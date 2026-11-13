import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SnapDivision, TrimSelection, TrimView,
  barsAvailable, clampView, computePeaks, fitSelection, secondsPerBar, snapToGrid, zoomView,
} from '../../core/trim';

interface TrimWaveformProps {
  buffer: AudioBuffer | null;   // always the RAW (untrimmed) buffer, so a trim can be widened again
  bpm: number;
  selection: TrimSelection;
  division: SnapDivision;
  view: TrimView;
  onViewChange: (view: TrimView) => void;
  onCommit: (selection: TrimSelection) => void;
  playheadSec: () => number | null;   // position in the raw audio, or null to hide
}

type Drag =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'move'; grab: number }                    // bars between the pointer and the selection start
  | { kind: 'new'; anchor: number; downX: number };

const RULER_H = 18;
const HEIGHT = 168;
const GRIP = 7;            // px around a handle that grabs it
const ACCENT = '#e69d45';
const MUTED = '168,159,145';

/** Bar ruler, peaks, and a selection you can resize (handles), move (drag inside) or redraw (drag outside). */
export const TrimWaveform: React.FC<TrimWaveformProps> = ({ buffer, bpm, selection, division, view, onViewChange, onCommit, playheadSec }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<TrimSelection | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const duration = buffer?.duration ?? 0;
  const spb = secondsPerBar(bpm);
  const visible = duration / view.zoom || 1;
  const sel = draft ?? selection;
  const secToX = (sec: number) => ((sec - view.offset) / visible) * width;
  const barToX = (bar: number) => secToX((bar - 1) * spb);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One peak per pixel of the zoomed waveform; the canvas draws the visible slice
  const zoomStep = Math.ceil(view.zoom);
  const peaks = useMemo(() => {
    if (!buffer || width <= 0) return null;
    return computePeaks(buffer.getChannelData(0), width * zoomStep);
  }, [buffer, width, zoomStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    if (!buffer) return;

    const x0 = barToX(sel.start);
    const x1 = barToX(sel.start + sel.bars);
    const mid = RULER_H + (HEIGHT - RULER_H) / 2;

    ctx.fillStyle = 'rgba(230,157,69,0.10)';
    ctx.fillRect(x0, RULER_H, x1 - x0, HEIGHT - RULER_H);

    // Grid: beats when there is room, bars, and numbered ruler ticks
    const barPx = (spb / visible) * width;
    let labelEvery = 1;
    while (barPx * labelEvery < 40) labelEvery *= 2;
    const firstBar = Math.max(1, Math.floor(view.offset / spb) + 1);
    const lastBar = Math.ceil((view.offset + visible) / spb) + 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let b = firstBar; b <= lastBar; b++) {
      const x = Math.round(barToX(b));
      if (barPx >= 48) {
        ctx.fillStyle = `rgba(${MUTED},0.07)`;
        for (let q = 1; q < 4; q++) ctx.fillRect(Math.round(barToX(b + q / 4)), RULER_H, 1, HEIGHT - RULER_H);
      }
      const labelled = (b - 1) % labelEvery === 0;
      if (barPx >= 6 || labelled) {
        ctx.fillStyle = `rgba(${MUTED},${labelled ? 0.22 : 0.12})`;
        ctx.fillRect(x, labelled ? 0 : RULER_H - 5, 1, HEIGHT);
      }
      if (labelled) {
        ctx.fillStyle = `rgba(${MUTED},0.9)`;
        ctx.fillText(String(b), x + 4, RULER_H / 2);
      }
    }
    ctx.fillStyle = `rgba(${MUTED},0.25)`;
    ctx.fillRect(0, RULER_H, width, 1);

    if (peaks) {
      const firstCol = Math.round((view.offset / duration) * peaks.length);
      const scale = peaks.length / (width * view.zoom);   // zoom is fractional, peaks are per whole step
      const half = (HEIGHT - RULER_H) / 2 - 6;
      for (let px = 0; px < width; px++) {
        const amp = Math.max(0.5, (peaks[Math.min(peaks.length - 1, firstCol + Math.floor(px * scale))] ?? 0) * half);
        ctx.fillStyle = px >= x0 && px < x1 ? ACCENT : `rgba(${MUTED},0.5)`;
        ctx.fillRect(px, mid - amp, 1, amp * 2);
      }
    }

    // Handles with ruler tabs, and the length label
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x0, 0, 2, HEIGHT);
    ctx.fillRect(x1 - 2, 0, 2, HEIGHT);
    ctx.fillRect(x0, 0, 8, RULER_H);
    ctx.fillRect(x1 - 8, 0, 8, RULER_H);
    const label = `${sel.bars} ${sel.bars === 1 ? 'bar' : 'bars'}`;
    const lw = ctx.measureText(label).width + 12;
    if (x1 - x0 > lw + 24) {
      const lx = Math.max(12, Math.min(width - lw - 12, (x0 + x1) / 2 - lw / 2));
      ctx.fillStyle = '#141113';
      ctx.fillRect(lx, RULER_H + 8, lw, 18);
      ctx.fillStyle = '#f3eddf';
      ctx.fillText(label, lx + 6, RULER_H + 17.5);
    }
  }, [buffer, peaks, width, sel.start, sel.bars, view.zoom, view.offset, spb, duration]);

  // Playhead: a DOM line moved every frame, so the waveform is not redrawn while playing
  const geomRef = useRef({ secToX, width });
  geomRef.current = { secToX, width };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = playheadRef.current;
      if (!el) return;
      const sec = playheadSec();
      const x = sec === null ? -1 : geomRef.current.secToX(sec);
      el.style.display = x >= 0 && x <= geomRef.current.width ? 'block' : 'none';
      el.style.transform = `translateX(${x}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playheadSec]);

  // Wheel: pinch / Ctrl / Cmd zooms at the pointer, otherwise pans. Native listener because it must preventDefault.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e) => {
    if (!buffer) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const anchor = view.offset + ((e.clientX - rect.left) / rect.width) * visible;
      onViewChange(zoomView(view, Math.exp(-e.deltaY * 0.01), anchor, duration));
    } else {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      onViewChange(clampView({ zoom: view.zoom, offset: view.offset + (delta / width) * visible }, duration));
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const pointerSec = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, sec: view.offset + ((e.clientX - rect.left) / rect.width) * visible };
  };
  const hit = (x: number): 'start' | 'end' | 'move' | 'new' => {
    const x0 = barToX(sel.start);
    const x1 = barToX(sel.start + sel.bars);
    if (Math.abs(x - x0) <= GRIP) return 'start';
    if (Math.abs(x - x1) <= GRIP) return 'end';
    return x > x0 && x < x1 ? 'move' : 'new';
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!buffer) return;
    const { x, sec } = pointerSec(e);
    const kind = hit(x);
    if (kind === 'move') dragRef.current = { kind, grab: sec / spb + 1 - sel.start };
    else if (kind === 'new') dragRef.current = { kind, anchor: snapToGrid(sec, bpm, division), downX: x };
    else dragRef.current = { kind };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, sec } = pointerSec(e);
    const drag = dragRef.current;
    if (!drag) {
      const kind = hit(x);
      e.currentTarget.style.cursor = !buffer ? 'default' : kind === 'move' ? 'grab' : kind === 'new' ? 'crosshair' : 'ew-resize';
      return;
    }
    const pos = sec / spb + 1;   // pointer as a bar position
    const end = selection.start + selection.bars;
    let next: TrimSelection;
    if (drag.kind === 'start') {
      const bars = Math.max(1, Math.min(Math.round(end - pos), Math.floor(end - 1 + 1e-6)));
      next = { start: end - bars, bars };
    } else if (drag.kind === 'end') {
      next = { start: selection.start, bars: Math.max(1, Math.min(Math.round(pos - selection.start), barsAvailable(selection.start, duration, bpm))) };
    } else if (drag.kind === 'move') {
      next = fitSelection({ start: snapToGrid((pos - drag.grab - 1) * spb, bpm, division), bars: selection.bars }, duration, bpm, division);
    } else {
      if (Math.abs(x - drag.downX) < 4) return;   // a plain click outside does nothing
      const bars = Math.max(1, Math.round(Math.abs(pos - drag.anchor)));
      next = fitSelection({ start: pos >= drag.anchor ? drag.anchor : drag.anchor - bars, bars }, duration, bpm, division);
    }
    setDraft(next);
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (draft && (draft.start !== selection.start || draft.bars !== selection.bars)) onCommit(draft);
    setDraft(null);
  };

  return (
    <div ref={wrapRef} className="relative rounded-md bg-well border border-line overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, touchAction: 'none' }}
        className={`block ${buffer ? '' : 'opacity-40'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div ref={playheadRef} className="pointer-events-none absolute top-0 left-0 w-px bg-text" style={{ height: HEIGHT, display: 'none' }} />
      {!buffer && <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">Load an audio file to trim it.</p>}
    </div>
  );
};
