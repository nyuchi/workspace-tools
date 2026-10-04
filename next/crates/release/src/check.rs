//! The checks every release passes before anything is built or drafted.
//!
//! - **Shape:** the brand, the Sanity target, every channel and image exist;
//!   the title, description and every social post fit their limits.
//! - **British spelling:** a list of American forms is refused outside URLs
//!   (`color`, `organization`, `-ize` verbs…), and `license` as a noun.
//! - **Privacy:** no school, student or staff data. The blocked-terms list
//!   (`NYUCHI_BLOCKED_TERMS_FILE`, kept outside the repo) is checked against
//!   every word, and any email address outside the ecosystem's own domains
//!   is refused.
//!
//! The live gate (every `live` URL answers 200) needs the network, so the
//! binary runs it; see [`crate::spec::Release::live`].

use crate::channels::Channels;
use crate::spec::{IMAGES, Loaded};

/// American forms refused in copy. Whole words, case-insensitive.
const AMERICAN: &[(&str, &str)] = &[
    ("color", "colour"),
    ("colors", "colours"),
    ("colored", "coloured"),
    ("organization", "organisation"),
    ("organizations", "organisations"),
    ("organize", "organise"),
    ("organized", "organised"),
    ("organizing", "organising"),
    ("center", "centre"),
    ("centers", "centres"),
    ("behavior", "behaviour"),
    ("behaviors", "behaviours"),
    ("favor", "favour"),
    ("favorite", "favourite"),
    ("honor", "honour"),
    ("labor", "labour"),
    ("neighbor", "neighbour"),
    ("neighborhood", "neighbourhood"),
    ("analyze", "analyse"),
    ("analyzed", "analysed"),
    ("recognize", "recognise"),
    ("recognized", "recognised"),
    ("prioritize", "prioritise"),
    ("realize", "realise"),
    ("customize", "customise"),
    ("standardize", "standardise"),
    ("standardized", "standardised"),
    ("optimize", "optimise"),
    ("optimized", "optimised"),
    ("summarize", "summarise"),
    ("apologize", "apologise"),
    ("catalog", "catalogue"),
    ("defense", "defence"),
    ("offense", "offence"),
    ("traveling", "travelling"),
    ("modeling", "modelling"),
    ("enrollment", "enrolment"),
    ("judgment", "judgement"),
    ("toward", "towards"),
];

/// Words that make the next `license` a noun (`the license`, `a license`).
const NOUN_BEFORE: &[&str] = &[
    "a", "an", "the", "this", "that", "our", "its", "their", "your", "open", "same", "free",
];

/// Length as the platform counts it. X counts every URL as 23 characters
/// (t.co); the others count characters.
pub fn weighted_len(text: &str, platform: &str) -> usize {
    if platform != "x" {
        return text.chars().count();
    }
    let mut n = 0;
    for (i, word) in text.split(' ').enumerate() {
        if i > 0 {
            n += 1;
        }
        // Count line breaks inside the word, then the word.
        let mut parts = word.split('\n').peekable();
        while let Some(p) = parts.next() {
            if is_url(p) {
                n += 23;
            } else {
                n += p.chars().count();
            }
            if parts.peek().is_some() {
                n += 1;
            }
        }
    }
    n
}

fn is_url(w: &str) -> bool {
    w.starts_with("https://") || w.starts_with("http://")
}

/// Words of `text` outside URLs and inline code, lower-cased, with their
/// neighbours' punctuation stripped.
fn words(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut in_code = false;
    for raw in text.split_whitespace() {
        let ticks = raw.matches('`').count();
        let was_code = in_code;
        if ticks % 2 == 1 {
            in_code = !in_code;
        }
        if was_code || ticks > 0 || is_url(raw) || raw.contains("](") || raw.contains("://") {
            continue;
        }
        for w in raw.split(|c: char| !c.is_alphanumeric() && c != '\'' && c != '-') {
            let w = w.trim_matches(|c| c == '\'' || c == '-');
            if !w.is_empty() {
                out.push(w.to_lowercase());
            }
        }
    }
    out
}

/// American spellings in `text`, as `found → British` hints.
pub fn american_spellings(text: &str) -> Vec<String> {
    let ws = words(text);
    let mut out = Vec::new();
    for (i, w) in ws.iter().enumerate() {
        if let Some((us, gb)) = AMERICAN.iter().find(|(us, _)| us == w) {
            out.push(format!("{us} → {gb}"));
        }
        if w == "license" && i > 0 && NOUN_BEFORE.contains(&ws[i - 1].as_str()) {
            out.push("license (noun) → licence".into());
        }
        if w == "licenses" && i > 0 && NOUN_BEFORE.contains(&ws[i - 1].as_str()) {
            out.push("licenses (noun) → licences".into());
        }
    }
    out
}

/// Email addresses in `text` whose domain is not one of `allowed`.
pub fn foreign_emails(text: &str, allowed: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for raw in text.split_whitespace() {
        let w = raw.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.');
        let w = w.trim_end_matches('.');
        if let Some((local, domain)) = w.split_once('@')
            && !local.is_empty()
            && domain.contains('.')
        {
            let d = domain.to_lowercase();
            let ok = allowed
                .iter()
                .any(|a| d == *a || d.ends_with(&format!(".{a}")));
            if !ok {
                out.push(w.to_string());
            }
        }
    }
    out
}

/// Every text a release publishes, labelled.
pub fn texts(l: &Loaded) -> Vec<(String, String)> {
    let r = &l.release;
    let mut out = vec![
        ("post.title".to_string(), r.post.title.clone()),
        ("post.description".into(), r.post.description.clone()),
        ("post.body".into(), l.body.clone()),
        ("images.headline".into(), r.images.headline.clone()),
    ];
    for (k, v) in [
        ("images.eyebrow", &r.images.eyebrow),
        ("images.sub", &r.images.sub),
        ("images.cta", &r.images.cta),
    ] {
        if let Some(v) = v {
            out.push((k.into(), v.clone()));
        }
    }
    for p in &r.images.points {
        out.push(("images.points".into(), p.clone()));
    }
    for (name, o) in [
        ("og", &r.images.og),
        ("square", &r.images.square),
        ("story", &r.images.story),
    ] {
        if let Some(o) = o {
            for v in [&o.headline, &o.sub].into_iter().flatten() {
                out.push((format!("images.{name}"), v.clone()));
            }
            for p in o.points.iter().flatten() {
                out.push((format!("images.{name}.points"), p.clone()));
            }
        }
    }
    for s in &r.socials {
        out.push((format!("social[{}]", s.channel), s.text.clone()));
    }
    out
}

/// Run every offline check. An empty list is a pass.
pub fn run(l: &Loaded, channels: &Channels, blocked_terms: &[String]) -> Vec<String> {
    let r = &l.release;
    let mut problems = Vec::new();

    if r.slug.is_empty()
        || !r
            .slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
    {
        problems.push(format!(
            "slug {:?}: use lower-case letters, digits, '-' and '.'",
            r.slug
        ));
    }
    if nyuchi_brands::get(&r.brand).is_none() {
        problems.push(format!("brand {:?} is not in brands.toml", r.brand));
    }
    match channels.brand.get(&r.brand) {
        None => problems.push(format!(
            "brand {:?} has no [brand.{}] target in channels.toml",
            r.brand, r.brand
        )),
        Some(t) => {
            if nyuchi_imaging::theme::get(&t.theme).is_none() {
                problems.push(format!("theme {:?} is not in nyuchi-imaging", t.theme));
            }
            if r.post.audience.is_some() && !t.sanity.audience {
                problems.push("post.audience is set, but this studio has no audience field".into());
            }
        }
    }
    let Some((owner_repo, n)) = r.tracking_issue.split_once('#') else {
        problems.push("tracking_issue must be owner/repo#number".into());
        return problems;
    };
    if !owner_repo.contains('/') || n.parse::<u64>().is_err() {
        problems.push("tracking_issue must be owner/repo#number".into());
    }
    if r.live.is_empty() {
        problems.push("live: list at least one production URL".into());
    }
    for u in &r.live {
        if !u.starts_with("https://") {
            problems.push(format!("live URL {u:?} must be https://"));
        }
    }

    let title = r.post.title.chars().count();
    if title == 0 || title > 140 {
        problems.push(format!("post.title is {title} characters (1–140)"));
    }
    let desc = r.post.description.chars().count();
    if desc == 0 || desc > 280 {
        problems.push(format!("post.description is {desc} characters (1–280)"));
    }
    if l.body.trim().is_empty() {
        problems.push("post body is empty".into());
    }
    if r.post.date.len() != 10 || r.post.date.as_bytes()[4] != b'-' {
        problems.push("post.date must be YYYY-MM-DD".into());
    }
    if r.images.headline.trim().is_empty() {
        problems.push("images.headline is empty".into());
    }

    let mut seen = std::collections::BTreeSet::new();
    for s in &r.socials {
        if !seen.insert(s.channel.as_str()) {
            problems.push(format!(
                "social[{}] appears twice: one draft per channel",
                s.channel
            ));
        }
        let Some(ch) = channels.get(&s.channel) else {
            problems.push(format!("social[{}]: no such channel", s.channel));
            continue;
        };
        if !IMAGES.contains(&s.image.as_str()) {
            problems.push(format!(
                "social[{}]: image {:?} is not one of og, square, story",
                s.channel, s.image
            ));
        }
        let len = weighted_len(s.text.trim(), &ch.platform);
        if len > ch.max {
            problems.push(format!(
                "social[{}]: {len} characters, {} allows {}",
                s.channel, ch.platform, ch.max
            ));
        }
        if s.text.trim().is_empty() {
            problems.push(format!("social[{}]: empty", s.channel));
        }
    }

    let allowed: Vec<&str> = nyuchi_brands::all()
        .iter()
        .flat_map(|b| b.domains.iter().map(String::as_str))
        .collect();
    for (field, text) in texts(l) {
        for hint in american_spellings(&text) {
            problems.push(format!("{field}: British spelling: {hint}"));
        }
        for e in foreign_emails(&text, &allowed) {
            problems.push(format!(
                "{field}: email address {e:?} is outside the ecosystem's domains"
            ));
        }
        let lower = text.to_lowercase();
        if blocked_terms
            .iter()
            .any(|t| !t.is_empty() && lower.contains(&t.to_lowercase()))
        {
            // The term itself is not echoed.
            problems.push(format!(
                "{field}: contains a blocked term (school, student or staff data never appears)"
            ));
        }
    }
    problems
}
