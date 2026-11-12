import test from 'node:test';
import assert from 'node:assert';
import { applyMode, resolveHardwareId, resolveSynthTheme } from '../src/core/mode-resolution.ts';
import { ModeManifest, VisualizerSettings } from '../src/types/index.ts';

const album: ModeManifest = {
  id: 'album-x', name: 'Album X', kind: 'album', input: 'midi', description: '',
  palette: { notesColor: '#111111', circleColor: '#222222', bgColor: '#333333', accentColor: '#444444', glowColor: '#555555' },
  synthTheme: 'gold',
};
const standalone: ModeManifest = { id: 'solo', name: 'Solo', kind: 'standalone', input: 'midi', description: '' };
const forced: ModeManifest = { ...standalone, id: 'forced', hardware: 'wing-upright' };

const s = (patch: Partial<VisualizerSettings>) => ({ synthModel: 'diva-synth', waveformMode: false, ...patch }) as VisualizerSettings;

test('Mode resolution: waveform view forces the tape machine', () => {
  assert.strictEqual(resolveHardwareId(album, s({ waveformMode: true }), true), 'tape-machine');
  assert.strictEqual(resolveHardwareId(forced, s({ waveformMode: true }), true), 'tape-machine');
});

test('Mode resolution: MIDI view uses forced hardware, then the chosen synth, then st909', () => {
  assert.strictEqual(resolveHardwareId(forced, s({}), true), 'wing-upright');
  assert.strictEqual(resolveHardwareId(standalone, s({}), true), 'diva-synth');
  assert.strictEqual(resolveHardwareId(standalone, s({ synthModel: undefined }), true), 'st909');
});

test('Mode resolution: synth theme and applyMode palette', () => {
  assert.strictEqual(resolveSynthTheme(album), 'gold');
  assert.strictEqual(resolveSynthTheme(standalone), 'crimson');
  assert.deepStrictEqual(applyMode(album), { modeId: 'album-x', ...album.palette });
  assert.deepStrictEqual(applyMode(standalone), { modeId: 'solo' });
});
