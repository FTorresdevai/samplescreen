import { MidiNote, ModelDrawContext, ModeModule, VisualizerSettings } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { hexToRgb } from '../../../engine/palettes';

/**
 * Ink Roll 98: a made-up late-90s paint program. Inside its window a piano roll scrolls past a
 * fixed playhead; notes arrive as bare outlines and get painted with their lane colour
 * (melody / chords / bass) as the brush on the playhead passes over them.
 * Flat fills and offset shadows only (no shadowBlur), so light palettes need no special case.
 */

export type Lane = 'melody' | 'chords' | 'bass';
const LANES: Lane[] = ['melody', 'chords', 'bass'];
const LANE_LABEL: Record<Lane, string> = { melody: 'MELODY', chords: 'CHORDS', bass: 'BASS' };

// ==========================================
// LANE ASSIGNMENT (pure, cached per notes array)
// ==========================================
const ONSET_EPS = 0.03;  // notes starting within 30 ms count as one onset
const laneCache = new WeakMap<MidiNote[], Map<MidiNote, Lane>>();

/** Split by MIDI track when ≥3 note tracks exist (lowest mean pitch = bass, highest = melody). */
function lanesByTrack(notes: MidiNote[]): Map<MidiNote, Lane> | null {
  const stats = new Map<number, { sum: number; count: number }>();
  for (const n of notes) {
    if (n.track === undefined) return null;
    const s = stats.get(n.track) ?? { sum: 0, count: 0 };
    s.sum += n.midi;
    s.count++;
    stats.set(n.track, s);
  }
  if (stats.size < 3) return null;
  const order = [...stats.entries()].sort((a, b) => a[1].sum / a[1].count - b[1].sum / b[1].count).map(e => e[0]);
  const trackLane = new Map<number, Lane>();
  order.forEach((t, i) => trackLane.set(t, i === 0 ? 'bass' : i === order.length - 1 ? 'melody' : 'chords'));
  return new Map(notes.map(n => [n, trackLane.get(n.track!)!]));
}

/** Split by register: lowest sounding voice = bass, top voice = melody, the rest = chords. */
function lanesByRegister(notes: MidiNote[]): Map<MidiNote, Lane> {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const lanes = new Map<MidiNote, Lane>();
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    const cluster: number[] = [];   // pitches starting together with n (n included)
    let lo = n.midi;
    let hi = n.midi;
    let sounding = 0;
    for (let j = i - 1; j >= 0 && n.time - sorted[j].time < 16; j--) {
      const o = sorted[j];
      const together = n.time - o.time <= ONSET_EPS;
      if (!together && o.time + o.duration <= n.time + ONSET_EPS) continue;
      if (together) cluster.push(o.midi);
      lo = Math.min(lo, o.midi);
      hi = Math.max(hi, o.midi);
      sounding++;
    }
    for (let j = i; j < sorted.length && sorted[j].time - n.time <= ONSET_EPS; j++) {
      const o = sorted[j];
      cluster.push(o.midi);
      lo = Math.min(lo, o.midi);
      hi = Math.max(hi, o.midi);
      if (j !== i) sounding++;
    }

    let lane: Lane;
    if (sounding === 0) {
      lane = n.midi < 52 ? 'bass' : 'melody';
    } else if (n.midi === lo && n.midi < 60) {
      lane = 'bass';
    } else if (n.midi === hi) {
      // A top note struck with a block chord only counts as melody when it clearly stands above it
      const below = cluster.filter(p => p < n.midi);
      const gap = below.length ? n.midi - Math.max(...below) : Infinity;
      lane = cluster.length >= 3 && gap < 5 ? 'chords' : 'melody';
    } else {
      lane = 'chords';
    }
    lanes.set(n, lane);
  }
  return lanes;
}

export function assignLanes(notes: MidiNote[]): Map<MidiNote, Lane> {
  let lanes = laneCache.get(notes);
  if (!lanes) {
    lanes = lanesByTrack(notes) ?? lanesByRegister(notes);
    laneCache.set(notes, lanes);
  }
  return lanes;
}

// ==========================================
// COLOURS
// ==========================================
interface Rgb { r: number; g: number; b: number }

const PAPER = '#fbfaf3';
const CHROME = '#c8c5bb';
const CHROME_HI = '#f5f3eb';
const CHROME_LO = '#807c72';
const CHROME_DK = '#2b2925';
const INK = '#1d1c19';
const BASS_BLUE: Rgb = { r: 74, g: 103, b: 176 };
const CHORD_CORAL: Rgb = { r: 208, g: 103, b: 91 };
const SWATCHES = [
  '#1d1c19', '#77736a', '#8a2b2b', '#8f7a2a', '#3d6b33', '#2f6b6b', '#2a3a7a', '#6e3a7a', '#7a5a3a', '#3a5a4a', '#4a3a5a', '#8a3a5a', '#5a6a2a', '#9a6a2a',
  '#ffffff', '#bdb9ae', '#d9534f', '#e8c64a', '#6fbf73', '#5bbcc4', '#6f86d6', '#c06fc4', '#e2b37a', '#9ad6b0', '#b9a6e6', '#ef9ab6', '#d7e08a', '#f2b766',
];

const rgba = (c: Rgb, a = 1): string => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
const luminance = (c: Rgb): number => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

/** Palette colours that would vanish on the white paper get darkened. */
function onPaper(hex: string | undefined, fallback: string): Rgb {
  const c = hexToRgb(hex || fallback);
  if (luminance(c) < 0.75) return c;
  const f = 0.55;
  return { r: Math.round(c.r * f), g: Math.round(c.g * f), b: Math.round(c.b * f) };
}

function laneColours(settings: VisualizerSettings): Record<Lane, Rgb> {
  return {
    melody: onPaper(settings.notesColor, '#e69d45'),
    // Cream-like accents (e.g. Walnut) would only darken to a dull khaki: use a coral instead
    chords: luminance(hexToRgb(settings.accentColor || '#a94f2d')) < 0.75 ? hexToRgb(settings.accentColor || '#a94f2d') : CHORD_CORAL,
    bass: BASS_BLUE,
  };
}

// ==========================================
// CHROME HELPERS
// ==========================================
function bevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, raised: boolean, fill: string = CHROME) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = raised ? CHROME_HI : CHROME_LO;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = raised ? CHROME_DK : CHROME_HI;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function fileName(title: string | undefined): string {
  const slug = (title || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16);
  return `${slug || 'UNTITLED'}.INK`;
}

interface Anchor { rel: number; y: number; lane: Lane; pitch: number }

type Tool = 'select' | 'lasso' | 'pencil' | 'brush' | 'bucket' | 'eraser' | 'picker' | 'line' | 'rect' | 'oval';
const TOOLS: Tool[] = ['select', 'lasso', 'pencil', 'brush', 'bucket', 'eraser', 'picker', 'line', 'rect', 'oval'];

function drawToolIcon(ctx: CanvasRenderingContext2D, tool: Tool, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  switch (tool) {
    case 'select':
      ctx.setLineDash([s * 0.15, s * 0.12]);
      ctx.strokeRect(-s * 0.35, -s * 0.3, s * 0.7, s * 0.6);
      break;
    case 'lasso':
      ctx.setLineDash([s * 0.15, s * 0.12]);
      ctx.ellipse(0, -s * 0.05, s * 0.38, s * 0.26, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'pencil':
      ctx.moveTo(-s * 0.32, s * 0.32);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.stroke();
      ctx.fillRect(-s * 0.38, s * 0.26, s * 0.12, s * 0.12);
      break;
    case 'brush':
      ctx.moveTo(-s * 0.1, s * 0.1);
      ctx.lineTo(s * 0.34, -s * 0.34);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, s * 0.2, s * 0.14, s * 0.2, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bucket':
      ctx.rotate(-0.4);
      ctx.strokeRect(-s * 0.22, -s * 0.18, s * 0.38, s * 0.4);
      ctx.rotate(0.4);
      ctx.fillRect(s * 0.24, s * 0.05, s * 0.1, s * 0.22);
      break;
    case 'eraser':
      ctx.rotate(-0.6);
      ctx.strokeRect(-s * 0.36, -s * 0.15, s * 0.72, s * 0.3);
      ctx.fillRect(-s * 0.36, -s * 0.15, s * 0.24, s * 0.3);
      break;
    case 'picker':
      ctx.moveTo(-s * 0.32, s * 0.32);
      ctx.lineTo(s * 0.12, -s * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.2, -s * 0.2, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'line':
      ctx.moveTo(-s * 0.35, s * 0.3);
      ctx.lineTo(s * 0.35, -s * 0.3);
      ctx.stroke();
      break;
    case 'rect':
      ctx.strokeRect(-s * 0.34, -s * 0.24, s * 0.68, s * 0.48);
      break;
    case 'oval':
      ctx.ellipse(0, 0, s * 0.36, s * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawBrushCursor(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, tip: Rgb) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.65);
  ctx.lineWidth = Math.max(1, u * 0.6);
  ctx.strokeStyle = INK;
  // Handle
  ctx.fillStyle = '#b5793d';
  ctx.fillRect(-u * 1.5, -u * 26, u * 3, u * 13);
  ctx.strokeRect(-u * 1.5, -u * 26, u * 3, u * 13);
  // Ferrule
  ctx.fillStyle = '#d7d4cc';
  ctx.fillRect(-u * 2, -u * 13, u * 4, u * 5);
  ctx.strokeRect(-u * 2, -u * 13, u * 4, u * 5);
  // Wet bristles, tip on the playhead
  ctx.beginPath();
  ctx.moveTo(-u * 2, -u * 8);
  ctx.quadraticCurveTo(-u * 2.4, -u * 2, 0, 0);
  ctx.quadraticCurveTo(u * 2.4, -u * 2, u * 2, -u * 8);
  ctx.closePath();
  ctx.fillStyle = rgba(tip);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ==========================================
// DRAW
// ==========================================
export function drawInkRoll(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, settings, activeNotes } = context;
  const notes = midi.notes || [];
  const lanes = assignLanes(notes);
  const colours = laneColours(settings);
  const playColour = onPaper(settings.accentColor, '#c0392b');
  const nameOf = (p: number): string => formatNoteName(p, settings.accidental, settings.middleC);

  // Scale unit: 1 at a ~520 px wide window, capped so chrome never gets chunky
  const u = Math.max(1, Math.min(2.2, Math.min(region.width / 520, region.height / 700)));
  const mono = (px: number, weight = 700) => `${weight} ${px.toFixed(1)}px "JetBrains Mono", monospace`;

  const margin = 6 * u;
  const wx = Math.round(region.x + margin);
  const wy = Math.round(region.y + margin);
  const ww = Math.round(region.width - margin * 2);
  const wh = Math.round(region.height - margin * 2);

  ctx.save();

  // ---- Window frame + offset shadow ----
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(wx + 5 * u, wy + 5 * u, ww, wh);
  bevel(ctx, wx, wy, ww, wh, true);

  // ---- Title bar: gradient from the palette's note colour ----
  const pad = 3 * u;
  const titleH = Math.round(18 * u);
  const tx = wx + pad;
  const ty = wy + pad;
  const tw = ww - pad * 2;
  const base = hexToRgb(settings.notesColor || '#e69d45');
  const dark: Rgb = { r: Math.round(base.r * 0.35), g: Math.round(base.g * 0.35), b: Math.round(base.b * 0.35) };
  const grad = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  grad.addColorStop(0, rgba(dark));
  grad.addColorStop(1, rgba(base, 0.85));
  ctx.fillStyle = grad;
  ctx.fillRect(tx, ty, tw, titleH);
  // App icon: a tiny paint pot
  ctx.fillStyle = PAPER;
  ctx.fillRect(tx + 4 * u, ty + 4 * u, 10 * u, 10 * u);
  ctx.fillStyle = rgba(colours.melody);
  ctx.fillRect(tx + 6 * u, ty + 8 * u, 6 * u, 4 * u);
  ctx.fillStyle = '#ffffff';
  ctx.font = mono(10 * u, 800);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`${fileName(settings.title)} - Ink Roll 98`, tx + 19 * u, ty + titleH / 2 + 0.5);
  // Window buttons
  const bs = titleH - 5 * u;
  for (let i = 0; i < 3; i++) {
    const bx = tx + tw - (3 - i) * (bs + 2 * u) - 1 * u;
    const by = ty + 2.5 * u;
    bevel(ctx, bx, by, bs, bs, true);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = Math.max(1, u * 1.2);
    const c = bs / 2;
    ctx.beginPath();
    if (i === 0) ctx.fillRect(bx + bs * 0.25, by + bs * 0.68, bs * 0.45, Math.max(1.5, u * 1.5));
    if (i === 1) ctx.strokeRect(bx + bs * 0.25, by + bs * 0.25, bs * 0.5, bs * 0.45);
    if (i === 2) {
      ctx.moveTo(bx + c - bs * 0.22, by + c - bs * 0.22);
      ctx.lineTo(bx + c + bs * 0.22, by + c + bs * 0.22);
      ctx.moveTo(bx + c + bs * 0.22, by + c - bs * 0.22);
      ctx.lineTo(bx + c - bs * 0.22, by + c + bs * 0.22);
      ctx.stroke();
    }
  }

  // ---- Menu row ----
  const menuY = ty + titleH + 1 * u;
  const menuH = Math.round(16 * u);
  ctx.font = mono(9.5 * u, 600);
  ctx.fillStyle = INK;
  let mx = tx + 6 * u;
  for (const item of ['File', 'Edit', 'View', 'Brush', 'Score', 'Help']) {
    ctx.fillText(item, mx, menuY + menuH / 2);
    const first = ctx.measureText(item[0]).width;
    ctx.fillRect(mx, menuY + menuH / 2 + 5 * u, first, Math.max(1, u * 0.8));
    mx += ctx.measureText(item).width + 12 * u;
  }

  // ---- Bottom: status bar, then swatch strip above it ----
  const statusH = Math.round(16 * u);
  const statusY = wy + wh - pad - statusH;
  const swatchH = Math.round(34 * u);
  const swatchY = statusY - 2 * u - swatchH;

  // ---- Tool palette (left) ----
  const bodyY = menuY + menuH + 2 * u;
  const cell = Math.round(15 * u);
  const toolsW = cell * 2 + 6 * u;
  bevel(ctx, tx, bodyY, toolsW, cell * 5 + 6 * u, true);
  TOOLS.forEach((tool, i) => {
    const cx = tx + 3 * u + (i % 2) * cell;
    const cy = bodyY + 3 * u + Math.floor(i / 2) * cell;
    const active = tool === 'brush';
    bevel(ctx, cx, cy, cell, cell, !active, active ? '#e4e1d8' : CHROME);
    drawToolIcon(ctx, tool, cx + cell / 2, cy + cell / 2, cell * 0.8);
  });

  // Brush-size well: the loudest active velocity picks the stroke width
  const maxVel = activeNotes.reduce((m, n) => Math.max(m, n.velocity || 0), 0);
  const sizeY = bodyY + cell * 5 + 10 * u;
  const sizeH = 44 * u;
  bevel(ctx, tx, sizeY, toolsW, sizeH, false, PAPER);
  const sizeSel = activeNotes.length ? Math.min(3, Math.floor(maxVel * 4)) : -1;
  for (let i = 0; i < 4; i++) {
    const ly = sizeY + 7 * u + i * 10 * u;
    if (i === sizeSel) {
      ctx.fillStyle = rgba(playColour);
      ctx.fillRect(tx + 3 * u, ly - 4 * u, toolsW - 6 * u, 8 * u);
    }
    ctx.fillStyle = i === sizeSel ? PAPER : INK;
    const lw = (i + 1) * 1.2 * u;
    ctx.fillRect(tx + 7 * u, ly - lw / 2, toolsW - 14 * u, lw);
  }

  // ---- Canvas (sunken white paper) ----
  const cx0 = tx + toolsW + 4 * u;
  const cy0 = bodyY;
  const cw = tx + tw - cx0;
  const ch = swatchY - 3 * u - cy0;
  bevel(ctx, cx0, cy0, cw, ch, false, PAPER);
  const px = cx0 + 2 * u;
  const py = cy0 + 2 * u;
  const pw = cw - 4 * u;
  const ph = ch - 4 * u;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  // Legend
  const legendH = 20 * u;
  ctx.font = mono(9 * u, 700);
  let lx = px + 10 * u;
  for (const lane of LANES) {
    ctx.fillStyle = rgba(colours[lane], 0.9);
    ctx.fillRect(lx, py + legendH / 2 - 4 * u, 8 * u, 8 * u);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.strokeRect(lx, py + legendH / 2 - 4 * u, 8 * u, 8 * u);
    ctx.fillStyle = INK;
    ctx.fillText(LANE_LABEL[lane], lx + 12 * u, py + legendH / 2 + 0.5);
    lx += 12 * u + ctx.measureText(LANE_LABEL[lane]).width + 18 * u;
  }
  const bpm = settings.bpm || midi.bpm || 80;
  ctx.textAlign = 'right';
  ctx.fillStyle = rgba(hexToRgb(INK), 0.55);
  ctx.fillText(`4/4  ${Math.round(bpm)} BPM`, px + pw - 8 * u, py + legendH / 2 + 0.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(hexToRgb(INK), 0.15);
  ctx.fillRect(px + 6 * u, py + legendH, pw - 12 * u, 1);

  // Roll geometry
  const labelW = 32 * u;
  const rollX = px + labelW;
  const rollY = py + legendH + 8 * u;
  const rollW = pw - labelW - 6 * u;
  const rollH = py + ph - 6 * u - rollY;
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    lo = Math.min(lo, n.midi);
    hi = Math.max(hi, n.midi);
  }
  if (lo > hi) { lo = 48; hi = 72; }
  lo -= 1;
  hi += 1;
  const rows = hi - lo + 1;
  const rowH = rollH / rows;
  const pitchY = (p: number) => rollY + (hi - p) * rowH;

  const secondsPerBar = (60 / bpm) * 4;
  const beatSec = secondsPerBar / 4;
  const loop = duration > 0 ? duration : 16;
  const now = ((loopTime % loop) + loop) % loop;
  const spanSec = Math.max(2, Math.min(loop, secondsPerBar * 4));
  const pxPerSec = rollW / spanSec;
  const playX = rollX + rollW * 0.3;
  const pastSec = (playX - rollX) / pxPerSec;
  const futureSec = (rollX + rollW - playX) / pxPerSec;
  const timeToX = (rel: number) => playX + rel * pxPerSec;

  // Row stripes (black keys) and C lines
  for (let p = lo; p <= hi; p++) {
    const pc = ((p % 12) + 12) % 12;
    const ry = pitchY(p);
    if ([1, 3, 6, 8, 10].includes(pc)) {
      ctx.fillStyle = 'rgba(29, 28, 25, 0.045)';
      ctx.fillRect(rollX, ry, rollW, rowH);
    }
    if (pc === 0) {
      ctx.fillStyle = 'rgba(29, 28, 25, 0.12)';
      ctx.fillRect(rollX, ry + rowH - 1, rollW, 1);
    }
  }

  // Beat grid: dotted beats, solid bars (wraps with the loop)
  const totalBeats = Math.max(1, Math.round(loop / beatSec));
  ctx.lineWidth = 1;
  for (let k = -1; k <= 1; k++) {
    for (let b = 0; b < totalBeats; b++) {
      const rel = b * beatSec + k * loop - now;
      if (rel < -pastSec || rel > futureSec) continue;
      const gx = Math.round(timeToX(rel)) + 0.5;
      const isBar = b % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(29, 28, 25, 0.22)' : 'rgba(29, 28, 25, 0.12)';
      ctx.setLineDash(isBar ? [] : [2 * u, 3 * u]);
      ctx.beginPath();
      ctx.moveTo(gx, rollY);
      ctx.lineTo(gx, rollY + rollH);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Notes: outlines ahead of the playhead, painted behind it
  const nh = Math.max(3, rowH - Math.max(1, rowH * 0.18));
  const nameFont = Math.min(nh - 2, 9 * u);
  const activeLane = new Map<number, Lane>();
  let cur: Anchor | null = null;   // latest onset at or before the playhead (top voice)
  let next: Anchor | null = null;  // first onset after it

  ctx.save();
  ctx.beginPath();
  ctx.rect(rollX, rollY, rollW, rollH);
  ctx.clip();
  for (const note of notes) {
    const lane = lanes.get(note) ?? 'chords';
    const col = colours[lane];
    const ny = pitchY(note.midi) + (rowH - nh) / 2;
    for (let k = -1; k <= 1; k++) {
      const rel = note.time + k * loop - now;
      const relEnd = rel + note.duration;
      if (relEnd < -pastSec || rel > futureSec) continue;
      const nx = timeToX(rel);
      const nw = Math.max(3 * u, note.duration * pxPerSec);
      const isActive = rel <= 0 && relEnd > 0;
      if (isActive) activeLane.set(note.midi, lane);

      const cand: Anchor = { rel, y: ny + nh / 2, lane, pitch: note.midi };
      if (rel <= 0 && relEnd > -0.25 && (!cur || rel > cur.rel + 1e-4 || (Math.abs(rel - cur.rel) <= 1e-4 && note.midi > cur.pitch))) cur = cand;
      if (rel > 0 && (!next || rel < next.rel - 1e-4 || (Math.abs(rel - next.rel) <= 1e-4 && note.midi > next.pitch))) next = cand;

      // Paint up to the playhead
      const paintW = Math.min(nw, playX - nx);
      if (paintW > 0) {
        ctx.fillStyle = rgba(col, 0.88);
        ctx.fillRect(nx, ny, paintW, nh);
        if (paintW < nw) {
          // Wet leading edge
          ctx.fillStyle = rgba(col);
          ctx.fillRect(nx + paintW - 1.5 * u, ny, 1.5 * u, nh);
        }
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, u * (isActive ? 1.4 : 0.9));
      ctx.strokeRect(nx + 0.5, ny + 0.5, nw - 1, nh - 1);

      if (nameFont >= 6) { // names inside the bars, piano-roll style
        const label = nameOf(note.midi);
        ctx.font = mono(nameFont, 700);
        if (ctx.measureText(label).width + 4 * u <= nw) {
          const painted = paintW >= Math.min(nw, 4 * u + ctx.measureText(label).width);
          ctx.fillStyle = painted ? (luminance(col) > 0.55 ? INK : '#ffffff') : 'rgba(29, 28, 25, 0.55)';
          ctx.fillText(label, nx + 2.5 * u, ny + nh / 2 + 0.5);
        }
      }
    }
  }
  ctx.restore();

  // Pitch labels; active pitches inverted in their lane colour
  const labelFont = Math.min(rowH * 0.85, 8.5 * u);
  ctx.font = mono(labelFont, 700);
  for (let p = lo; p <= hi; p++) {
    const pc = ((p % 12) + 12) % 12;
    const ry = pitchY(p);
    const lane = activeLane.get(p);
    const natural = ![1, 3, 6, 8, 10].includes(pc);
    if (lane) {
      const c = colours[lane];
      ctx.fillStyle = rgba(c);
      ctx.fillRect(px + 3 * u, ry, labelW - 6 * u, Math.max(rowH, labelFont + 2));
      ctx.fillStyle = luminance(c) > 0.55 ? INK : '#ffffff';
    } else if ((natural && rowH >= 7 * u) || pc === 0) {
      ctx.fillStyle = 'rgba(29, 28, 25, 0.6)';
    } else {
      continue;
    }
    ctx.fillText(nameOf(p), px + 5 * u, ry + rowH / 2 + 0.5);
  }

  // Playhead: dashed line with a small marker on top
  ctx.strokeStyle = rgba(playColour);
  ctx.lineWidth = Math.max(1, u);
  ctx.setLineDash([3 * u, 2 * u]);
  ctx.beginPath();
  ctx.moveTo(Math.round(playX) + 0.5, rollY - 2 * u);
  ctx.lineTo(Math.round(playX) + 0.5, rollY + rollH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(playColour);
  ctx.beginPath();
  ctx.moveTo(playX - 4 * u, rollY - 6 * u);
  ctx.lineTo(playX + 4 * u, rollY - 6 * u);
  ctx.lineTo(playX, rollY - 1 * u);
  ctx.closePath();
  ctx.fill();

  // Brush rides the top voice of the latest onset, gliding to the next one just before it lands
  const c0: Anchor | null = cur;
  const n0: Anchor | null = next;
  let brushY = c0?.y ?? n0?.y ?? rollY + rollH / 2;
  let brushLane: Lane = c0?.lane ?? n0?.lane ?? 'melody';
  if (n0 && n0.rel < 0.12) {
    const t = 1 - n0.rel / 0.12;
    brushY += (n0.y - brushY) * t * t;
    if (t > 0.5) brushLane = n0.lane;
  }
  drawBrushCursor(ctx, playX, brushY, u * 1.4, colours[brushLane]);
  ctx.restore(); // canvas clip

  // ---- Swatch strip ----
  bevel(ctx, tx, swatchY, tw, swatchH, true);
  const well = swatchH - 6 * u;
  bevel(ctx, tx + 3 * u, swatchY + 3 * u, well, well, false, '#e4e1d8');
  // Background / foreground colour chips (foreground = brush lane)
  ctx.fillStyle = PAPER;
  ctx.fillRect(tx + 3 * u + well * 0.42, swatchY + 3 * u + well * 0.42, well * 0.42, well * 0.42);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 3 * u + well * 0.42, swatchY + 3 * u + well * 0.42, well * 0.42, well * 0.42);
  ctx.fillStyle = rgba(colours[brushLane]);
  ctx.fillRect(tx + 3 * u + well * 0.16, swatchY + 3 * u + well * 0.16, well * 0.42, well * 0.42);
  ctx.strokeRect(tx + 3 * u + well * 0.16, swatchY + 3 * u + well * 0.16, well * 0.42, well * 0.42);

  const sw = (tw - well - 14 * u) / 14;
  const sh = (swatchH - 8 * u) / 2;
  const sx0 = tx + well + 9 * u;
  SWATCHES.forEach((hex, i) => {
    const sx = sx0 + (i % 14) * sw;
    const sy = swatchY + 4 * u + Math.floor(i / 14) * sh;
    // The first three of the bottom row carry the lane colours
    const laneIdx = i - 14;
    const lane = laneIdx >= 0 && laneIdx < 3 ? LANES[laneIdx] : null;
    bevel(ctx, sx, sy, sw - 1, sh - 1, false, lane ? rgba(colours[lane]) : hex);
    if (lane && lane === brushLane) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, u * 1.2);
      ctx.strokeRect(sx + 1.5 * u, sy + 1.5 * u, sw - 4 * u, sh - 4 * u);
    }
  });

  // ---- Status bar: playing notes | position | velocity meter ----
  const meterW = 96 * u;
  const posW = 64 * u;
  const notesW = tw - meterW - posW - 4 * u;
  bevel(ctx, tx, statusY, notesW, statusH, false);
  bevel(ctx, tx + notesW + 2 * u, statusY, posW, statusH, false);
  bevel(ctx, tx + tw - meterW, statusY, meterW, statusH, false);
  ctx.font = mono(8.5 * u, 700);
  ctx.fillStyle = INK;
  const playing = [...new Set(activeNotes.map(n => n.midi))].sort((a, b) => a - b).map(nameOf);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tx, statusY, notesW - 2 * u, statusH);
  ctx.clip();
  ctx.fillText(playing.length ? `♪ ${playing.join('  ')}` : '♪ --', tx + 5 * u, statusY + statusH / 2 + 0.5);
  ctx.restore();
  const bar = Math.floor(now / secondsPerBar) + 1;
  const beat = Math.floor((now % secondsPerBar) / beatSec) + 1;
  ctx.fillText(`Bar ${bar}:${beat}`, tx + notesW + 7 * u, statusY + statusH / 2 + 0.5);
  ctx.fillText('VEL', tx + tw - meterW + 5 * u, statusY + statusH / 2 + 0.5);
  const segs = 12;
  const mx0 = tx + tw - meterW + 26 * u;
  const segW = (meterW - 31 * u) / segs;
  const lit = Math.round(maxVel * segs);
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i < lit ? (i >= segs - 2 ? rgba(playColour) : INK) : 'rgba(29, 28, 25, 0.15)';
    ctx.fillRect(mx0 + i * segW, statusY + 4 * u, segW - 1.5 * u, statusH - 8 * u);
  }

  ctx.restore();
}

export default { draw: drawInkRoll } satisfies ModeModule;
