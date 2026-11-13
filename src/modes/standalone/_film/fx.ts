import type { AudioAnalysis } from '../../../types';

/**
 * Film / tape FX shared by the night modes (Backseat, Fog Stage, Camcorder '04).
 * No getImageData: everything is composite operations and small offscreen buffers,
 * so it runs per frame in preview and offline export alike. Time comes from
 * `currentTime` only, never the wall clock, so export frames match the preview.
 */

export interface Rect { x: number; y: number; w: number; h: number }

// ---------- beat envelopes ----------

export interface BeatState {
  kick: number;      // 0–1 envelope, fast attack, ~180 ms release
  hat: number;       // 0–1 envelope, ~60 ms release
  mid: number;       // 0–1 envelope, ~300 ms release
  rms: number;       // 0–1 smoothed loudness
  kickAvg: number;   // slow follower used to detect hits
  lastHit: number;   // currentTime of the last kick hit
  lastTime: number;  // currentTime of the previous step (-1 = none)
}

export interface BeatFrame {
  kick: number;
  hat: number;
  mid: number;
  rms: number;
  hit: boolean;   // a kick onset happened this frame
  dt: number;     // seconds since the previous step (0 after a seek / loop wrap)
}

export function newBeatState(): BeatState {
  return { kick: 0, hat: 0, mid: 0, rms: 0, kickAvg: 0, lastHit: -1, lastTime: -1 };
}

/** Mean of fft bytes in [a, b) scaled to 0–1. */
export function bandMean(fft: Uint8Array, a: number, b: number): number {
  const end = Math.min(b, fft.length);
  if (end <= a) return 0;
  let sum = 0;
  for (let i = a; i < end; i++) sum += fft[i];
  return sum / (end - a) / 255;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Advances the envelopes to `t`. Bins assume a 2048-point FFT at 44.1 kHz (21.5 Hz/bin):
 * kick 40–130 Hz, mids 250 Hz–2 kHz, hats 6–12 kHz.
 */
export function beatStep(s: BeatState, a: AudioAnalysis, t: number, sens = 1.2): BeatFrame {
  let dt = s.lastTime < 0 ? 0 : t - s.lastTime;
  if (dt < 0 || dt > 0.5) { dt = 0; s.lastHit = -1; }
  s.lastTime = t;
  const g = sens / 1.2;
  const kick = clamp01(((bandMean(a.fft, 2, 7) - 0.3) / 0.6) * g);
  const mid = clamp01(((bandMean(a.fft, 12, 93) - 0.2) / 0.6) * g);
  const hat = clamp01(((bandMean(a.fft, 280, 560) - 0.08) / 0.45) * g);
  const rms = clamp01((a.rms || 0) * 2.2 * g);

  const rel = (tau: number) => Math.exp(-dt / tau);
  const hit = kick > 0.35 && kick > s.kickAvg * 1.25 + 0.06 && (s.lastHit < 0 || t - s.lastHit > 0.14);
  if (hit) s.lastHit = t;
  s.kickAvg += (kick - s.kickAvg) * (1 - rel(0.4));
  s.kick = Math.max(kick, s.kick * rel(0.18));
  s.hat = Math.max(hat, s.hat * rel(0.06));
  s.mid = Math.max(mid, s.mid * rel(0.3));
  s.rms += (rms - s.rms) * (1 - rel(0.12));
  return { kick: s.kick, hat: s.hat, mid: s.mid, rms: s.rms, hit, dt };
}

/** Deterministic 0–1 hash for integer seeds (stable across preview and export). */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ---------- offscreen helpers ----------

export function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** The rect in raw canvas pixels (applies the context's current scale/translate). */
export function pixelRect(ctx: CanvasRenderingContext2D, r: Rect): Rect {
  if (typeof ctx.getTransform !== 'function') return r;
  const m = ctx.getTransform();
  return { x: r.x * m.a + m.e, y: r.y * m.d + m.f, w: r.w * m.a, h: r.h * m.d };
}

let grainTile: HTMLCanvasElement | null = null;
const GRAIN = 256;

function grainCanvas(): HTMLCanvasElement | null {
  if (grainTile) return grainTile;
  const c = makeCanvas(GRAIN, GRAIN);
  const g = c?.getContext('2d');
  if (!c || !g) return null;
  const img = g.createImageData(GRAIN, GRAIN);
  for (let i = 0; i < GRAIN * GRAIN; i++) {
    const v = Math.round(hash01(i + 17) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/** Tile offset for frame `f` of the grain (24 fps grain, like film). Pure. */
export function grainOffset(t: number): [number, number] {
  const f = Math.floor(t * 24);
  return [Math.floor(hash01(f * 2 + 1) * GRAIN), Math.floor(hash01(f * 2 + 2) * GRAIN)];
}

/** Film grain over `r` ('overlay' composite), `amount` 0–1, grain size `size` px. */
export function grain(ctx: CanvasRenderingContext2D, r: Rect, amount: number, t: number, size = 2): void {
  const tile = grainCanvas();
  if (!tile || amount <= 0) return;
  const s = GRAIN * size;
  const [ox, oy] = grainOffset(t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = false;
  for (let y = r.y - oy * size; y < r.y + r.h; y += s)
    for (let x = r.x - ox * size; x < r.x + r.w; x += s) ctx.drawImage(tile, x, y, s, s);
  ctx.restore();
}

const vignettes = new Map<string, CanvasGradient>();

/** Dark radial falloff toward the edges; `strength` 0–1. */
export function vignette(ctx: CanvasRenderingContext2D, r: Rect, strength: number, color = '0,0,0'): void {
  const key = `${r.x},${r.y},${r.w},${r.h}|${strength.toFixed(2)}|${color}`;
  let g = vignettes.get(key);
  if (!g) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g = ctx.createRadialGradient(cx, cy, Math.min(r.w, r.h) * 0.3, cx, cy, Math.hypot(r.w, r.h) * 0.55);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(1, `rgba(${color},${strength})`);
    if (vignettes.size > 32) vignettes.clear();
    vignettes.set(key, g);
  }
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** Full-rect colour wash with a composite op (flash = 'screen', tint = 'multiply' / 'soft-light' / 'color'). */
export function wash(ctx: CanvasRenderingContext2D, r: Rect, color: string, alpha: number, op: GlobalCompositeOperation): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Removes colour from what is already drawn in `r` (1 = black and white). */
export function desaturate(ctx: CanvasRenderingContext2D, r: Rect, amount = 1): void {
  wash(ctx, r, '#808080', amount, 'saturation');
}

interface Scratch { a: HTMLCanvasElement | null; b: HTMLCanvasElement | null }
const scratch = new WeakMap<object, Scratch>();

function scratchFor(ctx: CanvasRenderingContext2D): Scratch {
  const key: object = ctx.canvas ?? ctx;
  let s = scratch.get(key);
  if (!s) { s = { a: null, b: null }; scratch.set(key, s); }
  return s;
}

function sized(c: HTMLCanvasElement | null, w: number, h: number): HTMLCanvasElement | null {
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  const out = c ?? makeCanvas(cw, ch);
  if (out && (out.width !== cw || out.height !== ch)) { out.width = cw; out.height = ch; }
  return out;
}

/**
 * Bloom / halation: the frame is shrunk (which blurs it), only its bright parts kept
 * ('multiply' with itself squares the values), then added back with 'screen'.
 * `tint` colours the glow (red-orange = film halation).
 */
export function bloom(ctx: CanvasRenderingContext2D, r: Rect, amount: number, tint = '#ffffff', down = 10): void {
  if (amount <= 0 || !ctx.canvas) return;
  const p = pixelRect(ctx, r);
  const s = scratchFor(ctx);
  s.a = sized(s.a, p.w / down, p.h / down);
  const c = s.a?.getContext('2d');
  if (!s.a || !c) return;
  c.globalCompositeOperation = 'copy';
  c.imageSmoothingEnabled = true;
  c.drawImage(ctx.canvas, p.x, p.y, p.w, p.h, 0, 0, s.a.width, s.a.height);
  c.globalCompositeOperation = 'multiply';
  c.drawImage(s.a, 0, 0);
  c.drawImage(s.a, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = tint;
  c.fillRect(0, 0, s.a.width, s.a.height);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.a, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/**
 * Tape chroma bleed: removes red from the frame and adds back a blurred red copy
 * shifted by `shift` px, so edges get colour fringes.
 */
export function chromaShift(ctx: CanvasRenderingContext2D, r: Rect, shift: number, down = 2): void {
  if (shift === 0 || !ctx.canvas) return;
  const p = pixelRect(ctx, r);
  const s = scratchFor(ctx);
  s.b = sized(s.b, p.w / down, p.h / down);
  const c = s.b?.getContext('2d');
  if (!s.b || !c) return;
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, p.x, p.y, p.w, p.h, 0, 0, s.b.width, s.b.height);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = '#ff0000';
  c.fillRect(0, 0, s.b.width, s.b.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#00ffff';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(s.b, r.x + shift, r.y, r.w, r.h);
  ctx.restore();
}

/** Horizontal lines every `gap` px (interlace / scanlines). */
export function scanlines(ctx: CanvasRenderingContext2D, r: Rect, gap: number, alpha: number, offset = 0): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  const h = Math.max(1, gap / 2);
  for (let y = r.y + (offset % gap); y < r.y + r.h; y += gap) ctx.fillRect(r.x, y, r.w, h);
}

/** Soft round light (bokeh / lamp), additive. */
export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, alpha: number): void {
  if (alpha <= 0 || rad <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

// ---------- smoke texture ----------

let smokeTile: HTMLCanvasElement | null = null;
export const SMOKE = 256;

/** Seamless fractal value noise (4 octaves), 0–1, at integer pixel (x, y) of a `size` tile. Pure. */
export function smokeValue(x: number, y: number, size = SMOKE, seed = 3): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const cells = 4 << o;
    const cs = size / cells;
    const gx = x / cs;
    const gy = y / cs;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v = (i: number, j: number) => hash01(((i % cells) + cells) % cells + (((j % cells) + cells) % cells) * 977 + o * 7919 + seed * 104729);
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
    sum += (a + (b - a) * sy) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Grey smoke tile (alpha = density), rendered once. */
export function smokeCanvas(): HTMLCanvasElement | null {
  if (smokeTile) return smokeTile;
  const c = makeCanvas(SMOKE, SMOKE);
  const g = c?.getContext('2d');
  if (!c || !g) return null;
  const img = g.createImageData(SMOKE, SMOKE);
  for (let y = 0; y < SMOKE; y++)
    for (let x = 0; x < SMOKE; x++) {
      const v = smokeValue(x, y);
      const d = Math.max(0, Math.min(1, (v - 0.32) / 0.5));
      const i = (y * SMOKE + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(d * d * 255);
    }
  g.putImageData(img, 0, 0);
  smokeTile = c;
  return c;
}

/** Tiles the smoke texture over `r` at `scale` px per tile, scrolled by (ox, oy) px. */
export function smoke(ctx: CanvasRenderingContext2D, r: Rect, scale: number, ox: number, oy: number, alpha: number): void {
  const tile = smokeCanvas();
  if (!tile || alpha <= 0) return;
  const s = scale;
  const sx = ((ox % s) + s) % s;
  const sy = ((oy % s) + s) % s;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = r.y - sy; y < r.y + r.h; y += s)
    for (let x = r.x - sx; x < r.x + r.w; x += s) ctx.drawImage(tile, x, y, s, s);
  ctx.restore();
}
