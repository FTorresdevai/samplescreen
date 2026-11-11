import { ModelDrawContext } from '../../types';
import { hexToRgbaStr } from '../../engine/palettes';

export function drawCircularModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, analysis, settings, isWaveformMode } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();

  const loopProgress = duration > 0 ? (loopTime % duration) / duration : 0;
  const playheadAngle = loopProgress * Math.PI * 2 - Math.PI / 2;

  // Vinyl Grooves Outer Edge
  ctx.strokeStyle = hexToRgbaStr(settings.circleColor || '#2b231c', 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Concentric Pitch Rings
  const rings = [radius * 0.45, radius * 0.65, radius * 0.85];
  rings.forEach(r => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  if (isWaveformMode) {
    // ==========================================
    // CIRCULAR WAVEFORM MODE
    // ==========================================
    const waveData = analysis.waveform;
    const waveR = radius * 0.65;
    const steps = 72;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dataIdx = Math.floor((i / steps) * waveData.length);
      const amp = ((waveData[dataIdx] - 128) / 128) * (radius * 0.28) * (settings.audioSensitivity || 1.2);
      const r = waveR + amp;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = settings.accentColor || '#fde047';
    ctx.lineWidth = 3;
    ctx.shadowColor = settings.notesColor || '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Center Pulsing Orb
    const orbR = 25 + analysis.bass * 20;
    const orbGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, orbR);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.6, settings.accentColor || '#fde047');
    orbGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fill();

  } else {
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
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', 0.5);
        ctx.lineWidth = 2.5;
      }
      ctx.stroke();
      ctx.restore();
    });

    // Rotating 360 Playhead Needle
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(playheadAngle) * radius, cy + Math.sin(playheadAngle) * radius);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
