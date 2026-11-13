import { ModeManifest } from '../../../types';

// Full-frame mode: a silver pocket MP3 player with a click wheel and white earbuds on a grey desk.
// The beat plays on its colour screen: a "Now Playing" page with a spectrum (audio) or a mini piano roll (MIDI).
const manifest: ModeManifest = {
  id: 'pocket-player',
  name: 'Pocket Player',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  description: 'Silver pocket MP3 player with a click wheel and earbuds: the beat plays on its screen as a Now Playing page with a spectrum or a mini piano roll. MIDI or audio.',
};

export default manifest;
