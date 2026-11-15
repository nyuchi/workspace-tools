/* Bundu-ecosystem brand registry — the canonical brand taxonomy.
 *
 * Pure module (no React, no DOM): imported by the SPA, the SVG engines
 * (engines/nyuchi) and the nyuchi-tools Worker MCP server.
 *
 * ── Taxonomy (from bundu.org — authoritative) ──────────────────────────────
 *
 *   Bundu Foundation (bundu.org) — the parent. "Bundu is Shona for
 *   wilderness. The wilderness holds the hive." Philosophy: "I am because
 *   we are" (Ndiri nekuti tiri).
 *
 *   Three pillars — top-level brands alongside bundu itself:
 *   ├─ Nyuchi Africa (nyuchi.com)   — commercial pillar (gold)
 *   │    divisions: Learning, Development, Foundation — all gold
 *   ├─ Mukoko (mukoko.com)          — consumer pillar (tanzanite),
 *   │    "Africa's privacy-first social super-app"
 *   │    divisions: Mukoko News (river), Mukoko Lingo (cobalt),
 *   │      Mukoko Events (malachite)
 *   └─ Shamwari AI (shamwari.ai)    — intelligence pillar (sodalite),
 *        "AI that actually works for Africa"
 *
 *   Bundu Foundation initiatives (projects, NOT brands):
 *   - Zimbabwe Information Platform (travel-info.co.zw, malachite)
 *   - TELIA — Technology Leaders in Africa (telia.bundu.org, indigo)
 *   - Bundu Education (savanna)
 *
 *   Colour rules (owner, issue 70; Mzizi ecosystem canon): bundu is copper; every Nyuchi brand is
 *   gold; Mukoko the super-app is tanzanite; Shamwari sodalite. Sub-apps
 *   vary across the minerals and heritage colours but never take gold or
 *   tanzanite — a Nyuchi division is Nyuchi, and so gold.
 *
 * ── Consumers / sync obligations ───────────────────────────────────────────
 *
 * - engines/signature keeps its own BRANDS map (including the legacy
 *   `travel` and `learning` keys). Its wording follows this registry —
 *   owner decision 2 on issue 70 ended the byte-lock on the historical
 *   signature: where the copies differed (Mukoko's tagline, Learning's
 *   tagline), the registry wins.
 * - engines/nyuchi reads `lockupLabel` from here for the
 *   card lockup wordmark.
 * - gmail-addon/Code.js (BRANDS, slug-keyed) and email-signature/Code.js
 *   (CONFIG.divisions, email-domain-keyed) are hand-synced copies — Apps
 *   Script cannot import npm modules. Apply brand changes here first, then
 *   mirror them there.
 *
 * ── Icons ──────────────────────────────────────────────────────────────────
 *
 * The full per-brand icon set is the "bundu-ecosystem-icons" collection:
 * one dark-surface and one light-surface icon per brand (e.g. nyuchi's GOLD
 * bee for dark surfaces, BROWN bee for light surfaces). All six brands/
 * initiatives with an `icon` field below are vendored under
 * signature-generator/public/assets/brand-icons/; shamwari also has SVG
 * sources vendored alongside its PNGs.
 *
 * Bundu's icons (2026-10-31 refresh: brown ring + navy mark on light surfaces,
 * tan ring + pale mark on dark) are vendored as supplied, 500×500. Their
 * `.b64.txt` companions — the only thing the engines embed — are cut to the
 * circle with transparent corners (the supplied PNGs carry a baked cream/black
 * square that shows as a box on some surfaces) and downscaled to 192px, so a
 * Bundu card's SVG stays about 25 KB heavier instead of 115 KB.
 */

/** The four top-level Bundu-ecosystem brands (parent first, then pillars). */
export const TOP_BRAND_KEYS = ['bundu', 'nyuchi', 'mukoko', 'shamwari'] as const

export type TopBrandKey = (typeof TOP_BRAND_KEYS)[number]

/** Role a top-level brand plays in the Bundu ecosystem. */
export type PillarRole = 'foundation' | 'commercial' | 'consumer' | 'intelligence'

export interface TopBrand {
  key: TopBrandKey
  name: string
  /** Primary email/web domain, e.g. 'nyuchi.com'. */
  domain: string
  url: string
  tagline: string
  /** Short wordmark text rendered by the studio lockups. */
  lockupLabel: string
  pillar: PillarRole
  /** The brand's Mzizi colour family (see the colour rules above). */
  mineral: string
  /**
   * Per-theme brand icon (URL or asset path) from the
   * "bundu-ecosystem-icons" collection: `light` renders on light surfaces,
   * `dark` on dark surfaces.
   */
  icon: { light?: string; dark?: string }
  socials: Record<string, string>
}

export const TOP_BRANDS: Record<TopBrandKey, TopBrand> = {
  bundu: {
    key: 'bundu',
    name: 'Bundu Foundation',
    domain: 'bundu.org',
    url: 'https://bundu.org',
    tagline: 'The wilderness holds the hive',
    lockupLabel: 'bundu.org',
    pillar: 'foundation',
    mineral: 'copper',
    // Constellation mark. NOTE: current PNGs have baked backgrounds (no
    // alpha) — replace with transparent exports when available.
    icon: {
      light: '/assets/brand-icons/bundu-icon-light.png',
      dark: '/assets/brand-icons/bundu-icon-dark.png',
    },
    // TODO(brand): socials pending.
    socials: {},
  },
  nyuchi: {
    key: 'nyuchi',
    name: 'Nyuchi Africa',
    domain: 'nyuchi.com',
    url: 'https://nyuchi.com',
    tagline: 'I am because we are',
    lockupLabel: 'nyuchi.com',
    pillar: 'commercial',
    mineral: 'gold',
    // Brown bee on light surfaces, gold bee on dark.
    icon: {
      light: '/assets/brand-icons/nyuchi-icon-light.png',
      dark: '/assets/brand-icons/nyuchi-icon-dark.png',
    },
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/',
      facebook: 'https://facebook.com/nyuchigroup',
      instagram: 'https://instagram.com/nyuchi.africa',
    },
  },
  mukoko: {
    key: 'mukoko',
    name: 'Mukoko',
    domain: 'mukoko.com',
    url: 'https://mukoko.com',
    // Canonical bundu.org descriptor; the signature engine follows it
    // (owner decision 2, issue 70, ended the wording byte-lock).
    tagline: "Africa's privacy-first social super-app",
    lockupLabel: 'mukoko.com',
    pillar: 'consumer',
    mineral: 'tanzanite',
    icon: {
      light: '/assets/brand-icons/mukoko-icon-light.png',
      dark: '/assets/brand-icons/mukoko-icon-dark.png',
    },
    socials: {
      facebook: 'https://facebook.com/mukokoafrica',
      instagram: 'https://instagram.com/mukoko.africa',
    },
  },
  shamwari: {
    key: 'shamwari',
    name: 'Shamwari AI',
    domain: 'shamwari.ai',
    url: 'https://shamwari.ai',
    tagline: 'AI that actually works for Africa',
    lockupLabel: 'shamwari.ai',
    pillar: 'intelligence',
    mineral: 'sodalite',
    // Hexagonal lattice mark in the sodalite pair (#3D5AFE dark / #283593
    // light); source SVGs vendored beside the PNGs. TODO(brand): socials.
    icon: {
      light: '/assets/brand-icons/shamwari-icon-light.png',
      dark: '/assets/brand-icons/shamwari-icon-dark.png',
    },
    socials: {},
  },
}

export interface Division {
  key: string
  parent: TopBrandKey
  name: string
  /** Short display label where the full name is too long. */
  shortName?: string
  domain: string
  url: string
  tagline: string
  /** The brand's Mzizi colour family (see the colour rules above). */
  mineral: string
}

/** Divisions per top-level brand (slugs match gmail-addon/Code.js BRANDS). */
export const DIVISIONS: Record<TopBrandKey, readonly Division[]> = {
  bundu: [],
  nyuchi: [
    {
      key: 'learning',
      parent: 'nyuchi',
      name: 'Nyuchi Learning',
      domain: 'learning.nyuchi.com',
      url: 'https://learning.nyuchi.com',
      tagline: 'Education for All',
      mineral: 'gold',
    },
    {
      key: 'development',
      parent: 'nyuchi',
      name: 'Nyuchi Development',
      domain: 'services.nyuchi.com',
      url: 'https://services.nyuchi.com',
      tagline: 'Building Digital Africa',
      mineral: 'gold',
    },
    {
      key: 'foundation',
      parent: 'nyuchi',
      name: 'Nyuchi Foundation',
      domain: 'foundation.nyuchi.com',
      url: 'https://foundation.nyuchi.com',
      tagline: 'Empowering Communities',
      mineral: 'gold',
    },
  ],
  mukoko: [
    {
      key: 'mukokoNews',
      parent: 'mukoko',
      name: 'Mukoko News',
      domain: 'news.mukoko.com',
      url: 'https://news.mukoko.com',
      tagline: 'Pan-African Journalism',
      mineral: 'river',
    },
    // Lingo is a Mukoko sub-app (owner decision, Lingo-is-Mukoko): cobalt
    // is the Mzizi canon colour; it was never a Nyuchi division.
    {
      key: 'lingo',
      parent: 'mukoko',
      name: 'Mukoko Lingo',
      domain: 'lingo.mukoko.com',
      url: 'https://lingo.mukoko.com',
      tagline: 'Language Learning for Africa',
      mineral: 'cobalt',
    },
    // The events platform once branded nhimbe; the nhimbe brand is retired
    // (owner decision 2026-10-04), the alias keeps old lookups working.
    {
      key: 'mukokoEvents',
      shortName: 'Events',
      parent: 'mukoko',
      name: 'Mukoko Events',
      domain: 'events.mukoko.com',
      url: 'https://events.mukoko.com',
      tagline: 'Community Events and Gatherings',
      mineral: 'malachite',
    },
  ],
  shamwari: [],
}

export interface Initiative {
  key: string
  /** Initiatives are Bundu Foundation projects, not brands. */
  parent: 'bundu'
  name: string
  /** Short display label where the full name is too long. */
  shortLabel?: string
  domain?: string
  url?: string
  /** The initiative's Mzizi colour family (see the colour rules above). */
  mineral: string
  /** Per-theme initiative icon, same convention as TopBrand.icon. */
  icon?: { light?: string; dark?: string }
}

/** Bundu Foundation initiatives — projects under the foundation, NOT brands. */
export const INITIATIVES = {
  travel: {
    key: 'travel',
    parent: 'bundu',
    name: 'Zimbabwe Information Platform',
    domain: 'travel-info.co.zw',
    url: 'https://travel-info.co.zw',
    mineral: 'malachite',
    icon: {
      light: '/assets/brand-icons/travel-icon-light.png',
      dark: '/assets/brand-icons/travel-icon-dark.png',
    },
  },
  // Renamed from "Technology Leaders of Africa" (techdirectors.africa);
  // gmail-addon/Code.js still uses the legacy `techLeaders` slug.
  telia: {
    key: 'telia',
    parent: 'bundu',
    name: 'TELIA — Technology Leaders in Africa',
    shortLabel: 'TELIA',
    domain: 'telia.bundu.org',
    url: 'https://telia.bundu.org',
    mineral: 'indigo',
    icon: {
      light: '/assets/brand-icons/telia-icon-light.png',
      dark: '/assets/brand-icons/telia-icon-dark.png',
    },
  },
  // Bundu.org-based home like TELIA; its commercial product is Nyuchi
  // Learning (the nyuchi division).
  education: {
    key: 'education',
    parent: 'bundu',
    name: 'Bundu Education',
    domain: 'bundu.org',
    url: 'https://bundu.org', // TODO(brand): dedicated site pending (likely education.bundu.org)
    mineral: 'savanna',
  },
} as const satisfies Record<string, Initiative>

export type InitiativeKey = keyof typeof INITIATIVES

/**
 * Staff email domain → the engine brand that carries its signature
 * identity. Divisions without their own signature key (Lingo,
 * Development, Mukoko News, Mukoko Events) render under their parent
 * brand; unknown domains default to nyuchi. gmail-addon/Code.js and
 * email-signature/Code.js mirror this map by hand (Apps Script cannot
 * import npm modules) — change it here first.
 */
export const DOMAIN_TO_BRAND_SLUG: Record<string, string> = {
  'nyuchi.com': 'nyuchi',
  'services.nyuchi.com': 'nyuchi',
  'learning.nyuchi.com': 'learning',
  'travel-info.co.zw': 'travel',
  'mukoko.com': 'mukoko',
  'lingo.mukoko.com': 'mukoko',
  'events.mukoko.com': 'mukoko',
  'news.mukoko.com': 'mukoko',
  'hararemetro.co.zw': 'mukoko',
  // Legacy mailbox domain until lingo.nyuchi.com mail migrates.
  'lingo.nyuchi.com': 'mukoko',
  'bundu.org': 'bundu',
  'shamwari.ai': 'shamwari',
}

/** Look up a top-level brand; returns undefined for unknown keys. */
export function getBrand(key: TopBrandKey): TopBrand
export function getBrand(key: string): TopBrand | undefined
export function getBrand(key: string): TopBrand | undefined {
  return (TOP_BRANDS as Record<string, TopBrand>)[key]
}
