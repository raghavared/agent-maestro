import { useEffect, useRef, useCallback } from 'react'
import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const terminalLines = [
  { type: 'comment' as const, text: '# Create a parent task' },
  { type: 'command' as const, text: '$ maestro task create --title "Build authentication system"' },
  { type: 'success' as const, text: '\u2713 Task created: task_a1b2c3' },
  { type: 'empty' as const, text: '' },
  { type: 'comment' as const, text: '# Spawn workers for subtasks' },
  { type: 'command' as const, text: '$ maestro session spawn --task task_jwt --role worker' },
  { type: 'success' as const, text: '\u2713 Session spawned: sess_x7y8z9 (JWT endpoint)' },
  { type: 'command' as const, text: '$ maestro session spawn --task task_login --role worker' },
  { type: 'success' as const, text: '\u2713 Session spawned: sess_m4n5o6 (Login form)' },
  { type: 'empty' as const, text: '' },
  { type: 'comment' as const, text: '# Check status' },
  { type: 'command' as const, text: '$ maestro status' },
  { type: 'accent' as const, text: '  Active sessions: 2' },
  { type: 'success' as const, text: '  Tasks completed: 3/8' },
  { type: 'warning' as const, text: '  Blocked: 1 (awaiting review)' },
]

const lineColors: Record<string, string> = {
  comment: 'var(--color-text-muted)',
  command: '#E8E9ED',
  success: '#38BFA7',
  accent: '#5B6CF0',
  warning: '#E8A44A',
  empty: 'transparent',
}

const features = [
  {
    title: 'Persistent sessions',
    description: 'Leave and come back without losing state. Context, command history, and active work survive UI transitions and reconnects.',
  },
  {
    title: 'Session transcripts',
    description: 'Full input/output timeline captured as an execution log. Faster debugging, cleaner handoffs, auditable records.',
  },
  {
    title: 'Human checkpoints',
    description: 'needs-input states pause execution safely when human judgment is required. Automation keeps moving; you decide when to intervene.',
  },
  {
    title: 'Command permissions',
    description: 'Capability-based controls govern what agents can execute. Sensitive operations require explicit authorization.',
  },
]

export default function TerminalSection() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const typedRef = useRef(false)

  const typeTerminalLines = useCallback((container: HTMLElement) => {
    const lines = container.querySelectorAll('.terminal-line')
    lines.forEach((line, i) => {
      setTimeout(() => {
        line.classList.add('typed')
      }, i * 120)
    })
  }, [])

  useEffect(() => {
    if (!terminalRef.current || typedRef.current) return
    const el = terminalRef.current

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !typedRef.current) {
            typedRef.current = true
            typeTerminalLines(el)
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [typeTerminalLines])

  return (
    <Section
      id="terminal"
      eyebrow="TERMINAL"
      title="Real terminals. Full transparency."
      description="Every session runs in a real PTY-backed shell — not a simulated console. Commands behave exactly as they would in your native terminal. Session output is captured, logged, and available for replay."
      align="center"
      paddingTop="96px"
      paddingBottom="64px"
    >
      {/* Zone 1: Terminal mockup with perspective tilt */}
      <div className="reveal-scale" style={{
        maxWidth: 680,
        margin: '0 auto var(--space-12)',
      }}>
        <div
          ref={terminalRef}
          className="code-terminal terminal-tilt"
        >
          {/* Terminal chrome */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '12px var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57', boxShadow: '0 0 4px rgba(255, 95, 87, 0.4)' }} aria-hidden="true" />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E', boxShadow: '0 0 4px rgba(254, 188, 46, 0.4)' }} aria-hidden="true" />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840', boxShadow: '0 0 4px rgba(40, 200, 64, 0.4)' }} aria-hidden="true" />
            <span style={{
              marginLeft: 'var(--space-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
            }}>Terminal</span>
          </div>

          {/* Terminal content */}
          <div style={{
            padding: 'var(--space-5)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            lineHeight: 1.65,
          }}>
            {terminalLines.map((line, i) => (
              <div key={i} className="terminal-line" style={{
                color: lineColors[line.type],
                minHeight: line.type === 'empty' ? '1em' : undefined,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {line.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <MediaPlaceholder id="MP-12" description="Live terminal session" width={680} height={383} />
        </div>
      </div>

      {/* Zone 2: Feature grid — 2x2 */}
      <div className="terminal-feature-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: 'var(--space-12)',
      }}>
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className="card reveal"
            style={{
              '--stagger-index': index,
              padding: 'var(--space-6)',
            } as React.CSSProperties}
          >
            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 'var(--space-2)',
            }}>
              {feature.title}
            </h4>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Zone 3: Callout banner — left-aligned with dot-grid */}
      <div className="reveal" style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px 32px',
        borderLeft: '3px solid var(--color-accent-primary)',
        textAlign: 'left',
        backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        <p style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 500,
          color: 'var(--color-text)',
          margin: 0,
        }}>
          Agents get real shells. You get full logs. Everyone stays accountable.
        </p>
      </div>

      {/* Section divider */}
      <div className="section-divider" style={{ marginTop: 'var(--space-16)' }} />

      <style>{`
        .terminal-tilt {
          transform: perspective(1200px) rotateX(2deg);
          transition: transform var(--duration-slow) var(--ease-out);
        }
        .terminal-tilt:hover {
          transform: perspective(1200px) rotateX(0deg);
        }
        @media (max-width: 768px) {
          .terminal-feature-grid { grid-template-columns: 1fr !important; }
          .terminal-tilt {
            transform: none;
          }
          .terminal-tilt:hover {
            transform: none;
          }
        }
      `}</style>
    </Section>
  )
}
