import React from 'react';
import { ChordDisplay, VisualizerSettings } from '../../types';
import { findManifest } from '../../modes/registry';
import { Label, Segmented, SegmentOption, Toggle } from '../ui';

interface NoteNamesProps {
  settings: VisualizerSettings;
  onUpdate: (updates: Partial<VisualizerSettings>) => void;
}

/** Accidentals, octave numbering, chord display and note-name toggles. */
export const NoteNames: React.FC<NoteNamesProps> = ({ settings, onUpdate }) => {
  const isAlbum = findManifest(settings.modeId)?.kind === 'album';
  const chordOptions: SegmentOption<ChordDisplay>[] = [
    { value: 'bottom', label: 'Bottom', title: 'Show notes in the bottom bar' },
    ...(isAlbum ? [{ value: 'piano' as const, label: 'Under keys', title: 'Show notes under the album keyboard' }] : []),
    { value: 'off', label: 'Off', title: 'Hide notes and chord' },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div>
          <Label>Accidentals</Label>
          <Segmented<'sharp' | 'flat'>
            label="Accidentals"
            mono
            value={settings.accidental}
            onChange={(accidental) => onUpdate({ accidental })}
            options={[
              { value: 'sharp', label: '#' },
              { value: 'flat', label: '♭' },
            ]}
          />
        </div>
        <div>
          <Label>Middle C</Label>
          <Segmented<3 | 4 | 5>
            label="Middle C"
            mono
            value={settings.middleC}
            onChange={(middleC) => onUpdate({ middleC })}
            options={[
              { value: 3, label: 'C3' },
              { value: 4, label: 'C4' },
              { value: 5, label: 'C5' },
            ]}
          />
        </div>
      </div>

      <div>
        <Label>Chord display</Label>
        <Segmented<ChordDisplay>
          label="Chord display"
          value={settings.chordDisplay}
          onChange={(chordDisplay) => onUpdate({ chordDisplay })}
          options={chordOptions}
        />
      </div>

      <Toggle
        label="Chord symbol (Cm7, Ab)"
        checked={settings.showChordSymbol === true}
        onChange={(showChordSymbol) => onUpdate({ showChordSymbol })}
      />
      <Toggle
        label="Note names next to the playhead"
        checked={settings.noteNameTags !== false}
        onChange={(noteNameTags) => onUpdate({ noteNameTags })}
      />
      <Toggle
        label="Bar progress dashes"
        checked={settings.showProgressDashes !== false}
        onChange={(showProgressDashes) => onUpdate({ showProgressDashes })}
      />
    </div>
  );
};
