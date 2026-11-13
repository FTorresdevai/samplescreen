import type { AudioAnalysis, ModelDrawContext, ModelRegion, ModeModule, VisualizerSettings } from '../../../types';
import { hexToRgb } from '../../../engine/palettes';

/**
 * Night Scope: audio-only phosphor CRT measuring instrument.
 *   - Triggered oscilloscope trace of `analysis.waveform` with phosphor afterglow
 *     (offscreen buffer faded by a translucent fill each frame; no getImageData).
 *   - Graticule (10 × 8 divisions, minor ticks on the centre axes).
 *   - Log-frequency spectrum trace with peak hold and a marker on the dominant bin.
 *   - Numeric readouts: BPM, RMS / peak dBFS (from the waveform bytes), dominant
 *     frequency (parabolic peak of the fft bytes), elapsed time, title.
 * Phosphor is green or amber, picked from the palette's notesColor hue.
 * Perf: per-canvas state holds the afterglow buffer, spectrum arrays and gradients;
 * the frame loop only writes into preallocated typed arrays and strokes single paths.
 */

const MONO = '"JetBrains Mono", ui-monospace, monospace';
/** Analyser bins are always from a 2048-point FFT (realtime and offline); 44.1 kHz assumed. */
const SAMPLE_RATE = 44100;
const BIN_HZ = SAMPLE_RATE / 2048;
const DIV_X = 10;
const DIV_Y = 8;
const SPEC_POINTS = 160;
const SPEC_MIN_HZ = 30;
const SPEC_MAX_HZ = 16000;
const DB_FLOOR = -60;

export interface Rect { x: number; y: number; w: number; h: number }

export interface ScopeLayout {
  body: Rect;      // instrument housing (minimal bezel)
  screen: Rect;    // CRT face
  header: Rect;    // title / channel line inside the screen
  scope: Rect;     // oscilloscope graticule
  spectrum: Rect;  // secondary spectrum readout
  readouts: Rect;  // numeric readout block
}

/** Instrument layout inside the mode region. Pure, so it can be unit-tested. */
export function scopeLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): ScopeLayout {
  const pad = Math.round(Math.min(region.width, region.height) * 0.035);
  const body: Rect = { x: region.x + pad, y: region.y + pad, w: region.width - pad * 2, h: region.height - pad * 2 };
  const bezel = Math.round(Math.min(body.w, body.h) * 0.03);
  const screen: Rect = { x: body.x + bezel, y: body.y + bezel, w: body.w - bezel * 2, h: body.h - bezel * 2 };

  const inset = Math.round(Math.min(screen.w, screen.h) * 0.045);
  const gap = Math.round(inset * 0.6);
  const ix = screen.x + inset;
  const iw = screen.w - inset * 2;
  const ih = screen.h - inset * 2;
  const portrait = screen.h > screen.w;

  const headerH = Math.round(ih * (portrait ? 0.07 : 0.1));
  const readH = Math.round(ih * 0.2);
  const specH = Math.round(ih * (portrait ? 0.17 : 0.2));
  let y = screen.y + inset;
  const header: Rect = { x: ix, y, w: iw, h: headerH };
  y += headerH + gap;
  const scopeH = ih - headerH - specH - readH - gap * 3;
  const scope: Rect = { x: ix, y, w: iw, h: scopeH };
  y += scopeH + gap;
  const spectrum: Rect = { x: ix, y, w: iw, h: specH };
  y += specH + gap;
  const readouts: Rect = { x: ix, y, w: iw, h: screen.y + inset + ih - y };
  return { body, screen, header, scope, spectrum, readouts };
}

// ---------- phosphor colour ----------

interface Phosphor {
  key: string;
  trace: string;     // bright core
  halo: string;      // wide soft stroke under the core
  text: string;
  dim: string;
  grid: string;
  gridStrong: string;
  ghost: string;     // unlit segment digits
  screen: string;
  fade: string;      // afterglow fade fill (screen colour, translucent)
  body: string;
  bodyEdge: string;
}

/** Green when the palette's note colour leans green/teal, amber otherwise (and for greys). */
export function phosphorHue(notesColor: string): number {
  const { r, g, b } = hexToRgb(notesColor || '#e69d45');
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.15) return 38;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 75 && h <= 200 ? 138 : 38;
}

function makePhosphor(settings: Pick<VisualizerSettings, 'notesColor'>, fadeAlpha: number): Phosphor {
  const h = phosphorHue(settings.notesColor);
  const sat = h === 38 ? 95 : 85;
  return {
    key: `${h}|${fadeAlpha.toFixed(2)}`,
    trace: `hsl(${h}, ${sat}%, 66%)`,
    halo: `hsla(${h}, ${sat}%, 55%, 0.22)`,
    text: `hsl(${h}, ${sat}%, 64%)`,
    dim: `hsla(${h}, ${sat - 20}%, 58%, 0.55)`,
    grid: `hsla(${h}, 60%, 50%, 0.13)`,
    gridStrong: `hsla(${h}, 60%, 55%, 0.32)`,
    ghost: `hsla(${h}, 50%, 50%, 0.08)`,
    screen: `hsl(${h}, 30%, 4%)`,
    fade: `hsla(${h}, 30%, 4%, ${fadeAlpha.toFixed(2)})`,
    body: `hsl(${h}, 6%, 9%)`,
    bodyEdge: `hsl(${h}, 6%, 18%)`,
  };
}

// ---------- per-canvas state ----------

interface ScopeState {
  glow: HTMLCanvasElement | null;
  glowCtx: CanvasRenderingContext2D | null;
  glowKey: string;
  lastTime: number;
  specBins: Float32Array;   // fractional fft bin per spectrum point
  specHold: Float32Array;   // peak hold, 0..1
  specBinsLen: number;
  rmsDb: number;
  peakDb: number;
  vignette: CanvasGradient | null;
  vignetteKey: string;
  phosphor: Phosphor | null;
}

const states = new WeakMap<object, ScopeState>();

function stateFor(ctx: CanvasRenderingContext2D): ScopeState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) {
    s = {
      glow: null, glowCtx: null, glowKey: '', lastTime: -1,
      specBins: new Float32Array(SPEC_POINTS), specHold: new Float32Array(SPEC_POINTS), specBinsLen: 0,
      rmsDb: DB_FLOOR, peakDb: DB_FLOOR, vignette: null, vignetteKey: '', phosphor: null,
    };
    states.set(key, s);
  }
  return s;
}

// ---------- measurements (pure) ----------

/** RMS and peak of the waveform bytes in dBFS, floored at DB_FLOOR. */
export function levelsDb(wave: Uint8Array): { rmsDb: number; peakDb: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < wave.length; i++) {
    const v = (wave[i] - 128) / 128;
    sum += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  const rms = wave.length ? Math.sqrt(sum / wave.length) : 0;
  const toDb = (x: number): number => (x > 0 ? Math.max(DB_FLOOR, 20 * Math.log10(x)) : DB_FLOOR);
  return { rmsDb: toDb(rms), peakDb: toDb(peak) };
}

/** Dominant frequency in Hz from fft bytes (parabolic peak), or 0 when the spectrum is quiet. */
export function dominantHz(fft: Uint8Array): number {
  const end = Math.min(fft.length - 1, Math.floor(SPEC_MAX_HZ / BIN_HZ));
  let best = 0;
  let k = -1;
  for (let i = 2; i < end; i++) {
    if (fft[i] > best) { best = fft[i]; k = i; }
  }
  if (k < 0 || best < 48) return 0;
  const a = fft[k - 1];
  const b = fft[k];
  const c = fft[k + 1];
  const den = a - 2 * b + c;
  const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return (k + Math.max(-0.5, Math.min(0.5, delta))) * BIN_HZ;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteName(hz: number): string {
  const n = Math.round(12 * Math.log2(hz / 440)) + 69;
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

function formatHz(hz: number): string {
  if (hz <= 0) return '----';
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)}k` : hz.toFixed(0);
}

function formatDb(db: number): string {
  return db <= DB_FLOOR ? '-inf' : db.toFixed(1);
}

function formatClock(t: number): string {
  const total = Math.max(0, t);
  const m = Math.floor(total / 60);
  const s = Math.floor(total - m * 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${cs < 10 ? '0' : ''}${cs}`;
}

// ---------- drawing ----------

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, rad: number): void {
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

function drawGraticule(ctx: CanvasRenderingContext2D, r: Rect, divX: number, divY: number, ph: Phosphor): void {
  const dx = r.w / divX;
  const dy = r.h / divY;
  ctx.lineWidth = 1;
  ctx.strokeStyle = ph.grid;
  ctx.beginPath();
  for (let i = 1; i < divX; i++) {
    const x = Math.round(r.x + i * dx) + 0.5;
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  for (let j = 1; j < divY; j++) {
    const y = Math.round(r.y + j * dy) + 0.5;
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  ctx.stroke();

  // Centre axes with 5 minor ticks per division, plus the outer frame.
  ctx.strokeStyle = ph.gridStrong;
  ctx.beginPath();
  const cx = Math.round(r.x + (divX / 2) * dx) + 0.5;
  const cy = Math.round(r.y + (divY / 2) * dy) + 0.5;
  const tick = Math.max(3, Math.round(Math.min(dx, dy) * 0.08));
  for (let i = 1; i < divX * 5; i++) {
    const x = Math.round(r.x + (i * dx) / 5) + 0.5;
    const t = i % 5 === 0 ? tick * 2 : tick;
    ctx.moveTo(x, cy - t);
    ctx.lineTo(x, cy + t);
  }
  for (let j = 1; j < divY * 5; j++) {
    const y = Math.round(r.y + (j * dy) / 5) + 0.5;
    const t = j % 5 === 0 ? tick * 2 : tick;
    ctx.moveTo(cx - t, y);
    ctx.lineTo(cx + t, y);
  }
  ctx.rect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
  ctx.stroke();
}

/** Rising-edge trigger near the start; returns -1 when no crossing (free-run). */
function findTrigger(wave: Uint8Array, span: number): number {
  const limit = wave.length - span;
  for (let i = 1; i < limit; i++) {
    if (wave[i - 1] < 128 && wave[i] >= 128) return i;
  }
  return -1;
}

/** Afterglow buffer sized to the scope rect in device pixels; recreated when size/colour changes. */
function glowBuffer(s: ScopeState, r: Rect, scale: number, ph: Phosphor): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const w = Math.max(1, Math.ceil(r.w * scale));
  const h = Math.max(1, Math.ceil(r.h * scale));
  const key = `${w}x${h}|${ph.screen}`;
  if (!s.glow || s.glowKey !== key) {
    s.glow = s.glow ?? document.createElement('canvas');
    s.glow.width = w;
    s.glow.height = h;
    s.glowCtx = s.glow.getContext('2d');
    s.glowKey = key;
    if (s.glowCtx) {
      s.glowCtx.fillStyle = ph.screen;
      s.glowCtx.fillRect(0, 0, w, h);
    }
  }
  return s.glowCtx;
}

function strokeTrace(g: CanvasRenderingContext2D, wave: Uint8Array, start: number, span: number, w: number, h: number, gain: number): void {
  const half = h / 2;
  const amp = half * 0.92 * gain;
  const step = w / (span - 1);
  g.beginPath();
  for (let i = 0; i < span; i++) {
    let v = ((wave[start + i] - 128) / 128) * amp;
    if (v > half) v = half; else if (v < -half) v = -half;
    if (i === 0) g.moveTo(0, half - v);
    else g.lineTo(i * step, half - v);
  }
}

function drawScope(ctx: CanvasRenderingContext2D, s: ScopeState, r: Rect, a: AudioAnalysis, gain: number, scale: number, ph: Phosphor, triggered: { on: boolean }): void {
  const wave = a.waveform;
  const span = Math.max(2, Math.floor(wave.length / 2));
  const trig = findTrigger(wave, span);
  triggered.on = trig >= 0;
  const start = trig >= 0 ? trig : 0;

  const g = glowBuffer(s, r, scale, ph);
  if (g) {
    const w = g.canvas.width;
    const h = g.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = ph.fade;
    g.fillRect(0, 0, w, h);
    g.lineJoin = 'round';
    strokeTrace(g, wave, start, span, w, h, gain);
    g.strokeStyle = ph.halo;
    g.lineWidth = 6 * scale;
    g.stroke();
    g.strokeStyle = ph.trace;
    g.lineWidth = 1.6 * scale;
    g.stroke();
    ctx.drawImage(g.canvas, r.x, r.y, r.w, r.h);
  } else {
    // No DOM (tests / headless): draw the live trace without afterglow.
    ctx.save();
    ctx.translate(r.x, r.y);
    strokeTrace(ctx, wave, start, span, r.w, r.h, gain);
    ctx.strokeStyle = ph.trace;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
  drawGraticule(ctx, r, DIV_X, DIV_Y, ph);
}

function ensureSpecBins(s: ScopeState, fftLen: number): void {
  if (s.specBinsLen === fftLen) return;
  const maxBin = fftLen - 2;
  const lo = Math.log(SPEC_MIN_HZ);
  const hi = Math.log(SPEC_MAX_HZ);
  for (let i = 0; i < SPEC_POINTS; i++) {
    const hz = Math.exp(lo + ((hi - lo) * i) / (SPEC_POINTS - 1));
    s.specBins[i] = Math.min(maxBin, hz / BIN_HZ);
  }
  s.specHold.fill(0);
  s.specBinsLen = fftLen;
}

function hzToX(r: Rect, hz: number): number {
  const lo = Math.log(SPEC_MIN_HZ);
  const hi = Math.log(SPEC_MAX_HZ);
  return r.x + ((Math.log(hz) - lo) / (hi - lo)) * r.w;
}

const SPEC_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const SPEC_TICK_LABELS = ['50', '100', '200', '500', '1k', '2k', '5k', '10k'];

function drawSpectrum(ctx: CanvasRenderingContext2D, s: ScopeState, r: Rect, a: AudioAnalysis, hz: number, holdDecay: number, ph: Phosphor, labelPx: number): void {
  const fft = a.fft;
  ensureSpecBins(s, fft.length);

  // Graticule: 4 level divisions, decade-ish frequency lines.
  ctx.lineWidth = 1;
  ctx.strokeStyle = ph.grid;
  ctx.beginPath();
  for (let j = 1; j < 4; j++) {
    const y = Math.round(r.y + (j * r.h) / 4) + 0.5;
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  for (let i = 0; i < SPEC_TICKS.length; i++) {
    const x = Math.round(hzToX(r, SPEC_TICKS[i])) + 0.5;
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  ctx.stroke();
  ctx.strokeStyle = ph.gridStrong;
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);

  // Live trace (filled softly) + peak hold line.
  const step = r.w / (SPEC_POINTS - 1);
  const base = r.y + r.h;
  ctx.beginPath();
  ctx.moveTo(r.x, base);
  for (let i = 0; i < SPEC_POINTS; i++) {
    const bin = s.specBins[i];
    const k = Math.floor(bin);
    const f = bin - k;
    const v = (fft[k] * (1 - f) + fft[k + 1] * f) / 255;
    const hold = s.specHold[i] * holdDecay;
    s.specHold[i] = v > hold ? v : hold;
    ctx.lineTo(r.x + i * step, base - v * r.h * 0.94);
  }
  ctx.lineTo(r.x + r.w, base);
  ctx.closePath();
  ctx.fillStyle = ph.halo;
  ctx.fill();
  ctx.strokeStyle = ph.trace;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < SPEC_POINTS; i++) {
    const y = base - s.specHold[i] * r.h * 0.94;
    if (i === 0) ctx.moveTo(r.x, y);
    else ctx.lineTo(r.x + i * step, y);
  }
  ctx.strokeStyle = ph.dim;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dominant-frequency marker.
  if (hz >= SPEC_MIN_HZ && hz <= SPEC_MAX_HZ) {
    const x = hzToX(r, hz);
    const m = Math.max(4, labelPx * 0.5);
    ctx.fillStyle = ph.trace;
    ctx.beginPath();
    ctx.moveTo(x, r.y + m * 1.4);
    ctx.lineTo(x - m, r.y);
    ctx.lineTo(x + m, r.y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.font = `500 ${labelPx}px ${MONO}`;
  ctx.fillStyle = ph.dim;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  for (let i = 0; i < SPEC_TICKS.length; i++) {
    ctx.fillText(SPEC_TICK_LABELS[i], hzToX(r, SPEC_TICKS[i]), base - 3);
  }
}

/** One readout cell: small label, large segment-style value over unlit "8" ghosts. */
function readout(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, unit: string, ghost: string, valuePx: number, ph: Phosphor): void {
  const labelPx = Math.max(9, Math.round(valuePx * 0.3));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${labelPx}px ${MONO}`;
  ctx.fillStyle = ph.dim;
  ctx.fillText(label, x, y);

  const vy = y + labelPx * 1.5;
  ctx.font = `700 ${valuePx}px ${MONO}`;
  ctx.fillStyle = ph.ghost;
  ctx.fillText(ghost, x, vy);
  ctx.fillStyle = ph.text;
  // Right-align the value inside the ghost field, like a fixed-width display.
  const pad = ghost.length - value.length;
  const cw = ctx.measureText('8').width;
  ctx.fillText(value, x + Math.max(0, pad) * cw, vy);

  ctx.font = `600 ${labelPx}px ${MONO}`;
  ctx.fillStyle = ph.dim;
  ctx.fillText(unit, x + ghost.length * cw + labelPx * 0.4, vy + valuePx - labelPx * 1.1);
}

/** Segmented bar meter from DB_FLOOR to 0 dBFS. */
function levelBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rmsDb: number, peakDb: number, ph: Phosphor): void {
  const segs = 30;
  const gap = Math.max(1, w / segs * 0.25);
  const sw = w / segs - gap;
  const lit = Math.round(((rmsDb - DB_FLOOR) / -DB_FLOOR) * segs);
  const peakSeg = Math.min(segs - 1, Math.round(((peakDb - DB_FLOOR) / -DB_FLOOR) * segs));
  ctx.fillStyle = ph.ghost;
  for (let i = 0; i < segs; i++) ctx.fillRect(x + i * (sw + gap), y, sw, h);
  ctx.fillStyle = ph.trace;
  for (let i = 0; i < lit; i++) ctx.fillRect(x + i * (sw + gap), y, sw, h);
  if (peakDb > DB_FLOOR) ctx.fillRect(x + peakSeg * (sw + gap), y, sw, h);
}

function drawReadouts(ctx: CanvasRenderingContext2D, r: Rect, s: ScopeState, bpm: number, hz: number, t: number, ph: Phosphor): void {
  ctx.strokeStyle = ph.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, Math.round(r.y) + 0.5);
  ctx.lineTo(r.x + r.w, Math.round(r.y) + 0.5);
  ctx.stroke();

  const cols = r.w > r.h * 4.5 ? 5 : 3;
  const rows = cols === 5 ? 1 : 2;
  const cw = r.w / cols;
  const rh = (r.h - r.h * 0.18) / rows;
  const valuePx = Math.max(14, Math.min(cw / 6.4, rh * 0.5));
  const top = r.y + r.h * 0.1;

  const cells: Array<[string, string, string, string]> = [
    ['BPM', bpm > 0 ? bpm.toFixed(0) : '---', '', '888'],
    ['FREQ', formatHz(hz), hz > 0 ? `Hz ${noteName(hz)}` : 'Hz', '8888'],
    ['T+', formatClock(t), '', '88:88.88'],
    ['RMS', formatDb(s.rmsDb), 'dBFS', '-88.8'],
    ['PEAK', formatDb(s.peakDb), 'dBFS', '-88.8'],
  ];
  for (let i = 0; i < cells.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const c = cells[i];
    readout(ctx, r.x + col * cw, top + row * rh, c[0], c[1], c[2], c[3], valuePx, ph);
  }

  // Level meter fills the last free cell (portrait) or runs under the row (landscape).
  const labelPx = Math.max(9, Math.round(valuePx * 0.3));
  if (cols === 3) {
    const x = r.x + 2 * cw;
    const y = top + rh;
    ctx.font = `600 ${labelPx}px ${MONO}`;
    ctx.fillStyle = ph.dim;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LEVEL', x, y);
    levelBar(ctx, x, y + labelPx * 1.5 + valuePx * 0.2, cw * 0.88, valuePx * 0.6, s.rmsDb, s.peakDb, ph);
  } else {
    levelBar(ctx, r.x, r.y + r.h - labelPx, r.w, labelPx * 0.6, s.rmsDb, s.peakDb, ph);
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, r: Rect, title: string, sens: number, triggered: boolean, ph: Phosphor): void {
  const px = Math.max(10, Math.round(r.h * 0.28));
  const titlePx = Math.max(13, Math.round(r.h * 0.42));
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `600 ${px}px ${MONO}`;
  ctx.fillStyle = ph.dim;
  ctx.fillText('NIGHT SCOPE  CH1', r.x, r.y);
  ctx.font = `700 ${titlePx}px ${MONO}`;
  ctx.fillStyle = ph.text;
  ctx.fillText((title || 'UNTITLED').toUpperCase(), r.x, r.y + px * 1.4, r.w * 0.62);

  ctx.textAlign = 'right';
  ctx.font = `600 ${px}px ${MONO}`;
  ctx.fillStyle = triggered ? ph.text : ph.dim;
  ctx.fillText(triggered ? 'TRIG ▲' : 'AUTO', r.x + r.w, r.y);
  ctx.fillStyle = ph.dim;
  ctx.fillText(`GAIN x${sens.toFixed(1)}`, r.x + r.w, r.y + px * 1.4);
}

export function drawNightScope(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime } = context;
  const sens = settings.audioSensitivity || 1.2;
  const L = scopeLayout(region);
  const s = stateFor(ctx);

  // Time-based afterglow: ~120 ms decay; a jump (seek, loop wrap) clears the buffer.
  let dt = s.lastTime < 0 ? 0 : currentTime - s.lastTime;
  if (dt < 0 || dt > 0.5) {
    s.glowKey = '';
    s.specHold.fill(0);
    dt = 0;
  }
  s.lastTime = currentTime;
  const fadeAlpha = Math.round(Math.min(1, Math.max(0.12, 1 - Math.exp(-dt / 0.12))) * 50) / 50;
  if (!s.phosphor || s.phosphor.key !== `${phosphorHue(settings.notesColor)}|${fadeAlpha.toFixed(2)}`) {
    s.phosphor = makePhosphor(settings, fadeAlpha);
  }
  const ph = s.phosphor;

  const lv = levelsDb(analysis.waveform);
  const k = 0.35;
  s.rmsDb += (lv.rmsDb - s.rmsDb) * k;
  s.peakDb = lv.peakDb > s.peakDb ? lv.peakDb : s.peakDb + (lv.peakDb - s.peakDb) * 0.12;
  const hz = dominantHz(analysis.fft);

  let scale = 1;
  if (typeof ctx.getTransform === 'function') scale = Math.max(1, Math.abs(ctx.getTransform().a));

  ctx.save();
  // Surround keeps the page background; the instrument sits on it.
  ctx.fillStyle = settings.bgColor || '#141113';
  ctx.fillRect(region.x, region.y, region.width, region.height);

  const bodyRad = Math.min(L.body.w, L.body.h) * 0.03;
  ctx.fillStyle = ph.body;
  roundRect(ctx, L.body, bodyRad);
  ctx.fill();
  ctx.strokeStyle = ph.bodyEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  const scrRad = bodyRad * 0.7;
  ctx.fillStyle = ph.screen;
  roundRect(ctx, L.screen, scrRad);
  ctx.fill();

  ctx.save();
  roundRect(ctx, L.screen, scrRad);
  ctx.clip();

  const triggered = { on: false };
  drawScope(ctx, s, L.scope, analysis, sens, scale, ph, triggered);
  const labelPx = Math.max(9, Math.round(L.spectrum.h * 0.09));
  drawSpectrum(ctx, s, L.spectrum, analysis, hz, Math.exp(-Math.max(dt, 1 / 60) / 0.8), ph, labelPx);
  drawHeader(ctx, L.header, settings.title, sens, triggered.on, ph);
  drawReadouts(ctx, L.readouts, s, settings.bpm, hz, currentTime, ph);

  // Scope scale labels: timebase from the waveform window length.
  ctx.font = `500 ${labelPx}px ${MONO}`;
  ctx.fillStyle = ph.dim;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const span = Math.max(2, Math.floor(analysis.waveform.length / 2));
  const msDiv = ((span / SAMPLE_RATE) * 1000) / DIV_X;
  ctx.fillText(`${msDiv.toFixed(2)} ms/div`, L.scope.x + 6, L.scope.y + L.scope.h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('LOG 30 Hz – 16 kHz', L.spectrum.x + L.spectrum.w - 6, L.spectrum.y + labelPx + 6);

  // CRT vignette, cached per screen size and colour.
  const vKey = `${L.screen.x},${L.screen.y},${L.screen.w},${L.screen.h}|${ph.screen}`;
  if (!s.vignette || s.vignetteKey !== vKey) {
    const cx = L.screen.x + L.screen.w / 2;
    const cy = L.screen.y + L.screen.h / 2;
    const v = ctx.createRadialGradient(cx, cy, Math.min(L.screen.w, L.screen.h) * 0.35, cx, cy, Math.hypot(L.screen.w, L.screen.h) * 0.55);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    s.vignette = v;
    s.vignetteKey = vKey;
  }
  ctx.fillStyle = s.vignette;
  ctx.fillRect(L.screen.x, L.screen.y, L.screen.w, L.screen.h);
  ctx.restore();

  ctx.restore();
}

export default { draw: drawNightScope } satisfies ModeModule;
