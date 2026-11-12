import { ActiveVisualModel, ModelDrawContext, VisualModelManifest } from '../types';
import { drawLinearModel } from './linear';
import { drawCircularModel } from './circular';
import { drawTakeCareModel } from './take-care';
import { drawTzLadoMauModel } from './tz-lado-mau';
import { drawOrbitalMoonModel } from './orbital-moon';
import { drawAureolaModel } from './aureola';

export type ModelDrawFn = (ctx: CanvasRenderingContext2D, context: ModelDrawContext) => void;

export const MODEL_REGISTRY: Record<string, ModelDrawFn> = {
  'linear': drawLinearModel,
  'circular': drawCircularModel,
  'take-care': drawTakeCareModel,
  'tz-lado-mau': drawTzLadoMauModel,
  'orbital-moon': drawOrbitalMoonModel,
  'aureola': drawAureolaModel,
};

export const VISUAL_MODELS_MANIFEST: VisualModelManifest[] = [
  {
    id: 'take-care',
    name: 'Drake "Take Care"',
    category: 'album',
    description: 'OVO baroque salon, 40s vintage Toronto piano, and liquid gold waterfall.',
    tag: 'OFFICIAL ALBUM',
  },
  {
    id: 'tz-lado-mau',
    name: 'TZ da Coronel "Lado Mau"',
    category: 'album',
    description: 'Volcanic trap & drill aesthetics with sonic magma and dark inferno piano.',
    tag: 'OFFICIAL ALBUM',
  },
  {
    id: 'aureola',
    name: 'Prismatic Aureole',
    category: 'creative',
    description: 'Chromatic solar halo with reactive shockwaves and harmonic rings.',
    tag: 'HIGH DYNAMIC',
  },
  {
    id: 'linear',
    name: 'DAW Linear Roll',
    category: 'daw',
    description: 'Traditional horizontal studio visualizer with grid and bar markers.',
    tag: 'CLASSIC PRO',
  },
  {
    id: 'circular',
    name: 'Polar Sequencer',
    category: 'creative',
    description: '360-degree vinyl turntable with rotating playhead needle and center orb.',
    tag: 'VINYL 360°',
  },
  {
    id: 'orbital-moon',
    name: '3D Celestial Orbit',
    category: 'creative',
    description: 'Shaded celestial moon with tilted Saturn-like elliptical orbital rings.',
    tag: 'CELESTIAL 3D',
  },
];

export function getModelRenderer(mode: string): ModelDrawFn {
  return MODEL_REGISTRY[mode] || MODEL_REGISTRY['linear'];
}
