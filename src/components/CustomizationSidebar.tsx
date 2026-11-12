import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Sparkles,
  Disc,
  Layers,
  SlidersHorizontal,
  Download,
  GripVertical,
  Minimize2,
  Maximize2,
  Type,
  ShieldCheck,
  Music2,
  Activity,
  Eye,
  Sliders,
  Settings2,
  Tv,
  Scissors,
  RotateCcw,
  Check
} from 'lucide-react';
import { VisualizerSettings, ParsedMidi } from '../types';
import { PALETTES } from '../engine/palettes';
import { VISUAL_MODELS_MANIFEST } from '../models/registry';

interface CustomizationSidebarProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  isOpen: boolean;
  onToggle: () => void;
  onExport: () => void;
  midiData?: ParsedMidi | null;
  audioDuration?: number;
  rawAudioDuration?: number;
  introMidiData?: ParsedMidi | null;
  introMidiFileName?: string | null;
  onIntroMidiSelected?: (file: File) => void;
  onLoadDemoIntro?: () => void;
  onTrimAudio?: (startBar: number, numBars: number) => void;
  onResetAudioTrim?: () => void;
}

export const CustomizationSidebar: React.FC<CustomizationSidebarProps> = ({
  settings,
  onUpdate,
  isOpen,
  onToggle,
  onExport,
  midiData,
  audioDuration,
  rawAudioDuration,
  introMidiData: _introMidiData,
  introMidiFileName,
  onIntroMidiSelected,
  onLoadDemoIntro,
  onTrimAudio,
  onResetAudioTrim,
}) => {
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(390);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(390);

  // Drag to resize logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = dragStartXRef.current - e.clientX;
      const newWidth = Math.max(300, Math.min(680, startWidthRef.current + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const setWidthPreset = (width: number) => {
    setSidebarWidth(width);
  };

  if (!isOpen) return null;

  // Curated humanized studio swatches (Moog/Roland/Boutique analog aesthetic + Auréola, Wood/Cream & Drake)
  const swatchColors = [
    { name: 'Auréola Sunset Chroma', hex: '#f43f5e', accent: '#fde047', circle: '#3b1c4e', bg: '#170f24' },
    { name: 'Studio Wood & Cream (LoopVisualizer)', hex: '#e11d48', accent: '#d97706', circle: '#d6cbbe', bg: '#f5efe6' },
    { name: 'Radiant Solar Amber', hex: '#fbbf24', accent: '#fef08a', circle: '#3d2516', bg: '#1c130d' },
    { name: 'Take Care Gold', hex: '#eab308', accent: '#fde047', circle: '#382014', bg: '#150d09' },
    { name: 'Orbital Cosmos', hex: '#818cf8', accent: '#c7d2fe', circle: '#25254a', bg: '#0f1026' },
    { name: 'Terracotta', hex: '#f97316', accent: '#fdba74', circle: '#2e1e17', bg: '#17100d' },
    { name: 'Sage Green', hex: '#10b981', accent: '#6ee7b7', circle: '#1c2e24', bg: '#0e1713' },
    { name: 'Amethyst', hex: '#a855f7', accent: '#f0abfc', circle: '#291b3b', bg: '#140c1e' },
  ];

  // Trimmer calculations
  const bpm = settings.bpm || 80;
  const secondsPerBar = (60 / bpm) * 4;
  const effectiveRawDuration = rawAudioDuration || audioDuration || 0;
  const totalAvailableBars = effectiveRawDuration > 0
    ? Math.max(1, Math.floor(effectiveRawDuration / secondsPerBar))
    : 16;

  const currentStartBar = Math.max(1, Math.min(settings.audioTrimStartBar || 1, totalAvailableBars));
  const currentBars = Math.max(1, Math.min(settings.audioTrimBars || 16, Math.max(1, totalAvailableBars - currentStartBar + 1)));

  const trimStartTime = (currentStartBar - 1) * secondsPerBar;
  const trimDurationTime = currentBars * secondsPerBar;
  const trimEndTime = trimStartTime + trimDurationTime;

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="fixed lg:static top-16 right-0 bottom-0 bg-[#07080b] border-l border-white/[0.07] z-20 flex flex-col transition-all duration-75 select-none relative shadow-2xl text-zinc-300 font-sans"
    >
      {/* Draggable Left Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-30 group flex items-center justify-center hover:bg-amber-500/20 transition-colors"
        title="Drag horizontally to resize sidebar"
      >
        <div className="w-1 h-12 rounded-full bg-zinc-800 group-hover:bg-amber-400 group-hover:h-20 transition-all flex items-center justify-center">
          <GripVertical className="w-2.5 h-2.5 text-zinc-500 group-hover:text-amber-200" />
        </div>
      </div>

      {/* Top Header & Size Toggles */}
      <div className="h-12 border-b border-white/[0.06] px-4 flex items-center justify-between bg-[#0a0b10]">
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-200">
          <Settings2 className="w-3.5 h-3.5 text-amber-400" />
          <span>STUDIO CONTROLS</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWidthPreset(320)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
              sidebarWidth <= 340
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                : 'bg-zinc-900/80 border-white/[0.06] text-zinc-500 hover:text-white'
            }`}
            title="Compact (320px)"
          >
            S
          </button>
          <button
            onClick={() => setWidthPreset(400)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
              sidebarWidth > 340 && sidebarWidth <= 460
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                : 'bg-zinc-900/80 border-white/[0.06] text-zinc-500 hover:text-white'
            }`}
            title="Standard (400px)"
          >
            M
          </button>
          <button
            onClick={() => setWidthPreset(540)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
              sidebarWidth > 460
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                : 'bg-zinc-900/80 border-white/[0.06] text-zinc-500 hover:text-white'
            }`}
            title="Expanded (540px)"
          >
            L
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition ml-1"
            title="Close sidebar"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Settings Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">

        {/* ============================================================== */}
        {/* 1. UNIVERSAL DISPLAY MODE (PIANO VS WAVEFORM)                 */}
        {/* ============================================================== */}
        <section className="space-y-2.5 p-3 bg-[#0c0e14] border border-amber-500/30 rounded-xl shadow-inner">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            <span className="flex items-center gap-1.5 text-white">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              DISPLAY MODE
            </span>
            <span className="text-amber-400 font-bold uppercase">
              {settings.waveformMode ? 'Waveform' : 'Piano / MIDI'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-lg border border-white/[0.06]">
            <button
              onClick={() => onUpdate({ waveformMode: false })}
              className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                !settings.waveformMode
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span>Piano / MIDI</span>
            </button>
            <button
              onClick={() => onUpdate({ waveformMode: true })}
              className={`py-1.5 px-2 rounded text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                settings.waveformMode
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Waveform</span>
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 leading-tight">
            {settings.waveformMode
              ? 'Full-stage audio waveform visualizer. Piano keyboard and MIDI waterfall are completely removed.'
              : 'Displays cascading MIDI note waterfall streaming onto the physical concert keyboard.'}
          </p>
        </section>

        {/* ============================================================== */}
        {/* BEAT / AUDIO TRIMMER (BPM SNAPPED BY BARS)                    */}
        {/* ============================================================== */}
        <section className="space-y-3 p-3 bg-[#0c0e14] border border-amber-500/30 rounded-xl shadow-inner">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            <span className="flex items-center gap-1.5 text-white">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              BEAT TRIMMER (BPM SNAPPED)
            </span>
            {settings.isAudioTrimmed ? (
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> TRIMMED
              </span>
            ) : (
              <span className="text-zinc-500 font-mono text-[10px]">FULL AUDIO</span>
            )}
          </div>

          <p className="text-[10px] text-zinc-400 leading-tight">
            Slice and loop beat bars snapped directly to <strong className="text-amber-300 font-mono">{bpm} BPM</strong> in your browser without opening a DAW.
          </p>

          {/* Audio metrics badge */}
          <div className="grid grid-cols-2 gap-2 p-2 bg-black/40 rounded-lg border border-white/[0.06] text-[11px] font-mono">
            <div>
              <span className="text-zinc-500 block text-[9px]">SOURCE BEAT</span>
              <span className="text-zinc-200 font-bold">{effectiveRawDuration > 0 ? `${effectiveRawDuration.toFixed(1)}s` : 'Demo Synth'} ({totalAvailableBars} bars)</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">BAR DURATION</span>
              <span className="text-zinc-200 font-bold">{secondsPerBar.toFixed(2)}s / bar</span>
            </div>
          </div>

          {/* Start Bar Stepper / Slider */}
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span>Start at Bar:</span>
              <span className="font-mono text-amber-400 font-bold">Bar {currentStartBar} ({formatMinSec(trimStartTime)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={1}
                max={Math.max(1, totalAvailableBars)}
                value={currentStartBar}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  onUpdate({ audioTrimStartBar: val });
                }}
                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <button
                type="button"
                onClick={() => onUpdate({ audioTrimStartBar: Math.max(1, currentStartBar - 1) })}
                className="w-6 h-6 flex items-center justify-center rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 font-mono text-xs font-bold border border-white/[0.08] transition"
                title="Previous bar"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={totalAvailableBars}
                value={currentStartBar}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(totalAvailableBars, parseInt(e.target.value) || 1));
                  onUpdate({ audioTrimStartBar: val });
                }}
                className="w-12 bg-[#141721] border border-white/[0.08] rounded px-1.5 py-1 text-xs font-mono font-bold text-center text-white"
              />
              <button
                type="button"
                onClick={() => onUpdate({ audioTrimStartBar: Math.min(totalAvailableBars, currentStartBar + 1) })}
                className="w-6 h-6 flex items-center justify-center rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 font-mono text-xs font-bold border border-white/[0.08] transition"
                title="Next bar"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Start Bar Presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {[1, 5, 9, 13, 17, 25, 33].filter(b => b <= totalAvailableBars).map(barNum => (
              <button
                key={barNum}
                onClick={() => onUpdate({ audioTrimStartBar: barNum })}
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition ${
                  currentStartBar === barNum
                    ? 'bg-amber-400 text-black shadow-sm'
                    : 'bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-white'
                }`}
              >
                Bar {barNum}
              </button>
            ))}
          </div>

          {/* Loop Length (Number of Bars) */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Loop Length (Bars)</label>
            <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
              {([4, 8, 12, 16] as const).map(bars => (
                <button
                  key={bars}
                  onClick={() => onUpdate({ audioTrimBars: bars })}
                  className={`py-1.5 rounded-lg font-mono text-xs font-bold transition ${
                    currentBars === bars
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {bars} Bars
                </button>
              ))}
            </div>
          </div>

          {/* Slice Time Range Preview */}
          <div className={`p-2.5 rounded-lg border text-center font-mono text-[11px] transition ${
            settings.isAudioTrimmed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm'
              : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
          }`}>
            <span className="text-zinc-400 mr-1.5">{settings.isAudioTrimmed ? 'Active Slice:' : 'Selected Slice:'}</span>
            <span className="font-bold text-white">{formatMinSec(trimStartTime)} → {formatMinSec(trimEndTime)}</span>{' '}
            <span className={settings.isAudioTrimmed ? 'text-emerald-400 font-semibold' : 'text-amber-400/90'}>
              ({trimDurationTime.toFixed(1)}s • {currentBars} bars)
            </span>
          </div>

          {/* Trim Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onTrimAudio?.(currentStartBar, currentBars)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/20 transition active:scale-98"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{settings.isAudioTrimmed ? 'Update Beat Trim' : 'Apply Beat Trim'}</span>
            </button>
            {settings.isAudioTrimmed && (
              <button
                onClick={() => onResetAudioTrim?.()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-mono text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.08] transition hover:text-white"
                title="Reset to Full Audio"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 2. VISUALIZER MODELS (6 Clean Active Models)                   */}
        {/* ============================================================== */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            <span>VISUAL MODELS</span>
            <span className="text-amber-400 font-bold">{VISUAL_MODELS_MANIFEST.length} MODELS</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-[#0c0e14] p-1.5 rounded-xl border border-white/[0.06]">
            {VISUAL_MODELS_MANIFEST.map(model => {
              const isSelected = settings.centerVisualizerMode === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    if (model.id === 'take-care') {
                      onUpdate({
                        centerVisualizerMode: 'take-care',
                        notesColor: '#eab308',
                        circleColor: '#382014',
                        bgColor: '#150d09',
                        accentColor: '#fde047',
                        glowColor: '#b45309',
                      });
                    } else if (model.id === 'tz-lado-mau') {
                      onUpdate({
                        centerVisualizerMode: 'tz-lado-mau',
                        notesColor: '#ff5500',
                        circleColor: '#2b1206',
                        bgColor: '#080402',
                        accentColor: '#ff8800',
                        glowColor: '#ff3b00',
                      });
                    } else if (model.id === 'aureola') {
                      onUpdate({
                        centerVisualizerMode: 'aureola',
                        notesColor: '#f43f5e',
                        circleColor: '#3b1c4e',
                        bgColor: '#170f24',
                        accentColor: '#fde047',
                        glowColor: '#ec4899',
                      });
                    } else if (model.id === 'orbital-moon') {
                      onUpdate({
                        centerVisualizerMode: 'orbital-moon',
                        notesColor: '#e0e7ff',
                        circleColor: '#25254a',
                        bgColor: '#0f1026',
                        accentColor: '#818cf8',
                        glowColor: '#6366f1',
                      });
                    } else {
                      onUpdate({ centerVisualizerMode: model.id });
                    }
                  }}
                  className={`p-2 rounded-lg text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/20 text-white border border-amber-500/60 shadow-sm shadow-amber-500/20'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-mono font-black uppercase px-1 py-0.2 rounded bg-white/[0.08] text-amber-300">
                      {model.tag}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white line-clamp-1">
                    {model.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 2. NOTE NAMES (Exact match to User Reference Image 3)          */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            NOTE NAMES
          </div>

          {/* Accidental & Middle C Row */}
          <div className="flex items-center gap-3">
            {/* Accidental Toggle: [ # ] [ b ] */}
            <div className="flex rounded-lg bg-[#0c0e14] border border-white/[0.06] p-0.5">
              <button
                onClick={() => onUpdate({ accidental: 'sharp' })}
                className={`px-3 py-1.5 rounded-md font-mono font-bold text-xs transition ${
                  settings.accidental === 'sharp'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                #
              </button>
              <button
                onClick={() => onUpdate({ accidental: 'flat' })}
                className={`px-3 py-1.5 rounded-md font-mono font-bold text-xs transition ${
                  settings.accidental === 'flat'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                ♭
              </button>
            </div>

            {/* Middle C Selector: Middle C [ C3 ] [ C4 ] [ C5 ] */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-xs text-zinc-400 font-medium">Middle C</span>
              <div className="flex rounded-lg bg-[#0c0e14] border border-white/[0.06] p-0.5">
                {[3, 4, 5].map((oct) => (
                  <button
                    key={oct}
                    onClick={() => onUpdate({ middleC: oct as 3 | 4 | 5 })}
                    className={`px-2.5 py-1.5 rounded-md font-mono font-bold text-xs transition ${
                      settings.middleC === oct
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    C{oct}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chord Display Location: Bottom, Top, Both, Hidden */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs text-zinc-400 block font-mono">Chord Information Position:</span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/90 rounded-lg border border-white/[0.08]">
              <button
                type="button"
                onClick={() => onUpdate({ chordDisplayLocation: 'bottom', showChord: true, showChordBelowPiano: false })}
                className={`py-1.5 px-1 rounded text-[11px] font-mono font-bold transition text-center ${
                  (settings.chordDisplayLocation === 'bottom' || (!settings.chordDisplayLocation && settings.showChord !== false && !settings.showChordBelowPiano))
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
                title="Show only at bottom of screen (Below visualizer)"
              >
                Bottom
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ chordDisplayLocation: 'top', showChord: false, showChordBelowPiano: true })}
                className={`py-1.5 px-1 rounded text-[11px] font-mono font-bold transition text-center ${
                  settings.chordDisplayLocation === 'top'
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
                title="Show only at top (Directly below piano)"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ chordDisplayLocation: 'both', showChord: true, showChordBelowPiano: true })}
                className={`py-1.5 px-1 rounded text-[11px] font-mono font-bold transition text-center ${
                  settings.chordDisplayLocation === 'both'
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
                title="Show at both top and bottom"
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ chordDisplayLocation: 'hidden', showChord: false, showChordBelowPiano: false })}
                className={`py-1.5 px-1 rounded text-[11px] font-mono font-bold transition text-center ${
                  settings.chordDisplayLocation === 'hidden'
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
                title="Hide chord info on both"
              >
                Hidden
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              {settings.chordDisplayLocation === 'bottom' && '✓ Displaying notes only on the bottom bar (no duplication).'}
              {settings.chordDisplayLocation === 'top' && '✓ Displaying notes only at the top (below synthesizer).'}
              {settings.chordDisplayLocation === 'both' && '✓ Displaying notes at top and bottom simultaneously.'}
              {settings.chordDisplayLocation === 'hidden' && '✓ Chord and notes info hidden.'}
            </p>
          </div>

          {/* Checkboxes matching reference */}
          <div className="space-y-2 pt-1">
            {settings.centerVisualizerMode === 'linear' && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showMidiNotesInRoll !== false}
                  onChange={(e) => onUpdate({ showMidiNotesInRoll: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-300">Show notes in piano roll</span>
                  <span className="text-[10px] text-zinc-500">Uncheck to see only the laser line and active notes below</span>
                </div>
              </label>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showChordSymbol === true}
                onChange={(e) => onUpdate({ showChordSymbol: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Show chord symbol at bottom (Cm7, Ab...)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.noteNameTags !== false}
                onChange={(e) => onUpdate({ noteNameTags: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Note name tags next to the cursor</span>
            </label>

            {(settings.centerVisualizerMode === 'circular' || settings.centerVisualizerMode === 'orbital-moon' || settings.centerVisualizerMode === 'aureola') && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.drawNotesOnRings !== false}
                  onChange={(e) => onUpdate({ drawNotesOnRings: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs text-zinc-300">Draw notes on the rings (circular / orbital view)</span>
              </label>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showProgressDashes !== false}
                onChange={(e) => onUpdate({ showProgressDashes: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Show bar progress dashes (— — —)</span>
            </label>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. VIEW & COLORING (Beatsinner Obsidian Aesthetic)             */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            VIEW
          </div>

          {/* Quick Swatch Palette Dots matching reference */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {swatchColors.map(swatch => (
              <button
                key={swatch.name}
                onClick={() => onUpdate({
                  notesColor: swatch.hex,
                  glowColor: swatch.hex,
                  accentColor: swatch.accent,
                  circleColor: swatch.circle,
                  bgColor: swatch.bg,
                })}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 relative ${
                  settings.notesColor.toLowerCase() === swatch.hex.toLowerCase()
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#07080b]'
                    : ''
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              />
            ))}
          </div>

          {/* Quick Studio Ambience Lighting: Ultra-Bright Studio vs Dark Studio Night */}
          <div className="space-y-1.5 pt-1 pb-1">
            <span className="text-[10px] font-mono text-zinc-400 block">STUDIO THEME:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdate({
                  isLightStudioMode: true,
                  bgColor: '#ffffff',
                  notesColor: '#ef4444',
                  circleColor: '#cbd5e1',
                  accentColor: '#f59e0b',
                  glowColor: '#fed7aa',
                  backgroundGlow: true,
                  glowIntensity: 1.5,
                })}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  settings.isLightStudioMode
                    ? 'bg-amber-400 text-black border border-amber-300 shadow-md font-black'
                    : 'bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08]'
                }`}
                title="Ultra-Bright Light Studio Mode (White & Wood, LoopVisualizer)"
              >
                <span>☀</span>
                <span>Ultra-Bright Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdate({
                  isLightStudioMode: false,
                  bgColor: '#161310',
                  notesColor: '#f59e0b',
                  circleColor: '#2b231c',
                  accentColor: '#fde047',
                  glowColor: '#f59e0b',
                  backgroundGlow: true,
                  glowIntensity: 1.3,
                })}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  !settings.isLightStudioMode
                    ? 'bg-zinc-700 text-white border border-white/20 shadow-sm font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/[0.08]'
                }`}
                title="Dark Studio Night Mode (Dark & Cozy)"
              >
                <span>☾</span>
                <span>Dark Night Mode</span>
              </button>
            </div>
          </div>

          {/* Granular Color Elements */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Customize Colors</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.notesColor}
                  onChange={(e) => onUpdate({ notesColor: e.target.value, glowColor: e.target.value })}
                  className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                  title="Notes & Active Keys"
                />
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => onUpdate({ accentColor: e.target.value })}
                  className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                  title="Laser Needle & Accents"
                />
              </div>
            </div>

            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-xs text-zinc-300">Background glow</span>
              <input
                type="checkbox"
                checked={settings.backgroundGlow}
                onChange={(e) => onUpdate({ backgroundGlow: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Style dropdown */}
          <div className="space-y-1 pt-1">
            <label className="text-xs text-zinc-400">Style</label>
            <div className="w-full bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono font-medium text-white flex items-center justify-between">
              <span>Synthesizer (ST 909)</span>
              <span className="text-[10px] text-zinc-500 font-mono">ANALOG</span>
            </div>
          </div>

          {/* Background: Paper / Night */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-zinc-400">Background</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#0c0e14] p-1 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => onUpdate({ bgColor: '#f4f3ef', circleColor: '#27272a' })}
                className={`py-1.5 rounded-lg font-mono text-xs font-semibold transition ${
                  settings.bgColor === '#f4f3ef'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => onUpdate({ bgColor: '#060709', circleColor: '#161922' })}
                className={`py-1.5 rounded-lg font-mono text-xs font-semibold transition ${
                  settings.bgColor !== '#f4f3ef'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Night
              </button>
            </div>
          </div>

          {/* Dynamic Loop Duration (Bars) with MIDI & Audio automatic detection */}
          {(() => {
            const secondsPerBar = (60 / (settings.bpm || 80)) * 4;
            const barOptionsSet = new Set<number>([4, 8, 16]);
            if (midiData?.totalBars && midiData.totalBars > 0) {
              barOptionsSet.add(midiData.totalBars);
            }
            if (audioDuration && audioDuration > 0) {
              const calculatedAudioBars = Math.max(1, Math.round(audioDuration / secondsPerBar));
              barOptionsSet.add(calculatedAudioBars);
            }
            const availableBars = Array.from(barOptionsSet).sort((a, b) => a - b);
            const gridColsClass = availableBars.length <= 3 
              ? 'grid-cols-3' 
              : availableBars.length === 4 
                ? 'grid-cols-4' 
                : 'grid-cols-5';

            return (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Loop Duration (Bars)</label>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    {((settings.loopBars || 8) * secondsPerBar).toFixed(1)}s loop
                  </span>
                </div>
                <div className={`grid ${gridColsClass} gap-1.5 bg-[#0c0e14] p-1 rounded-xl border border-white/[0.06]`}>
                  {availableBars.map((bars) => {
                    const isMidiMatch = midiData?.totalBars === bars;
                    const isAudioMatch = audioDuration && Math.round(audioDuration / secondsPerBar) === bars;
                    const isSelected = settings.loopBars === bars;

                    return (
                      <button
                        key={bars}
                        type="button"
                        onClick={() => onUpdate({ loopBars: bars })}
                        className={`py-1.5 px-1 rounded-lg font-mono text-[11px] font-bold transition flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-sm font-black'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                        title={`${bars} compassos (${(bars * secondsPerBar).toFixed(1)}s)`}
                      >
                        <span>{bars}B</span>
                        {isMidiMatch && (
                          <span className={`text-[8px] uppercase tracking-tighter ${isSelected ? 'text-zinc-950 font-black' : 'text-amber-400'}`}>MIDI</span>
                        )}
                        {isAudioMatch && !isMidiMatch && (
                          <span className={`text-[8px] uppercase tracking-tighter ${isSelected ? 'text-zinc-950 font-black' : 'text-zinc-500'}`}>ÁUDIO</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Motion: Page / Continuous */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-zinc-400">Motion</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#0c0e14] p-1 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => onUpdate({ motionMode: 'page' })}
                className={`py-1.5 rounded-lg font-mono text-xs font-semibold transition ${
                  settings.motionMode === 'page'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Page
              </button>
              <button
                onClick={() => onUpdate({ motionMode: 'continuous' })}
                className={`py-1.5 rounded-lg font-mono text-xs font-semibold transition ${
                  settings.motionMode === 'continuous'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Continuous
              </button>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* INTRO SEQUENCE (1 - 8 BARS)                                    */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>INTRO SEQUENCE (1 - 8 BARS)</span>
            </div>
            {settings.enableIntro && (
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                ACTIVE
              </span>
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.enableIntro === true}
              onChange={(e) => onUpdate({ enableIntro: e.target.checked })}
              className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs text-zinc-200 font-semibold">Enable Intro Before Main Loop</span>
          </label>

          {settings.enableIntro && (
            <div className="space-y-3 pl-3 border-l-2 border-amber-400/40 pt-1">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Intro Duration (Bars)</label>
                <div className="grid grid-cols-6 gap-1 bg-[#0c0e14] p-1 rounded-xl border border-white/[0.06]">
                  {([1, 2, 3, 4, 6, 8] as const).map((barCount) => (
                    <button
                      key={barCount}
                      onClick={() => onUpdate({ introBars: barCount })}
                      className={`py-1.5 rounded-lg font-mono text-xs font-bold transition ${
                        settings.introBars === barCount
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {barCount}B
                    </button>
                  ))}
                </div>
              </div>

              {/* Intro MIDI File Manager */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Intro MIDI File</label>
                  {onLoadDemoIntro && (
                    <button
                      onClick={onLoadDemoIntro}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-mono underline cursor-pointer"
                    >
                      Use Demo Intro
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-[#0c0e14] border border-white/[0.08] hover:border-amber-400/50 cursor-pointer transition">
                    <span className="text-xs font-mono text-zinc-300 truncate max-w-[200px]">
                      {introMidiFileName || 'demo_intro_pads.mid'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Upload .MID
                    </span>
                    <input
                      type="file"
                      accept=".mid,.midi"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onIntroMidiSelected) {
                          onIntroMidiSelected(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-zinc-500 leading-tight">
                  Plays {settings.introBars} bars with its own MIDI chords before dropping into the main groove.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* 4. MUSIC & TEMPO                                               */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            MUSIC
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">BPM</label>
              <input
                type="number"
                value={settings.bpm}
                onChange={(e) => onUpdate({ bpm: parseInt(e.target.value) || 80 })}
                className="w-full bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500/60 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Key</label>
              <input
                type="text"
                value={settings.key}
                onChange={(e) => onUpdate({ key: e.target.value })}
                placeholder="CMIN"
                className="w-full bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:border-amber-500/60 outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Track / Sample Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="FEELS THE SAME"
              className="w-full bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-bold text-white focus:border-amber-500/60 outline-none uppercase tracking-wider"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Reactivity Sensitivity</span>
              <span className="font-mono text-amber-400">{Math.round((settings.audioSensitivity || 1.2) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={settings.audioSensitivity || 1.2}
              onChange={(e) => onUpdate({ audioSensitivity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </section>

        {/* ============================================================== */}
        {/* 5. EXTRA & PRODUCER SIGNATURE                                 */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            EXTRA
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Bottom signature (optional)</label>
            <input
              type="text"
              value={settings.producerHandle}
              onChange={(e) => onUpdate({ producerHandle: e.target.value })}
              placeholder="PRODBYSERROT"
              className="w-full bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:border-amber-500/60 outline-none uppercase tracking-wider"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.fitReelsSafeZone === true}
                onChange={(e) => onUpdate({ fitReelsSafeZone: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Fit inside the visible Reels area (crop and buttons)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showSafeZoneGuides === true}
                onChange={(e) => onUpdate({ showSafeZoneGuides: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Show Reels safe-zone guides</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.showPreviewHud === true}
                onChange={(e) => onUpdate({ showPreviewHud: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">Show on-screen shortcut controls (HUD)</span>
            </label>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 6. RECORD & EXPORT (Matching User Reference Image 2)           */}
        {/* ============================================================== */}
        <section className="space-y-3 pt-3 border-t border-white/[0.06] pb-4">
          <div className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
            RECORD
          </div>

          {/* Primary Amber Export CTA with Cycles Dropdown */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onExport}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/20 transition active:scale-98"
            >
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span>Export video</span>
            </button>

            <select
              value={settings.exportLoops}
              onChange={(e) => onUpdate({ exportLoops: parseInt(e.target.value) as 1 | 2 | 4 })}
              className="bg-[#0c0e14] border border-white/[0.08] text-white text-xs font-mono font-bold rounded-xl px-2.5 py-3 outline-none cursor-pointer"
            >
              <option value={1}>1 loop</option>
              <option value={2}>2 loops</option>
              <option value={4}>4 loops</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const elem = document.documentElement;
                if (!document.fullscreenElement) elem.requestFullscreen();
                else document.exitFullscreen();
              }}
              className="py-2 px-3 rounded-lg bg-[#0c0e14] border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 font-mono text-xs text-center transition"
            >
              Fullscreen
            </button>
            <button
              onClick={onToggle}
              className="py-2 px-3 rounded-lg bg-[#0c0e14] border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 font-mono text-xs text-center transition"
            >
              Hide controls
            </button>
          </div>

          {/* Technical Export Explanatory Footnote */}
          <div className="text-[11px] text-zinc-500 leading-relaxed font-sans pt-1">
            Export video renders a <strong className="text-zinc-400">1080×1920 60 FPS MP4</strong> frame by frame, with its audio and no stutter. If the browser doesn&apos;t support it, it records in real time (keep the tab visible).
          </div>

          <div className="text-[10px] font-mono text-zinc-600 pt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span><kbd className="text-zinc-400">Space</kbd> play/pause</span>
            <span><kbd className="text-zinc-400">R</kbd> restart</span>
            <span><kbd className="text-zinc-400">F</kbd> fullscreen</span>
            <span><kbd className="text-zinc-400">H</kbd> hide controls</span>
          </div>
        </section>

      </div>
    </aside>
  );
};
