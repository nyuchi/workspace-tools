import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

/* ── Shared style constants (Mzizi tokens — see design-system/tokens.css) ── */

const captionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-caption)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted-foreground)',
  margin: 0,
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 'var(--fs-h4)',
  lineHeight: 'var(--lh-h4)',
  fontWeight: 700,
  color: 'var(--foreground)',
  margin: 'var(--space-xs) 0 0',
}

const subHeadStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-caption)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted-foreground)',
  margin: 'var(--space-lg) 0 var(--space-sm)',
  paddingBottom: 'var(--space-sm)',
  borderBottom: '1px solid var(--border)',
}

const bodyStyle: React.CSSProperties = {
  fontSize: 'var(--fs-small)',
  lineHeight: 'var(--lh-body)',
  color: 'var(--foreground)',
  margin: '0 0 var(--space-md)',
}

const mutedStyle: React.CSSProperties = {
  ...bodyStyle,
  color: 'var(--muted-foreground)',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--ring-1), var(--shadow-sm)',
  padding: 'var(--space-lg)',
  // Keep anchored sections clear of the sticky 4rem nav.
  scrollMarginTop: '5rem',
}

const codeStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-caption)',
  lineHeight: 1.7,
  color: 'var(--foreground)',
  background: 'var(--muted)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-md) var(--space-base)',
  overflowX: 'auto',
  whiteSpace: 'pre',
  margin: '0 0 var(--space-md)',
}

const inlineCodeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85em',
  background: 'var(--muted)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xs)',
  padding: '1px 5px',
}

const listStyle: React.CSSProperties = {
  ...bodyStyle,
  paddingLeft: '1.25rem',
  display: 'grid',
  gap: 'var(--space-xs-plus)',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

/* ── Small building blocks ── */

const Section = ({
  id,
  index,
  title,
  children,
}: {
  id: string
  index: string
  title: string
  children: React.ReactNode
}) => (
  <section id={id} style={cardStyle}>
    <p style={captionStyle}>{index}</p>
    <h2 style={headingStyle}>{title}</h2>
    <div style={{ marginTop: 'var(--space-base)' }}>{children}</div>
  </section>
)

const Dot = ({ mineral }: { mineral: string }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: 'var(--radius-full)',
      background: `var(--color-${mineral})`,
      marginRight: 'var(--space-sm)',
      verticalAlign: 'baseline',
    }}
  />
)

const DefRow = ({ term, children }: { term: React.ReactNode; children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(9rem, 12rem) 1fr',
      gap: 'var(--space-md)',
      padding: 'var(--space-sm) 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 'var(--fs-small)',
      lineHeight: 'var(--lh-small)',
    }}
  >
    <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{term}</div>
    <div style={{ color: 'var(--muted-foreground)' }}>{children}</div>
  </div>
)

/* ── Content data ── */

const TOC = [
  { href: '#signature', label: 'Email Signature' },
  { href: '#studio', label: 'Nyuchi Studio' },
  { href: '#banner', label: 'Article Banner' },
  { href: '#workspace', label: 'Google Workspace' },
  { href: '#mcp', label: 'MCP Server' },
]

const MINERAL_MEANINGS = [
  { key: 'cobalt', name: 'Cobalt', role: 'Knowledge', desc: 'The mineral in every battery on earth. Our blue of learning and trust.' },
  { key: 'sodalite', name: 'Sodalite', role: 'Intelligence', desc: "Cobalt's deeper cousin — the colour of a mind reasoning through a hard problem." },
  { key: 'tanzanite', name: 'Tanzanite', role: 'Identity', desc: 'A thousand times rarer than diamond, found on a single hillside on earth.' },
  { key: 'malachite', name: 'Malachite', role: 'Growth', desc: 'The oldest green in the human story. The signal that something is alive and working.' },
  { key: 'gold', name: 'Gold', role: 'Value', desc: 'The metal and the honey. nyuchi means bee — the reward carried home to the hive.' },
  { key: 'copper', name: 'Copper', role: 'Stewardship', desc: 'The metal that connects everything. bundu — the ground the rest are dug from.' },
  { key: 'terracotta', name: 'Terracotta', role: 'Community', desc: 'Fired clay, the oldest material we build with. Ubuntu — I am because we are.' },
]

/* ── Page ── */

const Help = () => {
  const location = useLocation()

  // React Router doesn't scroll to #anchors on client-side navigation.
  useEffect(() => {
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView({ block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.hash])

  return (
    <div
      style={{
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
        minHeight: '100%',
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <p style={captionStyle}>Documentation</p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--fs-h3)',
              lineHeight: 'var(--lh-h3)',
              fontWeight: 700,
              margin: 'var(--space-xs) 0 var(--space-sm)',
            }}
          >
            Help
          </h1>
          <p style={{ ...mutedStyle, fontSize: 'var(--fs-body)', margin: 0 }}>
            How to use every tool on tools.nyuchi.com — signatures, social cards, banners,
            the Google Workspace add-ons, and the MCP server for AI agents.
          </p>
        </div>

        {/* On-page contents */}
        <nav
          aria-label="Help sections"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}
        >
          {TOC.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-caption)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
                background: 'var(--surface)',
                boxShadow: 'var(--ring-1)',
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-sm) var(--space-base)',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          {/* ── 01 · Email Signature Generator ── */}
          <Section id="signature" index="01 · Email Signature Generator" title="Create and install a branded signature">
            <p style={bodyStyle}>
              The <Link to="/signature-generator" style={linkStyle}>Signature Generator</Link> builds
              a branded HTML email signature for the Bundu-ecosystem brands — Bundu Foundation,
              Nyuchi Africa, Mukoko, and Shamwari AI, plus the legacy Travel and Learning
              signatures — and copies it to your clipboard, ready to paste into Gmail.
            </p>

            <h3 style={subHeadStyle}>Steps</h3>
            <ol style={listStyle}>
              <li>Pick your brand — social links are prefilled per brand and stay editable.</li>
              <li>Fill in the form. Only <strong>Full name</strong> and <strong>Email</strong> are required.</li>
              <li>Press <strong>Generate Signature</strong> and check the live preview.</li>
              <li>Press <strong>Copy Signature</strong> — the styled HTML is copied to your clipboard.</li>
              <li>
                In Gmail: gear icon → <strong>See all settings</strong> → <strong>General</strong> →{' '}
                <strong>Signature</strong> → <strong>Create new</strong> → paste →{' '}
                <strong>Save Changes</strong> at the bottom.
              </li>
            </ol>

            <h3 style={subHeadStyle}>Fields</h3>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <DefRow term="Full name / Email">Required. Shown as the signature headline and mailto link.</DefRow>
              <DefRow term="Job title">Optional role line under your name.</DefRow>
              <DefRow term="Phone">International format, e.g. +263 77 123 4567. Rendered as a tap-to-call link.</DefRow>
              <DefRow term="WhatsApp">Digits with country code, e.g. 263771234567. Becomes a wa.me chat link.</DefRow>
              <DefRow term="Profile image">Public HTTPS image URL. Square images work best; shown as a rounded avatar.</DefRow>
              <DefRow term="Social links">LinkedIn, X, Facebook, Instagram. Prefilled from the brand — clear a field to drop that icon.</DefRow>
              <DefRow term="Promo banner">Optional banner image URL plus a target link, shown under the signature.</DefRow>
            </div>

            <h3 style={subHeadStyle}>Troubleshooting</h3>
            <ul style={listStyle}>
              <li>
                <strong>Images don't show.</strong> Image URLs must be publicly reachable over HTTPS —
                recipients' mail clients fetch them from the web. Google Drive share links, intranet
                URLs, and local files won't render. If an image fails to load in the preview it is
                automatically left out of the copied signature.
              </li>
              <li>
                <strong>Copy fails.</strong> Modern browsers copy rich HTML directly. Older browsers
                fall back to selecting the preview and issuing a copy command. If both fail, select
                the signature preview by hand and press Ctrl+C (Cmd+C on Mac).
              </li>
              <li>
                <strong>Paste looks unstyled.</strong> Paste straight into Gmail's signature box —
                pasting through a plain-text editor strips the formatting.
              </li>
            </ul>
          </Section>

          {/* ── 02 · Nyuchi Studio ── */}
          <Section id="studio" index="02 · Nyuchi Studio" title="Generative social cards in the mineral system">
            <p style={bodyStyle}>
              <Link to="/studio" style={linkStyle}>Nyuchi Studio</Link> composes social cards as SVG
              from your text, one of seven mineral palettes, a format, a layout, and a seed. The same
              inputs always produce the same card, so designs are reproducible.
            </p>

            <h3 style={subHeadStyle}>The seven minerals</h3>
            <p style={mutedStyle}>
              Each palette carries a meaning in the Bundu design language. The{' '}
              <em>&ldquo;Load this mineral's copy&rdquo;</em> button fills the card with that
              mineral's editorial story (index, role, description, origin) and switches to the
              Mineral layout — a ready-made card about the palette itself.
            </p>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              {MINERAL_MEANINGS.map((m) => (
                <DefRow key={m.key} term={<span><Dot mineral={m.key} />{m.name} · {m.role}</span>}>
                  {m.desc}
                </DefRow>
              ))}
            </div>

            <h3 style={subHeadStyle}>Formats</h3>
            <ul style={listStyle}>
              <li><strong>Square 1:1</strong> — 1080 × 1080, Instagram feed and general social.</li>
              <li><strong>Story 9:16</strong> — 1080 × 1920, Instagram/WhatsApp stories.</li>
              <li><strong>16:9 header</strong> — 1600 × 900, article headers and slides.</li>
              <li><strong>OG / share</strong> — 1200 × 630, link previews (Open Graph).</li>
              <li><strong>LinkedIn</strong> — 1200 × 627, LinkedIn link posts.</li>
            </ul>

            <h3 style={subHeadStyle}>Layouts</h3>
            <ul style={listStyle}>
              <li><strong>L1 · Type</strong> — type-forward; the headline carries the card.</li>
              <li><strong>L2 · Anchor</strong> — composition anchored around the crystal mark.</li>
              <li><strong>L3 · Split</strong> — split block; text and mineral field side by side.</li>
              <li><strong>L4 · Halo</strong> — centered headline inside a radiating halo.</li>
              <li><strong>L5 · Mineral</strong> — spec-sheet layout used by the mineral presets.</li>
            </ul>

            <h3 style={subHeadStyle}>Reshuffle, seed, and export</h3>
            <ul style={listStyle}>
              <li>
                The generative composition is seeded from your title, palette, and layout. The{' '}
                <strong>↻</strong> button reshuffles to a new variation; the current seed is shown in
                the meta bar (e.g. <code style={inlineCodeStyle}>seed 3fa9c210</code>) so a card can
                be reproduced.
              </li>
              <li>
                <strong>SVG</strong> downloads the exact vector — infinitely scalable, ideal for
                editing or print. <strong>PNG</strong> rasterizes at 2× in your browser for platforms
                that only accept bitmaps (the meta bar shows the export pixel size).
              </li>
              <li>
                The <strong>◐ Theme</strong> button flips the light/dark surface; &ldquo;auto&rdquo;
                follows the site theme.
              </li>
            </ul>
          </Section>

          {/* ── 03 · Article Banner Generator ── */}
          <Section id="banner" index="03 · Article Banner Generator" title="Seeded banner art for articles and link shares">
            <p style={bodyStyle}>
              The <Link to="/banner" style={linkStyle}>Banner generator</Link> is Nyuchi Studio's
              sibling for article headers: give it a title and an optional dek, pick a palette and a
              format, and it composes seeded banner art around your words.
            </p>

            <h3 style={subHeadStyle}>Aspect ratios</h3>
            <ul style={listStyle}>
              <li><strong>16:9 header</strong> — 1600 × 900, blog and article headers.</li>
              <li><strong>OG / share</strong> — 1200 × 630, link-preview cards.</li>
              <li><strong>LinkedIn</strong> — 1200 × 627, LinkedIn link posts.</li>
              <li><strong>Instagram</strong> — 1080 × 1080, square social posts.</li>
            </ul>

            <h3 style={subHeadStyle}>Categories and layouts</h3>
            <p style={mutedStyle}>
              Categories are the same seven minerals as the Studio — use them to color-code content
              (e.g. cobalt for learning pieces, malachite for growth updates). Four layouts are
              available: <strong>type-forward</strong>, <strong>anchor</strong>,{' '}
              <strong>split block</strong>, and <strong>centered halo</strong>; square formats use
              dedicated 1:1 variants of each.
            </p>

            <h3 style={subHeadStyle}>Export</h3>
            <p style={mutedStyle}>
              Same as the Studio: shuffle for a new seeded variation, then download{' '}
              <strong>SVG</strong> (vector) or <strong>PNG</strong> (2× raster). Light and dark
              surfaces are supported, with &ldquo;auto&rdquo; following the site theme.
            </p>
          </Section>

          {/* ── 04 · Google Workspace ── */}
          <Section id="workspace" index="04 · Google Workspace" title="Gmail Add-on and admin batch script">
            <p style={bodyStyle}>
              Two Google Apps Script projects apply the same signatures inside Google Workspace. The{' '}
              <Link to="/gmail-addon" style={linkStyle}>Gmail Add-on</Link> lives in the Gmail
              sidebar with a self-service <strong>User tab</strong> and a domain-wide{' '}
              <strong>Admin tab</strong> plus a web dashboard. The <strong>email-signature batch
              script</strong> lets Workspace admins push signatures to every user in the domain —
              including each user's send-as aliases — on demand or on a daily schedule.
            </p>
            <p style={mutedStyle}>
              Admin features read the directory and write other users' signatures, which requires
              domain-wide delegation in the Google Admin Console. The{' '}
              <Link to="/setup" style={linkStyle}>Setup guide</Link> walks through clasp, deployment,
              and delegation; deeper docs live in the repo:{' '}
              <a href="https://github.com/nyuchi/workspace-tools/tree/main/gmail-addon" target="_blank" rel="noopener noreferrer" style={linkStyle}>gmail-addon</a>{' '}
              and{' '}
              <a href="https://github.com/nyuchi/workspace-tools/tree/main/email-signature" target="_blank" rel="noopener noreferrer" style={linkStyle}>email-signature</a>.
            </p>
          </Section>

          {/* ── 05 · MCP Server ── */}
          <Section id="mcp" index="05 · MCP Server" title="Use these tools from AI agents">
            <p style={bodyStyle}>
              MCP (Model Context Protocol) is an open standard that lets AI assistants like Claude
              call external tools over HTTP. This site hosts an MCP server, so an agent connected to
              it can generate Nyuchi email signatures and design assets directly in a conversation —
              the signature tool runs the exact same engine as the web generator, so the output is
              identical.
            </p>

            <h3 style={subHeadStyle}>Endpoint</h3>
            <code style={codeStyle}>https://tools.nyuchi.com/mcp</code>

            <h3 style={subHeadStyle}>Connect from claude.ai</h3>
            <p style={mutedStyle}>
              <strong>Settings → Connectors → Add custom connector</strong>, then paste the endpoint
              URL above. The tools appear in Claude's tool menu once connected.
            </p>

            <h3 style={subHeadStyle}>Connect from Claude Code</h3>
            <code style={codeStyle}>claude mcp add --transport http nyuchi-tools https://tools.nyuchi.com/mcp</code>

            <h3 style={subHeadStyle}>Tools</h3>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <DefRow term={<code style={inlineCodeStyle}>generate_email_signature</code>}>
                Live. Returns branded signature HTML — same engine and byte-identical output as the
                web generator.
              </DefRow>
              <DefRow term={<code style={inlineCodeStyle}>generate_studio_card</code>}>
                Live. Returns SVG from the same Studio engine as the /studio page, plus JSON
                metadata (size and seed). PNG output is a follow-up.
              </DefRow>
              <DefRow term={<code style={inlineCodeStyle}>generate_article_banner</code>}>
                Live. Returns SVG from the same banner engine as the /banner page, plus JSON
                metadata (size and seed). PNG output is a follow-up.
              </DefRow>
            </div>

            <p style={mutedStyle}>
              The endpoint is currently open — no sign-in required. Authentication via WorkOS
              (OAuth) may be enabled later; MCP clients will then prompt you to sign in when
              connecting.
            </p>
          </Section>
        </div>

        {/* Footer note */}
        <p style={{ ...mutedStyle, marginTop: 'var(--space-xl)', textAlign: 'center' }}>
          Something missing or wrong?{' '}
          <a
            href="https://github.com/nyuchi/workspace-tools/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Open an issue on GitHub
          </a>
          .
        </p>
      </div>
    </div>
  )
}

export default Help
