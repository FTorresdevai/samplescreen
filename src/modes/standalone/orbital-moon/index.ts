import { ModelDrawContext, ModeModule } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';
import { formatNoteName } from '../../../engine/chords';

const CRATERS = [
  { lat: -0.25, lon0: 0.3, r: 0.18 },
  { lat: 0.35, lon0: 1.2, r: 0.22 },
  { lat: 0.05, lon0: 2.1, r: 0.15 },
  { lat: -0.45, lon0: 2.9, r: 0.24 },
  { lat: 0.50, lon0: 3.8, r: 0.16 },
  { lat: -0.15, lon0: 4.6, r: 0.20 },
  { lat: 0.20, lon0: 5.4, r: 0.14 },
  { lat: -0.35, lon0: 6.0, r: 0.19 },
];

export function drawOrbitalMoonModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, settings, activeNotes } = context;
  const { centerX: cx, centerY: cy, radius } = region;

  ctx.save();
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;
  if (light) ctx.lineCap = 'round';

  const loop = duration > 0 ? duration : 16;
  const now = ((loopTime % loop) + loop) % loop;
  const READ = Math.PI / 2;
  const angleOf = (t: number) => READ - ((t - now) / loop) * Math.PI * 2;

  // 3D Tilted Elliptical Ring System (Tilt = 20 degrees / 0.35 rad)
  const ringA = radius * 0.95;
  const ringB = radius * 0.42;
  const moonR = radius * 0.35;
  const allNotes = midi.notes || [];

  // Helper to draw note segments partitioned by depth (front vs behind the moon)
  const drawBeltsPass = (isFrontPass: boolean) => {
    for (const note of allNotes) {
      const aStart = angleOf(note.time + note.duration);
      const aEnd = angleOf(note.time);
      const pitchNorm = (note.midi - 36) / 48;
      const trackA = ringA * (0.65 + Math.max(0, Math.min(1, pitchNorm)) * 0.35);
      const trackB = ringB * (0.65 + Math.max(0, Math.min(1, pitchNorm)) * 0.35);

      const isActive = now >= note.time && now < note.time + note.duration;

      ctx.save();
      if (isActive) {
        ctx.strokeStyle = settings.accentColor || '#fde047';
        ctx.lineWidth = isFrontPass ? 4 : 2.5;
        if (!light && isFrontPass) {
          ctx.shadowColor = settings.notesColor || '#f59e0b';
          ctx.shadowBlur = 12;
        }
      } else {
        const baseAlpha = light ? 0.85 : 0.5;
        const alpha = isFrontPass ? baseAlpha : baseAlpha * 0.35;
        ctx.strokeStyle = hexToRgbaStr(settings.notesColor || '#f59e0b', alpha);
        ctx.lineWidth = 2;
      }

      for (let s = 0; s < 10; s++) {
        const a0 = aStart + (s / 10) * (aEnd - aStart);
        const a1 = aStart + ((s + 1) / 10) * (aEnd - aStart);
        const aMid = (a0 + a1) / 2;
        const isFront = Math.sin(aMid) >= 0;
        if (isFront === isFrontPass) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a0) * trackA, Math.sin(a0) * trackB);
          ctx.lineTo(Math.cos(a1) * trackA, Math.sin(a1) * trackB);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };

  // ==========================================
  // PASS 1: BACK BELTS (Behind the moon, sin(a) < 0)
  // ==========================================
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35); // tilt

  // Subtle background orbit ring
  ctx.strokeStyle = hexToRgbaStr(ink, light ? 0.1 : 0.05);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, ringA, ringB, 0, 0, Math.PI * 2);
  ctx.stroke();

  drawBeltsPass(false);
  ctx.restore();

  // ==========================================
  // ROTATING MOON SPHERE WITH CRATERS
  // ==========================================
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
  ctx.clip();

  // Base moon surface
  ctx.fillStyle = light ? (settings.circleColor || '#b9bfb5') : '#94a3b8';
  ctx.fillRect(cx - moonR, cy - moonR, moonR * 2, moonR * 2);

  // Rotating craters
  for (const c of CRATERS) {
    const lon = c.lon0 + (now / loop) * Math.PI * 2;
    const cosL = Math.cos(lon);
    if (cosL > 0) {
      const crX = cx + Math.sin(lon) * moonR * 0.8;
      const crY = cy + c.lat * moonR;
      const rx = Math.max(0.5, moonR * c.r * cosL);
      const ry = moonR * c.r;
      ctx.fillStyle = light ? hexToRgbaStr(ink, 0.2) : 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(crX, crY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fixed light & shadow gradient on top of rotating surface
  const moonGrad = ctx.createRadialGradient(cx - moonR * 0.35, cy - moonR * 0.35, 5, cx, cy, moonR);
  if (light) {
    moonGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    moonGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    moonGrad.addColorStop(1, hexToRgbaStr(ink, 0.45));
  } else {
    moonGrad.addColorStop(0, 'rgba(241, 245, 249, 0.55)');
    moonGrad.addColorStop(0.35, 'rgba(148, 163, 184, 0.08)');
    moonGrad.addColorStop(0.75, 'rgba(15, 23, 42, 0.7)');
    moonGrad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ==========================================
  // PASS 2: FRONT BELTS & FIXED PLAYHEAD MARKER
  // ==========================================
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35); // tilt

  drawBeltsPass(true);

  // Fixed Playhead Marker at READ (Math.PI / 2)
  const py = ringB;
  ctx.strokeStyle = hexToRgbaStr(ink, light ? 0.35 : 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ringB - 14);
  ctx.lineTo(0, ringB + 8);
  ctx.stroke();

  ctx.fillStyle = ink;
  if (!light) {
    ctx.shadowColor = settings.accentColor || '#fde047';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.arc(0, py, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Note Name Tags for active notes at the fixed strike point
  if (settings.noteNameTags !== false && activeNotes && activeNotes.length > 0) {
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Deduplicate active notes by MIDI pitch
    const seenPitches = new Set<number>();
    const uniqueActive = activeNotes.filter(n => {
      if (seenPitches.has(n.midi)) return false;
      seenPitches.add(n.midi);
      return true;
    });

    for (let i = 0; i < uniqueActive.length; i++) {
      const note = uniqueActive[i];
      const pitchNorm = (note.midi - 36) / 48;
      const trackB = ringB * (0.65 + Math.max(0, Math.min(1, pitchNorm)) * 0.35);
      const noteName = formatNoteName(note.midi, settings.accidental, settings.middleC);
      const tagW = ctx.measureText(noteName).width + 8;
      const tagH = 16;
      const tagX = 14 + tagW / 2;
      const tagY = trackB;

      ctx.save();
      ctx.translate(tagX, tagY);
      ctx.rotate(0.35); // un-tilt so tag is upright

      ctx.fillStyle = settings.accentColor || '#fde047';
      if (!light) {
        ctx.shadowColor = settings.notesColor || '#f59e0b';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(-tagW / 2, -tagH / 2, tagW, tagH);

      ctx.fillStyle = settings.bgColor || '#0a0502';
      ctx.fillText(noteName, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore(); // restore tilt

  ctx.restore();
}

export default { draw: drawOrbitalMoonModel } satisfies ModeModule;
