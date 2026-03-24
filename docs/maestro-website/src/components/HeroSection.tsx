import MediaPlaceholder from './MediaPlaceholder'

export default function HeroSection() {
  return (
    <section id="overview" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      position: 'relative',
      paddingTop: 'calc(var(--nav-height) + 80px)',
      paddingBottom: '64px',
      paddingLeft: 'max(var(--space-6), 5vw)',
      paddingRight: 'max(var(--space-6), 5vw)',
    }} aria-label="Overview">
      {/* Animated gradient glow background */}
      <div className="hero-glow" aria-hidden="true" />

      {/* Gradient mesh background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(91, 108, 240, 0.08), transparent),
          radial-gradient(ellipse 50% 70% at 78% 5%, rgba(56, 191, 167, 0.05), transparent),
          radial-gradient(ellipse 60% 40% at 55% 90%, rgba(232, 164, 74, 0.03), transparent)`,
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }} aria-hidden="true" />

      <div style={{ maxWidth: 'var(--content-narrow)', width: '100%', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Eyebrow badges — plain text with · separators */}
        <div className="hero-entrance" style={{ '--hero-delay': '0ms', marginBottom: 'var(--space-6)' } as React.CSSProperties}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
          }}>
            Open Source <span style={{ margin: '0 8px', opacity: 0.5 }}>{'\u00B7'}</span> Multi-Agent <span style={{ margin: '0 8px', opacity: 0.5 }}>{'\u00B7'}</span> Local-First
          </span>
        </div>

        {/* Headline — Line 1 solid, Line 2 gradient */}
        <h1 className="hero-entrance" style={{
          '--hero-delay': '200ms',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2.5rem, 6vw + 0.5rem, 4.5rem)',
          fontWeight: 700,
          lineHeight: 1.0,
          letterSpacing: '-0.04em',
          marginBottom: 'var(--space-6)',
        } as React.CSSProperties}>
          <span style={{ display: 'block', color: 'var(--color-text)' }}>Orchestrate AI agents.</span>
          <span style={{
            display: 'block',
            background: 'var(--gradient-text-hero)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Ship faster.</span>
        </h1>

        {/* Subheadline */}
        <p className="hero-entrance" style={{
          '--hero-delay': '400ms',
          fontFamily: 'var(--font-body)',
          fontSize: '1.0625rem',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.7,
          marginBottom: 'var(--space-8)',
          maxWidth: '520px',
          marginLeft: 'auto',
          marginRight: 'auto',
        } as React.CSSProperties}>
          Maestro coordinates multiple Claude sessions across your projects — break work into tasks, spawn agents in parallel, and track everything from one place.
        </p>

        {/* CTA — primary button + text link */}
        <div className="hero-entrance" style={{
          '--hero-delay': '600ms',
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-12)',
        } as React.CSSProperties}>
          <a href="#get-started" className="btn-primary">Get Started</a>
          <a
            href="https://github.com/anthropics/maestro"
            className="btn-text"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub <span className="btn-arrow">{'\u2192'}</span>
          </a>
        </div>

        {/* Hero demo reel placeholder — slightly offset */}
        <div className="hero-entrance" style={{
          '--hero-delay': '900ms',
          marginLeft: '3%',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        } as React.CSSProperties}>
          <MediaPlaceholder id="MP-01" description="Hero demo reel — desktop app quick cuts" width={800} height={450} />
        </div>
      </div>
    </section>
  )
}
