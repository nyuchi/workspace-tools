//! SVG → pixels → PNG/JPEG, with resvg.
//!
//! resvg is pure Rust (tiny-skia underneath, no system libraries), so this
//! module compiles unchanged to `wasm32-unknown-unknown` for a Worker. Fonts
//! are the embedded faces from [`crate::text`]; system fonts are never
//! loaded, so a render is identical on every machine.

use crate::layout::{self, Content, Layout};
use crate::preset::{Format, Preset};
use crate::privacy::{Privacy, PrivacyError};
use crate::svg::{self, SvgOptions};
use crate::theme::{Mode, Theme};
use resvg::{tiny_skia, usvg};
use std::fmt;
use std::sync::{Arc, OnceLock};

#[derive(Debug)]
pub enum RenderError {
    Privacy(PrivacyError),
    Svg(String),
    Encode(String),
    TooLarge { bytes: usize, max: u64 },
}

impl fmt::Display for RenderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RenderError::Privacy(e) => write!(f, "{e}"),
            RenderError::Svg(e) => write!(f, "could not build the image: {e}"),
            RenderError::Encode(e) => write!(f, "could not encode the image: {e}"),
            RenderError::TooLarge { bytes, max } => {
                write!(
                    f,
                    "encoded image is {bytes} bytes, over the platform's {max}-byte limit"
                )
            }
        }
    }
}

impl std::error::Error for RenderError {}

impl From<PrivacyError> for RenderError {
    fn from(e: PrivacyError) -> Self {
        RenderError::Privacy(e)
    }
}

pub struct Request<'a> {
    pub preset: &'a Preset,
    pub theme: &'a Theme,
    pub mode: Mode,
    pub content: &'a Content,
    pub privacy: &'a Privacy,
    pub guides: bool,
}

pub struct Rendered {
    pub bytes: Vec<u8>,
    pub format: Format,
    pub width: u32,
    pub height: u32,
    pub layout: Layout,
    pub svg: String,
}

fn fontdb() -> Arc<usvg::fontdb::Database> {
    static DB: OnceLock<Arc<usvg::fontdb::Database>> = OnceLock::new();
    DB.get_or_init(|| {
        let mut db = usvg::fontdb::Database::new();
        for data in crate::text::font_data() {
            db.load_font_data(data.to_vec());
        }
        db.set_serif_family("Noto Serif");
        db.set_sans_serif_family("Noto Sans");
        db.set_monospace_family("JetBrains Mono");
        Arc::new(db)
    })
    .clone()
}

/// Lay out and build the SVG, after the privacy gate. No rasterising.
pub fn build_svg(req: &Request) -> Result<(Layout, String), RenderError> {
    req.privacy.check(req.content)?;
    let layout = layout::layout(req.preset, req.content, &req.theme.eyebrow);
    let svg = svg::to_svg(
        &layout,
        req.content,
        req.theme,
        &SvgOptions {
            mode: req.mode,
            guides: req.guides,
        },
    );
    Ok((layout, svg))
}

/// The full pipeline: privacy gate, layout, SVG, raster, encode, size check.
pub fn render(req: &Request) -> Result<Rendered, RenderError> {
    let (layout, svg) = build_svg(req)?;
    let (w, h) = (req.preset.width, req.preset.height);

    let opts = usvg::Options {
        fontdb: fontdb(),
        ..usvg::Options::default()
    };
    let tree = usvg::Tree::from_str(&svg, &opts).map_err(|e| RenderError::Svg(e.to_string()))?;
    let mut pixmap =
        tiny_skia::Pixmap::new(w, h).ok_or_else(|| RenderError::Svg("empty canvas".into()))?;
    resvg::render(
        &tree,
        tiny_skia::Transform::identity(),
        &mut pixmap.as_mut(),
    );

    let bytes = match req.preset.format {
        Format::Jpeg => encode_jpeg(&pixmap)?,
        Format::Png => encode_png(&pixmap, req.preset.alpha)?,
    };
    if bytes.len() as u64 > req.preset.max_bytes {
        return Err(RenderError::TooLarge {
            bytes: bytes.len(),
            max: req.preset.max_bytes,
        });
    }
    Ok(Rendered {
        bytes,
        format: req.preset.format,
        width: w,
        height: h,
        layout,
        svg,
    })
}

/// Drop the alpha channel. The canvas is painted opaque edge to edge, so
/// premultiplied and straight RGB are the same here.
fn rgb(pixmap: &tiny_skia::Pixmap) -> Vec<u8> {
    pixmap
        .data()
        .as_chunks::<4>()
        .0
        .iter()
        .flat_map(|[r, g, b, _]| [*r, *g, *b])
        .collect()
}

/// JPEG cannot carry alpha at all — the Chrome Web Store rejects alpha, and
/// this makes that impossible rather than remembered.
fn encode_jpeg(pixmap: &tiny_skia::Pixmap) -> Result<Vec<u8>, RenderError> {
    let mut out = Vec::new();
    let enc = jpeg_encoder::Encoder::new(&mut out, 92);
    enc.encode(
        &rgb(pixmap),
        pixmap.width() as u16,
        pixmap.height() as u16,
        jpeg_encoder::ColorType::Rgb,
    )
    .map_err(|e| RenderError::Encode(e.to_string()))?;
    Ok(out)
}

/// PNG, as 24-bit RGB unless the preset allows alpha.
fn encode_png(pixmap: &tiny_skia::Pixmap, alpha: bool) -> Result<Vec<u8>, RenderError> {
    if alpha {
        return pixmap
            .encode_png()
            .map_err(|e| RenderError::Encode(e.to_string()));
    }
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, pixmap.width(), pixmap.height());
        enc.set_color(png::ColorType::Rgb);
        enc.set_depth(png::BitDepth::Eight);
        enc.set_compression(png::Compression::High);
        let mut writer = enc
            .write_header()
            .map_err(|e| RenderError::Encode(e.to_string()))?;
        writer
            .write_image_data(&rgb(pixmap))
            .map_err(|e| RenderError::Encode(e.to_string()))?;
    }
    Ok(out)
}
