import test from 'node:test';
import assert from 'node:assert';
import { applyMode, exportBlockReason, hasViewSwitch, resolveAlbumView, resolveHardwareId, resolveSynthTheme, showsMidi } from '../src/core/mode-resolution.ts';
import { ModeManifest, VisualizerSettings } from '../src/types/index.ts';

const album: ModeManifest = {
  id: 'album-x', name: 'Album X', kind: 'album', input: 'both', description: '',
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
  assert.strictEqual(resolveHardwareId({ ...album, waveformHardware: 'album-banner' }, s({ albumView: 'waveform' }), true), 'album-banner');
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

test('Mode resolution: input rules (view switch, MIDI-only export block)', () => {
  const both: ModeManifest = { ...standalone, id: 'both', input: 'both' };
  assert.strictEqual(hasViewSwitch(album), true);
  assert.strictEqual(hasViewSwitch(both), true);
  assert.strictEqual(hasViewSwitch(standalone), false);
  assert.strictEqual(hasViewSwitch(audioOnly), false);
  // A standalone 'both' mode follows the view like an album
  assert.strictEqual(showsMidi(both, s({ albumView: 'waveform' }), true), false);
  assert.strictEqual(resolveHardwareId(both, s({ albumView: 'waveform' }), true), 'tape-machine');
  // Only MIDI-only modes need a loaded MIDI file to export
  assert.ok(exportBlockReason(standalone, false));
  assert.strictEqual(exportBlockReason(standalone, true), null);
  assert.strictEqual(exportBlockReason(album, false), null);
  assert.strictEqual(exportBlockReason(audioOnly, false), null);
});

test('Mode resolution: synth theme and applyMode palette', () => {
  assert.strictEqual(resolveSynthTheme(album), 'gold');
  assert.strictEqual(resolveSynthTheme(standalone), 'crimson');
  assert.strictEqual(resolveSynthTheme({ ...album, synthTheme: 'brass' }), 'brass');
  // Albums bring their palette (ink defaults to parchment); standalone modes take the chosen palette
  assert.deepStrictEqual(applyMode(album), { modeId: 'album-x', inkColor: '#f3eddf', ...album.palette });
  const paper = applyMode(standalone, 'atelier-paper');
  assert.strictEqual(paper.modeId, 'solo');
  assert.strictEqual(paper.paletteId, 'atelier-paper');
  assert.strictEqual(paper.bgColor, '#f4f2ec');
  assert.strictEqual(paper.inkColor, '#202a26');
  assert.strictEqual(applyMode(standalone, 'nope').paletteId, 'studio-walnut');
});
