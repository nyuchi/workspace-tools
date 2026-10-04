---
name: market-release
description: Market a release that is live in production, as drafts only — a Sanity post, one Postiz draft per channel and three nyuchi-tools images (OG, square, story), plus a review comment on the tracking issue. Use when asked to "market this release", write up a release, or announce something that has shipped. Never publishes or schedules.
---

# Market a release (drafts only)

The pipeline is `nyuchi-release` (`next/crates/release`); the data is in
`releases/`. Read `releases/README.md` once if you have not.

## Hard rules

- **Drafts only.** Never publish a Sanity document, never schedule or post a
  Postiz draft (`type` is always `"draft"`). The owner approves each one.
- **Only what is live in production.** Every fact must be checked against
  the live page or API, not staging, a PR or an issue. If it is not live, do
  not market it: add it to "Queued for when they ship" on the pipeline issue
  (nyuchi/workspace-tools#83) instead.
- **Never mention any school, students or staff data.** Set
  `NYUCHI_BLOCKED_TERMS_FILE` if the owner has given you the file.
- **British spelling** (licence is the noun, license the verb). Brand voice:
  `mzizi_get_tokens voiceAndTone` — a knowledgeable friend, plain words,
  Ubuntu, active voice.
- **Never touch existing Postiz posts.** Only create new drafts.
- No secrets in output. Clone under `$TMPDIR`, never `~/GitHub`.

## Steps

1. **Gather.** `cd next && cargo run --release --bin nyuchi-release -- gather <owner/repo> --tag <t> --pr <n> --issue <n>`.
   Then open the live URLs and read them: they are the source of truth.
2. **Draft** `releases/<slug>/release.toml` and `post.md` (copy
   `releases/bags-1.0.0/` as the model). Post: what changed, why it matters,
   how to use it, links. One `[[social]]` per channel in
   `releases/channels.toml` that fits the brand. You (the agent) write the
   words; the pipeline never calls a model.
3. **Check and build.** `nyuchi-release check <release.toml>`, then
   `nyuchi-release build <release.toml>`: it refuses unless every `live` URL
   answers 200, renders `out/og.png`, `out/square.png`, `out/story.png` and
   writes `out/pack.json`. Look at the three images.
4. **Status.** `nyuchi-release status <release.toml>` lists what is still
   pending. Only do the pending steps — that is what keeps re-runs from
   duplicating drafts.
5. **Sanity draft** (if pending), with the Sanity MCP:
   - `dataset_assets_upload_from_file` once per image, then `curl -X POST -H 'Content-Type: image/png' --data-binary @out/<name>.png <uploadUrl>`;
   - `create_documents` with `pack.json` → `sanity.document`, plus
     `_id` = `sanity.document_id` (the tool adds `drafts.`) and `heroImage`
     = `{_type: image, alt: sanity.hero_alt, asset: {_ref: <og asset id>}}`;
   - if a draft with that id already exists, do not create another: patch it
     only if the owner asked for a refresh.
6. **Postiz drafts** (pending channels only), with the Postiz MCP:
   `uploadFromUrlTool` on each image's Sanity CDN URL, then one
   `integrationSchedulePostTool` call with `type: "draft"`, the channel's
   `integration`, `html` as content, the uploaded image path as the
   attachment, and the channel's `settings` (minus `__type`) as key/values.
7. **Record.** `nyuchi-release record <release.toml> --sanity-doc --sanity-asset 'og=<id>=<url>' … --postiz '<channel>=<postId>=<previewUrl>' …`
   (quote the arguments: zsh globs `?`).
8. **Comment.** `nyuchi-release comment <release.toml> --post` creates or
   edits the one review comment on the tracking issue.
9. Commit `releases/<slug>/` (release, body, `out/`, `ledger.json`) on a
   branch and open a PR referencing the tracking issue.

Headless alternative to 5–7 (CI or a terminal with secrets from
1Password): `SANITY_API_TOKEN=… POSTIZ_API_KEY=… nyuchi-release publish <release.toml>`
(`--dry-run` first). It writes the same ledger.
