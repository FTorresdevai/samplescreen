import { ModelDrawContext } from '../../types';
import { formatNoteName, detectChord } from '../../engine/chords';
import { hexToRgbaStr } from '../../engine/palettes';
import { roundRect } from '../../hardware/st909-synth';

// Lazy loaded assets for Take Care
let takeCareImg: HTMLImageElement | null = null;
let vintagePianoImg: HTMLImageElement | null = null;
let isLoaded = false;

function loadAssets() {
  if (isLoaded || typeof window === 'undefined') return;
  isLoaded = true;

  const tc = new Image();
  tc.src = '/assets/take_care_album.jpg';
  tc.onload = () => { takeCareImg = tc; };

  const vp = new Image();
  vp.src = '/assets/vintage_piano.jpg';
  vp.onload = () => { vintagePianoImg = vp; };
}

// Start loading assets immediately in browser
if (typeof window !== 'undefined') {
  loadAssets();
}

/**
 * Mode: "Take Care" • OVO Baroque Salon & Vintage Grand Piano Lounge
 * Faithfully reproduces the aesthetic and elements of Drake's iconic "Take Care" album cover:
 * - Dim, opulent baroque salon with deep mahogany wood & burgundy damask walls
 * - Authentic high-res Take Care photograph of Drake seated with golden candelabrum
 * - Dynamic organic flickering candle flame casting warm chiaroscuro light & rising golden embers
 * - Cursive gold "Take Care" signature script
 * - Note Waterfall: notes cascade down from the room directly onto the piano keys, bursting into molten gold on impact
 * - Gilded fallboard with "• 40'S VINTAGE PIANOFORTE • TORONTO 2011 •" & red velvet felt
 * - Vintage Grand Piano physically seen being played: keys visibly depress and ignite with molten gold
 */
export function drawTakeCareModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  loadAssets();

  const { region, currentTime, loopTime, duration, midi, activeNotes, analysis, settings, introInfo } = context;
  const { x, y, width: w, height: h } = region;

  ctx.save();

  // 1. ZONAL ARCHITECTURE
  const isWaveform = !!context.isWaveformMode;
  const roomH = Math.round(h * 0.42);                  // Upper Baroque Chamber & Table (~280px)
  const rollAreaH = h - roomH;                         // Lower Suite (~390px)
  // In Waveform Mode, the piano keyboard is removed so the waveform gets the full stage!
  const keyboardH = isWaveform ? 0 : Math.round(Math.min(105, rollAreaH * 0.32)); 
  const waterfallH = rollAreaH - keyboardH - 8;
  const waterfallY = y + roomH;
  const pianoY = waterfallY + waterfallH;

  // 2. ROOM BACKGROUND: Deep Mahogany Salon with Vignette
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#150905');
  bgGrad.addColorStop(0.38, '#0b0503');
  bgGrad.addColorStop(1, '#050201');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, x, y, w, h, 10, true, false);

  // Gilded Double Antique Outer Frame with Warm Gold Patina
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 10, false, true);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 8, false, true);

  // Gilded Antique Corner Filigrees
  const cornerSize = 14;
  [
    [x + 8, y + 8, 1, 1],
    [x + w - 8, y + 8, -1, 1],
    [x + 8, y + h - 8, 1, -1],
    [x + w - 8, y + h - 8, -1, -1],
  ].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * cornerSize);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * cornerSize, cy);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. UPPER ZONE: REALISTIC TAKE CARE ALBUM PHOTOGRAPH & SCENE
  const roomImgW = w - 16;
  const roomImgH = roomH - 14;
  const roomImgX = x + 8;
  const roomImgY = y + 8;

  if (takeCareImg && takeCareImg.complete && takeCareImg.naturalWidth > 0) {
    ctx.save();
    // Clip to upper room rounded zone
    roundRect(ctx, roomImgX, roomImgY, roomImgW, roomImgH, 8, true, false);
    ctx.clip();

    // Cover-fit the authentic high-res Take Care photograph
    const img = takeCareImg;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = roomImgW / roomImgH;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgAspect > targetAspect) {
      sw = img.naturalHeight * targetAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetAspect;
      sy = (img.naturalHeight - sh) * 0.32; // Centered on Drake and the candelabrum
    }
    ctx.drawImage(img, sx, sy, sw, sh, roomImgX, roomImgY, roomImgW, roomImgH);

    // Warm cinematic oil vignette
    const photoVignette = ctx.createLinearGradient(roomImgX, roomImgY, roomImgX, roomImgY + roomImgH);
    photoVignette.addColorStop(0, 'rgba(0, 0, 0, 0.30)');
    photoVignette.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    photoVignette.addColorStop(0.85, 'rgba(15, 7, 3, 0.45)');
    photoVignette.addColorStop(1, 'rgba(10, 4, 2, 0.90)');
    ctx.fillStyle = photoVignette;
    ctx.fillRect(roomImgX, roomImgY, roomImgW, roomImgH);

    // Edge shadow blending towards the waterfall
    const edgeBlend = ctx.createLinearGradient(roomImgX, roomImgY + roomImgH - 35, roomImgX, roomImgY + roomImgH);
    edgeBlend.addColorStop(0, 'rgba(10, 4, 2, 0)');
    edgeBlend.addColorStop(1, 'rgba(10, 4, 2, 0.95)');
    ctx.fillStyle = edgeBlend;
    ctx.fillRect(roomImgX, roomImgY + roomImgH - 35, roomImgW, 35);

    ctx.restore();

    // Antique Gilded Inner Frame around photo
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.lineWidth = 1.8;
    roundRect(ctx, roomImgX, roomImgY, roomImgW, roomImgH, 8, false, true);

    // Dynamic Flickering Candle Flame Overlay positioned over the candelabrum on table
    const candleFlameX = roomImgX + roomImgW * 0.68;
    const candleFlameY = roomImgY + roomImgH * 0.46;
    const flickerX = Math.sin(currentTime * 17) * 1.5 + Math.cos(currentTime * 29) * 1.0;
    const flickerY = Math.cos(currentTime * 23) * 1.0;

    // Candle Ambient Light Bloom pulsing with bass
    const haloR = 130 + analysis.bass * 45;
    const haloGrad = ctx.createRadialGradient(candleFlameX, candleFlameY, 2, candleFlameX, candleFlameY, haloR);
    haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    haloGrad.addColorStop(0.2, 'rgba(253, 224, 71, 0.32)');
    haloGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.14)');
    haloGrad.addColorStop(1, 'rgba(120, 53, 15, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(candleFlameX, candleFlameY, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Living Candle Flame Teardrop
    const flameGrad = ctx.createLinearGradient(candleFlameX, candleFlameY - 10, candleFlameX, candleFlameY + 10);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.3, '#fef08a');
    flameGrad.addColorStop(0.7, '#f59e0b');
    flameGrad.addColorStop(1, '#dc2626');
    ctx.save();
    ctx.fillStyle = flameGrad;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(candleFlameX, candleFlameY - 9 + flickerY);
    ctx.bezierCurveTo(candleFlameX + 5 + flickerX, candleFlameY + 1, candleFlameX + 3, candleFlameY + 9, candleFlameX, candleFlameY + 10);
    ctx.bezierCurveTo(candleFlameX - 3, candleFlameY + 9, candleFlameX - 5 + flickerX, candleFlameY + 1, candleFlameX, candleFlameY - 9 + flickerY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Floating Candle Embers drifting upwards
    for (let i = 0; i < 18; i++) {
      const seed = i * 47.3;
      const driftTime = (currentTime * 22 + seed) % (roomH + 40);
      const ex = candleFlameX - 35 + Math.sin(currentTime * 1.2 + i * 2.1) * 60 + (i * 11) % 70;
      const ey = (candleFlameY + 30) - driftTime;
      const alpha = Math.max(0, Math.min(0.75, 1 - driftTime / (roomH + 40)));
      if (ey > roomImgY && ey < roomImgY + roomImgH) {
        ctx.fillStyle = hexToRgbaStr('#fde047', alpha);
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Elegant cursive "Take Care" watermark badge
    ctx.save();
    ctx.font = 'italic 700 24px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#d4af37';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.fillText('Take Care', roomImgX + 24, roomImgY + roomImgH - 20);
    ctx.restore();

  } else {
    // Fallback: warm mahogany baroque salon background
    ctx.fillStyle = '#1c0e07';
    ctx.fillRect(roomImgX, roomImgY, roomImgW, roomImgH);
  }

  // 4. KEYBOARD & WATERFALL GEOMETRY MAPPING
  // Establish dynamic pitch range matching MIDI notes with 3.5 octave balanced layout
  const allNotes = midi.notes || [];
  let minPitch = 36;
  let maxPitch = 84;
  if (allNotes.length > 0) {
    minPitch = Math.min(...allNotes.map(n => n.midi));
    maxPitch = Math.max(...allNotes.map(n => n.midi));
  }
  const lowestOctave = Math.max(1, Math.min(3, Math.floor(minPitch / 12)));
  const highestOctave = Math.min(7, Math.max(lowestOctave + 3, Math.ceil(maxPitch / 12)));
  const startKey = lowestOctave * 12; // e.g. 36 (C2)
  const endKey = Math.min(108, highestOctave * 12 + 11); // e.g. 83 (B5)

  const isWhiteKey = (p: number) => [0, 2, 4, 5, 7, 9, 11].includes(((p % 12) + 12) % 12);
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let p = startKey; p <= endKey; p++) {
    if (isWhiteKey(p)) whiteKeys.push(p);
    else blackKeys.push(p);
  }
  const numWhite = Math.max(14, whiteKeys.length);
  const kbdX = x + 18;
  const kbdW = w - 36;
  const whiteW = kbdW / numWhite;

  const getKeyX = (pitch: number) => {
    if (isWhiteKey(pitch)) {
      const idx = whiteKeys.indexOf(pitch);
      return kbdX + idx * whiteW + whiteW / 2;
    } else {
      const prevWIdx = whiteKeys.indexOf(pitch - 1);
      if (prevWIdx !== -1) {
        return kbdX + (prevWIdx + 1) * whiteW;
      }
      return kbdX + whiteW / 2;
    }
  };

  // 5. CENTRAL STAGE: VISUALIZERWAVE LIQUID GOLD WAVEFORM vs PIANO WATERFALL
  if (context.isWaveformMode) {
    // ==============================================================
    // WAVEFORM MODE: VisualizerWave-Inspired Liquid Gold Ribbon
    // ==============================================================
    drawLiquidGoldWaveform(ctx, x + 5, waterfallY, w - 10, waterfallH, currentTime, analysis, settings);

  } else {
    // ==============================================================
    // PIANO / MIDI MODE: Cascading Molten Gold Waterfall
    // ==============================================================
    ctx.save();
    // Waterfall Backing: Dark Smoked Walnut Glass
    const waterGrad = ctx.createLinearGradient(x, waterfallY, x, waterfallY + waterfallH);
    waterGrad.addColorStop(0, '#0a0503');
    waterGrad.addColorStop(0.5, '#120804');
    waterGrad.addColorStop(1, '#080302');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x + 5, waterfallY, w - 10, waterfallH);

    // Subtle Vertical Octave Divider Lines aligned with C keys
    whiteKeys.forEach(pitch => {
      if (pitch % 12 === 0) {
        const cx = getKeyX(pitch);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, waterfallY);
        ctx.lineTo(cx, waterfallY + waterfallH);
        ctx.stroke();

        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(212, 175, 55, 0.45)';
        ctx.textAlign = 'center';
        ctx.fillText(formatNoteName(pitch, settings.accidental, settings.middleC), cx, waterfallY + 14);
      }
    });

    // Waterfall Note Stream Projection Math
    const hasIntro = (introInfo && 'hasIntro' in introInfo) ? !!introInfo.hasIntro : (introInfo?.isIntro ?? false);
    const isIntro = introInfo?.isIntro ?? false;
    const bpm = settings.bpm || midi.bpm || 80;
    const secondsPerBar = (60 / bpm) * 4;
    const introDuration = (introInfo && 'introDuration' in introInfo && typeof introInfo.introDuration === 'number')
      ? introInfo.introDuration
      : (hasIntro ? (introInfo?.totalIntroBars || 1) * secondsPerBar : 0);
    const mainLoopDuration = (introInfo && 'mainLoopDuration' in introInfo && typeof introInfo.mainLoopDuration === 'number')
      ? introInfo.mainLoopDuration
      : (duration || 16);
    const loopDuration = duration || 16;
    const lookaheadSec = 2.6;
    const noteSpeed = waterfallH / lookaheadSec;
    const strikeLineY = waterfallY + waterfallH;

    // Clip waterfall rendering region
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, waterfallY, w - 8, waterfallH);
    ctx.clip();

    const effectiveTime = typeof loopTime === 'number' && !isNaN(loopTime) ? loopTime : (currentTime % loopDuration);

    allNotes.forEach(note => {
      let candidateOffsets: number[] = [0];

      if (hasIntro) {
        if (isIntro) {
          candidateOffsets = [0];
        } else {
          if (note.time < introDuration) {
            candidateOffsets = [0];
          } else {
            const timeInMain = Math.max(0, effectiveTime - introDuration);
            const mainProgress = timeInMain % mainLoopDuration;
            candidateOffsets = [0];
            if (mainProgress > mainLoopDuration - lookaheadSec) {
              candidateOffsets.push(1);
            }
            if (mainProgress < lookaheadSec) {
              candidateOffsets.push(-1);
            }
          }
        }
      } else {
        const currentLoopTime = effectiveTime % loopDuration;
        if (currentLoopTime > loopDuration - lookaheadSec) candidateOffsets.push(1);
        if (currentLoopTime < lookaheadSec) candidateOffsets.push(-1);
      }

      candidateOffsets.forEach(k => {
        let noteStartLoop: number;
        if (hasIntro && !isIntro && note.time >= introDuration) {
          noteStartLoop = note.time + k * mainLoopDuration;
        } else {
          noteStartLoop = note.time + k * loopDuration;
        }

        const relStart = noteStartLoop - effectiveTime;
        const relEnd = relStart + note.duration;

        // Skip notes completely out of waterfall temporal window
        if (relEnd < 0 || relStart > lookaheadSec) return;

        const noteCx = getKeyX(note.midi);
        const isWhite = isWhiteKey(note.midi);
        const noteW = isWhite ? Math.max(14, whiteW * 0.85) : Math.max(10, whiteW * 0.58);
        const noteLeft = noteCx - noteW / 2;
        const noteR = 4;
        const noteName = formatNoteName(note.midi, settings.accidental, settings.middleC);

        const isActive = relStart <= 0 && relEnd >= 0;

        if (isActive) {
          // ACTIVE NOTE: Striking the piano with molten gold illumination!
          const safeRelEnd = Number.isFinite(relEnd) ? relEnd : 0;
          const activeTailH = Math.max(0, Math.min(waterfallH, safeRelEnd * noteSpeed));
          const activeTopY = strikeLineY - activeTailH;

          if (Number.isFinite(noteLeft) && Number.isFinite(activeTopY) && Number.isFinite(strikeLineY)) {
            const goldNoteGrad = ctx.createLinearGradient(noteLeft, activeTopY, noteLeft, strikeLineY);
            goldNoteGrad.addColorStop(0, '#b45309');
            goldNoteGrad.addColorStop(0.4, '#eab308');
            goldNoteGrad.addColorStop(0.85, '#fde047');
            goldNoteGrad.addColorStop(1, '#ffffff');

            ctx.save();
            ctx.fillStyle = goldNoteGrad;
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 16 * (settings.glowIntensity || 1.2);
            roundRect(ctx, noteLeft, activeTopY, noteW, activeTailH, noteR, true, false);

            ctx.strokeStyle = '#fffbeb';
            ctx.lineWidth = 1.4;
            roundRect(ctx, noteLeft, activeTopY, noteW, activeTailH, noteR, false, true);
            ctx.restore();
          }

          // Hammer Impact Starburst Flare at Key Strike Line
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(noteCx, strikeLineY - 1, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Rising spark from strike point
          const sparkY = strikeLineY - 6 - (Math.sin(currentTime * 32 + note.midi) + 1) * 6;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(noteCx + Math.sin(currentTime * 18 + note.midi) * 4, sparkY, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Active Note Head Badge (Clear note identification at strike line)
          if (settings.noteNameTags !== false) {
            ctx.save();
            ctx.font = '800 10.5px "JetBrains Mono", monospace';
            const tm = ctx.measureText(noteName);
            const badgeW = Math.max(26, tm.width + 8);
            const badgeH = 16;
            const badgeX = noteCx - badgeW / 2;
            const badgeY = strikeLineY - 20;

            ctx.fillStyle = '#fde047';
            ctx.shadowColor = '#d4af37';
            ctx.shadowBlur = 8;
            roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3.5, true, false);

            ctx.fillStyle = '#0a0502';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(noteName, noteCx, badgeY + badgeH / 2 + 0.5);
            ctx.restore();
          }

        } else if (relStart > 0 && relStart <= lookaheadSec) {
          // UPCOMING NOTE: Approaching the keyboard from above
          const upBottomY = strikeLineY - relStart * noteSpeed;
          const upTopY = strikeLineY - relEnd * noteSpeed;
          const upH = Math.max(8, upBottomY - upTopY);

          ctx.save();
          ctx.fillStyle = 'rgba(212, 175, 55, 0.08)';
          roundRect(ctx, noteLeft, upTopY, noteW, upH, noteR, true, false);
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
          ctx.lineWidth = 1.2;
          roundRect(ctx, noteLeft, upTopY, noteW, upH, noteR, false, true);
          ctx.restore();
        }
      });
    });

    ctx.restore(); // remove waterfall clip
    ctx.restore(); // remove waterfall state
  }

  // 6. VINTAGE GRAND PIANO KEYBOARD & HARDWARE (Only in Piano / MIDI Mode)
  if (!isWaveform) {
    const fallboardH = 22;
    const keyStartY = pianoY + fallboardH;
    const whiteKeyH = keyboardH - fallboardH - 6;
    const blackKeyH = Math.round(whiteKeyH * 0.65);
    const blackKeyW = Math.round(whiteW * 0.62);

    // Piano Fallboard (Polished Walnut with Gilded Brass Nameplate)
    ctx.save();
    if (vintagePianoImg && vintagePianoImg.complete && vintagePianoImg.naturalWidth > 0) {
      ctx.drawImage(vintagePianoImg, 0, 0, vintagePianoImg.naturalWidth, vintagePianoImg.naturalHeight * 0.25, x + 5, pianoY, w - 10, fallboardH);
      ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
      ctx.fillRect(x + 5, pianoY, w - 10, fallboardH);
    } else {
      const fbGrad = ctx.createLinearGradient(x, pianoY, x, pianoY + fallboardH);
      fbGrad.addColorStop(0, '#1c0f08');
      fbGrad.addColorStop(0.5, '#2e180d');
      fbGrad.addColorStop(1, '#120804');
      ctx.fillStyle = fbGrad;
      ctx.fillRect(x + 5, pianoY, w - 10, fallboardH);
    }

    // Gilded Brushed Brass Nameplate Strip
    const brassGrad = ctx.createLinearGradient(kbdX, pianoY + 2, kbdX + kbdW, pianoY + 2);
    brassGrad.addColorStop(0, '#78350f');
    brassGrad.addColorStop(0.2, '#d4af37');
    brassGrad.addColorStop(0.5, '#fef08a');
    brassGrad.addColorStop(0.8, '#d4af37');
    brassGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = brassGrad;
    ctx.fillRect(kbdX, pianoY + 2, kbdW, 3.5);

    // Vintage Piano Maker Inscription
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.letterSpacing = '1.8px';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('• 40\'S VINTAGE PIANOFORTE • TORONTO 2011 •', kbdX + 12, pianoY + 13);
    ctx.letterSpacing = '0px';

    // Active Chord Voicing Readout in Royal Gold Typography
    const showTopChord = settings.chordDisplayLocation
      ? (settings.chordDisplayLocation === 'top' || settings.chordDisplayLocation === 'both')
      : (settings.showChordBelowPiano === true);

    if (showTopChord) {
      const activeChord = detectChord(activeNotes, settings.accidental, settings.middleC);
      if (activeChord && activeChord.symbol) {
        ctx.font = '900 13px "Inter", serif';
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#d4af37';
        ctx.shadowBlur = 8;
        ctx.textAlign = 'right';
        ctx.fillText(`${activeChord.symbol}  •  ${activeChord.notesFormatted.join(' · ')}`, kbdX + kbdW - 12, pianoY + 13);
        ctx.shadowBlur = 0;
      }
    }

    // Red Velvet Key Felt Strip (Cushioning above keys)
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(kbdX, pianoY + fallboardH - 2.5, kbdW, 2.5);
    ctx.restore();

    // 7. DRAW PHYSICAL PIANO KEYS
    // White keys first
    whiteKeys.forEach((pitch, idx) => {
      const isActive = activeNotes.some(n => n.midi === pitch);
      const wkX = kbdX + idx * whiteW;
      const wkY = isActive ? keyStartY + 3.5 : keyStartY; // Physical key depression!
      const wkH = isActive ? whiteKeyH - 3.5 : whiteKeyH;

      ctx.save();
      if (isActive) {
        // ACTIVE WHITE KEY (Illuminates with warm molten gold candlelight!)
        const goldKeyGrad = ctx.createLinearGradient(wkX, wkY, wkX, wkY + wkH);
        goldKeyGrad.addColorStop(0, '#ffffff');
        goldKeyGrad.addColorStop(0.35, '#fde047');
        goldKeyGrad.addColorStop(0.85, '#eab308');
        goldKeyGrad.addColorStop(1, '#b45309');

        ctx.fillStyle = goldKeyGrad;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 18 * (settings.glowIntensity || 1.2);
        roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, true, false);

        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 1.2;
        roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, false, true);

      } else {
        // IDLE WHITE KEY (Vintage Ivory Texture)
        const ivoryGrad = ctx.createLinearGradient(wkX, wkY, wkX, wkY + wkH);
        ivoryGrad.addColorStop(0, '#fefdfb');
        ivoryGrad.addColorStop(0.85, '#f5efe6');
        ivoryGrad.addColorStop(1, '#dfd5c6');

        ctx.fillStyle = ivoryGrad;
        roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, true, false);

        ctx.strokeStyle = 'rgba(60, 30, 15, 0.35)';
        ctx.lineWidth = 1;
        roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, false, true);

        // Bottom lip shadow
        ctx.fillStyle = 'rgba(120, 53, 15, 0.25)';
        ctx.fillRect(wkX + 1, wkY + wkH - 3.5, whiteW - 2, 3.5);
      }
      ctx.restore();
    });

    // Black keys second (layered in front)
    blackKeys.forEach(pitch => {
      const isActive = activeNotes.some(n => n.midi === pitch);
      const bkX = getKeyX(pitch) - blackKeyW / 2;
      const bkY = isActive ? keyStartY + 2.5 : keyStartY; // Physical key depression!
      const bkH = isActive ? blackKeyH - 2.5 : blackKeyH;

      ctx.save();
      // 3D Drop Shadow onto adjacent white keys
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      roundRect(ctx, bkX - 1.5, bkY + 2, blackKeyW + 3, bkH + 3, 2.5, true, false);

      if (isActive) {
        // ACTIVE BLACK KEY (Incandescent Honey Gold Molten Core!)
        const goldBlackGrad = ctx.createLinearGradient(bkX, bkY, bkX, bkY + bkH);
        goldBlackGrad.addColorStop(0, '#fef08a');
        goldBlackGrad.addColorStop(0.4, '#d97706');
        goldBlackGrad.addColorStop(1, '#78350f');

        ctx.fillStyle = goldBlackGrad;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 14 * (settings.glowIntensity || 1.2);
        roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, true, false);

        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 1;
        roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, false, true);

      } else {
        // IDLE BLACK KEY (Polished Ebony)
        const ebonyGrad = ctx.createLinearGradient(bkX, bkY, bkX + blackKeyW, bkY);
        ebonyGrad.addColorStop(0, '#242426');
        ebonyGrad.addColorStop(0.3, '#141416');
        ebonyGrad.addColorStop(1, '#09090b');

        ctx.fillStyle = ebonyGrad;
        roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, true, false);

        // Top specular highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(bkX + 1.5, bkY + 1, blackKeyW - 3, 2.5);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 0.8;
        roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, false, true);
      }
      ctx.restore();
    });

    // Mahogany Keybed Molding & Brass Base Trim under the keys
    ctx.save();
    const bedY = keyStartY + whiteKeyH;
    ctx.fillStyle = '#1c0e07';
    ctx.fillRect(x + 5, bedY, w - 10, 6);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.fillRect(kbdX, bedY + 4, kbdW, 1.5);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * VisualizerWave-Inspired Liquid Gold Mirrored Waveform
 * Renders an organic, smooth, mirrored audio-reactive golden ribbon with volumetric embers
 */
function drawLiquidGoldWaveform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  currentTime: number,
  analysis: any,
  settings: any
) {
  const centerY = y + h / 2;

  // 1. Dark Smoked Walnut Glass with radial ambient glow
  const bgGrad = ctx.createRadialGradient(x + w / 2, centerY, 30, x + w / 2, centerY, w * 0.6);
  bgGrad.addColorStop(0, '#1c0f08');
  bgGrad.addColorStop(0.5, '#0e0603');
  bgGrad.addColorStop(1, '#050201');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Subtle acoustic string lines behind the waveform
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.06)';
  ctx.lineWidth = 1;
  for (let lx = x + 24; lx < x + w - 24; lx += 32) {
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + h);
    ctx.stroke();
  }

  // Floating golden embers (VisualizerWave style volumetric particles)
  for (let i = 0; i < 35; i++) {
    const seed = i * 61.7;
    const progress = (currentTime * 45 + seed + analysis.bass * 60) % (h + 30);
    const px = x + 30 + (Math.sin(currentTime * 1.5 + i * 2.1) * 45 + (i * 27) % (w - 60));
    const py = (y + h + 15) - progress;
    const alpha = Math.max(0, Math.min(0.85, 1 - progress / (h + 30)));
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 1.2 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Mirrored Liquid Gold Waveform (VisualizerWave style)
  const numPoints = 128;
  const waveW = w - 40;
  const startX = x + 20;
  const step = waveW / numPoints;
  const topPoints: { x: number; y: number }[] = [];
  const botPoints: { x: number; y: number }[] = [];

  const waveData = analysis.waveform;
  const waveLen = waveData ? waveData.length : 0;
  const fftData = analysis.fft;
  const maxAmp = (h / 2) - 18;

  for (let i = 0; i <= numPoints; i++) {
    const px = startX + i * step;
    const norm = i / numPoints;
    // Bell curve envelope so edges cleanly anchor to the frame
    const env = Math.sin(norm * Math.PI);

    let rawVal = 0;
    if (waveLen > 0) {
      const sampleIdx = Math.floor(norm * (waveLen - 1));
      rawVal = Math.abs((waveData[sampleIdx] - 128) / 128);
    }
    const fftIdx = Math.floor(norm * 48);
    const fftVal = (fftData && fftData[fftIdx]) ? (fftData[fftIdx] / 255) : 0;

    // Organic multi-harmonic synthesis combined with real audio time-domain
    const harmonic = Math.sin(norm * 22 + currentTime * 5) * 0.12 * analysis.mid
                   + Math.cos(norm * 45 - currentTime * 3) * 0.08 * analysis.treble;
    const bassBloom = Math.exp(-Math.pow((norm - 0.42) * 5, 2)) * analysis.bass * 0.45;

    const combinedAmp = Math.max(0.04, rawVal * 0.65 + fftVal * 0.35 + harmonic + bassBloom) * env;
    const finalH = combinedAmp * maxAmp + 5;

    topPoints.push({ x: px, y: centerY - finalH });
    botPoints.push({ x: px, y: centerY + finalH });
  }

  // Draw Liquid Gold Metallic Gradient Body
  const safeMaxAmp = Number.isFinite(maxAmp) ? Math.max(1, maxAmp) : 50;
  const safeCenterY = Number.isFinite(centerY) ? centerY : y + h / 2;
  const goldFillGrad = ctx.createLinearGradient(0, safeCenterY - safeMaxAmp, 0, safeCenterY + safeMaxAmp);
  goldFillGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
  goldFillGrad.addColorStop(0.25, 'rgba(245, 158, 11, 0.75)');
  goldFillGrad.addColorStop(0.5, 'rgba(180, 83, 9, 0.3)');
  goldFillGrad.addColorStop(0.75, 'rgba(245, 158, 11, 0.75)');
  goldFillGrad.addColorStop(1, 'rgba(254, 240, 138, 0.95)');

  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 1; i < topPoints.length; i++) ctx.lineTo(topPoints[i].x, topPoints[i].y);
  for (let i = botPoints.length - 1; i >= 0; i--) ctx.lineTo(botPoints[i].x, botPoints[i].y);
  ctx.closePath();
  ctx.fillStyle = goldFillGrad;
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 24 * (settings.glowIntensity || 1.2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Draw Sharp Glowing Crest Lines (VisualizerWave hallmark)
  ctx.strokeStyle = '#fffbeb';
  ctx.lineWidth = 2.4;
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 1; i < topPoints.length; i++) ctx.lineTo(topPoints[i].x, topPoints[i].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(botPoints[0].x, botPoints[0].y);
  for (let i = 1; i < botPoints.length; i++) ctx.lineTo(botPoints[i].x, botPoints[i].y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}
