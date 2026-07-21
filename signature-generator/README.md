# signature-generator

The tools.nyuchi.com web app — an **Astro** static site with **React 19
islands**, styled with the **[@bundu/ui](https://www.npmjs.com/package/@bundu/ui)**
design system (the Bundu ecosystem's Mzizi implementation: seven mineral
palettes, Noto Sans / Noto Serif / JetBrains Mono, pill buttons).

## Architecture

- **Routes** are `src/pages/*.astro`, sharing `src/layouts/Base.astro`
  (theme bootstrap via `localStorage['nyuchi-theme']` — default dark — nav,
  footer, global stylesheet).
- **Content pages** (`/`, `/help`, `/setup`, `/gmail-addon`, 404) are native
  Astro, composed from @bundu/ui components (`Hero`, `Section`,
  `SectionHeader`, `Container`, `MineralStrip`, `Breadcrumb`, `Icon`,
  `Button`).
- **Tool pages** (`/signature-generator`, `/studio`) mount the
  pre-existing React page components as `client:only="react"` islands:
  `src/pages/signature/SignaturePage`, `src/pages/studio/StudioPage`,
  Those `.tsx`/`.ts` modules live inside
  `src/pages/` but are **not** routes — Astro only routes `.astro` files
  (the build warns about the two `.ts` helpers and skips them).
- **Engines** (`src/engines/{signature,nyuchi,brands,metrics}`) are
  pure modules also imported by the Cloudflare Worker in `../mcp/src` —
  do not add browser or Astro dependencies to them.
- **Styling**: `src/styles/global.css` imports Tailwind 4, the canonical
  `@bundu/ui/styles/globals.css` + `brand-nyuchi.css` (site primary = gold),
  local `fonts.css` (vendored variable fonts), and `compat.css` (maps the
  legacy `--fs-*` / `--space-*` / `--surface` … vars the tool islands use
  onto the canonical tokens). The @bundu/ui Tailwind preset is wired via
  `@config "../../tailwind.config.mjs"`.

## Commands

```bash
npm run dev      # astro dev server
npm run build    # tsc -b && astro build → dist/ (type-check included)
npm run lint     # eslint (React/TS sources)
npm run preview  # serve the built dist/
npm test         # vitest — engine + page-helper unit tests
```

The built `dist/` is served as static assets by the `nyuchi-tools` Worker
(root `wrangler.toml`); build here before deploying the Worker.
