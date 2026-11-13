import { MidiNote, ModelDrawContext, ModeModule } from '../../../types';

// "Y2K Desktop": a glossy late-2000s desktop. Main window = made-up DAW playlist
// (MIDI notes grouped by register into clips; audio only = one energy track),
// a smaller cam window with a placeholder silhouette, and a CRT/VHS pass on top.

interface Rect { x: number; y: number; w: number; h: number }

export interface PlaylistTrack {
  name: string;
  notes: MidiNote[];
  low: number;   // lowest midi pitch in the track
  high: number;  // highest midi pitch in the track
}

export interface Clip { start: number; end: number } // seconds

const FONT = 'Tahoma, Verdana, "DejaVu Sans", sans-serif';
const ROWS = 10;
const MAX_NOTE_TRACKS = 6;
const ENERGY_BINS = 240;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function registerName(centre: number): string {
  if (centre >= 84) return 'Bell Hi';
  if (centre >= 72) return 'Lead Synth';
  if (centre >= 60) return 'Keys';
  if (centre >= 48) return 'Warm Pad';
  if (centre >= 36) return 'Bass';
  return 'Sub 808';
}

/** One playlist track per used octave (high → low); extra octaves are merged so at most `maxTracks` remain. */
export function groupByRegister(notes: MidiNote[], maxTracks: number = MAX_NOTE_TRACKS): PlaylistTrack[] {
  if (notes.length === 0) return [];
  const octaves = [...new Set(notes.map(n => Math.floor(n.midi / 12)))].sort((a, b) => b - a);
  const groupCount = Math.min(maxTracks, octaves.length);
  const groupOf = new Map<number, number>();
  octaves.forEach((oct, i) => groupOf.set(oct, Math.floor((i * groupCount) / octaves.length)));

  const buckets: MidiNote[][] = Array.from({ length: groupCount }, () => []);
  for (const n of notes) buckets[groupOf.get(Math.floor(n.midi / 12))!].push(n);

  const seen = new Map<string, number>();
  return buckets.map(bucket => {
    const low = Math.min(...bucket.map(n => n.midi));
    const high = Math.max(...bucket.map(n => n.midi));
    const base = registerName((low + high) / 2);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { name: count > 1 ? `${base} #${count}` : base, notes: bucket, low, high };
  });
}

/** Bars that contain notes, merged into contiguous clips (clamped to the loop). */
export function buildClips(notes: MidiNote[], barLen: number, loop: number): Clip[] {
  if (barLen <= 0 || notes.length === 0) return [];
  const barCount = Math.max(1, Math.ceil(loop / barLen - 1e-6));
  const used = new Array<boolean>(barCount).fill(false);
  for (const n of notes) {
    const first = Math.floor(n.time / barLen);
    const last = Math.floor((n.time + Math.max(0, n.duration) - 1e-6) / barLen);
    for (let b = Math.max(0, first); b <= Math.min(barCount - 1, last); b++) used[b] = true;
  }
  const clips: Clip[] = [];
  for (let b = 0; b < barCount; b++) {
    if (!used[b]) continue;
    const start = b;
    while (b + 1 < barCount && used[b + 1]) b++;
    clips.push({ start: start * barLen, end: Math.min(loop, (b + 1) * barLen) });
  }
  return clips;
}

// ---------------------------------------------------------------------------
// Cam feed plug point: call setCamImage() with an <img>/<video>/<canvas> to replace the silhouette.
let camImage: CanvasImageSource | null = null;
export function setCamImage(img: CanvasImageSource | null): void { camImage = img; }

// Audio-only track: energy recorded per timeline bin as the playhead passes (fills in over one loop).
let energyBins = new Float32Array(ENERGY_BINS);
let energyLoop = 0;

// CRT helpers (created lazily; DOM only).
let scanPattern: CanvasPattern | null = null;
let fringeCanvas: HTMLCanvasElement | null = null;

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

function drawCamIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#dfe8f2';
  ctx.beginPath();
  ctx.arc(x + 9, y + 8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20324e';
  ctx.beginPath();
  ctx.arc(x + 9, y + 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fb6ff';
  ctx.beginPath();
  ctx.arc(x + 8, y + 7, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9aa9bc';
  ctx.fillRect(x + 5, y + 15, 8, 3);
}

// ---------------------------------------------------------------------------
// Main window: DAW playlist

interface PlaylistInput {
  tracks: PlaylistTrack[];      // empty → audio-only view
  loop: number;
  now: number;
  barLen: number;
  bpm: number;
  title: string;
  handle: string;
  notesColor: string;
  accent: string;
  energy: number;
  isPlaying: boolean;
}

function drawToolbar(ctx: CanvasRenderingContext2D, r: Rect, p: PlaylistInput): void {
  // Row 1: menus + transport + BPM.
  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(r.x, r.y, r.w, 34);
  ctx.fillStyle = '#d6dbe0';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const menus = ['FILE', 'EDIT', 'ADD', 'CLIPS', 'VIEW', 'OPTIONS', 'TOOLS', 'HELP'];
  let mx = r.x + 12;
  for (const m of menus) {
    ctx.fillText(m, mx, r.y + 17);
    mx += ctx.measureText(m).width + 9;
  }

  // Transport: play / stop / record.
  let tx = mx + 18;
  const ty = r.y + 7;
  ctx.fillStyle = p.isPlaying ? '#e2483b' : '#5b6168';
  ctx.fillRect(tx, ty, 34, 20);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(tx + 13, ty + 5); ctx.lineTo(tx + 23, ty + 10); ctx.lineTo(tx + 13, ty + 15); ctx.closePath();
  ctx.fill();
  tx += 42;
  ctx.fillStyle = '#c9ced4';
  ctx.fillRect(tx + 5, ty + 5, 10, 10);
  tx += 26;
  ctx.fillStyle = '#d44a3a';
  ctx.beginPath();
  ctx.arc(tx + 10, ty + 10, 6, 0, Math.PI * 2);
  ctx.fill();
  tx += 30;

  // BPM LCD.
  ctx.fillStyle = '#15191d';
  ctx.fillRect(tx, ty, 78, 20);
  ctx.strokeStyle = '#596068';
  ctx.strokeRect(tx + 0.5, ty + 0.5, 77, 19);
  ctx.fillStyle = '#e9edf0';
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(p.bpm.toFixed(3), tx + 72, ty + 11);
  ctx.textAlign = 'left';
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = '#9aa3ab';
  ctx.fillText('BPM', tx + 84, ty + 11);
  tx += 116;

  // Song position (bar:beat).
  const beatLen = p.barLen / 4;
  const bar = Math.floor(p.now / p.barLen) + 1;
  const beat = Math.floor((p.now % p.barLen) / beatLen) + 1;
  if (tx + 70 < r.x + r.w - 10) {
    ctx.fillStyle = '#15191d';
    ctx.fillRect(tx, ty, 64, 20);
    ctx.fillStyle = '#ffb347';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${bar}:${String(beat).padStart(2, '0')}`, tx + 32, ty + 11);
  }

  // Row 2: project line.
  const y2 = r.y + 34;
  ctx.fillStyle = '#30353a';
  ctx.fillRect(r.x, y2, r.w, 24);
  ctx.fillStyle = '#aab2ba';
  ctx.font = `11px ${FONT}`;
  ctx.textAlign = 'left';
  const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'untitled';
  ctx.fillText(`|  ${slug}_v2.prj   ${p.handle}`, r.x + 10, y2 + 12, r.w - 20);

  // Row 3: playlist breadcrumb.
  const y3 = y2 + 24;
  ctx.fillStyle = '#26292d';
  ctx.fillRect(r.x, y3, r.w, 24);
  ctx.fillStyle = '#d4d9de';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(`Playlist  ›  Arrangement  ›  ${p.title.toUpperCase()}`, r.x + 12, y3 + 12, r.w - 24);
}

function drawPlaylist(ctx: CanvasRenderingContext2D, inner: Rect, p: PlaylistInput, analysis: ModelDrawContext['analysis']): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();

  ctx.fillStyle = '#2b2f33';
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  drawToolbar(ctx, inner, p);

  const headerW = 118;
  const scrollW = 12;
  const rulerY = inner.y + 82;
  const rulerH = 20;
  const area: Rect = { x: inner.x + headerW, y: rulerY + rulerH, w: inner.w - headerW - scrollW, h: inner.y + inner.h - rulerY - rulerH };
  const rowH = area.h / ROWS;
  const xOf = (t: number): number => area.x + (t / p.loop) * area.w;

  // Ruler with bar numbers.
  ctx.fillStyle = '#3b4046';
  ctx.fillRect(inner.x, rulerY, inner.w, rulerH);
  const bars = Math.max(1, Math.round(p.loop / p.barLen));
  const labelEvery = bars > 16 ? 4 : bars > 8 ? 2 : 1;
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let b = 0; b < bars; b++) {
    const x = xOf(b * p.barLen);
    ctx.fillStyle = '#7d858d';
    ctx.fillRect(x, rulerY + 12, 1, 8);
    if (b % labelEvery === 0) {
      ctx.fillStyle = '#c9cfd5';
      ctx.fillText(String(b + 1), x + 3, rulerY + 8);
    }
  }

  // Track headers + lanes.
  for (let i = 0; i < ROWS; i++) {
    const y = area.y + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? '#34393e' : '#31353a';
    ctx.fillRect(area.x, y, area.w, rowH);
    ctx.fillStyle = '#3d4248';
    ctx.fillRect(inner.x, y, headerW, rowH);
    ctx.fillStyle = '#23272b';
    ctx.fillRect(inner.x, y + rowH - 1, inner.w, 1);
    ctx.fillStyle = '#b8c0c7';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`Track ${i + 1}`, inner.x + 10, y + 12);
    ctx.fillStyle = '#e8ecef';
    ctx.beginPath();
    ctx.arc(inner.x + headerW - 14, y + rowH - 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Beat grid.
  for (let b = 0; b <= bars; b++) {
    ctx.fillStyle = b % 4 === 0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.22)';
    ctx.fillRect(xOf(b * p.barLen), area.y, 1, area.h);
  }

  if (p.tracks.length > 0) {
    p.tracks.forEach((track, i) => {
      if (i >= ROWS) return;
      drawNoteTrack(ctx, track, { x: area.x, y: area.y + i * rowH, w: area.w, h: rowH }, p, xOf);
    });
  } else {
    drawAudioTrack(ctx, { x: area.x, y: area.y, w: area.w, h: rowH }, p, xOf, analysis);
  }

  // Scrollbar.
  ctx.fillStyle = '#25282c';
  ctx.fillRect(area.x + area.w, rulerY, scrollW, inner.y + inner.h - rulerY);
  ctx.fillStyle = '#5b636b';
  ctx.fillRect(area.x + area.w + 2, area.y + 4, scrollW - 4, area.h * 0.55);

  // Red playhead.
  const px = xOf(p.now);
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.moveTo(px - 6, rulerY + 4); ctx.lineTo(px + 6, rulerY + 4); ctx.lineTo(px, rulerY + rulerH); ctx.closePath();
  ctx.fill();
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 8;
  ctx.fillRect(px - 1, rulerY + rulerH, 2, area.h);
  ctx.restore();
}

function drawClipFrame(ctx: CanvasRenderingContext2D, x0: number, x1: number, lane: Rect, label: string): Rect {
  const top = lane.y + 4;
  const h = lane.h - 8;
  ctx.fillStyle = 'rgba(92, 104, 116, 0.55)';
  ctx.fillRect(x0, top, x1 - x0, h);
  ctx.fillStyle = 'rgba(150, 162, 176, 0.75)';
  ctx.fillRect(x0, top, x1 - x0, 13);
  ctx.strokeStyle = 'rgba(15, 18, 22, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, top + 0.5, x1 - x0 - 1, h - 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, top, x1 - x0, 13);
  ctx.clip();
  ctx.fillStyle = '#101418';
  ctx.font = `bold 10px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`▤ ${label}`, x0 + 3, top + 7);
  ctx.restore();
  return { x: x0, y: top + 15, w: x1 - x0, h: h - 18 };
}

function drawNoteTrack(ctx: CanvasRenderingContext2D, track: PlaylistTrack, lane: Rect, p: PlaylistInput, xOf: (t: number) => number): void {
  const clips = buildClips(track.notes, p.barLen, p.loop);
  const span = Math.max(1, track.high - track.low);
  for (const clip of clips) {
    const body = drawClipFrame(ctx, xOf(clip.start), xOf(clip.end), lane, track.name);
    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x, body.y, body.w, body.h);
    ctx.clip();
    for (const n of track.notes) {
      if (n.time + n.duration <= clip.start || n.time >= clip.end) continue;
      const y = body.y + body.h - 2 - ((n.midi - track.low) / span) * (body.h - 4);
      const x0 = xOf(n.time);
      const w = Math.max(2, xOf(n.time + n.duration) - x0 - 1);
      const active = p.now >= n.time && p.now < n.time + n.duration;
      if (active) {
        ctx.fillStyle = p.notesColor;
        ctx.shadowColor = p.notesColor;
        ctx.shadowBlur = 8;
        ctx.fillRect(x0, y - 2, w, 4);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(225, 232, 238, 0.85)';
        ctx.fillRect(x0, y - 1, w, 2);
      }
    }
    ctx.restore();
  }
}

function drawAudioTrack(
  ctx: CanvasRenderingContext2D, lane: Rect, p: PlaylistInput, xOf: (t: number) => number,
  analysis: ModelDrawContext['analysis'],
): void {
  if (energyLoop !== p.loop) {
    energyBins = new Float32Array(ENERGY_BINS);
    energyLoop = p.loop;
  }
  const bin = Math.min(ENERGY_BINS - 1, Math.floor((p.now / p.loop) * ENERGY_BINS));
  if (p.isPlaying) energyBins[bin] = p.energy;

  const body = drawClipFrame(ctx, xOf(0), xOf(p.loop), lane, `Audio  ${p.title}.wav`);
  const mid = body.y + body.h / 2;
  const binW = body.w / ENERGY_BINS;
  for (let i = 0; i < ENERGY_BINS; i++) {
    const half = Math.max(0.5, energyBins[i] * (body.h / 2 - 1));
    ctx.fillStyle = i <= bin ? 'rgba(230, 236, 242, 0.9)' : 'rgba(230, 236, 242, 0.45)';
    ctx.fillRect(body.x + i * binW, mid - half, Math.max(1, binW - 0.5), half * 2);
  }

  // Live scope just behind the playhead.
  const wave = analysis.waveform;
  if (wave && wave.length > 0) {
    const sw = Math.min(90, body.w * 0.15);
    const sx = xOf(p.now) - sw;
    ctx.strokeStyle = p.notesColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(wave.length / 90));
    for (let i = 0, k = 0; i < wave.length; i += step, k++) {
      const x = sx + (k / (wave.length / step)) * sw;
      const y = mid + ((wave[i] - 128) / 128) * (body.h / 2 - 1);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Cam window

function drawCamToolbar(ctx: CanvasRenderingContext2D, r: Rect): void {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#5a86b8');
  g.addColorStop(0.5, '#2f5888');
  g.addColorStop(0.52, '#1f456f');
  g.addColorStop(1, '#2d5a8c');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Round menu orb (generic glossy disc).
  const cx = r.x + 22;
  const cy = r.y + r.h / 2;
  const orb = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 12);
  orb.addColorStop(0, '#ffffff');
  orb.addColorStop(0.35, '#8fc3f0');
  orb.addColorStop(1, '#1c4a7a');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  ctx.fillStyle = '#e7f0fa';
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('▾', cx + 16, cy);
  // Help button.
  const hx = r.x + r.w - 34;
  ctx.beginPath();
  ctx.arc(hx, cy, 9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('?', hx, cy + 1);
  ctx.textAlign = 'left';
  ctx.font = `10px ${FONT}`;
  ctx.fillText('▾', hx + 13, cy);
}

/** Placeholder room + silhouette; an image set via setCamImage() replaces it (cover-fit). */
function drawCamFeed(ctx: CanvasRenderingContext2D, r: Rect, t: number, energy: number, bass: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  if (camImage) {
    const iw = (camImage as { width: number }).width || r.w;
    const ih = (camImage as { height: number }).height || r.h;
    const s = Math.max(r.w / iw, r.h / ih);
    ctx.drawImage(camImage, r.x + (r.w - iw * s) / 2, r.y + (r.h - ih * s) / 2, iw * s, ih * s);
  } else {
    const room = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    room.addColorStop(0, '#0d1f4a');
    room.addColorStop(0.6, '#13306f');
    room.addColorStop(1, '#081433');
    ctx.fillStyle = room;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // Monitor glow on the back wall + LED strip on the right.
    const mon = ctx.createRadialGradient(r.x + r.w * 0.2, r.y + r.h * 0.35, 4, r.x + r.w * 0.2, r.y + r.h * 0.35, r.w * 0.35);
    mon.addColorStop(0, `rgba(110, 170, 255, ${0.35 + energy * 0.25})`);
    mon.addColorStop(1, 'rgba(110, 170, 255, 0)');
    ctx.fillStyle = mon;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = `rgba(90, 150, 255, ${0.5 + energy * 0.5})`;
    ctx.shadowColor = '#5aa0ff';
    ctx.shadowBlur = 24;
    ctx.fillRect(r.x + r.w * 0.86, r.y + r.h * 0.15, 5, r.h * 0.7);
    ctx.shadowBlur = 0;

    // Chair back.
    ctx.fillStyle = '#0a1226';
    rr(ctx, { x: r.x + r.w * 0.2, y: r.y + r.h * 0.42, w: r.w * 0.16, h: r.h * 0.6 }, 14);
    ctx.fill();

    // Head-and-shoulders silhouette with a blue rim light; bobs with the beat.
    const bob = Math.sin(t * 1.3) * 2 + bass * 6;
    const cx = r.x + r.w * 0.52;
    const headY = r.y + r.h * 0.45 + bob;
    const headR = r.h * 0.17;
    ctx.fillStyle = '#05080f';
    ctx.strokeStyle = 'rgba(120, 175, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(90, 150, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(cx - r.w * 0.34, r.y + r.h + 4);
    ctx.bezierCurveTo(cx - r.w * 0.3, headY + headR * 1.9, cx - headR * 1.1, headY + headR * 1.6, cx - headR * 0.45, headY + headR * 1.05);
    ctx.lineTo(cx + headR * 0.45, headY + headR * 1.05);
    ctx.bezierCurveTo(cx + headR * 1.1, headY + headR * 1.6, cx + r.w * 0.3, headY + headR * 1.9, cx + r.w * 0.34, r.y + r.h + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.85, headR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // REC tag + timecode.
  const blink = Math.floor(t * 1.5) % 2 === 0;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(r.x + 18, r.y + 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('REC', r.x + 28, r.y + 19);
  const secs = Math.floor(t);
  const tc = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * 30)).padStart(2, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillText(tc, r.x + r.w - 12, r.y + r.h - 16);
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

/** Red copy nudged right, blue copy nudged left (additive, low alpha). */
function drawChromaticFringe(ctx: CanvasRenderingContext2D, r: Rect, shift: number): void {
  if (typeof document === 'undefined') return;
  const m = ctx.getTransform();
  const sx = r.x * m.a + m.e;
  const sy = r.y * m.d + m.f;
  const sw = Math.round(r.w * m.a);
  const sh = Math.round(r.h * m.d);
  if (sw <= 0 || sh <= 0) return;
  if (!fringeCanvas) fringeCanvas = document.createElement('canvas');
  if (fringeCanvas.width !== sw || fringeCanvas.height !== sh) {
    fringeCanvas.width = sw;
    fringeCanvas.height = sh;
  }
  const f = fringeCanvas.getContext('2d');
  if (!f) return;
  for (const [tint, dx] of [['#ff0000', shift], ['#0000ff', -shift]] as const) {
    f.globalCompositeOperation = 'copy';
    f.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    f.globalCompositeOperation = 'multiply';
    f.fillStyle = tint;
    f.fillRect(0, 0, sw, sh);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14;
    ctx.drawImage(fringeCanvas, r.x + dx, r.y, r.w, r.h);
    ctx.restore();
  }
}

function drawCrtPass(ctx: CanvasRenderingContext2D, r: Rect, t: number, energy: number): void {
  drawChromaticFringe(ctx, r, 2 + energy * 2);

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
  const notes = midi?.notes ?? [];
  const title = settings.title?.trim() || 'Untitled';

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  drawWallpaper(ctx, r, currentTime, energy);

  const mainWin: Rect = { x: r.x + 18, y: r.y + 40, w: r.w - 36, h: Math.round(r.h * 0.62) };
  const inner = drawGlassWindow(ctx, mainWin, `${title} - Playlist`, (x, y) => drawAppIcon(ctx, x, y));
  drawPlaylist(ctx, inner, {
    tracks: groupByRegister(notes),
    loop, now, barLen, bpm, title,
    handle: settings.producerHandle || '',
    notesColor: settings.notesColor || '#7fd1ff',
    accent: '#ff3b2f',
    energy,
    isPlaying: currentTime > 0,
  }, analysis);

  const camTop = mainWin.y + mainWin.h - 70;
  const camWin: Rect = { x: r.x + r.w * 0.15, y: camTop, w: r.w * 0.68, h: r.y + r.h - camTop + 30 };
  const handle = (settings.producerHandle || '').replace(/^@/, '');
  const camInner = drawGlassWindow(ctx, camWin, `${handle || 'Producer'} Cam`, (x, y) => drawCamIcon(ctx, x, y));
  drawCamToolbar(ctx, { x: camInner.x, y: camInner.y, w: camInner.w, h: 38 });
  drawCamFeed(ctx, { x: camInner.x, y: camInner.y + 38, w: camInner.w, h: camInner.h - 38 }, currentTime, energy, analysis?.bass ?? 0);

  drawCrtPass(ctx, r, currentTime, energy);
  ctx.restore();
}

export default { draw: drawAeroDesktop } satisfies ModeModule;
