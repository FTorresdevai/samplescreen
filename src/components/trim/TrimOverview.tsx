import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrimSelection, TrimView, clampView, computePeaks, secondsPerBar } from '../../core/trim';

interface TrimOverviewProps {
  buffer: AudioBuffer | null;
  bpm: number;
  selection: TrimSelection;
  view: TrimView;
  onViewChange: (view: TrimView) => void;
}

const HEIGHT = 28;

/** Whole file at a glance: the selection, and the window the editor is zoomed into. Drag to pan. */
export const TrimOverview: React.FC<TrimOverviewProps> = ({ buffer, bpm, selection, view, onViewChange }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const draggingRef = useRef(false);
  const duration = buffer?.duration ?? 0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const peaks = useMemo(() => (buffer && width > 0 ? computePeaks(buffer.getChannelData(0), width) : null), [buffer, width]);

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
    if (!peaks || duration <= 0) return;

    const spb = secondsPerBar(bpm);
    const x0 = (((selection.start - 1) * spb) / duration) * width;
    const x1 = (((selection.start - 1 + selection.bars) * spb) / duration) * width;
    for (let px = 0; px < width; px++) {
      const amp = Math.max(0.5, peaks[px] * (HEIGHT / 2 - 3));
      ctx.fillStyle = px >= x0 && px < x1 ? '#e69d45' : 'rgba(168,159,145,0.45)';
      ctx.fillRect(px, HEIGHT / 2 - amp, 1, amp * 2);
    }

    if (view.zoom > 1) {
      const vx = (view.offset / duration) * width;
      const vw = width / view.zoom;
      ctx.fillStyle = 'rgba(243,237,223,0.08)';
      ctx.fillRect(vx, 0, vw, HEIGHT);
      ctx.strokeStyle = '#f3eddf';
      ctx.lineWidth = 1;
      ctx.strokeRect(vx + 0.5, 0.5, vw - 1, HEIGHT - 1);
    }
  }, [peaks, width, duration, bpm, selection.start, selection.bars, view.zoom, view.offset]);

  // Centre the zoom window on the pointer
  const panTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (view.zoom <= 1 || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sec = ((e.clientX - rect.left) / rect.width) * duration;
    onViewChange(clampView({ zoom: view.zoom, offset: sec - duration / view.zoom / 2 }, duration));
  };

  return (
    <div ref={wrapRef} className="rounded-md bg-well border border-line overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: HEIGHT, touchAction: 'none' }}
        className={`block ${view.zoom > 1 ? 'cursor-grab' : ''}`}
        onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); panTo(e); }}
        onPointerMove={(e) => { if (draggingRef.current) panTo(e); }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
      />
    </div>
  );
};
