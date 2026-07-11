import type { Dispatch, SetStateAction } from 'react'
import type { Brand, Category, FormatKey, ThemeKey } from '../../engines/banner'
import type { BannerState, SurfaceMode } from './BannerPage'
import CategoryChips from './CategoryChips'

interface Props {
  state: BannerState
  setState: Dispatch<SetStateAction<BannerState>>
  resolvedTheme: ThemeKey
  seedReadout: string
  formatReadout: string
}

const FORMAT_OPTIONS: { v: FormatKey; label: string }[] = [
  { v: '16x9', label: '16:9' },
  { v: 'og',   label: 'OG' },
  { v: 'li',   label: 'LinkedIn' },
  { v: 'ig',   label: 'Square' },
]

const LAYOUT_OPTIONS: { v: number; label: string; desc: string }[] = [
  {
    v: 1,
    label: '01 type',
    desc: 'Type-forward — the headline fills most of the frame; kicker, dek, and lockup frame it, with the node graph subtle in the background.',
  },
  {
    v: 2,
    label: '02 anchor',
    desc: 'Text sits left in a narrow column; a large node-graph mark anchors the right half as its own graphic block.',
  },
  {
    v: 3,
    label: '03 split',
    desc: 'A solid mineral-colour panel (kicker + node graph + lockup) split against the headline on a dark panel — the boldest, most color-blocked option.',
  },
  {
    v: 4,
    label: '04 halo',
    desc: 'Everything centered — kicker, headline, dek, lockup — with the node graph arcing around the text like a halo.',
  },
]

const BRAND_OPTIONS: { v: Brand; label: string }[] = [
  { v: 'nyuchi',   label: 'nyuchi.com' },
  { v: 'bundu',    label: 'bundu.org' },
  { v: 'mukoko',   label: 'mukoko.com' },
  { v: 'shamwari', label: 'shamwari.ai' },
]

const SURFACE_OPTIONS: { v: SurfaceMode; label: string }[] = [
  { v: 'auto',  label: 'Auto' },
  { v: 'light', label: 'Light' },
  { v: 'dark',  label: 'Dark' },
]

/* Generic segmented control — the studio port's interaction pattern applied
   to the banner source's .seg markup (cols mirrors the source h2/h4 grids). */
function Seg<V extends string | number>(props: {
  cols: 2 | 3 | 4
  value: V
  options: { v: V; label: string; desc?: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div className={'seg h' + props.cols}>
      {props.options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={o.v === props.value ? 'active' : ''}
          title={o.desc}
          onClick={() => props.onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ControlPanel = ({ state, setState, resolvedTheme, seedReadout, formatReadout }: Props) => {
  const set = <K extends keyof BannerState>(key: K, value: BannerState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  return (
    <aside className="panel">
      <div className="panel-label">
        <span>01 · article</span>
        <span>{seedReadout}</span>
      </div>

      <div className="field">
        <label htmlFor="bn-title">Title</label>
        <textarea
          id="bn-title"
          className="title-input"
          rows={2}
          placeholder="Why we built our own data layer"
          value={state.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="bn-dek">Subtitle / dek</label>
        <textarea
          id="bn-dek"
          rows={3}
          placeholder="A short editorial summary, one or two sentences."
          value={state.dek}
          onChange={(e) => set('dek', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Category</label>
        <CategoryChips
          active={state.category}
          resolvedTheme={resolvedTheme}
          onPick={(cat: Category) => set('category', cat)}
        />
      </div>

      <div className="field">
        <label>Brand</label>
        <Seg cols={2} value={state.brand} options={BRAND_OPTIONS} onChange={(v) => set('brand', v)} />
      </div>

      <div className="panel-label" style={{ marginTop: 'var(--space-xl)' }}>
        <span>02 · format</span>
        <span>{formatReadout}</span>
      </div>

      <div className="field">
        <label>Aspect</label>
        <Seg cols={4} value={state.format} options={FORMAT_OPTIONS} onChange={(v) => set('format', v)} />
      </div>

      <div className="field">
        <label>Layout</label>
        <Seg cols={4} value={state.layout} options={LAYOUT_OPTIONS} onChange={(v) => set('layout', v)} />
        <p className="bn-hint">{LAYOUT_OPTIONS.find((o) => o.v === state.layout)?.desc}</p>
      </div>

      {/* Tweaks — the source kept these in a host-toggled floating panel;
          the SPA has no edit-mode host, so they live inline here. */}
      <div className="panel-label" style={{ marginTop: 'var(--space-xl)' }}>
        <span>03 · tweaks</span>
        <span />
      </div>

      <div className="field">
        <label>Surface</label>
        <Seg cols={3} value={state.theme} options={SURFACE_OPTIONS} onChange={(v) => set('theme', v)} />
      </div>

      <div className="field">
        <label className="switch">
          <input
            type="checkbox"
            checked={state.lockup}
            onChange={(e) => set('lockup', e.target.checked)}
          />
          <span>Show publisher lockup</span>
        </label>
      </div>

      <div className="field">
        <label className="switch">
          <input
            type="checkbox"
            checked={state.lattice}
            onChange={(e) => set('lattice', e.target.checked)}
          />
          <span>Background lattice</span>
        </label>
      </div>
    </aside>
  )
}

export default ControlPanel
