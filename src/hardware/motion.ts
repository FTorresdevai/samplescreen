import { MidiNote } from '../types';

/**
 * Envelope of the latest note attack: jumps on note-on and decays exponentially.
 * Pure function with no side effects or framework dependencies.
 */
export function noteEnvelope(notes: MidiNote[] | undefined, loopTime: number, decay = 3.5): number {
  if (!notes || notes.length === 0) return 0;
  let best = Infinity;
  for (const n of notes) {
    const age = loopTime - n.time;
    if (age >= 0 && age < best) best = age;
  }
  return best === Infinity ? 0 : Math.exp(-best * decay);
}

/**
 * Audio- and MIDI-reactive knob value for TUNE MOD (ST909 VCO).
 * Clamped 0-1, responds to note attack envelope and mid-range audio pulse.
 */
export function computeTuneModKnob(
  notes: MidiNote[] | undefined,
  loopTime: number,
  analysis: { mid: number; bass: number },
  decay = 3.5
): number {
  if (!notes || notes.length === 0) {
    return Math.max(0, Math.min(1, 0.3 + analysis.bass * 0.6));
  }
  const env = noteEnvelope(notes, loopTime, decay);
  return Math.max(0, Math.min(1, 0.25 + 0.45 * env + 0.3 * analysis.mid));
}

/**
 * Pitch wheel deflection proportional to interval between active note and previous note,
 * sprung back to center as the attack envelope decays.
 */
export function computePitchWheelDeflection(
  notes: MidiNote[] | undefined,
  activeNotes: MidiNote[] | undefined,
  loopTime: number,
  decay = 3.5
): number {
  if (!notes || notes.length === 0) return 0;
  const env = noteEnvelope(notes, loopTime, decay);
  if (env < 0.005) return 0;

  let currentPitch: number | undefined;
  if (activeNotes && activeNotes.length > 0) {
    currentPitch = Math.max(...activeNotes.map(n => n.midi));
  }
  if (currentPitch === undefined) return 0;

  let prevPitch: number | undefined;
  let minDiff = Infinity;
  for (const n of notes) {
    const diff = loopTime - n.time;
    if (diff > 0.02 && diff < minDiff && n.midi !== currentPitch) {
      minDiff = diff;
      prevPitch = n.midi;
    }
  }
  if (prevPitch === undefined) return 0;

  const delta = currentPitch - prevPitch;
  const deflection = Math.sign(delta) * Math.min(1, Math.abs(delta) / 12) * 6;
  return deflection * env;
}
