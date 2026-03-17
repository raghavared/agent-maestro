export default function CTASection() {
  return (
    <>
      {/* Top section divider */}
      <div className="section-divider" />

      <section
        aria-label="Call to action"
        style={{
          padding: 'var(--space-24) max(var(--space-6), 5vw)',
          background: `radial-gradient(ellipse 60% 50% at 50% 40%, rgba(91, 108, 240, 0.08), transparent), var(--color-surface-1)`,
          textAlign: 'center',
        }}
      >
        <div className="reveal" style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 3vw + 0.5rem, 2.25rem)',
            fontWeight: 700,
            color: 'var(--color-text)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            marginBottom: 'var(--space-4)',
          }}>
            Stop managing agents. Start{' '}
            <span style={{
              background: 'var(--gradient-text-hero)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>orchestrating</span> them.
          </h2>
          <p style={{
            fontSize: '1.0625rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.7,
            marginBottom: 'var(--space-8)',
          }}>
            Maestro is open source and runs entirely on your machine. Set up in minutes, coordinate dozens of agents, and keep everything local.
          </p>
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <a href="#get-started" className="btn-primary">Get Started</a>
            <a
              href="https://github.com/anthropics/maestro"
              className="btn-text"
              target="_blank"
              rel="noopener noreferrer"
            >
              Star on GitHub <span className="btn-arrow">{'\u2192'}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Bottom section divider */}
      <div className="section-divider" />
    </>
  )
}
