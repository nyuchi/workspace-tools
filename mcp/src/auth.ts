/**
 * Optional WorkOS Connect (OAuth 2.1) protection for the MCP endpoint.
 *
 * Config comes from Worker vars (wrangler.toml [vars] or dashboard secrets):
 *   AUTHKIT_DOMAIN — the WorkOS AuthKit/Connect domain for the environment,
 *                    e.g. "your-workspace.authkit.app". When UNSET, the MCP
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
 *     (https://<AUTHKIT_DOMAIN>/oauth2/jwks) with issuer + audience checks.
 *
 * Client registration (CIMD / dynamic client registration) is handled by
 * WorkOS itself — enable it in the WorkOS dashboard under
 * Connect → Configuration, and add MCP_RESOURCE as a resource indicator.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthEnv {
  AUTHKIT_DOMAIN?: string;
  MCP_RESOURCE?: string;
}

export const DEFAULT_RESOURCE = "https://tools.nyuchi.com";

export function authConfigured(env: AuthEnv): boolean {
  return typeof env.AUTHKIT_DOMAIN === "string" && env.AUTHKIT_DOMAIN.length > 0;
}

export function resourceUrl(env: AuthEnv): string {
  return env.MCP_RESOURCE || DEFAULT_RESOURCE;
}

export function issuerUrl(env: AuthEnv): string {
  return `https://${env.AUTHKIT_DOMAIN}`;
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
    `resource_metadata="${resourceUrl(env)}/.well-known/oauth-protected-resource"`,
  ].join(", ");
}

/* JWKS instances are cached per AuthKit domain for the isolate's lifetime. */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(domain: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(domain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${domain}/oauth2/jwks`));
    jwksCache.set(domain, jwks);
  }
  return jwks;
}

export interface VerifiedToken {
  userId?: string;
  scopes: string[];
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
  if (!token || !env.AUTHKIT_DOMAIN) return null;
  try {
    const { payload } = await jwtVerify(token, jwksFor(env.AUTHKIT_DOMAIN), {
      issuer: issuerUrl(env),
      audience: resourceUrl(env),
    });
    const scopes =
      typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
    return { userId: typeof payload.sub === "string" ? payload.sub : undefined, scopes };
  } catch {
    return null;
  }
}
