import test from 'node:test';
import assert from 'node:assert';
import { buildClips, groupByRegister } from '../src/modes/standalone/aero-desktop/index.ts';
import { MidiNote } from '../src/types/index.ts';

const n = (midi: number, time: number, duration = 0.5): MidiNote => ({ name: '', midi, time, duration, velocity: 0.8 });

test('Y2K Desktop: notes are grouped by octave, high register first', () => {
  const tracks = groupByRegister([n(36, 0), n(38, 1), n(60, 0), n(76, 2)]);
  assert.strictEqual(tracks.length, 3);
  assert.deepStrictEqual(tracks.map(t => [t.low, t.high]), [[76, 76], [60, 60], [36, 38]]);
  assert.strictEqual(tracks[2].name, 'Bass');
});

test('Y2K Desktop: extra octaves merge into at most maxTracks tracks', () => {
  const notes = [24, 36, 48, 60, 72, 84, 96, 108].map((m, i) => n(m, i));
  const tracks = groupByRegister(notes, 4);
  assert.strictEqual(tracks.length, 4);
  assert.strictEqual(tracks.reduce((s, t) => s + t.notes.length, 0), notes.length);
  assert.deepStrictEqual(groupByRegister([]), []);
});

test('Y2K Desktop: clips cover bars with notes and merge contiguous bars', () => {
  // 2 s bars, 8 s loop; notes in bars 1, 2 and 4.
  const clips = buildClips([n(60, 0.5), n(62, 3.5, 0.4), n(64, 7)], 2, 8);
  assert.deepStrictEqual(clips, [{ start: 0, end: 4 }, { start: 6, end: 8 }]);
  assert.deepStrictEqual(buildClips([], 2, 8), []);
});
