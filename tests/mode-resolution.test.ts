import test from 'node:test';
import assert from 'node:assert';
import { applyMode, resolveAlbumView, resolveHardwareId, resolveSynthTheme, showsMidi } from '../src/core/mode-resolution.ts';
import { ModeManifest, VisualizerSettings } from '../src/types/index.ts';

const album: ModeManifest = {
  id: 'album-x', name: 'Album X', kind: 'album', input: 'midi', description: '',
  palette: { notesColor: '#111111', circleColor: '#222222', bgColor: '#333333', accentColor: '#444444', glowColor: '#555555' },
  synthTheme: 'gold',
};
const standalone: ModeManifest = { id: 'solo', name: 'Solo', kind: 'standalone', input: 'midi', description: '' };
const forced: ModeManifest = { ...standalone, id: 'forced', hardware: 'wing-upright' };

const s = (patch: Partial<VisualizerSettings>) => ({ synthModel: 'diva-synth', albumView: 'midi', ...patch }) as VisualizerSettings;
const audioOnly: ModeManifest = { ...standalone, id: 'audio', input: 'audio', hardware: 'tape-machine' };

test('Mode resolution: albums without MIDI are forced to the waveform view', () => {
  assert.strictEqual(resolveAlbumView(s({ albumView: 'midi' }), false), 'waveform');
  assert.strictEqual(resolveAlbumView(s({ albumView: 'midi' }), true), 'midi');
  assert.strictEqual(resolveAlbumView(s({ albumView: 'waveform' }), true), 'waveform');
});

test('Mode resolution: album waveform view uses the tape machine, MIDI view the chosen synth', () => {
  assert.strictEqual(resolveHardwareId(album, s({ albumView: 'waveform' }), true), 'tape-machine');
  assert.strictEqual(resolveHardwareId(album, s({}), false), 'tape-machine');
  assert.strictEqual(resolveHardwareId(album, s({}), true), 'diva-synth');
});

test('Mode resolution: standalone modes ignore the album view', () => {
  assert.strictEqual(resolveHardwareId(standalone, s({ albumView: 'waveform' }), true), 'diva-synth');
  assert.strictEqual(resolveHardwareId(forced, s({}), true), 'wing-upright');
  assert.strictEqual(resolveHardwareId(standalone, s({ synthModel: undefined }), true), 'st909');
  assert.strictEqual(resolveHardwareId(audioOnly, s({}), true), 'tape-machine');
});

test('Mode resolution: notes row follows what the frame shows', () => {
  assert.strictEqual(showsMidi(album, s({}), true), true);
  assert.strictEqual(showsMidi(album, s({ albumView: 'waveform' }), true), false);
  assert.strictEqual(showsMidi(album, s({}), false), false);
  assert.strictEqual(showsMidi(standalone, s({ albumView: 'waveform' }), true), true);
  assert.strictEqual(showsMidi(audioOnly, s({}), true), false);
});

test('Mode resolution: synth theme and applyMode palette', () => {
  assert.strictEqual(resolveSynthTheme(album), 'gold');
  assert.strictEqual(resolveSynthTheme(standalone), 'crimson');
  assert.deepStrictEqual(applyMode(album), { modeId: 'album-x', ...album.palette });
  assert.deepStrictEqual(applyMode(standalone), { modeId: 'solo' });
});
