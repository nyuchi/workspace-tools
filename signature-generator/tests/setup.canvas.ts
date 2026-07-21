/* Deterministic canvas stub for the nyuchi SVG engine.
 *
 * The engine lazily calls `document.createElement('canvas').getContext('2d')`
 * and use `ctx.measureText(text).width` (after assigning `ctx.font`) to wrap
 * and auto-size text. In the node test environment there is no DOM, so this
 * setup file installs a minimal `document` global whose canvas context
 * measures text as chars × 0.53 × font-size (the same crude-but-realistic
 * approximation metrics-fallback.test.ts uses) — fully deterministic, so SVG
 * output is byte-stable across runs and machines. Size-awareness matters:
 * hook-mode title scaling grows text until it fills the measure, which a
 * fixed per-char width can't exercise.
 *
 * Registered as a vitest `setupFiles` entry, so it runs before any test file
 * (and therefore before any engine module) is imported.
 */

interface MeasureContextStub {
  font: string
  measureText: (text: string) => { width: number }
}

const measureContext: MeasureContextStub = {
  font: '',
  measureText(text: string) {
    const size = parseFloat(/([\d.]+)px/.exec(this.font)?.[1] ?? '16')
    return { width: text.length * size * 0.53 }
  },
}

const canvasStub = {
  getContext: (kind: string) => (kind === '2d' ? measureContext : null),
}

const documentStub = {
  createElement: (tag: string) => {
    if (tag !== 'canvas') {
      throw new Error(`document stub only supports createElement('canvas'), got '${tag}'`)
    }
    return canvasStub
  },
}

;(globalThis as { document?: unknown }).document = documentStub
