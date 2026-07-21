/**
 * MCP Server Card — a static, unauthenticated discovery document that lets
 * agent-readiness scanners and MCP clients identify this server and its
 * remote transport without a JSON-RPC round trip.
 *
 * Served at GET /.well-known/mcp/server-card.json (see index.ts). Routed to
 * the Worker via the existing `/.well-known/*` entry in
 * `wrangler.toml`'s `assets.run_worker_first` — no separate entry needed.
 *
 * `websiteUrl` and the MCP remote are deliberately different hostnames: the
 * human-facing site stays on tools.nyuchi.com, while the MCP endpoint is
 * tools.nyuchi.dev (see the MCP_RESOURCE comment in wrangler.toml) — so the
 * remote URL is derived from the configured resource rather than hardcoded.
 */

import { type AuthEnv, resourceUrl } from "./auth";

export interface ServerCard {
  serverInfo: { name: string; version: string };
  name: string;
  description: string;
  websiteUrl: string;
  remotes: { transportType: string; url: string }[];
  capabilities: {
    tools: { listChanged: boolean };
    resources: { listChanged: boolean };
    prompts: { listChanged: boolean };
  };
}

export function buildServerCard(name: string, version: string, env: AuthEnv): ServerCard {
  return {
    serverInfo: { name, version },
    name,
    description:
      "MCP server for Nyuchi Africa tools: email signatures, Nyuchi Studio social cards " +
      "(SVG, PNG, or hosted Cloudflare Images URL), asset uploads, and issue reporting.",
    websiteUrl: "https://tools.nyuchi.com",
    remotes: [{ transportType: "streamable-http", url: resourceUrl(env) }],
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
    },
  };
}
