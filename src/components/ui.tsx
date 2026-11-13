import React from 'react';

/** Shared control styles (design-system-review.md §3.2, §6). */
export const inputCls =
  'w-full bg-well border border-line rounded-md px-3 py-2 text-xs text-text placeholder:text-subtle';

export const secondaryBtnCls =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-surface-2 transition-colors disabled:text-subtle disabled:hover:bg-transparent';

export const SectionHeader: React.FC<{ n: string; title: string }> = ({ n, title }) => (
  <h2 className="flex items-baseline gap-3 text-sm font-medium text-text">
    <span className="font-mono text-[10px] text-subtle">{n}</span>
    {title}
  </h2>
);

export const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-[11px] text-muted mb-1">{children}</label>
);

/** 28×16 switch: `bg-well` off, `bg-accent` on. */
export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer py-0.5">
    <span className="text-xs text-text">{label}</span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <span className="relative w-7 h-4 shrink-0 rounded-full bg-well border border-line-strong transition-colors peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-[2px] after:left-[2px] after:w-2.5 after:h-2.5 after:rounded-full after:bg-muted after:transition-transform peer-checked:after:translate-x-3 peer-checked:after:bg-accent-ink" />
  </label>
);

export interface SegmentOption<T> {
  value: T;
  label: string;
  hint?: string;   // small second line, e.g. "MIDI"
  title?: string;
}

interface SegmentedProps<T> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;          // accessible name
  disabled?: boolean;
  mono?: boolean;
}

export function Segmented<T extends string | number>({ value, options, onChange, label, disabled, mono }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-well border border-line overflow-hidden">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${mono ? 'font-mono' : ''} ${
              selected
                ? 'bg-accent/10 text-text shadow-[inset_2px_0_0_rgb(var(--accent))]'
                : 'text-muted enabled:hover:bg-surface-2 disabled:text-subtle'
            }`}
          >
            {o.label}
            {o.hint && <span className="block font-mono text-[9px] text-subtle">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Typewriter key. */
export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-block rounded border border-line bg-surface-2 px-1 font-mono text-[10px] text-muted shadow-[0_1px_0_rgb(var(--line-strong))]">
    {children}
  </kbd>
);
