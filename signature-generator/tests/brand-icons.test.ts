/* Per-theme brand-icon registration (bundu-ecosystem-icons collection).
 *
 * Lives in its own file: `setBrandIcon` mutates module-level state inside
 * each engine, and vitest isolates module state per test file — so the icons
 * registered here never leak into the other engine suites (which rely on the
 * icon-less drawn-mark fallback).
 */

import { describe, expect, it } from 'vitest'
import * as studio from '../src/engines/nyuchi'
import * as banner from '../src/engines/banner'

const LIGHT_URI = 'data:image/png;base64,LIGHT-VARIANT'
const DARK_URI = 'data:image/png;base64,DARK-VARIANT'
const BOTH_URI = 'data:image/png;base64,BOTH-VARIANTS'

const studioParams = (theme: studio.ThemeKey, brand: studio.Brand): studio.Params => ({
  format: '16x9',
  layout: 1,
  theme,
  category: 'gold',
  title: 'Icon selection',
  seedKey: 'icon-seed',
  lockup: true,
  brand,
})

const bannerParams = (theme: banner.ThemeKey, brand: banner.Brand): banner.Params => ({
  format: '16x9',
  layout: 1,
  theme,
  category: 'gold',
  title: 'Icon selection',
  seedKey: 'icon-seed',
  lockup: true,
  brand,
})

describe('studio engine — per-theme brand icons', () => {
  it('registering without a theme sets both variants (legacy call shape)', () => {
    studio.setBrandIcon('nyuchi', BOTH_URI)
    expect(studio.getBrandIcon('nyuchi', 'light')).toBe(BOTH_URI)
    expect(studio.getBrandIcon('nyuchi', 'dark')).toBe(BOTH_URI)
    expect(studio.getBrandIcon('nyuchi')).toBe(BOTH_URI)

    for (const theme of ['light', 'dark'] as const) {
      const { svg } = studio.buildSVG(studioParams(theme, 'nyuchi'))
      expect(svg).toContain(`<image href="${BOTH_URI}"`)
    }
  })

  it('buildSVG picks the variant matching params.theme when both are registered', () => {
    studio.setBrandIcon('mukoko', LIGHT_URI, 'light')
    studio.setBrandIcon('mukoko', DARK_URI, 'dark')

    const light = studio.buildSVG(studioParams('light', 'mukoko')).svg
    expect(light).toContain(`<image href="${LIGHT_URI}"`)
    expect(light).not.toContain(DARK_URI)

    const dark = studio.buildSVG(studioParams('dark', 'mukoko')).svg
    expect(dark).toContain(`<image href="${DARK_URI}"`)
    expect(dark).not.toContain(LIGHT_URI)
  })

  it('falls back to the other variant when only one is registered', () => {
    studio.setBrandIcon('shamwari', DARK_URI, 'dark')
    expect(studio.getBrandIcon('shamwari', 'light')).toBe(DARK_URI)
    const light = studio.buildSVG(studioParams('light', 'shamwari')).svg
    expect(light).toContain(`<image href="${DARK_URI}"`)
  })

  it('returns undefined (and draws the o2 mark) for brands with no icon', () => {
    expect(studio.getBrandIcon('bundu')).toBeUndefined()
    const { svg } = studio.buildSVG(studioParams('light', 'bundu'))
    expect(svg).not.toContain('<image')
  })
})

describe('banner engine — per-theme brand icons', () => {
  it('registering without a theme sets both variants (legacy call shape)', () => {
    banner.setBrandIcon('nyuchi', BOTH_URI)
    expect(banner.getBrandIcon('nyuchi', 'light')).toBe(BOTH_URI)
    expect(banner.getBrandIcon('nyuchi', 'dark')).toBe(BOTH_URI)

    for (const theme of ['light', 'dark'] as const) {
      const { svg } = banner.buildSVG(bannerParams(theme, 'nyuchi'))
      expect(svg).toContain(`<image href="${BOTH_URI}"`)
    }
  })

  it('buildSVG picks the variant matching params.theme when both are registered', () => {
    banner.setBrandIcon('mukoko', LIGHT_URI, 'light')
    banner.setBrandIcon('mukoko', DARK_URI, 'dark')

    const light = banner.buildSVG(bannerParams('light', 'mukoko')).svg
    expect(light).toContain(`<image href="${LIGHT_URI}"`)
    expect(light).not.toContain(DARK_URI)

    const dark = banner.buildSVG(bannerParams('dark', 'mukoko')).svg
    expect(dark).toContain(`<image href="${DARK_URI}"`)
    expect(dark).not.toContain(LIGHT_URI)
  })

  it('falls back to the other variant when only one is registered', () => {
    banner.setBrandIcon('shamwari', LIGHT_URI, 'light')
    expect(banner.getBrandIcon('shamwari', 'dark')).toBe(LIGHT_URI)
    const dark = banner.buildSVG(bannerParams('dark', 'shamwari')).svg
    expect(dark).toContain(`<image href="${LIGHT_URI}"`)
  })

  it('returns undefined (and draws the o2 mark) for brands with no icon', () => {
    expect(banner.getBrandIcon('bundu')).toBeUndefined()
    const { svg } = banner.buildSVG(bannerParams('light', 'bundu'))
    expect(svg).not.toContain('<image')
  })
})
