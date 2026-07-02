import { Link } from 'react-router-dom'

/**
 * Placeholder — full port of Nyuchi Studio (social card generator) lands here.
 * See scratchpad handoff bundle: organic-loaders/project/Nyuchi Studio.html
 * + nyuchi-engine.js + nyuchi-app.js.
 */
const StudioPage = () => {
  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 4rem)',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
        padding: 'var(--space-2xl) var(--space-lg)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Nyuchi Studio · social cards
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--fs-h1)',
            lineHeight: 'var(--lh-h1)',
            letterSpacing: '-0.02em',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Seven minerals, <em style={{ color: 'var(--color-gold)' }}>one ecosystem</em>
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--fs-body-lg)',
            lineHeight: 'var(--lh-body)',
            color: 'var(--muted-foreground)',
            marginTop: 'var(--space-lg)',
          }}
        >
          The full social-card generator (5 layouts × 5 formats × 7 mineral palettes, seeded o2 graph
          background, SVG + PNG export) is being ported from the handoff bundle. This route is live
          so the URL is stable; the generator UI lands in the next commit.
        </p>
        <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 'var(--h-button-sm)',
              padding: '0 var(--space-lg)',
              borderRadius: 'var(--radius-full)',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-small)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Back to tools
          </Link>
        </div>
      </div>
    </div>
  )
}

export default StudioPage
