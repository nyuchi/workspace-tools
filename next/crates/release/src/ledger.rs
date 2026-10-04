//! The ledger: `releases/<slug>/ledger.json`, what has been drafted.
//!
//! It is what makes a re-run idempotent. Publish skips a Sanity draft or a
//! Postiz channel the ledger already has, so running twice never makes a
//! second draft; the Sanity id is also fixed per release
//! ([`crate::document_id`]) and written with `createIfNotExists`, so even a
//! lost ledger cannot duplicate the post or overwrite the owner's edits.
//! Both publish paths — headless and through the MCP tools — write it, and
//! it is committed with the release.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Ledger {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sanity: Option<SanityEntry>,
    /// Channel key → the Postiz draft.
    #[serde(default)]
    pub postiz: BTreeMap<String, PostizEntry>,
    /// The review comment on the tracking issue.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SanityEntry {
    pub project: String,
    pub dataset: String,
    pub document_id: String,
    /// Image asset ids by image name (`og`, `square`, `story`).
    #[serde(default)]
    pub assets: BTreeMap<String, String>,
    /// Public CDN URLs of those assets (used to hand images to Postiz).
    #[serde(default)]
    pub asset_urls: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PostizEntry {
    pub post_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

pub fn load(path: &Path) -> Result<Ledger, String> {
    match std::fs::read_to_string(path) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| format!("{}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Ledger::default()),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

pub fn save(path: &Path, l: &Ledger) -> Result<(), String> {
    let json = serde_json::to_string_pretty(l).map_err(|e| e.to_string())?;
    std::fs::write(path, json + "\n").map_err(|e| format!("{}: {e}", path.display()))
}

impl Ledger {
    /// Channels in `pack` that have no draft yet.
    pub fn pending<'a>(&self, pack: &'a crate::pack::Pack) -> Vec<&'a crate::pack::PostizDraft> {
        pack.posts
            .iter()
            .filter(|p| !self.postiz.contains_key(&p.channel))
            .collect()
    }
}
