import { ModeManifest } from '../../../types';

// Full-frame mode: the retro paint window fills the space between header and notes row.
const manifest: ModeManifest = {
  id: 'ink-roll',
  name: 'Ink Roll 98',
  kind: 'standalone',
  input: 'midi',
  fullFrame: true,
  description: 'A late-90s paint program: outlined notes get painted in melody, chord and bass colours as the brush passes.',
};

export default manifest;
