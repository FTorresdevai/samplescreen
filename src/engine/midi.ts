import { Midi } from '@tonejs/midi';
import { MidiNote, ParsedMidi, VisualizerSettings } from '../types';

export async function parseMidiFile(fileOrBuffer: File | ArrayBuffer): Promise<ParsedMidi> {
  const buffer = fileOrBuffer instanceof File 
    ? await fileOrBuffer.arrayBuffer() 
    : fileOrBuffer;

  const midi = new Midi(buffer);
  const notes: MidiNote[] = [];

  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      notes.push({
        name: note.name,
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
      });
    });
  });

  // Sort notes chronologically
  notes.sort((a, b) => a.time - b.time);

  // Determine BPM
  const bpm = midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : 80;
  
  // Calculate total duration
  let duration = midi.duration;
  if (duration <= 0 && notes.length > 0) {
    const lastNote = notes[notes.length - 1];
    duration = lastNote.time + lastNote.duration;
  }
  if (duration <= 0) duration = 16; // fallback 16s

  // Total bars based on BPM (4 beats per bar, quantized)
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4;
  const totalBars = Math.max(1, Math.round(duration / secondsPerBar));
  const barQuantizedDuration = totalBars * secondsPerBar;

  // Key detection heuristic
  const detectedKey = detectKeyFromNotes(notes);

  return {
    duration: barQuantizedDuration,
    bpm,
    key: detectedKey || 'C MIN',
    notes,
    totalBars,
  };
}

/**
 * Heuristic key detection based on pitch class histogram
 */
function detectKeyFromNotes(notes: MidiNote[]): string {
  if (notes.length === 0) return 'C MIN';
  
  const pitchCounts = new Array(12).fill(0);
  notes.forEach(n => {
    const pc = n.midi % 12;
    pitchCounts[pc] += n.duration * (n.velocity || 0.8);
  });

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  let maxIdx = 0; // C
  let maxCount = -1;
  for (let i = 0; i < 12; i++) {
    if (pitchCounts[i] > maxCount) {
      maxCount = pitchCounts[i];
      maxIdx = i;
    }
  }

  const minorThird = pitchCounts[(maxIdx + 3) % 12];
  const majorThird = pitchCounts[(maxIdx + 4) % 12];
  const mode = minorThird >= majorThird ? 'MIN' : 'MAJ';

  return `${noteNames[maxIdx]} ${mode}`;
}

/**
 * Creates an authentic 8-bar or 16-bar emotional progression in C Minor at 80 BPM.
 */
export function createDemoMidi(totalBars: number = 16): ParsedMidi {
  const bpm = 80;
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; // 3.0s per bar
  const duration = totalBars * secondsPerBar;

  const notes: MidiNote[] = [];

  const addNote = (name: string, midi: number, bar: number, beat: number, durBeats: number, vel = 0.85) => {
    const time = (bar * 4 + beat) * secondsPerBeat;
    const dur = durBeats * secondsPerBeat * 0.95;
    notes.push({ name, midi, time, duration: dur, velocity: vel });
  };

  // Progression: Cm7 -> Abmaj7 -> Ebmaj7 -> Bb (Repeats / modulates in 16 bars)
  const chordCycle = [
    { root: 48, notes: [{ n: 'C2', m: 36 }, { n: 'G2', m: 43 }, { n: 'C3', m: 48 }, { n: 'D#3', m: 51 }, { n: 'G3', m: 55 }, { n: 'A#3', m: 58 }] }, // Cm7
    { root: 44, notes: [{ n: 'G#1', m: 32 }, { n: 'D#2', m: 39 }, { n: 'G#2', m: 44 }, { n: 'C3', m: 48 }, { n: 'D#3', m: 51 }, { n: 'G3', m: 55 }] }, // Abmaj7
    { root: 51, notes: [{ n: 'D#2', m: 39 }, { n: 'A#2', m: 46 }, { n: 'D#3', m: 51 }, { n: 'G3', m: 55 }, { n: 'A#3', m: 58 }, { n: 'D4', m: 62 }] },  // Ebmaj7
    { root: 46, notes: [{ n: 'A#1', m: 34 }, { n: 'F2', m: 41 }, { n: 'A#2', m: 46 }, { n: 'D3', m: 50 }, { n: 'F3', m: 53 }, { n: 'G#3', m: 56 }] },  // Bb7
  ];

  for (let bar = 0; bar < totalBars; bar += 2) {
    const chord = chordCycle[(bar / 2) % chordCycle.length];
    chord.notes.forEach(noteObj => {
      addNote(noteObj.n, noteObj.m, bar, 0, 3.8, 0.78);
      addNote(noteObj.n, noteObj.m, bar + 1, 0, 3.8, 0.72);
    });
  }

  // Melodic motifs spanning 16 bars
  const melodyMotifs = [
    // Bars 0-3 (Section A)
    { n: 'G4', m: 67, bar: 0, beat: 0, dur: 1.5, vel: 0.95 },
    { n: 'D#4', m: 63, bar: 0, beat: 2, dur: 1.0, vel: 0.88 },
    { n: 'F4', m: 65, bar: 0, beat: 3, dur: 1.0, vel: 0.90 },
    { n: 'G4', m: 67, bar: 1, beat: 0, dur: 2.0, vel: 0.95 },
    { n: 'A#4', m: 70, bar: 1, beat: 2.5, dur: 1.5, vel: 0.92 },
    { n: 'G#4', m: 68, bar: 2, beat: 0, dur: 2.0, vel: 0.92 },
    { n: 'G4', m: 67, bar: 2, beat: 2, dur: 1.0, vel: 0.85 },
    { n: 'D#4', m: 63, bar: 2, beat: 3, dur: 1.0, vel: 0.88 },
    { n: 'C4', m: 60, bar: 3, beat: 0, dur: 3.5, vel: 0.90 },

    // Bars 4-7 (Section A2)
    { n: 'G4', m: 67, bar: 4, beat: 0, dur: 1.5, vel: 0.92 },
    { n: 'A#4', m: 70, bar: 4, beat: 1.5, dur: 1.5, vel: 0.95 },
    { n: 'D5', m: 74, bar: 4, beat: 3, dur: 1.0, vel: 0.98 },
    { n: 'C5', m: 72, bar: 5, beat: 0, dur: 2.5, vel: 0.95 },
    { n: 'A#4', m: 70, bar: 5, beat: 2.5, dur: 1.5, vel: 0.88 },
    { n: 'F4', m: 65, bar: 6, beat: 0, dur: 2.0, vel: 0.90 },
    { n: 'G4', m: 67, bar: 6, beat: 2, dur: 2.0, vel: 0.88 },
    { n: 'D#4', m: 63, bar: 7, beat: 0, dur: 1.5, vel: 0.85 },
    { n: 'D4', m: 62, bar: 7, beat: 1.5, dur: 1.5, vel: 0.82 },
    { n: 'C4', m: 60, bar: 7, beat: 3, dur: 1.0, vel: 0.90 },
  ];

  // If 16 bars, duplicate with octave transposition for high-energy drop
  melodyMotifs.forEach(m => {
    addNote(m.n, m.m, m.bar, m.beat, m.dur, m.vel);
    if (totalBars >= 16) {
      addNote(m.n, m.m + 12, m.bar + 8, m.beat, m.dur, m.vel * 1.05);
    }
  });

  notes.sort((a, b) => a.time - b.time);

  return {
    duration,
    bpm,
    key: 'C MIN',
    notes,
    totalBars,
  };
}

/**
 * Creates an atmospheric intro progression (1 to 8 bars)
 * that builds tension and resolves right into the main groove drop.
 */
export function createDemoIntroMidi(introBars: number = 4, bpm: number = 80): ParsedMidi {
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4;
  const duration = introBars * secondsPerBar;
  const notes: MidiNote[] = [];

  const addNote = (name: string, midi: number, bar: number, beat: number, durBeats: number, vel = 0.72) => {
    const time = (bar * 4 + beat) * secondsPerBeat;
    const dur = durBeats * secondsPerBeat * 0.98;
    notes.push({ name, midi, time, duration: dur, velocity: vel });
  };

  // Warm Rhodes/Pad Intro Chords: Abmaj9 -> Fm9 -> Bb7sus4 -> G7(b9)
  const introChords = [
    { name: 'Abmaj9', notes: [{ n: 'G#1', m: 32 }, { n: 'D#2', m: 39 }, { n: 'C3', m: 48 }, { n: 'D#3', m: 51 }, { n: 'G3', m: 55 }, { n: 'A#3', m: 58 }] },
    { name: 'Fm9',    notes: [{ n: 'F1', m: 29 },  { n: 'C2', m: 36 },  { n: 'G#2', m: 44 }, { n: 'C3', m: 48 }, { n: 'D#3', m: 51 }, { n: 'G3', m: 55 }] },
    { name: 'Bb7',    notes: [{ n: 'A#1', m: 34 }, { n: 'F2', m: 41 },  { n: 'G#2', m: 44 }, { n: 'D3', m: 50 }, { n: 'F3', m: 53 },  { n: 'C4', m: 60 }] },
    { name: 'G7b9',   notes: [{ n: 'G1', m: 31 },  { n: 'D2', m: 38 },  { n: 'F2', m: 41 },  { n: 'B2', m: 47 }, { n: 'D#3', m: 51 }, { n: 'G#3', m: 56 }] },
  ];

  for (let bar = 0; bar < introBars; bar++) {
    const chord = introChords[bar % introChords.length];
    chord.notes.forEach(no => {
      // Sustained ambient chords with subtle velocity swells
      const vel = 0.65 + (bar / introBars) * 0.25;
      addNote(no.n, no.m, bar, 0, 3.9, vel);
    });

    // Opening chime/sparkle on the final bar before drop
    if (bar === introBars - 1) {
      addNote('G4', 67, bar, 2.0, 0.9, 0.9);
      addNote('A#4', 70, bar, 2.5, 0.9, 0.92);
      addNote('D5', 74, bar, 3.0, 1.0, 0.98);
    }
  }

  notes.sort((a, b) => a.time - b.time);

  return {
    duration,
    bpm,
    key: 'C MIN (INTRO)',
    notes,
    totalBars: introBars,
  };
}

export interface TimelineTiming {
  bpm: number;
  secondsPerBeat: number;
  secondsPerBar: number;
  hasIntro: boolean;
  introBars: number;
  introDuration: number;
  mainBars: number;
  mainLoopDuration: number;
  totalDuration: number;
}

export function getTimelineTiming(
  mainMidi: ParsedMidi,
  introMidi: ParsedMidi | null,
  settings: VisualizerSettings
): TimelineTiming {
  const bpm = settings.bpm || mainMidi.bpm || 80;
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4;

  const hasIntro = settings.enableIntro === true && !!introMidi;
  const introBars = hasIntro ? (settings.introBars || 1) : 0;
  const introDuration = introBars * secondsPerBar;

  const mainBars = settings.loopBars || mainMidi.totalBars || 8;
  const mainLoopDuration = mainBars * secondsPerBar;
  const totalDuration = introDuration + mainLoopDuration;

  return {
    bpm,
    secondsPerBeat,
    secondsPerBar,
    hasIntro,
    introBars,
    introDuration,
    mainBars,
    mainLoopDuration,
    totalDuration,
  };
}

export function buildUnifiedTimelineMidi(
  mainMidi: ParsedMidi,
  introMidi: ParsedMidi | null,
  settings: VisualizerSettings
): {
  unifiedMidi: ParsedMidi;
  timing: TimelineTiming;
} {
  const timing = getTimelineTiming(mainMidi, introMidi, settings);
  const { bpm, secondsPerBar, hasIntro, introBars, introDuration, mainBars, mainLoopDuration, totalDuration } = timing;

  if (!hasIntro || !introMidi || introDuration <= 0) {
    return {
      unifiedMidi: {
        ...mainMidi,
        bpm,
        duration: mainLoopDuration,
        totalBars: mainBars,
      },
      timing,
    };
  }

  // Check whether mainMidi notes start at 0 (exported as clip/pattern)
  // or already start at/near introDuration (exported from DAW arrangement timeline)
  const firstMainTime = mainMidi.notes.length > 0
    ? Math.min(...mainMidi.notes.map(n => n.time))
    : 0;

  // If first main note is already placed near introDuration (within 0.5s), it was exported from timeline
  const isAlreadyTimelineOffset = Math.abs(firstMainTime - introDuration) < 0.5;

  const unifiedNotes: MidiNote[] = [];

  // 1. Add Intro Notes (strictly clamped to [0, introDuration) so it drops cleanly on the beat)
  introMidi.notes.forEach(n => {
    if (n.time < introDuration) {
      const clampedDuration = Math.min(n.duration, Math.max(0.08, introDuration - n.time));
      unifiedNotes.push({
        ...n,
        time: n.time,
        duration: clampedDuration,
      });
    }
  });

  // 2. Add Main Notes starting precisely at introDuration
  mainMidi.notes.forEach(n => {
    const rawOffset = isAlreadyTimelineOffset ? (n.time - firstMainTime) : n.time;
    const noteStart = introDuration + rawOffset;
    unifiedNotes.push({
      ...n,
      time: noteStart,
      duration: n.duration,
    });
  });

  unifiedNotes.sort((a, b) => a.time - b.time);

  return {
    unifiedMidi: {
      bpm,
      duration: totalDuration,
      key: mainMidi.key || introMidi.key || 'CMIN',
      notes: unifiedNotes,
      totalBars: introBars + mainBars,
    },
    timing,
  };
}
