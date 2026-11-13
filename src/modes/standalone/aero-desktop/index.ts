import { MidiNote, ModelDrawContext, ModeModule } from '../../../types';

// "Y2K Desktop": a glossy late-2000s desktop with one large glass window.
// Inside it, MIDI notes scroll past a fixed playhead on a pitch axis (piano-roll flow);
// audio only = a single scrolling energy band. A light CRT/VHS pass sits on top.

interface Rect { x: number; y: number; w: number; h: number }

export interface PitchRange { low: number; high: number } // inclusive midi pitches

const FONT = 'Tahoma, Verdana, "DejaVu Sans", sans-serif';
const ENERGY_BINS = 240;
const MIN_PITCH_SPAN = 12;     // at least one octave of rows
const VISIBLE_BARS = 4;        // time span shown across the roll
const PLAYHEAD_AT = 0.28;      // playhead position as a fraction of the roll width
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NO_NOTES: MidiNote[] = [];

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** "C4"-style name (midi 60 = C4). */
export function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Used pitch range padded by one semitone each side, widened symmetrically to at least `minSpan` rows. */
export function pitchRange(notes: MidiNote[], minSpan: number = MIN_PITCH_SPAN): PitchRange {
  if (notes.length === 0) return { low: 60 - Math.floor(minSpan / 2), high: 60 + Math.ceil(minSpan / 2) - 1 };
  let low = Infinity;
  let high = -Infinity;
  for (const n of notes) {
    if (n.midi < low) low = n.midi;
    if (n.midi > high) high = n.midi;
  }
  low -= 1;
  high += 1;
  const missing = minSpan - (high - low + 1);
  if (missing > 0) {
    low -= Math.floor(missing / 2);
    high += Math.ceil(missing / 2);
  }
  return { low, high };
}

// Pitch range only changes with the notes array, not per frame.
const rangeCache = new WeakMap<MidiNote[], PitchRange>();
function rangeFor(notes: MidiNote[]): PitchRange {
  let range = rangeCache.get(notes);
  if (!range) {
    range = pitchRange(notes);
    rangeCache.set(notes, range);
  }
  return range;
}

// Audio-only band: energy recorded per timeline bin as the playhead passes (fills in over one loop).
let energyBins = new Float32Array(ENERGY_BINS);
let energyLoop = 0;

// CRT scanline pattern (created lazily; DOM only).
let scanPattern: CanvasPattern | null = null;

// ---------------------------------------------------------------------------
// Drawing primitives

function rr(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function drawWallpaper(ctx: CanvasRenderingContext2D, r: Rect, t: number, energy: number): void {
  const bg = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.3, r.y + r.h);
  bg.addColorStop(0, '#071a4e');
  bg.addColorStop(0.45, '#1546a8');
  bg.addColorStop(0.75, '#0d348a');
  bg.addColorStop(1, '#061646');
  ctx.fillStyle = bg;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const glow = ctx.createRadialGradient(r.x + r.w * 0.8, r.y + r.h * 0.12, 0, r.x + r.w * 0.8, r.y + r.h * 0.12, r.w * 0.9);
  glow.addColorStop(0, `rgba(120, 190, 255, ${0.35 + energy * 0.15})`);
  glow.addColorStop(1, 'rgba(120, 190, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Soft light streaks: wide curved bands that drift slowly.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const drift = Math.sin(t * 0.15 + i * 1.7) * 40;
    const y0 = r.y + r.h * (0.25 + i * 0.2) + drift;
    const band = ctx.createLinearGradient(r.x, y0 - 60, r.x, y0 + 60);
    band.addColorStop(0, 'rgba(140, 200, 255, 0)');
    band.addColorStop(0.5, `rgba(160, 215, 255, ${0.07 + (i % 2) * 0.04})`);
    band.addColorStop(1, 'rgba(140, 200, 255, 0)');
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(r.x - 20, y0 + 70);
    ctx.bezierCurveTo(r.x + r.w * 0.3, y0 - 120 - i * 20, r.x + r.w * 0.65, y0 + 90, r.x + r.w + 20, y0 - 80);
    ctx.lineTo(r.x + r.w + 20, y0 - 40);
    ctx.bezierCurveTo(r.x + r.w * 0.65, y0 + 130, r.x + r.w * 0.3, y0 - 70 - i * 20, r.x - 20, y0 + 110);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCaptionButtons(ctx: CanvasRenderingContext2D, right: number, top: number): void {
  const h = 19;
  const buttons: { w: number; kind: 'min' | 'max' | 'close' }[] = [
    { w: 27, kind: 'min' }, { w: 26, kind: 'max' }, { w: 45, kind: 'close' },
  ];
  let x = right - buttons.reduce((s, b) => s + b.w, 0);
  for (const b of buttons) {
    const box: Rect = { x, y: top, w: b.w, h };
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    if (b.kind === 'close') {
      g.addColorStop(0, '#f0a090'); g.addColorStop(0.45, '#d9533b'); g.addColorStop(0.5, '#c23a20'); g.addColorStop(1, '#e0704f');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.45, 'rgba(200,220,240,0.45)');
      g.addColorStop(0.5, 'rgba(120,150,190,0.45)'); g.addColorStop(1, 'rgba(190,220,250,0.6)');
    }
    rr(ctx, box, 3);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 40, 80, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cx = x + b.w / 2;
    const cy = top + h / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 2;
    if (b.kind === 'min') {
      ctx.fillRect(cx - 5, cy + 3, 10, 2.5);
    } else if (b.kind === 'max') {
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 4, 10, 8);
      ctx.fillRect(cx - 5, cy - 4, 10, 2);
    } else {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx + 5, cy + 4);
      ctx.moveTo(cx + 5, cy - 4); ctx.lineTo(cx - 5, cy + 4);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    x += b.w;
  }
}

/** Glass frame with a gradient title bar. Returns the inner content rect. */
function drawGlassWindow(ctx: CanvasRenderingContext2D, r: Rect, title: string, drawIcon: (x: number, y: number) => void): Rect {
  const titleH = 32;
  const border = 7;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 10, 40, 0.7)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  rr(ctx, r, 9);
  const glass = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  glass.addColorStop(0, 'rgba(185, 215, 245, 0.62)');
  glass.addColorStop(0.5, 'rgba(110, 150, 205, 0.5)');
  glass.addColorStop(1, 'rgba(150, 190, 235, 0.58)');
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.restore();

  // Gloss on the title bar.
  ctx.save();
  rr(ctx, r, 9);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, r.y, 0, r.y + titleH);
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gloss.addColorStop(0.52, 'rgba(255,255,255,0.04)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = gloss;
  ctx.fillRect(r.x, r.y, r.w, titleH);
  // Diagonal sheen across the glass.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w * 0.35, r.y);
  ctx.lineTo(r.x + r.w * 0.55, r.y);
  ctx.lineTo(r.x + r.w * 0.25, r.y + r.h);
  ctx.lineTo(r.x + r.w * 0.05, r.y + r.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  rr(ctx, r, 9);
  ctx.strokeStyle = 'rgba(10, 25, 60, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  rr(ctx, { x: r.x + 1.5, y: r.y + 1.5, w: r.w - 3, h: r.h - 3 }, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  drawIcon(r.x + 12, r.y + 7);
  ctx.save();
  ctx.font = `15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#0b1830';
  ctx.fillText(title, r.x + 38, r.y + titleH / 2 + 1, r.w - 200);
  ctx.restore();

  drawCaptionButtons(ctx, r.x + r.w - 8, r.y + 1);

  const inner: Rect = { x: r.x + border, y: r.y + titleH, w: r.w - border * 2, h: r.h - titleH - border };
  ctx.strokeStyle = 'rgba(20, 40, 80, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(inner.x - 0.5, inner.y - 0.5, inner.w + 1, inner.h + 1);
  return inner;
}

function drawAppIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Made-up app icon: a glossy teal disc with an eighth note.
  const g = ctx.createRadialGradient(x + 7, y + 6, 1, x + 9, y + 9, 11);
  g.addColorStop(0, '#d8fff4');
  g.addColorStop(0.4, '#2fc4a8');
  g.addColorStop(1, '#0b5c62');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + 9, y + 9, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x + 7, y + 13, 2.6, 2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 8.8, y + 4, 1.5, 9);
  ctx.fillRect(x + 8.8, y + 4, 4, 1.5);
}

// ---------------------------------------------------------------------------
// Window content: header strip + piano-roll flow (or energy band)

interface RollInput {
  notes: MidiNote[];     // empty → audio-only band
  loop: number;
  now: number;
  barLen: number;
  bpm: number;
  notesColor: string;
  accent: string;
  energy: number;
  isPlaying: boolean;
}

const HEADER_H = 30;
const LABEL_W = 40;

function drawHeaderStrip(ctx: CanvasRenderingContext2D, r: Rect, p: RollInput): void {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + HEADER_H);
  g.addColorStop(0, '#3c434b');
  g.addColorStop(1, '#262b31');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, HEADER_H);
  ctx.fillStyle = '#15191d';
  ctx.fillRect(r.x, r.y + HEADER_H - 1, r.w, 1);

  const ty = r.y + 5;
  let tx = r.x + 10;
  // Play state lamp.
  ctx.fillStyle = p.isPlaying ? '#3ccf6e' : '#5b6168';
  ctx.beginPath();
  ctx.moveTo(tx + 4, ty + 4); ctx.lineTo(tx + 14, ty + 10); ctx.lineTo(tx + 4, ty + 16); ctx.closePath();
  ctx.fill();
  tx += 26;

  // BPM LCD.
  ctx.fillStyle = '#15191d';
  ctx.fillRect(tx, ty, 78, 20);
  ctx.strokeStyle = '#596068';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx + 0.5, ty + 0.5, 77, 19);
  ctx.fillStyle = '#e9edf0';
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.bpm.toFixed(3), tx + 72, ty + 11);
  ctx.textAlign = 'left';
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = '#9aa3ab';
  ctx.fillText('BPM', tx + 84, ty + 11);
  tx += 116;

  // Song position (bar:beat).
  const bar = Math.floor(p.now / p.barLen) + 1;
  const beat = Math.floor((p.now % p.barLen) / (p.barLen / 4)) + 1;
  ctx.fillStyle = '#15191d';
  ctx.fillRect(tx, ty, 64, 20);
  ctx.fillStyle = '#ffb347';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${bar}:${String(beat).padStart(2, '0')}`, tx + 32, ty + 11);
}

/** Calls fn for each copy of [t0, t1) (shifted by ±loop) that overlaps the visible time span. */
function forEachWrap(t0: number, t1: number, view0: number, view1: number, loop: number, fn: (a: number, b: number) => void): void {
  for (const off of [-loop, 0, loop]) {
    const a = t0 + off;
    const b = t1 + off;
    if (b > view0 && a < view1) fn(a, b);
  }
}

function drawPianoRoll(ctx: CanvasRenderingContext2D, area: Rect, p: RollInput, xOf: (t: number) => number, view0: number, view1: number): void {
  const range = rangeFor(p.notes);
  const rows = range.high - range.low + 1;
  const rowH = area.h / rows;
  const yOf = (midi: number): number => area.y + (range.high - midi) * rowH;

  // Row shading (black keys darker) + compact pitch labels.
  ctx.font = `${Math.max(8, Math.min(11, rowH * 0.75))}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const everyRow = rowH >= 11; // label every row when there is room, else only the Cs
  for (let m = range.low; m <= range.high; m++) {
    const y = yOf(m);
    const black = NOTE_NAMES[((m % 12) + 12) % 12].length > 1;
    ctx.fillStyle = black ? '#23272c' : '#2c3136';
    ctx.fillRect(area.x, y, area.w, rowH);
    if (m % 12 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(area.x, y + rowH - 1, area.w, 1);
    }
    ctx.fillStyle = black ? '#2b3036' : '#3a4047';
    ctx.fillRect(area.x - LABEL_W, y, LABEL_W, rowH);
    if (everyRow || m % 12 === 0) {
      ctx.fillStyle = m % 12 === 0 ? '#e3e8ec' : '#8f98a1';
      ctx.fillText(noteName(m), area.x - 5, y + rowH / 2);
    }
  }

  // Grid and notes stay inside the roll so they never scroll over the label column.
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();

  // Bar / beat grid.
  const beatLen = p.barLen / 4;
  for (let k = Math.floor(view0 / beatLen); k * beatLen <= view1; k++) {
    ctx.fillStyle = k % 4 === 0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)';
    ctx.fillRect(Math.round(xOf(k * beatLen)), area.y, 1, area.h);
  }

  // Notes: dimmed when idle, full colour + glow while playing.
  const barH = Math.max(2, rowH - 2);
  ctx.font = `bold ${Math.max(8, Math.min(11, barH - 2))}px ${FONT}`;
  ctx.textAlign = 'left';
  for (const n of p.notes) {
    forEachWrap(n.time, n.time + n.duration, view0, view1, p.loop, (a, b) => {
      const x0 = xOf(a);
      const w = Math.max(3, xOf(b) - x0 - 1);
      const y = yOf(n.midi) + (rowH - barH) / 2;
      const active = p.now >= a && p.now < b;
      ctx.globalAlpha = active ? 1 : 0.55;
      ctx.fillStyle = p.notesColor;
      if (active) {
        ctx.shadowColor = p.notesColor;
        ctx.shadowBlur = 12;
      }
      ctx.fillRect(x0, y, w, barH);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0, y, w, Math.max(1, barH * 0.3));
      if (barH >= 10) {
        const label = noteName(n.midi);
        if (ctx.measureText(label).width + 6 <= w) {
          ctx.fillStyle = active ? '#0b1830' : 'rgba(8, 16, 30, 0.85)';
          ctx.fillText(label, x0 + 3, y + barH / 2 + 0.5);
        }
      }
    });
  }
  ctx.restore();
}

function drawEnergyBand(
  ctx: CanvasRenderingContext2D, area: Rect, p: RollInput, xOf: (t: number) => number, view0: number, view1: number,
  analysis: ModelDrawContext['analysis'],
): void {
  if (energyLoop !== p.loop) {
    energyBins = new Float32Array(ENERGY_BINS);
    energyLoop = p.loop;
  }
  const bin = Math.min(ENERGY_BINS - 1, Math.floor((p.now / p.loop) * ENERGY_BINS));
  if (p.isPlaying) energyBins[bin] = p.energy;

  ctx.fillStyle = '#2a2f34';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  const mid = area.y + area.h / 2;
  const maxHalf = area.h * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(area.x, mid, area.w, 1);

  const binLen = p.loop / ENERGY_BINS;
  ctx.fillStyle = p.notesColor;
  for (let i = 0; i < ENERGY_BINS; i++) {
    forEachWrap(i * binLen, (i + 1) * binLen, view0, view1, p.loop, (a, b) => {
      const x0 = xOf(a);
      const half = Math.max(0.5, energyBins[i] * maxHalf);
      ctx.globalAlpha = a <= p.now ? 0.85 : 0.35;
      ctx.fillRect(x0, mid - half, Math.max(1, xOf(b) - x0 - 1), half * 2);
    });
  }
  ctx.globalAlpha = 1;

  // Live scope just behind the playhead.
  const wave = analysis?.waveform;
  if (wave && wave.length > 0) {
    const sw = Math.min(120, area.w * 0.15);
    const sx = xOf(p.now) - sw;
    const step = Math.max(1, Math.floor(wave.length / 90));
    const count = wave.length / step;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0, k = 0; i < wave.length; i += step, k++) {
      const x = sx + (k / count) * sw;
      const y = mid + ((wave[i] - 128) / 128) * maxHalf;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawWindowContent(ctx: CanvasRenderingContext2D, inner: Rect, p: RollInput, analysis: ModelDrawContext['analysis']): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  ctx.fillStyle = '#2b2f33';
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  drawHeaderStrip(ctx, inner, p);

  const hasNotes = p.notes.length > 0;
  const left = hasNotes ? LABEL_W : 0;
  const area: Rect = { x: inner.x + left, y: inner.y + HEADER_H, w: inner.w - left, h: inner.h - HEADER_H };
  const span = p.barLen * VISIBLE_BARS;
  const view0 = p.now - span * PLAYHEAD_AT;
  const view1 = view0 + span;
  const xOf = (t: number): number => area.x + ((t - view0) / span) * area.w;

  if (hasNotes) drawPianoRoll(ctx, area, p, xOf, view0, view1);
  else drawEnergyBand(ctx, area, p, xOf, view0, view1, analysis);

  // Playhead.
  const px = Math.round(xOf(p.now));
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.moveTo(px - 6, area.y); ctx.lineTo(px + 6, area.y); ctx.lineTo(px, area.y + 8); ctx.closePath();
  ctx.fill();
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 8;
  ctx.fillRect(px - 1, area.y, 2, area.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// CRT / VHS pass

function getScanPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (scanPattern || typeof document === 'undefined') return scanPattern;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 3;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = 'rgba(0,0,0,1)';
  g.fillRect(0, 2, 1, 1);
  scanPattern = ctx.createPattern(c, 'repeat');
  return scanPattern;
}

/** Cheap colour fringe: the window outline stroked again, red nudged right and blue nudged left (additive, low alpha). */
function drawEdgeFringe(ctx: CanvasRenderingContext2D, win: Rect, shift: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (const [tint, dx] of [['rgba(255, 40, 40, 0.35)', shift], ['rgba(40, 80, 255, 0.35)', -shift]] as const) {
    ctx.strokeStyle = tint;
    rr(ctx, { x: win.x + dx, y: win.y, w: win.w, h: win.h }, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrtPass(ctx: CanvasRenderingContext2D, r: Rect, win: Rect, t: number, energy: number): void {
  drawEdgeFringe(ctx, win, 1.5 + energy * 2);

  ctx.save();
  const pattern = getScanPattern(ctx);
  if (pattern) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pattern;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }

  // Rolling VHS tracking band.
  const bandY = r.y + ((t * 60) % (r.h + 120)) - 60;
  const band = ctx.createLinearGradient(0, bandY - 30, 0, bandY + 30);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(200,220,255,0.06)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(r.x, bandY - 30, r.w, 60);

  // Flicker tied to audio energy.
  const flicker = (0.5 + 0.5 * Math.sin(t * 47)) * (0.012 + energy * 0.035);
  ctx.fillStyle = `rgba(210, 225, 255, ${flicker})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Vignette.
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const vig = ctx.createRadialGradient(cx, cy, Math.min(r.w, r.h) * 0.35, cx, cy, Math.hypot(r.w, r.h) * 0.58);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,4,16,0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------

export function drawAeroDesktop(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, currentTime, loopTime, duration, midi, settings, analysis } = context;
  const r: Rect = { x: region.x, y: region.y, w: region.width, h: region.height };
  const bpm = settings.bpm > 0 ? settings.bpm : (midi?.bpm || 120);
  const barLen = 240 / bpm;
  const loop = duration > 0 ? duration : (midi?.duration || barLen * 4);
  const now = ((loopTime % loop) + loop) % loop;
  const energy = clamp01(((analysis?.bass ?? 0) * 0.6 + (analysis?.rms ?? 0) * 0.4) * (settings.audioSensitivity || 1));
  // Audio view (or no MIDI) shows the single energy band instead of the note flow
  const notes = context.albumView === 'midi' ? midi?.notes ?? NO_NOTES : NO_NOTES;
  const title = settings.title?.trim() || 'Untitled';

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  drawWallpaper(ctx, r, currentTime, energy);

  // One large centred window filling most of the frame.
  const winW = Math.round(r.w * 0.9);
  const winH = Math.round(r.h * 0.84);
  const win: Rect = { x: r.x + Math.round((r.w - winW) / 2), y: r.y + Math.round((r.h - winH) / 2), w: winW, h: winH };
  const inner = drawGlassWindow(ctx, win, title, (x, y) => drawAppIcon(ctx, x, y));
  drawWindowContent(ctx, inner, {
    notes, loop, now, barLen, bpm,
    notesColor: settings.notesColor || '#7fd1ff',
    accent: '#ff3b2f',
    energy,
    isPlaying: currentTime > 0,
  }, analysis);

  drawCrtPass(ctx, r, win, currentTime, energy);
  ctx.restore();
}

export default { draw: drawAeroDesktop } satisfies ModeModule;
