import React from 'react';
import { ModeInput, ModeManifest, ParsedMidi, VisualizerSettings } from '../../types';
import { MODE_MANIFESTS, findManifest } from '../../modes/registry';
import { applyMode, hasViewSwitch } from '../../core/mode-resolution';
import { PALETTES, paletteSettings } from '../../engine/palettes';
import { Label, SectionHeader, Segmented, Toggle, ViewSwitch } from '../ui';

const INPUT_TAG: Record<ModeInput, string> = { midi: 'MIDI', audio: 'Audio', both: 'MIDI · Audio' };

interface LookSectionProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
  midiData?: ParsedMidi | null;
}

const GROUPS: { kind: ModeManifest['kind']; label: string }[] = [
  { kind: 'album', label: 'Albums' },
  { kind: 'standalone', label: 'Modes' },
];

const colorInputCls = 'w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0';

/** 01 Look: mode list, MIDI / Audio view, palette, colours. */
export const LookSection: React.FC<LookSectionProps> = ({ settings, onUpdate, midiData }) => {
  const manifest = findManifest(settings.modeId);
  const isAlbum = manifest?.kind === 'album';
  const hasMidi = (midiData?.notes?.length ?? 0) > 0;

  const selectMode = (mode: ModeManifest) => {
    // 'Above piano' only exists in albums; fall back to the bottom bar elsewhere
    const chordFix = mode.kind !== 'album' && settings.chordDisplay === 'piano' ? { chordDisplay: 'bottom' as const } : {};
    onUpdate({ ...applyMode(mode, settings.paletteId), ...chordFix });
  };

  return (
    <section className="space-y-4">
      <SectionHeader n="01" title="Look" />

      {GROUPS.map(({ kind, label }) => (
        <div key={kind}>
          <div className="text-[11px] text-muted mb-1">{label}</div>
          <div className="rounded-md border border-line overflow-hidden divide-y divide-line">
            {MODE_MANIFESTS.filter((m) => m.kind === kind).map((mode) => {
              const selected = settings.modeId === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectMode(mode)}
                  className={`block w-full text-left px-3 py-2 transition-colors ${
                    selected ? 'bg-accent/10 shadow-[inset_2px_0_0_rgb(var(--accent))]' : 'hover:bg-surface-2'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-text">{mode.name}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase text-muted">{INPUT_TAG[mode.input]}</span>
                  </span>
                  <span className="block text-[11px] leading-snug text-muted">{mode.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* View: MIDI or full-stage audio waveform (modes with input 'both'; also pinned in the header) */}
      {manifest && hasViewSwitch(manifest) && (
        <div>
          <Label>View</Label>
          <ViewSwitch settings={settings} onUpdate={onUpdate} hasMidi={hasMidi} />
          {!hasMidi && <p className="mt-1 text-[11px] text-subtle">Load a MIDI file to use the MIDI view</p>}
        </div>
      )}

      {/* Palettes belong to standalone modes; albums keep their own colours */}
      {!isAlbum && (
        <div>
          <Label>Palette</Label>
          <Segmented<string>
            label="Palette"
            value={settings.paletteId}
            onChange={(id) => onUpdate(paletteSettings(id))}
            options={PALETTES.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text">Colours</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.notesColor}
              onChange={(e) => onUpdate({ notesColor: e.target.value, glowColor: e.target.value })}
              className={colorInputCls}
              title="Notes and active keys"
              aria-label="Notes colour"
            />
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => onUpdate({ accentColor: e.target.value })}
              className={colorInputCls}
              title="Playhead and accents"
              aria-label="Accent colour"
            />
          </div>
        </div>

        <Toggle
          label="Background glow"
          checked={settings.backgroundGlow}
          onChange={(backgroundGlow) => onUpdate({ backgroundGlow })}
        />

        <div>
          <div className="flex items-center justify-between text-xs text-text mb-1">
            <span>Reactivity</span>
            <span className="font-mono text-muted">{Math.round((settings.audioSensitivity || 1.2) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={settings.audioSensitivity || 1.2}
            onChange={(e) => onUpdate({ audioSensitivity: parseFloat(e.target.value) })}
            className="w-full h-1.5 cursor-pointer"
            aria-label="Reactivity"
          />
        </div>
      </div>
      {/* Title, key, BPM and producer live above the drop zone (TrackFields) */}
    </section>
  );
};
