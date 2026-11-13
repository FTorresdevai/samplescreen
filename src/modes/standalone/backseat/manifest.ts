import { ModeManifest } from '../../../types';

// Full-frame mode: back-seat POV at night, the city sliding past the windows.
// Kick = disposable-camera flash, hats = twinkling lights, BPM = car speed. MIDI notes add passing lights.
const manifest: ModeManifest = {
  id: 'backseat',
  name: 'Backseat',
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  photo: true,
  looks: [
    { id: 'tungsten', name: 'Tungsten' },
    { id: 'ice', name: 'Ice' },
  ],
  description: 'Night ride from the back seat: city lights stream past the windows, the kick fires a disposable-camera flash. Tungsten or Ice grade, optional photo. MIDI or audio.',
};

export default manifest;
