import type { AudioAnalysis, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';

/**
 * Night Plate: audio-only technical poster on a near-black plate.
 * Five bone-white panels, all driven by `analysis`:
 *   01 starburst (bass) · 02 wave impression (waveform) · 03 spectral comb (fft)
 *   04 halftone cloth (bass ripple, fft dot gain) · 05 dither column (rms scroll, treble mutation)
 * Perf: grids, bin maps and the glyph atlas are cached by size; the frame loop only
 * writes into preallocated typed arrays and batches strokes/fills into single paths.
 */

const PLATE_BG = '#0b0b0a';
const BONE = '#e9e4d8';
const BONE_DIM = 'rgba(233, 228, 216, 0.55)';
const BONE_FAINT = 'rgba(233, 228, 216, 0.28)';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const CAPTION_FONT = `500 11px ${MONO}`;
const TITLE_FONT = `600 15px ${MONO}`;
const TAU = Math.PI * 2;

export interface Rect { x: number; y: number; w: number; h: number }

export interface PlateLayout {
  top: Rect;        // bordered block holding cells 01–03 and the title cell
  titleCell: Rect;  // captions (top-left)
  waveCell: Rect;   // 02 wave impression (under the title)
  burstCell: Rect;  // 01 starburst (top-right of the block)
  combCell: Rect;   // 03 spectral comb (bottom-right of the block)
  cloth: Rect;      // 04 halftone cloth
  column: Rect;     // 05 dither column (full height, right)
}

/** Editorial grid inside the mode region. Pure, so it can be unit-tested. */
export function plateLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): PlateLayout {
  const pad = Math.round(Math.min(region.width, region.height) * 0.03);
  const gap = Math.round(pad * 0.6);
  const x = region.x + pad;
  const y = region.y + pad;
  const w = region.width - pad * 2;
  const h = region.height - pad * 2;

  const colW = Math.round(w * 0.34);
  const leftW = w - colW - gap;
  const topH = Math.round(h * 0.36);

  const top: Rect = { x, y, w: leftW, h: topH };
  const splitX = Math.round(leftW * 0.58);
  const titleH = Math.round(topH * 0.36);
  const burstH = Math.round(topH * 0.6);

  return {
    top,
    titleCell: { x, y, w: splitX, h: titleH },
    waveCell: { x, y: y + titleH, w: splitX, h: topH - titleH },
    burstCell: { x: x + splitX, y, w: leftW - splitX, h: burstH },
    combCell: { x: x + splitX, y: y + burstH, w: leftW - splitX, h: topH - burstH },
    cloth: { x, y: y + topH + gap, w: leftW, h: h - topH - gap },
    column: { x: x + leftW + gap, y, w: colW, h },
  };
}

// ---------- shared helpers ----------

const PERM = (() => {
  const p = new Uint8Array(512);
  let seed = 1337;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  return p;
})();

function hash2(ix: number, iy: number): number {
  return PERM[(PERM[ix & 255] + iy) & 255] / 255;
}

/** 2D value noise in [0, 1]. */
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Thin 1px border aligned to the pixel grid. */
function frame(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
}

function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillText(text, Math.round(x), Math.round(y));
}

/** Log-spaced fft bin map, cached per (count, fft length). */
interface BinMap { count: number; len: number; bins: Uint16Array }
function logBins(cache: BinMap | null, count: number, len: number): BinMap {
  if (cache && cache.count === count && cache.len === len) return cache;
  const bins = new Uint16Array(count);
  const lo = 2;
  const hi = Math.max(lo + 1, Math.floor(len * 0.72));
  for (let i = 0; i < count; i++) {
    bins[i] = Math.min(len - 1, Math.floor(lo * Math.pow(hi / lo, i / Math.max(1, count - 1))));
  }
  return { count, len, bins };
}

// ---------- 01 starburst ----------

const RAYS = 28;
let burstBins: BinMap | null = null;

function drawStarburst(ctx: CanvasRenderingContext2D, r: Rect, a: AudioAnalysis, sens: number, t: number): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 6;
  const m = Math.min(r.w, r.h);
  const bass = clamp01(a.bass * sens);
  burstBins = logBins(burstBins, RAYS, a.fft.length);

  const rot = t * 0.12;
  const inner = m * 0.035;
  ctx.beginPath();
  for (let i = 0; i < RAYS; i++) {
    const ang = (i / RAYS) * TAU + rot;
    const band = a.fft.length ? a.fft[burstBins.bins[i]] / 255 : 0;
    const base = i % 2 === 0 ? 0.3 : 0.2;
    const len = m * (base + 0.14 * bass + 0.07 * band * sens);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    ctx.moveTo(cx + c * inner, cy + s * inner);
    ctx.lineTo(cx + c * len, cy + s * len);
  }
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pulse ring + core
  ctx.beginPath();
  ctx.arc(cx, cy, m * (0.36 + 0.06 * bass), 0, TAU);
  ctx.strokeStyle = BONE_FAINT;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2 + bass * 3, 0, TAU);
  ctx.fillStyle = BONE;
  ctx.fill();
}

// ---------- 02 wave impression ----------

const STEMS = 84;
const stemTop = new Float32Array(STEMS);
const stemBot = new Float32Array(STEMS);

function drawWaveImpression(ctx: CanvasRenderingContext2D, r: Rect, a: AudioAnalysis, sens: number): void {
  const wave = a.waveform;
  const n = wave.length;
  const chunk = Math.max(1, Math.floor(n / STEMS));
  for (let i = 0; i < STEMS; i++) {
    let hi = 0;
    let lo = 0;
    const start = i * chunk;
    const end = Math.min(n, start + chunk);
    for (let k = start; k < end; k++) {
      const v = (wave[k] - 128) / 128;
      if (v > hi) hi = v;
      if (v < lo) lo = v;
    }
    // fast attack, slow release: the impression "holds" its ink
    stemTop[i] = Math.max(hi, stemTop[i] * 0.88);
    stemBot[i] = Math.max(-lo, stemBot[i] * 0.88);
  }

  const left = r.x + 18;
  const width = r.w - 36;
  const mid = r.y + r.h * 0.5;
  const maxH = r.h * 0.3;
  const step = width / (STEMS - 1);

  ctx.beginPath();
  for (let i = 0; i < STEMS; i++) {
    const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / STEMS), 1.2);
    const up = Math.min(maxH, (0.04 + stemTop[i] * sens * 1.6) * maxH * taper);
    const dn = Math.min(maxH, (0.04 + stemBot[i] * sens * 1.6) * maxH * taper);
    const x = Math.round(left + i * step) + 0.5;
    ctx.moveTo(x, mid - up);
    ctx.lineTo(x, mid + dn);
  }
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left - 8, Math.round(mid) + 0.5);
  ctx.lineTo(left + width + 8, Math.round(mid) + 0.5);
  ctx.strokeStyle = BONE_FAINT;
  ctx.stroke();
}

// ---------- 03 spectral comb ----------

let combBins: BinMap | null = null;
let combLevels = new Float32Array(0);

function drawSpectralComb(ctx: CanvasRenderingContext2D, r: Rect, a: AudioAnalysis, sens: number): void {
  const inset = 14;
  const x0 = r.x + inset;
  const w = r.w - inset * 2;
  const y0 = r.y + inset;
  const h = r.h - inset * 2 - 14; // room for the caption
  const count = Math.max(8, Math.floor(w / 3));
  combBins = logBins(combBins, count, a.fft.length);
  if (combLevels.length !== count) combLevels = new Float32Array(count);

  const mid = y0 + h / 2;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const v = a.fft.length ? clamp01((a.fft[combBins.bins[i]] / 255) * sens) : 0;
    combLevels[i] = Math.max(v, combLevels[i] * 0.84);
    const half = (h / 2) * (0.12 + 0.88 * combLevels[i]);
    const x = Math.round(x0 + i * 3) + 0.5;
    ctx.moveTo(x, mid - half);
    ctx.lineTo(x, mid + half);
  }
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------- 04 halftone cloth ----------

interface ClothGrid { key: string; cols: number; rows: number; u: Float32Array; v: Float32Array; colBin: Uint16Array }
let cloth: ClothGrid | null = null;

function clothGrid(w: number, h: number, fftLen: number): ClothGrid {
  const key = `${w}x${h}|${fftLen}`;
  if (cloth && cloth.key === key) return cloth;
  const cols = 30;
  const rows = Math.max(10, Math.round((cols * h) / w));
  const u = new Float32Array(cols * rows);
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      u[j * cols + i] = i / (cols - 1);
      v[j * cols + i] = j / (rows - 1);
    }
  }
  const colBin = logBins(null, cols, Math.max(1, fftLen)).bins;
  cloth = { key, cols, rows, u, v, colBin };
  return cloth;
}

function drawCloth(ctx: CanvasRenderingContext2D, r: Rect, a: AudioAnalysis, sens: number, t: number): void {
  const padX = r.w * 0.12;
  const padY = r.h * 0.1;
  const fw = r.w - padX * 2;
  const fh = r.h - padY * 2;
  const g = clothGrid(Math.round(fw), Math.round(fh), a.fft.length);
  const sp = fw / (g.cols - 1);
  const rMax = sp * 0.5;
  const bass = clamp01(a.bass * sens);
  const amp = 0.55 + bass * 1.3;
  const cx = r.x + r.w / 2;
  const top = r.y + padY;
  const hasFft = a.fft.length > 0;

  ctx.beginPath();
  for (let k = 0, n = g.u.length; k < n; k++) {
    const u = g.u[k];
    const v = g.v[k];
    const p1 = u * 5.2 + v * 2.1 - t * 1.05;
    const p2 = v * 6.3 - u * 1.7 + t * 0.75;
    const s1 = Math.sin(p1);
    const s2 = Math.sin(p2);
    const height = s1 * 0.6 + s2 * 0.4;
    // fold: the sheet narrows and widens down its length like hanging fabric
    const fold = 0.86 + 0.14 * Math.sin(v * 3.4 + t * 0.5);
    const x = cx + (u - 0.5) * fw * fold + height * sp * 1.3 * amp;
    const y = top + v * fh + Math.sin(p1 * 0.7 + v * 3) * sp * 0.9 * amp;
    // light from the slope of the surface, plus the column's band as dot gain
    const light = 0.5 + 0.5 * (Math.cos(p1) * 0.65 + Math.cos(p2) * 0.35);
    const band = hasFft ? a.fft[g.colBin[k % g.cols]] / 255 : 0;
    const rad = rMax * clamp01(0.12 + 0.6 * light + 0.35 * band * sens);
    if (rad < 0.6) continue;
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, TAU);
  }
  ctx.fillStyle = BONE;
  ctx.fill();
}

// ---------- 05 dither column ----------

const GLYPHS = '.:-=+*#%@';
const CELL_W = 10;
const CELL_H = 13;
let atlas: HTMLCanvasElement | null = null;

function glyphAtlas(): HTMLCanvasElement {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = CELL_W * GLYPHS.length;
  c.height = CELL_H;
  const g = c.getContext('2d')!;
  g.fillStyle = BONE;
  g.font = `600 12px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) g.fillText(GLYPHS[i], i * CELL_W + CELL_W / 2, CELL_H / 2 + 1);
  atlas = c;
  return c;
}

let ditherScroll = 0;
let lastTime = -1;

function drawDitherColumn(ctx: CanvasRenderingContext2D, r: Rect, a: AudioAnalysis, sens: number, t: number): void {
  const energy = clamp01(a.rms * sens * 2.2);
  const treble = clamp01(a.treble * sens);
  // Scroll speed follows energy; a seek or a paused frame does not jump it.
  const dt = t - lastTime;
  if (lastTime >= 0 && dt > 0 && dt < 0.25) ditherScroll += dt * (2 + energy * 22);
  lastTime = t;

  const inset = 12;
  const x0 = r.x + inset;
  const y0 = r.y + inset + 16; // caption row
  const cols = Math.floor((r.w - inset * 2) / CELL_W);
  const rows = Math.ceil((r.h - inset * 2 - 16) / CELL_H) + 1;
  const xOff = x0 + ((r.w - inset * 2) - cols * CELL_W) / 2;
  const whole = Math.floor(ditherScroll);
  const frac = ditherScroll - whole;
  const tick = Math.floor(t * 10);
  const thresh = 0.5 - energy * 0.22;
  const levels = GLYPHS.length;
  const img = glyphAtlas();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, r.w - inset * 2, r.h - inset * 2 - 16);
  ctx.clip();
  for (let j = 0; j < rows; j++) {
    const wr = j - whole; // world row: content moves downward as scroll grows
    const y = Math.round(y0 + (j - 1 + frac) * CELL_H);
    for (let i = 0; i < cols; i++) {
      // vertical streaks (bark): stretched low-frequency noise + finer grain + slow drift
      let n = 0.62 * vnoise(i * 0.42, wr * 0.07)
        + 0.25 * vnoise(i * 1.1 + 17, wr * 0.22)
        + 0.13 * vnoise(i * 0.3 + 40, wr * 0.05 + t * 0.35);
      const flip = hash2(i * 7 + tick, wr * 13 + tick) < treble * 0.22;
      if (flip) n = 1.05 - n;
      if (n < thresh) continue;
      const lvl = Math.min(levels - 1, Math.floor(((n - thresh) / (1 - thresh)) * levels * 1.5));
      ctx.drawImage(img, lvl * CELL_W, 0, CELL_W, CELL_H, xOff + i * CELL_W, y, CELL_W, CELL_H);
    }
  }
  ctx.restore();
}

// ---------- plate ----------

function formatClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function drawSignalPlate(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime } = context;
  const sens = settings.audioSensitivity || 1.2;
  const L = plateLayout(region);

  ctx.save();
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(region.x, region.y, region.width, region.height);

  // Panel grid
  ctx.strokeStyle = BONE_DIM;
  ctx.lineWidth = 1;
  frame(ctx, L.top);
  frame(ctx, L.cloth);
  frame(ctx, L.column);
  ctx.beginPath();
  const vx = Math.round(L.burstCell.x) + 0.5;
  ctx.moveTo(vx, L.top.y);
  ctx.lineTo(vx, L.top.y + L.top.h);
  const hy = Math.round(L.waveCell.y) + 0.5;
  ctx.moveTo(L.top.x, hy);
  ctx.lineTo(vx, hy);
  const cy = Math.round(L.combCell.y) + 0.5;
  ctx.moveTo(vx, cy);
  ctx.lineTo(L.top.x + L.top.w, cy);
  ctx.stroke();

  // Panels
  drawStarburst(ctx, L.burstCell, analysis, sens, currentTime);
  drawWaveImpression(ctx, L.waveCell, analysis, sens);
  drawSpectralComb(ctx, L.combCell, analysis, sens);
  drawCloth(ctx, L.cloth, analysis, sens, currentTime);
  drawDitherColumn(ctx, L.column, analysis, sens, currentTime);

  // Captions
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = BONE;
  ctx.font = TITLE_FONT;
  caption(ctx, 'NIGHT — PLATE', L.titleCell.x + 18, L.titleCell.y + 36);
  ctx.font = CAPTION_FONT;
  ctx.fillStyle = BONE_DIM;
  caption(ctx, 'SPECIMEN SHEET N°07 · SIGNAL ONLY', L.titleCell.x + 18, L.titleCell.y + 60);
  caption(ctx, `T+ ${formatClock(currentTime)}`, L.titleCell.x + 18, L.titleCell.y + L.titleCell.h - 16);
  caption(ctx, `RMS ${analysis.rms.toFixed(3)}`, L.titleCell.x + L.titleCell.w - 104, L.titleCell.y + L.titleCell.h - 16);
  caption(ctx, '02 / IMPRESSION OF THE WAVE', L.waveCell.x + 18, L.waveCell.y + 26);
  caption(ctx, 'INKED FROM THE INCOMING SIGNAL', L.waveCell.x + 18, L.waveCell.y + L.waveCell.h - 16);
  caption(ctx, '01 / LOW BAND RADIANT', L.burstCell.x + 14, L.burstCell.y + L.burstCell.h - 12);
  caption(ctx, '03 / SPECTRAL COMB', L.combCell.x + 14, L.combCell.y + L.combCell.h - 10);
  caption(ctx, '04 / CLOTH FIELD · DOT GAIN FOLLOWS THE MIX', L.cloth.x + 14, L.cloth.y + L.cloth.h - 14);
  caption(ctx, '05 / DITHER LOG', L.column.x + 12, L.column.y + 20);

  ctx.restore();
}

export default { draw: drawSignalPlate } satisfies ModeModule;
