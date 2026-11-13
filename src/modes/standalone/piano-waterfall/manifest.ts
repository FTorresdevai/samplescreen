import { ModeManifest } from '../../../types';

// Full-frame mode: no console above; the keytar and piano roll fill header → notes row.
const manifest: ModeManifest = {
  id: 'piano-waterfall',
  name: 'Pocket Keys 86',
  kind: 'standalone',
  input: 'midi',
  fullFrame: true,
  description: "A mid-80s portable keytar whose keys light up in each note's colour and whose display shows the chord and BPM, above a scrolling piano roll.",
};

export default manifest;
