/** Pure helpers for the bar-snapped audio trimmer (no DOM, unit-tested). */

export const secondsPerBar = (bpm: number): number => (60 / (bpm || 80)) * 4;

/** Bar boundary nearest to `seconds`, as a 1-based bar index clamped to [1, maxBars + 1]. */
export function snapToBar(seconds: number, bpm: number, maxBars: number): number {
  const bar = Math.round(seconds / secondsPerBar(bpm)) + 1;
  return Math.max(1, Math.min(maxBars + 1, bar));
}

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
