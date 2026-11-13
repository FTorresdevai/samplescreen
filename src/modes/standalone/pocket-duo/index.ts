import type { AudioAnalysis, MidiNote, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';
import { bandEdges, bandLevels, fitText, formatTime, rgba, rr, screenAccent } from '../pocket-player/index';

/**
 * Pocket Duo: an open white clamshell handheld with two screens, decorated with stickers,
 * on a dark charcoal desk.
 *   - Top screen: the beat. Audio view: soft spectrum columns + a bright scope trace;
 *     MIDI view: notes scrolling past a playhead. Camera-style HUD (time, BPM, card badge),
 *     LCD scanlines.
 *   - Bottom (touch) screen: L/R tabs with view icons, grid backdrop, title pill with progress,
 *     4-step beat counter, a pixel cat bobbing to the bass, artist / BPM · key buttons.
 * Perf: shell, buttons and stickers are painted once into an offscreen buffer per size.
 * No brand marks: generic handheld, original stickers.
 */

const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
const BANDS = 32;
const DEVICE_ASPECT = 0.94; // width / height of the open device

export interface Rect { x: number; y: number; w: number; h: number }

export interface DuoLayout {
  device: Rect;
  lid: Rect;
  hinge: Rect;
  base: Rect;
  topBezel: Rect;
  top: Rect;      // top screen (5:3)
  panel: Rect;    // raised panel around the bottom screen
  bottom: Rect;   // bottom screen (4:3)
  tabs: Rect;
  grid: Rect;
  pill: Rect;
  beats: Rect;
  footer: Rect;
  pad: { cx: number; cy: number; r: number };
  dpad: { cx: number; cy: number; s: number };
  face: { cx: number; cy: number; gap: number; r: number };
}

/** Device and screen layout inside the mode region. Pure, so it can be unit-tested. */
export function duoLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): DuoLayout {
  const d = Math.min(region.width * 0.92, region.height * 0.88 * DEVICE_ASPECT);
  const h = d / DEVICE_ASPECT;
  const device: Rect = { x: region.x + (region.width - d) / 2, y: region.y + (region.height - h) / 2, w: d, h };
  const X = (f: number) => device.x + f * d;
  const Y = (f: number) => device.y + f * d;

  const lid: Rect = { x: device.x, y: device.y, w: d, h: 0.5 * d };
  const hinge: Rect = { x: device.x + d * 0.01, y: Y(0.5), w: d * 0.98, h: 0.065 * d };
  const base: Rect = { x: device.x, y: Y(0.565), w: d, h: device.y + h - Y(0.565) };

  const topBezel: Rect = { x: X(0.18), y: Y(0.08), w: 0.64 * d, h: 0.4 * d };
  const top: Rect = { x: X(0.2), y: Y(0.1), w: 0.6 * d, h: 0.36 * d };

  const panel: Rect = { x: X(0.235), y: base.y + 0.008 * d, w: 0.53 * d, h: base.h - 0.03 * d };
  const bottom: Rect = { x: X(0.26), y: base.y + 0.03 * d, w: 0.48 * d, h: 0.36 * d };

  const u = bottom.h;
  const tabs: Rect = { x: bottom.x, y: bottom.y, w: bottom.w, h: 0.17 * u };
  const footer: Rect = { x: bottom.x, y: bottom.y + u * 0.85, w: bottom.w, h: 0.15 * u };
  const grid: Rect = { x: bottom.x, y: tabs.y + tabs.h, w: bottom.w, h: footer.y - tabs.y - tabs.h };
  const pill: Rect = { x: grid.x + grid.w * 0.1, y: grid.y + grid.h * 0.12, w: grid.w * 0.8, h: grid.h * 0.24 };
  const beats: Rect = { x: grid.x + grid.w * 0.3, y: grid.y + grid.h * 0.52, w: grid.w * 0.4, h: grid.h * 0.14 };

  return {
    device, lid, hinge, base, topBezel, top, panel, bottom, tabs, grid, pill, beats, footer,
    pad: { cx: X(0.12), cy: base.y + 0.11 * d, r: 0.055 * d },
    dpad: { cx: X(0.12), cy: base.y + 0.29 * d, s: 0.105 * d },
    face: { cx: X(0.875), cy: base.y + 0.165 * d, gap: 0.056 * d, r: 0.031 * d },
  };
}

/** Beat within the bar (0–3) at time `now` for a bar of `barLen` seconds. */
export function beatIndex(now: number, barLen: number): number {
  const b = Math.floor(now / (barLen / 4));
  return ((b % 4) + 4) % 4;
}

const CAT = [
  '10000000001',
  '11000000011',
  '11100000111',
  '11111111111',
  '11011111011',
  '11011111011',
  '11111111111',
  '11110101111',
  '01111111110',
  '00111111100',
];

function pixelCat(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, color: string): void {
  ctx.fillStyle = color;
  for (let r = 0; r < CAT.length; r++)
    for (let c = 0; c < CAT[r].length; c++) if (CAT[r][c] === '1') ctx.fillRect(x + c * px, y + r * px, px + 0.5, px + 0.5);
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.6, cy - s * 0.05, cx - s * 0.35, cy - s * 0.55, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.55, cx + s * 0.6, cy - s * 0.05, cx, cy + s * 0.35);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

/** White paper sticker with a soft shadow; `draw` paints its artwork on top. */
function sticker(ctx: CanvasRenderingContext2D, R: Rect, rad: number, fill: string, draw?: () => void): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = R.h * 0.12;
  ctx.shadowOffsetY = R.h * 0.04;
  ctx.fillStyle = fill;
  rr(ctx, R.x, R.y, R.w, R.h, rad);
  ctx.fill();
  ctx.restore();
  draw?.();
}

// ---------- static layer ----------

function shellGradient(ctx: CanvasRenderingContext2D, R: Rect): CanvasGradient {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, '#f1f0eb');
  g.addColorStop(1, '#dddcd5');
  return g;
}

function paintStatic(ctx: CanvasRenderingContext2D, region: ModelRegion, L: DuoLayout): void {
  const { x, y, width: W, height: H } = region;
  const d = L.device.w;
  const X = (f: number) => L.device.x + f * d;

  const desk = ctx.createLinearGradient(x, y, x + W * 0.4, y + H);
  desk.addColorStop(0, '#4b4d51');
  desk.addColorStop(1, '#161719');
  ctx.fillStyle = desk;
  ctx.fillRect(x, y, W, H);
  const spot = ctx.createRadialGradient(x + W * 0.5, y + H * 0.3, 0, x + W * 0.5, y + H * 0.3, Math.max(W, H) * 0.75);
  spot.addColorStop(0, 'rgba(255,255,255,0.16)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(x, y, W, H);

  // Shell halves with a drop shadow and a thin dark edge.
  const halves: [Rect, number[]][] = [
    [L.lid, [d * 0.075, d * 0.075, d * 0.02, d * 0.02]],
    [L.base, [d * 0.02, d * 0.02, d * 0.06, d * 0.06]],
  ];
  for (const [R, radii] of halves) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = d * 0.05;
    ctx.shadowOffsetY = d * 0.02;
    ctx.fillStyle = shellGradient(ctx, R);
    ctx.beginPath();
    ctx.roundRect(R.x, R.y, R.w, R.h, radii);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = Math.max(1, d * 0.004);
    ctx.strokeStyle = 'rgba(40,40,38,0.55)';
    ctx.beginPath();
    ctx.roundRect(R.x, R.y, R.w, R.h, radii);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, d * 0.002);
    ctx.beginPath();
    ctx.roundRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4, radii.map((r) => Math.max(0, r - 2)));
    ctx.stroke();
  }

  // Hinge: two end barrels and a recessed middle.
  const Hh = L.hinge;
  const hg = ctx.createLinearGradient(0, Hh.y, 0, Hh.y + Hh.h);
  hg.addColorStop(0, '#f6f5f0');
  hg.addColorStop(0.5, '#d9d8d1');
  hg.addColorStop(1, '#a9a8a2');
  ctx.fillStyle = hg;
  rr(ctx, Hh.x, Hh.y, Hh.w, Hh.h, Hh.h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,38,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const mid = ctx.createLinearGradient(0, Hh.y, 0, Hh.y + Hh.h);
  mid.addColorStop(0, '#cfcec8');
  mid.addColorStop(1, '#e9e8e2');
  ctx.fillStyle = mid;
  rr(ctx, X(0.17), Hh.y + Hh.h * 0.15, d * 0.66, Hh.h * 0.7, Hh.h * 0.2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  circle(ctx, X(0.93), Hh.y + Hh.h / 2, d * 0.006);
  ctx.fill();

  // Lid: camera, bumpers, speakers, sliders.
  const ly = (f: number) => L.lid.y + f * d;
  ctx.fillStyle = '#151515';
  circle(ctx, X(0.5), ly(0.04), d * 0.018);
  ctx.fill();
  ctx.fillStyle = '#3a4a5a';
  circle(ctx, X(0.497), ly(0.037), d * 0.007);
  ctx.fill();
  ctx.fillStyle = '#151515';
  circle(ctx, X(0.535), ly(0.042), d * 0.006);
  ctx.fill();
  for (const fx of [0.29, 0.71]) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = d * 0.008;
    ctx.shadowOffsetY = d * 0.003;
    ctx.fillStyle = '#fbfbf8';
    circle(ctx, X(fx), ly(0.04), d * 0.014);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#2b2b2b';
  for (const fx of [0.1, 0.9]) {
    const cx = X(fx);
    const cy = ly(0.2);
    const g = d * 0.026;
    for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) {
      circle(ctx, cx + dx * g, cy + dy * g, d * 0.0055);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#8f8e88';
  ctx.lineWidth = Math.max(1, d * 0.002);
  ctx.fillStyle = '#8f8e88';
  ctx.font = `500 ${Math.round(d * 0.018)}px ${SANS}`;
  ctx.textBaseline = 'middle';
  for (const side of [-1, 1] as const) {
    const sx = side < 0 ? X(0.025) : X(0.975);
    ctx.beginPath();
    ctx.moveTo(sx, ly(0.29));
    ctx.lineTo(sx + side * -d * 0.012, ly(0.4));
    ctx.lineTo(sx, ly(0.4));
    ctx.stroke();
    ctx.textAlign = side < 0 ? 'left' : 'right';
    ctx.fillText('OFF', sx + side * -d * 0.02, ly(0.42));
  }
  ctx.textAlign = 'left';
  ctx.fillText('VOL.', X(0.045), ly(0.34));

  // Top screen bezel
  const B = L.topBezel;
  ctx.fillStyle = '#cfcfca';
  rr(ctx, B.x, B.y, B.w, B.h, d * 0.018);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#e4e4df';
  rr(ctx, B.x + d * 0.006, B.y + d * 0.006, B.w - d * 0.012, B.h - d * 0.012, d * 0.014);
  ctx.fill();

  // Bottom panel and screen frame
  const P = L.panel;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = d * 0.012;
  ctx.shadowOffsetY = d * 0.004;
  ctx.fillStyle = '#ecebe6';
  ctx.beginPath();
  ctx.roundRect(P.x, P.y, P.w, P.h, [d * 0.015, d * 0.015, d * 0.05, d * 0.05]);
  ctx.fill();
  ctx.restore();
  const S = L.bottom;
  ctx.fillStyle = '#1b1b1b';
  rr(ctx, S.x - d * 0.008, S.y - d * 0.008, S.w + d * 0.016, S.h + d * 0.016, d * 0.008);
  ctx.fill();
  ctx.fillStyle = '#8f8e88';
  ctx.font = `500 ${Math.round(d * 0.014)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('MIC', P.x + P.w * 0.88, P.y + P.h - d * 0.012);

  // Circle pad
  const { cx: pcx, cy: pcy, r: pr } = L.pad;
  ctx.fillStyle = '#c9c8c2';
  circle(ctx, pcx, pcy, pr * 1.18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.stroke();
  const pg = ctx.createRadialGradient(pcx - pr * 0.3, pcy - pr * 0.3, pr * 0.1, pcx, pcy, pr);
  pg.addColorStop(0, '#f2f2ee');
  pg.addColorStop(1, '#b9b8b2');
  ctx.fillStyle = pg;
  circle(ctx, pcx, pcy, pr);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,40,0.75)';
  ctx.lineWidth = Math.max(1, pr * 0.07);
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 6; t += 0.15) {
    const rad = pr * 0.08 + (t / (Math.PI * 6)) * pr * 0.62;
    ctx.lineTo(pcx + Math.cos(t) * rad, pcy + Math.sin(t) * rad);
  }
  ctx.stroke();

  // D-pad
  const { cx: dcx, cy: dcy, s: ds } = L.dpad;
  const arm = ds * 0.34;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = d * 0.008;
  ctx.shadowOffsetY = d * 0.003;
  ctx.fillStyle = '#ecebe6';
  rr(ctx, dcx - ds / 2, dcy - arm / 2, ds, arm, arm * 0.15);
  ctx.fill();
  rr(ctx, dcx - arm / 2, dcy - ds / 2, arm, ds, arm * 0.15);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dcx - ds / 2, dcy - arm / 2);
  ctx.lineTo(dcx - arm / 2, dcy - arm / 2);
  ctx.lineTo(dcx - arm / 2, dcy - ds / 2);
  ctx.lineTo(dcx + arm / 2, dcy - ds / 2);
  ctx.lineTo(dcx + arm / 2, dcy - arm / 2);
  ctx.lineTo(dcx + ds / 2, dcy - arm / 2);
  ctx.lineTo(dcx + ds / 2, dcy + arm / 2);
  ctx.lineTo(dcx + arm / 2, dcy + arm / 2);
  ctx.lineTo(dcx + arm / 2, dcy + ds / 2);
  ctx.lineTo(dcx - arm / 2, dcy + ds / 2);
  ctx.lineTo(dcx - arm / 2, dcy + arm / 2);
  ctx.lineTo(dcx - ds / 2, dcy + arm / 2);
  ctx.closePath();
  ctx.stroke();

  // Face buttons
  const F = L.face;
  const buttons: [string, string, number, number][] = [
    ['X', '#2f5fd0', 0, -1], ['A', '#d8323b', 1, 0], ['B', '#b38a2c', 0, 1], ['Y', '#2a9448', -1, 0],
  ];
  for (const [label, col, bx, by] of buttons) {
    const cx = F.cx + bx * F.gap;
    const cy = F.cy + by * F.gap;
    ctx.fillStyle = '#d2d1cb';
    circle(ctx, cx, cy, F.r * 1.15);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - F.r * 0.35, cy - F.r * 0.4, F.r * 0.1, cx, cy, F.r);
    g.addColorStop(0, rgba(hexRgb(col), 0.75));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    circle(ctx, cx, cy, F.r);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(F.r * 1.05)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + F.r * 0.05);
  }

  // Small buttons: heart (home-style) top-left of the face buttons, start / select.
  const small = (cx: number, cy: number, r: number) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.15;
    ctx.fillStyle = '#f6f5f1';
    circle(ctx, cx, cy, r);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();
  };
  const by = L.base.y;
  small(X(0.765), by + d * 0.06, d * 0.022);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = Math.max(1, d * 0.0025);
  heart(ctx, X(0.765), by + d * 0.062, d * 0.022);
  ctx.stroke();
  ctx.fillStyle = '#8f8e88';
  ctx.font = `500 ${Math.round(d * 0.018)}px ${SANS}`;
  ctx.textAlign = 'left';
  for (const [i, label] of ['START', 'SELECT'].entries()) {
    const cy = by + d * (0.36 + i * 0.055);
    small(X(0.785), cy, d * 0.015);
    ctx.fillStyle = '#8f8e88';
    ctx.fillText(label, X(0.81), cy);
  }

  // Stickers (original artwork).
  pixelCat(ctx, X(0.07), L.lid.y + d * 0.07, d * 0.0075, '#141414');
  sticker(ctx, { x: X(0.07), y: L.lid.y + d * 0.03, w: d * 0.09, h: d * 0.035 }, d * 0.008, '#fbfbf8', () => {
    ctx.fillStyle = '#141414';
    ctx.font = `700 ${Math.round(d * 0.02)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('♡ ♡', X(0.115), L.lid.y + d * 0.048);
  });
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = d * 0.01;
  const sg = ctx.createLinearGradient(X(0.85), L.lid.y + d * 0.05, X(0.93), L.lid.y + d * 0.13);
  sg.addColorStop(0, '#f4f4f4');
  sg.addColorStop(0.5, '#8d8d8d');
  sg.addColorStop(1, '#e6e6e6');
  ctx.fillStyle = sg;
  star(ctx, X(0.89), L.lid.y + d * 0.09, d * 0.045, 0.15);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = Math.max(1, d * 0.003);
  ctx.stroke();
  sticker(ctx, { x: X(0.1), y: L.lid.y + d * 0.26, w: d * 0.035, h: d * 0.09 }, d * 0.008, '#141414', () => {
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = Math.max(1, d * 0.002);
    for (let i = 0; i < 3; i++) {
      heart(ctx, X(0.1175), L.lid.y + d * (0.282 + i * 0.024), d * 0.022);
      ctx.stroke();
    }
  });
  sticker(ctx, { x: X(0.875), y: L.lid.y + d * 0.29, w: d * 0.085, h: d * 0.034 }, d * 0.006, '#141414', () => {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(d * 0.018)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('lol?', X(0.9175), L.lid.y + d * 0.308);
  });
  // Bow next to the face buttons.
  ctx.fillStyle = '#141414';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(X(0.94), by + d * 0.045);
    ctx.lineTo(X(0.94) + s * d * 0.026, by + d * 0.03);
    ctx.lineTo(X(0.94) + s * d * 0.026, by + d * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  // "meow" + small cat below the d-pad side.
  ctx.fillStyle = '#3a3a3a';
  ctx.font = `600 ${Math.round(d * 0.016)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('meow', X(0.2), by + d * 0.2);
  ctx.fillStyle = '#141414';
  star(ctx, X(0.07), by + d * 0.43, d * 0.02, -0.2);
  ctx.fill();
  // Kaomoji pill under the bottom screen.
  sticker(ctx, { x: X(0.44), y: P.y + P.h - d * 0.05, w: d * 0.12, h: d * 0.034 }, d * 0.017, '#fbfbf8', () => {
    ctx.fillStyle = '#141414';
    ctx.font = `600 ${Math.round(d * 0.018)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('( ˘ ᵕ ˘ )', X(0.5), P.y + P.h - d * 0.032);
  });
}

function hexRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

interface DuoState {
  base: HTMLCanvasElement | null;
  baseKey: string;
  edges: Int32Array | null;
  edgesLen: number;
  raw: Float32Array;
  level: Float32Array;
  lastTime: number;
  bass: number;
}

const states = new WeakMap<object, DuoState>();
const rangeCache = new WeakMap<MidiNote[], { lo: number; hi: number }>();
const NO_NOTES: MidiNote[] = [];

function stateFor(ctx: CanvasRenderingContext2D): DuoState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) {
    s = { base: null, baseKey: '', edges: null, edgesLen: 0, raw: new Float32Array(BANDS), level: new Float32Array(BANDS), lastTime: -1, bass: 0 };
    states.set(key, s);
  }
  return s;
}

function staticLayer(s: DuoState, region: ModelRegion, L: DuoLayout, scale: number): HTMLCanvasElement | null {
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

// ---------- top screen ----------

function pitchRange(notes: MidiNote[]): { lo: number; hi: number } {
  let r = rangeCache.get(notes);
  if (!r) {
    let lo = 127;
    let hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    if (lo > hi) { lo = 48; hi = 72; }
    if (hi - lo < 12) { const c = (lo + hi) / 2; lo = Math.floor(c - 6); hi = Math.ceil(c + 6); }
    r = { lo, hi };
    rangeCache.set(notes, r);
  }
  return r;
}

function drawTopAudio(ctx: CanvasRenderingContext2D, R: Rect, s: DuoState, wave: Uint8Array, sens: number, accent: string): void {
  const bw = R.w / BANDS;
  const floor = R.y + R.h * 0.92;
  for (let i = 0; i < BANDS; i++) {
    const h = s.level[i] * R.h * 0.7;
    const g = ctx.createLinearGradient(0, floor - h, 0, floor);
    g.addColorStop(0, rgba(accent, 0.85));
    g.addColorStop(1, rgba(accent, 0.15));
    ctx.fillStyle = g;
    ctx.fillRect(R.x + i * bw + bw * 0.12, floor - h, bw * 0.76, h);
  }
  // Scope trace
  const cy = R.y + R.h * 0.45;
  const amp = R.h * 0.3 * sens;
  const n = wave.length;
  const step = Math.max(1, Math.floor(n / 240));
  ctx.beginPath();
  for (let i = 0; i < n; i += step) {
    const px = R.x + (i / (n - 1)) * R.w;
    const py = cy + ((wave[i] - 128) / 128) * amp;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = Math.max(3, R.h * 0.025);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, R.h * 0.008);
  ctx.stroke();
}

function drawTopRoll(ctx: CanvasRenderingContext2D, R: Rect, notes: MidiNote[], now: number, loop: number, barLen: number, accent: string): void {
  const span = barLen * 2;
  const pxs = R.w / span;
  const t0 = now - span * 0.25;
  const t1 = t0 + span;
  const top = R.y + R.h * 0.16;
  const h = R.h * 0.72;
  const { lo, hi } = pitchRange(notes);
  const rowH = h / (hi - lo + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  const beat = barLen / 4;
  for (let b = Math.ceil(t0 / beat) * beat; b < t1; b += beat) ctx.fillRect(R.x + (b - t0) * pxs, top, 1, h);
  for (const n of notes) {
    for (const off of [-loop, 0, loop]) {
      const a = n.time + off;
      const b = a + n.duration;
      if (b < t0 || a > t1) continue;
      const on = a <= now && now < b;
      const x = R.x + (a - t0) * pxs;
      const w = Math.max(2, (b - a) * pxs);
      const y = top + (hi - n.midi) * rowH;
      ctx.fillStyle = on ? '#ffffff' : rgba(accent, 0.45 + 0.45 * n.velocity);
      rr(ctx, x, y + rowH * 0.1, w, Math.max(2, rowH * 0.8), Math.min(4, rowH * 0.3));
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(R.x + R.w * 0.25 - 1, top, 2, h);
}

function hudBox(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, px: number, align: 'left' | 'right'): void {
  ctx.font = `700 ${Math.round(px)}px ${SANS}`;
  const w = ctx.measureText(text).width + px * 0.8;
  const bx = align === 'left' ? x : x - w;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  rr(ctx, bx, y, w, px * 1.5, px * 0.3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, px * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, y + px * 0.78);
}

function drawTop(ctx: CanvasRenderingContext2D, R: Rect, s: DuoState, a: AudioAnalysis, notes: MidiNote[], now: number, loop: number, barLen: number, bpm: number, sens: number, accent: string, scale: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  bg.addColorStop(0, '#141a26');
  bg.addColorStop(1, rgba(accent, 0.35));
  ctx.fillStyle = '#0c0f16';
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.fillStyle = bg;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  if (s.bass > 0.02) {
    ctx.fillStyle = rgba(accent, Math.min(0.18, s.bass * 0.18));
    ctx.fillRect(R.x, R.y, R.w, R.h);
  }

  if (notes.length) drawTopRoll(ctx, R, notes, now, loop, barLen, accent);
  else drawTopAudio(ctx, R, s, a.waveform, sens, accent);

  const px = R.h * 0.065;
  hudBox(ctx, R.x + px * 0.6, R.y + px * 0.6, `♪ ${formatTime(now)}`, px, 'left');
  hudBox(ctx, R.x + R.w - px * 0.6, R.y + px * 0.6, `${Math.round(bpm)} BPM`, px, 'right');
  hudBox(ctx, R.x + R.w - px * 0.6, R.y + R.h - px * 2.1, 'SD', px * 0.8, 'right');

  // LCD scanlines + edge shade
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  const step = Math.max(2, 3 * scale) / scale;
  for (let yy = R.y; yy < R.y + R.h; yy += step) ctx.fillRect(R.x, yy, R.w, step / 3);
  const glare = ctx.createLinearGradient(R.x, R.y, R.x + R.w * 0.5, R.y + R.h);
  glare.addColorStop(0, 'rgba(255,255,255,0.12)');
  glare.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.restore();
}

// ---------- bottom screen ----------

function keyCap(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, label: string): void {
  ctx.fillStyle = '#ffffff';
  rr(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.15);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = `800 ${Math.round(s * 0.7)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + s * 0.04);
}

function noteIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.fillRect(cx + s * 0.15, cy - s * 0.5, s * 0.12, s * 0.8);
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.3, s * 0.22, s * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function waveIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  const hs = [0.3, 0.7, 1, 0.55, 0.85];
  for (let i = 0; i < 5; i++) ctx.fillRect(cx - s * 0.5 + i * s * 0.22, cy - (hs[i] * s) / 2, s * 0.13, hs[i] * s);
}

function rollIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.fillRect(cx - s * 0.5, cy - s * 0.35, s * 0.5, s * 0.18);
  ctx.fillRect(cx - s * 0.15, cy - s * 0.05, s * 0.6, s * 0.18);
  ctx.fillRect(cx - s * 0.45, cy + s * 0.25, s * 0.4, s * 0.18);
}

function drawBottom(ctx: CanvasRenderingContext2D, L: DuoLayout, s: DuoState, now: number, loop: number, barLen: number, midiView: boolean, title: string, artist: string, info: string, accent: string): void {
  const S = L.bottom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(S.x, S.y, S.w, S.h);
  ctx.clip();

  // Grid backdrop
  const G = L.grid;
  ctx.fillStyle = '#ecece8';
  ctx.fillRect(S.x, S.y, S.w, S.h);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  const cell = G.w / 12;
  for (let gx = G.x; gx < G.x + G.w; gx += cell) ctx.fillRect(gx, G.y, 1, G.h);
  for (let gy = G.y; gy < G.y + G.h; gy += cell) ctx.fillRect(G.x, gy, G.w, 1);

  // Tabs bar
  const T = L.tabs;
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(T.x, T.y, T.w, T.h);
  const sideW = T.w * 0.24;
  const px = T.h * 0.36;
  for (const [i, label, text] of [[0, 'L', 'Prev'], [1, 'R', 'Next']] as const) {
    const tx = i === 0 ? T.x + T.h * 0.12 : T.x + T.w - sideW - T.h * 0.12;
    ctx.fillStyle = '#f4f4f1';
    rr(ctx, tx, T.y + T.h * 0.52, sideW, T.h * 0.44, T.h * 0.08);
    ctx.fill();
    keyCap(ctx, tx + sideW / 2, T.y + T.h * 0.28, T.h * 0.38, label);
    ctx.fillStyle = '#222';
    ctx.font = `600 ${Math.round(px)}px ${SANS}`;
    ctx.fillText(text, tx + sideW / 2, T.y + T.h * 0.75);
  }
  const icons = [noteIcon, waveIcon, rollIcon];
  const active = midiView ? 2 : 1;
  const tw = (T.w - sideW * 2 - T.h * 0.6) / 3;
  for (let i = 0; i < 3; i++) {
    const tx = T.x + sideW + T.h * 0.3 + i * tw;
    ctx.fillStyle = i === active ? '#f4f4f1' : '#b9b9b5';
    rr(ctx, tx + 2, T.y + T.h * (i === active ? 0.08 : 0.16), tw - 4, T.h * (i === active ? 0.92 : 0.7), T.h * 0.1);
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    icons[i](ctx, tx + tw / 2, T.y + T.h * 0.5, T.h * 0.42);
  }

  // Title pill + progress
  const P = L.pill;
  ctx.fillStyle = 'rgba(205,205,200,0.85)';
  rr(ctx, P.x, P.y, P.w, P.h, P.h * 0.2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = `600 ${Math.round(P.h * 0.42)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitText(ctx, title, P.w * 0.9), P.x + P.w / 2, P.y + P.h * 0.42);
  const pw = P.w * 0.84;
  const ph = Math.max(2, P.h * 0.1);
  const frac = loop > 0 ? Math.min(1, now / loop) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  rr(ctx, P.x + (P.w - pw) / 2, P.y + P.h * 0.74, pw, ph, ph / 2);
  ctx.fill();
  ctx.fillStyle = accent;
  rr(ctx, P.x + (P.w - pw) / 2, P.y + P.h * 0.74, Math.max(ph, pw * frac), ph, ph / 2);
  ctx.fill();

  // Beat counter
  const Bt = L.beats;
  const beat = beatIndex(now, barLen);
  const bs = Bt.h;
  const gap = (Bt.w - bs * 4) / 3;
  for (let i = 0; i < 4; i++) {
    const bx = Bt.x + i * (bs + gap);
    ctx.fillStyle = i === beat ? accent : '#ffffff';
    rr(ctx, bx, Bt.y, bs, bs, bs * 0.25);
    ctx.fill();
    ctx.strokeStyle = i === beat ? accent : '#9a9a96';
    ctx.lineWidth = Math.max(1, bs * 0.08);
    ctx.stroke();
    ctx.fillStyle = i === beat ? '#ffffff' : '#5a5a56';
    ctx.font = `700 ${Math.round(bs * 0.55)}px ${SANS}`;
    ctx.fillText(String(i + 1), bx + bs / 2, Bt.y + bs / 2 + 1);
  }

  // Pixel cat bobbing on the bass, a "!" when the beat hits.
  const cpx = G.h * 0.03;
  const catX = G.x + G.w * 0.06;
  const catY = G.y + G.h - cpx * 10 - G.h * 0.06 - s.bass * cpx * 2.5;
  pixelCat(ctx, catX, catY, cpx, '#1d1d1d');
  ctx.fillStyle = accent; // eyes
  ctx.fillRect(catX + cpx * 2, catY + cpx * 4, cpx, cpx * 2);
  ctx.fillRect(catX + cpx * 8, catY + cpx * 4, cpx, cpx * 2);
  if (s.bass > 0.45) {
    ctx.fillStyle = '#ffffff';
    circle(ctx, catX + cpx * 5.5, catY - cpx * 2.2, cpx * 1.4);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, cpx * 0.25);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = `800 ${Math.round(cpx * 2)}px ${SANS}`;
    ctx.fillText('!', catX + cpx * 5.5, catY - cpx * 2.1);
  }

  // Footer buttons
  const Fo = L.footer;
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(Fo.x, Fo.y, Fo.w, Fo.h);
  const split = Fo.w * 0.5;
  const fpx = Fo.h * 0.38;
  for (const [bx, bw, text] of [[Fo.x + Fo.h * 0.1, split - Fo.h * 0.15, artist], [Fo.x + split + Fo.h * 0.05, Fo.w - split - Fo.h * 0.15, info]] as const) {
    const g = ctx.createLinearGradient(0, Fo.y, 0, Fo.y + Fo.h);
    g.addColorStop(0, '#fafaf7');
    g.addColorStop(1, '#d7d7d2');
    ctx.fillStyle = g;
    rr(ctx, bx, Fo.y + Fo.h * 0.12, bw, Fo.h * 0.8, Fo.h * 0.2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = `600 ${Math.round(fpx)}px ${SANS}`;
    ctx.fillText(fitText(ctx, text, bw * 0.9), bx + bw / 2, Fo.y + Fo.h * 0.54);
  }
  ctx.restore();
}

function bassLevel(a: AudioAnalysis): number {
  let m = 0;
  for (let i = 1; i < 7 && i < a.fft.length; i++) if (a.fft[i] > m) m = a.fft[i];
  return Math.max(0, (m / 255 - 0.35) / 0.65);
}

export function drawPocketDuo(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime, loopTime, duration, midi } = context;
  const L = duoLayout(region);
  const s = stateFor(ctx);
  const sens = settings.audioSensitivity || 1.2;
  const accent = screenAccent(settings.notesColor);
  const bpm = settings.bpm || midi?.bpm || 120;
  const barLen = 240 / bpm;
  const loop = duration > 0 ? duration : midi?.duration || barLen * 4;
  const now = ((loopTime % loop) + loop) % loop;

  let dt = s.lastTime < 0 ? 0 : currentTime - s.lastTime;
  if (dt < 0 || dt > 0.5) { s.level.fill(0); dt = 0; }
  s.lastTime = currentTime;
  if (!s.edges || s.edgesLen !== analysis.fft.length) {
    s.edges = bandEdges(BANDS, 40, 14000, analysis.fft.length);
    s.edgesLen = analysis.fft.length;
  }
  bandLevels(analysis.fft, s.edges, sens, s.raw);
  const fall = Math.exp(-dt / 0.18);
  for (let i = 0; i < BANDS; i++) s.level[i] = Math.max(s.raw[i], s.level[i] * fall);
  const b = Math.min(1, bassLevel(analysis) * (sens / 1.2));
  s.bass = b > s.bass ? b : s.bass * Math.exp(-dt / 0.15);

  let scale = 1;
  if (typeof ctx.getTransform === 'function') scale = Math.max(1, Math.abs(ctx.getTransform().a));

  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  const base = staticLayer(s, region, L, scale);
  if (base) ctx.drawImage(base, region.x, region.y, region.width, region.height);
  else paintStatic(ctx, region, L);

  const notes = context.albumView === 'midi' ? midi?.notes ?? NO_NOTES : NO_NOTES;
  drawTop(ctx, L.top, s, analysis, notes, now, loop, barLen, bpm, sens, accent, scale);
  const info = [`${Math.round(bpm)} BPM`, settings.key].filter(Boolean).join(' · ');
  drawBottom(ctx, L, s, now, loop, barLen, notes.length > 0, settings.title || 'Untitled', settings.producerHandle || 'Unknown Artist', info, accent);
  ctx.restore();
}

export default { draw: drawPocketDuo } satisfies ModeModule;
