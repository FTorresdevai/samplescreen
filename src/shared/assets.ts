/**
 * Shared Asset Manager for SampleScreen
 * Resolves relative asset paths against Vite's BASE_URL and deduplicates image instances.
 */

export function getAssetUrl(relativePath: string): string {
  const base = ((import.meta as any).env?.BASE_URL || '/').replace(/\/+$/, '');
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}

const imageCache = new Map<string, HTMLImageElement>();
const listenersMap = new Map<string, Array<() => void>>();

/**
 * Retrieves a cached image instance. If not yet loaded, initiates loading.
 * Returns the HTMLImageElement only when it is fully loaded (naturalWidth > 0).
 */
export function getCachedImage(relativePath: string, onLoaded?: () => void): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;

  const url = getAssetUrl(relativePath);
  let img = imageCache.get(url);

  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    imageCache.set(url, img);

    if (onLoaded) {
      listenersMap.set(url, [onLoaded]);
    }

    img.onload = () => {
      const callbacks = listenersMap.get(url);
      if (callbacks) {
        callbacks.forEach(cb => {
          try { cb(); } catch {}
        });
        listenersMap.delete(url);
      }
    };

    img.onerror = (e) => {
      console.warn(`[SampleScreen] Failed to load image asset at "${url}":`, e);
    };
  } else if (onLoaded && !img.complete) {
    const list = listenersMap.get(url) || [];
    list.push(onLoaded);
    listenersMap.set(url, list);
  }

  return (img.complete && img.naturalWidth > 0) ? img : null;
}
