import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSVG,
  exportPNG,
  CATEGORIES,
  setBrandIcon,
  type Brand,
  type Category,
  type Facet,
  type FormatKey,
  type Params,
  type ThemeKey,
} from '../../engines/nyuchi'
import { loadBrandIcons } from '../../lib/loadBrandIcons'
import ControlPanel from './ControlPanel'
import Preview from './Preview'
import { MINERALS } from './minerals'

export type SurfaceMode = 'auto' | ThemeKey

export interface StudioState {
  eyebrow: string
  title: string
  dek: string
  index: string
  footnote: string
  role: string
  category: Category
  format: FormatKey
  layout: number
  theme: SurfaceMode
  lockup: boolean
  lattice: boolean
  brand: Brand
  facet: Facet
  angle: number
  cleave: boolean
  salt: number
}

const INITIAL: StudioState = {
  eyebrow: '',
  title: 'Seven minerals, one ecosystem',
  dek: 'How the bundu palette carries meaning across every brand we build.',
  index: '',
  footnote: '',
  role: '',
  category: 'cobalt',
  format: 'ig',
  layout: 5,
  theme: 'auto',
  lockup: true,
  lattice: true,
  brand: 'nyuchi',
  facet: 'diagonal',
  angle: 62,
  cleave: true,
  salt: 0,
}

const LAYOUT_NAMES: Record<number, string> = { 1: 'type', 2: 'anchor', 3: 'split', 4: 'halo', 5: 'mineral' }

function fileBase(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36)
  return base || 'card'
}

function readDomTheme(): ThemeKey {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

const StudioPage = () => {
  const [state, setState] = useState<StudioState>(INITIAL)
  const [domTheme, setDomTheme] = useState<ThemeKey>(readDomTheme)
  const [iconReady, setIconReady] = useState(false)

  /* Initial theme: restore persisted preference (matches original studio). */
  useEffect(() => {
    const saved = localStorage.getItem('nyuchi-theme')
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved)
      setDomTheme(saved)
    } else {
      setDomTheme(readDomTheme())
    }
  }, [])

  /* Register every per-theme brand icon from the registry so lockups render
   * the right mark for the card's theme (e.g. gold bee on dark cards). */
  useEffect(() => {
    let cancelled = false
    loadBrandIcons(setBrandIcon).then(() => {
      if (!cancelled) setIconReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const resolvedTheme: ThemeKey = state.theme === 'auto' ? domTheme : state.theme

  const params: Params = useMemo(
    () => ({
      format: state.format,
      layout: state.layout,
      theme: resolvedTheme,
      category: state.category,
      eyebrow: state.eyebrow,
      title: state.title,
      dek: state.dek,
      index: state.index,
      footnote: state.footnote,
      role: state.role,
      facet: state.facet,
      angle: state.angle,
      cleave: state.cleave,
      lattice: state.lattice,
      lockup: state.lockup,
      brand: state.brand,
      seedKey: state.title + state.category + state.layout + state.salt,
    }),
    [state, resolvedTheme],
  )

  const built = useMemo(() => {
    // iconReady is used as a dependency so that once the bee icon loads,
    // we re-run buildSVG to swap in the image href in the lockup.
    void iconReady
    return buildSVG(params)
  }, [params, iconReady])

  /* ── Theme toggle ── */
  const toggleTheme = useCallback(() => {
    const cur = readDomTheme()
    const next: ThemeKey = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('nyuchi-theme', next)
    setDomTheme(next)
  }, [])

  /* ── Downloads ── */
  const downloadSvg = useCallback(() => {
    const blob = new Blob([built.svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase(state.title)}-${state.format}-l${state.layout}.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, [built.svg, state.title, state.format, state.layout])

  const [pngBusy, setPngBusy] = useState(false)
  const downloadPng = useCallback(async () => {
    setPngBusy(true)
    try {
      const blob = await exportPNG(built.svg, built.format, 2)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileBase(state.title)}-${state.format}-l${state.layout}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error(err)
      alert('Export failed — see console.')
    } finally {
      setPngBusy(false)
    }
  }, [built.svg, built.format, state.title, state.format, state.layout])

  /* ── Load mineral copy into the fields ── */
  const loadMineral = useCallback(() => {
    setState((s) => {
      const m = MINERALS[s.category]
      const def = CATEGORIES[s.category]
      return {
        ...s,
        title: def.name,
        dek: m.desc,
        index: m.idx,
        footnote: m.origin,
        role: m.role,
        eyebrow: '',
        layout: 5,
      }
    })
  }, [])

  const shuffle = useCallback(() => setState((s) => ({ ...s, salt: (s.salt + 1) | 0 })), [])

  /* ── Meta strings ── */
  const catDef = CATEGORIES[state.category]
  const dot = resolvedTheme === 'dark' ? catDef.dark : catDef.light
  const seedStr = 'seed ' + ('00000000' + built.seed.toString(16)).slice(-8)
  const layoutStr = 'L' + state.layout + ' · ' + LAYOUT_NAMES[state.layout]
  const exportStr = built.format.w * 2 + ' × ' + built.format.h * 2

  const previewRef = useRef<HTMLDivElement | null>(null)

  /* Bump a resize signal so the Preview re-runs its fit math after layout changes. */
  const [resizeSignal, setResizeSignal] = useState(0)
  useEffect(() => {
    const onResize = () => setResizeSignal((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
      <style>{studioCss}</style>
      <div className="nyuchi-studio">
        <ControlPanel
          state={state}
          setState={setState}
          onLoadMineral={loadMineral}
          onDownloadPng={downloadPng}
          onDownloadSvg={downloadSvg}
          onShuffle={shuffle}
          pngBusy={pngBusy}
        />
        <div className="ns-stage">
          <div className="ns-topbar">
            <button type="button" className="ns-topbtn" onClick={toggleTheme}>◐ Theme</button>
          </div>
          <Preview
            ref={previewRef}
            svg={built.svg}
            formatW={built.format.w}
            formatH={built.format.h}
            resizeSignal={resizeSignal}
          />
          <div className="ns-meta">
            <div>
              <b>{built.format.name}</b> · <span>{built.format.label}</span> · <span>{layoutStr}</span>
              <br />
              <span>
                <span
                  className="ns-dot"
                  style={{ background: dot }}
                />
                {catDef.name} · {state.role || catDef.role}
              </span>{' '}
              · <span>{seedStr}</span> · export <b>{exportStr}</b>
            </div>
            <div className="ns-actions">
              <button type="button" className="ns-btn-act ghost" onClick={shuffle} aria-label="Shuffle">↻</button>
              <button type="button" className="ns-btn-act ghost" onClick={downloadSvg}>SVG</button>
              <button type="button" className="ns-btn-act primary" onClick={downloadPng} disabled={pngBusy}>PNG</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* Scoped CSS for the studio. Uses design-token variables where sensible;
   falls back to the original studio's palette variables for chrome. */
const studioCss = `
.nyuchi-studio {
  --ns-fg: var(--foreground);
  --ns-fg2: var(--muted-foreground);
  --ns-bg: var(--background);
  --ns-panel: var(--surface);
  --ns-card: var(--overlay);
  --ns-line: var(--border);
  --ns-accent: var(--color-copper-raw);
  --ns-input: var(--input);
  display: flex;
  min-height: calc(100dvh - 4rem);
  background: var(--ns-bg);
  color: var(--ns-fg);
  font-family: var(--font-sans);
}
.nyuchi-studio *,
.nyuchi-studio *::before,
.nyuchi-studio *::after { box-sizing: border-box; }

/* Panel */
.nyuchi-studio .ns-panel {
  width: 330px; flex-shrink: 0;
  background: var(--ns-panel);
  border-right: 1px solid var(--ns-line);
  padding: 18px 16px;
  overflow-y: auto;
  max-height: calc(100dvh - 4rem);
  position: sticky; top: 4rem;
}
.nyuchi-studio .ns-brandhead { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
.nyuchi-studio .ns-brandhead img { width: 26px; height: 26px; object-fit: contain; }
.nyuchi-studio .ns-brandhead h1 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0; }
.nyuchi-studio .ns-tag {
  font-family: var(--font-mono); font-size: 10px; color: var(--ns-fg2);
  margin-bottom: 16px; display: block; letter-spacing: .08em;
}
.nyuchi-studio .ns-grp { margin-bottom: 15px; border-bottom: 1px solid var(--ns-line); padding-bottom: 14px; }
.nyuchi-studio .ns-grp:last-child { border: none; margin-bottom: 0; }
.nyuchi-studio .ns-grp h2 {
  font-size: 10px; text-transform: uppercase; letter-spacing: .14em;
  color: var(--ns-fg2); margin-bottom: 9px; font-family: var(--font-mono); font-weight: 600;
}
.nyuchi-studio label { display: block; font-size: 11px; color: var(--ns-fg2); margin: 9px 0 3px; }
.nyuchi-studio .ns-lab-row { display: flex; justify-content: space-between; align-items: baseline; }
.nyuchi-studio input[type=text],
.nyuchi-studio textarea {
  width: 100%; background: var(--ns-input); border: 1px solid var(--ns-line); color: var(--ns-fg);
  border-radius: 10px; padding: 8px 10px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.nyuchi-studio input[type=text]:focus,
.nyuchi-studio textarea:focus { border-color: var(--ns-accent); }
.nyuchi-studio textarea { resize: vertical; min-height: 44px; line-height: 1.4; }
.nyuchi-studio .ns-two { display: flex; gap: 8px; }
.nyuchi-studio .ns-two > div { flex: 1; }
.nyuchi-studio input[type=range] { width: 100%; accent-color: var(--ns-accent); margin-top: 5px; }

.nyuchi-studio .ns-seg { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
.nyuchi-studio .ns-seg button {
  flex: 1; min-width: 46px; background: var(--ns-input); border: 1px solid var(--ns-line);
  color: var(--ns-fg2); border-radius: 999px; padding: 7px 4px; font-size: 10px; font-weight: 600;
  cursor: pointer; font-family: var(--font-mono); letter-spacing: .04em; transition: .12s; white-space: nowrap;
}
.nyuchi-studio .ns-seg button.active { background: var(--ns-accent); color: #1a0d06; border-color: var(--ns-accent); }
.nyuchi-studio .ns-seg button:hover:not(.active) { color: var(--ns-fg); }

.nyuchi-studio .ns-palette { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 5px; }
.nyuchi-studio .ns-swatch-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px;
  background: var(--ns-input); border: 1.5px solid transparent; border-radius: 9px; cursor: pointer;
  font-family: var(--font-sans); color: var(--ns-fg); transition: .12s;
}
.nyuchi-studio .ns-swatch-chip .ns-chip-color { width: 100%; height: 22px; border-radius: 5px; }
.nyuchi-studio .ns-swatch-chip .ns-chip-name { font-size: 9px; letter-spacing: .02em; }
.nyuchi-studio .ns-swatch-chip.active { border-color: var(--ns-accent); }

.nyuchi-studio .ns-chk { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--ns-fg); cursor: pointer; }
.nyuchi-studio .ns-chk input { width: auto; accent-color: var(--ns-accent); }

.nyuchi-studio .ns-act {
  width: 100%; background: var(--ns-accent); color: #1a0d06; border: none; border-radius: 999px;
  padding: 11px; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 7px;
  font-family: var(--font-sans); transition: opacity .15s;
}
.nyuchi-studio .ns-act:hover { opacity: .88; }
.nyuchi-studio .ns-act:disabled { opacity: .55; cursor: default; }
.nyuchi-studio .ns-act.sec { background: transparent; border: 1px solid var(--ns-line); color: var(--ns-fg); }
.nyuchi-studio .ns-hint { font-size: 10px; color: var(--ns-fg2); line-height: 1.5; margin-top: 7px; }
.nyuchi-studio .ns-hide { display: none !important; }

/* Stage */
.nyuchi-studio .ns-stage {
  flex: 1; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px;
  overflow-y: auto; min-height: calc(100dvh - 4rem);
}
.nyuchi-studio .ns-topbar { display: flex; gap: 8px; align-items: center; justify-content: flex-end; width: 100%; max-width: 1100px; }
.nyuchi-studio .ns-topbtn {
  background: var(--ns-panel); border: 1px solid var(--ns-line); color: var(--ns-fg2);
  border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-mono);
}
.nyuchi-studio .ns-topbtn:hover { color: var(--ns-fg); }
.nyuchi-studio .ns-preview-frame {
  width: 100%; max-width: 1100px; flex: 1; min-height: 240px;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: repeating-conic-gradient(var(--ns-card) 0 25%, transparent 0 50%) 0 0 / 22px 22px;
  border-radius: 10px;
}
.nyuchi-studio .ns-card-host { box-shadow: 0 6px 36px rgba(0,0,0,.45); border-radius: 3px; overflow: hidden; flex-shrink: 0; }
.nyuchi-studio .ns-card-host svg { display: block; width: 100%; height: 100%; }
.nyuchi-studio .ns-meta {
  width: 100%; max-width: 1100px; display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--ns-line);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; color: var(--ns-fg2); line-height: 1.7;
}
.nyuchi-studio .ns-meta b { color: var(--ns-fg); font-weight: 600; }
.nyuchi-studio .ns-actions { display: flex; gap: 6px; }
.nyuchi-studio .ns-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 99px;
  vertical-align: middle; margin-right: 5px;
}
.nyuchi-studio .ns-btn-act {
  display: inline-flex; align-items: center; height: 34px; padding: 0 16px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.nyuchi-studio .ns-btn-act.primary { background: var(--ns-accent); color: #1a0d06; }
.nyuchi-studio .ns-btn-act.ghost { background: transparent; border: 1px solid var(--ns-line); color: var(--ns-fg); }
.nyuchi-studio .ns-btn-act:hover { opacity: .82; }
.nyuchi-studio .ns-btn-act:disabled { opacity: .5; cursor: default; }

@media (max-width: 768px) {
  .nyuchi-studio { flex-direction: column; }
  .nyuchi-studio .ns-panel { width: 100%; position: relative; top: 0; max-height: none; border-right: none; border-bottom: 1px solid var(--ns-line); }
  .nyuchi-studio .ns-stage { min-height: 60vh; padding: 14px 12px 28px; }
  .nyuchi-studio .ns-preview-frame { min-height: 200px; flex: none; }
  .nyuchi-studio .ns-meta { flex-direction: column; align-items: stretch; }
  .nyuchi-studio .ns-actions { justify-content: flex-end; }
}
`

export default StudioPage
