/**
 * The one Bundu-ecosystem brand list, ported from the canon registry
 * (next/crates/brands/data/brands.toml — the file the Rust rebuild, the
 * Studio and the MCP all read). This replaces the hand-synced grid that was
 * baked into the old homepage: Lingo is Mukoko Lingo (lingo.mukoko.com,
 * cobalt), TELIA is indigo, Nyuchi divisions are gold, and the initiatives
 * are listed too.
 *
 * `dot` is a complete literal class string (not `bg-${mineral}` composed) so
 * Tailwind's source scanner generates every utility.
 */

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

export const BRANDS: Brand[] = [
  {
    key: 'bundu',
    kind: 'foundation',
    name: 'Bundu Foundation',
    shortName: 'Bundu',
    tagline: 'The wilderness holds the hive',
    url: 'https://bundu.org',
    domain: 'bundu.org',
    mineral: 'copper',
    dot: 'bg-copper',
  },
  {
    key: 'nyuchi',
    kind: 'pillar',
    parent: 'bundu',
    name: 'Nyuchi Africa',
    shortName: 'Nyuchi',
    tagline: 'I am because we are',
    url: 'https://nyuchi.com',
    domain: 'nyuchi.com',
    mineral: 'gold',
    dot: 'bg-gold',
  },
  {
    key: 'mukoko',
    kind: 'pillar',
    parent: 'bundu',
    name: 'Mukoko',
    tagline: "Africa's privacy-first social super-app",
    url: 'https://mukoko.com',
    domain: 'mukoko.com',
    mineral: 'tanzanite',
    dot: 'bg-tanzanite',
  },
  {
    key: 'shamwari',
    kind: 'pillar',
    parent: 'bundu',
    name: 'Shamwari AI',
    tagline: 'AI that actually works for Africa',
    url: 'https://shamwari.ai',
    domain: 'shamwari.ai',
    mineral: 'sodalite',
    dot: 'bg-sodalite',
  },
  {
    key: 'learning',
    kind: 'division',
    parent: 'nyuchi',
    name: 'Nyuchi Learning',
    tagline: 'Education for All',
    url: 'https://learning.nyuchi.com',
    domain: 'learning.nyuchi.com',
    mineral: 'gold',
    dot: 'bg-gold',
  },
  {
    key: 'development',
    kind: 'division',
    parent: 'nyuchi',
    name: 'Nyuchi Development',
    tagline: 'Building Digital Africa',
    url: 'https://services.nyuchi.com',
    domain: 'services.nyuchi.com',
    mineral: 'gold',
    dot: 'bg-gold',
  },
  {
    key: 'foundation',
    kind: 'division',
    parent: 'nyuchi',
    name: 'Nyuchi Foundation',
    tagline: 'Empowering Communities',
    url: 'https://foundation.nyuchi.com',
    domain: 'foundation.nyuchi.com',
    mineral: 'gold',
    dot: 'bg-gold',
  },
  {
    key: 'mukokoNews',
    kind: 'division',
    parent: 'mukoko',
    name: 'Mukoko News',
    tagline: 'Pan-African Journalism',
    url: 'https://news.mukoko.com',
    domain: 'news.mukoko.com',
    mineral: 'river',
    dot: 'bg-river',
  },
  {
    key: 'lingo',
    kind: 'division',
    parent: 'mukoko',
    name: 'Mukoko Lingo',
    tagline: 'Language Learning for Africa',
    url: 'https://lingo.mukoko.com',
    domain: 'lingo.mukoko.com',
    mineral: 'cobalt',
    dot: 'bg-cobalt',
  },
  {
    key: 'mukokoEvents',
    kind: 'division',
    parent: 'mukoko',
    name: 'Mukoko Events',
    shortName: 'Events',
    tagline: 'Community Events and Gatherings',
    url: 'https://events.mukoko.com',
    domain: 'events.mukoko.com',
    mineral: 'malachite',
    dot: 'bg-malachite',
  },
  {
    key: 'travel',
    kind: 'initiative',
    parent: 'bundu',
    name: 'Zimbabwe Information Platform',
    shortName: 'Zimbabwe Info',
    tagline: 'Discover the Heart of Africa',
    url: 'https://travel-info.co.zw',
    domain: 'travel-info.co.zw',
    mineral: 'malachite',
    dot: 'bg-malachite',
  },
  {
    key: 'telia',
    kind: 'initiative',
    parent: 'bundu',
    name: 'TELIA — Technology Leaders in Africa',
    shortName: 'TELIA',
    tagline: 'Leading African Innovation',
    url: 'https://telia.bundu.org',
    domain: 'telia.bundu.org',
    mineral: 'indigo',
    dot: 'bg-indigo',
  },
  {
    key: 'education',
    kind: 'initiative',
    parent: 'bundu',
    name: 'Bundu Education',
    shortName: 'Education',
    url: 'https://bundu.org',
    domain: 'bundu.org',
    mineral: 'savanna',
    dot: 'bg-savanna',
  },
]

export const brandByKey = (key: string): Brand | undefined =>
  BRANDS.find((b) => b.key === key)

/** Ordered display groups for the homepage registry grid and the footer. */
export const BRAND_GROUPS: { label: string; brands: Brand[] }[] = [
  { label: 'Foundation', brands: BRANDS.filter((b) => b.kind === 'foundation') },
  { label: 'Pillars', brands: BRANDS.filter((b) => b.kind === 'pillar') },
  {
    label: 'Nyuchi divisions',
    brands: BRANDS.filter((b) => b.kind === 'division' && b.parent === 'nyuchi'),
  },
  {
    label: 'Mukoko divisions',
    brands: BRANDS.filter((b) => b.kind === 'division' && b.parent === 'mukoko'),
  },
  { label: 'Initiatives', brands: BRANDS.filter((b) => b.kind === 'initiative') },
]
