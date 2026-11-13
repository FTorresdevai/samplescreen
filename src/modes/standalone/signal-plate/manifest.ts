import { ModeManifest } from '../../../types';

// Full-frame, audio-only: a phosphor CRT measuring instrument.
const manifest: ModeManifest = {
  id: 'signal-plate',
  name: 'Night Scope',
  kind: 'standalone',
  input: 'audio',
  fullFrame: true,
  description: 'Phosphor CRT instrument: triggered oscilloscope trace with afterglow, graticule, spectrum readout and live BPM, dB, frequency and time readouts. Audio only.',
};

export default manifest;
