//! nyuchi-imaging: the preset catalogue and renderer behind nyuchi-tools
//! images — Chrome Web Store screenshots and tiles, social cards, 9:16
//! stories with platform safe areas, store product images and icons.
//!
//! The pipeline is:
//!
//! 1. [`preset`] — every output size is data (`data/presets.toml`), with the
//!    platform's safe-area insets and upload limits.
//! 2. [`theme`] — colours from Mzizi (`data/themes.toml`); `toddle-launch` is
//!    the default look.
//! 3. [`privacy`] — the gate every render passes: an image must be attested
//!    as fake or redacted, no text may contain a blocked term (a school name,
//!    say), and redaction boxes are painted over the screenshot before it is
//!    composed.
//! 4. [`layout`] — pure geometry: where every block goes, kept inside the
//!    preset's safe area. Tests assert on this, not on pixels.
//! 5. [`svg`] — the layout as SVG; [`render`] rasterises it with resvg (pure
//!    Rust, so the same code runs natively and as wasm in a Worker) and
//!    encodes PNG or JPEG.
//! 6. [`campaign`] — a whole set of presets rendered from one input, with a
//!    manifest carrying each image's alt text ([`alt`]).

pub mod alt;
pub mod campaign;
pub mod layout;
pub mod preset;
pub mod privacy;
pub mod render;
pub mod svg;
pub mod text;
pub mod theme;

/// An axis-aligned rectangle in output pixels.
#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Rect {
    pub fn new(x: f32, y: f32, w: f32, h: f32) -> Self {
        Self { x, y, w, h }
    }
    pub fn right(&self) -> f32 {
        self.x + self.w
    }
    pub fn bottom(&self) -> f32 {
        self.y + self.h
    }
    /// True when `other` lies wholly inside `self`, allowing half a pixel
    /// for rounding.
    pub fn contains(&self, other: &Rect) -> bool {
        const E: f32 = 0.5;
        other.x >= self.x - E
            && other.y >= self.y - E
            && other.right() <= self.right() + E
            && other.bottom() <= self.bottom() + E
    }
}
