import { ModeManifest } from '../../../types';

// Full-frame mode: an open white clamshell handheld with two screens, covered in stickers.
// Top screen shows the beat (spectrum + scope, or a piano roll with MIDI); the bottom touch screen
// shows the track, a beat counter and a little pixel cat that bobs to the bass.
const manifest: ModeManifest = {
  id: 'pocket-duo',
  name: 'Pocket Duo',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  description: 'White dual-screen clamshell handheld with stickers: the beat plays on the top screen, the track, beat counter and a bobbing pixel cat on the touch screen. MIDI or audio.',
};

export default manifest;
