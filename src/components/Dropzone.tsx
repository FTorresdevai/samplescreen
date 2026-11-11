import React, { useRef } from 'react';
import { UploadCloud, FileAudio, FileMusic, CheckCircle2 } from 'lucide-react';
import { ParsedMidi } from '../types';

interface DropzoneProps {
  onAudioSelected: (file: File) => void;
  onMidiSelected: (file: File) => void;
  audioFileName: string | null;
  midiFileName: string | null;
  midiData: ParsedMidi | null;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onAudioSelected,
  onMidiSelected,
  audioFileName,
  midiFileName,
  midiData,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAudioSelected(e.target.files[0]);
    }
  };

  const handleMidiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onMidiSelected(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-[#07080a] border border-white/[0.06] rounded-xl">
      
      {/* Audio Dropzone */}
      <div
        onClick={() => audioInputRef.current?.click()}
        className={`group relative flex items-center gap-3 p-2.5 rounded-lg border border-dashed transition cursor-pointer select-none ${
          audioFileName
            ? 'bg-[#0c0e14] border-white/[0.12] hover:border-amber-500/50'
            : 'bg-[#090b10] border-white/[0.06] hover:border-white/[0.2] hover:bg-[#0c0e14]'
        }`}
      >
        <input
          ref={audioInputRef}
          type="file"
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          onChange={handleAudioChange}
          className="hidden"
        />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          audioFileName ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'
        }`}>
          {audioFileName ? <FileAudio className="w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-bold text-zinc-200 truncate">
              {audioFileName || 'Drop Audio (.WAV / .MP3)'}
            </span>
            {audioFileName && <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 truncate">
            {audioFileName ? 'Audio buffer ready' : 'Master audio file'}
          </p>
        </div>
      </div>

      {/* MIDI Dropzone */}
      <div
        onClick={() => midiInputRef.current?.click()}
        className={`group relative flex items-center gap-3 p-2.5 rounded-lg border border-dashed transition cursor-pointer select-none ${
          midiFileName
            ? 'bg-[#0c0e14] border-white/[0.12] hover:border-amber-500/50'
            : 'bg-[#090b10] border-white/[0.06] hover:border-white/[0.2] hover:bg-[#0c0e14]'
        }`}
      >
        <input
          ref={midiInputRef}
          type="file"
          accept=".mid,.midi,audio/midi"
          onChange={handleMidiChange}
          className="hidden"
        />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          midiFileName ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'
        }`}>
          {midiFileName ? <FileMusic className="w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-bold text-zinc-200 truncate">
              {midiFileName || 'Drop MIDI (.MID)'}
            </span>
            {midiFileName && <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 truncate">
            {midiFileName && midiData && midiData.notes.length > 0
              ? `${midiData.notes.length} notes • ${midiData.totalBars} bars • ${midiData.bpm} BPM`
              : 'Optional • Leave empty for Waveform Mode'}
          </p>
        </div>
      </div>

    </div>
  );
};
