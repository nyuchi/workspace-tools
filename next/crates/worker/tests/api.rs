use base64::Engine as _;
use nyuchi_tools_worker::api::{Config, Reply, handle};
use serde_json::{Value, json};

fn cfg() -> Config {
    Config {
        blocked_terms: vec!["Example Academy".into()],
    }
}

fn post(path: &str, body: &Value) -> Reply {
    handle("POST", path, &serde_json::to_vec(body).unwrap(), &cfg()).unwrap()
}

fn get(path: &str) -> Reply {
    handle("GET", path, &[], &cfg()).unwrap()
}

fn header<'a>(r: &'a Reply, name: &str) -> Option<&'a str> {
    r.headers
        .iter()
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.as_str())
}

fn json_body(r: &Reply) -> Value {
    serde_json::from_slice(&r.body).unwrap()
}

/// A small solid PNG, base64.
fn png_b64(w: u32, h: u32) -> String {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgb);
        enc.set_depth(png::BitDepth::Eight);
        let mut wr = enc.write_header().unwrap();
        wr.write_image_data(&vec![200; (w * h * 3) as usize])
            .unwrap();
    }
    base64::engine::general_purpose::STANDARD.encode(out)
}

#[test]
fn non_api_paths_fall_through_to_the_site() {
    assert!(handle("GET", "/", &[], &cfg()).is_none());
    assert!(handle("GET", "/studio", &[], &cfg()).is_none());
}

#[test]
fn catalogue_routes() {
    let r = get("/api/presets");
    assert_eq!(r.status, 200);
    let presets = json_body(&r);
    let story = presets
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == "story")
        .unwrap();
    assert_eq!(story["width"], 1080);
    assert_eq!(story["height"], 1920);
    assert_eq!(story["safe"], json!([250, 64, 340, 64]));
    assert_eq!(get("/api/health").status, 200);
    assert!(
        json_body(&get("/api/themes"))
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["id"] == "toddle-launch")
    );
    assert!(
        json_body(&get("/api/brands"))
            .as_array()
            .unwrap()
            .iter()
            .any(|b| b["key"] == "nyuchi")
    );
}

#[test]
fn wrong_methods_and_unknown_routes() {
    assert_eq!(get("/api/render").status, 405);
    assert_eq!(
        handle("POST", "/api/presets", b"{}", &cfg())
            .unwrap()
            .status,
        405
    );
    assert_eq!(get("/api/nope").status, 404);
    let big = vec![b' '; nyuchi_tools_worker::api::MAX_BODY + 1];
    assert_eq!(
        handle("POST", "/api/render", &big, &cfg()).unwrap().status,
        413
    );
}

#[test]
fn renders_a_story_with_alt_text() {
    let r = post(
        "/api/render",
        &json!({
            "preset": "story",
            "headline": "Every criterion, in its own column.",
            "cta": "learning.nyuchi.com",
            "fake_or_redacted": true,
            "image": { "data": format!("data:image/png;base64,{}", png_b64(600, 300)), "alt": "A test image", "redact": [[0, 0, 100, 20]] }
        }),
    );
    assert_eq!(r.status, 200, "{}", String::from_utf8_lossy(&r.body));
    assert_eq!(header(&r, "content-type"), Some("image/png"));
    assert_eq!(header(&r, "x-width"), Some("1080"));
    assert_eq!(header(&r, "x-height"), Some("1920"));
    let alt = header(&r, "x-alt-text").unwrap();
    assert!(alt.contains("A test image"));
    assert!(alt.is_ascii());
    assert_eq!(&r.body[1..4], b"PNG");
}

#[test]
fn store_presets_come_back_as_jpeg() {
    let r = post(
        "/api/render",
        &json!({ "preset": "cws-promo-small", "headline": "Toddle Enhancement Extension" }),
    );
    assert_eq!(r.status, 200);
    assert_eq!(header(&r, "content-type"), Some("image/jpeg"));
    assert_eq!(&r.body[..2], &[0xFF, 0xD8]);
}

#[test]
fn privacy_gate_runs_on_the_api() {
    // No attestation.
    let r = post(
        "/api/render",
        &json!({ "preset": "og", "headline": "x", "image": { "data": png_b64(40, 20), "alt": "x" } }),
    );
    assert_eq!(r.status, 422);
    // Blocked term, case-insensitive, not echoed.
    let r = post(
        "/api/render",
        &json!({ "preset": "og", "headline": "Now at EXAMPLE ACADEMY" }),
    );
    assert_eq!(r.status, 422);
    assert!(
        !String::from_utf8_lossy(&r.body)
            .to_lowercase()
            .contains("example academy")
    );
    // Missing alt for a screenshot.
    let r = post(
        "/api/render",
        &json!({ "preset": "og", "headline": "x", "fake_or_redacted": true, "image": { "data": png_b64(40, 20), "alt": " " } }),
    );
    assert_eq!(r.status, 400);
}

#[test]
fn bad_input_is_a_400() {
    assert_eq!(
        post("/api/render", &json!({ "preset": "nope", "headline": "x" })).status,
        400
    );
    assert_eq!(
        post(
            "/api/render",
            &json!({ "preset": "og", "headline": "x", "theme": "nope" })
        )
        .status,
        400
    );
    assert_eq!(
        post("/api/render", &json!({ "preset": "og", "surprise": 1 })).status,
        400
    );
    assert_eq!(
        handle("POST", "/api/render", b"not json", &cfg())
            .unwrap()
            .status,
        400
    );
    let r = post(
        "/api/render",
        &json!({ "preset": "og", "headline": "x", "fake_or_redacted": true, "image": { "data": "!!!", "alt": "x" } }),
    );
    assert_eq!(r.status, 400);
}

#[test]
fn campaign_comes_back_as_a_zip_with_a_manifest() {
    let r = post(
        "/api/campaign",
        &json!({
            "campaign": {
                "privacy": { "fake_or_redacted": true },
                "content": { "headline": "Hello", "cta": "example.test" },
                "image": { "alt": "A grey test image" },
                "render": [
                    { "preset": "story" },
                    { "preset": "cws-promo-small", "image": false, "file": "tile.jpg" }
                ]
            },
            "image": png_b64(600, 300)
        }),
    );
    assert_eq!(r.status, 200, "{}", String::from_utf8_lossy(&r.body));
    assert_eq!(header(&r, "content-type"), Some("application/zip"));
    let z = &r.body;
    assert_eq!(&z[..4], &[0x50, 0x4B, 0x03, 0x04]);
    let names: Vec<&str> = ["story.png", "tile.jpg", "manifest.json"].to_vec();
    for n in names {
        assert!(z.windows(n.len()).any(|w| w == n.as_bytes()), "{n} missing");
    }
    // End-of-central-directory says three entries.
    let eocd = z.len() - 22;
    assert_eq!(&z[eocd..eocd + 4], &[0x50, 0x4B, 0x05, 0x06]);
    assert_eq!(u16::from_le_bytes([z[eocd + 10], z[eocd + 11]]), 3);
}

#[test]
fn campaign_refuses_path_tricks_and_missing_images() {
    let r = post(
        "/api/campaign",
        &json!({
            "campaign": { "privacy": { "fake_or_redacted": true }, "content": { "headline": "x" },
                          "render": [{ "preset": "og", "file": "../escape.png" }] }
        }),
    );
    assert_eq!(r.status, 422);
    let r = post(
        "/api/campaign",
        &json!({
            "campaign": { "privacy": { "fake_or_redacted": true }, "content": { "headline": "x" },
                          "image": { "alt": "x" }, "render": [{ "preset": "og" }] }
        }),
    );
    assert_eq!(r.status, 422);
}

#[test]
fn signature_route() {
    let r = post(
        "/api/signature",
        &json!({ "name": "Sample Person", "email": "hello@learning.nyuchi.com", "title": "Lead" }),
    );
    assert_eq!(r.status, 200);
    let v = json_body(&r);
    assert_eq!(v["brand"], "learning");
    assert!(v["html"].as_str().unwrap().starts_with("<table"));
    assert!(v["text"].as_str().unwrap().starts_with("Sample Person"));
    assert_eq!(
        post(
            "/api/signature",
            &json!({ "name": "", "email": "x@nyuchi.com" })
        )
        .status,
        400
    );
}
