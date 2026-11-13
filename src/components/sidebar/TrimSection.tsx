import React, { useState } from 'react';
import { VisualizerSettings } from '../../types';
import { audioManager } from '../../engine/audio';
import { secondsPerBar } from '../../core/trim';
import { Toggle } from '../ui';
import { TrimWaveform } from './TrimWaveform';

interface TrimSectionProps {
  settings: VisualizerSettings;
  rawAudioDuration?: number;   // changes when a new file loads → re-reads the raw buffer
  onTrimAudio?: (startBar: number, numBars: number) => void;
  onResetAudioTrim?: () => void;
}

/** One toggle, one waveform with draggable handles, one reset. */
export const TrimSection: React.FC<TrimSectionProps> = ({ settings, rawAudioDuration, onTrimAudio, onResetAudioTrim }) => {
  const [open, setOpen] = useState(settings.isAudioTrimmed === true);
  const rawBuffer = rawAudioDuration ? audioManager.getRawBuffer() : null;

  return (
    <div className="space-y-2">
      <Toggle checked={open} onChange={setOpen} label="Trim" />

      {open && (
        <>
          <TrimWaveform
            buffer={rawBuffer}
            bpm={settings.bpm || 80}
            startBar={settings.isAudioTrimmed ? settings.audioTrimStartBar || 1 : 1}
            bars={settings.isAudioTrimmed ? settings.audioTrimBars || 1 : Math.max(1, Math.floor((rawBuffer?.duration ?? 0) / secondsPerBar(settings.bpm)))}
            accentColor="#e69d45"
            onCommit={(start, bars) => onTrimAudio?.(start, bars)}
          />
          {settings.isAudioTrimmed && (
            <button
              type="button"
              onClick={() => onResetAudioTrim?.()}
              className="text-[11px] text-muted hover:text-text underline underline-offset-2"
            >
              Reset trim
            </button>
          )}
        </>
      )}
    </div>
  );
};
