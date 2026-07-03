/* Deterministic canvas stub for the nyuchi/banner SVG engines.
 *
 * Both engines lazily call `document.createElement('canvas').getContext('2d')`
 * and use `ctx.measureText(text).width` (after assigning `ctx.font`) to wrap
 * and auto-size text. In the node test environment there is no DOM, so this
 * setup file installs a minimal `document` global whose canvas context
 * measures text as a fixed 8px per character — fully deterministic, so SVG
 * output is byte-stable across runs and machines.
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
  measureText: (text: string) => ({ width: text.length * 8 }),
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
