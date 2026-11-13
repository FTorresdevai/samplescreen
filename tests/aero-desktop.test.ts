import test from 'node:test';
import assert from 'node:assert';
import { noteName, pitchRange } from '../src/modes/standalone/aero-desktop/index.ts';
import { MidiNote } from '../src/types/index.ts';

const n = (midi: number, time = 0, duration = 0.5): MidiNote => ({ name: '', midi, time, duration, velocity: 0.8 });

test('Y2K Desktop: note names use C4 = 60', () => {
  assert.strictEqual(noteName(60), 'C4');
  assert.strictEqual(noteName(61), 'C#4');
  assert.strictEqual(noteName(21), 'A0');
});

test('Y2K Desktop: wide pitch range is padded by one semitone', () => {
  assert.deepStrictEqual(pitchRange([n(40), n(70), n(55)]), { low: 39, high: 71 });
});

test('Y2K Desktop: narrow pitch range widens to at least an octave', () => {
  const r = pitchRange([n(60), n(62)]);
  assert.strictEqual(r.high - r.low + 1, 12);
  assert.ok(r.low < 60 && r.high > 62);
  const empty = pitchRange([]);
  assert.strictEqual(empty.high - empty.low + 1, 12);
});
