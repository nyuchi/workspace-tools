/* Workers-fallback tests: text measurement without a canvas.
 *
 * tests/setup.canvas.ts installs a deterministic 8px-per-char canvas stub
 * before every test file. This file replaces that stub with a SIZE-AWARE one
 * (width = chars × 0.53 × font-size, a crude but realistic browser
 * approximation), imports the engines fresh, renders via the canvas path,
 * then DELETES the global `document` entirely to exercise the font-metrics
 * fallback the MCP Worker relies on — and checks that both paths produce
 * similar (not identical) wrap results and that the fallback is
 * deterministic. Vitest isolates modules per test file, so the engine module
 * instances (and their cached measure context) are private to this file.
 */

import { beforeAll, describe, expect, it } from 'vitest'

type NyuchiEngine = typeof import('../src/engines/nyuchi')

interface FontContextStub {
  font: string
  measureText(text: string): { width: number }
}

function installSizeAwareCanvasStub(): void {
  const ctx: FontContextStub = {
    font: '16px sans-serif',
    measureText(text: string) {
      const size = parseFloat(/([\d.]+)px/.exec(this.font)?.[1] ?? '16')
      return { width: text.length * size * 0.53 }
    },
  }
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => ({ getContext: (kind: string) => (kind === '2d' ? ctx : null) }),
  }
}

function deleteDocument(): void {
  delete (globalThis as { document?: unknown }).document
}

const LONG_TITLE = 'The long-run economics of community-owned connectivity infrastructure'
const DEK = 'How connected communities compound value across the continent.'

/* In layout 1 of both engines, the title lines are the only <text> elements
   emitted with font-weight="700". */
function titleLineCount(svg: string): number {
  return (svg.match(/font-weight="700"/g) ?? []).length
}

const NYUCHI_WRAP_PARAMS = {
  format: '16x9',
  layout: 1,
  theme: 'light',
  category: 'gold',
  title: LONG_TITLE,
  dek: DEK,
  seedKey: 'wrap-test',
  lockup: true,
  lattice: true,
} as const

let nyuchi: NyuchiEngine
let canvasNyuchiSvg = ''

beforeAll(async () => {
  installSizeAwareCanvasStub()
  nyuchi = await import('../src/engines/nyuchi')
  /* Render once through the canvas path (document present)… */
  canvasNyuchiSvg = nyuchi.buildSVG(NYUCHI_WRAP_PARAMS).svg
  /* …then drop the DOM so every render below uses the metrics fallback. */
  deleteDocument()
})

describe('metrics fallback vs canvas path — wrap similarity', () => {
  it('nyuchi: long-title line counts are within ±1 of the canvas path', () => {
    const metricsSvg = nyuchi.buildSVG(NYUCHI_WRAP_PARAMS).svg
    const canvasLines = titleLineCount(canvasNyuchiSvg)
    const metricsLines = titleLineCount(metricsSvg)
    expect(canvasLines).toBeGreaterThan(1)
    expect(Math.abs(metricsLines - canvasLines)).toBeLessThanOrEqual(1)
    /* Similar, not identical — the flat-width stub and real per-character
       advances should not agree byte-for-byte. */
    expect(metricsSvg).not.toBe(canvasNyuchiSvg)
  })
})

describe('buildSVG without a document (Workers environment)', () => {
  it('document really is gone', () => {
    expect((globalThis as { document?: unknown }).document).toBeUndefined()
  })

  const nyuchiCases = [
    { ...NYUCHI_WRAP_PARAMS, layout: 5, format: 'ig', theme: 'dark' },
    { ...NYUCHI_WRAP_PARAMS, layout: 2, format: 'og', category: 'malachite' },
  ] as const

  for (const params of nyuchiCases) {
    it(`nyuchi layout ${params.layout} / ${params.format} renders valid, deterministic SVG`, () => {
      const a = nyuchi.buildSVG(params)
      const b = nyuchi.buildSVG(params)
      expect(a.svg.startsWith('<svg')).toBe(true)
      expect(a.svg.endsWith('</svg>')).toBe(true)
      expect(a.svg).toContain(`viewBox="0 0 ${a.format.w} ${a.format.h}"`)
      expect((a.svg.match(/<circle /g) ?? []).length).toBeGreaterThan(5)
      expect(b.svg).toBe(a.svg)
      expect(b.seed).toBe(a.seed)
    })
  }


  it('escapes markup in the title on the metrics path too', () => {
    const { svg } = nyuchi.buildSVG({ ...NYUCHI_WRAP_PARAMS, title: 'Attack <script>alert(1)</script>' })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
})
