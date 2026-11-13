import { MidiNote, ModelDrawContext, ModeModule, ParsedMidi } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { darken, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { roundRect } from '../../../shared/canvas-utils';
import { drawSynth, GRAPHITE, hash, LitKey } from './synth';

/**
 * Graphite Synth: cream paper with grain, an original hand-drawn vintage synth whose keys light
 * up in the note's colour, and a piano roll of "pill" notes below it: outlined before the
 * playhead, filled once played. Active pitches are tagged at the left and the current chord is
 * written out underneath (e.g. "F2 · E4 · G4 · C5 · E5").
 */

const PAPER = '#efe9db';

/** Muted ink colours by register: bass teal, low-mid ochre, mid terracotta, high periwinkle. */
export function noteColor(midi: number): string {
  if (midi < 48) return '#5c9a8b';
  if (midi < 60) return '#c9a14a';
  if (midi < 72) return '#c4785c';
  return '#7b8fd1';
}

const SEAM_OFFSETS = [-1, 0, 1];
const NO_SEAM = [0];

interface WindowNote { note: MidiNote; relStart: number; relEnd: number }

/** Notes between `past` seconds ago and `future` seconds ahead, with loop-seam copies. */
function windowNotes(context: ModelDrawContext, past: number, future: number): WindowNote[] {
  const { currentTime, loopTime, duration, midi, settings, introInfo } = context;
  const hasIntro = introInfo?.hasIntro ?? introInfo?.isIntro ?? false;
  const isIntro = introInfo?.isIntro ?? false;
  const secondsPerBar = (60 / (settings.bpm || midi.bpm || 80)) * 4;
  const introDuration = introInfo?.introDuration ?? (hasIntro ? (introInfo?.totalIntroBars || 1) * secondsPerBar : 0);
  const loopDuration = duration || 16;
  const mainLoopDuration = introInfo?.mainLoopDuration ?? loopDuration;
  const now = typeof loopTime === 'number' && !isNaN(loopTime) ? loopTime : currentTime % loopDuration;

  const out: WindowNote[] = [];
  for (const note of midi.notes || []) {
    const inMainLoop = hasIntro && !isIntro && note.time >= introDuration;
    const period = inMainLoop ? mainLoopDuration : loopDuration;
    const offsets = !hasIntro || inMainLoop ? SEAM_OFFSETS : NO_SEAM;
    for (const k of offsets) {
      const relStart = note.time + k * period - now;
      const relEnd = relStart + note.duration;
      if (relEnd < -past || relStart > future) continue;
      out.push({ note, relStart, relEnd });
    }
  }
  return out;
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
    // Keyboard: whole octaves around the notes, at least three, clamped to 88 keys
    let kbLo = lo - (lo % 12);
    let kbHi = hi + (11 - (hi % 12));
    while (kbHi - kbLo + 1 < 36) kbHi += 12;
    kbLo = Math.max(21, kbLo);
    kbHi = Math.min(108, kbHi);
    // Roll: the notes' span, one semitone of air each side, at least an octave tall
    lo -= 1; hi += 1;
    while (hi - lo < 12) { lo -= 1; hi += 1; }
    r = { lo, hi, kbLo, kbHi };
    rangeCache.set(midi, r);
  }
  return r;
}

const paperCache = new Map<string, HTMLCanvasElement>();
/** Cream sheet with warm vignette, speckle grain and faint fibres (cached per size and tint). */
function paperLayer(w: number, h: number, tint: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${w}x${h}|${tint}`;
  let c = paperCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = tint;
      g.fillRect(0, 0, w, h);
      const v = g.createRadialGradient(w / 2, h * 0.4, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(255,252,240,0.35)');
      v.addColorStop(1, 'rgba(120,95,60,0.16)');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      const count = Math.floor((w * h) / 40);
      for (let i = 0; i < count; i++) {
        const a = hash(i * 2 + 0.5);
        g.fillStyle = a > 0.5 ? `rgba(90,70,45,${0.04 + (a - 0.5) * 0.12})` : `rgba(255,255,250,${0.05 + a * 0.12})`;
        g.fillRect(hash(i * 5 + 1) * w, hash(i * 7 + 3) * h, 1, 1);
      }
      g.strokeStyle = 'rgba(110,90,60,0.05)';
      g.lineWidth = 0.7;
      for (let i = 0; i < 90; i++) {
        const fx = hash(i * 11 + 9) * w;
        const fy = hash(i * 13 + 4) * h;
        const len = 8 + hash(i * 17) * 26;
        const ang = (hash(i * 19) - 0.5) * 0.8;
        g.beginPath();
        g.moveTo(fx, fy);
        g.quadraticCurveTo(fx + len / 2, fy + (hash(i) - 0.5) * 4, fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
        g.stroke();
      }
    }
    if (paperCache.size > 6) paperCache.clear();
    paperCache.set(key, c);
  }
  return c;
}

export function drawGraphiteSynth(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, midi, settings } = context;
  const { x, y, width: w, height: h } = region;
  const accidental = settings.accidental;
  const middleC = settings.middleC;
  const name = (p: number) => formatNoteName(p, accidental, middleC);
  const { lo, hi, kbLo, kbHi } = ranges(midi);

  ctx.save();

  // ---------- Paper ----------
  const tint = isLightTone(settings) && settings.bgColor ? settings.bgColor : PAPER;
  ctx.save();
  roundRect(ctx, x, y, w, h, 18, false, false);
  ctx.clip();
  const paper = paperLayer(w, h, tint);
  if (paper) ctx.drawImage(paper, x, y);
  else { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); }
  ctx.restore();

  // ---------- Time window ----------
  const bpm = settings.bpm || midi.bpm || 90;
  const span = Math.max(3, Math.min(8, (240 / bpm) * 2));
  const rollLeft = x + 92;
  const rollRight = x + w - 44;
  const rollW = rollRight - rollLeft;
  const playX = rollLeft + rollW * 0.26;
  const pxPerSec = rollW / span;
  const past = (playX - rollLeft) / pxPerSec;
  const future = (rollRight - playX) / pxPerSec;
  const notes = windowNotes(context, past, future);

  const active = notes.filter(n => n.relStart <= 0 && n.relEnd >= 0);
  const lit = new Map<number, LitKey>();
  for (const n of active) {
    const prev = lit.get(n.note.midi);
    const age = -n.relStart;
    if (!prev || age < prev.age) lit.set(n.note.midi, { color: noteColor(n.note.midi), label: name(n.note.midi), age });
  }

  // ---------- Synth ----------
  const sw = w * 0.9;
  const sh = Math.min(sw * 0.36, h * 0.3);
  const sy = y + 46;
  drawSynth(ctx, { x: Math.round(x + (w - sw) / 2), y: Math.round(sy), w: Math.round(sw), h: Math.round(sh), lo: kbLo, hi: kbHi }, lit, settings.noteNameTags !== false);

  // ---------- Piano roll ----------
  const rollTop = sy + sh + 64;
  const rollBottom = y + h - 150;
  const rows = hi - lo + 1;
  const rowH = (rollBottom - rollTop) / rows;
  const rowY = (p: number) => rollTop + (hi - p + 0.5) * rowH;

  // Faint staff: one hairline per row, slightly stronger on C
  for (let p = lo; p <= hi; p++) {
    ctx.fillStyle = hexToRgbaStr(GRAPHITE, p % 12 === 0 ? 0.1 : 0.035);
    ctx.fillRect(rollLeft, Math.round(rowY(p)), rollW, 1);
  }
  ctx.fillStyle = hexToRgbaStr(GRAPHITE, 0.55);
  ctx.fillRect(rollLeft, Math.round(rollTop) - 1, rollW, 1.5);
  ctx.fillRect(rollLeft, Math.round(rollBottom), rollW, 1.5);

  const pillH = Math.max(4, Math.min(11, rowH * 0.7));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rollLeft, rollTop, rollW, rollBottom - rollTop);
  ctx.clip();
  for (const n of notes) {
    const p = n.note.midi;
    if (p < lo || p > hi) continue;
    const nx = playX + n.relStart * pxPerSec;
    const nw = Math.max(pillH, n.note.duration * pxPerSec - 2);
    const ny = rowY(p) - pillH / 2;
    const color = noteColor(p);
    const r = pillH / 2;
    // Unplayed: paper-filled outline
    if (nx + nw > playX) {
      ctx.fillStyle = hexToRgbaStr(tint, 0.85);
      roundRect(ctx, nx, ny, nw, pillH, r, true, false);
    }
    // Played part: filled with the note's colour up to the playhead
    if (nx < playX) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(nx - 1, ny - 2, Math.min(nw + 2, playX - nx + 1), pillH + 4);
      ctx.clip();
      ctx.fillStyle = hexToRgbaStr(color, 0.88);
      roundRect(ctx, nx, ny, nw, pillH, r, true, false);
      ctx.restore();
    }
    const sounding = n.relStart <= 0 && n.relEnd >= 0;
    ctx.strokeStyle = sounding ? GRAPHITE : darken(color, 0.75);
    ctx.lineWidth = sounding ? 1.6 : 1.1;
    roundRect(ctx, nx, ny, nw, pillH, r, false, true);
  }
  ctx.restore();

  // Playhead
  ctx.fillStyle = GRAPHITE;
  ctx.fillRect(Math.round(playX), rollTop - 10, 1.4, rollBottom - rollTop + 20);

  // ---------- Pitch labels at left ----------
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const labelled = new Set(lit.keys());
  for (let p = lo; p <= hi; p++) {
    const ly = rowY(p);
    if (labelled.has(p)) {
      ctx.fillStyle = GRAPHITE;
      roundRect(ctx, x + 22, ly - 2.5, 22, 5, 2.5, true, false);
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(name(p), x + 50, ly + 0.5);
    } else if (p % 12 === 0) {
      ctx.fillStyle = hexToRgbaStr(GRAPHITE, 0.35);
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillText(name(p), x + 50, ly + 0.5);
    }
  }

  // ---------- Chord written out ----------
  // Sounding notes; otherwise the last onset group, faded, so the line never jumps to empty
  let chord = active.map(n => n.note.midi);
  let alpha = 1;
  if (!chord.length) {
    const played = notes.filter(n => n.relStart <= 0);
    const last = played.reduce((m, n) => Math.max(m, n.relStart), -Infinity);
    chord = played.filter(n => n.relStart >= last - 0.06).map(n => n.note.midi);
    alpha = 0.4;
  }
  const text = chordText(chord, accidental, middleC);
  if (text) {
    const cy = y + h - 92;
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hexToRgbaStr(GRAPHITE, alpha);
    ctx.fillText(text, x + w / 2, cy, w - 80);
    const tw = Math.min(ctx.measureText(text).width, w - 80);
    // Hand-drawn underline in the newest note's colour
    const under = chord.length ? noteColor(chord[chord.length - 1]) : GRAPHITE;
    ctx.strokeStyle = hexToRgbaStr(under, alpha * 0.9);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - tw * 0.32, cy + 18);
    ctx.quadraticCurveTo(x + w / 2, cy + 20.5, x + w / 2 + tw * 0.32, cy + 17.5);
    ctx.stroke();
  }

  ctx.restore();
}

export default { draw: drawGraphiteSynth } satisfies ModeModule;
