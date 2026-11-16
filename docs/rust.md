# The Rust pairing

Owner direction (2026-11-15): **Rust is always the backend.** This repo pairs
the Astro front end (`site/`) with Rust behind it — the Cloudflare Worker in
`crates/worker` (workers-rs, compiled to WASM), the engines in
`crates/{brands,signature,imaging,release}` — and moves onto as much Rust as
possible: WASM on the front end where it pays, Rust UI options, and the Mzizi
language for the build surface. TypeScript carries exactly what has not been
ported yet.

## What is here now

| Crate              | Role                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/brands`    | The one brand registry (`data/brands.toml`) and its colour-rule tests. The TS registry in `engines/brands` carries the same canon; the two must never disagree.            |
| `crates/imaging`   | The Rust renderer: presets, themes, SVG→layout, privacy gate (`nyuchi-img` CLI).                                                                                           |
| `crates/signature` | The signature engine in Rust (the parity target for `engines/signature`).                                                                                                  |
| `crates/release`   | The release-marketing pipeline (`nyuchi-release`), reading `releases/`.                                                                                                    |
| `crates/worker`    | The Rust Worker: `/api/*` + `/mcp` over the same engines, `site/` as static assets (`crates/worker/wrangler.toml`). **Not deployed** — no routes until the cut-over below. |

Gates (run locally; the org's required workflows run on every PR as-is):
`cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings`,
`cargo test`, and the wasm32 build of the Worker.

## The plan

1. **Restored (this change).** The crates live at the repo root as one Cargo
   workspace, exactly as they were in `next/` but paired with the real Astro
   site instead of the old skeleton. All suites green; wasm32 builds.
2. **Parity (next).** `crates/signature` emits byte-identical signatures to
   `engines/signature`, proven by golden tests shared with `site/tests`; the
   MCP surface of `crates/worker` matches the TypeScript Worker's
   (`mcp/src`) tool-for-tool, proven by porting `mcp/tests/worker.test.ts`.
   A parity test keeps `crates/brands/data/brands.toml` and
   `engines/brands` in lockstep.
3. **The WorkOS gate.** `crates/worker` grows the login gate the TypeScript
   Worker has (`mcp/src/site-auth.ts`): session cookie, PKCE round trip,
   bearer-JWT `/mcp`, the Nyuchi-org claim, one MCP URL (410 off-host).
4. **Cut-over — SHIPPED (2026-11-16).** The root `wrangler.toml` serves the
   Rust Worker on the production routes (`tools.nyuchi.com`,
   `tools.nyuchi.dev`); the TypeScript Worker (`mcp/`) is retired. Secrets
   carried over by name — the same `AUTHKIT_DOMAIN` / `SESSION_SECRET` /
   `WORKOS_CLIENT_ID`. Still porting from the TS side: the Google-console
   APIs (`/api/google/*`, `/api/admin/*`, `/api/self/*` — they answer 501),
   and the `nyuchi_upload_asset` / `nyuchi_report_issue` MCP tools (the tool
   list and honest errors until then). Deno: attempted for the site build —
   Deno 2.9's symlink `node_modules` breaks Astro 7's vite stack
   (`@tybys/wasm-util`); npm stays until either side fixes it.
5. **WASM and beyond.** The engines compile to WASM for the site (the
   signature preview and the Studio render in-browser through the same Rust
   the Worker runs — one implementation, two hosts), and the front end
   moves toward the Rust UI options and the Mzizi language as they release.

## Why not keep both workers

The TypeScript Worker (`mcp/`) stays production until step 4, then goes.
Nothing is dual-run: one Worker serves at a time, and the crates' parity
tests are the evidence for the switch.
