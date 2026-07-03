/* Bundu-ecosystem brand registry — the canonical brand taxonomy.
 *
 * Pure module (no React, no DOM): imported by the SPA, the SVG engines
 * (engines/nyuchi, engines/banner), and the nyuchi-tools Worker MCP server.
 *
 * ── Taxonomy (from bundu.org — authoritative) ──────────────────────────────
 *
 *   Bundu Foundation (bundu.org) — the parent. "Bundu is Shona for
 *   wilderness. The wilderness holds the hive." Philosophy: "I am because
 *   we are" (Ndiri nekuti tiri).
 *
 *   Three pillars — top-level brands alongside bundu itself:
 *   ├─ Nyuchi Africa (nyuchi.com)   — commercial pillar
 *   │    divisions: Lingo, Learning, Development, Foundation
 *   ├─ Mukoko (mukoko.com)          — consumer pillar,
 *   │    "Africa's privacy-first social super-app"
 *   │    divisions: Mukoko News
 *   └─ Shamwari AI (shamwari.ai)    — community pillar,
 *        "AI that actually works for Africa"
 *
 *   Bundu Foundation initiatives (projects, NOT brands):
 *   - Zimbabwe Information Platform (travel-info.co.zw)
 *   - TELIA — Technology Leaders in Africa (telia.bundu.org)
 *   - Bundu Education
 *
 * ── Consumers / sync obligations ───────────────────────────────────────────
 *
 * - engines/signature keeps its own BRANDS map: those entries are the
 *   HISTORICAL signature copies (byte-locked emitted HTML — including the
 *   legacy `travel` and `learning` keys). Do not re-sync their wording to
 *   this registry.
 * - engines/nyuchi and engines/banner read `lockupLabel` from here for the
 *   card/banner lockup wordmark.
 * - gmail-addon/Code.js (BRANDS, slug-keyed) and email-signature/Code.js
 *   (CONFIG.divisions, email-domain-keyed) are hand-synced copies — Apps
 *   Script cannot import npm modules. Apply brand changes here first, then
 *   mirror them there.
 *
 * ── Icons ──────────────────────────────────────────────────────────────────
 *
 * The full per-brand icon set is the "bundu-ecosystem-icons" collection:
 * one dark-surface and one light-surface icon per brand (e.g. nyuchi's GOLD
 * bee for dark surfaces, BROWN bee for light surfaces). Only nyuchi's
 * brown/light-surface icon is vendored today
 * (signature-generator/public/assets/nyuchi-bee.png); the rest are
 * TODO(brand) pending asset upload.
 */

/** The four top-level Bundu-ecosystem brands (parent first, then pillars). */
export const TOP_BRAND_KEYS = ['bundu', 'nyuchi', 'mukoko', 'shamwari'] as const

export type TopBrandKey = (typeof TOP_BRAND_KEYS)[number]

/** Role a top-level brand plays in the Bundu ecosystem. */
export type PillarRole = 'foundation' | 'commercial' | 'consumer' | 'community'

export interface TopBrand {
  key: TopBrandKey
  name: string
  /** Primary email/web domain, e.g. 'nyuchi.com'. */
  domain: string
  url: string
  tagline: string
  /** Short wordmark text rendered by the studio/banner lockups. */
  lockupLabel: string
  pillar: PillarRole
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
    // Canonical bundu.org descriptor. engines/signature deliberately keeps
    // the historical signature tagline ('Your Digital Twin Ecosystem').
    tagline: "Africa's privacy-first social super-app",
    lockupLabel: 'mukoko.com',
    pillar: 'consumer',
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
    pillar: 'community',
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
  domain: string
  url: string
  tagline: string
}

/** Divisions per top-level brand (slugs match gmail-addon/Code.js BRANDS). */
export const DIVISIONS: Record<TopBrandKey, readonly Division[]> = {
  bundu: [],
  nyuchi: [
    {
      key: 'lingo',
      parent: 'nyuchi',
      name: 'Nyuchi Lingo',
      domain: 'lingo.nyuchi.com',
      url: 'https://lingo.nyuchi.com',
      tagline: 'Language Learning for Africa',
    },
    {
      key: 'learning',
      parent: 'nyuchi',
      name: 'Nyuchi Learning',
      domain: 'learning.nyuchi.com',
      url: 'https://learning.nyuchi.com',
      tagline: 'Education for All',
    },
    {
      key: 'development',
      parent: 'nyuchi',
      name: 'Nyuchi Development',
      domain: 'services.nyuchi.com',
      url: 'https://services.nyuchi.com',
      tagline: 'Building Digital Africa',
    },
    {
      key: 'foundation',
      parent: 'nyuchi',
      name: 'Nyuchi Foundation',
      domain: 'foundation.nyuchi.com',
      url: 'https://foundation.nyuchi.com',
      tagline: 'Empowering Communities',
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
  },
} as const satisfies Record<string, Initiative>

export type InitiativeKey = keyof typeof INITIATIVES

/** Look up a top-level brand; returns undefined for unknown keys. */
export function getBrand(key: TopBrandKey): TopBrand
export function getBrand(key: string): TopBrand | undefined
export function getBrand(key: string): TopBrand | undefined {
  return (TOP_BRANDS as Record<string, TopBrand>)[key]
}
