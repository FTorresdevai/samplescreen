import React from 'react';
import { VisualizerSettings } from '../types';
import { Label, inputCls } from './ui';

interface TrackFieldsProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  compact?: boolean; // one row (file loaded) instead of the first-screen stack
}

/** On-screen text shown above the drop zone: title, key, BPM and producer. Writes straight to settings. */
export const TrackFields: React.FC<TrackFieldsProps> = ({ settings, onUpdate, compact }) => (
  <div className={compact ? 'grid grid-cols-2 sm:grid-cols-[2fr_1fr_5rem_1.5fr] gap-2' : 'space-y-2'}>
    <div className={compact ? 'col-span-2 sm:col-span-1' : ''}>
      <Label htmlFor="tf-title">Title</Label>
      <input
        id="tf-title"
        type="text"
        value={settings.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="SAMPLE/BEAT NAME"
        className={`${inputCls} uppercase`}
      />
    </div>
    <div className={compact ? 'contents' : 'grid grid-cols-[1fr_5rem] gap-2'}>
      <div>
        <Label htmlFor="tf-key">Key</Label>
        <input
          id="tf-key"
          type="text"
          value={settings.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          placeholder="KEY"
          className={`${inputCls} font-mono uppercase`}
        />
      </div>
      <div>
        <Label htmlFor="tf-bpm">BPM</Label>
        <input
          id="tf-bpm"
          type="number"
          min={20}
          max={300}
          value={settings.bpm}
          onChange={(e) => onUpdate({ bpm: parseInt(e.target.value) || 80 })}
          className={`${inputCls} font-mono`}
        />
      </div>
    </div>
    <div className={compact ? 'col-span-2 sm:col-span-1' : ''}>
      <Label htmlFor="tf-producer">Producer</Label>
      <input
        id="tf-producer"
        type="text"
        value={settings.producerHandle}
        onChange={(e) => onUpdate({ producerHandle: e.target.value })}
        placeholder="PRODUCER NAME"
        className={`${inputCls} font-mono uppercase`}
      />
    </div>
  </div>
);
