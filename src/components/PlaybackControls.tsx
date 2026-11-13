import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { AudioManager } from '../engine/audio';
import { Kbd } from './ui';

interface PlaybackControlsProps {
  audioManager: AudioManager;
  duration: number;
  bpm: number;
  enableIntro?: boolean;
  introBars?: number;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  audioManager,
  duration,
  bpm,
  enableIntro,
  introBars,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const isScrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  // Sync state with audio engine (only when not actively dragging the slider)
  useEffect(() => {
    let animId: number;
    const update = () => {
      setIsPlaying(audioManager.isPlaying());
      if (!isScrubbingRef.current) {
        setCurrentTime(audioManager.getCurrentTime());
      }
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [audioManager]);

  // Keep audio playback strictly bounded to timeline duration
  useEffect(() => {
    if (duration > 0) {
      audioManager.setLoopEndTime(duration);
    }
  }, [audioManager, duration]);

  // Keyboard shortcut: Spacebar to play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const togglePlay = () => {
    if (audioManager.isPlaying()) {
      audioManager.pause();
      setIsPlaying(false);
    } else {
      audioManager.play().catch((err) => console.error('[Playback] Play error:', err));
      setIsPlaying(true);
    }
  };

  const handlePointerDown = () => {
    isScrubbingRef.current = true;
    wasPlayingRef.current = audioManager.isPlaying();
    if (wasPlayingRef.current) {
      audioManager.pause();
    }
  };

  const handlePointerUp = () => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (wasPlayingRef.current) {
      audioManager.play(currentTime).catch((err) => console.error('[Playback] Resume error:', err));
    }
  };

  // Global window pointerup listener so scrubbing ends smoothly even if released outside slider
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isScrubbingRef.current) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [currentTime]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    // Live seek without audio restart if scrubbing, guaranteeing 60 FPS visual tracking
    audioManager.seek(time, false);
  };

  const handleRestart = () => {
    audioManager.seek(0);
    audioManager.play(0).catch((err) => console.error('[Playback] Play error:', err));
    setIsPlaying(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const secondsPerBar = (60 / (bpm || 80)) * 4;
  const hasIntro = enableIntro && (introBars || 0) > 0;
  const introDuration = hasIntro ? (introBars || 1) * secondsPerBar : 0;
  const isIntro = hasIntro && currentTime < introDuration;

  let barDisplay = '';
  if (isIntro) {
    const curIntroBar = Math.floor(currentTime / secondsPerBar) + 1;
    const curBeat = Math.floor((currentTime % secondsPerBar) / (60 / (bpm || 80))) + 1;
    barDisplay = `INTRO ${String(curIntroBar).padStart(2, '0')}.${curBeat}`;
  } else {
    const timeInMain = hasIntro ? Math.max(0, currentTime - introDuration) : currentTime;
    const curMainBar = Math.floor(timeInMain / secondsPerBar) + 1;
    const curBeat = Math.floor((timeInMain % secondsPerBar) / (60 / (bpm || 80))) + 1;
    barDisplay = `BAR ${String(curMainBar).padStart(2, '0')}.${curBeat}`;
  }

  return (
    <div className="h-16 shrink-0 bg-surface-1 border-t border-line px-4 lg:px-8 flex flex-col justify-center gap-1.5 select-none z-20">
      {/* Scrub slider */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-muted w-16 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 16}
          step={0.01}
          value={Math.min(currentTime, duration || 16)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onChange={handleSeek}
          className="flex-1 h-1 cursor-pointer"
          aria-label="Playhead"
        />
        <span className="font-mono text-[11px] text-subtle w-16">{formatTime(duration || 16)}</span>
      </div>

      <div className="grid grid-cols-3 items-center">
        {/* Bar / beat readout */}
        <div className="flex items-center gap-3">
          <span className={`font-mono text-[11px] px-2 py-0.5 rounded bg-well border ${isIntro ? 'border-accent text-accent' : 'border-line text-text'}`}>
            {barDisplay}
          </span>
          <span className="hidden sm:inline text-[11px] text-subtle"><Kbd>Space</Kbd> play / pause</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRestart}
            className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Restart"
            aria-label="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full border border-accent text-accent hover:bg-accent/10 flex items-center justify-center transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
        </div>

        <div className="text-right font-mono text-[11px] text-subtle">{bpm} <span className="uppercase">bpm</span></div>
      </div>
    </div>
  );
};
