//! The fetch handler: `/api/*` to [`crate::api`], everything else to the
//! site's static assets.

use crate::api::{self, Config};
use nyuchi_imaging::privacy::Privacy;
use worker::*;

#[event(fetch)]
async fn fetch(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let path = req.path();
    if !path.starts_with("/api/") {
        return env.assets("ASSETS")?.fetch_request(req).await;
    }
    let method = req.method().to_string();
    let body = if method == "POST" {
        req.bytes().await?
    } else {
        Vec::new()
    };
    // Optional secret; absent means no blocked terms beyond the attestation.
    let blocked_terms = env
        .secret("BLOCKED_TERMS")
        .map(|s| Privacy::terms_from_str(&s.to_string()))
        .unwrap_or_default();
    let reply = api::handle(&method, &path, &body, &Config { blocked_terms })
        .unwrap_or_else(|| unreachable!("every /api/ path gets a reply"));

    let headers = Headers::new();
    for (k, v) in &reply.headers {
        headers.set(k, v)?;
    }
    Ok(Response::from_bytes(reply.body)?
        .with_status(reply.status)
        .with_headers(headers))
}
