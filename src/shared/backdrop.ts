/**
 * Optional backdrop photo for modes whose manifest has `photo: true`.
 * Lives in memory only (an object URL), not in settings: preview and export run on the
 * main thread, so modes read it directly with getBackdropPhoto().
 */
let photo: HTMLImageElement | null = null;
let url: string | null = null;
let name: string | null = null;

/** File name of the loaded photo (survives the picker unmounting when the mode changes). */
export function getBackdropName(): string | null {
  return photo ? name : null;
}

export function getBackdropPhoto(): HTMLImageElement | null {
  return photo && photo.complete && photo.naturalWidth > 0 ? photo : null;
}

export function setBackdropPhoto(file: File | null): Promise<void> {
  if (url) URL.revokeObjectURL(url);
  photo = null;
  url = null;
  if (!file) return Promise.resolve();
  url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  return img.decode().then(() => { photo = img; name = file.name; });
}

/** Source rect that covers `w`×`h` with an image of `iw`×`ih`, centred on `focus` (0–1). Pure. */
export function coverCrop(iw: number, ih: number, w: number, h: number, focusX = 0.5, focusY = 0.5): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (iw - sw) * focusX, sy: (ih - sh) * focusY, sw, sh };
}

/** Draws the photo covering `r`, zoomed by `zoom` (≥ 1) and drifted by `drift` (−1…1 per axis). */
export function drawPhotoCover(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  r: { x: number; y: number; w: number; h: number }, zoom = 1, driftX = 0, driftY = 0,
): void {
  const z = Math.max(1, zoom);
  const c = coverCrop(img.naturalWidth, img.naturalHeight, r.w, r.h);
  const sw = c.sw / z;
  const sh = c.sh / z;
  const sx = c.sx + (c.sw - sw) / 2 + (driftX * (c.sw - sw)) / 2;
  const sy = c.sy + (c.sh - sh) / 2 + (driftY * (c.sh - sh)) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
}
