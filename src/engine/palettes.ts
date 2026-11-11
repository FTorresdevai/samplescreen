import { ColorPalette } from '../types';

export const PALETTES: ColorPalette[] = [
  {
    id: 'ultra-bright-white',
    name: '☀ Ultra-Bright Studio (Pure White & Wood)',
    notesColor: '#ef4444',
    circleColor: '#94a3b8',
    bgColor: '#ffffff',
    accentColor: '#f59e0b',
    glowColor: '#fed7aa',
  },
  {
    id: 'aureola-chroma',
    name: 'Auréola • Sunset Prism Glow',
    notesColor: '#f43f5e',
    circleColor: '#3b1c4e',
    bgColor: '#170f24',
    accentColor: '#fde047',
    glowColor: '#ec4899',
  },
  {
    id: 'studio-wood-cream',
    name: 'Studio Cream & Wood (LoopVisualizer)',
    notesColor: '#e11d48',
    circleColor: '#d6cbbe',
    bgColor: '#f5efe6',
    accentColor: '#d97706',
    glowColor: '#eadcc9',
  },
  {
    id: 'radiant-solar-gold',
    name: 'Radiant Solar Amber',
    notesColor: '#fbbf24',
    circleColor: '#3d2516',
    bgColor: '#1c130d',
    accentColor: '#fef08a',
    glowColor: '#f59e0b',
  },
  {
    id: 'take-care-gold',
    name: 'Drake "Take Care" Baroque Gold',
    notesColor: '#eab308',
    circleColor: '#382014',
    bgColor: '#150d09',
    accentColor: '#fde047',
    glowColor: '#b45309',
  },
  {
    id: 'tz-lado-mau',
    name: 'Tz da Coronel "Lado Mau" (Inferno & Charcoal)',
    notesColor: '#ff5500',
    circleColor: '#2b1206',
    bgColor: '#080402',
    accentColor: '#ff8800',
    glowColor: '#ff3b00',
  },
  {
    id: 'orbital-cosmos',
    name: 'Orbital Moon • Celestial Aurora',
    notesColor: '#e0e7ff',
    circleColor: '#25254a',
    bgColor: '#0f1026',
    accentColor: '#818cf8',
    glowColor: '#6366f1',
  },
  {
    id: 'analog-gold',
    name: 'Analogue Vacuum Gold',
    notesColor: '#f59e0b',
    circleColor: '#2b231c',
    bgColor: '#161310',
    accentColor: '#fde047',
    glowColor: '#f59e0b',
  },
  {
    id: 'sunset-terracotta',
    name: 'Sunset Terracotta',
    notesColor: '#f97316',
    circleColor: '#2e1e17',
    bgColor: '#17100d',
    accentColor: '#fdba74',
    glowColor: '#f97316',
  },
  {
    id: 'nordic-sage',
    name: 'Nordic Studio Sage',
    notesColor: '#10b981',
    circleColor: '#1c2e24',
    bgColor: '#0e1713',
    accentColor: '#6ee7b7',
    glowColor: '#10b981',
  },
  {
    id: 'imperial-plum',
    name: 'Imperial Plum & Amethyst',
    notesColor: '#c084fc',
    circleColor: '#291b3b',
    bgColor: '#140c1e',
    accentColor: '#f0abfc',
    glowColor: '#a855f7',
  },
  {
    id: 'crimson-heritage',
    name: 'Crimson Velvet Heritage',
    notesColor: '#ef4444',
    circleColor: '#33181d',
    bgColor: '#180c10',
    accentColor: '#fca5a5',
    glowColor: '#ef4444',
  },
  {
    id: 'minimal-bone',
    name: 'Architectural Bone Ivory',
    notesColor: '#fafaf9',
    circleColor: '#3d3835',
    bgColor: '#1a1715',
    accentColor: '#f59e0b',
    glowColor: '#fafaf9',
  },
  {
    id: 'minimal-paper',
    name: 'Editorial Minimal Paper',
    notesColor: '#18181b',
    circleColor: '#a1a1aa',
    bgColor: '#f4f3ef',
    accentColor: '#ef4444',
    glowColor: '#e4e2dd',
  }
];

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
