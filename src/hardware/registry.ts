import { SynthDrawContext, SynthManifest } from '../types';
import { drawST909Synthesizer } from './st909-synth';
import { drawWingUprightSynth } from './wing-upright-synth';
import { drawAnalogHardwareSynthesizer } from './analog-synth';
import { drawUheDivaSynthesizer } from './diva-synth';

export type SynthDrawFn = (ctx: CanvasRenderingContext2D, context: SynthDrawContext) => void;

/**
 * Standard Adapter for ST 909 Analog Synthesizer (Flagship).
 * Delivers 100% pixel-perfect rendering to the main console.
 */
export const drawST909Adapter: SynthDrawFn = (ctx, context) => {
  const { region, currentTime, midi, activeNotes, analysis, settings, colorTheme } = context;
  drawST909Synthesizer(
    ctx,
    region.x,
    region.y,
    region.width,
    region.height,
    currentTime,
    midi,
    activeNotes,
    analysis,
    settings,
    colorTheme ?? (settings.centerVisualizerMode === 'take-care' ? 'gold' : 'crimson')
  );
};

export const drawWingUprightAdapter: SynthDrawFn = (ctx, context) => {
  const { region, currentTime, midi, activeNotes, analysis, settings } = context;
  drawWingUprightSynth(
    ctx,
    region.x,
    region.y,
    region.width,
    region.height,
    currentTime,
    midi,
    activeNotes,
    analysis,
    settings
  );
};

export const drawAnalogSynthAdapter: SynthDrawFn = (ctx, context) => {
  const { region, currentTime, midi, activeNotes, analysis, settings } = context;
  drawAnalogHardwareSynthesizer(
    ctx,
    region.x,
    region.y,
    region.width,
    region.height,
    currentTime,
    midi,
    activeNotes,
    analysis,
    settings
  );
};

export const drawDivaSynthAdapter: SynthDrawFn = (ctx, context) => {
  const { region, currentTime, midi, activeNotes, analysis, settings } = context;
  drawUheDivaSynthesizer(
    ctx,
    region.x,
    region.y,
    region.width,
    region.height,
    currentTime,
    midi,
    activeNotes,
    analysis,
    settings
  );
};

export const SYNTH_REGISTRY: Record<string, SynthDrawFn> = {
  'st909': drawST909Adapter,
  'wing-upright': drawWingUprightAdapter,
  'analog-synth': drawAnalogSynthAdapter,
  'diva-synth': drawDivaSynthAdapter,
};

export const SYNTHS_MANIFEST: SynthManifest[] = [
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

export function getSynthRenderer(id?: string): SynthDrawFn {
  if (id && SYNTH_REGISTRY[id]) {
    return SYNTH_REGISTRY[id];
  }
  return drawST909Adapter;
}
