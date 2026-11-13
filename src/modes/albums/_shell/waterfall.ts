import { AudioAnalysis, MidiNote, ModelDrawContext } from '../../../types';
import { getCachedImage } from '../../../shared/assets';

/** How far ahead (seconds) a note appears at the top of the waterfall. */
export const ALBUM_LOOKAHEAD_SEC = 2.6;

export interface FallingNote {
  note: MidiNote;
  relStart: number;   // seconds until the note reaches the keys (≤ 0 once it sounds)
  relEnd: number;     // seconds until it ends
  isActive: boolean;
}

/**
 * Notes inside the lookahead window, including the copies that wrap around the loop
 * (and the intro → main-loop boundary), so the waterfall never has a gap at the seam.
 */
export function visibleNotes(context: ModelDrawContext, lookaheadSec = ALBUM_LOOKAHEAD_SEC): FallingNote[] {
  const { currentTime, loopTime, duration, midi, settings, introInfo } = context;
  const hasIntro = introInfo?.hasIntro ?? introInfo?.isIntro ?? false;
  const isIntro = introInfo?.isIntro ?? false;
  const secondsPerBar = (60 / (settings.bpm || midi.bpm || 80)) * 4;
  const introDuration = introInfo?.introDuration ?? (hasIntro ? (introInfo?.totalIntroBars || 1) * secondsPerBar : 0);
  const loopDuration = duration || 16;
  const mainLoopDuration = introInfo?.mainLoopDuration ?? loopDuration;
  const now = typeof loopTime === 'number' && !isNaN(loopTime) ? loopTime : currentTime % loopDuration;

  const out: FallingNote[] = [];
  for (const note of midi.notes || []) {
    const inMainLoop = hasIntro && !isIntro && note.time >= introDuration;
    const period = inMainLoop ? mainLoopDuration : loopDuration;
    const offsets = [0];
    if (!hasIntro || inMainLoop) {
      const progress = hasIntro ? Math.max(0, now - introDuration) % mainLoopDuration : now % loopDuration;
      if (progress > period - lookaheadSec) offsets.push(1);
      if (progress < lookaheadSec) offsets.push(-1);
    }
    for (const k of offsets) {
      const relStart = note.time + k * period - now;
      const relEnd = relStart + note.duration;
      if (relEnd < 0 || relStart > lookaheadSec) continue;
      out.push({ note, relStart, relEnd, isActive: relStart <= 0 && relEnd >= 0 });
    }
  }
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 0 = slow and quiet, 1 = fast and loud. Half from the tempo (90 → 160 BPM),
 * half from the bass and overall level, so a beat switch or an 808 pushes it up.
 */
export function albumEnergy(bpm: number, analysis: AudioAnalysis, sensitivity = 1): number {
  const tempo = clamp01(((bpm || 80) - 90) / 70);
  const level = clamp01((analysis.bass * 0.65 + analysis.rms * 0.35) * sensitivity);
  return clamp01(tempo * 0.5 + level * 0.6);
}

/** Deterministic 0–1 value per index: same frame in preview and export. */
export function hash01(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Optional album cover: drop `cover.jpg` (or .png / .webp) into the album's `assets/` folder.
 * `urls` comes from `import.meta.glob('./assets/cover.*', { eager: true, query: '?url', import: 'default' })`.
 */
export function optionalCover(urls: Record<string, string>): HTMLImageElement | null {
  const url = Object.values(urls)[0];
  return url ? getCachedImage(url) : null;
}

/** Image scaled to cover the square, cropped from the centre. */
export function drawCoverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, y, size, size);
}
