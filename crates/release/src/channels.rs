//! The channel map: `releases/channels.toml`.
//!
//! Per brand, the Sanity project, dataset and author a release post is
//! drafted in; and every connected Postiz channel with its platform, its
//! length limit and the settings a draft needs. Connecting a channel in
//! Postiz is a data change here.

use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Channels {
    pub brand: BTreeMap<String, BrandTarget>,
    #[serde(rename = "channel")]
    pub channels: Vec<Channel>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BrandTarget {
    pub sanity: SanityTarget,
    /// The image theme in `nyuchi-imaging` (carries the mineral and logo).
    pub theme: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SanityTarget {
    pub project: String,
    pub dataset: String,
    /// The post document type.
    #[serde(default = "default_type")]
    pub doc_type: String,
    /// Author document id the draft is credited to.
    pub author: String,
    /// The studio's URL for this dataset (for the review links).
    pub studio: String,
    /// Where a published post lives, for the review comment.
    pub public_prefix: String,
    /// Whether the schema has an `audience` field.
    #[serde(default)]
    pub audience: bool,
}

fn default_type() -> String {
    "post".into()
}

#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Channel {
    pub key: String,
    /// The account's display name in Postiz.
    pub name: String,
    /// Postiz platform identifier (`x`, `linkedin-page`, `facebook`, `instagram`…).
    pub platform: String,
    /// The Postiz integration id.
    pub integration: String,
    /// Maximum post length in characters, from Postiz's integration schema.
    pub max: usize,
    /// The platform needs an image on every post.
    #[serde(default)]
    pub needs_image: bool,
    /// Settings sent with every draft (`__type` is added from `platform`).
    #[serde(default)]
    pub settings: toml::Table,
}

pub fn parse(src: &str) -> Result<Channels, String> {
    let c: Channels = toml::from_str(src).map_err(|e| e.to_string())?;
    let mut seen = std::collections::BTreeSet::new();
    for ch in &c.channels {
        if !seen.insert(ch.key.as_str()) {
            return Err(format!("channel {:?} is listed twice", ch.key));
        }
    }
    Ok(c)
}

pub fn load(path: &Path) -> Result<Channels, String> {
    let src = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    parse(&src).map_err(|e| format!("{}: {e}", path.display()))
}

impl Channels {
    pub fn get(&self, key: &str) -> Option<&Channel> {
        self.channels.iter().find(|c| c.key == key)
    }
}
