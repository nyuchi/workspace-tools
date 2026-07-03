import type { Category, CategoryDef } from '../../engines/nyuchi'

interface Props {
  active: Category
  onPick: (cat: Category) => void
  categories: Record<Category, CategoryDef>
}

const PaletteChips = ({ active, onPick, categories }: Props) => {
  const entries = Object.entries(categories) as [Category, CategoryDef][]
  return (
    <div className="ns-palette">
      {entries.map(([key, def]) => (
        <button
          key={key}
          type="button"
          className={'ns-swatch-chip' + (key === active ? ' active' : '')}
          title={def.name + ' · ' + def.role}
          onClick={() => onPick(key)}
        >
          <span
            className="ns-chip-color"
            style={{
              background: `linear-gradient(135deg, ${def.dark} 0 50%, ${def.light} 50% 100%)`,
            }}
          />
          <span className="ns-chip-name">{def.name}</span>
        </button>
      ))}
    </div>
  )
}

export default PaletteChips
