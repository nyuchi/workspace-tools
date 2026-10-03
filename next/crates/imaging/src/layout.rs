//! Layout: pure geometry, no drawing.
//!
//! One template family — the Toddle launch frame — laid out five ways
//! depending on the canvas and the content:
//!
//! - `Top`: landscape canvas, landscape screenshot. Headline across the
//!   top, the screenshot card centred below (the CWS screenshot look).
//! - `Side`: landscape canvas with a tall screenshot, or a very wide canvas.
//!   Headline on the left, the card on the right.
//! - `Stack`: portrait or square canvas (story, reel cover, 4:5, 1:1).
//!   Headline at the top of the safe area, the card and any points in the
//!   middle, a CTA pill at the bottom of the safe area. Without a screenshot
//!   it is a text slide (carousels), signed with the product mark.
//! - `Tile`: landscape canvas, no screenshot. Byline, title, sub and the
//!   three-column product mark (the CWS promo tiles, email header).
//! - `Icon`: the mark alone (app icons, favicons).
//!
//! Every size is derived from the canvas, so one layout serves 440x280 and
//! 2048x2048 alike. Text and cards are kept inside the preset's safe area;
//! only the background and the identity strip bleed to the edges.

use crate::Rect;
use crate::preset::{Group, Preset};
use crate::text::{self, Font};
use serde::{Deserialize, Serialize};

/// A screenshot to set in the frame.
#[derive(Clone, Debug, Default)]
pub struct SourceImage {
    pub data: Vec<u8>,
    pub mime: String,
    pub width: u32,
    pub height: u32,
    /// `[x, y, w, h]` in the image's own pixels.
    pub crop: Option<[u32; 4]>,
    /// `[x, y, w, h]` boxes, in the image's own pixels, painted over as
    /// skeleton bars before the image is composed.
    pub redact: Vec<[u32; 4]>,
    /// Draw a browser frame round the card, with this text in its address
    /// bar (e.g. `learning.nyuchi.com`). `None` for a plain card.
    pub chrome: Option<String>,
}

impl SourceImage {
    /// Read a PNG or JPEG, probing its dimensions from the header.
    pub fn from_bytes(data: Vec<u8>) -> Result<Self, String> {
        let mime = match imagesize::image_type(&data).map_err(|e| e.to_string())? {
            imagesize::ImageType::Png => "image/png",
            imagesize::ImageType::Jpeg => "image/jpeg",
            other => return Err(format!("unsupported image type {other:?}: use PNG or JPEG")),
        };
        let size = imagesize::blob_size(&data).map_err(|e| e.to_string())?;
        Ok(Self {
            data,
            mime: mime.to_string(),
            width: size.width as u32,
            height: size.height as u32,
            ..Self::default()
        })
    }

    /// The crop, clamped to the image.
    pub fn crop_box(&self) -> [f32; 4] {
        let [x, y, w, h] = self.crop.unwrap_or([0, 0, self.width, self.height]);
        let x = x.min(self.width.saturating_sub(1));
        let y = y.min(self.height.saturating_sub(1));
        let w = w.min(self.width - x).max(1);
        let h = h.min(self.height - y).max(1);
        [x as f32, y as f32, w as f32, h as f32]
    }
}

/// What goes on the image.
#[derive(Clone, Debug, Default)]
pub struct Content {
    /// Small line above the headline; the theme's eyebrow when `None`.
    pub eyebrow: Option<String>,
    pub headline: String,
    pub sub: Option<String>,
    /// Short feature lines, shown with mineral dots (Stack only).
    pub points: Vec<String>,
    /// Call to action, e.g. a URL (Stack: a pill; Top: top right).
    pub cta: Option<String>,
    pub image: Option<SourceImage>,
    /// What the screenshot shows, for alt text. Required with an image.
    pub image_alt: Option<String>,
    /// `(n, of)` for a carousel slide.
    pub slide: Option<(u32, u32)>,
    /// Force a composition instead of choosing from the canvas.
    pub composition: Option<Composition>,
}

impl Content {
    /// Every piece of text that can reach the image or its alt text, for the
    /// privacy gate.
    pub fn texts(&self) -> Vec<(&'static str, &str)> {
        let mut out = vec![("headline", self.headline.as_str())];
        if let Some(t) = &self.eyebrow {
            out.push(("eyebrow", t));
        }
        if let Some(t) = &self.sub {
            out.push(("sub", t));
        }
        for p in &self.points {
            out.push(("points", p));
        }
        if let Some(t) = &self.cta {
            out.push(("cta", t));
        }
        if let Some(t) = &self.image_alt {
            out.push(("image_alt", t));
        }
        if let Some(t) = self.image.as_ref().and_then(|i| i.chrome.as_deref()) {
            out.push(("chrome", t));
        }
        out
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Composition {
    Top,
    Side,
    Stack,
    Tile,
    Icon,
}

/// Which colour a text block takes from the surface.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Role {
    Fg,
    Muted,
    /// Text on an `Fg`-filled pill.
    OnFg,
}

#[derive(Clone, Debug, Serialize)]
pub struct TextBlock {
    pub font: Font,
    pub size: f32,
    /// Letter-spacing in em.
    pub tracking: f32,
    pub line_height: f32,
    /// Left edge (or right edge when `align_end`).
    pub x: f32,
    /// Top of the first line box.
    pub y: f32,
    pub lines: Vec<String>,
    pub role: Role,
    pub align_end: bool,
}

impl TextBlock {
    pub fn width(&self) -> f32 {
        self.lines
            .iter()
            .map(|l| text::measure(self.font, l, self.size, self.tracking))
            .fold(0.0, f32::max)
    }
    pub fn height(&self) -> f32 {
        self.lines.len() as f32 * self.line_height
    }
    pub fn bbox(&self) -> Rect {
        let w = self.width();
        let x = if self.align_end { self.x - w } else { self.x };
        Rect::new(x, self.y, w, self.height())
    }
    /// Baseline of line `i`: the line box centred on the em box, with the
    /// baseline at 0.8em below the em box's top — close to Noto's metrics.
    pub fn baseline(&self, i: usize) -> f32 {
        self.y
            + i as f32 * self.line_height
            + (self.line_height - self.size) / 2.0
            + self.size * 0.8
    }
    fn shift(&mut self, dy: f32) {
        self.y += dy;
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Card {
    /// The whole card, browser bar included.
    pub frame: Rect,
    /// Height of the browser bar at the top of the frame (0 for none).
    pub chrome_h: f32,
    /// Where the cropped image is drawn.
    pub image: Rect,
    /// Output pixels per source pixel.
    pub scale: f32,
    pub radius: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct Pill {
    pub rect: Rect,
    pub label: TextBlock,
    /// The arrow after the label, drawn as a path: the Noto faces have no
    /// arrow glyph, and a fallback face would change the label's width.
    pub arrow: Rect,
}

#[derive(Clone, Debug, Serialize)]
pub struct Mark {
    pub columns: [Rect; 3],
    pub radius: f32,
}

#[derive(Clone, Debug, Serialize)]
pub struct Point {
    pub dot: Rect,
    pub text: TextBlock,
}

#[derive(Clone, Debug, Serialize)]
pub struct Layout {
    pub composition: Composition,
    pub width: f32,
    pub height: f32,
    pub safe: Rect,
    /// The identity strip down the left edge (zero width for icons).
    pub strip: Rect,
    pub eyebrow: Option<TextBlock>,
    pub headline: Option<TextBlock>,
    pub sub: Option<TextBlock>,
    pub points: Vec<Point>,
    pub card: Option<Card>,
    pub mark: Option<Mark>,
    pub cta: Option<Pill>,
    pub slide: Option<TextBlock>,
}

impl Layout {
    /// Every box that carries content — everything that must stay inside
    /// the safe area.
    pub fn content_boxes(&self) -> Vec<(&'static str, Rect)> {
        let mut out = Vec::new();
        for (name, block) in [
            ("eyebrow", &self.eyebrow),
            ("headline", &self.headline),
            ("sub", &self.sub),
            ("slide", &self.slide),
        ] {
            if let Some(b) = block {
                out.push((name, b.bbox()));
            }
        }
        for p in &self.points {
            out.push(("point", p.text.bbox()));
            out.push(("point-dot", p.dot));
        }
        if let Some(c) = &self.card {
            out.push(("card", c.frame));
        }
        if let Some(m) = &self.mark {
            for c in m.columns {
                out.push(("mark", c));
            }
        }
        if let Some(p) = &self.cta {
            out.push(("cta", p.rect));
            out.push(("cta-arrow", p.arrow));
        }
        out
    }
}

/// Pick the composition for a canvas and its content.
pub fn choose(preset: &Preset, content: &Content) -> Composition {
    if let Some(c) = content.composition {
        return c;
    }
    if preset.group == Group::Icon {
        return Composition::Icon;
    }
    let aspect = preset.aspect();
    match &content.image {
        None if aspect >= 1.2 => Composition::Tile,
        None => Composition::Stack,
        Some(_) if aspect < 1.2 => Composition::Stack,
        Some(img) => {
            let [_, _, w, h] = img.crop_box();
            if h > w * 0.9 || aspect >= 2.2 {
                Composition::Side
            } else {
                Composition::Top
            }
        }
    }
}

pub fn layout(preset: &Preset, content: &Content, default_eyebrow: &str) -> Layout {
    let composition = choose(preset, content);
    let w = preset.width as f32;
    let h = preset.height as f32;
    let mut l = Layout {
        composition,
        width: w,
        height: h,
        safe: preset.safe_rect(),
        strip: Rect::new(0.0, 0.0, 0.0, h),
        eyebrow: None,
        headline: None,
        sub: None,
        points: Vec::new(),
        card: None,
        mark: None,
        cta: None,
        slide: None,
    };
    let eyebrow = content
        .eyebrow
        .clone()
        .unwrap_or_else(|| default_eyebrow.to_string());
    match composition {
        Composition::Top => top(&mut l, content, &eyebrow),
        Composition::Side => side(&mut l, content, &eyebrow),
        Composition::Stack => stack(&mut l, content, &eyebrow),
        Composition::Tile => tile(&mut l, content, &eyebrow),
        Composition::Icon => icon(&mut l),
    }
    l
}

#[allow(clippy::too_many_arguments)]
fn block(
    font: Font,
    text: &str,
    max: f32,
    min: f32,
    tracking: f32,
    lh: f32,
    x: f32,
    y: f32,
    max_w: f32,
    max_lines: usize,
    role: Role,
) -> TextBlock {
    let (size, lines) = text::fit(font, text, max, min, tracking, max_w, max_lines);
    TextBlock {
        font,
        size,
        tracking,
        line_height: (size * lh).round(),
        x,
        y,
        lines,
        role,
        align_end: false,
    }
}

fn strip_width(w: f32, h: f32) -> f32 {
    (14.0 * w.min(h) / 800.0).round().max(4.0)
}

/// Fit the cropped image (plus browser bar) into `stage`, never scaling up.
fn fit_card(img: &SourceImage, stage: Rect, unit: f32) -> Card {
    let [_, _, cw, ch] = img.crop_box();
    let chrome_h = if img.chrome.is_some() {
        (34.0 * unit).max(stage.w * 0.04).round()
    } else {
        0.0
    };
    let scale = 1f32
        .min((stage.w - 2.0) / cw)
        .min((stage.h - chrome_h - 2.0) / ch)
        .max(0.01);
    let iw = (cw * scale).round();
    let ih = (ch * scale).round();
    let frame = Rect::new(stage.x, stage.y, iw, ih + chrome_h);
    Card {
        frame,
        chrome_h,
        image: Rect::new(frame.x, frame.y + chrome_h, iw, ih),
        scale,
        radius: (12.0 * unit).round().max(4.0),
    }
}

fn place_card(card: &mut Card, x: f32, y: f32) {
    let dx = x - card.frame.x;
    let dy = y - card.frame.y;
    card.frame.x += dx;
    card.frame.y += dy;
    card.image.x += dx;
    card.image.y += dy;
}

fn slide_label(
    content: &Content,
    font_size: f32,
    right: f32,
    y: f32,
    role: Role,
) -> Option<TextBlock> {
    content.slide.map(|(n, of)| TextBlock {
        font: Font::Mono,
        size: font_size,
        tracking: 0.04,
        line_height: (font_size * 1.4).round(),
        x: right,
        y,
        lines: vec![format!("{n:02} / {of:02}")],
        role,
        align_end: true,
    })
}

fn top(l: &mut Layout, c: &Content, eyebrow: &str) {
    let s = l.height / 800.0;
    l.strip.w = strip_width(l.width, l.height);
    let left = l.safe.x.max(l.strip.w) + 56.0 * s;
    let right = l.safe.right() - 56.0 * s;
    let top = l.safe.y + 63.0 * s;
    let bottom = l.safe.bottom() - 56.0 * s;
    let width = right - left;

    let mut y = top;
    let eb = block(
        Font::Sans,
        eyebrow,
        17.0 * s,
        12.0 * s,
        0.01,
        1.41,
        left,
        y,
        width * 0.7,
        1,
        Role::Muted,
    );
    y += eb.height() + 12.0 * s;
    if let Some(cta) = &c.cta {
        l.cta = Some(pill(cta, 15.0 * s, right, top, true));
    } else {
        l.slide = slide_label(c, 15.0 * s, right, top, Role::Muted);
    }
    l.eyebrow = Some(eb);
    let hl = block(
        Font::Serif,
        &c.headline,
        45.0 * s,
        30.0 * s,
        -0.02,
        1.08,
        left,
        y,
        width,
        2,
        Role::Fg,
    );
    y += hl.height() + 56.0 * s;
    l.headline = Some(hl);

    if let Some(img) = &c.image {
        let stage = Rect::new(left, y, width, bottom - y);
        let mut card = fit_card(img, stage, s);
        let x = stage.x + (stage.w - card.frame.w) / 2.0;
        let cy = stage.y + (stage.h - card.frame.h) / 2.0;
        place_card(&mut card, x.round(), cy.round());
        l.card = Some(card);
    }
}

fn side(l: &mut Layout, c: &Content, eyebrow: &str) {
    let s = l.height / 800.0;
    l.strip.w = strip_width(l.width, l.height);
    let left = l.safe.x.max(l.strip.w) + 72.0 * s;
    let right = l.safe.right() - 72.0 * s;
    let top = l.safe.y + 56.0 * s;
    let bottom = l.safe.bottom() - 56.0 * s;
    let col = (430.0 * s).min((right - left) * 0.45);
    let gap = 72.0 * s;

    let mut eb = block(
        Font::Sans,
        eyebrow,
        17.0 * s,
        12.0 * s,
        0.01,
        1.41,
        left,
        0.0,
        col,
        2,
        Role::Muted,
    );
    let mut hl = block(
        Font::Serif,
        &c.headline,
        47.0 * s,
        30.0 * s,
        -0.02,
        1.1,
        left,
        0.0,
        col,
        5,
        Role::Fg,
    );
    let text_h = eb.height() + 12.0 * s + hl.height();
    let y0 = top + ((bottom - top) - text_h) / 2.0;
    eb.shift(y0);
    hl.shift(y0 + eb.height() + 12.0 * s);
    l.eyebrow = Some(eb);
    l.headline = Some(hl);
    l.slide = slide_label(c, 15.0 * s, right, top, Role::Muted);

    if let Some(img) = &c.image {
        let stage = Rect::new(
            left + col + gap,
            top,
            right - (left + col + gap),
            bottom - top,
        );
        let mut card = fit_card(img, stage, s);
        let x = stage.right() - card.frame.w;
        let cy = stage.y + (stage.h - card.frame.h) / 2.0;
        place_card(&mut card, x.round(), cy.round());
        l.card = Some(card);
    }
}

fn stack(l: &mut Layout, c: &Content, eyebrow: &str) {
    let u = l.width / 1080.0;
    l.strip.w = (18.0 * u).round().max(4.0);
    let pad = 72.0 * u;
    let left = l.safe.x.max(l.strip.w + pad);
    let right = l.safe.right().min(l.width - pad);
    let top = if l.safe.y > 0.0 {
        l.safe.y + 16.0 * u
    } else {
        pad
    };
    let bottom = if l.safe.bottom() < l.height {
        l.safe.bottom() - 16.0 * u
    } else {
        l.height - pad
    };
    let width = right - left;
    let tall = l.height / l.width > 1.5;

    let mut y = top;
    let eb = block(
        Font::Sans,
        eyebrow,
        30.0 * u,
        22.0 * u,
        0.01,
        1.35,
        left,
        y,
        width * 0.75,
        1,
        Role::Muted,
    );
    l.slide = slide_label(c, 26.0 * u, right, y, Role::Muted);
    y += eb.height() + 18.0 * u;
    l.eyebrow = Some(eb);

    let (max, min, lines) = match (&c.image, tall) {
        (Some(_), true) => (80.0, 54.0, 3),
        (Some(_), false) => (64.0, 44.0, 3),
        (None, true) => (112.0, 64.0, 6),
        (None, false) => (96.0, 56.0, 5),
    };
    let hl = block(
        Font::Serif,
        &c.headline,
        max * u,
        min * u,
        -0.02,
        1.08,
        left,
        y,
        width,
        lines,
        Role::Fg,
    );
    y += hl.height();
    l.headline = Some(hl);
    if let Some(sub) = c.sub.as_ref().filter(|s| !s.trim().is_empty()) {
        y += 28.0 * u;
        let sb = block(
            Font::Sans,
            sub,
            38.0 * u,
            28.0 * u,
            0.0,
            1.4,
            left,
            y,
            width,
            4,
            Role::Muted,
        );
        y += sb.height();
        l.sub = Some(sb);
    }

    let mut floor = bottom;
    if let Some(cta) = &c.cta {
        let mut p = pill(cta, 34.0 * u, left, 0.0, false);
        let dy = bottom - p.rect.h;
        p.rect.y += dy;
        p.label.y += dy;
        p.arrow.y += dy;
        floor = p.rect.y;
        l.cta = Some(p);
    }

    // The middle: card, then points, centred in what is left.
    let region_top = y + 56.0 * u;
    let region_bottom = floor - 56.0 * u;
    let gap = 48.0 * u;
    let mut points: Vec<Point> = c
        .points
        .iter()
        .map(|p| {
            let dot = 16.0 * u;
            let tx = left + dot + 22.0 * u;
            let tb = block(
                Font::Sans,
                p,
                34.0 * u,
                26.0 * u,
                0.0,
                1.35,
                tx,
                0.0,
                right - tx,
                2,
                Role::Fg,
            );
            Point {
                dot: Rect::new(left, 0.0, dot, dot),
                text: tb,
            }
        })
        .collect();
    let row_gap = 20.0 * u;
    let points_h: f32 = points.iter().map(|p| p.text.height()).sum::<f32>()
        + row_gap * points.len().saturating_sub(1) as f32;

    let mut card = c.image.as_ref().map(|img| {
        let avail_h = region_bottom
            - region_top
            - if points.is_empty() {
                0.0
            } else {
                points_h + gap
            };
        fit_card(
            img,
            Rect::new(left, region_top, width, avail_h.max(10.0)),
            u,
        )
    });
    let card_h = card.as_ref().map_or(0.0, |c| c.frame.h);
    let group_h = card_h
        + if card.is_some() && !points.is_empty() {
            gap
        } else {
            0.0
        }
        + points_h;
    let mut gy = if card.is_some() {
        region_top + ((region_bottom - region_top) - group_h).max(0.0) / 2.0
    } else {
        region_top
    };
    if let Some(card) = card.as_mut() {
        let x = left + (width - card.frame.w) / 2.0;
        place_card(card, x.round(), gy.round());
        gy += card.frame.h + gap;
    }
    for p in points.iter_mut() {
        p.text.shift(gy);
        // Centre the dot on the first line.
        p.dot.y = gy + (p.text.line_height - p.dot.h) / 2.0;
        gy += p.text.height() + row_gap;
    }
    // No screenshot: sign the card with the product mark in the bottom-right
    // corner, and on a pure text slide (no points either) centre the
    // headline and sub in the room below the eyebrow — so a carousel's text
    // slides do not end in half a page of nothing.
    if card.is_none() {
        let mark_h = (120.0 * u).round();
        let col_w = mark_h * 0.276;
        let col_gap = mark_h * 0.067;
        let mark_w = col_w * 3.0 + col_gap * 2.0;
        l.mark = Some(mark(
            right - mark_w,
            bottom - mark_h,
            mark_h,
            col_w,
            col_gap,
            col_w * 0.31,
        ));

        let room_bottom = floor.min(bottom - mark_h) - 56.0 * u;
        let dy = if points.is_empty() {
            ((room_bottom - y) / 2.0).max(0.0)
        } else {
            0.0
        };
        if let Some(b) = l.headline.as_mut() {
            b.shift(dy);
        }
        if let Some(b) = l.sub.as_mut() {
            b.shift(dy);
        }
    }
    l.card = card;
    l.points = points;
}

fn tile(l: &mut Layout, c: &Content, byline: &str) {
    let s = l.height / 560.0;
    l.strip.w = (10.0 * s).round().max(4.0);
    let pad = 64.0 * s;
    let left = l.safe.x.max(l.strip.w) + pad;
    let right = l.safe.right() - pad;
    let top = l.safe.y + pad;
    let bottom = l.safe.bottom() - pad;

    let mark_h = (210.0 * s).min(bottom - top);
    let col_w = 58.0 * s;
    let col_gap = 14.0 * s;
    let mark_w = col_w * 3.0 + col_gap * 2.0;
    let gap = 72.0 * s;
    let text_w = right - left - mark_w - gap;

    let by_size = (15.0 * s).max(9.0);
    let mut by = block(
        Font::SansBold,
        &byline.to_uppercase(),
        by_size,
        by_size,
        0.14,
        1.3,
        left,
        0.0,
        text_w,
        1,
        Role::Muted,
    );
    let mut hl = block(
        Font::Serif,
        &c.headline,
        62.0 * s,
        36.0 * s,
        -0.02,
        1.08,
        left,
        0.0,
        text_w,
        3,
        Role::Fg,
    );
    let mut sb = c.sub.as_ref().filter(|s| !s.trim().is_empty()).map(|sub| {
        let size = (24.0 * s).max(14.0);
        block(
            Font::Sans,
            sub,
            size,
            size * 0.8,
            0.0,
            1.45,
            left,
            0.0,
            text_w.min((size * 0.55 * 28.0).max(text_w * 0.6)),
            3,
            Role::Muted,
        )
    });
    let by_gap = 20.0 * s;
    let sub_gap = 22.0 * s;
    let text_h =
        by.height() + by_gap + hl.height() + sb.as_ref().map_or(0.0, |b| sub_gap + b.height());
    let y0 = top + ((bottom - top) - text_h) / 2.0;
    by.shift(y0);
    hl.shift(y0 + by.height() + by_gap);
    if let Some(b) = sb.as_mut() {
        b.shift(y0 + by.height() + by_gap + hl.height() + sub_gap);
    }
    l.eyebrow = Some(by);
    l.headline = Some(hl);
    l.sub = sb;

    let mx = right - mark_w;
    let my = top + ((bottom - top) - mark_h) / 2.0;
    l.mark = Some(mark(mx, my, mark_h, col_w, col_gap, 18.0 * s));
}

fn icon(l: &mut Layout) {
    let area = if l.width <= 48.0 {
        Rect::new(0.0, 0.0, l.width, l.height)
    } else {
        l.safe
    };
    let mark_h = area.h * if l.width <= 48.0 { 0.84 } else { 0.62 };
    let col_w = mark_h * 0.276;
    let col_gap = mark_h * 0.067;
    let mark_w = col_w * 3.0 + col_gap * 2.0;
    let x = area.x + (area.w - mark_w) / 2.0;
    let y = area.y + (area.h - mark_h) / 2.0;
    l.mark = Some(mark(x, y, mark_h, col_w, col_gap, col_w * 0.31));
}

fn mark(x: f32, y: f32, h: f32, col_w: f32, gap: f32, radius: f32) -> Mark {
    let heights = [0.62, 1.0, 0.44];
    let columns = std::array::from_fn(|i| {
        let ch = h * heights[i];
        Rect::new(x + i as f32 * (col_w + gap), y + h - ch, col_w, ch)
    });
    Mark { columns, radius }
}

/// A pill with a label. `align_end` anchors its right edge at `x`.
fn pill(label: &str, size: f32, x: f32, y: f32, align_end: bool) -> Pill {
    let pad_x = size * 1.3;
    let h = (size * 2.6).round();
    let text = label.to_string();
    let tw = text::measure(Font::SansBold, &text, size, 0.0);
    let (gap, aw) = (size * 0.55, size * 0.8);
    let w = tw + gap + aw + pad_x * 2.0;
    let rx = if align_end { x - w } else { x };
    Pill {
        rect: Rect::new(rx, y, w, h),
        arrow: Rect::new(rx + pad_x + tw + gap, y + (h - aw) / 2.0, aw, aw),
        label: TextBlock {
            font: Font::SansBold,
            size,
            tracking: 0.0,
            line_height: h,
            x: rx + pad_x,
            y,
            lines: vec![text],
            role: Role::OnFg,
            align_end: false,
        },
    }
}
