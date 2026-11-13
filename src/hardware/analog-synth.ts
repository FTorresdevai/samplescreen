import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { drawPianoKeyboard, KeyboardSkin } from './keyboard-engine';
import { roundRect } from '../shared/canvas-utils';
import { computePitchWheelDeflection } from './motion';

export { roundRect };

/**
 * Draws a 3D Precision Rotary Synthesizer Knob with Circular Tick Marks and Audio-Reactive LED Arc
 */
function drawHardwareKnob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  label: string,
  baseAngleDeg: number,
  modulation: number,
  activeColor: string
) {
  const currentAngle = (baseAngleDeg + modulation * 40) * (Math.PI / 180);

  // Outer Tick Ring
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // Audio-Reactive Glowing LED Arc
  if (modulation > 0.05) {
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 7, 0.75 * Math.PI, 0.75 * Math.PI + modulation * 1.5 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Cylindrical Knob Body Drop Shadow
  ctx.fillStyle = '#090a0d';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer Metal Bezel
  const bezelGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  bezelGrad.addColorStop(0, '#3a3c44');
  bezelGrad.addColorStop(0.5, '#1b1c20');
  bezelGrad.addColorStop(1, '#0e0f12');
  ctx.fillStyle = bezelGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#08090b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner Cap
  const innerR = radius * 0.78;
  const innerGrad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, innerR);
  innerGrad.addColorStop(0, '#2e3037');
  innerGrad.addColorStop(0.8, '#141518');
  innerGrad.addColorStop(1, '#0a0a0c');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  // White Pointer Notch
  const ptrLen = innerR * 0.75;
  const px = cx + Math.cos(currentAngle) * ptrLen;
  const py = cy + Math.sin(currentAngle) * ptrLen;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.stroke();

  // Label Below
  ctx.font = '700 8.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label.toUpperCase(), cx, cy + radius + 11);
  ctx.restore();
}

/**
 * Authentic Vintage Red-Wine Analog Synthesizer Console
 * Complete with Mahogany wood cheeks, brass screws, control modules with LED knobs,
 * 7-segment digital display, pitch/mod wheels bay, and 3-octave keyboard.
 */
export function drawAnalogHardwareSynthesizer(
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
  options: { skin?: KeyboardSkin; faceColorTop?: string; faceColorBottom?: string } = {}
) {
  ctx.save();
  const woodW = 28;

  // 1. Chassis Outer Glow & Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#07080a';
  roundRect(ctx, x, y, w, h, 6, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 2. Solid Mahogany Wood Side Cheeks with Brass Screws
  [x, x + w - woodW].forEach((wx, idx) => {
    const woodGrad = ctx.createLinearGradient(wx, y, wx + woodW, y);
    if (idx === 0) {
      woodGrad.addColorStop(0, '#220b06');
      woodGrad.addColorStop(0.35, '#45180f');
      woodGrad.addColorStop(0.7, '#5c2014');
      woodGrad.addColorStop(1, '#2c0d08');
    } else {
      woodGrad.addColorStop(0, '#2c0d08');
      woodGrad.addColorStop(0.3, '#5c2014');
      woodGrad.addColorStop(0.65, '#45180f');
      woodGrad.addColorStop(1, '#220b06');
    }
    ctx.fillStyle = woodGrad;
    roundRect(ctx, wx, y, woodW, h, 4, true, false);

    // Brass Countersunk Screws
    const screwPositions = [y + 24, y + h / 2, y + h - 26];
    screwPositions.forEach(sy => {
      const sx = wx + woodW / 2;
      ctx.save();
      const screwGrad = ctx.createRadialGradient(sx - 1, sy - 1, 1, sx, sy, 4.5);
      screwGrad.addColorStop(0, '#d4af37');
      screwGrad.addColorStop(0.6, '#997a25');
      screwGrad.addColorStop(1, '#4a3b12');
      ctx.fillStyle = screwGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Slotted notch
      ctx.strokeStyle = '#181206';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 2.8, sy);
      ctx.lineTo(sx + 2.8, sy);
      ctx.stroke();
      ctx.restore();
    });
  });

  // 3. Faceplate Setup (Metallic Wine-Red / Magma / Charcoal)
  const faceX = x + woodW;
  const faceW = w - woodW * 2;
  const faceH = Math.round(h * 0.58); // Top control section

  const colorTop = options.faceColorTop || '#58151c';
  const colorBottom = options.faceColorBottom || '#240609';

  const faceGrad = ctx.createLinearGradient(faceX, y, faceX, y + faceH);
  faceGrad.addColorStop(0, colorTop);
  faceGrad.addColorStop(0.4, '#3d0d12');
  faceGrad.addColorStop(1, colorBottom);
  ctx.fillStyle = faceGrad;
  ctx.fillRect(faceX, y, faceW, faceH);

  // Subtle Metallic Grain Lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let ly = y + 2; ly < y + faceH; ly += 3) {
    ctx.fillRect(faceX, ly, faceW, 1);
  }

  // 4. Silk-Screen Header Strip
  const headerY = y + 20;
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.letterSpacing = '1.8px';
  ctx.fillStyle = '#b2bac2';
  ctx.textAlign = 'left';
  ctx.fillText('SEQUENTIAL VECTORS • PROPHET-5 REV 3.3', faceX + 16, headerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = settings.accentColor || '#38bdf8';
  const patchTitle = (settings.title || 'ST-909 ANALOG LEAD').toUpperCase();
  ctx.fillText(patchTitle, faceX + faceW - 16, headerY);
  ctx.letterSpacing = '0px';

  // Hairline separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(faceX + 14, headerY + 8);
  ctx.lineTo(faceX + faceW - 14, headerY + 8);
  ctx.stroke();

  // 5. Four Control Modules (LFO, OSC, 24dB FILTER, ENVELOPE)
  const modAreaY = headerY + 16;
  const modAreaH = 110;
  const numModules = 4;
  const modGap = 8;
  const modW = (faceW - 28 - modGap * (numModules - 1)) / numModules;

  const modules = [
    {
      title: 'LFO / MOD',
      knobs: [
        { label: 'Freq', angle: 45, mod: analysis.treble },
        { label: 'Depth', angle: -20, mod: analysis.mid },
      ],
    },
    {
      title: 'OSCILLATOR',
      knobs: [
        { label: 'Wave', angle: 10, mod: 0.1 },
        { label: 'PW', angle: 60, mod: analysis.bass * 0.5 },
      ],
    },
    {
      title: '24dB FILTER',
      knobs: [
        { label: 'Cutoff', angle: -60, mod: analysis.bass },
        { label: 'Res', angle: 30, mod: analysis.mid },
      ],
    },
    {
      title: 'ENVELOPE',
      knobs: [
        { label: 'Attack', angle: -80, mod: 0.15 },
        { label: 'Release', angle: 50, mod: analysis.bass * 0.4 },
      ],
    },
  ];

  modules.forEach((mod, idx) => {
    const mx = faceX + 14 + idx * (modW + modGap);
    // Module enclosure
    ctx.fillStyle = 'rgba(12, 13, 17, 0.65)';
    roundRect(ctx, mx, modAreaY, modW, modAreaH, 4, true, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, mx, modAreaY, modW, modAreaH, 4, false, true);

    // Module Title
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title, mx + modW / 2, modAreaY + 14);

    // Knobs inside module
    const knobSpacing = modW / 2;
    const knobRadius = Math.min(16, (modW - 16) / 4);
    const knobY = modAreaY + 54;

    mod.knobs.forEach((kb, kIdx) => {
      const kx = mx + knobSpacing * (kIdx + 0.5);
      drawHardwareKnob(
        ctx,
        kx,
        knobY,
        knobRadius,
        kb.label,
        kb.angle,
        kb.mod,
        settings.accentColor || '#fde047'
      );
    });
  });

  // 6. Program Preset Strip & 7-Segment Digital Display
  const presetBarY = modAreaY + modAreaH + 10;
  const presetBarH = 46;
  const pbx = faceX + 14;
  const pbw = faceW - 28;

  ctx.fillStyle = '#0a0b0e';
  roundRect(ctx, pbx, presetBarY, pbw, presetBarH, 4, true, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, pbx, presetBarY, pbw, presetBarH, 4, false, true);

  // Digital LED Screen (Shows current playback Bar:Beat, e.g. "BAR 04.2")
  const ledX = pbx + 12;
  const ledY = presetBarY + 8;
  const ledW = 100;
  const ledH = 30;

  ctx.fillStyle = '#140406';
  roundRect(ctx, ledX, ledY, ledW, ledH, 3, true, false);
  ctx.strokeStyle = '#2d080e';
  ctx.lineWidth = 1.2;
  roundRect(ctx, ledX, ledY, ledW, ledH, 3, false, true);

  // Dim ghost unlit LED background segments
  ctx.font = '700 15px "Courier New", monospace';
  ctx.fillStyle = 'rgba(220, 38, 38, 0.12)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('88:88', ledX + ledW / 2, ledY + ledH / 2);

  // Active glowing 7-segment digital readout
  const bpm = settings.bpm || midi.bpm || 80;
  const secondsPerBeat = 60 / bpm;
  const currentBeat = Math.floor(currentTime / secondsPerBeat);
  const barNum = Math.floor(currentBeat / 4) + 1;
  const beatInBar = (currentBeat % 4) + 1;
  const barDisplay = `B${String(barNum).padStart(2, '0')}.${beatInBar}`;

  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 8;
  ctx.fillText(barDisplay, ledX + ledW / 2, ledY + ledH / 2);
  ctx.shadowBlur = 0;

  // Preset Buttons 1 - 8
  const btnStartX = ledX + ledW + 24;
  const btnW = 24;
  const btnH = 22;
  const btnGap = 8;

  for (let b = 1; b <= 8; b++) {
    const bx = btnStartX + (b - 1) * (btnW + btnGap);
    const by = presetBarY + 12;
    const isLit = b === 1 || (b === (barNum % 8) + 1);

    ctx.fillStyle = isLit ? '#991b1b' : '#1e2025';
    roundRect(ctx, bx, by, btnW, btnH, 2, true, false);
    ctx.strokeStyle = isLit ? '#ef4444' : '#0d0e11';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, btnW, btnH, 2, false, true);

    ctx.font = '800 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = isLit ? '#ffffff' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${b}`, bx + btnW / 2, by + btnH / 2);
  }

  // Engraved Metal Producer Plaque on the right
  const plaqueW = 180;
  const plaqueH = 26;
  const plaqueX = pbx + pbw - plaqueW - 10;
  const plaqueY = presetBarY + 10;

  const plaqueGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX, plaqueY + plaqueH);
  plaqueGrad.addColorStop(0, '#383b42');
  plaqueGrad.addColorStop(0.5, '#22242a');
  plaqueGrad.addColorStop(1, '#15161a');
  ctx.fillStyle = plaqueGrad;
  roundRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 3, true, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, plaqueX, plaqueY, plaqueW, plaqueH, 3, false, true);

  ctx.font = '800 10px "JetBrains Mono", monospace';
  ctx.fillStyle = settings.accentColor || '#fde047';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const handle = (settings.producerHandle || 'PRODUCER NAME').toUpperCase();
  ctx.fillText(handle, plaqueX + plaqueW / 2, plaqueY + plaqueH / 2);

  // 7. Lower Section: Keyboard Shelf with Wheels Bay & 3-Octave Keyboard
  const shelfY = y + faceH;
  const shelfH = h - faceH - 12; // bottom apron leaves 12px
  const shelfX = faceX;
  const shelfW = faceW;

  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(shelfX, shelfY, shelfW, shelfH);

  // Pitch & Mod Wheels Bay on Left
  const wheelsBayW = 68;
  const wheelsBayX = shelfX + 12;
  const wheelsBayY = shelfY + 8;
  const wheelsBayH = shelfH - 14;

  ctx.fillStyle = '#060709';
  roundRect(ctx, wheelsBayX, wheelsBayY, wheelsBayW, wheelsBayH, 3, true, false);
  ctx.strokeStyle = '#1a1c24';
  ctx.lineWidth = 1.2;
  roundRect(ctx, wheelsBayX, wheelsBayY, wheelsBayW, wheelsBayH, 3, false, true);

  // Draw Pitch and Mod Wheel slots
  const wheelW = 20;
  const wheelH = wheelsBayH - 24;
  const loopDuration = midi.duration || 16;
  const loopTime = ((currentTime % loopDuration) + loopDuration) % loopDuration;
  const pitchDeflection = computePitchWheelDeflection(midi.notes, activeNotes, loopTime);
  [
    { name: 'PITCH', x: wheelsBayX + 9, val: pitchDeflection },
    { name: 'MOD', x: wheelsBayX + wheelsBayW - wheelW - 9, val: analysis.bass * 8 },
  ].forEach(wh => {
    const wy = wheelsBayY + 8;
    // Wheel body with ribbed lines
    const whGrad = ctx.createLinearGradient(wh.x, wy, wh.x + wheelW, wy);
    whGrad.addColorStop(0, '#121316');
    whGrad.addColorStop(0.5, '#2e3038');
    whGrad.addColorStop(1, '#0e0f12');
    ctx.fillStyle = whGrad;
    roundRect(ctx, wh.x, wy, wheelW, wheelH, 2, true, false);

    // Ribbed ridges, shifted by wheel value
    const offset = ((wh.val % 5) + 5) % 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    for (let ry = wy + 4 + offset; ry < wy + wheelH - 4; ry += 5) {
      ctx.fillRect(wh.x + 1, ry, wheelW - 2, 2);
    }

    ctx.font = '700 7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(wh.name, wh.x + wheelW / 2, wy + wheelH + 11);
  });

  // 8. Draw Integrated 3-Octave Piano Keyboard (C2 to C5, 37 keys)
  const kbX = wheelsBayX + wheelsBayW + 12;
  const kbY = shelfY + 8;
  const kbW = shelfW - (wheelsBayW + 36);
  const kbH = shelfH - 12;

  drawPianoKeyboard(
    ctx,
    kbX,
    kbY,
    kbW,
    kbH,
    activeNotes,
    settings,
    {
      skin: options.skin || 'modern-synth',
      activeColor: settings.notesColor || '#f59e0b',
      glowColor: settings.glowColor || '#f59e0b',
    }
  );

  // 9. Solid Mahogany Bottom Lip / Front Apron
  const apronY = y + h - 14;
  const apronGrad = ctx.createLinearGradient(x, apronY, x, apronY + 14);
  apronGrad.addColorStop(0, '#1c0a06');
  apronGrad.addColorStop(0.4, '#3e150d');
  apronGrad.addColorStop(1, '#240b06');
  ctx.fillStyle = apronGrad;
  roundRect(ctx, x, apronY, w, 14, 3, true, false);
  ctx.strokeStyle = '#120502';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, apronY);
  ctx.lineTo(x + w, apronY);
  ctx.stroke();

  ctx.restore();
}
