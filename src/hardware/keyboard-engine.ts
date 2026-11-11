import { MidiNote, VisualizerSettings } from '../types';
import { formatNoteName } from '../engine/chords';

export type KeyboardSkin = 'modern-synth' | 'vintage-upright' | 'magma-trap';

export interface KeyboardRenderOptions {
  skin?: KeyboardSkin;
  activeColor?: string;
  glowColor?: string;
  glowIntensity?: number;
}

export interface KeyGeometry {
  pitch: number;
  x: number;
  width: number;
  height: number;
  isBlack: boolean;
  name: string;
}

/**
 * Standard 3-Octave Professional Keyboard Layout:
 * C2 (MIDI 36) to C5 (MIDI 72)
 * Exactly 22 White Keys and 15 Black Keys (37 Keys Total).
 * Ending on C5 ensures the rightmost key is a white key with NO black key overflow.
 */
const START_MIDI = 36; // C2
const END_MIDI = 72;   // C5
const NUM_WHITE_KEYS = 22;

export const isWhiteKey = (pitch: number): boolean => {
  return [0, 2, 4, 5, 7, 9, 11].includes(((pitch % 12) + 12) % 12);
};

/**
 * Normalizes any MIDI pitch (e.g. C0 or C8) into the visible 3-octave range (C2 to C5).
 */
export function normalizePitchToKeyboard(pitch: number): number {
  if (pitch >= START_MIDI && pitch <= END_MIDI) return pitch;
  let p = pitch;
  while (p < START_MIDI) p += 12;
  while (p > END_MIDI) p -= 12;
  return p;
}

/**
 * Computes exact pixel geometry for all 37 keys based on the keyboard's bounding box.
 */
export function computeKeyboardGeometries(
  x: number,
  y: number,
  w: number,
  h: number,
  accidental: 'sharp' | 'flat' = 'sharp',
  middleC: 3 | 4 | 5 = 3
): { whiteKeys: KeyGeometry[]; blackKeys: KeyGeometry[]; allKeysMap: Map<number, KeyGeometry> } {
  const whiteKeyW = w / NUM_WHITE_KEYS;
  const whiteKeyH = h;
  const blackKeyW = whiteKeyW * 0.62;
  const blackKeyH = whiteKeyH * 0.62;

  const whiteKeys: KeyGeometry[] = [];
  const blackKeys: KeyGeometry[] = [];
  const allKeysMap = new Map<number, KeyGeometry>();

  let curX = x;
  // 1. Generate White Keys from C2 (36) to C5 (72)
  for (let p = START_MIDI; p <= END_MIDI; p++) {
    if (isWhiteKey(p)) {
      const geom: KeyGeometry = {
        pitch: p,
        x: curX,
        width: whiteKeyW,
        height: whiteKeyH,
        isBlack: false,
        name: formatNoteName(p, accidental, middleC),
      };
      whiteKeys.push(geom);
      allKeysMap.set(p, geom);
      curX += whiteKeyW;
    }
  }

  // 2. Generate Black Keys between natural intervals
  whiteKeys.forEach(wk => {
    const nextPitch = wk.pitch + 1;
    // Black keys exist only if next pitch is <= END_MIDI and is not a white key (B-C and E-F have no black key)
    if (nextPitch < END_MIDI && !isWhiteKey(nextPitch)) {
      const bkX = wk.x + whiteKeyW - blackKeyW / 2;
      const geom: KeyGeometry = {
        pitch: nextPitch,
        x: bkX,
        width: blackKeyW,
        height: blackKeyH,
        isBlack: true,
        name: formatNoteName(nextPitch, accidental, middleC),
      };
      blackKeys.push(geom);
      allKeysMap.set(nextPitch, geom);
    }
  });

  return { whiteKeys, blackKeys, allKeysMap };
}

/**
 * Returns the exact horizontal center and width for any MIDI note.
 * Used by waterfall rolls to guarantee 100% mathematical alignment with piano keys.
 */
export function getKeyPosition(
  pitch: number,
  x: number,
  w: number
): { x: number; centerX: number; width: number; isBlack: boolean } {
  const normPitch = normalizePitchToKeyboard(pitch);
  const { allKeysMap, whiteKeys } = computeKeyboardGeometries(x, 0, w, 100);
  const geom = allKeysMap.get(normPitch);

  if (geom) {
    return {
      x: geom.x,
      centerX: geom.x + geom.width / 2,
      width: geom.width,
      isBlack: geom.isBlack,
    };
  }

  // Fallback if somehow not mapped
  const whiteKeyW = w / NUM_WHITE_KEYS;
  return {
    x: x,
    centerX: x + whiteKeyW / 2,
    width: whiteKeyW,
    isBlack: false,
  };
}

/**
 * Single Unified Piano Keyboard Engine for SampleScreen
 * Flawless rendering for both vintage upright pianofortes and modern analog synths.
 */
export function drawPianoKeyboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  activeNotes: MidiNote[],
  settings: VisualizerSettings,
  options: KeyboardRenderOptions = {}
) {
  ctx.save();

  const skin = options.skin || 'modern-synth';
  const activeColor = options.activeColor || settings.notesColor || '#f59e0b';
  const glowColor = options.glowColor || settings.glowColor || activeColor;
  const glowIntensity = options.glowIntensity || settings.glowIntensity || 1.2;

  const { whiteKeys, blackKeys } = computeKeyboardGeometries(
    x,
    y,
    w,
    h,
    settings.accidental,
    settings.middleC
  );

  // Active notes pitch set (normalized to visible range)
  const activePitchSet = new Set<number>();
  activeNotes.forEach(n => {
    activePitchSet.add(normalizePitchToKeyboard(n.midi));
  });

  const activeKeyBadges: { x: number; y: number; name: string; isBlack: boolean }[] = [];

  // ==========================================
  // 1. DRAW WHITE KEYS (C2 to C5)
  // ==========================================
  whiteKeys.forEach(wk => {
    const isActive = activePitchSet.has(wk.pitch);
    const depressionOffset = isActive ? 3 : 0;
    const drawY = y + depressionOffset;
    const drawH = wk.height - depressionOffset;

    ctx.save();
    if (isActive) {
      if (skin === 'vintage-upright') {
        // Antique Ivory with Warm Golden Glow
        const goldKeyGrad = ctx.createLinearGradient(wk.x, drawY, wk.x, drawY + drawH);
        goldKeyGrad.addColorStop(0, '#ffffff');
        goldKeyGrad.addColorStop(0.3, '#fef08a');
        goldKeyGrad.addColorStop(0.7, '#fde047');
        goldKeyGrad.addColorStop(1, '#ca8a04');
        ctx.fillStyle = goldKeyGrad;
      } else if (skin === 'magma-trap') {
        const magmaGrad = ctx.createLinearGradient(wk.x, drawY, wk.x, drawY + drawH);
        magmaGrad.addColorStop(0, '#ffffff');
        magmaGrad.addColorStop(0.35, '#fed7aa');
        magmaGrad.addColorStop(0.75, '#ff4500');
        magmaGrad.addColorStop(1, '#9a3412');
        ctx.fillStyle = magmaGrad;
      } else {
        // Modern Synth
        const synthGrad = ctx.createLinearGradient(wk.x, drawY, wk.x, drawY + drawH);
        synthGrad.addColorStop(0, '#ffffff');
        synthGrad.addColorStop(0.6, '#fef3c7');
        synthGrad.addColorStop(1, activeColor);
        ctx.fillStyle = synthGrad;
      }

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12 * glowIntensity;
      ctx.fillRect(wk.x + 0.5, drawY, wk.width - 1, drawH);
      ctx.restore();

      activeKeyBadges.push({
        x: wk.x + wk.width / 2,
        y: y + wk.height - 18,
        name: wk.name,
        isBlack: false,
      });

    } else {
      // Idle White Key
      if (skin === 'vintage-upright') {
        const ivoryGrad = ctx.createLinearGradient(wk.x, drawY, wk.x, drawY + drawH);
        ivoryGrad.addColorStop(0, '#faf6ec');
        ivoryGrad.addColorStop(0.5, '#f3ece0');
        ivoryGrad.addColorStop(1, '#dfd5c2');
        ctx.fillStyle = ivoryGrad;
      } else {
        const ivoryGrad = ctx.createLinearGradient(wk.x, drawY, wk.x, drawY + drawH);
        ivoryGrad.addColorStop(0, '#f8fafc');
        ivoryGrad.addColorStop(0.7, '#f1f5f9');
        ivoryGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = ivoryGrad;
      }

      ctx.fillRect(wk.x + 0.5, drawY, wk.width - 1, drawH);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(wk.x + 0.5, drawY, wk.width - 1, drawH);
    }
    ctx.restore();
  });

  // ==========================================
  // 2. DRAW BLACK KEYS
  // ==========================================
  blackKeys.forEach(bk => {
    const isActive = activePitchSet.has(bk.pitch);
    const depressionOffset = isActive ? 2 : 0;
    const drawY = y + depressionOffset;
    const drawH = bk.height - depressionOffset;

    ctx.save();
    if (isActive) {
      if (skin === 'vintage-upright') {
        ctx.fillStyle = '#fde047';
      } else if (skin === 'magma-trap') {
        ctx.fillStyle = '#ff4500';
      } else {
        ctx.fillStyle = activeColor;
      }

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14 * glowIntensity;
      ctx.fillRect(bk.x, drawY, bk.width, drawH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bk.x, drawY, bk.width, drawH);

      activeKeyBadges.push({
        x: bk.x + bk.width / 2,
        y: y + bk.height - 16,
        name: bk.name,
        isBlack: true,
      });

    } else {
      // Idle Black Key
      const ebonyGrad = ctx.createLinearGradient(bk.x, drawY, bk.x + bk.width, drawY);
      ebonyGrad.addColorStop(0, '#262628');
      ebonyGrad.addColorStop(0.35, '#151517');
      ebonyGrad.addColorStop(1, '#09090b');
      ctx.fillStyle = ebonyGrad;
      ctx.fillRect(bk.x, drawY, bk.width, drawH);

      // Specular highlight line along top edge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(bk.x + 1, drawY, bk.width - 2, 2.5);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(bk.x, drawY, bk.width, drawH);
    }
    ctx.restore();
  });

  // ==========================================
  // 3. DRAW ACTIVE FLOATING NOTE BADGES
  // ==========================================
  activeKeyBadges.forEach(badge => {
    ctx.save();
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    const tm = ctx.measureText(badge.name);
    const bw = Math.max(26, tm.width + 8);
    const bh = 16;
    const bx = badge.x - bw / 2;
    const by = badge.y - bh / 2;

    ctx.fillStyle = badge.isBlack ? '#000000' : '#1e1b18';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.name, badge.x, badge.y + 0.5);
    ctx.restore();
  });

  ctx.restore();
}
