import { TOP_BRANDS, type TopBrandKey } from '../engines/brands'

/**
 * Load every per-theme brand icon the registry knows about and register it
 * with an SVG engine's icon store. Each vendored PNG under
 * public/assets/brand-icons/ has a same-named `.b64.txt` companion so the
 * engines can embed the image as a data URI inside exported SVG/PNG.
 *
 * Missing files resolve silently — the engines draw a wordmark-only lockup
 * (or their built-in mark) for brands without a registered icon.
 */
export async function loadBrandIcons(
  setBrandIcon: (brand: TopBrandKey, dataUri: string, theme?: 'light' | 'dark') => void,
): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const brand of Object.values(TOP_BRANDS)) {
    for (const theme of ['light', 'dark'] as const) {
      const path = brand.icon[theme]
      if (!path || !path.endsWith('.png')) continue
      jobs.push(
        fetch(path.replace(/\.png$/, '.b64.txt'))
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${path}: ${r.status}`))))
          .then((txt) => setBrandIcon(brand.key, 'data:image/png;base64,' + txt.trim(), theme))
          .catch(() => {
            /* wordmark-only fallback */
          }),
      )
    }
  }
  await Promise.all(jobs)
}
