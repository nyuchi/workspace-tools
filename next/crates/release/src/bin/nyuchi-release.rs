//! nyuchi-release — market a live release, as drafts.
//!
//!   nyuchi-release gather <owner/repo> [--tag T] [--pr N]... [--issue N]...
//!   nyuchi-release check   <releases/<slug>/release.toml>
//!   nyuchi-release build   <release.toml> [--offline]
//!   nyuchi-release status  <release.toml>
//!   nyuchi-release publish <release.toml> [--dry-run]
//!   nyuchi-release record  <release.toml> [--sanity-asset NAME=ID=URL]...
//!                          [--sanity-doc] [--postiz CHANNEL=POST_ID[=PREVIEW]]...
//!   nyuchi-release comment <release.toml> [--post]
//!
//! `gather` prints the facts (release notes, PRs, issues, changelog) for the
//! drafter. `build` runs the checks, refuses unless every `live` URL answers
//! 200, renders the images and writes `out/pack.json`. `publish` sends the
//! pack as drafts — Sanity (`SANITY_API_TOKEN`) and Postiz
//! (`POSTIZ_API_KEY`) — skipping whatever the ledger already has. `record`
//! writes the ledger when the drafts were made another way (the Sanity and
//! Postiz MCP tools). `comment` renders the review comment and, with
//! `--post`, creates or edits it on the tracking issue with `gh`.
//!
//! Nothing here publishes or schedules. Secrets are read from the
//! environment, passed to curl on stdin, and never printed.

use nyuchi_imaging::privacy::Privacy;
use nyuchi_release::channels::{self, Channels};
use nyuchi_release::ledger::{self, PostizEntry, SanityEntry};
use nyuchi_release::pack::{self, Pack};
use nyuchi_release::{check, comment, spec};
use serde_json::{Value, json};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

const USAGE: &str = "usage: nyuchi-release <gather|check|build|status|publish|record|comment> …
  gather  <owner/repo> [--tag T] [--pr N]... [--issue N]...
  check   <release.toml>
  build   <release.toml> [--offline]
  status  <release.toml>
  publish <release.toml> [--dry-run]
  record  <release.toml> [--sanity-asset NAME=ID=URL]... [--sanity-doc] [--postiz CHANNEL=ID[=PREVIEW]]...
  comment <release.toml> [--post]";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let rest = args.get(1..).unwrap_or(&[]);
    let result = match args.first().map(String::as_str) {
        Some("gather") => gather(rest),
        Some("check") => with_release(rest, |c| check_cmd(&c).map(|_| ())),
        Some("build") => with_release(rest, |c| build(&c, rest.iter().any(|a| a == "--offline"))),
        Some("status") => with_release(rest, |c| status(&c)),
        Some("publish") => {
            with_release(rest, |c| publish(&c, rest.iter().any(|a| a == "--dry-run")))
        }
        Some("record") => with_release(rest, |c| record(&c, rest)),
        Some("comment") => with_release(rest, |c| {
            comment_cmd(&c, rest.iter().any(|a| a == "--post"))
        }),
        _ => Err(USAGE.into()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}

struct Ctx {
    loaded: spec::Loaded,
    channels: Channels,
    out: PathBuf,
    ledger_path: PathBuf,
}

fn with_release(args: &[String], f: impl FnOnce(Ctx) -> Result<(), String>) -> Result<(), String> {
    let path = args.first().filter(|a| !a.starts_with("--")).ok_or(USAGE)?;
    let path = Path::new(path);
    let loaded = spec::load(path)?;
    // releases/<slug>/release.toml → releases/channels.toml
    let channels_path = loaded
        .dir
        .parent()
        .unwrap_or(Path::new("."))
        .join("channels.toml");
    let channels = channels::load(&channels_path)?;
    let out = loaded.dir.join("out");
    let ledger_path = loaded.dir.join("ledger.json");
    f(Ctx {
        loaded,
        channels,
        out,
        ledger_path,
    })
}

fn blocked_terms() -> Result<Vec<String>, String> {
    match std::env::var_os("NYUCHI_BLOCKED_TERMS_FILE") {
        Some(path) => std::fs::read_to_string(&path)
            .map(|s| Privacy::terms_from_str(&s))
            .map_err(|e| format!("NYUCHI_BLOCKED_TERMS_FILE: {e}")),
        None => {
            eprintln!("note: NYUCHI_BLOCKED_TERMS_FILE is not set; only the built-in checks ran");
            Ok(Vec::new())
        }
    }
}

fn check_cmd(c: &Ctx) -> Result<(), String> {
    let problems = check::run(&c.loaded, &c.channels, &blocked_terms()?);
    if problems.is_empty() {
        println!("ok: {} passes every check", c.loaded.release.slug);
        Ok(())
    } else {
        Err(format!(
            "{} problem(s):\n  - {}",
            problems.len(),
            problems.join("\n  - ")
        ))
    }
}

/// The live gate: every URL must answer 200 (redirects followed).
fn live_gate(urls: &[String]) -> Result<(), String> {
    let mut down = Vec::new();
    for u in urls {
        let out = Command::new("curl")
            .args([
                "-s",
                "-o",
                "/dev/null",
                "-L",
                "--max-time",
                "20",
                "-w",
                "%{http_code}",
                u,
            ])
            .output()
            .map_err(|e| format!("curl: {e}"))?;
        let code = String::from_utf8_lossy(&out.stdout).to_string();
        if code != "200" {
            down.push(format!("{u} → {code}"));
        } else {
            println!("live: {u}");
        }
    }
    if down.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "not live in production, so not marketed:\n  - {}",
            down.join("\n  - ")
        ))
    }
}

fn build(c: &Ctx, offline: bool) -> Result<(), String> {
    check_cmd(c)?;
    if offline {
        eprintln!("note: --offline skipped the live gate; do not publish this pack");
    } else {
        live_gate(&c.loaded.release.live)?;
    }
    let target = &c.channels.brand[&c.loaded.release.brand];
    std::fs::create_dir_all(&c.out).map_err(|e| e.to_string())?;
    let campaign = c.out.join("campaign.toml");
    std::fs::write(
        &campaign,
        pack::campaign_toml(&c.loaded.release.images, &target.theme),
    )
    .map_err(|e| e.to_string())?;
    let manifest = nyuchi_imaging::campaign::run(&campaign, blocked_terms()?)?;
    for m in &manifest {
        println!(
            "image: out/{} {}×{} ({} bytes)",
            m.file, m.width, m.height, m.bytes
        );
    }
    let alts = |name: &str| {
        manifest
            .iter()
            .find(|m| m.file == format!("{name}.png"))
            .map(|m| m.alt.clone())
            .unwrap_or_default()
    };
    let p = pack::build(&c.loaded, &c.channels, &alts);
    let json = serde_json::to_string_pretty(&p).map_err(|e| e.to_string())?;
    std::fs::write(c.out.join("pack.json"), json + "\n").map_err(|e| e.to_string())?;
    println!(
        "pack: out/pack.json ({} Postiz drafts, 1 Sanity draft)",
        p.posts.len()
    );
    Ok(())
}

fn read_pack(c: &Ctx) -> Result<Pack, String> {
    // Rebuild in memory from the release and the manifest, so the pack
    // always matches the release file; the images must exist.
    let manifest_path = c.out.join("manifest.json");
    let manifest: Value = serde_json::from_str(
        &std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("{}: {e} (run build first)", manifest_path.display()))?,
    )
    .map_err(|e| e.to_string())?;
    let alts = |name: &str| {
        manifest
            .as_array()
            .into_iter()
            .flatten()
            .find(|m| m["file"] == format!("{name}.png"))
            .and_then(|m| m["alt"].as_str())
            .unwrap_or_default()
            .to_string()
    };
    Ok(pack::build(&c.loaded, &c.channels, &alts))
}

fn status(c: &Ctx) -> Result<(), String> {
    let p = read_pack(c)?;
    let l = ledger::load(&c.ledger_path)?;
    match &l.sanity {
        Some(e) => println!("sanity: drafted (drafts.{})", e.document_id),
        None => println!(
            "sanity: pending → {}/{} drafts.{}",
            p.sanity.project, p.sanity.dataset, p.sanity.document_id
        ),
    }
    for d in &p.posts {
        match l.postiz.get(&d.channel) {
            Some(e) => println!("postiz {}: drafted ({})", d.channel, e.post_id),
            None => println!(
                "postiz {}: pending ({} {})",
                d.channel, d.platform, d.integration
            ),
        }
    }
    println!(
        "comment: {}",
        if l.comment.is_some() {
            "posted"
        } else {
            "pending"
        }
    );
    Ok(())
}

/// Run curl with a secret header given on stdin (never on the command line).
fn curl(secret_header: &str, args: &[&str], body: Option<&str>) -> Result<Value, String> {
    let mut config = format!("header = \"{}\"\n", secret_header.replace('"', ""));
    if let Some(b) = body {
        // The body goes in a temp file named in the config.
        let tmp = std::env::temp_dir().join(format!("nyuchi-release-{}.json", std::process::id()));
        std::fs::write(&tmp, b).map_err(|e| e.to_string())?;
        config.push_str(&format!("data-binary = \"@{}\"\n", tmp.display()));
        config.push_str("header = \"Content-Type: application/json\"\n");
    }
    let mut child = Command::new("curl")
        .args(["-sS", "--fail-with-body", "--config", "-"])
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("curl: {e}"))?;
    child
        .stdin
        .take()
        .expect("stdin")
        .write_all(config.as_bytes())
        .map_err(|e| e.to_string())?;
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if body.is_some() {
        let _ = std::fs::remove_file(
            std::env::temp_dir().join(format!("nyuchi-release-{}.json", std::process::id())),
        );
    }
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    if !out.status.success() {
        return Err(format!(
            "request failed: {} {}",
            String::from_utf8_lossy(&out.stderr).trim(),
            text.chars().take(400).collect::<String>()
        ));
    }
    serde_json::from_str(&text).map_err(|e| format!("unexpected response ({e})"))
}

fn env(name: &str) -> Result<String, String> {
    std::env::var(name).map_err(|_| {
        format!("{name} is not set (1Password: the workspace-tools vault; never commit it)")
    })
}

fn publish(c: &Ctx, dry_run: bool) -> Result<(), String> {
    let p = read_pack(c)?;
    live_gate(&p.live)?;
    let mut l = ledger::load(&c.ledger_path)?;
    const SANITY_API: &str = "v2025-02-19";

    // ── Sanity: images, then the draft (createIfNotExists: never clobbers).
    if l.sanity.is_none() {
        if dry_run {
            println!(
                "would upload og/square/story to {}/{} and create drafts.{}",
                p.sanity.project, p.sanity.dataset, p.sanity.document_id
            );
        } else {
            let auth = format!("Authorization: Bearer {}", env("SANITY_API_TOKEN")?);
            let mut entry = SanityEntry {
                project: p.sanity.project.clone(),
                dataset: p.sanity.dataset.clone(),
                document_id: p.sanity.document_id.clone(),
                assets: Default::default(),
                asset_urls: Default::default(),
            };
            for name in spec::IMAGES {
                let file = c.out.join(format!("{name}.png"));
                let url = format!(
                    "https://{}.api.sanity.io/{SANITY_API}/assets/images/{}?filename={}-{name}.png",
                    p.sanity.project, p.sanity.dataset, p.slug
                );
                let data = format!("@{}", file.display());
                let res = curl(
                    &auth,
                    &[
                        "-X",
                        "POST",
                        "-H",
                        "Content-Type: image/png",
                        "--data-binary",
                        &data,
                        &url,
                    ],
                    None,
                )?;
                let doc = &res["document"];
                entry
                    .assets
                    .insert(name.into(), doc["_id"].as_str().unwrap_or_default().into());
                entry
                    .asset_urls
                    .insert(name.into(), doc["url"].as_str().unwrap_or_default().into());
            }
            let mut doc = p.sanity.document.clone();
            doc["_id"] = json!(format!("drafts.{}", p.sanity.document_id));
            doc["heroImage"] = json!({
                "_type": "image",
                "alt": p.sanity.hero_alt,
                "asset": { "_type": "reference", "_ref": entry.assets["og"] },
            });
            let body = json!({ "mutations": [ { "createIfNotExists": doc } ] }).to_string();
            let url = format!(
                "https://{}.api.sanity.io/{SANITY_API}/data/mutate/{}",
                p.sanity.project, p.sanity.dataset
            );
            curl(&auth, &["-X", "POST", &url], Some(&body))?;
            println!("sanity: drafts.{}", p.sanity.document_id);
            l.sanity = Some(entry);
            ledger::save(&c.ledger_path, &l)?;
        }
    } else {
        println!("sanity: already drafted, skipped");
    }

    // ── Postiz: one draft per channel the ledger does not have.
    let base = std::env::var("POSTIZ_API_URL")
        .unwrap_or_else(|_| "https://api.postiz.com/public/v1".into());
    let pending: Vec<_> = l
        .pending(&p)
        .into_iter()
        .map(|d| d.channel.clone())
        .collect();
    if pending.is_empty() {
        println!("postiz: every channel already drafted, skipped");
    }
    for ch in pending {
        let d = p
            .posts
            .iter()
            .find(|d| d.channel == ch)
            .expect("pending is from the pack");
        if dry_run {
            println!(
                "would draft {} ({}) with {}: {} characters",
                d.channel,
                d.platform,
                d.image_file,
                d.html.len()
            );
            continue;
        }
        let auth = format!("Authorization: {}", env("POSTIZ_API_KEY")?);
        let file = c.out.join(&d.image_file);
        let form = format!("file=@{}", file.display());
        let up = curl(
            &auth,
            &["-X", "POST", "-F", &form, &format!("{base}/upload")],
            None,
        )?;
        let image = json!([{ "id": up["id"], "path": up["path"] }]);
        let body = json!({
            "type": "draft",
            "date": now_utc(),
            "shortLink": false,
            "tags": [],
            "posts": [{
                "integration": { "id": d.integration },
                "value": [{ "content": d.html, "image": image }],
                "settings": d.settings,
            }],
        })
        .to_string();
        let res = curl(
            &auth,
            &["-X", "POST", &format!("{base}/posts")],
            Some(&body),
        )?;
        let first = res
            .as_array()
            .and_then(|a| a.first())
            .cloned()
            .unwrap_or(res);
        let post_id = first["postId"]
            .as_str()
            .or_else(|| first["id"].as_str())
            .unwrap_or_default()
            .to_string();
        if post_id.is_empty() {
            return Err(format!("postiz {}: no post id in the response", d.channel));
        }
        println!("postiz {}: draft {post_id}", d.channel);
        l.postiz.insert(
            d.channel.clone(),
            PostizEntry {
                post_id,
                group: first["group"].as_str().map(String::from),
                preview: None,
            },
        );
        ledger::save(&c.ledger_path, &l)?;
    }
    Ok(())
}

fn now_utc() -> String {
    // Postiz needs a date even for a draft; the draft is unscheduled.
    let out = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%S"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    if out.is_empty() {
        "2026-01-01T00:00:00".into()
    } else {
        out
    }
}

fn record(c: &Ctx, args: &[String]) -> Result<(), String> {
    let p = read_pack(c)?;
    let mut l = ledger::load(&c.ledger_path)?;
    let mut it = args.iter().skip(1);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--sanity-doc" | "--sanity-asset" => {
                let e = l.sanity.get_or_insert_with(|| SanityEntry {
                    project: p.sanity.project.clone(),
                    dataset: p.sanity.dataset.clone(),
                    document_id: p.sanity.document_id.clone(),
                    assets: Default::default(),
                    asset_urls: Default::default(),
                });
                if a == "--sanity-asset" {
                    let v = it.next().ok_or("--sanity-asset NAME=ID=URL")?;
                    let mut parts = v.splitn(3, '=');
                    let (Some(n), Some(id), Some(url)) = (parts.next(), parts.next(), parts.next())
                    else {
                        return Err("--sanity-asset NAME=ID=URL".into());
                    };
                    e.assets.insert(n.into(), id.into());
                    e.asset_urls.insert(n.into(), url.into());
                }
            }
            "--postiz" => {
                let v = it.next().ok_or("--postiz CHANNEL=POST_ID[=PREVIEW]")?;
                let mut parts = v.splitn(3, '=');
                let (Some(ch), Some(id)) = (parts.next(), parts.next()) else {
                    return Err("--postiz CHANNEL=POST_ID[=PREVIEW]".into());
                };
                if !p.posts.iter().any(|d| d.channel == ch) {
                    return Err(format!("{ch} is not a channel of this release"));
                }
                l.postiz.insert(
                    ch.into(),
                    PostizEntry {
                        post_id: id.into(),
                        group: None,
                        preview: parts.next().map(String::from),
                    },
                );
            }
            other => return Err(format!("unknown option {other}\n{USAGE}")),
        }
    }
    ledger::save(&c.ledger_path, &l)?;
    println!("ledger: {}", c.ledger_path.display());
    Ok(())
}

fn gh(args: &[&str], stdin: Option<&str>) -> Result<String, String> {
    let mut child = Command::new("gh")
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("gh: {e}"))?;
    if let Some(s) = stdin {
        child
            .stdin
            .take()
            .expect("stdin")
            .write_all(s.as_bytes())
            .map_err(|e| e.to_string())?;
    } else {
        drop(child.stdin.take());
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!(
            "gh {}: {}",
            args.join(" "),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn comment_cmd(c: &Ctx, post: bool) -> Result<(), String> {
    let p = read_pack(c)?;
    let mut l = ledger::load(&c.ledger_path)?;
    let body = comment::render(&p, &l, None);
    if !post {
        print!("{body}");
        return Ok(());
    }
    let (repo, n) = p.tracking_issue.split_once('#').ok_or("tracking_issue")?;
    let marker = comment::marker(&p.slug);
    let list = gh(
        &[
            "api",
            "--paginate",
            &format!("repos/{repo}/issues/{n}/comments"),
            "--jq",
            &format!(".[] | select(.body | contains(\"{marker}\")) | .id"),
        ],
        None,
    )?;
    let payload = json!({ "body": body }).to_string();
    let url = match list.lines().next().map(str::trim).filter(|s| !s.is_empty()) {
        Some(id) => {
            let r = gh(
                &[
                    "api",
                    "-X",
                    "PATCH",
                    &format!("repos/{repo}/issues/comments/{id}"),
                    "--input",
                    "-",
                    "--jq",
                    ".html_url",
                ],
                Some(&payload),
            )?;
            println!("comment: edited {}", r.trim());
            r
        }
        None => {
            let r = gh(
                &[
                    "api",
                    "-X",
                    "POST",
                    &format!("repos/{repo}/issues/{n}/comments"),
                    "--input",
                    "-",
                    "--jq",
                    ".html_url",
                ],
                Some(&payload),
            )?;
            println!("comment: posted {}", r.trim());
            r
        }
    };
    l.comment = Some(url.trim().to_string());
    ledger::save(&c.ledger_path, &l)
}

fn gather(args: &[String]) -> Result<(), String> {
    let repo = args.first().filter(|a| a.contains('/')).ok_or(USAGE)?;
    let mut it = args.iter().skip(1);
    let mut out = format!("# Facts for a release of {repo}\n");
    while let Some(a) = it.next() {
        let v = it.next().ok_or(USAGE)?;
        match a.as_str() {
            "--tag" => {
                let r = gh(&["release", "view", v, "-R", repo, "--json", "name,tagName,publishedAt,url,body",
                             "--template", "## Release {{.name}} ({{.tagName}}, {{.publishedAt}})\n{{.url}}\n\n{{.body}}\n"], None)
                    .unwrap_or_else(|e| format!("## Release {v}\n(no GitHub release: {e})\n"));
                out.push_str(&r);
            }
            "--pr" => {
                let r = gh(
                    &[
                        "pr",
                        "view",
                        v,
                        "-R",
                        repo,
                        "--json",
                        "number,title,url,mergedAt,state,body",
                        "--template",
                        "## PR #{{.number}}: {{.title}} ({{.state}}, merged {{.mergedAt}})\n{{.url}}\n\n{{.body}}\n",
                    ],
                    None,
                )?;
                out.push_str(&r);
            }
            "--issue" => {
                let r = gh(
                    &[
                        "issue",
                        "view",
                        v,
                        "-R",
                        repo,
                        "--json",
                        "number,title,url,state,body",
                        "--template",
                        "## Issue #{{.number}}: {{.title}} ({{.state}})\n{{.url}}\n\n{{.body}}\n",
                    ],
                    None,
                )?;
                out.push_str(&r);
            }
            other => return Err(format!("unknown option {other}\n{USAGE}")),
        }
        out.push('\n');
    }
    if let Ok(cl) = gh(
        &[
            "api",
            &format!("repos/{repo}/contents/CHANGELOG.md"),
            "-H",
            "Accept: application/vnd.github.raw",
        ],
        None,
    ) {
        // The newest section: from the first "## " heading to the next.
        let mut sec = String::new();
        let mut seen = 0;
        for line in cl.lines() {
            if line.starts_with("## ") {
                seen += 1;
                if seen == 2 {
                    break;
                }
            }
            if seen == 1 {
                sec.push_str(line);
                sec.push('\n');
            }
        }
        if !sec.is_empty() {
            out.push_str("## CHANGELOG (newest section)\n\n");
            out.push_str(&sec);
        }
    }
    print!("{out}");
    Ok(())
}
