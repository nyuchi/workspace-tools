//! The fetch handler: the production router, ported from the TypeScript
//! Worker (mcp/src/index.ts) so the Rust Worker serves tools.nyuchi.com
//! with the same posture — one MCP URL, the WorkOS gate, fail closed.
//!
//!   /login /callback /logout        the site-wide login gate (site-auth)
//!   /.well-known/*                  OAuth + MCP discovery (mirrored)
//!   /mcp                            bearer-JWT MCP (host-pinned, Origin-checked)
//!   /images/*                       public R2 objects (MCP host only)
//!   /api/signature                  Apps Script API (own key or session)
//!   /api/{render,campaign}          the Rust imaging API
//!   /api/{google,admin,self}/*      the Google-console surface: porting (501)
//!   everything else                 the login-gated Astro site (ASSETS)

use crate::api::{self, Config};
use crate::auth::{self, AuthConfig};
use crate::mcp;
use nyuchi_imaging::privacy::Privacy;
use worker::*;

const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Everything the router needs beyond the imaging config.
struct Gate {
    auth: AuthConfig,
}

fn gate_config(env: &Env) -> Gate {
    let var = |k: &str| env.var(k).map(|v| v.to_string()).unwrap_or_default();
    let secret = |k: &str| env.secret(k).map(|v| v.to_string()).unwrap_or_default();
    // Deployment values are Worker secrets; a plain var of the same name is
    // still honoured so an existing deployment keeps working until it is moved.
    let secret_or_var = |k: &str| {
        let s = secret(k);
        if s.is_empty() { var(k) } else { s }
    };
    Gate {
        auth: AuthConfig {
            authkit_domain: secret("AUTHKIT_DOMAIN"),
            mcp_resource: secret_or_var("MCP_RESOURCE"),
            org_id: secret_or_var("NYUCHI_ORG_ID"),
            redirect_uri: secret("OAUTH_REDIRECT_URI"),
            required_permission: secret("WORKOS_REQUIRED_PERMISSION"),
            client_id: secret("WORKOS_CLIENT_ID"),
            session_secret: secret("SESSION_SECRET"),
            allow_unauthenticated_dev: var("ALLOW_UNAUTHENTICATED_DEV") == "true",
            allowed_origin_hosts: var("MCP_ALLOWED_ORIGINS")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
            signature_api_key: secret("SIGNATURE_API_KEY"),
        },
    }
}

fn imaging_config(env: &Env) -> Config {
    let blocked_terms = env
        .secret("BLOCKED_TERMS")
        .map(|s| Privacy::terms_from_str(&s.to_string()))
        .unwrap_or_default();
    Config { blocked_terms }
}

fn respond(status: u16, headers: &[(&str, String)], body: Vec<u8>) -> Result<Response> {
    let h = Headers::new();
    for (k, v) in headers {
        h.set(k, v)?;
    }
    Ok(Response::from_bytes(body)?
        .with_status(status)
        .with_headers(h))
}

fn json_reply(
    status: u16,
    value: &serde_json::Value,
    extra: &[(&str, String)],
) -> Result<Response> {
    let mut headers: Vec<(&str, String)> = vec![
        ("content-type", "application/json".into()),
        ("cache-control", "no-store".into()),
    ];
    for (k, v) in extra {
        headers.push((k, v.clone()));
    }
    respond(
        status,
        &headers,
        serde_json::to_vec(value).unwrap_or_default(),
    )
}

fn text_reply(status: u16, body: &str, content_type: &str) -> Result<Response> {
    respond(
        status,
        &[("content-type", content_type.into())],
        body.as_bytes().to_vec(),
    )
}

fn redirect(location: &str, cookies: &[String]) -> Result<Response> {
    let mut headers = Headers::new();
    for c in cookies {
        headers.append("set-cookie", c)?;
    }
    headers.set("location", location)?;
    Ok(Response::empty()?.with_status(302).with_headers(headers))
}

/// True when the path bypasses the site session gate (it does its own auth,
/// or is public by design). Mirrors EXEMPT_SITE_AUTH_PATHS.
fn exempt_from_site_auth(path: &str) -> bool {
    matches!(
        path,
        "/mcp" | "/auth.md" | "/register" | "/login" | "/callback" | "/logout" | "/api/signature"
    ) || path.starts_with("/mcp/")
        || path.starts_with("/images/")
        || path == "/.well-known"
        || path.starts_with("/.well-known/")
}

/// The MCP host pin: /mcp and /images live only on the host MCP_RESOURCE
/// names; every other host gets 410 Gone, permanently.
fn host_gate(host: &str, g: &Gate) -> Option<Result<Response>> {
    let mcp_host = g.auth.resource_host();
    if host == mcp_host || matches!(host, "localhost" | "127.0.0.1" | "[::1]") {
        return None;
    }
    Some(json_reply(
        410,
        &serde_json::json!({
            "error": "gone",
            "detail": "This MCP URL was permanently dropped.",
            "mcp": g.auth.resource_url(),
        }),
        &[],
    ))
}

fn origin_host(req: &Request) -> Option<String> {
    let origin = req.headers().get("origin").ok().flatten()?;
    auth::host_of(&origin)
}

#[event(fetch)]
async fn fetch(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let g = gate_config(&env);
    let path = req.path();
    let method = req.method().to_string();
    let url = req.url()?;
    let host = url.host_str().unwrap_or("").to_string();

    // One MCP URL: the host pin runs first, before anything else.
    if path == "/mcp" || path.starts_with("/mcp/") || path.starts_with("/images/") {
        if let Some(gone) = host_gate(&host, &g) {
            return gone;
        }
    }

    // The site-wide login gate: every human-facing page needs a session.
    if !exempt_from_site_auth(&path) {
        let cookie_header = req.headers().get("cookie").ok().flatten();
        let session = auth::verify_session(
            &g.auth,
            auth::cookie_value(cookie_header.as_deref(), auth::SESSION_COOKIE),
        );
        if session.is_none() {
            let query: String = url
                .as_str()
                .split_once('?')
                .map(|(_, q)| format!("?{q}"))
                .unwrap_or_default();
            let return_to = urlencode(&format!("{path}{query}"));
            return redirect(&format!("/login?return_to={return_to}"), &[]);
        }
    }

    match (method.as_str(), path.as_str()) {
        // ------------------------------------------------------------------
        // The login gate's browser flow.
        // ------------------------------------------------------------------
        ("GET", "/login") => {
            if g.auth.session_secret.is_empty() {
                return text_reply(500, "Site authentication is not configured.", "text/plain");
            }
            if !g.auth.auth_configured() {
                return text_reply(
                    503,
                    &format!("Service Unavailable: {}", auth::AUTHKIT_DOMAIN_MISSING),
                    "text/plain",
                );
            }
            if g.auth.client_id.trim().is_empty() {
                return text_reply(
                    503,
                    &format!("Service Unavailable: {}", auth::WORKOS_CLIENT_ID_MISSING),
                    "text/plain",
                );
            }
            if !g.auth.gate_configured() {
                return text_reply(
                    503,
                    &format!("Service Unavailable: {}", auth::NYUCHI_ORG_ID_MISSING),
                    "text/plain",
                );
            }
            let return_to = auth::sanitize_return_to(
                url.query_pairs()
                    .find(|(k, _)| k == "return_to")
                    .map(|(_, v)| v.into_owned())
                    .as_deref(),
            );
            let state = crate::remote::random_b64url(24);
            let verifier = crate::remote::random_b64url(32);
            let challenge = auth::pkce_challenge(&verifier);
            let url = match auth::authorize_url(&g.auth, &state, &challenge) {
                Ok(u) => u,
                Err(e) => {
                    return text_reply(503, &format!("Service Unavailable: {e}"), "text/plain");
                }
            };
            redirect(
                &url,
                &[auth::set_cookie(
                    auth::OAUTH_COOKIE,
                    &auth::encode_oauth_cookie(&state, &verifier, &return_to),
                    auth::OAUTH_TTL,
                )],
            )
        }
        ("GET", "/callback") => {
            let deny = || {
                redirect(
                    "/login?error=1",
                    &[
                        auth::clear_cookie(auth::OAUTH_COOKIE),
                        auth::clear_cookie(auth::SESSION_COOKIE),
                    ],
                )
            };
            let cookie_header = req.headers().get("cookie").ok().flatten();
            let Some((state, verifier, return_to)) = auth::decode_oauth_cookie(auth::cookie_value(
                cookie_header.as_deref(),
                auth::OAUTH_COOKIE,
            )) else {
                return deny();
            };
            let mut pairs = url.query_pairs();
            let code = pairs
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.into_owned());
            let got_state = pairs
                .find(|(k, _)| k == "state")
                .map(|(_, v)| v.into_owned());
            let (Some(code), Some(got_state)) = (code, got_state) else {
                return deny();
            };
            if got_state != state
                || g.auth.session_secret.is_empty()
                || !g.auth.auth_configured()
                || g.auth.client_id.trim().is_empty()
            {
                return deny();
            }
            let (id_token, access_token) =
                match crate::remote::exchange_code(&g.auth, &code, &verifier).await {
                    Ok(t) => t,
                    Err(_) => return deny(),
                };
            // The id_token's aud is the client id (OIDC), not the resource.
            let verified = match crate::remote::verify_jwt(
                &g.auth,
                Some(&id_token),
                Some(g.auth.client_id.trim()),
            )
            .await
            {
                Some(v) => v,
                None => return deny(),
            };
            // The organization and the permissions are on the access token
            // (the id_token may not carry them): read both from it.
            let mut org = verified.org_id.clone();
            let mut permissions = verified.permissions.clone();
            let access = crate::remote::verify_jwt(&g.auth, Some(&access_token), None).await;
            if let Some(a) = access.filter(|a| a.sub == verified.sub) {
                org = org.or(a.org_id);
                for p in a.permissions {
                    if !permissions.contains(&p) {
                        permissions.push(p);
                    }
                }
            }
            if !g.auth.identity_allowed(org.as_deref(), &permissions) {
                return deny();
            }
            match auth::mint_session(
                &g.auth,
                verified.sub.as_deref(),
                verified.email.as_deref(),
                org.as_deref().unwrap_or(""),
            ) {
                Some(value) => redirect(
                    &auth::sanitize_return_to(Some(&return_to)),
                    &[
                        auth::clear_cookie(auth::OAUTH_COOKIE),
                        auth::set_cookie(auth::SESSION_COOKIE, &value, auth::SESSION_TTL),
                    ],
                ),
                None => deny(),
            }
        }
        ("GET", "/logout") => redirect("/", &[auth::clear_cookie(auth::SESSION_COOKIE)]),

        // ------------------------------------------------------------------
        // OAuth + MCP discovery.
        // ------------------------------------------------------------------
        (_, p)
            if p == "/.well-known/oauth-protected-resource"
                || p.starts_with("/.well-known/oauth-protected-resource/") =>
        {
            if g.auth.auth_configured() {
                match auth::protected_resource_metadata(&g.auth) {
                    Ok(m) => json_reply(200, &m, &[]),
                    Err(e) => json_reply(
                        503,
                        &serde_json::json!({"error": "authorization_not_configured", "detail": e}),
                        &[],
                    ),
                }
            } else if g.auth.dev_allowed(&host) {
                json_reply(
                    404,
                    &serde_json::json!({"error": "no_protected_resource_metadata", "detail": "Local development: this MCP server does not require authentication."}),
                    &[],
                )
            } else {
                json_reply(
                    503,
                    &serde_json::json!({"error": "authorization_not_configured", "detail": auth::AUTHKIT_DOMAIN_MISSING}),
                    &[],
                )
            }
        }
        (_, p)
            if p == "/.well-known/oauth-authorization-server"
                || p.starts_with("/.well-known/oauth-authorization-server/")
                || p == "/.well-known/openid-configuration" =>
        {
            // Mirror the authorization server's own document — fetched and
            // passed through, never fabricated.
            if !g.auth.auth_configured() {
                if g.auth.dev_allowed(&host) {
                    return json_reply(
                        404,
                        &serde_json::json!({"error": "not_configured", "detail": "Local development: no authorization server."}),
                        &[],
                    );
                }
                return json_reply(
                    503,
                    &serde_json::json!({"error": "authorization_not_configured", "detail": auth::AUTHKIT_DOMAIN_MISSING}),
                    &[],
                );
            }
            let issuer = g.auth.issuer_url().unwrap_or_default();
            let doc = if p.contains("openid-configuration") {
                format!("{issuer}/.well-known/openid-configuration")
            } else {
                format!("{issuer}/.well-known/oauth-authorization-server")
            };
            match crate::remote::pass_through_json(&doc).await {
                Ok((status, bytes)) => respond(
                    status,
                    &[("content-type", "application/json".into())],
                    bytes,
                ),
                Err(_) => json_reply(
                    502,
                    &serde_json::json!({"error": "upstream_unavailable"}),
                    &[],
                ),
            }
        }
        (_, "/register") => json_reply(
            404,
            &serde_json::json!({"error": "registration_not_supported", "detail": "Client registration is handled by the WorkOS authorization server."}),
            &[],
        ),
        ("GET", "/.well-known/mcp/server-card.json") => json_reply(
            200,
            &serde_json::json!({
                "serverInfo": { "name": "nyuchi-tools", "version": SERVER_VERSION },
                "name": "nyuchi-tools",
                "description": "MCP server for Nyuchi Africa tools: email signatures, Nyuchi Studio social cards, asset uploads, and issue reporting.",
                "websiteUrl": "https://tools.nyuchi.com",
                "remotes": [{ "transportType": "streamable-http", "url": g.auth.resource_url() }],
                "capabilities": {
                    "tools": { "listChanged": true },
                    "resources": { "listChanged": true },
                    "prompts": { "listChanged": true }
                }
            }),
            &[],
        ),
        ("GET", "/auth.md") => text_reply(200, AUTH_MD, "text/markdown; charset=utf-8"),

        // ------------------------------------------------------------------
        // /mcp: fail-closed config checks, bearer gate, Origin check.
        // ------------------------------------------------------------------
        (_, "/mcp") => {
            if !g.auth.auth_configured() {
                if g.auth.dev_allowed(&host) {
                    return mcp_response(req, &env, &g).await;
                }
                return json_reply(
                    503,
                    &serde_json::json!({"error": "authorization_not_configured", "detail": format!("Service Unavailable: {}", auth::AUTHKIT_DOMAIN_MISSING)}),
                    &[],
                );
            }
            if !g.auth.gate_configured() {
                return json_reply(
                    503,
                    &serde_json::json!({"error": "authorization_not_configured", "detail": format!("Service Unavailable: {}", auth::NYUCHI_ORG_ID_MISSING)}),
                    &[],
                );
            }
            let token = req.headers().get("authorization").ok().flatten();
            let bearer = auth::bearer_of(token.as_deref());
            let verified = crate::remote::verify_jwt(&g.auth, bearer.as_deref(), None).await;
            let Some(verified) = verified else {
                return json_reply(
                    401,
                    &serde_json::json!({"error": "unauthorized", "detail": "Valid bearer token required."}),
                    &[(
                        "www-authenticate",
                        auth::www_authenticate(&g.auth, bearer.is_some()),
                    )],
                );
            };
            if !g.auth.identity_allowed(verified.org_id.as_deref(), &verified.permissions) {
                return json_reply(
                    403,
                    &serde_json::json!({"error": "forbidden", "detail": "This account does not hold the permission these tools need."}),
                    &[],
                );
            }
            if let Some(origin) = origin_host(&req) {
                if !g.auth.origin_allowed(&origin) {
                    return json_reply(
                        403,
                        &serde_json::json!({"error": "origin_not_allowed"}),
                        &[],
                    );
                }
            }
            mcp_response(req, &env, &g).await
        }
        (_, p) if p.starts_with("/mcp/") => {
            let _ = &g;
            json_reply(
                404,
                &serde_json::json!({"error": "not found", "hint": "POST /mcp for JSON-RPC"}),
                &[],
            )
        }

        // ------------------------------------------------------------------
        // Public stored images (R2 `IMAGES`): GET only, never listable.
        // ------------------------------------------------------------------
        ("GET", p) if p.starts_with("/images/") => {
            let key = p.trim_start_matches("/images/");
            if key.is_empty() || key.contains("..") {
                return respond(404, &[], Vec::new());
            }
            let bucket = env.bucket("IMAGES")?;
            match bucket.get(key).execute().await? {
                Some(object) => {
                    let bytes = object.body().expect("R2 object body").bytes().await?;
                    let ctype = object
                        .http_metadata()
                        .content_type
                        .unwrap_or_else(|| "application/octet-stream".into());
                    respond(
                        200,
                        &[
                            ("content-type", ctype),
                            (
                                "cache-control",
                                "public, max-age=31536000, immutable".into(),
                            ),
                            ("x-content-type-options", "nosniff".into()),
                            ("content-security-policy", "sandbox".into()),
                        ],
                        bytes,
                    )
                }
                None => respond(404, &[], Vec::new()),
            }
        }

        // ------------------------------------------------------------------
        // The Apps Script signature API: its own auth (shared key or session).
        // ------------------------------------------------------------------
        ("POST", "/api/signature") => {
            let cookie_header = req.headers().get("cookie").ok().flatten();
            let session_ok = auth::verify_session(
                &g.auth,
                auth::cookie_value(cookie_header.as_deref(), auth::SESSION_COOKIE),
            )
            .is_some();
            let header_key =
                auth::bearer_of(req.headers().get("authorization").ok().flatten().as_deref());
            let key_ok = !g.auth.signature_api_key.is_empty()
                && header_key.as_deref() == Some(g.auth.signature_api_key.as_str());
            if !session_ok && !key_ok {
                return json_reply(
                    401,
                    &serde_json::json!({"error": "unauthorized", "detail": "A valid bearer key or session is required."}),
                    &[],
                );
            }
            let body = req.bytes().await?;
            match api::handle("POST", "/api/signature", &body, &imaging_config(&env)) {
                Some(reply) => respond(reply.status, &reply.headers, reply.body),
                None => respond(404, &[], Vec::new()),
            }
        }

        // ------------------------------------------------------------------
        // The Google-console surface is porting; the TS Worker remains in git
        // history (v0.9.x) if an emergency rollback is ever needed.
        // ------------------------------------------------------------------
        (_, p)
            if p.starts_with("/api/google/")
                || p.starts_with("/api/admin/")
                || p.starts_with("/api/self/") =>
        {
            json_reply(
                501,
                &serde_json::json!({
                    "error": "not_implemented",
                    "detail": "The Google-console APIs are porting to the Rust Worker; see docs/rust.md. Signature generation, the MCP server and the login gate are live."
                }),
                &[],
            )
        }

        // ------------------------------------------------------------------
        // The Rust imaging API (render, campaign).
        // ------------------------------------------------------------------
        (_, p) if p.starts_with("/api/") => {
            let body = if method == "POST" {
                req.bytes().await?
            } else {
                Vec::new()
            };
            match api::handle(&method, p, &body, &imaging_config(&env)) {
                Some(reply) => respond(reply.status, &reply.headers, reply.body),
                None => respond(404, &[], Vec::new()),
            }
        }

        // ------------------------------------------------------------------
        // Everything else: the login-gated Astro site.
        // ------------------------------------------------------------------
        _ => env.assets("ASSETS")?.fetch_request(req).await,
    }
}

async fn mcp_response(mut req: Request, env: &Env, _g: &Gate) -> Result<Response> {
    if req.method().to_string() != "POST" {
        return respond(
            405,
            &[("allow", "POST".into())],
            b"MCP: POST JSON-RPC to /mcp".to_vec(),
        );
    }
    let body = req.bytes().await?;
    let (status, out) = mcp::handle(&body, &imaging_config(env));
    respond(
        status,
        &[
            ("content-type", "application/json".into()),
            ("cache-control", "no-store".into()),
        ],
        out,
    )
}

fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

const AUTH_MD: &str = r#"# Authorization

This server is a **resource server only**. The authorization server is
WorkOS Connect on the configured `AUTHKIT_DOMAIN`; clients discover it via
`/.well-known/oauth-protected-resource` and register through WorkOS dynamic
client registration.

- **`/mcp`** — bearer JWTs issued by the authorization server; issuer and
  audience must match the configured resource, and the token's `org_id`
  must be the Nyuchi organization. One URL: the host named by `MCP_RESOURCE`
  (https://tools.nyuchi.dev/mcp); every other host answers 410 Gone.
- **The site** — a session cookie (`nyuchi_session`, HS256) minted by the
  Authorization Code + PKCE login at `/login`; every human-facing page
  requires it. Fail closed: without `SESSION_SECRET`, `AUTHKIT_DOMAIN`,
  `WORKOS_CLIENT_ID` or `NYUCHI_ORG_ID` the gates answer 5xx and admit
  nobody.
- **`/api/signature`** — the shared `SIGNATURE_API_KEY` bearer or a site
  session.

The Rust port lives in `crates/worker/src/auth.rs`; the TypeScript original
(`mcp/src`) is retired in git history.
"#;
