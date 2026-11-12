import { ModeManifest, SynthTheme, VisualizerSettings } from '../types';

/**
 * Single place for "which hardware / theme does this frame use".
 * Pure (no Vite APIs) so tests can import it.
 *
 * Phase 3 keeps today's behaviour: the waveform view is the global `waveformMode`
 * toggle and forces the tape machine in every mode. Phase 4 replaces it with
 * the per-album `albumView`.
 */
export const DEFAULT_HARDWARE_ID = 'st909';
export const WAVEFORM_HARDWARE_ID = 'tape-machine';

export function isWaveformView(s: VisualizerSettings, hasMidi: boolean): boolean {
  return s.waveformMode ?? !hasMidi;
}

export function resolveHardwareId(m: ModeManifest, s: VisualizerSettings, hasMidi: boolean): string {
  if (isWaveformView(s, hasMidi)) return WAVEFORM_HARDWARE_ID;
  return m.hardware ?? s.synthModel ?? DEFAULT_HARDWARE_ID;
}

export function resolveSynthTheme(m: ModeManifest): SynthTheme {
  return m.synthTheme ?? 'crimson';
}

/** Settings patch applied when the user picks a mode in the sidebar. */
export function applyMode(m: ModeManifest): Partial<VisualizerSettings> {
  return { modeId: m.id, ...m.palette };
}
