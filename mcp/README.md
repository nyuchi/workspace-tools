# @nyuchi/mcp-tools

Model Context Protocol (MCP) server for the Nyuchi workspace-tools repo, exposed to LLM clients over streamable-HTTP.

- **Deploy target:** Cloudflare Workers, routed at `https://tools.nyuchi.com/mcp/*`.
- **Sibling deploys:** The React app in `signature-generator/` continues to serve the rest of `tools.nyuchi.com` from GitHub Pages. The Workers route for `/mcp/*` takes precedence over Pages for that path only.
- **Discovery endpoint:** `GET /mcp` returns a small JSON descriptor.
- **RPC endpoint:** `POST /mcp` handles JSON-RPC 2.0 requests per the MCP streamable-HTTP transport.

## Tools

Three stub tools are registered — they return valid MCP tool responses with placeholder HTML/SVG until the real generator engines are ported into this Worker.

| Name | Purpose |
|------|---------|
| `generate_email_signature` | Branded Nyuchi email signature HTML. |
| `generate_studio_card` | Nyuchi Studio social card as SVG. |
| `generate_article_banner` | Article banner as SVG. |

## Development

```bash
cd mcp
npm install
npm run dev        # local wrangler dev server
```

## Deployment

```bash
npx wrangler login # first time only
cd mcp
npm run deploy
```

The `tools.nyuchi.com` zone must already exist in your Cloudflare account. The route in `wrangler.toml` binds the Worker to `tools.nyuchi.com/mcp/*`.

## Notes / Follow-ups

- **PNG rasterization is deferred.** The card and banner tools currently return SVG strings. Producing PNGs from a Worker will use either `@resvg/resvg-wasm` (server-side) or client-side canvas rendering by the caller — we picked SVG-only for the initial scaffold to keep the Worker bundle small.
- **Brand configuration is not shared** with the other three sub-projects yet — see the repo root `CLAUDE.md`. When the real signature engine lands here, decide whether to duplicate the brand map (fourth copy) or extract a shared package.
