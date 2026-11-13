import test from 'node:test';
import assert from 'node:assert';
import { chordText, noteColor } from '../src/modes/standalone/piano-waterfall/index.ts';
import manifest from '../src/modes/standalone/piano-waterfall/manifest.ts';

test('graphite synth: renamed display name, same id', () => {
  assert.strictEqual(manifest.id, 'piano-waterfall');
  assert.strictEqual(manifest.name, 'Graphite Synth');
  assert.strictEqual(manifest.input, 'midi');
});

test('graphite synth: chord line sorts low to high and drops duplicates', () => {
  assert.strictEqual(chordText([72, 41, 64, 67, 76, 64]), 'F2 · E4 · G4 · C5 · E5');
  assert.strictEqual(chordText([]), '');
});

test('graphite synth: note colours follow register bands', () => {
  assert.notStrictEqual(noteColor(40), noteColor(76));
  assert.strictEqual(noteColor(60), noteColor(71));
});
