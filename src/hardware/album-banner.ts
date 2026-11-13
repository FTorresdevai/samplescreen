import { SynthDrawContext } from '../types';
import { roundRect } from '../shared/canvas-utils';
import { consoleTheme } from './themes';
import { getCachedImage } from '../shared/assets';

// Discover banner images in any album folder (either root `banner.*` or `assets/banner.*`)
const bannerGlob = import.meta.glob<string>(
  ['../modes/albums/*/banner.{jpg,jpeg,png,webp}', '../modes/albums/*/assets/banner.{jpg,jpeg,png,webp}'],
  { eager: true, query: '?url', import: 'default' }
);

function getBannerUrl(modeId: string): string | null {
  for (const [path, url] of Object.entries(bannerGlob)) {
    if (path.includes(`/${modeId}/`)) {
      return url;
    }
  }
  return null;
}

/**
 * Album Banner Hardware Console (Slot 1: 960 × 570)
 * Replaces the tape machine in Audio (waveform) mode with the album's custom photographic banner.
 * Framed in a luxury studio chassis with drop shadow, theme-matched metallic bezel,
 * and audio-reactive ambient glow.
 */
export function drawAlbumBanner(ctx: CanvasRenderingContext2D, context: SynthDrawContext) {
  const { region, analysis, settings, theme } = context;
  const { x, y, width: w, height: h } = region;

  const bannerUrl = getBannerUrl(settings.modeId);
  const img = bannerUrl ? getCachedImage(bannerUrl) : null;

  ctx.save();

  const T = consoleTheme(theme);
  const bezelColor = T.tapeBezel;

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

  // 3. Inner Clipped Frame for the Photo & Overlays
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8, false, false);
  ctx.clip();

  // Dark background fill
  ctx.fillStyle = '#07090e';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  if (img && img.complete && img.naturalWidth > 0) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = (w - 4) / (h - 4);
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    if (imgAspect > targetAspect) {
      sw = img.naturalHeight * targetAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetAspect;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, x + 2, y + 2, w - 4, h - 4);

    // Warm cinematic vignette overlay to blend into the studio dark UI
    const vignette = ctx.createLinearGradient(x, y, x, y + h);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    vignette.addColorStop(0.18, 'rgba(0, 0, 0, 0.02)');
    vignette.addColorStop(0.80, 'rgba(0, 0, 0, 0.08)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // Audio-reactive ambient glow along bottom rim matching album theme
    const bass = analysis?.bass ?? 0;
    if (bass > 0.08) {
      const glowGrad = ctx.createLinearGradient(x, y + h - 140, x, y + h);
      glowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      const alpha = Math.min(0.45, bass * 0.4).toFixed(3);
      glowGrad.addColorStop(1, T.tapeGlow.replace(/[\d.]+\)$/, `${alpha})`));
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x + 2, y + h - 140, w - 4, 138);
    }
  }

  ctx.restore(); // end clip

  // 4. Subtle hardware accents: corner bolts matching console theme
  const boltSize = 4.5;
  const boltInset = 11;
  const bolts = [
    [x + boltInset, y + boltInset],
    [x + w - boltInset, y + boltInset],
    [x + boltInset, y + h - boltInset],
    [x + w - boltInset, y + h - boltInset],
  ];
  bolts.forEach(([bx, by]) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(bx, by, boltSize + 1, 0, Math.PI * 2);
    ctx.fill();

    const boltGrad = ctx.createLinearGradient(bx - 3, by - 3, bx + 3, by + 3);
    boltGrad.addColorStop(0, T.screw[0]);
    boltGrad.addColorStop(0.5, T.screw[1]);
    boltGrad.addColorStop(1, T.screw[2]);
    ctx.fillStyle = boltGrad;
    ctx.beginPath();
    ctx.arc(bx, by, boltSize, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
