# SampleScreen 🎛️⚡
### High-Impact Audio & MIDI Vertical Video Visualizer (1080×1920 @ 60 FPS)

> A production-grade, optimized client-side competitor to loopvisualizer.app tailored for Instagram Reels, TikTok, and YouTube Shorts.

---

## 🚀 Quick Start

The development server runs at:
```bash
npm run dev
# Open http://localhost:3000
```

To build for production:
```bash
npm run build
```

To access the **Developer Mockups Lab**:
```
http://localhost:3000/#mockups
# or deep-link to any model:
http://localhost:3000/?model=take-care
http://localhost:3000/?model=tz-lado-mau&waveform=true
```

---

## 🛠️ Architecture & Tech Stack

- **Core**: Vite + React 19 + TypeScript + Tailwind CSS
- **Audio Processing**: Web Audio API (`AudioContext`, `AnalyserNode` with 2048 FFT, Bass/Mid/Treble extraction, RMS calculation, and offline channel analysis)
- **MIDI Engine**: `@tonejs/midi` (note extraction, pitch mapping, automatic BPM and Key signature detection)
- **Visual Engine**: HTML5 Canvas running at native internal **1080×1920 resolution** with a deterministic frame-by-frame render clock
- **Export Engine**: Client-side browser export using **WebCodecs API** (`VideoEncoder` + `AudioEncoder`) with **mp4-muxer** (producing zero-frame-drop 1080×1920 @ 60 FPS MP4 with synchronized AAC audio) and universal `MediaRecorder` fallback. Zero server or cloud rendering costs.

---

## 📐 Canvas Coordinate Architecture & The Two Protected Slots

The Canvas runs at internal native **1080×1920 resolution** (9:16 vertical video ratio). To guarantee that multiple developers and AI agents can build without breaking each other's work or overlapping pixels, the canvas is split into strict, immutable vertical zones:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR (y: 0 to 195)                                              │
│  Track Title · BPM · Key · Producer Handle · Loop Bar Counter          │
├────────────────────────────────────────────────────────────────────────┤
│  🎛️ SLOT 1: HARDWARE SYNTHESIZER CONSOLE                              │
│  Bounding Box: x = 60, y = 195, width = 960, height = 570              │
│  • Dispatched dynamically via `src/hardware/registry.ts`               │
│  • Primary flagship: ST 909 Triple VCO Console (Crimson or Real Gold) │
├────────────────────────────────────────────────────────────────────────┤
│  [ Fixed Separation Gap: y = 765 to 795 (30px) ]                       │
├────────────────────────────────────────────────────────────────────────┤
│  🎨 SLOT 2: ACTIVE VISUAL MODEL CARD                                   │
│  Bounding Box: x = 60, y = 795, width = 960, height = 670              │
│  • Dispatched dynamically via `src/models/registry.ts`                 │
│  • Supports Dual Mode: MIDI Piano Roll vs Pure Audio Waveform          │
├────────────────────────────────────────────────────────────────────────┤
│  BOTTOM BAR & TELEMETRY (y: 1465 to 1920)                              │
│  Active Playing Notes · Chord Detection · Watermark                    │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **The Golden Rule for Collaborators:**
> Never modify coordinates or add conditional branching in `src/engine/renderer.ts`, `src/engine/exporter.ts`, or `src/engine/audio.ts`. All new contributions must live isolated inside their own folder/file and conform to their designated bounding box slot.

---

## 👩‍💻 Developer Guide: How to Create a New Visual Model (in 3 Steps)

Visual models render inside **Slot 2** (`x = 60, y = 795, width = 960, height = 670`).

### Step 1: Create your isolated model directory
Create a new folder in `src/models/<your-model-name>/`:
```bash
mkdir src/models/my-new-visual/
touch src/models/my-new-visual/index.ts
```

### Step 2: Implement the `ModelDrawFn` contract
In `src/models/my-new-visual/index.ts`, export your drawing function matching `ModelDrawFn`:

```typescript
import { ModelDrawContext } from '../../types';
import { roundRect } from '../../shared/canvas-utils';
import { drawMirroredSpectrumBars, drawOscilloscopeBeam } from '../../shared/waveform-engine';

export function drawMyNewVisualModel(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, currentTime, duration, midi, activeNotes, analysis, settings, isWaveformMode } = context;
  const { x, y, width: w, height: h, centerX, centerY } = region;

  ctx.save();

  // 1. Draw your container / glass box inside the given region (x, y, w, h)
  ctx.fillStyle = 'rgba(10, 12, 16, 0.85)';
  roundRect(ctx, x, y, w, h, 16, true, false);

  if (isWaveformMode) {
    // -------------------------------------------------------------
    // Pure Audio / Waveform View (When user has no MIDI file loaded)
    // -------------------------------------------------------------
    drawMirroredSpectrumBars(
      ctx,
      x + 24,
      centerY,
      w - 48,
      h * 0.4,
      analysis.fft,
      48,
      3,
      settings.accentColor || '#f59e0b',
      settings.notesColor || '#eab308'
    );
  } else {
    // -------------------------------------------------------------
    // MIDI / Piano Roll View (When MIDI notes exist)
    // -------------------------------------------------------------
    activeNotes.forEach(note => {
      // Draw your reactive particles, notes, or visual elements here
    });
  }

  ctx.restore();
}
```

### Step 3: Register in `src/models/registry.ts`
Add 2 entries to `src/models/registry.ts`:

```typescript
// 1. Import your function
import { drawMyNewVisualModel } from './my-new-visual';

// 2. Add to MODEL_REGISTRY
export const MODEL_REGISTRY: Record<string, ModelDrawFn> = {
  // ... existing models
  'my-new-visual': drawMyNewVisualModel,
};

// 3. Add to VISUAL_MODELS_MANIFEST
export const VISUAL_MODELS_MANIFEST: VisualModelManifest[] = [
  // ... existing manifests
  {
    id: 'my-new-visual',
    name: 'My New Visual',
    category: 'creative',
    description: 'High-impact reactive visualizer with dual waveform support.',
    tag: 'NEW RELEASE',
  },
];
```
🎉 **Done!** The Customization Sidebar and the `#mockups` lab will automatically display your new model with zero changes required to any other files.

---

## 🎛️ Developer Guide: How to Create a New Hardware Synthesizer (in 3 Steps)

Hardware synthesizers render inside **Slot 1** (`x = 60, y = 195, width = 960, height = 570`).

### Step 1: Create your isolated synth file
Create a new file in `src/hardware/`:
```bash
touch src/hardware/my-custom-synth.ts
```

### Step 2: Implement your drawing function
In `src/hardware/my-custom-synth.ts`, implement your hardware faceplate and keyboard inside the specified bounding box:

```typescript
import { SynthDrawContext } from '../types';
import { roundRect } from '../shared/canvas-utils';
import { drawPianoKeyboard } from './keyboard-engine';

export function drawMyCustomSynth(ctx: CanvasRenderingContext2D, context: SynthDrawContext) {
  const { region, currentTime, midi, activeNotes, analysis, settings } = context;
  const { x, y, width: w, height: h } = region;

  ctx.save();

  // 1. Synth Outer Chassis (Beveled Wood / Metal cheeks)
  ctx.fillStyle = '#1e1b18';
  roundRect(ctx, x, y, w, h, 8, true, true);

  // 2. Faceplate Modules (Oscillators, Knobs, CRT Scope)
  // ... Draw your hardware knobs, LED segment displays, etc.

  // 3. Built-in Piano Keyboard (Bottom of the console)
  const keyH = 150;
  const keyY = y + h - keyH - 12;
  drawPianoKeyboard(ctx, x + 24, keyY, w - 48, keyH, activeNotes, {
    skin: 'modern-synth',
    activeColor: settings.notesColor || '#f59e0b',
  });

  ctx.restore();
}
```

### Step 3: Register in `src/hardware/registry.ts`
Register your synthesizer in `src/hardware/registry.ts`:

```typescript
import { drawMyCustomSynth } from './my-custom-synth';

// 1. Add to SYNTH_REGISTRY
export const SYNTH_REGISTRY: Record<string, SynthDrawFn> = {
  // ... existing synths
  'my-custom-synth': drawMyCustomSynth,
};

// 2. Add to SYNTHS_MANIFEST
export const SYNTHS_MANIFEST: SynthManifest[] = [
  // ... existing manifests
  {
    id: 'my-custom-synth',
    name: 'Moog Modular 2026',
    tag: 'ANALOG PRO',
    description: 'Custom vintage chassis with glowing vu-meters and 25-key keyboard.',
  },
];
```
🎉 **Done!** You can test it by passing `synthModel: 'my-custom-synth'` or viewing it in the Developer Mockups Lab.

---

## 🔒 Rules of Code Isolation & Asset Management

To maintain a clean codebase where multiple contributors and agents work concurrently:

1. **Shared Primitives Only from `src/shared/`**:
   - `src/shared/canvas-utils.ts` – Pure canvas geometry (e.g., `roundRect`).
   - `src/shared/waveform-engine.ts` – Standard audio visualization beams, spectrum bars, and scopes.
   - `src/hardware/keyboard-engine.ts` – Standard 3-octave / 2-octave piano keyboard layout calculations.
   - **Never import internal helper functions directly from another model's directory or another synth's file.**

2. **Asset Caching Rule (60 FPS Performance)**:
   - Place all images (`.jpg`, `.png`, `.webp`) in `public/assets/`.
   - Always load images **outside the canvas render loop** (memoized / lazy-loaded once).
   - Never call `new Image()` inside a function called on every animation frame, as this will trigger severe garbage-collection stuttering.

3. **No Dynamic Layout Mutations**:
   - Do not adjust global variables, canvas dimensions (`1080×1920`), or the heights of adjacent slots.
   - Always stay strictly within `region.x`, `region.y`, `region.width`, and `region.height`.

---

## 🧪 Verification & Testing

Always verify your changes before submitting:
```bash
# 1. Check TypeScript and Vite build
npm run build

# 2. Test in the browser
npm run dev

# 3. Open the Secret Mockups Lab to verify your model card
http://localhost:3000/#mockups
```
