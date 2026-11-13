import { ModelDrawContext, ModeModule, ParsedMidi } from '../../../types';
import { formatNoteName } from '../../../engine/chords';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';

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
  const { region, loopTime, duration, midi, settings } = context;
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
  // PIANO ROLL MODE (WITH MIDI NOTES)
  // ==========================================
  const bpm = settings.bpm || midi.bpm || 80;
  const secondsPerBar = (60 / bpm) * 4;
  const totalBars = Math.max(1, Math.round(duration / secondsPerBar));

  // Pitch Range Mapping
  const allNotes = midi.notes || [];
  const { minMidi, pitchSpan } = getPitchRange(midi);

  // Time window
  const windowSecs = duration || 16;
  const playheadX = x + (loopTime / windowSecs) * w;

  // Vertical Bar Lines
  ctx.strokeStyle = light ? hexToRgbaStr(settings.circleColor || ink, 0.9) : hexToRgbaStr(ink, 0.05);
  ctx.lineWidth = 1;
  for (let bar = 0; bar <= totalBars; bar++) {
    const bx = x + (bar / totalBars) * w;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx, y + h);
    ctx.stroke();
  }

  // Draw MIDI Note Blocks
  allNotes.forEach(note => {
    const nx = x + (note.time / windowSecs) * w;
    const nw = Math.max(4, (note.duration / windowSecs) * w);
    const pitchNorm = (note.midi - minMidi) / pitchSpan;
    const ny = y + h - 30 - pitchNorm * (h - 60);
    const nh = Math.max(8, (h - 60) / pitchSpan - 2);

    const isActive = loopTime >= note.time && loopTime < note.time + note.duration;

    ctx.save();
    if (isActive) {
      ctx.fillStyle = settings.accentColor || '#fde047';
      if (!light) {
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 10;
      }
    } else {
      ctx.fillStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', noteAlpha);
    }

    ctx.fillRect(nx, ny, nw, nh);
    ctx.restore();

    // Note name fixed inside the left edge of the active block, clipped to its width
    if (isActive && settings.noteNameTags !== false && nw > 14) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(nx, ny, nw, nh);
      ctx.clip();
      ctx.font = `800 ${Math.min(11, Math.max(8, nh - 4))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = settings.bgColor || '#0a0502';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatNoteName(note.midi, settings.accidental, settings.middleC), nx + 4, ny + nh / 2);
      ctx.restore();
    }
  });

  // Vertical Playhead Needle
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  if (light) {
    ctx.lineCap = 'round';
  } else {
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.moveTo(playheadX, y);
  ctx.lineTo(playheadX, y + h);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export default { draw: drawLinearModel } satisfies ModeModule;
