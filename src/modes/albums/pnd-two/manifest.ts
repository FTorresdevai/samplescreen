import { ModeManifest } from '../../../types';

// Console above the card: matte satin black ST 909 (`synthTheme: 'matte'`).
const manifest: ModeManifest = {
  id: 'pnd-two',
  name: 'PARTYNEXTDOOR "PARTYNEXTDOOR TWO"',
  kind: 'album',
  input: 'both',
  description: 'White and silver notes on black, with motion-blur trails at speed.',
  palette: { notesColor: '#f4f6f8', circleColor: '#2a2c30', bgColor: '#000000', accentColor: '#c8ccd2', glowColor: '#ffffff' },
  synthTheme: 'matte',
  waveformHardware: 'album-banner',
  defaults: { title: 'PND TWO', bpm: 72 },
};

export default manifest;
