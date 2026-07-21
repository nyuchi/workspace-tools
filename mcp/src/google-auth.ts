/**
 * Google OAuth plumbing for the Signature Console (Phase 1 of
 * docs/signature-console-plan.md), plus the self-service "Insert into
 * Gmail" endpoint.
 *
 * This is a SECOND, independent OAuth surface: site-auth.ts signs the user
 * into tools.nyuchi.com (WorkOS AuthKit); this module connects that
 * already-signed-in user's Google account so the Worker can call Google
 * APIs on their behalf. All routes registered here sit BEHIND the
 * site-wide login gate in index.ts (they are deliberately not on the
 * exempt list).
 *
 * Configuration (fails closed with clear errors until provisioned — same
 * pattern as images.ts / feedback.ts):
 *
 *   GOOGLE_CLIENT_ID      — Worker var (Web application OAuth client id)
 *   GOOGLE_CLIENT_SECRET  — secret (`wrangler secret put GOOGLE_CLIENT_SECRET`)
 *   SESSION_SECRET        — already required by site-auth.ts; the Google
 *                           session cookie's AES key is derived from it.
 *
 * Google tokens live server-side only, in the `nyuchi_google` cookie:
 * AES-256-GCM-encrypted JSON (key = SHA-256(SESSION_SECRET +
 * ':google-oauth'), random 12-byte IV prefixed to the ciphertext,
 * base64url). The page never sees a token — /api/google/status reports
 * only {connected, email, scopes}. A missing/undecryptable cookie or an
 * unset SESSION_SECRET is always "not connected", never a pass-through.
 */

import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { base64url } from "jose";
import { z } from "zod";
import {
  BRAND_KEYS,
  buildSignatureHtml,
} from "../../signature-generator/src/engines/signature";

export interface GoogleAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Same secret the site session uses (site-auth.ts). */
  SESSION_SECRET?: string;
}

export function googleConfigured(env: GoogleAuthEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export const GOOGLE_COOKIE_NAME = "nyuchi_google";
/** Short-lived state cookie for the authorize round-trip (mirrors
 * site-auth.ts's `nyuchi_oauth` pattern). */
export const GOOGLE_STATE_COOKIE_NAME = "nyuchi_google_oauth";
export const GOOGLE_CALLBACK_PATH = "/api/google/callback";

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SENDAS_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs";

export const GMAIL_SETTINGS_BASIC_SCOPE = "https://www.googleapis.com/auth/gmail.settings.basic";
export const DIRECTORY_READONLY_SCOPE =
  "https://www.googleapis.com/auth/admin.directory.user.readonly";

const SELF_SCOPES = ["openid", "email", GMAIL_SETTINGS_BASIC_SCOPE] as const;
const ADMIN_SCOPES = [...SELF_SCOPES, DIRECTORY_READONLY_SCOPE] as const;

export type GoogleMode = "self" | "admin";

export function scopesForMode(mode: GoogleMode): string[] {
  return mode === "admin" ? [...ADMIN_SCOPES] : [...SELF_SCOPES];
}

/** Google session cookie lifetime: 30 days — the refresh_token inside keeps
 * the access token current far beyond its own ~1h expiry. */
const GOOGLE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const STATE_COOKIE_MAX_AGE_SECONDS = 600;
/** Refresh this many seconds before the access token actually expires. */
const EXPIRY_SKEW_SECONDS = 60;

interface GoogleCookieOptions {
  httpOnly: true;
  secure: true;
  sameSite: "Lax";
  path: string;
  maxAge: number;
}

export function googleCookieOptions(): GoogleCookieOptions {
  return { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: GOOGLE_COOKIE_MAX_AGE_SECONDS };
}

function stateCookieOptions(): GoogleCookieOptions {
  return { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: STATE_COOKIE_MAX_AGE_SECONDS };
}

/** Opaque anti-CSRF value for the authorize round-trip. */
export function generateGoogleState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64url.encode(bytes);
}

export function buildGoogleAuthorizeUrl(
  env: GoogleAuthEnv,
  opts: { mode: GoogleMode; state: string; redirectUri: string },
): string {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", scopesForMode(opts.mode).join(" "));
  // offline + consent: always get a refresh_token, so the session outlives
  // the ~1h access token without another round-trip through Google.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", opts.state);
  return url.toString();
}

// -----------------------------------------------------------------------------
// The `nyuchi_google` session cookie: AES-256-GCM-encrypted JSON.
// -----------------------------------------------------------------------------

export interface GoogleSession {
  access_token: string;
  refresh_token?: string;
  /** Access-token expiry, epoch seconds. */
  expiry: number;
  scopes: string[];
  email: string;
}

/** Key = SHA-256(SESSION_SECRET + ':google-oauth') as a raw AES-256 key.
 * The suffix domain-separates this key from the HS256 site-session use of
 * the same secret. */
async function googleSessionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}:google-oauth`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

const IV_BYTES = 12;

/**
 * Encrypt a Google session into the cookie value. Throws if SESSION_SECRET
 * is unset — callers must treat a throw as "do not set the cookie", never
 * fall back to plaintext.
 */
export async function encryptGoogleSession(env: GoogleAuthEnv, session: GoogleSession): Promise<string> {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  const key = await googleSessionKey(env.SESSION_SECRET);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(session))),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, iv.length);
  return base64url.encode(out);
}

/**
 * Decrypt the Google session cookie. Returns null (never throws) for
 * anything that isn't a currently-decryptable, well-shaped session:
 * missing cookie, missing SESSION_SECRET, tampered/garbled ciphertext,
 * wrong-shaped JSON. Fails CLOSED — "not connected" — on every one.
 */
export async function decryptGoogleSession(
  env: GoogleAuthEnv,
  cookieValue: string | undefined,
): Promise<GoogleSession | null> {
  if (!cookieValue || !env.SESSION_SECRET) return null;
  try {
    const bytes = base64url.decode(cookieValue);
    if (bytes.length <= IV_BYTES) return null;
    const key = await googleSessionKey(env.SESSION_SECRET);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) },
      key,
      bytes.subarray(IV_BYTES),
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as GoogleSession).access_token === "string" &&
      typeof (parsed as GoogleSession).expiry === "number" &&
      Array.isArray((parsed as GoogleSession).scopes) &&
      (parsed as GoogleSession).scopes.every((s) => typeof s === "string") &&
      typeof (parsed as GoogleSession).email === "string"
    ) {
      return parsed as GoogleSession;
    }
    return null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Token endpoint + userinfo.
// -----------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/** POST to Google's token endpoint; null on any failure (routes deny). */
async function requestToken(params: Record<string, string>): Promise<GoogleTokenResponse | null> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  const token = (data as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || !token) return null;
  return data as GoogleTokenResponse;
}

async function fetchUserinfoEmail(accessToken: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  const email = (data as { email?: unknown } | null)?.email;
  return typeof email === "string" && email ? email : null;
}

function sessionFromToken(token: GoogleTokenResponse, email: string, previous?: GoogleSession): GoogleSession {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: token.access_token,
    // Google only returns refresh_token on the initial consent exchange (or
    // when it rotates one) — keep the previous one otherwise.
    ...(token.refresh_token ?? previous?.refresh_token
      ? { refresh_token: token.refresh_token ?? previous?.refresh_token }
      : {}),
    expiry: now + (token.expires_in ?? 3600),
    scopes: token.scope ? token.scope.split(" ") : (previous?.scopes ?? []),
    email,
  };
}

export interface RefreshResult {
  session: GoogleSession;
  /** True when the access token was renewed — the caller must re-set the
   * `nyuchi_google` cookie with the re-encrypted session. */
  refreshed: boolean;
}

/**
 * Return the session, refreshing the access token first if it is (nearly)
 * expired. Null means "no usable token" — expired with no refresh_token,
 * Google unconfigured, or the refresh itself failed — and callers must
 * treat it exactly like a missing session (fail closed).
 */
export async function refreshIfNeeded(
  env: GoogleAuthEnv,
  session: GoogleSession,
): Promise<RefreshResult | null> {
  const now = Math.floor(Date.now() / 1000);
  if (session.expiry - EXPIRY_SKEW_SECONDS > now) {
    return { session, refreshed: false };
  }
  if (!session.refresh_token || !googleConfigured(env)) return null;
  const token = await requestToken({
    grant_type: "refresh_token",
    refresh_token: session.refresh_token,
    client_id: env.GOOGLE_CLIENT_ID as string,
    client_secret: env.GOOGLE_CLIENT_SECRET as string,
  });
  if (!token) return null;
  return { session: sessionFromToken(token, session.email, session), refreshed: true };
}

// -----------------------------------------------------------------------------
// POST /api/self/insert request body — the same schema as the
// generate_email_signature MCP tool (index.ts), as a standalone object.
// -----------------------------------------------------------------------------

const SIGNATURE_PARAMS_SCHEMA = z.object({
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

// -----------------------------------------------------------------------------
// Routes. Registered from index.ts AFTER the site-wide login gate middleware
// (so every one of these requires a signed-in site session) and before the
// static-assets catch-all.
// -----------------------------------------------------------------------------

export function registerGoogleRoutes<E extends { Bindings: GoogleAuthEnv }>(app: Hono<E>): void {
  // GET /api/google/login?mode=self|admin → 302 to Google's consent screen.
  app.get("/api/google/login", (c) => {
    const env: GoogleAuthEnv = c.env;
    if (!googleConfigured(env)) {
      return c.json(
        {
          error: "google_not_configured",
          detail:
            "Google OAuth is not configured on this server (GOOGLE_CLIENT_ID / " +
            "GOOGLE_CLIENT_SECRET unset). Ask the operator to provision the OAuth client.",
        },
        503,
      );
    }
    if (!env.SESSION_SECRET) {
      // Fail CLOSED before sending the user to Google: without the secret
      // the callback could never encrypt the session cookie anyway.
      return c.json(
        {
          error: "google_not_configured",
          detail: "SESSION_SECRET is not configured; the Google session cookie cannot be protected.",
        },
        503,
      );
    }
    const mode: GoogleMode = c.req.query("mode") === "admin" ? "admin" : "self";
    const state = generateGoogleState();
    setCookie(c, GOOGLE_STATE_COOKIE_NAME, state, stateCookieOptions());
    const redirectUri = `${new URL(c.req.url).origin}${GOOGLE_CALLBACK_PATH}`;
    return c.redirect(buildGoogleAuthorizeUrl(env, { mode, state, redirectUri }), 302);
  });

  // GET /api/google/callback → verify state, exchange the code, set the
  // encrypted session cookie, land back on the signature page.
  app.get(GOOGLE_CALLBACK_PATH, async (c) => {
    const env: GoogleAuthEnv = c.env;
    const denyConnect = () => {
      deleteCookie(c, GOOGLE_STATE_COOKIE_NAME, { path: "/" });
      // Generic failure — never leak why (mirrors the site /callback).
      return c.redirect("/signature-generator?google=error", 302);
    };

    if (!googleConfigured(env) || !env.SESSION_SECRET) return denyConnect();
    const expectedState = getCookie(c, GOOGLE_STATE_COOKIE_NAME);
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!expectedState || !code || !state || state !== expectedState) {
      return denyConnect();
    }

    const redirectUri = `${new URL(c.req.url).origin}${GOOGLE_CALLBACK_PATH}`;
    const token = await requestToken({
      grant_type: "authorization_code",
      code,
      client_id: env.GOOGLE_CLIENT_ID as string,
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUri,
    });
    if (!token) return denyConnect();
    const email = await fetchUserinfoEmail(token.access_token);
    if (!email) return denyConnect();

    let cookieValue: string;
    try {
      cookieValue = await encryptGoogleSession(env, sessionFromToken(token, email));
    } catch {
      return denyConnect();
    }
    deleteCookie(c, GOOGLE_STATE_COOKIE_NAME, { path: "/" });
    setCookie(c, GOOGLE_COOKIE_NAME, cookieValue, googleCookieOptions());
    return c.redirect("/signature-generator", 302);
  });

  // GET /api/google/status → {connected, email?, scopes?}; never tokens.
  app.get("/api/google/status", async (c) => {
    const env: GoogleAuthEnv = c.env;
    const session = await decryptGoogleSession(env, getCookie(c, GOOGLE_COOKIE_NAME));
    if (!session) return c.json({ connected: false });
    const result = await refreshIfNeeded(env, session);
    if (!result) {
      // Expired and unrefreshable — drop the dead cookie so the client
      // stops presenting it.
      deleteCookie(c, GOOGLE_COOKIE_NAME, { path: "/" });
      return c.json({ connected: false });
    }
    if (result.refreshed) {
      try {
        setCookie(c, GOOGLE_COOKIE_NAME, await encryptGoogleSession(env, result.session), googleCookieOptions());
      } catch {
        return c.json({ connected: false });
      }
    }
    return c.json({ connected: true, email: result.session.email, scopes: result.session.scopes });
  });

  // POST /api/google/logout → clear the session cookie.
  app.post("/api/google/logout", (c) => {
    deleteCookie(c, GOOGLE_COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  // POST /api/self/insert → write the caller's own Gmail send-as signature.
  app.post("/api/self/insert", async (c) => {
    const env: GoogleAuthEnv = c.env;
    const session = await decryptGoogleSession(env, getCookie(c, GOOGLE_COOKIE_NAME));
    if (!session) {
      return c.json(
        {
          error: "google_not_connected",
          detail: "No Google session. Connect via /api/google/login?mode=self first.",
        },
        401,
      );
    }
    const result = await refreshIfNeeded(env, session);
    if (!result) {
      return c.json(
        {
          error: "google_not_connected",
          detail: "Google access token expired and could not be refreshed — reconnect via /api/google/login.",
        },
        401,
      );
    }
    if (!result.session.scopes.includes(GMAIL_SETTINGS_BASIC_SCOPE)) {
      return c.json(
        {
          error: "google_not_connected",
          detail: `Missing scope ${GMAIL_SETTINGS_BASIC_SCOPE} — reconnect via /api/google/login?mode=self.`,
        },
        401,
      );
    }
    if (result.refreshed) {
      try {
        setCookie(c, GOOGLE_COOKIE_NAME, await encryptGoogleSession(env, result.session), googleCookieOptions());
      } catch {
        // The insert can still proceed with the in-memory token; the next
        // request will simply have to refresh again.
      }
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_params", detail: "Request body must be JSON signature params." }, 400);
    }
    const parsed = SIGNATURE_PARAMS_SCHEMA.safeParse(body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return c.json({ error: "invalid_params", detail }, 400);
    }

    const html = buildSignatureHtml(parsed.data);
    const sendAs = result.session.email;
    let upstream: Response;
    try {
      upstream = await fetch(`${GMAIL_SENDAS_ENDPOINT}/${encodeURIComponent(sendAs)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${result.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: html }),
      });
    } catch {
      return c.json({ error: "gmail_api_error", detail: "Could not reach the Gmail API." }, 502);
    }
    if (!upstream.ok) {
      // Surface Gmail's error message, never the token.
      let detail = `HTTP ${upstream.status}`;
      try {
        const errorBody = (await upstream.json()) as { error?: { message?: string } } | null;
        if (errorBody?.error?.message) detail = `HTTP ${upstream.status}: ${errorBody.error.message}`;
      } catch {
        // status-only detail
      }
      return c.json({ error: "gmail_api_error", detail }, 502);
    }
    return c.json({ ok: true, email: sendAs, sendAs });
  });
}
