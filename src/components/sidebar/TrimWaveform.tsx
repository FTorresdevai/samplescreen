import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computePeaks, formatClock, secondsPerBar, snapToBar } from '../../core/trim';

interface TrimWaveformProps {
  buffer: AudioBuffer | null;   // always the RAW (untrimmed) buffer, so a trim can be widened again
  bpm: number;
  startBar: number;             // 1-based
  bars: number;
  accentColor: string;
  onCommit: (startBar: number, bars: number) => void;
}

const HEIGHT = 72;
const HANDLE_W = 8;

/** Peaks waveform with bar grid and two draggable, bar-snapped handles. */
export const TrimWaveform: React.FC<TrimWaveformProps> = ({ buffer, bpm, startBar, bars, accentColor, onCommit }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // Selection as bar boundaries: [start, end) in 1-based bars
  const [sel, setSel] = useState({ start: startBar, end: startBar + bars });
  const dragRef = useRef<'start' | 'end' | null>(null);

  const duration = buffer?.duration ?? 0;
  const spb = secondsPerBar(bpm);
  const totalBars = Math.max(1, Math.floor(duration / spb));

  useEffect(() => setSel({ start: startBar, end: startBar + bars }), [startBar, bars]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Peaks are computed once per buffer and width
  const peaks = useMemo(() => {
    if (!buffer || width <= 0) return null;
    return computePeaks(buffer.getChannelData(0), width);
  }, [buffer, width]);

  const barToX = (bar: number) => ((bar - 1) * spb / Math.max(duration, 0.001)) * width;

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

    const mid = HEIGHT / 2;
    const x0 = barToX(sel.start);
    const x1 = barToX(sel.end);

    // Selected region
    ctx.fillStyle = `${accentColor}22`;
    ctx.fillRect(x0, 0, x1 - x0, HEIGHT);

    // Bar grid
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let b = 1; b <= totalBars + 1; b++) ctx.fillRect(Math.round(barToX(b)), 0, 1, HEIGHT);

    // Peaks: muted outside the selection, accent inside
    if (peaks) {
      for (let px = 0; px < width; px++) {
        const amp = Math.max(1, peaks[px] * (mid - 4));
        ctx.fillStyle = px >= x0 && px <= x1 ? accentColor : 'rgba(161,161,170,0.45)';
        ctx.fillRect(px, mid - amp, 1, amp * 2);
      }
    }

    // Handles
    ctx.fillStyle = accentColor;
    ctx.fillRect(x0, 0, HANDLE_W / 2, HEIGHT);
    ctx.fillRect(x1 - HANDLE_W / 2, 0, HANDLE_W / 2, HEIGHT);
  }, [peaks, width, sel, accentColor, totalBars, duration, spb]);

  const xToBoundary = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sec = ((clientX - rect.left) / rect.width) * duration;
    return snapToBar(sec, bpm, totalBars);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!buffer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    dragRef.current = Math.abs(x - barToX(sel.start)) <= Math.abs(x - barToX(sel.end)) ? 'start' : 'end';
    e.currentTarget.setPointerCapture(e.pointerId);
    onPointerMove(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const handle = dragRef.current;
    if (!handle) return;
    const b = xToBoundary(e.clientX);
    setSel(prev => handle === 'start'
      ? { ...prev, start: Math.min(b, prev.end - 1) }      // minimum length: 1 bar
      : { ...prev, end: Math.max(b, prev.start + 1) });
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (sel.start !== startBar || sel.end - sel.start !== bars) onCommit(sel.start, sel.end - sel.start);
  };

  const t0 = (sel.start - 1) * spb;
  const t1 = (sel.end - 1) * spb;

  return (
    <div ref={wrapRef} className="space-y-1.5">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, touchAction: 'none' }}
        className={`block rounded-md bg-black/40 ${buffer ? 'cursor-ew-resize' : 'opacity-40'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <p className="font-mono text-[10px] text-zinc-400">
        {buffer
          ? `Bars ${sel.start}–${sel.end - 1} · ${formatClock(t0)}–${formatClock(t1)}`
          : 'Load an audio file to trim it.'}
      </p>
    </div>
  );
};
