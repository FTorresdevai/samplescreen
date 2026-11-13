import { MidiNote, ModelDrawContext, ModeModule, ParsedMidi } from '../../../types';
import { detectChord, formatNoteName } from '../../../engine/chords';
import { hexToRgbaStr } from '../../../engine/palettes';
import { roundRect } from '../../../shared/canvas-utils';
import { ACCENT, drawKeytar, KeytarReadout, LitKey } from './keytar';

/**
 * Pocket Keys 86: an original mid-80s keytar on a dusk-blue gridded backdrop. Its keys light
 * up in each note's colour and its green display shows the chord and BPM. Below it, a dark
 * "screen" piano roll scrolls past an accent playhead: notes are outlined before the playhead
 * and filled once played, active pitches are tagged at the left and the current chord is
 * written out underneath in the notes' colours.
 */

/** Bright register bands that read on the dark backdrop: bass teal, low-mid amber, mid coral, high periwinkle. */
const BANDS = ['#3ec6b4', '#f5b841', '#ff7a66', '#8ea7ff'];
const bandOf = (midi: number): number => (midi < 48 ? 0 : midi < 60 ? 1 : midi < 72 ? 2 : 3);
const BAND_FAINT = BANDS.map(c => hexToRgbaStr(c, 0.12));

export function noteColor(midi: number): string {
  return BANDS[bandOf(midi)];
}

const INK = '#e9ecf5';
const DARK_INK = '#11131c';
const MUTED = 'rgba(233,236,245,0.38)';
const SEAM_OFFSETS = [-1, 0, 1];
const NO_SEAM = [0];

interface WindowNote { note: MidiNote; relStart: number; relEnd: number }

// Reused every frame so the draw loop allocates nothing per note.
const pool: WindowNote[] = [];
const activeNotes: MidiNote[] = [];
const chordPitches: number[] = [];
const lastChord: number[] = [];
const lit = new Map<number, LitKey>();
const litPool: LitKey[] = [];
const readout: KeytarReadout = { main: '', sub: '' };
let loopNow = 0;
let chordSymbol = '';
let bpmLabel = '';
let bpmFor = -1;

/** Fills `pool` with notes between `past` seconds ago and `future` seconds ahead (loop-seam copies included); returns the count. */
function windowNotes(context: ModelDrawContext, past: number, future: number): number {
  const { currentTime, loopTime, duration, midi, settings, introInfo } = context;
  const hasIntro = introInfo?.hasIntro ?? introInfo?.isIntro ?? false;
  const isIntro = introInfo?.isIntro ?? false;
  const secondsPerBar = (60 / (settings.bpm || midi.bpm || 80)) * 4;
  const introDuration = introInfo?.introDuration ?? (hasIntro ? (introInfo?.totalIntroBars || 1) * secondsPerBar : 0);
  const loopDuration = duration || 16;
  const mainLoopDuration = introInfo?.mainLoopDuration ?? loopDuration;
  const now = typeof loopTime === 'number' && !isNaN(loopTime) ? loopTime : currentTime % loopDuration;
  loopNow = now;

  let count = 0;
  for (const note of midi.notes || []) {
    const inMainLoop = hasIntro && !isIntro && note.time >= introDuration;
    const period = inMainLoop ? mainLoopDuration : loopDuration;
    const offsets = !hasIntro || inMainLoop ? SEAM_OFFSETS : NO_SEAM;
    for (const k of offsets) {
      const relStart = note.time + k * period - now;
      const relEnd = relStart + note.duration;
      if (relEnd < -past || relStart > future) continue;
      const slot = pool[count] ?? (pool[count] = { note, relStart, relEnd });
      slot.note = note; slot.relStart = relStart; slot.relEnd = relEnd;
      count++;
    }
  }
  return count;
}

/** Chord line: pitches sorted low → high, joined with middle dots. */
export function chordText(pitches: number[], accidental: 'sharp' | 'flat' = 'sharp', middleC: 3 | 4 | 5 = 4): string {
  return [...new Set(pitches)].sort((a, b) => a - b).map(p => formatNoteName(p, accidental, middleC)).join(' · ');
}

const rangeCache = new WeakMap<ParsedMidi, { lo: number; hi: number; kbLo: number; kbHi: number }>();
function ranges(midi: ParsedMidi) {
  let r = rangeCache.get(midi);
  if (!r) {
    const notes = midi.notes || [];
    let lo = notes.length ? Math.min(...notes.map(n => n.midi)) : 48;
    let hi = notes.length ? Math.max(...notes.map(n => n.midi)) : 72;
    // Short keyboard: whole octaves around the notes, two to five octaves
    let kbLo = lo - (lo % 12);
    let kbHi = hi + (11 - (hi % 12));
    while (kbHi - kbLo + 1 < 24) kbHi += 12;
    while (kbHi - kbLo + 1 > 60) { kbLo += 12; if (kbHi - kbLo + 1 > 60) kbHi -= 12; }
    kbLo = Math.max(21, kbLo);
    kbHi = Math.min(108, kbHi + 1); // end on a C
    // Roll: the notes' span, one semitone of air each side, at least an octave tall
    lo -= 1; hi += 1;
    while (hi - lo < 12) { lo -= 1; hi += 1; }
    r = { lo, hi, kbLo, kbHi };
    rangeCache.set(midi, r);
  }
  return r;
}

let nameTable: string[] = [];
let nameAcc: 'sharp' | 'flat' | null = null;
let nameMid = 0;
function names(accidental: 'sharp' | 'flat', middleC: 3 | 4 | 5): string[] {
  if (nameAcc !== accidental || nameMid !== middleC) {
    nameTable = Array.from({ length: 128 }, (_, p) => formatNoteName(p, accidental, middleC));
    nameAcc = accidental;
    nameMid = middleC;
  }
  return nameTable;
}

let backdrop: HTMLCanvasElement | null = null;
let backdropW = 0;
let backdropH = 0;
/** Dusk-blue gradient with a faint square grid and a warm glow behind the instrument (cached per size). */
function backdropLayer(w: number, h: number, glowY: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (backdrop && backdropW === w && backdropH === h) return backdrop;
  const c = backdrop ?? document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d');
  if (g) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2a2f4f');
    bg.addColorStop(0.45, '#1d2139');
    bg.addColorStop(1, '#14172a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w / 2, glowY, 0, w / 2, glowY, w * 0.6);
    glow.addColorStop(0, 'rgba(240,83,47,0.16)');
    glow.addColorStop(1, 'rgba(240,83,47,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160,175,255,0.05)';
    for (let gx = 24; gx < w; gx += 32) g.fillRect(gx, 0, 1, h);
    for (let gy = 24; gy < h; gy += 32) g.fillRect(0, gy, w, 1);
  }
  backdrop = c;
  backdropW = w;
  backdropH = h;
  return c;
}

/** Keeps the display's chord symbol in sync with the sounding pitches; detectChord runs only when they change. */
function updateChordSymbol(accidental: 'sharp' | 'flat', middleC: 3 | 4 | 5) {
  let same = activeNotes.length === lastChord.length;
  for (let i = 0; same && i < activeNotes.length; i++) same = activeNotes[i].midi === lastChord[i];
  if (same) return;
  lastChord.length = 0;
  for (const n of activeNotes) lastChord.push(n.midi);
  const found = detectChord(activeNotes, accidental, middleC);
  chordSymbol = found ? found.symbol : '';
}

export function drawPocketKeys(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, midi, settings } = context;
  const { x, y, width: w, height: h } = region;
  const accidental = settings.accidental;
  const middleC = settings.middleC;
  const nameOf = names(accidental, middleC);
  const { lo, hi, kbLo, kbHi } = ranges(midi);

  // ---------- Layout ----------
  const kw = w * 0.88;
  const kh = Math.min(kw * 0.3, h * 0.24);
  const angle = -0.06;
  const ktTop = y + 28;
  const ktBlock = kh + kw * Math.sin(-angle) + 24;
  const ktCy = ktTop + ktBlock / 2;

  ctx.save();

  // ---------- Backdrop ----------
  ctx.save();
  roundRect(ctx, x, y, w, h, 18, false, false);
  ctx.clip();
  const bd = backdropLayer(w, h, ktCy - y);
  if (bd) ctx.drawImage(bd, x, y);
  else { ctx.fillStyle = '#1d2139'; ctx.fillRect(x, y, w, h); }
  ctx.restore();

  // ---------- Time window ----------
  const bpm = settings.bpm || midi.bpm || 90;
  const span = Math.max(3, Math.min(8, (240 / bpm) * 2));
  const panelX = x + 24;
  const panelW = w - 48;
  const rollLeft = panelX + 78;
  const rollRight = panelX + panelW - 14;
  const rollW = rollRight - rollLeft;
  const playX = rollLeft + rollW * 0.3;
  const pxPerSec = rollW / span;
  const past = (playX - rollLeft) / pxPerSec;
  const future = (rollRight - playX) / pxPerSec;
  const count = windowNotes(context, past, future);

  // Sounding notes, low → high, and the keys they light
  activeNotes.length = 0;
  lit.clear();
  for (let i = 0; i < count; i++) {
    const n = pool[i];
    if (n.relStart > 0 || n.relEnd < 0) continue;
    const p = n.note.midi;
    const age = -n.relStart;
    const prev = lit.get(p);
    if (!prev) {
      activeNotes.push(n.note);
      const key = litPool[p] ?? (litPool[p] = { color: '', age: 0 });
      key.color = noteColor(p);
      key.age = age;
      lit.set(p, key);
    } else if (age < prev.age) prev.age = age;
  }
  activeNotes.sort((a, b) => a.midi - b.midi);
  updateChordSymbol(accidental, middleC);

  // ---------- Keytar ----------
  if (bpm !== bpmFor) { bpmLabel = `BPM ${Math.round(bpm)}`; bpmFor = bpm; }
  readout.main = chordSymbol;
  readout.sub = bpmLabel;
  drawKeytar(ctx, { cx: Math.round(x + w / 2), cy: Math.round(ktCy), w: Math.round(kw), h: Math.round(kh), angle, lo: kbLo, hi: kbHi }, lit, readout);

  // ---------- Roll panel ----------
  const panelTop = ktTop + ktBlock + 20;
  const panelBottom = y + h - 128;
  const rollTop = panelTop + 22;
  const rollBottom = panelBottom - 14;
  const rows = hi - lo + 1;
  const rowH = (rollBottom - rollTop) / rows;
  const rowY = (p: number) => rollTop + (hi - p + 0.5) * rowH;

  ctx.fillStyle = 'rgba(8,10,22,0.62)';
  roundRect(ctx, panelX, panelTop, panelW, panelBottom - panelTop, 14, true, false);
  ctx.strokeStyle = 'rgba(160,175,255,0.14)';
  ctx.lineWidth = 1;
  roundRect(ctx, panelX + 0.5, panelTop + 0.5, panelW - 1, panelBottom - panelTop - 1, 14, false, true);
  // Accent tab at the top-left of the panel, echoing the keytar's stripe
  ctx.fillStyle = ACCENT;
  ctx.fillRect(panelX + 18, panelTop, 46, 3);

  // Lanes: black-key rows shaded like a keyboard, a line on every C
  for (let p = lo; p <= hi; p++) {
    const top = rollTop + (hi - p) * rowH;
    const pc = p % 12;
    if (pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      ctx.fillRect(rollLeft, top, rollW, rowH);
    }
    if (pc === 0) {
      ctx.fillStyle = 'rgba(160,175,255,0.12)';
      ctx.fillRect(rollLeft, Math.round(top + rowH), rollW, 1);
    }
  }
  // Beat grid scrolling with the music, stronger on bars
  const spb = 60 / bpm;
  const firstBeat = Math.ceil((loopNow - past) / spb);
  const lastBeat = Math.floor((loopNow + future) / spb);
  for (let b = firstBeat; b <= lastBeat; b++) {
    const bx = Math.round(playX + (b * spb - loopNow) * pxPerSec);
    ctx.fillStyle = b % 4 === 0 ? 'rgba(160,175,255,0.16)' : 'rgba(160,175,255,0.06)';
    ctx.fillRect(bx, rollTop, 1, rollBottom - rollTop);
  }

  // Notes
  const barH = Math.max(4, Math.min(16, rowH * 0.78));
  const radius = Math.min(4, barH / 2);
  const fontSize = Math.min(11, barH - 3);
  const showNames = fontSize >= 7;
  if (showNames) {
    ctx.font = `700 ${fontSize.toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(rollLeft, rollTop, rollW, rollBottom - rollTop);
  ctx.clip();
  for (let i = 0; i < count; i++) {
    const n = pool[i];
    const p = n.note.midi;
    if (p < lo || p > hi) continue;
    const band = bandOf(p);
    const color = BANDS[band];
    const nx = playX + n.relStart * pxPerSec;
    const nw = Math.max(barH, n.note.duration * pxPerSec - 2);
    const ny = rowY(p) - barH / 2;
    // Unplayed part: tinted outline
    if (nx + nw > playX) {
      ctx.fillStyle = BAND_FAINT[band];
      roundRect(ctx, nx, ny, nw, barH, radius, true, false);
    }
    // Played part: solid up to the playhead
    if (nx < playX) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(nx - 1, ny - 2, Math.min(nw + 2, playX - nx + 1), barH + 4);
      ctx.clip();
      ctx.fillStyle = color;
      roundRect(ctx, nx, ny, nw, barH, radius, true, false);
      ctx.restore();
    }
    const sounding = n.relStart <= 0 && n.relEnd >= 0;
    ctx.strokeStyle = sounding ? INK : color;
    ctx.lineWidth = sounding ? 1.8 : 1.3;
    roundRect(ctx, nx, ny, nw, barH, radius, false, true);
    // Name inside the bar when it fits (monospace width estimate, no measureText per note)
    if (showNames) {
      const label = nameOf[p];
      const tw = label.length * fontSize * 0.62;
      if (tw + 8 <= nw) {
        const tx = nx + 4;
        ctx.fillStyle = tx + tw <= playX ? DARK_INK : color;
        ctx.fillText(label, tx, ny + barH / 2 + 0.5);
      }
    }
  }
  ctx.restore();

  // Playhead: accent line with a notch at the top
  const px = Math.round(playX);
  ctx.fillStyle = 'rgba(240,83,47,0.14)';
  ctx.fillRect(px - 5, rollTop, 10, rollBottom - rollTop);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(px - 1, rollTop - 6, 2, rollBottom - rollTop + 12);
  ctx.beginPath();
  ctx.moveTo(px - 6, panelTop + 6);
  ctx.lineTo(px + 6, panelTop + 6);
  ctx.lineTo(px, panelTop + 14);
  ctx.closePath();
  ctx.fill();

  // ---------- Pitch labels at left (outside the note area) ----------
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const tagX = panelX + 12;
  const tagW = 50;
  const tagH = Math.max(10, Math.min(16, rowH + 2));
  for (let p = lo; p <= hi; p++) {
    const ly = rowY(p);
    const on = lit.get(p);
    if (on) {
      ctx.fillStyle = on.color;
      roundRect(ctx, tagX, ly - tagH / 2, tagW, tagH, tagH / 2, true, false);
      ctx.fillStyle = DARK_INK;
      ctx.font = `700 ${Math.min(11, tagH - 4)}px "JetBrains Mono", monospace`;
      ctx.fillText(nameOf[p], tagX + tagW / 2, ly + 0.5);
    } else if (p % 12 === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillText(nameOf[p], tagX + tagW / 2, ly + 0.5);
    }
  }

  // ---------- Chord written out, each note in its colour ----------
  // Sounding notes; otherwise the last onset group, faded, so the line never jumps to empty
  chordPitches.length = 0;
  let alpha = 1;
  if (activeNotes.length) {
    for (const n of activeNotes) chordPitches.push(n.midi);
  } else {
    let last = -Infinity;
    for (let i = 0; i < count; i++) if (pool[i].relStart <= 0 && pool[i].relStart > last) last = pool[i].relStart;
    for (let i = 0; i < count; i++) {
      const n = pool[i];
      if (n.relStart <= 0 && n.relStart >= last - 0.06 && !chordPitches.includes(n.note.midi)) chordPitches.push(n.note.midi);
    }
    chordPitches.sort((a, b) => a - b);
    alpha = 0.4;
  }
  if (chordPitches.length) {
    const cy = y + h - 70;
    const size = 20;
    ctx.font = `700 ${size}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const sep = ' · ';
    const charW = size * 0.62;
    let chars = 0;
    for (let i = 0; i < chordPitches.length; i++) chars += nameOf[chordPitches[i]].length + (i ? sep.length : 0);
    const scale = Math.min(1, (w - 80) / (chars * charW));
    const step = charW * scale;
    if (scale < 1) ctx.font = `700 ${(size * scale).toFixed(1)}px "JetBrains Mono", monospace`;
    let tx = x + w / 2 - (chars * step) / 2;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < chordPitches.length; i++) {
      if (i) {
        ctx.fillStyle = MUTED;
        ctx.fillText(sep, tx, cy);
        tx += sep.length * step;
      }
      const label = nameOf[chordPitches[i]];
      ctx.fillStyle = noteColor(chordPitches[i]);
      ctx.fillText(label, tx, cy);
      tx += label.length * step;
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export default { draw: drawPocketKeys } satisfies ModeModule;
