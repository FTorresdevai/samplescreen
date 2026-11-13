import { ModeManifest } from '../../../types';

// Full-frame mode: a black-and-white stage in thick fog, backlit, with flame columns.
// Bass raises the fire, a hard kick fires a pyro burst (and a rate-limited strobe), mids drive the beams.
const manifest: ModeManifest = {
  id: 'fog-stage',
  name: 'Fog Stage',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  photo: true,
  looks: [
    { id: 'mono', name: 'Mono' },
    { id: 'ember', name: 'Ember' },
  ],
  description: 'Black-and-white stage in thick fog: backlight beams, flame columns that rise with the bass, pyro bursts and strobe on the kick. Optional photo. MIDI or audio.',
};

export default manifest;
