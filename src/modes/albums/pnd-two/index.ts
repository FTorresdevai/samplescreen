import { ModelDrawContext, ModeModule } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { roundRect } from '../../../shared/canvas-utils';
import { AlbumLayout, computeAlbumLayout } from '../_shell/layout';
import { computeKeyboardGeometry } from '../_shell/keyboard';
import { CoverMount, albumEnergy, drawCoverBacking, drawCoverFinish, drawCoverFit, optionalCover, visibleNotes } from '../_shell/waterfall';
import { KeyColors, drawAlbumKeys, noteRect, scopePoints, strokeSmooth } from '../_shell/draw';

/**
 * PARTYNEXTDOOR TWO — quiet, slow, monochrome: white and silver on absolute black.
 * Slow tempo: long, calm fall with soft transparency. Fast or loud: every moving element
 * gains ghost trails (the motion blur of the cover), never colour.
 */
const covers = import.meta.glob<string>('./assets/cover.*', { eager: true, query: '?url', import: 'default' });

const WHITE = '244,246,248';
const SILVER = '200,204,210';

/** Matte black moulding under a faint, cold night light. */
const MOUNT: CoverMount = { frame: ['#2a2b2f', '#060607'], mat: '#000000', light: '200,212,255', lightAlpha: 0.14 };

const KEYS: KeyColors = {
  fallboard: '#050506',
  trim: `rgba(${SILVER},0.55)`,
  white: ['#eceef1', '#c6cad0'],
  whiteActive: ['#ffffff', '#f4f6f8'],
  black: '#0b0b0d',
  blackActive: '#9aa0a8',
  keyLine: 'rgba(0,0,0,0.55)',
  text: `rgb(${SILVER})`,
};

function draw(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, midi, analysis, settings } = context;
  const { x, y, width: w, height: h } = region;
  const layout = computeAlbumLayout(region, context.albumView);
  const bpm = settings.bpm || midi.bpm || 80;
  const energy = albumEnergy(bpm, analysis, settings.audioSensitivity);

  ctx.save();
  ctx.fillStyle = '#000000';
  roundRect(ctx, x, y, w, h, 10, true, false);
  ctx.strokeStyle = `rgba(${SILVER},0.32)`;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10, false, true);

  drawRoom(ctx, context, layout, energy);

  if (layout.isWaveform) {
    drawScope(ctx, context, x + 5, layout.waterfallY, w - 10, layout.waterfallH, energy);
  } else {
    drawWaterfall(ctx, context, layout, bpm, energy);
    drawAlbumKeys(ctx, context, layout, computeKeyboardGeometry(midi, region), KEYS);
  }
  ctx.restore();
}

/** Smoked glass, the cover (or a blurred white figure in its place), the title and a slow sine. */
function drawRoom(ctx: CanvasRenderingContext2D, context: ModelDrawContext, layout: AlbumLayout, energy: number) {
  const { region, currentTime, analysis } = context;
  const { x, y, width: w } = region;
  const { roomH } = layout;

  // Barely visible vertical reflections
  for (let i = 0; i < 5; i++) {
    const bx = x + w * (0.12 + i * 0.19);
    const grad = ctx.createLinearGradient(bx, 0, bx + 70, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.022)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, y + 6, 70, roomH - 12);
  }

  const size = roomH - 44;
  const cx = x + 30;
  const cy = y + 24;
  const blur = Math.max(0, energy - 0.35) / 0.65;   // 0 → 1
  const cover = optionalCover(covers);
  drawCoverBacking(ctx, cx, cy, size, y, MOUNT);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, size, size);
  ctx.clip();
  if (cover) {
    // Ghost copies sliding sideways = the cover's own motion blur
    for (let g = 3; g >= 1; g--) {
      ctx.globalAlpha = 0.16 * blur;
      drawCoverFit(ctx, cover, cx + g * 9 * blur, cy, size);
    }
    ctx.globalAlpha = 1;
    drawCoverFit(ctx, cover, cx, cy, size);
  } else {
    // Placeholder until the cover is added: a white shape with a horizontal smear
    const smear = 10 + blur * 26;
    for (let g = 6; g >= 0; g--) {
      ctx.fillStyle = `rgba(${WHITE},${g === 0 ? 0.9 : 0.07})`;
      const off = g * smear * 0.5;
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.5 + off, cy + size * 0.3, size * 0.15, size * 0.11, 0, 0, Math.PI * 2);   // cap
      ctx.fill();
      ctx.fillRect(cx + size * 0.27 + off, cy + size * 0.46, size * 0.46, size * 0.54);                   // jacket
    }
  }
  ctx.restore();
  drawCoverFinish(ctx, cx, cy, size, MOUNT);

  // Title block
  const tx = cx + size + 44;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = `rgba(${SILVER},0.85)`;
  ctx.fillText('PARTYNEXTDOOR', tx, cy + 26);
  ctx.letterSpacing = '0px';
  ctx.font = '800 76px "Inter", sans-serif';
  ctx.fillStyle = `rgb(${WHITE})`;
  ctx.fillText('TWO', tx - 4, cy + 104);

  // Slow, clean sine that breathes with the level
  const lineW = x + w - 28 - tx;
  const baseY = cy + size - 34;
  const amp = 8 + analysis.rms * 26;
  for (let g = Math.round(blur * 3); g >= 0; g--) {
    ctx.strokeStyle = `rgba(${WHITE},${g === 0 ? 0.9 : 0.14})`;
    ctx.lineWidth = g === 0 ? 1.5 : 3;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const px = tx + (i / 90) * lineW;
      const py = baseY + Math.sin((i / 90) * Math.PI * 4 + currentTime * 1.1 - g * 0.22) * amp * Math.sin((i / 90) * Math.PI);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawWaterfall(ctx: CanvasRenderingContext2D, context: ModelDrawContext, layout: AlbumLayout, bpm: number, energy: number) {
  const { region, midi, settings } = context;
  const { x, width: w } = region;
  const { waterfallY, waterfallH } = layout;
  const geom = computeKeyboardGeometry(midi, region);
  // Slow songs fall slower: the window grows from 2.6 s (≥ 140 BPM) to 3.6 s (≤ 80 BPM)
  const lookahead = 2.6 + Math.max(0, Math.min(1, (140 - bpm) / 60));
  const trail = Math.round(energy * 4);            // ghost copies behind each note
  const trailStep = 6 + energy * 14;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, waterfallY, w - 8, waterfallH);
  ctx.clip();

  // Octave hairlines
  ctx.fillStyle = `rgba(${SILVER},0.10)`;
  geom.whiteKeys.forEach((pitch) => {
    if (pitch % 12 === 0) ctx.fillRect(Math.round(geom.getKeyX(pitch) - geom.whiteW / 2), waterfallY, 1, waterfallH);
  });

  for (const f of visibleNotes(context, lookahead)) {
    const r = noteRect(f, geom, layout, lookahead);
    const alpha = f.isActive ? 1 : 0.5 + f.note.velocity * 0.35;
    for (let g = trail; g >= 1; g--) {
      ctx.fillStyle = `rgba(${WHITE},${(0.16 * (trail - g + 1)) / trail})`;
      ctx.fillRect(r.left - g * 0.5, r.top - g * trailStep, r.width + g, r.height);
    }
    const grad = ctx.createLinearGradient(0, r.top, 0, r.top + r.height);
    grad.addColorStop(0, `rgba(${SILVER},${alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${WHITE},${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(r.left, r.top, r.width, r.height);

    if (f.isActive) {
      // Soft halo at the strike line (a wider, faint bar — no shadowBlur)
      ctx.fillStyle = `rgba(${WHITE},0.14)`;
      ctx.fillRect(r.left - 6, waterfallY + waterfallH - 10, r.width + 12, 10);
      if (settings.noteNameTags !== false) {
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        if (r.height > 16) ctx.fillText(formatNoteName(f.note.midi, settings.accidental, settings.middleC), r.left + r.width / 2, waterfallY + waterfallH - 3);
      }
    }
  }
  ctx.restore();
}

/** Audio view: one clean ice-white trace; ghosts fan out sideways with energy. */
function drawScope(ctx: CanvasRenderingContext2D, context: ModelDrawContext, x: number, y: number, w: number, h: number, energy: number) {
  const { analysis, settings } = context;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = `rgba(${SILVER},0.14)`;
  ctx.fillRect(x + 12, y + h / 2, w - 24, 1);
  for (let i = 1; i < 8; i++) ctx.fillRect(x + (w / 8) * i, y + h / 2 - 4, 1, 8);

  const pts = scopePoints(analysis, x + 12, y, w - 24, h, (settings.audioSensitivity || 1) * 1.6);
  ctx.lineJoin = 'round';
  for (let g = Math.round(energy * 4); g >= 1; g--) {
    ctx.strokeStyle = `rgba(${WHITE},${0.1 + 0.04 * g})`;
    ctx.lineWidth = 2;
    strokeSmooth(ctx, pts, g * (4 + energy * 8), 0);
  }
  ctx.strokeStyle = `rgba(${WHITE},0.22)`;
  ctx.lineWidth = 6;
  strokeSmooth(ctx, pts);
  ctx.strokeStyle = `rgb(${WHITE})`;
  ctx.lineWidth = 2;
  strokeSmooth(ctx, pts);
  ctx.restore();
}

export default { draw } satisfies ModeModule;
