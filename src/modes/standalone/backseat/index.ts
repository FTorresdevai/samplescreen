import type { MidiNote, ModelDrawContext, ModelRegion, ModeModule } from '../../../types';
import { getBackdropPhoto, drawPhotoCover } from '../../../shared/backdrop';
import { resolveLook } from '../../../core/mode-resolution';
import manifest from './manifest';
import {
  BeatState, Rect, beatStep, bloom, desaturate, glowDot, grain, hash01, makeCanvas, newBeatState, vignette, wash,
} from '../_film/fx';

/**
 * Backseat: back-seat POV at night.
 *   - Outside (seen through the windshield and the side window): sky, a far skyline with lit windows,
 *     and three parallax layers of bokeh streaks sliding right → left at a speed tied to the BPM.
 *     Hats make the lights twinkle; MIDI note onsets add a light that rides the near layer.
 *   - Inside: headrests, seat backs, door and rear seat as dark silhouettes with a cyan rim from outside,
 *     a sodium streetlight sweep once per bar, and a warm disposable-camera flash on every kick.
 *   - Looks: Tungsten (amber skin light vs cyan night) and Ice (all cold blue, sparkle glints on highs).
 *   - Photo: replaces the scene (slow drift), lights stream across it, same flash and grade.
 * Film pass: halation bloom, grain, vignette; orange date-stamp text (title, BPM · key).
 * All motion is a function of currentTime (plus beat envelopes), so export matches the preview.
 */

const STAMP = '"JetBrains Mono", "Courier New", ui-monospace, monospace';

type Look = 'tungsten' | 'ice';

interface Theme {
  skyTop: string; skyLow: string; city: string; window: string;
  lights: string[]; // "r,g,b"
  rim: string; flash: string; sweep: string; halation: string; stamp: string;
}

const THEMES: Record<Look, Theme> = {
  tungsten: {
    skyTop: '#06141c', skyLow: '#1b5b70', city: '#061015', window: '255,190,110',
    lights: ['255,168,70', '255,236,210', '255,70,60', '80,220,230', '255,96,200'],
    rim: '90,200,220', flash: '#ffb27a', sweep: '255,160,70', halation: '#ff7a3a', stamp: '#ff8a2a',
  },
  ice: {
    skyTop: '#020814', skyLow: '#0f3b6b', city: '#030a14', window: '170,210,255',
    lights: ['170,210,255', '235,246,255', '110,160,255', '200,235,255', '150,190,255'],
    rim: '140,200,255', flash: '#d8ecff', sweep: '150,200,255', halation: '#6fb4ff', stamp: '#9fd0ff',
  },
};

export interface Polygon { pts: [number, number][] }

export interface CarLayout {
  frame: Rect;
  windshield: [number, number][];
  side: [number, number][];
  horizon: number;            // y of the horizon in the windows
  headrests: Rect[];
  seats: Rect[];
  rearSeat: Rect;
  stamp: { x: number; y: number; px: number };
}

/** Interior geometry as fractions of the region. Pure, so it can be unit-tested. */
export function carLayout(region: Pick<ModelRegion, 'x' | 'y' | 'width' | 'height'>): CarLayout {
  const { x, y, width: W, height: H } = region;
  const P = (fx: number, fy: number): [number, number] => [x + fx * W, y + fy * H];
  return {
    frame: { x, y, w: W, h: H },
    windshield: [P(0.03, 0.17), P(0.44, 0.13), P(0.43, 0.42), P(0.03, 0.45)],
    side: [P(0.51, 0.14), P(0.95, 0.09), P(0.97, 0.43), P(0.5, 0.47)],
    horizon: y + H * 0.33,
    headrests: [
      { x: x + W * 0.04, y: y + H * 0.31, w: W * 0.17, h: H * 0.065 },
      { x: x + W * 0.26, y: y + H * 0.305, w: W * 0.17, h: H * 0.065 },
    ],
    seats: [
      { x: x - W * 0.02, y: y + H * 0.39, w: W * 0.26, h: H * 0.4 },
      { x: x + W * 0.22, y: y + H * 0.385, w: W * 0.25, h: H * 0.4 },
    ],
    rearSeat: { x: x - W * 0.05, y: y + H * 0.74, w: W * 1.1, h: H * 0.3 },
    stamp: { x: x + W * 0.94, y: y + H * 0.93, px: Math.max(14, Math.min(W, H) * 0.034) },
  };
}

/** Horizontal position of a looping light: wraps every `span` px as `scroll` grows. Pure. */
export function wrapX(base: number, scroll: number, span: number): number {
  return ((((base - scroll) % span) + span) % span);
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], r: number): void {
  const n = pts.length;
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    ctx.arcTo(a[0], a[1], b[0], b[1], r);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, rad: number): void {
  const k = Math.min(rad, r.w / 2, r.h / 2);
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

interface SeatState { beat: BeatState; flash: number; lastHit: number; buf: HTMLCanvasElement | null }
const states = new WeakMap<object, SeatState>();
const NO_NOTES: MidiNote[] = [];

function stateFor(ctx: CanvasRenderingContext2D): SeatState {
  const key: object = ctx.canvas ?? ctx;
  let s = states.get(key);
  if (!s) { s = { beat: newBeatState(), flash: 0, lastHit: -1, buf: null }; states.set(key, s); }
  return s;
}

/** One horizontal light streak (bokeh smeared by motion). */
function streak(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, stretch: number, rgb: string, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(stretch, 1);
  glowDot(ctx, 0, 0, rad, rgb, alpha);
  ctx.restore();
}

interface Outside { scroll: number; hat: number; t: number; theme: Theme; notes: MidiNote[]; now: number; loop: number }

function drawOutside(ctx: CanvasRenderingContext2D, R: Rect, horizon: number, o: Outside, skyAndCity: boolean): void {
  const { theme, scroll, hat, t } = o;
  const W = R.w;
  if (skyAndCity) {
    const sky = ctx.createLinearGradient(0, R.y, 0, horizon + R.h * 0.15);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(R.x, R.y, R.w, R.h);

    // Far skyline: blocks with lit windows, slow parallax.
    const span = W * 1.5;
    const far = scroll * 0.12;
    for (let k = 0; k < 26; k++) {
      const bw = W * (0.03 + hash01(k * 7 + 1) * 0.05);
      const bh = R.h * (0.03 + hash01(k * 7 + 2) * 0.09);
      const bx = R.x + wrapX(k * (span / 26), far, span) - W * 0.25;
      ctx.fillStyle = theme.city;
      ctx.fillRect(bx, horizon - bh, bw, bh + R.h * 0.2);
      ctx.fillStyle = `rgba(${theme.window},0.8)`;
      const cell = Math.max(2, W * 0.009);
      for (let wy = horizon - bh + cell; wy < horizon - cell; wy += cell * 2.2)
        for (let wx = bx + cell; wx < bx + bw - cell; wx += cell * 2)
          if (hash01(Math.floor(wx * 13 + wy * 7) + k) > 0.62) ctx.fillRect(wx, wy, cell * 0.8, cell * 0.8);
    }
    // Road glow under the horizon
    const road = ctx.createLinearGradient(0, horizon, 0, R.y + R.h);
    road.addColorStop(0, 'rgba(0,0,0,0.2)');
    road.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = road;
    ctx.fillRect(R.x, horizon, R.w, R.y + R.h - horizon);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flick = Math.floor(t * 30);
  const layers = [
    { n: 16, speed: 0.22, yA: -0.03, yB: 0.02, rad: 0.008, alpha: 0.7, stretch: 1.6 },
    { n: 10, speed: 0.5, yA: -0.17, yB: 0.06, rad: 0.035, alpha: 0.7, stretch: 2.2 },
    { n: 7, speed: 1, yA: -0.2, yB: 0.1, rad: 0.075, alpha: 0.75, stretch: 2.8 },
  ];
  layers.forEach((L, li) => {
    const span = W * 1.6;
    for (let k = 0; k < L.n; k++) {
      const seed = li * 100 + k;
      const x = R.x + wrapX(hash01(seed * 3 + 1) * span, scroll * L.speed, span) - W * 0.3;
      const y = horizon + R.h * (L.yA + hash01(seed * 3 + 2) * (L.yB - L.yA));
      const rgb = theme.lights[Math.floor(hash01(seed * 3 + 3) * theme.lights.length)];
      const tw = 0.75 + 0.25 * hat * (hash01(seed * 31 + flick) > 0.5 ? 1 : -0.6);
      streak(ctx, x, y, W * L.rad * (0.7 + hash01(seed * 5) * 0.6), L.stretch, rgb, L.alpha * tw);
    }
  });

  // MIDI: each onset sends a light down the near layer, height by pitch, hue by pitch class.
  if (o.notes.length) {
    const speed = W * 0.9; // matches the near layer at 120 BPM-ish; visually close enough
    const travel = (W * 1.4) / speed;
    for (const n of o.notes) {
      let age = o.now - n.time;
      if (age < 0) age += o.loop;
      if (age < 0 || age > travel) continue;
      const x = R.x + W * 1.05 - age * speed;
      const y = horizon - R.h * (0.02 + ((n.midi % 36) / 36) * 0.16);
      const rgb = theme.lights[n.midi % theme.lights.length];
      streak(ctx, x, y, W * 0.03 * (0.6 + n.velocity * 0.6), 3, rgb, 0.4 + 0.5 * Math.max(0, 1 - age * 4));
    }
  }
  ctx.restore();
}

function drawInterior(ctx: CanvasRenderingContext2D, L: CarLayout, theme: Theme, ambient: number): void {
  const { frame: F } = L;
  // Body of the car: everything except the windows.
  ctx.save();
  ctx.beginPath();
  ctx.rect(F.x, F.y, F.w, F.h);
  poly(ctx, L.windshield, F.w * 0.03);
  poly(ctx, L.side, F.w * 0.04);
  const body = ctx.createLinearGradient(0, F.y, 0, F.y + F.h);
  body.addColorStop(0, '#0b0908');
  body.addColorStop(0.5, '#120e0c');
  body.addColorStop(1, '#070605');
  ctx.fillStyle = body;
  ctx.fill('evenodd');
  ctx.restore();


  // Front seats: backs then headrests with posts.
  for (const s of L.seats) {
    const g = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
    g.addColorStop(0, '#0a0807');
    g.addColorStop(0.75, '#16110e');
    g.addColorStop(1, '#0a0807');
    ctx.fillStyle = g;
    ctx.beginPath();
    roundRect(ctx, s, s.w * 0.22);
    ctx.fill();
    // Soft rim along the top edge, lit from the windows.
    const rim = ctx.createLinearGradient(0, s.y, 0, s.y + s.h * 0.12);
    rim.addColorStop(0, `rgba(${theme.rim},${0.12 + ambient * 0.12})`);
    rim.addColorStop(1, `rgba(${theme.rim},0)`);
    ctx.fillStyle = rim;
    ctx.fill();
  }
  for (const h of L.headrests) {
    ctx.fillStyle = '#0f0c0a';
    ctx.fillRect(h.x + h.w * 0.3, h.y + h.h * 0.8, h.w * 0.06, h.h * 0.5);
    ctx.fillRect(h.x + h.w * 0.64, h.y + h.h * 0.8, h.w * 0.06, h.h * 0.5);
    ctx.beginPath();
    roundRect(ctx, h, h.h * 0.45);
    const g = ctx.createLinearGradient(0, h.y, 0, h.y + h.h);
    g.addColorStop(0, '#1a1410');
    g.addColorStop(1, '#0b0908');
    ctx.fillStyle = g;
    ctx.fill();
    const rim = ctx.createLinearGradient(0, h.y, 0, h.y + h.h * 0.5);
    rim.addColorStop(0, `rgba(${theme.rim},${0.28 + ambient * 0.25})`);
    rim.addColorStop(1, `rgba(${theme.rim},0)`);
    ctx.fillStyle = rim;
    ctx.fill();
  }

  // Door panel line + handle under the side window.
  const sx = L.side[3][0];
  const sy = L.side[3][1];
  ctx.strokeStyle = `rgba(${theme.rim},0.12)`;
  ctx.beginPath();
  ctx.moveTo(sx, sy + F.h * 0.08);
  ctx.quadraticCurveTo(F.x + F.w * 0.75, sy + F.h * 0.05, F.x + F.w, sy + F.h * 0.06);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fillRect(F.x + F.w * 0.7, sy + F.h * 0.12, F.w * 0.12, F.h * 0.008);

  // Rear seat in the foreground: leather with a soft highlight.
  const R = L.rearSeat;
  ctx.beginPath();
  ctx.moveTo(R.x, R.y + R.h * 0.25);
  ctx.quadraticCurveTo(R.x + R.w * 0.5, R.y - R.h * 0.12, R.x + R.w, R.y + R.h * 0.2);
  ctx.lineTo(R.x + R.w, R.y + R.h);
  ctx.lineTo(R.x, R.y + R.h);
  ctx.closePath();
  const seat = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  seat.addColorStop(0, '#2a1d16');
  seat.addColorStop(0.35, '#140e0b');
  seat.addColorStop(1, '#050404');
  ctx.fillStyle = seat;
  ctx.fill();
}

function windowsClip(ctx: CanvasRenderingContext2D, L: CarLayout): void {
  ctx.beginPath();
  poly(ctx, L.windshield, L.frame.w * 0.03);
  poly(ctx, L.side, L.frame.w * 0.04);
  ctx.clip();
}

function drawStamp(ctx: CanvasRenderingContext2D, L: CarLayout, title: string, info: string, color: string): void {
  const { x, y, px } = L.stamp;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = px * 0.5;
  ctx.font = `700 ${Math.round(px)}px ${STAMP}`;
  ctx.fillText(title.toUpperCase(), x, y - px * 1.25);
  ctx.font = `600 ${Math.round(px * 0.8)}px ${STAMP}`;
  ctx.fillText(info.toUpperCase(), x, y);
  ctx.restore();
}

export function drawBackseat(ctx: CanvasRenderingContext2D, context: ModelDrawContext): void {
  const { region, analysis, settings, currentTime, loopTime, duration, midi } = context;
  const look = (resolveLook(manifest, settings.modeLook) || 'tungsten') as Look;
  const theme = THEMES[look];
  const L = carLayout(region);
  const F = L.frame;
  const s = stateFor(ctx);
  const b = beatStep(s.beat, analysis, currentTime, settings.audioSensitivity || 1.2);
  if (b.hit) s.flash = 1;
  else s.flash *= Math.exp(-b.dt / 0.09);
  if (b.dt === 0 && !b.hit) s.flash = 0;

  const bpm = settings.bpm || midi?.bpm || 120;
  const barLen = 240 / bpm;
  const loop = duration > 0 ? duration : midi?.duration || barLen * 4;
  const now = ((loopTime % loop) + loop) % loop;
  const scroll = currentTime * F.w * 0.9 * (bpm / 120);
  const notes = context.albumView === 'midi' ? midi?.notes ?? NO_NOTES : NO_NOTES;
  const outside: Outside = { scroll, hat: b.hat, t: currentTime, theme, notes, now, loop };
  const photo = getBackdropPhoto();

  ctx.save();
  ctx.beginPath();
  ctx.rect(F.x, F.y, F.w, F.h);
  ctx.clip();

  if (photo) {
    const z = 1.06 + 0.02 * Math.sin(currentTime * 0.15) + b.kick * 0.015;
    drawPhotoCover(ctx, photo, F, z, Math.sin(currentTime * 0.11), Math.cos(currentTime * 0.09) * 0.5);
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawOutside(ctx, F, F.y + F.h * 0.45, outside, false);
    ctx.restore();
  } else {
    const down = 8;
    s.buf = s.buf ?? makeCanvas(F.w / down, F.h / down);
    const bctx = s.buf?.getContext('2d');
    ctx.save();
    windowsClip(ctx, L);
    if (s.buf && bctx) {
      const bw = Math.ceil(F.w / down);
      const bh = Math.ceil(F.h / down);
      if (s.buf.width !== bw || s.buf.height !== bh) { s.buf.width = bw; s.buf.height = bh; }
      bctx.setTransform(1 / down, 0, 0, 1 / down, -F.x / down, -F.y / down);
      drawOutside(bctx, F, L.horizon, outside, true);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.buf, F.x, F.y, F.w, F.h);
    } else drawOutside(ctx, F, L.horizon, outside, true);
    // Glass sheen
    const sheen = ctx.createLinearGradient(F.x, F.y + F.h * 0.1, F.x + F.w * 0.6, F.y + F.h * 0.5);
    sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(F.x, F.y, F.w, F.h);
    ctx.restore();
    drawInterior(ctx, L, theme, b.mid);

    // Sodium streetlight sweeping across the cabin once per bar.
    const p = (now / barLen) % 1;
    const sx = F.x + F.w * (1.3 - p * 1.8);
    const sweep = ctx.createLinearGradient(sx - F.w * 0.35, 0, sx + F.w * 0.35, 0);
    sweep.addColorStop(0, `rgba(${theme.sweep},0)`);
    sweep.addColorStop(0.5, `rgba(${theme.sweep},0.16)`);
    sweep.addColorStop(1, `rgba(${theme.sweep},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sweep;
    ctx.fillRect(F.x, F.y, F.w, F.h);
    ctx.restore();
  }

  // Grade
  if (look === 'ice') {
    desaturate(ctx, F, 0.7);
    wash(ctx, F, '#5e9cff', 0.5, 'multiply');
    wash(ctx, F, '#0a1a33', 0.15, 'screen');
  } else {
    wash(ctx, F, '#ff9a4a', 0.16, 'soft-light');
    wash(ctx, F, '#13303a', 0.25, 'screen');
  }

  // Disposable-camera flash: warm (or cold) wash, strongest in the centre.
  if (s.flash > 0.01) {
    wash(ctx, F, theme.flash, s.flash * 0.18, 'screen');
    const cx = F.x + F.w * 0.42;
    const cy = F.y + F.h * 0.7;
    const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(F.w, F.h) * 0.55);
    const { r, g, b: bl } = { r: parseInt(theme.flash.slice(1, 3), 16), g: parseInt(theme.flash.slice(3, 5), 16), b: parseInt(theme.flash.slice(5, 7), 16) };
    fg.addColorStop(0, `rgba(${r},${g},${bl},${s.flash * 0.55})`);
    fg.addColorStop(0.5, `rgba(${r},${g},${bl},${s.flash * 0.25})`);
    fg.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = fg;
    ctx.fillRect(F.x, F.y, F.w, F.h);
    ctx.restore();
  }

  // Ice: sparkle glints on the highs.
  if (look === 'ice' && b.hat > 0.25) {
    const f = Math.floor(currentTime * 12);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(230,245,255,${Math.min(0.9, b.hat)})`;
    ctx.lineWidth = Math.max(1, F.w * 0.002);
    for (let i = 0; i < 6; i++) {
      const gx = F.x + hash01(f * 13 + i) * F.w;
      const gy = F.y + hash01(f * 17 + i) * F.h;
      const gr = F.w * (0.01 + hash01(f * 19 + i) * 0.02) * b.hat;
      ctx.beginPath();
      ctx.moveTo(gx - gr, gy); ctx.lineTo(gx + gr, gy);
      ctx.moveTo(gx, gy - gr); ctx.lineTo(gx, gy + gr);
      ctx.stroke();
      glowDot(ctx, gx, gy, gr * 0.6, '230,245,255', 0.6);
    }
    ctx.restore();
  }

  const info = [`${Math.round(bpm)} BPM`, settings.key].filter(Boolean).join('  ');
  drawStamp(ctx, L, settings.title || 'Untitled', info, theme.stamp);

  bloom(ctx, F, 0.55 + s.flash * 0.3, theme.halation);
  vignette(ctx, F, 0.7);
  grain(ctx, F, 0.1, currentTime, Math.max(1, F.w / 900));
  ctx.restore();
}

export default { draw: drawBackseat } satisfies ModeModule;
