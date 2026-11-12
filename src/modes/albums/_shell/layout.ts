import { AlbumView, ModelRegion } from '../../../types';

/** Vertical zones shared by every album: room/art on top, stage (+ keyboard in MIDI view) below. */
export interface AlbumLayout {
  isWaveform: boolean;
  roomH: number;
  rollAreaH: number;
  keyboardH: number;   // 0 in waveform view: the waveform gets the full stage
  waterfallH: number;
  waterfallY: number;
  pianoY: number;
}

export function computeAlbumLayout(region: ModelRegion, view: AlbumView): AlbumLayout {
  const { y, height: h } = region;
  const isWaveform = view === 'waveform';
  const roomH = Math.round(h * 0.42);
  const rollAreaH = h - roomH;
  const keyboardH = isWaveform ? 0 : Math.round(Math.min(105, rollAreaH * 0.32));
  const waterfallH = rollAreaH - keyboardH - 8;
  const waterfallY = y + roomH;
  const pianoY = waterfallY + waterfallH;
  return { isWaveform, roomH, rollAreaH, keyboardH, waterfallH, waterfallY, pianoY };
}
