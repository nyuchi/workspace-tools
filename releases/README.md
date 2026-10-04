# Release marketing

Owner, 2026-10-04: every big release, and some of the smaller ones, gets
written up. One release that is **live in production** becomes, for the
owner to review and approve:

- a **Sanity draft** post in the brand's studio, with its hero image;
- **Postiz drafts**, one per channel, unscheduled, each with an image;
- three images from nyuchi-tools: **OG 1200×630**, **square 1080×1080** and
  **story 1080×1920**, in the brand's mineral with its official logo;
- one **review comment** on the release's tracking issue.

Nothing is ever published or scheduled by the pipeline. Tracking:
nyuchi/workspace-tools#83.

## Layout

```text
releases/
  channels.toml            brand → Sanity project/dataset/author; Postiz channels
  <slug>/
    release.toml           the release: live URLs, post, image copy, socials
    post.md                the post body (Markdown, as the studios store it)
    out/                   built: og.png square.png story.png, pack.json, manifest.json
    ledger.json            what has been drafted (ids), so re-runs skip it
```

## Run it

In a Claude session: "market this release" runs the `market-release` skill
(`.claude/skills/market-release/SKILL.md`), which drives the steps below and
creates the drafts through the Sanity and Postiz MCP tools.

By hand, from `next/`:

```sh
cargo run --release --bin nyuchi-release -- gather bundu-labs/marketing --pr 123   # the facts
cargo run --release --bin nyuchi-release -- check  ../releases/<slug>/release.toml
cargo run --release --bin nyuchi-release -- build  ../releases/<slug>/release.toml # live gate + images + pack
cargo run --release --bin nyuchi-release -- status ../releases/<slug>/release.toml
SANITY_API_TOKEN=… POSTIZ_API_KEY=… \
cargo run --release --bin nyuchi-release -- publish ../releases/<slug>/release.toml [--dry-run]
cargo run --release --bin nyuchi-release -- comment ../releases/<slug>/release.toml --post
```

`publish` reads its two secrets from the environment (1Password, the
workspace-tools vault), hands them to curl on stdin and never prints them.
Set `NYUCHI_BLOCKED_TERMS_FILE` (kept outside the repo) so the privacy check
has the blocked-terms list.

## What the checks hold

- **Live only.** `build` and `publish` refuse unless every `live` URL answers 200. Staging links do not count.
- **Privacy.** No school, student or staff data: the blocked-terms list runs
  over every text, and email addresses outside the ecosystem's domains are
  refused.
- **British spelling.** American forms (`color`, `organization`, `-ize`
  verbs…) and `license` as a noun are refused outside URLs.
- **Fits the channel.** Every social post fits its platform's limit (X
  counts a URL as 23), the title ≤ 140 and the description ≤ 280.
- **Idempotent.** The Sanity id is fixed per release
  (`release-<slug>`, written with `createIfNotExists`), and the ledger
  records each Postiz draft, so running twice drafts nothing twice and never
  overwrites the owner's edits.

## Why it is shaped like this

- **Rust, beside the renderer.** The images come from `nyuchi-imaging`, so
  the pipeline is a crate in the same workspace and calls it as a library:
  one code path for the CLI, the Worker and this.
- **Deterministic; the agent drafts.** The pipeline never calls a model.
  The words are written by the agent (or a person) into `release.toml`,
  checked against the live release, and reviewed in a pull request. A model
  behind the Cloudflare AI Gateway (`fundi`) could draft later, but a
  reproducible pipeline whose every claim was checked by whoever ran it is
  the safer default for public copy.
- **MCP first, headless second.** The Sanity and Postiz MCP tools are what a
  session has; `publish` is the same steps over HTTP for CI once the two
  secrets are in place. Both write the same ledger.

## Queued for when they ship

Not marketed until they are live in production: Nyuchi API features (on
staging), the console redesign (on staging), and person deletion becoming
anonymised open research data.
