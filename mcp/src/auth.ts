/**
 * Optional WorkOS Connect (OAuth 2.1) protection for the MCP endpoint.
 *
 * Config comes from the Worker's settings — never from committed config:
 *   AUTHKIT_DOMAIN — the WorkOS AuthKit/Connect domain for the environment,
 *                    a bare host or an https origin. Set per environment as a
 *                    Worker secret (never a wrangler.toml [vars] entry, and
 *                    there is no default in code). When UNSET, the MCP
 *                    server runs open (no auth) and OAuth discovery endpoints
 *                    return 404s that tell clients no sign-in is needed.
 *   MCP_RESOURCE   — this server's canonical resource URL
 *                    (default: https://tools.nyuchi.com).
 *
 * Enforcement follows the MCP authorization spec:
 *   - /.well-known/oauth-protected-resource advertises the WorkOS
 *     authorization server.
 *   - Unauthenticated /mcp requests get 401 + WWW-Authenticate pointing at
 *     that metadata, which is how MCP clients discover the OAuth flow.
 *   - Bearer tokens are JWTs verified against the WorkOS JWKS
 *     (<AUTHKIT_DOMAIN>/oauth2/jwks) with issuer + audience checks.
 *
 * Client registration (CIMD / dynamic client registration) is handled by
 * WorkOS itself — enable it in the WorkOS dashboard under
 * Connect → Configuration, and add MCP_RESOURCE as a resource indicator.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthEnv {
  AUTHKIT_DOMAIN?: string;
  MCP_RESOURCE?: string;
  /**
   * Local development only: `"true"` lets `/mcp` run without a bearer token
   * when AUTHKIT_DOMAIN is unset AND the request is to localhost. Never set in
   * any deployed environment (it is not in wrangler.toml); put it in
   * `.dev.vars` for `wrangler dev`.
   */
  ALLOW_UNAUTHENTICATED_DEV?: string;
  /**
   * The WorkOS organization (`org_...`) whose members are the only people
   * allowed in — on the site login gate AND on /mcp. A valid AuthKit identity
   * is not enough: accounts.mukoko.com also hosts consumer accounts. Unset =
   * FAIL CLOSED (nobody is let in), never "any signed-in user".
   */
  NYUCHI_ORG_ID?: string;
}

/** Message used whenever a flow needs NYUCHI_ORG_ID and it is unset. */
export const NYUCHI_ORG_ID_MISSING = "NYUCHI_ORG_ID is not configured";

/** The configured org id, or undefined when unset/blank. */
export function requiredOrgId(env: AuthEnv): string | undefined {
  const id = typeof env.NYUCHI_ORG_ID === "string" ? env.NYUCHI_ORG_ID.trim() : "";
  return id || undefined;
}

/** True only when an org is configured AND `orgId` is exactly that org. */
export function orgAllowed(env: AuthEnv, orgId: string | undefined): boolean {
  const required = requiredOrgId(env);
  return required !== undefined && orgId === required;
}

// Must match the "AuthKit OAuth resource" registered in the WorkOS dashboard
// for this integration — see the MCP_RESOURCE comment in wrangler.toml.
export const DEFAULT_RESOURCE = "https://tools.nyuchi.dev/mcp";

/** Message used whenever a flow needs AUTHKIT_DOMAIN and it is unset. */
export const AUTHKIT_DOMAIN_MISSING = "AUTHKIT_DOMAIN is not configured";

/**
 * True when AUTHKIT_DOMAIN is set at all. Deliberately presence-only: this
 * switches auth ON, and an unusable value must not switch it OFF (that would
 * fail open). With auth on and an invalid value, `issuerUrl` throws, so bearer
 * verification returns null (401) and the OAuth surfaces error — fail closed.
 */
export function authConfigured(env: AuthEnv): boolean {
  return typeof env.AUTHKIT_DOMAIN === "string" && env.AUTHKIT_DOMAIN.trim().length > 0;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True only for the explicit local-development opt-out: AUTHKIT_DOMAIN unset,
 * `ALLOW_UNAUTHENTICATED_DEV` exactly `"true"`, and the request addressed to
 * localhost. Everywhere else an unset AUTHKIT_DOMAIN fails closed — `/mcp`
 * never serves tools unauthenticated by default.
 */
export function unauthenticatedDevAllowed(env: AuthEnv, requestUrl: string): boolean {
  if (authConfigured(env)) return false;
  if (env.ALLOW_UNAUTHENTICATED_DEV !== "true") return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(requestUrl).hostname);
  } catch {
    return false;
  }
}

export function resourceUrl(env: AuthEnv): string {
  return env.MCP_RESOURCE || DEFAULT_RESOURCE;
}

/**
 * Parse — never concatenate — a configured AuthKit domain into an https origin.
 *
 * Accepts a bare host or an https origin, in any case. Any path, query or
 * fragment is dropped. A blank value, `http:`, any other scheme, embedded
 * credentials and anything `URL` cannot parse all throw an error whose message
 * starts with `AUTHKIT_DOMAIN_MISSING`. The result is `URL.origin`.
 */
export function normaliseAuthkitDomain(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) throw new Error(AUTHKIT_DOMAIN_MISSING);
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`${AUTHKIT_DOMAIN_MISSING} (not a valid host or URL)`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${AUTHKIT_DOMAIN_MISSING} (must be an https origin)`);
  }
  return url.origin;
}

/**
 * The AuthKit issuer origin, from configuration only, parsed by
 * `normaliseAuthkitDomain` (the `iss` check is an exact string match against
 * it). Throws when AUTHKIT_DOMAIN is unset or is not a bare host / https
 * origin — callers check `authConfigured` first; there is no fallback host.
 */
export function issuerUrl(env: AuthEnv): string {
  return normaliseAuthkitDomain(env.AUTHKIT_DOMAIN);
}

/**
 * The origin `resourceUrl(env)` lives on — e.g. `https://tools.nyuchi.com`
 * for both the default (`.../mcp`) and a staging override with no path.
 * The `.well-known` discovery surface always lives at this origin's root,
 * never nested under whatever path the resource indicator itself uses.
 */
export function resourceOrigin(env: AuthEnv): string {
  return new URL(resourceUrl(env)).origin;
}

export function protectedResourceMetadata(env: AuthEnv): Record<string, unknown> {
  return {
    resource: resourceUrl(env),
    authorization_servers: [issuerUrl(env)],
    bearer_methods_supported: ["header"],
    // Honest, not aspirational: we only check issuer + audience today, no
    // scope-based authorization, so there is nothing to advertise here yet.
    scopes_supported: [],
  };
}

export function wwwAuthenticateHeader(env: AuthEnv): string {
  return [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${resourceOrigin(env)}/.well-known/oauth-protected-resource"`,
  ].join(", ");
}

/* JWKS instances are cached per AuthKit domain for the isolate's lifetime. */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/oauth2/jwks", issuer));
    jwksCache.set(issuer, jwks);
  }
  return jwks;
}

export interface VerifiedToken {
  userId?: string;
  scopes: string[];
}

export interface VerifiedJwt {
  sub?: string;
  email?: string;
  /** WorkOS `org_id` claim: the organization the session is signed in to. */
  orgId?: string;
  scopes: string[];
}

/**
 * Verify a raw JWT against the WorkOS JWKS for AUTHKIT_DOMAIN, checking
 * issuer + audience. Returns null (never throws) on any failure: missing
 * token/AUTHKIT_DOMAIN, JWKS fetch failure, expired/malformed token, wrong
 * issuer/audience.
 *
 * `expectedAudience` defaults to `resourceUrl(env)` (the /mcp resource
 * indicator) for `verifyBearer`, below. The site-wide login callback
 * (`site-auth.ts`) verifies a DIFFERENT token with a DIFFERENT audience: it
 * exchanges its PKCE code for an OIDC id_token (not the access token), whose
 * `aud` claim is the OAuth client_id per the OIDC Core spec — that has
 * nothing to do with the /mcp resource indicator, so it passes its own
 * `expectedAudience` explicitly rather than relying on this default. The
 * jose/JWKS logic itself still lives in exactly this one place either way.
 */
export async function verifyJwt(
  env: AuthEnv,
  token: string | undefined,
  expectedAudience?: string | null,
): Promise<VerifiedJwt | null> {
  if (!token || !authConfigured(env)) return null;
  try {
    const issuer = issuerUrl(env);
    // `null` skips the audience check (signature + issuer + expiry still
    // apply): used only to read the org claim off the site-login access token,
    // whose audience is not a registered resource.
    const { payload } = await jwtVerify(token, jwksFor(issuer), {
      issuer,
      ...(expectedAudience === null ? {} : { audience: expectedAudience ?? resourceUrl(env) }),
    });
    const scopes =
      typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
    return {
      sub: typeof payload.sub === "string" ? payload.sub : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      orgId: typeof payload.org_id === "string" ? payload.org_id : undefined,
      scopes,
    };
  } catch {
    return null;
  }
}

/**
 * Verify the Authorization header. Returns the verified claims, or null when
 * the token is missing/invalid (caller responds 401 with WWW-Authenticate).
 */
export async function verifyBearer(
  env: AuthEnv,
  authorizationHeader: string | undefined,
): Promise<VerifiedToken | null> {
  const token = authorizationHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const verified = await verifyJwt(env, token);
  if (!verified) return null;
  // Internal only: a valid token from another org (or none) is not enough.
  if (!orgAllowed(env, verified.orgId)) return null;
  return { userId: verified.sub, scopes: verified.scopes };
}
