/* Nyuchi social-card engine — TypeScript port of nyuchi-engine.js.
   Pure functional: same seeded RNG, graph algorithm, and layouts as the
   original vanilla IIFE.

   The 2026-07 Studio passes intentionally diverge from the original port:
   typography (titles in layouts 1-4 ~35% smaller, dek at ~0.88× the fitted
   title in the foreground color, opaque halo scrim, hook-mode title
   scaling) AND graph presentation (bigger/bolder nodes, off-canvas bleed,
   dark-theme glow, filled eyebrow chip, accent surface, conditional hex
   labels). These are deliberate — see CLAUDE.md — do not "restore" the
   original port's values. Keep the seeded RNG and graph *algorithm*
   byte-stable so seedKey determinism holds. */

import { measureWithMetrics } from '../metrics'
import { TOP_BRANDS, type TopBrandKey } from '../brands'

/* Structural DOM types so this module also typechecks in the Workers
   tsconfig (no DOM lib). In the browser these resolve to the real DOM
   globals; in Workers `DOM.document` is undefined and text measurement
   falls back to the font-metrics table. */
interface MeasureContext2D {
  font: string
  measureText(text: string): { width: number }
}
interface RasterContext2D {
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: string
  drawImage(image: unknown, dx: number, dy: number, dw: number, dh: number): void
}
interface CanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): (MeasureContext2D & RasterContext2D) | null
  toBlob(cb: (b: Blob | null) => void, type?: string): void
}
interface HtmlImageLike {
  crossOrigin: string
  onload: (() => void) | null
  onerror: (() => void) | null
  src: string
}
interface DomGlobals {
  document?: { createElement(tag: string): CanvasLike }
  Image?: new () => HtmlImageLike
  URL?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void }
}
const DOM = globalThis as unknown as DomGlobals

export type Category =
  | 'cobalt'
  | 'sodalite'
  | 'tanzanite'
  | 'malachite'
  | 'gold'
  | 'copper'
  | 'terracotta'

export type FormatKey = '16x9' | 'og' | 'li' | 'ig' | 'story'

/** 'accent' is a full-bleed mineral surface (mineral background, ink text)
    — the loudest option, built per-category in buildSVG rather than from
    the static SURFACE table. */
export type ThemeKey = 'light' | 'dark' | 'accent'

/* The four top-level Bundu-ecosystem brands ('nyuchi' | 'bundu' | 'mukoko' |
   'shamwari') — from the canonical registry in engines/brands. */
export type Brand = TopBrandKey

export type Facet = 'diagonal' | 'steep' | 'chevron'

export interface CategoryDef {
  name: string
  role: string
  light: string
  dark: string
}

export interface Format {
  w: number
  h: number
  label: string
  name: string
}

export interface Surface {
  bg: string
  fg: string
  mut: string
  edge: string
  mark: string
}

export interface Params {
  format: FormatKey
  layout: number
  theme: ThemeKey
  category: Category
  eyebrow?: string
  title?: string
  dek?: string
  index?: string
  footnote?: string
  role?: string
  facet?: Facet
  angle?: number
  cleave?: boolean
  lattice?: boolean
  lockup?: boolean
  brand?: Brand
  seedKey?: string
  /** Preferred dek font-size in px; still shrinks to fit if the text wraps
      past the layout's line budget. Default: ~0.88× the fitted title size. */
  dekFontSize?: number
  /** Dek fill as a hex color (#rgb…#rrggbbaa); invalid values are ignored.
      Default: the surface foreground (same off-white/ink as the title). */
  dekColor?: string
  /** Layout 5 only: show the DARK/LIGHT hex labels on the mineral swatch.
      Default: only when the card is about the mineral itself (no title, or
      the title IS the mineral name); generic cards hide the spec labels. */
  showHexes?: boolean
}

export interface BuildResult {
  svg: string
  format: Format
  seed: number
}

export const CATEGORIES: Record<Category, CategoryDef> = {
  cobalt:     { name: 'Cobalt',     role: 'Knowledge',    light: '#0047AB', dark: '#00B0FF' },
  sodalite:   { name: 'Sodalite',   role: 'Intelligence', light: '#283593', dark: '#3D5AFE' },
  tanzanite:  { name: 'Tanzanite',  role: 'Identity',     light: '#4B0082', dark: '#B388FF' },
  malachite:  { name: 'Malachite',  role: 'Growth',       light: '#004D40', dark: '#64FFDA' },
  gold:       { name: 'Gold',       role: 'Value',        light: '#5D4037', dark: '#FFD740' },
  copper:     { name: 'Copper',     role: 'Stewardship',  light: '#BF5A36', dark: '#FF8A65' },
  terracotta: { name: 'Terracotta', role: 'Community',    light: '#A0522D', dark: '#E1B07E' },
}

export const FORMATS: Record<FormatKey, Format> = {
  '16x9': { w: 1600, h: 900,  label: '1600 × 900',  name: '16:9 header' },
  og:     { w: 1200, h: 630,  label: '1200 × 630',  name: 'OG / share'  },
  li:     { w: 1200, h: 627,  label: '1200 × 627',  name: 'LinkedIn'    },
  ig:     { w: 1080, h: 1080, label: '1080 × 1080', name: 'Square 1:1'  },
  story:  { w: 1080, h: 1920, label: '1080 × 1920', name: 'Story 9:16'  },
}

export const SURFACE: Record<'light' | 'dark', Surface> = {
  light: { bg: '#FAF9F5', fg: '#141413', mut: '#5C5B58', edge: 'rgba(10,10,10,.08)',   mark: '#5D4037' },
  dark:  { bg: '#0F0E0C', fg: '#FAF9F5', mut: '#B2AFA8', edge: 'rgba(255,255,255,.08)', mark: '#FFD740' },
}

/* Optional data-URI icons per brand and theme (populated at runtime by the
   app). The bundu-ecosystem-icons collection has a light- and a dark-surface
   variant per brand; registering without a theme sets BOTH variants, so
   existing single-icon call sites behave exactly as before. */
const BRAND_ICONS: Partial<Record<Brand, { light?: string; dark?: string }>> = {}
export function setBrandIcon(brand: Brand, dataUri: string, theme?: ThemeKey): void {
  const entry = BRAND_ICONS[brand] ?? (BRAND_ICONS[brand] = {})
  if (theme === undefined || theme === 'light') entry.light = dataUri
  if (theme === undefined || theme === 'dark') entry.dark = dataUri
}
export function getBrandIcon(brand: Brand, theme?: ThemeKey): string | undefined {
  const entry = BRAND_ICONS[brand]
  if (!entry) return undefined
  if (theme === undefined) return entry.light ?? entry.dark
  /* The accent surface is bright like the light one, so it shares the
     light-surface icon variant. */
  const t = theme === 'accent' ? 'light' : theme
  /* Fall back to the other variant when only one icon is registered. */
  return entry[t] ?? (t === 'light' ? entry.dark : entry.light)
}

export const MINERAL_LAYOUT = 5

/* ── Seeded RNG ─────────────────────────────────────────────────────────── */
export function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── Graph generation ───────────────────────────────────────────────────── */
interface Node { x: number; y: number }
interface Bounds { x: number; y: number; w: number; h: number }
interface GraphOpts { k?: number; minDist?: number; inset?: number }
interface Graph { nodes: Node[]; edges: [number, number][]; coreIdx: number }

function makeGraph(seed: number, n: number, bounds: Bounds, opts?: GraphOpts): Graph {
  const o = opts || {}
  const rand = rng(seed)
  const inset = o.inset || 0
  const bx = bounds.x + inset
  const by = bounds.y + inset
  const bw = bounds.w - inset * 2
  const bh = bounds.h - inset * 2
  const minD = o.minDist || Math.min(bw, bh) * 0.22
  const nodes: Node[] = []
  let tries = 0
  while (nodes.length < n && tries < 500) {
    const px = bx + rand() * bw
    const py = by + rand() * bh
    let ok = true
    for (const nd of nodes) {
      if (Math.hypot(nd.x - px, nd.y - py) < minD) { ok = false; break }
    }
    if (ok) nodes.push({ x: px, y: py })
    tries++
  }
  while (nodes.length < n) nodes.push({ x: bx + rand() * bw, y: by + rand() * bh })

  const k = o.k || 2
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes
      .map((nd, j) => ({ j, d: i === j ? Infinity : Math.hypot(nd.x - nodes[i].x, nd.y - nodes[i].y) }))
      .sort((a, b) => a.d - b.d)
    for (let m = 0; m < k && m < dists.length; m++) {
      const j = dists[m].j
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([i, j]) }
    }
  }

  /* Connectivity guarantee — bridge any disconnected components. */
  function findRoot(parent: number[], x: number): number {
    return parent[x] === x ? x : (parent[x] = findRoot(parent, parent[x]))
  }
  function getComps(): number[][] {
    const parent = nodes.map((_, i) => i)
    for (const [i, j] of edges) {
      const ri = findRoot(parent, i)
      const rj = findRoot(parent, j)
      if (ri !== rj) parent[ri] = rj
    }
    const map = new Map<number, number[]>()
    for (let i = 0; i < nodes.length; i++) {
      const r = findRoot(parent, i)
      if (!map.has(r)) map.set(r, [])
      map.get(r)!.push(i)
    }
    return [...map.values()]
  }
  let comps = getComps()
  while (comps.length > 1) {
    let bestD = Infinity, bestI = -1, bestJ = -1
    for (let a = 0; a < comps.length; a++) {
      for (let b = a + 1; b < comps.length; b++) {
        for (const i of comps[a]) for (const j of comps[b]) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < bestD) { bestD = d; bestI = i; bestJ = j }
        }
      }
    }
    if (bestI < 0) break
    const key = bestI < bestJ ? `${bestI}-${bestJ}` : `${bestJ}-${bestI}`
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([bestI, bestJ]) }
    comps = getComps()
  }

  const cx = nodes.reduce((a, nd) => a + nd.x, 0) / nodes.length
  const cy = nodes.reduce((a, nd) => a + nd.y, 0) / nodes.length
  let coreIdx = 0, best = Infinity
  nodes.forEach((nd, i) => {
    const d = Math.hypot(nd.x - cx, nd.y - cy)
    if (d < best) { best = d; coreIdx = i }
  })
  return { nodes, edges, coreIdx }
}

interface DrawGraphOpts {
  color?: string
  edgeOpacity?: number
  nodeOpacity?: number
  strokeWidth?: number
  nodeRadius?: number
  coreRadius?: number
}

function drawGraph(graph: Graph, opts?: DrawGraphOpts): string {
  const o = opts || {}
  const c = o.color || '#5D4037'
  const eo = o.edgeOpacity ?? 0.4
  const no = o.nodeOpacity ?? 0.7
  const sw = o.strokeWidth ?? 2
  const nr = o.nodeRadius ?? 7
  const cr = o.coreRadius ?? (nr + 3)
  let s = ''
  for (const [i, j] of graph.edges) {
    const a = graph.nodes[i], b = graph.nodes[j]
    s += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" opacity="${eo}"/>`
  }
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]
    const r = i === graph.coreIdx ? cr : nr
    s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${c}" opacity="${no}"/>`
  }
  return s
}

/* ── Text helpers (lazy canvas init so module load is SSR-safe) ─────────── */
let _mx: MeasureContext2D | null = null
function ctx2d(): MeasureContext2D {
  if (!_mx) {
    _mx = DOM.document!.createElement('canvas').getContext('2d')!
  }
  return _mx
}
function measure(text: string, font: string): number {
  /* No DOM (Cloudflare Workers / plain node): measure from font metrics.
     When a document exists the canvas path stays the first choice, so SPA
     output is byte-identical to before. */
  if (DOM.document === undefined) return measureWithMetrics(text, font)
  const cx = ctx2d()
  cx.font = font
  return cx.measureText(text).width
}
function wrap(text: string, maxW: number, font: string): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (measure(t, font) <= maxW || !cur) cur = t
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines
}
interface FitResult { size: number; lines: string[]; font: string }
function fitText(text: string, maxW: number, maxLines: number, fontStr: string, startSz: number, minSz: number): FitResult {
  let size = startSz
  while (size > minSz) {
    const font = fontStr.replace('__SZ__', size + 'px')
    const lines = wrap(text, maxW, font)
    /* A single unbreakable word wraps to one "line" that can still exceed
       maxW — shrink for that too, or long one-word titles overflow the
       frame at full size. */
    if (lines.length <= maxLines && lines.every((l) => measure(l, font) <= maxW)) {
      return { size, lines, font }
    }
    size -= 2
  }
  const font = fontStr.replace('__SZ__', minSz + 'px')
  return { size: minSz, lines: wrap(text, maxW, font), font }
}
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** Valid CSS hex colors only: #rgb, #rgba, #rrggbb, #rrggbbaa. (A plain
    {3,8} quantifier would admit 5- and 7-digit strings, which SVG
    renderers silently drop — the dek would paint in inherited black.)
    Shared with the MCP tool schema. */
export const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/* ── Marks ──────────────────────────────────────────────────────────────── */
const MNODES: [number, number][] = [[60, 50], [140, 60], [50, 130], [100, 110], [160, 130], [90, 165], [120, 165]]
const MEDGES: [number, number, number, number][] = [
  [60, 50, 140, 60], [60, 50, 50, 130], [140, 60, 160, 130], [60, 50, 100, 110],
  [140, 60, 100, 110], [50, 130, 100, 110], [160, 130, 100, 110],
  [50, 130, 90, 165], [160, 130, 120, 165], [100, 110, 90, 165], [100, 110, 120, 165],
]

function drawMark(x: number, y: number, size: number, color: string): string {
  const sc = size / 200
  let s = `<g transform="translate(${x} ${y}) scale(${sc})">`
  for (const [x1, y1, x2, y2] of MEDGES) s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`
  for (const [cx, cy] of MNODES) s += `<circle cx="${cx}" cy="${cy}" r="9" fill="${color}"/>`
  return s + '</g>'
}

interface LockupOpts { align?: 'left' | 'center'; brand?: Brand; theme?: ThemeKey }
function drawLockup(x: number, y: number, size: number, surface: Surface, opts?: LockupOpts): string {
  const o = opts || {}
  const align = o.align || 'left'
  const brand: Brand = o.brand || 'nyuchi'
  const url = TOP_BRANDS[brand].lockupLabel
  const fs = Math.round(size * 0.5)
  const gap = Math.round(size * 0.22)
  const tw = measure(url, `400 ${fs}px "JetBrains Mono",monospace`)
  const totalW = size + gap + tw
  const sx = align === 'center' ? x - totalW / 2 : x
  const icon = getBrandIcon(brand, o.theme)
  const mark = icon
    ? `<image href="${icon}" x="${sx}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
    : drawMark(sx, y, size, surface.mark)
  const ty = y + size * 0.66
  return mark + `<text x="${sx + size + gap}" y="${ty.toFixed(1)}" font-family="JetBrains Mono,monospace" font-size="${fs}" fill="${surface.fg}">${url}</text>`
}

function drawEngBackground(w: number, h: number, color: string): string {
  const spacing = Math.round(Math.min(w, h) / 18)
  const cols = Math.floor((w - spacing * 0.5) / spacing)
  const rows = Math.floor((h - spacing * 0.5) / spacing)
  const ox = (w - cols * spacing) / 2
  const oy = (h - rows * spacing) / 2
  let s = '<g>'
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = (ox + c * spacing).toFixed(1)
      const y = (oy + r * spacing).toFixed(1)
      const major = (r % 4 === 0 && c % 4 === 0)
      if (major) s += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" opacity=".28"/>`
      else s += `<circle cx="${x}" cy="${y}" r="1.4" fill="${color}" opacity=".16"/>`
    }
  }
  return s + '</g>'
}

/* ── Layout helpers ─────────────────────────────────────────────────────── */
function safeBottom(h: number, pad: number, lockupOn: boolean): number {
  const lh = lockupOn ? Math.round(h * 0.12) : 0
  return h - pad - lh
}

function drawTitle(svg: string, lines: string[], x: number, size: number, startY: number, lh: number, color: string): { svg: string; endY: number } {
  let ty = startY + size * 0.88
  for (const line of lines) {
    svg += `<text x="${x}" y="${ty.toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${size}" fill="${color}">${esc(line)}</text>`
    ty += lh
  }
  return { svg, endY: ty }
}

function drawDek(svg: string, lines: string[], x: number, size: number, startY: number, lh: number, color: string, maxY: number): string {
  let dy = startY + size * 0.88
  for (const line of lines) {
    if (dy > maxY) break
    svg += `<text x="${x}" y="${dy.toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${size}" fill="${color}">${esc(line)}</text>`
    dy += lh
  }
  return svg
}

/* ── Layout context ─────────────────────────────────────────────────────── */
interface Ctx {
  w: number
  h: number
  surface: Surface
  cat: { key: Category; name: string; role: string; color: string; dark: string; light: string }
  title: string
  dek: string
  /** Resolved dek fill (dekColor override or the surface foreground). */
  dekFill: string
  /** Optional dek font-size override in px. */
  dekSize?: number
  /** Dark theme only: draw a radial mineral glow behind the graph region. */
  glow: boolean
  /** Full-bleed mineral surface (theme 'accent'). */
  accent: boolean
  /** Eyebrow-chip text color; the chip background is always cat.color
      (ink on accent, the mineral hex otherwise). */
  chipFg: string
  seed: number
  eyebrow: string
  opts: {
    lattice: boolean
    lockup: boolean
    brand: Brand
    theme: ThemeKey
    index: string
    footnote: string
    facet: Facet
    angle: number
    cleave: boolean
    showHexes: boolean
  }
}

/** Fit the dek at ~0.88× the fitted title size (or the caller's override),
    shrinking further only when the text wraps past the line budget. Callers
    pass the NON-hooked title size so a hook-scaled headline doesn't drag
    the dek up with it. When maxH (the vertical room down to safeBottom) is
    given, the dek also shrinks to FIT that room — a complete smaller dek
    beats drawDek's mid-sentence clipping. */
function fitDek(ctx: Ctx, titleSize: number, maxW: number, maxLines: number, maxH?: number): FitResult {
  const start = ctx.dekSize ?? Math.round(titleSize * 0.88)
  const min = Math.max(10, Math.round(start * 0.55))
  const font = '400 __SZ__ "Noto Serif",Georgia,serif'
  let fit = fitText(ctx.dek || '', maxW, maxLines, font, start, min)
  if (maxH !== undefined) {
    let s = fit.size
    while (s > min && fit.lines.length * s * 1.3 > maxH) {
      s -= 2
      fit = fitText(ctx.dek || '', maxW, maxLines, font, s, s)
    }
  }
  return fit
}

/** Hook mode: when the whole title fits ONE line at the default size, let it
    grow (2px steps) until it fills the measure or hits maxSz — a one-word
    hook like "Nhimbe" becomes the poster element instead of leaving dead
    space. Wrapping titles keep the validated default sizing untouched. */
function fitTitleHook(text: string, maxW: number, maxLines: number, fontStr: string, startSz: number, minSz: number, maxSz: number): FitResult {
  const base = fitText(text, maxW, maxLines, fontStr, startSz, minSz)
  if (base.lines.length !== 1 || base.size !== startSz || !base.lines[0]) return base
  let size = startSz
  while (size + 2 <= maxSz && measure(base.lines[0], fontStr.replace('__SZ__', `${size + 2}px`)) <= maxW) size += 2
  return { size, lines: base.lines, font: fontStr.replace('__SZ__', `${size}px`) }
}

/** WCAG relative luminance of a #rrggbb color. */
function relLum(hex: string): number {
  const lin = (v: number): number => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * lin(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * lin(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * lin(parseInt(hex.slice(5, 7), 16))
  )
}

/** Ink or white, whichever contrasts more on the given chip background.
    (Uses true relative luminance — the perceptual `txtOn` heuristic
    misjudges vivid mid-luminance hexes like cobalt #00B0FF.) */
function chipTextColor(bg: string): string {
  return relLum(bg) > 0.179 ? '#0F0E0C' : '#FFFFFF'
}

/** Chip width including the letter-spacing the emitted <text> carries —
    measure() alone omits tracking, which made long eyebrows overflow the
    pill. Single source of truth: drawChip uses this too. */
function chipWidth(text: string, fs: number): number {
  const tracked = measure(text, `600 ${fs}px "JetBrains Mono",monospace`) + text.length * fs * 0.12
  return tracked + Math.round(fs * 1.3) * 2
}

/** Filled pill chip for the eyebrow — a solid color anchor at the top of
    the card, replacing the old small mono text line. */
function drawChip(x: number, y: number, text: string, fs: number, bg: string, fg: string): { svg: string; w: number; h: number } {
  const pw = chipWidth(text, fs)
  const ph = Math.round(fs * 2.2)
  let s = `<rect x="${x}" y="${y}" width="${pw.toFixed(1)}" height="${ph}" rx="${ph / 2}" fill="${bg}"/>`
  s += `<text x="${(x + pw / 2).toFixed(1)}" y="${(y + ph * 0.665).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${fs}" letter-spacing="${(fs * 0.12).toFixed(1)}" fill="${fg}">${esc(text)}</text>`
  return { svg: s, w: pw, h: ph }
}

/** Radial mineral glow behind the graph region (dark theme). */
function drawGlow(cx: number, cy: number, r: number, color: string, seed: number): string {
  const id = 'gl' + ((seed % 99991) >>> 0)
  return (
    `<defs><radialGradient id="${id}">` +
    `<stop offset="0%" stop-color="${color}" stop-opacity=".3"/>` +
    `<stop offset="55%" stop-color="${color}" stop-opacity=".1"/>` +
    `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${id})"/>`
  )
}

/* ═══════════════════ LAYOUT 01 · type-forward ═══════════════════ */
function layoutType(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.075)
  const iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const nr = Math.max(16, w / 80), cr = Math.max(26, w / 52), gpr = Math.max(pad, cr + 8)
  const gw = w * 0.55, gh = h * 0.72
  /* Widened bounds let the graph bleed off the right edge for movement. */
  const gb = { x: w - gpr - gw, y: h - pad - gh, w: gw + Math.round(w * 0.14), h: gh }
  if (ctx.glow) svg += drawGlow(gb.x + gb.w / 2, gb.y + gb.h / 2, Math.max(gb.w, gb.h) * 0.62, cat.color, seed)
  const g = makeGraph(seed, 7, gb, { k: 2, minDist: Math.min(gw, gh) * 0.3, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.6, nodeOpacity: 0.9, strokeWidth: Math.max(4, w / 380), nodeRadius: nr, coreRadius: cr })

  const cfs = Math.round(w * 0.015)
  const chip = drawChip(pad, pad, eyebrow.toUpperCase(), cfs, cat.color, ctx.chipFg)
  svg += chip.svg
  svg += `<text x="${w - pad}" y="${(pad + chip.h * 0.665).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="${Math.round(w * 0.013)}" fill="${surface.mut}">NYUCHI · O2</text>`
  const ruleY = pad + chip.h + 16
  svg += `<line x1="${pad}" y1="${ruleY}" x2="${w - pad}" y2="${ruleY}" stroke="${surface.edge}" stroke-width="1"/>`

  const tsY = ruleY + Math.round(h * 0.055)
  const sb = safeBottom(h, pad, opts.lockup)
  const tStart = Math.round(h * 0.098)
  const tfit = fitTitleHook(title || '', iw * 0.65, 3, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.055), Math.round(h * 0.16))
  const tlh = tfit.size * 1.06
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tlh, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), iw * 0.65, 3, sb - endY - Math.round(h * 0.015))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, ctx.dekFill, sb)

  if (opts.lockup) {
    const ms = Math.round(h * 0.055)
    svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme })
  }
  return svg
}

/* ═══════════════════ LAYOUT 02 · anchor ═══════════════════ */
function layoutAnchor(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  const lx = w * 0.46, rw = w - lx, colW = lx - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gm = Math.round(Math.min(w, h) * 0.05), nr = Math.max(18, w / 70), cr = Math.max(30, w / 48)
  /* Widened bounds let the mark bleed off the right edge for movement. */
  const gb = { x: lx + gm, y: gm, w: rw - gm * 2 + Math.round(w * 0.1), h: h - gm * 2 }
  if (ctx.glow) svg += drawGlow(gb.x + gb.w / 2, gb.y + gb.h / 2, Math.max(gb.w, gb.h) * 0.6, cat.color, seed)
  const g = makeGraph(seed, 7, gb, { k: 3, minDist: Math.min(gb.w, gb.h) * 0.25, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.7, nodeOpacity: 0.95, strokeWidth: Math.max(4.5, w / 340), nodeRadius: nr, coreRadius: cr })
  svg += `<line x1="${lx}" y1="${pad}" x2="${lx}" y2="${h - pad}" stroke="${surface.edge}" stroke-width="1"/>`

  const cfs = Math.round(w * 0.013)
  const chipY = Math.round(pad * 0.75)
  const chip = drawChip(pad, chipY, eyebrow.toUpperCase(), cfs, cat.color, ctx.chipFg)
  svg += chip.svg
  const tsY = chipY + chip.h + Math.round(h * 0.06)

  const sb = safeBottom(h, pad, opts.lockup)
  const tStart = Math.round(h * 0.078)
  const tfit = fitTitleHook(title || '', colW, 4, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.048), Math.round(h * 0.13))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), colW, 4, sb - endY - Math.round(h * 0.015))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, ctx.dekFill, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }) }
  return svg
}

/* ═══════════════════ LAYOUT 03 · split block ═══════════════════ */
function layoutSplit(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07), bw = w * 0.34
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)
  svg += `<rect x="0" y="0" width="${bw}" height="${h}" fill="${cat.color}"/>`

  const gm = Math.round(Math.min(bw, h) * 0.1), nr = Math.max(10, w / 110), cr = Math.max(16, w / 75)
  const g = makeGraph(seed, 7, { x: gm, y: gm, w: bw - gm * 2, h: h - gm * 2 }, { k: 2, minDist: Math.min(bw, h) * 0.2, inset: cr + 4 })
  svg += drawGraph(g, { color: surface.bg, edgeOpacity: 0.5, nodeOpacity: 0.85, strokeWidth: Math.max(3, w / 500), nodeRadius: nr, coreRadius: cr })

  const catFs = Math.round(h * 0.038)
  svg += `<text x="${pad * 0.7}" y="${pad * 0.7 + catFs}" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${catFs}" fill="${surface.bg}">${esc(cat.name.toUpperCase())}</text>`
  if (opts.lockup) {
    const ms = Math.round(h * 0.05)
    const inv: Surface = { ...surface, mark: surface.bg, fg: surface.bg }
    svg += drawLockup(pad * 0.7, h - pad * 0.7 - ms, ms, inv, { brand: opts.brand, theme: opts.theme })
  }

  const tx = bw + pad, colW = w - bw - pad * 2
  const kfs = Math.round(w * 0.011)
  svg += `<text x="${tx}" y="${pad + kfs + 4}" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${surface.mut}">${esc(cat.role.toUpperCase())}</text>`

  const sb = safeBottom(h, pad, false)
  const tsY = pad + kfs + Math.round(h * 0.075)
  const tStart = Math.round(h * 0.078)
  const tfit = fitTitleHook(title || '', colW, 4, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.048), Math.round(h * 0.13))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, tx, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), colW, 4, sb - endY - Math.round(h * 0.015))
  svg = drawDek(svg, dfit.lines, tx, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, ctx.dekFill, sb)
  return svg
}

/* ═══════════════════ LAYOUT 04 · halo ═══════════════════ */
function layoutHalo(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gw = w * 0.82, gh = h * 0.82, nr = Math.max(16, w / 75), cr = Math.max(28, w / 50)
  if (ctx.glow) svg += drawGlow(w / 2, h / 2, Math.max(w, h) * 0.45, cat.color, seed)
  const g = makeGraph(seed, 7, { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.5, nodeOpacity: 0.7, strokeWidth: Math.max(4, w / 380), nodeRadius: nr, coreRadius: cr })

  const cfs = Math.round(w * 0.013)
  const chipText = eyebrow.toUpperCase()
  const chip = drawChip((w - chipWidth(chipText, cfs)) / 2, Math.round(pad * 0.8), chipText, cfs, cat.color, ctx.chipFg)
  svg += chip.svg

  const tfw = w * 0.76
  const sb = safeBottom(h, pad, opts.lockup)
  const tStart = Math.round(h * 0.085)
  const tfit = fitTitleHook(title || '', tfw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.05), Math.round(h * 0.15))
  const tlh = tfit.size * 1.06
  const tblk = tfit.lines.length * tlh
  const gapT = Math.round(h * 0.04)
  const gapDek = Math.round(h * 0.035)
  /* Budget the dek against safeBottom from its centered position, like the
     non-centered layouts do — otherwise the loop below clips mid-sentence
     while the opaque scrim stays sized for the missing lines. The title
     block extends 0.88×ts (first baseline) + tblk below ty; the dek needs
     its gap plus 0.58×s beyond the n×1.3×s line metric (ascent + descent). */
  const dekRef = Math.min(tfit.size, tStart)
  let dfit = fitDek(ctx, dekRef, w * 0.65, 3)
  for (let i = 0; i < 3; i++) {
    const ty0 = (h - (tblk + gapT + dfit.lines.length * dfit.size * 1.3)) / 2
    const dekTop = ty0 + tfit.size * 0.88 + tblk
    const avail = sb - dekTop
    const need = gapDek + dfit.size * 0.58 + dfit.lines.length * dfit.size * 1.3
    if (need <= avail) break
    dfit = fitDek(ctx, dekRef, w * 0.65, 3, Math.max(20, avail - gapDek - dfit.size * 0.6))
  }
  const total = tblk + gapT + dfit.lines.length * dfit.size * 1.3
  const ty = (h - total) / 2

  /* Fully opaque scrim: the halo graph must never bleed through the text. */
  const backH = tblk + Math.round(h * 0.06) + dfit.lines.length * dfit.size * 1.35 + dfit.size
  svg += `<rect x="${(w - tfw) / 2 - 24}" y="${ty - tfit.size * 0.2}" width="${tfw + 48}" height="${backH}" fill="${surface.bg}"/>`

  let tcy = ty + tfit.size * 0.88
  for (const line of tfit.lines) {
    svg += `<text x="${w / 2}" y="${tcy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${tfit.size}" fill="${surface.fg}">${esc(line)}</text>`
    tcy += tlh
  }
  svg += `<line x1="${w / 2 - 26}" y1="${tcy}" x2="${w / 2 + 26}" y2="${tcy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`

  /* First baseline clears the divider by the dek's own ascent (like drawDek). */
  let dy = tcy + Math.round(h * 0.035) + dfit.size * 0.88
  for (const line of dfit.lines) {
    if (dy + dfit.size > sb) break
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${ctx.dekFill}">${esc(line)}</text>`
    dy += dfit.size * 1.3
  }

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(w / 2, h - pad - ms, ms, surface, { align: 'center', brand: opts.brand, theme: opts.theme }) }
  return svg
}

/* ═══════════════════ SQUARE LAYOUTS (1:1 dedicated) ═══════════════════ */
function sqType(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08), iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const cfs = Math.round(w * 0.022)
  const chip = drawChip(pad, pad, eyebrow.toUpperCase(), cfs, cat.color, ctx.chipFg)
  svg += chip.svg
  svg += `<text x="${w - pad}" y="${(pad + chip.h * 0.665).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="${Math.round(w * 0.016)}" fill="${surface.mut}">NYUCHI · O2</text>`
  const ruleY = pad + chip.h + 18
  svg += `<line x1="${pad}" y1="${ruleY}" x2="${w - pad}" y2="${ruleY}" stroke="${surface.edge}" stroke-width="1"/>`

  const tsY = ruleY + Math.round(h * 0.065)
  const sb = safeBottom(h, pad, opts.lockup)
  // ig/layout-1 reference values from the 2026-07 fixes: title 70px, dek
  // 60px on the 1080 canvas (0.065h / ~0.88× title). Hook mode lets a
  // single-line title grow toward 0.175h (the validated 190px poster size).
  const tStart = Math.round(h * 0.065)
  const tfit = fitTitleHook(title || '', iw, 4, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.045), Math.round(h * 0.175))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.06, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), iw * 0.88, 3, sb - endY - Math.round(h * 0.016))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.016), dfit.size * 1.3, ctx.dekFill, sb)

  const lockH = opts.lockup ? Math.round(h * 0.1) : 0
  const gTop = Math.max(endY + Math.round(h * 0.04), h * 0.55)
  const nr = Math.max(22, w / 48), cr = Math.max(38, w / 28)
  const gw = w * 0.5, gbot = h - pad - lockH - Math.round(h * 0.02)
  const gh = Math.max(100, gbot - gTop)
  /* Widened bounds let the graph bleed off the right edge for movement. */
  const gb = { x: w - pad - gw, y: gTop, w: gw + Math.round(w * 0.14), h: gh }
  if (ctx.glow) svg += drawGlow(gb.x + gb.w / 2, gb.y + gb.h / 2, Math.max(gb.w, gb.h) * 0.62, cat.color, seed)
  const g = makeGraph(seed, 7, gb, { k: 2, minDist: Math.min(gw, gh) * 0.28, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.7, nodeOpacity: 0.95, strokeWidth: Math.max(5.5, w / 200), nodeRadius: nr, coreRadius: cr })

  if (opts.lockup) { const ms = Math.round(h * 0.058); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }) }
  return svg
}

function sqAnchor(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08), iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  /* 0.40 (was 0.48): the chip + larger dek need the reclaimed text room —
     a two-line title plus dek must still clear safeBottom. */
  const gH = h * 0.4, gw = w * 0.75, nr = Math.max(24, w / 44), cr = Math.max(40, w / 27)
  const gbA = { x: (w - gw) / 2, y: pad + Math.round(h * 0.02), w: gw, h: gH - Math.round(h * 0.04) }
  if (ctx.glow) svg += drawGlow(gbA.x + gbA.w / 2, gbA.y + gbA.h / 2, gbA.w * 0.6, cat.color, seed)
  const g = makeGraph(seed, 7, gbA, { k: 3, minDist: Math.min(gw, gH) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.7, nodeOpacity: 0.95, strokeWidth: Math.max(5.5, w / 200), nodeRadius: nr, coreRadius: cr })

  const ruleY = pad + gH
  svg += `<line x1="${pad}" y1="${ruleY}" x2="${w - pad}" y2="${ruleY}" stroke="${surface.edge}" stroke-width="1"/>`

  const cfs = Math.round(w * 0.02)
  const chipY = ruleY + 20
  const chip = drawChip(pad, chipY, eyebrow.toUpperCase(), cfs, cat.color, ctx.chipFg)
  svg += chip.svg

  const sb = safeBottom(h, pad, opts.lockup)
  const tsY = chipY + chip.h + Math.round(h * 0.01)
  const tStart = Math.round(h * 0.057)
  const tfit = fitTitleHook(title || '', iw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.042), Math.round(h * 0.11))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), iw, 3, sb - endY - Math.round(h * 0.012))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.012), dfit.size * 1.3, ctx.dekFill, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.055); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }) }
  return svg
}

function sqSplit(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts } = ctx
  const pad = Math.round(w * 0.07), bH = h * 0.4
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)
  svg += `<rect x="0" y="0" width="${w}" height="${bH}" fill="${cat.color}"/>`

  const gm = Math.round(Math.min(w, bH) * 0.1), nr = Math.max(12, w / 88), cr = Math.max(20, w / 58)
  const g = makeGraph(seed, 7, { x: gm, y: gm, w: w - gm * 2, h: bH - gm * 2 }, { k: 2, minDist: Math.min(w, bH) * 0.22, inset: cr + 4 })
  svg += drawGraph(g, { color: surface.bg, edgeOpacity: 0.55, nodeOpacity: 0.9, strokeWidth: Math.max(3, w / 420), nodeRadius: nr, coreRadius: cr })

  const catFs = Math.round(h * 0.022)
  svg += `<text x="${pad}" y="${pad + catFs}" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${catFs}" fill="${surface.bg}">${esc(cat.name.toUpperCase())}</text>`

  const iw = w - pad * 2, sb = safeBottom(h, pad, opts.lockup)
  const tsY = bH + Math.round(h * 0.065)
  // ig/layout-3 reference values from the 2026-07 fixes: title 62px, dek
  // 60px on the 1080 canvas. Hook mode grows single-line titles.
  const tStart = Math.round(h * 0.057)
  const tfit = fitTitleHook(title || '', iw, 4, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.042), Math.round(h * 0.12))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfit = fitDek(ctx, Math.min(tfit.size, tStart), iw, 3, sb - endY - Math.round(h * 0.015))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, ctx.dekFill, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }) }
  return svg
}

function sqHalo(ctx: Ctx): string {
  const { w, h, surface, cat, title, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08)
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gw = w * 0.85, gh = h * 0.85, nr = Math.max(20, w / 54), cr = Math.max(34, w / 32)
  if (ctx.glow) svg += drawGlow(w / 2, h / 2, w * 0.5, cat.color, seed)
  const g = makeGraph(seed, 7, { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.55, nodeOpacity: 0.75, strokeWidth: Math.max(5, w / 220), nodeRadius: nr, coreRadius: cr })

  const cfs = Math.round(w * 0.02)
  const chipText = eyebrow.toUpperCase()
  const chip = drawChip((w - chipWidth(chipText, cfs)) / 2, Math.round(pad * 0.8), chipText, cfs, cat.color, ctx.chipFg)
  svg += chip.svg

  const tfw = w * 0.76
  const sb = safeBottom(h, pad, opts.lockup)
  const tStart = Math.round(h * 0.062)
  const tfit = fitTitleHook(title || '', tfw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', tStart, Math.round(h * 0.044), Math.round(h * 0.15))
  const tlh = tfit.size * 1.06, tblk = tfit.lines.length * tlh
  const gapT = Math.round(h * 0.045)
  const gapDek = Math.round(h * 0.034)
  /* Same safeBottom budget as layoutHalo — shrink the dek instead of
     clipping it under an opaque scrim sized for the missing lines. */
  const dekRef = Math.min(tfit.size, tStart)
  let dfit = fitDek(ctx, dekRef, w * 0.7, 3)
  for (let i = 0; i < 3; i++) {
    const ty0 = (h - (tblk + gapT + dfit.lines.length * dfit.size * 1.3)) / 2
    const dekTop = ty0 + tfit.size * 0.88 + tblk
    const avail = sb - dekTop
    const need = gapDek + dfit.size * 0.58 + dfit.lines.length * dfit.size * 1.3
    if (need <= avail) break
    dfit = fitDek(ctx, dekRef, w * 0.7, 3, Math.max(20, avail - gapDek - dfit.size * 0.6))
  }
  const total = tblk + gapT + dfit.lines.length * dfit.size * 1.3
  const ty = (h - total) / 2

  /* Fully opaque scrim: the halo graph must never bleed through the text. */
  const backH = total + tfit.size * 0.4 + dfit.size
  svg += `<rect x="${(w - tfw) / 2 - 20}" y="${ty - tfit.size * 0.15}" width="${tfw + 40}" height="${backH}" fill="${surface.bg}"/>`

  let tcy = ty + tfit.size * 0.88
  for (const line of tfit.lines) {
    svg += `<text x="${w / 2}" y="${tcy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${tfit.size}" fill="${surface.fg}">${esc(line)}</text>`
    tcy += tlh
  }
  svg += `<line x1="${w / 2 - 26}" y1="${tcy}" x2="${w / 2 + 26}" y2="${tcy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`

  /* First baseline clears the divider by the dek's own ascent (like drawDek). */
  let dy = tcy + Math.round(h * 0.034) + dfit.size * 0.88
  for (const line of dfit.lines) {
    if (dy + dfit.size > sb) break
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${ctx.dekFill}">${esc(line)}</text>`
    dy += dfit.size * 1.3
  }

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(w / 2, h - pad - ms, ms, surface, { align: 'center', brand: opts.brand, theme: opts.theme }) }
  return svg
}

/* ═══════════════════ MINERAL layout ═══════════════════ */
function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function txtOn(hex: string): string {
  return lum(hex) > 140 ? 'rgba(0,0,0,.72)' : 'rgba(255,255,255,.94)'
}

function facetPoints(style: Facet, a: number, sw: number, sh: number): [number, number][] {
  const p = Math.max(0.12, Math.min(0.9, a / 100))
  const X = (v: number): number => +(v * sw).toFixed(1)
  switch (style) {
    case 'steep':   return [[X(p * 0.55), 0], [sw, 0], [sw, sh], [X(1 - p * 0.55), sh]]
    case 'chevron': return [[X(p), 0], [sw, 0], [sw, sh], [X(p), sh], [X(Math.max(0, p - 0.2)), sh / 2]]
    default:        return [[X(p), 0], [sw, 0], [sw, sh], [X(1 - p), sh]]
  }
}

function drawPill(x: number, y: number, text: string, fs: number, color: string): { svg: string; w: number; h: number } {
  const padX = Math.round(fs * 0.85)
  const tw = measure(text, `600 ${fs}px "Noto Sans",sans-serif`)
  const pw = tw + padX * 2, ph = Math.round(fs * 2), rx = ph / 2
  let s = `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${rx}" fill="none" stroke="${color}" stroke-width="${Math.max(2, fs * 0.13)}"/>`
  s += `<text x="${x + pw / 2}" y="${y + ph * 0.69}" text-anchor="middle" font-family="Noto Sans,sans-serif" font-weight="600" font-size="${fs}" fill="${color}">${esc(text)}</text>`
  return { svg: s, w: pw, h: ph }
}

function layoutMineral(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.075), iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const tall = h / w > 1.2, wide = w / h > 1.3
  const swH = Math.round(h * (tall ? 0.38 : wide ? 0.52 : 0.4))
  const swX = pad, swY = pad, swW = iw
  const rx = Math.round(Math.min(swW, swH) * 0.06)
  const cid = 'mc' + ((seed % 99991) >>> 0)

  svg += `<defs><clipPath id="${cid}"><rect x="${swX}" y="${swY}" width="${swW}" height="${swH}" rx="${rx}"/></clipPath></defs>`
  svg += `<g clip-path="url(#${cid})">`
  svg += `<rect x="${swX}" y="${swY}" width="${swW}" height="${swH}" fill="${cat.dark}"/>`
  const fp = facetPoints(opts.facet, opts.angle, swW, swH)
  const ptsStr = fp.map(([px, py]) => `${(swX + px).toFixed(1)},${(swY + py).toFixed(1)}`).join(' ')
  svg += `<polygon points="${ptsStr}" fill="${cat.light}"/>`
  if (opts.cleave) {
    const a0 = fp[0], aL = fp[fp.length - 1]
    svg += `<line x1="${(swX + a0[0]).toFixed(1)}" y1="${(swY + a0[1]).toFixed(1)}" x2="${(swX + aL[0]).toFixed(1)}" y2="${(swY + aL[1]).toFixed(1)}" stroke="rgba(255,255,255,.62)" stroke-width="${Math.max(2, w / 700)}"/>`
  }
  const gpad = Math.round(swH * 0.16)
  const eg = makeGraph(seed, 7, { x: swX + gpad, y: swY + gpad, w: swW * 0.34, h: swH - gpad * 2 }, { k: 2, minDist: swH * 0.16, inset: 6 })
  svg += drawGraph(eg, { color: txtOn(cat.dark), edgeOpacity: 0.3, nodeOpacity: 0.5, strokeWidth: Math.max(1.5, w / 900), nodeRadius: Math.max(3, w / 240), coreRadius: Math.max(5, w / 170) })
  svg += `</g>`
  if (ctx.accent) {
    /* On the accent surface the swatch's dark half is the same hex as the
       card background — outline the swatch so it keeps its silhouette. */
    svg += `<rect x="${swX}" y="${swY}" width="${swW}" height="${swH}" rx="${rx}" fill="none" stroke="rgba(15,14,12,.4)" stroke-width="${Math.max(2, w / 540)}"/>`
  }

  const idxFs = Math.round(swH * 0.16)
  if (opts.index) svg += `<text x="${swX + swW * 0.05}" y="${(swY + swH * 0.05 + idxFs).toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${idxFs}" fill="${txtOn(cat.dark)}">${esc(opts.index)}</text>`
  /* Spec labels are for "meet this mineral" cards; generic cards that just
     borrow the swatch stay clean. */
  if (opts.showHexes) {
    const hexFs = Math.round(swH * 0.062)
    svg += `<text x="${swX + swW * 0.05}" y="${(swY + swH - swH * 0.06).toFixed(1)}" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${hexFs}" fill="${txtOn(cat.dark)}">DARK ${cat.dark}</text>`
    svg += `<text x="${swX + swW - swW * 0.05}" y="${(swY + swH - swH * 0.06).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${hexFs}" fill="${txtOn(cat.light)}">LIGHT ${cat.light}</text>`
  }

  let cy = swY + swH + Math.round(h * 0.058)
  const nameFs = Math.round(h * (tall ? 0.066 : wide ? 0.07 : 0.082))
  const nfit = fitText(title || cat.name, iw, 2, '700 __SZ__ "Noto Serif",Georgia,serif', nameFs, Math.round(nameFs * 0.6))
  for (const line of nfit.lines) {
    svg += `<text x="${pad}" y="${(cy + nfit.size * 0.85).toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${nfit.size}" fill="${surface.fg}">${esc(line)}</text>`
    cy += nfit.size * 1.04
  }

  cy += Math.round(h * 0.014)
  const pillFs = Math.round(h * (tall ? 0.02 : 0.023))
  const pill = drawPill(pad, cy, cat.role, pillFs, cat.color)
  svg += pill.svg
  cy += pill.h + Math.round(h * 0.028)

  const sb = safeBottom(h, pad, opts.lockup || !!opts.footnote)
  // Layout 5 keeps its own caption-scale dek (it's an educational spec
  // sheet, not a title-first card) but honors the size override and the
  // foreground dek fill.
  const dfs = ctx.dekSize ?? Math.round(h * (tall ? 0.024 : 0.027))
  const dfit = fitText(dek || '', iw, 5, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.max(10, Math.round(dfs * 0.8)))
  for (const line of dfit.lines) {
    if (cy + dfit.size > sb) break
    svg += `<text x="${pad}" y="${(cy + dfit.size * 0.85).toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${ctx.dekFill}">${esc(line)}</text>`
    cy += dfit.size * 1.32
  }

  if (opts.footnote) {
    const ofs = Math.round(h * 0.0155)
    svg += `<text x="${pad}" y="${h - pad}" font-family="JetBrains Mono,monospace" font-size="${ofs}" letter-spacing="${(ofs * 0.06).toFixed(1)}" fill="${surface.mut}">${esc(String(opts.footnote).toUpperCase())}</text>`
  }
  if (opts.lockup) {
    const ms = Math.round(h * 0.05), fs = Math.round(ms * 0.5), gap = Math.round(ms * 0.22)
    const url = TOP_BRANDS[opts.brand].lockupLabel
    const tw = measure(url, `400 ${fs}px "JetBrains Mono",monospace`)
    svg += drawLockup(w - pad - (ms + gap + tw), h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme })
  }
  return svg
}

/* ═══════════════════ PUBLIC API ═══════════════════ */
const REGULAR: Record<number, (ctx: Ctx) => string> = { 1: layoutType, 2: layoutAnchor, 3: layoutSplit, 4: layoutHalo }
const SQUARE:  Record<number, (ctx: Ctx) => string> = { 1: sqType,     2: sqAnchor,     3: sqSplit,     4: sqHalo }

export function buildSVG(p: Params): BuildResult {
  const fmt = FORMATS[p.format] || FORMATS['16x9']
  const themeKey: ThemeKey = p.theme === 'dark' ? 'dark' : p.theme === 'accent' ? 'accent' : 'light'
  const catDef = CATEGORIES[p.category] || CATEGORIES.cobalt
  /* Accent surface: full-bleed mineral background, ink foreground. Built
     per-category here since its bg depends on the mineral. Ink on every
     mineral dark hex is 7.8:1+ (AA/AAA) — verified per-palette. */
  const surface: Surface =
    themeKey === 'accent'
      ? { bg: catDef.dark, fg: '#0F0E0C', mut: 'rgba(15,14,12,.7)', edge: 'rgba(10,10,10,.14)', mark: '#0F0E0C' }
      : SURFACE[themeKey]
  /* On accent the mineral IS the background, so the accent color (graph,
     divider, chip) flips to ink. */
  const accentColor = themeKey === 'accent' ? '#0F0E0C' : themeKey === 'dark' ? catDef.dark : catDef.light
  const cat = {
    key: p.category,
    name: catDef.name,
    role: p.role || catDef.role,
    color: accentColor,
    dark: catDef.dark,
    light: catDef.light,
  }
  const eyebrow = (p.eyebrow && p.eyebrow.trim()) || (catDef.name + ' · ' + catDef.role)
  const seed = hash((p.seedKey || '') + p.category + p.layout)
  const dekFill =
    p.dekColor && HEX_COLOR_RE.test(p.dekColor) ? p.dekColor : surface.fg
  const dekSize =
    typeof p.dekFontSize === 'number' && Number.isFinite(p.dekFontSize) && p.dekFontSize >= 10
      ? Math.round(p.dekFontSize)
      : undefined
  const ctx: Ctx = {
    w: fmt.w, h: fmt.h, surface, cat,
    title: p.title || '',
    dek: p.dek || '',
    dekFill, dekSize,
    glow: themeKey === 'dark',
    accent: themeKey === 'accent',
    chipFg: themeKey === 'accent' ? catDef.dark : chipTextColor(accentColor),
    seed, eyebrow,
    opts: {
      lattice: !!p.lattice,
      lockup: !!p.lockup,
      brand: p.brand || 'nyuchi',
      /* Theme picks the brand-icon variant when both are registered;
         accent is a bright surface, so it uses the light-surface icon. */
      theme: themeKey === 'dark' ? 'dark' : 'light',
      index: p.index || '',
      footnote: p.footnote || '',
      facet: p.facet || 'diagonal',
      angle: p.angle ?? 62,
      cleave: p.cleave !== false,
      /* Hex spec labels default on only for true mineral cards: no title,
         or the title IS the mineral name. */
      showHexes:
        p.showHexes ??
        (!(p.title && p.title.trim()) ||
          p.title.trim().toLowerCase() === catDef.name.toLowerCase()),
    },
  }
  const isSquare = Math.abs(fmt.w - fmt.h) < 4
  let inner: string
  if (+p.layout === 5) inner = layoutMineral(ctx)
  else inner = (isSquare ? SQUARE : REGULAR)[p.layout || 1](ctx)
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt.w} ${fmt.h}" width="${fmt.w}" height="${fmt.h}">${inner}</svg>`,
    format: fmt,
    seed,
  }
}

export async function exportPNG(svgStr: string, fmt: Format, scale = 2): Promise<Blob> {
  const { document: doc, Image: Img, URL: objectUrl } = DOM
  if (!doc || !Img || !objectUrl) throw new Error('exportPNG requires a browser environment')
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = objectUrl.createObjectURL(blob)
  try {
    const img = new Img()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG image load failed'))
      img.src = url
    })
    const canvas = doc.createElement('canvas')
    canvas.width = fmt.w * scale
    canvas.height = fmt.h * scale
    const cx = canvas.getContext('2d')!
    cx.imageSmoothingEnabled = true
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))), 'image/png')
    })
  } finally {
    objectUrl.revokeObjectURL(url)
  }
}
