import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CanvasRenderer } from '../engine/renderer';
import { AudioManager } from '../engine/audio';
import { ParsedMidi, VisualizerSettings } from '../types';
import { buildUnifiedTimelineMidi } from '../engine/midi';
import { calculateFrameProgress } from '../core/timeline';
import { loadRenderModules, peekRenderModules } from '../engine/modules';
import { Maximize2, Minimize2 } from 'lucide-react';

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

  // Keyboard shortcut [H] toggles the preview toolbar
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

  // Lazy-load the active mode + hardware chunks; the RAF loop picks them up via peek once ready.
  const hasMidi = unifiedMidi.notes.length > 0;
  useEffect(() => {
    loadRenderModules(settings, hasMidi).catch(err => console.error('[SampleScreen] Module load failed:', err));
  }, [settings.modeId, settings.synthModel, settings.albumView, hasMidi]);

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
            const modules = peekRenderModules(settings, hasMidi);
            rendererRef.current.render(currentTime, unifiedMidi, analysis, settings, modules, timingInfo);
          } catch (err) {
            console.error('[SampleScreen] Canvas render loop error:', err);
          }
        }
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [rendererRef, audioManager, unifiedMidi, timing, settings, isExporting, hasMidi]);

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

  const hudBtn = 'px-2.5 py-1 rounded text-[11px] border flex items-center gap-1.5 transition-colors';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 min-w-0 flex items-center justify-center p-3 lg:p-6 bg-bg overflow-hidden select-none"
    >
      {/* Preview toolbar, outside the 9:16 frame so it never covers the canvas (toggle: H) */}
      {settings.showPreviewHud && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-surface-1 px-2 py-1.5 rounded-md border border-line z-30">
          <span className="font-mono text-[10px] text-muted px-1.5">1080×1920</span>
          <button
            type="button"
            onClick={() => onUpdateSettings({ showSafeZoneGuides: !settings.showSafeZoneGuides })}
            aria-pressed={settings.showSafeZoneGuides}
            className={`${hudBtn} ${settings.showSafeZoneGuides ? 'bg-accent/10 border-accent text-text' : 'border-line text-muted hover:bg-surface-2'}`}
          >
            Safe area
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${hudBtn} border-line text-muted hover:bg-surface-2`}
            title="Full screen"
            aria-label="Full screen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* 9:16 frame: 1px line + the only shadow in the UI */}
      <div className="relative h-full max-h-[82vh] aspect-[9/16] max-w-full rounded-lg overflow-hidden border border-line bg-well shadow-[0_25px_60px_-15px_rgb(10_8_9/0.6)]">
        {/* Native 1080x1920 canvas, scaled down */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>
    </div>
  );
};
