import { defineConfig } from 'vitest/config'

// Engine tests are pure-node: no DOM environment needed. The nyuchi engine
// lazily grabs a canvas 2c context for text measurement; a deterministic
// stub is installed by tests/setup.canvas.ts before any engine module is
// imported. Paths mirror the repo layout: engines at ../../engines, the
// console pages under ../src/pages/signature.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.canvas.ts'],
  },
})
