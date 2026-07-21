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
 * Transport: streamable-HTTP, stateless JSON (one JSON-RPC request per
 * POST). We implement a minimal per-request transport because the SDK's
 * built-in `StreamableHTTPServerTransport` (v1.29.x) targets Node.js
 * req/res, not the fetch API used by Workers. Protocol version negotiation
 * is the SDK's — it accepts every entry in SUPPORTED_PROTOCOL_VERSIONS; the
 * LATEST_PROTOCOL_VERSION import below is only for discovery display.
 * SSE / server-initiated streaming is not required by the current tool set.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { LATEST_PROTOCOL_VERSION, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
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
  HEX_COLOR_RE,
  type Params as StudioParams,
} from "../../signature-generator/src/engines/nyuchi";
import { ensureBrandIconsLoaded } from "./brand-icons.js";
import { rasterizeSvg, warmRaster } from "./raster.js";
import {
  imagesConfigured,
  MAX_UPLOAD_BYTES,
  sanitizeKey,
  uploadImage,
  type ImagesEnv,
} from "./images.js";
import {
  createFeedbackIssue,
  feedbackRepo,
  type FeedbackCategory,
  type FeedbackEnv,
  type FeedbackSeverity,
} from "./feedback.js";
import {
  registerSignatureApi,
  SIGNATURE_API_PATH,
  type SignatureApiEnv,
} from "./signature-api.js";

/** Chunked bytes → base64 (no Buffer dependency; works in Workers + node). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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
/** Display-only (GET /mcp ping): actual negotiation is per-request in the SDK. */
const MCP_PROTOCOL_VERSION = LATEST_PROTOCOL_VERSION;

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
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
        "Generate a Nyuchi Studio social card (same engine as the /studio page). " +
        "`format` (canvas shape) and `layout` (composition) are independent axes — every combination " +
        "is valid, so pick each on its own merits rather than treating them as one choice. Default is " +
        "format 'ig' (square) + layout 5 (mineral, a 'meet this mineral' educational card); use layouts " +
        "1-4 for a title-first social card instead. `returnFormat` controls the response shape: 'svg' " +
        "(default without upload) returns the full SVG source plus JSON metadata — right for " +
        "design/editing/debugging; 'png' returns the rasterized image inline, no upload; 'url' " +
        "(default when `upload` is true) rasterizes, uploads to Cloudflare Images, and returns just " +
        "{url, id, width, height, seed} — the right choice when scheduling to social (Buffer, " +
        "Instagram, X all need a public image URL). Short single-line titles automatically scale up " +
        "to poster size (hook mode); wrapping titles keep the standard sizing.",
      // Not read-only: upload=true publishes the rendered card to Cloudflare
      // Images. Creation-only, never destructive; duplicate keys error rather
      // than overwrite (hence not idempotent).
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
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
        theme: z
          .enum(["light", "dark", "accent"])
          .optional()
          .default("dark")
          .describe(
            "Surface theme. 'dark' (default) adds a mineral glow behind the node graph; 'accent' is " +
              "a full-bleed mineral background with ink text — the boldest, most feed-stopping option.",
          ),
        eyebrow: z
          .string()
          .optional()
          .describe(
            "Kicker line, rendered as a filled pill chip; defaults to '<Mineral> · <role>'.",
          ),
        index: z.string().optional().describe("Big index numeral on the mineral swatch (layout 5)."),
        footnote: z.string().optional().describe("Small mono footnote (layout 5)."),
        showHexes: z
          .boolean()
          .optional()
          .describe(
            "Layout 5 only: show the mineral's DARK/LIGHT hex labels on the swatch. Default: only " +
              "when the card is about the mineral itself (no title, or the title is the mineral " +
              "name) — generic cards hide the spec labels automatically.",
          ),
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
        dekFontSize: z
          .number()
          .int()
          .min(10)
          .max(400)
          .optional()
          .describe(
            "Preferred dek font-size in px (still shrinks to fit long text). " +
              "Default: ~0.88× the fitted title size.",
          ),
        dekColor: z
          .string()
          .regex(HEX_COLOR_RE)
          .optional()
          .describe(
            "Dek fill as a hex color. Default: the surface foreground (#FAF9F5 on dark, #141413 on " +
              "light) — keep it there for contrast; use the mineral accents only for eyebrow/graph.",
          ),
        upload: z
          .boolean()
          .optional()
          .describe(
            "Rasterize server-side and upload to Cloudflare Images; flips the default returnFormat " +
              "to 'url'. Combine with returnFormat 'png' to upload AND receive the pixels inline " +
              "(the metadata then carries the url); combining with 'svg' is an error. Requires the " +
              "server to be configured with Cloudflare Images credentials.",
          ),
        returnFormat: z
          .enum(["url", "png", "svg"])
          .optional()
          .describe(
            "Response shape: 'url' uploads and returns only the public URL + metadata (default when " +
              "upload=true); 'png' returns the rasterized image inline; 'svg' returns the full SVG " +
              "source (default otherwise).",
          ),
        uploadKey: z
          .string()
          .max(512)
          .optional()
          .describe(
            "Suggested image id for uploads, namespaced per brand/campaign, e.g. " +
              "'nhimbe/2026-07/harvest-post.png'. Must be unique; unusable keys fall back to a " +
              "generated id.",
          ),
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
      showHexes?: boolean;
      dekFontSize?: number;
      dekColor?: string;
      upload?: boolean;
      returnFormat?: "url" | "png" | "svg";
      uploadKey?: string;
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
        showHexes: args.showHexes,
        dekFontSize: args.dekFontSize,
        dekColor: args.dekColor,
        // SPA defaults (StudioPage INITIAL state).
        facet: "diagonal",
        angle: 62,
        cleave: true,
        lattice: true,
        lockup: true,
        // Same derivation as the SPA (salt 0).
        seedKey: args.seedKey ?? `${args.title}${args.category}${layout}0`,
      };
      const returnFormat = args.returnFormat ?? (args.upload ? "url" : "svg");
      if (args.upload && returnFormat === "svg") {
        throw new Error(
          "upload:true cannot be combined with returnFormat 'svg' — nothing would be uploaded. " +
            "Use 'url' (the default with upload), 'png' (uploads AND returns the pixels inline), " +
            "or drop upload.",
        );
      }
      const wantUpload = Boolean(args.upload) || returnFormat === "url";
      // Overlap rasterizer cold-start (wasm + fonts) with icon loading.
      if (returnFormat !== "svg") warmRaster(env.ASSETS);
      await ensureBrandIconsLoaded(env.ASSETS);
      const { svg, format, seed } = buildStudioCard(params);

      if (returnFormat === "svg") {
        return {
          content: [
            { type: "text", text: svg },
            { type: "text", text: JSON.stringify({ format: { w: format.w, h: format.h }, seed }) },
          ],
        };
      }

      const png = await rasterizeSvg(svg, env.ASSETS);
      let uploaded: { url: string; id: string } | undefined;
      if (wantUpload) {
        if (!imagesConfigured(env)) {
          throw new Error(
            "Uploading needs Cloudflare Images configured on this server (CF_IMAGES_ACCOUNT_ID " +
              "plus the CF_IMAGES_TOKEN — or legacy CF_IMAGE_TOKEN — secret). " +
              "Use returnFormat 'png' or 'svg' without upload instead.",
          );
        }
        uploaded = await uploadImage(env, png, {
          id: sanitizeKey(args.uploadKey),
          contentType: "image/png",
        });
      }

      if (returnFormat === "png") {
        const meta = {
          format: { w: format.w, h: format.h },
          seed,
          ...(uploaded ? { url: uploaded.url, id: uploaded.id } : {}),
        };
        return {
          content: [
            { type: "image", data: bytesToBase64(png), mimeType: "image/png" },
            { type: "text", text: JSON.stringify(meta) },
          ],
        };
      }

      const payload = { url: uploaded!.url, id: uploaded!.id, width: format.w, height: format.h, seed };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    },
  );

  // --- upload_asset --------------------------------------------------------
  // Standalone "give me a public URL" tool: takes SVG (rasterized
  // server-side) or ready PNG bytes and uploads to Cloudflare Images, so a
  // generated image can be attached to anything that needs a fetchable URL
  // (Buffer, Instagram, X, ...).
  server.registerTool(
    "upload_asset",
    {
      title: "Upload an image asset, get a public URL",
      description:
        "Upload a generated image to Cloudflare Images and return a stable public URL in one call. " +
        "Give it either `svg` (e.g. the output of generate_studio_card — it is rasterized to PNG " +
        "server-side, no client SVG→PNG pipeline needed) or `pngBase64` (pre-rasterized bytes). " +
        "For generate_studio_card output, prefer calling that tool with upload=true instead — one " +
        "call, no SVG round-trip.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      outputSchema: {
        url: z.string().describe("Public delivery URL of the uploaded asset."),
        id: z.string().describe("Cloudflare Images id (the sanitized key, or a generated id)."),
        contentType: z.enum(["image/png", "image/svg+xml"]).describe("Stored content type."),
      },
      inputSchema: {
        svg: z
          .string()
          .optional()
          .describe("Raw SVG source to rasterize and upload. Exactly one of svg / pngBase64."),
        pngBase64: z
          .string()
          .optional()
          .describe("Base64-encoded PNG bytes to upload as-is. Exactly one of svg / pngBase64."),
        key: z
          .string()
          .max(512)
          .optional()
          .describe(
            "Suggested image id, namespaced per brand/campaign (e.g. 'nhimbe/2026-07/slug.png'). " +
              "Must be unique; unusable keys fall back to a generated id.",
          ),
        contentType: z
          .enum(["image/png", "image/svg+xml"])
          .optional()
          .describe(
            "Only meaningful with `svg` input: 'image/svg+xml' uploads the raw SVG without " +
              "rasterizing (note: social platforms generally can't use SVG URLs). Default: rasterize " +
              "to image/png.",
          ),
      },
    },
    async (args: {
      svg?: string;
      pngBase64?: string;
      key?: string;
      contentType?: "image/png" | "image/svg+xml";
    }) => {
      // Truthiness on purpose, and the same predicate drives the dispatch
      // below — an empty-string pngBase64 must not shadow a valid svg.
      if ((args.svg ? 1 : 0) + (args.pngBase64 ? 1 : 0) !== 1) {
        throw new Error("Provide exactly one of `svg` or `pngBase64`.");
      }
      if (!imagesConfigured(env)) {
        throw new Error(
          "Image upload is not configured on this server (CF_IMAGES_ACCOUNT_ID / CF_IMAGES_TOKEN " +
            "unset). Ask the operator to provision Cloudflare Images credentials.",
        );
      }

      let bytes: Uint8Array;
      let contentType: "image/png" | "image/svg+xml";
      if (args.pngBase64) {
        try {
          bytes = base64ToBytes(args.pngBase64);
        } catch {
          throw new Error("`pngBase64` is not valid base64.");
        }
        // PNG magic: eight fixed signature bytes.
        const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        if (bytes.length < 8 || magic.some((b, i) => bytes[i] !== b)) {
          throw new Error("`pngBase64` does not decode to a PNG (bad signature).");
        }
        contentType = "image/png";
      } else if (args.contentType === "image/svg+xml") {
        bytes = new TextEncoder().encode(args.svg as string);
        contentType = "image/svg+xml";
      } else {
        bytes = await rasterizeSvg(args.svg as string, env.ASSETS);
        contentType = "image/png";
      }
      if (bytes.length > MAX_UPLOAD_BYTES) {
        throw new Error(`Asset is ${bytes.length} bytes; the upload cap is ${MAX_UPLOAD_BYTES} bytes.`);
      }

      const { url, id } = await uploadImage(env, bytes, {
        id: sanitizeKey(args.key),
        contentType,
      });
      const payload = { url, id, contentType };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    },
  );

  // --- report_issue --------------------------------------------------------
  // Feedback loop: file a real GitHub issue on the Nyuchi Tools repo from
  // inside a session, instead of relying on someone writing a doc afterward.
  server.registerTool(
    "report_issue",
    {
      title: "Report an issue with a Nyuchi Tools tool",
      description:
        "File a GitHub issue on the Nyuchi Tools repo about a problem or gap in one of this " +
        "server's tools — a bug, a missing capability, confusing output, or a documentation gap. " +
        "The target repo is configured server-side. Include what was tried, what happened, and " +
        "what was expected; always name the specific tool concerned.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      outputSchema: {
        url: z.string().describe("URL of the created GitHub issue."),
        number: z.number().describe("Issue number."),
        repo: z.string().describe("owner/repo the issue was filed on."),
      },
      inputSchema: {
        title: z.string().min(4).max(200).describe("Short summary of the issue."),
        description: z
          .string()
          .min(10)
          .max(20000)
          .describe("What was tried, what happened, and what was expected. Markdown welcome."),
        tool_name: z
          .string()
          .max(100)
          .describe(
            "Which tool this concerns (e.g. generate_studio_card, upload_asset, " +
              "generate_email_signature) — be unambiguous.",
          ),
        severity: z
          .enum(["low", "medium", "high"])
          .optional()
          .default("medium")
          .describe("Impact of the issue."),
        category: z
          .enum(["bug", "missing_capability", "confusing_output", "documentation"])
          .describe("What kind of issue this is."),
      },
    },
    async (args: {
      title: string;
      description: string;
      tool_name: string;
      severity?: FeedbackSeverity;
      category: FeedbackCategory;
    }) => {
      const { url, number } = await createFeedbackIssue(env, {
        title: args.title,
        description: args.description,
        toolName: args.tool_name,
        severity: args.severity ?? "medium",
        category: args.category,
      });
      const payload = { url, number, repo: feedbackRepo(env) };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
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
interface Env extends SiteAuthEnv, ImagesEnv, FeedbackEnv, SignatureApiEnv {
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
  // /api/signature does its OWN auth (SIGNATURE_API_KEY bearer or session
  // cookie — see signature-api.ts); the gate's 302-to-/login would break
  // its non-browser callers (Apps Script UrlFetchApp).
  SIGNATURE_API_PATH,
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

// POST /api/signature — byte-locked signature HTML from the canonical
// engine, for Apps Script and other server-to-server callers. Does its own
// auth (bearer key or session cookie); exempted from the site gate above.
registerSignatureApi(app);

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
