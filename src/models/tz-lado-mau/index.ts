import { ModelDrawContext } from '../../types';
import { formatNoteName, detectChord } from '../../engine/chords';
import { hexToRgbaStr } from '../../engine/palettes';
import { roundRect } from '../../hardware/st909-synth';

let tzLadoMauImg: HTMLImageElement | null = null;
let isLoaded = false;

function loadAssets() {
  if (isLoaded || typeof window === 'undefined') return;
  isLoaded = true;

  const tz = new Image();
  tz.src = '/assets/tz_lado_mau_album.jpg';
  tz.onload = () => { tzLadoMauImg = tz; };
}

if (typeof window !== 'undefined') {
  loadAssets();
}

/**
 * Mode: Tz da Coronel "Lado Mau" • Inferno Trap Piano Suite
 * - Dark Charcoal & Pitch Black Salon with fiery thermal glow
 * - Authentic high-res album cover of Tz da Coronel with fiery orange-red fur hood
 * - Rising fiery magma embers and bass-reactive heat shimmer
 * - Molten magma waterfall with note strikes bursting in white-hot flame sparks
 * - Ebony & Charcoal pianoforte with glowing flame keys
 */
export function drawTzLadoMauModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  loadAssets();

  const { region, currentTime, loopTime, duration, midi, activeNotes, analysis, settings, introInfo } = context;
  const { x, y, width: w, height: h } = region;

  ctx.save();

  // 1. ZONAL ARCHITECTURE
  const isWaveform = !!context.isWaveformMode;
  const roomH = Math.round(h * 0.42);
  const rollAreaH = h - roomH;
  // In Waveform Mode, the piano keyboard is removed so the seismic waveform gets the full stage!
  const keyboardH = isWaveform ? 0 : Math.round(Math.min(105, rollAreaH * 0.32));
  const waterfallH = rollAreaH - keyboardH - 8;
  const waterfallY = y + roomH;
  const pianoY = waterfallY + waterfallH;

  // 2. ROOM BACKGROUND: Deep Volcanic Charcoal & Pitch Black
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#0c0503');
  bgGrad.addColorStop(0.38, '#080302');
  bgGrad.addColorStop(1, '#040201');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, x, y, w, h, 10, true, false);

  // Fiery Orange & Amber Double Outer Frame
  ctx.strokeStyle = 'rgba(255, 69, 0, 0.55)';
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 10, false, true);
  ctx.strokeStyle = 'rgba(255, 140, 0, 0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 8, false, true);

  // Fiery Corner Filigrees
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
    ctx.strokeStyle = '#ff4500';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. UPPER ZONE: EXACT TZ DA CORONEL "LADO MAU" PHOTOGRAPH
  const roomImgW = w - 16;
  const roomImgH = roomH - 14;
  const roomImgX = x + 8;
  const roomImgY = y + 8;

  const imgToDraw = tzLadoMauImg;
  if (imgToDraw && imgToDraw.complete && imgToDraw.naturalWidth > 0) {
    ctx.save();
    roundRect(ctx, roomImgX, roomImgY, roomImgW, roomImgH, 8, true, false);
    ctx.clip();

    ctx.fillStyle = '#000000';
    ctx.fillRect(roomImgX, roomImgY, roomImgW, roomImgH);

    // Aspect-fill crop centering on Tz's face and blazing fur hood
    const imgAspect = imgToDraw.naturalWidth / imgToDraw.naturalHeight;
    const targetAspect = roomImgW / roomImgH;
    let sx = 0, sy = 0, sw = imgToDraw.naturalWidth, sh = imgToDraw.naturalHeight;
    if (imgAspect > targetAspect) {
      sw = imgToDraw.naturalHeight * targetAspect;
      sx = (imgToDraw.naturalWidth - sw) / 2;
    } else {
      sh = imgToDraw.naturalWidth / targetAspect;
      sy = (imgToDraw.naturalHeight - sh) * 0.44;
    }
    ctx.drawImage(imgToDraw, sx, sy, sw, sh, roomImgX, roomImgY, roomImgW, roomImgH);

    // Dark cinematic charcoal & amber vignette
    const photoVignette = ctx.createLinearGradient(roomImgX, roomImgY, roomImgX, roomImgY + roomImgH);
    photoVignette.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    photoVignette.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    photoVignette.addColorStop(0.85, 'rgba(12, 4, 2, 0.45)');
    photoVignette.addColorStop(1, 'rgba(8, 2, 1, 0.90)');
    ctx.fillStyle = photoVignette;
    ctx.fillRect(roomImgX, roomImgY, roomImgW, roomImgH);

    // Edge shadow blending towards the waterfall
    const edgeBlend = ctx.createLinearGradient(roomImgX, roomImgY + roomImgH - 35, roomImgX, roomImgY + roomImgH);
    edgeBlend.addColorStop(0, 'rgba(8, 2, 1, 0)');
    edgeBlend.addColorStop(1, 'rgba(8, 2, 1, 0.95)');
    ctx.fillStyle = edgeBlend;
    ctx.fillRect(roomImgX, roomImgY + roomImgH - 35, roomImgW, 35);

    ctx.restore();

    // Glowing Fiery Orange Inner Frame
    ctx.strokeStyle = 'rgba(255, 69, 0, 0.75)';
    ctx.lineWidth = 1.8;
    roundRect(ctx, roomImgX, roomImgY, roomImgW, roomImgH, 8, false, true);

    // Bass-reactive Thermal Halo Bloom around the hood
    const hoodCenterX = roomImgX + roomImgW * 0.52;
    const hoodCenterY = roomImgY + roomImgH * 0.45;
    const thermalR = 140 + analysis.bass * 50;
    const thermalGrad = ctx.createRadialGradient(hoodCenterX, hoodCenterY, 5, hoodCenterX, hoodCenterY, thermalR);
    thermalGrad.addColorStop(0, 'rgba(255, 85, 0, 0.28)');
    thermalGrad.addColorStop(0.35, 'rgba(224, 59, 0, 0.16)');
    thermalGrad.addColorStop(0.7, 'rgba(140, 20, 0, 0.06)');
    thermalGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = thermalGrad;
    ctx.beginPath();
    ctx.arc(hoodCenterX, hoodCenterY, thermalR, 0, Math.PI * 2);
    ctx.fill();

    // Floating Fiery Embers drifting upwards
    for (let i = 0; i < 22; i++) {
      const seed = i * 43.7;
      const driftTime = (currentTime * 26 + seed) % (roomH + 40);
      const ex = roomImgX + 40 + Math.sin(currentTime * 1.5 + i * 2.3) * 65 + (i * 29) % (roomImgW - 80);
      const ey = (roomImgY + roomImgH + 10) - driftTime;
      const alpha = Math.max(0, Math.min(0.85, 1 - driftTime / (roomH + 40)));
      if (ey > roomImgY && ey < roomImgY + roomImgH) {
        ctx.fillStyle = hexToRgbaStr(i % 2 === 0 ? '#ff5500' : '#ffaa00', alpha);
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2 + (i % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Elegant italic "Lado Mau" badge in lower-left
    ctx.save();
    ctx.font = 'italic 700 24px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#ffaa33';
    ctx.shadowColor = '#ff4500';
    ctx.shadowBlur = 12;
    ctx.textAlign = 'left';
    ctx.fillText('Lado Mau', roomImgX + 24, roomImgY + roomImgH - 20);
    ctx.restore();

  } else {
    ctx.fillStyle = '#100502';
    ctx.fillRect(roomImgX, roomImgY, roomImgW, roomImgH);
  }

  // 4. KEYBOARD & WATERFALL GEOMETRY
  const allNotes = midi.notes || [];
  let minPitch = 36;
  let maxPitch = 84;
  if (allNotes.length > 0) {
    minPitch = Math.min(...allNotes.map(n => n.midi));
    maxPitch = Math.max(...allNotes.map(n => n.midi));
  }
  const lowestOctave = Math.max(1, Math.min(3, Math.floor(minPitch / 12)));
  const highestOctave = Math.min(7, Math.max(lowestOctave + 3, Math.ceil(maxPitch / 12)));
  const startKey = lowestOctave * 12;
  const endKey = Math.min(108, highestOctave * 12 + 11);

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

  // 5. CENTRAL STAGE: VISUALIZERWAVE SEISMIC MAGMA PLASMA vs INFERNO WATERFALL
  if (context.isWaveformMode) {
    drawSeismicMagmaWaveform(ctx, x + 5, waterfallY, w - 10, waterfallH, currentTime, analysis, settings);
  } else {
    ctx.save();
    const waterGrad = ctx.createLinearGradient(x, waterfallY, x, waterfallY + waterfallH);
    waterGrad.addColorStop(0, '#0a0302');
    waterGrad.addColorStop(0.5, '#120503');
    waterGrad.addColorStop(1, '#080201');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x + 5, waterfallY, w - 10, waterfallH);

  // Octave dividers
  whiteKeys.forEach(pitch => {
    if (pitch % 12 === 0) {
      const cx = getKeyX(pitch);
      ctx.strokeStyle = 'rgba(255, 69, 0, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, waterfallY);
      ctx.lineTo(cx, waterfallY + waterfallH);
      ctx.stroke();

      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 140, 0, 0.45)';
      ctx.textAlign = 'center';
      ctx.fillText(formatNoteName(pitch, settings.accidental, settings.middleC), cx, waterfallY + 14);
    }
  });

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

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, waterfallY, w - 8, waterfallH);
  ctx.clip();

  const effectiveTime = typeof loopTime === 'number' && !isNaN(loopTime) ? loopTime : (currentTime % loopDuration);

  allNotes.forEach(note => {
    let candidateOffsets: number[] = [0];
    if (hasIntro) {
      if (!isIntro && note.time >= introDuration) {
        const timeInMain = Math.max(0, effectiveTime - introDuration);
        const mainProgress = timeInMain % mainLoopDuration;
        if (mainProgress > mainLoopDuration - lookaheadSec) candidateOffsets.push(1);
        if (mainProgress < lookaheadSec) candidateOffsets.push(-1);
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
      if (relEnd < 0 || relStart > lookaheadSec) return;

      const noteCx = getKeyX(note.midi);
      const isWhite = isWhiteKey(note.midi);
      const noteW = isWhite ? Math.max(14, whiteW * 0.85) : Math.max(10, whiteW * 0.58);
      const noteLeft = noteCx - noteW / 2;
      const noteR = 4;
      const noteName = formatNoteName(note.midi, settings.accidental, settings.middleC);

      const isActive = relStart <= 0 && relEnd >= 0;

      if (isActive) {
        const activeTailH = Math.min(waterfallH, relEnd * noteSpeed);
        const activeTopY = strikeLineY - activeTailH;

        // Molten Magma / Fiery Orange Gradient Body
        const magmaGrad = ctx.createLinearGradient(noteLeft, activeTopY, noteLeft, strikeLineY);
        magmaGrad.addColorStop(0, '#881200');
        magmaGrad.addColorStop(0.4, '#e03b00');
        magmaGrad.addColorStop(0.85, '#ff6600');
        magmaGrad.addColorStop(1, '#ffffff');

        ctx.save();
        ctx.fillStyle = magmaGrad;
        ctx.shadowColor = '#ff4500';
        ctx.shadowBlur = 18 * (settings.glowIntensity || 1.2);
        roundRect(ctx, noteLeft, activeTopY, noteW, activeTailH, noteR, true, false);

        ctx.strokeStyle = '#ffe4cc';
        ctx.lineWidth = 1.4;
        roundRect(ctx, noteLeft, activeTopY, noteW, activeTailH, noteR, false, true);
        ctx.restore();

        // Hammer Impact Fiery Flare
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(noteCx, strikeLineY - 1, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Rising sparks
        const sparkY = strikeLineY - 6 - (Math.sin(currentTime * 32 + note.midi) + 1) * 6;
        ctx.fillStyle = '#ffcc66';
        ctx.beginPath();
        ctx.arc(noteCx + Math.sin(currentTime * 18 + note.midi) * 4, sparkY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Note Name Badge
        if (settings.noteNameTags !== false) {
          ctx.save();
          ctx.font = '800 10.5px "JetBrains Mono", monospace';
          const tm = ctx.measureText(noteName);
          const badgeW = Math.max(26, tm.width + 8);
          const badgeH = 16;
          const badgeX = noteCx - badgeW / 2;
          const badgeY = strikeLineY - 20;

          ctx.fillStyle = '#ff6600';
          ctx.shadowColor = '#cc2b00';
          ctx.shadowBlur = 8;
          roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3.5, true, false);

          ctx.fillStyle = '#080201';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(noteName, noteCx, badgeY + badgeH / 2 + 0.5);
          ctx.restore();
        }

      } else if (relStart > 0 && relStart <= lookaheadSec) {
        const upBottomY = strikeLineY - relStart * noteSpeed;
        const upTopY = strikeLineY - relEnd * noteSpeed;
        const upH = Math.max(8, upBottomY - upTopY);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 69, 0, 0.09)';
        roundRect(ctx, noteLeft, upTopY, noteW, upH, noteR, true, false);
        ctx.strokeStyle = 'rgba(255, 69, 0, 0.38)';
        ctx.lineWidth = 1.2;
        roundRect(ctx, noteLeft, upTopY, noteW, upH, noteR, false, true);
        ctx.restore();
      }
    });
  });

    ctx.restore();
    ctx.restore();
  }

  // 6. INFERNO PIANOFORTE KEYBOARD (Only in Piano / MIDI Mode)
  if (!isWaveform) {
    const fallboardH = 22;
  const keyStartY = pianoY + fallboardH;
  const whiteKeyH = keyboardH - fallboardH - 6;
  const blackKeyH = Math.round(whiteKeyH * 0.65);
  const blackKeyW = Math.round(whiteW * 0.62);

  ctx.save();
  // Burnt Charcoal Fallboard
  const fbGrad = ctx.createLinearGradient(x, pianoY, x, pianoY + fallboardH);
  fbGrad.addColorStop(0, '#100503');
  fbGrad.addColorStop(0.5, '#1e0c06');
  fbGrad.addColorStop(1, '#0e0402');
  ctx.fillStyle = fbGrad;
  ctx.fillRect(x + 5, pianoY, w - 10, fallboardH);

  // Copper / Fiery Brass Nameplate Strip
  const copperGrad = ctx.createLinearGradient(kbdX, pianoY + 2, kbdX + kbdW, pianoY + 2);
  copperGrad.addColorStop(0, '#7a1c00');
  copperGrad.addColorStop(0.2, '#e04400');
  copperGrad.addColorStop(0.5, '#ffaa33');
  copperGrad.addColorStop(0.8, '#e04400');
  copperGrad.addColorStop(1, '#7a1c00');
  ctx.fillStyle = copperGrad;
  ctx.fillRect(kbdX, pianoY + 2, kbdW, 3.5);

  // Inscription
  ctx.font = '800 10px "JetBrains Mono", monospace';
  ctx.letterSpacing = '1.8px';
  ctx.fillStyle = '#ff8833';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('• TZ DA CORONEL • LADO MAU • INFERNO PIANOFORTE •', kbdX + 12, pianoY + 13);
  ctx.letterSpacing = '0px';

  // Active Chord Voicing
  const showTopChord = settings.chordDisplayLocation
    ? (settings.chordDisplayLocation === 'top' || settings.chordDisplayLocation === 'both')
    : (settings.showChordBelowPiano === true);

  if (showTopChord) {
    const activeChord = detectChord(activeNotes, settings.accidental, settings.middleC);
    if (activeChord && activeChord.symbol) {
      ctx.font = '900 13px "Inter", serif';
      ctx.fillStyle = '#ffaa33';
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'right';
      ctx.fillText(`${activeChord.symbol}  •  ${activeChord.notesFormatted.join(' · ')}`, kbdX + kbdW - 12, pianoY + 13);
      ctx.shadowBlur = 0;
    }
  }

  // Fiery Orange/Crimson Key Cushioning Felt
  ctx.fillStyle = '#aa1c00';
  ctx.fillRect(kbdX, pianoY + fallboardH - 2.5, kbdW, 2.5);
  ctx.restore();

  // White Keys
  whiteKeys.forEach((pitch, idx) => {
    const isActive = activeNotes.some(n => n.midi === pitch);
    const wkX = kbdX + idx * whiteW;
    const wkY = isActive ? keyStartY + 3.5 : keyStartY;
    const wkH = isActive ? whiteKeyH - 3.5 : whiteKeyH;

    ctx.save();
    if (isActive) {
      const fireKeyGrad = ctx.createLinearGradient(wkX, wkY, wkX, wkY + wkH);
      fireKeyGrad.addColorStop(0, '#ffffff');
      fireKeyGrad.addColorStop(0.35, '#ffaa33');
      fireKeyGrad.addColorStop(0.85, '#ff5500');
      fireKeyGrad.addColorStop(1, '#881200');

      ctx.fillStyle = fireKeyGrad;
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 18 * (settings.glowIntensity || 1.2);
      roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, true, false);

      ctx.strokeStyle = '#ffe4cc';
      ctx.lineWidth = 1.2;
      roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, false, true);

    } else {
      const ivoryGrad = ctx.createLinearGradient(wkX, wkY, wkX, wkY + wkH);
      ivoryGrad.addColorStop(0, '#fdfbf7');
      ivoryGrad.addColorStop(0.85, '#eee5d8');
      ivoryGrad.addColorStop(1, '#d5c4af');

      ctx.fillStyle = ivoryGrad;
      roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, true, false);

      ctx.strokeStyle = 'rgba(60, 20, 10, 0.35)';
      ctx.lineWidth = 1;
      roundRect(ctx, wkX + 1, wkY, whiteW - 2, wkH, 3, false, true);

      ctx.fillStyle = 'rgba(140, 40, 10, 0.25)';
      ctx.fillRect(wkX + 1, wkY + wkH - 3.5, whiteW - 2, 3.5);
    }
    ctx.restore();
  });

  // Black Keys
  blackKeys.forEach(pitch => {
    const isActive = activeNotes.some(n => n.midi === pitch);
    const bkX = getKeyX(pitch) - blackKeyW / 2;
    const bkY = isActive ? keyStartY + 2.5 : keyStartY;
    const bkH = isActive ? blackKeyH - 2.5 : blackKeyH;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    roundRect(ctx, bkX - 1.5, bkY + 2, blackKeyW + 3, bkH + 3, 2.5, true, false);

    if (isActive) {
      const fireBlackGrad = ctx.createLinearGradient(bkX, bkY, bkX, bkY + bkH);
      fireBlackGrad.addColorStop(0, '#ffeeaa');
      fireBlackGrad.addColorStop(0.4, '#e03b00');
      fireBlackGrad.addColorStop(1, '#660b00');

      ctx.fillStyle = fireBlackGrad;
      ctx.shadowColor = '#ff4500';
      ctx.shadowBlur = 14 * (settings.glowIntensity || 1.2);
      roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, true, false);

      ctx.strokeStyle = '#ffe4cc';
      ctx.lineWidth = 1;
      roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, false, true);

    } else {
      const ebonyGrad = ctx.createLinearGradient(bkX, bkY, bkX + blackKeyW, bkY);
      ebonyGrad.addColorStop(0, '#221e1c');
      ebonyGrad.addColorStop(0.3, '#14100e');
      ebonyGrad.addColorStop(1, '#090605');

      ctx.fillStyle = ebonyGrad;
      roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, true, false);

      ctx.fillStyle = 'rgba(255, 120, 40, 0.16)';
      ctx.fillRect(bkX + 1.5, bkY + 1, blackKeyW - 3, 2.5);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = 0.8;
      roundRect(ctx, bkX, bkY, blackKeyW, bkH, 2.5, false, true);
    }
    ctx.restore();
  });

  // Charcoal Keybed Molding
  ctx.save();
  const bedY = keyStartY + whiteKeyH;
  ctx.fillStyle = '#100503';
  ctx.fillRect(x + 5, bedY, w - 10, 6);
  ctx.fillStyle = 'rgba(255, 85, 0, 0.40)';
  ctx.fillRect(kbdX, bedY + 4, kbdW, 1.5);
  ctx.restore();

  ctx.restore();
  }
}

/**
 * VisualizerWave-Inspired Seismic Magma Plasma Waveform
 * Renders an intense, high-voltage jagged magma plasma ribbon with exploding volcanic embers
 */
function drawSeismicMagmaWaveform(
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

  // Volcanic crevasse backdrop
  const bgGrad = ctx.createRadialGradient(x + w / 2, centerY, 30, x + w / 2, centerY, w * 0.6);
  bgGrad.addColorStop(0, '#1c0502');
  bgGrad.addColorStop(0.5, '#0b0201');
  bgGrad.addColorStop(1, '#040101');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Volcanic ember sparks bursting
  for (let i = 0; i < 40; i++) {
    const seed = i * 53.3;
    const progress = (currentTime * 55 + seed + analysis.bass * 80) % (h + 30);
    const px = x + 30 + (Math.sin(currentTime * 2 + i * 2.7) * 55 + (i * 31) % (w - 60));
    const py = (y + h + 15) - progress;
    const alpha = Math.max(0, Math.min(0.9, 1 - progress / (h + 30)));
    ctx.fillStyle = i % 2 === 0 ? `rgba(255, 69, 0, ${alpha})` : `rgba(255, 170, 0, ${alpha})`;
    ctx.shadowColor = '#ff3b00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px, py, 1.2 + (i % 3) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Seismic Magma Plasma Waveform with High-Voltage Electric Spikes
  const numPoints = 140;
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
    const env = Math.sin(norm * Math.PI);

    let rawVal = 0;
    if (waveLen > 0) {
      const sampleIdx = Math.floor(norm * (waveLen - 1));
      rawVal = Math.abs((waveData[sampleIdx] - 128) / 128);
    }
    const fftIdx = Math.floor(norm * 48);
    const fftVal = (fftData && fftData[fftIdx]) ? (fftData[fftIdx] / 255) : 0;

    // High-frequency seismic jitter for trap 808 distortion
    const jitter = (Math.sin(norm * 65 + currentTime * 12) * Math.cos(norm * 120)) * 0.15 * analysis.treble;
    const kickDisplacement = Math.exp(-Math.pow((norm - 0.45) * 6, 2)) * analysis.bass * 0.55;

    const combined = Math.max(0.05, rawVal * 0.6 + fftVal * 0.4 + jitter + kickDisplacement) * env;
    const finalH = combined * maxAmp + 6;

    topPoints.push({ x: px, y: centerY - finalH });
    botPoints.push({ x: px, y: centerY + finalH });
  }

  // Magma Plasma Gradient Fill
  const magmaFillGrad = ctx.createLinearGradient(0, centerY - maxAmp, 0, centerY + maxAmp);
  magmaFillGrad.addColorStop(0, 'rgba(254, 215, 170, 0.95)');
  magmaFillGrad.addColorStop(0.2, 'rgba(249, 115, 22, 0.75)');
  magmaFillGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.35)');
  magmaFillGrad.addColorStop(0.8, 'rgba(249, 115, 22, 0.75)');
  magmaFillGrad.addColorStop(1, 'rgba(254, 215, 170, 0.95)');

  ctx.beginPath();
  ctx.moveTo(topPoints[0].x, topPoints[0].y);
  for (let i = 1; i < topPoints.length; i++) ctx.lineTo(topPoints[i].x, topPoints[i].y);
  for (let i = botPoints.length - 1; i >= 0; i--) ctx.lineTo(botPoints[i].x, botPoints[i].y);
  ctx.closePath();
  ctx.fillStyle = magmaFillGrad;
  ctx.shadowColor = '#ff2200';
  ctx.shadowBlur = 28 * (settings.glowIntensity || 1.2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // White-hot Lightning Core line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.shadowColor = '#ffedd5';
  ctx.shadowBlur = 12;

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
