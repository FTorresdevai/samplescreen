import test from 'node:test';
import assert from 'node:assert';
import { noteEnvelope, computeTuneModKnob } from '../src/hardware/motion.ts';
import { MidiNote } from '../src/types/index.ts';

const note = (time: number, midi = 60): MidiNote => ({
  time,
  midi,
  duration: 1,
  name: 'C4',
  velocity: 0.8,
});

test('Motion: noteEnvelope is 1 at attack instant, < 0.05 after 1s, and 0 without notes', () => {
  const notes = [note(2.0)];

  // 1 at the instant of attack (loopTime === note.time)
  assert.strictEqual(noteEnvelope(notes, 2.0), 1);

  // < 0.05 after 1 s
  const valAfter1s = noteEnvelope(notes, 3.0);
  assert.ok(valAfter1s < 0.05, `Expected < 0.05 but got ${valAfter1s}`);
  assert.ok(valAfter1s > 0, `Expected > 0 but got ${valAfter1s}`);

  // 0 without notes
  assert.strictEqual(noteEnvelope([], 2.0), 0);
  assert.strictEqual(noteEnvelope(undefined, 2.0), 0);
});

test('Motion: tune mod knob is music-reactive and clamped', () => {
  // Idle with zero audio and no MIDI
  const idle = computeTuneModKnob([], 0, { mid: 0, bass: 0 });
  assert.strictEqual(idle, 0.3);

  // At note attack instant
  const attack = computeTuneModKnob([note(1.0)], 1.0, { mid: 0.5, bass: 0.2 });
  assert.ok(attack > 0.8, `Expected > 0.8 but got ${attack}`);
  assert.ok(attack <= 1.0, `Expected <= 1.0 but got ${attack}`);
});
