import type { AudioAnalysis, MidiNote, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';
import { hexToRgb } from '../../../engine/palettes';

/**
 * Pocket Player: a silver pocket MP3 player with a click wheel, lying on a grey desk
 * next to a pair of white earbuds. The beat plays on its colour screen:
 *   - header bar ("Now Playing", play/pause glyph, battery),
 *   - spinning record "cover" that pulses with the bass, title / artist / BPM · key,
 *   - audio view: segmented spectrum with peak caps; MIDI view: mini piano roll past a playhead,
 *   - progress bar with elapsed / remaining time.
 * Perf: the desk, earbuds, body and wheel never change for a given size, so they are painted
 * once into an offscreen buffer; each frame only redraws the screen.
 * No brand marks: generic player, generic labels.
 */

const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
/** Analyser bins come from a 2048-point FFT; 44.1 kHz assumed (same as Night Scope). */
const BIN_HZ = 44100 / 2048;
const BANDS = 28;
const SEGMENTS = 12;
const DEVICE_ASPECT = 0.75; // width / height
const EAR_SPACE = 0.42;     // room left of the device for the earbuds, × device width

export interface Rect { x: number; y: number; w: number; h: number }

export interface PlayerLayout {
  device: Rect;
  bezel: Rect;   // black glass around the LCD
  screen: Rect;  // LCD
  wheel: { cx: number; cy: number; r: number; inner: number };
  header: Rect;
  art: Rect;
  meta: Rect;
  viz: Rect;
  progress: Rect;
}

/** Device and screen layout inside the mode region. Pure, so it can be unit-tested. */
export function playerLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): PlayerLayout {
  const d = Math.min((region.width * 0.9) / (1 + EAR_SPACE), region.height * 0.84 * DEVICE_ASPECT);
  const h = d / DEVICE_ASPECT;
  const compW = d * (1 + EAR_SPACE);
  const device: Rect = {
    x: region.x + (region.width - compW) / 2 + d * EAR_SPACE,
    y: region.y + (region.height - h) / 2,
    w: d,
    h,
  };

  const bm = d * 0.065;
  const bezel: Rect = { x: device.x + bm, y: device.y + bm, w: d - bm * 2, h: (d - bm * 2) * 0.7 };
  const gi = d * 0.018;
  const screen: Rect = { x: bezel.x + gi, y: bezel.y + gi, w: bezel.w - gi * 2, h: bezel.h - gi * 2 };

  const below = device.y + device.h - (bezel.y + bezel.h);
  const r = Math.min(d * 0.36, below * 0.42);
  const wheel = { cx: device.x + d / 2, cy: bezel.y + bezel.h + below / 2, r, inner: r * 0.42 };

  const pad = screen.h * 0.035;
  const header: Rect = { x: screen.x, y: screen.y, w: screen.w, h: screen.h * 0.12 };
  const ix = screen.x + pad * 1.5;
  const iw = screen.w - pad * 3;
  let y = header.y + header.h + pad;
  const artH = screen.h * 0.3;
  const art: Rect = { x: ix, y, w: artH, h: artH };
  const meta: Rect = { x: ix + artH + pad * 1.5, y, w: iw - artH - pad * 1.5, h: artH };
  y += artH + pad;
  const progH = screen.h * 0.14;
  const progress: Rect = { x: ix, y: screen.y + screen.h - pad - progH, w: iw, h: progH };
  const viz: Rect = { x: ix, y, w: iw, h: progress.y - pad - y };
  return { device, bezel, screen, wheel, header, art, meta, viz, progress };
}

/** `m:ss` (negative input clamps to 0). */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Log-spaced band edges as FFT bin indices: n + 1 strictly increasing values. */
export function bandEdges(n: number, minHz: number, maxHz: number, bins: number): Int32Array {
  const edges = new Int32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const hz = minHz * Math.pow(maxHz / minHz, i / n);
    const bin = Math.min(bins - 1, Math.max(1, Math.round(hz / BIN_HZ)));
    edges[i] = i > 0 && bin <= edges[i - 1] ? edges[i - 1] + 1 : bin;
  }
  return edges;
}

/** 0–1 level per band (loudest bin in the band), scaled by sensitivity. */
export function bandLevels(fft: Uint8Array, edges: Int32Array, sens: number, out: Float32Array): Float32Array {
  for (let i = 0; i < out.length; i++) {
    let m = 0;
    for (let b = edges[i]; b < edges[i + 1] && b < fft.length; b++) if (fft[b] > m) m = fft[b];
    const v = ((m / 255 - 0.2) / 0.75) * (sens / 1.2);
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}

/** Screen accent from the palette's notes colour, darkened until it reads on the white LCD. */
export function screenAccent(hex: string | undefined): string {
  let { r, g, b } = hexToRgb(hex || '#3b82f6');
  for (let i = 0; i < 6 && (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5; i++) {
    r *= 0.8; g *= 0.8; b *= 0.8;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ---------- per-canvas state ----------

interface PlayerState {
  base: HTMLCanvasElement | null;
  baseKey: string;
  edges: Int32Array | null;
  edgesLen: number;
  raw: Float32Array;
  level: Float32Array;
  peak: Float32Array;
  lastTime: number;
  bass: number;
}

const states = new WeakMap<object, PlayerState>();
const rangeCache = new WeakMap<MidiNote[], { lo: number; hi: number }>();
const NO_NOTES: MidiNote[] = [];

function stateFor(ctx: CanvasRenderingContext2D): PlayerState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) {
    s = {
      base: null, baseKey: '', edges: null, edgesLen: 0,
      raw: new Float32Array(BANDS), level: new Float32Array(BANDS), peak: new Float32Array(BANDS),
      lastTime: -1, bass: 0,
    };
    states.set(key, s);
  }
  return s;
}

function pitchRange(notes: MidiNote[]): { lo: number; hi: number } {
  let r = rangeCache.get(notes);
  if (!r) {
    let lo = 127;
    let hi = 0;
    for (const n of notes) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
    if (lo > hi) { lo = 48; hi = 72; }
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = Math.floor(c - 6); hi = Math.ceil(c + 6); }
    r = { lo, hi };
    rangeCache.set(notes, r);
  }
  return r;
}

// ---------- drawing helpers ----------

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + '…';
}

function rgba(rgb: string, a: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `, ${a})`);
}

// ---------- static layer: desk, earbuds, body, wheel ----------

function drawCable(ctx: CanvasRenderingContext2D, pts: number[], w: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [col, lw] of [['rgba(0,0,0,0.18)', w * 1.7], ['#cfd0d2', w * 1.25], ['#fbfbfb', w]] as const) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const STEM_LEN = 1.5;  // × earbud size
const STEM_X = 0.35;
const STEM_Y = 0.45;

/** World position of an earbud's stem tip (where the cable leaves). */
function earbudTip(x: number, y: number, size: number, angle: number): [number, number] {
  const tx = size * STEM_X;
  const ty = size * (STEM_Y - 0.2 + STEM_LEN);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x + tx * c - ty * s, y + tx * s + ty * c];
}

/** Earbud head + stem at (x, y), rotated. */
function drawEarbud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number): void {
  const stemLen = size * STEM_LEN;
  const sx = size * STEM_X;
  const sy = size * STEM_Y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = size * 0.4;
  ctx.shadowOffsetY = size * 0.15;

  // Stem
  const sg = ctx.createLinearGradient(sx - size * 0.22, 0, sx + size * 0.22, 0);
  sg.addColorStop(0, '#d6d7d9');
  sg.addColorStop(0.45, '#ffffff');
  sg.addColorStop(1, '#c9cacc');
  ctx.fillStyle = sg;
  rr(ctx, sx - size * 0.2, sy - size * 0.2, size * 0.4, stemLen, size * 0.2);
  ctx.fill();

  // Head
  const hg = ctx.createRadialGradient(-size * 0.35, -size * 0.35, size * 0.1, 0, 0, size * 1.1);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(0.6, '#f1f1f2');
  hg.addColorStop(1, '#c6c7c9');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Speaker slot
  ctx.fillStyle = '#2b2c2e';
  ctx.beginPath();
  ctx.ellipse(-size * 0.38, -size * 0.15, size * 0.24, size * 0.08, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.6);
  ctx.lineTo(x + s * 0.5, y);
  ctx.lineTo(x - s * 0.5, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
}

function drawSkipIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: 1 | -1): void {
  for (const off of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(x + (off - 0.45) * s * dir, y - s * 0.5);
    ctx.lineTo(x + (off + 0.45) * s * dir, y);
    ctx.lineTo(x + (off - 0.45) * s * dir, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(dir > 0 ? x + s * 0.9 : x - s * 1.05, y - s * 0.5, s * 0.15, s);
}

function paintStatic(ctx: CanvasRenderingContext2D, region: ModelRegion, L: PlayerLayout): void {
  const { x, y, width: W, height: H } = region;
  const D = L.device;
  const d = D.w;

  // Desk: soft grey with a light spot near the top.
  const desk = ctx.createLinearGradient(x, y, x + W * 0.4, y + H);
  desk.addColorStop(0, '#d4d5d7');
  desk.addColorStop(1, '#9c9ea1');
  ctx.fillStyle = desk;
  ctx.fillRect(x, y, W, H);
  const spot = ctx.createRadialGradient(x + W * 0.55, y + H * 0.25, 0, x + W * 0.55, y + H * 0.25, Math.max(W, H) * 0.75);
  spot.addColorStop(0, 'rgba(255,255,255,0.35)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(x, y, W, H);

  // Earbuds: cables first so the heads sit on top.
  const size = d * 0.13;
  const e1 = { x: D.x - d * 0.24, y: D.y + d * 0.06, a: -0.35 };
  const e2 = { x: D.x - d * 0.33, y: D.y + d * 0.42, a: -0.2 };
  const bottom = y + H + d * 0.05;
  const cw = Math.max(1.5, d * 0.014);
  const t1 = earbudTip(e1.x, e1.y, size, e1.a);
  const t2 = earbudTip(e2.x, e2.y, size, e2.a);
  drawCable(ctx, [t1[0], t1[1], t1[0] + d * 0.05, t1[1] + d * 0.5, D.x - d * 0.05, D.y + D.h * 0.7, D.x - d * 0.12, bottom], cw);
  drawCable(ctx, [t2[0], t2[1], t2[0] + d * 0.02, t2[1] + d * 0.4, D.x - d * 0.25, D.y + D.h * 0.8, D.x - d * 0.2, bottom], cw);
  drawEarbud(ctx, e1.x, e1.y, size, e1.a);
  drawEarbud(ctx, e2.x, e2.y, size, e2.a);

  // Headphone cable out of the bottom edge.
  const jx = D.x + d * 0.82;
  drawCable(ctx, [jx, D.y + D.h, jx, D.y + D.h + d * 0.2, jx + d * 0.03, bottom - d * 0.2, jx + d * 0.04, bottom], cw);
  ctx.fillStyle = '#f4f4f5';
  rr(ctx, jx - d * 0.028, D.y + D.h - d * 0.01, d * 0.056, d * 0.11, d * 0.012);
  ctx.fill();

  // Body: brushed aluminium.
  const rad = d * 0.09;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = d * 0.07;
  ctx.shadowOffsetY = d * 0.03;
  const body = ctx.createLinearGradient(0, D.y, 0, D.y + D.h);
  body.addColorStop(0, '#ececee');
  body.addColorStop(0.5, '#d2d4d7');
  body.addColorStop(1, '#b6b8bc');
  ctx.fillStyle = body;
  rr(ctx, D.x, D.y, D.w, D.h, rad);
  ctx.fill();
  ctx.restore();

  ctx.save();
  rr(ctx, D.x, D.y, D.w, D.h, rad);
  ctx.clip();
  let seed = 7;
  for (let ly = D.y; ly < D.y + D.h; ly += Math.max(1, d * 0.004)) {
    seed = (seed * 16807) % 2147483647;
    const v = seed / 2147483647;
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.12})` : `rgba(0,0,0,${v * 0.06})`;
    ctx.fillRect(D.x, ly, D.w, 1);
  }
  const curve = ctx.createLinearGradient(D.x, 0, D.x + D.w, 0);
  curve.addColorStop(0, 'rgba(0,0,0,0.16)');
  curve.addColorStop(0.07, 'rgba(0,0,0,0)');
  curve.addColorStop(0.93, 'rgba(0,0,0,0)');
  curve.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = curve;
  ctx.fillRect(D.x, D.y, D.w, D.h);
  ctx.restore();

  ctx.lineWidth = Math.max(1, d * 0.004);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  rr(ctx, D.x + 1.5, D.y + 1.5, D.w - 3, D.h - 3, rad - 1.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, D.x, D.y, D.w, D.h, rad);
  ctx.stroke();

  // Bezel
  const B = L.bezel;
  const bz = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
  bz.addColorStop(0, '#1a1b1d');
  bz.addColorStop(1, '#050506');
  ctx.fillStyle = bz;
  rr(ctx, B.x, B.y, B.w, B.h, d * 0.02);
  ctx.fill();

  // Click wheel
  const { cx, cy, r, inner } = L.wheel;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = r * 0.08;
  ctx.shadowOffsetY = r * 0.02;
  const ring = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy, r);
  ring.addColorStop(0, '#ffffff');
  ring.addColorStop(1, '#e7e8ea');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, r * 0.01);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const btn = ctx.createLinearGradient(0, cy - inner, 0, cy + inner);
  btn.addColorStop(0, '#cdced1');
  btn.addColorStop(1, '#dfe0e2');
  ctx.fillStyle = btn;
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.stroke();

  ctx.fillStyle = '#9a9da2';
  ctx.font = `700 ${Math.round(r * 0.13)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MENU', cx, cy - r * 0.71);
  const ic = r * 0.075;
  drawSkipIcon(ctx, cx - r * 0.71, cy, ic, -1);
  drawSkipIcon(ctx, cx + r * 0.71, cy, ic, 1);
  drawPlayIcon(ctx, cx - ic * 0.9, cy + r * 0.71, ic * 1.3);
  ctx.fillRect(cx + ic * 0.25, cy + r * 0.71 - ic * 0.75, ic * 0.32, ic * 1.5);
  ctx.fillRect(cx + ic * 0.85, cy + r * 0.71 - ic * 0.75, ic * 0.32, ic * 1.5);
}

function staticLayer(ctx: CanvasRenderingContext2D, s: PlayerState, region: ModelRegion, L: PlayerLayout, scale: number): HTMLCanvasElement | null {
  const key = `${region.x},${region.y},${region.width},${region.height}@${scale}`;
  if (s.base && s.baseKey === key) return s.base;
  if (typeof document === 'undefined') return null;
  const c = s.base ?? document.createElement('canvas');
  c.width = Math.ceil(region.width * scale);
  c.height = Math.ceil(region.height * scale);
  const bctx = c.getContext('2d');
  if (!bctx) return null;
  bctx.setTransform(scale, 0, 0, scale, -region.x * scale, -region.y * scale);
  paintStatic(bctx, region, L);
  s.base = c;
  s.baseKey = key;
  return c;
}

// ---------- screen ----------

function drawHeader(ctx: CanvasRenderingContext2D, R: Rect, playing: boolean): void {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, '#fbfcfd');
  g.addColorStop(1, '#cdd2d8');
  ctx.fillStyle = g;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(R.x, R.y + R.h - 1, R.w, 1);

  const cy = R.y + R.h / 2;
  const u = R.h * 0.32;
  ctx.fillStyle = '#2f3338';
  if (playing) drawPlayIcon(ctx, R.x + R.h * 0.6, cy, u);
  else {
    ctx.fillRect(R.x + R.h * 0.4, cy - u * 0.6, u * 0.35, u * 1.2);
    ctx.fillRect(R.x + R.h * 0.4 + u * 0.6, cy - u * 0.6, u * 0.35, u * 1.2);
  }
  ctx.font = `600 ${Math.round(R.h * 0.5)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Now Playing', R.x + R.w / 2, cy + 0.5);

  // Battery
  const bw = R.h * 0.95;
  const bh = R.h * 0.42;
  const bx = R.x + R.w - R.h * 0.4 - bw;
  ctx.strokeStyle = '#2f3338';
  ctx.lineWidth = Math.max(1, R.h * 0.06);
  rr(ctx, bx, cy - bh / 2, bw, bh, bh * 0.2);
  ctx.stroke();
  ctx.fillRect(bx + bw, cy - bh * 0.22, bh * 0.18, bh * 0.44);
  const fill = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
  fill.addColorStop(0, '#8fe07a');
  fill.addColorStop(1, '#3f9e2c');
  ctx.fillStyle = fill;
  const p = bh * 0.18;
  ctx.fillRect(bx + p, cy - bh / 2 + p, (bw - p * 2) * 0.8, bh - p * 2);
}

function drawArt(ctx: CanvasRenderingContext2D, R: Rect, accent: string, bass: number, t: number): void {
  const g = ctx.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h);
  g.addColorStop(0, accent);
  g.addColorStop(1, '#101114');
  ctx.save();
  rr(ctx, R.x, R.y, R.w, R.h, R.w * 0.04);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  const cx = R.x + R.w / 2;
  const cy = R.y + R.h / 2;
  const rad = R.w * 0.4 * (1 + bass * 0.06);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, rad * (1.08 + bass * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#121214';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let k = 0.5; k < 0.97; k += 0.09) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sheen sweeps around as the record turns (33⅓ rpm).
  const a = t * ((Math.PI * 2 * 33.333) / 60);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, rad, a, a + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, rad, a + Math.PI, a + Math.PI + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eceef1';
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeta(ctx: CanvasRenderingContext2D, R: Rect, title: string, artist: string, info: string): void {
  const px = R.h * 0.2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111317';
  ctx.font = `700 ${Math.round(px)}px ${SANS}`;
  ctx.fillText(fitText(ctx, title, R.w), R.x, R.y + R.h * 0.22);
  ctx.fillStyle = '#3b4048';
  ctx.font = `500 ${Math.round(px * 0.85)}px ${SANS}`;
  ctx.fillText(fitText(ctx, artist, R.w), R.x, R.y + R.h * 0.5);
  ctx.fillStyle = '#6b717a';
  ctx.font = `500 ${Math.round(px * 0.75)}px ${SANS}`;
  ctx.fillText(fitText(ctx, info, R.w), R.x, R.y + R.h * 0.76);
}

function drawSpectrum(ctx: CanvasRenderingContext2D, R: Rect, s: PlayerState, accent: string): void {
  const gap = Math.max(1, R.w * 0.006);
  const bw = (R.w - gap * (BANDS - 1)) / BANDS;
  const sg = Math.max(1, R.h * 0.018);
  const sh = (R.h - sg * (SEGMENTS - 1)) / SEGMENTS;
  for (let i = 0; i < BANDS; i++) {
    const x = R.x + i * (bw + gap);
    const lit = Math.round(s.level[i] * SEGMENTS);
    for (let k = 0; k < SEGMENTS; k++) {
      const y = R.y + R.h - (k + 1) * sh - k * sg;
      ctx.fillStyle = k < lit ? rgba(accent, 0.45 + 0.55 * (k / (SEGMENTS - 1))) : 'rgba(17,19,23,0.06)';
      ctx.fillRect(x, y, bw, sh);
    }
    const pk = Math.min(SEGMENTS - 1, Math.round(s.peak[i] * SEGMENTS) - 1);
    if (pk >= lit && pk >= 0) {
      ctx.fillStyle = '#111317';
      ctx.fillRect(x, R.y + R.h - (pk + 1) * sh - pk * sg, bw, sh * 0.45);
    }
  }
}

function drawRoll(ctx: CanvasRenderingContext2D, R: Rect, notes: MidiNote[], now: number, loop: number, barLen: number, accent: string): void {
  ctx.fillStyle = 'rgba(17,19,23,0.04)';
  ctx.fillRect(R.x, R.y, R.w, R.h);
  const span = barLen * 2;
  const head = R.x + R.w * 0.25;
  const pxs = R.w / span;
  const t0 = now - span * 0.25;
  const t1 = now + span * 0.75;
  const { lo, hi } = pitchRange(notes);
  const rows = hi - lo + 1;
  const rowH = R.h / rows;

  // Beat lines
  ctx.fillStyle = 'rgba(17,19,23,0.08)';
  const beat = barLen / 4;
  for (let b = Math.ceil(t0 / beat) * beat; b < t1; b += beat) ctx.fillRect(R.x + (b - t0) * pxs, R.y, 1, R.h);

  for (const n of notes) {
    for (const off of [-loop, 0, loop]) {
      const a = n.time + off;
      const b = a + n.duration;
      if (b < t0 || a > t1) continue;
      const on = a <= now && now < b;
      const x = Math.max(R.x, R.x + (a - t0) * pxs);
      const w = Math.min(R.x + R.w, R.x + (b - t0) * pxs) - x;
      if (w <= 0) continue;
      const y = R.y + (hi - n.midi) * rowH;
      ctx.fillStyle = on ? accent : rgba(accent, 0.35 + 0.35 * n.velocity);
      rr(ctx, x, y + rowH * 0.1, Math.max(2, w), Math.max(2, rowH * 0.8), Math.min(3, rowH * 0.3));
      ctx.fill();
    }
  }
  ctx.fillStyle = '#111317';
  ctx.fillRect(head - 1, R.y, 2, R.h);
}

function drawProgress(ctx: CanvasRenderingContext2D, R: Rect, now: number, total: number, accent: string): void {
  const barH = R.h * 0.3;
  const by = R.y + R.h * 0.08;
  const frac = total > 0 ? Math.min(1, Math.max(0, now / total)) : 0;
  const track = ctx.createLinearGradient(0, by, 0, by + barH);
  track.addColorStop(0, '#c9ced5');
  track.addColorStop(1, '#eef0f3');
  ctx.fillStyle = track;
  rr(ctx, R.x, by, R.w, barH, barH / 2);
  ctx.fill();
  if (frac > 0) {
    const f = ctx.createLinearGradient(0, by, 0, by + barH);
    f.addColorStop(0, rgba(accent, 0.65));
    f.addColorStop(0.5, accent);
    f.addColorStop(1, rgba(accent, 0.8));
    ctx.fillStyle = f;
    rr(ctx, R.x, by, Math.max(barH, R.w * frac), barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(R.x + barH / 2, by + barH * 0.12, Math.max(0, R.w * frac - barH), barH * 0.25);
  }
  ctx.strokeStyle = 'rgba(17,19,23,0.25)';
  ctx.lineWidth = 1;
  rr(ctx, R.x, by, R.w, barH, barH / 2);
  ctx.stroke();

  ctx.fillStyle = '#111317';
  ctx.font = `600 ${Math.round(R.h * 0.36)}px ${SANS}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(formatTime(now), R.x, R.y + R.h);
  ctx.textAlign = 'right';
  ctx.fillText(`-${formatTime(Math.ceil(total - now))}`, R.x + R.w, R.y + R.h);
}

function bassLevel(a: AudioAnalysis): number {
  // fft bins 1–6 ≈ 20–130 Hz
  let m = 0;
  for (let i = 1; i < 7 && i < a.fft.length; i++) if (a.fft[i] > m) m = a.fft[i];
  return Math.max(0, (m / 255 - 0.35) / 0.65);
}

export function drawPocketPlayer(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime, loopTime, duration, midi } = context;
  const L = playerLayout(region);
  const s = stateFor(ctx);
  const sens = settings.audioSensitivity || 1.2;
  const accent = screenAccent(settings.notesColor);
  const bpm = settings.bpm || midi?.bpm || 120;
  const barLen = 240 / bpm;
  const loop = duration > 0 ? duration : midi?.duration || barLen * 4;
  const now = ((loopTime % loop) + loop) % loop;

  let dt = s.lastTime < 0 ? 0 : currentTime - s.lastTime;
  const playing = dt > 0;
  if (dt < 0 || dt > 0.5) { s.peak.fill(0); s.level.fill(0); dt = 0; }
  s.lastTime = currentTime;

  if (!s.edges || s.edgesLen !== analysis.fft.length) {
    s.edges = bandEdges(BANDS, 40, 14000, analysis.fft.length);
    s.edgesLen = analysis.fft.length;
  }
  bandLevels(analysis.fft, s.edges, sens, s.raw);
  const fall = Math.exp(-dt / 0.18);
  for (let i = 0; i < BANDS; i++) {
    s.level[i] = Math.max(s.raw[i], s.level[i] * fall);
    s.peak[i] = Math.max(s.level[i], s.peak[i] - dt * 0.7);
  }
  const b = bassLevel(analysis) * (sens / 1.2);
  s.bass = b > s.bass ? b : s.bass * Math.exp(-dt / 0.15);

  let scale = 1;
  if (typeof ctx.getTransform === 'function') scale = Math.max(1, Math.abs(ctx.getTransform().a));

  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  const base = staticLayer(ctx, s, region, L, scale);
  if (base) ctx.drawImage(base, region.x, region.y, region.width, region.height);
  else paintStatic(ctx, region, L);

  // LCD
  const S = L.screen;
  ctx.save();
  rr(ctx, S.x, S.y, S.w, S.h, S.w * 0.012);
  ctx.clip();
  const lcd = ctx.createLinearGradient(0, S.y, 0, S.y + S.h);
  lcd.addColorStop(0, '#ffffff');
  lcd.addColorStop(1, '#e6e9ee');
  ctx.fillStyle = lcd;
  ctx.fillRect(S.x, S.y, S.w, S.h);

  drawHeader(ctx, L.header, playing);
  drawArt(ctx, L.art, accent, Math.min(1, s.bass), currentTime);
  const info = [`${Math.round(bpm)} BPM`, settings.key].filter(Boolean).join(' · ');
  drawMeta(ctx, L.meta, settings.title || 'Untitled', settings.producerHandle || 'Unknown Artist', info);
  const notes = context.albumView === 'midi' ? midi?.notes ?? NO_NOTES : NO_NOTES;
  if (notes.length) drawRoll(ctx, L.viz, notes, now, loop, barLen, accent);
  else drawSpectrum(ctx, L.viz, s, accent);
  drawProgress(ctx, L.progress, now, loop, accent);

  // Glass glare + faint backlight pulse on the beat.
  const glare = ctx.createLinearGradient(S.x, S.y, S.x + S.w * 0.6, S.y + S.h);
  glare.addColorStop(0, 'rgba(255,255,255,0.22)');
  glare.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  glare.addColorStop(0.46, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(S.x, S.y, S.w, S.h);
  if (s.bass > 0.02) {
    ctx.fillStyle = rgba(accent, Math.min(0.08, s.bass * 0.08));
    ctx.fillRect(S.x, S.y, S.w, S.h);
  }
  ctx.restore();
  ctx.restore();
}

export default { draw: drawPocketPlayer } satisfies ModeModule;
