import { roundRect } from '../shared/canvas-utils';
import { getCachedImage } from '../shared/assets';
import { AudioAnalysis } from '../types';

export interface TapeMachineOptions {
  currentTime?: number;
  analysis?: AudioAnalysis;
  bpm?: number;
}

/**
 * Studio Master Tape Machine (Photo-Based + Real Analog Mechanical Motion)
 * Renders the authentic Softube / Studer Tape Mark II hardware console
 * inside Slot 1 (w: 960, h: 570) with luxury chassis framing,
 * spinning NAB reel flanges in perspective, and ballistic analog VU needles.
 */
export function drawStudioTapeMachine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorTheme: 'gold' | 'crimson' | string = 'gold',
  options?: TapeMachineOptions
) {
  const tapeMachineImg = getCachedImage('images/tape_machine.jpg');

  ctx.save();

  const isGold = colorTheme !== 'crimson';
  const bezelColor = isGold ? 'rgba(212, 175, 55, 0.45)' : 'rgba(239, 68, 68, 0.45)';

  // 1. Outer Chassis Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#06080c';
  roundRect(ctx, x, y, w, h, 10, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 2. Metallic Bezel Border with album theme color
  ctx.strokeStyle = bezelColor;
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 10, false, true);

  // 3. Inner Clipped Frame for the Photo & Mechanical Overlays
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8, false, false);
  ctx.clip();

  if (tapeMachineImg && tapeMachineImg.complete && tapeMachineImg.naturalWidth > 0) {
    const img = tapeMachineImg;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgAspect > targetAspect) {
      sw = img.naturalHeight * targetAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetAspect;
      sy = (img.naturalHeight - sh) / 2;
    }

    // A. Draw Base Photorealistic Console
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

    // Helpers to convert image pixel coordinates to canvas space
    const toCanvasX = (ix: number) => x + ((ix - sx) / sw) * w;
    const toCanvasY = (iy: number) => y + ((iy - sy) / sh) * h;
    const toCanvasW = (iw: number) => (iw / sw) * w;
    const toCanvasH = (ih: number) => (ih / sh) * h;

    const time = options?.currentTime ?? 0;
    const analysis = options?.analysis;
    const bass = analysis?.bass ?? 0.2;
    const rms = analysis?.rms ?? 0.2;

    // B. OVERLAY 1: DYNAMIC ROTATING NAB TAPE REELS (Supply & Take-up in perspective)
    // Left Reel (Anodized Red) Center ~ (ix: 172, iy: 88)
    const lReelX = toCanvasX(172);
    const lReelY = toCanvasY(88);
    // Right Reel (Brushed Silver) Center ~ (ix: 456, iy: 88)
    const rReelX = toCanvasX(456);
    const rReelY = toCanvasY(88);
    const reelRadiusX = toCanvasW(92); // ~165px

    const rotSpeed = 3.8; // 15 IPS realistic spin
    const leftAngle = time * rotSpeed;
    const rightAngle = time * rotSpeed * 1.04;

    // Draw Left Reel Rotating Spoke Highlights & Cutouts
    drawRotatingReelSpokes(ctx, lReelX, lReelY, reelRadiusX, leftAngle, '#991b1b', '#f87171', '#450a0a');
    // Draw Right Reel Rotating Spoke Highlights & Cutouts
    drawRotatingReelSpokes(ctx, rReelX, rReelY, reelRadiusX, rightAngle, '#94a3b8', '#f8fafc', '#1e293b');

    // C. OVERLAY 2: BALLISTIC ANALOG VU METERS WITH BOUNCING PHYSICAL NEEDLES
    // Left VU Meter Face: ix: 78, iy: 196, iw: 114, ih: 67
    const lVuX = toCanvasX(78);
    const lVuY = toCanvasY(196);
    const lVuW = toCanvasW(114);
    const lVuH = toCanvasH(67);

    // Right VU Meter Face: ix: 216, iy: 196, iw: 114, ih: 67
    const rVuX = toCanvasX(216);
    const rVuY = toCanvasY(196);
    const rVuW = toCanvasW(114);
    const rVuH = toCanvasH(67);

    // Ballistic response calculation (Left = Kick / Sub dominant, Right = Master RMS)
    const leftVuLevel = Math.min(1.15, Math.max(0, bass * 1.35 + rms * 0.35));
    const rightVuLevel = Math.min(1.15, Math.max(0, rms * 1.25 + (analysis?.mid ?? 0.2) * 0.4));

    drawDynamicVuFace(ctx, lVuX, lVuY, lVuW, lVuH, leftVuLevel, 'LEFT', bass);
    drawDynamicVuFace(ctx, rVuX, rVuY, rVuW, rVuH, rightVuLevel, 'RIGHT', bass);

    // D. OVERLAY 3: INCANDESCENT TYPE [A] BUTTON TUBE WARMTH
    // Button [A] is located at ix: 398, iy: 218 in photo
    const btnAX = toCanvasX(398);
    const btnAY = toCanvasY(218);
    const btnAW = toCanvasW(18);
    const btnAH = toCanvasH(16);
    if (bass > 0.55) {
      const glowAlpha = Math.min(0.65, (bass - 0.45) * 1.5);
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${glowAlpha})`;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      roundRect(ctx, btnAX, btnAY, btnAW, btnAH, 3, true, false);
      ctx.restore();
    }

    // E. Subtle Glass Sheen Reflection across top half
    const sheen = ctx.createLinearGradient(x, y, x + w, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h * 0.45);

    // Bottom bezel glow
    const themeGlow = ctx.createLinearGradient(x, y + h - 18, x, y + h);
    themeGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    themeGlow.addColorStop(1, isGold ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)');
    ctx.fillStyle = themeGlow;
    ctx.fillRect(x, y + h - 18, w, 18);
  } else {
    // Dark metallic brushed fallback while photo loads
    const fbGrad = ctx.createLinearGradient(x, y, x, y + h);
    fbGrad.addColorStop(0, '#1c1f28');
    fbGrad.addColorStop(0.5, '#12141c');
    fbGrad.addColorStop(1, '#090a0f');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(x, y, w, h);

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = isGold ? '#d4af37' : '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('• TAPE MACHINE MARK II •', x + w / 2, y + h / 2);
  }

  ctx.restore(); // remove inner clip
  ctx.restore(); // remove chassis save
}

/**
 * Draws the rotating aluminum NAB reel flange cutouts under realistic perspective tilt.
 * Replicates the physical 3-spoke / 6-hole metal cutouts and highlights as they spin.
 */
function drawRotatingReelSpokes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  angle: number,
  baseColor: string,
  highlightColor: string,
  voidColor: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  // Match the exact top-down camera perspective of the Softube console
  ctx.scale(1.0, 0.44);

  // Rotate cutouts and metallic specular reflections
  ctx.rotate(angle);

  const numHoles = 3;
  const holeRadius = rx * 0.22;
  const holeDistance = rx * 0.54;

  for (let i = 0; i < numHoles; i++) {
    const spokeAngle = (i * Math.PI * 2) / numHoles;
    const hx = Math.cos(spokeAngle) * holeDistance;
    const hy = Math.sin(spokeAngle) * holeDistance;

    // Cutout hole (revealing underlying dark wound magnetic tape)
    ctx.fillStyle = voidColor;
    ctx.beginPath();
    ctx.arc(hx, hy, holeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Metallic beveled lip around the cutout hole
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(hx, hy, holeRadius, spokeAngle, spokeAngle + Math.PI);
    ctx.stroke();

    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hx, hy, holeRadius, spokeAngle + Math.PI, spokeAngle + Math.PI * 2);
    ctx.stroke();
  }

  // Inner hub rim
  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  // Outer flange rim highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 0.94, -0.4, 1.2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders an authentic analog VU Meter Face with physical ballistic needle,
 * scale calibrations (-20 to +3 dB), warm backlit lamp glow, and peak overload flasher.
 */
function drawDynamicVuFace(
  ctx: CanvasRenderingContext2D,
  mx: number,
  my: number,
  mw: number,
  mh: number,
  level: number,
  channelLabel: string,
  bassEnergy: number
) {
  ctx.save();

  // Clip strictly inside the VU meter glass frame
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 4, false, false);
  ctx.clip();

  // 1. Warm Incandescent Backlit Lamp Gradient
  const lampGlow = 0.88 + Math.min(0.25, bassEnergy * 0.22);
  const faceGrad = ctx.createRadialGradient(
    mx + mw * 0.5, my + mh * 0.85, 8,
    mx + mw * 0.5, my + mh * 0.6, mw * 0.85
  );
  faceGrad.addColorStop(0, `rgba(255, 175, 45, ${lampGlow})`);
  faceGrad.addColorStop(0.55, `rgba(235, 130, 20, ${lampGlow * 0.95})`);
  faceGrad.addColorStop(1, 'rgba(150, 60, 5, 0.98)');
  ctx.fillStyle = faceGrad;
  ctx.fillRect(mx, my, mw, mh);

  // 2. Vintage Printed Scale Markings
  const pivotX = mx + mw * 0.5;
  const pivotY = my + mh * 1.48; // Pivot is located below the meter frame
  const arcRadius = mh * 1.15;

  // Black calibration arc (-20 to 0 dB)
  ctx.strokeStyle = '#1e1b18';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, arcRadius, -Math.PI * 0.72, -Math.PI * 0.46);
  ctx.stroke();

  // Red Overload calibration arc (0 to +3 dB)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, arcRadius, -Math.PI * 0.46, -Math.PI * 0.28);
  ctx.stroke();

  // Printed tick lines
  const tickAngles = [
    { a: -0.72, l: '20' },
    { a: -0.66, l: '10' },
    { a: -0.60, l: '7' },
    { a: -0.54, l: '5' },
    { a: -0.49, l: '3' },
    { a: -0.46, l: '0' },
    { a: -0.38, l: '+1' },
    { a: -0.28, l: '+3' },
  ];

  ctx.fillStyle = '#1e1b18';
  ctx.font = '700 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  tickAngles.forEach(t => {
    const ang = t.a * Math.PI;
    const isRed = t.a >= -0.46;
    const x1 = pivotX + Math.cos(ang) * (arcRadius - 3);
    const y1 = pivotY + Math.sin(ang) * (arcRadius - 3);
    const x2 = pivotX + Math.cos(ang) * (arcRadius + 4);
    const y2 = pivotY + Math.sin(ang) * (arcRadius + 4);

    ctx.strokeStyle = isRed ? '#dc2626' : '#1e1b18';
    ctx.lineWidth = isRed ? 1.6 : 1.0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const lx = pivotX + Math.cos(ang) * (arcRadius - 10);
    const ly = pivotY + Math.sin(ang) * (arcRadius - 10);
    if (ly > my + 14) {
      ctx.fillStyle = isRed ? '#991b1b' : '#292524';
      ctx.fillText(t.l, lx, ly);
    }
  });

  // "VU" and Channel Badge
  ctx.font = '800 11px sans-serif';
  ctx.fillStyle = '#1c1917';
  ctx.fillText('VU', pivotX, my + mh * 0.72);

  ctx.font = '700 7px "JetBrains Mono", monospace';
  ctx.fillStyle = '#78350f';
  ctx.fillText(channelLabel, pivotX, my + mh * 0.85);

  // 3. Peak Overload Red LED (Top Right of Meter)
  const isPeak = level > 0.90;
  const ledX = mx + mw - 12;
  const ledY = my + 10;
  ctx.fillStyle = isPeak ? '#ef4444' : '#450a0a';
  if (isPeak) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(ledX, ledY, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 4. Physical Ballistic Pointer Needle
  // Level (0 to 1+) maps to angle from -0.72 PI to -0.26 PI
  const needleAngle = (-0.72 + Math.min(1.15, level) * 0.44) * Math.PI;
  const needleTipLen = arcRadius + 8;
  const tipX = pivotX + Math.cos(needleAngle) * needleTipLen;
  const tipY = pivotY + Math.sin(needleAngle) * needleTipLen;

  // Subtle needle cast shadow on the meter face
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pivotX + 2, pivotY + 2);
  ctx.lineTo(tipX + 2, tipY + 2);
  ctx.stroke();

  // Needle Body (Black Steel)
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Needle Tip (Fiery Orange / Red)
  const tipSegmentLen = 18;
  const segStartX = tipX - Math.cos(needleAngle) * tipSegmentLen;
  const segStartY = tipY - Math.sin(needleAngle) * tipSegmentLen;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(segStartX, segStartY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Center Pivot Black Hub Cap
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(pivotX, my + mh + 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // 5. Glass Reflection Glare across top rim
  const glare = ctx.createLinearGradient(mx, my, mx, my + mh * 0.4);
  glare.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  glare.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  glare.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glare;
  ctx.fillRect(mx, my, mw, mh * 0.4);

  ctx.restore();
}
