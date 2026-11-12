# SampleScreen 🎛️⚡
### High-Impact Audio & MIDI Vertical Video Visualizer (1080×1920 @ 60 FPS)

> A production-grade, highly optimized client-side competitor to loopvisualizer.app tailored for Instagram Reels, TikTok, and YouTube Shorts.

---

## 🔒 Repository Governance & Protection Policy

> [!IMPORTANT]
> **STRICT MAIN BRANCH LOCKDOWN:**
> The `main` branch represents production. Direct pushes to `main` are strictly prohibited.
> **Only the repository owner ([@FTorresdevai](https://github.com/FTorresdevai) / Francisco) has authority to approve and merge Pull Requests into `main`.**
> Any pull request that modifies shared core files outside isolated slots or fails the automated CI build will be automatically rejected.

### Contribution Flow (How to Submit Work):
1. **Never commit directly to `main`**: All work must happen on a feature or fix branch.
   ```bash
   git checkout -b feature/my-new-screen
   # or
   git checkout -b fix/audio-latency
   ```
2. **Verify your build locally**: Ensure TypeScript and Vite pass with zero warnings or errors:
   ```bash
   npm run build
   ```
3. **Open a Pull Request against `main`**:
   - Fill out the PR template completely.
   - Attach screenshot or video proof of your screen/fix running at native 1080×1920 @ 60 FPS.
   - Link the relevant GitHub Issue (`Closes #<issue_number>`).
4. **Automated CI Validation**: GitHub Actions will automatically compile TypeScript and run `npm run build` on your PR.
5. **Francisco's Review & Merge**: Once approved by Francisco, your PR is squashed and merged into `main`.

---

## 📋 Issues, Proof-of-Bug Reporting & Ideas Dashboard

We use GitHub Issues and the GitHub Project Dashboard to organize all work, track bug fixes with hard proof, and curate new screen ideas.

### 1. Reporting Bugs (With Mandatory Evidence)
To prevent phantom issues and guarantee rapid resolution, **all bug reports require direct visual proof**:
- **Open a Bug Report** using the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- **Mandatory Attachments**:
  - Drag-and-drop a **screenshot** or **screen recording (`.mp4` / `.mov`)** showing the exact visual bug, export freeze, or UI misalignment.
  - Paste any red error stack traces from the browser console (`F12` or `Cmd + Option + I` -> **Console** tab).
- **Provide Environment Specs**: Browser (Chrome/Safari/Firefox), OS (macOS/Windows), and whether you used a custom WAV/MP3 or MIDI file.
- *Issues submitted without proof or reproduction steps will be closed immediately.*

### 2. Proposing New Screens & Visual Models
Have an idea for a new artist album theme (e.g. Travis Scott, Pink Floyd, Daft Punk) or a classic hardware synth (e.g. Moog, Roland Juno, Prophet)?
- **Open a Screen Proposal** using the [Screen Idea Template](.github/ISSUE_TEMPLATE/screen_idea.md).
- Include visual moodboard images, reference album art, target colors, and audio-reactivity behavior (bass bloom, spectrum rays, waterfall styling).

### 3. Project Kanban Workflow & Completion
All tasks move through the project board:
```text
[Backlog / Ideas] ──> [In Progress] ──> [In Review (PR Open)] ──> [Done (Merged by Francisco)]
```
- **Claiming an Issue:** Comment on the issue requesting assignment before starting work.
- **Marking as Complete:** In your PR description, include `Closes #<id>` (e.g. `Closes #14`). When Francisco approves and merges your PR, the linked issue is automatically closed and moved to **Done**.

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
```text
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
- **In-Browser Beat Trimmer**: Mathematical bar-based sample slicing with BPM synchronization (`(60 / BPM) * 4` seconds per bar) allowing producers to crop and loop audio directly in the browser without opening a DAW.

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
│  Active Playing Notes · Chord Detection · Bar Dashes · Watermark       │
└────────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **The Golden Rule for Visual Model & Hardware Contributors:**
> **NEVER** hardcode model-specific visual elements or conditional branching inside `src/engine/renderer.ts`, `src/engine/exporter.ts`, or `src/engine/audio.ts`. All visual models and hardware synthesizers must live isolated inside `src/models/` or `src/hardware/`, conform to their designated bounding box slot, and be registered via their respective registry.

---

## ✂️ In-Browser Beat Trimmer (BPM Snapped)

When producers upload a full beat or sample, they do not need to open FL Studio, Ableton, or Logic to crop it. The site features a built-in mathematical bar trimmer:
- **BPM-Snapped Calculations**: Slices audio precisely to bar boundaries based on `(60 / BPM) * 4`.
- **Start Bar Selection**: Pick the starting bar (Bar 1, 5, 9, 13, 17, 25, 33...) via range slider or numeric stepper.
- **Loop Length Presets**: Select 4, 8, 12, or 16 bars.
- **Slice Preview**: Displays exact time range (`00:16.0 → 00:32.0 (16.0s)`).
- **Instant Non-Destructive Slicing**: Slices the memory buffer, updates playback timeline, loops, and exports at 60 FPS with zero re-rendering delays. Original audio is preserved for one-click resets.

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
import { drawMirroredSpectrumBars } from '../../shared/waveform-engine';
import { formatNoteName } from '../../engine/chords';

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
      // Draw reactive particles, rings, or visual elements here
    });

    // Optional: Draw note name tags if settings.noteNameTags !== false
    if (settings.noteNameTags !== false && activeNotes.length > 0) {
      activeNotes.forEach(note => {
        const name = formatNoteName(note.midi, settings.accidental, settings.middleC);
        // Render note badge...
      });
    }
  }

  ctx.restore();
}
```

### Step 3: Register in `src/models/registry.ts`
Add entries to `src/models/registry.ts`:

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
🎉 **Done!** The Customization Sidebar will automatically display your new model with zero changes required to any other files.

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
   - `src/hardware/keyboard-engine.ts` – Standard piano keyboard layout calculations.
   - `src/engine/chords.ts` – Standard note formatting (`formatNoteName`) and chord detection (`detectChord`).
   - **Never import internal helper functions directly from another model's directory or another synth's file.**

2. **Asset Caching Rule (60 FPS Performance)**:
   - Place all images (`.jpg`, `.png`, `.webp`) in `public/assets/`.
   - Always load images **outside the canvas render loop** (memoized / lazy-loaded once).
   - Never call `new Image()` inside a function called on every animation frame, as this will trigger severe garbage-collection stuttering.

3. **No Dynamic Layout Mutations**:
   - Do not adjust global variables, canvas dimensions (`1080×1920`), or the heights of adjacent slots.
   - Always stay strictly within `region.x`, `region.y`, `region.width`, and `region.height`.

---

## 🛡️ GitHub Repository Security Setup (For Francisco / Admin)

To enforce this protection policy on the GitHub web interface:

1. Go to **Repository Settings** -> **Branches**.
2. Click **Add branch ruleset** or **Add branch protection rule**.
3. Set **Branch name pattern** to `main`.
4. Enable the following protections:
   - ✅ **Require a pull request before merging** (Require 1 approval).
   - ✅ **Require status checks to pass before merging** (Search and select the `Type Check & Production Build` check from our GitHub Actions workflow).
   - ✅ **Require branches to be up to date before merging**.
   - ✅ **Require conversation resolution before merging**.
   - ✅ **Do not allow bypassing the above settings** (or restrict bypass to Repository Admin only).
5. Click **Create** / **Save Changes**.

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
