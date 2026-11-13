import { ModelDrawContext, ModeModule } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { roundRect } from '../../../shared/canvas-utils';
import { AlbumLayout, computeAlbumLayout } from '../_shell/layout';
import { computeKeyboardGeometry } from '../_shell/keyboard';
import { CoverMount, albumEnergy, drawCoverBacking, drawCoverFinish, drawCoverFit, hash01, optionalCover, visibleNotes } from '../_shell/waterfall';
import { KeyColors, drawAlbumKeys, noteRect, scopePoints, strokeSmooth } from '../_shell/draw';

/**
 * ASTROWORLD — a fairground at night: gold on deep indigo.
 * Slow tempo: the wheel turns lazily and its lights glow steadily. Fast or loud: the lights
 * chase around the rim and sparks fly off the keys where notes land.
 */
const covers = import.meta.glob<string>('./assets/cover.*', { eager: true, query: '?url', import: 'default' });

const GOLD = '246,196,83';
const CREAM = '255,233,168';
const EMBER = '255,157,46';

/** Brass moulding under a warm fairground spot. */
const MOUNT: CoverMount = { frame: ['#e3c277', '#5a4219'], mat: '#120d06', light: '255,190,110', lightAlpha: 0.32 };

const KEYS: KeyColors = {
  fallboard: '#0b0a1c',
  trim: `rgba(${GOLD},0.6)`,
  white: ['#f6efdc', '#cfc3a2'],
  whiteActive: ['#ffe9a8', '#f6c453'],
  black: '#120f24',
  blackActive: '#ff9d2e',
  keyLine: 'rgba(7,11,31,0.6)',
  text: `rgb(${CREAM})`,
};

function draw(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, midi, analysis, settings } = context;
  const { x, y, width: w, height: h } = region;
  const layout = computeAlbumLayout(region, context.albumView);
  const bpm = settings.bpm || midi.bpm || 80;
  const energy = albumEnergy(bpm, analysis, settings.audioSensitivity);

  ctx.save();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#070b1f');
  sky.addColorStop(0.42, '#1a1338');
  sky.addColorStop(1, '#06060f');
  ctx.fillStyle = sky;
  roundRect(ctx, x, y, w, h, 10, true, false);
  ctx.strokeStyle = `rgba(${GOLD},0.35)`;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10, false, true);

  drawRoom(ctx, context, layout, energy);

  if (layout.isWaveform) {
    drawScope(ctx, context, x + 5, layout.waterfallY, w - 10, layout.waterfallH, energy);
  } else {
    drawWaterfall(ctx, context, layout, energy);
    drawAlbumKeys(ctx, context, layout, computeKeyboardGeometry(midi, region), KEYS);
  }
  ctx.restore();
}

/** Stars, the cover (or a gold gate in its place), the title and the wheel. */
function drawRoom(ctx: CanvasRenderingContext2D, context: ModelDrawContext, layout: AlbumLayout, energy: number) {
  const { region, currentTime, analysis } = context;
  const { x, y, width: w } = region;
  const { roomH } = layout;

  // Stars: fixed positions, slow twinkle
  for (let i = 0; i < 46; i++) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(currentTime * (0.4 + hash01(i + 200)) + i));
    ctx.fillStyle = `rgba(${CREAM},${0.5 * twinkle})`;
    const s = hash01(i + 100) > 0.8 ? 2 : 1;
    ctx.fillRect(x + 10 + hash01(i) * (w - 20), y + 8 + hash01(i + 50) * (roomH - 16), s, s);
  }

  drawBulbs(ctx, context, energy);

  const size = roomH - 44;
  const cx = x + 30;
  const cy = y + 24;
  drawCoverBacking(ctx, cx, cy, size, y, MOUNT);
  const cover = optionalCover(covers);
  if (cover) {
    drawCoverFit(ctx, cover, cx, cy, size);
  } else {
    // Placeholder until the cover is added: a gold gate arch on a dark panel
    ctx.fillStyle = '#0d0a22';
    ctx.fillRect(cx, cy, size, size);
    ctx.strokeStyle = `rgba(${GOLD},0.9)`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx + size / 2, cy + size * 0.56, size * 0.3, Math.PI, 0);
    ctx.lineTo(cx + size * 0.8, cy + size);
    ctx.moveTo(cx + size * 0.2, cy + size * 0.56);
    ctx.lineTo(cx + size * 0.2, cy + size);
    ctx.stroke();
  }
  drawCoverFinish(ctx, cx, cy, size, MOUNT);

  // Title block
  const tx = cx + size + 44;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = `rgba(${CREAM},0.85)`;
  ctx.fillText('TRAVIS SCOTT', tx, cy + 26);
  ctx.letterSpacing = '0px';
  ctx.font = '800 54px "Inter", sans-serif';
  ctx.fillStyle = `rgb(${GOLD})`;
  ctx.fillText('ASTROWORLD', tx - 3, cy + 84, x + w - 28 - tx);

  // The wheel: spokes turn with tempo, rim lights chase with energy
  const r = Math.min(size * 0.3, (x + w - 28 - tx) * 0.24);
  const wx = x + w - 28 - r - 8;
  const wy = cy + size - r - 6;
  const turn = currentTime * (0.15 + energy * 0.9);
  const lights = 20;
  ctx.strokeStyle = `rgba(${GOLD},0.35)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = turn + (i / 10) * Math.PI * 2;
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r);
  }
  ctx.moveTo(wx + r, wy);
  ctx.arc(wx, wy, r, 0, Math.PI * 2);
  ctx.moveTo(wx - r * 0.45, wy + r + 8);   // stand
  ctx.lineTo(wx, wy);
  ctx.lineTo(wx + r * 0.45, wy + r + 8);
  ctx.stroke();
  const head = (currentTime * (2 + energy * 14)) % lights;
  for (let i = 0; i < lights; i++) {
    const a = turn + (i / lights) * Math.PI * 2;
    const behind = (head - i + lights) % lights;                        // 0 = the leading light
    const chase = Math.max(0, 1 - behind / 6) * Math.min(1, energy * 1.6);
    const lit = Math.min(1, 0.45 + chase * 0.55 + analysis.rms * 0.3);
    const px = wx + Math.cos(a) * r;
    const py = wy + Math.sin(a) * r;
    ctx.fillStyle = `rgba(${EMBER},${0.18 * lit})`;
    ctx.beginPath();
    ctx.arc(px, py, 5 + chase * 3, 0, Math.PI * 2);                     // halo disc, no shadowBlur
    ctx.fill();
    ctx.fillStyle = `rgba(${CREAM},${lit})`;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A sagging string of warm bulbs across the top of the room; brighter and faster with energy. */
function drawBulbs(ctx: CanvasRenderingContext2D, context: ModelDrawContext, energy: number) {
  const { region, currentTime, analysis } = context;
  const { x, y, width: w } = region;
  const count = 28;
  const sag = 16;
  ctx.strokeStyle = 'rgba(40,30,20,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = x + 12 + t * (w - 24);
    const py = y + 6 + Math.sin(t * Math.PI) * sag;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  const step = currentTime * (1.5 + energy * 8);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const px = x + 12 + t * (w - 24);
    const py = y + 9 + Math.sin(t * Math.PI) * sag;
    const on = (Math.floor(step) + i) % 3 === 0 ? 1 : 0.55;
    const lit = Math.min(1, on * (0.6 + analysis.rms * 0.6));
    ctx.fillStyle = `rgba(${EMBER},${0.16 * lit})`;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${CREAM},${0.35 + 0.65 * lit})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaterfall(ctx: CanvasRenderingContext2D, context: ModelDrawContext, layout: AlbumLayout, energy: number) {
  const { region, midi, settings } = context;
  const { x, width: w } = region;
  const { waterfallY, waterfallH } = layout;
  const geom = computeKeyboardGeometry(midi, region);
  const strikeY = waterfallY + waterfallH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, waterfallY, w - 8, waterfallH);
  ctx.clip();

  // Octave hairlines
  ctx.fillStyle = `rgba(${GOLD},0.10)`;
  geom.whiteKeys.forEach((pitch) => {
    if (pitch % 12 === 0) ctx.fillRect(Math.round(geom.getKeyX(pitch) - geom.whiteW / 2), waterfallY, 1, waterfallH);
  });

  for (const f of visibleNotes(context)) {
    const r = noteRect(f, geom, layout);
    const alpha = f.isActive ? 1 : 0.55 + f.note.velocity * 0.35;
    const grad = ctx.createLinearGradient(0, r.top, 0, r.top + r.height);
    grad.addColorStop(0, `rgba(${EMBER},${alpha * 0.7})`);
    grad.addColorStop(1, `rgba(${f.isActive ? CREAM : GOLD},${alpha})`);
    ctx.fillStyle = grad;
    roundRect(ctx, r.left, r.top, r.width, r.height, Math.min(3, r.height / 2), true, false);

    if (!f.isActive) continue;
    ctx.fillStyle = `rgba(${EMBER},0.22)`;
    ctx.fillRect(r.left - 6, strikeY - 10, r.width + 12, 10);

    // Sparks: deterministic per note and time, so preview and export match
    const count = Math.round(energy * 7);
    const age = -f.relStart;
    for (let i = 0; i < count; i++) {
      const seed = f.note.midi * 13 + i * 7 + Math.floor(f.note.time * 31);
      const life = 0.35 + hash01(seed) * 0.4;
      const t = ((age + hash01(seed + 1) * life) % life) / life;         // 0 → 1, looping while held
      const sx = r.left + r.width / 2 + (hash01(seed + 2) - 0.5) * (r.width + 40 * t + 20);
      const sy = strikeY - 4 - t * (30 + hash01(seed + 3) * 70) + t * t * 24;
      ctx.fillStyle = `rgba(${CREAM},${(1 - t) * 0.9})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    if (settings.noteNameTags !== false && r.height > 16) {
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#070b1f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatNoteName(f.note.midi, settings.accidental, settings.middleC), r.left + r.width / 2, strikeY - 3);
    }
  }
  ctx.restore();
}

/** Audio view: a gold trace with an ember under-glow that thickens with energy. */
function drawScope(ctx: CanvasRenderingContext2D, context: ModelDrawContext, x: number, y: number, w: number, h: number, energy: number) {
  const { analysis, settings } = context;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = `rgba(${GOLD},0.16)`;
  ctx.fillRect(x + 12, y + h / 2, w - 24, 1);
  for (let i = 1; i < 8; i++) ctx.fillRect(x + (w / 8) * i, y + h / 2 - 4, 1, 8);

  const pts = scopePoints(analysis, x + 12, y, w - 24, h, (settings.audioSensitivity || 1) * 1.6);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${EMBER},${0.12 + energy * 0.2})`;
  ctx.lineWidth = 8 + energy * 10;
  strokeSmooth(ctx, pts);
  ctx.strokeStyle = `rgba(${GOLD},0.9)`;
  ctx.lineWidth = 2.5;
  strokeSmooth(ctx, pts);
  ctx.strokeStyle = `rgb(${CREAM})`;
  ctx.lineWidth = 1;
  strokeSmooth(ctx, pts);
  ctx.restore();
}

export default { draw } satisfies ModeModule;
