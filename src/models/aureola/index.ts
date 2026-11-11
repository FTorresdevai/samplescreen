import { ModelDrawContext } from '../../types';
import { hexToRgbaStr } from '../../engine/palettes';
import { formatNoteName } from '../../engine/chords';

/**
 * Chromatic Aureola Halo Visual Model
 * Highly Optimized: Removed shadowBlur from 48-ray and 64-bar loops for lightning-fast 60 FPS export
 */
export function drawAureolaModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, analysis, settings, isWaveformMode, currentTime } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();

  const bassPulse = analysis.bass * (settings.audioSensitivity || 1.2);
  const midPulse = analysis.mid * (settings.audioSensitivity || 1.2);
  const loopDuration = duration || 16;
  const currentLoopTime = loopTime % loopDuration;
  const loopProgress = currentLoopTime / loopDuration;
  const playheadAngle = loopProgress * Math.PI * 2 - Math.PI / 2;

  // 1. MASSIVE COLORFUL AURA BLOOM (Single high-impact radial gradient, zero per-ray shadow cost)
  const haloBloomR = radius * 1.35 + bassPulse * 45;
  const auraGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, haloBloomR);
  auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  auraGrad.addColorStop(0.2, hexToRgbaStr(settings.accentColor || '#fde047', 0.4 + bassPulse * 0.2));
  auraGrad.addColorStop(0.5, hexToRgbaStr(settings.notesColor || '#f43f5e', 0.28));
  auraGrad.addColorStop(0.75, hexToRgbaStr(settings.glowColor || '#ec4899', 0.15));
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, haloBloomR, 0, Math.PI * 2);
  ctx.fill();

  // 2. ROTATING PRISMATIC RAY CORONA (Optimized: crisp dynamic strokes without shadowBlur)
  const numRays = 36;
  const rot = currentTime * 0.3;
  ctx.save();
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + rot;
    const fftIdx = Math.floor((i / numRays) * (analysis.fft.length / 2));
    const fftAmp = (analysis.fft[fftIdx] / 255) * 45 * (settings.audioSensitivity || 1.2);

    const rInner = radius * 0.45;
    const rOuter = radius * 1.02 + fftAmp;

    const x1 = cx + Math.cos(angle) * rInner;
    const y1 = cy + Math.sin(angle) * rInner;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;

    const hue = ((i / numRays) * 360 + currentTime * 20) % 360;
    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.25 + (analysis.fft[fftIdx] / 255) * 0.6})`;
    ctx.lineWidth = i % 4 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // 3. FLUID AUREOLA RIPPLE (Organic Harmonic Wave)
  const wavePoints = 64;
  const baseWaveR = radius * 0.85;
  ctx.save();
  ctx.beginPath();
  for (let j = 0; j <= wavePoints; j++) {
    const ang = (j / wavePoints) * Math.PI * 2;
    const harm1 = Math.sin(ang * 6 + currentTime * 3.8) * (bassPulse * 22);
    const harm2 = Math.cos(ang * 9 - currentTime * 2.5) * (midPulse * 14);
    const curR = baseWaveR + harm1 + harm2;

    const px = cx + Math.cos(ang) * curR;
    const py = cy + Math.sin(ang) * curR;
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  if (isWaveformMode) {
    // ==========================================
    // WAVEFORM MODE: CENTER OSCILLOSCOPE PRISM
    // ==========================================
    const coreR = radius * 0.35;
    const waveData = analysis.waveform;
    const wSteps = 60;

    ctx.save();
    ctx.beginPath();
    for (let k = 0; k <= wSteps; k++) {
      const wAngle = (k / wSteps) * Math.PI * 2;
      const dIdx = Math.floor((k / wSteps) * waveData.length);
      const amp = ((waveData[dIdx] - 128) / 128) * (coreR * 0.4) * (settings.audioSensitivity || 1.2);
      const curWr = coreR * 0.65 + amp;
      const wx = cx + Math.cos(wAngle) * curWr;
      const wy = cy + Math.sin(wAngle) * curWr;
      if (k === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // Center jewel core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + bassPulse * 6, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // ==========================================
    // PIANO MODE: CHROMATIC ORBIT RINGS & NOTES
    // ==========================================
    const allNotes = midi.notes || [];
    const ringRadii = [radius * 0.48, radius * 0.64, radius * 0.80, radius * 0.94];

    // Orbit guides
    ringRadii.forEach(r => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    allNotes.forEach(note => {
      const noteStart = (note.time / loopDuration) * Math.PI * 2 - Math.PI / 2;
      const noteSpan = (note.duration / loopDuration) * Math.PI * 2;
      const trackIdx = Math.max(0, Math.min(3, Math.floor(((note.midi - 36) / 48) * 4)));
      const trackR = ringRadii[trackIdx];

      const isActive = currentLoopTime >= note.time && currentLoopTime < note.time + note.duration;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, trackR, noteStart, noteStart + noteSpan);
      if (isActive) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4.5;
      } else {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();
    });

    // Playhead Needle
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(playheadAngle) * (radius * 0.98), cy + Math.sin(playheadAngle) * (radius * 0.98));
    ctx.stroke();
    ctx.restore();

    // Floating Note Name Tags along the rotating playhead needle
    if (settings.noteNameTags !== false && context.activeNotes && context.activeNotes.length > 0) {
      context.activeNotes.forEach(note => {
        const pitchNorm = (note.midi - 36) / 48;
        const noteR = radius * (0.48 + Math.max(0, Math.min(1, pitchNorm)) * 0.46);
        const tagX = cx + Math.cos(playheadAngle) * noteR + Math.cos(playheadAngle + Math.PI / 2) * 16;
        const tagY = cy + Math.sin(playheadAngle) * noteR + Math.sin(playheadAngle + Math.PI / 2) * 16;
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

  ctx.restore();
}
