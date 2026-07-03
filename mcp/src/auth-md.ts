/**
 * auth.md — a human/agent-readable description of this server's OAuth
 * architecture, served at GET /auth.md (see index.ts). This is descriptive
 * documentation, not protocol metadata: the machine-readable metadata lives
 * at /.well-known/oauth-protected-resource (this resource server) and at
 * identity.nyuchi.com's own /.well-known/oauth-authorization-server (the
 * WorkOS Connect authorization server, mirrored read-only at the same path
 * on this domain — see auth.ts / index.ts).
 *
 * tools.nyuchi.com is a *resource server* only. It never issues tokens or
 * runs an authorization flow itself, so this file intentionally does not
 * fabricate an `agent_auth` block or any AS-shaped JSON — that belongs in
 * the authorization server's own metadata, not here.
 */

export function authMd(): string {
  return `# auth.md — tools.nyuchi.com

## Audience

AI agents and MCP clients calling the Nyuchi Tools MCP server at
https://tools.nyuchi.com/mcp.

tools.nyuchi.com is a resource server only — it verifies bearer tokens but
never issues them and runs no authorization flow itself. The authorization
server is identity.nyuchi.com (WorkOS Connect), outside this repo; this page
describes our side of the handshake only and does not restate or invent
authorization-server metadata on its behalf.

## Protected resource

- Resource: https://tools.nyuchi.com
- Metadata: https://tools.nyuchi.com/.well-known/oauth-protected-resource

## Authorization server

- Issuer: https://identity.nyuchi.com (WorkOS Connect)
- Metadata: https://identity.nyuchi.com/.well-known/oauth-authorization-server
  (mirrored at /.well-known/oauth-authorization-server on this domain)
- Flow: OAuth 2.1 Authorization Code + PKCE
- Client registration: Dynamic Client Registration (RFC 7591) at the
  authorization server's \`registration_endpoint\` — no manual client setup
  required
- Token type: Bearer JWT, verified against the AS's JWKS with issuer +
  audience (\`https://tools.nyuchi.com\`) checks

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
