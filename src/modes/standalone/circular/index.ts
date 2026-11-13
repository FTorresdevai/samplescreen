import { ModelDrawContext, ModeModule } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';
import { roundRect } from '../../../shared/canvas-utils';

export function drawCircularModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, analysis, settings } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  if (light) ctx.lineCap = 'round';

  const loopProgress = duration > 0 ? (loopTime % duration) / duration : 0;
  const playheadAngle = loopProgress * Math.PI * 2 - Math.PI / 2;

  // Vinyl Grooves Outer Edge
  ctx.strokeStyle = hexToRgbaStr(settings.circleColor || '#2b231c', light ? 0.9 : 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // ==========================================
  // CIRCULAR PIANO ROLL (MIDI NOTES)
  // ==========================================
  const allNotes = midi.notes || [];

  allNotes.forEach(note => {
    const startAngle = (note.time / duration) * Math.PI * 2 - Math.PI / 2;
    const spanAngle = (note.duration / duration) * Math.PI * 2;
    const pitchNorm = (note.midi - 36) / 48; // normalize
    const noteR = radius * (0.45 + Math.max(0, Math.min(1, pitchNorm)) * 0.45);

    const isActive = loopTime >= note.time && loopTime < note.time + note.duration;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, noteR, startAngle, startAngle + spanAngle);

    if (isActive) {
      ctx.strokeStyle = settings.accentColor || '#fde047';
      ctx.lineWidth = 4.5;
      if (!light) {
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 12;
      }
    } else {
      ctx.strokeStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', light ? 0.85 : 0.5);
      ctx.lineWidth = 2.5;
    }
    ctx.stroke();
    ctx.restore();
  });

  // Rotating 360 Playhead Needle
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  if (!light) {
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(playheadAngle) * radius, cy + Math.sin(playheadAngle) * radius);
  ctx.stroke();
  ctx.restore();

  // Floating Note Name Tags along the rotating playhead needle
  if (settings.noteNameTags !== false && context.activeNotes && context.activeNotes.length > 0) {
    context.activeNotes.forEach(note => {
      const pitchNorm = (note.midi - 36) / 48;
      const noteR = radius * (0.45 + Math.max(0, Math.min(1, pitchNorm)) * 0.45);
      const tagX = cx + Math.cos(playheadAngle) * noteR + Math.cos(playheadAngle + Math.PI / 2) * 16;
      const tagY = cy + Math.sin(playheadAngle) * noteR + Math.sin(playheadAngle + Math.PI / 2) * 16;
      const noteName = formatNoteName(note.midi, settings.accidental, settings.middleC);

      ctx.save();
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      const tm = ctx.measureText(noteName);
      const tagW = tm.width + 8;
      const tagH = 16;

      ctx.fillStyle = settings.accentColor || '#fde047';
      if (!light) {
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 8;
      }
      roundRect(ctx, tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, 3, true, false);

      ctx.fillStyle = settings.bgColor || '#0a0502';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteName, tagX, tagY);
      ctx.restore();
    });
  }

  ctx.restore();
}

export default { draw: drawCircularModel } satisfies ModeModule;
