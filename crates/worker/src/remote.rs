//! Remote pieces of the gate that need the Workers runtime: randomness,
//! the JWKS fetch, WebCrypto RS256 verification, and the token exchange.
//! Host builds (tests) never touch this module.

#![cfg(target_arch = "wasm32")]

use crate::auth::{self, AuthConfig, VerifiedJwt};
use js_sys::{JSON, Object, Promise, Reflect};
use serde_json::Value;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use worker::{Method, Request, RequestInit};

fn crypto_global() -> web_sys::Crypto {
    Reflect::get(&js_sys::global(), &JsValue::from_str("crypto"))
        .expect("crypto global")
        .unchecked_into()
}

/// n random bytes, base64url.
pub fn random_b64url(n: usize) -> String {
    let mut buf = vec![0u8; n];
    crypto_global()
        .get_random_values_with_u8_array(&mut buf)
        .expect("getRandomValues");
    auth::b64url(&buf)
}

/// A JS object from a JSON string (algorithms and JWKs are easier via JSON
/// than Reflect sets).
fn js_object(s: &str) -> Object {
    JSON::parse(s).expect("valid JSON object").unchecked_into()
}

async fn fetch_json(url: &str) -> Result<Value, String> {
    let mut resp = get(url).await?;
    resp.json().await.map_err(|e| e.to_string())
}

async fn get(url: &str) -> Result<worker::Response, String> {
    worker::Fetch::Url(url::Url::parse(url).map_err(|e| e.to_string())?)
        .send()
        .await
        .map_err(|e| e.to_string())
}

async fn post(
    url: &str,
    content_type: &str,
    body: String,
    bearer: Option<&str>,
) -> Result<worker::Response, String> {
    let headers = worker::Headers::new();
    headers
        .set("content-type", content_type)
        .map_err(|e| e.to_string())?;
    if let Some(token) = bearer {
        headers
            .set("authorization", &format!("Bearer {token}"))
            .map_err(|e| e.to_string())?;
    }
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(JsValue::from_str(&body)));
    let req = Request::new_with_init(url, &init).map_err(|e| e.to_string())?;
    worker::Fetch::Request(req)
        .send()
        .await
        .map_err(|e| e.to_string())
}

/// JWKS cached per issuer for the isolate's lifetime.
fn jwks_cache() -> &'static std::sync::Mutex<Option<(String, Value)>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<Option<(String, Value)>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(None))
}

async fn jwks(cfg: &AuthConfig) -> Result<Value, String> {
    let url = auth::jwks_url(cfg)?;
    let mut cache = jwks_cache().lock().expect("jwks lock");
    if let Some((cached_url, keys)) = cache.as_ref() {
        if cached_url == &url {
            return Ok(keys.clone());
        }
    }
    let keys = fetch_json(&url).await?;
    *cache = Some((url, keys.clone()));
    Ok(keys)
}

async fn promise_bool(p: Promise) -> bool {
    JsFuture::from(p)
        .await
        .map(|v| v.is_truthy())
        .unwrap_or(false)
}

/// RS256-verify `signature` over `signing_input` with the JWK (n, e).
async fn rs256_verify(n: &str, e: &str, signing_input: &str, signature: &[u8]) -> bool {
    let jwk = js_object(&format!(
        r#"{{"kty":"RSA","n":"{n}","e":"{e}","ext":true,"key_ops":["verify"]}}"#
    ));
    let alg = js_object(r#"{"name":"RSASSA-PKCS1-v1_5","hash":{"name":"SHA-256"}}"#);
    let usages = js_sys::Array::of1(&JsValue::from_str("verify")).into();
    let key: web_sys::CryptoKey = match crypto_global()
        .subtle()
        .import_key_with_object("jwk", &jwk, &alg, false, &usages)
    {
        Ok(p) => match JsFuture::from(p).await {
            Ok(k) => k.unchecked_into(),
            Err(_) => return false,
        },
        Err(_) => return false,
    };
    let data = js_sys::Uint8Array::from(signing_input.as_bytes());
    let sig = js_sys::Uint8Array::from(signature);
    match crypto_global()
        .subtle()
        .verify_with_object_and_buffer_source_and_buffer_source(&alg, &key, &sig, &data)
    {
        Ok(p) => promise_bool(p).await,
        Err(_) => false,
    }
}

/// Verify a WorkOS-issued JWT against the JWKS: signature (RS256), issuer,
/// expiry and (when given) audience. `audience: None` skips the audience
/// check; `Some(a)` requires it.
pub async fn verify_jwt(
    cfg: &AuthConfig,
    token: Option<&str>,
    audience: Option<&str>,
) -> Option<VerifiedJwt> {
    let token = token?;
    if !cfg.auth_configured() {
        return None;
    }
    let (header_b64, rest) = token.split_once('.')?;
    let (payload_b64, sig_b64) = rest.split_once('.')?;
    let header: Value = serde_json::from_slice(&auth::b64url_decode(header_b64)?).ok()?;
    let kid = header["kid"].as_str()?.to_string();
    let sig = auth::b64url_decode(sig_b64)?;
    let claims: Value = serde_json::from_slice(&auth::b64url_decode(payload_b64)?).ok()?;

    let keys = jwks(cfg).await.ok()?;
    let matching = keys["keys"]
        .as_array()?
        .iter()
        .find(|k| k["kid"].as_str() == Some(kid.as_str()))?;
    if matching["kty"].as_str() != Some("RSA") {
        return None;
    }
    let n = matching["n"].as_str()?.to_string();
    let e = matching["e"].as_str()?.to_string();

    if !rs256_verify(&n, &e, &format!("{header_b64}.{payload_b64}"), &sig).await {
        return None;
    }
    if !auth::claims_pass(cfg, &claims, audience) {
        return None;
    }
    Some(auth::verified_from_claims(&claims))
}

/// Exchange an authorization code (public client, PKCE). Both tokens must
/// come back; the site login needs the id_token's identity.
pub async fn exchange_code(
    cfg: &AuthConfig,
    code: &str,
    verifier: &str,
) -> Result<(String, String), String> {
    let body = format!(
        "grant_type=authorization_code&code={}&redirect_uri={}&client_id={}&code_verifier={}",
        urlencode(code),
        urlencode("https://tools.nyuchi.com/callback"),
        urlencode(cfg.client_id.trim()),
        urlencode(verifier)
    );
    let mut resp = post(
        &auth::token_url(cfg)?,
        "application/x-www-form-urlencoded",
        body,
        None,
    )
    .await?;
    if !(200..300).contains(&resp.status_code()) {
        return Err(format!(
            "token exchange failed: HTTP {}",
            resp.status_code()
        ));
    }
    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let id = data["id_token"]
        .as_str()
        .ok_or("missing id_token")?
        .to_string();
    let access = data["access_token"]
        .as_str()
        .ok_or("missing access_token")?
        .to_string();
    Ok((id, access))
}

/// Fetch a URL and pass the JSON through untouched (the authorization-server
/// metadata mirrors).
pub async fn pass_through_json(url: &str) -> Result<(u16, Vec<u8>), String> {
    let mut resp = get(url).await?;
    let status = resp.status_code();
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok((status, bytes))
}

/// POST a GitHub issue (the nyuchi_report_issue tool).
pub async fn create_github_issue(
    token: &str,
    repo: &str,
    title: &str,
    body: &str,
    labels: &[String],
) -> Result<Value, String> {
    let payload = serde_json::json!({ "title": title, "body": body, "labels": labels });
    let mut resp = post(
        &format!("https://api.github.com/repos/{repo}/issues"),
        "application/json",
        serde_json::to_string(&payload).unwrap_or_default(),
        Some(token),
    )
    .await?;
    let status = resp.status_code();
    let data: Value = resp.json().await.unwrap_or(Value::Null);
    if status == 201 {
        Ok(data)
    } else {
        Err(format!("GitHub answered HTTP {status}"))
    }
}

/// Percent-encode for form bodies.
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
