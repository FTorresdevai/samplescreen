import { AlbumView, ModeManifest, SynthTheme, VisualizerSettings } from '../types';
import { DEFAULT_INK, paletteSettings } from '../engine/palettes';

/**
 * Single place for "which hardware / theme does this frame use".
 * Pure (no Vite APIs) so tests can import it.
 *
 * Only albums have two views (MIDI waterfall or audio waveform). Standalone
 * modes have a single medium, declared by `manifest.input`.
 */
export const DEFAULT_HARDWARE_ID = 'st909';
export const WAVEFORM_HARDWARE_ID = 'tape-machine';

/** Without MIDI notes an album can only show its waveform view. */
export function resolveAlbumView(s: VisualizerSettings, hasMidi: boolean): AlbumView {
  return hasMidi ? s.albumView : 'waveform';
}

export function resolveHardwareId(m: ModeManifest, s: VisualizerSettings, hasMidi: boolean): string {
  if (m.kind === 'album' && resolveAlbumView(s, hasMidi) === 'waveform') {
    return m.waveformHardware ?? WAVEFORM_HARDWARE_ID;
  }
  return m.hardware ?? s.synthModel ?? DEFAULT_HARDWARE_ID;
}

/** True when the frame shows MIDI notes (drives the bottom notes row). */
export function showsMidi(m: ModeManifest, s: VisualizerSettings, hasMidi: boolean): boolean {
  if (m.kind === 'album') return resolveAlbumView(s, hasMidi) === 'midi';
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
