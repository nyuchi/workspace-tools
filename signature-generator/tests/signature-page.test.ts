import { describe, expect, it } from 'vitest'
import { BRANDS, BRAND_KEYS, buildSignatureHtml } from '../src/engines/signature'
import {
  BRAND_LABELS,
  BRAND_MINERAL,
  blocksReadout,
  socialDefaults,
  toSignatureParams,
  type SignatureFormData,
} from '../src/pages/signature/helpers'

const FORM: SignatureFormData = {
  name: 'Bryan Fawcett',
  title: 'Founder & CEO',
  email: 'bryan@nyuchi.com',
  phone: '',
  whatsapp: '',
  profileImage: 'https://assets.nyuchi.com/people/bryan.png',
  linkedin: 'https://www.linkedin.com/in/bryanfawcett/',
  twitter: '',
  facebook: '',
  instagram: '',
  promoBanner: 'https://assets.nyuchi.com/promos/launch.png',
  promoLink: 'https://nyuchi.com/launch',
}

describe('BRAND_MINERAL / BRAND_LABELS', () => {
  it('covers every signature brand key', () => {
    for (const key of BRAND_KEYS) {
      expect(BRAND_MINERAL[key], `mineral for ${key}`).toBeTruthy()
      expect(BRAND_LABELS[key], `label for ${key}`).toBeTruthy()
    }
  })

  it('keeps the historical brand → mineral accent mapping', () => {
    expect(BRAND_MINERAL.nyuchi).toBe('gold')
    expect(BRAND_MINERAL.mukoko).toBe('tanzanite')
    expect(BRAND_MINERAL.travel).toBe('malachite')
    expect(BRAND_MINERAL.learning).toBe('cobalt')
    expect(BRAND_MINERAL.bundu).toBe('copper')
    expect(BRAND_MINERAL.shamwari).toBe('sodalite')
  })
})

describe('socialDefaults', () => {
  it('mirrors the brand socials with empty-string fallbacks', () => {
    expect(socialDefaults('nyuchi')).toEqual({
      linkedin: BRANDS.nyuchi.socials.linkedin,
      twitter: '',
      facebook: BRANDS.nyuchi.socials.facebook,
      instagram: BRANDS.nyuchi.socials.instagram,
    })
  })

  it('returns all-empty defaults for brands without socials', () => {
    expect(socialDefaults('bundu')).toEqual({ linkedin: '', twitter: '', facebook: '', instagram: '' })
    expect(socialDefaults('shamwari')).toEqual({ linkedin: '', twitter: '', facebook: '', instagram: '' })
  })
})

describe('toSignatureParams', () => {
  it('passes the form through untouched when no image errored', () => {
    expect(toSignatureParams('nyuchi', FORM, {})).toEqual({ brand: 'nyuchi', ...FORM })
  })

  it('drops errored images from the params — and thus from the emitted HTML', () => {
    const params = toSignatureParams('nyuchi', FORM, { profile: true, banner: true })
    expect(params.profileImage).toBe('')
    expect(params.promoBanner).toBe('')

    const html = buildSignatureHtml(params)
    expect(html).not.toContain('alt="Profile"')
    expect(html).not.toContain('alt="Promotion"')
    // Everything else survives.
    expect(html).toContain('Bryan Fawcett')
    expect(html).toContain('alt="LinkedIn"')
  })

  it('drops each image independently', () => {
    const params = toSignatureParams('nyuchi', FORM, { banner: true })
    expect(params.profileImage).toBe(FORM.profileImage)
    expect(params.promoBanner).toBe('')
  })
})

describe('blocksReadout', () => {
  it('lists photo, social count and banner', () => {
    expect(blocksReadout(toSignatureParams('nyuchi', FORM, {}))).toBe('photo · socials ×1 · banner')
  })

  it('reflects dropped images', () => {
    expect(blocksReadout(toSignatureParams('nyuchi', FORM, { profile: true, banner: true }))).toBe(
      'socials ×1',
    )
  })

  it('counts whatsapp as a social and ignores unsanitizable URLs', () => {
    const params = toSignatureParams(
      'nyuchi',
      {
        ...FORM,
        profileImage: '',
        promoBanner: '',
        whatsapp: '263771234567',
        twitter: 'javascript:alert(1)', // sanitizes to '' → not emitted, not counted
      },
      {},
    )
    expect(blocksReadout(params)).toBe('socials ×2')
  })

  it('falls back to "text only" when no optional block is active', () => {
    const params = toSignatureParams(
      'bundu',
      { ...FORM, profileImage: '', promoBanner: '', linkedin: '', twitter: '', facebook: '', instagram: '' },
      {},
    )
    expect(blocksReadout(params)).toBe('text only')
  })
})
