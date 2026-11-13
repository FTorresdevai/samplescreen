# SampleScreen 🎛️⚡
### High-Impact Audio & MIDI Vertical Video Visualizer (1080×1920 @ 60 FPS)

> Drop a sample and its MIDI, pick a look, export a vertical video for Reels, TikTok and Shorts. Free, and everything runs in the browser.

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

```bash
npm install
npm run dev        # http://localhost:3000
```

The site has two pages:

| Page | File | What it is |
|---|---|---|
| Landing | `index.html` | Short static page: what the tool does, live previews of every look, FAQ. Free, no account. |
| App | `app.html` | The visualizer. Drop a WAV/MP3 and a MIDI file, pick a look, export. |

Deep links into the app:

```text
/app.html?model=take-care          open a mode by id (folder name under src/modes/)
/app.html?model=linear&palette=atelier-paper
/app.html?model=tz-lado-mau&view=waveform    album in its Audio view
/app.html?trim=1                   open the trim editor
```

Old links of the form `/?model=<id>` are redirected from the landing page to the app.

Commands:

```bash
npx tsc --noEmit   # type check
npm test           # unit tests (esbuild + node --test)
npm run build      # tsc + vite build → dist/index.html and dist/app.html
```

---

## 🛠️ Architecture & Tech Stack

- **Core**: Vite 6 (two-page build) + React 19 + TypeScript + Tailwind CSS 3. The landing page is plain HTML/CSS/TS, without React.
- **Audio**: Web Audio API (`AnalyserNode`, bass / mid / treble / RMS, offline analysis for export).
- **MIDI**: `@tonejs/midi`.
- **Canvas**: 1080×1920 internal resolution, deterministic frame clock.
- **Export**: WebCodecs (`VideoEncoder` + `AudioEncoder`) with `mp4-muxer` → H.264 MP4 at 60 fps with AAC audio (Opus on Firefox). Browsers without WebCodecs fall back to a real-time `MediaRecorder` capture, which may produce WebM. Everything runs in the browser; nothing is uploaded.

```text
src/
  App.tsx                  app state and wiring
  tokens.css               colour tokens, shared by the app and the landing page
  components/              Header, Dropzone, CanvasPreview, PlaybackControls, ExportModal
    sidebar/               01 Look · 02 Time · 03 Export
    trim/                  trim editor (waveform, ruler, overview)
  core/                    pure logic with tests: trim, timeline, mode resolution, defaults
  engine/                  renderer, exporter, audio, midi, chords, palettes, module loader
  hardware/                consoles drawn in slot 1 (lazy-loaded)
  modes/
    registry.ts            discovers every folder below; no manual registration
    standalone/<id>/       linear, circular, orbital-moon, aureola
    albums/<id>/           take-care, tz-lado-mau, astroworld, pnd-two
    albums/_shell/         layout, keyboard, waterfall and drawing helpers shared by albums
  landing/                 landing page styles, card builder and live previews
  shared/                  canvas utilities, image cache
tests/                     unit tests
```

### Design system

One theme, Dark Studio (walnut), with a single accent, amber `#e69d45`. The tokens are CSS variables in `src/tokens.css`, exposed to Tailwind in `tailwind.config.js` (`bg-surface-1`, `text-muted`, `border-line`, `bg-accent`…). Use the tokens; do not add raw Tailwind palette colours (`amber-*`, `zinc-*`) or hex values to components. All user-facing text is in English.

---

## 📐 Canvas Layout: Two Slots

```text
┌────────────────────────────────────────────────────────────────────────┐
│  HEADER (y: 0 to 195)                                                  │
│  Title · BPM · Key · Signature · Bar counter                           │
├────────────────────────────────────────────────────────────────────────┤
│  SLOT 1: HARDWARE CONSOLE                                              │
│  x = 60, y = 195, width = 960, height = 570                            │
│  loaded through src/hardware/registry.ts                               │
├────────────────────────────────────────────────────────────────────────┤
│  gap: y = 765 to 795                                                   │
├────────────────────────────────────────────────────────────────────────┤
│  SLOT 2: MODE CARD                                                     │
│  x = 60, y = 795, width = 960, height = 670                            │
│  loaded through src/modes/registry.ts                                  │
├────────────────────────────────────────────────────────────────────────┤
│  BOTTOM (y: 1465 to 1920)                                              │
│  Active notes · Chord · Bar dashes · Watermark                         │
└────────────────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **Never** add mode-specific or hardware-specific branches to `src/engine/renderer.ts`, `src/engine/exporter.ts` or `src/engine/audio.ts`. A mode lives in its own folder under `src/modes/`, a console in its own file under `src/hardware/`, and each draws only inside its slot.

### Modes: two kinds

| Kind | Medium | Colours |
|---|---|---|
| `standalone` | One medium, declared by `input` in the manifest: `'midi'` (linear, circular, orbital-moon) or `'audio'` (aureola). | The user's palette: Walnut, Paper, Receipt or Riso (`src/engine/palettes.ts`). |
| `album` | Two views, switched in the sidebar: **MIDI** (falling notes and keys) and **Audio** (full-stage waveform; the console becomes the tape machine). Without a MIDI file only the Audio view is available. | The palette in the album's manifest. |

Light palettes (Paper, Receipt, Riso) follow extra rules: no radial glow, no `shadowBlur`, round line caps, and all text uses `settings.inkColor`. Use `isLightTone(settings)` from `engine/palettes.ts` and never hardcode white or near-black for text and strokes in a standalone mode.

---

## ✂️ Trim Editor

Open **Trim** in the sidebar (section 02 Time) once an audio file is loaded. A panel docks above the transport:

- Bar ruler, beat grid when zoomed in, playhead.
- Drag the handles to resize, drag inside to move, drag outside to draw a new selection.
- 4 / 8 / 16 bar presets. The start snaps to the bar or the beat; the length is always whole bars (`(60 / BPM) * 4` seconds each).
- Changing the BPM re-fits the selection to the new grid.
- Zoom with the buttons, a pinch or Ctrl + scroll; the overview strip pans.
- Undo, redo and Reset. Audio and MIDI are cut together and the original is kept.

The maths is in `src/core/trim.ts` and is covered by `tests/trim.test.ts`.

---

## 👩‍💻 How to Add a Mode

A mode is a folder with two files. The registry finds it by itself; nothing else needs editing.

```bash
mkdir src/modes/standalone/my-mode      # or src/modes/albums/my-album
```

**`manifest.ts`** (small, loaded up front; the `id` must equal the folder name):

```typescript
import { ModeManifest } from '../../../types';

const manifest: ModeManifest = {
  id: 'my-mode',
  name: 'My Mode',
  kind: 'standalone',            // or 'album'
  input: 'midi',                 // or 'audio'
  description: 'One line shown in the sidebar and on the landing page.',
  // Albums only:
  // palette: { notesColor, circleColor, bgColor, accentColor, glowColor, inkColor? },
  // synthTheme: 'gold',                       // console skin, default 'crimson'
  // defaults: { title: 'MY ALBUM', bpm: 90 }, // applied on first load via ?model=
  // Optional for any mode:
  // hardware: 'tape-machine',                 // force a console
};

export default manifest;
```

**`index.ts`** (loaded on demand as its own chunk):

```typescript
import { ModelDrawContext, ModeModule } from '../../../types';
import { DEFAULT_INK, hexToRgbaStr, isLightTone } from '../../../engine/palettes';

function draw(ctx: CanvasRenderingContext2D, context: ModelDrawContext) {
  const { region, loopTime, duration, midi, activeNotes, analysis, settings } = context;
  const { x, y, width: w, height: h } = region;
  const light = isLightTone(settings);
  const ink = settings.inkColor || DEFAULT_INK;

  ctx.save();
  ctx.strokeStyle = hexToRgbaStr(ink, 0.25);
  ctx.strokeRect(x, y, w, h);
  // ... draw inside (x, y, w, h) only; skip shadowBlur when `light`
  ctx.restore();
}

export default { draw } satisfies ModeModule;
```

For an album, read `context.albumView` (`'midi'` or `'waveform'`) and reuse the helpers in `src/modes/albums/_shell/`:

| File | What it gives you |
|---|---|
| `layout.ts` | `computeAlbumLayout`: room on top, waterfall, keyboard |
| `keyboard.ts` | `computeKeyboardGeometry`: key positions for the MIDI's pitch range |
| `waterfall.ts` | `visibleNotes` (loop-aware), `albumEnergy` (tempo + level, 0 to 1), `optionalCover`, `hash01` |
| `draw.ts` | `noteRect`, `drawAlbumKeys` (themable keys), `scopePoints`, `strokeSmooth` |

`pnd-two` and `astroworld` are short examples built on these helpers. An album's images go in its own `assets/` folder; a file named `cover.jpg` (or `.png` / `.webp`) is picked up by `optionalCover`.

The new mode then shows up in the sidebar and on the landing page, with a live preview, and opens at `/app.html?model=my-mode`.

---

## 🎛️ How to Add a Hardware Console

Consoles draw in slot 1 (`x = 60, y = 195, width = 960, height = 570`).

1. Create `src/hardware/my-synth.ts` and export a draw function that stays inside the region it is given. `drawPianoKeyboard` from `keyboard-engine.ts` draws the keys.
2. Register it in `src/hardware/registry.ts`, in both tables:

```typescript
export const HARDWARE_LOADERS: Record<string, () => Promise<HardwareModule>> = {
  // ...
  'my-synth': () => import('./my-synth').then(m => ({
    draw: (ctx, { region: r, currentTime, midi, activeNotes, analysis, settings, theme }) =>
      m.drawMySynth(ctx, r.x, r.y, r.width, r.height, currentTime, midi, activeNotes, analysis, settings, theme),
  })),
};

export const SYNTHS_MANIFEST: SynthManifest[] = [
  // ...
  { id: 'my-synth', name: 'My Synth', tag: 'ANALOG', description: 'One line about it.' },
];
```

A mode can force it with `hardware: 'my-synth'` in its manifest; otherwise the default console is the ST 909, and albums in the Audio view use the tape machine.

---

## 🔒 Rules of Code Isolation & Assets

1. **Shared code comes from shared places**: `src/shared/` (canvas utilities, image cache), `src/engine/chords.ts` (`formatNoteName`, `detectChord`), `src/engine/palettes.ts`, `src/hardware/keyboard-engine.ts`, and `src/modes/albums/_shell/` for albums. Never import from another mode's folder or another console's file.
2. **Images**: an album's images live in `src/modes/albums/<id>/assets/`; images used by hardware live in `public/images/`. Load them through `getCachedImage` (`src/shared/assets.ts`), never with `new Image()` inside a draw function.
3. **Frame cost**: no `shadowBlur` or gradient creation inside per-note or per-particle loops; draw a wider, fainter shape for a halo instead. Use deterministic values (`hash01`) rather than `Math.random()` so the preview and the export match.
4. **Layout**: do not change the canvas size or the slot heights. Stay inside `region`.

---

## 🛡️ GitHub Repository Security Setup (For Francisco / Admin)

To enforce this protection policy on the GitHub web interface:

1. Go to **Repository Settings** -> **Branches**.
2. Click **Add branch ruleset** or **Add branch protection rule**.
3. Set **Branch name pattern** to `main`.
4. Enable the following protections:
   - ✅ **Require a pull request before merging** (Require 1 approval).
   - ✅ **Require status checks to pass before merging** (Search and select the `Type Check, Test & Build` check from our GitHub Actions workflow).
   - ✅ **Require branches to be up to date before merging**.
   - ✅ **Require conversation resolution before merging**.
   - ✅ **Do not allow bypassing the above settings** (or restrict bypass to Repository Admin only).
5. Click **Create** / **Save Changes**.

---

## 🧪 Verification & Testing

Before opening a pull request:

```bash
npx tsc --noEmit
npm test
npm run build
npm run dev        # then check your mode at /app.html?model=<id>, and the landing page at /
```

For a standalone mode, check all four palettes (`&palette=studio-walnut`, `atelier-paper`, `thermal-receipt`, `risograph`). For an album, check both views. Export once in Chrome and look at the `[SampleScreen] Export timing` line in the console.
