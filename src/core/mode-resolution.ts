import { AlbumView, ModeManifest, SynthTheme, VisualizerSettings } from '../types';
import { DEFAULT_INK, paletteSettings } from '../engine/palettes';

/**
 * Single place for "which hardware / theme does this frame use".
 * Pure (no Vite APIs) so tests can import it.
 *
 * `manifest.input` decides the medium: 'both' modes (all albums) switch between
 * the MIDI view and the audio waveform via `settings.albumView`; 'midi' and
 * 'audio' modes have a single medium.
 */
export const DEFAULT_HARDWARE_ID = 'st909';
export const WAVEFORM_HARDWARE_ID = 'tape-machine';

/** Without MIDI notes a 'both' mode can only show its waveform view. */
export function resolveAlbumView(s: VisualizerSettings, hasMidi: boolean): AlbumView {
  return hasMidi ? s.albumView : 'waveform';
}

/** True when the mode offers the MIDI / Audio view switch. */
export function hasViewSwitch(m: ModeManifest): boolean {
  return m.input === 'both';
}

/** MIDI-only modes cannot export until the user loads a real MIDI file (the demo does not count). */
export function exportBlockReason(m: ModeManifest, hasMidiFile: boolean): string | null {
  return m.input === 'midi' && !hasMidiFile ? 'This mode is MIDI only: load a MIDI file to export.' : null;
}

export function resolveHardwareId(m: ModeManifest, s: VisualizerSettings, hasMidi: boolean): string {
  if (hasViewSwitch(m) && resolveAlbumView(s, hasMidi) === 'waveform') {
    return m.waveformHardware ?? WAVEFORM_HARDWARE_ID;
  }
  return m.hardware ?? s.synthModel ?? DEFAULT_HARDWARE_ID;
}

/** True when the frame shows MIDI notes (drives the bottom notes row). */
export function showsMidi(m: ModeManifest, s: VisualizerSettings, hasMidi: boolean): boolean {
  if (hasViewSwitch(m)) return resolveAlbumView(s, hasMidi) === 'midi';
  return m.input === 'midi';
}

export function resolveSynthTheme(m: ModeManifest): SynthTheme {
  return m.synthTheme ?? 'crimson';
}

/**
 * Settings patch applied when a mode is picked (sidebar, first load, landing previews).
 * Albums bring their own palette; standalone modes take the user's palette (`paletteId`).
 */
export function applyMode(m: ModeManifest, paletteId?: string): Partial<VisualizerSettings> {
  if (m.kind === 'album') return { modeId: m.id, inkColor: DEFAULT_INK, ...m.palette };
  return { modeId: m.id, ...paletteSettings(paletteId) };
}

/** The active look id: `modeLook` when the manifest offers it, else its first look ('' when it has none). */
export function resolveLook(m: ModeManifest, modeLook: string | undefined): string {
  const looks = m.looks ?? [];
  return looks.find((l) => l.id === modeLook)?.id ?? looks[0]?.id ?? '';
}
