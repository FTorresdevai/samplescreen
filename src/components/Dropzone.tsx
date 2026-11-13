import React, { useEffect, useRef, useState } from 'react';
import { AudioLines } from 'lucide-react';
import { ParsedMidi } from '../types';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;   // audio and MIDI together; the app routes by extension
  isDemo: boolean;                            // nothing loaded yet → large first-screen panel
  audioFileName: string | null;
  midiFileName: string | null;
  midiData: ParsedMidi | null;
  detectedAudioInfo?: string | null;
}

const ACCEPT = '.wav,.mp3,.mid,.midi,audio/wav,audio/mpeg,audio/midi';

/** One drop target for audio and MIDI. Files dropped anywhere on the window are accepted. */
export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  isDemo,
  audioFileName,
  midiFileName,
  midiData,
  detectedAudioInfo,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const selectRef = useRef(onFilesSelected);
  selectRef.current = onFilesSelected;

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setIsDragOver(true); } };
    const onLeave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setIsDragOver(false); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) selectRef.current(files);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length) onFilesSelected(files);
        e.target.value = ''; // allow picking the same file again
      }}
    />
  );
  const browse = () => inputRef.current?.click();
  const frame = `border border-dashed rounded-lg transition-colors cursor-pointer ${
    isDragOver ? 'border-accent bg-accent/10' : 'border-line-strong bg-well hover:bg-surface-2'
  }`;

  if (isDemo) {
    return (
      <div className="w-full">
        <button type="button" onClick={browse} className={`${frame} w-full px-6 py-10 lg:py-16 flex flex-col items-center text-center`}>
          <AudioLines className="w-7 h-7 text-muted mb-4" aria-hidden />
          <span className="text-lg font-medium text-text">Drop audio or MIDI</span>
          <span className="mt-1 text-xs text-muted">WAV, MP3, MID · or click to browse</span>
        </button>
        {input}
        <p className="mt-3 text-xs text-muted text-center">
          The preview is playing a demo loop until you load a file.
        </p>
      </div>
    );
  }

  const midiSummary = midiFileName && midiData && midiData.notes.length > 0
    ? `${midiData.notes.length} notes · ${midiData.totalBars} bars · ${midiData.bpm} BPM`
    : null;

  return (
    <div className="w-full">
      <button type="button" onClick={browse} className={`${frame} w-full px-3 py-2 flex items-center gap-3 text-left`}>
        <AudioLines className="w-4 h-4 shrink-0 text-muted" aria-hidden />
        <span className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
          <FileLine kind="Audio" name={audioFileName} detail={detectedAudioInfo} empty="Demo synth" />
          <FileLine kind="MIDI" name={midiFileName} detail={midiSummary} empty="None · audio only" />
        </span>
        <span className="hidden sm:block shrink-0 text-[11px] text-muted">Drop or click to replace</span>
      </button>
      {input}
    </div>
  );
};

const FileLine: React.FC<{ kind: string; name: string | null; detail?: string | null; empty: string }> = ({ kind, name, detail, empty }) => (
  <span className="flex items-baseline gap-2 min-w-0">
    <span className="font-mono text-[10px] uppercase text-subtle w-9 shrink-0">{kind}</span>
    <span className={`text-xs truncate ${name ? 'text-text' : 'text-muted'}`}>{name || empty}</span>
    {detail && <span className="font-mono text-[10px] text-muted truncate">{detail}</span>}
  </span>
);
