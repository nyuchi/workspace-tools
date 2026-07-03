import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSVG,
  exportPNG,
  setBrandIcon,
  CATEGORIES,
  type Brand,
  type Category,
  type FormatKey,
  type Params,
  type ThemeKey,
} from '../../engines/banner'
import { loadBrandIcons } from '../../lib/loadBrandIcons'
import ControlPanel from './ControlPanel'
import Preview from './Preview'

export type SurfaceMode = 'auto' | ThemeKey

export interface BannerState {
  title: string
  dek: string
  category: Category
  format: FormatKey
  layout: number
  theme: SurfaceMode
  lattice: boolean
  lockup: boolean
  brand: Brand
  seedSalt: number
}

const INITIAL: BannerState = {
  title: 'Speed is rented. Truth is owned.',
  dek: 'A note on local-first software, the cost of being online, and what we owe to the next two billion devices.',
  category: 'cobalt',
  format: '16x9',
  layout: 1,
  theme: 'auto',
  lattice: true,
  lockup: true,
  brand: 'nyuchi',
  seedSalt: 0,
}

const LAYOUT_NAMES: Record<number, string> = {
  1: 'type-forward',
  2: 'anchor',
  3: 'split block',
  4: 'centered halo',
}

function readDomTheme(): ThemeKey {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

const BannerPage = () => {
  const [state, setState] = useState<BannerState>(INITIAL)
  const [domTheme, setDomTheme] = useState<ThemeKey>(readDomTheme)
  const [iconReady, setIconReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  /* Initial theme: restore persisted preference (matches the original app). */
  useEffect(() => {
    const saved = localStorage.getItem('nyuchi-theme')
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved)
      setDomTheme(saved)
    } else {
      setDomTheme(readDomTheme())
    }
  }, [])

  /* Register every per-theme brand icon from the registry so the lockup
   * embeds the right mark for the banner's theme. */
  useEffect(() => {
    let cancelled = false
    loadBrandIcons(setBrandIcon).then(() => {
      if (!cancelled) setIconReady(true)
    })
    return () => { cancelled = true }
  }, [])

  /* Re-render once fonts load — title auto-fitting needs real metrics
     (the source waits on document.fonts.ready before its final render). */
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      let cancelled = false
      document.fonts.ready.then(() => { if (!cancelled) setFontsReady(true) }).catch(() => { /* noop */ })
      return () => { cancelled = true }
    }
  }, [])

  const resolvedTheme: ThemeKey = state.theme === 'auto' ? domTheme : state.theme

  const params: Params = useMemo(
    () => ({
      format: state.format,
      layout: state.layout,
      theme: resolvedTheme,
      category: state.category,
      title: state.title,
      dek: state.dek,
      seedKey: `${state.title}·${state.category}·${state.layout}·${state.seedSalt}`,
      lattice: state.lattice,
      lockup: state.lockup,
      brand: state.brand,
    }),
    [state, resolvedTheme],
  )

  const built = useMemo(() => {
    // iconReady/fontsReady are dependencies so buildSVG re-runs once the bee
    // icon data-URI registers and once font metrics are final.
    void iconReady
    void fontsReady
    return buildSVG(params)
  }, [params, iconReady, fontsReady])

  /* ── Theme toggle ── */
  const toggleTheme = useCallback(() => {
    const cur = readDomTheme()
    const next: ThemeKey = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('nyuchi-theme', next)
    setDomTheme(next)
  }, [])

  /* ── Reshuffle / downloads ── */
  const shuffle = useCallback(() => setState((s) => ({ ...s, seedSalt: (s.seedSalt + 1) | 0 })), [])

  const fileBase = useCallback(() => {
    const safeTitle =
      (state.title || 'banner')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'banner'
    return `${safeTitle}-${state.category}-${state.format}-l${state.layout}`
  }, [state.title, state.category, state.format, state.layout])

  const downloadSvg = useCallback(() => {
    const blob = new Blob([built.svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileBase() + '.svg'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, [built.svg, fileBase])

  const [pngBusy, setPngBusy] = useState(false)
  const downloadPng = useCallback(async () => {
    setPngBusy(true)
    try {
      const blob = await exportPNG(built.svg, built.format, 2)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileBase() + '.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error('Export failed', err)
      alert('Could not render PNG — check console.')
    } finally {
      setPngBusy(false)
    }
  }, [built.svg, built.format, fileBase])

  /* WebMCP: expose the same download actions the UI buttons already call, so
   * an agent driving the browser can export a banner without scraping the
   * DOM. Feature-detected — a silent no-op wherever document.modelContext
   * doesn't exist (i.e. every browser in this repo's test matrix today). */
  useEffect(() => {
    if (typeof document === 'undefined' || !('modelContext' in document)) return
    const controller = new AbortController()
    document.modelContext?.registerTool(
      {
        name: 'download_article_banner_svg',
        description: 'Render and download the current article banner as an SVG file.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          downloadSvg()
          return { status: 'downloaded', format: 'svg' }
        },
        annotations: { readOnlyHint: false },
      },
      { signal: controller.signal },
    )
    document.modelContext?.registerTool(
      {
        name: 'download_article_banner_png',
        description: 'Render and download the current article banner as a PNG file.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          await downloadPng()
          return { status: 'downloaded', format: 'png' }
        },
        annotations: { readOnlyHint: false },
      },
      { signal: controller.signal },
    )
    return () => controller.abort()
  }, [downloadSvg, downloadPng])

  /* ── Readouts (mirror the source's doRender) ── */
  const cat = CATEGORIES[state.category]
  const dot = resolvedTheme === 'dark' ? cat.dark : cat.light
  const seedReadout = `seed ${('00000000' + built.seed.toString(16)).slice(-8)}`
  const layoutReadout = `layout 0${state.layout} · ${LAYOUT_NAMES[state.layout]}`
  const exportLabel = `${built.format.w * 2} × ${built.format.h * 2}`

  return (
    <>
      <style>{bannerCss}</style>
      <div className="banner-studio">
        <button className="toggle" type="button" onClick={toggleTheme} aria-label="Toggle theme">
          <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
          </svg>
          <svg className="moon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </svg>
          <span>Theme</span>
        </button>

        <header className="masthead">
          <div className="kicker">nyuchi · banner studio</div>
          <h1>
            Article <em>banner</em> generator
          </h1>
          <div className="kicker right">o2-seeded · category-driven</div>
        </header>

        <main className="workspace">
          <ControlPanel
            state={state}
            setState={setState}
            resolvedTheme={resolvedTheme}
            seedReadout={seedReadout}
            formatReadout={built.format.name}
          />

          <section className="panel preview">
            <div className="panel-label">
              <span>{layoutReadout}</span>
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: dot,
                    verticalAlign: 'middle',
                    marginRight: 6,
                  }}
                />
                {cat.name}
              </span>
            </div>

            <Preview svg={built.svg} formatW={built.format.w} formatH={built.format.h} />

            <div className="preview-meta">
              <div className="preview-dims">
                <b>{built.format.label}</b> · png export at 2× → <b>{exportLabel}</b>
              </div>
              <div className="actions">
                <button className="btn ghost" type="button" onClick={shuffle} title="Reseed graph">
                  Reshuffle
                </button>
                <button className="btn ghost" type="button" onClick={downloadSvg}>
                  SVG
                </button>
                <button className="btn primary" type="button" onClick={downloadPng} disabled={pngBusy}>
                  {pngBusy ? 'Rendering…' : 'PNG'}
                </button>
              </div>
            </div>
          </section>
        </main>

        <div className="footer-strip">
          <div>nyuchi design system · article banners</div>
          <div className="r">one motif · seven nodes · four formats</div>
        </div>
      </div>
    </>
  )
}

/* Ported from the source page's <style> block, scoped under .banner-studio.
   Token substitutions for the app's Mzizi tokens.css (the original ds file
   used --card / --input(border) / ink --primary / ink --ring):
     --card → --bn-card (var(--surface))
     --input ring → --bn-input-ring (var(--border))
     --primary/--primary-foreground → --bn-primary/--bn-primary-fg (ink/paper)
     --ring → --bn-ring (ink)
   The theme toggle is absolute (not fixed) so it sits below the app nav. */
const bannerCss = `
.banner-studio {
  --bn-card: var(--surface);
  --bn-input-ring: var(--border);
  --bn-primary: var(--foreground);
  --bn-primary-fg: var(--background);
  --bn-ring: var(--foreground);
  position: relative;
  min-height: calc(100dvh - 4rem);
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 14px;
}
.banner-studio *,
.banner-studio *::before,
.banner-studio *::after { box-sizing: border-box; }

/* ───── Masthead ───── */
.banner-studio .masthead {
  max-width: 1440px; margin: 0 auto;
  padding: var(--space-xl) var(--space-2xl) var(--space-base);
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: end; gap: var(--space-xl);
  border-bottom: 1px solid var(--border);
}
.banner-studio .kicker {
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.banner-studio .kicker.right { text-align: right; }
.banner-studio .masthead h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: var(--fs-h2);
  line-height: 1;
  white-space: nowrap;
}
.banner-studio .masthead h1 em {
  color: var(--color-gold);
  font-style: italic;
}

.banner-studio .toggle {
  position: absolute; top: var(--space-lg); right: var(--space-lg);
  display: inline-flex; align-items: center; gap: 6px;
  height: var(--h-button-xs);
  padding: 0 14px;
  border-radius: var(--radius-full);
  background: var(--bn-card);
  color: var(--foreground);
  box-shadow: var(--ring-1);
  border: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  z-index: 10;
}
.banner-studio .toggle:hover { background: var(--muted); }
.banner-studio .toggle svg { width: 14px; height: 14px; }
[data-theme="dark"] .banner-studio .toggle .sun { display: none; }
[data-theme="dark"] .banner-studio .toggle .moon { display: inline; }
.banner-studio .toggle .moon { display: none; }
.banner-studio .toggle .sun { display: inline; }

/* ───── Workspace ───── */
.banner-studio .workspace {
  max-width: 1440px; margin: 0 auto;
  padding: var(--space-xl) var(--space-2xl) var(--space-3xl);
  display: grid; grid-template-columns: 360px 1fr;
  gap: var(--space-xl);
}
.banner-studio .panel {
  background: var(--bn-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--ring-1);
  padding: var(--space-xl);
}
.banner-studio .panel.preview { padding: var(--space-lg); }

.banner-studio .panel-label {
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-lg);
}

/* ───── Form ───── */
.banner-studio .field { margin-bottom: var(--space-lg); }
.banner-studio .field:last-child { margin-bottom: 0; }
.banner-studio .field label {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  margin-bottom: var(--space-sm);
}
.banner-studio .field input[type="text"],
.banner-studio .field textarea,
.banner-studio .field select {
  width: 100%;
  height: var(--h-input-sm);
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  border: 0;
  background: var(--muted);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  box-shadow: inset 0 0 0 1px var(--bn-input-ring);
  outline: none;
  transition: box-shadow 150ms ease;
}
.banner-studio .field textarea {
  height: auto;
  min-height: 84px;
  padding: 10px var(--space-md);
  line-height: 1.4;
  resize: vertical;
  font-family: var(--font-serif);
  font-size: var(--fs-body-lg);
}
.banner-studio .field .title-input {
  height: auto;
  padding: 10px var(--space-md);
  font-family: var(--font-serif);
  font-size: var(--fs-h4);
  font-weight: 600;
  line-height: 1.15;
}
.banner-studio .field input:focus,
.banner-studio .field textarea:focus,
.banner-studio .field select:focus {
  box-shadow: inset 0 0 0 2px var(--bn-ring);
}

/* segmented control */
.banner-studio .seg {
  display: grid;
  gap: 4px;
  padding: 4px;
  background: var(--muted);
  border-radius: var(--radius-md);
  box-shadow: inset 0 0 0 1px var(--bn-input-ring);
}
.banner-studio .seg.h2 { grid-template-columns: 1fr 1fr; }
.banner-studio .seg.h3 { grid-template-columns: 1fr 1fr 1fr; }
.banner-studio .seg.h4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.banner-studio .seg button {
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  padding: 8px 6px;
  border-radius: calc(var(--radius-md) - 2px);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}
.banner-studio .seg button:hover { color: var(--foreground); }
.banner-studio .seg button.active {
  background: var(--bn-card);
  color: var(--foreground);
  box-shadow: var(--ring-1);
}

/* category grid */
.banner-studio .cats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.banner-studio .cat {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--muted);
  box-shadow: inset 0 0 0 1px var(--bn-input-ring);
  border: 0;
  cursor: pointer;
  text-align: left;
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  transition: box-shadow 150ms ease;
}
.banner-studio .cat .dot {
  width: 12px; height: 12px; border-radius: 999px; flex: 0 0 12px;
}
.banner-studio .cat.active {
  box-shadow: inset 0 0 0 2px var(--bn-ring);
  background: var(--bn-card);
}

/* switches (from the source tweaks panel) */
.banner-studio .switch {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  color: var(--foreground);
  cursor: pointer;
  text-transform: none;
  letter-spacing: normal;
}
.banner-studio .switch input { accent-color: var(--bn-ring); }

/* ───── Preview ───── */
.banner-studio .preview-frame {
  position: relative;
  width: 100%;
  background:
    repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%) 0 0 / 24px 24px;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: grid; place-items: center;
  padding: var(--space-lg);
  min-height: 540px;
}
.banner-studio .banner-host {
  position: relative;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.06),
    0 12px 32px rgba(0,0,0,0.08);
  border-radius: 2px;
  overflow: hidden;
}
.banner-studio .banner-host svg { display: block; width: 100%; height: 100%; }

.banner-studio .preview-meta {
  margin-top: var(--space-lg);
  display: flex; justify-content: space-between; align-items: center;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}
.banner-studio .preview-dims {
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.banner-studio .preview-dims b { color: var(--foreground); font-weight: 600; }

.banner-studio .actions { display: flex; gap: var(--space-md); }
.banner-studio .btn {
  display: inline-flex; align-items: center; gap: var(--space-sm);
  height: var(--h-button-sm);
  padding: 0 var(--space-lg);
  border-radius: var(--radius-full);
  border: 0;
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.banner-studio .btn.primary {
  background: var(--bn-primary);
  color: var(--bn-primary-fg);
}
.banner-studio .btn.primary:hover { background: color-mix(in oklab, var(--bn-primary) 80%, transparent); }
.banner-studio .btn.primary:disabled { opacity: .6; cursor: default; }
.banner-studio .btn.ghost {
  background: transparent;
  color: var(--foreground);
  box-shadow: inset 0 0 0 1px var(--bn-input-ring);
}
.banner-studio .btn.ghost:hover { background: var(--muted); }

/* notes / footer */
.banner-studio .footer-strip {
  max-width: 1440px; margin: 0 auto;
  padding: 0 var(--space-2xl) var(--space-xl);
  display: grid; grid-template-columns: 1fr 1fr;
  font-family: var(--font-mono);
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.banner-studio .footer-strip .r { text-align: right; }

@media (max-width: 1080px) {
  .banner-studio .workspace {
    grid-template-columns: 1fr;
    padding: var(--space-base);
    gap: var(--space-base);
  }
  .banner-studio .masthead {
    padding: var(--space-base) var(--space-base) var(--space-sm);
    grid-template-columns: 1fr;
    grid-template-areas: "k1" "h1" "k2";
    gap: 4px;
  }
  .banner-studio .masthead .kicker:first-child { grid-area: k1; }
  .banner-studio .masthead h1 { grid-area: h1; font-size: var(--fs-h4); white-space: normal; }
  .banner-studio .masthead .kicker.right { grid-area: k2; text-align: left; }
  .banner-studio .toggle {
    top: var(--space-sm);
    right: var(--space-sm);
    padding: 0 10px;
    height: 28px;
  }
  .banner-studio .toggle span { display: none; }
  .banner-studio .panel { padding: var(--space-base); }
  .banner-studio .panel.preview { padding: var(--space-sm); }
  .banner-studio .preview-frame { min-height: 280px; padding: var(--space-sm); }
  .banner-studio .preview-meta {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
  .banner-studio .actions { justify-content: flex-end; flex-wrap: wrap; }
  .banner-studio .footer-strip {
    grid-template-columns: 1fr;
    padding: 0 var(--space-base) var(--space-base);
    gap: 4px;
  }
  .banner-studio .footer-strip .r { text-align: left; }
  .banner-studio .cats { grid-template-columns: 1fr 1fr; }
  .banner-studio .field textarea { font-size: var(--fs-body); }
  .banner-studio .field .title-input { font-size: var(--fs-h5); }
  .banner-studio .seg.h4 button { font-size: 9px; padding: 7px 2px; }
}

@media (max-width: 480px) {
  .banner-studio .cats { grid-template-columns: 1fr; }
  .banner-studio .seg.h4 { grid-template-columns: 1fr 1fr; }
}
`

export default BannerPage
