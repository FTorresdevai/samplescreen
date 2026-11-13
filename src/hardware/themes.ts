import { SynthTheme } from '../types';

/**
 * Colour sets for the album consoles (ST 909 + tape machine).
 * 4-stop gradients run top→bottom (face) or outside→inside (cheeks; the right cheek is mirrored).
 */
export interface ConsoleTheme {
  cheek: [string, string, string, string];
  cheekGrain: string;           // fine vertical lines on the cheeks
  screw: [string, string, string];
  face: [string, string, string, string];
  faceBrush: string;            // horizontal brushed lines
  bevel: string;                // top edge highlight
  badge: string;
  badgeLine: string;
  displayLine: string;
  displayText: string;
  selFill: string;
  selLine: string;
  tabFill: string;
  tabLine: string;
  tabText: string;
  felt: string;                 // strip above the keys
  apron: [string, string, string];
  apronLip: string;
  keyGlow: string;              // active key light
  keyActive: [string, string, string, string];
  keyActiveDeep: string;
  tapeBezel: string;
  tapeGlow: string;
  tapeLabel: string;
}

const GOLD: ConsoleTheme = {
  cheek: ['#19110a', '#322112', '#4a321a', '#23160b'],
  cheekGrain: 'rgba(255, 255, 255, 0.035)',
  screw: ['#fef08a', '#d4af37', '#5a4212'],
  face: ['#4e3b16', '#38290e', '#261b07', '#160e03'],
  faceBrush: 'rgba(254, 240, 138, 0.025)',
  bevel: '#d4af37',
  badge: '#b48a28',
  badgeLine: '#fde047',
  displayLine: '#d4af37',
  displayText: '#fde047',
  selFill: '#b48a28',
  selLine: '#fde047',
  tabFill: '#2d2009',
  tabLine: '#d4af37',
  tabText: '#fde047',
  felt: '#b48a28',
  apron: ['#362413', '#4c3319', '#1e1308'],
  apronLip: 'rgba(254, 240, 138, 0.25)',
  keyGlow: '#f59e0b',
  keyActive: ['#ffffff', '#fef08a', '#fde047', '#eab308'],
  keyActiveDeep: '#b45309',
  tapeBezel: 'rgba(212, 175, 55, 0.45)',
  tapeGlow: 'rgba(245, 158, 11, 0.12)',
  tapeLabel: '#d4af37',
};

const CRIMSON: ConsoleTheme = {
  cheek: ['#1c0a06', '#3e150d', '#5c1f13', '#2c0d08'],
  cheekGrain: 'rgba(255, 255, 255, 0.035)',
  screw: ['#ba9f72', '#7d6745', '#3a2d1d'],
  face: ['#5a161d', '#430f14', '#340a0e', '#220508'],
  faceBrush: 'rgba(255, 255, 255, 0.015)',
  bevel: '#8a2830',
  badge: '#b91c1c',
  badgeLine: '#ef4444',
  displayLine: '#1e293b',
  displayText: '#38bdf8',
  selFill: '#991b1b',
  selLine: '#f87171',
  tabFill: '#351117',
  tabLine: '#ea580c',
  tabText: '#ffaa22',
  felt: '#8b151b',
  apron: ['#3a160c', '#552112', '#200904'],
  apronLip: 'rgba(255, 255, 255, 0.15)',
  keyGlow: '#f59e0b',
  keyActive: ['#ffffff', '#fef08a', '#fde047', '#eab308'],
  keyActiveDeep: '#b45309',
  tapeBezel: 'rgba(239, 68, 68, 0.45)',
  tapeGlow: 'rgba(239, 68, 68, 0.12)',
  tapeLabel: '#ef4444',
};

/** ASTROWORLD: brushed brass, warm fairground bulbs. */
const BRASS: ConsoleTheme = {
  cheek: ['#3a2a10', '#8a6a2c', '#c9a557', '#5a4219'],
  cheekGrain: 'rgba(255, 236, 180, 0.09)',
  screw: ['#fff4cf', '#c9a557', '#4a3610'],
  face: ['#8d6d30', '#6b5022', '#4d3815', '#2e210b'],
  faceBrush: 'rgba(255, 233, 168, 0.06)',
  bevel: '#ffe3a1',
  badge: '#1a1338',
  badgeLine: '#f6c453',
  displayLine: '#c9a557',
  displayText: '#ffb347',
  selFill: '#ff9d2e',
  selLine: '#ffe9a8',
  tabFill: '#2a1d0a',
  tabLine: '#ff9d2e',
  tabText: '#ffe9a8',
  felt: '#5e1a1a',
  apron: ['#7a5c24', '#a8843f', '#3a2a10'],
  apronLip: 'rgba(255, 236, 180, 0.45)',
  keyGlow: '#ff9d2e',
  keyActive: ['#fff7e0', '#ffe9a8', '#f6c453', '#ff9d2e'],
  keyActiveDeep: '#b8570f',
  tapeBezel: 'rgba(201, 165, 87, 0.6)',
  tapeGlow: 'rgba(255, 157, 46, 0.16)',
  tapeLabel: '#f6c453',
};

/** PND TWO: matte satin black, silver legends, a cold night light. */
const MATTE: ConsoleTheme = {
  cheek: ['#050506', '#121315', '#1b1c1f', '#0a0a0c'],
  cheekGrain: 'rgba(255, 255, 255, 0.018)',
  screw: ['#d6d9de', '#6b7078', '#1a1b1e'],
  face: ['#1a1b1e', '#141517', '#0e0f10', '#08080a'],
  faceBrush: 'rgba(255, 255, 255, 0.008)',
  bevel: '#3a3d42',
  badge: '#0b0b0d',
  badgeLine: '#c8ccd2',
  displayLine: '#2a2c30',
  displayText: '#f4f6f8',
  selFill: '#2a2c30',
  selLine: '#f4f6f8',
  tabFill: '#121315',
  tabLine: '#9aa0a8',
  tabText: '#f4f6f8',
  felt: '#1f2024',
  apron: ['#141517', '#1d1e21', '#060607'],
  apronLip: 'rgba(200, 204, 210, 0.18)',
  keyGlow: '#c8d4ff',
  keyActive: ['#ffffff', '#f4f6f8', '#dfe3ea', '#b9c0cc'],
  keyActiveDeep: '#6b7380',
  tapeBezel: 'rgba(200, 204, 210, 0.35)',
  tapeGlow: 'rgba(200, 212, 255, 0.08)',
  tapeLabel: '#c8ccd2',
};

export const CONSOLE_THEMES: Record<SynthTheme, ConsoleTheme> = {
  gold: GOLD,
  crimson: CRIMSON,
  brass: BRASS,
  matte: MATTE,
};

export function consoleTheme(theme: string | undefined): ConsoleTheme {
  return CONSOLE_THEMES[(theme ?? 'crimson') as SynthTheme] ?? CRIMSON;
}
