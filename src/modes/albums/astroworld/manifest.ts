import { ModeManifest } from '../../../types';

// Console above the card: brushed-brass ST 909 (`synthTheme: 'brass'`).
const manifest: ModeManifest = {
  id: 'astroworld',
  name: 'Travis Scott "ASTROWORLD"',
  kind: 'album',
  input: 'midi',
  description: 'Gold notes under a night sky; the wheel lights chase and sparks fly at speed.',
  palette: { notesColor: '#f6c453', circleColor: '#2a2140', bgColor: '#070b1f', accentColor: '#ffe9a8', glowColor: '#ff9d2e' },
  synthTheme: 'brass',
  waveformHardware: 'album-banner',
  defaults: { title: 'ASTROWORLD', bpm: 150 },
};

export default manifest;
