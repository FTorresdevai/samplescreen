import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Music } from 'lucide-react';
import { ParsedMidi } from '../types';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;   // the app routes by extension
  isDemo: boolean;                            // nothing loaded yet → large first-screen boxes
  audioFileName: string | null;
  midiFileName: string | null;
  midiData: ParsedMidi | null;
  detectedAudioInfo?: string | null;
}

type Kind = 'audio' | 'midi';

const KINDS: Record<Kind, { label: string; formats: string; accept: string; matches: (f: File) => boolean }> = {
  audio: {
    label: 'Audio',
    formats: 'WAV, MP3',
    accept: '.wav,.mp3,audio/wav,audio/mpeg',
    matches: (f) => /\.(wav|mp3)$/i.test(f.name),
  },
  midi: {
    label: 'MIDI',
    formats: 'MID',
    accept: '.mid,.midi,audio/midi',
    matches: (f) => /\.midi?$/i.test(f.name),
  },
};

/** Two drop targets: one for audio, one for MIDI. Each only accepts its own file type. */
export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  isDemo,
  audioFileName,
  midiFileName,
  midiData,
  detectedAudioInfo,
}) => {
  // Stop the browser from opening files dropped outside the boxes.
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const midiSummary = midiFileName && midiData && midiData.notes.length > 0
    ? `${midiData.notes.length} notes · ${midiData.totalBars} bars · ${midiData.bpm} BPM`
    : null;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row lg:flex-col gap-2">
        <DropBox kind="audio" large={isDemo} fileName={audioFileName} detail={detectedAudioInfo} onFiles={onFilesSelected} />
        <DropBox kind="midi" large={isDemo} fileName={midiFileName} detail={midiSummary} onFiles={onFilesSelected} />
      </div>
      {isDemo && (
        <p className="mt-3 text-xs text-muted text-center">
          The preview is playing a demo loop until you load a file.
        </p>
      )}
    </div>
  );
};

interface DropBoxProps {
  kind: Kind;
  large: boolean;
  fileName: string | null;
  detail?: string | null;
  onFiles: (files: File[]) => void;
}

const DropBox: React.FC<DropBoxProps> = ({ kind, large, fileName, detail, onFiles }) => {
  const { label, formats, accept, matches } = KINDS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const Icon = kind === 'audio' ? AudioLines : Music;

  const take = (files: File[]) => {
    const file = files.find(matches);
    if (file) onFiles([file]);
  };

  // Children ignore pointer events so dragleave doesn't fire when the cursor crosses the text.
  const frame = `flex-1 min-w-0 border border-dashed rounded-lg transition-colors cursor-pointer [&>*]:pointer-events-none ${
    isOver ? 'border-accent bg-accent/10' : 'border-line-strong bg-well hover:bg-surface-2'
  }`;
  const layout = large
    ? 'px-4 py-8 lg:py-10 flex flex-col items-center text-center'
    : 'px-3 py-2 flex items-center gap-3 text-left';
  const textCls = `min-w-0 flex flex-col ${large ? 'max-w-full' : 'flex-1'}`;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          take(Array.from(e.dataTransfer.files));
        }}
        className={`${frame} ${layout}`}
      >
        <Icon className={large ? 'w-6 h-6 text-muted mb-3' : 'w-4 h-4 shrink-0 text-muted'} aria-hidden />
        {fileName ? (
          <span className={textCls}>
            <span className="font-mono text-[10px] uppercase text-subtle">{label}</span>
            <span className="text-xs text-text truncate">{fileName}</span>
            {detail && <span className="font-mono text-[10px] text-muted truncate">{detail}</span>}
          </span>
        ) : (
          <span className={textCls}>
            <span className={`${large ? 'text-base' : 'text-sm'} font-medium text-text`}>Drop {label}</span>
            <span className="text-[11px] text-muted">{formats} · or click to browse</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label} file`}
        onChange={(e) => {
          take(Array.from(e.target.files ?? []));
          e.target.value = ''; // allow picking the same file again
        }}
      />
    </>
  );
};
