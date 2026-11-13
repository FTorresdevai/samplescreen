import test from 'node:test';
import assert from 'node:assert';
import { playerLayout, formatTime, bandEdges, bandLevels, screenAccent, Rect } from '../src/modes/standalone/pocket-player/index.ts';
import manifest from '../src/modes/standalone/pocket-player/manifest.ts';

const inside = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x - 1e-6 && r.y >= outer.y - 1e-6 && r.x + r.w <= outer.x + outer.w + 1e-6 && r.y + r.h <= outer.y + outer.h + 1e-6;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('Pocket Player: full-frame MIDI/audio manifest matching its folder', () => {
  assert.strictEqual(manifest.id, 'pocket-player');
  assert.strictEqual(manifest.input, 'both');
  assert.strictEqual(manifest.fullFrame, true);
});

test('Pocket Player: device, screen and wheel fit; screen sections do not overlap', () => {
  for (const region of [{ x: 60, y: 195, width: 960, height: 1270 }, { x: 0, y: 120, width: 1920, height: 840 }]) {
    const L = playerLayout(region);
    const outer: Rect = { x: region.x, y: region.y, w: region.width, h: region.height };
    assert.ok(inside(L.device, outer));
    assert.ok(inside(L.bezel, L.device) && inside(L.screen, L.bezel));
    const { cx, cy, r } = L.wheel;
    assert.ok(cy - r > L.bezel.y + L.bezel.h, 'wheel sits below the screen');
    assert.ok(cy + r < L.device.y + L.device.h && cx - r > L.device.x && cx + r < L.device.x + L.device.w);
    const parts = [L.header, L.art, L.meta, L.viz, L.progress];
    for (const p of parts) assert.ok(inside(p, L.screen) && p.w > 0 && p.h > 0);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) assert.ok(!overlaps(parts[i], parts[j]));
    assert.ok(L.device.x - region.x > L.device.w * 0.3, 'room for the earbuds on the left');
  }
});

test('Pocket Player: time format', () => {
  assert.strictEqual(formatTime(0), '0:00');
  assert.strictEqual(formatTime(65.9), '1:05');
  assert.strictEqual(formatTime(-3), '0:00');
});

test('Pocket Player: spectrum bands are increasing and scale with the input', () => {
  const edges = bandEdges(28, 40, 14000, 1024);
  for (let i = 1; i < edges.length; i++) assert.ok(edges[i] > edges[i - 1]);
  assert.ok(edges[edges.length - 1] < 1024);
  const out = new Float32Array(28);
  bandLevels(new Uint8Array(1024), edges, 1.2, out);
  assert.ok(out.every((v) => v === 0));
  bandLevels(new Uint8Array(1024).fill(255), edges, 1.2, out);
  assert.ok(out.every((v) => v === 1));
});

test('Pocket Player: accent stays readable on the white screen', () => {
  const lum = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  assert.ok(lum(screenAccent('#ffff66')) <= 0.5);
  assert.strictEqual(screenAccent('#1d4ed8'), 'rgb(29, 78, 216)');
});
