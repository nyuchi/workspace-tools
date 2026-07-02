/**
 * Nyuchi MCP Worker.
 *
 * Deployed at https://tools.nyuchi.com/mcp/* via a Cloudflare Workers route
 * (see wrangler.toml). Inside this Worker, Hono routes are matched against
 * the ORIGINAL request URL (Workers do not strip the route prefix), so the
 * Hono route path is `/mcp` — the same path the route pattern matches.
 *
 * Transport: streamable-HTTP (per MCP 2024-11-05). We implement a minimal
 * per-request transport because the SDK's built-in `StreamableHTTPServerTransport`
 * (v1.29.x) targets Node.js req/res, not the fetch API used by Workers.
 * For our stateless single-JSON-RPC-request-per-POST use case this is enough;
 * SSE / server-initiated streaming is not required by the current tool set.
 */

import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const SERVER_NAME = "nyuchi-mcp";
const SERVER_VERSION = "0.1.0";
const MCP_PROTOCOL_VERSION = "2024-11-05";

// -----------------------------------------------------------------------------
// Minimal per-request streamable-HTTP transport.
// -----------------------------------------------------------------------------

/**
 * Single-shot transport: feeds one incoming JSON-RPC message into the server,
 * captures the first outgoing message, and resolves with it. Notifications
 * (no `id`) get a 202 with no body — handled at the fetch layer, not here.
 */
class WorkerHttpTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  sessionId?: string;

  private _resolveResponse!: (message: JSONRPCMessage) => void;
  private _responsePromise: Promise<JSONRPCMessage>;

  constructor() {
    this._responsePromise = new Promise<JSONRPCMessage>((resolve) => {
      this._resolveResponse = resolve;
    });
  }

  async start(): Promise<void> {
    // No-op: connection is a single HTTP request.
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this._resolveResponse(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  /** Dispatch a decoded JSON-RPC message and await the server's reply. */
  dispatch(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!this.onmessage) {
      throw new Error("Transport not connected to a server");
    }
    this.onmessage(message);
    return this._responsePromise;
  }
}

// -----------------------------------------------------------------------------
// MCP server + tool registrations.
// -----------------------------------------------------------------------------

function buildServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // --- generate_email_signature -------------------------------------------
  server.registerTool(
    "generate_email_signature",
    {
      title: "Generate email signature",
      description: "Generate a branded Nyuchi email signature as HTML.",
      inputSchema: {
        brand: z.string().describe("Brand slug, e.g. 'nyuchi' or 'mukoko'."),
        name: z.string().describe("Full name of the signer."),
        title: z.string().optional().describe("Job title / role."),
        email: z.string().describe("Email address."),
        phone: z.string().optional().describe("Phone number in international format."),
        linkedin: z.string().optional().describe("LinkedIn profile URL or handle."),
      },
    },
    async (args: {
      brand: string;
      name: string;
      title?: string;
      email: string;
      phone?: string;
      linkedin?: string;
    }) => {
      // Stub — real signature template will land when the engine is ported here.
      const html = `<div data-nyuchi-signature="${escapeHtml(args.brand)}">` +
        `<strong>${escapeHtml(args.name)}</strong>` +
        (args.title ? `<br/><span>${escapeHtml(args.title)}</span>` : "") +
        `<br/><a href="mailto:${escapeHtml(args.email)}">${escapeHtml(args.email)}</a>` +
        `<!-- placeholder signature for ${escapeHtml(args.name)} -->` +
        `</div>`;
      return { content: [{ type: "text", text: html }] };
    },
  );

  // --- generate_studio_card -----------------------------------------------
  server.registerTool(
    "generate_studio_card",
    {
      title: "Generate Nyuchi Studio social card",
      description:
        "Generate a Nyuchi Studio social card as an SVG string. PNG rasterization is a follow-up.",
      inputSchema: {
        title: z.string(),
        dek: z.string().optional(),
        category: z.enum([
          "cobalt",
          "sodalite",
          "tanzanite",
          "malachite",
          "gold",
          "copper",
          "terracotta",
        ]),
        format: z.enum(["ig", "story", "16x9", "og", "li"]).optional(),
        layout: z.number().int().optional().default(5),
      },
    },
    async (args: {
      title: string;
      dek?: string;
      category: string;
      format?: string;
      layout?: number;
    }) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080">` +
        `<!-- placeholder studio card: category=${escapeHtml(args.category)} ` +
        `format=${escapeHtml(args.format ?? "ig")} layout=${args.layout ?? 5} -->` +
        `<rect width="1080" height="1080" fill="#5f5873"/>` +
        `<text x="60" y="540" fill="#fff" font-family="Plus Jakarta Sans" font-size="72">${escapeHtml(args.title)}</text>` +
        (args.dek
          ? `<text x="60" y="640" fill="#fff" font-family="Plus Jakarta Sans" font-size="36">${escapeHtml(args.dek)}</text>`
          : "") +
        `</svg>`;
      return { content: [{ type: "text", text: svg }] };
    },
  );

  // --- generate_article_banner --------------------------------------------
  server.registerTool(
    "generate_article_banner",
    {
      title: "Generate article banner",
      description: "Generate an article banner as an SVG string.",
      inputSchema: {
        title: z.string(),
        dek: z.string().optional(),
        category: z.string(),
        format: z.string().optional(),
        layout: z.number().int().optional().default(5),
      },
    },
    async (args: {
      title: string;
      dek?: string;
      category: string;
      format?: string;
      layout?: number;
    }) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">` +
        `<!-- placeholder article banner: category=${escapeHtml(args.category)} ` +
        `format=${escapeHtml(args.format ?? "16x9")} layout=${args.layout ?? 5} -->` +
        `<rect width="1600" height="900" fill="#5f5873"/>` +
        `<text x="80" y="460" fill="#fff" font-family="Plus Jakarta Sans" font-size="96">${escapeHtml(args.title)}</text>` +
        (args.dek
          ? `<text x="80" y="560" fill="#fff" font-family="Plus Jakarta Sans" font-size="40">${escapeHtml(args.dek)}</text>`
          : "") +
        `</svg>`;
      return { content: [{ type: "text", text: svg }] };
    },
  );

  return server;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -----------------------------------------------------------------------------
// Hono HTTP surface.
// -----------------------------------------------------------------------------

const app = new Hono();

// Discovery: cheap identity ping for clients probing the endpoint.
app.get("/mcp", (c) => {
  return c.json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: `mcp/${MCP_PROTOCOL_VERSION}`,
    endpoint: "/mcp",
  });
});

// JSON-RPC entry: one request per POST (stateless streamable-HTTP).
app.post("/mcp", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      400,
    );
  }

  const messages = Array.isArray(body) ? body : [body];
  const server = buildServer();
  const transport = new WorkerHttpTransport();
  await server.connect(transport);

  try {
    // MCP HTTP requests batching is rare; we support only single-request payloads.
    // Notifications (no `id`) get an empty 202 per JSON-RPC + MCP HTTP spec.
    const first = messages[0] as { id?: unknown };
    if (first == null || typeof first !== "object") {
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
        400,
      );
    }
    const isNotification = !("id" in first) || first.id === undefined || first.id === null;
    if (isNotification) {
      transport.dispatch(first as JSONRPCMessage).catch(() => {
        /* fire-and-forget; server may still process */
      });
      return new Response(null, { status: 202 });
    }

    const response = await transport.dispatch(first as JSONRPCMessage);
    return c.json(response);
  } finally {
    await transport.close();
  }
});

// Anything else under /mcp/*: 404 with a hint.
app.all("/mcp/*", (c) => c.json({ error: "not found", hint: "POST /mcp for JSON-RPC" }, 404));

export default {
  fetch: app.fetch,
};
