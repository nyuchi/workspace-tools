import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vitest/config'

// mcp/src/raster.ts imports @resvg/resvg-wasm's binary the way Wrangler's
// CompiledWasm module rule expects (default export = WebAssembly.Module).
// Node/vite has no such rule — left alone, the import is externalized to
// node's ESM loader, which tries to link the binary's 'wbg' bindings import
// and fails. So: inline the .wasm id (server.deps.inline below) to keep it
// in the Vite pipeline, where this plugin compiles it to a Module.
const compiledWasm: Plugin = {
  name: 'compiled-wasm',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('.wasm')) return null
    const bytes = readFileSync(id)
    return {
      code: `const bytes = Uint8Array.from(atob(${JSON.stringify(
        bytes.toString('base64'),
      )}), (c) => c.charCodeAt(0));\nexport default new WebAssembly.Module(bytes);`,
    }
  },
}

// Worker (mcp/src) test setup. Lives at the repo root because the Worker's
// runtime deps (hono, @modelcontextprotocol/sdk, zod, jose) are root
// package.json dependencies — mcp/ intentionally has no package.json.
// The Worker is plain Hono (no cloudflare: imports), so node is sufficient.
// mcp/tsconfig.json only includes src/**, so `npm run typecheck:worker`
// is unaffected by the tests.
export default defineConfig({
  plugins: [compiledWasm],
  test: {
    environment: 'node',
    include: ['mcp/tests/**/*.test.ts'],
    testTimeout: 20000,
    server: {
      deps: {
        inline: [/\.wasm$/, /@resvg\/resvg-wasm/],
      },
    },
  },
})
