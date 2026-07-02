import { CATEGORIES, type Category, type ThemeKey } from '../../engines/banner'

interface Props {
  active: Category
  resolvedTheme: ThemeKey
  onPick: (cat: Category) => void
}

/* Category swatch grid — mirrors the source's #cats buttons (dot + name),
   with dot colors following the resolved surface theme (refreshCatDots). */
const CategoryChips = ({ active, resolvedTheme, onPick }: Props) => {
  const entries = Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][]
  return (
    <div className="cats">
      {entries.map(([key, def]) => (
        <button
          key={key}
          type="button"
          className={'cat' + (key === active ? ' active' : '')}
          onClick={() => onPick(key)}
        >
          <span
            className="dot"
            style={{ background: resolvedTheme === 'dark' ? def.dark : def.light }}
          />
          <span>{def.name}</span>
        </button>
      ))}
    </div>
  )
}

export default CategoryChips
