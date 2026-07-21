/**
 * POST /api/signature — render byte-locked signature HTML over plain HTTP.
 *
 * The same canonical engine (`engines/signature`) that powers the web
 * island and the `generate_email_signature` MCP tool, exposed as a JSON
 * endpoint so the Apps Script projects (and any future console surface) can
 * fetch the emitted HTML instead of hand-syncing their own template copies
 * (signature-console-plan.md, Phase 0). The response HTML is byte-identical
 * to `buildSignatureHtml` — this module never post-processes it.
 *
 * Auth (the route is exempt from the site-wide login gate and does its own):
 *   - `Authorization: Bearer <SIGNATURE_API_KEY>` — constant-time compare
 *     against the Worker secret. Fails CLOSED with a clear detail when the
 *     secret is not provisioned.
 *   - OR a valid `nyuchi_session` site cookie (verifySessionCookie).
 * Anything else → 401 JSON. Never open.
 */

import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookie,
  type SiteAuthEnv,
} from "./site-auth.js";
import {
  BRAND_KEYS,
  buildSignatureHtml,
} from "../../signature-generator/src/engines/signature";

export interface SignatureApiEnv extends SiteAuthEnv {
  /** Shared secret for server-to-server callers (e.g. Apps Script). */
  SIGNATURE_API_KEY?: string;
}

export const SIGNATURE_API_PATH = "/api/signature";

/** Mirrors the `generate_email_signature` MCP tool's input schema (index.ts)
 * and the engine's SignatureParams shape — keep the three in lockstep. */
const signatureParamsSchema = z.object({
  brand: z.enum(BRAND_KEYS),
  name: z.string(),
  email: z.string(),
  title: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  profileImage: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  promoBanner: z.string().optional(),
  promoLink: z.string().optional(),
});

/**
 * Constant-time string equality: compare fixed-length SHA-256 digests with a
 * full XOR sweep, so neither the position of the first differing byte nor
 * the candidate's length shapes the timing.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

export function registerSignatureApi<E extends { Bindings: SignatureApiEnv }>(
  app: Hono<E>,
): void {
  app.post(SIGNATURE_API_PATH, async (c) => {
    // A presented bearer credential is judged on its own — a wrong or
    // unconfigurable key never silently falls back to the cookie path.
    const authorization = c.req.header("Authorization");
    if (authorization?.startsWith("Bearer ")) {
      if (!c.env.SIGNATURE_API_KEY) {
        // Fail CLOSED: no configured key means no bearer access, ever.
        return c.json(
          {
            error: "unauthorized",
            detail:
              "Bearer auth is not configured on this server (SIGNATURE_API_KEY secret unset).",
          },
          401,
        );
      }
      const token = authorization.slice("Bearer ".length);
      if (!(await timingSafeEqual(token, c.env.SIGNATURE_API_KEY))) {
        return c.json({ error: "unauthorized", detail: "Invalid bearer token." }, 401);
      }
    } else {
      const claims = await verifySessionCookie(c.env, getCookie(c, SESSION_COOKIE_NAME));
      if (!claims) {
        return c.json(
          {
            error: "unauthorized",
            detail:
              "Provide `Authorization: Bearer <SIGNATURE_API_KEY>` or a valid site session cookie.",
          },
          401,
        );
      }
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: "invalid_params", issues: [{ message: "Request body must be JSON" }] },
        400,
      );
    }
    const parsed = signatureParamsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid_params", issues: parsed.error.issues }, 400);
    }

    return c.json({ html: buildSignatureHtml(parsed.data) }, 200);
  });
}
