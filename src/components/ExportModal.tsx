import React from 'react';
import { Check, X } from 'lucide-react';
import { ExportProgress } from '../engine/exporter';
import { secondaryBtnCls } from './ui';

interface ExportModalProps {
  isOpen: boolean;
  isExporting: boolean;
  progress: ExportProgress | null;
  downloadUrl: string | null;
  fileName: string;
  bpm: number;
  error: string | null;
  onClose: () => void;
  onCancel: () => void;
}

const EXPORT_FPS = 60;

/** `Bar N of M`, derived from the frame counter. */
function barProgress(p: ExportProgress, bpm: number): string {
  const framesPerBar = (60 / (bpm || 80)) * 4 * EXPORT_FPS;
  const total = Math.max(1, Math.round(p.totalFrames / framesPerBar));
  const current = Math.min(total, Math.floor(p.currentFrame / framesPerBar) + 1);
  return `Bar ${current} of ${total}`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  isExporting,
  progress,
  downloadUrl,
  fileName,
  bpm,
  error,
  onClose,
  onCancel,
}) => {
  if (!isOpen) return null;

  const format = fileName.toLowerCase().endsWith('.webm') ? 'WebM' : 'MP4';
  const percent = Math.round(progress?.percent ?? 0);

  return (
    <div className="fixed inset-0 z-50 bg-bg/90 flex items-center justify-center p-4 select-none" role="dialog" aria-modal="true" aria-label="Export">
      <div className="w-full max-w-sm bg-surface-1 border border-line rounded-lg p-6 relative">
        {!isExporting && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {downloadUrl ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-success" aria-hidden />
              <h2 className="font-serif text-4xl leading-none text-text">Ready</h2>
            </div>
            <p className="font-mono text-[11px] text-muted break-all">{fileName}</p>
            <div className="flex flex-col gap-2">
              <a
                href={downloadUrl}
                download={fileName}
                className="rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent/90"
              >
                Download {format}
              </a>
              <button type="button" onClick={onClose} className="py-1.5 text-xs text-muted hover:text-text underline underline-offset-2">
                Keep editing
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-error">Export failed</h2>
            <p className="text-xs text-muted leading-relaxed">{error}</p>
            <button type="button" onClick={onClose} className={`${secondaryBtnCls} w-full`}>
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-text">
              Rendering <span className="font-mono">1080×1920 · 60 fps</span>
            </h2>

            <div className="font-mono text-2xl text-text" aria-live="off">{percent}%</div>
            <div
              className="w-full h-2 bg-well rounded-full overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${percent}%` }} />
            </div>

            <div className="flex justify-between font-mono text-[11px] text-muted">
              <span>{progress ? barProgress(progress, bpm) : 'Preparing'}</span>
              <span>{progress && progress.etaSeconds > 0 ? `About ${Math.ceil(progress.etaSeconds)} s left` : ''}</span>
            </div>

            <p className="text-[11px] text-subtle">Rendered on this device. Nothing is uploaded.</p>

            <button type="button" onClick={onCancel} className={`${secondaryBtnCls} w-full`}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
