# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Sub-projects for managing Nyuchi Africa email signatures and design assets. They share branding but **no code** — each maintains its own copy of the brand list.

| Directory | Stack | Purpose | Deploy target |
|-----------|-------|---------|---------------|
| `gmail-addon/` | Google Apps Script (V8) | Gmail Add-on (CardService UI) + admin web dashboard | Apps Script via clasp |
| `email-signature/` | Google Apps Script (V8) | Admin batch script: push signatures to all domain users & aliases | Apps Script via clasp |
| `signature-generator/` | React 19 + TypeScript + Vite | Standalone web app: signature builder, Nyuchi Studio (social cards), banner generator, setup docs | Bundled into the `nyuchi-tools` Worker as static assets |
| `mcp/` | Cloudflare Workers + Hono + `@modelcontextprotocol/sdk` | The `nyuchi-tools` Worker: serves the built SPA **and** the MCP HTTP server | Cloudflare Workers route `tools.nyuchi.com/*` |

The repo root is an npm workspace covering the two Apps Script projects; `signature-generator/` and `mcp/` are separate npm projects with their own lockfiles.

## URL layout on `tools.nyuchi.com`

One Cloudflare Worker (`nyuchi-tools`, defined in `mcp/`) serves the whole hostname via the route `tools.nyuchi.com/*`:

- `/mcp` and `/mcp/*` → MCP JSON-RPC handler (`assets.run_worker_first` sends these to the Worker script)
- everything else → the built SPA from `signature-generator/dist` as static assets, with `single-page-application` fallback for client-side routes

GitHub Pages is **no longer used** — the DNS record is a proxied Workers-only placeholder (`AAAA 100::`), not a CNAME to GitHub. **The SPA must be built before deploying the Worker** (`cd signature-generator && npm run build`), since `mcp/wrangler.toml` points its assets directory at `../signature-generator/dist`.

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

### React app (`signature-generator/`)
```bash
cd signature-generator
npm run dev      # vite dev server
npm run build    # tsc -b && vite build  (type-check is part of the build)
npm run lint     # eslint
npm run preview
```

### MCP server (`mcp/`)
```bash
cd mcp
npm install
npm run dev      # wrangler dev — local Worker at http://localhost:8787/mcp
npm run deploy   # wrangler deploy — deploys to Cloudflare, binds the tools.nyuchi.com/mcp/* route
```
Deploy requires `wrangler login` first and the `nyuchi.com` zone to exist in Cloudflare.

### Tests
There is **no automated test runner**. The Apps Script "tests" are exported functions run manually from the Apps Script editor:
- `email-signature/Code.js`: `runAllTests()`, `testSignatureGeneration()`, `testDivisionDetection()`, `testFlagColors()`, `testMySignature()`, plus dry-run `listAllUsersAndAliases()` and `updateSingleUserSignature(email)` before a full `updateAllUserSignatures()`.
- `gmail-addon/Code.js`: `testSignatureGeneration()`, `testAdminSignature()`.

## Architecture notes

### Design tokens live in Mzizi; `tokens.css` mirrors them
The React app's design system is a mirror of the Mzizi brand registry (Bundu ecosystem's design-system source of truth). The canonical values — 7 mineral palettes (cobalt/tanzanite/malachite/gold/terracotta/sodalite/copper), semantic surfaces, type scale, radius (**pill for buttons/inputs**, 14px for cards), spacing — are exposed via the Mzizi MCP server. `signature-generator/src/design-system/tokens.css` is a hand-mirrored CSS-var version of those tokens. Two rules:

1. When changing colors, radius, spacing, or type scale, update Mzizi first, then reflect in `tokens.css`. Do not invent values.
2. Fonts are Noto Sans (body/UI), Noto Serif (headlines), JetBrains Mono (labels/code). Noto Sans and JetBrains Mono are vendored as variable fonts under `signature-generator/public/fonts/`; Noto Serif still loads from Google Fonts.

Nyuchi's canonical mineral is **gold** (`#FFD740`). Every other brand has its own — the mapping lives in `EmailSignatureGenerator.tsx`.

### Brand config is duplicated across the Apps Script side, not shared
The two Apps Script projects hardcode their own brand/division list:
- `gmail-addon/Code.js` → `BRANDS` object (keyed by brand slug, e.g. `nyuchi`, `mukoko`).
- `email-signature/Code.js` → `CONFIG.divisions` (keyed by **email domain**, e.g. `lingo.nyuchi.com`).
- `signature-generator/src/components/EmailSignatureGenerator.tsx` → its own brand map.

A brand or social-link change must be applied in all three. The two Apps Script files also differ in shape (slug-keyed vs domain-keyed) and in logo URLs (`assets.nyuchi.com` CDN vs raw GitHub).

### The emitted email-signature HTML is separate from the SPA UI
`EmailSignatureGenerator.tsx` has two visual surfaces:
- **SPA UI** — the form the user fills in. Restyled to the Mzizi mineral / dark design system.
- **Emitted signature HTML** — the string this component copies into Gmail. This uses the historical Nyuchi purple `#5f5873` + Plus Jakarta Sans / Noto Serif and must match the two Apps Script files so signatures render consistently across every recipient's inbox.

Don't accidentally restyle the emitted HTML when working on the SPA UI. The distinction is important: the SPA is behind the studio's mineral tokens; the signature markup is brand-locked to the historical Nyuchi purple.

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

PNG rasterization is done client-side via `<canvas>` in the SPA. On the MCP side, tools currently return SVG only; PNG output is a follow-up (either `resvg-wasm` inside the Worker or letting the client rasterize).

### HTML generation & XSS
All signature HTML is assembled from user input by hand. Both Apps Script files have an `escapeHtml()` helper; the React component additionally uses `@braintree/sanitize-url` plus `escapeHtml`/`createMailtoUrl`/`createTelUrl`/`createWhatsAppUrl` helpers. **Preserve this escaping when editing signature templates** — these strings end up as raw HTML in users' mailboxes.

## Deployment

- The whole web surface deploys as one Worker: `cd signature-generator && npm run build`, then `cd ../mcp && npm run deploy` (wrangler picks up `CLOUDFLARE_API_TOKEN`; the account is pinned in `wrangler.toml`). Workers Builds (GitHub app) is the intended CI path — root dir `mcp`, deploy `npx wrangler deploy`, watch paths `mcp/**` and `signature-generator/**`.
- There is no GitHub Pages deployment anymore; don't resurrect `.github/workflows/deploy.yml` or `public/CNAME`.
- Apps Script projects deploy manually with the clasp `deploy:*` scripts; there is no CI for them.
