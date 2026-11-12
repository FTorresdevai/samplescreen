import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { TimelineTiming, isMidiTimelineOffset } from './midi';
import { analyzeAudioWindow } from '../shared/fft';
import { MAX_AUDIO_DURATION_SECONDS } from '../core/validator';

export function createMockAudioBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number
): AudioBuffer {
  const channels: Float32Array[] = [];
  for (let c = 0; c < numberOfChannels; c++) {
    channels.push(new Float32Array(length));
  }
  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channels[ch] || channels[0],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  
  private startTime = 0;
  private pauseOffset = 0;
  private isPlayingState = false;
  private loopEndTime: number | null = null;
  private isLooping = true;
  private hasCustomFile = false;

  private fftData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));
  private waveformData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));

  // Cached offline channel data for deterministic export
  private originalRawBuffer: AudioBuffer | null = null;
  private channelDataLeft: Float32Array | null = null;
  private channelDataRight: Float32Array | null = null;
  private reusableOfflineWave: Uint8Array = new Uint8Array(1024);
  private reusableOfflineFFT: Uint8Array = new Uint8Array(512);
  private offlinePcmWindow = new Float32Array(2048);
  private offlinePrevSmoothed = new Float32Array(1024);
  private scratchSmoothed = new Float32Array(1024); // smoothing=0 path: never touches export state

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.9;
      this.gainNode.connect(this.ctx.destination);
      this.analyser.connect(this.gainNode);

      this.fftData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.waveformData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }
  }

  private createAudioBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer {
    if (this.ctx && typeof this.ctx.createBuffer === 'function') {
      return this.ctx.createBuffer(numberOfChannels, length, sampleRate);
    }
    return createMockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  public getContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  public isCustomAudio(): boolean {
    return this.hasCustomFile;
  }

  public clearCustomAudio() {
    this.hasCustomFile = false;
    this.originalRawBuffer = null;
    this.buffer = null;
    this.pauseOffset = 0;
    this.loopEndTime = null;
    this.channelDataLeft = null;
    this.channelDataRight = null;
    this.offlinePrevSmoothed.fill(0);
    this.stopSource();
    this.isPlayingState = false;
  }

  public async loadAudioFile(file: File): Promise<AudioBuffer> {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
    if (decoded.duration > MAX_AUDIO_DURATION_SECONDS) {
      const minutes = Math.floor(decoded.duration / 60);
      throw new Error(`Audio duration too long (${minutes} min). Maximum limit is 15 minutes to prevent memory overflow.`);
    }
    this.hasCustomFile = true;
    this.originalRawBuffer = decoded;
    this.setBuffer(decoded);
    return decoded;
  }

  public setBuffer(decoded: AudioBuffer) {
    if (this.hasCustomFile || !this.originalRawBuffer) {
      this.originalRawBuffer = decoded;
    }
    this.buffer = decoded;
    this.channelDataLeft = decoded.getChannelData(0);
    this.channelDataRight = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : this.channelDataLeft;
    this.pauseOffset = 0;
  }

  public getRawBuffer(): AudioBuffer | null {
    return this.originalRawBuffer || this.buffer;
  }

  public getRawDuration(): number {
    return this.originalRawBuffer ? this.originalRawBuffer.duration : (this.buffer ? this.buffer.duration : 0);
  }

  /**
   * Cuts/trims the audio based on musical bars and BPM directly in the browser.
   * @param startBar 1-based bar number to start the loop from (e.g. 1, 5, 9, 17)
   * @param numBars Number of bars to loop (e.g. 4, 8, 16)
   * @param bpm Beats Per Minute
   */
  public trimToBars(
    startBar: number,
    numBars: number,
    bpm: number
  ): { startSec: number; durationSec: number; totalBars: number; totalAvailableBars: number } | null {
    this.init();
    const raw = this.originalRawBuffer || this.buffer;
    if (!raw) return null;
    if (!this.originalRawBuffer) {
      this.originalRawBuffer = raw;
    }

    const secondsPerBar = (60 / Math.max(20, bpm || 120)) * 4;
    const totalAvailableBars = Math.max(1, Math.floor(raw.duration / secondsPerBar));
    const safeStartBar = Math.max(1, Math.min(startBar, totalAvailableBars));
    const startSec = (safeStartBar - 1) * secondsPerBar;
    const maxPossibleBars = Math.max(1, Math.floor((raw.duration - startSec) / secondsPerBar));
    const safeNumBars = Math.max(1, Math.min(numBars, maxPossibleBars));
    const durationSec = safeNumBars * secondsPerBar;

    const sampleRate = raw.sampleRate;
    const startSample = Math.round(startSec * sampleRate);
    const numSamples = Math.round(durationSec * sampleRate);

    // Create a new sliced AudioBuffer with precision
    const trimmed = this.createAudioBuffer(
      raw.numberOfChannels,
      numSamples,
      sampleRate
    );

    // 3ms Hann micro-fade at loop boundaries to prevent clicks/pops
    const microFadeSamples = Math.min(Math.round(sampleRate * 0.003), Math.floor(numSamples / 8));

    for (let ch = 0; ch < raw.numberOfChannels; ch++) {
      const srcData = raw.getChannelData(ch);
      const dstData = trimmed.getChannelData(ch);
      const copyLen = Math.min(numSamples, Math.max(0, srcData.length - startSample));
      for (let i = 0; i < copyLen; i++) {
        dstData[i] = srcData[startSample + i];
      }

      // Smooth loop boundaries
      if (microFadeSamples > 0) {
        for (let i = 0; i < microFadeSamples; i++) {
          const gain = 0.5 * (1 - Math.cos((Math.PI * i) / microFadeSamples));
          dstData[i] *= gain;
          const endIdx = numSamples - 1 - i;
          if (endIdx >= 0) {
            dstData[endIdx] *= gain;
          }
        }
      }
    }

    this.buffer = trimmed;
    this.channelDataLeft = trimmed.getChannelData(0);
    this.channelDataRight = trimmed.numberOfChannels > 1 ? trimmed.getChannelData(1) : this.channelDataLeft;
    this.pauseOffset = 0;
    this.loopEndTime = durationSec;

    if (this.isPlayingState) {
      this.play(0);
    }

    return {
      startSec,
      durationSec,
      totalBars: safeNumBars,
      totalAvailableBars,
    };
  }

  public resetTrim(): number {
    if (this.originalRawBuffer) {
      this.buffer = this.originalRawBuffer;
      this.channelDataLeft = this.originalRawBuffer.getChannelData(0);
      this.channelDataRight = this.originalRawBuffer.numberOfChannels > 1 ? this.originalRawBuffer.getChannelData(1) : this.channelDataLeft;
      this.pauseOffset = 0;
      this.loopEndTime = this.originalRawBuffer.duration;
      if (this.isPlayingState) {
        this.play(0);
      }
      return this.originalRawBuffer.duration;
    }
    return this.buffer ? this.buffer.duration : 0;
  }

  public getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  public getDuration(): number {
    return this.buffer ? this.buffer.duration : 0;
  }

  public setLoopEndTime(seconds: number | null) {
    const target = seconds && seconds > 0 ? seconds : null;
    if (this.loopEndTime === target) return;
    this.loopEndTime = target;
    if (this.source && this.isPlayingState) {
      const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
        ? this.loopEndTime
        : (this.buffer ? this.buffer.duration : 0);
      if (this.isLooping) {
        this.source.loopEnd = maxAllowed;
      }
    }
  }

  public getLoopEndTime(): number | null {
    return this.loopEndTime;
  }

  public setLooping(enabled: boolean) {
    this.isLooping = enabled;
    if (this.source && this.isPlayingState) {
      const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
        ? this.loopEndTime
        : (this.buffer ? this.buffer.duration : 0);
      this.source.loop = enabled;
      if (enabled) {
        this.source.loopStart = 0;
        this.source.loopEnd = maxAllowed;
        this.source.onended = null;
      }
    }
  }

  public isLoopingEnabled(): boolean {
    return this.isLooping;
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public async play(fromTime?: number): Promise<void> {
    if (!this.buffer) return;
    this.init();

    // Ensure AudioContext is resumed before scheduling audio
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[SampleScreen] AudioContext resume error:', err);
      }
    }

    if (this.isPlayingState) {
      this.stopSource();
    }

    // Ensure gain is audible
    if (this.gainNode && this.ctx) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0.9, this.ctx.currentTime);
      } catch {}
    }

    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : this.buffer.duration;

    if (typeof fromTime === 'number') {
      this.pauseOffset = Math.max(0, Math.min(fromTime, maxAllowed));
    } else if (this.pauseOffset >= maxAllowed - 0.02) {
      this.pauseOffset = 0;
    }

    const playDuration = Math.max(0, maxAllowed - this.pauseOffset);
    if (playDuration <= 0) {
      this.pauseOffset = 0;
      if (!this.isLooping) {
        this.isPlayingState = false;
        return;
      }
    }

    this.source = this.ctx!.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.analyser!);

    this.startTime = this.ctx!.currentTime - this.pauseOffset;

    if (this.isLooping) {
      this.source.loop = true;
      this.source.loopStart = 0;
      this.source.loopEnd = maxAllowed;
      this.source.start(0, this.pauseOffset);
    } else {
      this.source.loop = false;
      const effectiveDuration = Math.max(0.01, maxAllowed - this.pauseOffset);
      this.source.start(0, this.pauseOffset, effectiveDuration);
      this.source.onended = () => {
        if (this.isPlayingState) {
          this.pauseOffset = maxAllowed;
          this.stopSource();
          this.isPlayingState = false;
        }
      };
    }
    this.isPlayingState = true;
  }

  public pause() {
    if (!this.isPlayingState) return;
    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : (this.buffer ? this.buffer.duration : 0);
    this.pauseOffset = Math.min(this.getCurrentTime(), maxAllowed);
    this.isPlayingState = false;

    // Immediately mute gain to cut any audible tail or hardware output buffer
    if (this.gainNode && this.ctx) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {}
    }

    this.stopSource();

    // Suspend AudioContext to immediately halt hardware processing without delay
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public seek(seconds: number, autoPlay: boolean = true) {
    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : this.getDuration();
    if (maxAllowed <= 0) return;
    const clamped = Math.max(0, Math.min(seconds, maxAllowed));
    this.pauseOffset = clamped;
    if (this.isPlayingState && autoPlay) {
      this.play(clamped);
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlayingState) {
      return this.pauseOffset;
    }
    const elapsed = this.ctx!.currentTime - this.startTime;
    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : (this.buffer ? this.buffer.duration : 0);

    if (maxAllowed > 0 && elapsed >= maxAllowed) {
      if (this.isLooping) {
        return elapsed % maxAllowed;
      }
      return maxAllowed;
    }
    return Math.max(0, elapsed);
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch {
        // already stopped
      }
      this.source = null;
    }
  }

  /**
   * Real-time analysis extraction from live AnalyserNode
   */
  public getRealtimeAnalysis(): AudioAnalysis {
    if (this.analyser && this.isPlayingState) {
      this.analyser.getByteFrequencyData(this.fftData);
      this.analyser.getByteTimeDomainData(this.waveformData);

      // Extract frequency bands (FFT size 2048, 1024 bins, ~21.5 Hz per bin at 44.1kHz)
      // Bass: 20Hz - 250Hz (bins 1 to 12)
      let bassSum = 0;
      for (let i = 1; i <= 12; i++) bassSum += this.fftData[i];
      const bass = Math.min(1, (bassSum / 12) / 255);

      // Mid: 250Hz - 4000Hz (bins 13 to 186)
      let midSum = 0;
      for (let i = 13; i <= 186; i++) midSum += this.fftData[i];
      const mid = Math.min(1, (midSum / (186 - 13)) / 255);

      // Treble: 4000Hz - 16000Hz (bins 187 to 744)
      let trebleSum = 0;
      for (let i = 187; i <= 744; i++) trebleSum += this.fftData[i];
      const treble = Math.min(1, (trebleSum / (744 - 187)) / 255);

      // RMS calculation
      let sumSquares = 0;
      for (let i = 0; i < this.waveformData.length; i++) {
        const norm = (this.waveformData[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.min(1, Math.sqrt(sumSquares / this.waveformData.length) * 2.2);

      return {
        fft: this.fftData,
        waveform: this.waveformData,
        bass,
        mid,
        treble,
        rms,
      };
    }

    // When paused or scrubbing: Compute deterministic analysis from buffer at current pause/scrub position!
    if (this.buffer) {
      // No smoothing while paused/scrubbing: each position is analysed on its own, so
      // seeking backwards never inherits decayed state (waveform stays visible).
      return this.getOfflineAnalysis(this.getCurrentTime(), null, 0);
    }

    // Default resting values if no audio buffer loaded
    return {
      fft: new Uint8Array(512),
      waveform: new Uint8Array(512).fill(128),
      bass: 0,
      mid: 0,
      treble: 0,
      rms: 0,
    };
  }

  public resetOfflineAnalysisState() {
    this.offlinePrevSmoothed.fill(0);
  }

  /**
   * Deterministic Offline Analysis at any exact timestamp.
   * Runs the exact same Radix-2 FFT and smoothing as AnalyserNode.
   */
  public getOfflineAnalysis(time: number, customBuffer?: AudioBuffer | null, smoothing = 0.8): AudioAnalysis {
    const activeBuf = customBuffer || this.buffer;
    if (!activeBuf) {
      return this.getRealtimeAnalysis();
    }

    const sampleRate = activeBuf.sampleRate;
    const centerSample = Math.floor(time * sampleRate);
    const windowSize = 2048;
    const halfWindow = windowSize / 2;
    const startSample = centerSample - halfWindow;

    const left = customBuffer ? customBuffer.getChannelData(0) : this.channelDataLeft!;
    const right = (customBuffer && customBuffer.numberOfChannels > 1)
      ? customBuffer.getChannelData(1)
      : (this.channelDataRight || left);

    const pcmWindow = this.offlinePcmWindow;
    const tempWave = this.reusableOfflineWave;

    for (let i = 0; i < windowSize; i++) {
      const idx = startSample + i;
      let val = 0;
      if (idx >= 0 && idx < left.length) {
        const raw = (left[idx] + right[idx]) * 0.5;
        val = Number.isFinite(raw) ? raw : 0;
      }
      pcmWindow[i] = val;

      if (i < 1024) {
        tempWave[i] = Math.max(0, Math.min(255, Math.floor((val + 1) * 127.5)));
      }
    }

    let prevSmoothed = this.offlinePrevSmoothed;
    if (smoothing === 0) {
      prevSmoothed = this.scratchSmoothed;
      prevSmoothed.fill(0);
    }
    const { bass, mid, treble, rms } = analyzeAudioWindow(
      pcmWindow,
      prevSmoothed,
      this.reusableOfflineFFT,
      smoothing
    );

    return {
      fft: this.reusableOfflineFFT,
      waveform: tempWave,
      bass,
      mid,
      treble,
      rms,
    };
  }

  /**
   * Generates a combined AudioBuffer containing an optional Intro progression (1-8 bars)
   * followed seamlessly by the Main loop progression.
   */
  public generateCombinedAudioBuffer(
    introMidi: ParsedMidi | null,
    mainMidi: ParsedMidi,
    enableIntro: boolean,
    introBarsCount: number = 1
  ): AudioBuffer {
    if (!enableIntro || !introMidi) {
      return this.generateDemoAudioBuffer(mainMidi);
    }

    this.init();
    const bpm = mainMidi.bpm || 80;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4;
    const sampleRate = 44100;

    const actualIntroBars = (enableIntro && introMidi) ? (introBarsCount || introMidi.totalBars || 1) : 0;
    const introDuration = actualIntroBars * secondsPerBar;
    const actualMainBars = mainMidi.totalBars || 8;
    const mainDuration = actualMainBars * secondsPerBar;
    const totalDuration = introDuration + mainDuration;
    const numSamples = Math.ceil(totalDuration * sampleRate);

    const buffer = this.ctx!.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // 1. Synthesize Intro Notes (0 to introDuration, clamped so it resolves at the drop)
    const clampedIntroNotes = introMidi.notes
      .filter(n => n.time < introDuration)
      .map(n => ({
        ...n,
        duration: Math.min(n.duration, Math.max(0.08, introDuration - n.time)),
      }));
    synthesizeNotesToChannels(left, right, clampedIntroNotes, 0, sampleRate);

    // 2. Synthesize Main Notes starting precisely at introDuration
    const { isOffset: isAlreadyTimelineOffset, firstNoteTime: firstMainTime } = isMidiTimelineOffset(mainMidi.notes, introDuration);
    const mainOffset = isAlreadyTimelineOffset ? (introDuration - firstMainTime) : introDuration;
    synthesizeNotesToChannels(left, right, mainMidi.notes, mainOffset, sampleRate);

    // 2.1 Add Analog Filtered Noise Riser on final bar of intro
    const lastBarStartSec = Math.max(0, introDuration - (secondsPerBeat * 4));
    const riserStartSec = lastBarStartSec + secondsPerBeat * 1.5;
    const riserDur = introDuration - riserStartSec;
    const riserSamples = Math.floor(riserDur * sampleRate);
    const riserStartSample = Math.floor(riserStartSec * sampleRate);

    for (let i = 0; i < riserSamples; i++) {
      const sIdx = riserStartSample + i;
      if (sIdx >= numSamples) break;
      const tNorm = i / riserSamples;
      const amp = Math.pow(tNorm, 2.2) * 0.16;
      const noise = (Math.random() * 2 - 1);
      const sweepFreq = 300 + Math.pow(tNorm, 3) * 3200;
      const resonance = Math.sin(2 * Math.PI * sweepFreq * (i / sampleRate));
      const riserVal = (noise * 0.6 + resonance * 0.4) * amp;

      left[sIdx] += riserVal * 0.8;
      right[sIdx] += riserVal * 0.8;
    }

    // 3. Synthesize 808 Sub Kicks (Drop on bar downbeats)
    const totalBars = actualIntroBars + actualMainBars;
    synthesizeKicksToChannels(left, right, bpm, totalBars, sampleRate, 0, actualIntroBars);

    // Soft clip limiter
    applySoftClipLimiter(left, right);

    this.setBuffer(buffer);
    this.setLoopEndTime(totalDuration);
    return buffer;
  }

  /**
   * Generates a warm, authentic 8-bar analog synth loop as an AudioBuffer
   * matching the demo MIDI sequence.
   */
  public generateDemoAudioBuffer(midi: ParsedMidi): AudioBuffer {
    this.init();
    const sampleRate = 44100;
    const duration = midi.duration || 16;
    const numSamples = Math.ceil(duration * sampleRate);

    const buffer = this.ctx!.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Synthesize notes and kicks
    synthesizeNotesToChannels(left, right, midi.notes, 0, sampleRate);
    synthesizeKicksToChannels(left, right, midi.bpm || 80, midi.totalBars || 8, sampleRate, 0, 0);
    applySoftClipLimiter(left, right);

    this.setBuffer(buffer);
    this.setLoopEndTime(duration);
    return buffer;
  }

  /**
   * Pre-slices and renders an exact, cut-to-size AudioBuffer for the exported video.
   * Completely solves the issue of extensive uncut audio samples, ensuring that:
   * 1. Total duration matches the video down to the exact sample.
   * 2. Loops repeat seamlessly if exportLoops > 1.
   * 3. Trim start bar is respected.
   * 4. Intro section is seamlessly prepended if enabled.
   * 5. Zero CPU overhead during frame encoding.
   */
  public prepareExportAudioBuffer(
    timing: TimelineTiming,
    settings: VisualizerSettings,
    introMidi?: ParsedMidi | null,
    mainMidi?: ParsedMidi | null
  ): AudioBuffer | null {
    this.init();
    if (!this.ctx) return null;

    const { hasIntro, introDuration, mainLoopDuration, secondsPerBar } = timing;
    const exportLoops = Math.max(1, settings.exportLoops || 1);
    const totalDuration = introDuration + mainLoopDuration * exportLoops;
    if (totalDuration <= 0) return null;

    // Use raw uploaded sample if available, or current buffer
    const source = this.originalRawBuffer || this.buffer;
    if (!source) {
      if (mainMidi) {
        return this.generateCombinedAudioBuffer(
          hasIntro ? (introMidi || null) : null,
          mainMidi,
          hasIntro,
          timing.introBars
        );
      }
      return null;
    }

    const sampleRate = source.sampleRate;
    const totalSamples = Math.max(1, Math.round(totalDuration * sampleRate));
    const target = this.createAudioBuffer(2, totalSamples, sampleRate);
    const outL = target.getChannelData(0);
    const outR = target.getChannelData(1);

    const srcL = source.getChannelData(0);
    const srcR = source.numberOfChannels > 1 ? source.getChannelData(1) : srcL;

    const isCustomSample = this.hasCustomFile;

    if (isCustomSample || settings.isAudioTrimmed) {
      const srcBuffer = settings.isAudioTrimmed ? (this.buffer || source) : (this.originalRawBuffer || source);
      const curSrcL = srcBuffer.getChannelData(0);
      const curSrcR = srcBuffer.numberOfChannels > 1 ? srcBuffer.getChannelData(1) : curSrcL;

      const startBar = Math.max(1, settings.audioTrimStartBar || 1);
      const startSec = settings.isAudioTrimmed ? 0 : (startBar - 1) * secondsPerBar;
      const startSample = Math.round(startSec * sampleRate);
      const loopSamples = Math.round(mainLoopDuration * sampleRate);
      const introSamples = (hasIntro && introDuration > 0) ? Math.round(introDuration * sampleRate) : 0;

      // 1. Handle Intro (Guaranteed non-silent even if startSample < introSamples)
      if (hasIntro && introSamples > 0) {
        if (startSample >= introSamples) {
          const preDropStart = startSample - introSamples;
          for (let i = 0; i < introSamples; i++) {
            const idx = (preDropStart + i) % curSrcL.length;
            outL[i] = curSrcL[idx];
            outR[i] = curSrcR[idx];
          }
        } else {
          // Prepend from start of sample with smooth riser swell into the drop
          for (let i = 0; i < introSamples; i++) {
            const idx = i % curSrcL.length;
            const env = 0.45 + 0.55 * (i / introSamples);
            outL[i] = curSrcL[idx] * env;
            outR[i] = curSrcR[idx] * env;
          }
        }
      }

      // 2. Fill Main Loop (repeat exportLoops times)
      for (let l = 0; l < exportLoops; l++) {
        const loopOffset = introSamples + l * loopSamples;
        for (let i = 0; i < loopSamples; i++) {
          const outIdx = loopOffset + i;
          if (outIdx >= totalSamples) break;
          const srcIdx = (startSample + i) % curSrcL.length;
          outL[outIdx] = curSrcL[srcIdx];
          outR[outIdx] = curSrcR[srcIdx];
        }
      }
    } else {
      // Generated demo synth audio: generate exact intro + main drop progression
      const demoBuffer = this.generateCombinedAudioBuffer(
        hasIntro ? (introMidi || null) : null,
        mainMidi || { notes: [], totalBars: 8, duration: 16, bpm: 80 },
        hasIntro,
        timing.introBars
      );
      const dL = demoBuffer.getChannelData(0);
      const dR = demoBuffer.numberOfChannels > 1 ? demoBuffer.getChannelData(1) : dL;

      const introSamples = (hasIntro && introDuration > 0) ? Math.round(introDuration * sampleRate) : 0;
      const loopSamples = Math.round(mainLoopDuration * sampleRate);

      // Copy Intro once
      for (let i = 0; i < introSamples && i < totalSamples; i++) {
        outL[i] = dL[i % dL.length];
        outR[i] = dR[i % dR.length];
      }

      // Copy Main loop (repeat exportLoops times)
      for (let l = 0; l < exportLoops; l++) {
        const loopOffset = introSamples + l * loopSamples;
        for (let i = 0; i < loopSamples; i++) {
          const outIdx = loopOffset + i;
          if (outIdx >= totalSamples) break;
          const srcIdx = (introSamples + (i % Math.max(1, dL.length - introSamples))) % dL.length;
          outL[outIdx] = dL[srcIdx];
          outR[outIdx] = dR[srcIdx];
        }
      }
    }

    // 3. Clean loop boundaries and micro-fades to eliminate clicks/pops
    if (!hasIntro) {
      const fadeInSamples = Math.min(Math.round(sampleRate * 0.005), totalSamples);
      for (let f = 0; f < fadeInSamples; f++) {
        const gain = 0.5 * (1 - Math.cos((Math.PI * f) / fadeInSamples));
        outL[f] *= gain;
        outR[f] *= gain;
      }
    }

    // 25ms Anti-click micro fade out at the very end
    const fadeSamples = Math.min(Math.round(sampleRate * 0.025), totalSamples);
    for (let f = 0; f < fadeSamples; f++) {
      const idx = totalSamples - 1 - f;
      if (idx >= 0) {
        const gain = 0.5 * (1 - Math.cos((Math.PI * f) / fadeSamples));
        outL[idx] *= gain;
        outR[idx] *= gain;
      }
    }

    return target;
  }
}

function synthesizeNotesToChannels(
  left: Float32Array,
  right: Float32Array,
  notes: MidiNote[],
  timeOffsetSecs: number,
  sampleRate: number
) {
  const numSamples = left.length;
  notes.forEach(note => {
    const startSample = Math.floor((note.time + timeOffsetSecs) * sampleRate);
    const noteSamples = Math.floor(note.duration * sampleRate);
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

    const pan = (note.midi - 60) / 40; // -1 to 1
    const leftGain = Math.cos((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;
    const rightGain = Math.sin((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;

    for (let i = 0; i < noteSamples; i++) {
      const sampleIdx = startSample + i;
      if (sampleIdx >= numSamples) break;

      const t = i / sampleRate;
      const attack = 0.04;
      const release = 0.2;
      let env = 1.0;
      if (t < attack) env = t / attack;
      else if (t > note.duration - release) {
        env = Math.max(0, (note.duration - t) / release);
      }

      const osc1 = ((t * freq) % 1) * 2 - 1;
      const osc2 = ((t * (freq * 1.003)) % 1) * 2 - 1;
      const tri = Math.asin(Math.sin(2 * Math.PI * freq * t)) * (2 / Math.PI);
      const raw = (osc1 * 0.4 + osc2 * 0.4 + tri * 0.3) * env;

      left[sampleIdx] += raw * leftGain;
      right[sampleIdx] += raw * rightGain;
    }
  });
}

function synthesizeKicksToChannels(
  left: Float32Array,
  right: Float32Array,
  bpm: number,
  totalBars: number,
  sampleRate: number,
  offsetSecs: number = 0,
  introBars: number = 0
) {
  const numSamples = left.length;
  const secondsPerBeat = 60 / bpm;
  for (let bar = 0; bar < totalBars; bar++) {
    const isIntroBar = bar < introBars;
    const kickVol = isIntroBar ? 0.18 : 0.40;
    const beatTimes = isIntroBar ? [bar * 4] : [bar * 4, bar * 4 + 2.5];

    beatTimes.forEach(b => {
      const startTime = offsetSecs + b * secondsPerBeat;
      const kickStart = Math.floor(startTime * sampleRate);
      const kickLen = Math.floor(0.45 * sampleRate);

      for (let i = 0; i < kickLen; i++) {
        const sIdx = kickStart + i;
        if (sIdx >= numSamples) break;
        const t = i / sampleRate;
        const kFreq = 85 * Math.exp(-t * 9) + 38;
        const kEnv = Math.exp(-t * 7);
        const kickVal = Math.sin(2 * Math.PI * kFreq * t) * kEnv * kickVol;

        left[sIdx] += kickVal;
        right[sIdx] += kickVal;
      }
    });
  }
}

function applySoftClipLimiter(left: Float32Array, right: Float32Array) {
  const numSamples = left.length;
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.tanh(left[i] * 1.2);
    right[i] = Math.tanh(right[i] * 1.2);
  }
}

export const audioManager = new AudioManager();
