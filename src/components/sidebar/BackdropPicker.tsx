import React, { useRef, useState } from 'react';
import { getBackdropName, setBackdropPhoto } from '../../shared/backdrop';
import { Label } from '../ui';

/** Optional backdrop photo for modes with `photo: true`. Kept in memory only. */
export const BackdropPicker: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(getBackdropName);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | null) => {
    setError(null);
    setBackdropPhoto(file)
      .then(() => setName(file ? file.name : null))
      .catch(() => { setName(null); setError('Could not read that image'); });
  };

  return (
    <div>
      <Label>Backdrop photo</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-surface-2"
        >
          {name ? 'Replace' : 'Choose image'}
        </button>
        {name && (
          <>
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted" title={name}>{name}</span>
            <button type="button" onClick={() => pick(null)} className="text-[11px] text-muted hover:text-text">Remove</button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
      <p className="mt-1 text-[11px] text-subtle">{error ?? 'Optional: the mode films your photo instead of its own scene.'}</p>
    </div>
  );
};
