import { HardwareModule, ModeManifest, ModeModule, SynthTheme, VisualizerSettings } from '../types';
import { getManifest, loadMode } from '../modes/registry';
import { loadHardware } from '../hardware/registry';
import { resolveHardwareId, resolveSynthTheme } from '../core/mode-resolution';

/** Everything the renderer needs for one frame, already loaded (render stays synchronous). */
export interface RenderModules {
  manifest: ModeManifest;
  mode: ModeModule;
  hardware: HardwareModule;
  theme: SynthTheme;
}

const cache = new Map<string, Promise<RenderModules>>();
const ready = new Map<string, RenderModules>();

function keyFor(s: VisualizerSettings, hasMidi: boolean): { key: string; manifest: ModeManifest; hardwareId: string } {
  const manifest = getManifest(s.modeId);
  const hardwareId = resolveHardwareId(manifest, s, hasMidi);
  return { key: `${manifest.id}|${hardwareId}`, manifest, hardwareId };
}

export function loadRenderModules(s: VisualizerSettings, hasMidi: boolean): Promise<RenderModules> {
  const { key, manifest, hardwareId } = keyFor(s, hasMidi);
  let pending = cache.get(key);
  if (!pending) {
    pending = Promise.all([loadMode(manifest.id), loadHardware(hardwareId)]).then(([mode, hardware]) => {
      const modules = { manifest, mode, hardware, theme: resolveSynthTheme(manifest) };
      ready.set(key, modules);
      return modules;
    });
    pending.catch(() => cache.delete(key)); // allow a retry after a failed chunk load
    cache.set(key, pending);
  }
  return pending;
}

/** Synchronous lookup for the RAF loop: the modules if already loaded, else null. */
export function peekRenderModules(s: VisualizerSettings, hasMidi: boolean): RenderModules | null {
  return ready.get(keyFor(s, hasMidi).key) ?? null;
}
