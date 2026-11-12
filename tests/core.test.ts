import test from 'node:test';
import assert from 'node:assert';
import { validateAudioDuration, sanitizeText, MAX_AUDIO_DURATION_SECONDS } from '../src/core/validator.ts';
import { calculateFrameProgress } from '../src/core/timeline.ts';
import { getTimelineTiming, isMidiTimelineOffset, getActiveNotes } from '../src/engine/midi.ts';
import { analyzeAudioWindow } from '../src/shared/fft.ts';
import { ParsedMidi, VisualizerSettings, MidiNote } from '../src/types/index.ts';

test('Validator: audio duration limit & text sanitization', () => {
  const validDuration = validateAudioDuration(120);
  assert.strictEqual(validDuration.valid, true);

  const tooLong = validateAudioDuration(MAX_AUDIO_DURATION_SECONDS + 60);
  assert.strictEqual(tooLong.valid, false);
  assert.match(tooLong.error || '', /15 minutes/);

  const sanitized = sanitizeText('<b>Hello <script>alert(1)</script>World!</b>', 32);
  assert.strictEqual(sanitized.includes('<'), false);
  assert.strictEqual(sanitized.includes('>'), false);
  assert.strictEqual(sanitized.length <= 32, true);
});

test('Timeline: calculateFrameProgress with and without intro', () => {
  const dummyMidi: ParsedMidi = {
    bpm: 120,
    duration: 16,
    notes: [],
    totalBars: 8,
  };

  const dummySettings: VisualizerSettings = {
    title: 'Test',
    bpm: 120,
    key: 'C',
    producerHandle: 'Tester',
    watermark: 'Watermark',
    notesColor: '#fff',
    circleColor: '#000',
    bgColor: '#111',
    accentColor: '#aaa',
    glowColor: '#bbb',
    backgroundGlow: true,
    waveformMode: false,
    chordDisplay: 'bottom',
    showChordSymbol: false,
    showSafeZoneGuides: false,
    showPreviewHud: false,
    fitReelsSafeZone: false,
    modeId: 'take-care',
    loopBars: 8,
    noteNameTags: true,
    showProgressDashes: true,
    accidental: 'sharp',
    middleC: 3,
    enableIntro: true,
    introBars: 2,
    audioSensitivity: 1.0,
    glowIntensity: 1.0,
    exportLoops: 1,
  };

  const timing = getTimelineTiming(dummyMidi, dummyMidi, dummySettings);
  assert.strictEqual(timing.hasIntro, true);
  assert.strictEqual(timing.introBars, 2);
  assert.strictEqual(timing.introDuration, 4); // 2 bars * 2s/bar at 120bpm = 4s

  // At 1.0s (inside intro)
  const introProgress = calculateFrameProgress(1.0, timing, dummySettings, dummyMidi);
  assert.strictEqual(introProgress.isIntro, true);
  assert.strictEqual(introProgress.introBar, 1);
  assert.strictEqual(introProgress.loopTime, 1.0);

  // At 5.0s (inside main loop: 5.0 - 4.0 = 1.0s in main)
  const mainProgress = calculateFrameProgress(5.0, timing, dummySettings, dummyMidi);
  assert.strictEqual(mainProgress.isIntro, false);
  assert.strictEqual(mainProgress.introBar, 0);
  assert.strictEqual(mainProgress.loopTime, 5.0); // introDuration + mainProgress = 4 + 1 = 5.0
});

test('MIDI: isMidiTimelineOffset and binary search getActiveNotes', () => {
  const notes: MidiNote[] = [
    { name: 'C4', midi: 60, time: 0, duration: 1, velocity: 0.8 },
    { name: 'E4', midi: 64, time: 2, duration: 2, velocity: 0.8 },
    { name: 'G4', midi: 67, time: 4, duration: 2, velocity: 0.8 },
    { name: 'B4', midi: 71, time: 8, duration: 2, velocity: 0.8 },
  ];

  // Notes start at 0, intro duration is 4 -> not offset
  const check1 = isMidiTimelineOffset(notes, 4);
  assert.strictEqual(check1.isOffset, false);
  assert.strictEqual(check1.firstNoteTime, 0);

  // Notes offset to 4.05
  const offsetNotes: MidiNote[] = notes.map(n => ({ ...n, time: n.time + 4.05 }));
  const check2 = isMidiTimelineOffset(offsetNotes, 4);
  assert.strictEqual(check2.isOffset, true);

  // Binary search getActiveNotes at t = 3.0s (only E4 is active: start=2, dur=2)
  const activeAt3 = getActiveNotes(notes, 3.0);
  assert.strictEqual(activeAt3.length, 1);
  assert.strictEqual(activeAt3[0].name, 'E4');

  // At t = 10.0s (no note active)
  const activeAt10 = getActiveNotes(notes, 10.0);
  assert.strictEqual(activeAt10.length, 0);
});

test('FFT Analyzer: Radix-2 FFT produces clean valid spectrum', () => {
  const pcm = new Float32Array(2048);
  // Generate 440 Hz tone at 44.1kHz
  for (let i = 0; i < 2048; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.8;
  }
  const prevSmoothed = new Float32Array(1024);
  const outFft = new Uint8Array(512);

  const { bass, mid, treble, rms } = analyzeAudioWindow(pcm, prevSmoothed, outFft, 0.8);
  assert.ok(rms > 0.3, 'RMS should be non-zero');
  // 440Hz tone peak at bin 20
  const peakVal = Math.max(outFft[19], outFft[20], outFft[21]);
  assert.ok(peakVal > 20, `440Hz tone should register peak at bin 20 (got ${peakVal})`);
  assert.ok(Number.isFinite(bass) && Number.isFinite(treble) && Number.isFinite(mid));
});

test('AudioManager: loopEndTime and state isolation', () => {
  const { AudioManager } = require('../src/engine/audio.ts');
  const mgr = new AudioManager();
  assert.strictEqual(mgr.isPlaying(), false);
  assert.strictEqual(mgr.getCurrentTime(), 0);
  assert.strictEqual(mgr.getLoopEndTime(), null);

  mgr.setLoopEndTime(16.5);
  assert.strictEqual(mgr.getLoopEndTime(), 16.5);

  // Calling with same value should be no-op
  mgr.setLoopEndTime(16.5);
  assert.strictEqual(mgr.getLoopEndTime(), 16.5);

  mgr.setLoopEndTime(null);
  assert.strictEqual(mgr.getLoopEndTime(), null);
});
