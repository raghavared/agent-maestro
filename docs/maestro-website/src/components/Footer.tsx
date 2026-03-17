const linkGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Desktop App', href: '#pillars' },
      { label: 'CLI', href: '#pillars' },
      { label: 'Server & API', href: '#pillars' },
      { label: 'Documentation', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Getting Started', href: '#get-started' },
      { label: 'Architecture Guide', href: '#' },
      { label: 'GitHub Repository', href: 'https://github.com/anthropics/maestro' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub Discussions', href: '#' },
      { label: 'Contributing Guide', href: '#' },
      { label: 'License (AGPL-3.0)', href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      style={{
        background: 'var(--color-bg-deep)',
        padding: '64px max(24px, 5vw) 32px',
        borderTop: '1px solid var(--color-divider)',
      }}
    >
      <div className="footer-grid" style={{
        maxWidth: 'var(--content-max-width)',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1.5fr repeat(3, 1fr)',
        gap: '40px',
      }}>
        {/* Brand column */}
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <span aria-hidden="true" style={{ color: 'var(--color-accent-primary)' }}>{'\u25C6'}</span> Maestro
          </div>
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            maxWidth: 260,
          }}>
            Open-source multi-agent orchestration.
          </p>
        </div>

        {/* Link group columns */}
        {linkGroups.map((group) => (
          <div key={group.title}>
            <h4 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 'var(--space-4)',
            }}>
              {group.title}
            </h4>
            <ul style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}>
              {group.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-muted)',
                      transition: 'color var(--duration-fast) var(--ease-smooth)',
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--color-text-secondary)' }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--color-text-muted)' }}
                    {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        maxWidth: 'var(--content-max-width)',
        margin: 'var(--space-12) auto 0',
        paddingTop: 'var(--space-6)',
        borderTop: '1px solid var(--color-divider)',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
        }}>
          {'\u00A9'} {new Date().getFullYear()} Maestro. Open source under AGPL-3.0.
        </p>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  )
}
