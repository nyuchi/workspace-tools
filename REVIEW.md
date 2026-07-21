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

## Latest review record

_(populated by the current review — see below)_
