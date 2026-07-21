/**
 * Registers the real per-brand icons (the same vendored PNGs the SPA's
 * Studio page uses) with the Studio engine's icon store, so
 * generate_studio_card draws the actual brand mark instead of falling back
 * to the engine's generic placeholder mark.
 *
 * loadBrandIcons() normally resolves its icon paths with the browser's own
 * fetch — there's no page origin to resolve a relative path against inside
 * a Worker, so this passes a fetch implementation backed by the `ASSETS`
 * binding instead (the vendored PNGs/`.b64.txt` files are static-passthrough
 * assets, bundled into the same `signature-generator/dist` the Worker
 * serves everything else from).
 *
 * Cached per isolate: the icon set never changes at runtime, so this only
 * does real work once per cold start.
 */

import { loadBrandIcons } from "../../signature-generator/src/lib/loadBrandIcons";
import { setBrandIcon as setStudioIcon } from "../../signature-generator/src/engines/nyuchi";

let cached: Promise<void> | null = null;

export function ensureBrandIconsLoaded(assets: Fetcher | undefined): Promise<void> {
  if (!assets) return Promise.resolve();
  if (!cached) {
    const assetsFetch: typeof fetch = (input) => {
      const path = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      return assets.fetch(new Request(new URL(path, "https://assets.internal")));
    };
    cached = loadBrandIcons(setStudioIcon, assetsFetch).then(() => undefined);
  }
  return cached;
}
