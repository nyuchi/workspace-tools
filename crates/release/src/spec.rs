//! The release file: `releases/<slug>/release.toml`.
//!
//! Everything the pipeline publishes as a draft is in this file (and the
//! Markdown body beside it), so a release's marketing is reviewed like code.

use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Release {
    /// Stable id: the idempotency key. Never change it after a run.
    pub slug: String,
    /// Brand key from `crates/brands/data/brands.toml`; picks the Sanity
    /// target, the image theme and the logo.
    pub brand: String,
    /// The tracking issue the review comment goes on, `owner/repo#n`.
    pub tracking_issue: String,
    /// Production URLs that prove the release is live. The build refuses if
    /// any of them does not answer 200: only what is live is marketed.
    pub live: Vec<String>,
    /// Where the facts came from (repos, tags, PRs, issues), for review.
    #[serde(default)]
    pub sources: Vec<String>,
    pub post: Post,
    pub images: Images,
    #[serde(rename = "social", default)]
    pub socials: Vec<Social>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Post {
    pub title: String,
    /// One or two sentences for the index and social cards (≤ 280).
    pub description: String,
    /// The post's URL slug; derived from the title when absent.
    pub slug: Option<String>,
    /// `YYYY-MM-DD`: the release date, used as the draft's publish date.
    pub date: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// Markdown body, relative to the release file.
    pub body: String,
    /// Optional studio fields, passed through when the schema has them.
    pub audience: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct Images {
    pub eyebrow: Option<String>,
    pub headline: String,
    pub sub: Option<String>,
    #[serde(default)]
    pub points: Vec<String>,
    pub cta: Option<String>,
    #[serde(default)]
    pub dark: bool,
    pub og: Option<Override>,
    pub square: Option<Override>,
    pub story: Option<Override>,
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct Override {
    pub headline: Option<String>,
    pub sub: Option<String>,
    pub points: Option<Vec<String>>,
    pub dark: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Social {
    /// Channel key from `releases/channels.toml`.
    pub channel: String,
    /// Plain text; each line becomes a paragraph.
    pub text: String,
    /// Which rendered image goes with it: `og`, `square` or `story`.
    #[serde(default = "default_image")]
    pub image: String,
}

fn default_image() -> String {
    "square".into()
}

pub const IMAGES: [&str; 3] = ["og", "square", "story"];

/// A release file, loaded with its body and its folder.
pub struct Loaded {
    pub release: Release,
    pub body: String,
    pub dir: PathBuf,
}

pub fn parse(src: &str) -> Result<Release, String> {
    toml::from_str(src).map_err(|e| e.to_string())
}

pub fn load(path: &Path) -> Result<Loaded, String> {
    let src = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let release = parse(&src).map_err(|e| format!("{}: {e}", path.display()))?;
    let dir = path.parent().unwrap_or(Path::new(".")).to_path_buf();
    let body_path = dir.join(&release.post.body);
    let body =
        std::fs::read_to_string(&body_path).map_err(|e| format!("{}: {e}", body_path.display()))?;
    Ok(Loaded { release, body, dir })
}

impl Release {
    pub fn post_slug(&self) -> String {
        self.post
            .slug
            .clone()
            .unwrap_or_else(|| crate::slugify(&self.post.title))
    }
}
