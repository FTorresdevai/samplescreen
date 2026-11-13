import test from 'node:test';
import assert from 'node:assert';
import { emitterFor, stageLayout, strobeAllowed } from '../src/modes/standalone/fog-stage/index.ts';
import manifest from '../src/modes/standalone/fog-stage/manifest.ts';
import { smokeValue } from '../src/modes/standalone/_film/fx.ts';

test('Fog Stage: manifest with photo and Mono / Ember looks', () => {
  assert.strictEqual(manifest.id, 'fog-stage');
  assert.strictEqual(manifest.photo, true);
  assert.deepStrictEqual(manifest.looks?.map((l) => l.id), ['mono', 'ember']);
});

test('Fog Stage: emitters spread inside the frame above the floor line', () => {
  for (const region of [{ x: 0, y: 160, width: 1080, height: 1600 }, { x: 0, y: 0, width: 1920, height: 1080 }]) {
    const L = stageLayout(region);
    assert.strictEqual(L.emitters.length, 5);
    for (let i = 1; i < L.emitters.length; i++) assert.ok(L.emitters[i] > L.emitters[i - 1]);
    assert.ok(L.emitters[0] - L.flameW > region.x && L.emitters[4] + L.flameW < region.x + region.width);
    assert.ok(L.floorY - L.maxFlame > region.y, 'tallest flame stays in frame');
  }
});

test('Fog Stage: pitch → column, low notes on the left', () => {
  assert.strictEqual(emitterFor(48, 48, 72), 0);
  assert.strictEqual(emitterFor(72, 48, 72), 4);
  assert.strictEqual(emitterFor(60, 60, 60), 2);
});

test('Fog Stage: strobe capped at 3 per second', () => {
  assert.ok(strobeAllowed(1, -1));
  assert.ok(!strobeAllowed(1.2, 1));
  assert.ok(strobeAllowed(1.34, 1));
  assert.ok(strobeAllowed(0.5, 1), 'seek back resets');
});

test('Film FX: smoke noise is bounded and tiles seamlessly', () => {
  for (let i = 0; i < 50; i++) {
    const v = smokeValue(i * 5, i * 3);
    assert.ok(v >= 0 && v <= 1);
  }
  assert.ok(Math.abs(smokeValue(0, 10) - smokeValue(256, 10)) < 1e-9);
  assert.ok(Math.abs(smokeValue(10, 0) - smokeValue(10, 256)) < 1e-9);
});
