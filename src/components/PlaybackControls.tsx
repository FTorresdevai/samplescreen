import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { AudioManager } from '../engine/audio';

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

  // Sync state with audio engine
  useEffect(() => {
    let animId: number;
    const update = () => {
      setIsPlaying(audioManager.isPlaying());
      setCurrentTime(audioManager.getCurrentTime());
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
      audioManager.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    audioManager.seek(time);
    setCurrentTime(time);
  };

  const handleRestart = () => {
    audioManager.seek(0);
    audioManager.play(0);
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
    <div className="h-16 bg-[#07080a] border-t border-white/[0.06] px-4 lg:px-8 flex flex-col justify-center gap-1.5 select-none z-20">
      
      {/* Scrub Slider */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] font-bold text-zinc-400 w-16 text-right">
          {formatTime(currentTime)}
        </span>

        <div className="flex-1 relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 16}
            step={0.01}
            value={Math.min(currentTime, duration || 16)}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400 group-hover:h-1.5 transition-all"
          />
        </div>

        <span className="font-mono text-[11px] font-bold text-zinc-600 w-16">
          {formatTime(duration || 16)}
        </span>
      </div>

      {/* Control Buttons & Bar Info */}
      <div className="flex items-center justify-between">
        
        {/* Left: Bar / Beat readout */}
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#0c0e14] border ${isIntro ? 'border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'border-white/[0.06] text-zinc-300'}`}>
            {barDisplay}
          </span>
          <span className="text-[11px] font-mono text-zinc-600 hidden sm:inline">
            [Space] Play/Pause • [R] Restart
          </span>
        </div>

        {/* Center: Play / Pause & Restart */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition active:scale-95"
            title="Restart Loop"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow-md shadow-amber-400/20 transition active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
        </div>

        {/* Right: Loop Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono font-bold text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="uppercase tracking-wider">LOOP 60FPS</span>
          </div>
        </div>

      </div>

    </div>
  );
};
