import { Link } from 'react-router-dom'

/**
 * Placeholder — full port of the Article Banner Generator lands here.
 * See scratchpad handoff bundle: organic-loaders/project/Article Banner Generator.html
 * + banner-engine.js + banner-app.js.
 */
const BannerPage = () => {
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
          Nyuchi · banner studio
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
          Article <em style={{ color: 'var(--color-gold)' }}>banner</em> generator
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
          Editorial banner generator (4 layouts × 4 formats, category-driven, o2-seeded) is being
          ported from the handoff bundle. This route is live so the URL is stable; the generator
          UI lands in the next commit.
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

export default BannerPage
