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
  inkColor: string;         // text drawn on bgColor
  tone: 'dark' | 'light';
}

export type SynthTheme = 'crimson' | 'gold' | 'brass' | 'matte';
export type AlbumView = 'midi' | 'waveform';

export type ChordDisplay = 'bottom' | 'piano' | 'off'; // 'piano' = under album keyboard

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
  inkColor: string;         // Header / footer text; must read on bgColor
  paletteId: string;        // Standalone palette (engine/palettes.ts); albums use their manifest palette
  backgroundGlow: boolean;  // Toggle audio-reactive ambient glow

  // Universal Mode Switch: Piano Roll (with MIDI) vs Waveform View (Pure Audio)
  albumView: AlbumView;     // album modes only: MIDI waterfall + keys, or full-stage audio waveform

  // Layout & Style Features
  synthModel?: string;       // Active synthesizer hardware model ('st909', etc.)
  chordDisplay: ChordDisplay;    // Where active notes/chord are shown
  showChordSymbol: boolean;      // Show detected chord symbol (e.g. Cm7)
  showSafeZoneGuides: boolean; // Instagram Reels / TikTok overlay
  showPreviewHud?: boolean;    // Show/hide on-screen HUD buttons over preview (clean view)
  fitReelsSafeZone: boolean;

  // Active Visual Model Theme
  modeId: string;            // id of a folder under src/modes/{standalone,albums}/
  loopBars: number;
  noteNameTags: boolean;     // Note name tags next to the cursor/playhead (e.g. C5, D4, F3, A#2)
  showProgressDashes: boolean; // Show bar progress dashes below notes

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
  loopTime?: number;
  loopProgress?: number;
  duration?: number;
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
  albumView: AlbumView;     // resolved view (no MIDI → 'waveform'); read only by album modes
}

/** Default export of src/modes/<kind>/<id>/manifest.ts (loaded eagerly). */
export interface ModeManifest {
  id: string;                  // must equal the folder name
  name: string;
  kind: 'standalone' | 'album';
  input: 'midi' | 'audio';
  description: string;
  hardware?: string;           // forces this hardware id (ignores settings.synthModel)
  fullFrame?: boolean;         // standalone: no console; the mode fills header → notes row
  waveformHardware?: string;   // albums: hardware in 'waveform' view (default 'tape-machine')
  palette?: Pick<VisualizerSettings, 'notesColor' | 'circleColor' | 'bgColor' | 'accentColor' | 'glowColor'> & { inkColor?: string }; // albums only
  synthTheme?: SynthTheme;     // default 'crimson'
  defaults?: Partial<Pick<VisualizerSettings, 'title' | 'bpm' | 'key' | 'synthModel'>>; // applied on first load only
}

export type ModelDrawFn = (ctx: CanvasRenderingContext2D, context: ModelDrawContext) => void;

/** Default export of src/modes/<kind>/<id>/index.ts (loaded lazily). */
export interface ModeModule {
  draw: ModelDrawFn;
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
  theme: SynthTheme;
}

export interface HardwareModule {
  draw: (ctx: CanvasRenderingContext2D, context: SynthDrawContext) => void;
}

export interface SynthManifest {
  id: string;
  name: string;
  tag: string;
  description: string;
  author?: string;
}

