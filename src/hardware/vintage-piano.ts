import { AudioAnalysis, MidiNote, ParsedMidi, VisualizerSettings } from '../types';
import { drawPianoKeyboard, getKeyPosition } from './keyboard-engine';
import { drawMirroredSpectrumBars, drawOscilloscopeBeam, drawVintageVuMeter } from '../shared/waveform-engine';
import { roundRect } from './analog-synth';

// Lazy loaded assets for Drake Take Care
let takeCareImg: HTMLImageElement | null = null;
let isAssetsLoaded = false;

function loadAssets() {
  if (isAssetsLoaded || typeof window === 'undefined') return;
  isAssetsLoaded = true;

  const tc = new Image();
  tc.src = '/assets/take_care_album.jpg';
  tc.onload = () => { takeCareImg = tc; };
}

/**
 * Vintage Wing Upright Piano (Pianoforte Vertical de Concerto dos Anos 40)
 * Tailored exclusively for Drake's "Take Care" aesthetic:
 * Burled mahogany cabinetry, carved acoustic side brackets (wings), gilded baroque picture frame,
 * strictly bounded golden waterfall note roll, and candlelight illuminated ivory keys.
 */
export function drawVintageWingUprightPiano(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  currentTime: number,
  loopTime: number,
  duration: number,
  midi: ParsedMidi,
  activeNotes: MidiNote[],
  analysis: AudioAnalysis,
  settings: VisualizerSettings,
  isWaveformMode: boolean
) {
  loadAssets();
  ctx.save();

  // 1. ZONAL ARCHITECTURAL LAYOUT
  const wingW = 34; // Side acoustic console wings
  const innerX = x + wingW;
  const innerW = w - wingW * 2;

  const upperPhotoH = Math.round(h * 0.44); // Framed portrait area
  const keyboardH = 108;                     // Standard ergonomic keyboard height
  const fallboardH = 28;                     // Gilded brand fallboard
  const pedalsH = 26;                        // Bottom brass pedals apron
  const waterfallH = h - upperPhotoH - fallboardH - keyboardH - pedalsH;

  const upperPhotoY = y + 10;
  const waterfallY = upperPhotoY + upperPhotoH;
  const fallboardY = waterfallY + waterfallH;
  const keyboardY = fallboardY + fallboardH;
  const pedalsY = keyboardY + keyboardH;

  // 2. MAIN CABINET BACKGROUND (Deep Walnut & Burled Mahogany)
  const cabinetGrad = ctx.createLinearGradient(x, y, x, y + h);
  cabinetGrad.addColorStop(0, '#1c0c07');
  cabinetGrad.addColorStop(0.35, '#120704');
  cabinetGrad.addColorStop(0.8, '#0b0402');
  cabinetGrad.addColorStop(1, '#050201');
  ctx.fillStyle = cabinetGrad;
  roundRect(ctx, x, y, w, h, 8, true, false);

  // Antique Gilded Perimeter Inlay
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 8, false, true);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 6, false, true);

  // 3. CARVED SIDE WINGS (Consolas Laterais de Piano Vertical Clássico)
  [x, x + w - wingW].forEach((wx, idx) => {
    ctx.save();
    const wingGrad = ctx.createLinearGradient(wx, y, wx + wingW, y);
    if (idx === 0) {
      wingGrad.addColorStop(0, '#2b1007');
      wingGrad.addColorStop(0.4, '#421a0d');
      wingGrad.addColorStop(0.8, '#2d1108');
      wingGrad.addColorStop(1, '#150603');
    } else {
      wingGrad.addColorStop(0, '#150603');
      wingGrad.addColorStop(0.2, '#2d1108');
      wingGrad.addColorStop(0.6, '#421a0d');
      wingGrad.addColorStop(1, '#2b1007');
    }
    ctx.fillStyle = wingGrad;
    roundRect(ctx, wx, y, wingW, h, idx === 0 ? 8 : 8, true, false);

    // Gilded antique bevel lines on wings
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1;
    const lineX = idx === 0 ? wx + wingW - 3 : wx + 3;
    ctx.beginPath();
    ctx.moveTo(lineX, y + 10);
    ctx.lineTo(lineX, y + h - 10);
    ctx.stroke();

    // Brass Sconce / Candleholder Bracket
    const sconceY = y + upperPhotoH * 0.65;
    const sconceX = wx + wingW / 2;
    const sconceGrad = ctx.createRadialGradient(sconceX, sconceY, 1, sconceX, sconceY, 8);
    sconceGrad.addColorStop(0, '#fef08a');
    sconceGrad.addColorStop(0.4, '#d4af37');
    sconceGrad.addColorStop(1, '#854d0e');
    ctx.fillStyle = sconceGrad;
    ctx.beginPath();
    ctx.arc(sconceX, sconceY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Candlelight Warm Glow
    ctx.fillStyle = 'rgba(253, 224, 71, 0.12)';
    ctx.beginPath();
    ctx.arc(sconceX, sconceY - 14, 22, 0, Math.PI * 2);
    ctx.fill();

    // Candle flame
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(sconceX, sconceY - 14, 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 4. UPPER SECTION: Gilded Framed Portrait of Drake
  const photoMarginX = 14;
  const photoX = innerX + photoMarginX;
  const photoW = innerW - photoMarginX * 2;
  const photoY = upperPhotoY + 4;
  const photoH = upperPhotoH - 12;

  if (takeCareImg && takeCareImg.complete && takeCareImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, photoX, photoY, photoW, photoH, 4, false, false);
    ctx.clip();

    const imgAspect = takeCareImg.naturalWidth / takeCareImg.naturalHeight;
    const targetAspect = photoW / photoH;
    let sx = 0, sy = 0, sw = takeCareImg.naturalWidth, sh = takeCareImg.naturalHeight;
    if (imgAspect > targetAspect) {
      sw = takeCareImg.naturalHeight * targetAspect;
      sx = (takeCareImg.naturalWidth - sw) / 2;
    } else {
      sh = takeCareImg.naturalWidth / targetAspect;
      sy = (takeCareImg.naturalHeight - sh) * 0.28;
    }
    ctx.drawImage(takeCareImg, sx, sy, sw, sh, photoX, photoY, photoW, photoH);

    // Warm candlelight vignette over portrait
    const vignette = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
    vignette.addColorStop(0.5, 'rgba(15, 6, 2, 0.05)');
    vignette.addColorStop(1, 'rgba(8, 3, 1, 0.92)');
    ctx.fillStyle = vignette;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.restore();
  } else {
    // Elegant fallback textured dark velvet soundboard
    ctx.fillStyle = '#100603';
    roundRect(ctx, photoX, photoY, photoW, photoH, 4, true, false);
  }

  // Double Gilded Baroque Frame with Corner Rosettes
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  roundRect(ctx, photoX, photoY, photoW, photoH, 4, false, true);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, photoX + 4, photoY + 4, photoW - 8, photoH - 8, 3, false, true);

  // 5. MIDDLE SECTION: Strictly Bounded Waterfall Note Roll OR Waveform
  if (isWaveformMode) {
    // ==========================================
    // WAVEFORM MODE (DUAL ANALOG VU METERS + MOLTEN GOLD SCOPE)
    // ==========================================
    const vuAreaY = waterfallY + 12;
    const vuW = (innerW - 36) / 2;
    const vuH = 72;

    drawVintageVuMeter(ctx, innerX + 12, vuAreaY, vuW, vuH, 'LEFT • ACOUSTIC BUS', analysis, currentTime, false);
    drawVintageVuMeter(ctx, innerX + 24 + vuW, vuAreaY, vuW, vuH, 'RIGHT • ACOUSTIC BUS', analysis, currentTime, true);

    const scopeCenterY = vuAreaY + vuH + (fallboardY - (vuAreaY + vuH)) / 2;
    drawMirroredSpectrumBars(
      ctx,
      innerX + 16,
      scopeCenterY,
      innerW - 32,
      75,
      analysis.fft,
      48,
      2,
      '#fde047',
      '#d4af37'
    );

    drawOscilloscopeBeam(
      ctx,
      innerX + 16,
      scopeCenterY,
      innerW - 32,
      35,
      analysis.waveform,
      '#ffffff',
      '#fde047'
    );

  } else {
    // ==========================================
    // PIANO MODE: STRICTLY CLIPPED WATERFALL ROLL
    // ==========================================
    const waterfallX = innerX + 10;
    const waterfallW = innerW - 20;

    // Dark Velvet Soundboard Backdrop
    ctx.fillStyle = '#080302';
    ctx.fillRect(waterfallX, waterfallY, waterfallW, waterfallH);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(waterfallX, waterfallY, waterfallW, waterfallH);

    // Subtle Vertical String Lines matching piano soundboard
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
    ctx.lineWidth = 0.8;
    for (let lx = waterfallX + 20; lx < waterfallX + waterfallW; lx += 24) {
      ctx.beginPath();
      ctx.moveTo(lx, waterfallY);
      ctx.lineTo(lx, waterfallY + waterfallH);
      ctx.stroke();
    }

    // STRICT CLIPPING RECTANGLE:
    // Notes CANNOT bleed upwards into Drake's face and CANNOT bleed downwards past the piano keys!
    ctx.save();
    ctx.beginPath();
    ctx.rect(waterfallX, waterfallY, waterfallW, waterfallH);
    ctx.clip();

    const allNotes = midi.notes || [];
    const windowSecs = 3.0; // 3 seconds lookahead

    allNotes.forEach(note => {
      const timeToHit = note.time - loopTime;
      // Only render notes within the visible time window
      if (timeToHit >= -note.duration && timeToHit <= windowSecs) {
        // Derive exact X coordinate from the underlying keyboard keys
        const keyGeom = getKeyPosition(note.midi, waterfallX, waterfallW);
        const nx = keyGeom.x + 1.5;
        const nw = Math.max(6, keyGeom.width - 3);

        // Calculate vertical position: notes fall downwards into the fallboard (y = waterfallY + waterfallH)
        const hitY = waterfallY + waterfallH;
        const ny = hitY - (timeToHit / windowSecs) * waterfallH;
        const nh = Math.max(6, (note.duration / windowSecs) * waterfallH);

        const isStriking = timeToHit <= 0 && timeToHit >= -note.duration;

        ctx.save();
        if (isStriking) {
          // Molten White-Gold when actively striking
          const strikeGrad = ctx.createLinearGradient(nx, ny - nh, nx, ny);
          strikeGrad.addColorStop(0, '#fef08a');
          strikeGrad.addColorStop(0.5, '#ffffff');
          strikeGrad.addColorStop(1, '#fde047');
          ctx.fillStyle = strikeGrad;
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 14;
        } else {
          // Warm Antique Gold for pending notes
          const noteGrad = ctx.createLinearGradient(nx, ny - nh, nx, ny);
          noteGrad.addColorStop(0, 'rgba(212, 175, 55, 0.45)');
          noteGrad.addColorStop(1, 'rgba(253, 224, 71, 0.85)');
          ctx.fillStyle = noteGrad;
        }

        // Draw note bar with rounded top
        roundRect(ctx, nx, ny - nh, nw, nh, 2.5, true, false);
        ctx.restore();
      }
    });

    ctx.restore(); // Exit waterfall clipping region
  }

  // 6. GILDED WOODEN FALLBOARD (Tampa do Piano com Inscrição Dourada)
  const fbX = innerX + 8;
  const fbW = innerW - 16;

  const fbGrad = ctx.createLinearGradient(fbX, fallboardY, fbX, fallboardY + fallboardH);
  fbGrad.addColorStop(0, '#2d1209');
  fbGrad.addColorStop(0.4, '#1b0803');
  fbGrad.addColorStop(1, '#0e0401');
  ctx.fillStyle = fbGrad;
  ctx.fillRect(fbX, fallboardY, fbW, fallboardH);

  // Brass Bevel Edge
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(fbX, fallboardY, fbW, fallboardH);

  // Authentic Gold Engraved Fallboard Plaque
  ctx.font = '800 10.5px "JetBrains Mono", monospace';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦ OVO SOUND • VINTAGE PIANOFORTE • TORONTO 2011 ✦', fbX + fbW / 2, fallboardY + fallboardH / 2);
  ctx.shadowBlur = 0;
  ctx.letterSpacing = '0px';

  // 7. PHYSICAL PIANO KEYBOARD (37 Keys: 22 White, 15 Black, C2 to C5)
  const kbX = innerX + 10;
  const kbW = innerW - 20;

  drawPianoKeyboard(
    ctx,
    kbX,
    keyboardY,
    kbW,
    keyboardH,
    activeNotes,
    settings,
    {
      skin: 'vintage-upright',
      activeColor: '#fde047',
      glowColor: '#d4af37',
      glowIntensity: 1.4,
    }
  );

  // 8. BOTTOM WOODEN APRON & BRASS PEDALS
  const apronX = innerX + 8;
  const apronW = innerW - 16;
  const apronGrad = ctx.createLinearGradient(apronX, pedalsY, apronX, pedalsY + pedalsH);
  apronGrad.addColorStop(0, '#1c0a06');
  apronGrad.addColorStop(0.5, '#100503');
  apronGrad.addColorStop(1, '#080201');
  ctx.fillStyle = apronGrad;
  roundRect(ctx, apronX, pedalsY, apronW, pedalsH, 3, true, false);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, apronX, pedalsY, apronW, pedalsH, 3, false, true);

  // Three Brass Foot Pedals (Una Corda, Sostenuto, Sustain)
  const pedalW = 14;
  const pedalH = 12;
  const pedalSpacing = 28;
  const centerPedalX = apronX + apronW / 2;

  [-1, 0, 1].forEach(offset => {
    const px = centerPedalX + offset * pedalSpacing - pedalW / 2;
    const py = pedalsY + 6;
    const pGrad = ctx.createLinearGradient(px, py, px, py + pedalH);
    pGrad.addColorStop(0, '#fef08a');
    pGrad.addColorStop(0.5, '#d4af37');
    pGrad.addColorStop(1, '#854d0e');
    ctx.fillStyle = pGrad;
    roundRect(ctx, px, py, pedalW, pedalH, 2, true, false);
  });

  ctx.restore();
}
