//! The email signature, redesigned on Mzizi (decision 2 on #70).
//!
//! Email-safe by construction:
//!
//! - **Tables and inline styles only.** No `<style>`, no classes, no CSS
//!   that Gmail or Outlook strip; `bgcolor` attributes as well as
//!   `background-color` for the strip, because Outlook honours only one.
//! - **No images by default.** The seven-mineral identity strip is table
//!   cells, socials are text links — so nothing is hidden behind "load
//!   images", and nothing looks like a tracking pixel. A profile photo and a
//!   promo banner are opt-in, and only from `https://` URLs.
//! - **Fonts degrade cleanly.** Noto Serif / Noto Sans first, Georgia /
//!   Arial after: clients that drop web fonts still get a serif name and a
//!   sans body.
//! - **Readable.** Link colours are the brand mineral's on-light hex only
//!   where it meets WCAG AA (4.5:1) on white; otherwise ink.
//! - **Escaped.** Every value is HTML-escaped; URLs are checked against an
//!   allow-list of schemes.
//!
//! Brand data comes from `nyuchi-brands` — the one list.

use nyuchi_brands::Brand;
use serde::{Deserialize, Serialize};
use std::fmt::Write as _;

/// Mzizi ink and muted text (on white), and the seven minerals in strip
/// order with their on-light (text) and vivid (strip) hexes.
pub const INK: &str = "#141413";
pub const MUTED: &str = "#4F4E4A";
pub const MINERALS: [(&str, &str, &str); 7] = [
    ("cobalt", "#0047AB", "#00B0FF"),
    ("tanzanite", "#4B0082", "#B388FF"),
    ("malachite", "#004D40", "#64FFDA"),
    ("gold", "#5D4037", "#FFD740"),
    ("terracotta", "#A0522D", "#E1B07E"),
    ("sodalite", "#283593", "#3D5AFE"),
    ("copper", "#BF5A36", "#FF8A65"),
];

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct Params {
    /// Brand key; when empty, the brand is found from the email's domain.
    pub brand: String,
    pub name: String,
    pub email: String,
    pub title: String,
    pub phone: String,
    pub whatsapp: String,
    /// `https://` URL of a square photo.
    pub photo: String,
    /// Personal profiles, shown before the brand's own accounts.
    pub linkedin: String,
    pub x: String,
    pub instagram: String,
    pub facebook: String,
    /// Optional banner: `https://` image URL, link and alt text.
    pub promo_image: String,
    pub promo_link: String,
    pub promo_alt: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    UnknownBrand,
    MissingName,
    BadEmail,
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::UnknownBrand => {
                write!(f, "unknown brand, and no brand claims the email's domain")
            }
            Error::MissingName => write!(f, "a name is required"),
            Error::BadEmail => write!(f, "the email address is not valid"),
        }
    }
}

impl std::error::Error for Error {}

pub struct Signature {
    pub html: String,
    pub text: String,
    pub brand: &'static Brand,
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
            c if c.is_control() => {}
            c => out.push(c),
        }
    }
    out
}

/// An `https://` URL with no whitespace, quotes or angle brackets; a bare
/// host gets `https://`. Anything else (including `javascript:`, `data:`,
/// `http:`) is refused.
pub fn https_url(raw: &str) -> Option<String> {
    let t = raw.trim();
    if t.is_empty()
        || t.chars()
            .any(|c| c.is_whitespace() || c.is_control() || "\"'<>`".contains(c))
    {
        return None;
    }
    let url = if t.contains("://") || t.contains(':') {
        t.to_string()
    } else {
        format!("https://{t}")
    };
    let lower = url.to_ascii_lowercase();
    (lower.starts_with("https://") && url.len() > "https://".len()).then_some(url)
}

fn valid_email(e: &str) -> bool {
    let Some((local, domain)) = e.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && e.chars()
            .all(|c| c.is_ascii_alphanumeric() || "@.+-_'".contains(c))
}

/// Digits and a leading `+`, for `tel:` and `wa.me`.
fn dial(phone: &str) -> String {
    let mut out = String::new();
    for (i, c) in phone.trim().chars().enumerate() {
        if c.is_ascii_digit() || (c == '+' && i == 0) {
            out.push(c);
        }
    }
    out
}

fn luminance(hex: &str) -> f64 {
    let v = u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0);
    let ch = |shift: u32| {
        let c = ((v >> shift) & 0xFF) as f64 / 255.0;
        if c <= 0.039_28 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * ch(16) + 0.7152 * ch(8) + 0.0722 * ch(0)
}

/// WCAG contrast ratio of two hex colours.
pub fn contrast(a: &str, b: &str) -> f64 {
    let (la, lb) = (luminance(a), luminance(b));
    let (hi, lo) = if la > lb { (la, lb) } else { (lb, la) };
    (hi + 0.05) / (lo + 0.05)
}

/// The colour for links and the brand name: the mineral's on-light hex
/// when it reaches 4.5:1 on white, otherwise ink.
pub fn accent(mineral: &str) -> &'static str {
    let light = MINERALS
        .iter()
        .find(|(name, _, _)| *name == mineral)
        .map_or(INK, |(_, light, _)| light);
    if contrast(light, "#FFFFFF") >= 4.5 {
        light
    } else {
        INK
    }
}

const SOCIAL_LABELS: [(&str, &str); 5] = [
    ("linkedin", "LinkedIn"),
    ("x", "X"),
    ("instagram", "Instagram"),
    ("facebook", "Facebook"),
    ("whatsapp", "WhatsApp"),
];

/// Social links: personal profiles first, then the brand's accounts for
/// networks the person did not give, deduplicated by network.
fn socials(p: &Params, brand: &Brand) -> Vec<(&'static str, String)> {
    let personal = [
        ("linkedin", &p.linkedin),
        ("x", &p.x),
        ("instagram", &p.instagram),
        ("facebook", &p.facebook),
    ];
    let mut out = Vec::new();
    for (net, label) in SOCIAL_LABELS {
        let url = if net == "whatsapp" {
            let d = dial(&p.whatsapp);
            (d.len() > 4).then(|| format!("https://wa.me/{}", d.trim_start_matches('+')))
        } else {
            personal
                .iter()
                .find(|(n, _)| *n == net)
                .and_then(|(_, v)| https_url(v))
                .or_else(|| brand.socials.get(net).and_then(|v| https_url(v)))
        };
        if let Some(url) = url {
            out.push((label, url));
        }
    }
    out
}

pub fn build(p: &Params) -> Result<Signature, Error> {
    let name = p.name.trim();
    if name.is_empty() {
        return Err(Error::MissingName);
    }
    let email = p.email.trim();
    if !valid_email(email) {
        return Err(Error::BadEmail);
    }
    let brand = if p.brand.trim().is_empty() {
        nyuchi_brands::for_email(email)
    } else {
        nyuchi_brands::get(p.brand.trim())
    }
    .ok_or(Error::UnknownBrand)?;

    let accent = accent(&brand.mineral);
    let font = "'Noto Sans',Arial,Helvetica,sans-serif";
    let serif = "'Noto Serif',Georgia,'Times New Roman',serif";
    let title = p.title.trim();
    let phone = p.phone.trim();
    let socials = socials(p, brand);
    let photo = https_url(&p.photo);

    let mut h = String::new();
    let _ = write!(
        h,
        r#"<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:{font};font-size:13px;line-height:1.5;color:{INK};max-width:560px;"><tr>"#
    );

    // The identity strip: seven mineral cells, top to bottom.
    h.push_str(r#"<td valign="top" width="4" style="width:4px;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="4" style="border-collapse:collapse;width:4px;">"#);
    for (_, _, vivid) in MINERALS {
        let _ = write!(
            h,
            r#"<tr><td width="4" height="14" bgcolor="{vivid}" style="width:4px;height:14px;background-color:{vivid};font-size:0;line-height:0;">&nbsp;</td></tr>"#
        );
    }
    h.push_str("</table></td>");

    if let Some(photo) = &photo {
        let _ = write!(
            h,
            r#"<td valign="top" style="padding:0 0 0 16px;"><img src="{}" alt="{}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:36px;border:0;"></td>"#,
            esc(photo),
            esc(name)
        );
    }

    let _ = write!(h, r#"<td valign="top" style="padding:0 0 0 16px;">"#);
    let _ = write!(
        h,
        r#"<div style="font-family:{serif};font-size:19px;font-weight:700;line-height:1.25;color:{INK};">{}</div>"#,
        esc(name)
    );
    let role = if title.is_empty() {
        format!(
            r#"<span style="color:{accent};font-weight:600;">{}</span>"#,
            esc(&brand.name)
        )
    } else {
        format!(
            r#"{} · <span style="color:{accent};font-weight:600;">{}</span>"#,
            esc(title),
            esc(&brand.name)
        )
    };
    let _ = write!(
        h,
        r#"<div style="font-size:13px;color:{MUTED};padding:2px 0 10px 0;">{role}</div>"#
    );

    let link = |href: &str, label: &str| {
        format!(
            r#"<a href="{}" style="color:{accent};text-decoration:none;">{}</a>"#,
            esc(href),
            esc(label)
        )
    };
    let mut contact = vec![link(&format!("mailto:{email}"), email)];
    let tel = dial(phone);
    if tel.len() > 4 {
        contact.push(link(&format!("tel:{tel}"), phone));
    }
    contact.push(link(&brand.url, brand.website()));
    let _ = write!(
        h,
        r#"<div style="font-size:13px;color:{MUTED};">{}</div>"#,
        contact.join(r#" <span style="color:#B2AFA8;">·</span> "#)
    );
    if !socials.is_empty() {
        let links: Vec<String> = socials
            .iter()
            .map(|(label, url)| link(url, label))
            .collect();
        let _ = write!(
            h,
            r#"<div style="font-size:12px;color:{MUTED};padding-top:4px;">{}</div>"#,
            links.join(r#" <span style="color:#B2AFA8;">·</span> "#)
        );
    }
    if let Some(tagline) = brand.tagline.as_deref() {
        let _ = write!(
            h,
            r#"<div style="font-family:{serif};font-size:12px;font-style:italic;color:{MUTED};padding-top:8px;">{}</div>"#,
            esc(tagline)
        );
    }
    h.push_str("</td></tr>");

    if let Some(img) = https_url(&p.promo_image) {
        let cols = if photo.is_some() { 3 } else { 2 };
        let alt = if p.promo_alt.trim().is_empty() {
            brand.name.as_str()
        } else {
            p.promo_alt.trim()
        };
        let image = format!(
            r#"<img src="{}" alt="{}" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0;border-radius:8px;">"#,
            esc(&img),
            esc(alt)
        );
        let body = match https_url(&p.promo_link) {
            Some(href) => format!(
                r#"<a href="{}" style="text-decoration:none;">{image}</a>"#,
                esc(&href)
            ),
            None => image,
        };
        let _ = write!(
            h,
            r#"<tr><td colspan="{cols}" style="padding:16px 0 0 0;">{body}</td></tr>"#
        );
    }
    h.push_str("</table>");

    Ok(Signature {
        html: h,
        text: text(brand, name, email, title, phone, &socials),
        brand,
    })
}

fn text(
    brand: &Brand,
    name: &str,
    email: &str,
    title: &str,
    phone: &str,
    socials: &[(&'static str, String)],
) -> String {
    let mut t = String::from(name);
    t.push('\n');
    if title.is_empty() {
        t.push_str(&brand.name);
    } else {
        let _ = write!(t, "{title} · {}", brand.name);
    }
    let _ = write!(t, "\n\n{email}");
    if dial(phone).len() > 4 {
        let _ = write!(t, "\n{phone}");
    }
    let _ = write!(t, "\n{}", brand.website());
    for (label, url) in socials {
        let _ = write!(t, "\n{label}: {url}");
    }
    if let Some(tagline) = brand.tagline.as_deref() {
        let _ = write!(t, "\n\n{tagline}");
    }
    t
}
