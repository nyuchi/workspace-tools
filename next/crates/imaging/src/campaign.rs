//! Campaigns: a whole set of images from one input.
//!
//! A campaign file (TOML) names the shared content once — headline,
//! eyebrow, CTA, the screenshot with its crop and redaction boxes — and then
//! lists renders, each a preset with optional per-render overrides (a shorter
//! headline for the small tile, `image = false` for a text slide, a carousel
//! slide number). Rendering it writes every file plus `manifest.json`: size,
//! format, bytes and alt text per image, ready to hand to a scheduler.
//!
//! See `samples/toddle-launch/campaign.toml` for a complete example.

use crate::layout::{Composition, Content, SourceImage};
use crate::preset;
use crate::privacy::Privacy;
use crate::render::{self, Request};
use crate::theme::{self, Mode};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Campaign {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub mode: Mode,
    /// Output folder, relative to the campaign file.
    #[serde(default = "default_out")]
    pub out: String,
    pub privacy: PrivacySection,
    pub content: ContentSection,
    pub image: Option<ImageSection>,
    #[serde(rename = "render")]
    pub renders: Vec<RenderSection>,
}

fn default_theme() -> String {
    theme::DEFAULT_THEME.to_string()
}
fn default_out() -> String {
    ".".to_string()
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrivacySection {
    /// The screenshot holds only fake or already-redacted data. Required
    /// (true) whenever `[image]` is present.
    pub fake_or_redacted: bool,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ContentSection {
    pub eyebrow: Option<String>,
    #[serde(default)]
    pub headline: String,
    pub sub: Option<String>,
    #[serde(default)]
    pub points: Vec<String>,
    pub cta: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImageSection {
    /// Path relative to the campaign file (the CLI). A Worker request sends
    /// the bytes instead and leaves this empty.
    #[serde(default)]
    pub src: String,
    pub crop: Option<[u32; 4]>,
    #[serde(default)]
    pub redact: Vec<[u32; 4]>,
    pub chrome: Option<String>,
    /// What the screenshot shows — becomes part of every image's alt text.
    pub alt: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenderSection {
    pub preset: String,
    /// Output file name; `<preset>.<ext>` when omitted.
    pub file: Option<String>,
    pub mode: Option<Mode>,
    #[serde(default)]
    pub guides: bool,
    /// `false` renders this one without the screenshot.
    pub image: Option<bool>,
    pub crop: Option<[u32; 4]>,
    pub composition: Option<Composition>,
    pub slide: Option<[u32; 2]>,
    pub eyebrow: Option<String>,
    pub headline: Option<String>,
    pub sub: Option<String>,
    pub points: Option<Vec<String>>,
    pub cta: Option<String>,
    /// `false` drops the shared CTA for this render.
    pub show_cta: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ManifestEntry {
    pub file: String,
    pub preset: String,
    pub platform: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub bytes: usize,
    pub safe_area: [u32; 4],
    pub guides: bool,
    pub alt: String,
}

pub fn parse(src: &str) -> Result<Campaign, String> {
    toml::from_str(src).map_err(|e| e.to_string())
}

/// Render every entry. `blocked_terms` come from outside the campaign file.
pub fn run(path: &Path, blocked_terms: Vec<String>) -> Result<Vec<ManifestEntry>, String> {
    let src = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let campaign = parse(&src).map_err(|e| format!("{}: {e}", path.display()))?;
    let base = path.parent().unwrap_or(Path::new("."));
    let out_dir: PathBuf = base.join(&campaign.out);
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let image = match &campaign.image {
        Some(sec) => {
            let file = base.join(&sec.src);
            Some(std::fs::read(&file).map_err(|e| format!("{}: {e}", file.display()))?)
        }
        None => None,
    };
    let set = render_set(&campaign, image, blocked_terms)?;
    let mut manifest = Vec::new();
    for (entry, bytes) in set {
        std::fs::write(out_dir.join(&entry.file), &bytes).map_err(|e| e.to_string())?;
        manifest.push(entry);
    }
    let json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    std::fs::write(out_dir.join("manifest.json"), json + "\n").map_err(|e| e.to_string())?;
    Ok(manifest)
}

/// Render every entry in memory: the same pipeline as [`run`], with no
/// filesystem — what a Worker calls. `image` is the screenshot's bytes when
/// the campaign has an `[image]` section (its `src` is then ignored).
pub fn render_set(
    campaign: &Campaign,
    image: Option<Vec<u8>>,
    blocked_terms: Vec<String>,
) -> Result<Vec<(ManifestEntry, Vec<u8>)>, String> {
    let theme =
        theme::get(&campaign.theme).ok_or_else(|| format!("unknown theme {:?}", campaign.theme))?;
    let image = match (&campaign.image, image) {
        (Some(sec), Some(data)) => {
            let mut img = SourceImage::from_bytes(data)?;
            img.crop = sec.crop;
            img.redact = sec.redact.clone();
            img.chrome = sec.chrome.clone();
            Some(img)
        }
        (Some(_), None) => {
            return Err("the campaign has an [image] section but no image was given".into());
        }
        (None, _) => None,
    };
    let privacy = Privacy {
        fake_or_redacted: campaign.privacy.fake_or_redacted,
        blocked_terms,
    };

    let mut out = Vec::new();
    for r in &campaign.renders {
        let preset =
            preset::get(&r.preset).ok_or_else(|| format!("unknown preset {:?}", r.preset))?;
        let content = content_for(campaign, r, image.as_ref());
        let mode = r.mode.unwrap_or(campaign.mode);
        let rendered = render::render(&Request {
            preset,
            theme,
            mode,
            content: &content,
            privacy: &privacy,
            guides: r.guides,
        })
        .map_err(|e| format!("{}: {e}", r.preset))?;
        let file = r
            .file
            .clone()
            .unwrap_or_else(|| format!("{}.{}", preset.id, preset.format.extension()));
        if file.contains('/') || file.contains('\\') || file.starts_with('.') {
            return Err(format!(
                "{}: file name {file:?} must be a plain name",
                r.preset
            ));
        }
        let entry = ManifestEntry {
            file,
            preset: preset.id.clone(),
            platform: preset.platform.clone(),
            width: rendered.width,
            height: rendered.height,
            format: preset.format.extension().to_string(),
            bytes: rendered.bytes.len(),
            safe_area: preset.safe,
            guides: r.guides,
            alt: crate::alt::describe(&content, &theme.eyebrow),
        };
        out.push((entry, rendered.bytes));
    }
    Ok(out)
}

/// Shared content with one render's overrides applied.
pub fn content_for(c: &Campaign, r: &RenderSection, image: Option<&SourceImage>) -> Content {
    let base = &c.content;
    let use_image = r.image.unwrap_or(true);
    let image = image.filter(|_| use_image).map(|img| {
        let mut img = img.clone();
        if r.crop.is_some() {
            img.crop = r.crop;
        }
        img
    });
    let cta = if r.show_cta == Some(false) {
        None
    } else {
        r.cta.clone().or_else(|| base.cta.clone())
    };
    Content {
        eyebrow: r.eyebrow.clone().or_else(|| base.eyebrow.clone()),
        headline: r.headline.clone().unwrap_or_else(|| base.headline.clone()),
        sub: r
            .sub
            .clone()
            .or_else(|| base.sub.clone())
            .filter(|s| !s.trim().is_empty()),
        points: r.points.clone().unwrap_or_else(|| base.points.clone()),
        cta,
        image_alt: image.as_ref().and(c.image.as_ref().map(|i| i.alt.clone())),
        image,
        slide: r.slide.map(|[n, of]| (n, of)),
        composition: r.composition,
    }
}
