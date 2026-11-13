import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ParsedMidi, VisualizerSettings } from '../../types';
import { LookSection } from './LookSection';
import { TimeSection } from './TimeSection';
import { ExportBar, ExportSection } from './ExportSection';

interface SidebarProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  isOpen: boolean;
  onToggle: () => void;
  onExport: () => void;
  isExporting?: boolean;
  exportBlockReason?: string | null; // shown under the Export button, which stays disabled
  midiData?: ParsedMidi | null;
  audioDuration?: number;
  isTrimOpen?: boolean;
  onToggleTrim?: (open: boolean) => void;
  introMidiFileName?: string | null;
  onIntroMidiSelected?: (file: File) => void;
  onLoadDemoIntro?: () => void;
  onResetAudioTrim?: () => void;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 560;

/** Controls in three acts (01 Look, 02 Time, 03 Export) with Export pinned at the bottom. */
export const Sidebar: React.FC<SidebarProps> = ({ settings, onUpdate, isOpen, onToggle, onExport, isExporting, exportBlockReason, midiData, ...time }) => {
  const [width, setWidth] = useState(360);
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Drag the left edge to resize
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const start = dragRef.current;
      if (start) setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, start.width + start.x - e.clientX)));
    };
    const onUp = () => setIsDragging(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  return (
    <aside
      style={{ width }}
      className="absolute inset-y-0 right-0 z-20 max-w-full lg:relative flex flex-col shrink-0 bg-surface-1 border-l border-line select-none"
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = { x: e.clientX, width };
          setIsDragging(true);
        }}
        className="absolute inset-y-0 -left-1 w-2 cursor-col-resize z-30 hover:bg-accent/30 transition-colors"
        title="Drag to resize"
      />

      <div className="h-11 shrink-0 px-4 flex items-center justify-between border-b border-line">
        <span className="text-sm font-medium text-text">Controls</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
          title="Close controls"
          aria-label="Close controls"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <LookSection settings={settings} onUpdate={onUpdate} midiData={midiData} />
        <TimeSection settings={settings} onUpdate={onUpdate} midiData={midiData} {...time} />
        <ExportSection settings={settings} onUpdate={onUpdate} />
      </div>

      <ExportBar settings={settings} onUpdate={onUpdate} onExport={onExport} disabled={isExporting} blockReason={exportBlockReason} />
    </aside>
  );
};
