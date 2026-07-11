# nyuchi-tools Worker

Source for the Cloudflare Worker that serves **all of `tools.nyuchi.com`**
(the site) **and `tools.nyuchi.dev`** (the canonical MCP endpoint — same
Worker, same code, two Workers Custom Domains; see the `MCP_RESOURCE`
comment in `../wrangler.toml` for why `/mcp` lives on a separate hostname):

- `/mcp` — Model Context Protocol server (streamable-HTTP JSON-RPC) exposing
  `generate_email_signature`, `generate_studio_card`, and
  `generate_article_banner`. Has its own bearer-token gate (see below); never
  double-gated by the site-wide login gate. Reachable on both domains, but
  `tools.nyuchi.dev/mcp` is the one advertised by discovery metadata.
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
- `/login`, `/callback`, `/logout` — the **site-wide login gate** (see
  below). `/callback` is the fixed value of `CALLBACK_PATH` in `site-auth.ts`.
- everything else (Home, Help, Setup, the gmail-addon docs, Studio, Signature
  Generator, Banner, and any other page in the built SPA) — the built
  `signature-generator/` site, served as Worker static assets **only after
  the login gate passes** (every route is a real HTML file; unknown paths
  get `dist/404.html`).

## Site-wide login gate

Every human-facing page sits behind a session cookie (`nyuchi_session`), a
compact HS256 JWT signed with the `SESSION_SECRET` secret. The flow (see
`site-auth.ts`) is Authorization Code + PKCE against the same WorkOS Connect
app that already protects `/mcp` (`client_01KVTX0V2K1VM3PSC0DJ9VZWTV`,
authorization server `identity.nyuchi.com`), used here as a public client
(`token_endpoint_auth_method=none` — no client secret is ever sent):

- `GET /login` — validates `?return_to=` as a same-origin relative path
  (rejects absolute/protocol-relative URLs, falling back to `/`), generates
  PKCE `state`/`code_verifier`/`code_challenge`, stashes them in a
  short-lived `nyuchi_oauth` cookie, and 302s to
  `https://identity.nyuchi.com/oauth2/authorize`. Returns 500 (fails closed)
  if `SESSION_SECRET` isn't configured, rather than starting an OAuth round
  trip that could never succeed.
- `GET /callback` — reads the `nyuchi_oauth` cookie, verifies `state`
  matches, exchanges `code` for an access token, verifies that token with
  the exact same JWKS/issuer/audience logic `/mcp`'s bearer-token gate uses
  (`verifyJwt` in `auth.ts` — factored out so this logic exists in exactly
  one place), mints the `nyuchi_session` cookie, clears the oauth cookie,
  and 302s to the validated `return_to`. Any failure (state mismatch,
  exchange failure, invalid token, no configured secret) clears both cookies
  and redirects to `/login?error=1` without leaking why.
- `GET /logout` — clears the session cookie and 302s to `/`.
- A global Hono middleware (`app.use('*', ...)`, registered before every
  other route) verifies the session cookie on every request and redirects
  to `/login?return_to=<original path+query>` when it's missing or invalid,
  **except** for this exact exempt list:
  `/mcp`, `/mcp/*`, `/.well-known/*`, `/auth.md`, `/register`, `/login`,
  `/callback`, `/logout`. (`signature-generator/public` has no
  `robots.txt` / `llms.txt` / `llms-full.txt` / `ads.txt` today, so there was
  nothing else to add; add them here too if any of those files show up
  later.) A catch-all route (`app.all("*", (c) => c.env.ASSETS.fetch(...))`)
  registered *last* serves the built site once the gate passes.
- **`SESSION_SECRET` must be provisioned before this works in production:**
  `wrangler secret put SESSION_SECRET` — it is deliberately not in
  `wrangler.toml`'s `[vars]` (that would commit it in plaintext). Every
  session-cookie check fails CLOSED (denies access) when it's unset; it
  never falls back to running the site open.
- Because the login gate runs for every path, `run_worker_first` in
  `wrangler.toml` is `true` (the Worker runs first for every request, not
  just a fixed path list) and `[assets]` has an explicit `binding = "ASSETS"`
  so `c.env.ASSETS.fetch(...)` can serve the static build from inside the
  Worker after the gate passes.

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
pinned in `wrangler.toml`. Both custom domains are managed by Cloudflare:
`tools.nyuchi.com` (Workers Custom Domain on the `nyuchi.com` zone) and
`tools.nyuchi.dev` (Workers Custom Domain on the `nyuchi.dev` zone).

For local testing only, pass a throwaway session secret since `wrangler.toml`
deliberately has none:

```bash
npx wrangler dev --var SESSION_SECRET:test-secret-do-not-use-in-prod
```

Never use a throwaway value like that in production — set the real one with
`wrangler secret put SESSION_SECRET` (see above).

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
- `verifyJwt(env, token)` (`auth.ts`) is the one place that does JWKS/issuer/
  audience verification against `AUTHKIT_DOMAIN`; both `/mcp`'s bearer-token
  gate (`verifyBearer`) and the site-wide login callback (`site-auth.ts`,
  verifying the access token from its own PKCE token exchange) call it —
  neither reimplements the jose/JWKS logic.
- The three `client:only="react"` tool islands
  (`signature-generator/src/pages/{signature,studio,banner}/*Page.tsx`) each
  feature-detect `document.modelContext` (WebMCP) and, when present, register
  1–2 tools that call the exact same functions the UI's own buttons call
  (`downloadSvg`/`downloadPng`, `copyString`). Ambient types for
  `document.modelContext` live at
  `signature-generator/src/types/webmcp.d.ts`, since it isn't in TS's DOM lib
  yet.
