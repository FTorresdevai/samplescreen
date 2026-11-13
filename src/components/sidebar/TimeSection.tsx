import React from 'react';
import { ParsedMidi, VisualizerSettings } from '../../types';
import { Label, SectionHeader, Segmented, inputCls } from '../ui';
import { TrimSection } from './TrimSection';
import { IntroControls } from './IntroControls';
import { NoteNames } from './NoteNames';

interface TimeSectionProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  midiData?: ParsedMidi | null;
  audioDuration?: number;
  rawAudioDuration?: number;
  introMidiFileName?: string | null;
  onIntroMidiSelected?: (file: File) => void;
  onLoadDemoIntro?: () => void;
  onTrimAudio?: (startBar: number, numBars: number) => void;
  onResetAudioTrim?: () => void;
}

/** 02 Time: trim, tempo, loop length, intro, note names. */
export const TimeSection: React.FC<TimeSectionProps> = ({
  settings,
  onUpdate,
  midiData,
  audioDuration,
  rawAudioDuration,
  introMidiFileName,
  onIntroMidiSelected,
  onLoadDemoIntro,
  onTrimAudio,
  onResetAudioTrim,
}) => {
  // Loop length options: 4 / 8 / 16 plus the lengths detected from the MIDI file and the audio
  const secondsPerBar = (60 / (settings.bpm || 80)) * 4;
  const midiBars = midiData?.totalBars && midiData.totalBars > 0 ? midiData.totalBars : null;
  const audioBars = audioDuration && audioDuration > 0 ? Math.max(1, Math.round(audioDuration / secondsPerBar)) : null;
  const barOptions = Array.from(new Set([4, 8, 16, ...(midiBars ? [midiBars] : []), ...(audioBars ? [audioBars] : [])])).sort((a, b) => a - b);

  return (
    <section className="space-y-4 pt-5 border-t border-line">
      <SectionHeader n="02" title="Time" />

      <TrimSection
        settings={settings}
        rawAudioDuration={rawAudioDuration}
        onTrimAudio={onTrimAudio}
        onResetAudioTrim={onResetAudioTrim}
      />

      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <div>
          <Label htmlFor="sb-bpm">Tempo <span className="font-mono text-[10px] uppercase">bpm</span></Label>
          <input
            id="sb-bpm"
            type="number"
            value={settings.bpm}
            onChange={(e) => onUpdate({ bpm: parseInt(e.target.value) || 80 })}
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label>Loop length <span className="font-mono text-[10px] uppercase">bars</span></Label>
            <span className="font-mono text-[10px] text-muted">{((settings.loopBars || 8) * secondsPerBar).toFixed(1)} s</span>
          </div>
          <Segmented<number>
            label="Loop length in bars"
            mono
            value={settings.loopBars}
            onChange={(loopBars) => onUpdate({ loopBars })}
            options={barOptions.map((bars) => ({
              value: bars,
              label: String(bars),
              hint: bars === midiBars ? 'MIDI' : bars === audioBars ? 'AUDIO' : undefined,
              title: `${bars} bars (${(bars * secondsPerBar).toFixed(1)} s)`,
            }))}
          />
        </div>
      </div>

      <IntroControls
        settings={settings}
        onUpdate={onUpdate}
        introMidiFileName={introMidiFileName}
        onIntroMidiSelected={onIntroMidiSelected}
        onLoadDemoIntro={onLoadDemoIntro}
      />

      <div className="pt-1">
        <div className="text-xs text-text mb-2">Note names</div>
        <NoteNames settings={settings} onUpdate={onUpdate} />
      </div>
    </section>
  );
};
