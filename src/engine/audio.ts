import { AudioAnalysis, ParsedMidi, VisualizerSettings } from '../types';
import { TimelineTiming } from './midi';

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

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
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
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  public isCustomAudio(): boolean {
    return this.hasCustomFile;
  }

  public async loadAudioFile(file: File): Promise<AudioBuffer> {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
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
    const raw = this.originalRawBuffer || this.buffer;
    if (!raw || !this.ctx) return null;

    const secondsPerBar = (60 / Math.max(20, bpm || 120)) * 4;
    const totalAvailableBars = Math.max(1, Math.floor(raw.duration / secondsPerBar));
    const safeStartBar = Math.max(1, Math.min(startBar, totalAvailableBars));
    const startSec = (safeStartBar - 1) * secondsPerBar;
    const maxPossibleBars = Math.max(1, Math.floor((raw.duration - startSec) / secondsPerBar));
    const safeNumBars = Math.max(1, Math.min(numBars, maxPossibleBars));
    const durationSec = safeNumBars * secondsPerBar;

    const sampleRate = raw.sampleRate;
    const startSample = Math.floor(startSec * sampleRate);
    const numSamples = Math.floor(durationSec * sampleRate);

    // Create a new sliced AudioBuffer with precision
    const trimmed = this.ctx.createBuffer(
      raw.numberOfChannels,
      numSamples,
      sampleRate
    );

    for (let ch = 0; ch < raw.numberOfChannels; ch++) {
      const srcData = raw.getChannelData(ch);
      const dstData = trimmed.getChannelData(ch);
      const copyLen = Math.min(numSamples, Math.max(0, srcData.length - startSample));
      for (let i = 0; i < copyLen; i++) {
        dstData[i] = srcData[startSample + i];
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
    this.loopEndTime = seconds && seconds > 0 ? seconds : null;
    if (this.isPlayingState) {
      // Re-trigger play from current offset so Web Audio schedule matches new endpoint
      const cur = this.getCurrentTime();
      this.play(cur);
    }
  }

  public getLoopEndTime(): number | null {
    return this.loopEndTime;
  }

  public setLooping(enabled: boolean) {
    this.isLooping = enabled;
  }

  public isLoopingEnabled(): boolean {
    return this.isLooping;
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public play(fromTime?: number) {
    if (!this.buffer) return;
    this.init();
    if (this.isPlayingState) {
      this.stopSource();
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
    
    // Explicit duration tells browser Web Audio engine to STOP at exactly maxAllowed!
    // Never allows audio to overflow into silence or reverb tail!
    const effectiveDuration = Math.max(0.01, maxAllowed - this.pauseOffset);
    this.source.start(0, this.pauseOffset, effectiveDuration);
    this.isPlayingState = true;

    this.source.onended = () => {
      // Triggered when effectiveDuration finishes playing
      if (this.isPlayingState) {
        if (this.isLooping) {
          // Seamless musical loop back to beginning
          this.pauseOffset = 0;
          this.play(0);
        } else {
          this.pauseOffset = maxAllowed;
          this.stopSource();
          this.isPlayingState = false;
        }
      }
    };
  }

  public pause() {
    if (!this.isPlayingState) return;
    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : (this.buffer ? this.buffer.duration : 0);
    this.pauseOffset = Math.min(this.getCurrentTime(), maxAllowed);
    this.isPlayingState = false;
    this.stopSource();
  }

  public seek(seconds: number) {
    const maxAllowed = this.loopEndTime !== null && this.loopEndTime > 0
      ? this.loopEndTime
      : this.getDuration();
    if (maxAllowed <= 0) return;
    const clamped = Math.max(0, Math.min(seconds, maxAllowed));
    this.pauseOffset = clamped;
    if (this.isPlayingState) {
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

    // Default resting values
    return {
      fft: new Uint8Array(512),
      waveform: new Uint8Array(512).fill(128),
      bass: 0,
      mid: 0,
      treble: 0,
      rms: 0,
    };
  }

  /**
   * Deterministic Offline Analysis at any exact timestamp.
   * Crucial for 60 FPS offline export without audio glitch or frame drop!
   */
  public getOfflineAnalysis(time: number, customBuffer?: AudioBuffer | null): AudioAnalysis {
    const activeBuf = customBuffer || this.buffer;
    if (!activeBuf) {
      return this.getRealtimeAnalysis();
    }

    const sampleRate = activeBuf.sampleRate;
    const centerSample = Math.floor(time * sampleRate);
    const windowSize = 2048;
    const halfWindow = windowSize / 2;
    const startSample = Math.max(0, centerSample - halfWindow);

    const tempWave = this.reusableOfflineWave;
    let sumSquares = 0;
    let bassApprox = 0;
    let midApprox = 0;
    let trebleApprox = 0;

    const left = customBuffer ? customBuffer.getChannelData(0) : this.channelDataLeft!;
    const right = (customBuffer && customBuffer.numberOfChannels > 1)
      ? customBuffer.getChannelData(1)
      : (this.channelDataRight || left);

    for (let i = 0; i < 1024; i++) {
      const idx = startSample + i * 2;
      let val = 0;
      if (idx < left.length) {
        const raw = (left[idx] + right[idx]) * 0.5;
        val = Number.isFinite(raw) ? raw : 0;
      }
      tempWave[i] = Math.max(0, Math.min(255, Math.floor((val + 1) * 127.5)));
      sumSquares += val * val;

      // Approximate frequency energy through simple gradient & diff
      if (i > 1) {
        const prev = (left[idx - 2] + right[idx - 2]) * 0.5;
        const diff = Math.abs(val - (Number.isFinite(prev) ? prev : 0));
        trebleApprox += Number.isFinite(diff) ? diff : 0;
      }
      bassApprox += Math.abs(val);
    }

    const safeSumSquares = Number.isFinite(sumSquares) ? sumSquares : 0;
    const safeBassApprox = Number.isFinite(bassApprox) ? bassApprox : 0;
    const safeTrebleApprox = Number.isFinite(trebleApprox) ? trebleApprox : 0;

    const rms = Math.min(1, Math.sqrt(safeSumSquares / 1024) * 2.5) || 0;
    const bass = Math.min(1, (safeBassApprox / 1024) * 2.8) || 0;
    const treble = Math.min(1, (safeTrebleApprox / 1024) * 4.0) || 0;
    const mid = Math.min(1, (rms + bass * 0.4 + treble * 0.4) * 0.8) || 0;

    // Synthesize pseudo-FFT bins for visualization during offline frame rendering
    const pseudoFFT = this.reusableOfflineFFT;
    for (let i = 0; i < 512; i++) {
      let weight = 0;
      if (i < 30) weight = bass * 220;
      else if (i < 150) weight = mid * 180;
      else weight = treble * 140;

      const safeTime = Number.isFinite(time) ? time : 0;
      const noise = (Math.sin(i * 12.3 + safeTime * 40) + 1) * 0.2;
      const binVal = Math.floor(weight * (0.8 + noise));
      pseudoFFT[i] = Math.max(0, Math.min(255, Number.isFinite(binVal) ? binVal : 0));
    }

    return {
      fft: pseudoFFT,
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

    const renderMidiNotesToBuffer = (notes: typeof mainMidi.notes, timeOffsetSecs: number) => {
      notes.forEach(note => {
        const startSample = Math.floor((note.time + timeOffsetSecs) * sampleRate);
        const noteSamples = Math.floor(note.duration * sampleRate);
        const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

        // Stereo pan based on pitch
        const pan = (note.midi - 60) / 40; // -1 to 1
        const leftGain = Math.cos((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;
        const rightGain = Math.sin((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;

        for (let i = 0; i < noteSamples; i++) {
          const sampleIdx = startSample + i;
          if (sampleIdx >= numSamples) break;

          const t = i / sampleRate;
          // ADSR Envelope
          const attack = 0.04;
          const release = 0.2;
          let env = 1.0;
          if (t < attack) env = t / attack;
          else if (t > note.duration - release) {
            env = Math.max(0, (note.duration - t) / release);
          }

          // Warm dual-saw + triangle analog voice
          const osc1 = ((t * freq) % 1) * 2 - 1;
          const osc2 = ((t * (freq * 1.003)) % 1) * 2 - 1; // slight detune
          const tri = Math.asin(Math.sin(2 * Math.PI * freq * t)) * (2 / Math.PI);

          // Lowpass filter emulation (warm harmonics)
          const raw = (osc1 * 0.4 + osc2 * 0.4 + tri * 0.3) * env;

          left[sampleIdx] += raw * leftGain;
          right[sampleIdx] += raw * rightGain;
        }
      });
    };

    // 1. Synthesize Intro Notes (0 to introDuration, clamped so it resolves at the drop)
    const clampedIntroNotes = introMidi.notes
      .filter(n => n.time < introDuration)
      .map(n => ({
        ...n,
        duration: Math.min(n.duration, Math.max(0.08, introDuration - n.time)),
      }));
    renderMidiNotesToBuffer(clampedIntroNotes, 0);

    // 2. Synthesize Main Notes starting precisely at introDuration
    const firstMainTime = mainMidi.notes.length > 0 ? Math.min(...mainMidi.notes.map(n => n.time)) : 0;
    const isAlreadyTimelineOffset = Math.abs(firstMainTime - introDuration) < 0.5;
    const mainOffset = isAlreadyTimelineOffset ? (introDuration - firstMainTime) : introDuration;
    renderMidiNotesToBuffer(mainMidi.notes, mainOffset);

    // 2.1 Add Analog Filtered Noise Riser & Reverse Swell on the final bar of the intro for an ultra-smooth drop transition
    const lastBarStartSec = Math.max(0, introDuration - (secondsPerBeat * 4));
    const riserStartSec = lastBarStartSec + secondsPerBeat * 1.5; // Starts 2.5 beats before drop
    const riserDur = introDuration - riserStartSec;
    const riserSamples = Math.floor(riserDur * sampleRate);
    const riserStartSample = Math.floor(riserStartSec * sampleRate);

    for (let i = 0; i < riserSamples; i++) {
      const sIdx = riserStartSample + i;
      if (sIdx >= numSamples) break;
      const tNorm = i / riserSamples; // 0 to 1
      // Exponential rise
      const amp = Math.pow(tNorm, 2.2) * 0.16;
      // White noise with pitch-sweeping bandpass filter emulation
      const noise = (Math.random() * 2 - 1);
      const sweepFreq = 300 + Math.pow(tNorm, 3) * 3200;
      const resonance = Math.sin(2 * Math.PI * sweepFreq * (i / sampleRate));
      const riserVal = (noise * 0.6 + resonance * 0.4) * amp;

      left[sIdx] += riserVal * 0.8;
      right[sIdx] += riserVal * 0.8;
    }

    // 3. Synthesize 808 Sub Kicks (Drop on bar downbeats)
    const totalBars = actualIntroBars + actualMainBars;

    for (let bar = 0; bar < totalBars; bar++) {
      // Intro has softer kick, Main loop drops full heavy 808
      const isIntroBar = bar < actualIntroBars;
      const kickVol = isIntroBar ? 0.18 : 0.40;
      const beatTimes = isIntroBar ? [bar * 4] : [bar * 4, bar * 4 + 2.5];

      beatTimes.forEach(b => {
        const startTime = b * secondsPerBeat;
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

    // Soft clip limiter
    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.tanh(left[i] * 1.2);
      right[i] = Math.tanh(right[i] * 1.2);
    }

    this.setBuffer(buffer);
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

    // Synthesize each note into buffer
    midi.notes.forEach(note => {
      const startSample = Math.floor(note.time * sampleRate);
      const noteSamples = Math.floor(note.duration * sampleRate);
      const freq = 440 * Math.pow(2, (note.midi - 69) / 12);

      // Stereo pan based on pitch
      const pan = (note.midi - 60) / 40; // -1 to 1
      const leftGain = Math.cos((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;
      const rightGain = Math.sin((pan + 1) * Math.PI / 4) * (note.velocity || 0.8) * 0.25;

      for (let i = 0; i < noteSamples; i++) {
        const sampleIdx = startSample + i;
        if (sampleIdx >= numSamples) break;

        const t = i / sampleRate;
        // ADSR Envelope
        const attack = 0.04;
        const release = 0.2;
        let env = 1.0;
        if (t < attack) env = t / attack;
        else if (t > note.duration - release) {
          env = Math.max(0, (note.duration - t) / release);
        }

        // Warm dual-saw + triangle analog voice
        const osc1 = ((t * freq) % 1) * 2 - 1;
        const osc2 = ((t * (freq * 1.003)) % 1) * 2 - 1; // slight detune
        const tri = Math.asin(Math.sin(2 * Math.PI * freq * t)) * (2 / Math.PI);

        // Lowpass filter emulation (warm harmonics)
        const raw = (osc1 * 0.4 + osc2 * 0.4 + tri * 0.3) * env;

        left[sampleIdx] += raw * leftGain;
        right[sampleIdx] += raw * rightGain;
      }
    });

    // Add gentle 808 sub kick on bar downbeats for audio orb & FFT reactivity
    const secondsPerBeat = 60 / midi.bpm;
    const totalBars = midi.totalBars;
    for (let bar = 0; bar < totalBars; bar++) {
      const beatTimes = [bar * 4, bar * 4 + 2.5]; // downbeat & syncopated 808
      beatTimes.forEach(b => {
        const startTime = b * secondsPerBeat;
        const kickStart = Math.floor(startTime * sampleRate);
        const kickLen = Math.floor(0.45 * sampleRate);

        for (let i = 0; i < kickLen; i++) {
          const sIdx = kickStart + i;
          if (sIdx >= numSamples) break;
          const t = i / sampleRate;
          const kFreq = 85 * Math.exp(-t * 9) + 38; // pitch drop
          const kEnv = Math.exp(-t * 7);
          const kickVal = Math.sin(2 * Math.PI * kFreq * t) * kEnv * 0.38;

          left[sIdx] += kickVal;
          right[sIdx] += kickVal;
        }
      });
    }

    // Soft clip limiter to prevent distortion
    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.tanh(left[i] * 1.2);
      right[i] = Math.tanh(right[i] * 1.2);
    }

    this.setBuffer(buffer);
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
    const target = this.ctx.createBuffer(2, totalSamples, sampleRate);
    const outL = target.getChannelData(0);
    const outR = target.getChannelData(1);

    const srcL = source.getChannelData(0);
    const srcR = source.numberOfChannels > 1 ? source.getChannelData(1) : srcL;

    const isCustomSample = this.hasCustomFile;

    if (isCustomSample) {
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

    // 3. 25ms Anti-click micro fade out at the very end
    const fadeSamples = Math.round(sampleRate * 0.025);
    for (let f = 0; f < fadeSamples; f++) {
      const idx = totalSamples - 1 - f;
      if (idx >= 0) {
        const gain = f / fadeSamples;
        outL[idx] *= gain;
        outR[idx] *= gain;
      }
    }

    return target;
  }
}

export const audioManager = new AudioManager();
