import { ModeManifest } from '../../../types';

// Base version: the mode card (room, notes, keys, audio view). The matte-black synth chassis
// needs a third hardware theme; until then the console above uses the default one.
const manifest: ModeManifest = {
  id: 'pnd-two',
  name: 'PARTYNEXTDOOR "PARTYNEXTDOOR TWO"',
  kind: 'album',
  input: 'midi',
  description: 'White and silver notes on black, with motion-blur trails at speed.',
  palette: { notesColor: '#f4f6f8', circleColor: '#2a2c30', bgColor: '#000000', accentColor: '#c8ccd2', glowColor: '#ffffff' },
  defaults: { title: 'PND TWO', bpm: 72 },
};

export default manifest;
