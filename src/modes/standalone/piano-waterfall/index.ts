import { ModelDrawContext, ModeModule, ParsedMidi } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { DEFAULT_INK, darken, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { roundRect } from '../../../shared/canvas-utils';
import { visibleNotes } from '../../albums/_shell/waterfall';

/**
 * Wax Keys: a full-width upright piano at the bottom, MIDI notes falling onto it.
 * A key goes down and lights up the instant its note lands, with a short attack flash and a
 * warm reflection on the felt strip. No shadowBlur anywhere (halo shapes instead), so it stays
 * cheap at 60 FPS and follows the light-palette rules for free.
 */

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const isBlack = (p: number) => !WHITE_PCS.includes(((p % 12) + 12) % 12);
// Black keys sit slightly off the white-key seam, like a real keyboard
const BLACK_SHIFT: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.14, 8: 0, 10: 0.14 };

interface Keyboard {
  lo: number;
  hi: number;
  whiteW: number;
  blackW: number;
  /** Left edge of the key in px relative to the keyboard's x. */
  left: (p: number) => number;
  width: (p: number) => number;
}

/** Whole octaves around the notes, at least two, clamped to the 88 keys. */
const rangeCache = new WeakMap<ParsedMidi, { lo: number; hi: number }>();
function keyRange(midi: ParsedMidi) {
  let r = rangeCache.get(midi);
  if (!r) {
    const notes = midi.notes || [];
    const min = notes.length ? Math.min(...notes.map(n => n.midi)) : 48;
    const max = notes.length ? Math.max(...notes.map(n => n.midi)) : 71;
    let lo = min - (min % 12);
    let hi = max + (11 - (max % 12));
    while (hi - lo + 1 < 24) hi += 12;
    lo = Math.max(21, lo);
    hi = Math.min(108, hi);
    r = { lo, hi };
    rangeCache.set(midi, r);
  }
  return r;
}

function buildKeyboard(midi: ParsedMidi, width: number): Keyboard {
  const { lo, hi } = keyRange(midi);
  const whiteIndex = new Map<number, number>();
  let n = 0;
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whiteIndex.set(p, n++);
  const whiteW = width / n;
  const blackW = whiteW * 0.6;
  return {
    lo,
    hi,
    whiteW,
    blackW,
    left: (p) => {
      if (!isBlack(p)) return (whiteIndex.get(p) ?? 0) * whiteW;
      const seam = ((whiteIndex.get(p - 1) ?? 0) + 1) * whiteW;
      return seam - blackW / 2 + (BLACK_SHIFT[p % 12] ?? 0) * blackW;
    },
    width: (p) => (isBlack(p) ? blackW : whiteW),
  };
}

interface Press { age: number; velocity: number }

export function drawPianoWaterfall(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, midi, settings } = context;
  const { x, y, width: w, height: h } = region;
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  const notesColor = settings.notesColor || '#e69d45';
  const accent = settings.accentColor || '#ecdcb9';
  const glow = settings.glowColor || notesColor;

  const kb = buildKeyboard(midi, w);
  const kbH = Math.min(240, Math.max(110, h * 0.2), kb.whiteW * 6.5);
  const railH = 18;                         // wooden key slip above the keys
  const feltH = 5;
  const kbY = y + h - kbH;
  const strikeY = kbY - railH - feltH;      // where notes land
  const fallTop = y;
  const fallH = strikeY - fallTop;
  const bpm = settings.bpm || midi.bpm || 90;
  const lookahead = Math.max(1.6, Math.min(4, (60 / bpm) * 6));   // ~1.5 bars on screen
  const pxPerSec = fallH / lookahead;

  const falling = visibleNotes(context, lookahead);
  const pressed = new Map<number, Press>();
  for (const f of falling) {
    if (!f.isActive) continue;
    const prev = pressed.get(f.note.midi);
    const age = -f.relStart;
    if (!prev || age < prev.age) pressed.set(f.note.midi, { age, velocity: f.note.velocity });
  }

  ctx.save();

  // ---------- Lanes ----------
  ctx.fillStyle = hexToRgbaStr(ink, light ? 0.05 : 0.025);
  for (let p = kb.lo; p <= kb.hi; p++) {
    if (isBlack(p)) ctx.fillRect(x + kb.left(p), fallTop, kb.blackW, fallH);
  }
  ctx.fillStyle = hexToRgbaStr(ink, light ? 0.22 : 0.09);
  for (let p = kb.lo; p <= kb.hi; p++) {
    if (p % 12 === 0) ctx.fillRect(Math.round(x + kb.left(p)), fallTop, 1, fallH);
  }

  // ---------- Light shafts above pressed keys (dark palettes only) ----------
  if (!light) {
    for (const [p, press] of pressed) {
      const kx = x + kb.left(p);
      const kw = kb.width(p);
      const shaftH = fallH * (0.35 + press.velocity * 0.3);
      const g = ctx.createLinearGradient(0, strikeY, 0, strikeY - shaftH);
      g.addColorStop(0, hexToRgbaStr(glow, 0.22));
      g.addColorStop(1, hexToRgbaStr(glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(kx - kw * 0.2, strikeY - shaftH, kw * 1.4, shaftH);
    }
  }

  // ---------- Falling notes ----------
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, fallTop, w, fallH);
  ctx.clip();
  const blackNoteColor = light ? darken(notesColor, 0.7) : darken(notesColor, 0.72);
  for (const f of falling) {
    const p = f.note.midi;
    if (p < kb.lo || p > kb.hi) continue;
    const top = Math.max(fallTop - 4, strikeY - f.relEnd * pxPerSec);
    const bottom = Math.min(strikeY, strikeY - f.relStart * pxPerSec);
    const nh = Math.max(3, bottom - top);
    const inset = isBlack(p) ? 1 : Math.max(1.5, kb.whiteW * 0.1);
    const nx = x + kb.left(p) + inset;
    const nw = kb.width(p) - inset * 2;
    const radius = Math.min(5, nw / 3, nh / 2);
    const base = isBlack(p) ? blackNoteColor : notesColor;

    if (f.isActive) {
      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, hexToRgbaStr(base, 0.95));
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = hexToRgbaStr(base, light ? 0.92 : 0.6 + f.note.velocity * 0.35);
    }
    roundRect(ctx, nx, top, nw, nh, radius, true, false);
    // Glossy edge: thin highlight on the left, darker edge on the right
    ctx.fillStyle = light ? hexToRgbaStr(ink, 0.18) : 'rgba(255,255,255,0.18)';
    ctx.fillRect(nx + 1, top + radius, 1.2, Math.max(0, nh - radius * 2));

    if (f.isActive && settings.noteNameTags !== false && nh > 18 && nw > 12) {
      ctx.font = `800 ${Math.min(11, Math.max(8, nw * 0.42))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = settings.bgColor || '#141113';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatNoteName(p, settings.accidental, settings.middleC), nx + nw / 2, strikeY - 4, nw - 2);
    }
  }
  ctx.restore();

  // ---------- Attack flashes at the strike line ----------
  for (const [p, press] of pressed) {
    const flash = Math.max(0, 1 - press.age / 0.2);
    if (flash <= 0) continue;
    const cx = x + kb.left(p) + kb.width(p) / 2;
    const spread = kb.width(p) * (0.8 + (1 - flash) * 1.4);
    if (light) {
      ctx.strokeStyle = hexToRgbaStr(ink, 0.6 * flash);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, strikeY, spread, 6 + (1 - flash) * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = hexToRgbaStr(glow, 0.35 * flash);
      ctx.beginPath();
      ctx.ellipse(cx, strikeY, spread, 10 + (1 - flash) * 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.7 * flash})`;
      ctx.fillRect(cx - spread * 0.5, strikeY - 1.5, spread, 3);
    }
  }

  drawPiano(ctx, context, kb, pressed, { x, kbY, kbH, railH, feltH, strikeY, w, light, ink, notesColor, accent, glow });
  ctx.restore();
}

interface PianoStyle {
  x: number; kbY: number; kbH: number; railH: number; feltH: number; strikeY: number; w: number;
  light: boolean; ink: string; notesColor: string; accent: string; glow: string;
}

/** Felt strip, wooden key slip, ivory and ebony keys, front lips. Pressed keys sink and light up. */
function drawPiano(ctx: CanvasRenderingContext2D, context: ModelDrawContext, kb: Keyboard, pressed: Map<number, Press>, s: PianoStyle) {
  const { x, kbY, kbH, railH, feltH, strikeY, w, light, ink, notesColor, accent, glow } = s;
  const settings = context.settings;

  // Felt: burgundy on dark palettes, the palette accent on light (printed look)
  const felt = light ? accent : '#6e1f2b';
  ctx.fillStyle = felt;
  ctx.fillRect(x, strikeY, w, feltH);
  // Reflection of each pressed key on the felt
  for (const [p, press] of pressed) {
    const cx = x + kb.left(p) + kb.width(p) / 2;
    const rw = kb.width(p) * 2.2;
    const g = ctx.createRadialGradient(cx, strikeY + feltH / 2, 0, cx, strikeY + feltH / 2, rw);
    g.addColorStop(0, light ? hexToRgbaStr(ink, 0.35) : hexToRgbaStr(glow, 0.45 + press.velocity * 0.3));
    g.addColorStop(1, light ? hexToRgbaStr(ink, 0) : hexToRgbaStr(glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rw, strikeY, rw * 2, feltH);
  }

  // Key slip: polished wood (dark) or a flat ink rail (light)
  const railY = strikeY + feltH;
  if (light) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, railY, w, railH);
  } else {
    const wood = ctx.createLinearGradient(0, railY, 0, railY + railH);
    wood.addColorStop(0, '#3a2418');
    wood.addColorStop(0.45, '#24150d');
    wood.addColorStop(1, '#110904');
    ctx.fillStyle = wood;
    ctx.fillRect(x, railY, w, railH);
    ctx.fillStyle = 'rgba(255,225,190,0.18)';
    ctx.fillRect(x, railY + 1, w, 1);
  }
  ctx.font = '600 8px "JetBrains Mono", monospace';
  ctx.letterSpacing = '4px';
  ctx.fillStyle = light ? hexToRgbaStr(settings.bgColor || '#f4f2ec', 0.8) : 'rgba(230,200,150,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WAX KEYS', x + w / 2, railY + railH / 2 + 0.5);
  ctx.letterSpacing = '0px';

  const lip = Math.max(5, kbH * 0.05);
  const dip = 3;

  // White keys
  for (let p = kb.lo; p <= kb.hi; p++) {
    if (isBlack(p)) continue;
    const kx = x + kb.left(p);
    const kw = kb.whiteW;
    const down = pressed.get(p);
    const bodyH = kbH - lip + (down ? dip : 0);
    const g = ctx.createLinearGradient(0, kbY, 0, kbY + bodyH);
    if (down) {
      const flash = Math.max(0, 1 - down.age / 0.25);
      g.addColorStop(0, light ? hexToRgbaStr(notesColor, 0.75) : hexToRgbaStr(accent, 0.95));
      g.addColorStop(0.55, hexToRgbaStr(notesColor, 0.85 + flash * 0.15));
      g.addColorStop(1, hexToRgbaStr(notesColor, 1));
    } else if (light) {
      g.addColorStop(0, '#fbfaf6');
      g.addColorStop(1, '#ecebe4');
    } else {
      g.addColorStop(0, '#d9d2c3');
      g.addColorStop(0.08, '#f4efe2');
      g.addColorStop(1, '#e6dfcf');
    }
    ctx.fillStyle = g;
    ctx.fillRect(kx, kbY, kw, bodyH);
    // Front lip (shorter when pressed: the key tilts down)
    ctx.fillStyle = down ? darken(notesColor, 0.7) : light ? '#d8d6cd' : '#bfb6a3';
    ctx.fillRect(kx, kbY + bodyH, kw, kbH - bodyH);
    // Seam
    ctx.fillStyle = light ? hexToRgbaStr(ink, 0.55) : 'rgba(30,20,12,0.55)';
    ctx.fillRect(kx, kbY, 1, kbH);
  }
  ctx.fillStyle = light ? hexToRgbaStr(ink, 0.55) : 'rgba(30,20,12,0.55)';
  ctx.fillRect(x + w - 1, kbY, 1, kbH);

  // Shadow of the key slip on the keys
  const shade = ctx.createLinearGradient(0, kbY, 0, kbY + 10);
  shade.addColorStop(0, light ? hexToRgbaStr(ink, 0.18) : 'rgba(0,0,0,0.45)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, kbY, w, 10);

  // Black keys
  const blackH = kbH * 0.62;
  for (let p = kb.lo; p <= kb.hi; p++) {
    if (!isBlack(p)) continue;
    const kx = x + kb.left(p);
    const kw = kb.blackW;
    const down = pressed.get(p);
    // Contact shadow on the white keys (offset rect, no blur)
    ctx.fillStyle = light ? hexToRgbaStr(ink, 0.12) : 'rgba(0,0,0,0.35)';
    ctx.fillRect(kx + 2, kbY, kw, blackH + (down ? 1 : 4));

    if (down) {
      const g = ctx.createLinearGradient(0, kbY, 0, kbY + blackH);
      g.addColorStop(0, darken(notesColor, 0.55));
      g.addColorStop(0.7, notesColor);
      g.addColorStop(1, light ? notesColor : accent);
      ctx.fillStyle = g;
      roundRect(ctx, kx, kbY - 1, kw, blackH + 1, 2, true, false);
    } else {
      ctx.fillStyle = light ? ink : '#0d0b0a';
      roundRect(ctx, kx, kbY - 1, kw, blackH + 1, 2, true, false);
      // Top face (the lacquered surface) with a highlight; the front bevel is lower down
      const top = ctx.createLinearGradient(0, kbY, 0, kbY + blackH - 9);
      top.addColorStop(0, light ? ink : '#1d1a18');
      top.addColorStop(1, light ? darken(ink, 0.85) : '#2c2724');
      ctx.fillStyle = top;
      ctx.fillRect(kx + 2, kbY, kw - 4, blackH - 9);
      ctx.fillStyle = light ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(kx + 3, kbY + 2, 1.2, blackH - 14);
    }
  }
}

export default { draw: drawPianoWaterfall } satisfies ModeModule;
