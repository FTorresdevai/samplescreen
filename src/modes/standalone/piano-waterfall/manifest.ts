import { ModeManifest } from '../../../types';

// Full-frame mode: no console above, the piano fills the space between header and notes row.
const manifest: ModeManifest = {
  id: 'piano-waterfall',
  name: 'Wax Keys',
  kind: 'standalone',
  input: 'midi',
  fullFrame: true,
  description: 'Notes fall onto a full-width upright piano; keys press and light up as they land.',
};

export default manifest;
