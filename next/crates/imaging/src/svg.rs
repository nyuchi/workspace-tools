//! A [`Layout`] as SVG.
//!
//! All user text goes through [`esc`]; the screenshot goes in as a data URI,
//! so the SVG is self-contained and nothing is fetched while rendering.

use crate::layout::{Composition, Content, Layout, Role, TextBlock};
use crate::theme::{Mode, STRIP_ORDER, Surface, Theme};
use base64::Engine as _;
use std::fmt::Write as _;

pub struct SvgOptions {
    pub mode: Mode,
    /// Overlay the safe area and the platform-UI bands (for previews and
    /// review, never for upload).
    pub guides: bool,
}

pub fn esc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c if (c as u32) < 0x20 && c != '\t' => {}
            c => out.push(c),
        }
    }
    out
}

fn color(role: Role, surface: &Surface) -> &str {
    match role {
        Role::Fg => &surface.fg,
        Role::Muted => &surface.muted,
        Role::OnFg => &surface.bg,
    }
}

fn text(out: &mut String, b: &TextBlock, surface: &Surface) {
    let anchor = if b.align_end {
        r#" text-anchor="end""#
    } else {
        ""
    };
    for (i, line) in b.lines.iter().enumerate() {
        let _ = write!(
            out,
            r#"<text x="{:.1}" y="{:.1}" font-family="{}" font-weight="{}" font-size="{:.1}" letter-spacing="{:.2}" fill="{}"{anchor}>{}</text>"#,
            b.x,
            b.baseline(i),
            b.font.family(),
            b.font.weight(),
            b.size,
            b.tracking * b.size,
            color(b.role, surface),
            esc(line),
        );
    }
}

pub fn to_svg(layout: &Layout, content: &Content, theme: &Theme, opts: &SvgOptions) -> String {
    let surface = theme.surface(opts.mode);
    let (w, h) = (layout.width, layout.height);
    let mut s = String::new();
    let _ = write!(
        s,
        r#"<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}">"#
    );

    // Background: the surface, then a soft mineral mesh — three radial
    // glows from the theme's mesh minerals.
    s.push_str("<defs>");
    let spots = [(0.92, 0.06, 0.62), (0.06, 0.98, 0.58), (0.78, 0.72, 0.42)];
    let big = w.max(h);
    for (i, name) in theme.mesh.iter().take(3).enumerate() {
        let (cx, cy, r) = spots[i];
        let opacity = surface.mesh_opacity * [1.0, 0.85, 0.6][i];
        let _ = write!(
            s,
            r#"<radialGradient id="mesh{i}" gradientUnits="userSpaceOnUse" cx="{:.1}" cy="{:.1}" r="{:.1}"><stop offset="0" stop-color="{c}" stop-opacity="{opacity:.3}"/><stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>"#,
            w * cx,
            h * cy,
            big * r,
            c = theme.vivid(name),
        );
    }
    let unit = w.min(h) / 800.0;
    let _ = write!(
        s,
        r##"<filter id="lift" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="{:.1}" stdDeviation="{:.1}" flood-color="#000000" flood-opacity="{}"/></filter>"##,
        13.0 * unit,
        21.0 * unit,
        if opts.mode == Mode::Dark { 0.45 } else { 0.12 },
    );
    if let Some(card) = &layout.card {
        let f = card.frame;
        let _ = write!(
            s,
            r#"<clipPath id="cardclip"><rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}"/></clipPath>"#,
            f.x, f.y, f.w, f.h, card.radius
        );
    }
    s.push_str("</defs>");

    let icon = layout.composition == Composition::Icon;
    // Icons sit on the dark surface: the mark reads best there at 16px.
    let bg = if icon { &theme.dark.bg } else { &surface.bg };
    let _ = write!(s, r#"<rect width="{w}" height="{h}" fill="{bg}"/>"#);
    if !icon {
        for i in 0..theme.mesh.len().min(3) {
            let _ = write!(
                s,
                r#"<rect width="{w}" height="{h}" fill="url(#mesh{i})"/>"#
            );
        }
    }

    // The identity strip: always vertical, seven equal segments, left edge.
    if layout.strip.w > 0.0 {
        let seg = h / 7.0;
        for (i, name) in STRIP_ORDER.iter().enumerate() {
            let _ = write!(
                s,
                r#"<rect x="0" y="{:.2}" width="{:.1}" height="{:.2}" fill="{}"/>"#,
                i as f32 * seg,
                layout.strip.w,
                seg + 0.5,
                theme.vivid(name)
            );
        }
    }

    for b in [
        &layout.eyebrow,
        &layout.headline,
        &layout.sub,
        &layout.slide,
    ]
    .into_iter()
    .flatten()
    {
        text(&mut s, b, surface);
    }

    for (i, p) in layout.points.iter().enumerate() {
        let name = &theme.mark[i % theme.mark.len()];
        let d = p.dot;
        let _ = write!(
            s,
            r#"<circle cx="{:.1}" cy="{:.1}" r="{:.1}" fill="{}"/>"#,
            d.x + d.w / 2.0,
            d.y + d.h / 2.0,
            d.w / 2.0,
            theme.vivid(name)
        );
        text(&mut s, &p.text, surface);
    }

    if let (Some(card), Some(img)) = (&layout.card, &content.image) {
        let f = card.frame;
        let _ = write!(
            s,
            r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}" fill="{}" filter="url(#lift)"/>"#,
            f.x, f.y, f.w, f.h, card.radius, surface.card
        );
        s.push_str(r#"<g clip-path="url(#cardclip)">"#);
        if card.chrome_h > 0.0 {
            let ch = card.chrome_h;
            let _ = write!(
                s,
                r##"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{ch:.1}" fill="#F3F3F1"/>"##,
                f.x, f.y, f.w
            );
            let r = ch * 0.14;
            for i in 0..3 {
                let _ = write!(
                    s,
                    r##"<circle cx="{:.1}" cy="{:.1}" r="{r:.1}" fill="#D6D5D1"/>"##,
                    f.x + ch * 0.6 + i as f32 * r * 3.2,
                    f.y + ch / 2.0
                );
            }
            if let Some(url) = img.chrome.as_deref().filter(|u| !u.is_empty()) {
                let size = ch * 0.38;
                let px = f.x + ch * 0.6 + r * 9.0;
                let pw = (crate::text::measure(crate::text::Font::Mono, url, size, 0.0)
                    + size * 2.4)
                    .min(f.w - (px - f.x) - ch * 0.4);
                let _ = write!(
                    s,
                    r##"<rect x="{px:.1}" y="{:.1}" width="{pw:.1}" height="{:.1}" rx="{:.1}" fill="#FFFFFF"/>"##,
                    f.y + ch * 0.2,
                    ch * 0.6,
                    ch * 0.3
                );
                let _ = write!(
                    s,
                    r##"<text x="{:.1}" y="{:.1}" font-family="JetBrains Mono" font-size="{size:.1}" fill="#4F4E4A">{}</text>"##,
                    px + size * 1.2,
                    f.y + ch / 2.0 + size * 0.36,
                    esc(url)
                );
            }
            let _ = write!(
                s,
                r##"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="1" fill="#E5E4E1"/>"##,
                f.x,
                f.y + ch - 1.0,
                f.w
            );
        }
        // The image, cropped by a transform into the card's image box; the
        // redaction bars share the transform, so they are given in source
        // pixels and land exactly where the data was.
        let [cx, cy, _, _] = img.crop_box();
        let sc = card.scale;
        let _ = write!(
            s,
            r#"<g transform="translate({:.2} {:.2}) scale({sc:.5}) translate({:.1} {:.1})">"#,
            card.image.x, card.image.y, -cx, -cy
        );
        let data = base64::engine::general_purpose::STANDARD.encode(&img.data);
        let _ = write!(
            s,
            r#"<image x="0" y="0" width="{}" height="{}" preserveAspectRatio="none" xlink:href="data:{};base64,{data}"/>"#,
            img.width, img.height, img.mime
        );
        for [rx, ry, rw, rh] in &img.redact {
            let _ = write!(
                s,
                r#"<rect class="redact" x="{rx}" y="{ry}" width="{rw}" height="{rh}" rx="{:.1}" fill="{}"/>"#,
                (*rh as f32 / 2.0).min(8.0),
                surface.skeleton
            );
        }
        s.push_str("</g></g>");
        // A hairline ring so a white screenshot keeps its edge on a light page.
        let _ = write!(
            s,
            r##"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}" fill="none" stroke="#000000" stroke-opacity="0.06"/>"##,
            f.x, f.y, f.w, f.h, card.radius
        );
    }

    if let Some(m) = &layout.mark {
        for (i, c) in m.columns.iter().enumerate() {
            let _ = write!(
                s,
                r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}" fill="{}"/>"#,
                c.x,
                c.y,
                c.w,
                c.h,
                m.radius,
                theme.vivid(&theme.mark[i % theme.mark.len()])
            );
        }
    }

    if let Some(p) = &layout.cta {
        let r = p.rect;
        let _ = write!(
            s,
            r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}" fill="{}"/>"#,
            r.x,
            r.y,
            r.w,
            r.h,
            r.h / 2.0,
            surface.fg
        );
        text(&mut s, &p.label, surface);
        let a = p.arrow;
        let my = a.y + a.h / 2.0;
        let _ = write!(
            s,
            r#"<path d="M{:.1} {my:.1}H{:.1}M{:.1} {:.1}L{:.1} {my:.1}L{:.1} {:.1}" fill="none" stroke="{}" stroke-width="{:.1}" stroke-linecap="round" stroke-linejoin="round"/>"#,
            a.x,
            a.right(),
            a.right() - a.w * 0.42,
            a.y + a.h * 0.1,
            a.right(),
            a.right() - a.w * 0.42,
            a.bottom() - a.h * 0.1,
            surface.bg,
            (a.h * 0.13).max(1.5),
        );
    }

    if opts.guides {
        guides(&mut s, layout);
    }
    s.push_str("</svg>");
    s
}

/// The safe-area overlay: platform-UI bands tinted, the safe area outlined,
/// and each band labelled with its height.
fn guides(s: &mut String, l: &Layout) {
    let (w, h, sa) = (l.width, l.height, l.safe);
    let size = (w.min(h) / 40.0).max(10.0);
    let bands = [
        (
            0.0,
            0.0,
            w,
            sa.y,
            format!("PLATFORM UI · TOP {}px", sa.y as u32),
        ),
        (
            0.0,
            sa.bottom(),
            w,
            h - sa.bottom(),
            format!("PLATFORM UI · BOTTOM {}px", (h - sa.bottom()) as u32),
        ),
        (0.0, sa.y, sa.x, sa.h, String::new()),
        (sa.right(), sa.y, w - sa.right(), sa.h, String::new()),
    ];
    for (x, y, bw, bh, label) in bands {
        if bw <= 0.0 || bh <= 0.0 {
            continue;
        }
        let _ = write!(
            s,
            r##"<rect x="{x:.1}" y="{y:.1}" width="{bw:.1}" height="{bh:.1}" fill="#FF3B30" fill-opacity="0.16"/>"##
        );
        if !label.is_empty() {
            let _ = write!(
                s,
                r##"<text x="{:.1}" y="{:.1}" text-anchor="middle" font-family="JetBrains Mono" font-size="{size:.1}" fill="#C62828">{label}</text>"##,
                w / 2.0,
                y + bh / 2.0 + size * 0.35
            );
        }
    }
    let _ = write!(
        s,
        r##"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" fill="none" stroke="#FF3B30" stroke-width="{:.1}" stroke-dasharray="{:.1} {:.1}"/>"##,
        sa.x + 1.0,
        sa.y + 1.0,
        sa.w - 2.0,
        sa.h - 2.0,
        (w / 540.0).max(1.0),
        size,
        size * 0.6
    );
}
