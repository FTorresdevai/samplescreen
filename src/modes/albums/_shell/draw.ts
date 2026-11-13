import { AudioAnalysis, ModelDrawContext } from '../../../types';
import { detectChord } from '../../../engine/chords';
import { AlbumLayout } from './layout';
import { KeyboardGeometry } from './keyboard';
import { ALBUM_LOOKAHEAD_SEC, FallingNote } from './waterfall';

export interface Rect { left: number; top: number; width: number; height: number }

/** Where a falling note sits in the waterfall right now (clipped at the keys). */
export function noteRect(f: FallingNote, geom: KeyboardGeometry, layout: AlbumLayout, lookaheadSec = ALBUM_LOOKAHEAD_SEC): Rect {
  const speed = layout.waterfallH / lookaheadSec;
  const strikeY = layout.waterfallY + layout.waterfallH;
  const width = geom.isWhiteKey(f.note.midi) ? Math.max(14, geom.whiteW * 0.85) : Math.max(10, geom.whiteW * 0.58);
  const top = Math.max(layout.waterfallY, strikeY - f.relEnd * speed);
  const bottom = Math.min(strikeY, strikeY - f.relStart * speed);
  return { left: geom.getKeyX(f.note.midi) - width / 2, top, width, height: Math.max(2, bottom - top) };
}

export interface KeyColors {
  fallboard: string;
  trim: string;                       // thin metal strip and felt line
  white: [string, string];            // top, bottom
  whiteActive: [string, string];
  black: string;
  blackActive: string;
  keyLine: string;
  text: string;                       // chord text on the fallboard
}

/** Fallboard, chord text ("Under keys") and the keys, with the active ones pressed. */
export function drawAlbumKeys(ctx: CanvasRenderingContext2D, context: ModelDrawContext, layout: AlbumLayout, geom: KeyboardGeometry, c: KeyColors) {
  const { region, activeNotes, settings } = context;
  const { pianoY, keyboardH } = layout;
  const { whiteKeys, blackKeys, kbdX, kbdW, whiteW, getKeyX } = geom;
  const fallboardH = 22;
  const keyY = pianoY + fallboardH;
  const whiteH = keyboardH - fallboardH - 6;
  const blackH = Math.round(whiteH * 0.65);
  const blackW = Math.round(whiteW * 0.62);
  const active = new Set(activeNotes.map((n) => n.midi));

  ctx.save();
  ctx.fillStyle = c.fallboard;
  ctx.fillRect(region.x + 5, pianoY, region.width - 10, keyboardH);
  ctx.fillStyle = c.trim;
  ctx.fillRect(kbdX, pianoY + 2, kbdW, 1.5);
  ctx.fillRect(kbdX, keyY - 2, kbdW, 2);

  if (settings.chordDisplay === 'piano') {
    const chord = detectChord(activeNotes, settings.accidental, settings.middleC);
    if (chord?.symbol) {
      ctx.font = '700 12px "Inter", sans-serif';
      ctx.fillStyle = c.text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${chord.symbol}  ·  ${chord.notesFormatted.join(' · ')}`, kbdX + kbdW - 12, pianoY + 12);
    }
  }

  whiteKeys.forEach((pitch, i) => {
    const on = active.has(pitch);
    const kx = kbdX + i * whiteW;
    const ky = on ? keyY + 3 : keyY;
    const [top, bottom] = on ? c.whiteActive : c.white;
    const grad = ctx.createLinearGradient(0, ky, 0, keyY + whiteH);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(kx + 0.5, ky, whiteW - 1, keyY + whiteH - ky);
    ctx.fillStyle = c.keyLine;
    ctx.fillRect(kx + whiteW - 0.5, keyY, 1, whiteH);
  });

  blackKeys.forEach((pitch) => {
    const on = active.has(pitch);
    ctx.fillStyle = on ? c.blackActive : c.black;
    ctx.fillRect(getKeyX(pitch) - blackW / 2, keyY, blackW, on ? blackH - 2 : blackH);
  });
  ctx.restore();
}

/** Time-domain samples as points across the box; `gain` scales the amplitude (1 = full height). */
export function scopePoints(analysis: AudioAnalysis, x: number, y: number, w: number, h: number, gain: number, count = 180): { x: number; y: number }[] {
  const data = analysis.waveform;
  const mid = y + h / 2;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const sample = data.length ? ((data[Math.floor((i / count) * (data.length - 1))] ?? 128) - 128) / 128 : 0;
    const edge = Math.sin((i / count) * Math.PI);   // pinned to the centre line at both ends
    pts.push({ x: x + (i / count) * w, y: mid + Math.max(-1, Math.min(1, sample * gain)) * (h / 2 - 12) * edge });
  }
  return pts;
}

/** Smooth line through the points (quadratic midpoints). */
export function strokeSmooth(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], dx = 0, dy = 0) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i].x + dx, pts[i].y + dy, (pts[i].x + pts[i + 1].x) / 2 + dx, (pts[i].y + pts[i + 1].y) / 2 + dy);
  }
  ctx.stroke();
}
