import test from 'node:test';
import assert from 'node:assert';
import { plateLayout, Rect } from '../src/modes/standalone/signal-plate/index.ts';
import manifest from '../src/modes/standalone/signal-plate/manifest.ts';

const region = { x: 60, y: 195, width: 960, height: 1270 };

const inside = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('Night Plate: audio-only full-frame manifest matching its folder', () => {
  assert.strictEqual(manifest.id, 'signal-plate');
  assert.strictEqual(manifest.input, 'audio');
  assert.strictEqual(manifest.fullFrame, true);
});

test('Night Plate: panels stay inside the region and do not overlap', () => {
  const L = plateLayout(region);
  const outer: Rect = { x: region.x, y: region.y, w: region.width, h: region.height };
  for (const r of [L.top, L.cloth, L.column]) assert.ok(inside(r, outer));
  for (const r of [L.titleCell, L.waveCell, L.burstCell, L.combCell]) assert.ok(inside(r, L.top));
  assert.ok(!overlaps(L.top, L.cloth));
  assert.ok(!overlaps(L.top, L.column));
  assert.ok(!overlaps(L.cloth, L.column));
  assert.ok(!overlaps(L.titleCell, L.waveCell));
  assert.ok(!overlaps(L.burstCell, L.combCell));
  assert.ok(L.column.h > L.column.w * 2, 'dither column is tall');
});
