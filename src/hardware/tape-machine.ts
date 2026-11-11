import { roundRect } from '../shared/canvas-utils';
import { getCachedImage } from '../shared/assets';

/**
 * Studio Master Tape Machine (Photo-Based)
 * Renders the authentic Softube / Studer Tape Mark II hardware console
 * inside Slot 1 (w: 960, h: 570) with luxury chassis framing and glass sheen.
 */
export function drawStudioTapeMachine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorTheme: 'gold' | 'crimson' | string = 'gold'
) {
  const tapeMachineImg = getCachedImage('assets/tape_machine.jpg');

  ctx.save();

  const isGold = colorTheme !== 'crimson';
  const accentGlow = isGold ? '#f59e0b' : '#ef4444';
  const bezelColor = isGold ? 'rgba(212, 175, 55, 0.45)' : 'rgba(239, 68, 68, 0.45)';

  // 1. Outer Chassis Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#06080c';
  roundRect(ctx, x, y, w, h, 10, true, false);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 2. Metallic Bezel Border with album theme color
  ctx.strokeStyle = bezelColor;
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 10, false, true);

  // 3. Inner Clipped Frame for the Photo
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8, false, false);
  ctx.clip();

  if (tapeMachineImg && tapeMachineImg.complete && tapeMachineImg.naturalWidth > 0) {
    const img = tapeMachineImg;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgAspect > targetAspect) {
      sw = img.naturalHeight * targetAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetAspect;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

    // Subtle glass sheen reflection across top half
    const sheen = ctx.createLinearGradient(x, y, x + w, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h * 0.45);

    // Subtle theme glow wash on bottom edge
    const themeGlow = ctx.createLinearGradient(x, y + h - 18, x, y + h);
    themeGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    themeGlow.addColorStop(1, isGold ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)');
    ctx.fillStyle = themeGlow;
    ctx.fillRect(x, y + h - 18, w, 18);
  } else {
    // Dark metallic brushed fallback while photo loads
    const fbGrad = ctx.createLinearGradient(x, y, x, y + h);
    fbGrad.addColorStop(0, '#1c1f28');
    fbGrad.addColorStop(0.5, '#12141c');
    fbGrad.addColorStop(1, '#090a0f');
    ctx.fillStyle = fbGrad;
    ctx.fillRect(x, y, w, h);

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = isGold ? '#d4af37' : '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('• TAPE MACHINE MARK II •', x + w / 2, y + h / 2);
  }

  ctx.restore(); // remove inner clip
  ctx.restore(); // remove chassis save
}
