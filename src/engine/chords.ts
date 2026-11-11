import { MidiNote } from '../types';

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function formatNoteName(midi: number, accidental: 'sharp' | 'flat' = 'sharp', middleCOctave: 3 | 4 | 5 = 4): string {
  const names = accidental === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const pc = midi % 12;
  // Standard MIDI 60 is C4 (when middle C is 4)
  // If middle C is 3, 60 is C3 => octaveOffset = middleCOctave - 4
  const octaveOffset = middleCOctave - 4;
  const octave = Math.floor(midi / 12) - 1 + octaveOffset;
  return `${names[pc]}${octave}`;
}

export interface DetectedChord {
  symbol: string;
  rootName: string;
  notesFormatted: string[];
}

/**
 * Intelligent harmonic chord detector for active polyphonic notes
 */
export function detectChord(
  activeNotes: MidiNote[],
  accidental: 'sharp' | 'flat' = 'sharp',
  middleCOctave: 3 | 4 | 5 = 4
): DetectedChord | null {
  if (activeNotes.length === 0) return null;

  const names = accidental === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  // Format active notes sorted by pitch
  const sorted = [...activeNotes].sort((a, b) => a.midi - b.midi);
  const notesFormatted = sorted.map(n => formatNoteName(n.midi, accidental, middleCOctave));

  if (activeNotes.length === 1) {
    const singleName = formatNoteName(sorted[0].midi, accidental, middleCOctave);
    return {
      symbol: singleName,
      rootName: names[sorted[0].midi % 12],
      notesFormatted,
    };
  }

  // Extract unique pitch classes
  const pitchClasses = Array.from(new Set(sorted.map(n => n.midi % 12)));
  const lowestMidi = sorted[0].midi;
  const bassPc = lowestMidi % 12;

  // Match against known chord definitions
  // Pattern: intervals from candidate root in semitones
  interface ChordDef {
    name: string;
    intervals: number[];
  }

  const chordDefs: ChordDef[] = [
    // Triads
    { name: '', intervals: [0, 4, 7] },         // Major
    { name: 'm', intervals: [0, 3, 7] },        // Minor
    { name: 'dim', intervals: [0, 3, 6] },      // Diminished
    { name: 'aug', intervals: [0, 4, 8] },      // Augmented
    { name: 'sus4', intervals: [0, 5, 7] },     // Sus4
    { name: 'sus2', intervals: [0, 2, 7] },     // Sus2
    // 7ths
    { name: '7', intervals: [0, 4, 7, 10] },    // Dominant 7
    { name: 'maj7', intervals: [0, 4, 7, 11] }, // Major 7
    { name: 'm7', intervals: [0, 3, 7, 10] },   // Minor 7
    { name: 'm(maj7)', intervals: [0, 3, 7, 11] },
    { name: 'm7b5', intervals: [0, 3, 6, 10] }, // Half-diminished
    { name: 'dim7', intervals: [0, 3, 6, 9] },  // Diminished 7
    // Extensions
    { name: 'add9', intervals: [0, 4, 7, 2] },
    { name: '9', intervals: [0, 4, 7, 10, 2] },
    { name: 'maj9', intervals: [0, 4, 7, 11, 2] },
    { name: 'm9', intervals: [0, 3, 7, 10, 2] },
  ];

  // Try each pitch class as candidate root, prioritizing the bass note
  const candidateRoots = [bassPc, ...pitchClasses.filter(pc => pc !== bassPc)];

  for (const root of candidateRoots) {
    const rootName = names[root];
    // Calculate intervals relative to root
    const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

    for (const def of chordDefs) {
      const defSorted = [...def.intervals].sort((a, b) => a - b);
      
      // Check if all def intervals are present in pitch classes
      const allMatch = defSorted.every(int => intervals.includes(int));
      if (allMatch) {
        let symbol = `${rootName}${def.name}`;
        // If bass note is different from root, add slash chord notation
        if (bassPc !== root) {
          symbol += `/${names[bassPc]}`;
        }
        return {
          symbol,
          rootName,
          notesFormatted,
        };
      }
    }
  }

  // Fallback: list notes
  const rootName = names[bassPc];
  return {
    symbol: `${rootName} chord`,
    rootName,
    notesFormatted,
  };
}
