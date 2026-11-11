import { ModelDrawContext } from '../../types';
import { formatNoteName } from '../../engine/chords';
import { hexToRgbaStr } from '../../engine/palettes';
import { drawMirroredSpectrumBars, drawOscilloscopeBeam } from '../../shared/waveform-engine';

export function drawLinearModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, activeNotes, analysis, settings, isWaveformMode } = context;
  const { x, y, width: w, height: h } = region;

  ctx.save();

  // Glass Frame Box
  ctx.fillStyle = 'rgba(8, 9, 13, 0.75)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  if (isWaveformMode) {
    // ==========================================
    // WAVEFORM MODE (PURE AUDIO STREAM)
    // ==========================================
    const centerY = y + h / 2;

    // Spectrum Equalizer Bars
    drawMirroredSpectrumBars(
      ctx,
      x + 20,
      centerY,
      w - 40,
      h * 0.38,
      analysis.fft,
      48,
      3,
      settings.accentColor || '#fde047',
      settings.notesColor || '#f59e0b'
    );

    // Center Oscilloscope Glowing Beam
    drawOscilloscopeBeam(
      ctx,
      x + 20,
      centerY,
      w - 40,
      h * 0.22,
      analysis.waveform,
      '#ffffff',
      settings.accentColor || '#fde047'
    );

    // DAW Track Header
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = settings.accentColor || '#fde047';
    ctx.textAlign = 'left';
    ctx.fillText('AUDIO STREAM • MASTER STEREO WAVEFORM (60 FPS)', x + 24, y + 28);

  } else {
    // ==========================================
    // PIANO ROLL MODE (WITH MIDI NOTES)
    // ==========================================
    const bpm = settings.bpm || midi.bpm || 80;
    const secondsPerBar = (60 / bpm) * 4;
    const totalBars = Math.max(1, Math.round(duration / secondsPerBar));

    // Pitch Range Mapping
    const allNotes = midi.notes || [];
    const minMidi = allNotes.length > 0 ? Math.min(...allNotes.map(n => n.midi)) : 48;
    const maxMidi = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.midi)) : 72;
    const pitchSpan = Math.max(12, maxMidi - minMidi + 4);

    // Time window
    const windowSecs = duration || 16;
    const playheadX = x + (loopTime / windowSecs) * w;

    // Vertical Bar Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', 0.65);
      }

      ctx.fillRect(nx, ny, nw, nh);
      ctx.restore();
    });

    // Vertical Playhead Needle
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(playheadX, y);
    ctx.lineTo(playheadX, y + h);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
