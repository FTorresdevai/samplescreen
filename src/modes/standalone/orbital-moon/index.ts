import { ModelDrawContext, ModeModule } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';

export function drawOrbitalMoonModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, analysis, settings } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  if (light) ctx.lineCap = 'round';

  const loopProgress = duration > 0 ? (loopTime % duration) / duration : 0;
  const playheadAngle = loopProgress * Math.PI * 2 - Math.PI / 2;

  // 3D Tilted Elliptical Ring System (Tilt = 22 degrees)
  const ringA = radius * 0.95;
  const ringB = radius * 0.42;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35); // tilt

  // ==========================================
  // ORBITAL MIDI BELTS
  // ==========================================
  const allNotes = midi.notes || [];

  allNotes.forEach(note => {
    const noteAng = (note.time / duration) * Math.PI * 2 - Math.PI / 2;
    const noteSpan = (note.duration / duration) * Math.PI * 2;
    const pitchNorm = (note.midi - 36) / 48;
    const trackA = ringA * (0.65 + pitchNorm * 0.35);
    const trackB = ringB * (0.65 + pitchNorm * 0.35);

    const isActive = loopTime >= note.time && loopTime < note.time + note.duration;

    ctx.save();
    ctx.beginPath();
    // Draw small arc along ellipse
    for (let s = 0; s <= 10; s++) {
      const a = noteAng + (s / 10) * noteSpan;
      const ex = Math.cos(a) * trackA;
      const ey = Math.sin(a) * trackB;
      if (s === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
    }

    if (isActive) {
      ctx.strokeStyle = settings.accentColor || '#fde047';
      ctx.lineWidth = 4;
      if (!light) {
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 12;
      }
    } else {
      ctx.strokeStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', light ? 0.85 : 0.5);
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    ctx.restore();
  });

  // 3D Playhead Marker
  const px = Math.cos(playheadAngle) * ringA;
  const py = Math.sin(playheadAngle) * ringB;
  ctx.fillStyle = ink;
  if (!light) {
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Floating Note Name Tags
  if (settings.noteNameTags !== false && context.activeNotes && context.activeNotes.length > 0) {
    context.activeNotes.forEach(note => {
      const pitchNorm = (note.midi - 36) / 48;
      const trackA = ringA * (0.65 + Math.max(0, Math.min(1, pitchNorm)) * 0.35);
      const trackB = ringB * (0.65 + Math.max(0, Math.min(1, pitchNorm)) * 0.35);
      const tagX = Math.cos(playheadAngle) * trackA + 14;
      const tagY = Math.sin(playheadAngle) * trackB - 10;
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
      ctx.fillRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH);

      ctx.fillStyle = settings.bgColor || '#0a0502';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteName, tagX, tagY);
      ctx.restore();
    });
  }

  ctx.restore(); // restore tilt

  // Center Shaded Moon Sphere
  const moonR = radius * 0.35;
  const moonGrad = ctx.createRadialGradient(cx - moonR * 0.3, cy - moonR * 0.3, 5, cx, cy, moonR);
  if (light) {
    // Printed look: the moon is a two-tone disc in the palette's own colours
    moonGrad.addColorStop(0, settings.circleColor || '#b9bfb5');
    moonGrad.addColorStop(1, hexToRgbaStr(ink, 0.9));
  } else {
    moonGrad.addColorStop(0, '#f1f5f9');
    moonGrad.addColorStop(0.4, '#94a3b8');
    moonGrad.addColorStop(0.85, '#334155');
    moonGrad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default { draw: drawOrbitalMoonModel } satisfies ModeModule;
