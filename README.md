# Nyuchi Workspace Tools

<p align="center">
  <img src="https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_dark.svg" alt="Nyuchi Africa" width="200">
</p>

<p align="center">
  <strong>I am because we are</strong>
</p>

Email signature management and brand design tools for Nyuchi Africa and the Bundu
ecosystem. The web tools live at **[tools.nyuchi.com](https://tools.nyuchi.com)**,
served by a single Cloudflare Worker that also hosts an **MCP server** so AI agents
can use the same tools.

## The live site

| Tool | URL | What it does |
|------|-----|--------------|
| Email Signature Generator | [/signature-generator](https://tools.nyuchi.com/signature-generator) | Fill in a form, pick a brand, copy a styled HTML signature into Gmail. |
| Nyuchi Studio | [/studio](https://tools.nyuchi.com/studio) | Generative social cards in the Bundu mineral design language — 7 palettes, 5 formats, 5 layouts, seeded SVG/PNG export. |
| Article Banner Generator | [/banner](https://tools.nyuchi.com/banner) | Seeded banner art for articles and link shares — 16:9, OG, LinkedIn, and square formats. |
| Gmail Add-on docs | [/gmail-addon](https://tools.nyuchi.com/gmail-addon) | Overview of the Gmail sidebar add-on and its admin web dashboard. |
| Setup guide | [/setup](https://tools.nyuchi.com/setup) | Step-by-step clasp / Apps Script / domain-wide-delegation setup. |
| Help | [/help](https://tools.nyuchi.com/help) | Per-tool usage guides, including how to connect the MCP server. |
| MCP server | [tools.nyuchi.dev/mcp](https://tools.nyuchi.dev/mcp) | Streamable-HTTP MCP endpoint for AI agents (see below). |

## Repository layout

Four sub-projects. They share branding but no code — the Apps Script projects each
keep their own copy of the brand list, because Apps Script cannot import npm modules.

| Directory | Stack | Purpose | Deploys to |
|-----------|-------|---------|------------|
| `signature-generator/` | Astro + React 19 islands + TypeScript + [@bundu/ui](https://www.npmjs.com/package/@bundu/ui) | The web app: signature builder, Nyuchi Studio, banner generator, docs pages | Bundled into the `nyuchi-tools` Worker as static assets |
| `mcp/src/` | Cloudflare Workers + Hono + `@modelcontextprotocol/sdk` | The `nyuchi-tools` Worker: serves the built static site **and** the MCP HTTP server | `tools.nyuchi.com` (site) + `tools.nyuchi.dev` (MCP) — same Worker, two Custom Domains (config: root `wrangler.toml`) |
| `gmail-addon/` | Google Apps Script (V8) | Gmail Add-on (User + Admin tabs) and the admin web dashboard | Apps Script via clasp — see [gmail-addon/README.md](gmail-addon/README.md) |
| `email-signature/` | Google Apps Script (V8) | Admin batch script: push signatures to all domain users and their aliases | Apps Script via clasp — see [email-signature/README.md](email-signature/README.md) |

The canonical brand taxonomy for the TypeScript side lives in
`signature-generator/src/engines/brands/` (the Bundu-ecosystem registry); the
signature template and its historical brand copies live in
`signature-generator/src/engines/signature/` — pure modules imported by both the
web app and the Worker's MCP tools, so both emit identical signature HTML.

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

`wrangler` reads `CLOUDFLARE_API_TOKEN` from the environment; the account id is
pinned in `wrangler.toml`.

### Apps Script projects (root, via clasp)

Requires `clasp login` first, and a `scriptId` in each project's `.clasp.json`.

```bash
npm run push:gmail             # clasp push gmail-addon
npm run push:signature         # clasp push email-signature
npm run push:all
npm run deploy:gmail           # clasp deploy
npm run open:gmail             # open in the Apps Script editor
```

For full Apps Script setup (creating projects, OAuth scopes, domain-wide
delegation, testing) see [gmail-addon/README.md](gmail-addon/README.md),
[email-signature/README.md](email-signature/README.md), and the
[online setup guide](https://tools.nyuchi.com/setup).

## Deployment

The whole web surface — static site **and** MCP — deploys as one Cloudflare
Worker (`nyuchi-tools`) on two Workers Custom Domains: `tools.nyuchi.com`
(the site) and `tools.nyuchi.dev` (the canonical MCP endpoint — moved off
`.com` after its `/mcp` traffic kept tripping Cloudflare's Layer 7 DDoS
mitigation for legitimate MCP client traffic). Same code, same behavior on
both:

- `/mcp` and `/mcp/*` are handled by the Worker script (MCP JSON-RPC).
- Everything else is served from the built Astro site in
  `signature-generator/dist`; every route is a real HTML file, and unknown
  paths get the built `404.html`.

Deploy manually with `npm run deploy:tools`, or let **Workers Builds** (the
Cloudflare GitHub app) deploy on push — the `[build]` command in `wrangler.toml`
builds the site before every deploy, so the assets directory always exists.
There is no GitHub Pages deployment.

The Apps Script projects deploy manually with the clasp scripts above; there is
no CI for them.

## MCP server

The Worker hosts an MCP (Model Context Protocol) server so AI agents can generate
signatures and design assets directly:

```
https://tools.nyuchi.dev/mcp
```

**Connect from claude.ai** — Settings → Connectors → Add custom connector, then
paste the endpoint URL.

**Connect from Claude Code:**

```bash
claude mcp add --transport http nyuchi-tools https://tools.nyuchi.dev/mcp
```

| Tool | Status |
|------|--------|
| `generate_email_signature` | Live — same engine as the web generator, byte-identical HTML output |
| `generate_studio_card` | Live — SVG from the same Studio engine as the `/studio` page, plus JSON metadata (size, seed) |
| `generate_article_banner` | Live — SVG from the same banner engine as the `/banner` page, plus JSON metadata (size, seed) |

The endpoint requires a bearer token issued by WorkOS Connect (OAuth 2.1 +
PKCE, dynamic client registration) — clients are prompted to sign in when
connecting. See `/auth.md` on the endpoint for the full architecture.

## Supported brands

The Bundu ecosystem has four top-level brands: **Bundu Foundation** is the
parent ("Bundu is Shona for wilderness. The wilderness holds the hive."), and
the other three are its pillars.

| Brand | Domain | Pillar |
|-------|--------|--------|
| **Bundu Foundation** | bundu.org | The parent — foundation |
| **Nyuchi Africa** | nyuchi.com | Commercial |
| **Mukoko** | mukoko.com | Consumer |
| **Shamwari AI** | shamwari.ai | Community |

Divisions and Bundu Foundation initiatives (initiatives are projects, not brands):

| Division / initiative | Domain | Notes |
|-----------------------|--------|-------|
| **Nyuchi Lingo** | lingo.nyuchi.com | Nyuchi division — language learning |
| **Nyuchi Learning** | learning.nyuchi.com | Nyuchi division — education platform |
| **Nyuchi Development** | services.nyuchi.com | Nyuchi division — software services |
| **Nyuchi Foundation** | foundation.nyuchi.com | Nyuchi division — community initiatives |
| **Mukoko News** | news.mukoko.com | Mukoko division — pan-African journalism |
| **Zimbabwe Information Platform** | travel-info.co.zw | Bundu initiative — tourism information |
| **TELIA — Technology Leaders in Africa** | telia.bundu.org | Bundu initiative — technology leadership |
| **Bundu Education** | bundu.org | Bundu initiative — dedicated site pending |

The canonical registry is `signature-generator/src/engines/brands/index.ts`.
The web generator and MCP tools cover the four top-level brands plus the
legacy signature keys `travel` and `learning`; the Apps Script projects carry
the full division list. A brand or social-link change must be applied in the
registry, in `signature-generator/src/engines/signature/index.ts` (new keys
only — existing signature output is byte-locked), **and** in both Apps Script
files (`gmail-addon/Code.js`, `email-signature/Code.js`).

## Design system

The web app's UI follows the Mzizi brand registry (the Bundu ecosystem's
design-system source of truth): 7 mineral palettes, Noto Sans / Noto Serif /
JetBrains Mono, pill buttons, 14&nbsp;px cards. The canonical tokens, Tailwind
preset, and marketing components ship in the **[@bundu/ui](https://www.npmjs.com/package/@bundu/ui)**
npm package (imported by `signature-generator/src/styles/global.css`) — change
them in Mzizi/@bundu/ui first. The *emitted signature HTML* deliberately keeps
the historical signature styling so signatures render consistently in every
inbox; it is not part of the web app's design system.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Open a Pull Request

Issues: [github.com/nyuchi/workspace-tools/issues](https://github.com/nyuchi/workspace-tools/issues)

## License

MIT — see [LICENSE](LICENSE).

## Author

**Nyuchi Web Services** — [services.nyuchi.com](https://services.nyuchi.com)

**Developer:** Bryan Fawcett ([@bryanfawcett](https://github.com/bryanfawcett))

---

<p align="center">
  <strong>Built with Ubuntu</strong> • Powered by Community
</p>
