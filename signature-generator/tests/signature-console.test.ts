/* Signature Console pure helpers (src/pages/signature/api.ts) — the
 * node-safe parts of the two-mode console: directory-row → engine-params
 * mapping and push-result summarizing. The fetch wrappers themselves are
 * browser-only and not exercised here (no DOM/jsdom in this suite). */

import { describe, expect, it } from 'vitest'
import { BRANDS, BRAND_KEYS, buildSignatureHtml } from '../src/engines/signature'
import {
  describePushSummary,
  isBrandKey,
  mapDirectoryUserToParams,
  summarizePush,
  type DirectoryUser,
  type PushResult,
} from '../src/pages/signature/api'

const user = (over: Partial<DirectoryUser> = {}): DirectoryUser => ({
  email: 'amara@nyuchi.com',
  name: 'Amara Moyo',
  title: 'Head of Learning',
  phone: '+263 77 123 4567',
  aliases: ['amara@lingo.nyuchi.com', 'a.moyo@nyuchi.com'],
  brand: 'nyuchi',
  ...over,
})

const result = (over: Partial<PushResult> = {}): PushResult => ({
  email: 'amara@nyuchi.com',
  sendAs: 'amara@nyuchi.com',
  status: 'pushed',
  ...over,
})

describe('isBrandKey', () => {
  it('accepts every signature brand key, including the legacy identities', () => {
    for (const key of BRAND_KEYS) expect(isBrandKey(key), key).toBe(true)
  })

  it('rejects non-signature brands', () => {
    expect(isBrandKey('lingo')).toBe(false)
    expect(isBrandKey('')).toBe(false)
    expect(isBrandKey('NYUCHI')).toBe(false)
  })
})

describe('mapDirectoryUserToParams', () => {
  it('maps identity fields from the directory row', () => {
    const params = mapDirectoryUserToParams(user())
    expect(params.brand).toBe('nyuchi')
    expect(params.name).toBe('Amara Moyo')
    expect(params.email).toBe('amara@nyuchi.com')
    expect(params.title).toBe('Head of Learning')
    expect(params.phone).toBe('+263 77 123 4567')
  })

  it('defaults missing title and phone to empty strings', () => {
    const params = mapDirectoryUserToParams(user({ title: undefined, phone: undefined }))
    expect(params.title).toBe('')
    expect(params.phone).toBe('')
  })

  it('keeps every valid brand, including legacy travel/learning signature keys', () => {
    for (const key of BRAND_KEYS) {
      expect(mapDirectoryUserToParams(user({ brand: key })).brand, key).toBe(key)
    }
  })

  it('falls back to nyuchi for unknown brands', () => {
    expect(mapDirectoryUserToParams(user({ brand: 'lingo.nyuchi.com' })).brand).toBe('nyuchi')
    expect(mapDirectoryUserToParams(user({ brand: '' })).brand).toBe('nyuchi')
  })

  it('fills socials from the brand defaults (batch-script behavior)', () => {
    const nyuchi = mapDirectoryUserToParams(user())
    expect(nyuchi.linkedin).toBe(BRANDS.nyuchi.socials.linkedin)
    expect(nyuchi.facebook).toBe(BRANDS.nyuchi.socials.facebook)
    expect(nyuchi.instagram).toBe(BRANDS.nyuchi.socials.instagram)
    expect(nyuchi.twitter).toBe('')

    const travel = mapDirectoryUserToParams(user({ brand: 'travel' }))
    expect(travel.linkedin).toBe(BRANDS.travel.socials.linkedin || '')
    expect(travel.facebook).toBe(BRANDS.travel.socials.facebook || '')

    const learning = mapDirectoryUserToParams(user({ brand: 'learning' }))
    expect(learning.linkedin).toBe(BRANDS.learning.socials.linkedin || '')
  })

  it('leaves per-user extras empty and never leaks aliases into the params', () => {
    const params = mapDirectoryUserToParams(user())
    expect(params.whatsapp).toBe('')
    expect(params.profileImage).toBe('')
    expect(params.promoBanner).toBe('')
    expect(params.promoLink).toBe('')
    expect('aliases' in params).toBe(false)
  })

  it('produces params the byte-locked engine renders directly', () => {
    const html = buildSignatureHtml(mapDirectoryUserToParams(user()))
    expect(html).toContain('Amara Moyo')
    expect(html).toContain('Head of Learning')
    expect(html).toContain('alt="LinkedIn"')
  })
})

describe('summarizePush', () => {
  it('tallies each status into the contract summary shape', () => {
    const summary = summarizePush([
      result(),
      result({ email: 'b@nyuchi.com', status: 'pushed' }),
      result({ email: 'c@nyuchi.com', status: 'dry-run' }),
      result({ email: 'd@nyuchi.com', status: 'failed', error: 'quota exceeded' }),
    ])
    expect(summary).toEqual({ pushed: 2, dryRun: 1, failed: 1 })
  })

  it('returns zeros for no results', () => {
    expect(summarizePush([])).toEqual({ pushed: 0, dryRun: 0, failed: 0 })
  })
})

describe('describePushSummary', () => {
  it('joins only the non-zero buckets', () => {
    expect(describePushSummary({ pushed: 3, dryRun: 0, failed: 1 })).toBe('3 pushed · 1 failed')
    expect(describePushSummary({ pushed: 0, dryRun: 5, failed: 0 })).toBe('5 dry-run')
  })

  it('falls back when everything is zero', () => {
    expect(describePushSummary({ pushed: 0, dryRun: 0, failed: 0 })).toBe('no results')
  })
})
