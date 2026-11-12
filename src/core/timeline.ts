import { ParsedMidi, VisualizerSettings, TimingInfo } from '../types';
import { TimelineTiming } from '../engine/midi';

export interface CalculatedFrameProgress {
  loopTime: number;
  loopProgress: number;
  isIntro: boolean;
  introBar: number;
  duration: number;
  timingInfo: TimingInfo;
}

/**
 * Single Source of Truth for Timeline and Intro Progression
 * Shared identically between CanvasPreview (60fps live) and VideoExporter (WebCodecs offline)
 */
export function calculateFrameProgress(
  currentTime: number,
  timing: TimelineTiming,
  settings: VisualizerSettings,
  midi: ParsedMidi
): CalculatedFrameProgress {
  const { hasIntro, introDuration, mainLoopDuration, secondsPerBar, introBars } = timing;
  const duration = hasIntro ? (introDuration + mainLoopDuration) : (midi.duration || 16);

  if (hasIntro && currentTime < introDuration) {
    const introBar = Math.min(introBars, Math.floor(currentTime / secondsPerBar) + 1);
    const loopProgress = introDuration > 0 ? (currentTime / introDuration) : 0;

    return {
      loopTime: currentTime,
      loopProgress,
      isIntro: true,
      introBar,
      duration,
      timingInfo: {
        hasIntro: true,
        isIntro: true,
        introBar,
        totalIntroBars: introBars,
        introDuration,
        mainLoopDuration,
        loopTime: currentTime,
        loopProgress,
        duration,
      },
    };
  }

  const timeInMain = hasIntro ? (currentTime - introDuration) : currentTime;
  const mainProgress = timeInMain >= 0 ? (timeInMain % mainLoopDuration) : 0;
  const loopTime = hasIntro ? (introDuration + mainProgress) : mainProgress;
  const loopProgress = mainLoopDuration > 0 ? (mainProgress / mainLoopDuration) : 0;

  return {
    loopTime,
    loopProgress,
    isIntro: false,
    introBar: 0,
    duration,
    timingInfo: {
      hasIntro,
      isIntro: false,
      introBar: 0,
      totalIntroBars: introBars,
      introDuration,
      mainLoopDuration,
      loopTime,
      loopProgress,
      duration,
    },
  };
}
