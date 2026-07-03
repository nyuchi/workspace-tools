import { describe, expect, it } from 'vitest'
import {
  BRANDS,
  buildSVG,
  CATEGORIES,
  FORMATS,
  hashString,
  LAYOUTS,
  type Brand,
  type Category,
  type FormatKey,
  type Params,
} from '../src/engines/banner'

const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[]
const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]
const LAYOUT_KEYS = Object.keys(LAYOUTS).map(Number)

const baseParams = (overrides: Partial<Params> = {}): Params => ({
  format: 'og',
  layout: 1,
  theme: 'light',
  category: 'malachite',
  title: 'Rivers of the Zambezi Basin',
  dek: 'A field guide to the waterways that shape Southern Africa.',
  seedKey: 'banner-seed',
  lockup: true,
  lattice: true,
  ...overrides,
})

describe('hashString (FNV-1a)', () => {
  it('matches the FNV-1a offset basis for the empty string', () => {
    expect(hashString('')).toBe(2166136261)
  })

  it('is deterministic and input-sensitive', () => {
    expect(hashString('banner')).toBe(hashString('banner'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})

describe('buildSVG — every layout x every format', () => {
  it('exposes exactly 4 named layouts', () => {
    expect(LAYOUT_KEYS).toEqual([1, 2, 3, 4])
  })

  for (const layout of [1, 2, 3, 4]) {
    for (const format of FORMAT_KEYS) {
      it(`layout ${layout} / format ${format} renders a well-formed SVG at the right size`, () => {
        const { svg, format: fmt, seed } = buildSVG(baseParams({ layout, format }))
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.endsWith('</svg>')).toBe(true)
        expect(fmt).toBe(FORMATS[format])
        expect(svg).toContain(`viewBox="0 0 ${FORMATS[format].w} ${FORMATS[format].h}"`)
        expect(svg).toContain(`width="${FORMATS[format].w}"`)
        expect(svg).toContain(`height="${FORMATS[format].h}"`)
        expect(seed).toBe(hashString('banner-seed'))
      })
    }
  }

  it('an unknown layout falls back to layout 1 output', () => {
    const known = buildSVG(baseParams({ layout: 1 }))
    const fallback = buildSVG(baseParams({ layout: 99 }))
    expect(fallback.svg).toBe(known.svg)
  })
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

  it('without seedKey the seed is derived from title·category·layout', () => {
    const params = baseParams({ seedKey: undefined })
    const { seed } = buildSVG(params)
    expect(seed).toBe(hashString('Rivers of the Zambezi Basin·malachite·1'))
    const other = buildSVG(baseParams({ seedKey: undefined, title: 'A different title' }))
    expect(other.seed).not.toBe(seed)
  })
})

describe('buildSVG — all 7 categories render with their palette', () => {
  for (const key of CATEGORY_KEYS) {
    it(`category ${key} uses its light hex in light theme`, () => {
      const { svg } = buildSVG(baseParams({ category: key, theme: 'light' }))
      expect(svg).toContain(CATEGORIES[key].light)
    })

    it(`category ${key} uses its dark hex in dark theme`, () => {
      const { svg } = buildSVG(baseParams({ category: key, theme: 'dark' }))
      expect(svg).toContain(CATEGORIES[key].dark)
    })
  }
})

describe('buildSVG — escaping', () => {
  it('escapes <script> injected via the title (all layouts)', () => {
    for (const layout of [1, 2, 3, 4]) {
      const { svg } = buildSVG(baseParams({ layout, title: '<script>alert("x")</script>' }))
      expect(svg).not.toContain('<script>')
      expect(svg).toContain('&lt;script&gt;')
    }
  })

  it('escapes hostile dek text', () => {
    const { svg } = buildSVG(baseParams({ dek: 'a & b <img src=x onerror=alert(1)>' }))
    expect(svg).not.toContain('<img')
    expect(svg).toContain('&amp; b &lt;img')
  })
})

describe('buildSVG — lockup brands', () => {
  const LOCKUPS: [Brand, string][] = [
    ['nyuchi', 'nyuchi.com'],
    ['bundu', 'bundu.org'],
    ['mukoko', 'mukoko.com'],
    ['shamwari', 'shamwari.ai'],
  ]

  it('BRANDS covers exactly the four top-level brands with their lockup URLs', () => {
    expect(Object.keys(BRANDS).sort()).toEqual(['bundu', 'mukoko', 'nyuchi', 'shamwari'])
    for (const [brand, label] of LOCKUPS) {
      expect(BRANDS[brand].url).toBe(label)
    }
  })

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
    const { svg } = buildSVG(baseParams({ brand: 'mukoko', lockup: true }))
    expect(svg).not.toContain('<image')
    expect(svg).toContain('>mukoko.com</text>')
  })
})

describe('buildSVG — determinism', () => {
  it('two calls with identical params are byte-identical for every layout', () => {
    for (const layout of [1, 2, 3, 4]) {
      const params = baseParams({ layout, format: 'ig', theme: 'dark' })
      expect(buildSVG(params).svg).toBe(buildSVG(params).svg)
    }
  })
})
