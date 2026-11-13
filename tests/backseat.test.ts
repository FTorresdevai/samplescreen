import test from 'node:test';
import assert from 'node:assert';
import { carLayout, wrapX } from '../src/modes/standalone/backseat/index.ts';
import manifest from '../src/modes/standalone/backseat/manifest.ts';

test('Backseat: manifest with photo and Tungsten / Ice looks', () => {
  assert.strictEqual(manifest.id, 'backseat');
  assert.strictEqual(manifest.fullFrame, true);
  assert.strictEqual(manifest.photo, true);
  assert.deepStrictEqual(manifest.looks?.map((l) => l.id), ['tungsten', 'ice']);
});

test('Backseat: windows sit inside the frame, side by side, above the seats', () => {
  for (const region of [{ x: 0, y: 160, width: 1080, height: 1600 }, { x: 0, y: 0, width: 1920, height: 1080 }]) {
    const L = carLayout(region);
    const xs = (pts: [number, number][]) => pts.map((p) => p[0]);
    const ys = (pts: [number, number][]) => pts.map((p) => p[1]);
    for (const w of [L.windshield, L.side]) {
      assert.ok(Math.min(...xs(w)) >= region.x && Math.max(...xs(w)) <= region.x + region.width);
      assert.ok(Math.min(...ys(w)) >= region.y && Math.max(...ys(w)) <= region.y + region.height);
    }
    assert.ok(Math.max(...xs(L.windshield)) < Math.min(...xs(L.side)), 'pillar between the windows');
    assert.ok(L.horizon > Math.min(...ys(L.side)) && L.horizon < Math.max(...ys(L.side)));
    for (const s of L.seats) assert.ok(s.y > L.headrests[0].y);
  }
});

test('Backseat: lights wrap within the span', () => {
  for (const scroll of [0, 10, 999.5, -40]) {
    const x = wrapX(300, scroll, 1000);
    assert.ok(x >= 0 && x < 1000);
  }
  assert.strictEqual(wrapX(300, 100, 1000), 200);
});
