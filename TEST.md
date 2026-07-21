# TEST.md — how this repo is tested

**Who:** anyone changing code here — human or agent. CI enforces it; agents run it locally before every push.
**What:** two Vitest suites + lint + typecheck + site build, plus manual Apps Script checks and visual render verification.
**Why:** the engines emit brand-locked SVG/HTML that lands in inboxes and social feeds; regressions are user-visible immediately.
**When:** locally before every commit (see `.claude/skills/verify`); in CI on every push/PR (`.github/workflows/ci.yml`, Node 22); the session verify loop re-checks on a cadence.
**Where:** `signature-generator/tests/` (engine suite) and `mcp/tests/` (worker suite, config at root `vitest.worker.config.ts`).

## How — the full verification sequence

```bash
cd signature-generator
npm run lint          # eslint over React/TS sources
npx tsc -b            # type-check (also part of npm run build)
npx vitest run        # engine suite
npm run build         # astro build — required before deploying the Worker
cd ..
npm run typecheck:worker   # tsc against mcp/tsconfig.json
npm run test:worker        # worker suite (root vitest.worker.config.ts)
```

`npm test` at the repo root runs both suites.

## Suite 1 — engines (`signature-generator/tests/`)

- Unit tests for the two pure engines (`signature`, `nyuchi`) plus the signature-page helpers (`tests/signature-page.test.ts` imports `src/pages/signature/helpers.ts` — keep that file at that path with those exports).
- **Canvas stub**: `tests/setup.canvas.ts` installs a deterministic `document`/canvas stub measuring text as **chars × 0.53 × font-size**. Size-awareness is load-bearing: hook-mode title scaling grows text until it fills the measure, which a fixed per-char width cannot exercise. Keep the stub if you add engine tests.
- Engine tests are **structural, not byte-locked** — assert on sizes, fills, element presence, determinism; never on full SVG strings.
- Studio typography contracts under test: dek ≈ 0.88× title in the surface foreground; ig layout-1 reference sizes (title 70/dek 62); hook mode grows one-line titles only; layout-4 scrim fully opaque; hex labels only on mineral-education cards; chip text color flips by true relative luminance (cobalt→ink, sodalite→white).

## Suite 2 — worker (`mcp/tests/`, run from repo root)

- HTTP-level tests of the `nyuchi-tools` Worker via `worker.fetch(new Request(...), env)` — no Workers runtime needed (plain Hono, no `cloudflare:` imports).
- **Wasm**: `vitest.worker.config.ts` mirrors wrangler's CompiledWasm module rule (a `.wasm` import resolves to a compiled `WebAssembly.Module`) and inlines `@resvg/resvg-wasm` so node tests exercise the real rasterizer.
- **ASSETS stubs**: `FONT_ASSETS_STUB` serves the vendored raster TTFs from `signature-generator/public/fonts/raster/` plus fake brand icons; tests that pass an ASSETS binding run **after** the icon tests because brand icons cache per module load (mirroring one isolate's lifetime).
- **External calls are mocked**: Cloudflare Images and GitHub issue creation are `vi.spyOn(globalThis, 'fetch')` mocks — no network, no real uploads. WorkOS JWT verification is exercised with real locally-generated RS256 keys.
- MCP behavior under test: four tools listed with annotations/output schemas, resources (list/read of the `nyuchi://` catalog + the per-brand template, including unknown-key rejection) and prompts (list/get with argument interpolation), removed-banner-tool rejection, returnFormat svg/png/url paths (PNG asserted down to signature bytes), upload guardrails, nyuchi_report_issue payloads, fail-closed errors when secrets are absent, OAuth discovery in both auth modes, the login gate. Signature Console coverage: POST /api/signature auth paths + byte-identity, /api/google/* OAuth flow with forged encrypted session cookies, /api/self/insert Gmail PATCH, /api/admin/users directory mapping, /api/admin/push dry-run/impersonation/backoff — all Google endpoints mocked, no live calls.

## Visual verification (manual, after engine changes)

Rendered output must be *looked at*, not just asserted on: rasterize sample cards (each changed layout × dark/accent) via `returnFormat: "png"` and inspect. In a Claude session, write a temporary test that saves PNGs to the scratchpad and view them; delete the temp file before committing. This catch rate is real — the dek/divider collision and the layout-2 dek truncation were both found only in renders.

## Apps Script (manual — no CI)

- `email-signature/Code.js`: `runAllTests()`, `testSignatureGeneration()`, `testDivisionDetection()`, `testMySignature()` (require `SIGNATURE_API_KEY` in Script Properties since HTML comes from the Worker render API); dry-run `listAllUsersAndAliases()` and `updateSingleUserSignature(email)` before any full `updateAllUserSignatures()`.
- `gmail-addon/Code.js`: `testSignatureGeneration()`, `testAdminSignature()`.

## What cannot be tested locally

- Live Cloudflare Images upload and live GitHub issue creation (secrets exist only in the deployed Worker). Verify post-deploy by calling the live MCP (`https://tools.nyuchi.dev/mcp`, WorkOS bearer required) with `upload: true` and checking the returned `imagedelivery.net` URL serves the image.
- Workers Builds deploys on push; its status lands on the PR as a bot comment.
