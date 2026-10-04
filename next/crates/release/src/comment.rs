//! The review comment on a release's tracking issue.
//!
//! One comment per release, found again by its marker and edited in place
//! on a re-run, never posted twice.

use crate::ledger::Ledger;
use crate::pack::Pack;
use std::fmt::Write as _;

pub fn marker(slug: &str) -> String {
    format!("<!-- nyuchi-release:{slug} -->")
}

pub fn render(pack: &Pack, ledger: &Ledger, images_url: Option<&str>) -> String {
    let mut s = String::new();
    let _ = writeln!(s, "{}", marker(&pack.slug));
    let _ = writeln!(s, "## Release marketing drafts: `{}`\n", pack.slug);
    let _ = writeln!(
        s,
        "Everything below is a **draft**. Nothing is published or scheduled until you approve it.\n"
    );
    let _ = writeln!(s, "**Live in production** (checked at build):");
    for u in &pack.live {
        let _ = writeln!(s, "- {u}");
    }
    let _ = writeln!(s, "\n**Sanity**");
    match &ledger.sanity {
        Some(e) => {
            let _ = writeln!(
                s,
                "- Draft `drafts.{}` in `{}/{}`: [open in the studio]({})",
                e.document_id, e.project, e.dataset, pack.sanity.studio_url
            );
            let _ = writeln!(s, "- Will publish at {}", pack.sanity.public_url);
        }
        None => {
            let _ = writeln!(s, "- not drafted yet");
        }
    }
    let _ = writeln!(s, "\n**Postiz** (drafts, unscheduled)\n");
    let _ = writeln!(s, "| Channel | Platform | Image | Draft |");
    let _ = writeln!(s, "| --- | --- | --- | --- |");
    for p in &pack.posts {
        let draft = match ledger.postiz.get(&p.channel) {
            Some(e) => match &e.preview {
                Some(url) => format!("[`{}`]({url})", e.post_id),
                None => format!("`{}`", e.post_id),
            },
            None => "not drafted yet".into(),
        };
        let _ = writeln!(
            s,
            "| {} | {} | {} | {draft} |",
            p.name, p.platform, p.image_file
        );
    }
    let _ = writeln!(
        s,
        "\n**Images** (nyuchi-tools: OG 1200×630, square 1080×1080, story 1080×1920)"
    );
    match (images_url, &ledger.sanity) {
        (Some(base), _) => {
            let _ = writeln!(s, "- {base}");
        }
        (None, Some(e)) if !e.asset_urls.is_empty() => {
            for (name, url) in &e.asset_urls {
                let _ = writeln!(s, "- [{name}]({url})");
            }
        }
        _ => {
            let _ = writeln!(s, "- in `out/` beside the release file");
        }
    }
    let _ = writeln!(
        s,
        "\nTo approve: publish the Sanity draft in the studio, and schedule or post each Postiz draft in Postiz."
    );
    s
}
