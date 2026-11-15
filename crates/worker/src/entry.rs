//! The fetch handler: `/api/*` to [`crate::api`], `/mcp` to [`crate::mcp`],
//! everything else to the site's static assets.

use crate::api::{self, Config};
use crate::mcp;
use nyuchi_imaging::privacy::Privacy;
use worker::*;

/// The one permission check for the API and the MCP alike, so a tool can
/// never do what the UI's caller could not. Allows everything until phase 3
/// wires the WorkOS login (the Worker has no route until then).
fn authorize(_req: &Request, _env: &Env) -> std::result::Result<(), Response> {
    Ok(())
}

fn config(env: &Env) -> Config {
    // Optional secret; absent means no blocked terms beyond the attestation.
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

#[event(fetch)]
async fn fetch(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let path = req.path();
    let is_api = path.starts_with("/api/");
    let is_mcp = path == "/mcp";
    if !is_api && !is_mcp {
        return env.assets("ASSETS")?.fetch_request(req).await;
    }
    if let Err(denied) = authorize(&req, &env) {
        return Ok(denied);
    }
    let method = req.method().to_string();
    let body = if method == "POST" {
        req.bytes().await?
    } else {
        Vec::new()
    };

    if is_mcp {
        if method != "POST" {
            return respond(
                405,
                &[("allow", "POST".into())],
                b"MCP: POST JSON-RPC to /mcp".to_vec(),
            );
        }
        let (status, out) = mcp::handle(&body, &config(&env));
        return respond(
            status,
            &[
                ("content-type", "application/json".into()),
                ("cache-control", "no-store".into()),
            ],
            out,
        );
    }

    let reply = api::handle(&method, &path, &body, &config(&env))
        .unwrap_or_else(|| unreachable!("every /api/ path gets a reply"));
    respond(reply.status, &reply.headers, reply.body)
}
