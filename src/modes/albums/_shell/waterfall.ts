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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';   // small covers (250 px) are upscaled
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x, y, size, size);
}

/** Gallery mount for the album cover: frame colours and the room light that falls on it. */
export interface CoverMount {
  frame: [string, string];    // moulding gradient, light edge → dark edge
  mat: string;                // thin inner border between frame and art
  light: string;              // 'r,g,b' of the spotlight
  lightAlpha: number;
}

const MOUNT_PAD = 7;

/**
 * Before the art: a spotlight cone from the ceiling, a layered contact shadow (stacked
 * translucent rects, no shadowBlur) and the moulding + mat the cover sits in.
 */
export function drawCoverBacking(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, roomTop: number, m: CoverMount) {
  const p = MOUNT_PAD;
  ctx.save();
  // Spotlight cone: narrow at the ceiling, wide at the cover, fading downward
  const cone = ctx.createLinearGradient(0, roomTop, 0, y + size + p);
  cone.addColorStop(0, `rgba(${m.light},${m.lightAlpha * 0.5})`);
  cone.addColorStop(0.55, `rgba(${m.light},${m.lightAlpha * 0.22})`);
  cone.addColorStop(1, `rgba(${m.light},0)`);
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.38, roomTop);
  ctx.lineTo(x + size * 0.62, roomTop);
  ctx.lineTo(x + size + p * 4, y + size + p);
  ctx.lineTo(x - p * 4, y + size + p);
  ctx.closePath();
  ctx.fill();

  // Contact shadow: offset down-right, five soft layers
  for (let i = 5; i >= 1; i--) {
    ctx.fillStyle = `rgba(0,0,0,${0.09})`;
    ctx.fillRect(x - p + i * 0.8, y - p + i * 1.6, size + p * 2 + i * 1.2, size + p * 2 + i * 1.2);
  }

  // Moulding
  const frame = ctx.createLinearGradient(x - p, y - p, x + size + p, y + size + p);
  frame.addColorStop(0, m.frame[0]);
  frame.addColorStop(1, m.frame[1]);
  ctx.fillStyle = frame;
  ctx.fillRect(x - p, y - p, size + p * 2, size + p * 2);
  ctx.fillStyle = m.mat;
  ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
  ctx.restore();
}

/** After the art: glass sheen, a bevel line on the moulding and the light's top-edge falloff. */
export function drawCoverFinish(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, m: CoverMount) {
  const p = MOUNT_PAD;
  ctx.save();
  // Light falloff: brighter at the top edge where the spot hits, darker toward the bottom
  const fall = ctx.createLinearGradient(0, y, 0, y + size);
  fall.addColorStop(0, `rgba(${m.light},${m.lightAlpha * 0.18})`);
  fall.addColorStop(0.45, 'rgba(0,0,0,0)');
  fall.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = fall;
  ctx.fillRect(x, y, size, size);

  // Diagonal glass reflection
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  const glass = ctx.createLinearGradient(x, y, x + size, y + size);
  glass.addColorStop(0.18, 'rgba(255,255,255,0)');
  glass.addColorStop(0.3, 'rgba(255,255,255,0.07)');
  glass.addColorStop(0.36, 'rgba(255,255,255,0)');
  ctx.fillStyle = glass;
  ctx.fillRect(x, y, size, size);
  ctx.restore();

  // Bevels: highlight on the top-left of the moulding, inner shadow line around the art
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${m.light},0.35)`;
  ctx.beginPath();
  ctx.moveTo(x - p + 0.5, y + size + p - 0.5);
  ctx.lineTo(x - p + 0.5, y - p + 0.5);
  ctx.lineTo(x + size + p - 0.5, y - p + 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeRect(x - 0.5, y - 0.5, size + 1, size + 1);
  ctx.restore();
}
