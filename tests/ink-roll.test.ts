import test from 'node:test';
import assert from 'node:assert';
import { assignLanes } from '../src/modes/standalone/ink-roll/index.ts';
import { createDemoMidi } from '../src/engine/midi.ts';
import { MidiNote } from '../src/types/index.ts';

const n = (midi: number, time: number, duration: number, track?: number): MidiNote =>
  ({ name: '', midi, time, duration, velocity: 0.8, track });

test('Ink Roll: three or more note tracks split lanes by mean pitch', () => {
  const notes = [n(36, 0, 1, 0), n(72, 0, 1, 1), n(55, 0, 1, 2), n(60, 0, 1, 2), n(40, 1, 1, 0), n(76, 1, 1, 1)];
  const lanes = assignLanes(notes);
  assert.deepStrictEqual(notes.map(x => lanes.get(x)), ['bass', 'melody', 'chords', 'chords', 'bass', 'melody']);
});

test('Ink Roll: fewer than three tracks fall back to register', () => {
  const bass = n(36, 0, 2, 0);
  const chord = [n(55, 0, 2, 0), n(59, 0, 2, 0), n(62, 0, 2, 0)];
  const melody = n(74, 0, 1, 1);
  const lanes = assignLanes([bass, ...chord, melody]);
  assert.strictEqual(lanes.get(bass), 'bass');
  assert.deepStrictEqual(chord.map(x => lanes.get(x)), ['chords', 'chords', 'chords']);
  assert.strictEqual(lanes.get(melody), 'melody');
});

test('Ink Roll: a block chord without a clear top voice stays in the chord lane', () => {
  const block = [n(36, 0, 2), n(48, 0, 2), n(51, 0, 2), n(55, 0, 2)];
  const lanes = assignLanes(block);
  assert.deepStrictEqual(block.map(x => lanes.get(x)), ['bass', 'chords', 'chords', 'chords']);
});

test('Ink Roll: demo MIDI uses all three lanes', () => {
  const demo = createDemoMidi(16);
  const lanes = assignLanes(demo.notes);
  const used = new Set(demo.notes.map(x => lanes.get(x)));
  assert.deepStrictEqual([...used].sort(), ['bass', 'chords', 'melody']);
  // Every melody motif note (above the highest chord tone, D4) lands in the melody lane
  assert.ok(demo.notes.filter(x => x.midi > 62).every(x => lanes.get(x) === 'melody'));
});
