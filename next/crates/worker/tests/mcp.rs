//! MCP parity and protocol tests. Owner rule: the MCP can do everything the
//! UI can, through the same backend.

use base64::Engine as _;
use nyuchi_tools_worker::api::{Config, ROUTES};
use nyuchi_tools_worker::mcp::{self, TOOLS};
use serde_json::{Value, json};
use std::collections::BTreeSet;
use std::path::Path;

fn cfg() -> Config {
    Config {
        blocked_terms: vec!["Example Academy".into()],
    }
}

fn rpc(msg: Value) -> Value {
    let (status, body) = mcp::handle(&serde_json::to_vec(&msg).unwrap(), &cfg());
    assert_eq!(status, 200, "{}", String::from_utf8_lossy(&body));
    serde_json::from_slice(&body).unwrap()
}

fn call(name: &str, args: Value) -> Value {
    let r = rpc(
        json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": name, "arguments": args } }),
    );
    r["result"].clone()
}

fn png_b64(w: u32, h: u32) -> String {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgb);
        enc.set_depth(png::BitDepth::Eight);
        let mut wr = enc.write_header().unwrap();
        wr.write_image_data(&vec![180; (w * h * 3) as usize])
            .unwrap();
    }
    base64::engine::general_purpose::STANDARD.encode(out)
}

/// Every `/api/...` route the site's source calls.
fn site_routes() -> BTreeSet<String> {
    fn walk(dir: &Path, out: &mut BTreeSet<String>) {
        for e in std::fs::read_dir(dir).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                walk(&p, out);
            } else if matches!(p.extension().and_then(|x| x.to_str()), Some("astro" | "ts")) {
                let src = std::fs::read_to_string(&p).unwrap();
                for (i, _) in src.match_indices("'/api/") {
                    let rest = &src[i + 1..];
                    let end = rest.find('\'').unwrap();
                    out.insert(rest[..end].to_string());
                }
            }
        }
    }
    let mut out = BTreeSet::new();
    walk(
        &Path::new(env!("CARGO_MANIFEST_DIR")).join("../../site/src"),
        &mut out,
    );
    out
}

/// How the UI offers each tool's capability. A tool the UI does not offer
/// must say why here, and the test keeps this list honest.
fn ui_surface(tool: &str) -> &'static str {
    match tool {
        "nyuchi_render_image" | "nyuchi_render_campaign" | "nyuchi_build_signature" => "fetch",
        // The site renders these lists at build time from the same TOML the
        // API serves (Presets page, Studio picker, theme and brand menus).
        "nyuchi_list_presets" | "nyuchi_list_themes" | "nyuchi_list_brands" => "build-time data",
        "nyuchi_health" => "ops only",
        other => panic!("{other}: say how the UI offers this tool"),
    }
}

#[test]
fn every_api_route_has_exactly_one_tool_and_back() {
    let routes: BTreeSet<_> = ROUTES
        .iter()
        .map(|(m, p)| (m.to_string(), p.to_string()))
        .collect();
    let tools: BTreeSet<_> = TOOLS
        .iter()
        .map(|t| (t.method.to_string(), t.route.to_string()))
        .collect();
    assert_eq!(routes, tools, "API routes and MCP tools differ");
    assert_eq!(TOOLS.len(), routes.len(), "two tools share a route");
    let names: BTreeSet<_> = TOOLS.iter().map(|t| t.name).collect();
    assert_eq!(names.len(), TOOLS.len(), "duplicate tool names");
}

#[test]
fn every_ui_action_has_a_tool_and_every_tool_a_ui_surface() {
    let fetched = site_routes();
    assert!(
        !fetched.is_empty(),
        "found no /api/ calls in the site source"
    );
    for route in &fetched {
        assert!(
            TOOLS.iter().any(|t| t.route == route),
            "the site calls {route}, which no MCP tool exposes"
        );
    }
    for t in TOOLS {
        match ui_surface(t.name) {
            "fetch" => assert!(
                fetched.contains(t.route),
                "{} is marked as a UI action but the site never calls {}",
                t.name,
                t.route
            ),
            "build-time data" | "ops only" => {}
            s => panic!("unknown surface {s}"),
        }
    }
}

#[test]
fn initialize_and_list() {
    let r = rpc(
        json!({ "jsonrpc": "2.0", "id": 0, "method": "initialize", "params": { "protocolVersion": mcp::PROTOCOL_VERSION, "capabilities": {}, "clientInfo": { "name": "t", "version": "0" } } }),
    );
    assert_eq!(r["result"]["protocolVersion"], mcp::PROTOCOL_VERSION);
    assert!(r["result"]["capabilities"]["tools"].is_object());
    let list = rpc(json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }));
    let tools = list["result"]["tools"].as_array().unwrap();
    assert_eq!(tools.len(), TOOLS.len());
    for t in tools {
        assert_eq!(t["inputSchema"]["type"], "object", "{}", t["name"]);
        assert!(t["description"].as_str().unwrap().len() > 20);
    }
}

#[test]
fn render_returns_image_content_with_alt_text() {
    let r = call(
        "nyuchi_render_image",
        json!({
            "preset": "story", "theme": "toddle-launch", "mode": "dark", "guides": true,
            "fake_or_redacted": true, "eyebrow": "Nyuchi Learning", "headline": "Every criterion, in its own column.",
            "sub": "One line.", "points": ["One", "Two"], "cta": "learning.nyuchi.com", "slide": [1, 3], "composition": "stack",
            "image": { "data": png_b64(600, 300), "alt": "A grey test image", "crop": [0, 0, 600, 300], "redact": [[0, 0, 50, 10]], "chrome": "example.test" }
        }),
    );
    assert!(r.get("isError").is_none(), "{r}");
    let img = &r["content"][0];
    assert_eq!(img["type"], "image");
    assert_eq!(img["mimeType"], "image/png");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(img["data"].as_str().unwrap())
        .unwrap();
    assert_eq!(&bytes[1..4], b"PNG");
    assert_eq!(r["structuredContent"]["width"], "1080");
    assert!(
        r["structuredContent"]["alt"]
            .as_str()
            .unwrap()
            .contains("A grey test image")
    );
}

#[test]
fn the_privacy_gate_runs_for_tools_too() {
    let r = call(
        "nyuchi_render_image",
        json!({ "preset": "og", "headline": "x", "image": { "data": png_b64(40, 20), "alt": "x" } }),
    );
    assert_eq!(r["isError"], true);
    let r = call(
        "nyuchi_render_image",
        json!({ "preset": "og", "headline": "Now at EXAMPLE ACADEMY" }),
    );
    assert_eq!(r["isError"], true);
    assert!(!r.to_string().to_lowercase().contains("example academy"));
    let r = call(
        "nyuchi_render_campaign",
        json!({ "campaign": { "privacy": { "fake_or_redacted": true }, "content": { "headline": "Example Academy" }, "render": [{ "preset": "og" }] } }),
    );
    assert_eq!(r["isError"], true);
}

#[test]
fn campaign_returns_zip_and_manifest() {
    let r = call(
        "nyuchi_render_campaign",
        json!({
            "campaign": {
                "theme": "toddle-launch", "mode": "light",
                "privacy": { "fake_or_redacted": true },
                "content": { "headline": "Hello", "cta": "example.test" },
                "image": { "alt": "A grey test image" },
                "render": [{ "preset": "story" }, { "preset": "cws-promo-small", "image": false, "file": "tile.jpg", "show_cta": false }]
            },
            "image": png_b64(600, 300)
        }),
    );
    assert!(r.get("isError").is_none(), "{r}");
    let res = &r["content"][0]["resource"];
    assert_eq!(res["mimeType"], "application/zip");
    let zip = base64::engine::general_purpose::STANDARD
        .decode(res["blob"].as_str().unwrap())
        .unwrap();
    assert_eq!(&zip[..4], &[0x50, 0x4B, 0x03, 0x04]);
    let m = r["structuredContent"]["manifest"].as_array().unwrap();
    assert_eq!(m.len(), 2);
    assert!(m[0]["alt"].as_str().unwrap().contains("A grey test image"));
    assert_eq!(m[1]["file"], "tile.jpg");
}

#[test]
fn signature_and_lists() {
    let r = call(
        "nyuchi_build_signature",
        json!({ "name": "Sample Person", "email": "hello@lingo.mukoko.com", "title": "Lead", "whatsapp": "+263 77 000 0000" }),
    );
    assert_eq!(r["structuredContent"]["brand"], "lingo");
    assert!(
        r["structuredContent"]["html"]
            .as_str()
            .unwrap()
            .starts_with("<table")
    );
    let presets = call("nyuchi_list_presets", json!({}));
    assert!(
        presets["structuredContent"]["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == "story")
    );
    let brands = call("nyuchi_list_brands", json!({}));
    assert!(
        brands["structuredContent"]["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|b| b["key"] == "mukoko")
    );
    assert_eq!(
        call("nyuchi_health", json!({}))["structuredContent"]["ok"],
        true
    );
}

#[test]
fn protocol_errors() {
    let r = rpc(
        json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "nope" } }),
    );
    assert_eq!(r["error"]["code"], -32602);
    let r = rpc(json!({ "jsonrpc": "2.0", "id": 4, "method": "nope" }));
    assert_eq!(r["error"]["code"], -32601);
    let (s, b) = mcp::handle(
        br#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
        &cfg(),
    );
    assert_eq!((s, b.len()), (202, 0));
    let (s, _) = mcp::handle(b"not json", &cfg());
    assert_eq!(s, 400);
    let batch = rpc(json!([
        { "jsonrpc": "2.0", "id": 5, "method": "ping" },
        { "jsonrpc": "2.0", "method": "notifications/initialized" },
        { "jsonrpc": "2.0", "id": 6, "method": "tools/list" }
    ]));
    assert_eq!(batch.as_array().unwrap().len(), 2);
    // Unknown arguments are refused by the API's own validation.
    let r = call(
        "nyuchi_render_image",
        json!({ "preset": "og", "headline": "x", "surprise": 1 }),
    );
    assert_eq!(r["isError"], true);
}
