import { AudioAnalysis } from '../types';

/**
 * Reusable Waveform & Audio Geometry Engine for SampleScreen
 * Used by all visual models in Waveform Mode
 */

export interface WaveformPoint {
  x: number;
  y: number;
}

/**
 * Calculates a smooth cubic bezier/linear path across a bounding box from time-domain waveform data
 */
export function getWaveformPoints(
  x: number,
  y: number,
  width: number,
  amplitude: number,
  waveData: Uint8Array,
  steps = 80
): WaveformPoint[] {
  const points: WaveformPoint[] = [];
  const len = waveData.length;

  for (let i = 0; i <= steps; i++) {
    const norm = i / steps;
    const dataIdx = Math.floor(norm * (len - 1));
    const val = (waveData[dataIdx] - 128) / 128; // -1.0 to 1.0
    const px = x + norm * width;
    const py = y + val * amplitude;
    points.push({ x: px, y: py });
  }

  return points;
}

/**
 * Draws mirrored vertical spectrum bars (SoundCloud / Studio aesthetic)
 */
export function drawMirroredSpectrumBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  width: number,
  maxHeight: number,
  fftData: Uint8Array,
  numBars = 48,
  barGap = 2,
  colorTop = '#fde047',
  colorBottom = '#f59e0b'
) {
  const barWidth = (width - (numBars - 1) * barGap) / numBars;
  const halfLen = Math.floor(fftData.length / 2);

  for (let b = 0; b < numBars; b++) {
    const bx = x + b * (barWidth + barGap);
    const fftIdx = Math.floor((b / numBars) * halfLen);
    const ampNorm = (fftData[fftIdx] / 255);
    const safeAmp = Number.isFinite(ampNorm) ? ampNorm : 0;
    const h = Math.min(maxHeight, Math.max(3, safeAmp * maxHeight));
    const topY = centerY - h;
    const botY = centerY + h;

    if (!Number.isFinite(bx) || !Number.isFinite(topY) || !Number.isFinite(botY)) {
      continue;
    }

    const grad = ctx.createLinearGradient(bx, topY, bx, botY);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(0.5, colorBottom);
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');

    ctx.fillStyle = grad;
    ctx.fillRect(bx, topY, barWidth, h * 2);
  }
}

/**
 * Draws an intense glowing horizontal oscilloscope beam (phosphor CRT look)
 */
export function drawOscilloscopeBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  width: number,
  amplitude: number,
  waveData: Uint8Array,
  beamColor = '#ffffff',
  glowColor = '#f59e0b'
) {
  const points = getWaveformPoints(x, centerY, width, amplitude, waveData, 100);
  if (points.length === 0) return;

  ctx.save();
  ctx.beginPath();
  points.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });

  ctx.strokeStyle = beamColor;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws vintage analog VU meters with needle deflection
 */
export function drawVintageVuMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  analysis: AudioAnalysis,
  currentTime: number,
  isRightChannel = false
) {
  ctx.save();
  // Bezel
  ctx.fillStyle = '#101218';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#383e50';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);

  // Meter Glass Background
  const glassGrad = ctx.createLinearGradient(x, y, x, y + h);
  glassGrad.addColorStop(0, '#2d2208');
  glassGrad.addColorStop(0.6, '#42330d');
  glassGrad.addColorStop(1, '#1b1404');
  ctx.fillStyle = glassGrad;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

  // Scale Arc
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h + 10, 68, -Math.PI * 0.78, -Math.PI * 0.22);
  ctx.stroke();

  // Label
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 20);

  // Dynamic Needle (driven by RMS, bass, and natural analog ballistics)
  const energy = (isRightChannel ? analysis.treble * 0.6 + analysis.rms * 0.4 : analysis.bass * 0.6 + analysis.rms * 0.4);
  const needleAngle = -Math.PI * 0.5 + (energy - 0.4) * 0.9;
  const needleLen = 58;
  const pivotX = x + w / 2;
  const pivotY = y + h + 6;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(pivotX + Math.cos(needleAngle) * needleLen, pivotY + Math.sin(needleAngle) * needleLen);
  ctx.stroke();
  ctx.restore();
}
