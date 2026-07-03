#!/usr/bin/env node
/*
 * extract-font-metrics.mjs — regenerate src/engines/metrics/font-metrics.ts
 *
 * Extracts per-character advance widths (em-relative: advanceWidth / unitsPerEm)
 * from the fonts the SVG engines render with, so text can be measured without
 * a canvas (e.g. inside the Cloudflare Worker that serves the MCP tools).
 *
 * Sources:
 *   - public/fonts/NotoSans-VariableFont_wdth_wght.ttf  → weights 400/500/600/700
 *     (instanced via the fontkit variation axis { wght })
 *   - public/fonts/JetBrainsMono-VariableFont_wght.ttf  → weights 400/600
 *   - Noto Serif (NOT vendored) → weights 400/600/700, downloaded once per run
 *     from the Google Fonts css2 API into a temp dir. If the download fails,
 *     serif widths are approximated as Noto Sans widths × 1.02 and the
 *     generated header says so.
 *
 * Run from signature-generator/:
 *   node scripts/extract-font-metrics.mjs
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fontkit from 'fontkit'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = join(ROOT, 'src', 'engines', 'metrics', 'font-metrics.ts')

/* Printable ASCII (' ' .. '~') plus the punctuation the engines emit. */
const EXTRA_CHARS = ['–', '—', '·', '×', '‘', '’', '“', '”', '…']
const CHARS = []
for (let cp = 0x20; cp <= 0x7e; cp++) CHARS.push(String.fromCodePoint(cp))
CHARS.push(...EXTRA_CHARS)

/** Extract em-relative advance widths for every char from one font instance. */
function extractWidths(font) {
  const upm = font.unitsPerEm
  const widths = {}
  for (const ch of CHARS) {
    const cp = ch.codePointAt(0)
    if (!font.hasGlyphForCodePoint(cp)) continue
    const glyph = font.glyphForCodePoint(cp)
    widths[ch] = Number((glyph.advanceWidth / upm).toFixed(4))
  }
  return widths
}

/** Instance a (possibly variable) font at a given wght, then extract. */
function widthsAtWeight(font, weight) {
  let instance = font
  if (font.variationAxes && font.variationAxes.wght) {
    const axes = { wght: weight }
    if (font.variationAxes.wdth) axes.wdth = 100
    instance = font.getVariation(axes)
  }
  return extractWidths(instance)
}

function average(widths) {
  const values = Object.values(widths)
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
}

/** Download the Google Fonts css2 stylesheet + per-weight TTFs for Noto Serif. */
async function downloadNotoSerif(weights) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Serif:wght@${weights.join(';')}`
  // A legacy (non-woff2) user agent makes the css2 API hand back TTF URLs.
  const res = await fetch(cssUrl, { headers: { 'User-Agent': 'curl/8' } })
  if (!res.ok) throw new Error(`css2 request failed: ${res.status}`)
  const css = await res.text()

  const dir = mkdtempSync(join(tmpdir(), 'noto-serif-'))
  const files = {}
  for (const weight of weights) {
    const block = css.match(
      new RegExp(`font-weight:\\s*${weight};[^}]*?src:\\s*url\\((https://[^)]+\\.ttf)\\)`),
    )
    if (!block) throw new Error(`no TTF URL for Noto Serif ${weight} in css2 response`)
    const ttfRes = await fetch(block[1])
    if (!ttfRes.ok) throw new Error(`TTF download failed (${weight}): ${ttfRes.status}`)
    const file = join(dir, `NotoSerif-${weight}.ttf`)
    writeFileSync(file, Buffer.from(await ttfRes.arrayBuffer()))
    files[weight] = file
  }
  return files
}

async function main() {
  const metrics = {}

  /* Noto Sans — vendored variable font. */
  const notoSans = fontkit.create(
    readFileSync(join(ROOT, 'public', 'fonts', 'NotoSans-VariableFont_wdth_wght.ttf')),
  )
  const SANS_WEIGHTS = [400, 500, 600, 700]
  for (const w of SANS_WEIGHTS) {
    metrics[`Noto Sans:${w}`] = widthsAtWeight(notoSans, w)
  }

  /* JetBrains Mono — vendored variable font (monospaced; real advances anyway). */
  const jbMono = fontkit.create(
    readFileSync(join(ROOT, 'public', 'fonts', 'JetBrainsMono-VariableFont_wght.ttf')),
  )
  for (const w of [400, 600]) {
    metrics[`JetBrains Mono:${w}`] = widthsAtWeight(jbMono, w)
  }

  /* Noto Serif — downloaded from Google Fonts (not vendored). */
  const SERIF_WEIGHTS = [400, 600, 700]
  let serifSource = 'Google Fonts css2 API (real Noto Serif TTFs)'
  try {
    const files = await downloadNotoSerif(SERIF_WEIGHTS)
    for (const w of SERIF_WEIGHTS) {
      metrics[`Noto Serif:${w}`] = extractWidths(fontkit.openSync(files[w]))
    }
  } catch (err) {
    console.warn(`Noto Serif download failed (${err.message}); approximating serif = sans × 1.02`)
    serifSource = 'APPROXIMATED: Noto Sans widths × 1.02 (download was unavailable)'
    for (const w of SERIF_WEIGHTS) {
      const sans = metrics[`Noto Sans:${w}`]
      const approx = {}
      for (const [ch, v] of Object.entries(sans)) approx[ch] = Number((v * 1.02).toFixed(4))
      metrics[`Noto Serif:${w}`] = approx
    }
  }

  const fallback = {}
  for (const [key, widths] of Object.entries(metrics)) fallback[key] = average(widths)

  const header = `/* GENERATED FILE — do not edit by hand.
 *
 * Per-character advance widths (em-relative: advanceWidth / unitsPerEm) for
 * the fonts the nyuchi/banner SVG engines render with, extracted with fontkit.
 * Used by measureWithMetrics() (./index.ts) to measure text in environments
 * without a canvas (Cloudflare Workers, plain node).
 *
 * Covers printable ASCII (' '..'~') plus – — · × ‘ ’ “ ” ….
 * Noto Serif source: ${serifSource}.
 *
 * Regenerate from signature-generator/:
 *   node scripts/extract-font-metrics.mjs
 */
`

  const tableSrc = JSON.stringify(metrics, null, 2)
  const fallbackSrc = JSON.stringify(fallback, null, 2)
  const out = `${header}
/** "Family:weight" → character → advance width in em. */
export const FONT_METRICS: Record<string, Record<string, number>> = ${tableSrc}

/** "Family:weight" → average advance width in em, for characters not in the table. */
export const FONT_FALLBACK_AVG: Record<string, number> = ${fallbackSrc}
`
  writeFileSync(OUT_FILE, out)

  const keys = Object.keys(metrics)
  const chars = Object.keys(metrics[keys[0]]).length
  console.log(`Wrote ${OUT_FILE}`)
  console.log(`  ${keys.length} font/weight tables (${keys.join(', ')})`)
  console.log(`  ${chars} characters per table`)
  console.log(`  Noto Serif: ${serifSource}`)
  /* Sanity: variable-font instancing should give different advances per weight. */
  const a400 = metrics['Noto Sans:400']['a']
  const a700 = metrics['Noto Sans:700']['a']
  console.log(`  sanity — Noto Sans 'a': 400→${a400} em, 700→${a700} em`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
