import type { MidiNote, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';
import { getBackdropPhoto, drawPhotoCover } from '../../../shared/backdrop';
import {
  BeatState, Rect, beatStep, bloom, chromaShift, glowDot, grain, hash01, makeCanvas, newBeatState, scanlines, vignette, wash,
} from '../_film/fx';

/**
 * Camcorder '04: MiniDV night footage.
 *   - Scene: a night city looking up (window grids, billboards, marquee bulbs, blooming lamps),
 *     painted once into an oversized offscreen (plus a blurred copy for focus hunts).
 *     With a backdrop photo, the photo is the scene.
 *   - Camera: handheld sway, zoom pulse on each kick, auto-exposure breathing with loudness,
 *     a short focus hunt after very hard hits.
 *   - Billboards blink on the beat (MIDI: the billboard under each active note's pitch).
 *   - Tape: chroma bleed, interlace, bloom, light grain, dropout bands on loud hits.
 *   - OSD: ● REC, battery, SP, zoom bar (W–T follows the zoom), date + clock, timecode, title caption.
 */

const OSD = '"JetBrains Mono", "Courier New", ui-monospace, monospace';
const MARGIN = 1.16; // scene is this much larger than the frame (room for sway + zoom)
const CLOCK_START = 23 * 3600 + 58 * 60 + 30; // 11:58:30 PM

export interface Billboard { x: number; y: number; w: number; h: number; rgb: string }

/** h:mm:ss:ff timecode at 30 fps. Pure. */
export function timecode(sec: number): string {
  const s = Math.max(0, sec);
  const f = Math.floor((s % 1) * 30);
  const t = Math.floor(s);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(t / 3600)}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}:${p(f)}`;
}

/** Camcorder clock, starting 11:58:30 PM and rolling past midnight. Pure. */
export function clock(sec: number): string {
  const t = Math.floor(CLOCK_START + Math.max(0, sec)) % 86400;
  const h24 = Math.floor(t / 3600);
  const h = h24 % 12 || 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${h}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Date shown on the OSD: DEC 31 2004, then JAN 1 2005 after midnight. Pure. */
export function osdDate(sec: number): string {
  return CLOCK_START + Math.max(0, sec) >= 86400 ? 'JAN  1 2005' : 'DEC 31 2004';
}

/** Billboards in scene coordinates (scene centred on 0,0, size sw × sh). Pure. */
export function billboards(sw: number, sh: number): Billboard[] {
  const cols = ['245,247,255', '255,59,48', '255,210,63', '58,160,255', '255,255,255', '255,90,170'];
  const out: Billboard[] = [];
  for (let i = 0; i < 6; i++) {
    const w = sw * (0.12 + hash01(i * 11 + 1) * 0.12);
    const h = sh * (0.06 + hash01(i * 11 + 2) * 0.1);
    const x = -sw / 2 + sw * (0.04 + (i / 6) * 0.9) + hash01(i * 11 + 3) * sw * 0.03;
    const y = -sh / 2 + sh * (0.28 + hash01(i * 11 + 4) * 0.4);
    out.push({ x, y, w, h, rgb: cols[i % cols.length] });
  }
  return out;
}

interface CamState {
  beat: BeatState;
  zoom: number;
  focus: number;     // 1 = fully out of focus
  dropout: number;
  scene: HTMLCanvasElement | null;
  blur: HTMLCanvasElement | null;
  key: string;
}

const states = new WeakMap<object, CamState>();
const rangeCache = new WeakMap<MidiNote[], { lo: number; hi: number }>();

function stateFor(ctx: CanvasRenderingContext2D): CamState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) {
    s = { beat: newBeatState(), zoom: 0, focus: 0, dropout: 0, scene: null, blur: null, key: '' };
    states.set(key, s);
  }
  return s;
}

function paintCity(g: CanvasRenderingContext2D, sw: number, sh: number): void {
  const sky = g.createLinearGradient(0, 0, 0, sh);
  sky.addColorStop(0, '#050a2a');
  sky.addColorStop(0.6, '#13207a');
  sky.addColorStop(1, '#0a0f3a');
  g.fillStyle = sky;
  g.fillRect(0, 0, sw, sh);

  const m = Math.min(sw, sh);
  const windows = (bx: number, by: number, bw: number, bh: number, cell: number, seed: number, lit: number) => {
    for (let y = by + cell; y < by + bh - cell; y += cell * 1.9)
      for (let x = bx + cell * 0.8; x < bx + bw - cell; x += cell * 1.6) {
        const r = hash01(Math.floor(x * 3.1 + y * 7.7) + seed);
        if (r > lit) continue;
        const a = 0.35 + 0.6 * hash01(Math.floor(x * 5.3 + y * 1.9) + seed * 3);
        g.fillStyle = r < lit * 0.25 ? `rgba(190,225,255,${a})` : `rgba(255,232,170,${a})`;
        g.fillRect(x, y, cell * 0.9, cell * 1.1);
      }
  };
  // Back row
  for (let i = 0; i < 12; i++) {
    const bw = sw * (0.08 + hash01(i * 3 + 1) * 0.08);
    const bx = (i / 12) * sw * 1.05 - sw * 0.03;
    const bh = sh * (0.55 + hash01(i * 3 + 2) * 0.4);
    g.fillStyle = '#080c26';
    g.fillRect(bx, sh - bh, bw, bh);
    windows(bx, sh - bh, bw, bh, m * 0.006, i * 101, 0.32);
  }
  // Front row: taller, darker, bigger windows; one bright tower like a lit facade.
  for (let i = 0; i < 6; i++) {
    const bw = sw * (0.14 + hash01(i * 5 + 7) * 0.08);
    const bx = (i / 6) * sw + (hash01(i * 5 + 8) - 0.5) * sw * 0.05;
    const bh = sh * (0.7 + hash01(i * 5 + 9) * 0.35);
    g.fillStyle = '#04061a';
    g.fillRect(bx, sh - bh, bw, bh);
    windows(bx, sh - bh, bw, bh, m * 0.01, i * 211, i === 3 ? 0.7 : 0.28);
  }
  // Billboards (base glow; the beat brightens them later)
  for (const b of billboards(sw, sh)) {
    const x = b.x + sw / 2;
    const y = b.y + sh / 2;
    g.fillStyle = `rgba(${b.rgb},0.85)`;
    g.fillRect(x, y, b.w, b.h);
    const inner = g.createLinearGradient(x, y, x, y + b.h);
    inner.addColorStop(0, 'rgba(255,255,255,0.35)');
    inner.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = inner;
    g.fillRect(x, y, b.w, b.h);
    // Generic ad artwork: a round mark and text bars printed on the lit board.
    const k = Math.round(hash01(Math.floor(x)) * 3);
    g.fillStyle = 'rgba(10,12,30,0.8)';
    g.beginPath();
    g.arc(x + b.w * 0.22, y + b.h / 2, Math.min(b.w, b.h) * 0.24, 0, Math.PI * 2);
    g.fill();
    for (let r = 0; r < 2 + (k % 2); r++) g.fillRect(x + b.w * 0.42, y + b.h * (0.28 + r * 0.2), b.w * (0.46 - r * 0.1), b.h * 0.09);
    glowDot(g, x + b.w / 2, y + b.h / 2, Math.max(b.w, b.h) * 0.9, b.rgb, 0.25);
  }
  // Marquee bulbs down the left edge
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 26; k++) {
    const y = sh * (0.35 + k * 0.022);
    glowDot(g, sw * 0.05, y, m * 0.014, '255,200,110', 0.9);
    glowDot(g, sw * 0.05 + m * 0.04, y + sh * 0.011, m * 0.014, '255,200,110', 0.9);
  }
  // Big streetlamps blooming at the top left
  for (let k = 0; k < 3; k++) glowDot(g, sw * (0.16 + k * 0.05), sh * (0.1 + k * k * 0.035), m * (0.11 - k * 0.025), '255,250,235', 0.95);
  g.restore();
  // Street-level darkness
  const ground = g.createLinearGradient(0, sh * 0.8, 0, sh);
  ground.addColorStop(0, 'rgba(0,0,0,0)');
  ground.addColorStop(1, 'rgba(0,0,8,0.85)');
  g.fillStyle = ground;
  g.fillRect(0, sh * 0.8, sw, sh * 0.2);
}

function buildScene(s: CamState, F: Rect, scale: number, photo: HTMLImageElement | null): void {
  const key = `${F.w}x${F.h}@${scale}|${photo ? photo.src : 'city'}`;
  if (s.scene && s.key === key) return;
  const sw = F.w * MARGIN;
  const sh = F.h * MARGIN;
  const scene = makeCanvas(sw * scale, sh * scale);
  const g = scene?.getContext('2d');
  if (!scene || !g) return;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  if (photo) drawPhotoCover(g, photo, { x: 0, y: 0, w: sw, h: sh });
  else paintCity(g, sw, sh);
  const blur = makeCanvas(scene.width / 10, scene.height / 10);
  const bg = blur?.getContext('2d');
  if (blur && bg) {
    bg.imageSmoothingEnabled = true;
    bg.drawImage(scene, 0, 0, blur.width, blur.height);
  }
  s.scene = scene;
  s.blur = blur;
  s.key = key;
}

function noteRange(notes: MidiNote[]): { lo: number; hi: number } {
  let r = rangeCache.get(notes);
  if (!r) {
    let lo = 127;
    let hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    r = lo > hi ? { lo: 48, hi: 72 } : { lo, hi };
    rangeCache.set(notes, r);
  }
  return r;
}

function osdText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, align: CanvasTextAlign, color = '#ffffff'): void {
  ctx.font = `700 ${Math.round(px)}px ${OSD}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + px * 0.08, y + px * 0.08);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawOsd(ctx: CanvasRenderingContext2D, F: Rect, t: number, zoom: number, title: string, info: string): void {
  const m = Math.min(F.w, F.h);
  const px = Math.max(14, m * 0.036);
  const pad = m * 0.07;
  const L = F.x + pad;
  const R = F.x + F.w - pad;
  const T = F.y + pad;
  const B = F.y + F.h - pad;
  ctx.save();
  // ● REC (dot blinks once per second)
  if (t % 1 < 0.6) {
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.arc(L + px * 0.4, T, px * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  osdText(ctx, 'REC', L + px * 1.1, T, px, 'left');
  osdText(ctx, 'SP', L, T + px * 1.5, px * 0.8, 'left');
  // Battery
  const bw = px * 1.9;
  const bh = px * 0.9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, px * 0.1);
  ctx.strokeRect(R - bw, T - bh / 2, bw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(R - bw - px * 0.16, T - bh * 0.22, px * 0.16, bh * 0.44);
  for (let i = 0; i < 3; i++) ctx.fillRect(R - bw + px * 0.18 + i * bw * 0.3, T - bh / 2 + px * 0.16, bw * 0.22, bh - px * 0.32);
  // Zoom bar W ▮▮▮▯ T
  const zy = T + px * 2.2;
  const zw = px * 6;
  osdText(ctx, 'W', R - zw - px * 0.6, zy, px * 0.8, 'right');
  osdText(ctx, 'T', R + px * 0.1, zy, px * 0.8, 'left');
  ctx.strokeRect(R - zw, zy - px * 0.25, zw - px * 0.2, px * 0.5);
  ctx.fillRect(R - zw, zy - px * 0.25, (zw - px * 0.2) * Math.min(1, 0.15 + zoom), px * 0.5);
  // Date + clock, timecode
  osdText(ctx, osdDate(t), L, B - px * 1.3, px, 'left');
  osdText(ctx, clock(t), L, B, px, 'left');
  osdText(ctx, timecode(t), R, B, px, 'right');
  // Title caption
  osdText(ctx, title.toUpperCase(), F.x + F.w / 2, B - px * 3.4, px * 1.15, 'center');
  osdText(ctx, info.toUpperCase(), F.x + F.w / 2, B - px * 2.2, px * 0.75, 'center', 'rgba(255,255,255,0.85)');
  ctx.restore();
}

export function drawCamcorder(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime, midi, activeNotes } = context;
  const F: Rect = { x: region.x, y: region.y, w: region.width, h: region.height };
  const s = stateFor(ctx);
  const b = beatStep(s.beat, analysis, currentTime, settings.audioSensitivity || 1.2);
  if (b.dt === 0) { s.zoom = 0; s.focus = 0; s.dropout = 0; }
  if (b.hit) {
    s.zoom = Math.max(s.zoom, 0.5 + b.kick * 0.5);
    if (b.kick > 0.92) { s.focus = 1; s.dropout = 1; }
  }
  s.zoom *= Math.exp(-b.dt / 0.28);
  s.focus *= Math.exp(-b.dt / 0.35);
  s.dropout *= Math.exp(-b.dt / 0.12);

  let scale = 1;
  if (typeof ctx.getTransform === 'function') scale = Math.max(1, Math.abs(ctx.getTransform().a));
  const photo = getBackdropPhoto();
  buildScene(s, F, scale, photo);

  const t = currentTime;
  const sw = F.w * MARGIN;
  const sh = F.h * MARGIN;
  const z = 1 + s.zoom * 0.07;
  const swayX = F.w * (0.006 * Math.sin(t * 1.1) + 0.004 * Math.sin(t * 2.3 + 1));
  const swayY = F.h * (0.004 * Math.sin(t * 0.9 + 2) + 0.003 * Math.sin(t * 1.9));
  const rot = 0.004 * Math.sin(t * 0.7);

  ctx.save();
  ctx.beginPath();
  ctx.rect(F.x, F.y, F.w, F.h);
  ctx.clip();
  ctx.fillStyle = '#02030a';
  ctx.fillRect(F.x, F.y, F.w, F.h);

  ctx.save();
  ctx.translate(F.x + F.w / 2 + swayX, F.y + F.h / 2 + swayY);
  ctx.rotate(rot);
  ctx.scale(z, z);
  if (s.scene) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.scene, -sw / 2, -sh / 2, sw, sh);
    if (s.blur && s.focus > 0.02) {
      ctx.globalAlpha = Math.min(1, s.focus * 1.2);
      ctx.drawImage(s.blur, -sw / 2, -sh / 2, sw, sh);
      ctx.globalAlpha = 1;
    }
  }
  // Billboards blink: MIDI → billboard under the note's pitch; audio → one per beat.
  if (!photo) {
    const boards = billboards(sw, sh);
    const lit = new Array(boards.length).fill(0);
    if (context.albumView === 'midi' && midi?.notes?.length) {
      const { lo, hi } = noteRange(midi.notes);
      for (const n of activeNotes) {
        const i = Math.min(boards.length - 1, Math.floor(((n.midi - lo) / (hi - lo + 1)) * boards.length));
        lit[i] = Math.max(lit[i], 0.5 + n.velocity * 0.5);
      }
    } else {
      const bpm = settings.bpm || midi?.bpm || 120;
      const beatN = Math.floor(t / (60 / bpm));
      lit[beatN % boards.length] = b.kick;
      lit[(beatN * 7 + 3) % boards.length] = Math.max(lit[(beatN * 7 + 3) % boards.length], b.hat * 0.6);
    }
    ctx.globalCompositeOperation = 'lighter';
    boards.forEach((bd, i) => {
      if (lit[i] < 0.05) return;
      ctx.fillStyle = `rgba(${bd.rgb},${lit[i] * 0.55})`;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      glowDot(ctx, bd.x + bd.w / 2, bd.y + bd.h / 2, Math.max(bd.w, bd.h) * 1.1, bd.rgb, lit[i] * 0.35);
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  // Auto exposure: lifts with loudness, a touch of MiniDV blue.
  wash(ctx, F, '#ffffff', 0.04 + b.rms * 0.12, 'soft-light');
  wash(ctx, F, '#2a3cff', 0.12, 'soft-light');

  // Tape dropout: a few bands shifted sideways.
  if (s.dropout > 0.05 && ctx.canvas) {
    const f = Math.floor(t * 30);
    const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const sx = m ? m.a : 1;
    for (let i = 0; i < 4; i++) {
      const by = F.y + hash01(f * 7 + i) * F.h;
      const bh = F.h * (0.005 + hash01(f * 11 + i) * 0.02);
      const off = (hash01(f * 13 + i) - 0.5) * F.w * 0.08 * s.dropout;
      const py = m ? by * m.d + m.f : by;
      const px0 = m ? F.x * sx + m.e : F.x;
      ctx.drawImage(ctx.canvas, px0, py, F.w * sx, bh * sx, F.x + off, by, F.w, bh);
      ctx.fillStyle = `rgba(255,255,255,${0.15 * s.dropout})`;
      ctx.fillRect(F.x, by, F.w, Math.max(1, bh * 0.2));
    }
  }

  bloom(ctx, F, 0.5, '#e8ecff', 8);
  chromaShift(ctx, F, Math.max(2, F.w * 0.003) * (1 + s.dropout * 3));
  scanlines(ctx, F, Math.max(3, F.h / 480), 0.14, Math.floor(t * 60) % 2);
  grain(ctx, F, 0.08, t, Math.max(1, F.w / 900));
  vignette(ctx, F, 0.45);

  const info = [`${Math.round(settings.bpm || midi?.bpm || 120)} BPM`, settings.key].filter(Boolean).join(' · ');
  drawOsd(ctx, F, t, s.zoom, settings.title || 'Untitled', info);
  ctx.restore();
}

export default { draw: drawCamcorder } satisfies ModeModule;
