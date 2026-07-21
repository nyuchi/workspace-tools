# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Sub-projects for managing Nyuchi Africa email signatures and design assets. They share branding but **no code** — the TypeScript side shares one brand registry (`signature-generator/src/engines/brands`); the Apps Script projects each maintain a hand-synced copy of the brand list.

| Directory | Stack | Purpose | Deploy target |
|-----------|-------|---------|---------------|
| `gmail-addon/` | Google Apps Script (V8) | Gmail Add-on (CardService UI) + admin web dashboard | Apps Script via clasp |
| `email-signature/` | Google Apps Script (V8) | Admin batch script: push signatures to all domain users & aliases | Apps Script via clasp |
| `signature-generator/` | Astro (static) + React 19 islands + TypeScript + `@bundu/ui` | Standalone web app: signature builder, Nyuchi Studio (social cards), banner generator, setup docs | Bundled into the `nyuchi-tools` Worker as static assets |
| `mcp/src/` | Cloudflare Workers + Hono + `@modelcontextprotocol/sdk` | Source of the `nyuchi-tools` Worker: serves the built static site **and** the MCP HTTP server | Workers Custom Domain on `tools.nyuchi.com` (site) **and** `tools.nyuchi.dev` (MCP) — same Worker, two domains (config: root `wrangler.toml`) |

The repo root package.json carries the Apps Script npm workspace **and** the Worker's dependencies + deploy scripts; `signature-generator/` is a separate npm project with its own lockfile. `mcp/` holds only Worker source and its tsconfig — no package.json.

## URL layout: `tools.nyuchi.com` (site) + `tools.nyuchi.dev` (MCP)

One Cloudflare Worker (`nyuchi-tools`, defined in `mcp/`) answers on **two** Workers Custom Domains — identical code and behavior on both, `run_worker_first = true` on both routes in `wrangler.toml`:

- `tools.nyuchi.com` — the human-facing site (Home, Studio, Signature Generator, Banner, Help, Setup, gmail-addon docs), behind the site-wide AuthKit login gate. `/mcp` also technically answers here (same Worker) but is not the advertised endpoint.
- `tools.nyuchi.dev` — the canonical MCP endpoint. `/mcp` traffic was moved off `.com` because it kept tripping Cloudflare's Layer 7 DDoS mitigation for legitimate MCP client traffic (confirmed via the zone's firewall event log: a `managed_challenge` from a ruleset outside WAF's reach — not Bot Fight Mode, and not bypassable by a WAF custom-rule skip). The fresh `nyuchi.dev` zone has no such accumulated traffic history. `MCP_RESOURCE` in `wrangler.toml`, `DEFAULT_RESOURCE` in `mcp/src/auth.ts`, the WorkOS-registered "AuthKit OAuth resource", and the MCP server-card/auth.md discovery documents all point at `https://tools.nyuchi.dev/mcp` — that's the one MCP clients should be given, not the `.com` one.

Within each domain, routing is the same:

- `/mcp` and `/mcp/*` → MCP JSON-RPC handler (`assets.run_worker_first` sends these to the Worker script)
- everything else → the built Astro site from `signature-generator/dist` as static assets, but only after the site-wide login gate passes (irrelevant on `tools.nyuchi.dev` in practice, since nothing else should be linked there). Every route is a real HTML file (`build.format: 'file'` → `/studio` serves `studio.html` with no trailing-slash redirect); unknown paths get `404-page` handling (the built `404.html`). Do not switch back to `single-page-application` fallback — there is no client-side router anymore.

GitHub Pages is **no longer used** — the DNS record is a proxied Workers-only placeholder (`AAAA 100::`), not a CNAME to GitHub. **The site must be built before deploying the Worker** (`cd signature-generator && npm run build`), since the root `wrangler.toml` points its assets directory at `signature-generator/dist`.

## Commands

### Apps Script projects (root)
Wrappers around [clasp](https://github.com/google/clasp). Requires `clasp login` first; `gmail-addon/.clasp.json` has an empty `scriptId` that must be filled before pushing.
```bash
npm run push:gmail        # clasp push gmail-addon
npm run push:signature    # clasp push email-signature
npm run push:all
npm run deploy:gmail      # clasp deploy
npm run open:gmail        # open in Apps Script editor
```

### Web app (`signature-generator/`, Astro)
```bash
cd signature-generator
npm run dev      # astro dev server
npm run build    # tsc -b && astro build  (type-check is part of the build)
npm run lint     # eslint (React/TS sources; .astro files are not linted)
npm run preview  # astro preview — serves the built dist/
```

### The `nyuchi-tools` Worker (root `wrangler.toml`, source in `mcp/src/`)
Deployment lives at the **repo root** — there is no per-directory package for the Worker.
```bash
npm install               # root deps include wrangler + the Worker's runtime deps
npm run build:web         # build the site into signature-generator/dist (required before deploy)
npm run dev:tools         # wrangler dev — local Worker at http://localhost:8787
npm run deploy:tools      # build:web + wrangler deploy
npm run typecheck:worker  # tsc against mcp/tsconfig.json
```
`wrangler` reads `CLOUDFLARE_API_TOKEN` from the environment; the account id is pinned in `wrangler.toml`. `tools.nyuchi.com` (site) is a Workers Custom Domain on the `nyuchi.com` zone; `tools.nyuchi.dev` (MCP) is a Workers Custom Domain on the `nyuchi.dev` zone — both point at the same Worker.

### Tests
Two **Vitest** suites (node environment, no jsdom); `npm test` at the repo root runs both. CI (`.github/workflows/ci.yml`) runs lint, `typecheck:worker`, the site build, and both suites on Node 22.
- `signature-generator/`: `npm test` (`vitest.config.ts`, tests in `tests/`) — unit tests for the three pure engines (`signature`, `nyuchi`, `banner`) plus the signature-page helpers (`tests/signature-page.test.ts` imports `src/pages/signature/helpers.ts` — keep that file at that path with those exports). The nyuchi/banner engines measure text via a lazily created canvas 2d context; `tests/setup.canvas.ts` installs a deterministic `document`/canvas stub (8px per character) before any engine import — keep that stub if you add engine tests.
- Repo root: `npm run test:worker` (`vitest.worker.config.ts`, tests in `mcp/tests/`) — HTTP-level tests of the `nyuchi-tools` Worker, exercising the default export via `worker.fetch(new Request(...), env)`. These live at the root because the Worker's deps are root dependencies and `mcp/` intentionally has no package.json; `mcp/tsconfig.json` only includes `src/**`, so `typecheck:worker` never sees them.

The Apps Script "tests" remain exported functions run manually from the Apps Script editor:
- `email-signature/Code.js`: `runAllTests()`, `testSignatureGeneration()`, `testDivisionDetection()`, `testFlagColors()`, `testMySignature()`, plus dry-run `listAllUsersAndAliases()` and `updateSingleUserSignature(email)` before a full `updateAllUserSignatures()`.
- `gmail-addon/Code.js`: `testSignatureGeneration()`, `testAdminSignature()`.

## Architecture notes

### Astro islands architecture
`signature-generator/` is a static **Astro** site (no SSR adapter; `astro.config.ts` at the project root):

- Routes are `src/pages/*.astro` (`/`, `/signature-generator`, `/studio`, `/banner`, `/help`, `/setup`, `/gmail-addon`, `404`), all sharing `src/layouts/Base.astro` — html shell, theme bootstrap (`localStorage['nyuchi-theme']`, default **dark**, sets `data-theme` before first paint), sticky 4rem nav (the tool panels' `top: 4rem` sticky math depends on that height), theme toggle, footer.
- The three tool pages mount the pre-existing React components as **`client:only="react"` islands** (`src/pages/signature/SignaturePage`, `src/pages/studio/StudioPage`, `src/pages/banner/BannerPage`) — they touch `document`/`localStorage`/canvas, so they must not be server-rendered.
- The React `.tsx`/`.ts` modules live **inside `src/pages/`** next to the routes. Astro only routes `.astro` files; it warns about `src/pages/signature/helpers.ts` and `src/pages/studio/minerals.ts` at build ("No API Route handler") and skips them — that warning is expected and harmless. `helpers.ts` must stay at that exact path (the vitest suite imports it).
- Content pages (`/`, `/help`, `/setup`, `/gmail-addon`, 404) are native Astro composed from `@bundu/ui` Astro components; there is no client-side router (react-router is gone).

### Design tokens live in Mzizi; `@bundu/ui` ships them
The web app's design system is **`@bundu/ui`** (npm) — the canonical Mzizi implementation: 7 mineral palettes (cobalt/tanzanite/malachite/gold/terracotta/sodalite/copper), semantic tokens, type scale, radius (**pill for buttons/inputs**, 14px for cards), a Tailwind preset, and Astro/React components. Wiring lives in `src/styles/global.css`: Tailwind 4 → `@bundu/ui/styles/globals.css` → `brand-nyuchi.css` (site primary = gold) → `fonts.css` → `compat.css`, plus `@config "../../tailwind.config.mjs"` (loads the preset and adds `node_modules/@bundu/ui/src` to the content globs — required so the package's own utility classes compile). Rules:

1. When changing colors, radius, spacing, or type scale, update Mzizi/@bundu/ui first. Do not invent values or redefine canonical vars locally.
2. `src/styles/compat.css` maps the legacy vars the tool islands still consume (`--fs-*`, `--space-*`, `--lh-*`, `--surface`, `--overlay`, `--ring-1`, `--h-*`, `--container-*`, `--color-*-raw`, font stacks) onto canonical tokens/values — extend it rather than re-adding a local tokens file.
3. Fonts are Noto Sans (body/UI), Noto Serif (headlines), JetBrains Mono (labels/code). Noto Sans and JetBrains Mono are vendored as variable fonts under `signature-generator/public/fonts/` (`src/styles/fonts.css`); Noto Serif and Plus Jakarta Sans (signature preview) load from Google Fonts via `<link>` in `Base.astro`.
4. Tailwind class names must appear as complete literal strings in source (no `bg-${mineral}` composition) or the scanner won't generate them.

Nyuchi's canonical mineral is **gold** (`#FFD740`). Every other brand has its own — the signature-page mapping lives in `signature-generator/src/pages/signature/helpers.ts` (`BRAND_MINERAL`).

### The brand registry is the canonical source; Apps Script copies are hand-synced
`signature-generator/src/engines/brands/index.ts` is THE canonical brand
registry — a pure module holding the Bundu-ecosystem taxonomy:

- **Bundu Foundation** (`bundu`, bundu.org) is the parent; the other three
  top-level brands are its pillars: **Nyuchi Africa** (`nyuchi`, commercial),
  **Mukoko** (`mukoko`, consumer), **Shamwari AI** (`shamwari`, community).
- `DIVISIONS` (keyed by parent): nyuchi → lingo/learning/development/foundation,
  mukoko → mukokoNews.
- `INITIATIVES` under bundu (projects, NOT brands): Zimbabwe Information
  Platform (travel-info.co.zw), TELIA — Technology Leaders in Africa
  (telia.bundu.org), Bundu Education.
- Per-brand `lockupLabel` drives the studio/banner lockups; per-theme `icon`
  pairs come from the bundu-ecosystem-icons collection (only nyuchi's
  light-surface bee is vendored today).

Consumers:
- `signature-generator/src/engines/signature/index.ts` (`BRANDS`,
  `buildSignatureHtml`, `buildSignatureText`) — the signature template +
  the **historical signature copies** of the brand data, imported by both the
  signature island and the Worker's `generate_email_signature` MCP tool. Its
  `travel`/`learning` keys are legacy signature identities; emitted HTML for
  pre-existing keys is byte-locked, so never re-sync its wording/colors to
  the registry.
- `engines/nyuchi` + `engines/banner` re-export `Brand` from the registry and
  read `lockupLabel` from it.
- The two Apps Script projects still hardcode their own brand/division list
  (Apps Script cannot import npm modules):
  - `gmail-addon/Code.js` → `BRANDS` object (keyed by brand slug, e.g. `nyuchi`, `bundu`)
    plus a second copy in `Dashboard.html`.
  - `email-signature/Code.js` → `CONFIG.divisions` (keyed by **email domain**, e.g. `lingo.nyuchi.com`, `bundu.org`).

A brand or social-link change must be applied in the registry first, then in
the signature engine (new keys only — existing output is byte-locked) and
both Apps Script files. The two Apps Script files also differ in shape
(slug-keyed vs domain-keyed) and in logo URLs (`assets.nyuchi.com` CDN vs raw
GitHub).

### The emitted email-signature HTML is separate from the web-app UI
The signature page (`signature-generator/src/pages/signature/`) has two visual surfaces:
- **Web-app UI** — the panel + stage the user works in (studio layout pattern). Styled to the Mzizi mineral / dark design system.
- **Emitted signature HTML** — the string the page previews and copies into Gmail, built by `src/engines/signature/index.ts` (`buildSignatureHtml`). This uses the historical signature styling (Plus Jakarta Sans / Noto Serif, brand primary colors) and must match the two Apps Script files so signatures render consistently across every recipient's inbox. Change it only in the engine module, never per-surface. The page injects the engine output verbatim for the live preview, so preview and clipboard share one code path.

Don't accidentally restyle the emitted HTML when working on the web-app UI. The distinction is important: the UI is behind the studio's mineral tokens; the signature markup is brand-locked to the historical Nyuchi purple.

### Apps Script global functions are the API contract
In `gmail-addon/`, top-level function names are referenced by string elsewhere, so renaming one silently breaks it:
- `appsscript.json` triggers point to `onHomepage`, `onComposeInsert`, `openDashboard`, `resetSettings`.
- `Dashboard.html` calls server functions via `google.script.run` (e.g. `getDashboardData`, `getSignaturePreview`, `updateSingleUserFromDashboard`, `updateAllFromDashboard`).
- `doGet` serves `Dashboard.html` as a web app (`webapp.executeAs: USER_ACCESSING`, `access: DOMAIN`).

The add-on has two tabs built by `buildTabbedCard`: a **User tab** (self-service, only the user's own signature) and an **Admin tab** (domain-wide, requires Admin SDK access).

### Permission model
- `gmail-addon` User tab: per-user, `gmail.settings.basic`.
- `gmail-addon` Admin tab & `email-signature`: read the directory via `admin.directory.user.readonly` and write other users' send-as signatures via `gmail.settings.sharing`, which requires **domain-wide delegation** configured in the Google Admin Console (see `email-signature/README.md` and `TESTING.md`).
- `email-signature` also handles aliases: for each user it applies a signature to the primary address plus every send-as alias.

### The Nyuchi Studio & Banner generators
`/studio` and `/banner` are React ports of two vanilla-JS/HTML tools originally built in Claude Design. The ported SVG-generation engines live under `signature-generator/src/engines/nyuchi/` and `signature-generator/src/engines/banner/` respectively. They are **pure functions** — `buildSVG(params) → { svg, format, seed }` — so the same code paths can be imported by the MCP server tools (`generate_studio_card`, `generate_article_banner`) without duplication.

**The Banner tool is deprecated in favor of the Studio.** The Studio fully replaces it; `generate_article_banner`'s MCP description says so and steers callers to `generate_studio_card`, and the banner engine no longer receives visual fixes (the 2026-07 Studio typography fixes — larger foreground-colored dek at ~0.88× title, smaller titles, opaque halo scrim, `dekFontSize`/`dekColor` overrides — were applied to `engines/nyuchi` only, deliberately). Remove the tool once nothing depends on it; don't port Studio fixes into `engines/banner`.

PNG rasterization is done client-side via `<canvas>` in the web app. On the MCP side, `generate_studio_card` also rasterizes **server-side** via `@resvg/resvg-wasm` (`mcp/src/raster.ts`): fonts come from the static TTFs in `signature-generator/public/fonts/raster/` (vendored from Google Fonts; served to the Worker through the ASSETS binding — keep them in `public/` or rasterization breaks). `returnFormat` controls the response: `'svg'` (default), `'png'` (inline image), or `'url'` (default when `upload: true` — rasterize, upload to **Cloudflare Images**, return only `{url, id, width, height, seed}`, no SVG body). `upload_asset` does the same for arbitrary SVG/PNG input, and `report_issue` files GitHub issues on `FEEDBACK_REPO`. Upload needs `CF_IMAGES_ACCOUNT_ID` + the `CF_IMAGES_TOKEN` secret; report_issue needs the `GITHUB_FEEDBACK_TOKEN` secret — all fail closed with clear tool errors when unconfigured (see `wrangler.toml`).

### HTML generation & XSS
All signature HTML is assembled from user input by hand. Both Apps Script files have an `escapeHtml()` helper; the React component additionally uses `@braintree/sanitize-url` plus `escapeHtml`/`createMailtoUrl`/`createTelUrl`/`createWhatsAppUrl` helpers. **Preserve this escaping when editing signature templates** — these strings end up as raw HTML in users' mailboxes.

## Deployment

- The whole web surface deploys as one Worker: `cd signature-generator && npm run build`, then `npm run deploy:tools` at the repo root (wrangler picks up `CLOUDFLARE_API_TOKEN`; the account is pinned in `wrangler.toml`). Workers Builds (GitHub app) is the intended CI path — root dir `mcp`, deploy `npx wrangler deploy`, watch paths `mcp/**` and `signature-generator/**`.
- There is no GitHub Pages deployment anymore; don't resurrect `.github/workflows/deploy.yml` or `public/CNAME`.
- Apps Script projects deploy manually with the clasp `deploy:*` scripts; there is no CI for them.
