import type { Dispatch, SetStateAction } from 'react'
import { CATEGORIES, type Brand, type Category, type Facet, type FormatKey } from '../../engines/nyuchi'
import type { StudioState, SurfaceMode } from './StudioPage'
import PaletteChips from './PaletteChips'

interface Props {
  state: StudioState
  setState: Dispatch<SetStateAction<StudioState>>
  onLoadMineral: () => void
  onDownloadPng: () => void
  onDownloadSvg: () => void
  onShuffle: () => void
  pngBusy: boolean
}

const FORMATS: { v: FormatKey; label: string }[] = [
  { v: 'ig',    label: 'Square' },
  { v: 'story', label: 'Story' },
  { v: '16x9',  label: '16:9' },
  { v: 'og',    label: 'OG' },
  { v: 'li',    label: 'LinkedIn' },
]

const LAYOUTS: { v: number; label: string }[] = [
  { v: 5, label: 'Mineral' },
  { v: 1, label: 'Type' },
  { v: 2, label: 'Anchor' },
  { v: 3, label: 'Split' },
  { v: 4, label: 'Halo' },
]

const FACETS: { v: Facet; label: string }[] = [
  { v: 'diagonal', label: 'Diagonal' },
  { v: 'steep',    label: 'Steep' },
  { v: 'chevron',  label: 'Chevron' },
]

const SURFACES: { v: SurfaceMode; label: string }[] = [
  { v: 'auto',  label: 'Auto' },
  { v: 'light', label: 'Light' },
  { v: 'dark',  label: 'Dark' },
]

const BRANDS: { v: Brand; label: string }[] = [
  { v: 'nyuchi', label: 'nyuchi.com' },
  { v: 'bundu',  label: 'bundu.org' },
]

function Seg<V extends string | number>(props: {
  value: V
  options: { v: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div className="ns-seg">
      {props.options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={o.v === props.value ? 'active' : ''}
          onClick={() => props.onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ControlPanel = ({ state, setState, onLoadMineral, onDownloadPng, onDownloadSvg, onShuffle, pngBusy }: Props) => {
  const set = <K extends keyof StudioState>(key: K, value: StudioState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  return (
    <aside className="ns-panel">
      <div className="ns-brandhead">
        <img alt="nyuchi" src="/assets/nyuchi-bee.png" />
        <h1>Nyuchi Studio</h1>
      </div>
      <span className="ns-tag">social cards · 7 minerals · one system</span>

      <div className="ns-grp">
        <h2>Content</h2>
        <label>
          Eyebrow <span style={{ opacity: 0.6 }}>(optional — defaults to palette)</span>
        </label>
        <input
          type="text"
          value={state.eyebrow}
          placeholder="Cobalt · Knowledge"
          onChange={(e) => set('eyebrow', e.target.value)}
        />
        <label>Title</label>
        <textarea rows={2} value={state.title} onChange={(e) => set('title', e.target.value)} />
        <label>Subtitle / description</label>
        <textarea rows={3} value={state.dek} onChange={(e) => set('dek', e.target.value)} />
        <div className="ns-two">
          <div>
            <label>Index</label>
            <input
              type="text"
              value={state.index}
              placeholder="01"
              onChange={(e) => set('index', e.target.value)}
            />
          </div>
          <div style={{ flex: 2.4 }}>
            <label>Footnote / origin</label>
            <input
              type="text"
              value={state.footnote}
              placeholder="Katanga Copperbelt · DRC"
              onChange={(e) => set('footnote', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ns-grp">
        <h2>Palette</h2>
        <PaletteChips
          active={state.category}
          onPick={(cat: Category) => set('category', cat)}
          categories={CATEGORIES}
        />
        <button type="button" className="ns-act sec" style={{ marginTop: 10 }} onClick={onLoadMineral}>
          ↩ Load this mineral's copy
        </button>
        <div className="ns-hint">
          Pick a palette for any card. "Load copy" fills the fields with that mineral's story and switches to the Mineral layout.
        </div>
      </div>

      <div className="ns-grp">
        <h2>Format</h2>
        <Seg value={state.format} options={FORMATS} onChange={(v) => set('format', v)} />
        <label style={{ marginTop: 11 }}>Layout</label>
        <Seg value={state.layout} options={LAYOUTS} onChange={(v) => set('layout', v)} />
      </div>

      {state.layout === 5 && (
        <div className="ns-grp">
          <h2>Mineral swatch</h2>
          <Seg value={state.facet} options={FACETS} onChange={(v) => set('facet', v)} />
          <div className="ns-lab-row">
            <label>Cleave angle</label>
            <span
              style={{
                color: 'var(--ns-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              {state.angle}
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            value={state.angle}
            onChange={(e) => set('angle', Number(e.target.value))}
          />
          <label className="ns-chk">
            <input
              type="checkbox"
              checked={state.cleave}
              onChange={(e) => set('cleave', e.target.checked)}
            />
            {' '}Show cleavage line
          </label>
        </div>
      )}

      <div className="ns-grp">
        <h2>Surface &amp; brand</h2>
        <Seg value={state.theme} options={SURFACES} onChange={(v) => set('theme', v)} />
        <label style={{ marginTop: 11 }}>Lockup mark</label>
        <Seg value={state.brand} options={BRANDS} onChange={(v) => set('brand', v)} />
        <label className="ns-chk">
          <input
            type="checkbox"
            checked={state.lockup}
            onChange={(e) => set('lockup', e.target.checked)}
          />
          {' '}Show logo lockup
        </label>
        <label className="ns-chk">
          <input
            type="checkbox"
            checked={state.lattice}
            onChange={(e) => set('lattice', e.target.checked)}
          />
          {' '}Engineering grid
        </label>
      </div>

      <div className="ns-grp">
        <h2>Export</h2>
        <button type="button" className="ns-act" onClick={onDownloadPng} disabled={pngBusy}>
          {pngBusy ? 'Rendering…' : 'Download PNG (2×)'}
        </button>
        <button type="button" className="ns-act sec" onClick={onDownloadSvg}>
          Download SVG
        </button>
        <button type="button" className="ns-act sec" onClick={onShuffle}>
          ↻ Reshuffle graph
        </button>
      </div>
    </aside>
  )
}

export default ControlPanel
