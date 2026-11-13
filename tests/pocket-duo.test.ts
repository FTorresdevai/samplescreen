import test from 'node:test';
import assert from 'node:assert';
import { duoLayout, beatIndex, Rect } from '../src/modes/standalone/pocket-duo/index.ts';
import manifest from '../src/modes/standalone/pocket-duo/manifest.ts';

const inside = (r: Rect, o: Rect): boolean =>
  r.x >= o.x - 1e-6 && r.y >= o.y - 1e-6 && r.x + r.w <= o.x + o.w + 1e-6 && r.y + r.h <= o.y + o.h + 1e-6;
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('Pocket Duo: full-frame MIDI/audio manifest matching its folder', () => {
  assert.strictEqual(manifest.id, 'pocket-duo');
  assert.strictEqual(manifest.input, 'both');
  assert.strictEqual(manifest.fullFrame, true);
});

test('Pocket Duo: halves, screens and controls fit without overlapping', () => {
  for (const region of [{ x: 60, y: 195, width: 960, height: 1270 }, { x: 0, y: 120, width: 1920, height: 840 }]) {
    const L = duoLayout(region);
    assert.ok(inside(L.device, { x: region.x, y: region.y, w: region.width, h: region.height }));
    assert.ok(inside(L.top, L.topBezel) && inside(L.topBezel, L.lid));
    assert.ok(inside(L.bottom, L.panel) && inside(L.panel, L.base));
    assert.ok(!overlaps(L.lid, L.base) && L.hinge.y >= L.lid.y + L.lid.h - 1e-6);
    const parts = [L.tabs, L.grid, L.footer];
    for (const p of parts) assert.ok(inside(p, L.bottom));
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) assert.ok(!overlaps(parts[i], parts[j]));
    assert.ok(inside(L.pill, L.grid) && inside(L.beats, L.grid) && !overlaps(L.pill, L.beats));
    assert.ok(Math.abs(L.top.w / L.top.h - 5 / 3) < 0.01 && Math.abs(L.bottom.w / L.bottom.h - 4 / 3) < 0.01);
    assert.ok(L.pad.cx + L.pad.r * 1.2 < L.panel.x && L.face.cx - L.face.gap - L.face.r > L.panel.x + L.panel.w);
  }
});

test('Pocket Duo: beat counter cycles 0–3 within the bar', () => {
  assert.deepStrictEqual([0, 0.5, 1, 1.5, 2, 2.1].map((t) => beatIndex(t, 2)), [0, 1, 2, 3, 0, 0]);
  assert.strictEqual(beatIndex(-0.1, 2), 3);
});
