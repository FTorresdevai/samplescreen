import { ModelDrawContext, ModeModule, ParsedMidi } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';

// Pitch range per MIDI object, computed once instead of scanning every note each frame
const rangeCache = new WeakMap<ParsedMidi, { minMidi: number; pitchSpan: number }>();
function getPitchRange(midi: ParsedMidi) {
  let range = rangeCache.get(midi);
  if (!range) {
    const notes = midi.notes || [];
    const minMidi = notes.length > 0 ? Math.min(...notes.map(n => n.midi)) : 48;
    const maxMidi = notes.length > 0 ? Math.max(...notes.map(n => n.midi)) : 72;
    range = { minMidi, pitchSpan: Math.max(12, maxMidi - minMidi + 4) };
    rangeCache.set(midi, range);
  }
  return range;
}

export function drawLinearModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, settings, activeNotes } = context;
  const { x, y, width: w, height: h } = region;

  ctx.save();

  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  const noteAlpha = light ? 0.9 : 0.65;

  // Frame: smoked glass on dark palettes, a plain outline on light ones
  if (!light) {
    ctx.fillStyle = 'rgba(8, 9, 13, 0.75)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = hexToRgbaStr(ink, light ? 0.25 : 0.08);
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // ==========================================
  // DAW PIANO ROLL GEOMETRY
  // Vertical keyboard on the left, scrolling roll on the right
  // ==========================================
  const keysW = Math.max(28, Math.min(48, w * 0.06));
  const rollX = x + keysW;
  const rollW = w - keysW;

  const bpm = settings.bpm || midi.bpm || 80;
  const secondsPerBar = (60 / bpm) * 4;
  const loop = duration > 0 ? duration : 16;
  const now = ((loopTime % loop) + loop) % loop;
  const spanSec = Math.max(2, Math.min(loop, secondsPerBar * 4));   // up to 4 bars on screen
  const pxPerSec = rollW / spanSec;
  const strikeX = rollX + rollW * 0.28;
  const pastSec = (strikeX - rollX) / pxPerSec;
  const futureSec = (rollX + rollW - strikeX) / pxPerSec;
  const timeToX = (rel: number) => strikeX + rel * pxPerSec;
  const notesColor = settings.notesColor || '#f59e0b';
  const accent = settings.accentColor || '#fde047';

  const allNotes = midi.notes || [];
  const { minMidi, pitchSpan } = getPitchRange(midi);
  const rowH = (h - 60) / pitchSpan;
  const pitchY = (p: number) => y + h - 30 - ((p - minMidi) / pitchSpan) * (h - 60);

  const activePitches = new Set<number>(activeNotes.map(n => n.midi));
  const keyActiveColor = light ? (settings.notesColor || ink) : (settings.accentColor || '#fde047');
  const whiteKeyColor = light ? '#fbfaf6' : '#efe9dc';
  const blackKeyColor = light ? ink : '#141113';

  // 1. Vertical Keyboard (DAW sidebar)
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, keysW, h);
  ctx.clip();

  for (let p = minMidi; p < minMidi + pitchSpan; p++) {
    const pc = ((p % 12) + 12) % 12;
    const isWhite = pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11;
    const ky = pitchY(p);
    const isAct = activePitches.has(p);

    if (isWhite) {
      ctx.fillStyle = isAct ? keyActiveColor : whiteKeyColor;
      ctx.fillRect(x, ky, keysW, rowH - 1);
    } else {
      // White extension behind the black key
      ctx.fillStyle = whiteKeyColor;
      ctx.fillRect(x, ky, keysW, rowH - 1);
      // Black key
      ctx.fillStyle = isAct ? keyActiveColor : blackKeyColor;
      ctx.fillRect(x, ky, keysW * 0.62, rowH - 1);
    }

    // Key separator
    ctx.fillStyle = light ? hexToRgbaStr(ink, 0.15) : 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x, ky + rowH - 1, keysW, 1);

    // Subtle C key marker line
    if (pc === 0) {
      ctx.fillStyle = light ? hexToRgbaStr(ink, 0.4) : hexToRgbaStr(ink, 0.3);
      ctx.fillRect(x, ky + rowH - 1, keysW, 1.5);
    }
  }
  ctx.restore();

  // Vertical divider between keys and piano roll
  ctx.strokeStyle = hexToRgbaStr(ink, light ? 0.25 : 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rollX, y);
  ctx.lineTo(rollX, y + h);
  ctx.stroke();

  // 2. Piano Roll (Lanes, Bar lines, Note blocks)
  ctx.save();
  ctx.beginPath();
  ctx.rect(rollX, y, rollW, h);
  ctx.clip();

  // Background lane stripes for black keys & C dividers
  for (let p = minMidi; p < minMidi + pitchSpan; p++) {
    const pc = ((p % 12) + 12) % 12;
    const isWhite = pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11;
    const ky = pitchY(p);
    if (!isWhite) {
      ctx.fillStyle = hexToRgbaStr(ink, light ? 0.04 : 0.03);
      ctx.fillRect(rollX, ky, rollW, rowH);
    }
    if (pc === 0) {
      ctx.fillStyle = hexToRgbaStr(ink, light ? 0.12 : 0.06);
      ctx.fillRect(rollX, ky + rowH - 1, rollW, 1);
    }
  }

  // Bar lines (wrap around the loop so the grid never jumps)
  ctx.strokeStyle = light ? hexToRgbaStr(settings.circleColor || ink, 0.9) : hexToRgbaStr(ink, 0.06);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const totalBars = Math.max(1, Math.round(loop / secondsPerBar));
  for (let k = -1; k <= 1; k++) {
    for (let bar = 0; bar < totalBars; bar++) {
      const rel = bar * secondsPerBar + k * loop - now;
      if (rel < -pastSec || rel > futureSec) continue;
      const bx = timeToX(rel);
      ctx.moveTo(bx, y);
      ctx.lineTo(bx, y + h);
    }
  }
  ctx.stroke();

  // Note blocks: three copies (previous, current, next loop) cover the seam.
  // Like the album waterfalls, a sounding note keeps its own shape (just at full strength);
  // the lit key on the keyboard and a faint halo on the strike line show what is playing.
  const nh = Math.max(4, rowH - 2);
  const showNames = settings.noteNameTags !== false && nh >= 9;
  ctx.font = `600 ${Math.min(11, Math.floor(nh - 2))}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const note of allNotes) {
    const ny = pitchY(note.midi);
    for (let k = -1; k <= 1; k++) {
      const rel = note.time + k * loop - now;
      const relEnd = rel + note.duration;
      if (relEnd < -pastSec || rel > futureSec) continue;
      const nx = timeToX(rel);
      const nw = Math.max(4, note.duration * pxPerSec);
      const isActive = rel <= 0 && relEnd > 0;
      const played = relEnd <= 0;

      ctx.fillStyle = isActive ? notesColor : hexToRgbaStr(notesColor, played ? noteAlpha * 0.4 : noteAlpha);
      ctx.fillRect(nx, ny, nw, nh);

      if (isActive) {
        // Soft halo where the note meets the strike line (a short faint bar, no shadowBlur)
        ctx.fillStyle = light ? hexToRgbaStr(ink, 0.18) : 'rgba(255,255,255,0.16)';
        ctx.fillRect(strikeX - 5, ny - 2, 10, nh + 4);
      }

      // Note name inside the bar, piano-roll style, when it fits
      if (showNames && nw > 26) {
        ctx.fillStyle = light ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.72)';
        ctx.fillText(formatNoteName(note.midi, settings.accidental, settings.middleC), nx + 4, ny + nh / 2 + 0.5, nw - 8);
      }
    }
  }
  ctx.restore();

  // Fixed strike line
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  if (light) {
    ctx.lineCap = 'round';
  } else {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.moveTo(strikeX, y);
  ctx.lineTo(strikeX, y + h);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export default { draw: drawLinearModel } satisfies ModeModule;
