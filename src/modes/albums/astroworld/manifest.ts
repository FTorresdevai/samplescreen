import { ModeManifest } from '../../../types';

// Base version: the mode card (room, notes, keys, audio view). The console above uses the
// existing gold hardware theme; a brushed-brass chassis is a later step.
const manifest: ModeManifest = {
  id: 'astroworld',
  name: 'Travis Scott "ASTROWORLD"',
  kind: 'album',
  input: 'midi',
  description: 'Gold notes under a night sky; the wheel lights chase and sparks fly at speed.',
  palette: { notesColor: '#f6c453', circleColor: '#2a2140', bgColor: '#070b1f', accentColor: '#ffe9a8', glowColor: '#ff9d2e' },
  synthTheme: 'gold',
  defaults: { title: 'ASTROWORLD', bpm: 150 },
};

export default manifest;
