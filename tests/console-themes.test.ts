import test from 'node:test';
import assert from 'node:assert';
import { CONSOLE_THEMES, consoleTheme } from '../src/hardware/themes.ts';

test('Console themes: every theme defines every colour, unknown ids fall back to crimson', () => {
  const keys = Object.keys(CONSOLE_THEMES.crimson).sort();
  for (const [id, theme] of Object.entries(CONSOLE_THEMES)) {
    assert.deepStrictEqual(Object.keys(theme).sort(), keys, id);
  }
  assert.strictEqual(consoleTheme('brass'), CONSOLE_THEMES.brass);
  assert.strictEqual(consoleTheme('matte'), CONSOLE_THEMES.matte);
  assert.strictEqual(consoleTheme('nope'), CONSOLE_THEMES.crimson);
  assert.strictEqual(consoleTheme(undefined), CONSOLE_THEMES.crimson);
});
