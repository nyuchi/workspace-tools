# nyuchi-tools Worker

Source for the Cloudflare Worker that serves **all of `tools.nyuchi.com`**:

- `/mcp` — Model Context Protocol server (streamable-HTTP JSON-RPC) exposing
  `generate_email_signature`, `generate_studio_card`, and
  `generate_article_banner`.
- `/.well-known/mcp/server-card.json` — static MCP Server Card (name,
  version, website, remote transport, capabilities) for agent-readiness
  scanners and MCP clients that discover servers this way instead of via
  JSON-RPC.
- `/auth.md` — human/agent-readable description of the OAuth architecture
  (`text/markdown`). Documents that this server is a resource server only —
  the authorization server is identity.nyuchi.com (WorkOS Connect), outside
  this repo.
- `/.well-known/oauth-protected-resource` — protected-resource metadata (see
  `auth.ts`); JSON 404 when auth is off.
- `/.well-known/oauth-authorization-server` and
  `/.well-known/openid-configuration` — read-only mirrors of
  identity.nyuchi.com's own discovery documents, fetched and passed through
  (never fabricated) when auth is on; JSON 404 when auth is off. Responses
  are cached in-memory per-isolate for ~5 minutes as a soft optimization.
- everything else — the built `signature-generator/` SPA, bundled as Worker
  static assets (every route is a real HTML file; unknown paths get
  `dist/404.html`).

## Where things live

Deployment is configured **at the repo root**, not here:

- `../wrangler.toml` — Worker name, custom domain, assets directory
- `../package.json` — dependencies and the `dev:tools` / `deploy:tools` scripts
- `mcp/src/index.ts` — the Worker source (this directory)
- `mcp/tsconfig.json` — typecheck config (`npm run typecheck:worker` from root)

## Develop & deploy (from the repo root)

```bash
npm install
npm run build:web      # build the SPA into signature-generator/dist
npm run dev:tools      # wrangler dev — http://localhost:8787
npm run deploy:tools   # build SPA + wrangler deploy
```

`wrangler` reads `CLOUDFLARE_API_TOKEN` from the environment; the account is
pinned in `wrangler.toml`. The custom domain `tools.nyuchi.com` is managed by
Cloudflare (Workers Custom Domain on the `nyuchi.com` zone).

## Notes

- `generate_email_signature` imports the shared pure engine at
  `signature-generator/src/engines/signature` (the same module the SPA uses),
  so both surfaces emit byte-identical signature HTML.
- `generate_studio_card` and `generate_article_banner` import the real SVG
  engines (`signature-generator/src/engines/nyuchi` and `.../banner`) — the
  same modules the `/studio` and `/banner` pages render with. Workers have no
  canvas, so text measurement falls back to a committed font-metrics table
  (`signature-generator/src/engines/metrics/`, regenerated with
  `node scripts/extract-font-metrics.mjs` from `signature-generator/`).
  Each tool returns the SVG plus a second JSON content item:
  `{format: {w, h}, seed}`.
- PNG output is deferred: either `resvg-wasm` in the Worker or client-side
  canvas rasterization of the returned SVG.
- `protectedResourceMetadata()` (`auth.ts`) advertises `scopes_supported: []`
  — honest, not aspirational: this server only checks bearer-token issuer +
  audience today, no scope-based authorization.
- The three `client:only="react"` tool islands
  (`signature-generator/src/pages/{signature,studio,banner}/*Page.tsx`) each
  feature-detect `document.modelContext` (WebMCP) and, when present, register
  1–2 tools that call the exact same functions the UI's own buttons call
  (`downloadSvg`/`downloadPng`, `copyString`). Ambient types for
  `document.modelContext` live at
  `signature-generator/src/types/webmcp.d.ts`, since it isn't in TS's DOM lib
  yet.
