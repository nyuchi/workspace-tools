---
name: verify
description: Run this repo's full verification sequence (lint, typecheck, both vitest suites, site build) in the right directories, and report a pass/fail summary. Use before every commit/push, after dependency changes, or when asked whether the repo is green.
---

# Verify — full check sequence for workspace-tools

Run these in order. Stop at the first failure and report it with the failing output; do not push on red.

```bash
cd signature-generator
npm run lint
npx tsc -b
npx vitest run
npm run build
cd ..
npm run typecheck:worker
npm run test:worker
```

Notes:
- Directory matters: the engine suite/`tsc -b`/lint run **inside** `signature-generator/`; the worker suite and `typecheck:worker` run at the **repo root** (its config is root `vitest.worker.config.ts`, deps are root deps).
- If dependencies were never installed in this container: `npm install` at the root **and** in `signature-generator/` first.
- A changed engine also warrants visual verification — see the `studio-qa` skill.
- Optionally confirm deployability with `npx wrangler deploy --dry-run --outdir <scratch>` (no credentials needed).

Report: one line per step (pass/fail + counts), then overall verdict. If everything passes and the working tree is clean, say so and stop — no pushes, no commits unless the caller asked.
