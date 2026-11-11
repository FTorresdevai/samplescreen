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
  if (w < 0 || h < 0) return;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    const r = Array.isArray(radius) ? radius[0] || 0 : radius;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
