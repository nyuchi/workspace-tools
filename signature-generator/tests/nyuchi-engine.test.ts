import { describe, expect, it } from 'vitest'
import {
  buildSVG,
  CATEGORIES,
  FORMATS,
  hash,
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

describe('buildSVG — determinism', () => {
  it('two calls with identical params are byte-identical for every layout', () => {
    for (const layout of LAYOUTS) {
      const params = baseParams({ layout, format: 'story', theme: 'dark' })
      expect(buildSVG(params).svg).toBe(buildSVG(params).svg)
    }
  })
})
