import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { CanvasRenderer } from './renderer';
import { AudioManager } from './audio';
import { ParsedMidi, VisualizerSettings } from '../types';
import { buildUnifiedTimelineMidi, TimelineTiming } from './midi';
import { calculateFrameProgress } from '../core/timeline';

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  fps: number;
  etaSeconds: number;
  status: string;
}

export class VideoExporter {
  private isCancelled = false;

  public cancel() {
    this.isCancelled = true;
  }

  public async exportVideo(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    audioManager: AudioManager,
    midi: ParsedMidi,
    settings: VisualizerSettings,
    onProgress: (p: ExportProgress) => void,
    introMidi?: ParsedMidi | null
  ): Promise<Blob> {
    this.isCancelled = false;

    const fps = 60;
    const { unifiedMidi, timing } = buildUnifiedTimelineMidi(midi, introMidi || null, settings);
    const { hasIntro, introDuration, mainLoopDuration, secondsPerBar, introBars } = timing;
    const mainDuration = mainLoopDuration * (settings.exportLoops || 1);
    const duration = introDuration + mainDuration;
    const totalFrames = Math.floor(duration * fps);
    const audioBuffer = audioManager.getBuffer();

    // Check for WebCodecs support
    const hasWebCodecs = typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

    if (!hasWebCodecs) {
      console.warn('WebCodecs not supported, falling back to MediaRecorder export');
      return this.exportWithMediaRecorder(canvas, renderer, audioManager, unifiedMidi, settings, onProgress, timing);
    }

    try {
      return await this.exportWithWebCodecs(
        canvas,
        renderer,
        audioManager,
        unifiedMidi,
        settings,
        totalFrames,
        fps,
        duration,
        audioBuffer,
        onProgress,
        timing
      );
    } catch (err) {
      console.warn('WebCodecs failed, falling back to MediaRecorder:', err);
      return this.exportWithMediaRecorder(canvas, renderer, audioManager, unifiedMidi, settings, onProgress, timing);
    }
  }

  private async exportWithWebCodecs(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    audioManager: AudioManager,
    unifiedMidi: ParsedMidi,
    settings: VisualizerSettings,
    totalFrames: number,
    fps: number,
    duration: number,
    audioBuffer: AudioBuffer | null,
    onProgress: (p: ExportProgress) => void,
    timing: TimelineTiming
  ): Promise<Blob> {
    const target = new ArrayBufferTarget();

    // Setup Audio Encoder if supported
    let audioEncoder: AudioEncoder | null = null;
    let hasAudio = false;

    // Use standard 44.1kHz or 48kHz stereo for universal AAC compatibility
    const sampleRate = (audioBuffer && (audioBuffer.sampleRate === 48000 || audioBuffer.sampleRate === 44100))
      ? audioBuffer.sampleRate
      : 44100;
    const numberOfChannels = 2; // Always stereo (universal across all players and encoders)
    const audioBitrate = 192_000;

    const muxerOptions: ConstructorParameters<typeof Muxer>[0] = {
      target,
      video: {
        codec: 'avc',
        width: 1080,
        height: 1920,
      },
      fastStart: 'in-memory',
    };

    if (audioBuffer && typeof window.AudioEncoder === 'function') {
      try {
        const audioSupport = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          numberOfChannels,
          sampleRate,
          bitrate: audioBitrate,
        });

        if (audioSupport.supported) {
          muxerOptions.audio = {
            codec: 'aac',
            numberOfChannels,
            sampleRate,
          };
          hasAudio = true;
        } else {
          console.warn('AudioEncoder reported AAC not supported:', audioSupport);
        }
      } catch (e) {
        console.warn('AudioEncoder config check failed:', e);
      }
    }

    const muxer = new Muxer(muxerOptions);

    // Pick best supported H.264 profile
    const codecsToTry = [
      'avc1.640034', // High Profile Level 5.2
      'avc1.640028', // High Profile Level 4.0
      'avc1.4d002a', // Main Profile Level 4.2
      'avc1.42001f', // Baseline Profile Level 3.1
    ];
    let chosenCodec = 'avc1.4d002a';
    for (const c of codecsToTry) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: c,
          width: 1080,
          height: 1920,
          bitrate: 10_000_000,
          framerate: fps,
        });
        if (support.supported) {
          chosenCodec = c;
          break;
        }
      } catch {
        // try next
      }
    }

    // Initialize VideoEncoder
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('VideoEncoder error:', e),
    });

    videoEncoder.configure({
      codec: chosenCodec,
      width: 1080,
      height: 1920,
      bitrate: 10_000_000,
      framerate: fps,
    });

    if (hasAudio && audioBuffer) {
      try {
        let audioChunksCount = 0;
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            audioChunksCount++;
            muxer.addAudioChunk(chunk, meta);
          },
          error: (e) => console.error('AudioEncoder error:', e),
        });

        audioEncoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels,
          sampleRate,
          bitrate: audioBitrate,
        });

        // Encode audio buffer deterministically into AAC chunks matching exact video duration
        await this.encodeAudioBuffer(audioBuffer, audioEncoder, numberOfChannels, sampleRate, duration, settings.exportLoops || 1);
        await audioEncoder.flush();
        audioEncoder.close();
        audioEncoder = null; // Cleaned up
        console.log(`Audio encoding complete! Total AAC chunks muxed: ${audioChunksCount}`);
      } catch (audioErr) {
        console.error('Audio encoding failed:', audioErr);
      }
    }

    // Immediately notify UI that video frame encoding has started
    onProgress({
      currentFrame: 1,
      totalFrames,
      percent: 1,
      fps: 60,
      etaSeconds: Math.ceil(duration),
      status: 'Rendering & Encoding frames at 60 FPS...',
    });

    // Deterministic Video Frame Loop
    const startTime = performance.now();
    const frameDurationMicros = Math.round(1_000_000 / fps);

    // Enforce clean canvas export: Never draw safe-zone guide lines or UI helpers on the final exported video
    const exportCleanSettings: VisualizerSettings = {
      ...settings,
      showSafeZoneGuides: false,
    };

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (this.isCancelled) {
        throw new Error('Export cancelled by user');
      }

      // Safe non-blocking queue throttle: only pause if GPU queue is backed up
      if (videoEncoder.encodeQueueSize > 25) {
        await new Promise((r) => setTimeout(r, 8));
      }

      const currentTime = frameIndex / fps;
      const analysis = audioManager.getOfflineAnalysis(currentTime);

      // Render exact deterministic frame with seamless unified timeline and intro awareness
      const { loopTime, timingInfo } = calculateFrameProgress(currentTime, timing, exportCleanSettings, unifiedMidi);
      renderer.render(loopTime, unifiedMidi, analysis, exportCleanSettings, timingInfo);

      // Create video frame directly from canvas
      const timestampMicros = Math.round(frameIndex * frameDurationMicros);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicros,
        duration: frameDurationMicros,
      });

      // Insert keyframe every 2 seconds (120 frames at 60fps)
      videoEncoder.encode(videoFrame, { keyFrame: frameIndex % 120 === 0 });
      videoFrame.close();

      // Report progress periodically (every 8 frames gives smooth UI without slowing GPU encoding)
      if (frameIndex % 8 === 0 || frameIndex === totalFrames - 1) {
        const elapsedSecs = (performance.now() - startTime) / 1000;
        const currentSpeed = frameIndex / Math.max(0.01, elapsedSecs);
        const remainingFrames = totalFrames - frameIndex;
        const eta = remainingFrames / Math.max(1, currentSpeed);

        onProgress({
          currentFrame: frameIndex + 1,
          totalFrames,
          percent: Math.min(99, Math.round(((frameIndex + 1) / totalFrames) * 100)),
          fps: Math.round(currentSpeed),
          etaSeconds: Math.ceil(eta),
          status: 'Rendering & Encoding frames at 60 FPS...',
        });

        // Yield to browser UI thread to prevent freezing
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({
      currentFrame: totalFrames,
      totalFrames,
      percent: 99,
      fps: 60,
      etaSeconds: 0,
      status: 'Finalizing MP4 container...',
    });

    await videoEncoder.flush();
    videoEncoder.close();

    if (audioEncoder) {
      await audioEncoder.flush();
      audioEncoder.close();
    }

    muxer.finalize();

    const buffer = target.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  }

  private async encodeAudioBuffer(
    buffer: AudioBuffer,
    encoder: AudioEncoder,
    numberOfChannels: number,
    sampleRate: number,
    targetDuration: number,
    loops = 1
  ): Promise<void> {
    const totalSamples = Math.max(1, Math.round(targetDuration * sampleRate));
    const singleBufferSamples = Math.min(buffer.length, totalSamples);
    const chunkSize = 1024; // AAC-LC standard window size (1024 frames per chunk)

    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
    const fadeSamples = Math.round(sampleRate * 0.025); // 25ms anti-click micro fade out

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      if (this.isCancelled) return;

      const samplesRemaining = totalSamples - offset;
      const validFrames = Math.min(chunkSize, samplesRemaining);

      // Construct contiguous planar Float32Array: Plane 0 (Left 1024), Plane 1 (Right 1024)
      // Zero-initialized so the last frame is safely padded with silence
      const planarData = new Float32Array(chunkSize * 2);

      for (let i = 0; i < validFrames; i++) {
        const sampleInLoop = offset + i;
        const bufferIdx = sampleInLoop % singleBufferSamples;
        let s0 = ch0[bufferIdx];
        let s1 = ch1[bufferIdx];

        if (totalSamples - sampleInLoop <= fadeSamples) {
          const fade = Math.max(0, (totalSamples - sampleInLoop) / fadeSamples);
          s0 *= fade;
          s1 *= fade;
        }

        planarData[i] = s0;
        planarData[chunkSize + i] = s1;
      }

      const timestampMicros = Math.round((offset / sampleRate) * 1_000_000);
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: chunkSize, // Always exactly 1024 frames for AAC
        numberOfChannels: 2,
        timestamp: timestampMicros,
        data: planarData,
      });

      encoder.encode(audioData);
      audioData.close();
    }
  }

  /**
   * Universal Fallback using MediaRecorder for legacy browsers
   */
  private async exportWithMediaRecorder(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    audioManager: AudioManager,
    unifiedMidi: ParsedMidi,
    settings: VisualizerSettings,
    onProgress: (p: ExportProgress) => void,
    timing: TimelineTiming
  ): Promise<Blob> {
    const stream = canvas.captureStream(60);
    const mimeCandidates = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    let mimeType = '';
    for (const m of mimeCandidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
        mimeType = m;
        break;
      }
    }

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })
      : new MediaRecorder(stream);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (e) => reject(e);

      recorder.start(100);

      const { hasIntro, introDuration, mainLoopDuration, secondsPerBar, introBars } = timing;
      const mainDuration = mainLoopDuration * (settings.exportLoops || 1);
      const duration = introDuration + mainDuration;
      const totalFrames = Math.floor(duration * 60);
      let frame = 0;

      const exportCleanSettings: VisualizerSettings = {
        ...settings,
        showSafeZoneGuides: false,
      };

      const interval = setInterval(() => {
        if (this.isCancelled || frame >= totalFrames) {
          clearInterval(interval);
          recorder.stop();
          return;
        }

        const t = frame / 60;
        const analysis = audioManager.getOfflineAnalysis(t);

        const { loopTime, timingInfo } = calculateFrameProgress(t, timing, exportCleanSettings, unifiedMidi);
        renderer.render(loopTime, unifiedMidi, analysis, exportCleanSettings, timingInfo);

        frame++;

        onProgress({
          currentFrame: frame,
          totalFrames,
          percent: Math.round((frame / totalFrames) * 100),
          fps: 60,
          etaSeconds: Math.ceil((totalFrames - frame) / 60),
          status: 'Rendering fallback video...',
        });
      }, 1000 / 60);
    });
  }
}
