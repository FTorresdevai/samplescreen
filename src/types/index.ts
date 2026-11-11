export interface MidiNote {
  name: string;      // e.g. "C4", "A#4"
  midi: number;      // 0 - 127
  time: number;      // start time in seconds
  duration: number;  // duration in seconds
  velocity: number;  // 0 - 1
}

export interface ParsedMidi {
  duration: number;
  bpm: number;
  key?: string;
  notes: MidiNote[];
  totalBars: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  notesColor: string;
  circleColor: string;
  bgColor: string;
  accentColor: string;
  glowColor: string;
}

export type ActiveVisualModel =
  | 'linear'
  | 'circular'
  | 'take-care'
  | 'tz-lado-mau'
  | 'orbital-moon'
  | 'aureola';

export interface VisualizerSettings {
  // Direct Text Editing
  title: string;
  bpm: number;
  key: string;
  producerHandle: string;
  watermark: string;

  // Fully Granular Color Customization
  notesColor: string;       // Color of MIDI notes and active keys
  circleColor: string;      // Color of circular sequencer rings / vinyl grooves
  bgColor: string;          // Background color
  accentColor: string;      // Playhead needle and center orb
  glowColor: string;        // Ambient bloom and backlight
  backgroundGlow: boolean;  // Toggle audio-reactive ambient glow

  // Universal Mode Switch: Piano Roll (with MIDI) vs Waveform View (Pure Audio)
  waveformMode: boolean;    // true = Soundwave / Oscilloscope / Spectrum (no piano); false = Piano Roll / Waterfall (with MIDI)

  // Layout & Style Features
  showObiStrip: boolean;     // Authentic Japanese / Studio vertical label strip
  showSynthConsole: boolean; // Top sleek keyboard & hardware console
  synthModel?: string;       // Active synthesizer hardware model ('st909', etc.)
  showCenterOrb: boolean;    // Center audio reactor orb
  showChord: boolean;            // Show active note names & chord at the bottom of the screen (below visualizer)
  showChordBelowPiano: boolean;  // Show chord information directly below the piano keyboard
  chordDisplayLocation?: 'bottom' | 'top' | 'both' | 'hidden'; // Unified chord location selector
  showChordSymbol: boolean;      // Show detected chord symbol (e.g. Cm7)
  showMidiNotesInRoll?: boolean; // Show/hide MIDI note blocks in linear roll (clean playhead mode)
  isLightStudioMode?: boolean;   // Ultra-bright high-contrast studio mode
  showSafeZoneGuides: boolean; // Instagram Reels / TikTok overlay
  showPreviewHud?: boolean;    // Show/hide on-screen HUD buttons over preview (clean view)
  fitReelsSafeZone: boolean;

  // Active Visual Model Theme
  centerVisualizerMode: ActiveVisualModel;
  loopBars: number;
  motionMode: 'rotating-wheel' | 'continuous' | 'page';
  drawNotesOnRings: boolean;
  noteNameTags: boolean;     // Note name tags next to the cursor/playhead (e.g. C5, D4, F3, A#2)
  showProgressDashes: boolean; // Show bar progress dashes below notes
  audioVisualizerMode: 'piano-roll' | 'radial-waveform' | 'spectrum-grooves';

  // Harmony Settings
  accidental: 'sharp' | 'flat';
  middleC: 3 | 4 | 5;

  // Intro Sequence Feature (1 - 8 Bars with distinct Intro MIDI)
  enableIntro: boolean;
  introBars: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  // Audio Dynamics & Glow
  audioSensitivity: number; // 0.5 - 2.5
  glowIntensity: number;    // 0.2 - 2.5

  // Audio Trim / Beat Slicing Feature (Direct in-browser bar trimmer)
  audioTrimStartBar?: number; // Starting bar (1-based, e.g. Bar 1, 5, 9)
  audioTrimBars?: number;     // Number of bars to loop (e.g. 4, 8, 16)
  isAudioTrimmed?: boolean;

  // Export Tools
  exportLoops: 1 | 2 | 4;
}

export interface AudioAnalysis {
  fft: Uint8Array;
  waveform: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  rms: number;
}

export interface TimingInfo {
  hasIntro?: boolean;
  isIntro: boolean;
  introBar: number;
  totalIntroBars: number;
  introDuration?: number;
  mainLoopDuration?: number;
}

export interface ModelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
}

export interface ModelDrawContext {
  ctx: CanvasRenderingContext2D;
  region: ModelRegion;
  currentTime: number;
  loopTime: number;
  duration: number;
  midi: ParsedMidi;
  activeNotes: MidiNote[];
  analysis: AudioAnalysis;
  settings: VisualizerSettings;
  introInfo?: TimingInfo;
  isWaveformMode: boolean;
}

export interface VisualModelManifest {
  id: ActiveVisualModel;
  name: string;
  category: 'album' | 'daw' | 'creative';
  description: string;
  tag: string;
  hasCustomTheme?: boolean;
  author?: string;
}

export interface SynthRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SynthDrawContext {
  region: SynthRegion;
  currentTime: number;
  midi: ParsedMidi;
  activeNotes: MidiNote[];
  analysis: AudioAnalysis;
  settings: VisualizerSettings;
  colorTheme?: 'crimson' | 'gold';
}

export interface SynthManifest {
  id: string;
  name: string;
  tag: string;
  description: string;
  author?: string;
}

