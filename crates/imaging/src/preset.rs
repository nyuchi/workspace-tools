//! The preset catalogue: every output size as data.

use crate::Rect;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Group {
    Social,
    Web,
    Store,
    Email,
    Icon,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Png,
    Jpeg,
}

impl Format {
    pub fn extension(self) -> &'static str {
        match self {
            Format::Png => "png",
            Format::Jpeg => "jpg",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub group: Group,
    pub width: u32,
    pub height: u32,
    pub format: Format,
    /// `[top, right, bottom, left]` insets covered by platform UI.
    pub safe: [u32; 4],
    pub max_bytes: u64,
    pub alpha: bool,
    #[serde(default)]
    pub legacy: Option<String>,
}

impl Preset {
    /// The area platform UI leaves clear, in output pixels.
    pub fn safe_rect(&self) -> Rect {
        let [t, r, b, l] = self.safe.map(|v| v as f32);
        Rect::new(l, t, self.width as f32 - l - r, self.height as f32 - t - b)
    }
    pub fn aspect(&self) -> f32 {
        self.width as f32 / self.height as f32
    }
    pub fn has_safe_area(&self) -> bool {
        self.safe.iter().any(|v| *v > 0)
    }
}

#[derive(Deserialize)]
struct File {
    preset: Vec<Preset>,
}

/// The catalogue, parsed once from the embedded `data/presets.toml`.
pub fn catalogue() -> &'static [Preset] {
    static CATALOGUE: OnceLock<Vec<Preset>> = OnceLock::new();
    CATALOGUE.get_or_init(|| {
        let file: File = toml::from_str(include_str!("../data/presets.toml"))
            .expect("data/presets.toml is valid");
        file.preset
    })
}

pub fn get(id: &str) -> Option<&'static Preset> {
    catalogue().iter().find(|p| p.id == id)
}
