/**
 * Site-wide login gate for tools.nyuchi.com.
 *
 * Every human-facing page (Home, Help, Setup, gmail-addon docs, Studio,
 * Signature Generator, Banner — everything except /mcp and the OAuth/MCP
 * discovery surface) sits behind a session cookie. This module implements
 * the browser-facing side of that gate: an Authorization Code + PKCE flow
 * against the Hosted AuthKit UI, and the signed session cookie minted once
 * that flow succeeds.
 *
 * This reuses the SAME WorkOS Connect app that already protects /mcp
 * (client_01KVTX0V2K1VM3PSC0DJ9VZWTV, authorization server
 * identity.nyuchi.com — see auth.ts) as a public client (PKCE,
 * token_endpoint_auth_method=none, no client_secret). The access token
 * returned by the token exchange is verified with the exact same
 * JWKS/issuer/audience logic /mcp uses for bearer tokens (`verifyJwt` in
 * auth.ts) — this module does not reimplement that check.
 *
 * Flow:
 *   GET /login    → generate state + PKCE verifier/challenge, stash them in
 *                    a short-lived `nyuchi_oauth` cookie, 302 to the AS.
 *   GET /callback → read the oauth cookie, verify `state`, exchange `code`
 *                    for an access token, verify it, mint the session
 *                    cookie, 302 to the validated return_to.
 *   GET /logout   → clear the session cookie.
 *
 * Fails closed: any missing/invalid piece (no SESSION_SECRET, bad state,
 * failed exchange, invalid token) must result in "not authenticated", never
 * a silent pass-through. Callers (index.ts) are responsible for actually
 * denying access when these functions return null/throw.
 */

import { SignJWT, base64url, jwtVerify } from "jose";
import type { AuthEnv } from "./auth.js";

export interface SiteAuthEnv extends AuthEnv {
  SESSION_SECRET?: string;
}

/** The public client already provisioned in WorkOS for tools.nyuchi.com. */
export const SITE_CLIENT_ID = "client_01KVTX0V2K1VM3PSC0DJ9VZWTV";

export const CALLBACK_PATH = "/callback";
export const SESSION_COOKIE_NAME = "nyuchi_session";
export const OAUTH_COOKIE_NAME = "nyuchi_oauth";

// The redirect_uri is fixed to the one WorkOS has registered for this
// client. It is intentionally NOT derived from MCP_RESOURCE (which exists
// for a different purpose — the /mcp resource indicator/audience — and may
// be overridden for staging): redirect_uri must byte-match a registered
// value or the authorization server rejects the request outright.
const SITE_ORIGIN = "https://tools.nyuchi.com";
const REDIRECT_URI = `${SITE_ORIGIN}${CALLBACK_PATH}`;

const AUTHORIZE_ENDPOINT = "https://identity.nyuchi.com/oauth2/authorize";
const TOKEN_ENDPOINT = "https://identity.nyuchi.com/oauth2/token";

/** Session cookie lifetime: 7 days. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Oauth round-trip cookie lifetime: 10 minutes — long enough for a human
 * to complete the Hosted AuthKit UI, short enough to limit replay risk. */
const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

/** Structural subset of Hono's CookieOptions this module cares about. */
export interface SiteCookieOptions {
  httpOnly: true;
  secure: true;
  sameSite: "Lax";
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(): SiteCookieOptions {
  return { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_TTL_SECONDS };
}

export function oauthCookieOptions(): SiteCookieOptions {
  return { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS };
}

// -----------------------------------------------------------------------------
// Open-redirect prevention.
// -----------------------------------------------------------------------------

/**
 * Validate that `returnTo` is a same-origin relative path before it is ever
 * echoed back into a redirect. Rejects absolute URLs, protocol-relative
 * URLs ("//evil.com"), and backslash tricks some browsers still normalize
 * into protocol-relative URLs ("/\evil.com"). Also rejects CR/LF/NUL, which
 * the Fetch API's Headers implementation already refuses in a Location
 * header value (it throws rather than splitting the header) — this check
 * just turns that into a clean fallback to "/" instead of a 500. Falls back
 * to "/" on anything that doesn't look like a safe same-origin path.
 */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/";
  if (!returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//")) return "/";
  if (returnTo.includes("://")) return "/";
  if (returnTo.includes("\\")) return "/";
  if (/[\r\n\0]/.test(returnTo)) return "/";
  return returnTo;
}

// -----------------------------------------------------------------------------
// PKCE helpers.
// -----------------------------------------------------------------------------

/** 32 random bytes, base64url-encoded → 43 chars (RFC 7636 min length). */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url.encode(bytes);
}

/** code_challenge = BASE64URL(SHA-256(ASCII(code_verifier))). */
export async function codeChallengeFromVerifier(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return base64url.encode(new Uint8Array(digest));
}

/** Opaque anti-CSRF value for the authorize round-trip. */
export function generateState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64url.encode(bytes);
}

// -----------------------------------------------------------------------------
// Authorize / token exchange.
// -----------------------------------------------------------------------------

/**
 * Build the redirect URL to the Hosted AuthKit authorize endpoint.
 *
 * `returnTo` is accepted for signature symmetry with the login handler but
 * is NOT sent to the authorization server — it already travels in the
 * `nyuchi_oauth` cookie and is read back on /callback.
 */
export function buildAuthorizeUrl(
  env: SiteAuthEnv,
  state: string,
  codeChallenge: string,
  returnTo: string,
): string {
  void env;
  void returnTo;
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", SITE_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid profile email");
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  refresh_token?: string;
}

/**
 * POST the authorization code + PKCE verifier to the token endpoint.
 * Public client (no client_secret — token_endpoint_auth_method=none).
 * Throws on any non-2xx response or a malformed body; never returns a
 * partial/fabricated token.
 */
export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: SITE_CLIENT_ID,
    code_verifier: codeVerifier,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: HTTP ${response.status}`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Token exchange response was not valid JSON");
  }
  const token = (data as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Token exchange response is missing access_token");
  }
  return data as TokenResponse;
}

// -----------------------------------------------------------------------------
// The `nyuchi_oauth` round-trip cookie: {state, codeVerifier, returnTo}.
// -----------------------------------------------------------------------------

export interface OauthCookiePayload {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

/** Base64url(JSON) — plain JSON can't round-trip as a cookie value as-is
 * (quotes aren't a legal cookie-value character), so it's encoded. This is
 * NOT a security boundary: the cookie is HttpOnly and short-lived, and its
 * contents (a state nonce, a PKCE verifier, and a same-origin path) are
 * only meaningful when matched against the authorization code on /callback. */
export function encodeOauthCookie(payload: OauthCookiePayload): string {
  return base64url.encode(JSON.stringify(payload));
}

export function decodeOauthCookie(value: string | undefined): OauthCookiePayload | null {
  if (!value) return null;
  try {
    const json = new TextDecoder().decode(base64url.decode(value));
    const parsed: unknown = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as OauthCookiePayload).state === "string" &&
      typeof (parsed as OauthCookiePayload).codeVerifier === "string" &&
      typeof (parsed as OauthCookiePayload).returnTo === "string"
    ) {
      return parsed as OauthCookiePayload;
    }
    return null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Session cookie: a compact HS256 JWT signed with SESSION_SECRET.
// -----------------------------------------------------------------------------

export interface SessionClaims {
  sub?: string;
  email?: string;
}

/**
 * Mint the session cookie value. Throws if SESSION_SECRET is unset —
 * callers must only reach this after confirming the secret is configured,
 * and must treat a throw as "deny access", never as "skip the cookie".
 */
export async function mintSessionCookie(env: SiteAuthEnv, claims: SessionClaims): Promise<string> {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  const key = new TextEncoder().encode(env.SESSION_SECRET);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: claims.sub, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(key);
}

/**
 * Verify the session cookie. Returns null (never throws) for anything that
 * isn't a currently-valid signature: missing cookie, missing
 * SESSION_SECRET, tampered signature, expired token. Missing SESSION_SECRET
 * is treated as "no valid session" — the whole site fails CLOSED, not open,
 * when the secret hasn't been provisioned.
 */
export async function verifySessionCookie(
  env: SiteAuthEnv,
  cookieValue: string | undefined,
): Promise<SessionClaims | null> {
  if (!cookieValue || !env.SESSION_SECRET) return null;
  try {
    const key = new TextEncoder().encode(env.SESSION_SECRET);
    const { payload } = await jwtVerify(cookieValue, key, { algorithms: ["HS256"] });
    return {
      sub: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
