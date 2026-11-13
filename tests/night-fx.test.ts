import test from 'node:test';
import assert from 'node:assert';
import { bandMean, beatStep, grainOffset, hash01, newBeatState } from '../src/modes/standalone/_film/fx.ts';
import { coverCrop } from '../src/shared/backdrop.ts';
import { resolveLook } from '../src/core/mode-resolution.ts';
import type { AudioAnalysis, ModeManifest } from '../src/types/index.ts';

const frame = (kick: number, rms = 0.3): AudioAnalysis => {
  const fft = new Uint8Array(1024);
  for (let i = 2; i < 7; i++) fft[i] = kick;
  return { fft, waveform: new Uint8Array(2048).fill(128), bass: 0, mid: 0, treble: 0, rms };
};

test('Film FX: band mean and hash are bounded and deterministic', () => {
  assert.strictEqual(bandMean(new Uint8Array(8).fill(255), 0, 8), 1);
  assert.strictEqual(bandMean(new Uint8Array(8), 4, 4), 0);
  for (let i = 0; i < 100; i++) { const h = hash01(i); assert.ok(h >= 0 && h < 1); assert.strictEqual(h, hash01(i)); }
  const [x, y] = grainOffset(1.234);
  assert.ok(x >= 0 && x < 256 && y >= 0 && y < 256);
  assert.deepStrictEqual(grainOffset(1.234), grainOffset(1.234));
});

test('Film FX: kick envelope hits on onsets, releases, and resets after a seek', () => {
  const s = newBeatState();
  beatStep(s, frame(0), 0);
  const hit = beatStep(s, frame(250), 1 / 60);
  assert.ok(hit.hit && hit.kick > 0.9);
  const held = beatStep(s, frame(250), 2 / 60);
  assert.ok(!held.hit, 'no retrigger inside 140 ms');
  let k = 1;
  for (let f = 3; f < 40; f++) k = beatStep(s, frame(0), f / 60).kick;
  assert.ok(k < 0.2, 'kick releases');
  assert.strictEqual(beatStep(s, frame(0), 0).dt, 0, 'seek backwards → dt 0');
});

test('Look resolution falls back to the first look', () => {
  const m = { looks: [{ id: 'tungsten', name: 'Tungsten' }, { id: 'ice', name: 'Ice' }] } as ModeManifest;
  assert.strictEqual(resolveLook(m, 'ice'), 'ice');
  assert.strictEqual(resolveLook(m, 'nope'), 'tungsten');
  assert.strictEqual(resolveLook({} as ModeManifest, 'x'), '');
});

test('Backdrop cover crop keeps the aspect and stays inside the image', () => {
  const c = coverCrop(4000, 3000, 1080, 1920);
  assert.ok(Math.abs(c.sw / c.sh - 1080 / 1920) < 1e-9);
  assert.ok(c.sx >= 0 && c.sy >= 0 && c.sx + c.sw <= 4000 + 1e-9 && c.sy + c.sh <= 3000 + 1e-9);
});
