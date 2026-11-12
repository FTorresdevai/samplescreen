import { ModelDrawContext, ModeModule } from '../../../types';
import { hexToRgbaStr } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';

export function drawOrbitalMoonModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, analysis, settings, isWaveformMode } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();

  const loopProgress = duration > 0 ? (loopTime % duration) / duration : 0;
  const playheadAngle = loopProgress * Math.PI * 2 - Math.PI / 2;

  // 3D Tilted Elliptical Ring System (Tilt = 22 degrees)
  const ringA = radius * 0.95;
  const ringB = radius * 0.42;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35); // tilt

  // Orbit Guide Lines
  ctx.strokeStyle = hexToRgbaStr(settings.accentColor || '#fde047', 0.25);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, ringA, ringB, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.ellipse(0, 0, ringA * 0.7, ringB * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (isWaveformMode) {
    // ==========================================
    // ORBITAL WAVEFORM MODE
    // ==========================================
    const wave = analysis.waveform;
    const steps = 64;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const dIdx = Math.floor((i / steps) * wave.length);
      const amp = ((wave[dIdx] - 128) / 128) * 35 * (settings.audioSensitivity || 1.2);

      const radX = ringA + amp;
      const radY = ringB + amp * 0.5;
      const px = Math.cos(ang) * radX;
      const py = Math.sin(ang) * radY;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = settings.accentColor || '#fde047';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = settings.notesColor || '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.stroke();

  } else {
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
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', 0.5);
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();
    });

    // 3D Playhead Marker
    const px = Math.cos(playheadAngle) * ringA;
    const py = Math.sin(playheadAngle) * ringB;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 10;
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

        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.fillRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH);

        ctx.fillStyle = '#0a0502';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteName, tagX, tagY);
        ctx.restore();
      });
    }
  }

  ctx.restore(); // restore tilt

  // Center Shaded Moon Sphere
  const moonR = radius * 0.35;
  const moonGrad = ctx.createRadialGradient(cx - moonR * 0.3, cy - moonR * 0.3, 5, cx, cy, moonR);
  moonGrad.addColorStop(0, '#f1f5f9');
  moonGrad.addColorStop(0.4, '#94a3b8');
  moonGrad.addColorStop(0.85, '#334155');
  moonGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default { draw: drawOrbitalMoonModel } satisfies ModeModule;
