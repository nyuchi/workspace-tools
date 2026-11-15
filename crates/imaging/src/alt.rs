//! Alt text for every rendered image.
//!
//! Deterministic, from the content itself: what the screenshot shows (the
//! campaign's `image_alt`, which a render with a screenshot must supply)
//! straight after the headline — truncation then cuts the least important
//! words — then the rest of the words on the image. Model-written
//! descriptions are a later phase; this guarantees no image ships without alt text in the meantime.

use crate::layout::Content;

/// Most platforms truncate or cap alt text around here (X allows 1000,
/// but screen-reader users are better served short).
pub const MAX_LEN: usize = 300;

pub fn describe(content: &Content, eyebrow: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    let eyebrow = content.eyebrow.as_deref().unwrap_or(eyebrow);
    let headline = content.headline.trim().trim_end_matches('.');
    if !headline.is_empty() {
        parts.push(format!("{eyebrow}: {headline}."));
    } else {
        parts.push(format!("{eyebrow}."));
    }
    if let Some(alt) = content
        .image_alt
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        parts.push(ensure_stop(alt.trim()));
    }
    if let Some(sub) = content.sub.as_deref().filter(|s| !s.trim().is_empty()) {
        parts.push(ensure_stop(sub.trim()));
    }
    if !content.points.is_empty() {
        parts.push(ensure_stop(&content.points.join("; ")));
    }
    // Whole sentences only: drop the trailing ones that do not fit rather
    // than cutting one mid-word. Only a first sentence that is too long on
    // its own is truncated.
    let mut out = String::new();
    for part in parts {
        let sep = usize::from(!out.is_empty());
        if out.chars().count() + sep + part.chars().count() <= MAX_LEN {
            if sep == 1 {
                out.push(' ');
            }
            out.push_str(&part);
        } else if out.is_empty() {
            out = part
                .chars()
                .take(MAX_LEN - 1)
                .collect::<String>()
                .trim_end()
                .to_string()
                + "…";
        }
    }
    out
}

fn ensure_stop(s: &str) -> String {
    if s.ends_with(['.', '!', '?', '…']) {
        s.to_string()
    } else {
        format!("{s}.")
    }
}
