import { ModeManifest } from '../../../types';

const manifest: ModeManifest = {
  id: 'tz-lado-mau',
  name: 'TZ da Coronel "Lado Mau"',
  kind: 'album',
  input: 'both',
  description: 'Ember note waterfall over a dark piano.',
  palette: { notesColor: '#ff5500', circleColor: '#2b1206', bgColor: '#080402', accentColor: '#ff8800', glowColor: '#ff3b00' },
  waveformHardware: 'album-banner',
  bannerFocus: { x: 0.5, y: 0 }, // fill the frame, keep the top (faces) visible
  defaults: { title: 'LADO MAU', bpm: 140, key: 'D MIN' },
};

export default manifest;
