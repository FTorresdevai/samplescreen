import React from 'react';
import { VisualizerSettings } from '../../types';
import { Kbd, SectionHeader, Toggle, inputCls } from '../ui';

interface ExportProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
}

/** 03 Export: framing options and format facts. The Export button itself is pinned (ExportBar). */
export const ExportSection: React.FC<ExportProps> = ({ settings, onUpdate }) => (
  <section className="space-y-3 pt-5 border-t border-line">
    <SectionHeader n="03" title="Export" />

    <div className="space-y-2">
      <Toggle
        label="Fit inside the Reels safe area"
        checked={settings.fitReelsSafeZone === true}
        onChange={(fitReelsSafeZone) => onUpdate({ fitReelsSafeZone })}
      />
      <Toggle
        label="Show safe-area guides"
        checked={settings.showSafeZoneGuides === true}
        onChange={(showSafeZoneGuides) => onUpdate({ showSafeZoneGuides })}
      />
      <Toggle
        label="Show preview toolbar"
        checked={settings.showPreviewHud === true}
        onChange={(showPreviewHud) => onUpdate({ showPreviewHud })}
      />
    </div>

    <p className="text-[11px] text-muted leading-relaxed">
      MP4, <span className="font-mono">1080×1920</span> at <span className="font-mono">60 fps</span>, rendered frame by frame on this device.
      Browsers without a video encoder record in real time instead; keep the tab visible.
    </p>

    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-subtle">
      <span><Kbd>Space</Kbd> play / pause</span>
      <span><Kbd>H</Kbd> preview toolbar</span>
    </div>
  </section>
);

/** Pinned footer: the single primary action of the screen. */
export const ExportBar: React.FC<ExportProps & { onExport: () => void; disabled?: boolean; blockReason?: string | null }> = ({ settings, onUpdate, onExport, disabled, blockReason }) => (
  <div className="p-3 border-t border-line bg-surface-1">
    {blockReason && <p className="mb-2 text-[11px] text-muted" role="status">{blockReason}</p>}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={disabled || !!blockReason}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent/90 disabled:bg-surface-2 disabled:text-subtle"
      >
        Export video
      </button>
      <select
        value={settings.exportLoops}
        onChange={(e) => onUpdate({ exportLoops: parseInt(e.target.value) as 1 | 2 | 4 })}
        className={`${inputCls} !w-auto font-mono py-2.5 cursor-pointer`}
        aria-label="Loops to export"
      >
        <option value={1}>1 loop</option>
        <option value={2}>2 loops</option>
        <option value={4}>4 loops</option>
      </select>
    </div>
  </div>
);
