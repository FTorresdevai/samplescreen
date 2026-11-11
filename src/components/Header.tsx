import React from 'react';
import { Download, Sparkles, Sliders, PanelRightClose, PanelRightOpen, Disc3 } from 'lucide-react';
import { VisualizerSettings } from '../types';

interface HeaderProps {
  settings: VisualizerSettings;
  onUpdateSettings: (updates: Partial<VisualizerSettings>) => void;
  onLoadDemo: () => void;
  onOpenExport: () => void;
  isExporting: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onLoadDemo,
  onOpenExport,
  isExporting,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <header className="h-14 bg-[#07080a] border-b border-white/[0.06] px-4 lg:px-6 flex items-center justify-between z-30 sticky top-0 select-none">
      
      {/* Studio Brand & Identity (Beatsinner Aesthetic) */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <div className="w-8 h-8 rounded-lg bg-[#0e1118] border border-white/[0.1] flex items-center justify-center shadow-md shadow-black transition-transform group-hover:scale-105">
            <Disc3 className="w-4 h-4 text-amber-400 animate-[spin_8s_linear_infinite]" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full shadow-sm shadow-amber-400" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono font-black text-sm tracking-widest text-white uppercase flex items-center gap-2">
              SAMPLESCREEN
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                PRO 60FPS
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono hidden sm:flex items-center gap-1.5 uppercase">
            <span>Modular Visual Engine • 1080×1920 60 FPS</span>
          </p>
        </div>
      </div>

      {/* Track Quick Summary in Header */}
      <div className="hidden md:flex items-center gap-2.5 bg-[#0c0e14] border border-white/[0.06] rounded-lg px-3 py-1.5 shadow-inner">
        <Sliders className="w-3 h-3 text-zinc-500" />
        <input
          type="text"
          value={settings.title}
          onChange={(e) => onUpdateSettings({ title: e.target.value })}
          placeholder="TRACK TITLE"
          className="bg-transparent text-xs font-mono font-bold tracking-wider text-zinc-100 outline-none w-36 uppercase placeholder:text-zinc-600"
        />
        <div className="h-3 w-px bg-white/[0.08]" />
        <span className="text-[10px] font-mono font-bold text-amber-400">
          {settings.bpm} BPM · {settings.key}
        </span>
      </div>

      {/* Studio Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onLoadDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[#0c0e14] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.06] transition active:scale-95 shadow-sm"
          title="Load 16-bar analog synth progression"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">16-Bar Demo</span>
        </button>

        <button
          onClick={onOpenExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/20 transition active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Video</span>
        </button>

        {/* Toggle Customization Sidebar Button */}
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition ${
            isSidebarOpen
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-[#0c0e14] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title="Toggle Studio Controls"
        >
          {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

    </header>
  );
};
