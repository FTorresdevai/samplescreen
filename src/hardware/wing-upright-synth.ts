import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { roundRect } from '../shared/canvas-utils';
import { getCachedImage } from '../shared/assets';

// Offscreen cache for the heavy static elements of the Wing Upright VST Console
let cachedCanvas: HTMLCanvasElement | null = null;
let cachedCtx: CanvasRenderingContext2D | null = null;
let lastCacheKey = '';

/**
 * Draws the authentic Spectrasonics Keyscape Wing Upright Piano Console
 * Features the real photograph of the Wing Upright Piano in full VST plugin format,
 * completely free of preset menus, with pristine DAW window framing and audio-reactive acoustics.
 */
export function drawWingUprightSynth(
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
  const wingPianoImg = getCachedImage('images/wing_upright_piano_real.jpg', () => {
    lastCacheKey = '';
  });

  const cacheKey = `${w}_${h}_${wingPianoImg ? 'loaded' : 'pending'}`;

  // Build / update offscreen cache for static VST frame and photo
  if (!cachedCanvas || cachedCanvas.width !== w || cachedCanvas.height !== h || lastCacheKey !== cacheKey) {
    if (!cachedCanvas) {
      cachedCanvas = document.createElement('canvas');
    }
    cachedCanvas.width = w;
    cachedCanvas.height = h;
    cachedCtx = cachedCanvas.getContext('2d');
    if (cachedCtx) {
      renderStaticWingUprightVST(cachedCtx, 0, 0, w, h, settings);
      lastCacheKey = cacheKey;
    }
  }

  // 1. Draw cached static VST console in a single drawImage call (solid 60 FPS)
  if (cachedCanvas) {
    ctx.drawImage(cachedCanvas, x, y);
  } else {
    renderStaticWingUprightVST(ctx, x, y, w, h, settings);
  }

  // 2. Draw dynamic interactive elements (soundboard bloom, pedal glints, VU meters, MIDI LED)
  renderDynamicWingUprightVST(ctx, x, y, w, h, currentTime, activeNotes, analysis, settings);
}

/**
 * Renders all static graphics of the Wing Upright Piano VST into offscreen cache
 */
function renderStaticWingUprightVST(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  settings: VisualizerSettings
) {
  const titlebarH = 34;
  const bottomBarH = 34;
  const radius = 10;

  // 1. Outer Chassis: Sleek dark obsidian metallic DAW window
  ctx.save();
  const chassisGrad = ctx.createLinearGradient(x, y, x, y + h);
  chassisGrad.addColorStop(0, '#1c1f28');
  chassisGrad.addColorStop(0.3, '#13151c');
  chassisGrad.addColorStop(1, '#0b0c10');
  ctx.fillStyle = chassisGrad;
  roundRect(ctx, x, y, w, h, radius, true, false);

  // Subtle outer metallic bezel border
  ctx.strokeStyle = '#2d3240';
  ctx.lineWidth = 1.6;
  roundRect(ctx, x, y, w, h, radius, false, true);

  // 2. DAW Titlebar Header (Height: 34px)
  const tbGrad = ctx.createLinearGradient(x, y, x, y + titlebarH);
  tbGrad.addColorStop(0, '#2d3340');
  tbGrad.addColorStop(0.5, '#202530');
  tbGrad.addColorStop(1, '#151922');
  ctx.fillStyle = tbGrad;
  roundRect(ctx, x, y, w, titlebarH, radius, true, false);
  ctx.fillRect(x, y + titlebarH - radius, w, radius);

  // Divider under titlebar
  ctx.strokeStyle = '#0d0f14';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + titlebarH);
  ctx.lineTo(x + w, y + titlebarH);
  ctx.stroke();

  // 3. macOS Window Controls (Red, Yellow, Green Glass Buttons)
  const btnY = y + titlebarH / 2;
  const btnStartX = x + 16;
  const btnSpacing = 16;

  const windowButtons = [
    { color: '#ff5f56', border: '#e0443e', inner: '#ff857d' }, // Close
    { color: '#ffbd2e', border: '#dea123', inner: '#ffd56e' }, // Minimize
    { color: '#27c93f', border: '#1aab29', inner: '#59dd6c' }, // Expand
  ];

  windowButtons.forEach((btn, idx) => {
    const bx = btnStartX + idx * btnSpacing;
    ctx.fillStyle = btn.color;
    ctx.beginPath();
    ctx.arc(bx, btnY, 5.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = btn.border;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = btn.inner;
    ctx.beginPath();
    ctx.arc(bx - 1.2, btnY - 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. Titlebar Typography
  ctx.font = '700 12.5px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('VST3: Spectrasonics Keyscape™ — [Wing Upright Piano (1900)]', btnStartX + btnSpacing * 3 + 12, btnY);

  // 5. Titlebar Right Badges
  const badgeRightX = x + w - 16;
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // "64-BIT VST3" pill
  const pillW = 68;
  const pillH = 17;
  const pillX = badgeRightX - pillW;
  const pillY = btnY - pillH / 2;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, pillX, pillY, pillW, pillH, 4, true, false);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  roundRect(ctx, pillX, pillY, pillW, pillH, 4, false, true);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText('64-BIT VST3', pillX + pillW / 2, btnY);

  // "48.0 kHz" indicator
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText('48.0 kHz', pillX - 12, btnY);

  // 6. Main Instrument Viewport
  const vpX = x + 2;
  const vpY = y + titlebarH;
  const vpW = w - 4;
  const vpH = h - titlebarH - bottomBarH;

  // Viewport Background: Warm dark mahogany acoustic room
  const vpGrad = ctx.createRadialGradient(vpX + vpW / 2, vpY + vpH / 2, 80, vpX + vpW / 2, vpY + vpH / 2, vpW * 0.6);
  vpGrad.addColorStop(0, '#1c120c');
  vpGrad.addColorStop(0.6, '#0f0a07');
  vpGrad.addColorStop(1, '#080504');
  ctx.fillStyle = vpGrad;
  ctx.fillRect(vpX, vpY, vpW, vpH);

  // 7. Render Real Wing Upright Piano Photo (Without preset browser!)
  const wingPianoImg = getCachedImage('images/wing_upright_piano_real.jpg');
  if (wingPianoImg && wingPianoImg.complete && wingPianoImg.naturalWidth > 0) {
    const origW = wingPianoImg.naturalWidth;   // 584
    const origH = wingPianoImg.naturalHeight;  // 340
    const imgAspect = origW / origH;          // ~1.7176

    // Fit cleanly inside viewport with maximum presence
    let drawW = vpW;
    let drawH = vpW / imgAspect;
    if (drawH > vpH) {
      drawH = vpH;
      drawW = vpH * imgAspect;
    }

    const drawX = vpX + (vpW - drawW) / 2;
    const drawY = vpY + (vpH - drawH) / 2;

    ctx.save();
    roundRect(ctx, vpX, vpY, vpW, vpH, 4, true, false);
    ctx.clip();

    // Draw the pure Wing Upright Piano photograph
    ctx.drawImage(wingPianoImg, 0, 0, origW, origH, drawX, drawY, drawW, drawH);

    // Warm atmospheric studio vignette overlay around the piano edges
    const edgeVigLeft = ctx.createLinearGradient(vpX, 0, vpX + 60, 0);
    edgeVigLeft.addColorStop(0, 'rgba(8, 5, 4, 0.85)');
    edgeVigLeft.addColorStop(1, 'rgba(8, 5, 4, 0)');
    ctx.fillStyle = edgeVigLeft;
    ctx.fillRect(vpX, vpY, 60, vpH);

    const edgeVigRight = ctx.createLinearGradient(vpX + vpW - 60, 0, vpX + vpW, 0);
    edgeVigRight.addColorStop(0, 'rgba(8, 5, 4, 0)');
    edgeVigRight.addColorStop(1, 'rgba(8, 5, 4, 0.85)');
    ctx.fillStyle = edgeVigRight;
    ctx.fillRect(vpX + vpW - 60, vpY, 60, vpH);

    // Subtle golden corner accents
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX + 4, vpY + 4, vpW - 8, vpH - 8);

    ctx.restore();
  } else {
    // Elegant fallback if asset still loading
    ctx.fillStyle = '#14161f';
    ctx.fillRect(vpX, vpY, vpW, vpH);
    ctx.font = '600 14px "Inter", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Spectrasonics Wing Upright Interface...', vpX + vpW / 2, vpY + vpH / 2);
  }

  // 8. Bottom Status Strip (Height: 34px)
  const bbY = y + h - bottomBarH;
  const bbGrad = ctx.createLinearGradient(x, bbY, x, bbY + bottomBarH);
  bbGrad.addColorStop(0, '#151922');
  bbGrad.addColorStop(0.5, '#12141c');
  bbGrad.addColorStop(1, '#0b0c10');
  ctx.fillStyle = bbGrad;
  roundRect(ctx, x, bbY, w, bottomBarH, radius, true, false);
  ctx.fillRect(x, bbY, w, radius);

  // Top divider of bottom bar
  ctx.strokeStyle = '#202532';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, bbY);
  ctx.lineTo(x + w, bbY);
  ctx.stroke();

  // Bottom Bar Telemetry Labels
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  const midBbY = bbY + bottomBarH / 2;

  // Left: Model & Mechanism
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'left';
  ctx.fillText('MODEL: WING UPRIGHT (1900)', x + 16, midBbY);

  ctx.fillStyle = '#94a3b8';
  ctx.fillText('• 4-PEDAL SYSTEM (TREMELO / TACK)', x + 215, midBbY);

  // Center: Character preset
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText('ACOUSTIC SALON • STEREO RIBBON', x + w / 2 + 50, midBbY);

  ctx.restore();
}

/**
 * Renders dynamic audio-reactive elements over the Wing Upright Piano VST at 60 FPS
 */
function renderDynamicWingUprightVST(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  currentTime: number,
  activeNotes: MidiNote[],
  analysis: AudioAnalysis,
  settings: VisualizerSettings
) {
  const titlebarH = 34;
  const bottomBarH = 34;
  const vpX = x + 2;
  const vpY = y + titlebarH;
  const vpW = w - 4;
  const vpH = h - titlebarH - bottomBarH;

  // 1. Titlebar Active MIDI Activity Signal LED
  const isMidiActive = activeNotes.length > 0;
  const ledX = x + w - 160;
  const ledY = y + titlebarH / 2;

  ctx.save();
  ctx.fillStyle = isMidiActive ? '#22c55e' : '#15803d';
  if (isMidiActive) {
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.arc(ledX, ledY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillStyle = isMidiActive ? '#86efac' : '#475569';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MIDI IN', ledX + 8, ledY);
  ctx.restore();

  // 2. Audio-Reactive Acoustic Bloom in the Open Piano Harp & Hammers
  // In the real Wing Upright image, the open hammers and strings are centered at x ~ 50% and y ~ 28% of the viewport
  const harpX = vpX + vpW / 2;
  const harpY = vpY + vpH * 0.28;
  const harpRadius = 60 + analysis.bass * 80 + (isMidiActive ? 25 : 0);

  ctx.save();
  const harpGlow = ctx.createRadialGradient(harpX, harpY, 10, harpX, harpY, harpRadius);
  harpGlow.addColorStop(0, `rgba(253, 224, 71, ${0.20 + analysis.bass * 0.25})`);
  harpGlow.addColorStop(0.45, `rgba(245, 158, 11, ${0.10 + analysis.mid * 0.15})`);
  harpGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = harpGlow;
  ctx.beginPath();
  ctx.arc(harpX, harpY, harpRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Brass Pedals Specular Reflection (Located at bottom center of piano)
  const pedalY = vpY + vpH * 0.82;
  const pedalGleam = analysis.bass * 0.45;
  if (pedalGleam > 0.05) {
    const pedalGlow = ctx.createRadialGradient(harpX, pedalY, 5, harpX, pedalY, 70);
    pedalGlow.addColorStop(0, `rgba(254, 240, 138, ${pedalGleam})`);
    pedalGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pedalGlow;
    ctx.beginPath();
    ctx.arc(harpX, pedalY, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Stereo Peak VU Meters on the Right side of the Bottom Status Bar
  const bbY = y + h - bottomBarH;
  const meterX = x + w - 120;
  const meterY = bbY + 9;
  const meterW = 95;
  const meterH = 6;

  // Channel L
  const leftLevel = Math.min(1, (analysis.bass * 0.7 + analysis.mid * 0.3) * (settings.audioSensitivity || 1.2));
  // Channel R
  const rightLevel = Math.min(1, (analysis.bass * 0.5 + analysis.treble * 0.5) * (settings.audioSensitivity || 1.2));

  [
    { yPos: meterY, level: leftLevel, label: 'L' },
    { yPos: meterY + meterH + 4, level: rightLevel, label: 'R' },
  ].forEach(ch => {
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText(ch.label, meterX - 5, ch.yPos + meterH / 2);

    // Background track
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, meterX, ch.yPos, meterW, meterH, 2, true, false);

    // Dynamic LED bars (segment style)
    const activeW = Math.round(meterW * ch.level);
    if (activeW > 0) {
      const ledGrad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
      ledGrad.addColorStop(0, '#22c55e');
      ledGrad.addColorStop(0.65, '#eab308');
      ledGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = ledGrad;
      ctx.shadowColor = ch.level > 0.8 ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 4;
      roundRect(ctx, meterX, ch.yPos, activeW, meterH, 2, true, false);
      ctx.shadowBlur = 0;
    }
  });

  ctx.restore();
}
