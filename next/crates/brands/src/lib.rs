//! The one Bundu-ecosystem brand list (`data/brands.toml`).
//!
//! Every surface — signatures, images, the site, the MCP — reads brands from
//! here. Lookups are by key (or a legacy alias) and by email domain.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Foundation,
    Pillar,
    Division,
    Initiative,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Brand {
    pub key: String,
    pub kind: Kind,
    #[serde(default)]
    pub parent: Option<String>,
    pub name: String,
    #[serde(default)]
    pub short_name: Option<String>,
    #[serde(default)]
    pub tagline: Option<String>,
    pub url: String,
    pub domains: Vec<String>,
    pub mineral: String,
    pub socials: BTreeMap<String, String>,
    #[serde(default)]
    pub aliases: Vec<String>,
}

impl Brand {
    /// The bare host of `url`, for display (`nyuchi.com`).
    pub fn website(&self) -> &str {
        self.url
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/')
    }
}

#[derive(Deserialize)]
struct File {
    brand: Vec<Brand>,
}

/// Every brand, in file order (parent first).
pub fn all() -> &'static [Brand] {
    static ALL: OnceLock<Vec<Brand>> = OnceLock::new();
    ALL.get_or_init(|| {
        let file: File =
            toml::from_str(include_str!("../data/brands.toml")).expect("data/brands.toml is valid");
        file.brand
    })
}

/// A brand by key or legacy alias.
pub fn get(key: &str) -> Option<&'static Brand> {
    all()
        .iter()
        .find(|b| b.key == key || b.aliases.iter().any(|a| a == key))
}

/// The brand an email address signs as, by its domain. `None` for a domain
/// no brand claims.
pub fn for_email(email: &str) -> Option<&'static Brand> {
    let domain = email.rsplit_once('@')?.1.trim().to_ascii_lowercase();
    all().iter().find(|b| b.domains.contains(&domain))
}

/// The raw TOML, for serving to clients that need the whole list.
pub fn source() -> &'static str {
    include_str!("../data/brands.toml")
}
