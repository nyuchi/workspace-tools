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
import {
  type AuthEnv,
  authConfigured,
  protectedResourceMetadata,
  verifyBearer,
  wwwAuthenticateHeader,
} from "./auth.js";
import {
  BRAND_KEYS,
  buildSignatureHtml,
  type SignatureParams,
} from "../../signature-generator/src/engines/signature";
import { TOP_BRAND_KEYS } from "../../signature-generator/src/engines/brands";
import {
  buildSVG as buildStudioCard,
  type Params as StudioParams,
} from "../../signature-generator/src/engines/nyuchi";
import {
  buildSVG as buildArticleBanner,
  type Params as BannerParams,
} from "../../signature-generator/src/engines/banner";

/** One-line brand taxonomy, appended to every `brand` param description. */
const BRAND_TAXONOMY =
  "Top-level Bundu-ecosystem brand: bundu (foundation), nyuchi (commercial), " +
  "mukoko (consumer), shamwari (community AI).";

/** The seven Mzizi mineral palettes shared by both SVG engines. */
const MINERALS = [
  "cobalt",
  "sodalite",
  "tanzanite",
  "malachite",
  "gold",
  "copper",
  "terracotta",
] as const;

const SERVER_NAME = "nyuchi-tools";
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
  // Shares the pure signature engine with the SPA so both surfaces emit
  // byte-identical signature HTML.
  server.registerTool(
    "generate_email_signature",
    {
      title: "Generate email signature",
      description: "Generate a branded Nyuchi email signature as HTML.",
      inputSchema: {
        brand: z
          .enum(BRAND_KEYS)
          .describe(
            `Brand slug. ${BRAND_TAXONOMY} travel and learning are legacy ` +
              "signature keys (Zimbabwe Information Platform initiative / Nyuchi Learning division).",
          ),
        name: z.string().describe("Full name of the signer."),
        email: z.string().describe("Email address."),
        title: z.string().optional().describe("Job title / role."),
        phone: z.string().optional().describe("Phone number in international format."),
        whatsapp: z.string().optional().describe("WhatsApp number, digits with country code."),
        profileImage: z.string().optional().describe("Profile image URL."),
        linkedin: z.string().optional().describe("LinkedIn profile URL."),
        twitter: z.string().optional().describe("X / Twitter profile URL."),
        facebook: z.string().optional().describe("Facebook page URL."),
        instagram: z.string().optional().describe("Instagram profile URL."),
        promoBanner: z.string().optional().describe("Promo banner image URL."),
        promoLink: z.string().optional().describe("Promo banner target URL."),
      },
    },
    async (args: SignatureParams) => {
      const html = buildSignatureHtml(args);
      return { content: [{ type: "text", text: html }] };
    },
  );

  // --- generate_studio_card -----------------------------------------------
  // The real Studio engine — the same pure module the SPA's /studio page
  // renders with. Text is measured from the committed font-metrics table
  // (Workers have no canvas); all user input is escaped inside the engine.
  server.registerTool(
    "generate_studio_card",
    {
      title: "Generate Nyuchi Studio social card",
      description:
        "Generate a Nyuchi Studio social card as an SVG string (same engine as the /studio page). " +
        "PNG rasterization is a follow-up. The second content item is JSON metadata: {format:{w,h}, seed}.",
      inputSchema: {
        title: z.string().describe("Card title."),
        dek: z.string().optional().describe("Supporting line under the title."),
        category: z.enum(MINERALS).describe("Mineral palette."),
        format: z
          .enum(["ig", "story", "16x9", "og", "li"])
          .optional()
          .default("ig")
          .describe("Canvas format (ig 1080x1080, story 1080x1920, 16x9 1600x900, og 1200x630, li 1200x627)."),
        layout: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .default(5)
          .describe("Layout: 1 type, 2 anchor, 3 split, 4 halo, 5 mineral."),
        theme: z.enum(["light", "dark"]).optional().default("dark").describe("Surface theme."),
        eyebrow: z.string().optional().describe("Kicker line; defaults to '<Mineral> · <role>'."),
        index: z.string().optional().describe("Big index numeral on the mineral swatch (layout 5)."),
        footnote: z.string().optional().describe("Small mono footnote (layout 5)."),
        role: z.string().optional().describe("Role label; defaults to the mineral's role."),
        brand: z
          .enum(TOP_BRAND_KEYS)
          .optional()
          .default("nyuchi")
          .describe(`Lockup brand. ${BRAND_TAXONOMY}`),
        seedKey: z
          .string()
          .optional()
          .describe("Seed for the generative graph; defaults to title+category+layout like the SPA."),
      },
    },
    async (args: {
      title: string;
      dek?: string;
      category: StudioParams["category"];
      format?: StudioParams["format"];
      layout?: number;
      theme?: StudioParams["theme"];
      eyebrow?: string;
      index?: string;
      footnote?: string;
      role?: string;
      brand?: StudioParams["brand"];
      seedKey?: string;
    }) => {
      const layout = args.layout ?? 5;
      const params: StudioParams = {
        format: args.format ?? "ig",
        layout,
        theme: args.theme ?? "dark",
        category: args.category,
        title: args.title,
        dek: args.dek,
        eyebrow: args.eyebrow,
        index: args.index,
        footnote: args.footnote,
        role: args.role,
        brand: args.brand ?? "nyuchi",
        // SPA defaults (StudioPage INITIAL state).
        facet: "diagonal",
        angle: 62,
        cleave: true,
        lattice: true,
        lockup: true,
        // Same derivation as the SPA (salt 0).
        seedKey: args.seedKey ?? `${args.title}${args.category}${layout}0`,
      };
      const { svg, format, seed } = buildStudioCard(params);
      return {
        content: [
          { type: "text", text: svg },
          { type: "text", text: JSON.stringify({ format: { w: format.w, h: format.h }, seed }) },
        ],
      };
    },
  );

  // --- generate_article_banner --------------------------------------------
  // The real banner engine — the same pure module the SPA's /banner page
  // renders with. Note the banner engine has no 'story' format and only
  // layouts 1–4.
  server.registerTool(
    "generate_article_banner",
    {
      title: "Generate article banner",
      description:
        "Generate an article banner as an SVG string (same engine as the /banner page). " +
        "PNG rasterization is a follow-up. The second content item is JSON metadata: {format:{w,h}, seed}.",
      inputSchema: {
        title: z.string().describe("Banner title."),
        dek: z.string().optional().describe("Supporting line under the title."),
        category: z.enum(MINERALS).describe("Mineral palette."),
        format: z
          .enum(["16x9", "og", "li", "ig"])
          .optional()
          .default("16x9")
          .describe("Canvas format (16x9 1600x900, og 1200x630, li 1200x627, ig 1080x1080)."),
        layout: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .default(1)
          .describe("Layout: 1 type-forward, 2 anchor, 3 split block, 4 centered halo."),
        theme: z.enum(["light", "dark"]).optional().default("dark").describe("Surface theme."),
        brand: z
          .enum(TOP_BRAND_KEYS)
          .optional()
          .default("nyuchi")
          .describe(`Lockup brand. ${BRAND_TAXONOMY}`),
        seedKey: z
          .string()
          .optional()
          .describe("Seed for the generative graph; defaults to title·category·layout like the SPA."),
      },
    },
    async (args: {
      title: string;
      dek?: string;
      category: BannerParams["category"];
      format?: BannerParams["format"];
      layout?: number;
      theme?: BannerParams["theme"];
      brand?: BannerParams["brand"];
      seedKey?: string;
    }) => {
      const layout = args.layout ?? 1;
      const params: BannerParams = {
        format: args.format ?? "16x9",
        layout,
        theme: args.theme ?? "dark",
        category: args.category,
        title: args.title,
        dek: args.dek,
        // SPA defaults (BannerPage INITIAL state).
        lattice: true,
        lockup: true,
        brand: args.brand ?? "nyuchi",
        // Same derivation as the SPA (seedSalt 0).
        seedKey: args.seedKey ?? `${args.title}·${args.category}·${layout}·0`,
      };
      const { svg, format, seed } = buildArticleBanner(params);
      return {
        content: [
          { type: "text", text: svg },
          { type: "text", text: JSON.stringify({ format: { w: format.w, h: format.h }, seed }) },
        ],
      };
    },
  );

  return server;
}

// -----------------------------------------------------------------------------
// Hono HTTP surface.
// -----------------------------------------------------------------------------

const app = new Hono<{ Bindings: AuthEnv }>();

// OAuth surface. Behavior is driven by the AUTHKIT_DOMAIN Worker var:
//
//   unset → the MCP server is OPEN. Discovery endpoints return JSON 404s so
//     MCP clients (e.g. claude.ai connectors) conclude "no sign-in needed"
//     instead of hitting the SPA fallback's 200 text/html and inventing a
//     broken sign-in service.
//
//   set → WorkOS Connect protects /mcp. The protected-resource metadata
//     advertises the WorkOS authorization server; client registration and
//     the actual OAuth flow happen on WorkOS, not here.
//
// These paths reach the Worker via assets.run_worker_first in wrangler.toml.
app.all("/.well-known/oauth-protected-resource", (c) => {
  if (authConfigured(c.env)) return c.json(protectedResourceMetadata(c.env));
  return c.json(
    { error: "no_protected_resource_metadata", detail: "This MCP server does not require authentication." },
    404,
  );
});
app.all("/.well-known/oauth-protected-resource/*", (c) => {
  if (authConfigured(c.env)) return c.json(protectedResourceMetadata(c.env));
  return c.json(
    { error: "no_protected_resource_metadata", detail: "This MCP server does not require authentication." },
    404,
  );
});
app.all("/.well-known/oauth-authorization-server", (c) =>
  c.json({ error: "no_authorization_server", detail: "Authorization is handled by WorkOS; see oauth-protected-resource metadata." }, 404),
);
app.all("/.well-known/oauth-authorization-server/*", (c) =>
  c.json({ error: "no_authorization_server", detail: "Authorization is handled by WorkOS; see oauth-protected-resource metadata." }, 404),
);
app.all("/register", (c) =>
  c.json({ error: "registration_not_supported", detail: "Client registration is handled by the WorkOS authorization server." }, 404),
);

// Bearer-token gate for /mcp — no-op until AUTHKIT_DOMAIN is configured.
app.use("/mcp", async (c, next) => {
  if (!authConfigured(c.env)) return next();
  const verified = await verifyBearer(c.env, c.req.header("Authorization"));
  if (!verified) {
    return c.json(
      { error: "unauthorized", detail: "Valid bearer token required." },
      401,
      { "WWW-Authenticate": wwwAuthenticateHeader(c.env) },
    );
  }
  return next();
});

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
