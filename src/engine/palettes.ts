import { ColorPalette, VisualizerSettings } from '../types';

/** Standalone-mode palettes (design-system-review.md §5). Albums keep the palette in their manifest. */
export const PALETTES: ColorPalette[] = [
  { id: 'studio-walnut', name: 'Walnut', tone: 'dark', bgColor: '#141113', notesColor: '#e69d45', accentColor: '#ecdcb9', circleColor: '#4a3f43', glowColor: '#e69d45', inkColor: '#f3eddf' },
  { id: 'atelier-paper', name: 'Paper', tone: 'light', bgColor: '#f4f2ec', notesColor: '#245847', accentColor: '#a94f2d', circleColor: '#b9bfb5', glowColor: '#245847', inkColor: '#202a26' },
  { id: 'thermal-receipt', name: 'Receipt', tone: 'light', bgColor: '#ebe8df', notesColor: '#18181b', accentColor: '#b91c1c', circleColor: '#d1cdc2', glowColor: '#18181b', inkColor: '#18181b' },
  { id: 'risograph', name: 'Riso', tone: 'light', bgColor: '#eae4d5', notesColor: '#234e40', accentColor: '#d9532f', circleColor: '#b5ad9b', glowColor: '#234e40', inkColor: '#234e40' },
];

export const DEFAULT_PALETTE_ID = 'studio-walnut';
export const DEFAULT_INK = '#f3eddf';

type PaletteSettings = Pick<VisualizerSettings, 'paletteId' | 'notesColor' | 'accentColor' | 'circleColor' | 'glowColor' | 'bgColor' | 'inkColor'>;

/** Settings patch for a standalone palette; unknown id → the default palette. */
export function paletteSettings(id: string | undefined): PaletteSettings {
  const p = PALETTES.find(x => x.id === id) ?? PALETTES[0];
  return { paletteId: p.id, notesColor: p.notesColor, accentColor: p.accentColor, circleColor: p.circleColor, glowColor: p.glowColor, bgColor: p.bgColor, inkColor: p.inkColor };
}

/** Light backgrounds get no glow and no shadowBlur (review §5). Derived from bgColor so custom colours work too. */
export function isLightTone(settings: Pick<VisualizerSettings, 'bgColor'>): boolean {
  const { r, g, b } = hexToRgb(settings.bgColor || '#141113');
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/** `hex` multiplied toward black: 1 = unchanged, 0 = black. */
export function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function hexToRgbaStr(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
