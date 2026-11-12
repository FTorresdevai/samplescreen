import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CanvasRenderer } from '../engine/renderer';
import { AudioManager } from '../engine/audio';
import { ParsedMidi, VisualizerSettings } from '../types';
import { buildUnifiedTimelineMidi } from '../engine/midi';
import { calculateFrameProgress } from '../core/timeline';
import { Maximize2, Minimize2, Edit3, ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface CanvasPreviewProps {
  rendererRef: React.MutableRefObject<CanvasRenderer | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  audioManager: AudioManager;
  midiData: ParsedMidi;
  introMidiData?: ParsedMidi | null;
  settings: VisualizerSettings;
  onUpdateSettings: (updates: Partial<VisualizerSettings>) => void;
  isExporting?: boolean;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  rendererRef,
  canvasRef,
  audioManager,
  midiData,
  introMidiData,
  settings,
  onUpdateSettings,
  isExporting = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);

  // Keyboard shortcut [H] to toggle on-screen HUD buttons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        onUpdateSettings({ showPreviewHud: !settings.showPreviewHud });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.showPreviewHud, onUpdateSettings]);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, [canvasRef, rendererRef]);

  // Memoized unified timeline to prevent 60 FPS recalculations
  const { unifiedMidi, timing } = useMemo(() => {
    return buildUnifiedTimelineMidi(midiData, introMidiData || null, settings);
  }, [
    midiData,
    introMidiData,
    settings.enableIntro,
    settings.introBars,
    settings.bpm,
    settings.loopBars,
    settings.audioTrimBars,
    settings.audioTrimStartBar,
    settings.isAudioTrimmed,
    settings.exportLoops,
  ]);

  // Main 60 FPS Animation loop for real-time preview with seamless unified timeline and intro awareness.
  // Pauses rendering while an export is actively generating frames to free GPU/CPU bandwidth.
  // Throttles rendering to 60 FPS on high refresh rate displays (120Hz/144Hz) to avoid excessive GPU overhead.
  useEffect(() => {
    let animId: number;
    let lastFrameTime = 0;
    const targetInterval = 1000 / 60; // 60 FPS target (~16.67ms)

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      if (!isExporting && rendererRef.current) {
        const elapsedSinceLast = now - lastFrameTime;
        if (elapsedSinceLast >= targetInterval - 1.5) {
          lastFrameTime = now - (elapsedSinceLast % targetInterval);
          try {
            const currentTime = audioManager.getCurrentTime();
            const analysis = audioManager.getRealtimeAnalysis();
            const { timingInfo } = calculateFrameProgress(currentTime, timing, settings, unifiedMidi);
            rendererRef.current.render(currentTime, unifiedMidi, analysis, settings, timingInfo);
          } catch (err) {
            console.error('[SampleScreen] Canvas render loop error:', err);
          }
        }
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [rendererRef, audioManager, unifiedMidi, timing, settings, isExporting]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center p-3 lg:p-6 bg-gradient-to-b from-[#090a0e] via-[#07080a] to-[#040507] overflow-hidden select-none"
    >
      {/* Floating Toolbar (Placed OUTSIDE the phone screen so it never covers canvas titles) */}
      {settings.showPreviewHud ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#0b0d14]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-2xl z-30 animate-in fade-in slide-in-from-top-2">
          <span className="text-[10px] font-mono font-bold text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-900 border border-white/[0.06] select-none">
            1080×1920 • 9:16
          </span>

          <button
            onClick={() => onUpdateSettings({ showSafeZoneGuides: !settings.showSafeZoneGuides })}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 transition ${
              settings.showSafeZoneGuides
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Show/Hide Reels Safe-Zone Guides"
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Safe-Zone</span>
          </button>

          <button
            onClick={() => setIsEditingOverlay(!isEditingOverlay)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 transition ${
              isEditingOverlay
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
            }`}
            title="Edit Title and Producer on screen"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit Text</span>
          </button>

          <button
            onClick={() => onUpdateSettings({ showPreviewHud: false })}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white flex items-center gap-1.5 transition"
            title="Hide controls for clean view (shortcut: H key)"
          >
            <EyeOff className="w-3 h-3 text-zinc-400" />
            <span>Hide Controls</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Full Screen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        /* Subtle, unobtrusive button to show buttons if user needs them */
        <button
          onClick={() => onUpdateSettings({ showPreviewHud: true })}
          className="absolute top-3 right-5 bg-[#0b0d14]/75 hover:bg-[#0b0d14] backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-mono text-zinc-400 hover:text-amber-300 flex items-center gap-1.5 shadow-lg z-30 transition opacity-60 hover:opacity-100"
          title="Show on-screen controls (shortcut: H key)"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>Show Controls</span>
        </button>
      )}

      {/* Direct On-Screen Quick Text Editor (Centered Floating Modal) */}
      {isEditingOverlay && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-80 bg-zinc-950/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3.5 shadow-2xl z-40 space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
            <span>Edit On-Screen Text</span>
            <button
              onClick={() => setIsEditingOverlay(false)}
              className="text-zinc-500 hover:text-white text-[10px] font-mono"
            >
              Done ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">Track Title</label>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => onUpdateSettings({ title: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-bold text-white uppercase outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[9px] text-zinc-400 block mb-0.5">BPM & Key</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={settings.bpm}
                  onChange={(e) => onUpdateSettings({ bpm: parseInt(e.target.value) || 80 })}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={settings.key}
                  onChange={(e) => onUpdateSettings({ key: e.target.value })}
                  className="w-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-white uppercase outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[9px] text-zinc-400 block mb-0.5">Producer Handle</label>
            <input
              type="text"
              value={settings.producerHandle}
              onChange={(e) => onUpdateSettings({ producerHandle: e.target.value })}
              placeholder="PRODBYSERROT"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono font-bold text-amber-300 uppercase outline-none focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* 9:16 Mockup Frame Device Container */}
      <div className="relative h-full max-h-[82vh] aspect-[9/16] rounded-2xl p-1 bg-gradient-to-b from-zinc-700/40 via-zinc-800/20 to-zinc-900/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/10 flex items-center justify-center">
        
        {/* Screen Bezel (Pure, clean artwork without any overlay blocking it!) */}
        <div className="w-full h-full rounded-[14px] overflow-hidden bg-black relative flex items-center justify-center">
          
          {/* Native 1080x1920 internal Canvas scaled smoothly */}
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full object-contain pointer-events-none"
          />

        </div>

      </div>
    </div>
  );
};
