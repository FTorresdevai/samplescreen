import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Code2, Eye, ShieldCheck, Box, Sliders, Cpu } from 'lucide-react';
import { VISUAL_MODELS_MANIFEST } from '../models/registry';
import { SYNTHS_MANIFEST } from '../hardware/registry';

interface MockupsPageProps {
  onBackToStudio: () => void;
}

export const MockupsPage: React.FC<MockupsPageProps> = ({ onBackToStudio }) => {
  const [activeTab, setActiveTab] = useState<'models' | 'synths'>('models');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Models' },
    { id: 'album', label: 'Official Albums' },
    { id: 'creative', label: 'Creative & Visual' },
    { id: 'daw', label: 'Studio & DAW' },
  ];

  const filteredModels = selectedCategory === 'all'
    ? VISUAL_MODELS_MANIFEST
    : VISUAL_MODELS_MANIFEST.filter(m => m.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 p-6 md:p-10 font-sans">
      
      {/* Top Header Bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-white/[0.08] mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToStudio}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#10131b] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.1] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Studio</span>
          </button>
          <div className="h-4 w-px bg-white/[0.1]" />
          <div>
            <h1 className="text-base font-mono font-bold tracking-wider text-white uppercase flex items-center gap-2">
              Secret Mockups Lab
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30">
                DEV ONLY
              </span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Gallery of visual references and models for developers to contribute.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Isolated Environment (Zero Impact on Main)</span>
        </div>
      </div>

      {/* Top Module Switcher Tabs (Models vs Synths) */}
      <div className="max-w-6xl mx-auto flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
            activeTab === 'models'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
              : 'bg-[#10131b] text-zinc-400 hover:text-white border border-white/[0.08]'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>VISUAL MODELS ({VISUAL_MODELS_MANIFEST.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('synths')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
            activeTab === 'synths'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
              : 'bg-[#10131b] text-zinc-400 hover:text-white border border-white/[0.08]'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>HARDWARE SYNTHS ({SYNTHS_MANIFEST.length})</span>
        </button>
      </div>

      {/* Guide Banner for Contributors & AI Agents */}
      <div className="max-w-6xl mx-auto mb-8 p-4 bg-amber-500/[0.04] border border-amber-500/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Code2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xs font-mono font-bold text-white uppercase">
              {activeTab === 'models' ? 'How to Develop a New Visual Model' : 'How to Develop a New Hardware Synthesizer'}
            </h2>
            {activeTab === 'models' ? (
              <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                1. Create a folder in <code className="text-amber-300 font-mono">src/models/[your-model]/</code>.<br />
                2. Implement the <code className="text-amber-300 font-mono">draw(ctx, context: ModelDrawContext)</code> within slot bounds <code className="text-amber-300 font-mono">(w: 960, h: 670)</code>.<br />
                3. Register in <code className="text-amber-300 font-mono">src/models/registry.ts</code>. The sidebar detects it automatically!
              </p>
            ) : (
              <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                1. Create a file in <code className="text-amber-300 font-mono">src/hardware/[your-synth].ts</code>.<br />
                2. Implement the <code className="text-amber-300 font-mono">draw(ctx, context: SynthDrawContext)</code> within slot bounds <code className="text-amber-300 font-mono">(w: 960, h: 570)</code>.<br />
                3. Register in <code className="text-amber-300 font-mono">src/hardware/registry.ts</code>. Zero risk to existing synths!
              </p>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'models' ? (
        <>
          {/* Category Pills */}
          <div className="max-w-6xl mx-auto flex items-center gap-2 mb-6">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  selectedCategory === cat.id
                    ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20'
                    : 'bg-[#10131b] text-zinc-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Models Grid */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredModels.map(model => (
              <div
                key={model.id}
                className="bg-[#0e1118] border border-white/[0.08] hover:border-amber-500/40 rounded-xl p-5 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {model.tag}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      ID: {model.id}
                    </span>
                  </div>

                  <h3 className="font-mono text-sm font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                    {model.name}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    {model.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">
                    src/models/{model.id}/index.ts
                  </span>
                  <button
                    onClick={onBackToStudio}
                    className="flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-400 hover:text-amber-300 transition"
                  >
                    <span>Test in Studio</span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Synths Grid */
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
          {SYNTHS_MANIFEST.map(synth => (
            <div
              key={synth.id}
              className="bg-[#0e1118] border border-white/[0.08] hover:border-amber-500/40 rounded-xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {synth.tag}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    ID: {synth.id}
                  </span>
                </div>

                <h3 className="font-mono text-sm font-bold text-white group-hover:text-amber-300 transition-colors mb-1.5">
                  {synth.name}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  {synth.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  src/hardware/{synth.id}-synth.ts
                </span>
                <button
                  onClick={onBackToStudio}
                  className="flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-400 hover:text-amber-300 transition"
                >
                  <span>Active in Console</span>
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
