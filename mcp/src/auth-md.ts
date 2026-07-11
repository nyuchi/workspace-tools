/**
 * auth.md — a human/agent-readable description of this server's OAuth
 * architecture, served at GET /auth.md (see index.ts). This is descriptive
 * documentation, not protocol metadata: the machine-readable metadata lives
 * at /.well-known/oauth-protected-resource (this resource server) and at
 * identity.nyuchi.com's own /.well-known/oauth-authorization-server (the
 * WorkOS Connect authorization server, mirrored read-only at the same path
 * on this domain — see auth.ts / index.ts).
 *
 * This Worker answers on more than one hostname (the site stays on
 * tools.nyuchi.com; the MCP endpoint is tools.nyuchi.dev — see the
 * MCP_RESOURCE comment in wrangler.toml), so every URL here is derived from
 * the configured resource rather than hardcoded, and stays correct on
 * whichever hostname actually served the request.
 */

import { type AuthEnv, resourceOrigin, resourceUrl } from "./auth";

// Fixed, not derived from env.AUTHKIT_DOMAIN: this describes the canonical
// architecture (which authorization server this resource server trusts)
// even in open mode, when AUTHKIT_DOMAIN is unset — see "When auth is not
// required" below. Only the resource-server side (this domain) varies.
const ISSUER = "https://identity.nyuchi.com";

export function authMd(env: AuthEnv): string {
  const resource = resourceUrl(env);
  const origin = resourceOrigin(env);
  const host = new URL(origin).hostname;
  return `# auth.md — ${host}

## Audience

AI agents and MCP clients calling the Nyuchi Tools MCP server at
${resource}.

${host} is a resource server only — it verifies bearer tokens but
never issues them and runs no authorization flow itself. The authorization
server is identity.nyuchi.com (WorkOS Connect), outside this repo; this page
describes our side of the handshake only and does not restate or invent
authorization-server metadata on its behalf.

## Protected resource

- Resource: ${resource}
- Metadata: ${origin}/.well-known/oauth-protected-resource

## Authorization server

- Issuer: ${ISSUER} (WorkOS Connect)
- Metadata: ${ISSUER}/.well-known/oauth-authorization-server
  (mirrored at /.well-known/oauth-authorization-server on this domain)
- Flow: OAuth 2.1 Authorization Code + PKCE
- Client registration: Dynamic Client Registration (RFC 7591) at the
  authorization server's \`registration_endpoint\` — no manual client setup
  required
- Token type: Bearer JWT, verified against the AS's JWKS with issuer +
  audience (\`${resource}\`) checks

## Using credentials

Send the access token as \`Authorization: Bearer <token>\` on requests to
\`/mcp\`. Unauthenticated requests receive \`401\` with a \`WWW-Authenticate\`
header pointing back at the protected-resource metadata.

## When auth is not required

This server can run in an open mode (no \`AUTHKIT_DOMAIN\` configured) for
local development; the protected-resource metadata endpoint returns \`404\`
in that mode to signal no authorization is needed, and \`/mcp\` accepts
requests without a bearer token.
`;
}
