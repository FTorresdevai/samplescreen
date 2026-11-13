import { ModeManifest } from '../../../types';

// Full-frame mode: a 2004 MiniDV viewfinder filming a night city.
// Kick = zoom pulse, loudness = auto-exposure, hard hits = tape dropout and a focus hunt. MIDI notes flash billboards.
const manifest: ModeManifest = {
  id: 'camcorder-04',
  name: "Camcorder '04",
  kind: 'standalone',
  input: 'both',
  fullFrame: true,
  photo: true,
  description: 'MiniDV night footage, 2004: REC, timecode and date over a glowing city, zoom pulses on the kick, interlace, chroma bleed and tape dropouts. Optional photo. MIDI or audio.',
};

export default manifest;
