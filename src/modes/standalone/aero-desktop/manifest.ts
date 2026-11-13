import { ModeManifest } from '../../../types';

// Full-frame mode: a late-2000s glossy desktop with a made-up DAW playlist and a cam window.
// Works with MIDI (clips = notes) and audio only (one track with the recorded energy envelope).
// 'both': the MIDI / Audio view switch picks which one (settings.albumView).
const manifest: ModeManifest = {
  id: 'aero-desktop',
  name: 'Y2K Desktop',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  description: 'Glossy late-2000s desktop: a DAW playlist window, a cam window and a CRT/VHS pass. MIDI or audio.',
};

export default manifest;
