---
name: studio-qa
description: Visually verify Studio engine output by rasterizing sample cards and inspecting them. Use after ANY change to signature-generator/src/engines/nyuchi (layouts, typography, colors, themes) — structural tests alone have missed real visual defects.
---

# Studio-QA — render and look

Assertions catch numbers; only renders catch collisions, contrast problems, and dead space. Both the dek/divider overlap and the layout-2 dek truncation were found this way.

## Procedure

1. Write a **temporary** vitest file in `mcp/tests/` (so it gets the wasm plugin + fonts) that calls the worker's `nyuchi_generate_studio_card` with `returnFormat: "png"` and writes PNGs to the session scratchpad. Serve ASSETS from `signature-generator/public` via a small fs-backed stub (copy the pattern in `mcp/tests/worker.test.ts` `FONT_ASSETS_STUB`).
2. Render at minimum:
   - layout 1, dark, short one-word title (hook mode) + dek
   - layout 1, accent theme, same content
   - layout 3 and layout 4, dark, medium title
   - layout 2, dark, two-line title + full-sentence dek (the tightest vertical budget)
   - layout 5 twice: title = mineral name (hex labels must show) and generic title (hex labels must be hidden)
   - one non-square format (og or story) for any layout touched
3. View every PNG. Check: no text/graphic overlap, dek complete (never truncated mid-sentence), chip/eyebrow legible, hex labels only on mineral cards, lockup intact, contrast sane on both dark and accent.
4. Delete the temporary test file before committing.
5. If a defect is visible, fix the engine (never post-process output) and re-render before shipping.

The Studio is the only image generator — the legacy Banner tool was removed entirely (its `/banner` route now redirects to `/studio`).
