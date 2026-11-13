import { ModeManifest } from '../../../types';

// Full-frame mode: no console above; the illustrated synth and piano roll fill header → notes row.
const manifest: ModeManifest = {
  id: 'piano-waterfall',
  name: 'Graphite Synth',
  kind: 'standalone',
  input: 'midi',
  fullFrame: true,
  description: "A hand-drawn vintage synth on cream paper; keys light up in each note's colour above a pill-note piano roll.",
};

export default manifest;
