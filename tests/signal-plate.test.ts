import test from 'node:test';
import assert from 'node:assert';
import { scopeLayout, levelsDb, dominantHz, phosphorHue, Rect } from '../src/modes/standalone/signal-plate/index.ts';
import manifest from '../src/modes/standalone/signal-plate/manifest.ts';

const inside = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('Night Scope: audio-only full-frame manifest matching its folder', () => {
  assert.strictEqual(manifest.id, 'signal-plate');
  assert.strictEqual(manifest.name, 'Night Scope');
  assert.strictEqual(manifest.input, 'audio');
  assert.strictEqual(manifest.fullFrame, true);
});

test('Night Scope: screen sections stay inside the screen and do not overlap', () => {
  for (const region of [{ x: 60, y: 195, width: 960, height: 1270 }, { x: 0, y: 120, width: 1920, height: 840 }]) {
    const L = scopeLayout(region);
    const outer: Rect = { x: region.x, y: region.y, w: region.width, h: region.height };
    assert.ok(inside(L.body, outer));
    assert.ok(inside(L.screen, L.body));
    const parts = [L.header, L.scope, L.spectrum, L.readouts];
    for (const r of parts) assert.ok(inside(r, L.screen) && r.w > 0 && r.h > 0);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) assert.ok(!overlaps(parts[i], parts[j]));
    assert.ok(L.scope.h > L.spectrum.h, 'oscilloscope is the main readout');
  }
});

test('Night Scope: levels in dBFS from waveform bytes', () => {
  const silent = new Uint8Array(1024).fill(128);
  assert.deepStrictEqual(levelsDb(silent), { rmsDb: -60, peakDb: -60 });
  const square = new Uint8Array(1024);
  for (let i = 0; i < square.length; i++) square[i] = i % 2 ? 192 : 64; // ±0.5
  const lv = levelsDb(square);
  assert.ok(Math.abs(lv.rmsDb - -6.02) < 0.1);
  assert.ok(Math.abs(lv.peakDb - -6.02) < 0.1);
});

test('Night Scope: dominant frequency from fft bins', () => {
  const fft = new Uint8Array(1024);
  assert.strictEqual(dominantHz(fft), 0);
  fft[20] = 200; fft[19] = 120; fft[21] = 120; // symmetric peak → bin 20
  assert.ok(Math.abs(dominantHz(fft) - (20 * 44100) / 2048) < 0.5);
});

test('Night Scope: phosphor is green or amber from the palette', () => {
  assert.strictEqual(phosphorHue('#e69d45'), 38);  // walnut → amber
  assert.strictEqual(phosphorHue('#245847'), 138); // paper → green
  assert.strictEqual(phosphorHue('#18181b'), 38);  // grey → amber
});
