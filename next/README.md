# nyuchi-tools, next

The rebuild of nyuchi-tools on the default stack: an **Astro** front end on
Mzizi components, and **Rust** on Cloudflare Workers (workers-rs) behind it.
The plan, phases and cut-over are in the rebuild issue on this repo. Until
cut-over, the live app (`signature-generator/`, `mcp/`, `gmail-addon/`,
`email-signature/`) is untouched, and nothing here is deployed.

## Phase 1: `crates/imaging`

The image system: a preset catalogue and a renderer, as a Rust library and a
CLI (`nyuchi-img`). It replaces the Toddle extension's Playwright store renders
and the Nyuchi Studio's fixed formats with one pipeline.

```text
content + screenshot ─▶ privacy gate ─▶ layout (pure geometry) ─▶ SVG ─▶ resvg ─▶ PNG / JPEG
                         │                │
                         │                └ preset: size, safe area, format, byte limit
                         └ attestation, blocked terms, redaction bars
```

- **Presets are data.** `crates/imaging/data/presets.toml` lists every
  output size with its platform's safe-area insets, format and upload limit.
  Adding a platform is a data change.
- **Themes are data, from Mzizi.** `crates/imaging/data/themes.toml`;
  `toddle-launch` (the look the extension launched with) is the default.
- **Safe areas are tested, not eyeballed.** The layout is pure geometry,
  and the tests assert that every text block, card and pill lies inside the
  preset's safe area and that no two overlap, for every preset and several
  screenshot shapes. `--guides` draws the bands for a visual check.
- **Privacy is a gate, not a reminder.** A render with a screenshot is refused
  unless the screenshot is attested as fake or redacted; any text containing a
  blocked term (`NYUCHI_BLOCKED_TERMS_FILE`, kept outside the repo) is
  refused without echoing the term; redaction boxes are painted over the
  screenshot in the image itself.
- **Every image gets alt text**, in the campaign manifest.

### Why Rust and resvg

resvg (with tiny-skia) is a pure-Rust SVG renderer: no system libraries, no
browser, the same output on every machine, and it compiles unchanged to
`wasm32-unknown-unknown` — CI builds the library for that target. That makes
it the renderer for a Worker as well as for the CLI. The old pipelines needed
a headless Chromium (Playwright) for every render; Cloudflare Browser
Rendering stays the right tool for **capturing** a live page (phase 2), not
for composing an image from known parts.

Text is wrapped by measuring with the same font files resvg draws with, so a
measured line is the line drawn. The four faces (Noto Serif 700, Noto Sans
400/600, JetBrains Mono 400) are embedded. All four are under the SIL Open
Font Licence 1.1; the Noto copy of it is in `assets/fonts/OFL.txt`, and
JetBrains Mono carries the same terms.

### Use

```sh
cd next
cargo run --release -- presets                       # the catalogue
cargo run --release -- campaign ../samples/toddle-launch/campaign.toml
cargo run --release -- render --preset story --headline "Every criterion, in its own column." \
  --image shot.png --alt "The gradebook with fake students" --fake-or-redacted \
  --crop 0,0,1200,620 --redact 10,40,180,16 --chrome learning.nyuchi.com --guides
cargo test
```

### Presets

| id                                                       | size      | format | safe area (t/r/b/l) |
| -------------------------------------------------------- | --------- | ------ | ------------------- |
| `story`                                                  | 1080×1920 | PNG    | 250/64/340/64       |
| `reel-cover`                                             | 1080×1920 | PNG    | 240/140/420/64      |
| `portrait`, `linkedin-carousel`                          | 1080×1350 | PNG    | —                   |
| `square`                                                 | 1080×1080 | PNG    | —                   |
| `og`                                                     | 1200×630  | PNG    | —                   |
| `linkedin`                                               | 1200×627  | PNG    | —                   |
| `x`, `header-16x9`                                       | 1600×900  | PNG    | —                   |
| `youtube-thumb`                                          | 1280×720  | JPEG   | 0/0/72/0            |
| `cws-screenshot`                                         | 1280×800  | JPEG   | —                   |
| `cws-screenshot-small`                                   | 640×400   | JPEG   | —                   |
| `cws-promo-small`                                        | 440×280   | JPEG   | —                   |
| `cws-promo-marquee`                                      | 1400×560  | JPEG   | —                   |
| `shopify-square`                                         | 2048×2048 | JPEG   | —                   |
| `shopify-square-1600`                                    | 1600×1600 | JPEG   | —                   |
| `email-header`                                           | 1200×400  | JPEG   | —                   |
| `icon-512`, `icon-192`, `apple-touch-icon`, `favicon-32` | 512…32    | PNG    | 10% on PWA icons    |

The layout picks a composition from the canvas and content: `top`
(landscape with a landscape screenshot), `side` (a tall screenshot, or a very
wide canvas), `stack` (portrait and square: headline, card, points, CTA; a
text slide without a screenshot), `tile` (landscape, no screenshot), `icon`.

## `crates/brands`: the one brand list

`crates/brands/data/brands.toml` is the single Bundu-ecosystem brand list —
the foundation, pillars, divisions and initiatives, each with its tagline,
URL, email domains, Mzizi mineral and official socials. It replaces the three
hand-synced copies in the live app (the TypeScript registry and the two Apps
Script lists). Lookups by key, legacy alias (`techLeaders`) and email domain;
the tests hold the taxonomy (divisions under pillars, initiatives under
Bundu), unique keys and domains, valid minerals and `https://` links.

## `crates/signature`: the email signature on Mzizi

Owner decision 2 on #70 ended the byte-lock on the historical purple
signature. The new one is built for email clients, not browsers:

- tables and inline styles only — no `<style>`, classes, flex or grid;
- the seven-mineral identity strip as table cells (`bgcolor` and
  `background-color`), so it shows with images blocked;
- no images by default: socials are text links; a profile photo and a
  promo banner are opt-in and `https://` only;
- Noto Serif / Noto Sans first, Georgia / Arial fallbacks;
- link colours are the brand mineral's on-light hex where it reaches WCAG AA
  on white, otherwise ink (copper falls back);
- every value escaped, every URL checked against a scheme allow-list;
- a plain-text version alongside.

The brand comes from the key, or from the email's domain when no key is
given. Samples (made-up people only) are in `samples/signatures/`:
`cargo run -p nyuchi-signature --example samples`.

## `crates/worker` + `site/`: the Worker and the site

One Worker (`next/wrangler.toml`, name `nyuchi-tools-next`), Rust on
workers-rs, serving the Astro site as static assets and the API under
`/api/`:

| Route                 | Does                                           |
| --------------------- | ---------------------------------------------- |
| `GET /api/presets`    | the preset catalogue                           |
| `GET /api/themes`     | the themes                                     |
| `GET /api/brands`     | the one brand list                             |
| `POST /api/render`    | one image (PNG/JPEG); alt text in `X-Alt-Text` |
| `POST /api/campaign`  | a whole set as a ZIP with `manifest.json`      |
| `POST /api/signature` | the email signature: `{html, text, brand}`     |
| `GET /api/health`     | liveness                                       |

The API is plain Rust (`crates/worker/src/api.rs`), tested natively with
`cargo test`; `entry.rs` is the thin wasm fetch handler. The privacy gate
runs on every render; the optional `BLOCKED_TERMS` secret supplies the
blocked-terms list. The compiled Worker is about 2.3 MB gzipped (the four
fonts are most of it); a story renders in about a second, cold.

`site/` is Astro on `@bundu/ui` (Mzizi): Home, Studio (preview every size
with its safe area, download the set), Presets (generated from
`presets.toml` at build), Signatures (preview in a sandboxed frame, copy for
Gmail). It reads the same TOML files the crates embed.

**Not live.** The Worker has no route and no `workers.dev` URL: the API has
no login yet. Phase 3 adds the WorkOS gate before it gets one.

Run it locally (needs `worker-build`: `cargo install worker-build`):

```sh
cd next
npx wrangler dev        # builds the site and the Worker, serves on :8787
```

## MCP: everything the UI can do

Owner rule: _the nyuchi-tools MCP must have all the access the UI has._ The
Rust Worker serves MCP itself at `POST /mcp` (streamable HTTP, stateless,
JSON responses), and every tool **is** an API route: its input schema is the
route's request body, and calling it runs the same `api::handle` — the same
validation, privacy gate, blocked terms and (from phase 3) the same
permission check, because `entry.rs` authorises `/api/*` and `/mcp` in one
place. There is no second implementation to drift.

| Tool                     | Route                 | Returns                                                     |
| ------------------------ | --------------------- | ----------------------------------------------------------- |
| `nyuchi_list_presets`    | `GET /api/presets`    | every preset with size, format, safe area, limit            |
| `nyuchi_list_themes`     | `GET /api/themes`     | the themes                                                  |
| `nyuchi_list_brands`     | `GET /api/brands`     | the one brand list                                          |
| `nyuchi_render_image`    | `POST /api/render`    | image content (PNG/JPEG) + alt text; `guides` for safe area |
| `nyuchi_render_campaign` | `POST /api/campaign`  | the ZIP as an embedded resource + the manifest (alt text)   |
| `nyuchi_build_signature` | `POST /api/signature` | signature HTML, plain text and brand                        |
| `nyuchi_health`          | `GET /api/health`     | liveness and version                                        |

`crates/worker/tests/mcp.rs` enforces parity: every API route has exactly
one tool and every tool one route; every `/api/` call in the site's source
has a tool; and every tool declares how the UI offers it (a request, data
rendered at build time, or ops only). Adding a UI action without a tool, or
a tool without a route, fails CI. Live capture, R2 storage with signed review
URLs and the Signature Console actions join as routes — and so as tools —
when their bindings and the login exist.

**The live MCP.** `tools.nyuchi.dev/mcp` is still the TypeScript Worker. Its
tools are not wired to this backend yet: that needs a Service Binding in the
root `wrangler.toml`, which open PR #68 edits, and this Worker deployed. The
Rust Worker serves the MCP itself so nothing here touches that file; at
cut-over `tools.nyuchi.dev` points at this Worker and the TypeScript MCP is
retired (the phase 3 trial in #70 has, in effect, run: a stateless JSON-RPC
handler on workers-rs is about 250 lines and passes the protocol tests).
