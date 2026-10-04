//! Themes, with colours from Mzizi.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub const DEFAULT_THEME: &str = "toddle-launch";

/// The seven minerals in identity-strip order.
pub const STRIP_ORDER: [&str; 7] = [
    "cobalt",
    "tanzanite",
    "malachite",
    "gold",
    "terracotta",
    "sodalite",
    "copper",
];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    Light,
    Dark,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Surface {
    pub bg: String,
    pub fg: String,
    pub muted: String,
    pub card: String,
    pub edge: String,
    pub skeleton: String,
    pub mesh_opacity: f32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub eyebrow: String,
    pub byline: String,
    pub mark: Vec<String>,
    pub mesh: Vec<String>,
    pub accent: String,
    /// The brand's official logo, by id in [`crate::logo`]. When set, it is
    /// drawn where the three-column product mark would go — the file as
    /// published, never redrawn.
    #[serde(default)]
    pub logo: Option<String>,
    pub light: Surface,
    pub dark: Surface,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Mineral {
    pub light: String,
    pub dark: String,
}

#[derive(Deserialize)]
struct File {
    theme: Vec<Theme>,
    minerals: BTreeMap<String, Mineral>,
}

fn file() -> &'static File {
    static FILE: OnceLock<File> = OnceLock::new();
    FILE.get_or_init(|| {
        toml::from_str(include_str!("../data/themes.toml")).expect("data/themes.toml is valid")
    })
}

pub fn themes() -> &'static [Theme] {
    &file().theme
}

pub fn get(id: &str) -> Option<&'static Theme> {
    themes().iter().find(|t| t.id == id)
}

pub fn mineral(name: &str) -> Option<&'static Mineral> {
    file().minerals.get(name)
}

impl Theme {
    pub fn surface(&self, mode: Mode) -> &Surface {
        match mode {
            Mode::Light => &self.light,
            Mode::Dark => &self.dark,
        }
    }
    /// A mineral's vivid (dark-surface) hex — the one the strip, the mark
    /// and the mesh use on either surface.
    pub fn vivid(&self, name: &str) -> &'static str {
        mineral(name).map(|m| m.dark.as_str()).unwrap_or("#00B0FF")
    }
    /// A mineral's hex readable as text or a dot on this surface.
    pub fn ink(&self, name: &str, mode: Mode) -> &'static str {
        let m = mineral(name);
        match mode {
            Mode::Light => m.map(|m| m.light.as_str()).unwrap_or("#0047AB"),
            Mode::Dark => m.map(|m| m.dark.as_str()).unwrap_or("#00B0FF"),
        }
    }
}
