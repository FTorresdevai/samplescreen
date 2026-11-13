import { ModeManifest, ModeModule } from '../types';

/**
 * Plug-and-play discovery: every folder src/modes/<kind>/<id>/ with a
 * manifest.ts + index.ts is a mode. Manifests load eagerly (tiny metadata);
 * draw code loads on demand as its own chunk.
 */
const manifests = import.meta.glob<{ default: ModeManifest }>('./*/*/manifest.ts', { eager: true });
const loaders = import.meta.glob<{ default: ModeModule }>('./*/*/index.ts');

export const FALLBACK_MODE_ID = 'linear';  // unknown id → linear
export const DEFAULT_MODE_ID = 'take-care'; // mode shown on first load

export const MODE_MANIFESTS: ModeManifest[] = Object.values(manifests).map(m => m.default);

/** Retired mode ids (13/11) → their replacement, so old links and saved ids keep working. */
export const LEGACY_MODE_IDS: Record<string, string> = {
  circular: 'ink-roll',        // Polar Sequencer
  'orbital-moon': 'aero-desktop', // 3D Celestial Orbit
  aureola: 'signal-plate',     // Prismatic Aureole
};

export { inputTag, INPUT_TAG_LABEL, type InputTag } from '../core/mode-resolution';

export function findManifest(id: string | null | undefined): ModeManifest | undefined {
  const resolved = id ? LEGACY_MODE_IDS[id] ?? id : id;
  return MODE_MANIFESTS.find(m => m.id === resolved);
}

export function getManifest(id: string | null | undefined): ModeManifest {
  return findManifest(id) ?? findManifest(FALLBACK_MODE_ID)!;
}

export async function loadMode(id: string): Promise<ModeModule> {
  const id_ = getManifest(id).id;
  const entry = Object.entries(loaders).find(([path]) => path.endsWith(`/${id_}/index.ts`));
  if (!entry) throw new Error(`[modes] No index.ts for mode "${id_}"`);
  return (await entry[1]()).default;
}
