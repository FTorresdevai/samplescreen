import test from 'node:test';
import assert from 'node:assert';
import { AudioManager, createMockAudioBuffer } from '../src/engine/audio.ts';
import { sliceMidiNotes, sliceMidiData, createDemoMidi } from '../src/engine/midi.ts';
import { MidiNote, ParsedMidi } from '../src/types/index.ts';

test('Trim: Audio slicing math, duration, and boundary micro-fade', () => {
  const sampleRate = 44100;
  // Create a 24-bar audio buffer at 120 BPM (2.0s per bar -> 48.0s total, 2,116,800 samples)
  const bpm = 120;
  const secondsPerBar = (60 / bpm) * 4; // 2.0s
  const totalBars = 24;
  const totalDuration = totalBars * secondsPerBar; // 48.0s
  const totalSamples = Math.round(totalDuration * sampleRate);

  const rawBuffer = createMockAudioBuffer(2, totalSamples, sampleRate);
  const left = rawBuffer.getChannelData(0);
  const right = rawBuffer.getChannelData(1);

  // Fill buffer with an identifiable ramp signal
  for (let i = 0; i < totalSamples; i++) {
    const val = (i % 1000) / 1000;
    left[i] = val;
    right[i] = val;
  }

  const audioManager = new AudioManager();
  audioManager.setBuffer(rawBuffer);

  assert.strictEqual(audioManager.getDuration(), 48);
  assert.strictEqual(audioManager.getRawDuration(), 48);

  // Trim from Bar 5 for 8 bars at 120 BPM:
  // startSec = (5 - 1) * 2.0 = 8.0s (352,800 samples)
  // durationSec = 8 * 2.0 = 16.0s (705,600 samples)
  // endSec = 24.0s
  const result = audioManager.trimToBars(5, 8, 120);
  assert.ok(result, 'trimToBars should return a valid result');
  assert.strictEqual(result.startSec, 8.0);
  assert.strictEqual(result.durationSec, 16.0);
  assert.strictEqual(result.totalBars, 8);
  assert.strictEqual(result.totalAvailableBars, 24);

  // Verify trimmed AudioBuffer properties
  const trimmed = audioManager.getBuffer();
  assert.ok(trimmed, 'audioManager buffer must exist');
  assert.strictEqual(trimmed.duration, 16.0);
  assert.strictEqual(trimmed.length, Math.round(16.0 * sampleRate));
  assert.strictEqual(audioManager.getLoopEndTime(), 16.0);

  // Verify internal samples: middle samples match original offset (Bar 5 startSample = 352800)
  const trimLeft = trimmed.getChannelData(0);
  const startSample = Math.round(8.0 * sampleRate);
  const testSampleIndex = 10000; // Well past boundary micro-fade
  assert.strictEqual(trimLeft[testSampleIndex], left[startSample + testSampleIndex]);

  // Verify clean boundary micro-fade at index 0 (smooth Hann fade-in)
  assert.strictEqual(trimLeft[0], 0, 'First sample should be scaled to 0 for click-free start');

  // Test clamping math when requested range exceeds available buffer
  // E.g. start at bar 22 for 8 bars, but buffer only has 24 bars total -> safeNumBars should clamp to 3
  const clampResult = audioManager.trimToBars(22, 8, 120);
  assert.ok(clampResult);
  assert.strictEqual(clampResult.startSec, 42.0); // (22 - 1) * 2 = 42s
  assert.strictEqual(clampResult.totalBars, 3);   // Bars 22, 23, 24
  assert.strictEqual(clampResult.durationSec, 6.0);
  assert.strictEqual(audioManager.getBuffer()?.duration, 6.0);
});

test('Trim: MIDI notes slicing, filtering, and timestamp offset calculation', () => {
  // Test scenario: Trimming from Bar 5 for 8 bars at 120 BPM:
  // startSec = 8.0s, durationSec = 16.0s (active window: [8.0s, 24.0s))
  const startSec = 8.0;
  const durationSec = 16.0;
  const numBars = 8;

  const testNotes: MidiNote[] = [
    { name: 'C3', midi: 48, time: 2.0, duration: 1.0, velocity: 0.8 },   // Note 1: before startSec -> discard
    { name: 'E3', midi: 52, time: 7.9, duration: 0.5, velocity: 0.8 },   // Note 2: right before startSec -> discard
    { name: 'G3', midi: 55, time: 8.0, duration: 2.0, velocity: 0.85 },  // Note 3: exactly at startSec -> keep, time = 0.0
    { name: 'C4', midi: 60, time: 12.5, duration: 1.5, velocity: 0.9 },  // Note 4: inside window -> keep, time = 4.5
    { name: 'D4', midi: 62, time: 23.0, duration: 3.0, velocity: 0.8 },  // Note 5: inside window near end -> keep, time = 15.0, clamped duration = 1.0
    { name: 'F4', midi: 65, time: 24.0, duration: 1.0, velocity: 0.75 }, // Note 6: exactly at startSec + durationSec -> discard
    { name: 'A4', midi: 69, time: 30.0, duration: 2.0, velocity: 0.8 },  // Note 7: after window -> discard
  ];

  const sourceMidi: ParsedMidi = {
    bpm: 120,
    duration: 48.0,
    totalBars: 24,
    key: 'C MAJ',
    notes: testNotes,
  };

  const slicedNotes = sliceMidiNotes(testNotes, startSec, durationSec);

  // 1. Exactly 3 notes should remain
  assert.strictEqual(slicedNotes.length, 3, 'Should keep only the 3 notes inside [8.0, 24.0)');

  // 2. Verify note 3: started at 8.0s -> offset to 0.0s
  assert.strictEqual(slicedNotes[0].name, 'G3');
  assert.strictEqual(slicedNotes[0].time, 0.0);
  assert.strictEqual(slicedNotes[0].duration, 2.0);

  // 3. Verify note 4: started at 12.5s -> offset to 4.5s
  assert.strictEqual(slicedNotes[1].name, 'C4');
  assert.strictEqual(slicedNotes[1].time, 4.5);
  assert.strictEqual(slicedNotes[1].duration, 1.5);

  // 4. Verify note 5: started at 23.0s -> offset to 15.0s, duration clamped to 1.0s (16.0 - 15.0)
  assert.strictEqual(slicedNotes[2].name, 'D4');
  assert.strictEqual(slicedNotes[2].time, 15.0);
  assert.strictEqual(slicedNotes[2].duration, 1.0);

  // 5. Test sliceMidiData wrapper
  const slicedMidi = sliceMidiData(sourceMidi, startSec, durationSec, numBars);
  assert.strictEqual(slicedMidi.duration, 16.0);
  assert.strictEqual(slicedMidi.totalBars, 8);
  assert.strictEqual(slicedMidi.bpm, 120);
  assert.strictEqual(slicedMidi.notes.length, 3);
  assert.strictEqual(slicedMidi.notes[0].time, 0.0);

  // 6. Test empty notes guard
  assert.deepStrictEqual(sliceMidiNotes([], 0, 10), []);
  assert.deepStrictEqual(sliceMidiNotes(undefined, 0, 10), []);
});

test('Trim: Reset functionality restoring original audio and MIDI', () => {
  const sampleRate = 44100;
  const bpm = 120;
  const originalBars = 16;
  const originalDuration = (60 / bpm) * 4 * originalBars; // 32.0s
  const originalSamples = Math.round(originalDuration * sampleRate);

  const rawBuffer = createMockAudioBuffer(2, originalSamples, sampleRate);
  const audioManager = new AudioManager();
  audioManager.setBuffer(rawBuffer);

  const originalMidi: ParsedMidi = createDemoMidi(originalBars);
  const originalNotesCount = originalMidi.notes.length;
  assert.ok(originalNotesCount > 0, 'Demo MIDI should have notes');

  // Track originalMidi in ref-like variable (matching App.tsx behavior)
  let originalMidiRef: ParsedMidi | null = originalMidi;
  let activeMidi: ParsedMidi = originalMidi;

  // 1. Apply trim (Bar 5 for 8 bars)
  const trimResult = audioManager.trimToBars(5, 8, bpm);
  assert.ok(trimResult);
  assert.strictEqual(audioManager.getBuffer()?.duration, 16.0);
  assert.strictEqual(audioManager.getLoopEndTime(), 16.0);

  activeMidi = sliceMidiData(originalMidiRef, trimResult.startSec, trimResult.durationSec, trimResult.totalBars);
  assert.strictEqual(activeMidi.duration, 16.0);
  assert.strictEqual(activeMidi.totalBars, 8);
  assert.ok(activeMidi.notes.length < originalNotesCount, 'Trimmed MIDI should have fewer notes than original');

  // 2. Perform Reset (handleResetAudioTrim behavior)
  const restoredDuration = audioManager.resetTrim();
  assert.strictEqual(restoredDuration, 32.0);
  assert.strictEqual(audioManager.getBuffer()?.duration, 32.0);
  assert.strictEqual(audioManager.getLoopEndTime(), 32.0);

  // Restore MIDI from originalMidiRef
  if (originalMidiRef) {
    activeMidi = originalMidiRef;
  }
  assert.strictEqual(activeMidi.duration, originalMidi.duration);
  assert.strictEqual(activeMidi.totalBars, originalBars);
  assert.strictEqual(activeMidi.notes.length, originalNotesCount);
  assert.strictEqual(activeMidi.notes[0].time, originalMidi.notes[0].time);

  // 3. Reset again is idempotent
  const secondResetDuration = audioManager.resetTrim();
  assert.strictEqual(secondResetDuration, 32.0);
  assert.strictEqual(audioManager.getBuffer()?.duration, 32.0);
});

test('Trim: snapToBar rounds to the nearest bar boundary and clamps', async () => {
  const { snapToBar } = await import('../src/core/trim.ts');
  // 120 BPM → 2 s per bar
  assert.strictEqual(snapToBar(0, 120, 10), 1);
  assert.strictEqual(snapToBar(2.9, 120, 10), 2);   // 1.45 bars → boundary 1 → bar 2
  assert.strictEqual(snapToBar(3.1, 120, 10), 3);   // 1.55 bars → boundary 2 → bar 3
  assert.strictEqual(snapToBar(-5, 120, 10), 1);    // clamp low
  assert.strictEqual(snapToBar(999, 120, 10), 11);  // clamp at end boundary (after bar 10)
});

test('Trim: computePeaks length, silence and full scale', async () => {
  const { computePeaks } = await import('../src/core/trim.ts');
  assert.strictEqual(computePeaks(new Float32Array(1000), 50).length, 50);
  assert.ok(computePeaks(new Float32Array(1000), 50).every(v => v === 0));
  const loud = new Float32Array(1000).fill(-1);
  assert.ok(computePeaks(loud, 50).every(v => v === 1));
  assert.strictEqual(computePeaks(new Float32Array(0), 10).length, 10);
});
