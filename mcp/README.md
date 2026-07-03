# nyuchi-tools Worker

Source for the Cloudflare Worker that serves **all of `tools.nyuchi.com`**:

- `/mcp` — Model Context Protocol server (streamable-HTTP JSON-RPC) exposing
  `generate_email_signature`, `generate_studio_card`, and
  `generate_article_banner`.
- everything else — the built `signature-generator/` SPA, bundled as Worker
  static assets with single-page-application fallback.

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
