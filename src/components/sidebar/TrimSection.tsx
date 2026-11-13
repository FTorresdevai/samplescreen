import React from 'react';
import { VisualizerSettings } from '../../types';
import { Toggle } from '../ui';

interface TrimSectionProps {
  settings: VisualizerSettings;
  isTrimOpen?: boolean;
  onToggleTrim?: (open: boolean) => void;
  onResetAudioTrim?: () => void;
}

/** Opens the wide trim editor (components/trim) and shows what is currently trimmed. */
export const TrimSection: React.FC<TrimSectionProps> = ({ settings, isTrimOpen, onToggleTrim, onResetAudioTrim }) => (
  <div className="space-y-1.5">
    <Toggle checked={isTrimOpen === true} onChange={(open) => onToggleTrim?.(open)} label="Trim editor" />
    {settings.isAudioTrimmed && (
      <div className="flex items-center justify-between">
        <span className="rounded bg-well border border-line px-2 py-1 font-mono text-[10px] text-text">
          {settings.audioTrimBars} {settings.audioTrimBars === 1 ? 'bar' : 'bars'} from bar {settings.audioTrimStartBar || 1}
        </span>
        <button
          type="button"
          onClick={() => onResetAudioTrim?.()}
          className="text-[11px] text-muted hover:text-text underline underline-offset-2"
        >
          Reset trim
        </button>
      </div>
    )}
  </div>
);
