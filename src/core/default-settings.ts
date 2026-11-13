import { VisualizerSettings } from '../types';
import { DEFAULT_MODE_ID } from '../modes/registry';
import { DEFAULT_PALETTE_ID, paletteSettings } from '../engine/palettes';

/** Settings on first load; the app overrides title/BPM/key/mode from the URL, the landing previews reuse them. */
export const DEFAULT_SETTINGS: VisualizerSettings = {
  title: 'FEELS THE SAME',
  bpm: 120,
  key: 'E MIN',
  producerHandle: 'PRODBYSERROT',
  watermark: 'samplescreen visualizer • 1080x1920 @ 60 fps',

  ...paletteSettings(DEFAULT_PALETTE_ID),
  backgroundGlow: true,
  albumView: 'midi',

  chordDisplay: 'bottom',
  showChordSymbol: false,
  showSafeZoneGuides: false,
  showPreviewHud: false,
  fitReelsSafeZone: false,

  modeId: DEFAULT_MODE_ID,
  loopBars: 10,
  noteNameTags: true,
  showProgressDashes: true,

  accidental: 'sharp',
  middleC: 3,

  // Intro Sequence Feature (1 - 8 Bars)
  enableIntro: false,
  introBars: 4,

  audioSensitivity: 1.2,
  glowIntensity: 1.3,

  exportLoops: 1,
};
