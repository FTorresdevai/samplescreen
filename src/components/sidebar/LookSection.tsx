import React from 'react';
import { AlbumView, ModeManifest, ParsedMidi, VisualizerSettings } from '../../types';
import { MODE_MANIFESTS, findManifest } from '../../modes/registry';
import { applyMode } from '../../core/mode-resolution';
import { PALETTES, paletteSettings } from '../../engine/palettes';
import { Label, SectionHeader, Segmented, Toggle, inputCls } from '../ui';

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

/** 01 Look: mode list, album view, colours, on-screen text. */
export const LookSection: React.FC<LookSectionProps> = ({ settings, onUpdate, midiData }) => {
  const isAlbum = findManifest(settings.modeId)?.kind === 'album';
  const hasMidi = (midiData?.notes?.length ?? 0) > 0;

  const selectMode = (mode: ModeManifest) => {
    // 'Under keys' only exists in albums; fall back to the bottom bar elsewhere
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
                  <span className="block text-xs font-medium text-text">{mode.name}</span>
                  <span className="block text-[11px] leading-snug text-muted">{mode.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Album view: MIDI waterfall + keys, or full-stage audio waveform (albums only) */}
      {isAlbum && (
        <div>
          <Label>Album view</Label>
          <Segmented<AlbumView>
            label="Album view"
            value={hasMidi ? settings.albumView : 'waveform'}
            disabled={!hasMidi}
            onChange={(albumView) => onUpdate({ albumView })}
            options={[
              { value: 'midi', label: 'MIDI' },
              { value: 'waveform', label: 'Audio' },
            ]}
          />
          {!hasMidi && <p className="mt-1 text-[11px] text-subtle">Load a MIDI file to use this view</p>}
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

      <div className="space-y-2">
        <div>
          <Label htmlFor="sb-title">Title</Label>
          <input
            id="sb-title"
            type="text"
            value={settings.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="SAMPLE/BEAT NAME"
            className={`${inputCls} uppercase`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="sb-key">Key</Label>
            <input
              id="sb-key"
              type="text"
              value={settings.key}
              onChange={(e) => onUpdate({ key: e.target.value })}
              placeholder="KEY"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
          <div>
            <Label htmlFor="sb-signature">Signature (optional)</Label>
            <input
              id="sb-signature"
              type="text"
              value={settings.producerHandle}
              onChange={(e) => onUpdate({ producerHandle: e.target.value })}
              placeholder="PRODUCER NAME"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
