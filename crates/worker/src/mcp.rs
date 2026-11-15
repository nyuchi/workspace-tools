//! The MCP server, on the same backend as the site.
//!
//! Owner rule: *the MCP must be able to do everything the UI can.* So every
//! tool here is one API route: its input schema is that route's request
//! body, and calling it runs [`crate::api::handle`] — the same validation,
//! the same privacy gate and blocked terms, and (once the login lands) the
//! same permission check, because `entry.rs` authorises `/api/*` and `/mcp`
//! in one place. No logic lives here that the API does not have.
//!
//! Transport: MCP streamable HTTP, stateless — `POST /mcp` with a JSON-RPC
//! message (or batch), answered with `application/json`. No sessions and no
//! server-initiated stream, so `GET /mcp` is 405. Images come back as MCP
//! image content; a campaign as an embedded ZIP resource plus its manifest
//! (sizes and alt text) as text.

use crate::api::{self, Config, Reply};
use base64::Engine as _;
use serde_json::{Value, json};

pub const PROTOCOL_VERSION: &str = "2025-06-18";

pub struct Tool {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    /// The API route this tool calls.
    pub method: &'static str,
    pub route: &'static str,
    pub read_only: bool,
    pub schema: fn() -> Value,
}

fn no_args() -> Value {
    json!({ "type": "object", "properties": {}, "additionalProperties": false })
}

fn mode() -> Value {
    json!({ "type": "string", "enum": ["light", "dark"], "default": "light" })
}

fn image_in() -> Value {
    json!({
        "type": "object",
        "description": "A screenshot to set in the frame. Must show only fake or redacted data.",
        "properties": {
            "data": { "type": "string", "description": "Base64 PNG or JPEG; a data: URL prefix is accepted." },
            "alt": { "type": "string", "description": "What the screenshot shows. Required; becomes the alt text." },
            "crop": { "type": "array", "items": { "type": "integer", "minimum": 0 }, "minItems": 4, "maxItems": 4, "description": "[x, y, w, h] in the screenshot's pixels." },
            "redact": { "type": "array", "items": { "type": "array", "items": { "type": "integer", "minimum": 0 }, "minItems": 4, "maxItems": 4 }, "description": "[x, y, w, h] boxes painted over as skeleton bars." },
            "chrome": { "type": "string", "description": "Draw a browser frame with this address-bar text." }
        },
        "required": ["data", "alt"],
        "additionalProperties": false
    })
}

fn content_props() -> Value {
    json!({
        "eyebrow": { "type": "string", "description": "Small line above the headline; the theme's default when omitted." },
        "headline": { "type": "string" },
        "sub": { "type": "string", "description": "Supporting line." },
        "points": { "type": "array", "items": { "type": "string" }, "description": "Short feature lines (stories, 4:5, square)." },
        "cta": { "type": "string", "description": "Call to action, e.g. a URL." }
    })
}

fn render_schema() -> Value {
    let mut props = content_props();
    let p = props.as_object_mut().expect("object");
    p.insert("preset".into(), json!({ "type": "string", "description": "Preset id from nyuchi_list_presets, e.g. story, square, og, cws-screenshot." }));
    p.insert("theme".into(), json!({ "type": "string", "default": "toddle-launch", "description": "Theme id from nyuchi_list_themes." }));
    p.insert("mode".into(), mode());
    p.insert("guides".into(), json!({ "type": "boolean", "default": false, "description": "Overlay the platform's safe area (for review, not upload)." }));
    p.insert("fake_or_redacted".into(), json!({ "type": "boolean", "default": false, "description": "Attest the screenshot holds only fake or redacted data. Renders with a screenshot are refused without it." }));
    p.insert("slide".into(), json!({ "type": "array", "items": { "type": "integer", "minimum": 1 }, "minItems": 2, "maxItems": 2, "description": "[n, of] for a carousel slide." }));
    p.insert("composition".into(), json!({ "type": "string", "enum": ["top", "side", "stack", "tile", "icon"], "description": "Force a layout instead of choosing from the canvas." }));
    p.insert("image".into(), image_in());
    json!({ "type": "object", "properties": props, "required": ["preset", "headline"], "additionalProperties": false })
}

fn campaign_schema() -> Value {
    let render = json!({
        "type": "object",
        "properties": {
            "preset": { "type": "string" },
            "file": { "type": "string", "description": "Plain file name; <preset>.<ext> when omitted." },
            "mode": mode(),
            "guides": { "type": "boolean" },
            "image": { "type": "boolean", "description": "false renders this one without the screenshot." },
            "crop": { "type": "array", "items": { "type": "integer" }, "minItems": 4, "maxItems": 4 },
            "composition": { "type": "string", "enum": ["top", "side", "stack", "tile", "icon"] },
            "slide": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 },
            "eyebrow": { "type": "string" }, "headline": { "type": "string" }, "sub": { "type": "string" },
            "points": { "type": "array", "items": { "type": "string" } }, "cta": { "type": "string" },
            "show_cta": { "type": "boolean", "description": "false drops the shared CTA for this render." }
        },
        "required": ["preset"],
        "additionalProperties": false
    });
    json!({
        "type": "object",
        "properties": {
            "campaign": {
                "type": "object",
                "properties": {
                    "theme": { "type": "string", "default": "toddle-launch" },
                    "mode": mode(),
                    "privacy": {
                        "type": "object",
                        "properties": { "fake_or_redacted": { "type": "boolean" } },
                        "required": ["fake_or_redacted"],
                        "additionalProperties": false
                    },
                    "content": { "type": "object", "properties": content_props(), "additionalProperties": false },
                    "image": {
                        "type": "object",
                        "description": "Present when the set uses a screenshot (its bytes go in the top-level `image`).",
                        "properties": {
                            "alt": { "type": "string" },
                            "crop": { "type": "array", "items": { "type": "integer" }, "minItems": 4, "maxItems": 4 },
                            "redact": { "type": "array", "items": { "type": "array", "items": { "type": "integer" }, "minItems": 4, "maxItems": 4 } },
                            "chrome": { "type": "string" }
                        },
                        "required": ["alt"],
                        "additionalProperties": false
                    },
                    "render": { "type": "array", "items": render, "minItems": 1, "maxItems": 40 }
                },
                "required": ["privacy", "content", "render"],
                "additionalProperties": false
            },
            "image": { "type": "string", "description": "Base64 PNG or JPEG screenshot, when campaign.image is set." }
        },
        "required": ["campaign"],
        "additionalProperties": false
    })
}

fn signature_schema() -> Value {
    let s = |d: &str| json!({ "type": "string", "description": d });
    json!({
        "type": "object",
        "properties": {
            "brand": s("Brand key from nyuchi_list_brands; empty to take it from the email's domain."),
            "name": s("Full name."), "email": s("Email address."), "title": s("Role."),
            "phone": s("Phone number."), "whatsapp": s("WhatsApp number."),
            "photo": s("https:// URL of a square photo (optional)."),
            "linkedin": s("Personal LinkedIn URL."), "x": s("Personal X URL."),
            "instagram": s("Personal Instagram URL."), "facebook": s("Personal Facebook URL."),
            "promo_image": s("https:// banner image URL."), "promo_link": s("Banner link."), "promo_alt": s("Banner alt text.")
        },
        "required": ["name", "email"],
        "additionalProperties": false
    })
}

/// One tool per API route. The parity test holds this to `api::ROUTES` and
/// to the routes the site calls.
pub const TOOLS: &[Tool] = &[
    Tool {
        name: "nyuchi_health",
        title: "Health",
        description: "Liveness and version of the nyuchi-tools backend.",
        method: "GET",
        route: "/api/health",
        read_only: true,
        schema: no_args,
    },
    Tool {
        name: "nyuchi_list_presets",
        title: "List image presets",
        description: "Every image size the tools render: id, platform, width, height, format, safe-area insets [top, right, bottom, left] and upload limit.",
        method: "GET",
        route: "/api/presets",
        read_only: true,
        schema: no_args,
    },
    Tool {
        name: "nyuchi_list_themes",
        title: "List themes",
        description: "The image themes (Mzizi colours, light and dark); toddle-launch is the default.",
        method: "GET",
        route: "/api/themes",
        read_only: true,
        schema: no_args,
    },
    Tool {
        name: "nyuchi_list_brands",
        title: "List brands",
        description: "The one Bundu-ecosystem brand list: key, kind, parent, name, tagline, URL, email domains, Mzizi colour, socials.",
        method: "GET",
        route: "/api/brands",
        read_only: true,
        schema: no_args,
    },
    Tool {
        name: "nyuchi_render_image",
        title: "Render one image",
        description: "Render one image at any preset — story, feed, OG, store, email, icon — with a theme, light or dark, an optional screenshot (framed, cropped, redacted), eyebrow, headline, supporting line, points, CTA and carousel slide number. Set guides=true to preview the platform's safe area. Returns the image and its alt text. A screenshot needs fake_or_redacted=true; text with a blocked term is refused.",
        method: "POST",
        route: "/api/render",
        read_only: true,
        schema: render_schema,
    },
    Tool {
        name: "nyuchi_render_campaign",
        title: "Render a campaign set",
        description: "Render a whole set of presets from one input, with per-render overrides. Returns the ZIP (every image plus manifest.json) as an embedded resource, and the manifest — file, size, format, safe area and alt text per image — as text.",
        method: "POST",
        route: "/api/campaign",
        read_only: true,
        schema: campaign_schema,
    },
    Tool {
        name: "nyuchi_build_signature",
        title: "Build an email signature",
        description: "Build the Mzizi email signature for any brand and person: email-safe HTML, plain text, and the brand used.",
        method: "POST",
        route: "/api/signature",
        read_only: true,
        schema: signature_schema,
    },
];

fn rpc_result(id: &Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn rpc_error(id: &Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn tool_list() -> Value {
    let tools: Vec<Value> = TOOLS
        .iter()
        .map(|t| {
            json!({
                "name": t.name,
                "title": t.title,
                "description": t.description,
                "inputSchema": (t.schema)(),
                "annotations": { "readOnlyHint": t.read_only, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false }
            })
        })
        .collect();
    json!({ "tools": tools })
}

fn header<'a>(r: &'a Reply, name: &str) -> &'a str {
    r.headers
        .iter()
        .find(|(k, _)| *k == name)
        .map_or("", |(_, v)| v.as_str())
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%'
            && i + 3 <= b.len()
            && let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16)
        {
            out.push(v);
            i += 3;
            continue;
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A tool result from an API reply.
fn to_result(reply: Reply) -> Value {
    let b64 = |b: &[u8]| base64::engine::general_purpose::STANDARD.encode(b);
    let ctype = header(&reply, "content-type").to_string();
    if reply.status >= 400 {
        let msg = serde_json::from_slice::<Value>(&reply.body)
            .ok()
            .and_then(|v| v["error"].as_str().map(str::to_string))
            .unwrap_or_else(|| format!("HTTP {}", reply.status));
        return json!({ "content": [{ "type": "text", "text": msg }], "isError": true });
    }
    if ctype.starts_with("image/") {
        let alt = percent_decode(header(&reply, "x-alt-text"));
        let size = format!(
            "{}×{}",
            header(&reply, "x-width"),
            header(&reply, "x-height")
        );
        return json!({
            "content": [
                { "type": "image", "data": b64(&reply.body), "mimeType": ctype },
                { "type": "text", "text": format!("{size} {ctype}. Alt text: {alt}") }
            ],
            "structuredContent": { "width": header(&reply, "x-width"), "height": header(&reply, "x-height"), "mimeType": ctype, "alt": alt }
        });
    }
    if ctype == "application/zip" {
        let manifest = reply.meta.clone().unwrap_or(Value::Null);
        return json!({
            "content": [
                { "type": "resource", "resource": { "uri": "nyuchi://campaign.zip", "mimeType": "application/zip", "blob": b64(&reply.body) } },
                { "type": "text", "text": serde_json::to_string_pretty(&manifest).unwrap_or_default() }
            ],
            "structuredContent": { "manifest": manifest }
        });
    }
    let body: Value = serde_json::from_slice(&reply.body).unwrap_or(Value::Null);
    json!({
        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&body).unwrap_or_default() }],
        "structuredContent": if body.is_object() { body } else { json!({ "items": body }) }
    })
}

fn call_tool(params: &Value, cfg: &Config) -> Result<Value, (i64, String)> {
    let name = params["name"]
        .as_str()
        .ok_or((-32602, "params.name is required".to_string()))?;
    let tool = TOOLS
        .iter()
        .find(|t| t.name == name)
        .ok_or((-32602, format!("unknown tool {name:?}")))?;
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let body = if tool.method == "POST" {
        serde_json::to_vec(&args).unwrap_or_default()
    } else {
        Vec::new()
    };
    let reply =
        api::handle(tool.method, tool.route, &body, cfg).expect("tool routes are API routes");
    Ok(to_result(reply))
}

/// Handle one JSON-RPC message. `None` for a notification.
fn handle_one(msg: &Value, cfg: &Config) -> Option<Value> {
    let id = msg.get("id").cloned();
    let method = msg["method"].as_str().unwrap_or("");
    let id = id?; // notifications (no id) get no response
    if msg["jsonrpc"] != "2.0" {
        return Some(rpc_error(&id, -32600, "jsonrpc must be \"2.0\""));
    }
    Some(match method {
        "initialize" => rpc_result(
            &id,
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": { "name": "nyuchi-tools", "title": "Nyuchi Tools", "version": env!("CARGO_PKG_VERSION") },
                "instructions": "Image presets, renders (single and campaign sets) and email signatures for the Bundu ecosystem — the same backend as tools.nyuchi.com. Screenshots must show only fake or redacted data; never put a real student, staff member or school name in any text."
            }),
        ),
        "ping" => rpc_result(&id, json!({})),
        "tools/list" => rpc_result(&id, tool_list()),
        "tools/call" => match call_tool(&msg["params"], cfg) {
            Ok(r) => rpc_result(&id, r),
            Err((code, m)) => rpc_error(&id, code, &m),
        },
        _ => rpc_error(&id, -32601, &format!("method not found: {method}")),
    })
}

/// `POST /mcp`. Returns the HTTP status and the JSON body (empty for
/// notification-only input, answered 202).
pub fn handle(body: &[u8], cfg: &Config) -> (u16, Vec<u8>) {
    let parsed: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => {
            let e = rpc_error(&Value::Null, -32700, "parse error");
            return (400, serde_json::to_vec(&e).unwrap_or_default());
        }
    };
    let out = match &parsed {
        Value::Array(batch) => {
            let replies: Vec<Value> = batch.iter().filter_map(|m| handle_one(m, cfg)).collect();
            if replies.is_empty() {
                None
            } else {
                Some(Value::Array(replies))
            }
        }
        msg => handle_one(msg, cfg),
    };
    match out {
        Some(v) => (200, serde_json::to_vec(&v).unwrap_or_default()),
        None => (202, Vec::new()),
    }
}
