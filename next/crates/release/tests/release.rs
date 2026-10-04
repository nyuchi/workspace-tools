use nyuchi_release::channels;
use nyuchi_release::check::{american_spellings, foreign_emails, weighted_len};
use nyuchi_release::comment;
use nyuchi_release::ledger::{Ledger, PostizEntry};
use nyuchi_release::pack;
use nyuchi_release::spec::{self, Loaded};
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../releases")
}

fn channels() -> channels::Channels {
    channels::load(&root().join("channels.toml")).expect("channels.toml")
}

fn loaded(src: &str, body: &str) -> Loaded {
    Loaded {
        release: spec::parse(src).expect("release parses"),
        body: body.into(),
        dir: PathBuf::from("."),
    }
}

const MINIMAL: &str = r#"
slug = "demo-1.0.0"
brand = "bundu"
tracking_issue = "nyuchi/workspace-tools#83"
live = ["https://www.bundu.org/"]
[post]
title = "A demo release"
description = "One sentence."
date = "2026-10-04"
body = "post.md"
[images]
headline = "A headline."
[[social]]
channel = "nyuchi-x"
text = "Short and sweet. https://www.bundu.org/research/standards/ai-guardrails"
"#;

#[test]
fn every_committed_release_passes_its_checks() {
    let ch = channels();
    for entry in std::fs::read_dir(root()).unwrap() {
        let path = entry.unwrap().path().join("release.toml");
        if path.exists() {
            let l = spec::load(&path).unwrap();
            let problems = nyuchi_release::check::run(&l, &ch, &[]);
            assert!(problems.is_empty(), "{}: {problems:#?}", path.display());
        }
    }
}

#[test]
fn channel_map_is_consistent() {
    let ch = channels();
    for (key, target) in &ch.brand {
        assert!(nyuchi_brands::get(key).is_some(), "{key} is not a brand");
        assert!(target.sanity.public_prefix.starts_with("https://"));
        assert!(target.sanity.public_prefix.ends_with('/'));
    }
    for c in &ch.channels {
        assert!(c.max > 0, "{}", c.key);
        assert!(!c.integration.is_empty(), "{}", c.key);
    }
    assert!(nyuchi_imaging::theme::get(&ch.brand["bundu"].theme).is_some());
}

#[test]
fn a_minimal_release_passes() {
    let problems = nyuchi_release::check::run(&loaded(MINIMAL, "Body."), &channels(), &[]);
    assert!(problems.is_empty(), "{problems:#?}");
}

#[test]
fn x_counts_a_url_as_23() {
    let url = "https://www.bundu.org/research/standards/ai-guardrails";
    assert_eq!(weighted_len(&format!("Hi {url}"), "x"), 3 + 23);
    assert_eq!(
        weighted_len(&format!("Hi {url}"), "linkedin-page"),
        3 + url.len()
    );
    assert_eq!(weighted_len("a\nb", "x"), 3);
}

#[test]
fn over_length_posts_are_refused() {
    let long = "word ".repeat(80);
    let src = MINIMAL.replace(
        "Short and sweet. https://www.bundu.org/research/standards/ai-guardrails",
        long.trim(),
    );
    let problems = nyuchi_release::check::run(&loaded(&src, "Body."), &channels(), &[]);
    assert!(
        problems.iter().any(|p| p.contains("x allows 280")),
        "{problems:#?}"
    );
}

#[test]
fn american_spelling_is_refused_but_not_in_urls() {
    assert_eq!(
        american_spellings("The color of the organization."),
        ["color → colour", "organization → organisation"]
    );
    assert!(american_spellings("see https://example.org/color and `color`").is_empty());
    assert_eq!(
        american_spellings("under the license"),
        ["license (noun) → licence"]
    );
    // The verb is fine.
    assert!(american_spellings("we license it, and it is licensed").is_empty());
}

#[test]
fn outside_emails_are_refused_ecosystem_ones_allowed() {
    let allowed = ["nyuchi.com", "bundu.org"];
    assert!(foreign_emails("write to privacy@nyuchi.com.", &allowed).is_empty());
    assert_eq!(
        foreign_emails("contact jane@example.edu today", &allowed),
        ["jane@example.edu"]
    );
}

#[test]
fn blocked_terms_are_refused_without_echoing_them() {
    let src = MINIMAL.replace("A headline.", "Built with Example Academy.");
    let problems = nyuchi_release::check::run(
        &loaded(&src, "Body."),
        &channels(),
        &["example academy".to_string()],
    );
    assert_eq!(problems.len(), 1, "{problems:#?}");
    assert!(!problems[0].to_lowercase().contains("academy"));
}

#[test]
fn a_release_must_name_live_urls_and_known_channels() {
    let src = MINIMAL
        .replace(r#"live = ["https://www.bundu.org/"]"#, "live = []")
        .replace("nyuchi-x", "nowhere");
    let problems = nyuchi_release::check::run(&loaded(&src, "Body."), &channels(), &[]);
    assert!(problems.iter().any(|p| p.starts_with("live:")));
    assert!(problems.iter().any(|p| p.contains("no such channel")));
}

#[test]
fn the_pack_is_stable_drafts_only_and_ids_are_fixed() {
    let l = loaded(MINIMAL, "Body.");
    let alt = |n: &str| format!("alt for {n}");
    let p = pack::build(&l, &channels(), &alt);
    assert_eq!(p.sanity.document_id, "release-demo-1-0-0");
    assert_eq!(p.sanity.document["_type"], "post");
    assert_eq!(p.sanity.document["slug"]["current"], "a-demo-release");
    assert!(
        p.sanity.document.get("_id").is_none(),
        "publish sets drafts.<id>"
    );
    assert_eq!(p.posts.len(), 1);
    assert_eq!(p.posts[0].settings["__type"], "x");
    assert!(p.posts[0].html.starts_with("<p>"));
    // Same input, same pack.
    let again = pack::build(&l, &channels(), &alt);
    assert_eq!(
        serde_json::to_string(&p).unwrap(),
        serde_json::to_string(&again).unwrap()
    );
}

#[test]
fn html_is_escaped_one_paragraph_per_line() {
    assert_eq!(
        pack::to_html("a < b\n\nc & d\n"),
        "<p>a &lt; b</p><p>c &amp; d</p>"
    );
}

#[test]
fn the_ledger_makes_reruns_skip_drafted_channels() {
    let l = loaded(MINIMAL, "Body.");
    let p = pack::build(&l, &channels(), &|_| String::new());
    let mut ledger = Ledger::default();
    assert_eq!(ledger.pending(&p).len(), 1);
    ledger.postiz.insert(
        "nyuchi-x".into(),
        PostizEntry {
            post_id: "abc".into(),
            group: None,
            preview: None,
        },
    );
    assert!(ledger.pending(&p).is_empty());
    let body = comment::render(&p, &ledger, None);
    assert!(body.starts_with(&comment::marker("demo-1.0.0")));
    assert!(body.contains("`abc`"));
    assert!(body.contains("**draft**"));
}

#[test]
fn the_campaign_renders_og_square_and_story_in_the_brand_theme() {
    let l = loaded(MINIMAL, "Body.");
    let toml = pack::campaign_toml(&l.release.images, "bundu");
    let c = nyuchi_imaging::campaign::parse(toml.split_once("\n\n").unwrap().1).unwrap();
    assert_eq!(c.theme, "bundu");
    let presets: Vec<_> = c.renders.iter().map(|r| r.preset.as_str()).collect();
    assert_eq!(presets, ["og", "square", "story"]);
}
