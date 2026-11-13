import React, { useCallback, useEffect, useState } from 'react';
import { Minus, Plus, Redo2, Undo2, X } from 'lucide-react';
import { VisualizerSettings } from '../../types';
import { audioManager } from '../../engine/audio';
import {
  SnapDivision, TrimSelection, TrimView,
  barsAvailable, fitSelection, formatClock, secondsPerBar, zoomView,
} from '../../core/trim';
import { Kbd, Segmented, inputCls, secondaryBtnCls } from '../ui';
import { TrimWaveform } from './TrimWaveform';
import { TrimOverview } from './TrimOverview';

interface TrimEditorProps {
  settings: VisualizerSettings;
  rawAudioDuration?: number;   // changes when a new file loads → re-reads the raw buffer
  onTrimAudio: (startBar: number, numBars: number, bpm?: number) => void;
  onResetAudioTrim: () => void;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  onClose: () => void;
}

type Step = TrimSelection | null;   // null = untrimmed
const PRESETS = [4, 8, 16];
const iconBtn = `${secondaryBtnCls} !px-1.5`;

/** Wide trim editor docked above the transport: pick the bars that loop, hear them, undo. */
export const TrimEditor: React.FC<TrimEditorProps> = ({ settings, rawAudioDuration, onTrimAudio, onResetAudioTrim, onUpdate, onClose }) => {
  const buffer = rawAudioDuration ? audioManager.getRawBuffer() : null;
  const duration = buffer?.duration ?? 0;
  const bpm = settings.bpm || 80;
  const spb = secondsPerBar(bpm);
  const totalBars = Math.max(1, barsAvailable(1, duration, bpm));
  const trimmed = settings.isAudioTrimmed === true;

  const [division, setDivision] = useState<SnapDivision>(1);
  const [view, setView] = useState<TrimView>({ zoom: 1, offset: 0 });
  const current: Step = trimmed ? { start: settings.audioTrimStartBar || 1, bars: settings.audioTrimBars || 1 } : null;
  const [history, setHistory] = useState<{ steps: Step[]; index: number }>({ steps: [current], index: 0 });

  // A new file starts a fresh history and a full view
  useEffect(() => {
    setHistory({ steps: [current], index: 0 });
    setView({ zoom: 1, offset: 0 });
  }, [buffer]);

  const selection: TrimSelection = current ?? { start: 1, bars: totalBars };

  const apply = (step: Step, withBpm?: number) => {
    if (step) onTrimAudio(step.start, step.bars, withBpm);
    else onResetAudioTrim();
  };
  const commit = (step: Step) => {
    setHistory((h) => ({ steps: [...h.steps.slice(0, h.index + 1), step], index: h.index + 1 }));
    apply(step);
  };
  const travel = (delta: -1 | 1) => {
    const index = history.index + delta;
    if (index < 0 || index >= history.steps.length) return;
    setHistory({ ...history, index });
    apply(history.steps[index]);
  };

  const setLength = (bars: number) => commit(fitSelection({ start: selection.start, bars }, duration, bpm, division));

  const setBpm = (value: number) => {
    const next = Math.max(20, Math.min(400, Math.round(value) || bpm));
    if (next === bpm) return;
    // The grid moves with the tempo: keep the same bars, refitted to the new grid
    if (current) apply(fitSelection(current, duration, next, division), next);
    else onUpdate({ bpm: next });
  };

  // Position in the raw file. The intro plays other audio first, so the playhead is hidden with it.
  const startSec = trimmed ? (selection.start - 1) * spb : 0;
  const introOn = settings.enableIntro === true;
  const playheadSec = useCallback(
    () => (introOn ? null : startSec + audioManager.getCurrentTime()),
    [introOn, startSec]
  );

  const zoom = (factor: number) => setView((v) => zoomView(v, factor, v.offset + duration / v.zoom / 2, duration));
  const t0 = (selection.start - 1) * spb;
  const firstBar = Number.isInteger(selection.start) ? String(selection.start) : selection.start.toFixed(2);
  const lastBar = Number.isInteger(selection.start) ? String(selection.start + selection.bars - 1) : (selection.start + selection.bars).toFixed(2);

  return (
    <section className="shrink-0 bg-surface-1 border-t border-line px-4 py-3 space-y-2 select-none" aria-label="Trim editor">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-sm font-medium text-text">Trim</h2>
        <span className="rounded bg-well border border-line px-2 py-1 font-mono text-[11px] text-text">
          {buffer
            ? `${Number.isInteger(selection.start) ? 'Bars' : 'From'} ${firstBar}–${lastBar} · ${formatClock(t0)}–${formatClock(t0 + selection.bars * spb)}`
            : 'No audio'}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Length</span>
          <div className="w-36">
            <Segmented<number>
              label="Loop length in bars"
              mono
              disabled={!buffer}
              value={trimmed ? selection.bars : -1}
              onChange={setLength}
              options={PRESETS.filter((n) => n <= totalBars || n === PRESETS[0]).map((n) => ({ value: n, label: String(n), title: `${n} bars from the current start` }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Snap</span>
          <div className="w-28">
            <Segmented<SnapDivision>
              label="Snap the start to"
              value={division}
              onChange={setDivision}
              options={[
                { value: 1, label: 'Bar', title: 'The selection starts on a bar line' },
                { value: 4, label: 'Beat', title: 'The selection can start on any beat; the length stays in whole bars' },
              ]}
            />
          </div>
        </div>

        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-muted">bpm</span>
          <input
            type="number"
            min={20}
            max={400}
            value={settings.bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className={`${inputCls} !w-16 !py-1.5 font-mono`}
            title="Sets the bar grid. Change it if the bar lines do not sit on the downbeats."
          />
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={iconBtn} onClick={() => zoom(0.5)} disabled={!buffer || view.zoom <= 1} title="Zoom out" aria-label="Zoom out"><Minus className="w-3.5 h-3.5" /></button>
          <span className="w-9 text-center font-mono text-[10px] text-muted">{view.zoom < 10 ? view.zoom.toFixed(1) : Math.round(view.zoom)}×</span>
          <button type="button" className={iconBtn} onClick={() => zoom(2)} disabled={!buffer} title="Zoom in" aria-label="Zoom in"><Plus className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-line mx-1" />
          <button type="button" className={iconBtn} onClick={() => travel(-1)} disabled={history.index === 0} title="Undo" aria-label="Undo"><Undo2 className="w-3.5 h-3.5" /></button>
          <button type="button" className={iconBtn} onClick={() => travel(1)} disabled={history.index >= history.steps.length - 1} title="Redo" aria-label="Redo"><Redo2 className="w-3.5 h-3.5" /></button>
          <button type="button" className={secondaryBtnCls} onClick={() => commit(null)} disabled={!trimmed}>Reset</button>
          <button type="button" className={iconBtn} onClick={onClose} title="Close the trim editor" aria-label="Close the trim editor"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <TrimWaveform
        buffer={buffer}
        bpm={bpm}
        selection={selection}
        division={division}
        view={view}
        onViewChange={setView}
        onCommit={commit}
        playheadSec={playheadSec}
      />
      <TrimOverview buffer={buffer} bpm={bpm} selection={selection} view={view} onViewChange={setView} />

      <p className="text-[11px] text-subtle">
        Drag a handle to change the length, drag inside to move, drag outside to draw a new loop. <Kbd>Space</Kbd> plays the selection in a loop.
        Pinch or <Kbd>Ctrl</Kbd> + scroll zooms.
      </p>
    </section>
  );
};
