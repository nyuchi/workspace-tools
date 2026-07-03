import { defineConfig } from 'vitest/config'

// Engine tests are pure-node: no DOM environment needed. The nyuchi/banner
// engines lazily grab a canvas 2d context for text measurement; a
// deterministic stub is installed by tests/setup.canvas.ts before any
// engine module is imported.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.canvas.ts'],
  },
})
