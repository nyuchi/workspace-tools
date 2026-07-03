import { describe, expect, it } from 'vitest'
import {
  DIVISIONS,
  getBrand,
  INITIATIVES,
  TOP_BRAND_KEYS,
  TOP_BRANDS,
  type TopBrandKey,
} from '../src/engines/brands'

describe('TOP_BRANDS registry shape', () => {
  it('exposes exactly the four top-level brands, parent first', () => {
    expect(TOP_BRAND_KEYS).toEqual(['bundu', 'nyuchi', 'mukoko', 'shamwari'])
    expect(Object.keys(TOP_BRANDS)).toEqual([...TOP_BRAND_KEYS])
  })

  it('every entry is self-keyed and fully populated', () => {
    for (const key of TOP_BRAND_KEYS) {
      const brand = TOP_BRANDS[key]
      expect(brand.key).toBe(key)
      expect(brand.name).toBeTruthy()
      expect(brand.domain).toBeTruthy()
      expect(brand.url).toBe(`https://${brand.domain}`)
      expect(brand.tagline).toBeTruthy()
      expect(brand.icon).toBeTypeOf('object')
      expect(brand.socials).toBeTypeOf('object')
    }
  })

  it('pins the lockup labels', () => {
    expect(TOP_BRANDS.bundu.lockupLabel).toBe('bundu.org')
    expect(TOP_BRANDS.nyuchi.lockupLabel).toBe('nyuchi.com')
    expect(TOP_BRANDS.mukoko.lockupLabel).toBe('mukoko.com')
    expect(TOP_BRANDS.shamwari.lockupLabel).toBe('shamwari.ai')
  })

  it('assigns each brand its pillar role (bundu is the foundation)', () => {
    expect(TOP_BRANDS.bundu.pillar).toBe('foundation')
    expect(TOP_BRANDS.nyuchi.pillar).toBe('commercial')
    expect(TOP_BRANDS.mukoko.pillar).toBe('consumer')
    expect(TOP_BRANDS.shamwari.pillar).toBe('community')
  })

  it('vendors only the nyuchi light-surface icon today', () => {
    expect(TOP_BRANDS.nyuchi.icon.light).toBe('/assets/nyuchi-bee.png')
    expect(TOP_BRANDS.nyuchi.icon.dark).toBeUndefined()
    expect(TOP_BRANDS.bundu.icon).toEqual({})
    expect(TOP_BRANDS.mukoko.icon).toEqual({})
    expect(TOP_BRANDS.shamwari.icon).toEqual({})
  })
})

describe('DIVISIONS', () => {
  it('is keyed by every top-level brand', () => {
    expect(Object.keys(DIVISIONS).sort()).toEqual([...TOP_BRAND_KEYS].sort())
  })

  it('nyuchi has the four divisions from gmail-addon/Code.js', () => {
    expect(DIVISIONS.nyuchi.map((d) => d.key)).toEqual([
      'lingo',
      'learning',
      'development',
      'foundation',
    ])
  })

  it('mukoko has Mukoko News; bundu and shamwari have none', () => {
    expect(DIVISIONS.mukoko.map((d) => d.key)).toEqual(['mukokoNews'])
    expect(DIVISIONS.bundu).toEqual([])
    expect(DIVISIONS.shamwari).toEqual([])
  })

  it('every division points back at its parent and has a real domain', () => {
    for (const parent of TOP_BRAND_KEYS) {
      for (const division of DIVISIONS[parent]) {
        expect(division.parent).toBe(parent)
        expect(division.domain).toBeTruthy()
        expect(division.url).toBe(`https://${division.domain}`)
        expect(division.name).toBeTruthy()
      }
    }
  })
})

describe('INITIATIVES', () => {
  it('holds the three Bundu Foundation initiatives', () => {
    expect(Object.keys(INITIATIVES)).toEqual(['travel', 'telia', 'education'])
  })

  it('all initiatives belong to bundu (projects, not brands)', () => {
    for (const initiative of Object.values(INITIATIVES)) {
      expect(initiative.parent).toBe('bundu')
    }
  })

  it('travel is the Zimbabwe Information Platform on travel-info.co.zw', () => {
    expect(INITIATIVES.travel.name).toBe('Zimbabwe Information Platform')
    expect(INITIATIVES.travel.domain).toBe('travel-info.co.zw')
  })

  it('telia carries the new naming and bundu.org home', () => {
    expect(INITIATIVES.telia.name).toBe('TELIA — Technology Leaders in Africa')
    expect(INITIATIVES.telia.shortLabel).toBe('TELIA')
    expect(INITIATIVES.telia.domain).toBe('telia.bundu.org')
    expect(INITIATIVES.telia.url).toBe('https://telia.bundu.org')
  })

  it('education points at bundu.org until its dedicated site exists', () => {
    expect(INITIATIVES.education.name).toBe('Bundu Education')
    expect(INITIATIVES.education.url).toBe('https://bundu.org')
  })
})

describe('getBrand', () => {
  it('returns the registry entry for each key', () => {
    for (const key of TOP_BRAND_KEYS) {
      expect(getBrand(key)).toBe(TOP_BRANDS[key])
    }
  })

  it('returns undefined for unknown keys', () => {
    expect(getBrand('acme')).toBeUndefined()
    expect(getBrand('travel')).toBeUndefined() // initiative, not a brand
    expect(getBrand('' as TopBrandKey)).toBeUndefined()
  })
})
