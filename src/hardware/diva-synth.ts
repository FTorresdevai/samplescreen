import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { drawPianoKeyboard } from './keyboard-engine';

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill = true,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

export function drawUheDivaSynthesizer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  currentTime: number,
  midi: ParsedMidi,
  activeNotes: MidiNote[],
  analysis: AudioAnalysis,
  settings: VisualizerSettings
) {
  ctx.save();
  const woodW = 32;

  // Chassis Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#08090c';
  roundRect(ctx, x, y, w, h, 6, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Mahogany Wood End Cheeks
  [x, x + w - woodW].forEach((wx, idx) => {
    const woodGrad = ctx.createLinearGradient(wx, y, wx + woodW, y);
    if (idx === 0) {
      woodGrad.addColorStop(0, '#1c0a06');
      woodGrad.addColorStop(0.3, '#3e150d');
      woodGrad.addColorStop(1, '#2c0d08');
    } else {
      woodGrad.addColorStop(0, '#2c0d08');
      woodGrad.addColorStop(0.7, '#3e150d');
      woodGrad.addColorStop(1, '#1c0a06');
    }
    ctx.fillStyle = woodGrad;
    roundRect(ctx, wx, y, woodW, h, 4, true, false);
  });

  const faceX = x + woodW;
  const faceW = w - woodW * 2;
  const faceH = h - 25;

  // Wine-Red Brushed Metallic Faceplate
  const faceGrad = ctx.createLinearGradient(faceX, y, faceX, y + faceH);
  faceGrad.addColorStop(0, '#5a161d');
  faceGrad.addColorStop(0.35, '#430f14');
  faceGrad.addColorStop(1, '#220508');
  ctx.fillStyle = faceGrad;
  ctx.fillRect(faceX, y, faceW, faceH);

  // Top Header Bar
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  const patchTitle = (settings.title || 'ST-909 ANALOG LEAD').toUpperCase();
  ctx.fillText(patchTitle, faceX + faceW / 2, y + 24);

  // Lower Module Section: CRT Amber Scope Screen
  const scopeX = faceX + 16;
  const scopeY = y + 48;
  const scopeW = faceW - 32;
  const scopeH = 140;

  ctx.fillStyle = '#090b10';
  roundRect(ctx, scopeX, scopeY, scopeW, scopeH, 4, true, false);
  ctx.strokeStyle = '#222838';
  ctx.lineWidth = 1;
  roundRect(ctx, scopeX, scopeY, scopeW, scopeH, 4, false, true);

  // CRT Phosphor Waveform
  const wave = analysis.waveform;
  ctx.save();
  ctx.beginPath();
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const norm = i / steps;
    const dIdx = Math.floor(norm * (wave.length - 1));
    const amp = ((wave[dIdx] - 128) / 128) * (scopeH * 0.38) * (settings.audioSensitivity || 1.2);
    const px = scopeX + 10 + norm * (scopeW - 20);
    const py = scopeY + scopeH / 2 + amp;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();

  // Draw 3-Octave Integrated Clean Synth Keyboard
  const kbY = y + scopeH + 65;
  const kbH = h - (scopeH + 85);
  drawPianoKeyboard(
    ctx,
    faceX + 10,
    kbY,
    faceW - 20,
    kbH,
    activeNotes,
    settings,
    {
      skin: 'modern-synth',
      activeColor: settings.notesColor || '#f59e0b',
      glowColor: settings.glowColor || '#f59e0b',
    }
  );

  ctx.restore();
}
