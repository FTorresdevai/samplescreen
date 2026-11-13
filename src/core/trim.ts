/** Pure helpers for the bar-snapped audio trimmer (no DOM, unit-tested). */

export const secondsPerBar = (bpm: number): number => (60 / (bpm || 80)) * 4;

/** Max |sample| per column, in [0, 1]. */
export function computePeaks(channel: Float32Array, columns: number): Float32Array {
  const peaks = new Float32Array(Math.max(0, columns));
  if (columns <= 0 || channel.length === 0) return peaks;
  const step = channel.length / columns;
  for (let c = 0; c < columns; c++) {
    const from = Math.floor(c * step);
    const to = Math.min(channel.length, Math.max(from + 1, Math.floor((c + 1) * step)));
    let max = 0;
    for (let i = from; i < to; i++) {
      const v = Math.abs(channel[i]);
      if (v > max) max = v;
    }
    peaks[c] = Math.min(1, max);
  }
  return peaks;
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

/** Grid steps per bar used when positioning the selection: 1 = bar, 4 = beat. */
export type SnapDivision = 1 | 4;

/** `start` is a 1-based bar position (x.25 steps with beat snap); the length is always whole bars. */
export interface TrimSelection { start: number; bars: number }

/** Visible window of the editor: `zoom` ≥ 1, `offset` in seconds from the start of the audio. */
export interface TrimView { zoom: number; offset: number }

export const MAX_TRIM_ZOOM = 32;
const EPS = 1e-6;

/** Grid line nearest to `seconds`, as a 1-based bar position. */
export function snapToGrid(seconds: number, bpm: number, division: SnapDivision): number {
  return Math.round((Math.max(0, seconds) / secondsPerBar(bpm)) * division) / division + 1;
}

/** Whole bars that fit between bar position `start` and the end of the audio. */
export function barsAvailable(start: number, duration: number, bpm: number): number {
  return Math.max(0, Math.floor(duration / secondsPerBar(bpm) - (start - 1) + EPS));
}

/** Clamps a selection into the audio: at least 1 bar, and the start is pulled back until the length fits. */
export function fitSelection(sel: TrimSelection, duration: number, bpm: number, division: SnapDivision): TrimSelection {
  const bars = Math.max(1, Math.min(Math.round(sel.bars), Math.max(1, barsAvailable(1, duration, bpm))));
  const lastStart = Math.floor((duration / secondsPerBar(bpm) - bars + 1) * division + EPS) / division;
  return { start: Math.max(1, Math.min(sel.start, lastStart)), bars };
}

export function clampView(view: TrimView, duration: number): TrimView {
  const zoom = Math.max(1, Math.min(MAX_TRIM_ZOOM, view.zoom));
  const visible = duration / zoom;
  return { zoom, offset: Math.max(0, Math.min(duration - visible, view.offset)) };
}

/** Zooms by `factor`, keeping the time at `anchorSec` under the same pixel. */
export function zoomView(view: TrimView, factor: number, anchorSec: number, duration: number): TrimView {
  const zoom = Math.max(1, Math.min(MAX_TRIM_ZOOM, view.zoom * factor));
  const ratio = (anchorSec - view.offset) / (duration / view.zoom || 1);
  return clampView({ zoom, offset: anchorSec - ratio * (duration / zoom) }, duration);
}
