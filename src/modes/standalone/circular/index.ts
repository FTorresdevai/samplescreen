import { ModelDrawContext, ModeModule } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';
import { roundRect } from '../../../shared/canvas-utils';

export const TAU = Math.PI * 2;
export const NEEDLE = -Math.PI / 2;   // the stylus sits at 12 o'clock and never moves

export function polarAngleOf(t: number, loop: number): number {
  return NEEDLE - (t / loop) * TAU;
}

export function polarRotation(now: number, loop: number): number {
  return (now / loop) * TAU;
}

export function polarScreenAngle(t: number, now: number, loop: number): number {
  return polarAngleOf(t, loop) + polarRotation(now, loop);
}

/** Deterministic 0–1 per index, so preview and export draw the same grooves. */
const hash01 = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export const noteRadius = (pitch: number, radius: number) =>
  radius * (0.45 + Math.max(0, Math.min(1, (pitch - 36) / 48)) * 0.45);

/**
 * Polar sequencer as a turning record. The disc (grooves, label, note arcs) rotates clockwise
 * once per loop, so every note reaches the fixed stylus at the exact moment it sounds.
 * Notes are laid out counter-clockwise from 12 o'clock, i.e. upcoming notes wait to the left.
 */
export function drawCircularModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, settings } = context;
  const { centerX: cx, centerY: cy, radius } = region;
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  const notesColor = settings.notesColor || '#f59e0b';
  const accent = settings.accentColor || '#fde047';
  const circleColor = settings.circleColor || '#2b231c';

  const loop = duration > 0 ? duration : 16;
  const now = ((loopTime % loop) + loop) % loop;
  const rotation = polarRotation(now, loop);          // rotationAngle = (time · 2π / loop) mod 2π
  const angleOf = (t: number) => polarAngleOf(t, loop);

  ctx.save();
  if (light) ctx.lineCap = 'round';

  // ---------- Rotating disc ----------
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Platter body
  ctx.fillStyle = hexToRgbaStr(circleColor, light ? 0.12 : 0.28);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = hexToRgbaStr(circleColor, light ? 0.9 : 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Grooves: concentric arcs with irregular gaps, which is what makes the spin readable
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const r = radius * (0.36 + (i / 18) * 0.6);
    ctx.strokeStyle = hexToRgbaStr(light ? ink : circleColor, light ? 0.1 : 0.45 + hash01(i) * 0.25);
    const gap = 0.25 + hash01(i + 40) * 0.6;
    const start = hash01(i + 80) * TAU;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, start + TAU - gap);
    ctx.stroke();
  }

  // Note arcs
  const allNotes = midi.notes || [];
  for (const note of allNotes) {
    const a0 = angleOf(note.time);
    const a1 = angleOf(note.time + note.duration);
    const r = noteRadius(note.midi, radius);
    const isActive = now >= note.time && now < note.time + note.duration;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, a1, a0);
    if (isActive) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      if (!light) {
        ctx.shadowColor = notesColor;
        ctx.shadowBlur = 12;
      }
    } else {
      ctx.strokeStyle = hexToRgbaStr(notesColor, light ? 0.85 : 0.5 + note.velocity * 0.25);
      ctx.lineWidth = 2.5;
    }
    ctx.stroke();
    ctx.restore();
  }

  // Fixed note name tags on arcs, rotating with the disc
  if (settings.noteNameTags !== false) {
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const note of allNotes) {
      const r = noteRadius(note.midi, radius);
      const span = (note.duration / loop) * TAU;
      if (r * span < 22) continue;

      // Chord overlap check: skip if another note at the same instant is higher-pitched within 14px
      const hasClash = allNotes.some(
        other =>
          other !== note &&
          Math.abs(other.time - note.time) < 0.02 &&
          other.midi > note.midi &&
          Math.abs(noteRadius(other.midi, radius) - r) < 14
      );
      if (hasClash) continue;

      const a = angleOf(note.time) - 0.04; // logo a seguir ao início do arco
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r;
      const isActive = now >= note.time && now < note.time + note.duration;
      const label = formatNoteName(note.midi, settings.accidental, settings.middleC);
      const tagW = ctx.measureText(label).width + 8;
      const tagH = 15;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-rotation); // texto sempre na horizontal

      if (isActive) {
        ctx.fillStyle = accent;
        if (!light) {
          ctx.shadowColor = notesColor;
          ctx.shadowBlur = 8;
        }
        roundRect(ctx, -tagW / 2, -tagH / 2, tagW, tagH, 3, true, false);
        ctx.shadowBlur = 0;
        ctx.fillStyle = settings.bgColor || '#0a0502';
      } else {
        ctx.fillStyle = hexToRgbaStr(notesColor, 0.25);
        roundRect(ctx, -tagW / 2, -tagH / 2, tagW, tagH, 3, true, false);
        ctx.fillStyle = ink;
      }
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  // Centre label with one tick per bar, printed title and spindle
  const labelR = radius * 0.3;
  ctx.fillStyle = hexToRgbaStr(notesColor, light ? 0.18 : 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, labelR, 0, TAU);
  ctx.fill();
  const bars = Math.max(1, Math.round(loop / ((60 / (settings.bpm || midi.bpm || 120)) * 4)));
  ctx.strokeStyle = hexToRgbaStr(ink, 0.55);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let b = 0; b < Math.min(bars, 64); b++) {
    const a = angleOf((b / bars) * loop);
    const inner = b === 0 ? labelR * 0.6 : labelR * 0.82;
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * labelR * 0.95, Math.sin(a) * labelR * 0.95);
  }
  ctx.stroke();
  ctx.fillStyle = hexToRgbaStr(ink, 0.7);
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((settings.title || 'SAMPLESCREEN').toUpperCase().slice(0, 16), 0, -labelR * 0.4, labelR * 1.4);
  ctx.fillStyle = settings.bgColor || '#0a0502';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();

  // ---------- Fixed light and stylus ----------
  if (!light) {
    // Static sheen: the light stays put while the grooves turn under it
    const sheen = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  if (!light) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius * 0.32);
  ctx.lineTo(cx, cy - radius - 6);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export default { draw: drawCircularModel } satisfies ModeModule;
