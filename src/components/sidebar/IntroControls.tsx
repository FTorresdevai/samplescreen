import React from 'react';
import { VisualizerSettings } from '../../types';
import { Label, Segmented, Toggle } from '../ui';

interface IntroControlsProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  introMidiFileName?: string | null;
  onIntroMidiSelected?: (file: File) => void;
  onLoadDemoIntro?: () => void;
}

type IntroBars = VisualizerSettings['introBars'];
const INTRO_BARS: IntroBars[] = [1, 2, 3, 4, 6, 8];

/** Optional intro (1–8 bars) with its own MIDI file, played before the main loop. */
export const IntroControls: React.FC<IntroControlsProps> = ({ settings, onUpdate, introMidiFileName, onIntroMidiSelected, onLoadDemoIntro }) => (
  <div className="space-y-2">
    <Toggle
      label="Intro before the loop"
      checked={settings.enableIntro === true}
      onChange={(enableIntro) => onUpdate({ enableIntro })}
    />

    {settings.enableIntro && (
      <div className="space-y-2 pl-3 border-l border-line-strong">
        <div>
          <Label>Intro length <span className="font-mono text-[10px] uppercase">bars</span></Label>
          <Segmented<IntroBars>
            label="Intro length in bars"
            mono
            value={settings.introBars}
            onChange={(introBars) => onUpdate({ introBars })}
            options={INTRO_BARS.map((n) => ({ value: n, label: String(n) }))}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Intro MIDI file</Label>
            {onLoadDemoIntro && (
              <button
                type="button"
                onClick={onLoadDemoIntro}
                className="mb-1 text-[11px] text-muted hover:text-text underline underline-offset-2"
              >
                Use demo intro
              </button>
            )}
          </div>
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-well border border-line hover:bg-surface-2 cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <span className="text-xs font-mono text-text truncate">{introMidiFileName || 'No file'}</span>
            <span className="text-[11px] text-muted shrink-0">Browse</span>
            <input
              type="file"
              accept=".mid,.midi"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onIntroMidiSelected) onIntroMidiSelected(file);
              }}
            />
          </label>
          <p className="mt-1 text-[11px] text-subtle leading-snug">
            Plays {settings.introBars} {settings.introBars === 1 ? 'bar' : 'bars'} from this file before the main loop.
          </p>
        </div>
      </div>
    )}
  </div>
);
