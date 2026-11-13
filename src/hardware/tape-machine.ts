import { roundRect } from '../shared/canvas-utils';
import { consoleTheme } from './themes';
import { AudioAnalysis } from '../types';

export interface TapeMachineOptions {
  currentTime?: number;
  analysis?: AudioAnalysis;
  bpm?: number;
}

/**
 * Studio Master Tape Machine, drawn entirely on the canvas (no photo):
 * transport deck with spinning NAB reels in perspective, head block and guides,
 * and a brushed front panel with ballistic VU meters, drive knob, type buttons and speed selector.
 * Laid out in fractions of the slot (designed for w: 960, h: 570).
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
  ctx.save();

  const T = consoleTheme(colorTheme);
  const bezelColor = T.tapeBezel;

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

  // 3. Inner clipped frame for the deck and front panel
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8, false, false);
  ctx.clip();

  const time = options?.currentTime ?? 0;
  const analysis = options?.analysis;
  const bass = analysis?.bass ?? 0.2;
  const rms = analysis?.rms ?? 0.2;
  const fx = (f: number) => x + f * w;
  const fy = (f: number) => y + f * h;

  // A. Transport deck (top half): dark recess, back meter bridge, brushed deck plate
  const deckBottom = fy(0.5);
  const recess = ctx.createLinearGradient(x, y, x, deckBottom);
  recess.addColorStop(0, '#07080b');
  recess.addColorStop(0.3, '#15171d');
  recess.addColorStop(1, '#2a2c31');
  ctx.fillStyle = recess;
  ctx.fillRect(x, y, w, deckBottom - y);

  // Meter bridge at the back: a row of small amber windows with status LEDs
  const bridgeH = h * 0.1;
  ctx.fillStyle = '#0b0c10';
  ctx.fillRect(x, y, w, bridgeH);
  for (let i = 0; i < 8; i++) {
    const wx = fx(0.08 + i * 0.108);
    const ww = w * 0.08;
    ctx.fillStyle = `rgba(214, 120, 28, ${0.55 + Math.min(0.3, rms * 0.4)})`;
    roundRect(ctx, wx, y + bridgeH * 0.18, ww, bridgeH * 0.46, 2, true, false);
    ctx.fillStyle = i % 3 === 0 ? '#2dd4bf' : '#134e4a';
    ctx.beginPath();
    ctx.arc(wx + 5, y + bridgeH * 0.82, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Deck plate seen from above (a tilted, lighter surface toward the front)
  const plateTop = fy(0.2);
  const plate = ctx.createLinearGradient(x, plateTop, x, deckBottom);
  plate.addColorStop(0, '#3a3c41');
  plate.addColorStop(1, '#6b6d72');
  ctx.fillStyle = plate;
  ctx.fillRect(x, plateTop, w, deckBottom - plateTop);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x, deckBottom - 3, w, 2);

  // Reels: flange, wound tape pack, rotating cutouts and spindle
  const reelY = fy(0.27);
  const reelR = w * 0.17;
  const reels: Array<{ cx: number; flange: [string, string]; spokes: [string, string, string]; pack: number; angle: number }> = [
    { cx: fx(0.235), flange: ['#b91c1c', '#5f0d0d'], spokes: ['#991b1b', '#f87171', '#450a0a'], pack: 0.78, angle: time * 3.8 },
    { cx: fx(0.765), flange: ['#e2e8f0', '#64748b'], spokes: ['#94a3b8', '#f8fafc', '#1e293b'], pack: 0.55, angle: time * 3.8 * 1.04 },
  ];
  for (const r of reels) {
    ctx.save();
    ctx.translate(r.cx, reelY);
    ctx.scale(1, 0.44);
    // Drop shadow on the deck
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(6, 22, reelR, 0, Math.PI * 2);
    ctx.fill();
    // Flange
    const fl = ctx.createLinearGradient(-reelR, -reelR, reelR, reelR);
    fl.addColorStop(0, r.flange[0]);
    fl.addColorStop(1, r.flange[1]);
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(0, 0, reelR, 0, Math.PI * 2);
    ctx.fill();
    // Wound tape pack seen through the flange
    ctx.fillStyle = 'rgba(38, 24, 16, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, reelR * r.pack, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawRotatingReelSpokes(ctx, r.cx, reelY, reelR, r.angle, r.spokes[0], r.spokes[1], r.spokes[2]);

    // Spindle post and hub cap
    const post = ctx.createLinearGradient(r.cx - 14, 0, r.cx + 14, 0);
    post.addColorStop(0, '#6b7280');
    post.addColorStop(0.45, '#e5e7eb');
    post.addColorStop(1, '#4b5563');
    ctx.fillStyle = post;
    ctx.fillRect(r.cx - 14, reelY - 34, 28, 34);
    ctx.fillStyle = '#d1d5db';
    ctx.beginPath();
    ctx.ellipse(r.cx, reelY - 34, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tape path: reels -> guide rollers -> head block
  const guideY = fy(0.4);
  const guides = [fx(0.16), fx(0.35), fx(0.65), fx(0.84)];
  ctx.strokeStyle = '#3b2416';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(reels[0].cx - reelR * 0.78, reelY);
  ctx.lineTo(guides[0], guideY);
  ctx.lineTo(guides[3], guideY);
  ctx.lineTo(reels[1].cx + reelR * 0.55, reelY);
  ctx.stroke();
  for (const gx of guides) {
    const roller = ctx.createLinearGradient(gx - 9, 0, gx + 9, 0);
    roller.addColorStop(0, '#4b5563');
    roller.addColorStop(0.5, '#f3f4f6');
    roller.addColorStop(1, '#374151');
    ctx.fillStyle = roller;
    ctx.fillRect(gx - 9, guideY - 30, 18, 32);
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.ellipse(gx, guideY - 30, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head block cover
  const headX = fx(0.4);
  const headW = w * 0.2;
  const head = ctx.createLinearGradient(0, guideY - 46, 0, guideY + 6);
  head.addColorStop(0, '#d4d4d8');
  head.addColorStop(0.5, '#8b8d93');
  head.addColorStop(1, '#4b4d52');
  ctx.fillStyle = head;
  roundRect(ctx, headX, guideY - 46, headW, 52, 6, true, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, headX + 0.5, guideY - 45.5, headW - 1, 51, 6, false, true);

  // B. Front panel (bottom half): brushed metal with screws
  const panelY = deckBottom;
  const panel = ctx.createLinearGradient(x, panelY, x, y + h);
  panel.addColorStop(0, '#5c5e63');
  panel.addColorStop(0.5, '#47494e');
  panel.addColorStop(1, '#2e3034');
  ctx.fillStyle = panel;
  ctx.fillRect(x, panelY, w, y + h - panelY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let ly = panelY + 4; ly < y + h; ly += 3) ctx.fillRect(x, ly, w, 1);
  const screws: Array<[number, number]> = [[fx(0.02), panelY + 14], [fx(0.98), panelY + 14], [fx(0.02), y + h - 16], [fx(0.98), y + h - 16]];
  for (const [sx, sy] of screws) {
    ctx.fillStyle = '#1f2023';
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy);
    ctx.lineTo(sx + 3, sy);
    ctx.stroke();
  }

  // Engraved labels
  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('LEVEL METER', fx(0.29), fy(0.565));
  ctx.fillText('DRIVE', fx(0.645), fy(0.565));
  ctx.fillText('TYPE', fx(0.79), fy(0.565));
  ctx.fillText('SPEED', fx(0.915), fy(0.565));
  ctx.font = '600 9px "JetBrains Mono", monospace';
  ctx.fillText('LEFT', fx(0.164), fy(0.6));
  ctx.fillText('RIGHT', fx(0.422), fy(0.6));

  // C. Ballistic VU meters in dark bezels
  const vuY = fy(0.62);
  const vuW = w * 0.214;
  const vuH = h * 0.21;
  const leftVuLevel = Math.min(1.15, Math.max(0, bass * 1.35 + rms * 0.35));
  const rightVuLevel = Math.min(1.15, Math.max(0, rms * 1.25 + (analysis?.mid ?? 0.2) * 0.4));
  const vus: Array<[number, number, string]> = [[fx(0.057), leftVuLevel, 'LEFT'], [fx(0.315), rightVuLevel, 'RIGHT']];
  for (const [vx, level, label] of vus) {
    ctx.fillStyle = '#111215';
    roundRect(ctx, vx - 6, vuY - 6, vuW + 12, vuH + 12, 6, true, false);
    drawDynamicVuFace(ctx, vx, vuY, vuW, vuH, level, label, bass);
  }

  // D. Drive knob, type buttons (A lights with the bass) and speed selector
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawPanelKnob(ctx, fx(0.645), fy(0.73), w * 0.042, -0.3 + Math.min(0.25, rms * 0.3));
  const btnW = w * 0.03;
  const btnH = h * 0.06;
  ['A', 'B', 'C'].forEach((label, i) => {
    const bx = fx(0.79) - btnW / 2;
    const by = fy(0.6 + i * 0.085);
    const lit = i === 0 && bass > 0.45;
    ctx.save();
    ctx.fillStyle = lit ? '#ef4444' : '#5f0d0d';
    if (lit) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
    }
    roundRect(ctx, bx, by, btnW, btnH, 3, true, false);
    ctx.restore();
    ctx.fillStyle = lit ? '#fff7ed' : '#fca5a5';
    ctx.font = '700 11px sans-serif';
    ctx.fillText(label, bx + btnW / 2, by + btnH / 2 + 0.5);
  });
  drawPanelKnob(ctx, fx(0.915), fy(0.73), w * 0.042, 0);
  ctx.fillStyle = '#d1d5db';
  ctx.font = '600 8px "JetBrains Mono", monospace';
  ctx.fillText('7.5', fx(0.87), fy(0.84));
  ctx.fillText('15', fx(0.915), fy(0.625));
  ctx.fillText('30', fx(0.96), fy(0.84));

  // E. Badge strip
  ctx.textAlign = 'left';
  ctx.fillStyle = T.tapeLabel;
  ctx.font = '800 26px sans-serif';
  ctx.fillText('TAPE', fx(0.045), fy(0.93));
  ctx.fillStyle = 'rgba(229, 231, 235, 0.7)';
  ctx.font = '600 8px "JetBrains Mono", monospace';
  ctx.fillText('TWO-TRACK MASTER RECORDER \u00b7 SERVO TRANSPORT', fx(0.16), fy(0.915));
  ctx.fillText('15 IPS \u00b7 NAB', fx(0.16), fy(0.945));

  // F. Subtle sheen across the deck and the theme glow on the bottom bezel
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h * 0.45);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h * 0.45);

  const themeGlow = ctx.createLinearGradient(x, y + h - 18, x, y + h);
  themeGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
  themeGlow.addColorStop(1, T.tapeGlow);
  ctx.fillStyle = themeGlow;
  ctx.fillRect(x, y + h - 18, w, 18);

  ctx.restore(); // remove inner clip
  ctx.restore(); // remove chassis save
}

/** Chrome knob with a skirt of ticks; `turn` is the pointer angle in turns from 12 o'clock (-0.375 to 0.375). */
function drawPanelKnob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, turn: number) {
  ctx.save();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 10; i++) {
    const ang = (-0.75 + i * 0.15) * Math.PI - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (r + 5), cy + Math.sin(ang) * (r + 5));
    ctx.lineTo(cx + Math.cos(ang) * (r + 10), cy + Math.sin(ang) * (r + 10));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(cx + 3, cy + 5, r, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  body.addColorStop(0, '#f9fafb');
  body.addColorStop(0.55, '#9ca3af');
  body.addColorStop(1, '#374151');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const pa = turn * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(pa) * r * 0.3, cy + Math.sin(pa) * r * 0.3);
  ctx.lineTo(cx + Math.cos(pa) * r * 0.88, cy + Math.sin(pa) * r * 0.88);
  ctx.stroke();
  ctx.restore();
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
