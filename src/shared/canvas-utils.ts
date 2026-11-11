/**
 * Shared Canvas Utilities
 * Pure drawing helpers designed to be reused safely across all models and hardware synthesizers.
 */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[] = 0,
  fill = false,
  stroke = true
) {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  let usedNative = false;
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, w, h, radius);
      usedNative = true;
    } catch {
      usedNative = false;
    }
  }
  
  if (!usedNative) {
    const r = Array.isArray(radius) ? radius[0] || 0 : radius;
    const safeR = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + safeR, y);
    ctx.lineTo(x + w - safeR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
    ctx.lineTo(x + w, y + h - safeR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
    ctx.lineTo(x + safeR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
    ctx.lineTo(x, y + safeR);
    ctx.quadraticCurveTo(x, y, x + safeR, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
