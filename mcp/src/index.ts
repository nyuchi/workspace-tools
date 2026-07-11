/**
 * Nyuchi Tools Worker.
 *
 * Deployed via a Workers Custom Domain on two hostnames (see wrangler.toml)
 * with `run_worker_first = true` — this Worker runs for EVERY request on
 * both, not just `/mcp`. tools.nyuchi.com is the human-facing site;
 * tools.nyuchi.dev is the canonical MCP endpoint (moved off .com after its
 * `/mcp` traffic kept tripping Cloudflare's Layer 7 DDoS mitigation — see
 * the MCP_RESOURCE comment in wrangler.toml). Same code, same behavior on
 * both; only the advertised MCP_RESOURCE differs. It serves three things:
 *
 *   - `/mcp`, plus the OAuth/MCP discovery surface (`/.well-known/*`,
 *     `/auth.md`, `/register`) — bearer-token protected, cookie-free, meant
 *     for MCP clients and agents. See auth.ts.
 *   - `/login`, `/callback`, `/logout` — the site-wide login gate for human
 *     visitors, an Authorization Code + PKCE flow against the Hosted AuthKit
 *     UI at identity.nyuchi.com. See site-auth.ts.
 *   - everything else — the built signature-generator Astro site, served as
 *     static assets via `c.env.ASSETS.fetch(...)`, but only once the
 *     site-wide login gate above has let the request through.
 *
 * Transport: streamable-HTTP (per MCP 2024-11-05). We implement a minimal
 * per-request transport because the SDK's built-in `StreamableHTTPServerTransport`
 * (v1.29.x) targets Node.js req/res, not the fetch API used by Workers.
 * For our stateless single-JSON-RPC-request-per-POST use case this is enough;
 * SSE / server-initiated streaming is not required by the current tool set.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  type AuthEnv,
  authConfigured,
  issuerUrl,
  protectedResourceMetadata,
  verifyBearer,
  verifyJwt,
  wwwAuthenticateHeader,
} from "./auth.js";
import { fetchMetadata } from "./as-metadata-proxy.js";
import { authMd } from "./auth-md.js";
import { buildServerCard } from "./server-card.js";
import {
  buildAuthorizeUrl,
  CALLBACK_PATH,
  codeChallengeFromVerifier,
  decodeOauthCookie,
  encodeOauthCookie,
  exchangeCode,
  generateCodeVerifier,
  generateState,
  mintSessionCookie,
  OAUTH_COOKIE_NAME,
  oauthCookieOptions,
  sanitizeReturnTo,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  type SessionClaims,
  SITE_CLIENT_ID,
  type SiteAuthEnv,
  verifySessionCookie,
} from "./site-auth.js";
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
import { ensureBrandIconsLoaded } from "./brand-icons.js";

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

function buildServer(env: Env): McpServer {
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
        "`format` (canvas shape) and `layout` (composition) are independent axes — every combination " +
        "is valid, so pick each on its own merits rather than treating them as one choice. Default is " +
        "format 'ig' (square) + layout 5 (mineral, a 'meet this mineral' educational card); use layouts " +
        "1-4 for a title-first social card instead. PNG rasterization is a follow-up. The second content " +
        "item is JSON metadata: {format:{w,h}, seed}.",
      inputSchema: {
        title: z.string().describe("Card title."),
        dek: z.string().optional().describe("Supporting line under the title."),
        category: z.enum(MINERALS).describe("Mineral palette."),
        format: z
          .enum(["ig", "story", "16x9", "og", "li"])
          .optional()
          .default("ig")
          .describe(
            "Canvas aspect ratio / target platform — independent of layout. " +
              "'ig' Square 1080x1080 (default; Instagram feed or any square social slot). " +
              "'story' 1080x1920 (Instagram/Facebook Story, full-bleed vertical). " +
              "'16x9' 1600x900 (wide hero/header image). " +
              "'og' 1200x630 (Open Graph link-preview unfurl for Slack/X/iMessage). " +
              "'li' 1200x627 (LinkedIn share image, near-identical to og).",
          ),
        layout: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .default(5)
          .describe(
            "Composition — independent of format, applies at any aspect ratio. " +
              "5 mineral (default): a diagonal light/dark colour swatch for `category`'s mineral, with " +
              "index/footnote/role overlaid — a 'meet this mineral' card, not a title-first design. " +
              "1 type-forward: the headline dominates the frame, node graph subtle in the background — " +
              "best for a punchy title with little else. " +
              "2 anchor: text in a left column, a large node-graph mark anchored on the right half. " +
              "3 split: a solid mineral-colour panel (with the node graph) split against the headline on " +
              "a dark panel — the boldest, most color-blocked option. " +
              "4 halo: everything centered, with the node graph arcing around the text like a halo.",
          ),
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
      await ensureBrandIconsLoaded(env.ASSETS);
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
        "`format` (canvas shape) and `layout` (composition) are independent axes — every combination " +
        "is valid, so pick each on its own merits rather than treating them as one choice. Default is " +
        "format 'ig' (square) + layout 1 (type-forward); reach for '16x9' when the banner needs a wide " +
        "article-header shape, or 'og'/'li' for a link-preview unfurl. PNG rasterization is a follow-up. " +
        "The second content item is JSON metadata: {format:{w,h}, seed}. Note: unlike " +
        "generate_studio_card, this engine has no 'story' format and only layouts 1-4 (no mineral swatch).",
      inputSchema: {
        title: z.string().describe("Banner title."),
        dek: z.string().optional().describe("Supporting line under the title."),
        category: z.enum(MINERALS).describe("Mineral palette."),
        format: z
          .enum(["16x9", "og", "li", "ig"])
          .optional()
          .default("ig")
          .describe(
            "Canvas aspect ratio / target platform — independent of layout. " +
              "'ig' Square 1080x1080 (default; Instagram feed or any square social slot). " +
              "'16x9' 1600x900 (wide article hero/header image). " +
              "'og' 1200x630 (Open Graph link-preview unfurl for Slack/X/iMessage). " +
              "'li' 1200x627 (LinkedIn share image, near-identical to og).",
          ),
        layout: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .default(1)
          .describe(
            "Composition — independent of format, applies at any aspect ratio. " +
              "1 type-forward (default): the headline dominates the frame, node graph subtle in the " +
              "background — best for a punchy title with little else. " +
              "2 anchor: text in a left column, a large node-graph mark anchored on the right half. " +
              "3 split: a solid mineral-colour panel (with the node graph) split against the headline on " +
              "a dark panel — the boldest, most color-blocked option. " +
              "4 halo: everything centered, with the node graph arcing around the text like a halo.",
          ),
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
      await ensureBrandIconsLoaded(env.ASSETS);
      const layout = args.layout ?? 1;
      const params: BannerParams = {
        format: args.format ?? "ig",
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

/**
 * Builds a route handler that mirrors one of the WorkOS Connect authorization
 * server's `.well-known` discovery documents onto this domain, so agents
 * that only probe the resource server's own well-known paths still find it.
 *
 * - Auth OFF (no AUTHKIT_DOMAIN): there is no authorization server to
 *   mirror, so this keeps returning the same JSON 404 as before.
 * - Auth ON: fetches (never fabricates) the real document from
 *   identity.nyuchi.com and passes it through; a fetch failure or a
 *   non-200 upstream response becomes a 502 — never fake metadata.
 */
function authorizationServerMetadataHandler(wellKnownPath: "oauth-authorization-server" | "openid-configuration") {
  return async (c: Context<{ Bindings: AuthEnv }>) => {
    if (!authConfigured(c.env)) {
      return c.json(
        {
          error: "no_authorization_server",
          detail: "Authorization is handled by WorkOS; see oauth-protected-resource metadata.",
        },
        404,
      );
    }
    const upstream = `${issuerUrl(c.env)}/.well-known/${wellKnownPath}`;
    const result = await fetchMetadata(upstream);
    if (!result.ok) {
      return c.json({ error: "upstream_fetch_failed", detail: result.message }, 502);
    }
    return c.json(result.data as Record<string, unknown>);
  };
}

/**
 * This Worker's full environment: the WorkOS/MCP auth vars (`AuthEnv`), the
 * site-wide login gate's signing secret, and the static-assets binding the
 * post-auth catch-all route serves the built Astro site from.
 */
interface Env extends SiteAuthEnv {
  ASSETS: Fetcher;
}

interface Variables {
  sessionUser?: SessionClaims;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// -----------------------------------------------------------------------------
// Site-wide login gate.
//
// Every human-facing page on tools.nyuchi.com (Home, Help, Setup, the
// gmail-addon docs, Studio, Signature Generator, Banner — everything except
// the MCP JSON-RPC endpoint and the OAuth/MCP discovery surface below) sits
// behind a session cookie. The PKCE flow and cookie logic live in
// site-auth.ts; this just wires them into Hono.
//
// The exempt list below MUST stay exact and minimal:
//   /mcp, /mcp/*         — has its own bearer-token gate below; never double-gated.
//   /.well-known/*       — MCP client discovery must keep working with zero cookies.
//   /auth.md, /register  — existing agent-readiness docs/discovery stubs.
//   /login, /callback,
//   /logout              — the login flow itself (unreachable if gated).
//
// (signature-generator/public has no robots.txt / llms.txt / llms-full.txt /
// ads.txt today, so there is nothing else to exempt for crawlers. If any of
// those are added later, add them here too.)
// -----------------------------------------------------------------------------

const EXEMPT_SITE_AUTH_PATHS = new Set<string>([
  "/mcp",
  "/auth.md",
  "/register",
  "/login",
  CALLBACK_PATH,
  "/logout",
]);

function isExemptFromSiteAuth(pathname: string): boolean {
  if (EXEMPT_SITE_AUTH_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/mcp/")) return true;
  if (pathname === "/.well-known" || pathname.startsWith("/.well-known/")) return true;
  return false;
}

// Registered before every other route so it runs first for every request
// (Hono composes matching handlers in registration order).
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (isExemptFromSiteAuth(url.pathname)) {
    return next();
  }
  const claims = await verifySessionCookie(c.env, getCookie(c, SESSION_COOKIE_NAME));
  if (!claims) {
    // Never fail open: no/invalid session (including an unset
    // SESSION_SECRET, which verifySessionCookie treats as "no valid
    // session") always means "go log in", never "let the request through".
    const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);
    return c.redirect(`/login?return_to=${returnTo}`, 302);
  }
  c.set("sessionUser", claims);
  return next();
});

app.get("/login", async (c) => {
  if (!c.env.SESSION_SECRET) {
    // Fail CLOSED: don't send the user through an OAuth round trip that can
    // never succeed (mintSessionCookie throws without a secret) — surface
    // the misconfiguration instead of silently granting or looping.
    return c.text("Site authentication is not configured.", 500);
  }
  const returnTo = sanitizeReturnTo(c.req.query("return_to"));
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeFromVerifier(codeVerifier);
  setCookie(
    c,
    OAUTH_COOKIE_NAME,
    encodeOauthCookie({ state, codeVerifier, returnTo }),
    oauthCookieOptions(),
  );
  return c.redirect(buildAuthorizeUrl(c.env, state, codeChallenge, returnTo), 302);
});

app.get(CALLBACK_PATH, async (c) => {
  const denyLogin = () => {
    deleteCookie(c, OAUTH_COOKIE_NAME, { path: "/" });
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    // Generic failure — never leak *why* to the client.
    return c.redirect("/login?error=1", 302);
  };

  const oauthPayload = decodeOauthCookie(getCookie(c, OAUTH_COOKIE_NAME));
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!oauthPayload || !code || !state || state !== oauthPayload.state) {
    return denyLogin();
  }
  if (!c.env.SESSION_SECRET) {
    // Fail CLOSED: never mint a session without a configured secret.
    return denyLogin();
  }

  let idToken: string | undefined;
  try {
    const tokenResponse = await exchangeCode(code, oauthPayload.codeVerifier);
    idToken = tokenResponse.id_token;
  } catch {
    return denyLogin();
  }
  if (!idToken) {
    // scope=openid was requested; a missing id_token means the exchange
    // didn't give us what we need to establish identity. Deny, don't guess.
    return denyLogin();
  }

  // Verify the id_token, not the access_token: an id_token's `aud` is the
  // OAuth client_id per OIDC Core (§2), which has nothing to do with the
  // /mcp resource indicator `verifyJwt` defaults to for bearer-token calls.
  const verified = await verifyJwt(c.env, idToken, SITE_CLIENT_ID);
  if (!verified) {
    return denyLogin();
  }

  let sessionCookieValue: string;
  try {
    sessionCookieValue = await mintSessionCookie(c.env, { sub: verified.sub, email: verified.email });
  } catch {
    return denyLogin();
  }

  deleteCookie(c, OAUTH_COOKIE_NAME, { path: "/" });
  setCookie(c, SESSION_COOKIE_NAME, sessionCookieValue, sessionCookieOptions());
  return c.redirect(sanitizeReturnTo(oauthPayload.returnTo), 302);
});

app.get("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.redirect("/", 302);
});

// OAuth surface. Behavior is driven by the AUTHKIT_DOMAIN Worker var:
//
//   unset → the MCP server is OPEN. Discovery endpoints return JSON 404s so
//     MCP clients (e.g. claude.ai connectors) conclude "no sign-in needed"
//     instead of hitting the SPA fallback's 200 text/html and inventing a
//     broken sign-in service.
//
//   set → WorkOS Connect protects /mcp. The protected-resource metadata
//     advertises the WorkOS authorization server; client registration and
//     the actual OAuth flow happen on WorkOS, not here. The authorization
//     server's own discovery documents (oauth-authorization-server,
//     openid-configuration) are mirrored — fetched from identity.nyuchi.com
//     and passed through, never fabricated — onto this domain's
//     `.well-known` paths so agents that only probe the resource server
//     still find them.
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
app.all("/.well-known/oauth-authorization-server", authorizationServerMetadataHandler("oauth-authorization-server"));
app.all("/.well-known/oauth-authorization-server/*", authorizationServerMetadataHandler("oauth-authorization-server"));
app.all("/.well-known/openid-configuration", authorizationServerMetadataHandler("openid-configuration"));
app.all("/register", (c) =>
  c.json({ error: "registration_not_supported", detail: "Client registration is handled by the WorkOS authorization server." }, 404),
);

// MCP Server Card — static discovery document for agent-readiness scanners
// and MCP clients (see server-card.ts). Reached via the existing
// `/.well-known/*` entry in wrangler.toml's assets.run_worker_first.
app.get("/.well-known/mcp/server-card.json", (c) => c.json(buildServerCard(SERVER_NAME, SERVER_VERSION, c.env)));

// auth.md — human/agent-readable description of the OAuth architecture
// (see auth-md.ts). Reached via the `/auth.md` entry in
// wrangler.toml's assets.run_worker_first.
app.get("/auth.md", (c) => c.text(authMd(c.env), 200, { "Content-Type": "text/markdown; charset=utf-8" }));

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
  const server = buildServer(c.env);
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

// Everything else, once the login gate above has passed (or the path was
// exempt): the built Astro site as static assets (see [assets] in
// wrangler.toml). Registered LAST — Hono composes matching handlers in
// registration order, so this only ever runs for requests that fell through
// every more specific route above. `run_worker_first = true` in
// wrangler.toml means Cloudflare no longer serves assets before the Worker
// runs, so this route is what actually serves them now.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
};
