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

    // Pre-slice and render the exact, cut-to-size AudioBuffer for the exported video
    const exportAudioBuffer = audioManager.prepareExportAudioBuffer(timing, settings, introMidi || null, midi);

    // Create a dedicated off-screen 1080x1920 export canvas and renderer.
    // This completely isolates video frame generation from the live on-screen preview DOM canvas,
    // avoiding GPU resource lockups, compositing stalls, and preview thread interference.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1080;
    exportCanvas.height = 1920;
    const exportRenderer = new CanvasRenderer(exportCanvas);

    // Check for WebCodecs support
    const hasWebCodecs = typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

    if (!hasWebCodecs) {
      console.warn('WebCodecs not supported, falling back to MediaRecorder export');
      return this.exportWithMediaRecorder(exportCanvas, exportRenderer, audioManager, unifiedMidi, settings, onProgress, timing, exportAudioBuffer);
    }

    try {
      return await this.exportWithWebCodecs(
        exportCanvas,
        exportRenderer,
        audioManager,
        unifiedMidi,
        settings,
        totalFrames,
        fps,
        duration,
        exportAudioBuffer,
        onProgress,
        timing
      );
    } catch (err) {
      console.warn('WebCodecs failed, falling back to MediaRecorder:', err);
      return this.exportWithMediaRecorder(exportCanvas, exportRenderer, audioManager, unifiedMidi, settings, onProgress, timing, exportAudioBuffer);
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
    let chosenAudioCodec: 'aac' | 'opus' | null = null;
    let webCodecsAudioCodecName = 'mp4a.40.2';

    // Use standard 44.1kHz or 48kHz stereo matching export audio buffer
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
      firstTimestampBehavior: 'offset',
    };

    if (audioBuffer && typeof window.AudioEncoder === 'function') {
      try {
        const aacSupport = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          numberOfChannels,
          sampleRate,
          bitrate: audioBitrate,
        });

        if (aacSupport.supported) {
          chosenAudioCodec = 'aac';
          webCodecsAudioCodecName = 'mp4a.40.2';
        } else {
          const opusSupport = await AudioEncoder.isConfigSupported({
            codec: 'opus',
            numberOfChannels,
            sampleRate: 48000,
            bitrate: audioBitrate,
          });
          if (opusSupport.supported) {
            chosenAudioCodec = 'opus';
            webCodecsAudioCodecName = 'opus';
          }
        }

        if (chosenAudioCodec) {
          muxerOptions.audio = {
            codec: chosenAudioCodec,
            numberOfChannels,
            sampleRate: chosenAudioCodec === 'opus' ? 48000 : sampleRate,
          };
        } else {
          console.warn('AudioEncoder does not support AAC or Opus in this browser.');
        }
      } catch (e) {
        console.warn('AudioEncoder config check failed:', e);
      }
    }

    // If an audio buffer exists but WebCodecs cannot encode audio, fallback to MediaRecorder so video is never silent!
    if (audioBuffer && !chosenAudioCodec) {
      console.warn('Falling back to MediaRecorder to ensure audio is recorded into the video file.');
      return this.exportWithMediaRecorder(
        canvas,
        renderer,
        audioManager,
        unifiedMidi,
        settings,
        onProgress,
        timing,
        audioBuffer
      );
    }

    const muxer = new Muxer(muxerOptions);

    // Pick best supported H.264 profile (Main Profile 4.2 first for universal compatibility)
    const codecsToTry = [
      'avc1.4d002a', // Main Profile Level 4.2 (Universal standard for 1080p60 on Reels/Shorts/TikTok/Mac/iOS/Win)
      'avc1.64002a', // High Profile Level 4.2
      'avc1.640034', // High Profile Level 5.2
      'avc1.640028', // High Profile Level 4.0
      'avc1.420028', // Baseline Profile Level 4.0
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
          avc: { format: 'avc' },
        });
        if (support.supported) {
          chosenCodec = c;
          break;
        }
      } catch {
        // try next
      }
    }

    // Initialize VideoEncoder with robust error tracking
    let encoderError: Error | null = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addVideoChunk(chunk, meta);
        } catch (muxErr) {
          console.error('Muxer addVideoChunk error:', muxErr);
          encoderError = muxErr instanceof Error ? muxErr : new Error(String(muxErr));
        }
      },
      error: (e) => {
        console.error('VideoEncoder error:', e);
        encoderError = e instanceof Error ? e : new Error(String(e));
      },
    });

    videoEncoder.configure({
      codec: chosenCodec,
      width: 1080,
      height: 1920,
      bitrate: 10_000_000,
      framerate: fps,
      avc: { format: 'avc' },
    });

    if (chosenAudioCodec && audioBuffer) {
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
          codec: webCodecsAudioCodecName,
          numberOfChannels,
          sampleRate,
          bitrate: audioBitrate,
        });

        // Encode pre-cut audio buffer directly into AAC/Opus chunks matching exact video duration
        await this.encodeAudioBuffer(audioBuffer, audioEncoder, sampleRate);
        await audioEncoder.flush();
        try { audioEncoder.close(); } catch {}
        audioEncoder = null; // Cleaned up
        console.log(`Audio encoding complete! Total ${chosenAudioCodec.toUpperCase()} chunks muxed: ${audioChunksCount}`);
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
      if (encoderError) {
        throw encoderError;
      }

      // Safe non-blocking queue throttle: wait for encoder dequeue or small timeout
      while (videoEncoder.encodeQueueSize > 25) {
        if (this.isCancelled) throw new Error('Export cancelled by user');
        if (encoderError) throw encoderError;
        await Promise.race([
          new Promise((r) => videoEncoder.addEventListener('dequeue', r, { once: true })),
          new Promise((r) => setTimeout(r, 8))
        ]);
      }

      const currentTime = frameIndex / fps;
      const analysis = audioManager.getOfflineAnalysis(currentTime, audioBuffer);

      // Render exact deterministic frame with seamless unified timeline and intro awareness
      const { timingInfo } = calculateFrameProgress(currentTime, timing, exportCleanSettings, unifiedMidi);
      renderer.render(currentTime, unifiedMidi, analysis, exportCleanSettings, timingInfo);

      // Create video frame directly from canvas
      const timestampMicros = Math.round(frameIndex * frameDurationMicros);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicros,
        duration: frameDurationMicros,
      });

      // Insert keyframe every 2 seconds (120 frames at 60fps)
      videoEncoder.encode(videoFrame, { keyFrame: frameIndex % 120 === 0 });
      videoFrame.close();

      // Report progress periodically (every 4 frames gives smooth UI and lets GPU encode breathe)
      if (frameIndex % 4 === 0 || frameIndex === totalFrames - 1) {
        const elapsedSecs = (performance.now() - startTime) / 1000;
        const currentSpeed = frameIndex / Math.max(0.01, elapsedSecs);
        const effectiveFps = frameIndex > 8 ? (Math.round(currentSpeed) || 60) : 60;
        const remainingFrames = totalFrames - frameIndex;
        const eta = Math.ceil(remainingFrames / effectiveFps);

        onProgress({
          currentFrame: frameIndex + 1,
          totalFrames,
          percent: Math.min(99, Math.round(((frameIndex + 1) / totalFrames) * 100)),
          fps: effectiveFps,
          etaSeconds: eta,
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

    await Promise.race([
      videoEncoder.flush(),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
    try { videoEncoder.close(); } catch {}

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
    sampleRate: number
  ): Promise<void> {
    const totalSamples = buffer.length;
    const chunkSize = 1024; // AAC/Opus chunk size

    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      if (this.isCancelled) return;

      const samplesRemaining = totalSamples - offset;
      const validFrames = Math.min(chunkSize, samplesRemaining);

      // Planar Float32Array: Channel 0 (1024 samples), Channel 1 (1024 samples)
      const planarData = new Float32Array(chunkSize * 2);
      for (let i = 0; i < validFrames; i++) {
        planarData[i] = ch0[offset + i];
        planarData[chunkSize + i] = ch1[offset + i];
      }

      const timestampMicros = Math.round((offset / sampleRate) * 1_000_000);
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: chunkSize,
        numberOfChannels: 2,
        timestamp: timestampMicros,
        data: planarData,
      });

      encoder.encode(audioData);
      audioData.close();
    }
  }

  /**
   * Universal Fallback using MediaRecorder for legacy browsers (e.g. Firefox)
   * Captures both 60 FPS video canvas and synchronized stereo audio tracks!
   */
  private async exportWithMediaRecorder(
    canvas: HTMLCanvasElement,
    renderer: CanvasRenderer,
    audioManager: AudioManager,
    unifiedMidi: ParsedMidi,
    settings: VisualizerSettings,
    onProgress: (p: ExportProgress) => void,
    timing: TimelineTiming,
    audioBuffer: AudioBuffer | null
  ): Promise<Blob> {
    // 1. Prepare synchronized Audio Track for MediaRecorder
    let audioCtx: AudioContext | null = audioManager.getContext();
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (resumeErr) {
        console.warn('AudioContext resume warning:', resumeErr);
      }
    }

    let sourceNode: AudioBufferSourceNode | null = null;
    const tracks: MediaStreamTrack[] = [...canvas.captureStream(60).getVideoTracks()];

    if (audioBuffer) {
      try {
        const dest = audioCtx.createMediaStreamDestination();
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(dest);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          tracks.push(audioTrack);
        }
      } catch (audioInitErr) {
        console.warn('Failed to initialize AudioDestination for MediaRecorder:', audioInitErr);
      }
    }

    const combinedStream = new MediaStream(tracks);

    const mimeCandidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
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
      ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 12_000_000 })
      : new MediaRecorder(combinedStream);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      let isEnded = false;
      let animId = 0;

      const cleanupAudio = () => {
        if (isEnded) return;
        isEnded = true;
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
        if (sourceNode) {
          try { sourceNode.stop(); } catch {}
          sourceNode = null;
        }
      };

      recorder.onstop = () => {
        cleanupAudio();
        resolve(new Blob(chunks, { type: mimeType || 'video/mp4' }));
      };
      recorder.onerror = (e) => {
        cleanupAudio();
        reject(e);
      };

      recorder.start(100);
      if (sourceNode) {
        sourceNode.start(0);
      }

      const { hasIntro, introDuration, mainLoopDuration } = timing;
      const mainDuration = mainLoopDuration * (settings.exportLoops || 1);
      const duration = introDuration + mainDuration;
      const totalFrames = Math.floor(duration * 60);

      const exportCleanSettings: VisualizerSettings = {
        ...settings,
        showSafeZoneGuides: false,
      };

      const startTime = performance.now();

      const renderTick = () => {
        if (isEnded) return;

        if (this.isCancelled) {
          cleanupAudio();
          try { recorder.stop(); } catch {}
          reject(new Error('Export cancelled by user'));
          return;
        }

        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed >= duration) {
          cleanupAudio();
          try { recorder.stop(); } catch {}
          return;
        }

        try {
          const analysis = audioManager.getOfflineAnalysis(elapsed, audioBuffer);
          const { timingInfo } = calculateFrameProgress(elapsed, timing, exportCleanSettings, unifiedMidi);
          renderer.render(elapsed, unifiedMidi, analysis, exportCleanSettings, timingInfo);

          const curFrame = Math.min(totalFrames, Math.round(elapsed * 60));
          onProgress({
            currentFrame: curFrame,
            totalFrames,
            percent: Math.min(99, Math.round((elapsed / duration) * 100)),
            fps: 60,
            etaSeconds: Math.max(0, Math.ceil(duration - elapsed)),
            status: 'Recording synchronized video & audio stream...',
          });

          animId = requestAnimationFrame(renderTick);
        } catch (err) {
          cleanupAudio();
          try { recorder.stop(); } catch {}
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      animId = requestAnimationFrame(renderTick);
    });
  }
}
