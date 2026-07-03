import { describe, expect, it } from 'vitest'
import {
  BRAND_KEYS,
  BRANDS,
  buildSignatureHtml,
  buildSignatureText,
  createMailtoUrl,
  createTelUrl,
  createWhatsAppUrl,
  escapeHtml,
  sanitizeUrl,
  type SignatureParams,
} from '../src/engines/signature'

const FULL_PARAMS: SignatureParams = {
  brand: 'nyuchi',
  name: 'Bryan Fawcett',
  title: 'Founder & CEO',
  email: 'bryan@nyuchi.com',
  phone: '+263 77 123 4567',
  whatsapp: '+263 77 123 4567',
  profileImage: 'https://assets.nyuchi.com/people/bryan.png',
  linkedin: 'https://www.linkedin.com/in/bryanfawcett/',
  twitter: 'https://x.com/bryanfawcett',
  facebook: 'https://facebook.com/nyuchigroup',
  instagram: 'https://instagram.com/nyuchi.africa',
  promoBanner: 'https://assets.nyuchi.com/promos/launch.png',
  promoLink: 'https://nyuchi.com/launch',
}

const MINIMAL_PARAMS: SignatureParams = {
  brand: 'mukoko',
  name: 'Thandi Moyo',
  email: 'thandi@mukoko.com',
}

describe('URL helpers', () => {
  it('createMailtoUrl percent-encodes the address', () => {
    expect(createMailtoUrl('bryan@nyuchi.com')).toBe('mailto:bryan%40nyuchi.com')
    expect(createMailtoUrl('  padded@nyuchi.com  ')).toBe('mailto:padded%40nyuchi.com')
    expect(createMailtoUrl('')).toBe('')
  })

  it('createTelUrl strips spaces and encodes the plus sign', () => {
    expect(createTelUrl('+263 77 123 4567')).toBe('tel:%2B263771234567')
    expect(createTelUrl('')).toBe('')
  })

  it('createWhatsAppUrl keeps only digits and + and builds a wa.me link', () => {
    expect(createWhatsAppUrl('+263 (77) 123-4567')).toBe('https://wa.me/%2B263771234567')
    expect(createWhatsAppUrl('263771234567')).toBe('https://wa.me/263771234567')
    expect(createWhatsAppUrl('')).toBe('')
  })

  it('sanitizeUrl neutralizes javascript: and data: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBe('')
  })

  it('sanitizeUrl assumes https for protocol-less URLs and passes real URLs through', () => {
    expect(sanitizeUrl('linkedin.com/in/foo')).toBe('https://linkedin.com/in/foo')
    // braintree v7 canonicalizes bare origins by appending a trailing slash.
    expect(sanitizeUrl('https://nyuchi.com')).toBe('https://nyuchi.com/')
    expect(sanitizeUrl('https://nyuchi.com/launch')).toBe('https://nyuchi.com/launch')
    expect(sanitizeUrl('')).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapes every HTML-special character in replacement order', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#039;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('')).toBe('')
  })

  it('does not double-escape via the ampersand-first ordering', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('BRANDS registry', () => {
  it('exposes the four legacy slugs plus bundu and shamwari', () => {
    expect(BRAND_KEYS).toEqual(['nyuchi', 'mukoko', 'travel', 'learning', 'bundu', 'shamwari'])
    expect(Object.keys(BRANDS).sort()).toEqual([...BRAND_KEYS].sort())
  })

  it('pins the historical primary colors per brand', () => {
    expect(BRANDS.nyuchi.primaryColor).toBe('#5D4037')
    expect(BRANDS.mukoko.primaryColor).toBe('#4B0082')
    expect(BRANDS.travel.primaryColor).toBe('#004D40')
    expect(BRANDS.learning.primaryColor).toBe('#0047AB')
  })

  it('pins the mineral primary colors of the new brands', () => {
    expect(BRANDS.bundu.primaryColor).toBe('#BF5A36') // copper (light)
    expect(BRANDS.bundu.primaryColorDark).toBe('#FF8A65')
    expect(BRANDS.shamwari.primaryColor).toBe('#283593') // sodalite (light)
    expect(BRANDS.shamwari.primaryColorDark).toBe('#3D5AFE')
  })
})

describe('buildSignatureHtml — full params (nyuchi)', () => {
  const html = buildSignatureHtml(FULL_PARAMS)

  it('renders name, title, brand block, and the brand primary color', () => {
    expect(html).toContain('>Bryan Fawcett</span>')
    expect(html).toContain('>Founder &amp; CEO</span>')
    expect(html).toContain('color: #5D4037;">Nyuchi Africa</span>')
    expect(html).toContain('"I am because we are"')
    expect(html).toContain(`href="${BRANDS.nyuchi.websiteUrl}"`)
    expect(html).toContain('>nyuchi.com</a>')
  })

  it('emits encoded mailto:, tel:, and wa.me URLs', () => {
    expect(html).toContain('href="mailto:bryan%40nyuchi.com"')
    expect(html).toContain('href="tel:%2B263771234567"')
    // The wa.me link passes through sanitizeUrl (unlike mailto:/tel:), and
    // braintree v7 decodes percent-encoding — so %2B comes back out as +.
    expect(html).toContain('href="https://wa.me/+263771234567"')
  })

  it('renders the profile image, all four social icons, and the promo banner', () => {
    expect(html).toContain('src="https://assets.nyuchi.com/people/bryan.png" alt="Profile"')
    for (const alt of ['LinkedIn', 'X', 'Facebook', 'Instagram', 'WhatsApp']) {
      expect(html).toContain(`alt="${alt}"`)
    }
    expect(html).toContain('src="https://assets.nyuchi.com/promos/launch.png" alt="Promotion"')
    expect(html).toContain('href="https://nyuchi.com/launch"')
  })

  it('is brand-locked to the historical signature fonts', () => {
    expect(html).toContain("font-family: 'Plus Jakarta Sans', Arial, sans-serif")
    expect(html).toContain("font-family: 'Noto Serif', Georgia, serif")
  })

  it('is deterministic — identical params produce identical HTML', () => {
    expect(buildSignatureHtml({ ...FULL_PARAMS })).toBe(html)
  })
})

describe('buildSignatureHtml — minimal params (mukoko)', () => {
  const html = buildSignatureHtml(MINIMAL_PARAMS)

  it('renders the mukoko brand block and color', () => {
    expect(html).toContain('color: #4B0082;">Mukoko</span>')
    expect(html).toContain('"Your Digital Twin Ecosystem"')
    expect(html).toContain('href="mailto:thandi%40mukoko.com"')
  })

  it('omits optional sections entirely', () => {
    expect(html).not.toContain('<img') // no profile image, no social icons, no banner
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('wa.me')
    expect(html).not.toContain('alt="Promotion"')
  })

  it('is deterministic', () => {
    expect(buildSignatureHtml({ ...MINIMAL_PARAMS })).toBe(html)
  })
})

describe('buildSignatureHtml — whatsapp-only socials', () => {
  const html = buildSignatureHtml({
    brand: 'travel',
    name: 'Guide',
    email: 'guide@travel-info.co.zw',
    whatsapp: '263 71 999 8888',
  })

  it('renders only the WhatsApp icon', () => {
    expect(html).toContain('href="https://wa.me/263719998888"')
    expect(html).toContain('alt="WhatsApp"')
    expect(html).not.toContain('alt="LinkedIn"')
    expect(html).not.toContain('alt="X"')
    expect(html).not.toContain('alt="Facebook"')
    expect(html).not.toContain('alt="Instagram"')
  })

  it('uses the travel brand primary color', () => {
    expect(html).toContain('color: #004D40;">Zimbabwe Travel Information</span>')
  })
})

describe('buildSignatureHtml — XSS hardening', () => {
  const hostile = '<b>&"\''
  const html = buildSignatureHtml({
    brand: 'learning',
    name: `Name ${hostile}`,
    title: `Title ${hostile}`,
    email: `evil${hostile}@x.com`,
    phone: `+1 <555> "0"`,
    whatsapp: '+1 555 000',
    linkedin: 'javascript:alert(1)',
    twitter: 'javascript:alert(2)',
    facebook: 'javascript:alert(3)',
    instagram: 'javascript:alert(4)',
    profileImage: 'javascript:alert(5)',
    promoBanner: 'javascript:alert(6)',
    promoLink: 'javascript:alert(7)',
  })

  it('HTML-escapes every text field', () => {
    expect(html).toContain('Name &lt;b&gt;&amp;&quot;&#039;')
    expect(html).toContain('Title &lt;b&gt;&amp;&quot;&#039;')
    expect(html).toContain('evil&lt;b&gt;&amp;&quot;&#039;@x.com')
    expect(html).toContain('+1 &lt;555&gt; &quot;0&quot;')
    expect(html).not.toContain(hostile)
  })

  it('neutralizes every javascript: URL', () => {
    expect(html).not.toContain('javascript:')
    // javascript: social links are dropped entirely (no icon cell rendered)
    expect(html).not.toContain('alt="LinkedIn"')
    expect(html).not.toContain('alt="X"')
    expect(html).not.toContain('alt="Facebook"')
    expect(html).not.toContain('alt="Instagram"')
    // javascript: promo link degrades to the inert '#' href
    expect(html).toContain('href="#"')
  })

  it('percent-encodes hostile characters out of mailto:/tel: URLs', () => {
    expect(html).toContain(`href="${escapeHtml('mailto:' + encodeURIComponent(`evil${hostile}@x.com`))}"`)
    expect(html).toContain('href="tel:%2B1%3C555%3E%220%22"')
  })
})

describe('buildSignatureHtml — new top-level brands (bundu, shamwari)', () => {
  const bunduHtml = buildSignatureHtml({
    brand: 'bundu',
    name: 'Tariro Chikafu',
    email: 'tariro@bundu.org',
  })

  const shamwariHtml = buildSignatureHtml({
    brand: 'shamwari',
    name: 'Farai Gumbo',
    email: 'farai@shamwari.ai',
  })

  it('renders the Bundu Foundation brand block with the copper primary', () => {
    expect(bunduHtml).toContain('color: #BF5A36;">Bundu Foundation</span>')
    expect(bunduHtml).toContain('"The wilderness holds the hive"')
    expect(bunduHtml).toContain('href="https://bundu.org"')
    expect(bunduHtml).toContain('>bundu.org</a>')
  })

  it('renders the Shamwari AI brand block with the sodalite primary', () => {
    expect(shamwariHtml).toContain('color: #283593;">Shamwari AI</span>')
    expect(shamwariHtml).toContain('"AI that actually works for Africa"')
    expect(shamwariHtml).toContain('href="https://shamwari.ai"')
    expect(shamwariHtml).toContain('>shamwari.ai</a>')
  })

  it('is deterministic for the new brands', () => {
    expect(buildSignatureHtml({ brand: 'bundu', name: 'Tariro Chikafu', email: 'tariro@bundu.org' })).toBe(bunduHtml)
    expect(buildSignatureHtml({ brand: 'shamwari', name: 'Farai Gumbo', email: 'farai@shamwari.ai' })).toBe(shamwariHtml)
  })

  it('produces the exact golden plain-text signatures', () => {
    expect(buildSignatureText({ brand: 'bundu', name: 'Tariro Chikafu', email: 'tariro@bundu.org' })).toBe(
      'Tariro Chikafu\n' +
        '\n' +
        '\n' +
        'Bundu Foundation\n' +
        '"The wilderness holds the hive"\n' +
        '\n' +
        'tariro@bundu.org\n' +
        'bundu.org',
    )
    expect(buildSignatureText({ brand: 'shamwari', name: 'Farai Gumbo', email: 'farai@shamwari.ai' })).toBe(
      'Farai Gumbo\n' +
        '\n' +
        '\n' +
        'Shamwari AI\n' +
        '"AI that actually works for Africa"\n' +
        '\n' +
        'farai@shamwari.ai\n' +
        'shamwari.ai',
    )
  })
})

describe('buildSignatureText', () => {
  it('produces the exact golden plain-text signature (with phone)', () => {
    expect(buildSignatureText(FULL_PARAMS)).toBe(
      'Bryan Fawcett\n' +
        'Founder & CEO\n' +
        '\n' +
        'Nyuchi Africa\n' +
        '"I am because we are"\n' +
        '\n' +
        'bryan@nyuchi.com\n' +
        '+263 77 123 4567\n' +
        'nyuchi.com',
    )
  })

  it('produces the exact golden plain-text signature (minimal, no phone)', () => {
    expect(buildSignatureText(MINIMAL_PARAMS)).toBe(
      'Thandi Moyo\n' +
        '\n' +
        '\n' +
        'Mukoko\n' +
        '"Your Digital Twin Ecosystem"\n' +
        '\n' +
        'thandi@mukoko.com\n' +
        'mukoko.com',
    )
  })

  it('is deterministic', () => {
    expect(buildSignatureText(FULL_PARAMS)).toBe(buildSignatureText({ ...FULL_PARAMS }))
  })
})
