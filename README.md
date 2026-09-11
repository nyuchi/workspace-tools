# Nyuchi Workspace Tools

> Email signature management and brand design tools for Nyuchi Africa and the
> Bundu ecosystem — one Cloudflare Worker serving both a web app and an MCP
> server, plus two Google Apps Script projects.

[![CI](https://img.shields.io/github/actions/workflow/status/nyuchi/workspace-tools/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/nyuchi/workspace-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Worker](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-React_19_islands-BC52EE?style=flat-square&logo=astro&logoColor=white)
![Apps Script](https://img.shields.io/badge/Google-Apps_Script_V8-4285F4?style=flat-square&logo=google&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-streamable_HTTP-000000?style=flat-square)

**Site:** [tools.nyuchi.com](https://tools.nyuchi.com) | **MCP:**
`tools.nyuchi.dev/mcp` | **Worker:** `nyuchi-tools`

> **Both hostnames require sign-in.** Every page on `tools.nyuchi.com`
> redirects to `/login` and on to WorkOS at `identity.nyuchi.com`; the MCP
> endpoint answers `401` without a bearer token. Verified 2026-09-12. The
> links below are correct but none of them opens to an anonymous visitor.

---

## What it is

Four sub-projects that share branding but no code. The Apps Script projects
each keep their own copy of the brand list, because Apps Script cannot import
npm modules.

| Directory              | Stack                                                                                        | Purpose                                                             | Deploys to                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `signature-generator/` | Astro + React 19 islands + TypeScript + [@bundu/ui](https://www.npmjs.com/package/@bundu/ui) | The web app: signature builder, Nyuchi Studio, docs pages           | Bundled into the `nyuchi-tools` Worker as static assets                               |
| `mcp/src/`             | Cloudflare Workers + Hono + `@modelcontextprotocol/sdk`                                      | The `nyuchi-tools` Worker: serves the built static site **and** MCP | `tools.nyuchi.com` (site) + `tools.nyuchi.dev` (MCP) — one Worker, two Custom Domains |
| `gmail-addon/`         | Google Apps Script (V8)                                                                      | Gmail Add-on (User + Admin tabs) and the admin web dashboard        | Apps Script via clasp — see [gmail-addon/README.md](gmail-addon/README.md)            |
| `email-signature/`     | Google Apps Script (V8)                                                                      | Admin batch script: push signatures to all domain users and aliases | Apps Script via clasp — see [email-signature/README.md](email-signature/README.md)    |

The canonical brand taxonomy for the TypeScript side lives in
`signature-generator/src/engines/brands/`; the signature template and its
historical brand copies live in `signature-generator/src/engines/signature/` —
pure modules imported by both the web app and the Worker's MCP tools, so both
emit identical signature HTML.

## The live site

| Tool                      | Path                                                                 | What it does                                                                               |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Email Signature Generator | [/signature-generator](https://tools.nyuchi.com/signature-generator) | Fill in a form, pick a brand, copy a styled HTML signature into Gmail.                     |
| Nyuchi Studio             | [/studio](https://tools.nyuchi.com/studio)                           | Generative social cards — 7 mineral palettes, 5 formats, 5 layouts, seeded SVG/PNG export. |
| Gmail Add-on docs         | [/gmail-addon](https://tools.nyuchi.com/gmail-addon)                 | Overview of the Gmail sidebar add-on and its admin web dashboard.                          |
| Setup guide               | [/setup](https://tools.nyuchi.com/setup)                             | Step-by-step clasp / Apps Script / domain-wide-delegation setup.                           |
| Help                      | [/help](https://tools.nyuchi.com/help)                               | Per-tool usage guides, including how to connect the MCP server.                            |
| MCP server                | `https://tools.nyuchi.dev/mcp`                                       | Streamable-HTTP MCP endpoint for AI agents (see below).                                    |

Studio's five formats are `16x9` (1600×900), `og` (1200×630), `li`
(1200×627), `ig` (1080×1080) and `story` (1080×1920); its five layouts are
type, anchor, split, halo and mineral (`signature-generator/src/engines/nyuchi/`).

## Quickstart

```bash
git clone https://github.com/nyuchi/workspace-tools.git
cd workspace-tools
npm install                    # root deps: wrangler, Worker runtime deps, clasp
```

### Web app (`signature-generator/`)

```bash
cd signature-generator
npm install
npm run dev                    # Astro dev server
npm run build                  # tsc -b && astro build (type-check included)
npm run lint                   # eslint
```

### The `nyuchi-tools` Worker (root)

```bash
npm run build:web              # build the site into signature-generator/dist
npm run dev:tools              # wrangler dev — local Worker at http://localhost:8787
npm run deploy:tools           # wrangler deploy (builds the site first via [build])
npm run typecheck:worker       # tsc against mcp/tsconfig.json
```

`wrangler` reads `CLOUDFLARE_API_TOKEN` from the environment; the account id
is pinned in `wrangler.toml`.

### Apps Script projects (root, via clasp)

Requires `clasp login` first, and a `scriptId` in each project's
`.clasp.json`.

```bash
npm run push:gmail             # clasp push gmail-addon
npm run push:signature         # clasp push email-signature
npm run push:all
npm run deploy:gmail           # clasp deploy
npm run open:gmail             # open in the Apps Script editor
```

For full Apps Script setup — creating projects, OAuth scopes, domain-wide
delegation, testing — see [gmail-addon/README.md](gmail-addon/README.md),
[email-signature/README.md](email-signature/README.md), and the
[online setup guide](https://tools.nyuchi.com/setup).

## Deployment

The whole web surface — static site **and** MCP — deploys as one Cloudflare
Worker (`nyuchi-tools`) on two Workers Custom Domains: `tools.nyuchi.com`
(the site) and `tools.nyuchi.dev` (the canonical MCP endpoint — moved off
`.com` after its `/mcp` traffic kept tripping Cloudflare's Layer 7 DDoS
mitigation for legitimate MCP client traffic). Same code, same behaviour on
both:

- `/mcp` and `/mcp/*` are handled by the Worker script (MCP JSON-RPC).
- Everything else is served from the built Astro site in
  `signature-generator/dist`; every route is a real HTML file, and unknown
  paths get the built `404.html`.

Deploy manually with `npm run deploy:tools`, or let **Workers Builds** (the
Cloudflare GitHub app) deploy on push — the `[build]` command in
`wrangler.toml` builds the site before every deploy, so the assets directory
always exists. There is no GitHub Pages deployment.

The Apps Script projects deploy manually with the clasp scripts above; there
is no CI for them.

## MCP server

The Worker hosts an MCP (Model Context Protocol) server so AI agents can
generate signatures and design assets directly:

```text
https://tools.nyuchi.dev/mcp
```

**Connect from claude.ai** — Settings → Connectors → Add custom connector,
then paste the endpoint URL.

**Connect from Claude Code:**

```bash
claude mcp add --transport http nyuchi-tools https://tools.nyuchi.dev/mcp
```

| Tool                              | Status                                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nyuchi_generate_email_signature` | Live — same engine as the web generator, byte-identical HTML output                                                                                                        |
| `nyuchi_generate_studio_card`     | Live — same Studio engine as `/studio`. `returnFormat` picks SVG source (default), inline PNG (rasterized server-side), or a public Cloudflare Images URL (`upload: true`) |
| `nyuchi_upload_asset`             | Live — SVG (rasterized server-side) or base64 PNG in, stable public Cloudflare Images URL out                                                                              |
| `nyuchi_report_issue`             | Live — files a GitHub issue on this repo (tool name, severity, category)                                                                                                   |

The endpoint requires a bearer token issued by WorkOS Connect (OAuth 2.1 +
PKCE, dynamic client registration) — clients are prompted to sign in when
connecting. An unauthenticated request gets `401`. See `/auth.md` on the
endpoint for the full architecture.

## Supported brands

The Bundu ecosystem has four top-level brands: **Bundu Foundation** is the
parent ("Bundu is Shona for wilderness. The wilderness holds the hive."), and
the other three are its pillars.

| Brand                | Domain                             | Pillar     |
| -------------------- | ---------------------------------- | ---------- |
| **Bundu Foundation** | [bundu.org](https://bundu.org)     | The parent |
| **Nyuchi Africa**    | [nyuchi.com](https://nyuchi.com)   | Commercial |
| **Mukoko**           | [mukoko.com](https://mukoko.com)   | Consumer   |
| **Shamwari AI**      | [shamwari.ai](https://shamwari.ai) | Community  |

Divisions and Bundu Foundation initiatives (initiatives are projects, not
brands):

| Division / initiative                    | Domain                                             | Notes                                           |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Nyuchi Lingo**                         | [lingo.nyuchi.com](https://lingo.nyuchi.com)       | Nyuchi division — language learning             |
| **Nyuchi Learning**                      | [learning.nyuchi.com](https://learning.nyuchi.com) | Nyuchi division — education platform            |
| **Nyuchi Development**                   | [services.nyuchi.com](https://services.nyuchi.com) | Nyuchi division — software services             |
| **Nyuchi Foundation**                    | `foundation.nyuchi.com`                            | Nyuchi division — **does not resolve** (no DNS) |
| **Mukoko News**                          | [news.mukoko.com](https://news.mukoko.com)         | Mukoko division — pan-African journalism        |
| **Zimbabwe Information Platform**        | [travel-info.co.zw](https://travel-info.co.zw)     | Bundu initiative — tourism information          |
| **TELIA — Technology Leaders in Africa** | [telia.bundu.org](https://telia.bundu.org)         | Bundu initiative — technology leadership        |
| **Bundu Education**                      | [bundu.org](https://bundu.org)                     | Bundu initiative — dedicated site pending       |

`foundation.nyuchi.com` is a live brand entry in
`signature-generator/src/engines/brands/index.ts` and in `gmail-addon/Code.js`,
so signatures generated for that brand currently link to a hostname with no DNS
record. Either point the domain somewhere or retire the brand entry.

The canonical registry is `signature-generator/src/engines/brands/index.ts`.
The web generator and MCP tools cover the four top-level brands plus the
legacy signature keys `travel` and `learning`; the Apps Script projects carry
the full division list. A brand or social-link change must be applied in the
registry, in `signature-generator/src/engines/signature/index.ts` (new keys
only — existing signature output is byte-locked), **and** in both Apps Script
files (`gmail-addon/Code.js`, `email-signature/Code.js`).

## Design system

The web app's UI follows the Mzizi registry — the Bundu ecosystem's
design-system source of truth. Mzizi is an open-architecture project of the
Bundu Foundation, operated and developed by Nyuchi.

Its palette is **21 colour families**: seven minerals (cobalt, tanzanite,
malachite, gold, terracotta, sodalite, copper), seven heritage (indigo,
savanna, baobab, sunset, river, hematite, kalahari) and seven experimental
(ember, acacia, fern, lagoon, storm, dusk, protea) — live at
`GET https://api.mzizi.dev/api/v1/brand`. Nyuchi Studio draws on the seven
minerals specifically; that is a subset, not the whole palette, and this
README previously described the registry itself as having seven.

Type is Noto Sans / Noto Serif / JetBrains Mono, with pill buttons and
14&nbsp;px cards. The canonical tokens, Tailwind preset and marketing
components ship in the
**[@bundu/ui](https://www.npmjs.com/package/@bundu/ui)** npm package, imported
by `signature-generator/src/styles/global.css` — change them in Mzizi /
`@bundu/ui` first. The _emitted signature HTML_ deliberately keeps the
historical signature styling so signatures render consistently in every inbox;
it is not part of the web app's design system.

## Ecosystem

- [docs.nyuchi.com](https://docs.nyuchi.com) — Nyuchi engineering docs
- [docs.bundu.org](https://docs.bundu.org) — Bundu Foundation product docs
- [mzizi.dev](https://mzizi.dev) — the Mzizi design system

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a pull request

Issues:
[github.com/nyuchi/workspace-tools/issues](https://github.com/nyuchi/workspace-tools/issues).
See also [SECURITY.md](SECURITY.md).

## Licence

Licensed under the [MIT License](LICENSE).
© Nyuchi Africa (PVT) Ltd.

**Developer:** Bryan Fawcett ([@bryanfawcett](https://github.com/bryanfawcett))
