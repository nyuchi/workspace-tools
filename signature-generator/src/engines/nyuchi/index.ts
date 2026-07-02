/* Nyuchi social-card engine — TypeScript port of nyuchi-engine.js.
   Pure functional: same seeded RNG, graph algorithm, and layouts as the
   original vanilla IIFE. Do not "improve" — keep pixel output identical. */

export type Category =
  | 'cobalt'
  | 'sodalite'
  | 'tanzanite'
  | 'malachite'
  | 'gold'
  | 'copper'
  | 'terracotta'

export type FormatKey = '16x9' | 'og' | 'li' | 'ig' | 'story'

export type ThemeKey = 'light' | 'dark'

export type Brand = 'nyuchi' | 'bundu'

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

export const SURFACE: Record<ThemeKey, Surface> = {
  light: { bg: '#FAF9F5', fg: '#141413', mut: '#5C5B58', edge: 'rgba(10,10,10,.08)',   mark: '#5D4037' },
  dark:  { bg: '#0F0E0C', fg: '#FAF9F5', mut: '#B2AFA8', edge: 'rgba(255,255,255,.08)', mark: '#FFD740' },
}

/* Optional data-URI icons per brand (populated at runtime by the app). */
const BRAND_ICONS: Partial<Record<Brand, string>> = {}
export function setBrandIcon(brand: Brand, dataUri: string): void {
  BRAND_ICONS[brand] = dataUri
}
export function getBrandIcon(brand: Brand): string | undefined {
  return BRAND_ICONS[brand]
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
let _mx: CanvasRenderingContext2D | null = null
function ctx2d(): CanvasRenderingContext2D {
  if (!_mx) {
    _mx = document.createElement('canvas').getContext('2d')!
  }
  return _mx
}
function measure(text: string, font: string): number {
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
    if (lines.length <= maxLines) return { size, lines, font }
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

interface LockupOpts { align?: 'left' | 'center'; brand?: Brand }
function drawLockup(x: number, y: number, size: number, surface: Surface, opts?: LockupOpts): string {
  const o = opts || {}
  const align = o.align || 'left'
  const brand: Brand = o.brand || 'nyuchi'
  const url = brand === 'bundu' ? 'bundu.org' : 'nyuchi.com'
  const fs = Math.round(size * 0.5)
  const gap = Math.round(size * 0.22)
  const tw = measure(url, `400 ${fs}px "JetBrains Mono",monospace`)
  const totalW = size + gap + tw
  const sx = align === 'center' ? x - totalW / 2 : x
  const icon = BRAND_ICONS[brand]
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
  seed: number
  eyebrow: string
  opts: {
    lattice: boolean
    lockup: boolean
    brand: Brand
    index: string
    footnote: string
    facet: Facet
    angle: number
    cleave: boolean
  }
}

/* ═══════════════════ LAYOUT 01 · type-forward ═══════════════════ */
function layoutType(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.075)
  const iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const nr = Math.max(10, w / 130), cr = Math.max(15, w / 90), gpr = Math.max(pad, cr + 8)
  const gw = w * 0.55, gh = h * 0.72
  const g = makeGraph(seed, 7, { x: w - gpr - gw, y: h - pad - gh, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.3, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.38, nodeOpacity: 0.65, strokeWidth: Math.max(2.5, w / 560), nodeRadius: nr, coreRadius: cr })

  const kfs = Math.round(w * 0.013)
  svg += `<text x="${pad}" y="${pad + kfs}" font-family="JetBrains Mono,monospace" font-size="${kfs}" letter-spacing="${(kfs * 0.16).toFixed(1)}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`
  svg += `<text x="${w - pad}" y="${pad + kfs}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${surface.mut}">NYUCHI · O2</text>`
  svg += `<line x1="${pad}" y1="${pad + kfs + 14}" x2="${w - pad}" y2="${pad + kfs + 14}" stroke="${surface.edge}" stroke-width="1"/>`

  const tsY = pad + kfs + 14 + Math.round(h * 0.06)
  const sb = safeBottom(h, pad, opts.lockup)
  const tfit = fitText(title || '', iw * 0.65, 3, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.15), Math.round(h * 0.065))
  const tlh = tfit.size * 1.06
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tlh, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.026)
  const dfit = fitText(dek || '', iw * 0.58, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, surface.mut, sb)

  if (opts.lockup) {
    const ms = Math.round(h * 0.055)
    svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand })
  }
  return svg
}

/* ═══════════════════ LAYOUT 02 · anchor ═══════════════════ */
function layoutAnchor(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  const lx = w * 0.46, rw = w - lx, colW = lx - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gm = Math.round(Math.min(w, h) * 0.05), nr = Math.max(12, w / 95), cr = Math.max(20, w / 65)
  const gb = { x: lx + gm, y: gm, w: rw - gm * 2, h: h - gm * 2 }
  const g = makeGraph(seed, 7, gb, { k: 3, minDist: Math.min(gb.w, gb.h) * 0.25, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.6, nodeOpacity: 0.95, strokeWidth: Math.max(3, w / 460), nodeRadius: nr, coreRadius: cr })
  svg += `<line x1="${lx}" y1="${pad}" x2="${lx}" y2="${h - pad}" stroke="${surface.edge}" stroke-width="1"/>`

  const kfs = Math.round(w * 0.011), tsY = pad + kfs + Math.round(h * 0.085)
  svg += `<text x="${pad}" y="${pad + kfs + 4}" font-family="JetBrains Mono,monospace" font-size="${kfs}" letter-spacing="${(kfs * 0.18).toFixed(1)}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`
  svg += `<circle cx="${pad - 8}" cy="${pad + kfs}" r="3" fill="${cat.color}"/>`

  const sb = safeBottom(h, pad, opts.lockup)
  const tfit = fitText(title || '', colW, 4, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.12), Math.round(h * 0.055))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.023)
  const dfit = fitText(dek || '', colW, 4, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, surface.mut, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand }) }
  return svg
}

/* ═══════════════════ LAYOUT 03 · split block ═══════════════════ */
function layoutSplit(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
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
    svg += drawLockup(pad * 0.7, h - pad * 0.7 - ms, ms, inv, { brand: opts.brand })
  }

  const tx = bw + pad, colW = w - bw - pad * 2
  const kfs = Math.round(w * 0.011)
  svg += `<text x="${tx}" y="${pad + kfs + 4}" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${surface.mut}">${esc(cat.role.toUpperCase())}</text>`

  const sb = safeBottom(h, pad, false)
  const tsY = pad + kfs + Math.round(h * 0.075)
  const tfit = fitText(title || '', colW, 4, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.12), Math.round(h * 0.055))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, tx, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.023)
  const dfit = fitText(dek || '', colW, 4, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, tx, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, surface.mut, sb)
  return svg
}

/* ═══════════════════ LAYOUT 04 · halo ═══════════════════ */
function layoutHalo(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(Math.min(w, h) * 0.07)
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gw = w * 0.82, gh = h * 0.82, nr = Math.max(12, w / 100), cr = Math.max(20, w / 68)
  const g = makeGraph(seed, 7, { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.3, nodeOpacity: 0.45, strokeWidth: Math.max(3, w / 500), nodeRadius: nr, coreRadius: cr })

  const kfs = Math.round(w * 0.012)
  svg += `<text x="${w / 2}" y="${pad + kfs}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="${kfs}" letter-spacing="${(kfs * 0.2).toFixed(1)}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`

  const tfw = w * 0.76
  const tfit = fitText(title || '', tfw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.13), Math.round(h * 0.065))
  const tlh = tfit.size * 1.06
  const tblk = tfit.lines.length * tlh
  const dfs = Math.round(h * 0.026)
  const dfit = fitText(dek || '', w * 0.65, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  const total = tblk + Math.round(h * 0.04) + dfit.lines.length * dfit.size * 1.3
  const ty = (h - total) / 2

  const backH = tblk + Math.round(h * 0.06) + dfit.lines.length * dfit.size * 1.35
  svg += `<rect x="${(w - tfw) / 2 - 24}" y="${ty - tfit.size * 0.2}" width="${tfw + 48}" height="${backH}" fill="${surface.bg}" opacity=".82"/>`

  let tcy = ty + tfit.size * 0.88
  for (const line of tfit.lines) {
    svg += `<text x="${w / 2}" y="${tcy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${tfit.size}" fill="${surface.fg}">${esc(line)}</text>`
    tcy += tlh
  }
  svg += `<line x1="${w / 2 - 26}" y1="${tcy}" x2="${w / 2 + 26}" y2="${tcy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`

  const sb = safeBottom(h, pad, opts.lockup)
  let dy = tcy + Math.round(h * 0.035)
  for (const line of dfit.lines) {
    if (dy + dfit.size > sb) break
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dfit.size * 1.3
  }

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(w / 2, h - pad - ms, ms, surface, { align: 'center', brand: opts.brand }) }
  return svg
}

/* ═══════════════════ SQUARE LAYOUTS (1:1 dedicated) ═══════════════════ */
function sqType(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08), iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const kfs = Math.round(w * 0.018)
  svg += `<text x="${pad}" y="${pad + kfs}" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`
  svg += `<text x="${w - pad}" y="${pad + kfs}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${surface.mut}">NYUCHI · O2</text>`
  svg += `<line x1="${pad}" y1="${pad + kfs + 16}" x2="${w - pad}" y2="${pad + kfs + 16}" stroke="${surface.edge}" stroke-width="1"/>`

  const tsY = pad + kfs + 16 + Math.round(h * 0.07)
  const sb = safeBottom(h, pad, opts.lockup)
  const tfit = fitText(title || '', iw, 4, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.1), Math.round(h * 0.05))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.06, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.026)
  const dfit = fitText(dek || '', iw * 0.88, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.016), dfit.size * 1.3, surface.mut, sb)

  const lockH = opts.lockup ? Math.round(h * 0.1) : 0
  const gTop = Math.max(endY + Math.round(h * 0.04), h * 0.55)
  const nr = Math.max(14, w / 78), cr = Math.max(22, w / 54)
  const gw = w * 0.5, gbot = h - pad - lockH - Math.round(h * 0.02)
  const gh = Math.max(100, gbot - gTop)
  const g = makeGraph(seed, 7, { x: w - pad - gw, y: gTop, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.28, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.65, nodeOpacity: 0.95, strokeWidth: Math.max(4, w / 360), nodeRadius: nr, coreRadius: cr })

  if (opts.lockup) { const ms = Math.round(h * 0.058); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand }) }
  return svg
}

function sqAnchor(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08), iw = w - pad * 2
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gH = h * 0.48, gw = w * 0.75, nr = Math.max(16, w / 68), cr = Math.max(26, w / 46)
  const g = makeGraph(seed, 7, { x: (w - gw) / 2, y: pad + Math.round(h * 0.02), w: gw, h: gH - Math.round(h * 0.04) }, { k: 3, minDist: Math.min(gw, gH) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.65, nodeOpacity: 0.95, strokeWidth: Math.max(4, w / 320), nodeRadius: nr, coreRadius: cr })

  const ruleY = pad + gH
  svg += `<line x1="${pad}" y1="${ruleY}" x2="${w - pad}" y2="${ruleY}" stroke="${surface.edge}" stroke-width="1"/>`

  const kfs = Math.round(w * 0.018)
  svg += `<text x="${pad}" y="${ruleY + kfs + 18}" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`

  const sb = safeBottom(h, pad, opts.lockup)
  const tsY = ruleY + kfs + 18
  const tfit = fitText(title || '', iw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.08), Math.round(h * 0.048))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.024)
  const dfit = fitText(dek || '', iw, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.012), dfit.size * 1.3, surface.mut, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.055); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand }) }
  return svg
}

function sqSplit(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts } = ctx
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
  const tfit = fitText(title || '', iw, 4, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.08), Math.round(h * 0.048))
  const { svg: svg2, endY } = drawTitle(svg, tfit.lines, pad, tfit.size, tsY, tfit.size * 1.05, surface.fg)
  svg = svg2

  const dfs = Math.round(h * 0.024)
  const dfit = fitText(dek || '', iw, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  svg = drawDek(svg, dfit.lines, pad, dfit.size, endY + Math.round(h * 0.015), dfit.size * 1.3, surface.mut, sb)

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(pad, h - pad - ms, ms, surface, { brand: opts.brand }) }
  return svg
}

function sqHalo(ctx: Ctx): string {
  const { w, h, surface, cat, title, dek, seed, opts, eyebrow } = ctx
  const pad = Math.round(w * 0.08)
  let svg = `<rect width="${w}" height="${h}" fill="${surface.bg}"/>`
  if (opts.lattice) svg += drawEngBackground(w, h, surface.fg)

  const gw = w * 0.85, gh = h * 0.85, nr = Math.max(14, w / 74), cr = Math.max(22, w / 50)
  const g = makeGraph(seed, 7, { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh }, { k: 2, minDist: Math.min(gw, gh) * 0.24, inset: cr + 4 })
  svg += drawGraph(g, { color: cat.color, edgeOpacity: 0.45, nodeOpacity: 0.6, strokeWidth: Math.max(4, w / 360), nodeRadius: nr, coreRadius: cr })

  const kfs = Math.round(w * 0.018)
  svg += `<text x="${w / 2}" y="${pad + kfs}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="${kfs}" fill="${cat.color}" font-weight="600">${esc(eyebrow.toUpperCase())}</text>`

  const tfw = w * 0.76
  const tfit = fitText(title || '', tfw, 3, '700 __SZ__ "Noto Serif",Georgia,serif', Math.round(h * 0.095), Math.round(h * 0.05))
  const tlh = tfit.size * 1.06, tblk = tfit.lines.length * tlh
  const dfs = Math.round(h * 0.026)
  const dfit = fitText(dek || '', w * 0.7, 3, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  const total = tblk + Math.round(h * 0.045) + dfit.lines.length * dfit.size * 1.3
  const ty = (h - total) / 2

  const backH = total + tfit.size * 0.4
  svg += `<rect x="${(w - tfw) / 2 - 20}" y="${ty - tfit.size * 0.15}" width="${tfw + 40}" height="${backH}" fill="${surface.bg}" opacity=".82"/>`

  let tcy = ty + tfit.size * 0.88
  for (const line of tfit.lines) {
    svg += `<text x="${w / 2}" y="${tcy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${tfit.size}" fill="${surface.fg}">${esc(line)}</text>`
    tcy += tlh
  }
  svg += `<line x1="${w / 2 - 26}" y1="${tcy}" x2="${w / 2 + 26}" y2="${tcy}" stroke="${cat.color}" stroke-width="2" stroke-linecap="round"/>`

  const sb = safeBottom(h, pad, opts.lockup)
  let dy = tcy + Math.round(h * 0.034)
  for (const line of dfit.lines) {
    if (dy + dfit.size > sb) break
    svg += `<text x="${w / 2}" y="${dy.toFixed(1)}" text-anchor="middle" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${surface.mut}">${esc(line)}</text>`
    dy += dfit.size * 1.3
  }

  if (opts.lockup) { const ms = Math.round(h * 0.05); svg += drawLockup(w / 2, h - pad - ms, ms, surface, { align: 'center', brand: opts.brand }) }
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

  const idxFs = Math.round(swH * 0.16)
  if (opts.index) svg += `<text x="${swX + swW * 0.05}" y="${(swY + swH * 0.05 + idxFs).toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-weight="700" font-size="${idxFs}" fill="${txtOn(cat.dark)}">${esc(opts.index)}</text>`
  const hexFs = Math.round(swH * 0.062)
  svg += `<text x="${swX + swW * 0.05}" y="${(swY + swH - swH * 0.06).toFixed(1)}" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${hexFs}" fill="${txtOn(cat.dark)}">DARK ${cat.dark}</text>`
  svg += `<text x="${swX + swW - swW * 0.05}" y="${(swY + swH - swH * 0.06).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono,monospace" font-weight="600" font-size="${hexFs}" fill="${txtOn(cat.light)}">LIGHT ${cat.light}</text>`

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
  const dfs = Math.round(h * (tall ? 0.024 : 0.027))
  const dfit = fitText(dek || '', iw, 5, '400 __SZ__ "Noto Serif",Georgia,serif', dfs, Math.round(dfs * 0.8))
  for (const line of dfit.lines) {
    if (cy + dfit.size > sb) break
    svg += `<text x="${pad}" y="${(cy + dfit.size * 0.85).toFixed(1)}" font-family="Noto Serif,Georgia,serif" font-style="italic" font-size="${dfit.size}" fill="${surface.mut}">${esc(line)}</text>`
    cy += dfit.size * 1.32
  }

  if (opts.footnote) {
    const ofs = Math.round(h * 0.0155)
    svg += `<text x="${pad}" y="${h - pad}" font-family="JetBrains Mono,monospace" font-size="${ofs}" letter-spacing="${(ofs * 0.06).toFixed(1)}" fill="${surface.mut}">${esc(String(opts.footnote).toUpperCase())}</text>`
  }
  if (opts.lockup) {
    const ms = Math.round(h * 0.05), fs = Math.round(ms * 0.5), gap = Math.round(ms * 0.22)
    const url = opts.brand === 'bundu' ? 'bundu.org' : 'nyuchi.com'
    const tw = measure(url, `400 ${fs}px "JetBrains Mono",monospace`)
    svg += drawLockup(w - pad - (ms + gap + tw), h - pad - ms, ms, surface, { brand: opts.brand })
  }
  return svg
}

/* ═══════════════════ PUBLIC API ═══════════════════ */
const REGULAR: Record<number, (ctx: Ctx) => string> = { 1: layoutType, 2: layoutAnchor, 3: layoutSplit, 4: layoutHalo }
const SQUARE:  Record<number, (ctx: Ctx) => string> = { 1: sqType,     2: sqAnchor,     3: sqSplit,     4: sqHalo }

export function buildSVG(p: Params): BuildResult {
  const fmt = FORMATS[p.format] || FORMATS['16x9']
  const surface = SURFACE[p.theme] || SURFACE.light
  const catDef = CATEGORIES[p.category] || CATEGORIES.cobalt
  const cat = {
    key: p.category,
    name: catDef.name,
    role: p.role || catDef.role,
    color: p.theme === 'dark' ? catDef.dark : catDef.light,
    dark: catDef.dark,
    light: catDef.light,
  }
  const eyebrow = (p.eyebrow && p.eyebrow.trim()) || (catDef.name + ' · ' + catDef.role)
  const seed = hash((p.seedKey || '') + p.category + p.layout)
  const ctx: Ctx = {
    w: fmt.w, h: fmt.h, surface, cat,
    title: p.title || '',
    dek: p.dek || '',
    seed, eyebrow,
    opts: {
      lattice: !!p.lattice,
      lockup: !!p.lockup,
      brand: p.brand || 'nyuchi',
      index: p.index || '',
      footnote: p.footnote || '',
      facet: p.facet || 'diagonal',
      angle: p.angle ?? 62,
      cleave: p.cleave !== false,
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
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG image load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
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
    URL.revokeObjectURL(url)
  }
}
