//! Fonts, text measurement and wrapping.
//!
//! SVG has no line wrapping, so the layout wraps text itself, measuring with
//! the same font files resvg renders with — the width a line is measured at
//! is the width it is drawn at. The four faces are embedded so the renderer
//! is self-contained natively and in wasm.

use ttf_parser::Face;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub enum Font {
    /// Noto Serif 700 — headlines.
    Serif,
    /// Noto Sans 400 — body, eyebrows.
    Sans,
    /// Noto Sans 600 — bylines, CTAs, pills.
    SansBold,
    /// JetBrains Mono 400 — labels, slide numbers, guides.
    Mono,
}

impl Font {
    pub fn family(self) -> &'static str {
        match self {
            Font::Serif => "Noto Serif",
            Font::Sans | Font::SansBold => "Noto Sans",
            Font::Mono => "JetBrains Mono",
        }
    }
    pub fn weight(self) -> u16 {
        match self {
            Font::Serif => 700,
            Font::SansBold => 600,
            Font::Sans | Font::Mono => 400,
        }
    }
    fn data(self) -> &'static [u8] {
        match self {
            Font::Serif => SERIF,
            Font::Sans => SANS,
            Font::SansBold => SANS_BOLD,
            Font::Mono => MONO,
        }
    }
}

static SERIF: &[u8] = include_bytes!("../../../assets/fonts/NotoSerif-Bold.ttf");
static SANS: &[u8] = include_bytes!("../../../assets/fonts/NotoSans-Regular.ttf");
static SANS_BOLD: &[u8] = include_bytes!("../../../assets/fonts/NotoSans-SemiBold.ttf");
static MONO: &[u8] = include_bytes!("../../../assets/fonts/JetBrainsMono-Regular.ttf");

/// Every embedded face, for loading into resvg's font database.
pub fn font_data() -> [&'static [u8]; 4] {
    [SERIF, SANS, SANS_BOLD, MONO]
}

/// Width of `text` in pixels at `size`, with `tracking` extra space per
/// character in em (SVG `letter-spacing`).
pub fn measure(font: Font, text: &str, size: f32, tracking: f32) -> f32 {
    let face = Face::parse(font.data(), 0).expect("embedded font parses");
    let upem = face.units_per_em() as f32;
    let mut width = 0.0;
    let mut count = 0;
    for ch in text.chars() {
        let advance = face
            .glyph_index(ch)
            .and_then(|g| face.glyph_hor_advance(g))
            .unwrap_or((upem * 0.5) as u16) as f32;
        width += advance / upem * size;
        count += 1;
    }
    width + tracking * size * count as f32
}

/// Greedy word wrap. A single word wider than `max_width` gets a line of its
/// own rather than being split mid-word.
pub fn wrap(font: Font, text: &str, size: f32, tracking: f32, max_width: f32) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            let candidate = if line.is_empty() {
                word.to_string()
            } else {
                format!("{line} {word}")
            };
            if !line.is_empty() && measure(font, &candidate, size, tracking) > max_width {
                lines.push(std::mem::take(&mut line));
                line = word.to_string();
            } else {
                line = candidate;
            }
        }
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines
}

/// The largest size from `max` down to `min` at which `text` wraps into at
/// most `max_lines` lines no wider than `max_width`. Falls back to `min`,
/// truncated to `max_lines` with an ellipsis, so a render never overflows.
pub fn fit(
    font: Font,
    text: &str,
    max: f32,
    min: f32,
    tracking: f32,
    max_width: f32,
    max_lines: usize,
) -> (f32, Vec<String>) {
    let mut size = max;
    loop {
        let lines = wrap(font, text, size, tracking, max_width);
        let widest = lines
            .iter()
            .map(|l| measure(font, l, size, tracking))
            .fold(0.0, f32::max);
        if lines.len() <= max_lines && widest <= max_width {
            return (size, lines);
        }
        if size <= min {
            let mut lines = lines;
            lines.truncate(max_lines);
            if let Some(last) = lines.last_mut() {
                while !last.is_empty()
                    && measure(font, &format!("{last}…"), size, tracking) > max_width
                {
                    last.pop();
                }
                last.push('…');
            }
            return (size, lines);
        }
        size = (size * 0.94).max(min);
    }
}
