import { ModelRegion, ParsedMidi } from '../../../types';

/** Keyboard range and key positions fitted to the MIDI notes (min. 4 octaves, C1–C8). */
export interface KeyboardGeometry {
  startKey: number;
  endKey: number;
  whiteKeys: number[];
  blackKeys: number[];
  isWhiteKey: (pitch: number) => boolean;
  kbdX: number;
  kbdW: number;
  whiteW: number;
  getKeyX: (pitch: number) => number;   // key centre (white) or left edge of the gap (black)
}

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];

export function computeKeyboardGeometry(midi: ParsedMidi, region: ModelRegion): KeyboardGeometry {
  const { x, width: w } = region;
  const allNotes = midi.notes || [];
  let minPitch = 36;
  let maxPitch = 84;
  if (allNotes.length > 0) {
    minPitch = Math.min(...allNotes.map(n => n.midi));
    maxPitch = Math.max(...allNotes.map(n => n.midi));
  }
  const lowestOctave = Math.max(1, Math.min(3, Math.floor(minPitch / 12)));
  const highestOctave = Math.min(7, Math.max(lowestOctave + 3, Math.ceil(maxPitch / 12)));
  const startKey = lowestOctave * 12;
  const endKey = Math.min(108, highestOctave * 12 + 11);

  const isWhiteKey = (p: number) => WHITE_PITCH_CLASSES.includes(((p % 12) + 12) % 12);
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let p = startKey; p <= endKey; p++) {
    if (isWhiteKey(p)) whiteKeys.push(p);
    else blackKeys.push(p);
  }
  const numWhite = Math.max(14, whiteKeys.length);
  const kbdX = x + 18;
  const kbdW = w - 36;
  const whiteW = kbdW / numWhite;

  const getKeyX = (pitch: number) => {
    if (isWhiteKey(pitch)) {
      return kbdX + whiteKeys.indexOf(pitch) * whiteW + whiteW / 2;
    }
    const prevWIdx = whiteKeys.indexOf(pitch - 1);
    return prevWIdx !== -1 ? kbdX + (prevWIdx + 1) * whiteW : kbdX + whiteW / 2;
  };

  return { startKey, endKey, whiteKeys, blackKeys, isWhiteKey, kbdX, kbdW, whiteW, getKeyX };
}
