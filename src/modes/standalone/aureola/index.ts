import { ModelDrawContext, ModeModule } from '../../../types';
import { hexToRgbaStr } from '../../../engine/palettes';

/**
 * Chromatic Aureola Halo Visual Model
 * Highly Optimized: Removed shadowBlur from 48-ray and 64-bar loops for lightning-fast 60 FPS export
 */
export function drawAureolaModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, analysis, settings, currentTime } = context;
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
    const curWr = coreR * 0.65 + Math.max(-coreR * 0.35, Math.min(coreR * 0.45, amp));
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


  ctx.restore();
}

export default { draw: drawAureolaModel } satisfies ModeModule;
