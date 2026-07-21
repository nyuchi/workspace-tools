import { describe, expect, it } from 'vitest'
import {
  buildSVG,
  CATEGORIES,
  FORMATS,
  hash,
  type Brand,
  type Category,
  type FormatKey,
  type Params,
} from '../src/engines/nyuchi'

const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[]
const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]
const LAYOUTS = [1, 2, 3, 4, 5] as const

const baseParams = (overrides: Partial<Params> = {}): Params => ({
  format: '16x9',
  layout: 1,
  theme: 'light',
  category: 'gold',
  title: 'The Hive Economy',
  dek: 'How connected communities compound value across the continent.',
  seedKey: 'test-seed',
  lockup: true,
  lattice: true,
  ...overrides,
})

describe('hash (FNV-1a)', () => {
  it('matches the FNV-1a offset basis for the empty string', () => {
    expect(hash('')).toBe(2166136261)
  })

  it('is deterministic and input-sensitive', () => {
    expect(hash('nyuchi')).toBe(hash('nyuchi'))
    expect(hash('a')).not.toBe(hash('b'))
  })
})

describe('buildSVG — every layout x every format', () => {
  for (const layout of LAYOUTS) {
    for (const format of FORMAT_KEYS) {
      it(`layout ${layout} / format ${format} renders a well-formed SVG at the right size`, () => {
        const { svg, format: fmt, seed } = buildSVG(baseParams({ layout, format }))
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.endsWith('</svg>')).toBe(true)
        expect(fmt).toBe(FORMATS[format])
        expect(svg).toContain(`viewBox="0 0 ${FORMATS[format].w} ${FORMATS[format].h}"`)
        expect(svg).toContain(`width="${FORMATS[format].w}"`)
        expect(svg).toContain(`height="${FORMATS[format].h}"`)
        expect(seed).toBe(hash('test-seed' + 'gold' + layout))
      })
    }
  }
})

describe('buildSVG — seeding', () => {
  it('same seedKey → same seed and byte-identical SVG', () => {
    const a = buildSVG(baseParams())
    const b = buildSVG(baseParams())
    expect(b.seed).toBe(a.seed)
    expect(b.svg).toBe(a.svg)
  })

  it('different seedKey → different seed and different SVG', () => {
    const a = buildSVG(baseParams({ seedKey: 'seed-one' }))
    const b = buildSVG(baseParams({ seedKey: 'seed-two' }))
    expect(b.seed).not.toBe(a.seed)
    expect(b.svg).not.toBe(a.svg)
  })

  it('seed also varies with category and layout', () => {
    const a = buildSVG(baseParams({ category: 'gold' }))
    const b = buildSVG(baseParams({ category: 'cobalt' }))
    expect(b.seed).not.toBe(a.seed)
    const c = buildSVG(baseParams({ layout: 2 }))
    expect(c.seed).not.toBe(a.seed)
  })
})

describe('buildSVG — all 7 categories render with their palette', () => {
  for (const key of CATEGORY_KEYS) {
    it(`category ${key} uses its light hex in light theme`, () => {
      const { svg } = buildSVG(baseParams({ category: key, theme: 'light', layout: 1 }))
      expect(svg).toContain(CATEGORIES[key].light)
    })

    it(`category ${key} uses its dark hex in dark theme`, () => {
      const { svg } = buildSVG(baseParams({ category: key, theme: 'dark', layout: 1 }))
      expect(svg).toContain(CATEGORIES[key].dark)
    })
  }

  it('the mineral layout (5) prints both swatch hexes', () => {
    for (const key of CATEGORY_KEYS) {
      const { svg } = buildSVG(baseParams({ category: key, layout: 5 }))
      expect(svg).toContain(`DARK ${CATEGORIES[key].dark}`)
      expect(svg).toContain(`LIGHT ${CATEGORIES[key].light}`)
    }
  })
})

describe('buildSVG — escaping', () => {
  it('escapes <script> injected via the title (all layouts)', () => {
    for (const layout of LAYOUTS) {
      const { svg } = buildSVG(baseParams({ layout, title: '<script>alert("x")</script>' }))
      expect(svg).not.toContain('<script>')
      expect(svg).toContain('&lt;script&gt;')
    }
  })

  it('escapes hostile dek and eyebrow text', () => {
    const { svg } = buildSVG(
      baseParams({ dek: 'a & b <i>"quoted"</i>', eyebrow: '<style>bad</style>' }),
    )
    expect(svg).not.toContain('<i>')
    expect(svg).not.toContain('<style>')
    expect(svg).toContain('&amp; b &lt;i&gt;')
    expect(svg).toContain('&lt;STYLE&gt;')
  })
})

describe('buildSVG — lockup brands', () => {
  const LOCKUPS: [Brand, string][] = [
    ['nyuchi', 'nyuchi.com'],
    ['bundu', 'bundu.org'],
    ['mukoko', 'mukoko.com'],
    ['shamwari', 'shamwari.ai'],
  ]

  for (const [brand, label] of LOCKUPS) {
    it(`brand ${brand} renders the ${label} lockup wordmark deterministically`, () => {
      const params = baseParams({ brand, lockup: true })
      const { svg } = buildSVG(params)
      expect(svg).toContain(`>${label}</text>`)
      expect(buildSVG(params).svg).toBe(svg)
    })
  }

  it('brands without a registered icon fall back to the drawn o2 mark', () => {
    // No icons are registered in this suite, so every lockup uses the mark.
    const { svg } = buildSVG(baseParams({ brand: 'shamwari', lockup: true }))
    expect(svg).not.toContain('<image')
    expect(svg).toContain('>shamwari.ai</text>')
  })

  it('the mineral layout (5) places the lockup for every brand', () => {
    for (const [brand, label] of LOCKUPS) {
      const { svg } = buildSVG(baseParams({ brand, lockup: true, layout: 5 }))
      expect(svg).toContain(`>${label}</text>`)
    }
  })
})

describe('buildSVG — dek typography (2026-07 Studio fixes)', () => {
  /** Pull every dek <text> node (italic Noto Serif) with its size + fill. */
  const dekNodes = (svg: string): { size: number; fill: string }[] =>
    [...svg.matchAll(/font-style="italic" font-size="(\d+)" fill="([^"]+)"/g)].map((m) => ({
      size: Number(m[1]),
      fill: m[2],
    }))
  const titleSize = (svg: string): number =>
    Number(svg.match(/font-weight="700" font-size="(\d+)"/)![1])

  it('dek defaults to the surface foreground, not the muted grey (layouts 1-4)', () => {
    for (const layout of [1, 2, 3, 4]) {
      const dark = buildSVG(baseParams({ layout, theme: 'dark', format: 'ig' })).svg
      for (const d of dekNodes(dark)) expect(d.fill).toBe('#FAF9F5')
      const light = buildSVG(baseParams({ layout, theme: 'light', format: 'ig' })).svg
      for (const d of dekNodes(light)) expect(d.fill).toBe('#141413')
    }
  })

  it('dek renders near the title size (title ≈ 1.05-1.15× dek) for a short dek', () => {
    for (const format of FORMAT_KEYS) {
      for (const layout of [1, 2, 3, 4]) {
        const { svg } = buildSVG(
          baseParams({ layout, format, title: 'Nhimbe', dek: 'Gathering, discovered.' }),
        )
        const dek = dekNodes(svg)
        expect(dek.length).toBeGreaterThan(0)
        const ratio = titleSize(svg) / dek[0].size
        expect(ratio).toBeGreaterThanOrEqual(1.0)
        expect(ratio).toBeLessThanOrEqual(1.25)
      }
    }
  })

  it('ig layout 1 lands on the validated reference sizes (title 70, dek ~60)', () => {
    const { svg } = buildSVG(
      baseParams({ layout: 1, format: 'ig', title: 'Nhimbe', dek: 'Gathering, discovered.' }),
    )
    expect(titleSize(svg)).toBe(70)
    expect(dekNodes(svg)[0].size).toBe(62)
  })

  it('honors dekFontSize and dekColor overrides', () => {
    const { svg } = buildSVG(
      baseParams({ layout: 1, format: 'ig', dek: 'Short dek.', dekFontSize: 44, dekColor: '#FFD740' }),
    )
    const dek = dekNodes(svg)
    expect(dek[0].size).toBe(44)
    expect(dek[0].fill).toBe('#FFD740')
  })

  it('ignores an invalid dekColor (attribute-injection guard)', () => {
    const { svg } = buildSVG(
      baseParams({ layout: 1, theme: 'dark', dek: 'Short dek.', dekColor: '"><script>x</script>' }),
    )
    expect(svg).not.toContain('<script>')
    expect(dekNodes(svg)[0].fill).toBe('#FAF9F5')
  })

  it('layout 4 (halo) draws a fully opaque text scrim — no graph bleed-through', () => {
    for (const format of FORMAT_KEYS) {
      const { svg } = buildSVG(baseParams({ layout: 4, format }))
      const scrim = svg.match(/<rect [^>]*fill="#[^"]+"[^>]*\/>/g)!.find((r) => !r.includes('width="16') && !r.includes('opacity'))
      expect(scrim).toBeTruthy()
      expect(svg).not.toContain('opacity=".82"')
    }
  })
})

describe('buildSVG — determinism', () => {
  it('two calls with identical params are byte-identical for every layout', () => {
    for (const layout of LAYOUTS) {
      const params = baseParams({ layout, format: 'story', theme: 'dark' })
      expect(buildSVG(params).svg).toBe(buildSVG(params).svg)
    }
  })
})
