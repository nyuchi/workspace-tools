---
name: docs-sync
description: Sweep the repo's documentation for consistency with the current code and fix drift. Use after feature work, tool/schema changes, renames, or on a maintenance cadence.
---

# Docs-sync — keep every doc telling the same story

The documentation set, in canonical order (check each against the code, in this order):

1. `README.md` — public front door. MCP tool table, page list, commands, deployment.
2. `SECURITY.md` — Apps Script scopes/delegation AND the Worker/MCP auth model, secrets, input handling.
3. `CLAUDE.md` — agent instructions: architecture notes, invariants, byte-lock rules, current tool behavior.
4. `TEST.md` — test infrastructure: suites, stubs, commands, what CI runs, what needs manual/visual checks.
5. `REVIEW.md` — review standard and the latest review record.
6. Secondary: `mcp/README.md`, `wrangler.toml` comments, MCP tool descriptions in `mcp/src/index.ts`, `mcp/src/server-card.ts` description, `signature-generator/README.md`, `CHANGELOG.md`/`RELEASES.md` links.

## Procedure

1. `git log --oneline -10` and `git diff` to know what changed recently.
2. Grep for known drift markers — phrases that have gone stale before:
   - `PNG rasterization is a follow-up`, `SVG only`, `three tools`, `exactly the three`
   - `nyuchitech` (org renamed to `nyuchi`)
   - `8px per char` (stub is now size-aware)
   - counts of tools/tests that may have moved
3. Compare the MCP tool table in `README.md` against `server.registerTool` calls in `mcp/src/index.ts` (names, deprecations, output modes).
4. Check `CLAUDE.md` claims against reality (paths that must exist, invariants still true).
5. Fix what's wrong, run the `verify` skill if any `.ts` changed, commit with a `Docs consistency:` message, push to the current feature branch.
6. If nothing drifted: report "consistent" and change nothing.

Never describe aspirations as shipped: docs state what the code does today.
