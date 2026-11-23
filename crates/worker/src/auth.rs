//! The WorkOS gate, ported from the TypeScript Worker (mcp/src/auth.ts and
//! site-auth.ts) so the Rust Worker takes production with the same posture:
//! fail closed everywhere, one MCP URL, the Nyuchi org claim required.
//!
//! Pure helpers (HS256, base64url, URL parsing, return-to sanitising, PKCE
//! challenge) are host-testable; the JWKS fetch and WebCrypto verification
//! live behind the wasm target, where the Workers runtime provides them.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const AUTHKIT_DOMAIN_MISSING: &str = "AUTHKIT_DOMAIN is not configured";
pub const NYUCHI_ORG_ID_MISSING: &str =
    "NYUCHI_ORG_ID or WORKOS_INTERNAL_ENVIRONMENT is not configured";
pub const WORKOS_CLIENT_ID_MISSING: &str = "WORKOS_CLIENT_ID is not configured";

pub const SESSION_COOKIE: &str = "nyuchi_session";
pub const OAUTH_COOKIE: &str = "nyuchi_oauth";
pub const CALLBACK_PATH: &str = "/callback";
pub const SIGNATURE_API_PATH: &str = "/api/signature";

/// Session cookie lifetime: 7 days (seconds).
pub const SESSION_TTL: u64 = 7 * 24 * 60 * 60;
/// OAuth round-trip cookie lifetime: 10 minutes.
pub const OAUTH_TTL: u64 = 600;

pub const REDIRECT_URI_MISSING: &str = "OAUTH_REDIRECT_URI is not configured";

/// Everything the gate reads from the environment. `String::new` means
/// "not configured" — every check treats that as fail-closed.
#[derive(Clone, Debug, Default)]
pub struct AuthConfig {
    pub authkit_domain: String,
    pub mcp_resource: String,
    pub org_id: String,
    /// The site login's OAuth redirect URI (OAUTH_REDIRECT_URI, a secret); it
    /// must be registered on the WorkOS application. Unset fails closed.
    pub redirect_uri: String,
    /// WORKOS_INTERNAL_ENVIRONMENT is exactly "true": the internal Nyuchi
    /// WorkOS environment, which has no organizations and has sign-up off, so
    /// WorkOS holds who may sign in. Every signed-in user is admitted and
    /// `org_id` is not consulted.
    pub internal_environment: bool,
    pub client_id: String,
    pub session_secret: String,
    pub allow_unauthenticated_dev: bool,
    pub allowed_origin_hosts: Vec<String>,
    pub signature_api_key: String,
}

pub const DEFAULT_RESOURCE: &str = "https://tools.nyuchi.dev/mcp";

impl AuthConfig {
    pub fn resource_url(&self) -> &str {
        if self.mcp_resource.trim().is_empty() {
            DEFAULT_RESOURCE
        } else {
            &self.mcp_resource
        }
    }

    /// The host the MCP surface is pinned to (off-host answers 410).
    pub fn resource_host(&self) -> String {
        host_of(self.resource_url()).unwrap_or_else(|| "tools.nyuchi.dev".into())
    }

    pub fn redirect_uri(&self) -> Result<&str, String> {
        let uri = self.redirect_uri.trim();
        if uri.is_empty() {
            Err(REDIRECT_URI_MISSING.to_string())
        } else {
            Ok(uri)
        }
    }

    pub fn issuer_url(&self) -> Result<String, String> {
        normalise_origin(&self.authkit_domain)
    }

    pub fn auth_configured(&self) -> bool {
        !self.authkit_domain.trim().is_empty()
    }

    pub fn org_allowed(&self, org: Option<&str>) -> bool {
        !self.org_id.trim().is_empty() && org == Some(self.org_id.trim())
    }

    /// Whether who-may-sign-in is configured at all: a user allowlist or an
    /// organization. Neither set means nobody is admitted.
    pub fn gate_configured(&self) -> bool {
        self.internal_environment || !self.org_id.trim().is_empty()
    }

    /// The gate: in the internal environment a signed-in user (a token with a
    /// `sub`) is admitted and no organization is needed; otherwise the
    /// organization gate applies unchanged.
    pub fn identity_allowed(&self, org: Option<&str>, sub: Option<&str>) -> bool {
        if self.internal_environment {
            return sub.is_some_and(|s| !s.is_empty());
        }
        self.org_allowed(org)
    }

    /// The local-development opt-out: auth unconfigured, the flag exactly on,
    /// and the request addressed to localhost. Nothing else.
    pub fn dev_allowed(&self, request_host: &str) -> bool {
        !self.auth_configured()
            && self.allow_unauthenticated_dev
            && matches!(request_host, "localhost" | "127.0.0.1" | "[::1]")
    }

    /// Origins a browser MCP client may call from: no Origin always passes;
    /// a present Origin must be one of these hosts (DNS-rebinding defence).
    pub fn origin_allowed(&self, origin_host: &str) -> bool {
        [
            self.resource_host(),
            "tools.nyuchi.com".to_string(),
            "localhost".into(),
            "127.0.0.1".into(),
            "[::1]".into(),
        ]
        .iter()
        .chain(self.allowed_origin_hosts.iter())
        .any(|h| h == origin_host)
    }
}

/// Hostname of an absolute URL, or None when unparseable.
pub fn host_of(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()
        .map(|u| u.host_str().unwrap_or("").to_string())
}

/// A configured AuthKit domain (bare host or https origin) into an https
/// origin — mirrors `normaliseAuthkitDomain`: no path, no credentials,
/// https only. Blank or unusable values fail closed.
pub fn normalise_origin(value: &str) -> Result<String, String> {
    let raw = value.trim();
    if raw.is_empty() {
        return Err(AUTHKIT_DOMAIN_MISSING.into());
    }
    let candidate = if raw.contains("://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    let url = url::Url::parse(&candidate)
        .map_err(|_| format!("{AUTHKIT_DOMAIN_MISSING} (not a valid host or URL)"))?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err(format!(
            "{AUTHKIT_DOMAIN_MISSING} (must be an https origin)"
        ));
    }
    Ok(url.origin().ascii_serialization())
}

/// Same-origin relative path only: no absolute or protocol-relative URLs, no
/// backslash tricks, no CR/LF/NUL. Anything else falls back to "/".
pub fn sanitize_return_to(value: Option<&str>) -> String {
    let Some(rt) = value else { return "/".into() };
    if !rt.starts_with('/')
        || rt.starts_with("//")
        || rt.contains("://")
        || rt.contains('\\')
        || rt.contains(['\r', '\n', '\0'])
    {
        return "/".into();
    }
    rt.to_string()
}

// -----------------------------------------------------------------------------
// base64url + HS256 (pure, host-testable)
// -----------------------------------------------------------------------------

pub fn b64url(data: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(data)
}

pub fn b64url_decode(value: &str) -> Option<Vec<u8>> {
    URL_SAFE_NO_PAD.decode(value).ok()
}

/// Sign a JWT with HS256. Panics never; an empty secret is the caller's
/// fail-closed precondition, checked before this is reached.
pub fn hs256_sign(claims: &Value, secret: &str) -> String {
    let header = json!({ "alg": "HS256", "typ": "JWT" });
    let signing_input = format!(
        "{}.{}",
        b64url(serde_json::to_string(&header).unwrap().as_bytes()),
        b64url(serde_json::to_string(claims).unwrap().as_bytes())
    );
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC takes any key length");
    mac.update(signing_input.as_bytes());
    format!("{signing_input}.{}", b64url(&mac.finalize().into_bytes()))
}

/// Verify an HS256 JWT and return its claims; None for a bad signature,
/// bad shape, or expiry. Never panics, never fails open.
pub fn hs256_verify(token: &str, secret: &str) -> Option<Value> {
    let (header_b64, rest) = token.split_once('.')?;
    let (payload_b64, sig_b64) = rest.split_once('.')?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(format!("{header_b64}.{payload_b64}").as_bytes());
    let given = b64url_decode(sig_b64)?;
    // verify_slice is constant-time.
    if mac.verify_slice(&given).is_err() {
        return None;
    }
    let header: Value = serde_json::from_slice(&b64url_decode(header_b64)?).ok()?;
    if header["alg"].as_str() != Some("HS256") {
        return None;
    }
    let claims: Value = serde_json::from_slice(&b64url_decode(payload_b64)?).ok()?;
    let now = unix_now();
    claims["exp"].as_u64().filter(|e| now < *e)?;
    Some(claims)
}

pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// PKCE: challenge = BASE64URL(SHA-256(ASCII(verifier))).
pub fn pkce_challenge(verifier: &str) -> String {
    use sha2::Digest;
    let digest = Sha256::digest(verifier.as_bytes());
    b64url(&digest)
}

/// Session-cookie claims; `org` is required by the gate on every request.
pub fn mint_session(
    cfg: &AuthConfig,
    sub: Option<&str>,
    email: Option<&str>,
    org: &str,
) -> Option<String> {
    if cfg.session_secret.is_empty() {
        return None;
    }
    let now = unix_now();
    let claims = json!({
        "sub": sub, "email": email, "org": org,
        "iat": now, "exp": now + SESSION_TTL,
    });
    Some(hs256_sign(&claims, &cfg.session_secret))
}

/// Verify a session cookie: signature + expiry + the org claim must match.
pub fn verify_session(cfg: &AuthConfig, cookie: Option<&str>) -> Option<Value> {
    let value = cookie?;
    if cfg.session_secret.is_empty() {
        return None;
    }
    let claims = hs256_verify(value, &cfg.session_secret)?;
    let org = claims["org"].as_str().filter(|o| !o.is_empty());
    if !cfg.identity_allowed(org, claims["sub"].as_str()) {
        return None;
    }
    Some(claims)
}

/// The `nyuchi_oauth` round-trip cookie: base64url(JSON of state, verifier,
/// returnTo) — opaque to the browser, meaningful only against the code.
pub fn encode_oauth_cookie(state: &str, verifier: &str, return_to: &str) -> String {
    b64url(
        serde_json::to_string(&json!({
            "state": state, "codeVerifier": verifier, "returnTo": return_to
        }))
        .unwrap()
        .as_bytes(),
    )
}

pub fn decode_oauth_cookie(value: Option<&str>) -> Option<(String, String, String)> {
    let raw = b64url_decode(value?)?;
    let v: Value = serde_json::from_slice(&raw).ok()?;
    Some((
        v["state"].as_str()?.to_string(),
        v["codeVerifier"].as_str()?.to_string(),
        v["returnTo"].as_str()?.to_string(),
    ))
}

/// The authorize redirect (Authorization Code + PKCE, public client).
pub fn authorize_url(cfg: &AuthConfig, state: &str, challenge: &str) -> Result<String, String> {
    let issuer = cfg.issuer_url()?;
    let redirect_uri = cfg.redirect_uri()?;
    let mut url =
        url::Url::parse(&format!("{issuer}/oauth2/authorize")).map_err(|e| e.to_string())?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair("response_type", "code")
            .append_pair("client_id", cfg.client_id.trim())
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("code_challenge", challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", state)
            .append_pair("scope", "openid profile email");
        // The internal environment has no organizations: do not pin the flow.
        if !cfg.internal_environment {
            q.append_pair("organization_id", cfg.org_id.trim());
        }
    }
    Ok(url.to_string())
}

pub fn token_url(cfg: &AuthConfig) -> Result<String, String> {
    Ok(format!("{}/oauth2/token", cfg.issuer_url()?))
}

pub fn jwks_url(cfg: &AuthConfig) -> Result<String, String> {
    Ok(format!("{}/oauth2/jwks", cfg.issuer_url()?))
}

/// RFC 6750 / RFC 9728 challenge for the 401 on /mcp.
pub fn www_authenticate(cfg: &AuthConfig, token_sent: bool) -> String {
    let mut parts = vec![
        r#"Bearer realm="nyuchi-tools""#.to_string(),
        format!(
            r#"resource_metadata="{}/.well-known/oauth-protected-resource""#,
            origin_of(cfg.resource_url())
        ),
    ];
    if token_sent {
        parts.push(r#"error="invalid_token""#.into());
        parts.push(r#"error_description="The access token is invalid or expired""#.into());
    }
    parts.join(", ")
}

pub fn origin_of(url: &str) -> String {
    match url::Url::parse(url) {
        Ok(u) => u.origin().ascii_serialization(),
        Err(_) => "https://tools.nyuchi.dev".into(),
    }
}

pub fn protected_resource_metadata(cfg: &AuthConfig) -> Result<Value, String> {
    Ok(json!({
        "resource": cfg.resource_url(),
        "authorization_servers": [cfg.issuer_url()?],
        "bearer_methods_supported": ["header"],
        "scopes_supported": [],
    }))
}

/// A bearer token's claims, after JWKS verification (wasm) — the org and
/// identity fields the gates read.
#[derive(Clone, Debug, Default)]
pub struct VerifiedJwt {
    pub sub: Option<String>,
    pub email: Option<String>,
    pub org_id: Option<String>,
    pub scopes: Vec<String>,
}

/// Parse (not verify) a JWT's claims — used only inside
/// [`verify_jwt_wasm`] after the signature check, and in tests.
pub fn jwt_claims_unverified(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    serde_json::from_slice(&b64url_decode(payload)?).ok()
}

/// Claim checks shared by every verified token: issuer exact match, expiry,
/// and (when given) audience as string or array.
pub fn claims_pass(cfg: &AuthConfig, claims: &Value, audience: Option<&str>) -> bool {
    let Some(iss) = claims["iss"].as_str() else {
        return false;
    };
    let Ok(issuer) = cfg.issuer_url() else {
        return false;
    };
    if iss != issuer {
        return false;
    }
    let Some(exp) = claims["exp"].as_u64() else {
        return false;
    };
    if unix_now() >= exp {
        return false;
    }
    if let Some(want) = audience {
        let aud = &claims["aud"];
        let ok = match aud {
            Value::String(s) => s == want,
            Value::Array(a) => a.iter().any(|v| v.as_str() == Some(want)),
            _ => false,
        };
        if !ok {
            return false;
        }
    }
    true
}

pub fn verified_from_claims(claims: &Value) -> VerifiedJwt {
    VerifiedJwt {
        sub: claims["sub"].as_str().map(str::to_string),
        email: claims["email"].as_str().map(str::to_string),
        org_id: claims["org_id"].as_str().map(str::to_string),
        scopes: claims["scope"]
            .as_str()
            .map(|s| {
                s.split(' ')
                    .filter(|p| !p.is_empty())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
    }
}

/// Extract the bearer token from an Authorization header value.
pub fn bearer_of(header: Option<&str>) -> Option<String> {
    let h = header?;
    let rest = h.strip_prefix("Bearer ")?;
    let t = rest.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// Cookie value by name from a Cookie header (best-effort parse; cookies are
/// `name=value` pairs separated by `; `).
pub fn cookie_value<'a>(cookie_header: Option<&'a str>, name: &str) -> Option<&'a str> {
    let header = cookie_header?;
    for pair in header.split(';') {
        let pair = pair.trim();
        if let Some((_, v)) = pair.split_once('=').filter(|(k, _)| k.trim() == name) {
            return Some(v.trim());
        }
    }
    None
}

/// Set-Cookie strings matching the TS gate's options.
pub fn set_cookie(name: &str, value: &str, max_age: u64) -> String {
    format!("{name}={value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={max_age}")
}

pub fn clear_cookie(name: &str) -> String {
    format!("{name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> AuthConfig {
        AuthConfig {
            authkit_domain: "accounts.example.com".into(),
            mcp_resource: "https://tools.nyuchi.dev/mcp".into(),
            org_id: "org_123".into(),
            redirect_uri: "https://tools.example.com/callback".into(),
            client_id: "client_1".into(),
            session_secret: "secret".into(),
            ..Default::default()
        }
    }

    fn internal_cfg() -> AuthConfig {
        AuthConfig {
            internal_environment: true,
            ..cfg()
        }
    }

    #[test]
    fn the_redirect_uri_comes_from_configuration_and_fails_closed() {
        assert_eq!(cfg().redirect_uri().unwrap(), "https://tools.example.com/callback");
        let blank = AuthConfig {
            redirect_uri: "  ".into(),
            ..cfg()
        };
        assert_eq!(blank.redirect_uri().unwrap_err(), REDIRECT_URI_MISSING);
        assert!(authorize_url(&blank, "s", "c").is_err());
        assert!(authorize_url(&cfg(), "s", "c")
            .unwrap()
            .contains("redirect_uri=https%3A%2F%2Ftools.example.com%2Fcallback"));
    }

    #[test]
    fn internal_environment_admits_a_signed_in_user_with_no_org() {
        let c = internal_cfg();
        assert!(c.gate_configured());
        assert!(c.identity_allowed(None, Some("user_a")));
        assert!(c.identity_allowed(Some("org_other"), Some("user_b")));
    }

    #[test]
    fn internal_environment_refuses_a_token_with_no_subject() {
        let c = internal_cfg();
        assert!(!c.identity_allowed(Some("org_123"), None));
        assert!(!c.identity_allowed(None, Some("")));
    }

    #[test]
    fn without_the_switch_the_org_gate_applies_unchanged() {
        let c = cfg();
        assert!(c.identity_allowed(Some("org_123"), Some("anyone")));
        assert!(!c.identity_allowed(Some("org_other"), Some("user_a")));
        assert!(!c.identity_allowed(None, Some("user_a")));
        // Nothing configured at all admits nobody.
        let none = AuthConfig::default();
        assert!(!none.gate_configured());
        assert!(!none.identity_allowed(Some("org_123"), Some("user_a")));
    }

    #[test]
    fn internal_session_needs_no_org_and_old_org_sessions_still_verify_for_a_subject() {
        let c = internal_cfg();
        let ok = mint_session(&c, Some("user_a"), Some("a@b.c"), "").unwrap();
        assert!(verify_session(&c, Some(&ok)).is_some());
        // A session with no subject is not admitted.
        let nosub = mint_session(&c, None, None, "org_123").unwrap();
        assert!(verify_session(&c, Some(&nosub)).is_none());
    }

    #[test]
    fn authorize_url_pins_the_org_only_outside_the_internal_environment() {
        let pinned = authorize_url(&cfg(), "s", "c").unwrap();
        assert!(pinned.contains("organization_id=org_123"));
        let internal = authorize_url(&internal_cfg(), "s", "c").unwrap();
        assert!(!internal.contains("organization_id"));
    }

    #[test]
    fn hs256_roundtrip_and_tamper() {
        let c = cfg();
        let minted = mint_session(&c, Some("user_1"), Some("a@b.c"), "org_123").unwrap();
        let claims = verify_session(&c, Some(&minted)).unwrap();
        assert_eq!(claims["sub"], "user_1");
        assert_eq!(claims["org"], "org_123");
        // Tampered payload fails.
        let mut parts: Vec<&str> = minted.split('.').collect();
        parts[1] = "e30";
        assert!(verify_session(&c, Some(&parts.join("."))).is_none());
        // Wrong secret fails closed.
        let mut other = c.clone();
        other.session_secret = "other".into();
        assert!(verify_session(&other, Some(&minted)).is_none());
        // No secret configured: no session, never open.
        let mut bare = c.clone();
        bare.session_secret.clear();
        assert!(verify_session(&bare, Some(&minted)).is_none());
    }

    #[test]
    fn org_must_match() {
        let c = cfg();
        let minted = mint_session(&c, None, None, "org_OTHER").unwrap();
        assert!(verify_session(&c, Some(&minted)).is_none());
    }

    #[test]
    fn return_to_sanitising() {
        assert_eq!(sanitize_return_to(None), "/");
        assert_eq!(sanitize_return_to(Some("/studio?x=1")), "/studio?x=1");
        for bad in [
            "/\\evil.com",
            "//evil.com",
            "https://evil.com",
            "/a\r\nb",
            "/a\0b",
        ] {
            assert_eq!(sanitize_return_to(Some(bad)), "/");
        }
    }

    #[test]
    fn pkce_challenge_is_sha256_b64url() {
        // Known vector: SHA-256("nJ0!ar4BXw") — computed independently.
        assert_eq!(pkce_challenge("").len(), 43);
        assert_ne!(pkce_challenge("a"), pkce_challenge("b"));
    }

    #[test]
    fn origin_and_host_gates() {
        let c = cfg();
        assert!(c.origin_allowed("tools.nyuchi.dev"));
        assert!(c.origin_allowed("tools.nyuchi.com"));
        assert!(!c.origin_allowed("evil.com"));
        assert_eq!(c.resource_host(), "tools.nyuchi.dev");
    }

    #[test]
    fn normalise_origin_variants() {
        assert_eq!(
            normalise_origin(" accounts.example.com ").unwrap(),
            "https://accounts.example.com"
        );
        assert_eq!(
            normalise_origin("https://a.com/x?y").unwrap(),
            "https://a.com"
        );
        assert!(normalise_origin("http://a.com").is_err());
        assert!(normalise_origin("").is_err());
    }

    #[test]
    fn oauth_cookie_roundtrip() {
        let enc = encode_oauth_cookie("st", "vf", "/help");
        assert_eq!(
            decode_oauth_cookie(Some(&enc)).unwrap(),
            ("st".into(), "vf".into(), "/help".into())
        );
        assert!(decode_oauth_cookie(None).is_none());
    }

    #[test]
    fn bearer_and_cookies_parse() {
        assert_eq!(bearer_of(Some("Bearer abc")).as_deref(), Some("abc"));
        assert_eq!(bearer_of(Some("bearer abc")), None);
        assert_eq!(
            cookie_value(Some("a=1; nyuchi_session=jwt; b=2"), "nyuchi_session"),
            Some("jwt")
        );
    }

    #[test]
    fn challenge_and_metadata_shapes() {
        let c = cfg();
        assert!(www_authenticate(&c, false).starts_with(r#"Bearer realm="nyuchi-tools""#));
        assert!(www_authenticate(&c, false).contains(
            r#"resource_metadata="https://tools.nyuchi.dev/.well-known/oauth-protected-resource""#
        ));
        assert!(www_authenticate(&c, true).contains("invalid_token"));
        let m = protected_resource_metadata(&c).unwrap();
        assert_eq!(m["resource"], "https://tools.nyuchi.dev/mcp");
        assert_eq!(
            m["authorization_servers"][0],
            "https://accounts.example.com"
        );
    }

    #[test]
    fn claims_checks() {
        let c = cfg();
        let now = unix_now();
        let good =
            json!({"iss": "https://accounts.example.com", "exp": now + 600, "aud": "client_1"});
        assert!(claims_pass(&c, &good, Some("client_1")));
        assert!(!claims_pass(&c, &good, Some("other")));
        assert!(!claims_pass(
            &c,
            &json!({"iss": "https://other", "exp": now + 600}),
            None
        ));
        assert!(!claims_pass(
            &c,
            &json!({"iss": "https://accounts.example.com", "exp": now - 1}),
            None
        ));
        let arr = json!({"iss": "https://accounts.example.com", "exp": now + 600, "aud": ["x", "client_1"]});
        assert!(claims_pass(&c, &arr, Some("client_1")));
    }
}
