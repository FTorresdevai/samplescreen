import { roundRect } from '../../../shared/canvas-utils';

/**
 * Pocket Keys 86: an original mid-80s portable keyboard / keytar drawn procedurally.
 * Off-white plastic body with one vermilion accent, a grip neck on the left, a green VFD
 * display, rubber pill buttons, a speaker grille and a short keyboard.
 * The whole instrument is tilted slightly. The static body is cached to an offscreen canvas;
 * only keys, the display text and the note LED are drawn per frame.
 */

export const ACCENT = '#f0532f';
export const VFD = '#7df5d0';
const BODY_TOP = '#f5f2ea';
const BODY_BOTTOM = '#d8d1c1';
const PRINT = '#2b2d33';
const WHITE_KEY = '#f7f5ef';
const BLACK_KEY = '#1f2025';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
export const isBlack = (p: number): boolean => !WHITE_PCS.includes(((p % 12) + 12) % 12);
const BLACK_SHIFT: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.14, 8: 0, 10: 0.14 };
const KEY_RADIUS = [0, 0, 3, 3];
const MAIN_CELLS = 8;
const SUB_GHOST = '8888888';
const MAIN_GHOST = '88888888';

export interface KeytarLayout {
  /** Centre of the instrument on the canvas. */
  cx: number; cy: number;
  /** Unrotated size. */
  w: number; h: number;
  /** Tilt in radians (negative = right end up). */
  angle: number;
  /** Key range shown on the keyboard (inclusive). */
  lo: number; hi: number;
}

export interface LitKey { color: string; age: number }

export interface KeytarReadout {
  /** Big line: chord symbol or note name ("" when silent). */
  main: string;
  /** Small line, e.g. "BPM 120". */
  sub: string;
}

interface Box { x: number; y: number; w: number; h: number }

interface Geometry {
  w: number; h: number; lo: number; hi: number;
  kb: Box;
  whiteW: number; blackW: number;
  /** Left edge of each key, indexed by pitch - lo. */
  keyX: Float32Array;
  display: Box;
  mainFont: string; subFont: string;
  mainX: number; mainY: number; subX: number; subY: number;
  led: { x: number; y: number; r: number };
}

let geoCache: Geometry | null = null;

function geometry(l: KeytarLayout): Geometry {
  const c = geoCache;
  if (c && c.w === l.w && c.h === l.h && c.lo === l.lo && c.hi === l.hi) return c;
  const { w, h, lo, hi } = l;
  const kb: Box = { x: w * 0.235, y: h * 0.53, w: w * 0.69, h: h * 0.36 };
  let whites = 0;
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites++;
  const whiteW = kb.w / Math.max(1, whites);
  const blackW = whiteW * 0.62;
  const keyX = new Float32Array(hi - lo + 1);
  let n = 0;
  for (let p = lo; p <= hi; p++) {
    if (isBlack(p)) keyX[p - lo] = n * whiteW - blackW / 2 + (BLACK_SHIFT[p % 12] ?? 0) * blackW;
    else keyX[p - lo] = n++ * whiteW;
  }
  const display: Box = { x: w * 0.4, y: h * 0.08, w: w * 0.235, h: h * 0.3 };
  const innerW = display.w - 16;
  const mainSize = Math.min(display.h * 0.42, innerW / (MAIN_CELLS * 0.62));
  const subSize = Math.max(8, mainSize * 0.45);
  geoCache = {
    w, h, lo, hi, kb, whiteW, blackW, keyX, display,
    mainFont: `700 ${mainSize.toFixed(1)}px "JetBrains Mono", monospace`,
    subFont: `700 ${subSize.toFixed(1)}px "JetBrains Mono", monospace`,
    mainX: display.x + 8, mainY: display.y + display.h * 0.46,
    subX: display.x + 8, subY: display.y + display.h * 0.8,
    led: { x: display.x + display.w - 9, y: display.y + display.h * 0.8, r: Math.max(2, h * 0.014) },
  };
  return geoCache;
}

/** Trapezoid body with an angled right end, corners rounded. */
function bodyPath(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = h * 0.07;
  const tl = { x: w * 0.21, y: 0 };
  const tr = { x: w * 0.95, y: 0 };
  const br = { x: w, y: h };
  const bl = { x: w * 0.19, y: h };
  g.beginPath();
  g.moveTo((tl.x + tr.x) / 2, 0);
  g.arcTo(tr.x, tr.y, br.x, br.y, r);
  g.arcTo(br.x, br.y, bl.x, bl.y, r);
  g.arcTo(bl.x, bl.y, tl.x, tl.y, r);
  g.arcTo(tl.x, tl.y, tr.x, tr.y, r);
  g.closePath();
}

function neckBox(w: number, h: number): Box {
  return { x: 0, y: h * 0.32, w: w * 0.26, h: h * 0.3 };
}

function drawBody(g: CanvasRenderingContext2D, geo: Geometry) {
  const { w, h, kb, display: d } = geo;
  const neck = neckBox(w, h);
  const plastic = g.createLinearGradient(0, 0, 0, h);
  plastic.addColorStop(0, BODY_TOP);
  plastic.addColorStop(1, BODY_BOTTOM);

  // Soft drop shadow under neck and body
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = h * 0.12;
  g.shadowOffsetY = h * 0.06;
  g.fillStyle = BODY_BOTTOM;
  roundRect(g, neck.x, neck.y, neck.w, neck.h, neck.h / 2, true, false);
  bodyPath(g, w, h);
  g.fill();
  g.restore();

  // ---------- Neck ----------
  const neckGrad = g.createLinearGradient(0, neck.y, 0, neck.y + neck.h);
  neckGrad.addColorStop(0, BODY_TOP);
  neckGrad.addColorStop(1, BODY_BOTTOM);
  g.fillStyle = neckGrad;
  roundRect(g, neck.x, neck.y, neck.w, neck.h, neck.h / 2, true, false);
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  roundRect(g, neck.x, neck.y, neck.w, neck.h, neck.h / 2, false, true);
  // Rubber grip in the accent colour, with ribs
  const grip: Box = { x: neck.x + w * 0.022, y: neck.y + neck.h * 0.14, w: w * 0.11, h: neck.h * 0.72 };
  g.fillStyle = ACCENT;
  roundRect(g, grip.x, grip.y, grip.w, grip.h, grip.h / 2, true, false);
  g.fillStyle = 'rgba(90,20,10,0.28)';
  for (let rx = grip.x + grip.h * 0.5; rx < grip.x + grip.w - grip.h * 0.4; rx += 5) g.fillRect(rx, grip.y + 3, 1.4, grip.h - 6);
  // Ribbon controller and two small pills
  const rib: Box = { x: grip.x + grip.w + w * 0.012, y: neck.y + neck.h * 0.22, w: w * 0.08, h: neck.h * 0.2 };
  g.fillStyle = '#34363d';
  roundRect(g, rib.x, rib.y, rib.w, rib.h, rib.h / 2, true, false);
  g.fillStyle = '#8f9299';
  const pw = rib.w * 0.42;
  const ph = neck.h * 0.15;
  roundRect(g, rib.x, neck.y + neck.h * 0.58, pw, ph, ph / 2, true, false);
  roundRect(g, rib.x + rib.w - pw, neck.y + neck.h * 0.58, pw, ph, ph / 2, true, false);

  // ---------- Body ----------
  g.fillStyle = plastic;
  bodyPath(g, w, h);
  g.fill();
  g.save();
  bodyPath(g, w, h);
  g.clip();
  // Bottom lip, accent stripe, top highlight
  g.fillStyle = 'rgba(80,70,50,0.22)';
  g.fillRect(0, h * 0.93, w, h * 0.07);
  g.fillStyle = ACCENT;
  g.fillRect(0, h * 0.445, w, h * 0.03);
  g.fillStyle = 'rgba(240,83,47,0.55)';
  g.fillRect(0, h * 0.488, w, h * 0.008);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(0, 1, w, 1.5);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  bodyPath(g, w, h);
  g.stroke();

  // ---------- Brand ----------
  const brandX = w * 0.235;
  const brandW = d.x - brandX - w * 0.015;
  let size = h * 0.075;
  g.font = `800 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  const tw = g.measureText('POCKET KEYS').width;
  if (tw > brandW) { size *= brandW / tw; g.font = `800 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`; }
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = PRINT;
  g.fillText('POCKET KEYS', brandX, h * 0.17);
  g.fillStyle = ACCENT;
  g.font = `800 ${size * 1.9}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  g.fillText('86', brandX, h * 0.17 + size * 2);
  g.fillStyle = '#7a7466';
  g.font = `600 ${Math.max(7, size * 0.55)}px "JetBrains Mono", monospace`;
  g.fillText('12-VOICE DIGITAL', brandX, h * 0.38, brandW);

  // ---------- Display ----------
  g.fillStyle = '#2b2e35';
  roundRect(g, d.x - 4, d.y - 4, d.w + 8, d.h + 8, 7, true, false);
  const glass = g.createLinearGradient(0, d.y, 0, d.y + d.h);
  glass.addColorStop(0, '#0f2422');
  glass.addColorStop(1, '#081413');
  g.fillStyle = glass;
  roundRect(g, d.x, d.y, d.w, d.h, 4, true, false);
  // Unlit segments, so the live text reads as a segmented display
  g.fillStyle = 'rgba(125,245,208,0.08)';
  g.textBaseline = 'middle';
  g.font = geo.mainFont;
  g.fillText(MAIN_GHOST, geo.mainX, geo.mainY);
  g.font = geo.subFont;
  g.fillText(SUB_GHOST, geo.subX, geo.subY);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(d.x + 2, d.y + 2, d.w - 4, d.h * 0.18);

  // ---------- Rubber pill buttons ----------
  const bx = d.x + d.w + w * 0.022;
  const bw = w * 0.17;
  const pillW = bw / 4 - 5;
  const pillH = h * 0.075;
  for (let row = 0; row < 2; row++) {
    const py = d.y + h * 0.04 + row * h * 0.14;
    for (let i = 0; i < 4; i++) {
      const px = bx + i * (bw / 4);
      g.fillStyle = row === 0 && i === 3 ? ACCENT : row === 0 ? '#9a9ca3' : '#6d7078';
      roundRect(g, px, py, pillW, pillH, pillH / 2, true, false);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(px + pillH / 2, py + 1.5, pillW - pillH, 1.2);
    }
    g.fillStyle = '#8a8476';
    g.fillRect(bx, py + pillH + h * 0.025, bw - 5, 1);
  }

  // ---------- Speaker grille ----------
  const gx = bx + bw + w * 0.012;
  const gr: Box = { x: gx, y: d.y - 2, w: w * 0.93 - gx, h: d.h + 4 };
  g.save();
  roundRect(g, gr.x, gr.y, gr.w, gr.h, 6, false, false);
  g.clip();
  g.fillStyle = 'rgba(40,40,46,0.75)';
  const step = Math.max(5, h * 0.03);
  for (let yy = gr.y + step / 2; yy < gr.y + gr.h; yy += step) {
    const offset = Math.round((yy - gr.y) / step) % 2 ? step / 2 : 0;
    for (let xx = gr.x + step / 2 + offset; xx < gr.x + gr.w; xx += step) {
      g.beginPath();
      g.arc(xx, yy, step * 0.26, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // ---------- Keybed recess ----------
  g.fillStyle = '#25262b';
  roundRect(g, kb.x - 5, kb.y - 5, kb.w + 10, kb.h + 9, 5, true, false);
}

let bodyCanvas: HTMLCanvasElement | null = null;
let bodyFor: Geometry | null = null;
const PAD = 40;

function bodyLayer(geo: Geometry): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (bodyCanvas && bodyFor === geo) return bodyCanvas;
  const c = bodyCanvas ?? document.createElement('canvas');
  c.width = Math.ceil(geo.w + PAD * 2);
  c.height = Math.ceil(geo.h + PAD * 2);
  const g = c.getContext('2d');
  if (g) {
    g.clearRect(0, 0, c.width, c.height);
    g.translate(PAD, PAD);
    drawBody(g, geo);
  }
  bodyCanvas = c;
  bodyFor = geo;
  return c;
}

export function drawKeytar(ctx: CanvasRenderingContext2D, l: KeytarLayout, lit: Map<number, LitKey>, readout: KeytarReadout) {
  const geo = geometry(l);
  ctx.save();
  ctx.translate(l.cx, l.cy);
  ctx.rotate(l.angle);
  ctx.translate(-l.w / 2, -l.h / 2);

  const layer = bodyLayer(geo);
  if (layer) ctx.drawImage(layer, -PAD, -PAD);
  else drawBody(ctx, geo);

  // ---------- Keys ----------
  const { kb, whiteW, blackW, keyX } = geo;
  for (let p = l.lo; p <= l.hi; p++) {
    if (isBlack(p)) continue;
    const kx = kb.x + keyX[p - l.lo];
    const key = lit.get(p);
    ctx.fillStyle = key ? key.color : WHITE_KEY;
    roundRect(ctx, kx + 0.6, kb.y, whiteW - 1.2, kb.h, KEY_RADIUS, true, false);
    ctx.fillStyle = key ? 'rgba(0,0,0,0.12)' : 'rgba(60,50,30,0.1)';
    ctx.fillRect(kx + 0.6, kb.y + kb.h * 0.9, whiteW - 1.2, kb.h * 0.1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(kb.x, kb.y, kb.w, 3);
  const bh = kb.h * 0.6;
  for (let p = l.lo; p <= l.hi; p++) {
    if (!isBlack(p)) continue;
    const kx = kb.x + keyX[p - l.lo];
    const key = lit.get(p);
    ctx.fillStyle = key ? key.color : BLACK_KEY;
    roundRect(ctx, kx, kb.y, blackW, bh, KEY_RADIUS, true, false);
    ctx.fillStyle = key ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.13)';
    ctx.fillRect(kx + 2, kb.y + 3, blackW - 4, 1.5);
  }

  // ---------- Display text ----------
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = VFD;
  if (readout.main) {
    ctx.font = geo.mainFont;
    ctx.fillText(readout.main, geo.mainX, geo.mainY, geo.display.w - 16);
  }
  ctx.font = geo.subFont;
  ctx.fillText(readout.sub, geo.subX, geo.subY);

  // Note LED in the newest note's colour
  let newest: LitKey | undefined;
  for (const key of lit.values()) if (!newest || key.age < newest.age) newest = key;
  ctx.fillStyle = newest ? newest.color : '#23403a';
  ctx.beginPath();
  ctx.arc(geo.led.x, geo.led.y, geo.led.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
