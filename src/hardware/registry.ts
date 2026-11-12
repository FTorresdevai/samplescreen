import { HardwareModule, SynthManifest } from '../types';

/**
 * Lazy hardware loaders: each synth is its own chunk and loads only when used.
 * Adapters map the shared SynthDrawContext onto each renderer's signature.
 */
export const HARDWARE_LOADERS: Record<string, () => Promise<HardwareModule>> = {
  'st909': () => import('./st909-synth').then(m => ({
    draw: (ctx, { region: r, currentTime, midi, activeNotes, analysis, settings, theme }) =>
      m.drawST909Synthesizer(ctx, r.x, r.y, r.width, r.height, currentTime, midi, activeNotes, analysis, settings, theme),
  })),
  'tape-machine': () => import('./tape-machine').then(m => ({
    draw: (ctx, { region: r, currentTime, analysis, settings, theme }) =>
      m.drawStudioTapeMachine(ctx, r.x, r.y, r.width, r.height, theme, { currentTime, analysis, bpm: settings.bpm }),
  })),
  'wing-upright': () => import('./wing-upright-synth').then(m => ({
    draw: (ctx, { region: r, currentTime, midi, activeNotes, analysis, settings }) =>
      m.drawWingUprightSynth(ctx, r.x, r.y, r.width, r.height, currentTime, midi, activeNotes, analysis, settings),
  })),
  'analog-synth': () => import('./analog-synth').then(m => ({
    draw: (ctx, { region: r, currentTime, midi, activeNotes, analysis, settings }) =>
      m.drawAnalogHardwareSynthesizer(ctx, r.x, r.y, r.width, r.height, currentTime, midi, activeNotes, analysis, settings),
  })),
  'diva-synth': () => import('./diva-synth').then(m => ({
    draw: (ctx, { region: r, currentTime, midi, activeNotes, analysis, settings }) =>
      m.drawUheDivaSynthesizer(ctx, r.x, r.y, r.width, r.height, currentTime, midi, activeNotes, analysis, settings),
  })),
};

export const SYNTHS_MANIFEST: SynthManifest[] = [
  {
    id: 'tape-machine',
    name: 'Tape Mark II Master Studio Deck',
    tag: 'ANALOG MASTER',
    description: 'Swedish 1/2" dual-reel master tape machine with incandescent backlit VU meters and servo motor control.',
  },
  {
    id: 'st909',
    name: 'ST 909 Analogue Synthesizer',
    tag: 'FLAGSHIP PRO',
    description: 'Triple VCO analog hardware with CRT oscilloscope, mahogany cheeks, and illuminated 25-key keyboard.',
  },
  {
    id: 'wing-upright',
    name: 'Keyscape Wing Upright',
    tag: 'ACOUSTIC VINTAGE',
    description: 'Spectrasonics vintage wing upright piano with carved American walnut side cheeks.',
  },
  {
    id: 'analog-synth',
    name: 'Vintage Prophet Console',
    tag: 'POLYPHONIC',
    description: 'Classic 70s polyphonic analog synthesizer with pitch and modulation wheels well.',
  },
  {
    id: 'diva-synth',
    name: 'U-he Diva Dual Rack',
    tag: 'VIRTUAL ANALOG',
    description: 'Zero-delay feedback filter rack with modular oscillator matrix.',
  },
];

export function loadHardware(id: string): Promise<HardwareModule> {
  return (HARDWARE_LOADERS[id] ?? HARDWARE_LOADERS['st909'])();
}
