import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const pillars = [
  {
    title: 'Desktop App',
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 17h6M10 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    description: 'A full workspace with terminals, task boards, and real-time session monitoring. See what every agent is doing at a glance. Jump between sessions without losing context. Built with Tauri for native performance on macOS, Linux, and Windows.',
    mediaId: 'MP-02',
    mediaDesc: 'Desktop app workspace',
    mediaWidth: 560,
    mediaHeight: 350,
    large: true,
  },
  {
    title: 'Server & API',
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="12" width="14" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="5" r="1" fill="currentColor" />
        <circle cx="6" cy="15" r="1" fill="currentColor" />
        <path d="M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    description: 'The coordination backbone. Express + WebSocket server that manages tasks, sessions, and projects. Real-time event streaming keeps every client in sync. All data stored as plain JSON files on disk — no database required.',
    mediaId: 'MP-03',
    mediaDesc: 'Session timeline view',
    mediaWidth: 560,
    mediaHeight: 350,
    large: false,
  },
  {
    title: 'CLI',
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 8l3 2.5L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    description: 'Full control from the terminal. Create tasks, spawn sessions, report progress, manage queues. Every command supports --json for scripting. Built for power users and CI/CD automation.',
    mediaId: 'MP-04',
    mediaDesc: 'Terminal CLI output',
    mediaWidth: 480,
    mediaHeight: 360,
    large: false,
  },
  {
    title: 'Coordination',
    icon: (
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="4" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5V10M10 10L5 13.5M10 10l5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    description: 'The layer that makes multi-agent work actually work. Coordinators plan and delegate. Workers execute and report back. DAG workflows, batch parallelism, and inter-session messaging keep complex projects moving without manual bookkeeping.',
    mediaId: 'MP-05',
    mediaDesc: 'Multi-session parallel view',
    mediaWidth: 560,
    mediaHeight: 350,
    large: true,
  },
]

export default function PillarsSection() {
  return (
    <Section
      id="pillars"
      eyebrow="PLATFORM"
      title="Built for how you actually work"
      description="Maestro is a desktop app, a CLI, a server, and a coordination engine — designed to work together. Pick the interface that fits your workflow. Everything stays in sync."
      align="left"
      paddingTop="80px"
      paddingBottom="96px"
    >
      <div className="pillars-bento">
        {pillars.map((pillar, index) => (
          <div
            key={pillar.title}
            className="card reveal"
            style={{
              '--stagger-index': index,
              padding: pillar.large ? 'var(--space-8)' : 'var(--space-6)',
            } as React.CSSProperties}
          >
            <div style={{
              color: 'var(--color-accent-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              {pillar.icon}
            </div>
            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 600,
              marginBottom: 'var(--space-2)',
              color: 'var(--color-text)',
            }}>{pillar.title}</h4>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              marginBottom: pillar.large ? 'var(--space-5)' : 0,
            }}>{pillar.description}</p>
            {pillar.large && (
              <MediaPlaceholder
                id={pillar.mediaId}
                description={pillar.mediaDesc}
                width={pillar.mediaWidth}
                height={pillar.mediaHeight}
              />
            )}
          </div>
        ))}
      </div>

      {/* Section divider */}
      <div className="section-divider" style={{ marginTop: 'var(--space-24)' }} />

      <style>{`
        .pillars-bento {
          display: grid;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: auto auto;
          gap: 16px;
        }
        .pillars-bento > :nth-child(1) { grid-column: 1; grid-row: 1; }
        .pillars-bento > :nth-child(2) { grid-column: 2; grid-row: 1; }
        .pillars-bento > :nth-child(3) { grid-column: 1; grid-row: 2; }
        .pillars-bento > :nth-child(4) { grid-column: 2; grid-row: 2; }
        @media (max-width: 768px) {
          .pillars-bento {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }
          .pillars-bento > * {
            grid-column: 1 !important;
            grid-row: auto !important;
          }
        }
      `}</style>
    </Section>
  )
}
