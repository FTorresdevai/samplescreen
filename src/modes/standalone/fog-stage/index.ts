import type { MidiNote, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';
import { getBackdropPhoto, drawPhotoCover } from '../../../shared/backdrop';
import { resolveLook } from '../../../core/mode-resolution';
import manifest from './manifest';
import {
  BeatState, Rect, beatStep, bloom, desaturate, grain, hash01, makeCanvas, newBeatState, smoke, vignette, wash,
} from '../_film/fx';

/**
 * Fog Stage: black-and-white stage in thick fog.
 *   - Backlight behind the stage lights the fog from below (bright floor haze, black sky).
 *   - Fog: large soft blobs drifting sideways, drawn into a low-res buffer so they stay soft.
 *   - Beams: volumetric wedges from above the frame, swinging slowly; the mids set their intensity.
 *   - Fire: flame columns along the stage edge, stateless puffs (phase = f(currentTime)), height from
 *     the bass envelope plus a pyro boost on each kick hit; embers rise during a burst.
 *     MIDI: active notes push the column under their pitch (low = left).
 *   - Strobe on hard kicks, capped at 3 per second.
 *   - Looks: Mono (pure B&W) and Ember (B&W with a faint orange fire).
 *   - Photo: B&W, high contrast, fog and fire composited over it.
 * Heavy grain, crushed blacks, vignette.
 */

const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
const EMITTERS = 5;
const PUFFS = 72;
const STROBE_GAP = 1 / 3; // ≤ 3 strobes per second

export interface StageLayout {
  frame: Rect;
  floorY: number;          // stage edge
  light: { x: number; y: number; r: number }; // backlight
  emitters: number[];      // flame column x positions
  flameW: number;
  maxFlame: number;        // tallest column, px
  title: { x: number; y: number; px: number };
}

/** Stage geometry. Pure, so it can be unit-tested. */
export function stageLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): StageLayout {
  const { x, y, width: W, height: H } = region;
  const floorY = y + H * 0.84;
  const emitters: number[] = [];
  for (let i = 0; i < EMITTERS; i++) emitters.push(x + W * (0.12 + (0.76 * i) / (EMITTERS - 1)));
  return {
    frame: { x, y, w: W, h: H },
    floorY,
    light: { x: x + W * 0.5, y: floorY - H * 0.06, r: Math.max(W, H) * 0.65 },
    emitters,
    flameW: Math.min(W, H) * 0.09,
    maxFlame: H * 0.5,
    title: { x: x + W / 2, y: y + H * 0.08, px: Math.max(14, Math.min(W, H) * 0.03) },
  };
}

/** Emitter index for a MIDI pitch over the note range [lo, hi]. Pure. */
export function emitterFor(midi: number, lo: number, hi: number, n = EMITTERS): number {
  if (hi <= lo) return Math.floor(n / 2);
  return Math.min(n - 1, Math.max(0, Math.floor(((midi - lo) / (hi - lo + 1)) * n)));
}

/** Strobe gate: true when a hit may fire a strobe given the last one. Pure. */
export function strobeAllowed(t: number, last: number, gap = STROBE_GAP): boolean {
  return last < 0 || t - last >= gap || t < last;
}

interface FogState {
  beat: BeatState;
  pyro: Float32Array;   // per-emitter burst envelope
  strobe: number;
  lastStrobe: number;
  buf: HTMLCanvasElement | null;
  sprites: HTMLCanvasElement[] | null;
}

const states = new WeakMap<object, FogState>();
const rangeCache = new WeakMap<MidiNote[], { lo: number; hi: number }>();

function stateFor(ctx: CanvasRenderingContext2D): FogState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) {
    s = { beat: newBeatState(), pyro: new Float32Array(EMITTERS), strobe: 0, lastStrobe: -1, buf: null, sprites: null };
    states.set(key, s);
  }
  return s;
}

/** Soft round sprites (core, flame, edge) rendered once and stamped with drawImage. */
function sprites(s: FogState): HTMLCanvasElement[] | null {
  if (s.sprites) return s.sprites;
  const cols = ['255,246,220', '255,170,60', '210,70,20', '255,255,255'];
  const out: HTMLCanvasElement[] = [];
  for (const c of cols) {
    const cv = makeCanvas(64, 64);
    const g = cv?.getContext('2d');
    if (!cv || !g) return null;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${c},1)`);
    grad.addColorStop(0.4, `rgba(${c},0.55)`);
    grad.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    out.push(cv);
  }
  s.sprites = out;
  return out;
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

function drawFogAndBeams(ctx: CanvasRenderingContext2D, L: StageLayout, t: number, mid: number, kick: number, photo: boolean): void {
  const F = L.frame;
  const W = F.w;
  const H = F.h;
  if (!photo) {
    ctx.fillStyle = '#000';
    ctx.fillRect(F.x, F.y, W, H);
  }

  // Textured smoke: two layers drifting at different scales, lit by the backlight
  // (multiply by a light mask keeps the top black and the floor haze bright).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  smoke(ctx, F, W * 0.9, t * W * 0.025, -t * H * 0.006, 0.55);
  smoke(ctx, F, W * 0.5, -t * W * 0.04, -t * H * 0.012, 0.4);
  ctx.globalCompositeOperation = 'multiply';
  const mask = ctx.createRadialGradient(L.light.x, L.light.y, 0, L.light.x, L.light.y, L.light.r * 1.1);
  mask.addColorStop(0, '#ffffff');
  mask.addColorStop(0.45, '#8a8a8a');
  mask.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = mask;
  ctx.fillRect(F.x, F.y, W, H);
  ctx.restore();

  // Backlight: the fog glows around the light source.
  const lg = ctx.createRadialGradient(L.light.x, L.light.y, 0, L.light.x, L.light.y, L.light.r);
  const lit = 0.75 + kick * 0.25;
  lg.addColorStop(0, `rgba(255,255,255,${0.85 * lit})`);
  lg.addColorStop(0.25, `rgba(220,220,220,${0.4 * lit})`);
  lg.addColorStop(0.6, `rgba(120,120,120,${0.12 * lit})`);
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = photo ? 'screen' : 'lighter';
  ctx.globalAlpha = photo ? 0.45 : 0.6;
  ctx.fillStyle = lg;
  ctx.fillRect(F.x, F.y, W, H);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Beams from above the frame.
  const beams = 5;
  for (let i = 0; i < beams; i++) {
    const ox = F.x + W * (0.1 + (0.8 * i) / (beams - 1));
    const oy = F.y - H * 0.1;
    const ang = Math.sin(t * 0.35 + i * 1.7) * 0.28 + (i - 2) * -0.06;
    const len = H * 1.1;
    const spread = 0.07;
    const ex1 = ox + Math.sin(ang - spread) * len;
    const ex2 = ox + Math.sin(ang + spread) * len;
    const ey = oy + Math.cos(ang) * len;
    const a = 0.035 + mid * 0.1;
    const g = ctx.createLinearGradient(ox, oy, ox, ey);
    g.addColorStop(0, `rgba(255,255,255,${a * 1.6})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ex1, ey);
    ctx.lineTo(ex2, ey);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawFire(ctx: CanvasRenderingContext2D, L: StageLayout, sp: HTMLCanvasElement[], heights: number[], pyro: Float32Array, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  L.emitters.forEach((ex, e) => {
    const h = heights[e];
    if (h < 2) return;
    const w = L.flameW * (0.8 + Math.min(1, h / L.maxFlame) * 0.6);
    for (let k = 0; k < PUFFS; k++) {
      const seed = e * 1000 + k;
      const rate = 1.4 + hash01(seed) * 0.9;
      const p = (t * rate + hash01(seed + 7)) % 1;          // 0 = base, 1 = tip
      const wob = Math.sin(t * 9 + hash01(seed + 3) * 20 + p * 6) * w * 0.5 * p;
      const x = ex + (hash01(seed + 11) - 0.5) * w * 0.5 * (1 - p) + wob;
      const y = L.floorY - p * h;
      const r = w * (0.46 - p * 0.34) * (0.7 + hash01(seed + 5) * 0.5);
      const life = Math.pow(1 - p, 1.5);
      const img = p < 0.2 ? sp[0] : p < 0.55 ? sp[1] : sp[2];
      ctx.globalAlpha = Math.min(1, life * 0.5 * Math.min(1, h / (L.maxFlame * 0.3)));
      ctx.drawImage(img, x - r * 0.6, y - r * 1.4, r * 1.2, r * 2.8);
    }
    // Embers during a burst
    const burst = pyro[e];
    if (burst > 0.05) {
      for (let k = 0; k < 10; k++) {
        const seed = e * 777 + k;
        const p = (t * (0.6 + hash01(seed) * 0.5) + hash01(seed + 1)) % 1;
        const x = ex + (hash01(seed + 2) - 0.5) * w * 3 + Math.sin(t * 3 + k) * w * 0.4;
        const y = L.floorY - h * 0.6 - p * L.maxFlame * 0.9;
        const r = L.flameW * 0.04 * (1 - p * 0.5);
        ctx.globalAlpha = burst * (1 - p);
        ctx.drawImage(sp[0], x - r * 3, y - r * 3, r * 6, r * 6);
      }
    }
    // Floor glow under each column
    ctx.globalAlpha = Math.min(0.35, (h / L.maxFlame) * 0.5);
    const gw = w * 2.6;
    ctx.drawImage(sp[1], ex - gw, L.floorY - gw * 0.12, gw * 2, gw * 0.24);
  });
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, L: StageLayout, title: string, info: string): void {
  const { x, y, px } = L.title;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `700 ${Math.round(px)}px ${SANS}`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(px * 0.45)}px`;
  ctx.fillText(title.toUpperCase(), x, y);
  ctx.font = `500 ${Math.round(px * 0.55)}px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(info.toUpperCase(), x, y + px * 1.3);
  ctx.restore();
}

export function drawFogStage(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime, midi, activeNotes } = context;
  const look = resolveLook(manifest, settings.modeLook) || 'mono';
  const L = stageLayout(region);
  const F = L.frame;
  const s = stateFor(ctx);
  const b = beatStep(s.beat, analysis, currentTime, settings.audioSensitivity || 1.2);
  const decay = Math.exp(-b.dt / 0.5);
  for (let e = 0; e < EMITTERS; e++) s.pyro[e] *= decay;
  if (b.dt === 0) { s.pyro.fill(0); s.strobe = 0; }
  if (b.hit) {
    // Burst on two columns picked by the hit time (stable for export), all five on a very hard kick.
    const pick = Math.floor(hash01(Math.floor(currentTime * 1000)) * EMITTERS);
    if (b.kick > 0.85) s.pyro.fill(1);
    else { s.pyro[pick] = 1; s.pyro[(pick + 2) % EMITTERS] = 1; }
    if (b.kick > 0.7 && strobeAllowed(currentTime, s.lastStrobe)) { s.strobe = 1; s.lastStrobe = currentTime; }
  }
  s.strobe *= Math.exp(-b.dt / 0.045);

  const midiView = context.albumView === 'midi' && (midi?.notes?.length ?? 0) > 0;
  const noteBoost = new Array(EMITTERS).fill(0);
  if (midiView) {
    const { lo, hi } = noteRange(midi.notes);
    for (const n of activeNotes) {
      const e = emitterFor(n.midi, lo, hi);
      noteBoost[e] = Math.max(noteBoost[e], 0.45 + n.velocity * 0.55);
    }
  }
  const heights = L.emitters.map((_, e) => {
    const base = midiView ? noteBoost[e] * 0.75 : b.kick * (0.55 + 0.45 * hash01(e + 3));
    const idle = 0.07 + 0.03 * Math.sin(currentTime * 2 + e);
    return L.maxFlame * Math.min(1.25, idle + base * 0.75 + s.pyro[e] * 0.55);
  });

  const photo = getBackdropPhoto();
  ctx.save();
  ctx.beginPath();
  ctx.rect(F.x, F.y, F.w, F.h);
  ctx.clip();

  if (photo) {
    drawPhotoCover(ctx, photo, F, 1.05 + b.kick * 0.02, Math.sin(currentTime * 0.08) * 0.6, 0);
    desaturate(ctx, F, 1);
    wash(ctx, F, '#000000', 0.35, 'soft-light');
  }

  // Fog + beams soft: low-res buffer.
  const down = 8;
  s.buf = s.buf ?? makeCanvas(F.w / down, F.h / down);
  const bctx = s.buf?.getContext('2d');
  if (s.buf && bctx) {
    const bw = Math.ceil(F.w / down);
    const bh = Math.ceil(F.h / down);
    if (s.buf.width !== bw || s.buf.height !== bh) { s.buf.width = bw; s.buf.height = bh; }
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bw, bh);
    bctx.setTransform(1 / down, 0, 0, 1 / down, -F.x / down, -F.y / down);
    drawFogAndBeams(bctx, L, currentTime, b.mid, b.kick, !!photo);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (photo) ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(s.buf, F.x, F.y, F.w, F.h);
    ctx.restore();
  } else drawFogAndBeams(ctx, L, currentTime, b.mid, b.kick, !!photo);

  // Stage floor: dark band below the edge.
  const fl = ctx.createLinearGradient(0, L.floorY, 0, F.y + F.h);
  fl.addColorStop(0, 'rgba(0,0,0,0.25)');
  fl.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = fl;
  ctx.fillRect(F.x, L.floorY, F.w, F.y + F.h - L.floorY);

  const sp = sprites(s);
  if (sp) drawFire(ctx, L, sp, heights, s.pyro, currentTime);

  // Low fog in front of the flames' base
  const front = ctx.createLinearGradient(0, L.floorY - F.h * 0.08, 0, F.y + F.h);
  front.addColorStop(0, 'rgba(200,200,200,0)');
  front.addColorStop(0.4, 'rgba(200,200,200,0.14)');
  front.addColorStop(1, 'rgba(120,120,120,0.1)');
  ctx.fillStyle = front;
  ctx.fillRect(F.x, L.floorY - F.h * 0.08, F.w, F.h);

  const info = [`${Math.round(settings.bpm || midi?.bpm || 120)} BPM`, settings.key].filter(Boolean).join(' · ');
  drawText(ctx, L, settings.title || 'Untitled', info);

  if (look === 'ember') {
    desaturate(ctx, F, 0.82);
    wash(ctx, F, '#ff8a3a', 0.12, 'soft-light');
  } else desaturate(ctx, F, 1);

  if (s.strobe > 0.02) wash(ctx, F, '#ffffff', s.strobe * 0.45, 'screen');

  bloom(ctx, F, 0.45, '#ffffff', 8);
  wash(ctx, F, '#000000', 0.25, 'soft-light'); // crush
  vignette(ctx, F, 0.8);
  grain(ctx, F, 0.26, currentTime, Math.max(1.5, F.w / 700));
  ctx.restore();
}

export default { draw: drawFogStage } satisfies ModeModule;
