/**
 * The ecosystem registry for display — DERIVED from engines/brands (the
 * canon TS registry, which itself follows next/crates/brands/data/brands.toml
 * while it exists). There is no second hand-synced copy: taxonomy changes
 * happen in engines/brands and every consumer sees them.
 *
 * `dot` classes are literal strings (Tailwind's scanner reads this file's
 * text; composed `bg-${mineral}` would not be generated).
 */

import {
  TOP_BRANDS,
  TOP_BRAND_KEYS,
  DIVISIONS,
  INITIATIVES,
  type TopBrandKey,
} from '@engines/brands'

export type BrandKind = 'foundation' | 'pillar' | 'division' | 'initiative'

export interface Brand {
  key: string
  kind: BrandKind
  /** key of the parent brand; absent for the foundation */
  parent?: string
  name: string
  shortName?: string
  tagline?: string
  url: string
  domain: string
  mineral: string
  dot: string
}

/** Mzizi colour family → literal dot utility (keep in sync with the minerals). */
const DOT: Record<string, string> = {
  copper: 'bg-copper',
  gold: 'bg-gold',
  tanzanite: 'bg-tanzanite',
  sodalite: 'bg-sodalite',
  cobalt: 'bg-cobalt',
  river: 'bg-river',
  malachite: 'bg-malachite',
  indigo: 'bg-indigo',
  savanna: 'bg-savanna',
}

const dot = (mineral: string): string => DOT[mineral] ?? 'bg-gold'

const FOUNDATION: Brand = {
  key: 'bundu',
  kind: 'foundation',
  name: TOP_BRANDS.bundu.name,
  shortName: 'Bundu',
  tagline: TOP_BRANDS.bundu.tagline,
  url: TOP_BRANDS.bundu.url,
  domain: TOP_BRANDS.bundu.domain,
  mineral: TOP_BRANDS.bundu.mineral,
  dot: dot(TOP_BRANDS.bundu.mineral),
}

const PILLARS: Brand[] = TOP_BRAND_KEYS.filter((k) => k !== 'bundu').map((key) => {
  const b = TOP_BRANDS[key as TopBrandKey]
  return {
    key,
    kind: 'pillar' as const,
    parent: 'bundu',
    name: b.name,
    tagline: b.tagline,
    url: b.url,
    domain: b.domain,
    mineral: b.mineral,
    dot: dot(b.mineral),
  }
})

const divisionsOf = (parent: TopBrandKey): Brand[] =>
  DIVISIONS[parent].map((d) => ({
    key: d.key,
    kind: 'division' as const,
    parent,
    name: d.name,
    shortName: d.shortName,
    tagline: d.tagline,
    url: d.url,
    domain: d.domain,
    mineral: d.mineral,
    dot: dot(d.mineral),
  }))

const INITIATIVE_BRANDS: Brand[] = Object.values(INITIATIVES).map((i) => ({
  key: i.key,
  kind: 'initiative' as const,
  parent: 'bundu',
  name: i.name,
  shortName: 'shortLabel' in i ? i.shortLabel : undefined,
  url: i.url ?? 'https://bundu.org',
  domain: i.domain ?? 'bundu.org',
  mineral: i.mineral,
  dot: dot(i.mineral),
}))

export const BRANDS: Brand[] = [
  FOUNDATION,
  ...PILLARS,
  ...divisionsOf('nyuchi'),
  ...divisionsOf('mukoko'),
  ...INITIATIVE_BRANDS,
]

export const brandByKey = (key: string): Brand | undefined =>
  BRANDS.find((b) => b.key === key)

/** Ordered display groups for the homepage registry grid and the footer. */
export const BRAND_GROUPS: { label: string; brands: Brand[] }[] = [
  { label: 'Foundation', brands: [FOUNDATION] },
  { label: 'Pillars', brands: PILLARS },
  { label: 'Nyuchi divisions', brands: divisionsOf('nyuchi') },
  { label: 'Mukoko divisions', brands: divisionsOf('mukoko') },
  { label: 'Initiatives', brands: INITIATIVE_BRANDS },
]
