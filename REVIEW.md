# REVIEW.md — the review standard for workspace-tools

**Who:** every change gets reviewed — by a human, by an agent running this standard (`.claude/agents/` + `/code-review`), or both. The author never solely approves their own work.
**What:** the branch diff against `main`, plus the enclosing functions of every hunk (bugs in unchanged lines of a touched function are in scope).
**Why:** this repo emits brand-locked HTML into inboxes and images into social feeds, and runs an authenticated public MCP surface — defects are user-visible and externally reachable.
**When:** before a PR leaves draft; re-run after any substantive push. Record the result here (latest record below, newest first).
**Where:** findings live in this file and, when actionable beyond the PR, as GitHub issues (the same loop `report_issue` gives MCP callers).

## How — the method

1. **Find** along independent angles, each surfacing candidates with a concrete failure scenario:
   - line-by-line diff scan (wrong conditions, off-by-one, missing escape/await, swallowed errors)
   - removed-behavior audit (every deleted line enforced *something* — where is it re-established?)
   - cross-file trace (callers/callees of every changed symbol, widened types, changed defaults)
   - reuse / simplification / efficiency (duplication, derivable state, wasted work)
   - altitude (is the fix at the right depth, or a point-patch on shared infrastructure?)
   - conventions (CLAUDE.md rules, byte-lock invariants, escaping)
2. **Verify** each candidate against the actual code: CONFIRMED / PLAUSIBLE / REFUTED — recall-biased (realistic rare paths count), but refutations must be constructible from the code.
3. **Fix or file**: confirmed defects are fixed on the branch when small and unambiguous; anything architectural or debatable becomes a GitHub issue and is listed here with its disposition.
4. Engine changes additionally require the `studio-qa` visual pass — two shipped defects (dek/divider collision, layout-2 dek truncation) were only visible in renders.

A review is not complete until `verify` (lint, typecheck, both suites, build) is green on the reviewed commit.

---

## Latest review record — 2026-07-21, branch `claude/studio-generator-fixes-upload-2vxbgp` (PR #40)

Eight finder angles over `main...HEAD` (~35 candidates), deduped and verified against the code; the top finding was verified by rendering. **All confirmed defects fixed on the branch and re-verified (188 engine + 94 worker tests green, renders inspected).**

### Confirmed and fixed

```json
[
  {"file": "signature-generator/src/engines/nyuchi/index.ts", "line": 700, "summary": "Both halo layouts lacked the dek vertical budget: wide-format cards clipped the dek mid-sentence while the now-opaque scrim stayed sized for the missing lines (verified by render)", "failure_scenario": "og/16x9 halo with wrapping title + 3-line dek drew 2 lines under a scrim sized for 3 — fixed with a safeBottom budget loop accounting for the title's first-baseline offset and the dek's ascent/descent"},
  {"file": "signature-generator/src/engines/nyuchi/index.ts", "line": 537, "summary": "drawChip sized the pill without the letter-spacing its <text> carries — eyebrows over ~21 chars overflowed the chip and mis-centered in halo", "failure_scenario": "eyebrow 'COMMUNITY ENGAGEMENT · SOUTHERN AFRICA' escaped the pill by ~23px per side — chipWidth now includes tracking and is drawChip's single source of width"},
  {"file": "mcp/src/index.ts", "line": 414, "summary": "upload:true combined with an explicit returnFormat 'png'/'svg' silently skipped the upload", "failure_scenario": "caller believed an Images URL existed that was never created — 'png'+upload now uploads AND returns pixels (url in metadata); 'svg'+upload errors"},
  {"file": "mcp/src/raster.ts", "line": 32, "summary": "ensureWasm cached a rejected promise forever, poisoning all rasterization in the isolate", "failure_scenario": "one transient instantiation failure made every later png/url render fail until recycle — now resets on failure like fontsCache"},
  {"file": "signature-generator/src/engines/nyuchi/index.ts", "line": 355, "summary": "fitText never shrank a single unbreakable word (wrap always yields 1 line ≤ maxLines), so long one-word titles overflowed the frame", "failure_scenario": "'Interoperability' at layout-1 ig rendered wider than the measure — lines are now width-checked too"},
  {"file": "signature-generator/src/engines/nyuchi/index.ts", "line": 200, "summary": "Hex validation accepted 5-/7-digit strings (invalid CSS → dek painted inherited black); regex also duplicated in the zod schema", "failure_scenario": "dekColor '#FFD74' passed both layers and rendered invisibly — shared HEX_COLOR_RE now allows only 3/4/6/8-digit forms"},
  {"file": "signature-generator/src/engines/nyuchi/index.ts", "line": 927, "summary": "Accent theme + layout 5: the swatch's dark half matched the card background exactly, dissolving the swatch silhouette", "failure_scenario": "accent malachite mineral card lost its rounded-rect boundary — accent cards now outline the swatch"},
  {"file": "signature-generator/src/pages/studio/StudioPage.tsx", "line": 225, "summary": "SPA meta-row mineral dot kept a binary theme conditional after ThemeKey widened — accent showed the light hex, a color absent from the card", "failure_scenario": "Accent+cobalt preview showed a #0047AB dot beside a #00B0FF card — accent now shows the dark hex"},
  {"file": "mcp/src/index.ts", "line": 519, "summary": "upload_asset validated inputs by truthiness but dispatched on !== undefined — empty-string pngBase64 shadowed a valid svg", "failure_scenario": "{svg, pngBase64: ''} failed with a decode error instead of using the svg — dispatch now uses the same truthiness predicate"},
  {"file": "email-signature/signature.html", "line": 114, "summary": "Org rename missed the clasp project's HTML companions (signature.html/preview.html kept nyuchitech URLs)", "failure_scenario": "admins copying from the in-project reference would reintroduce the dead org — completed in commit 0bb9fbb along with the contradictory engine header comment"}
]
```

### Accepted / follow-ups (not fixed in this PR, by design)

- **Structure**: the eight layout functions repeat chip/glow/hook/dek rituals and magic ratio triplets — extract a per-layout spec table + shared helpers next time typography is tuned. Same for the duplicated halo title/dek block, `chipWidth`-in-`drawPill` unification, `relLum` vs `txtOn` (two contrast heuristics, `txtOn` kept only for the byte-locked swatch labels), the images/feedback response-parsing twins, and `assetFetch` sharing with brand-icons (whose cache still poisons on failure — port raster.ts's fix when touched).
- **Semantics**: `showHexes` default infers "mineral card" from title == mineral name — copy-sensitive, but explicitly overridable and documented; revisit if it misfires in practice. `MCP_PROTOCOL_VERSION` now tracks the SDK's latest (display-only; negotiation is per-request in the SDK) — re-check the minimal stateless transport when bumping the SDK major. `CF_IMAGE_TOKEN` alias: consolidate to `CF_IMAGES_TOKEN` and delete the legacy secret when convenient; error messages name both.
- **Efficiency (accepted)**: fitText/fitDek/hook loops do tens of extra arithmetic-only measure() calls per card — negligible at current scale; revisit if card generation becomes hot.
- **Test brittleness**: some chip/scrim assertions couple to SVG attribute order; acceptable until an attribute changes, then prefer an order-insensitive attribute helper.
