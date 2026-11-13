import { roundRect } from '../../../shared/canvas-utils';

/**
 * Graphite Synth illustration: an original, hand-drawn-looking 2D vintage synthesizer
 * (wood cheeks, four knob/slider modules, wheel box, keyboard). Everything is procedural.
 * The static body is cached to an offscreen canvas; only keys and LEDs are drawn per frame.
 */

export const GRAPHITE = '#2c2a27';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
export const isBlack = (p: number): boolean => !WHITE_PCS.includes(((p % 12) + 12) % 12);
const BLACK_SHIFT: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.14, 8: 0, 10: 0.14 };

/** Deterministic 0..1 noise so the "hand-drawn" wobble never shimmers between frames. */
export function hash(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export interface SynthLayout {
  x: number; y: number; w: number; h: number;
  /** Key range shown on the keyboard (inclusive). */
  lo: number; hi: number;
}

interface KeyGeometry {
  x: number; y: number; w: number; h: number;
  whiteW: number; blackW: number;
  left: (p: number) => number;
}

interface Parts {
  cheekW: number;
  innerX: number; innerW: number;
  panelY: number; panelH: number;
  bedY: number; bedH: number;
  keys: KeyGeometry;
  ledSpots: { x: number; y: number }[];
}

function parts(l: SynthLayout): Parts {
  const cheekW = l.w * 0.035;
  const innerX = l.x + cheekW;
  const innerW = l.w - cheekW * 2;
  const panelY = l.y + l.h * 0.06;
  const panelH = l.h * 0.5;
  const bedY = panelY + panelH + l.h * 0.03;
  const bedH = l.y + l.h - l.h * 0.07 - bedY;
  const wheelW = innerW * 0.09;
  const kx = innerX + wheelW + 8;
  const kw = innerW - wheelW - 14;

  const whiteIndex = new Map<number, number>();
  let n = 0;
  for (let p = l.lo; p <= l.hi; p++) if (!isBlack(p)) whiteIndex.set(p, n++);
  const whiteW = kw / Math.max(1, n);
  const blackW = whiteW * 0.6;
  const keys: KeyGeometry = {
    x: kx, y: bedY + 4, w: kw, h: bedH - 8, whiteW, blackW,
    left: (p: number): number => {
      if (!isBlack(p)) return (whiteIndex.get(p) ?? 0) * whiteW;
      const seam = ((whiteIndex.get(p - 1) ?? 0) + 1) * whiteW;
      return seam - blackW / 2 + (BLACK_SHIFT[((p % 12) + 12) % 12] ?? 0) * blackW;
    },
  };

  const ledSpots = MODULES.flatMap((m, mi) => {
    const mx = moduleX(innerX, innerW, mi);
    const mw = innerW * m.width;
    return m.items.filter(it => it.kind === 'led').map(it => ({ x: mx + it.u * mw, y: panelY + it.v * panelH }));
  });
  return { cheekW, innerX, innerW, panelY, panelH, bedY, bedH, keys, ledSpots };
}

// ---------- Module layout (normalized u/v inside each module) ----------
type ItemKind = 'bigKnob' | 'knob' | 'slider' | 'jack' | 'led';
interface Item { kind: ItemKind; u: number; v: number }
interface ModuleSpec { width: number; face: string; items: Item[] }

const grid = (kind: ItemKind, us: number[], vs: number[]): Item[] =>
  vs.flatMap(v => us.map(u => ({ kind, u, v })));

const MODULES: ModuleSpec[] = [
  {
    width: 0.27, face: '#66705a',
    items: [
      { kind: 'bigKnob', u: 0.32, v: 0.33 },
      ...grid('knob', [0.2, 0.45], [0.78]),
      ...grid('jack', [0.8], [0.22, 0.5, 0.78]),
      { kind: 'led', u: 0.65, v: 0.14 },
    ],
  },
  {
    width: 0.27, face: '#66705a',
    items: [
      ...grid('knob', [0.14, 0.34, 0.54, 0.74], [0.2]),
      ...grid('slider', [0.2, 0.33, 0.46, 0.59], [0.62]),
      ...grid('jack', [0.78, 0.9], [0.5, 0.72]),
      { kind: 'led', u: 0.86, v: 0.2 },
    ],
  },
  {
    width: 0.2, face: '#7d7590',
    items: [
      ...grid('knob', [0.25, 0.5, 0.75], [0.2]),
      ...grid('jack', [0.2, 0.4, 0.6, 0.8], [0.52, 0.78]),
      ...grid('led', [0.3, 0.7], [0.38]),
    ],
  },
  {
    width: 0.26, face: '#66705a',
    items: [
      { kind: 'bigKnob', u: 0.36, v: 0.36 },
      ...grid('knob', [0.18, 0.42], [0.8]),
      ...grid('knob', [0.84], [0.2, 0.46]),
      { kind: 'slider', u: 0.68, v: 0.66 },
      ...grid('jack', [0.86], [0.76]),
      { kind: 'led', u: 0.66, v: 0.14 },
    ],
  },
];

function moduleX(innerX: number, innerW: number, index: number): number {
  let u = 0;
  for (let i = 0; i < index; i++) u += MODULES[i].width;
  return innerX + innerW * u;
}

// ---------- Sketchy primitives ----------
function sketchLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number) {
  const mx = (x1 + x2) / 2 + (hash(seed) - 0.5) * 1.6;
  const my = (y1 + y2) / 2 + (hash(seed + 1) - 0.5) * 1.6;
  const ox = (hash(seed + 2) - 0.5) * 1.2;
  const oy = (hash(seed + 3) - 0.5) * 1.2;
  ctx.moveTo(x1 + ox, y1 + oy);
  ctx.quadraticCurveTo(mx, my, x2 - ox, y2 - oy);
}

function sketchRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, width = 1.4) {
  ctx.strokeStyle = GRAPHITE;
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineWidth = pass ? width * 0.5 : width;
    ctx.globalAlpha = pass ? 0.45 : 0.9;
    const s = seed + pass * 17;
    ctx.beginPath();
    sketchLine(ctx, x, y, x + w, y, s);
    sketchLine(ctx, x + w, y, x + w, y + h, s + 4);
    sketchLine(ctx, x + w, y + h, x, y + h, s + 8);
    sketchLine(ctx, x, y + h, x, y, s + 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function sketchCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, width = 1.2) {
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = width;
  ctx.beginPath();
  const start = hash(seed) * Math.PI * 2;
  for (let i = 0; i <= 20; i++) {
    const a = start + (i / 20) * Math.PI * 2.08;
    const rr = r + (hash(seed + i) - 0.5) * Math.min(1.2, r * 0.12);
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** Flat colour with speckles: the "printed on rough stock" look of the panels and wood. */
function speckle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, light: string, dark: string) {
  const count = Math.floor((w * h) / 22);
  for (let i = 0; i < count; i++) {
    const px = x + hash(seed + i * 3) * w;
    const py = y + hash(seed + i * 3 + 1) * h;
    ctx.fillStyle = hash(seed + i * 3 + 2) > 0.5 ? light : dark;
    ctx.fillRect(px, py, 1, 1);
  }
}

// ---------- Static body ----------
function drawWood(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  ctx.fillStyle = '#a4552f';
  ctx.fillRect(x, y, w, h);
  speckle(ctx, x, y, w, h, seed, 'rgba(255,220,180,0.18)', 'rgba(60,20,5,0.25)');
  ctx.strokeStyle = 'rgba(70,28,10,0.35)';
  ctx.lineWidth = 0.8;
  const vertical = h > w;
  const lines = Math.max(2, Math.floor((vertical ? w : h) / 5));
  for (let i = 1; i < lines; i++) {
    ctx.beginPath();
    const t = i / lines;
    for (let k = 0; k <= 12; k++) {
      const s = k / 12;
      const wob = Math.sin(s * 6 + hash(seed + i) * 6) * 1.2;
      const px = vertical ? x + t * w + wob : x + s * w;
      const py = vertical ? y + s * h : y + t * h + wob;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function cheekPath(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, cw: number, mirror: boolean) {
  const inner = mirror ? x : x + cw;
  const outer = mirror ? x + cw : x;
  ctx.beginPath();
  ctx.moveTo(inner, top);
  ctx.quadraticCurveTo(outer, top - 2, outer + (mirror ? -cw * 0.15 : cw * 0.15), top + cw * 0.9);
  ctx.lineTo(outer, bottom - 6);
  ctx.quadraticCurveTo(outer, bottom, inner, bottom);
  ctx.closePath();
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, cx: number, cy: number, unit: number, seed: number) {
  if (it.kind === 'bigKnob') {
    const r = unit * 1.9;
    ctx.fillStyle = '#20201c';
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eee6d2';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,100,70,0.18)';
    ctx.beginPath(); ctx.arc(cx + r * 0.15, cy + r * 0.15, r * 0.8, 0, Math.PI * 2); ctx.fill();
    sketchCircle(ctx, cx, cy, r, seed, 1.4);
    // Scale ticks
    ctx.strokeStyle = '#e9e1cc';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
      ctx.lineTo(cx + Math.cos(a) * r * 1.38, cy + Math.sin(a) * r * 1.38);
      ctx.stroke();
    }
    const a = Math.PI * 0.75 + hash(seed + 5) * Math.PI * 1.5;
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
  } else if (it.kind === 'knob') {
    const r = unit * 0.8;
    ctx.fillStyle = '#1d1c1a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, Math.PI * 2); ctx.fill();
    const a = Math.PI * 0.75 + hash(seed + 7) * Math.PI * 1.5;
    ctx.strokeStyle = '#efe7d3';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
    ctx.stroke();
    ctx.fillStyle = '#d99a3a';
    ctx.beginPath(); ctx.arc(cx, cy - r * 1.55, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (it.kind === 'slider') {
    const len = unit * 4;
    ctx.fillStyle = '#1b1a18';
    roundRect(ctx, cx - 1.6, cy - len / 2, 3.2, len, 1.5, true, false);
    const pos = cy - len / 2 + hash(seed + 9) * len;
    ctx.fillStyle = '#ece4cf';
    roundRect(ctx, cx - unit * 0.7, pos - unit * 0.35, unit * 1.4, unit * 0.7, 1.5, true, false);
    sketchRect(ctx, cx - unit * 0.7, pos - unit * 0.35, unit * 1.4, unit * 0.7, seed, 0.9);
  } else if (it.kind === 'jack') {
    const r = unit * 0.55;
    ctx.fillStyle = '#d9d2bf';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141311';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
    sketchCircle(ctx, cx, cy, r, seed, 0.9);
  } else {
    // LED socket (the lit dot is drawn live)
    ctx.fillStyle = '#3b2a17';
    ctx.beginPath(); ctx.arc(cx, cy, unit * 0.42, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, l: SynthLayout, p: Parts) {
  const { x, y, w, h } = l;
  // Soft drop shadow on the paper (offset shape, no blur)
  ctx.fillStyle = 'rgba(60,45,30,0.12)';
  roundRect(ctx, x + 6, y + 10, w, h, 10, true, false);

  // Case back and front rail
  drawWood(ctx, p.innerX, y + h * 0.02, p.innerW, p.panelY - y, 11);
  ctx.fillStyle = '#3a2f26';
  ctx.fillRect(p.innerX, p.panelY + p.panelH, p.innerW, p.bedY - (p.panelY + p.panelH) + p.bedH);
  drawWood(ctx, p.innerX - 2, p.bedY + p.bedH, p.innerW + 4, y + h - (p.bedY + p.bedH), 23);
  sketchRect(ctx, p.innerX - 2, p.bedY + p.bedH, p.innerW + 4, y + h - (p.bedY + p.bedH), 29, 1.6);

  // Modules
  const unit = Math.max(4, p.panelH * 0.075);
  MODULES.forEach((m, mi) => {
    const mx = moduleX(p.innerX, p.innerW, mi);
    const mw = p.innerW * m.width;
    ctx.fillStyle = m.face;
    ctx.fillRect(mx, p.panelY, mw, p.panelH);
    speckle(ctx, mx, p.panelY, mw, p.panelH, 100 + mi * 1000, 'rgba(255,250,230,0.16)', 'rgba(20,25,15,0.22)');
    sketchRect(ctx, mx + 1, p.panelY + 1, mw - 2, p.panelH - 2, 300 + mi * 31, 1.3);
    // Screws
    for (const [sx, sy] of [[5, 5], [mw - 5, 5], [5, p.panelH - 5], [mw - 5, p.panelH - 5]]) {
      ctx.fillStyle = '#c9c1aa';
      ctx.beginPath(); ctx.arc(mx + sx, p.panelY + sy, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GRAPHITE; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(mx + sx - 1.6, p.panelY + sy); ctx.lineTo(mx + sx + 1.6, p.panelY + sy); ctx.stroke();
    }
    m.items.forEach((it, ii) => drawItem(ctx, it, mx + it.u * mw, p.panelY + it.v * p.panelH, unit, mi * 97 + ii * 13));
  });

  // Wheel box left of the keys
  const wbX = p.innerX + 4;
  const wbW = p.keys.x - wbX - 4;
  ctx.fillStyle = '#66705a';
  ctx.fillRect(wbX, p.keys.y, wbW, p.keys.h);
  speckle(ctx, wbX, p.keys.y, wbW, p.keys.h, 7000, 'rgba(255,250,230,0.16)', 'rgba(20,25,15,0.22)');
  sketchRect(ctx, wbX, p.keys.y, wbW, p.keys.h, 777, 1.2);
  for (let i = 0; i < 2; i++) {
    const ww = wbW * 0.2;
    const wx = wbX + wbW * (0.28 + i * 0.32) - ww / 2;
    const wy = p.keys.y + p.keys.h * 0.3;
    const wh = p.keys.h * 0.6;
    ctx.fillStyle = '#141311';
    roundRect(ctx, wx - 2, wy - 2, ww + 4, wh + 4, 3, true, false);
    ctx.fillStyle = '#ddd5c0';
    roundRect(ctx, wx, wy, ww, wh, 2, true, false);
    ctx.strokeStyle = 'rgba(44,42,39,0.5)'; ctx.lineWidth = 0.8;
    for (let k = 1; k < 8; k++) {
      ctx.beginPath(); ctx.moveTo(wx, wy + (wh * k) / 8); ctx.lineTo(wx + ww, wy + (wh * k) / 8); ctx.stroke();
    }
    ctx.fillStyle = '#d99a3a';
    ctx.beginPath(); ctx.arc(wx + ww / 2, p.keys.y + p.keys.h * 0.15, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Wood cheeks (drawn last so they overlap the case edges)
  const top = y;
  const bottom = y + h;
  for (const mirror of [false, true]) {
    const cx = mirror ? x + w - p.cheekW : x;
    ctx.save();
    cheekPath(ctx, cx, top, bottom, p.cheekW, mirror);
    ctx.clip();
    drawWood(ctx, cx - 2, top - 4, p.cheekW + 4, h + 8, mirror ? 41 : 37);
    ctx.restore();
    cheekPath(ctx, cx, top, bottom, p.cheekW, mirror);
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

const bodyCache = new Map<string, HTMLCanvasElement>();
function bodyLayer(l: SynthLayout, p: Parts): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${l.x}|${l.y}|${l.w}|${l.h}|${l.lo}|${l.hi}`;
  let c = bodyCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.ceil(l.x + l.w + 12);
    c.height = Math.ceil(l.y + l.h + 16);
    const g = c.getContext('2d');
    if (g) drawBody(g, l, p);
    if (bodyCache.size > 8) bodyCache.clear();
    bodyCache.set(key, c);
  }
  return c;
}

// ---------- Live parts ----------
export interface LitKey { color: string; label: string; age: number }

export function drawSynth(ctx: CanvasRenderingContext2D, l: SynthLayout, lit: Map<number, LitKey>, showLabels: boolean) {
  const p = parts(l);
  const layer = bodyLayer(l, p);
  if (layer) ctx.drawImage(layer, 0, 0);
  else drawBody(ctx, l, p);

  const k = p.keys;
  // White keys
  for (let n = l.lo; n <= l.hi; n++) {
    if (isBlack(n)) continue;
    const kx = k.x + k.left(n);
    const key = lit.get(n);
    ctx.fillStyle = key ? key.color : '#f2ecdd';
    ctx.fillRect(kx, k.y, k.whiteW, k.h);
    if (!key) {
      ctx.fillStyle = 'rgba(120,100,70,0.12)';
      ctx.fillRect(kx, k.y + k.h * 0.88, k.whiteW, k.h * 0.12);
    }
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    sketchLine(ctx, kx, k.y, kx, k.y + k.h, n * 7);
    ctx.stroke();
    if (key && showLabels && k.whiteW > 9) {
      ctx.font = `700 ${Math.min(8, k.whiteW * 0.42)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = GRAPHITE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(key.label, kx + k.whiteW / 2, k.y + k.h - 3, k.whiteW - 2);
    }
  }
  sketchRect(ctx, k.x, k.y, k.w, k.h, 4242, 1.4);
  // Shadow under the panel lip
  ctx.fillStyle = 'rgba(30,22,15,0.25)';
  ctx.fillRect(k.x, k.y, k.w, 4);

  // Black keys
  const bh = k.h * 0.6;
  for (let n = l.lo; n <= l.hi; n++) {
    if (!isBlack(n)) continue;
    const kx = k.x + k.left(n);
    const key = lit.get(n);
    ctx.fillStyle = key ? key.color : '#24211e';
    roundRect(ctx, kx, k.y, k.blackW, bh, [0, 0, 2, 2], true, false);
    ctx.strokeStyle = GRAPHITE;
    ctx.lineWidth = 1;
    roundRect(ctx, kx, k.y, k.blackW, bh, [0, 0, 2, 2], false, true);
    if (!key) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(kx + 2, k.y + 3, 1.2, bh - 9);
    }
  }

  // LEDs glow in the colour of the most recent note
  let newest: LitKey | undefined;
  for (const key of lit.values()) if (!newest || key.age < newest.age) newest = key;
  const r = Math.max(2, p.panelH * 0.03);
  for (const s of p.ledSpots) {
    ctx.fillStyle = newest ? newest.color : '#5a3d1e';
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    if (newest) {
      ctx.fillStyle = 'rgba(255,250,235,0.7)';
      ctx.beginPath(); ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }
}
