import React from 'react';
import { Download, CheckCircle2, AlertCircle, X, Disc3 } from 'lucide-react';
import { ExportProgress } from '../engine/exporter';

interface ExportModalProps {
  isOpen: boolean;
  isExporting: boolean;
  progress: ExportProgress | null;
  downloadUrl: string | null;
  fileName: string;
  error: string | null;
  onClose: () => void;
  onCancel: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  isExporting,
  progress,
  downloadUrl,
  fileName,
  error,
  onClose,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#0a0c12] border border-white/[0.08] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button when done or error */}
        {(!isExporting || error) && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center space-y-4">
          
          {/* Header Icon */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0e1118] border border-white/[0.08] flex items-center justify-center shadow-lg">
            {downloadUrl ? (
              <CheckCircle2 className="w-8 h-8 text-amber-400 animate-bounce" />
            ) : error ? (
              <AlertCircle className="w-8 h-8 text-rose-500" />
            ) : (
              <Disc3 className="w-8 h-8 text-amber-400 animate-[spin_3s_linear_infinite]" />
            )}
          </div>

          <div>
            <h2 className="text-base font-mono font-bold text-white uppercase tracking-wider">
              {downloadUrl
                ? 'Export Complete!'
                : error
                ? 'Export Error'
                : 'Rendering 1080×1920 MP4'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              {downloadUrl
                ? 'Your 60 FPS vertical video is ready for Instagram Reels, TikTok, and YouTube Shorts.'
                : error
                ? error
                : progress?.status || 'Encoding frames with 0 frame drops...'}
            </p>
          </div>

          {/* Progress Bar (During Export) */}
          {isExporting && progress && (
            <div className="space-y-3 pt-2">
              <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/[0.06] p-0.5">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-150 shadow-sm shadow-amber-400/50"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 px-1">
                <span className="font-bold text-amber-300">{progress.percent}%</span>
                <span>
                  {progress.currentFrame} / {progress.totalFrames} frames
                </span>
                <span>{progress.fps} FPS</span>
                <span>ETA: {progress.etaSeconds}s</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col gap-2">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download={fileName}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs font-mono uppercase bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/25 transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download {fileName}</span>
              </a>
            ) : isExporting ? (
              <button
                onClick={onCancel}
                className="w-full py-2.5 rounded-xl text-xs font-mono font-semibold text-zinc-400 hover:text-white bg-[#0e1118] hover:bg-zinc-800 border border-white/[0.06] transition"
              >
                Cancel Export
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-xs font-mono font-semibold text-white bg-zinc-800 hover:bg-zinc-700 transition"
              >
                Dismiss
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
