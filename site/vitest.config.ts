import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Engine tests are pure-node: no DOM environment needed. The nyuchi engine
// lazily grabs a canvas 2c context for text measurement; a deterministic
// stub is installed by tests/setup.canvas.ts before any engine module is
// imported. The @engines alias mirrors astro.config.mjs so the console
// pages (src/pages/signature) resolve the shared engines too.
export default defineConfig({
  resolve: {
    alias: {
      '@engines': fileURLToPath(new URL('../engines', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.canvas.ts'],
  },
})
