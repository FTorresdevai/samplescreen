// Live previews for the landing page, drawn by the same code as the app:
// the hero is a full 1080×1920 frame (CanvasRenderer), each card is that mode's own draw().
// There is no audio here, so the audio analysis is simulated from the demo MIDI.
import { AudioAnalysis, MidiNote, ModeModule, ModelDrawContext, VisualizerSettings } from '../types';
import { CanvasRenderer } from '../engine/renderer';
import { createDemoMidi, getActiveNotes } from '../engine/midi';
import { RenderModules, loadRenderModules } from '../engine/modules';
import { DEFAULT_MODE_ID, getManifest, loadMode } from '../modes/registry';
import { DEFAULT_SETTINGS } from '../core/default-settings';
import { applyMode } from '../core/mode-resolution';

const midi = createDemoMidi(16);
const REGION = { x: 60, y: 795, width: 960, height: 670 };   // the mode card inside the 1080×1920 frame

function settingsFor(modeId: string): VisualizerSettings {
  const manifest = getManifest(modeId);
  return {
    ...DEFAULT_SETTINGS,
    ...applyMode(manifest, DEFAULT_SETTINGS.paletteId),
    bpm: midi.bpm,
    key: 'KEY',
    producerHandle: 'PRODUCER NAME',
  };
}

const analysis: AudioAnalysis = { fft: new Uint8Array(512), waveform: new Uint8Array(1024), bass: 0, mid: 0, treble: 0, rms: 0 };

/** Fills `analysis` with a plausible signal for the notes sounding at `t`. */
function simulateAnalysis(t: number, active: MidiNote[]) {
  const kick = Math.exp(-((t * midi.bpm) / 60 % 1) * 5);
  const level = Math.min(1, active.length / 5);
  const { fft, waveform } = analysis;
  for (let i = 0; i < waveform.length; i++) {
    let v = 0;
    for (const n of active) v += Math.sin((i / waveform.length) * Math.PI * 2 * 3 * Math.pow(2, (n.midi - 48) / 12) + t * 6);
    waveform[i] = 128 + Math.max(-1, Math.min(1, (v / Math.max(2, active.length)) * (0.5 + 0.4 * kick))) * 100;
  }
  for (let i = 0; i < fft.length; i++) {
    let v = i < 8 ? kick * 200 * (1 - i / 8) : 0;
    for (const n of active) {
      const d = i - (n.midi - 30) * 4;
      v += 170 * Math.exp(-(d * d) / 18);
    }
    fft[i] = Math.min(255, v * (0.75 + 0.25 * Math.sin(i * 0.7 + t * 4)));
  }
  analysis.bass = 0.2 + 0.5 * kick;
  analysis.mid = 0.15 + 0.4 * level;
  analysis.treble = 0.08 + 0.2 * level;
  analysis.rms = 0.12 + 0.25 * level + 0.12 * kick;
}

interface Thumb { canvas: HTMLCanvasElement; settings: VisualizerSettings; mode: ModeModule | null }

function drawThumb(th: Thumb, t: number, active: MidiNote[]) {
  const { canvas, settings, mode } = th;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!mode || !w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = w / REGION.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = settings.bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(s, 0, 0, s, -REGION.x * s, -REGION.y * s);
  const context: ModelDrawContext = {
    ctx,
    region: { ...REGION, centerX: REGION.x + REGION.width / 2, centerY: REGION.y + REGION.height / 2, radius: REGION.height / 2 - 20 },
    currentTime: t,
    loopTime: t,
    duration: midi.duration,
    midi,
    activeNotes: active,
    analysis,
    settings,
    albumView: 'midi',
  };
  ctx.save();
  try { mode.draw(ctx, context); } catch (err) { console.warn(`[landing] ${settings.modeId} preview failed`, err); th.mode = null; }
  ctx.restore();
}

export function startPreviews() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroCanvas = document.querySelector<HTMLCanvasElement>('#hero-canvas');
  const heroSettings = settingsFor(DEFAULT_MODE_ID);
  const renderer = heroCanvas ? new CanvasRenderer(heroCanvas) : null;
  let heroModules: RenderModules | null = null;
  loadRenderModules(heroSettings, true).then((m) => { heroModules = m; kick(); });

  const thumbs: Thumb[] = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-mode]')].map((canvas) => {
    const th: Thumb = { canvas, settings: settingsFor(canvas.dataset.mode!), mode: null };
    loadMode(th.settings.modeId).then((mode) => { th.mode = mode; kick(); });
    return th;
  });

  const visible = new Set<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }
  }, { rootMargin: '80px' });
  if (heroCanvas) io.observe(heroCanvas);
  thumbs.forEach((th) => io.observe(th.canvas));

  let frame = 0;
  const render = (ms: number) => {
    // Reduced motion: one still frame from the middle of bar 2
    const t = reduced ? 4.2 : (ms / 1000) % midi.duration;
    const active = getActiveNotes(midi.notes, t);
    simulateAnalysis(t, active);
    if (renderer && heroCanvas && visible.has(heroCanvas)) renderer.render(t, midi, analysis, heroSettings, heroModules);
    if (frame++ % 2 === 0 || reduced) {                      // cards at half rate
      for (const th of thumbs) if (visible.has(th.canvas)) drawThumb(th, t, active);
    }
  };

  // Still frames are redrawn when a module or image arrives; otherwise the loop runs.
  function kick() { if (reduced) [0, 300, 1200].forEach((d) => setTimeout(() => requestAnimationFrame(render), d)); }
  if (reduced) {
    kick();
    addEventListener('resize', () => requestAnimationFrame(render));
  } else {
    const loop = (ms: number) => { render(ms); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
