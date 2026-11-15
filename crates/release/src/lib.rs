//! nyuchi-release: the release marketing pipeline.
//!
//! One release that is **live in production** becomes, for the owner to
//! review:
//!
//! - a Sanity **draft** post in the brand's studio, with the hero image;
//! - Postiz **drafts**, one per channel, unscheduled, each with an image;
//! - three images from `nyuchi-imaging` in the brand's theme and official
//!   logo: OG 1200×630, square 1080×1080 and story 1080×1920;
//! - one summary comment on the release's tracking issue.
//!
//! This crate is the deterministic part, with no network and no clock: the
//! release file ([`spec`]), the channel map ([`channels`]), the checks every
//! release must pass ([`check`]), the pack it builds ([`pack`]), the ledger
//! that makes re-runs idempotent ([`ledger`]) and the review comment
//! ([`comment`]). The `nyuchi-release` binary adds the I/O: `gh` for
//! gathering and the comment, `curl` for the live gate and the headless
//! publish.
//!
//! Drafting the words is done by whoever runs the pipeline (the agent in a
//! Claude session, or a person) and written into `release.toml`; the
//! pipeline never calls a model. That keeps a run reproducible and
//! reviewable in a pull request, and keeps every claim in the copy one a
//! person or agent has checked against the live release.

pub mod channels;
pub mod check;
pub mod comment;
pub mod ledger;
pub mod pack;
pub mod spec;

/// The Sanity document id for a release: stable, so a re-run finds the same
/// document. Dots are avoided (a dotted id sits in a private path in
/// Sanity), so `bags-1.0.0` becomes `release-bags-1-0-0`.
pub fn document_id(slug: &str) -> String {
    let mut id = String::from("release-");
    for c in slug.chars() {
        id.push(if c.is_ascii_alphanumeric() {
            c.to_ascii_lowercase()
        } else {
            '-'
        });
    }
    id
}

/// A URL-friendly slug from a title: lower case, ASCII letters and digits,
/// single hyphens.
pub fn slugify(title: &str) -> String {
    let mut out = String::new();
    for c in title.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}
