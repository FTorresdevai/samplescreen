import { ModeManifest } from '../../../types';

// Full-frame mode: a late-2000s glossy desktop with one large glass window.
// Works with MIDI (notes scroll past a playhead on a pitch axis) and audio only (one energy band).
// 'both': the MIDI / Audio view switch picks which one (settings.albumView).
const manifest: ModeManifest = {
  id: 'aero-desktop',
  name: 'Y2K Desktop',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  description: 'Glossy late-2000s desktop: one glass window with notes scrolling past a playhead, and a light CRT/VHS pass. MIDI or audio.',
};

export default manifest;
