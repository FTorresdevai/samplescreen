import test from 'node:test';
import assert from 'node:assert';
import { billboards, clock, osdDate, timecode } from '../src/modes/standalone/camcorder-04/index.ts';
import manifest from '../src/modes/standalone/camcorder-04/manifest.ts';

test("Camcorder '04: full-frame manifest with photo", () => {
  assert.strictEqual(manifest.id, 'camcorder-04');
  assert.strictEqual(manifest.fullFrame, true);
  assert.strictEqual(manifest.photo, true);
});

test("Camcorder '04: timecode, clock and date roll over midnight", () => {
  assert.strictEqual(timecode(0), '0:00:00:00');
  assert.strictEqual(timecode(61.5), '0:01:01:15');
  assert.strictEqual(clock(0), '11:58:30 PM');
  assert.strictEqual(osdDate(0), 'DEC 31 2004');
  assert.strictEqual(clock(90), '12:00:00 AM');
  assert.strictEqual(osdDate(90), 'JAN  1 2005');
});

test("Camcorder '04: billboards stay inside the scene", () => {
  for (const [sw, sh] of [[1250, 1850], [2230, 1250]]) {
    for (const b of billboards(sw, sh)) {
      assert.ok(b.x >= -sw / 2 && b.x + b.w <= sw / 2 + 1);
      assert.ok(b.y >= -sh / 2 && b.y + b.h <= sh / 2);
    }
  }
});
