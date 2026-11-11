import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { formatNoteName } from '../engine/chords';
import { hexToRgbaStr } from '../engine/palettes';

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

/**
 * Draws a precision 3D vector rotary synthesizer knob with calibrated scale ticks
 */
function drawKnob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  label: string,
  val: number,
  isDynamic: boolean,
  dynamicVal: number,
  glowColor: string
) {
  ctx.save();
  const actualVal = isDynamic ? Math.max(0, Math.min(1, dynamicVal)) : val;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalAngle = endAngle - startAngle;

  // Scale ticks around knob
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.1;
  const numTicks = 8;
  for (let i = 0; i <= numTicks; i++) {
    const a = startAngle + (i / numTicks) * totalAngle;
    const isMajor = i % 4 === 0;
    const innerR = radius + 3;
    const outerR = radius + (isMajor ? 6.5 : 4.5);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * innerR, y + Math.sin(a) * innerR);
    ctx.lineTo(x + Math.cos(a) * outerR, y + Math.sin(a) * outerR);
    ctx.stroke();
  }

  // Dynamic glowing LED arc around active/modulated knobs
  if (isDynamic && actualVal > 0.05) {
    const activeAngle = startAngle + actualVal * totalAngle;
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = radius > 16 ? 14 : 9;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = radius > 16 ? 2.8 : 2.0;
    ctx.beginPath();
    ctx.arc(x, y, radius + 4.5, startAngle, activeAngle);
    ctx.stroke();
    ctx.restore();
  }

  // 3D Knob Cylindrical Body
  const kGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 1.5, x, y, radius);
  kGrad.addColorStop(0, '#464956');
  kGrad.addColorStop(0.5, '#22232a');
  kGrad.addColorStop(1, '#0e0f13');
  ctx.fillStyle = kGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // White pointer indicator line
  const ptr = startAngle + actualVal * totalAngle;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = radius > 16 ? 2.4 : 1.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ptr) * (radius - 2), y + Math.sin(ptr) * (radius - 2));
  ctx.stroke();

  // Label underneath
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.fillStyle = isDynamic ? '#e2e8f0' : '#8e96a4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y + radius + 5);

  ctx.restore();
}

/**
 * Vertical Fader Slider for VCF Cutoff & Resonance with metal slider cap and calibration
 */
function drawVerticalFader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  val: number,
  isDynamic: boolean,
  dynamicVal: number,
  glowColor: string
) {
  ctx.save();
  const actualVal = isDynamic ? Math.max(0, Math.min(1, dynamicVal)) : val;

  // Fader slot track (recessed groove)
  const slotW = 5;
  const slotX = x + w / 2 - slotW / 2;
  const slotY = y + 15;
  const slotH = h - 32;

  // Scale tick marks on left and right
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1;
  const ticks = 8;
  for (let i = 0; i <= ticks; i++) {
    const ty = slotY + (i / ticks) * slotH;
    const isMajor = i === 0 || i === ticks / 2 || i === ticks;
    const tickLen = isMajor ? 5 : 2.5;

    ctx.beginPath();
    ctx.moveTo(slotX - 3, ty);
    ctx.lineTo(slotX - 3 - tickLen, ty);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(slotX + slotW + 3, ty);
    ctx.lineTo(slotX + slotW + 3 + tickLen, ty);
    ctx.stroke();
  }

  // Groove background
  ctx.fillStyle = '#08090c';
  roundRect(ctx, slotX, slotY, slotW, slotH, 2, true, false);
  ctx.strokeStyle = '#1b1d24';
  ctx.lineWidth = 1;
  roundRect(ctx, slotX, slotY, slotW, slotH, 2, false, true);

  // Fader Slider Cap (Inverted so 1 is at top)
  const capH = 15;
  const capW = Math.min(w - 6, 26);
  const capY = slotY + (1 - actualVal) * (slotH - capH);
  const capX = x + w / 2 - capW / 2;

  // Cap drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Ribbed metallic cap body
  const capGrad = ctx.createLinearGradient(capX, capY, capX + capW, capY);
  capGrad.addColorStop(0, '#555864');
  capGrad.addColorStop(0.35, '#828795');
  capGrad.addColorStop(0.7, '#474a56');
  capGrad.addColorStop(1, '#2c2e36');
  ctx.fillStyle = capGrad;
  roundRect(ctx, capX, capY, capW, capH, 2, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Bezel border
  ctx.strokeStyle = '#16181f';
  ctx.lineWidth = 1;
  roundRect(ctx, capX, capY, capW, capH, 2, false, true);

  // Center indicator line
  const lineY = capY + capH / 2;
  if (isDynamic) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(capX + 2, lineY);
    ctx.lineTo(capX + capW - 2, lineY);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(capX + 2, lineY);
    ctx.lineTo(capX + capW - 2, lineY);
    ctx.stroke();
  }

  // Top Label
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.fillStyle = isDynamic ? '#f1f5f9' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x + w / 2, y + 11);

  // Bottom numeric readout
  const readout = Math.round(actualVal * 10);
  ctx.font = '800 8.5px "JetBrains Mono", monospace';
  ctx.fillStyle = isDynamic ? glowColor : '#64748b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(readout), x + w / 2, y + h - 11);

  ctx.restore();
}

/**
 * Mini Fader for ADSR Envelope sections
 */
function drawMiniFader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  val: number
) {
  ctx.save();
  const slotW = 3.5;
  const slotX = x + w / 2 - slotW / 2;
  const slotY = y + 12;
  const slotH = h - 20;

  // Track
  ctx.fillStyle = '#0a0b0e';
  roundRect(ctx, slotX, slotY, slotW, slotH, 1.5, true, false);

  // Cap
  const capH = 9;
  const capW = 16;
  const capY = slotY + (1 - val) * (slotH - capH);
  const capX = x + w / 2 - capW / 2;

  ctx.fillStyle = '#64748b';
  roundRect(ctx, capX, capY, capW, capH, 1.5, true, false);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.8;
  roundRect(ctx, capX, capY, capW, capH, 1.5, false, true);

  // White center pip
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(capX + 2, capY + capH / 2 - 0.5, capW - 4, 1);

  // Label
  ctx.font = '700 7px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x + w / 2, y + 9);

  ctx.restore();
}

/**
 * Signature Audio Phosphor CRT Oscilloscope with live golden waveform
 */
function drawDivaScope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  waveform: Uint8Array,
  sensitivity: number
) {
  ctx.save();

  // Dark recessed CRT oscilloscope screen
  const screenGrad = ctx.createLinearGradient(x, y, x, y + h);
  screenGrad.addColorStop(0, '#0a1017');
  screenGrad.addColorStop(0.5, '#060a0f');
  screenGrad.addColorStop(1, '#030508');
  ctx.fillStyle = screenGrad;
  roundRect(ctx, x, y, w, h, 4, true, false);

  // Screen bezel border
  ctx.strokeStyle = '#1e2836';
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 4, false, true);

  // Fine oscilloscope graticule / grid lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
  ctx.lineWidth = 0.8;

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h / 2);
  ctx.lineTo(x + w - 4, y + h / 2);
  ctx.stroke();

  // Vertical grid ticks
  const gridCols = 8;
  for (let c = 1; c < gridCols; c++) {
    const gx = x + (c / gridCols) * w;
    ctx.beginPath();
    ctx.moveTo(gx, y + 4);
    ctx.lineTo(gx, y + h - 4);
    ctx.stroke();
  }

  // Draw intense amber phosphor audio waveform
  const traceW = w - 16;
  const traceX = x + 8;
  const midY = y + h / 2;
  const maxAmplitude = (h / 2) * 0.85;

  ctx.beginPath();
  const points = 120;
  for (let i = 0; i < points; i++) {
    const px = traceX + (i / (points - 1)) * traceW;
    const waveIdx = Math.floor((i / points) * waveform.length);
    const sample = ((waveform[waveIdx] || 128) - 128) / 128;
    const py = midY + sample * maxAmplitude * sensitivity;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  // Amber outer phosphor glow
  ctx.save();
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#ff9911';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Bright white-amber core
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 4;
  ctx.strokeStyle = '#fff1d6';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // CRT glass sheen highlight across top
  const glassGrad = ctx.createLinearGradient(x, y, x + w, y + h * 0.4);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glassGrad;
  roundRect(ctx, x + 1, y + 1, w - 2, h * 0.45, 3, true, false);

  // Header label
  ctx.font = '800 8px "JetBrains Mono", monospace';
  ctx.letterSpacing = '1px';
  ctx.fillStyle = 'rgba(255, 170, 50, 0.65)';
  ctx.textAlign = 'right';
  ctx.fillText('SCOPE', x + w - 10, y + 13);
  ctx.letterSpacing = '0px';

  ctx.restore();
}

/**
 * Module container box with title header
 */
function drawModuleBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string
) {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 13, 17, 0.72)';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillRect(x, y, w, 18);

  ctx.font = '800 8.5px "Inter", sans-serif';
  ctx.letterSpacing = '1.2px';
  ctx.fillStyle = '#b0b8c4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x + w / 2, y + 9);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/**
 * Left well with Pitch and Mod wheels
 */
function drawWheelsWell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = '#08080a';
  roundRect(ctx, x, y, w, h, 3, true, false);
  ctx.strokeStyle = '#181920';
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 3, false, true);

  const wheelW = 18;
  const wheelH = h - 34;
  const pX = x + 7;
  const mX = x + w - wheelW - 7;
  const wheelY = y + 12;

  [
    { name: 'PITCH', wx: pX },
    { name: 'MOD', wx: mX },
  ].forEach(st => {
    ctx.fillStyle = '#0f1014';
    ctx.fillRect(st.wx - 2, wheelY - 2, wheelW + 4, wheelH + 4);

    // Ribbed segments
    for (let r = 0; r < wheelH; r += 4.5) {
      ctx.fillStyle = r % 9 === 0 ? '#383a44' : '#1e1f26';
      ctx.fillRect(st.wx, wheelY + r, wheelW, 3.2);
    }

    ctx.font = '800 7px "Inter", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(st.name, st.wx + wheelW / 2, y + h - 5);
  });

  ctx.restore();
}

/**
 * Master ST 909 Analogue Synthesizer Console
 * Complete 100% fidelity to reference video:
 * - Oiled mahogany side cheeks with countersunk brass screws
 * - Deep crimson wine-red metallic brushed chassis
 * - Header: ST 909 badge, blinking ACTIVITY led, display window < FEELS THE SAME >, + MULTI, ST-AUDIO
 * - Full 12-knob TRIPLE VCO (3 rows of 4 knobs)
 * - Full 4-knob MIXER (OSC 1, OSC 2, FEEDBACK, NOISE)
 * - VCF | MULTIMODE with CUTOFF and RES vertical faders + buttons + knobs
 * - Dual ADSR envelope fader banks (FILTER ENV & AMP ENV)
 * - Full 8-knob LFO 1 & 2
 * - Center CRT AUDIO PHOSPHOR OSCILLOSCOPE with live amber waveform
 * - Full 8-knob EFFECT 1 & 2
 * - Tab buttons (MAIN, MODIFICATIONS, TRIMMERS, SCOPE, PATCHES)
 * - PITCH & MOD wheels well
 * - Integrated 25-key keyboard (C2 to C4: 15 white, 10 black) with active glowing keys & note badges!
 */
export function drawST909Synthesizer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  currentTime: number,
  midi: ParsedMidi,
  activeNotes: MidiNote[],
  analysis: AudioAnalysis,
  settings: VisualizerSettings,
  colorTheme: 'crimson' | 'gold' = 'crimson'
) {
  ctx.save();
  const woodW = 28;
  const isGold = colorTheme === 'gold';

  // 1. Chassis Outer Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#08090c';
  roundRect(ctx, x, y, w, h, 6, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 2. Wood Side Cheeks with Brass / Gilded Screws
  [x, x + w - woodW].forEach((wx, idx) => {
    const woodGrad = ctx.createLinearGradient(wx, y, wx + woodW, y);
    if (isGold) {
      // Dark Smoked American Walnut with Antique Gold Sheen
      if (idx === 0) {
        woodGrad.addColorStop(0, '#19110a');
        woodGrad.addColorStop(0.3, '#322112');
        woodGrad.addColorStop(0.65, '#4a321a');
        woodGrad.addColorStop(1, '#23160b');
      } else {
        woodGrad.addColorStop(0, '#23160b');
        woodGrad.addColorStop(0.35, '#4a321a');
        woodGrad.addColorStop(0.7, '#322112');
        woodGrad.addColorStop(1, '#19110a');
      }
    } else {
      // Oiled Mahogany Red
      if (idx === 0) {
        woodGrad.addColorStop(0, '#1c0a06');
        woodGrad.addColorStop(0.3, '#3e150d');
        woodGrad.addColorStop(0.65, '#5c1f13');
        woodGrad.addColorStop(1, '#2c0d08');
      } else {
        woodGrad.addColorStop(0, '#2c0d08');
        woodGrad.addColorStop(0.35, '#5c1f13');
        woodGrad.addColorStop(0.7, '#3e150d');
        woodGrad.addColorStop(1, '#1c0a06');
      }
    }
    ctx.fillStyle = woodGrad;
    roundRect(ctx, wx, y, woodW, h, 4, true, false);

    // Fine woodgrain lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let g = 4; g < woodW - 4; g += 5) {
      ctx.fillRect(wx + g, y + 2, 1.2, h - 4);
    }

    // Countersunk Screws with dark washers
    [y + 30, y + h / 2, y + h - 30].forEach(sy => {
      const cx = wx + woodW / 2;
      // Washer
      ctx.beginPath();
      ctx.arc(cx, sy, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1610';
      ctx.fill();

      // Brass / 24K Gold screw head
      const sGrad = ctx.createRadialGradient(cx - 1.5, sy - 1.5, 1, cx, sy, 5);
      if (isGold) {
        sGrad.addColorStop(0, '#fef08a');
        sGrad.addColorStop(0.6, '#d4af37');
        sGrad.addColorStop(1, '#5a4212');
      } else {
        sGrad.addColorStop(0, '#ba9f72');
        sGrad.addColorStop(0.6, '#7d6745');
        sGrad.addColorStop(1, '#3a2d1d');
      }
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(cx, sy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Slotted notch
      ctx.beginPath();
      ctx.moveTo(cx - 3, sy - 1);
      ctx.lineTo(cx + 3, sy + 1);
      ctx.strokeStyle = '#120e09';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    });
  });

  const faceX = x + woodW;
  const faceW = w - woodW * 2;
  const faceH = h - 22;

  // Faceplate Metallic Finish: Crimson Wine-Red for TZ, Brushed Royal Gold for Drake
  const faceGrad = ctx.createLinearGradient(faceX, y, faceX, y + faceH);
  if (isGold) {
    faceGrad.addColorStop(0, '#4e3b16');
    faceGrad.addColorStop(0.25, '#38290e');
    faceGrad.addColorStop(0.6, '#261b07');
    faceGrad.addColorStop(1, '#160e03');
  } else {
    faceGrad.addColorStop(0, '#5a161d');
    faceGrad.addColorStop(0.25, '#430f14');
    faceGrad.addColorStop(0.6, '#340a0e');
    faceGrad.addColorStop(1, '#220508');
  }
  ctx.fillStyle = faceGrad;
  ctx.fillRect(faceX, y, faceW, faceH);

  // Micro horizontal brushed lines
  ctx.fillStyle = isGold ? 'rgba(254, 240, 138, 0.025)' : 'rgba(255, 255, 255, 0.015)';
  for (let r = 0; r < faceH; r += 2) {
    ctx.fillRect(faceX, y + r, faceW, 1);
  }

  // Top metal bevel border
  ctx.fillStyle = isGold ? '#d4af37' : '#8a2830';
  ctx.fillRect(faceX, y, faceW, 1.5);

  // ==========================================
  // TOP HEADER BAR (h = 38px)
  // ==========================================
  const headH = 38;

  // 1. ST 909 Logo Badge on Left (Red for TZ, Gold for Drake)
  const badgeX = faceX + 10;
  const badgeY = y + 9;
  const badgeW = 54;
  const badgeH = 20;

  ctx.fillStyle = isGold ? '#b48a28' : '#b91c1c';
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.5, true, false);
  ctx.strokeStyle = isGold ? '#fde047' : '#ef4444';
  ctx.lineWidth = 0.8;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.5, false, true);

  ctx.font = '900 11px "Inter", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ST 909', badgeX + badgeW / 2, badgeY + badgeH / 2);

  // 2. Activity LED & ANALOGUE SYNTHESIZER
  const actX = badgeX + badgeW + 8;
  const actY = badgeY + badgeH / 2;

  ctx.font = '700 7.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'left';
  ctx.fillText('ACTIVITY', actX, actY);

  const actLedX = actX + 46;
  const isMidiActive = activeNotes.length > 0;
  ctx.beginPath();
  ctx.arc(actLedX, actY, 3.5, 0, Math.PI * 2);
  if (isMidiActive) {
    ctx.save();
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#4ade80';
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#15803d';
    ctx.fill();
  }
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.fillText('ANALOGUE SYNTHESIZER', actLedX + 8, actY);

  // 3. Center Recessed Display Window (< FEELS THE SAME >)
  const dispW = 240;
  const dispH = 22;
  const dispX = faceX + faceW / 2 - dispW / 2;
  const dispY = y + 8;

  ctx.fillStyle = '#0b0f16';
  roundRect(ctx, dispX, dispY, dispW, dispH, 3, true, false);
  ctx.strokeStyle = isGold ? '#d4af37' : '#1e293b';
  ctx.lineWidth = 1;
  roundRect(ctx, dispX, dispY, dispW, dispH, 3, false, true);

  // Chevrons & Patch Name
  ctx.font = '700 10.5px "Inter", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('‹', dispX + 8, dispY + dispH / 2 + 0.5);
  ctx.textAlign = 'right';
  ctx.fillText('›', dispX + dispW - 8, dispY + dispH / 2 + 0.5);

  const patchTitle = (settings.title || 'FEELS THE SAME').toUpperCase();
  ctx.fillStyle = isGold ? '#fde047' : '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(patchTitle.length > 24 ? patchTitle.substring(0, 24) + '...' : patchTitle, dispX + dispW / 2, dispY + dispH / 2 + 0.5);

  // 4. Right Controls: + MULTI and ST • AUDIO
  const rightTagX = faceX + faceW - 12;
  const multiW = 54;
  const multiX = rightTagX - multiW - 80;

  ctx.fillStyle = '#1c1f26';
  roundRect(ctx, multiX, y + 10, multiW, 18, 2, true, false);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.8;
  roundRect(ctx, multiX, y + 10, multiW, 18, 2, false, true);

  ctx.font = '700 7.5px "Inter", sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'center';
  ctx.fillText('• MULTI', multiX + multiW / 2, y + 19);

  // ST • AUDIO badge
  const audX = rightTagX - 70;
  ctx.fillStyle = '#10141d';
  roundRect(ctx, audX, y + 10, 68, 18, 2, true, false);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 0.8;
  roundRect(ctx, audX, y + 10, 68, 18, 2, false, true);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText('ST • AUDIO', audX + 34, y + 19);

  // ==========================================
  // UPPER MODULE TIER (y + 40, h = 188)
  // 1. TRIPLE VCO | 2. MIXER | 3. VCF MULTIMODE | 4. ANALOGUE ENVELOPE
  // ==========================================
  const upperY = y + 40;
  const upperH = 188;

  const modW1 = 330; // TRIPLE VCO
  const modW2 = 114; // MIXER
  const modW3 = 210; // VCF MULTIMODE
  const modW4 = faceW - 12 - (modW1 + modW2 + modW3 + 12); // ANALOGUE ENVELOPE (~238px)

  const m1X = faceX + 6;
  const m2X = m1X + modW1 + 4;
  const m3X = m2X + modW2 + 4;
  const m4X = m3X + modW3 + 4;

  // Draw Module Boxes
  drawModuleBox(ctx, m1X, upperY, modW1, upperH, 'TRIPLE VCO ▼');
  drawModuleBox(ctx, m2X, upperY, modW2, upperH, 'MIXER ▼');
  drawModuleBox(ctx, m3X, upperY, modW3, upperH, 'VCF | MULTIMODE ▼');
  drawModuleBox(ctx, m4X, upperY, modW4, upperH, 'ANALOGUE ENVE ▼');

  // --- MODULE 1: TRIPLE VCO (Complete 12 knobs: 3 rows of 4!) ---
  const osc2TuneDynamic = (Math.sin(currentTime * 3.8) + 1) * 0.5;

  // Row 1 (Osc 1): FM 1>2, Range 8', Sync, Wave
  drawKnob(ctx, m1X + 44, upperY + 52, 12.5, 'FM 1>2', 0.25, false, 0, '#64748b');
  drawKnob(ctx, m1X + 118, upperY + 52, 12.5, "RANGE 8'", 0.50, false, 0, '#64748b');
  drawKnob(ctx, m1X + 198, upperY + 52, 12.5, 'SYNC', 0.70, false, 0, '#64748b');
  drawKnob(ctx, m1X + 278, upperY + 52, 12.5, 'WAVE', 0.35, true, analysis.mid * 0.6, settings.accentColor || '#fde047');

  // Row 2 (Osc 2): TUNE MOD (DYNAMIC!), Detune, PW, Pulse
  drawKnob(ctx, m1X + 44, upperY + 108, 12.5, 'TUNE MOD', osc2TuneDynamic, true, osc2TuneDynamic, settings.accentColor || '#38bdf8');
  drawKnob(ctx, m1X + 118, upperY + 108, 12.5, 'DETUNE', 0.48, false, 0, '#64748b');
  drawKnob(ctx, m1X + 198, upperY + 108, 12.5, 'PW', 0.62, true, analysis.bass * 0.4, '#fde047');
  drawKnob(ctx, m1X + 278, upperY + 108, 12.5, 'PULSE', 0.50, false, 0, '#64748b');

  // Row 3 (Osc 3): Shape, Freq 3, Stack, Noise
  drawKnob(ctx, m1X + 44, upperY + 162, 12.5, 'SHAPE', 0.30, false, 0, '#64748b');
  drawKnob(ctx, m1X + 118, upperY + 162, 12.5, 'FREQ 3', 0.50, false, 0, '#64748b');
  drawKnob(ctx, m1X + 198, upperY + 162, 12.5, 'STACK', 0.20, false, 0, '#64748b');
  drawKnob(ctx, m1X + 278, upperY + 162, 12.5, 'NOISE', 0.15, false, 0, '#64748b');

  // --- MODULE 2: MIXER (Full 4 knobs: OSC 1, OSC 2, FEEDBACK, NOISE) ---
  drawKnob(ctx, m2X + modW2 / 2, upperY + 44, 11.5, 'OSC 1', 0.85, true, analysis.bass * 0.7, '#fde047');
  drawKnob(ctx, m2X + modW2 / 2, upperY + 84, 11.5, 'OSC 2', 0.80, true, analysis.mid * 0.5, '#fde047');
  drawKnob(ctx, m2X + modW2 / 2, upperY + 124, 11.5, 'FEEDBACK', 0.35, false, 0, '#64748b');
  drawKnob(ctx, m2X + modW2 / 2, upperY + 164, 11.5, 'NOISE', 0.10, false, 0, '#64748b');

  // --- MODULE 3: VCF | MULTIMODE ---
  const cutoffDynamic = Math.min(1, 0.22 + analysis.bass * 0.75 * (settings.audioSensitivity || 1.2));
  const resDynamic = Math.min(1, 0.25 + analysis.mid * 0.65 * (settings.audioSensitivity || 1.2));

  drawVerticalFader(ctx, m3X + 12, upperY + 22, 44, 116, 'CUTOFF', cutoffDynamic, true, cutoffDynamic, settings.notesColor || '#fde047');
  drawVerticalFader(ctx, m3X + 64, upperY + 22, 44, 116, 'RES', resDynamic, true, resDynamic, settings.accentColor || '#38bdf8');

  // Filter Pole Selectors: LP4, LP2, HP, BP
  const poles = ['LP4', 'LP2', 'HP', 'BP'];
  poles.forEach((p, pi) => {
    const px = m3X + 122 + (pi % 2) * 38;
    const py = upperY + 34 + Math.floor(pi / 2) * 26;
    const isSel = pi === 0;

    ctx.fillStyle = isSel ? (isGold ? '#b48a28' : '#991b1b') : '#1e2129';
    roundRect(ctx, px, py, 34, 19, 2, true, false);
    ctx.strokeStyle = isSel ? (isGold ? '#fde047' : '#f87171') : '#334155';
    ctx.lineWidth = 0.8;
    roundRect(ctx, px, py, 34, 19, 2, false, true);

    ctx.font = '700 8.5px "Inter", sans-serif';
    ctx.fillStyle = isSel ? '#ffffff' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p, px + 17, py + 9.5);
  });

  // Lower VCF Knobs: ENV 2, FM OSC, KYBD
  drawKnob(ctx, m3X + 40, upperY + 162, 11.5, 'ENV 2', 0.65, false, 0, '#64748b');
  drawKnob(ctx, m3X + 105, upperY + 162, 11.5, 'FM OSC', 0.30, false, 0, '#64748b');
  drawKnob(ctx, m3X + 170, upperY + 162, 11.5, 'KYBD', 0.75, false, 0, '#64748b');

  // --- MODULE 4: ANALOGUE ENVELOPE (Dual ADSR Banks) ---
  const adsrLabels = ['A', 'D', 'S', 'R', 'VEL'];
  const env1Vals = [0.10, 0.45, 0.70, 0.35, 0.80];
  const env2Vals = [0.05, 0.50, 0.85, 0.40, 0.90];

  // Upper Bank: FILTER ENV
  ctx.font = '700 8px "Inter", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FILTER ENV', m4X + 12, upperY + 24);

  adsrLabels.forEach((lbl, li) => {
    const fx = m4X + 12 + li * 42;
    drawMiniFader(ctx, fx, upperY + 32, 34, 56, lbl, env1Vals[li]);
  });

  // Lower Bank: AMP ENV
  ctx.fillText('AMP ENV', m4X + 12, upperY + 104);
  adsrLabels.forEach((lbl, li) => {
    const fx = m4X + 12 + li * 42;
    drawMiniFader(ctx, fx, upperY + 112, 34, 56, lbl, env2Vals[li]);
  });

  // ==========================================
  // LOWER MODULE TIER (y + 234, h = 138)
  // 1. LFO 1 & 2 | 2. CRT OSCILLOSCOPE | 3. EFFECTS
  // ==========================================
  const lowerY = y + 234;
  const lowerH = 138;

  const lowW1 = 226; // LFO 1 & 2
  const lowW2 = 422; // CENTER SCOPE
  const lowW3 = faceW - 12 - (lowW1 + lowW2 + 8); // EFFECTS

  const l1X = faceX + 6;
  const l2X = l1X + lowW1 + 4;
  const l3X = l2X + lowW2 + 4;

  // --- LOWER MODULE 1: LFO 1 & 2 (8 knobs) ---
  drawModuleBox(ctx, l1X, lowerY, lowW1, lowerH, 'LFO 1 & 2');
  drawKnob(ctx, l1X + 35, lowerY + 48, 11.5, 'RATE 1', 0.50, false, 0, '#64748b');
  drawKnob(ctx, l1X + 90, lowerY + 48, 11.5, 'DELAY', 0.20, false, 0, '#64748b');
  drawKnob(ctx, l1X + 145, lowerY + 48, 11.5, 'DEPTH', 0.65, true, analysis.mid * 0.4, '#fde047');
  drawKnob(ctx, l1X + 195, lowerY + 48, 9.5, 'TRI', 0.50, false, 0, '#64748b');

  drawKnob(ctx, l1X + 35, lowerY + 104, 11.5, 'RATE 2', 0.40, false, 0, '#64748b');
  drawKnob(ctx, l1X + 90, lowerY + 104, 11.5, 'DELAY', 0.10, false, 0, '#64748b');
  drawKnob(ctx, l1X + 145, lowerY + 104, 11.5, 'DEPTH', 0.80, true, analysis.bass * 0.4, '#fde047');
  drawKnob(ctx, l1X + 195, lowerY + 104, 9.5, 'SAW', 0.50, false, 0, '#64748b');

  // --- LOWER MODULE 2: SCOPE (Signature Glowing Amber CRT Monitor!) ---
  drawDivaScope(
    ctx,
    l2X,
    lowerY,
    lowW2,
    lowerH - 28,
    analysis.waveform,
    settings.audioSensitivity || 1.2
  );

  // Scope bottom telemetry label
  const scY = lowerY + lowerH - 14;
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AUDIO PHOSPHOR OSCILLOSCOPE', l2X + lowW2 / 2, scY);

  // --- LOWER MODULE 3: EFFECTS (8 knobs) ---
  drawModuleBox(ctx, l3X, lowerY, lowW3, lowerH, 'EFFECT 1 & 2');
  drawKnob(ctx, l3X + 35, lowerY + 48, 11.5, 'CHORUS', 0.60, false, 0, '#64748b');
  drawKnob(ctx, l3X + 92, lowerY + 48, 11.5, 'DEPTH', 0.70, true, analysis.treble * 0.5, '#38bdf8');
  drawKnob(ctx, l3X + 148, lowerY + 48, 11.5, 'RATE', 0.45, false, 0, '#64748b');
  drawKnob(ctx, l3X + 198, lowerY + 48, 9.5, 'WET', 0.50, false, 0, '#64748b');

  drawKnob(ctx, l3X + 35, lowerY + 104, 11.5, 'DELAY', 0.55, false, 0, '#64748b');
  drawKnob(ctx, l3X + 92, lowerY + 104, 11.5, 'FEEDBK', 0.40, true, analysis.mid * 0.4, '#38bdf8');
  drawKnob(ctx, l3X + 148, lowerY + 104, 11.5, 'DAMP', 0.30, false, 0, '#64748b');
  drawKnob(ctx, l3X + 198, lowerY + 104, 9.5, 'MIX', 0.40, true, analysis.bass * 0.4, '#38bdf8');

  // ==========================================
  // BOTTOM TAB STRIP (y + 378, h = 18px)
  // MAIN | MODIFICATIONS | TRIMMERS | [ SCOPE ] | PATCHES
  // ==========================================
  const tabY = y + 378;
  const tabs = ['MAIN', 'MODIFICATIONS', 'TRIMMERS', 'SCOPE', 'PATCHES'];
  const tabW = 84;
  const tabStartX = faceX + faceW / 2 - (tabs.length * tabW) / 2;

  tabs.forEach((t, ti) => {
    const tx = tabStartX + ti * tabW;
    const isScope = t === 'SCOPE';

    ctx.fillStyle = isScope ? (isGold ? '#2d2009' : '#351117') : '#14161d';
    roundRect(ctx, tx + 2, tabY, tabW - 4, 17, 2, true, false);
    ctx.strokeStyle = isScope ? (isGold ? '#d4af37' : '#ea580c') : '#272a36';
    ctx.lineWidth = isScope ? 1.2 : 0.8;
    roundRect(ctx, tx + 2, tabY, tabW - 4, 17, 2, false, true);

    ctx.font = '700 8px "Inter", sans-serif';
    ctx.fillStyle = isScope ? (isGold ? '#fde047' : '#ffaa22') : '#828a9a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, tx + tabW / 2, tabY + 8.5);
  });

  // ==========================================
  // LOWER TIER: PITCH/MOD WHEELS + 25-KEY SYNTHESIZER KEYBOARD
  // ==========================================
  const kbY = y + 402;
  const kbH = h - 422; // ~148px
  const wheelsW = 58;
  const wheelsX = faceX + 8;

  drawWheelsWell(ctx, wheelsX, kbY, wheelsW, kbH);

  // Keyboard (25 Keys: C2 to C4 = 15 White, 10 Black)
  const synthKbX = wheelsX + wheelsW + 8;
  const synthKbW = faceW - wheelsW - 20;

  drawClean25KeyKeyboard(
    ctx,
    synthKbX,
    kbY,
    synthKbW,
    kbH,
    activeNotes,
    settings,
    isGold
  );

  // Bottom solid apron lip running along the front of the keys
  const apronY = y + h - 22;
  const apronGrad = ctx.createLinearGradient(faceX, apronY, faceX, y + h);
  if (isGold) {
    apronGrad.addColorStop(0, '#362413');
    apronGrad.addColorStop(0.4, '#4c3319');
    apronGrad.addColorStop(1, '#1e1308');
  } else {
    apronGrad.addColorStop(0, '#3a160c');
    apronGrad.addColorStop(0.4, '#552112');
    apronGrad.addColorStop(1, '#200904');
  }
  ctx.fillStyle = apronGrad;
  ctx.fillRect(faceX, apronY, faceW, 22);
  ctx.fillStyle = isGold ? 'rgba(254, 240, 138, 0.25)' : 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(faceX, apronY, faceW, 1.2);

  ctx.restore();
}

/**
 * 25-Key Synthesizer Keyboard (C2 to C4: 15 white keys, 10 black keys)
 * Guaranteed 100% visible illuminated active keys with note badges matching reference video!
 */
function drawClean25KeyKeyboard(
  ctx: CanvasRenderingContext2D,
  kbX: number,
  kbY: number,
  kbW: number,
  kbH: number,
  activeNotes: MidiNote[],
  settings: VisualizerSettings,
  isGold = false
) {
  ctx.save();

  const numWhite = 15;
  const whiteKeyW = kbW / numWhite;
  const blackKeyW = whiteKeyW * 0.62;
  const blackKeyH = kbH * 0.62;

  const baseMidi = 36; // C2
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];

  interface KeyPos {
    midi: number;
    x: number;
    w: number;
    h: number;
    isBlack: boolean;
    name: string;
  }
  const keyPositions: KeyPos[] = [];

  // 15 White keys (C2, D2, E2, F2, G2, A2, B2, C3, D3, E3, F3, G3, A3, B3, C4)
  for (let i = 0; i < numWhite; i++) {
    const oct = Math.floor(i / 7);
    const noteInOct = i % 7;
    const midiVal = baseMidi + oct * 12 + whiteOffsets[noteInOct];
    keyPositions.push({
      midi: midiVal,
      x: kbX + i * whiteKeyW,
      w: whiteKeyW,
      h: kbH,
      isBlack: false,
      name: formatNoteName(midiVal, settings.accidental, settings.middleC),
    });
  }

  // 10 Black keys
  const blackOffsets = [
    { whiteIdx: 0, midiOffset: 1 },
    { whiteIdx: 1, midiOffset: 3 },
    { whiteIdx: 3, midiOffset: 6 },
    { whiteIdx: 4, midiOffset: 8 },
    { whiteIdx: 5, midiOffset: 10 },
  ];
  for (let oct = 0; oct < 2; oct++) {
    blackOffsets.forEach(bo => {
      const whiteIdx = oct * 7 + bo.whiteIdx;
      const midiVal = baseMidi + oct * 12 + bo.midiOffset;
      const bx = kbX + (whiteIdx + 1) * whiteKeyW - blackKeyW / 2;
      keyPositions.push({
        midi: midiVal,
        x: bx,
        w: blackKeyW,
        h: blackKeyH,
        isBlack: true,
        name: formatNoteName(midiVal, settings.accidental, settings.middleC),
      });
    });
  }

  // Active key mapping: Fold any playing MIDI note into the 2-octave span
  const activeKeyMap = new Map<number, string>();
  activeNotes.forEach(n => {
    let mappedMidi = n.midi;
    while (mappedMidi < baseMidi) mappedMidi += 12;
    while (mappedMidi > baseMidi + 24) mappedMidi -= 12;
    const formattedName = formatNoteName(n.midi, settings.accidental, settings.middleC);
    activeKeyMap.set(mappedMidi, formattedName);
  });

  // Felt cushioning strip along top (Red for TZ, Gold for Drake)
  ctx.fillStyle = isGold ? '#b48a28' : '#8b151b';
  ctx.fillRect(kbX, kbY, kbW, 4.5);

  // 1. Draw White Keys First
  keyPositions.filter(k => !k.isBlack).forEach(k => {
    const isActive = activeKeyMap.has(k.midi);

    if (isActive) {
      ctx.save();
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16 * (settings.glowIntensity || 1.2);

      // Warm golden/amber gradient matching reference video
      const actGrad = ctx.createLinearGradient(k.x, kbY + 4, k.x, kbY + k.h);
      actGrad.addColorStop(0, '#ffffff');
      actGrad.addColorStop(0.30, '#fef08a');
      actGrad.addColorStop(0.70, '#fde047');
      actGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = actGrad;
      roundRect(ctx, k.x + 0.5, kbY + 4, k.w - 1, k.h - 6, 2.5, true, false);

      // Top striker highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(k.x + 1.5, kbY + 4, k.w - 3, 2.5);
      ctx.restore();

      // Note badge at the bottom of the active white key
      const noteLabel = activeKeyMap.get(k.midi)!;
      const badgeW = k.w - 4;
      const badgeH = 16;
      const badgeX = k.x + 2;
      const badgeY = kbY + k.h - 22;

      ctx.fillStyle = '#14161f';
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.5, true, false);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.5, false, true);

      ctx.font = '800 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(noteLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);
    } else {
      const whiteGrad = ctx.createLinearGradient(k.x, kbY + 4, k.x, kbY + k.h);
      whiteGrad.addColorStop(0, '#fbfaf7');
      whiteGrad.addColorStop(0.85, '#ebe7dc');
      whiteGrad.addColorStop(1, '#dbd5c6');
      ctx.fillStyle = whiteGrad;
      roundRect(ctx, k.x + 0.5, kbY + 4, k.w - 1, k.h - 6, 2.5, true, false);

      ctx.strokeStyle = '#b8af9c';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(k.x + 0.5, kbY + 4, k.w - 1, k.h - 6);
    }
  });

  // 2. Draw Black Keys on Top
  keyPositions.filter(k => k.isBlack).forEach(k => {
    const isActive = activeKeyMap.has(k.midi);

    if (isActive) {
      ctx.save();
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18 * (settings.glowIntensity || 1.2);

      const blkGrad = ctx.createLinearGradient(k.x, kbY + 4, k.x, kbY + k.h);
      blkGrad.addColorStop(0, '#ffffff');
      blkGrad.addColorStop(0.35, '#fde047');
      blkGrad.addColorStop(0.80, '#eab308');
      blkGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = blkGrad;
      roundRect(ctx, k.x, kbY + 4, k.w, k.h, 2, true, false);
      ctx.restore();

      // Note badge at the tip of the black key
      const noteLabel = activeKeyMap.get(k.midi)!;
      const badgeW = k.w - 2;
      const badgeH = 14;
      const badgeX = k.x + 1;
      const badgeY = kbY + k.h - 18;

      ctx.fillStyle = '#0a0d14';
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2, true, false);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 2, false, true);

      ctx.font = '800 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(noteLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 3;
      const blkGrad = ctx.createLinearGradient(k.x, kbY + 4, k.x, kbY + k.h);
      blkGrad.addColorStop(0, '#2c2d33');
      blkGrad.addColorStop(0.7, '#15161a');
      blkGrad.addColorStop(1, '#090a0d');
      ctx.fillStyle = blkGrad;
      roundRect(ctx, k.x, kbY + 4, k.w, k.h, 2, true, false);
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(k.x + 1.5, kbY + 5, k.w - 3, 2.5);
    }
  });

  ctx.restore();
}
