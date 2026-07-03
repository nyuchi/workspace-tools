/* Pure helpers for the Email Signature page — UI-side only.
 *
 * Nothing here touches the emitted signature markup: that lives exclusively
 * in src/engines/signature (buildSignatureHtml / buildSignatureText) and is
 * byte-locked. These helpers map brands to SPA accent minerals, reset the
 * social links on brand switch, drop errored images from the engine params,
 * and describe which optional blocks are active for the meta readout.
 */

import { BRANDS, sanitizeUrl, type BrandKey, type SignatureParams } from '../../engines/signature'
import type { Category } from '../../engines/nyuchi'

/** Every field the control panel edits. All strings; empty = absent. */
export interface SignatureFormData {
  name: string
  title: string
  email: string
  phone: string
  whatsapp: string
  profileImage: string
  linkedin: string
  twitter: string
  facebook: string
  instagram: string
  promoBanner: string
  promoLink: string
}

/** Brand slug → Mzizi mineral. Drives the SPA accent only (brand chips,
 * focus rings, primary action button). It does NOT affect the emitted
 * signature HTML, which keeps using BRANDS[brand].primaryColor. */
export const BRAND_MINERAL: Record<BrandKey, Category> = {
  nyuchi: 'gold',
  mukoko: 'tanzanite',
  travel: 'malachite',
  learning: 'cobalt',
  bundu: 'copper',
  shamwari: 'sodalite',
}

/** Short chip labels for the brand grid. */
export const BRAND_LABELS: Record<BrandKey, string> = {
  nyuchi: 'Nyuchi',
  mukoko: 'Mukoko',
  travel: 'Travel',
  learning: 'Learning',
  bundu: 'Bundu',
  shamwari: 'Shamwari',
}

/** Default social links for a brand — what the form resets to on brand
 * switch (same behavior as the original component's brand effect). */
export const socialDefaults = (
  brand: BrandKey,
): Pick<SignatureFormData, 'linkedin' | 'twitter' | 'facebook' | 'instagram'> => {
  const socials = BRANDS[brand].socials
  return {
    linkedin: socials.linkedin || '',
    twitter: socials.twitter || '',
    facebook: socials.facebook || '',
    instagram: socials.instagram || '',
  }
}

/** Engine params for the current form. Images that failed to load in the
 * preview are dropped so the preview and the copied HTML stay in lockstep. */
export const toSignatureParams = (
  brand: BrandKey,
  form: SignatureFormData,
  imageErrors: Record<string, boolean>,
): SignatureParams => ({
  brand,
  ...form,
  profileImage: imageErrors['profile'] ? '' : form.profileImage,
  promoBanner: imageErrors['banner'] ? '' : form.promoBanner,
})

/** Mono meta-row readout of the optional blocks the emitted signature
 * contains, e.g. "photo · socials ×3 · banner". Mirrors the engine's own
 * emission rules: a social icon renders only when its URL sanitizes to a
 * non-empty value; WhatsApp renders whenever the number is non-empty. */
export const blocksReadout = (params: SignatureParams): string => {
  let socials = [params.linkedin, params.twitter, params.facebook, params.instagram].filter(
    (url) => Boolean(url && sanitizeUrl(url)),
  ).length
  if (params.whatsapp) socials += 1

  const parts: string[] = []
  if (params.profileImage) parts.push('photo')
  if (socials) parts.push(`socials ×${socials}`)
  if (params.promoBanner) parts.push('banner')
  return parts.length ? parts.join(' · ') : 'text only'
}
