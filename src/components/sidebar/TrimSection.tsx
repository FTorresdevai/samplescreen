import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { VisualizerSettings } from '../../types';
import { audioManager } from '../../engine/audio';
import { secondsPerBar } from '../../core/trim';
import { TrimWaveform } from './TrimWaveform';

interface TrimSectionProps {
  settings: VisualizerSettings;
  rawAudioDuration?: number;   // changes when a new file loads → re-reads the raw buffer
  onTrimAudio?: (startBar: number, numBars: number) => void;
  onResetAudioTrim?: () => void;
}

/** One toggle, one waveform with draggable handles, one reset. */
export const TrimSection: React.FC<TrimSectionProps> = ({ settings, rawAudioDuration, onTrimAudio, onResetAudioTrim }) => {
  const [open, setOpen] = useState(settings.isAudioTrimmed);
  const rawBuffer = rawAudioDuration ? audioManager.getRawBuffer() : null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400 hover:text-white transition"
        >
          <Scissors className="w-3.5 h-3.5" />
          Trim
          <span className={`ml-1 inline-block w-6 h-3.5 rounded-full relative transition ${open ? 'bg-amber-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${open ? 'left-3' : 'left-0.5'}`} />
          </span>
        </button>
        {open && settings.isAudioTrimmed && (
          <button
            type="button"
            onClick={() => onResetAudioTrim?.()}
            className="text-[10px] font-mono text-zinc-400 hover:text-white underline-offset-2 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {open && (
        <TrimWaveform
          buffer={rawBuffer}
          bpm={settings.bpm || 80}
          startBar={settings.isAudioTrimmed ? settings.audioTrimStartBar || 1 : 1}
          bars={settings.isAudioTrimmed ? settings.audioTrimBars || 1 : Math.max(1, Math.floor((rawBuffer?.duration ?? 0) / secondsPerBar(settings.bpm)))}
          accentColor={settings.accentColor || '#e69d45'}
          onCommit={(start, bars) => onTrimAudio?.(start, bars)}
        />
      )}
    </section>
  );
};
