/**
 * MCP Server Card — a static, unauthenticated discovery document that lets
 * agent-readiness scanners and MCP clients identify this server and its
 * remote transport without a JSON-RPC round trip.
 *
 * Served at GET /.well-known/mcp/server-card.json (see index.ts). Routed to
 * the Worker via the existing `/.well-known/*` entry in
 * `wrangler.toml`'s `assets.run_worker_first` — no separate entry needed.
 */

export interface ServerCard {
  serverInfo: { name: string; version: string };
  name: string;
  description: string;
  websiteUrl: string;
  remotes: { transportType: string; url: string }[];
  capabilities: { tools: { listChanged: boolean } };
}

export function buildServerCard(name: string, version: string): ServerCard {
  return {
    serverInfo: { name, version },
    name,
    description:
      "MCP server for Nyuchi Africa tools: email signatures, Nyuchi Studio social cards, and article banners.",
    websiteUrl: "https://tools.nyuchi.com",
    remotes: [{ transportType: "streamable-http", url: "https://tools.nyuchi.com/mcp" }],
    capabilities: { tools: { listChanged: true } },
  };
}
