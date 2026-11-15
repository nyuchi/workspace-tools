//! The API, as plain functions: bytes in, a [`Reply`] out.
//!
//! Nothing here touches workers-rs, so the whole API is tested natively
//! (`cargo test`); `entry.rs` is the thin wasm wrapper that moves a request
//! in and a reply out.
//!
//! | Route                  | Does                                                    |
//! | ---------------------- | ------------------------------------------------------- |
//! | `GET  /api/health`     | liveness + version                                      |
//! | `GET  /api/presets`    | the preset catalogue                                    |
//! | `GET  /api/themes`     | the themes                                              |
//! | `GET  /api/brands`     | the one brand list                                      |
//! | `POST /api/render`     | one image (PNG/JPEG), alt text in `X-Alt-Text`          |
//! | `POST /api/campaign`   | a whole set as a ZIP, with `manifest.json`              |
//! | `POST /api/signature`  | the email signature: `{html, text, brand}`              |

use base64::Engine as _;
use nyuchi_imaging::campaign::{self, Campaign};
use nyuchi_imaging::layout::{Composition, Content, SourceImage};
use nyuchi_imaging::privacy::Privacy;
use nyuchi_imaging::render::{self, RenderError, Request};
use nyuchi_imaging::theme::{self, Mode};
use nyuchi_imaging::{alt, preset};
use serde::Deserialize;
use serde_json::json;

/// Requests carry a base64 screenshot; Cloudflare Images' own ceiling is
/// 10MB, and base64 adds a third.
pub const MAX_BODY: usize = 14 * 1024 * 1024;

pub struct Config {
    /// School, student and staff names that must never appear in an image —
    /// from the `BLOCKED_TERMS` secret, one per line. Never logged, never
    /// echoed.
    pub blocked_terms: Vec<String>,
}

/// Every API route, `(method, path)`. The UI calls these, and the MCP
/// server exposes each as a tool (`crate::mcp::TOOLS`); a test fails if the
/// three ever disagree.
pub const ROUTES: &[(&str, &str)] = &[
    ("GET", "/api/health"),
    ("GET", "/api/presets"),
    ("GET", "/api/themes"),
    ("GET", "/api/brands"),
    ("POST", "/api/render"),
    ("POST", "/api/campaign"),
    ("POST", "/api/signature"),
];

#[derive(Debug)]
pub struct Reply {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: Vec<u8>,
    /// Structured data alongside the body for in-process callers (the MCP
    /// server): the campaign manifest. Never sent over HTTP.
    pub meta: Option<serde_json::Value>,
}

impl Reply {
    fn json(status: u16, value: &serde_json::Value) -> Self {
        Reply {
            status,
            headers: vec![
                ("content-type", "application/json; charset=utf-8".into()),
                ("cache-control", "no-store".into()),
            ],
            body: serde_json::to_vec(value).unwrap_or_default(),
            meta: None,
        }
    }
    fn error(status: u16, msg: impl std::fmt::Display) -> Self {
        Reply::json(status, &json!({ "error": msg.to_string() }))
    }
}

/// `None` when the path is not an API route — the caller serves the site.
pub fn handle(method: &str, path: &str, body: &[u8], cfg: &Config) -> Option<Reply> {
    if !path.starts_with("/api/") {
        return None;
    }
    if body.len() > MAX_BODY {
        return Some(Reply::error(413, "request body too large"));
    }
    Some(match (method, path) {
        ("GET", "/api/health") => Reply::json(
            200,
            &json!({ "ok": true, "version": env!("CARGO_PKG_VERSION") }),
        ),
        ("GET", "/api/presets") => Reply::json(200, &json!(preset::catalogue())),
        ("GET", "/api/themes") => Reply::json(200, &json!(theme::themes())),
        ("GET", "/api/brands") => Reply::json(200, &json!(nyuchi_brands::all())),
        ("POST", "/api/render") => render_one(body, cfg),
        ("POST", "/api/campaign") => render_campaign(body, cfg),
        ("POST", "/api/signature") => signature(body),
        (_, "/api/health" | "/api/presets" | "/api/themes" | "/api/brands") => {
            Reply::error(405, "use GET")
        }
        (_, "/api/render" | "/api/campaign" | "/api/signature") => Reply::error(405, "use POST"),
        _ => Reply::error(404, "no such API route"),
    })
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImageIn {
    /// Base64 PNG or JPEG (a `data:` URL prefix is accepted and stripped).
    pub data: String,
    pub crop: Option<[u32; 4]>,
    #[serde(default)]
    pub redact: Vec<[u32; 4]>,
    pub chrome: Option<String>,
    /// What the screenshot shows — required, becomes the alt text.
    pub alt: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenderIn {
    pub preset: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub mode: Mode,
    #[serde(default)]
    pub guides: bool,
    #[serde(default)]
    pub fake_or_redacted: bool,
    pub eyebrow: Option<String>,
    #[serde(default)]
    pub headline: String,
    pub sub: Option<String>,
    #[serde(default)]
    pub points: Vec<String>,
    pub cta: Option<String>,
    pub slide: Option<[u32; 2]>,
    pub composition: Option<Composition>,
    pub image: Option<ImageIn>,
}

fn default_theme() -> String {
    theme::DEFAULT_THEME.to_string()
}

fn decode_image(data: &str) -> Result<Vec<u8>, String> {
    let b64 = match data.split_once(";base64,") {
        Some((prefix, rest)) if prefix.starts_with("data:") => rest,
        _ => data,
    };
    base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|_| "image.data is not valid base64".to_string())
}

fn status_for(e: &RenderError) -> u16 {
    match e {
        RenderError::Privacy(_) => 422,
        RenderError::TooLarge { .. } => 422,
        _ => 500,
    }
}

/// Header values must be visible ASCII: percent-encode everything else.
fn header_safe(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if (b' '..=b'~').contains(&b) && b != b'%' {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn render_one(body: &[u8], cfg: &Config) -> Reply {
    let req: RenderIn = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => return Reply::error(400, format!("bad request: {e}")),
    };
    let Some(preset) = preset::get(&req.preset) else {
        return Reply::error(400, format!("unknown preset {:?}", req.preset));
    };
    let Some(theme) = theme::get(&req.theme) else {
        return Reply::error(400, format!("unknown theme {:?}", req.theme));
    };
    let mut content = Content {
        eyebrow: req.eyebrow,
        headline: req.headline,
        sub: req.sub.filter(|s| !s.trim().is_empty()),
        points: req.points,
        cta: req.cta.filter(|s| !s.trim().is_empty()),
        slide: req.slide.map(|[n, of]| (n, of)),
        composition: req.composition,
        ..Content::default()
    };
    if let Some(img) = req.image {
        if img.alt.trim().is_empty() {
            return Reply::error(400, "image.alt is required: say what the screenshot shows");
        }
        let bytes = match decode_image(&img.data) {
            Ok(b) => b,
            Err(e) => return Reply::error(400, e),
        };
        let mut source = match SourceImage::from_bytes(bytes) {
            Ok(s) => s,
            Err(e) => return Reply::error(400, e),
        };
        source.crop = img.crop;
        source.redact = img.redact;
        source.chrome = img.chrome;
        content.image = Some(source);
        content.image_alt = Some(img.alt);
    }
    let privacy = Privacy {
        fake_or_redacted: req.fake_or_redacted,
        blocked_terms: cfg.blocked_terms.clone(),
    };
    match render::render(&Request {
        preset,
        theme,
        mode: req.mode,
        content: &content,
        privacy: &privacy,
        guides: req.guides,
    }) {
        Ok(r) => Reply {
            status: 200,
            headers: vec![
                (
                    "content-type",
                    match r.format {
                        preset::Format::Png => "image/png",
                        preset::Format::Jpeg => "image/jpeg",
                    }
                    .into(),
                ),
                ("cache-control", "no-store".into()),
                (
                    "x-alt-text",
                    header_safe(&alt::describe(&content, &theme.eyebrow)),
                ),
                ("x-width", r.width.to_string()),
                ("x-height", r.height.to_string()),
            ],
            body: r.bytes,
            meta: None,
        },
        Err(e) => Reply::error(status_for(&e), e),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CampaignIn {
    pub campaign: Campaign,
    /// Base64 screenshot, when the campaign has an `image` section.
    pub image: Option<String>,
}

fn render_campaign(body: &[u8], cfg: &Config) -> Reply {
    let req: CampaignIn = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => return Reply::error(400, format!("bad request: {e}")),
    };
    if req.campaign.renders.len() > 40 {
        return Reply::error(400, "a campaign renders at most 40 images per request");
    }
    let image = match req.image.as_deref().map(decode_image).transpose() {
        Ok(i) => i,
        Err(e) => return Reply::error(400, e),
    };
    let set = match campaign::render_set(&req.campaign, image, cfg.blocked_terms.clone()) {
        Ok(s) => s,
        // Privacy refusals come back as messages from the gate; they never
        // contain the blocked term itself.
        Err(e) => return Reply::error(422, e),
    };
    let manifest: Vec<_> = set.iter().map(|(m, _)| m).collect();
    let manifest_json = serde_json::to_vec_pretty(&manifest).unwrap_or_default();
    let mut files: Vec<(&str, &[u8])> = set
        .iter()
        .map(|(m, b)| (m.file.as_str(), b.as_slice()))
        .collect();
    files.push(("manifest.json", &manifest_json));
    Reply {
        status: 200,
        headers: vec![
            ("content-type", "application/zip".into()),
            (
                "content-disposition",
                "attachment; filename=\"campaign.zip\"".into(),
            ),
            ("cache-control", "no-store".into()),
        ],
        body: crate::zip::store(&files),
        meta: serde_json::to_value(&manifest).ok(),
    }
}

fn signature(body: &[u8]) -> Reply {
    let params: nyuchi_signature::Params = match serde_json::from_slice(body) {
        Ok(p) => p,
        Err(e) => return Reply::error(400, format!("bad request: {e}")),
    };
    match nyuchi_signature::build(&params) {
        Ok(s) => Reply::json(
            200,
            &json!({ "html": s.html, "text": s.text, "brand": s.brand.key }),
        ),
        Err(e) => Reply::error(400, e),
    }
}
