/* Article banner engine — TypeScript port of banner-engine.js
   (nyuchi · banner-engine: generative o2 graph + 4 SVG layouts + PNG export).
   Pure functional: same seeded RNG, graph algorithm, layouts, and string
   emission as the original vanilla IIFE. Do not "improve" — SVG output must
   stay byte-identical to the source for identical params. */

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

export type FormatKey = '16x9' | 'og' | 'li' | 'ig'

export type ThemeKey = 'light' | 'dark'

/* The four top-level Bundu-ecosystem brands ('nyuchi' | 'bundu' | 'mukoko' |
   'shamwari') — from the canonical registry in engines/brands. */
export type Brand = TopBrandKey

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
  card: string
  edge: string
  gold: string
  mark: string
}

export interface Params {
  format: FormatKey
  layout: number
  theme: ThemeKey
  category: Category
  title?: string
  dek?: string
  seedKey?: string
  lattice?: boolean
  lockup?: boolean
  brand?: Brand
}

export interface BuildResult {
  svg: string
  format: Format
  seed: number
}

/* ────────────────────────── Constants ────────────────────────── */

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
  og:     { w: 1200, h: 630,  label: '1200 × 630',  name: 'OG / share' },
  li:     { w: 1200, h: 627,  label: '1200 × 627',  name: 'LinkedIn' },
  ig:     { w: 1080, h: 1080, label: '1080 × 1080', name: 'Instagram' },
}

export const SURFACE: Record<ThemeKey, Surface> = {
  light: { bg: '#FAF9F5', fg: '#141413', mut: '#5C5B58', card: '#FFFFFF', edge: 'rgba(10,10,10,0.08)', gold: '#5D4037', mark: '#5D4037' },
  dark:  { bg: '#0F0E0C', fg: '#FAF9F5', mut: '#B2AFA8', card: '#1A1815', edge: 'rgba(255,255,255,0.08)', gold: '#FFD740', mark: '#FFD740' },
}

/* ────────────────────────── Seeded RNG ────────────────────────── */

export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ────────────────────────── Graph generation ──────────────────────────
   Place N nodes inside a bounding box, then connect each to its K nearest
   neighbours. Slight perturbation gives every article its own silhouette
   while staying inside the o2 visual family (7 nodes, 9–12 edges).        */

interface GraphNode { x: number; y: number }
interface Bounds { x: number; y: number; w: number; h: number }
interface GraphOpts { k?: number; minDist?: number; inset?: number }
interface Graph { nodes: GraphNode[]; edges: [number, number][]; coreIdx: number }

function generateGraph(seed: number, n: number, bounds: Bounds, opts?: GraphOpts): Graph {
  const o = opts || {}
  const rand = mulberry32(seed)
  // inset by node radius so circles don't bleed past the bounds we were given
  const inset = o.inset || 0
  const x = bounds.x + inset
  const y = bounds.y + inset
  const w = bounds.w - inset * 2
  const h = bounds.h - inset * 2

  // poisson-ish sample: random points but with a minimum spacing
  const minDist = o.minDist || Math.min(w, h) * 0.18
  const nodes: GraphNode[] = []
  let tries = 0
  while (nodes.length < n && tries < 400) {
    const px = x + rand() * w
    const py = y + rand() * h
    let ok = true
    for (const nd of nodes) {
      const dx = nd.x - px, dy = nd.y - py
      if (Math.hypot(dx, dy) < minDist) { ok = false; break }
    }
    if (ok) nodes.push({ x: px, y: py })
    tries++
  }
  // top up if spacing was too tight
  while (nodes.length < n) {
    nodes.push({ x: x + rand() * w, y: y + rand() * h })
  }

  // edges: connect each node to its 2 nearest neighbours
  const k = o.k || 2
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes.map((nd, j) => ({
      j, d: i === j ? Infinity : Math.hypot(nd.x - nodes[i].x, nd.y - nodes[i].y),
    }))
    dists.sort((a, b) => a.d - b.d)
    for (let m = 0; m < k && m < dists.length; m++) {
      const j = dists[m].j
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push([i, j])
    }
  }

  // assign one node as the "core" (largest) — closest to centroid
  const cx = nodes.reduce((a, nd) => a + nd.x, 0) / nodes.length
  const cy = nodes.reduce((a, nd) => a + nd.y, 0) / nodes.length
  let coreIdx = 0, best = Infinity
  nodes.forEach((nd, i) => {
    const d = Math.hypot(nd.x - cx, nd.y - cy)
    if (d < best) { best = d; coreIdx = i }
  })

  return { nodes, edges, coreIdx }
}

/* ────────────────────────── Graph rendering ────────────────────────── */

interface RenderGraphOpts {
  color?: string
  edgeOpacity?: number
  nodeOpacity?: number
  strokeWidth?: number
  nodeRadius?: number
  coreRadius?: number
}

function renderGraph(graph: Graph, opts?: RenderGraphOpts): string {
  const o = opts || {}
  const stroke = o.color || '#5D4037'
  const fill = o.color || '#5D4037'
  const edgeOpacity = o.edgeOpacity ?? 0.4
  const nodeOpacity = o.nodeOpacity ?? 0.7
  const sw = o.strokeWidth ?? 2
  const nr = o.nodeRadius ?? 6
  const coreR = o.coreRadius ?? (nr + 2)

  let s = ''
  for (const [i, j] of graph.edges) {
    const a = graph.nodes[i], b = graph.nodes[j]
    s += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="${edgeOpacity}"/>`
  }
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]
    const r = i === graph.coreIdx ? coreR : nr
    s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${fill}" opacity="${nodeOpacity}"/>`
  }
  return s
}

/* ────────────────────────── Text helpers ──────────────────────────
   Canvas-based measurement so we get accurate wrap + auto-size.
   (Lazy canvas init so module load is SSR/Worker-safe.)               */

let _measureCtx: MeasureContext2D | null = null
function measureCtx(): MeasureContext2D {
  if (!_measureCtx) {
    _measureCtx = DOM.document!.createElement('canvas').getContext('2d')!
  }
  return _measureCtx
}

function measure(text: string, font: string): number {
  /* No DOM (Cloudflare Workers / plain node): measure from font metrics.
     When a document exists the canvas path stays the first choice, so SPA
     output is byte-identical to before. */
  if (DOM.document === undefined) return measureWithMetrics(text, font)
  const ctx = measureCtx()
  ctx.font = font
  return ctx.measureText(text).width
}

function wrap(text: string, maxWidth: number, font: string): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const tryLine = cur ? cur + ' ' + w : w
    if (measure(tryLine, font) <= maxWidth || !cur) {
      cur = tryLine
    } else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

interface FitResult { size: number; lines: string[]; font: string }

// Fit text to a max width and max line count by shrinking — and for short text,
// grow up to a hard ceiling so short titles fill the canvas instead of looking tiny.
function fitText(text: string, maxWidth: number, maxLines: number, fontStr: string, startSize: number, minSize: number, maxSize?: number): FitResult {
  // Allow only a gentle grow for very short text — large jumps look unbalanced.
  maxSize = maxSize || Math.round(startSize * 1.15)

  function linesAt(sz: number): { font: string; lines: string[] } {
    const font = fontStr.replace('__SIZE__', sz + 'px')
    return { font, lines: wrap(text, maxWidth, font) }
  }

  // 1) Try to GROW above startSize while text still fits in maxLines and any
  //    single line is narrower than maxWidth. Useful for short titles.
  let bestUp: FitResult | null = null
  for (let sz = startSize; sz <= maxSize; sz += 2) {
    const r = linesAt(sz)
    // longest line width at this size
    let maxLineW = 0
    for (const ln of r.lines) {
      const w = measure(ln, r.font)
      if (w > maxLineW) maxLineW = w
    }
    if (r.lines.length <= maxLines && maxLineW <= maxWidth) {
      bestUp = { size: sz, lines: r.lines, font: r.font }
    } else {
      break
    }
  }
  if (bestUp && bestUp.size > startSize) return bestUp

  // 2) Shrink to fit if too tall.
  let size = startSize
  while (size > minSize) {
    const r = linesAt(size)
    if (r.lines.length <= maxLines) return { size, lines: r.lines, font: r.font }
    size -= 2
  }
  const r = linesAt(minSize)
  return { size: minSize, lines: r.lines, font: r.font }
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/* ────────────────────────── Logo mark (mini o2) ──────────────────────────
   The frozen 7-node graph from the source loader. Used as anchor mark.     */

const MARK_NODES: [number, number][] = [[60, 50], [140, 60], [50, 130], [100, 110], [160, 130], [90, 165], [120, 165]]
const MARK_EDGES: [number, number, number, number][] = [
  [60, 50, 140, 60], [60, 50, 50, 130], [140, 60, 160, 130], [60, 50, 100, 110], [140, 60, 100, 110],
  [50, 130, 100, 110], [160, 130, 100, 110], [50, 130, 90, 165], [160, 130, 120, 165],
  [100, 110, 90, 165], [100, 110, 120, 165],
]

/* Lockup wordmarks — URLs come from the registry's lockupLabel. */
export const BRANDS: Record<Brand, { name: string; url: string }> = {
  nyuchi:   { name: 'nyuchi',           url: TOP_BRANDS.nyuchi.lockupLabel },
  bundu:    { name: 'bundu foundation', url: TOP_BRANDS.bundu.lockupLabel },
  mukoko:   { name: 'mukoko',           url: TOP_BRANDS.mukoko.lockupLabel },
  shamwari: { name: 'shamwari ai',      url: TOP_BRANDS.shamwari.lockupLabel },
}

/* Canonical o2 graph — the SAME shape as the loader, scaled to fit bounds.
   This is what "the spinner" looks like: 7 nodes, 11 edges, frozen positions.
   (Unused by the four layouts; kept for parity with the source engine.) */
export function renderCanonicalGraph(bounds: Bounds, opts?: RenderGraphOpts): string {
  const o = opts || {}
  const stroke = o.color || '#5D4037'
  const fill = o.color || '#5D4037'
  const edgeOpacity = o.edgeOpacity ?? 0.4
  const nodeOpacity = o.nodeOpacity ?? 0.65
  const { x, y, w, h } = bounds
  // canonical viewBox is 0–200 on both axes; preserve aspect by scaling uniformly
  const scale = Math.min(w, h) / 200
  const fitW = 200 * scale
  const fitH = 200 * scale
  const ox = x + (w - fitW) / 2
  const oy = y + (h - fitH) / 2
  const sw = o.strokeWidth ?? Math.max(2, scale * 2.2)
  const nr = o.nodeRadius ?? Math.max(5, scale * 9)
  const coreR = o.coreRadius ?? (nr + Math.max(2, scale * 2))

  let s = `<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${scale.toFixed(3)})">`
  for (const [x1, y1, x2, y2] of MARK_EDGES) {
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${(sw / scale).toFixed(2)}" stroke-linecap="round" opacity="${edgeOpacity}"/>`
  }
  // index 3 is [100,110] — that's the core (centroid-ish)
  const coreIdx = 3
  for (let i = 0; i < MARK_NODES.length; i++) {
    const [cx, cy] = MARK_NODES[i]
    const r = (i === coreIdx ? coreR : nr) / scale
    s += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="${fill}" opacity="${nodeOpacity}"/>`
  }
  s += '</g>'
  return s
}

/* Optional data-URI icons per brand (populated at runtime by the app);
   replaces the source's window.__BRAND_ICONS global. */
/* The bundu-ecosystem-icons collection has a light- and a dark-surface
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
  /* Fall back to the other variant when only one icon is registered. */
  return entry[theme] ?? (theme === 'light' ? entry.dark : entry.light)
}

/* The lockup only reads mark + fg from the surface (layoutSplit passes an
   inverted two-key surface object). */
type LockupSurface = Pick<Surface, 'mark' | 'fg'>
interface LockupOpts { align?: 'left' | 'center'; fontSize?: number; brand?: Brand; theme?: ThemeKey }

/* Clean lockup: mark + brand URL — single weight, no subtitle. */
function renderLockup(x: number, y: number, size: number, surface: LockupSurface, opts?: LockupOpts): { svg: string; width: number } {
  const o = opts || {}
  const align = o.align || 'left' // 'left' | 'center'
  const wmFs = o.fontSize || Math.round(size * 0.5)
  const gap = Math.round(size * 0.22)
  const brand = BRANDS[o.brand || 'nyuchi'] || BRANDS.nyuchi
  const wmText = brand.url
  const wmFont = `400 ${wmFs}px "JetBrains Mono", ui-monospace, monospace`
  const textW = measure(wmText, wmFont)
  const totalW = size + gap + textW
  let startX = x
  if (align === 'center') startX = x - totalW / 2
  // Use uploaded brand icon if available (data URL), else fall back to o2 mark.
  const iconData = getBrandIcon(o.brand || 'nyuchi', o.theme)
  let mark: string
  if (iconData) {
    mark = `<image href="${iconData}" x="${startX}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
  } else {
    mark = renderMark(startX, y, size, surface.mark)
  }
  const ty = y + size * 0.66
  const wm = `<text x="${startX + size + gap}" y="${ty.toFixed(1)}" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="400" font-size="${wmFs}" letter-spacing="${(wmFs * 0.04).toFixed(2)}" fill="${surface.fg}">${wmText}</text>`
  return { svg: mark + wm, width: totalW }
}

interface RenderMarkOpts { strokeWidth?: number; nodeRadius?: number }

function renderMark(x: number, y: number, size: number, color: string, opts?: RenderMarkOpts): string {
  const o = opts || {}
  const scale = size / 200
  const sw = o.strokeWidth ?? 5
  const nr = o.nodeRadius ?? 9
  let s = `<g transform="translate(${x} ${y}) scale(${scale})">`
  for (const [x1, y1, x2, y2] of MARK_EDGES) {
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="0.55"/>`
  }
  for (const [cx, cy] of MARK_NODES) {
    s += `<circle cx="${cx}" cy="${cy}" r="${nr}" fill="${color}"/>`
  }
  s += '</g>'
  return s
}

/* ────────────────────────── Lattice (background pattern) ────────────────
   Low-opacity repeating o2 graph across the canvas — the "subtle lattice".  */

function renderLattice(w: number, h: number, color: string, seed: number): string {
  const tile = 220 // px between graph centres
  const cols = Math.ceil(w / tile) + 1
  const rows = Math.ceil(h / tile) + 1
  const rand = mulberry32(seed ^ 0xA17ECE)
  let s = '<g opacity="0.06">'
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = c * tile + (r % 2 ? tile / 2 : 0)
      const cy = r * tile
      const rot = Math.floor(rand() * 4) * 90
      const scale = 0.45 + rand() * 0.15
      s += `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale}) translate(-100 -100)">`
      for (const [x1, y1, x2, y2] of MARK_EDGES) {
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
      }
      for (const [px, py] of MARK_NODES) {
        s += `<circle cx="${px}" cy="${py}" r="7" fill="${color}"/>`
      }
      s += '</g>'
    }
  }
  s += '</g>'
  return s
}

/* ────────────────────────── Layout context ────────────────────────── */

export interface LayoutCtx {
  w: number
  h: number
  surface: Surface
  cat: { key: Category; name: string; role: string; color: string }
  title: string
  dek: string
  seed: number
  opts: { lattice: boolean; lockup: boolean; brand: Brand; theme: ThemeKey }
}

/* ────────────────────────── Layout 01 · type-forward ────────────────── */

function layoutType(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.075)
  const innerW = w - pad * 2

  let svg = ''

  // background
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`

  // lattice
  if (opts.lattice) {
    svg += renderLattice(w, h, surface.fg, seed)
  }

  // graph: neurons firing — random per seed, anchored bottom-right, sits behind
  const nodeR = Math.max(10, w / 130)
  const coreR = Math.max(15, w / 90)
  const gPadR = Math.max(pad, coreR + 8)
  const gW = w * 0.62
  const gH = h * 0.78
  const graph = generateGraph(seed, 7, {
    x: w - gPadR - gW,
    y: h - pad - gH,
    w: gW,
    h: gH,
  }, { k: 2, minDist: Math.min(gW, gH) * 0.32, inset: coreR + 6 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.42, nodeOpacity: 0.7,
    strokeWidth: Math.max(2.5, w / 560),
    nodeRadius: nodeR,
    coreRadius: coreR,
  })

  // top kicker
  const kFs = Math.round(w * 0.013)
  svg += `<text x="${pad}" y="${pad + kFs}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.16).toFixed(2)}" fill="${surface.fg}" font-weight="500">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`
  svg += `<text x="${pad}" y="${pad + kFs}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.16).toFixed(2)}" fill="${surface.mut}" font-weight="500" text-anchor="end" transform="translate(${w - pad} 0)">NYUCHI · O2</text>`

  // divider
  svg += `<line x1="${pad}" y1="${pad + kFs + 16}" x2="${w - pad}" y2="${pad + kFs + 16}" stroke="${surface.edge}" stroke-width="1"/>`

  // title (auto-fit)
  const titleStartY = pad + kFs + 16 + Math.round(h * 0.06)
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const titleMaxFs = Math.round(h * 0.16)
  const titleMinFs = Math.round(h * 0.07)
  const tFit = fitText(title || '', innerW, 3, titleFontStr, titleMaxFs, titleMinFs)
  const titleLH = tFit.size * 1.05
  let ty = titleStartY + tFit.size * 0.82
  for (const line of tFit.lines) {
    svg += `<text x="${pad}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // dek
  const dekFs = Math.round(h * 0.028)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', innerW * 0.7, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.02)
  for (const line of dekFit.lines) {
    svg += `<text x="${pad}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-weight="400" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  // bottom lockup
  if (opts.lockup) {
    const markSize = Math.round(h * 0.055)
    const my = h - pad - markSize
    svg += renderLockup(pad, my, markSize, surface, { brand: opts.brand, theme: opts.theme }).svg
  }

  return svg
}

/* ────────────────────────── Layout 02 · off-center anchor ────────────── */

function layoutAnchor(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  const split = 0.46
  const leftW = w * split
  const rightX = leftW
  const rightW = w - leftW

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // RIGHT — big anchor graph
  const gMargin = Math.round(Math.min(w, h) * 0.05)
  const gBounds = {
    x: rightX + gMargin,
    y: gMargin,
    w: rightW - gMargin * 2,
    h: h - gMargin * 2,
  }
  const nodeR2 = Math.max(12, w / 95)
  const coreR2 = Math.max(20, w / 65)
  const graph = generateGraph(seed, 7, gBounds, { k: 3, minDist: Math.min(gBounds.w, gBounds.h) * 0.26, inset: coreR2 + 4 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.65, nodeOpacity: 1,
    strokeWidth: Math.max(3, w / 460),
    nodeRadius: nodeR2,
    coreRadius: coreR2,
  })

  // divider between left/right
  svg += `<line x1="${rightX}" y1="${pad}" x2="${rightX}" y2="${h - pad}" stroke="${surface.edge}" stroke-width="1"/>`

  // LEFT — text column
  const colW = leftW - pad * 2

  // kicker
  const kFs = Math.round(w * 0.011)
  svg += `<text x="${pad}" y="${pad + kFs + 4}" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.18).toFixed(2)}" fill="${cat.color}" font-weight="600">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`
  // small dot indicator
  svg += `<circle cx="${pad - 8}" cy="${pad + kFs - 1}" r="3" fill="${cat.color}"/>`

  // title
  const titleStartY = pad + kFs + Math.round(h * 0.08)
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const titleMaxFs = Math.round(h * 0.13)
  const titleMinFs = Math.round(h * 0.06)
  const tFit = fitText(title || '', colW, 4, titleFontStr, titleMaxFs, titleMinFs)
  let ty = titleStartY + tFit.size * 0.85
  const titleLH = tFit.size * 1.05
  for (const line of tFit.lines) {
    svg += `<text x="${pad}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // dek
  const dekFs = Math.round(h * 0.025)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', colW, 4, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.02)
  for (const line of dekFit.lines) {
    svg += `<text x="${pad}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  // bottom lockup
  if (opts.lockup) {
    const markSize = Math.round(h * 0.05)
    const my = h - pad - markSize
    svg += renderLockup(pad, my, markSize, surface, { brand: opts.brand, theme: opts.theme }).svg
  }

  return svg
}

/* ────────────────────────── Layout 03 · split block ─────────────────── */

function layoutSplit(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  const blockW = w * 0.34

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // LEFT block — solid category color
  svg += `<rect x="0" y="0" width="${blockW}" height="${h}" fill="${cat.color}"/>`

  // overlay graph on block
  const gMargin = Math.round(Math.min(blockW, h) * 0.12)
  const nodeR3 = Math.max(10, w / 110)
  const coreR3 = Math.max(16, w / 75)
  const graph = generateGraph(seed, 7, {
    x: gMargin,
    y: gMargin,
    w: blockW - gMargin * 2,
    h: h - gMargin * 2,
  }, { k: 2, minDist: Math.min(blockW, h) * 0.2, inset: coreR3 + 4 })
  svg += renderGraph(graph, {
    color: surface.bg, edgeOpacity: 0.6, nodeOpacity: 0.95,
    strokeWidth: Math.max(3, w / 500),
    nodeRadius: nodeR3,
    coreRadius: coreR3,
  })

  // big vertical category label inside block
  const catFs = Math.round(h * 0.04)
  svg += `<text x="${pad * 0.7}" y="${pad * 0.7 + catFs}" font-family="JetBrains Mono, monospace" font-weight="600" font-size="${catFs}" letter-spacing="${(catFs * 0.14).toFixed(2)}" fill="${surface.bg}">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`

  // bottom-left mark on the block (inverted lockup on category color)
  if (opts.lockup) {
    const markSize = Math.round(h * 0.05)
    const my = h - pad * 0.7 - markSize
    const invSurface = { mark: surface.bg, fg: surface.bg }
    svg += renderLockup(pad * 0.7, my, markSize, invSurface, { brand: opts.brand, theme: opts.theme }).svg
  }

  // RIGHT — text column on neutral surface
  const tx = blockW + pad
  const colW = w - blockW - pad * 2

  // kicker
  const kFs = Math.round(w * 0.011)
  svg += `<text x="${tx}" y="${pad + kFs + 4}" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.18).toFixed(2)}" fill="${surface.mut}" font-weight="500">FROM THE FIELD · NYUCHI</text>`

  // title
  const titleStartY = pad + kFs + Math.round(h * 0.08)
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const titleMaxFs = Math.round(h * 0.13)
  const titleMinFs = Math.round(h * 0.06)
  const tFit = fitText(title || '', colW, 4, titleFontStr, titleMaxFs, titleMinFs)
  let ty = titleStartY + tFit.size * 0.85
  const titleLH = tFit.size * 1.05
  for (const line of tFit.lines) {
    svg += `<text x="${tx}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // dek
  const dekFs = Math.round(h * 0.025)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', colW, 4, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.025)
  for (const line of dekFit.lines) {
    svg += `<text x="${tx}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  return svg
}

/* ────────────────────────── Layout 04 · centered halo ───────────────── */

function layoutHalo(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // wide halo graph BEHIND title — spans 80% width, centered vertically
  const gW = w * 0.84
  const gH = h * 0.78
  const gX = (w - gW) / 2
  const gY = (h - gH) / 2
  const nodeR4 = Math.max(12, w / 100)
  const coreR4 = Math.max(18, w / 70)
  const graph = generateGraph(seed, 7, {
    x: gX, y: gY, w: gW, h: gH,
  }, { k: 2, minDist: Math.min(gW, gH) * 0.24, inset: coreR4 + 4 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.55, nodeOpacity: 0.7,
    strokeWidth: Math.max(3, w / 500),
    nodeRadius: nodeR4,
    coreRadius: coreR4,
  })

  // top kicker — centered
  const kFs = Math.round(w * 0.012)
  const kText = `${cat.name.toUpperCase()}${cat.role ? ' · ' + cat.role.toUpperCase() : ''}`
  svg += `<text x="${w / 2}" y="${pad + kFs}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.2).toFixed(2)}" fill="${surface.mut}" font-weight="500">${esc(kText)}</text>`

  // measure title
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const titleMaxFs = Math.round(h * 0.14)
  const titleMinFs = Math.round(h * 0.07)
  const titleMaxW = w * 0.78
  const tFit = fitText(title || '', titleMaxW, 3, titleFontStr, titleMaxFs, titleMinFs)
  const titleLH = tFit.size * 1.05
  const titleBlockH = tFit.lines.length * titleLH

  // dek
  const dekFs = Math.round(h * 0.028)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', w * 0.65, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  const dekBlockH = dekFit.lines.length * dekFit.size * 1.35

  const totalH = titleBlockH + Math.round(h * 0.03) + dekBlockH
  let ty = (h - totalH) / 2 + tFit.size * 0.85

  // semi-transparent backing card for legibility (very subtle)
  // not a hard card — just a soft fill
  svg += `<rect x="${(w - titleMaxW) / 2 - 24}" y="${ty - tFit.size}" width="${titleMaxW + 48}" height="${titleBlockH + 8}" fill="${surface.bg}" opacity="0.78"/>`

  for (const line of tFit.lines) {
    svg += `<text x="${w / 2}" y="${ty.toFixed(1)}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // small divider mark under title
  const dvy = ty + Math.round(h * 0.005)
  svg += `<line x1="${w / 2 - 24}" y1="${dvy}" x2="${w / 2 + 24}" y2="${dvy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`

  let dy = dvy + Math.round(h * 0.04)
  for (const line of dekFit.lines) {
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  // bottom lockup — centered
  if (opts.lockup) {
    const markSize = Math.round(h * 0.05)
    const my = h - pad - markSize
    svg += renderLockup(w / 2, my, markSize, surface, { align: 'center', brand: opts.brand, theme: opts.theme }).svg
  }

  return svg
}

/* ────────────────────────── Square layouts (1:1) ───────────────────────
   Dedicated 1080×1080 compositions. Stacked, generous, centered.        */

function squareType(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(w * 0.08)
  const innerW = w - pad * 2

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // Top strip: kicker + rule
  const kFs = Math.round(w * 0.018)
  svg += `<text x="${pad}" y="${pad + kFs}" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.18).toFixed(2)}" fill="${cat.color}" font-weight="600">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`
  svg += `<text x="${w - pad}" y="${pad + kFs}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.18).toFixed(2)}" fill="${surface.mut}" font-weight="500">NYUCHI · O2</text>`
  svg += `<line x1="${pad}" y1="${pad + kFs + 18}" x2="${w - pad}" y2="${pad + kFs + 18}" stroke="${surface.edge}" stroke-width="1"/>`

  // Title block (upper-mid)
  const titleY0 = pad + kFs + 18 + Math.round(h * 0.07)
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const tFit = fitText(title || '', innerW, 4, titleFontStr, Math.round(h * 0.11), Math.round(h * 0.055))
  const titleLH = tFit.size * 1.06
  let ty = titleY0 + tFit.size * 0.85
  for (const line of tFit.lines) {
    svg += `<text x="${pad}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // Dek
  const dekFs = Math.round(h * 0.028)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', innerW * 0.92, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.018)
  for (const line of dekFit.lines) {
    svg += `<text x="${pad}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  // Bottom: BIG prominent graph filling the lower third, anchored right
  const lockMarkSize = Math.round(h * 0.06)
  const lockY = h - pad - lockMarkSize
  const gTop = dy + Math.round(h * 0.04)
  const gBottom = lockY - Math.round(h * 0.03)
  const nodeR = Math.max(14, w / 80)
  const coreR = Math.max(22, w / 55)
  const gW = w * 0.52
  const gH = Math.max(120, gBottom - gTop)
  const graph = generateGraph(seed, 7, {
    x: w - pad - gW, y: gTop, w: gW, h: gH,
  }, { k: 2, minDist: Math.min(gW, gH) * 0.26, inset: coreR + 6 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.7, nodeOpacity: 1,
    strokeWidth: Math.max(4, w / 360),
    nodeRadius: nodeR, coreRadius: coreR,
  })

  // Lockup bottom-left
  if (opts.lockup) {
    svg += renderLockup(pad, lockY, lockMarkSize, surface, { brand: opts.brand, theme: opts.theme }).svg
  }
  return svg
}

function squareAnchor(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(w * 0.08)

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // TOP HALF: huge centered graph
  const gH = h * 0.5
  const gW = w * 0.78
  const nodeR = Math.max(16, w / 70)
  const coreR = Math.max(26, w / 48)
  const graph = generateGraph(seed, 7, {
    x: (w - gW) / 2, y: pad + Math.round(h * 0.03),
    w: gW, h: gH - Math.round(h * 0.04),
  }, { k: 2, minDist: Math.min(gW, gH) * 0.24, inset: coreR + 6 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.7, nodeOpacity: 1,
    strokeWidth: Math.max(4, w / 320),
    nodeRadius: nodeR, coreRadius: coreR,
  })

  // hairline rule under graph
  const ruleY = pad + gH + Math.round(h * 0.02)
  svg += `<line x1="${pad}" y1="${ruleY}" x2="${w - pad}" y2="${ruleY}" stroke="${surface.edge}" stroke-width="1"/>`

  // kicker
  const kFs = Math.round(w * 0.018)
  svg += `<text x="${pad}" y="${ruleY + kFs + 22}" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.18).toFixed(2)}" fill="${cat.color}" font-weight="600">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`

  // title
  const innerW = w - pad * 2
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const tFit = fitText(title || '', innerW, 3, titleFontStr, Math.round(h * 0.085), Math.round(h * 0.05))
  let ty = ruleY + kFs + 22 + tFit.size * 0.95
  const titleLH = tFit.size * 1.05
  for (const line of tFit.lines) {
    svg += `<text x="${pad}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  // dek
  const dekFs = Math.round(h * 0.026)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', innerW, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.014)
  for (const line of dekFit.lines) {
    svg += `<text x="${pad}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  if (opts.lockup) {
    const ms = Math.round(h * 0.055)
    svg += renderLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }).svg
  }
  return svg
}

function squareSplit(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(w * 0.07)
  const blockH = h * 0.42

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // TOP block — solid category color
  svg += `<rect x="0" y="0" width="${w}" height="${blockH}" fill="${cat.color}"/>`

  // overlay graph in block
  const gMargin = Math.round(Math.min(w, blockH) * 0.1)
  const nodeR = Math.max(12, w / 90)
  const coreR = Math.max(20, w / 60)
  const graph = generateGraph(seed, 7, {
    x: gMargin, y: gMargin,
    w: w - gMargin * 2, h: blockH - gMargin * 2,
  }, { k: 2, minDist: Math.min(w, blockH) * 0.2, inset: coreR + 4 })
  svg += renderGraph(graph, {
    color: surface.bg, edgeOpacity: 0.6, nodeOpacity: 0.95,
    strokeWidth: Math.max(3, w / 420),
    nodeRadius: nodeR, coreRadius: coreR,
  })

  // category label inside block, top-left
  const catFs = Math.round(h * 0.024)
  svg += `<text x="${pad}" y="${pad + catFs}" font-family="JetBrains Mono, monospace" font-weight="600" font-size="${catFs}" letter-spacing="${(catFs * 0.16).toFixed(2)}" fill="${surface.bg}">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}</text>`

  // text below
  const tx = pad
  const tStart = blockH + Math.round(h * 0.07)
  const innerW = w - pad * 2
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const tFit = fitText(title || '', innerW, 4, titleFontStr, Math.round(h * 0.085), Math.round(h * 0.05))
  let ty = tStart + tFit.size * 0.88
  const titleLH = tFit.size * 1.05
  for (const line of tFit.lines) {
    svg += `<text x="${tx}" y="${ty.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }

  const dekFs = Math.round(h * 0.026)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', innerW, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  let dy = ty + Math.round(h * 0.018)
  for (const line of dekFit.lines) {
    svg += `<text x="${tx}" y="${dy.toFixed(1)}" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  if (opts.lockup) {
    const ms = Math.round(h * 0.05)
    svg += renderLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand, theme: opts.theme }).svg
  }
  return svg
}

function squareHalo(ctx: LayoutCtx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
  const pad = Math.round(w * 0.08)

  let svg = ''
  svg += `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += renderLattice(w, h, surface.fg, seed)

  // Huge centered halo graph filling 85%
  const gW = w * 0.86
  const gH = h * 0.86
  const nodeR = Math.max(14, w / 75)
  const coreR = Math.max(22, w / 50)
  const graph = generateGraph(seed, 7, {
    x: (w - gW) / 2, y: (h - gH) / 2, w: gW, h: gH,
  }, { k: 2, minDist: Math.min(gW, gH) * 0.24, inset: coreR + 6 })
  svg += renderGraph(graph, {
    color: cat.color, edgeOpacity: 0.55, nodeOpacity: 0.7,
    strokeWidth: Math.max(4, w / 360),
    nodeRadius: nodeR, coreRadius: coreR,
  })

  // kicker top centered
  const kFs = Math.round(w * 0.018)
  svg += `<text x="${w / 2}" y="${pad + kFs}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${kFs}" letter-spacing="${(kFs * 0.22).toFixed(2)}" fill="${cat.color}" font-weight="600">${esc(cat.name.toUpperCase())}${cat.role ? ' · ' + esc(cat.role.toUpperCase()) : ''}   ·   NYUCHI</text>`

  // measure title + dek
  const titleFontStr = `700 __SIZE__ "Noto Serif", Georgia, serif`
  const tFit = fitText(title || '', w * 0.78, 3, titleFontStr, Math.round(h * 0.1), Math.round(h * 0.055))
  const titleLH = tFit.size * 1.06
  const titleBlockH = tFit.lines.length * titleLH

  const dekFs = Math.round(h * 0.028)
  const dekFontStr = `400 __SIZE__ "Noto Serif", Georgia, serif`
  const dekFit = fitText(dek || '', w * 0.7, 3, dekFontStr, dekFs, Math.round(dekFs * 0.8))
  const dekBlockH = dekFit.lines.length * dekFit.size * 1.35

  const dividerH = Math.round(h * 0.04)
  const total = titleBlockH + dividerH + dekBlockH
  let ty = (h - total) / 2 + tFit.size * 0.85

  // soft backing for legibility
  const padTop = tFit.size * 0.4
  svg += `<rect x="${pad}" y="${ty - tFit.size - padTop}" width="${w - pad * 2}" height="${titleBlockH + dividerH + dekBlockH + padTop + tFit.size * 0.6}" fill="${surface.bg}" opacity="0.82"/>`

  for (const line of tFit.lines) {
    svg += `<text x="${w / 2}" y="${ty.toFixed(1)}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-weight="700" font-size="${tFit.size}" fill="${surface.fg}">${esc(line)}</text>`
    ty += titleLH
  }
  const dvy = ty + Math.round(h * 0.005)
  svg += `<line x1="${w / 2 - 28}" y1="${dvy}" x2="${w / 2 + 28}" y2="${dvy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`
  let dy = dvy + Math.round(h * 0.035)
  for (const line of dekFit.lines) {
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-style="italic" font-size="${dekFit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dekFit.size * 1.35
  }

  if (opts.lockup) {
    const ms = Math.round(h * 0.05)
    svg += renderLockup(w / 2, h - pad - ms, ms, surface, { align: 'center', brand: opts.brand, theme: opts.theme }).svg
  }
  return svg
}

const SQUARE_LAYOUTS: Record<number, (ctx: LayoutCtx) => string> = {
  1: squareType,
  2: squareAnchor,
  3: squareSplit,
  4: squareHalo,
}

/* ────────────────────────── Public API ────────────────────────── */

export const LAYOUTS: Record<number, { name: string; render: (ctx: LayoutCtx) => string }> = {
  1: { name: 'type-forward', render: layoutType },
  2: { name: 'anchor',       render: layoutAnchor },
  3: { name: 'split',        render: layoutSplit },
  4: { name: 'halo',         render: layoutHalo },
}

export function buildSVG(p: Params): BuildResult {
  const { format, layout, theme, category, title, dek, seedKey, lattice, lockup } = p
  const fmt = FORMATS[format] || FORMATS['16x9']
  const surface = SURFACE[theme] || SURFACE.light
  const catDef = CATEGORIES[category] || CATEGORIES.cobalt
  const cat = { key: category, name: catDef.name, role: catDef.role, color: theme === 'dark' ? catDef.dark : catDef.light }
  const seed = hashString(seedKey || ((title || '') + '·' + category + '·' + layout))
  const ctx: LayoutCtx = {
    w: fmt.w, h: fmt.h,
    surface, cat,
    title: title || '', dek: dek || '', seed,
    /* opts.theme picks the brand-icon variant when both are registered. */
    opts: { lattice: !!lattice, lockup: !!lockup, brand: p.brand || 'nyuchi', theme: theme === 'dark' ? 'dark' : 'light' },
  }
  const lay = LAYOUTS[layout] || LAYOUTS[1]
  // For 1:1 use dedicated square layouts
  const isSquare = Math.abs(fmt.w - fmt.h) < 4
  const renderFn = isSquare ? (SQUARE_LAYOUTS[layout] || SQUARE_LAYOUTS[1]) : lay.render
  const inner = renderFn(ctx)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt.w} ${fmt.h}" width="${fmt.w}" height="${fmt.h}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`
  return { svg, format: fmt, seed }
}

/* PNG export — serialize SVG, draw on canvas at 2x. */
export async function exportPNG(svgString: string, format: Format, scale = 2): Promise<Blob> {
  const { document: doc, Image: Img, URL: objectUrl } = DOM
  if (!doc || !Img || !objectUrl) throw new Error('exportPNG requires a browser environment')
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
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
    canvas.width = format.w * scale
    canvas.height = format.h * scale
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))), 'image/png')
    })
  } finally {
    objectUrl.revokeObjectURL(url)
  }
}
