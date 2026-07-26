/* Email-signature engine — the canonical source of the emitted signature HTML.
 *
 * Pure module (no React, no DOM): imported by both the SPA
 * (src/components/EmailSignatureGenerator.tsx) and the nyuchi-tools Cloudflare
 * Worker MCP server (mcp/src/index.ts, tool `nyuchi_generate_email_signature`).
 *
 * The logic was moved VERBATIM from EmailSignatureGenerator.tsx — the emitted
 * HTML must stay byte-identical for identical inputs. It is brand-locked to
 * the historical signature styling (Plus Jakarta Sans / Noto Serif, brand
 * primary colors) and must NOT be restyled to the SPA's mineral design system.
 *
 * NOTE: gmail-addon/Code.js and email-signature/Code.js still hardcode their
 * own copies of the brand config and signature template (Apps Script cannot
 * import npm modules). This module is now the canonical source; those two
 * files must be kept in sync manually whenever brands, social links, or the
 * signature markup change.
 */

import { sanitizeUrl as braintreeSanitizeUrl } from '@braintree/sanitize-url';

// Use braintree's sanitize-url for robust XSS protection
// Returns 'about:blank' for dangerous URLs (javascript:, data:, etc.)
export const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  // If no protocol and not empty, assume https
  if (trimmed && !/^[a-z]+:/i.test(trimmed)) {
    return braintreeSanitizeUrl(`https://${trimmed}`);
  }
  const sanitized = braintreeSanitizeUrl(trimmed);
  // braintree returns 'about:blank' for dangerous URLs
  return sanitized === 'about:blank' ? '' : sanitized;
};

// Create safe mailto URL with proper encoding
export const createMailtoUrl = (email: string): string => {
  if (!email) return '';
  return `mailto:${encodeURIComponent(email.trim())}`;
};

// Create safe tel URL with proper encoding
export const createTelUrl = (phone: string): string => {
  if (!phone) return '';
  // Remove spaces and encode the phone number
  const cleanPhone = phone.replace(/\s/g, '');
  return `tel:${encodeURIComponent(cleanPhone)}`;
};

// Create safe WhatsApp URL with proper encoding
export const createWhatsAppUrl = (phone: string): string => {
  if (!phone) return '';
  // Remove any non-numeric characters except + and encode
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  return `https://wa.me/${encodeURIComponent(cleanPhone)}`;
};

// Escape HTML entities to prevent XSS - uses string replacement for safety
export const escapeHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Escape attribute values
export const escapeAttr = (text: string): string => {
  return escapeHtml(text);
};

export interface SignatureBrand {
  name: string;
  tagline: string;
  website: string;
  websiteUrl: string;
  primaryColor: string;
  primaryColorDark: string;
  socials: Record<string, string>;
}

/**
 * Signature brand slugs, usable as a zod enum (z.enum(BRAND_KEYS)) on the
 * MCP side.
 *
 * `nyuchi`, `mukoko`, `bundu`, and `shamwari` are the four top-level
 * Bundu-ecosystem brands — see src/engines/brands (the canonical registry).
 * `travel` and `learning` stay as LEGACY signature keys:
 * - `travel`   → Zimbabwe Information Platform, a Bundu Foundation
 *   initiative (still emitted under its historical "Zimbabwe Travel
 *   Information" signature identity).
 * - `learning` → Nyuchi Learning, a Nyuchi Africa division.
 *
 * The entries below are the historical signature copies: emitted HTML for
 * the pre-existing keys is byte-locked, so do not re-sync their wording or
 * colors to the registry.
 */
export const BRAND_KEYS = ['nyuchi', 'mukoko', 'travel', 'learning', 'bundu', 'shamwari'] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

export const BRANDS: Record<BrandKey, SignatureBrand> = {
  nyuchi: {
    name: 'Nyuchi Africa',
    tagline: 'I am because we are',
    website: 'nyuchi.com',
    websiteUrl: 'https://nyuchi.com',
    primaryColor: '#5D4037',
    primaryColorDark: '#FFD740',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/',
      facebook: 'https://facebook.com/nyuchigroup',
      instagram: 'https://instagram.com/nyuchi.africa'
    }
  },
  mukoko: {
    name: 'Mukoko',
    tagline: 'Your Digital Twin Ecosystem',
    website: 'mukoko.com',
    websiteUrl: 'https://mukoko.com',
    primaryColor: '#4B0082',
    primaryColorDark: '#B388FF',
    socials: {
      facebook: 'https://facebook.com/mukokoafrica',
      instagram: 'https://instagram.com/mukoko.africa'
    }
  },
  travel: {
    name: 'Zimbabwe Travel Information',
    tagline: 'Discover the Heart of Africa',
    website: 'travel-info.co.zw',
    websiteUrl: 'https://travel-info.co.zw',
    primaryColor: '#004D40',
    primaryColorDark: '#64FFDA',
    socials: {
      twitter: 'https://x.com/zimbabwetravel',
      instagram: 'https://instagram.com/zimbabwe.travel'
    }
  },
  learning: {
    name: 'Nyuchi Learning',
    tagline: 'Education for Africa\'s Future',
    website: 'learning.nyuchi.com',
    websiteUrl: 'https://learning.nyuchi.com',
    primaryColor: '#0047AB',
    primaryColorDark: '#00B0FF',
    socials: {
      linkedin: 'https://www.linkedin.com/company/nyuchi/',
      instagram: 'https://instagram.com/nyuchi.africa'
    }
  },
  bundu: {
    name: 'Bundu Foundation',
    tagline: 'The wilderness holds the hive',
    website: 'bundu.org',
    websiteUrl: 'https://bundu.org',
    // TODO(brand): confirm — copper mineral (light/dark) as Bundu's colors.
    primaryColor: '#BF5A36',
    primaryColorDark: '#FF8A65',
    socials: {}
  },
  shamwari: {
    name: 'Shamwari AI',
    tagline: 'AI that actually works for Africa',
    website: 'shamwari.ai',
    websiteUrl: 'https://shamwari.ai',
    // TODO(brand): confirm — sodalite mineral (light/dark) as Shamwari's colors.
    primaryColor: '#283593',
    primaryColorDark: '#3D5AFE',
    socials: {}
  }
};

/** Neutral text colors used inside the emitted signature markup. */
export const SIGNATURE_COLORS = {
  text: '#141413',
  muted: '#52524E'
} as const;

export interface SignatureParams {
  /** Brand slug — one of BRAND_KEYS. */
  brand: BrandKey;
  name: string;
  email: string;
  title?: string;
  phone?: string;
  whatsapp?: string;
  profileImage?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  promoBanner?: string;
  promoLink?: string;
}

const resolveBrand = (brand: BrandKey): SignatureBrand => {
  const brandData = BRANDS[brand];
  if (!brandData) {
    throw new Error(`Unknown brand '${brand}'. Expected one of: ${BRAND_KEYS.join(', ')}`);
  }
  return brandData;
};

// Normalize optional fields to the empty-string form the template logic expects.
const normalizeParams = (params: SignatureParams) => ({
  name: params.name ?? '',
  title: params.title ?? '',
  email: params.email ?? '',
  phone: params.phone ?? '',
  profileImage: params.profileImage ?? '',
  linkedin: params.linkedin ?? '',
  twitter: params.twitter ?? '',
  facebook: params.facebook ?? '',
  instagram: params.instagram ?? '',
  whatsapp: params.whatsapp ?? '',
  promoBanner: params.promoBanner ?? '',
  promoLink: params.promoLink ?? ''
});

// Generate signature HTML with proper escaping - avoids innerHTML XSS risks
export function buildSignatureHtml(params: SignatureParams): string {
  const brandData = resolveBrand(params.brand);
  const formData = normalizeParams(params);
  const colors = SIGNATURE_COLORS;

  const socialIconHtml = (url: string, iconUrl: string, alt: string) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return '';
    return `<td style="padding-right: 8px;">
        <a href="${escapeAttr(safeUrl)}" style="text-decoration: none;">
          <img src="${escapeAttr(sanitizeUrl(iconUrl))}" alt="${escapeAttr(alt)}" width="24" height="24" style="display: block; border-radius: 4px;" />
        </a>
      </td>`;
  };

  let html = `<table cellpadding="0" cellspacing="0" style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: ${colors.text}; max-width: 500px;">
      <tbody>
        <tr>`;

  // Profile image
  if (formData.profileImage) {
    html += `<td style="vertical-align: top; padding-right: 16px;">
        <img src="${escapeAttr(sanitizeUrl(formData.profileImage))}" alt="Profile" width="80" height="80" style="border-radius: 50%; display: block; object-fit: cover;" />
      </td>`;
  }

  html += `<td style="vertical-align: top;">
      <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 17px; font-weight: 700; color: ${colors.text};">${escapeHtml(formData.name)}</span>
      <br />
      <span style="font-size: 13px; font-weight: 500; color: ${colors.muted};">${escapeHtml(formData.title)}</span>
      <br /><br />
      <span style="font-family: 'Noto Serif', Georgia, serif; font-size: 15px; font-weight: 700; color: ${brandData.primaryColor};">${escapeHtml(brandData.name)}</span>
      <br />
      <span style="font-size: 12px; font-style: italic; color: ${colors.muted};">"${escapeHtml(brandData.tagline)}"</span>
      <br /><br />
      <table cellpadding="0" cellspacing="0" style="font-size: 13px; color: ${colors.muted};">
        <tbody>
          <tr>
            <td style="padding-bottom: 3px;">
              <a href="${escapeAttr(createMailtoUrl(formData.email))}" style="color: ${brandData.primaryColor}; text-decoration: none;">${escapeHtml(formData.email)}</a>
            </td>
          </tr>`;

  if (formData.phone) {
    html += `<tr>
        <td style="padding-bottom: 3px;">
          <a href="${escapeAttr(createTelUrl(formData.phone))}" style="color: ${brandData.primaryColor}; text-decoration: none;">${escapeHtml(formData.phone)}</a>
        </td>
      </tr>`;
  }

  html += `<tr>
        <td>
          <a href="${escapeAttr(brandData.websiteUrl)}" style="color: ${brandData.primaryColor}; text-decoration: none;">${escapeHtml(brandData.website)}</a>
        </td>
      </tr>
        </tbody>
      </table>
      <br />
      <table cellpadding="0" cellspacing="0">
        <tbody>
          <tr>
            ${socialIconHtml(formData.linkedin, 'https://cdn-icons-png.flaticon.com/512/3536/3536505.png', 'LinkedIn')}
            ${socialIconHtml(formData.twitter, 'https://cdn-icons-png.flaticon.com/512/5969/5969020.png', 'X')}
            ${socialIconHtml(formData.facebook, 'https://cdn-icons-png.flaticon.com/512/5968/5968764.png', 'Facebook')}
            ${socialIconHtml(formData.instagram, 'https://cdn-icons-png.flaticon.com/512/2111/2111463.png', 'Instagram')}
            ${formData.whatsapp ? socialIconHtml(createWhatsAppUrl(formData.whatsapp), 'https://cdn-icons-png.flaticon.com/512/3670/3670051.png', 'WhatsApp') : ''}
          </tr>
        </tbody>
      </table>
    </td>
  </tr>`;

  // Promo banner
  if (formData.promoBanner) {
    html += `<tr>
        <td colspan="2" style="padding-top: 16px;"></td>
      </tr>
      <tr>
        <td colspan="2">
          <a href="${escapeAttr(sanitizeUrl(formData.promoLink) || '#')}" style="text-decoration: none;">
            <img src="${escapeAttr(sanitizeUrl(formData.promoBanner))}" alt="Promotion" width="400" style="display: block; max-width: 100%; height: auto; border-radius: 8px;" />
          </a>
        </td>
      </tr>`;
  }

  html += `</tbody></table>`;

  return html;
}

// Generate plain text version
export function buildSignatureText(params: SignatureParams): string {
  const brandData = resolveBrand(params.brand);
  const formData = normalizeParams(params);
  let text = `${formData.name}\n${formData.title}\n\n${brandData.name}\n"${brandData.tagline}"\n\n${formData.email}`;
  if (formData.phone) text += `\n${formData.phone}`;
  text += `\n${brandData.website}`;
  return text;
}
