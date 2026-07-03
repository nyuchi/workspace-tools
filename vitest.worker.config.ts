import { defineConfig } from 'vitest/config'

// Worker (mcp/src) test setup. Lives at the repo root because the Worker's
// runtime deps (hono, @modelcontextprotocol/sdk, zod, jose) are root
// package.json dependencies — mcp/ intentionally has no package.json.
// The Worker is plain Hono (no cloudflare: imports), so node is sufficient.
// mcp/tsconfig.json only includes src/**, so `npm run typecheck:worker`
// is unaffected by the tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['mcp/tests/**/*.test.ts'],
  },
})
