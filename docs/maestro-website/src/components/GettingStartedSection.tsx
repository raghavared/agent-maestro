import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const steps = [
  {
    number: 1,
    title: 'Install',
    code: 'git clone https://github.com/anthropics/agent-maestro.git\ncd agent-maestro\nnpm install',
    description: 'Clone the repo and install dependencies.',
  },
  {
    number: 2,
    title: 'Start',
    code: 'npm run dev:all',
    description: 'Launches the desktop app and server together. You\u2019re running.',
  },
  {
    number: 3,
    title: 'CLI Setup',
    code: 'cd maestro-cli\nnpm run build && npm link\nmaestro --help',
    description: 'Now maestro is available globally from any terminal.',
  },
]

const workflowLines = [
  { type: 'comment', text: '# Step 1 \u2014 Create tasks' },
  { type: 'command', text: '$ maestro task create --title "Build authentication system"' },
  { type: 'success', text: '\u2713 Task created: task_001' },
  { type: 'command', text: '$ maestro task create --title "JWT endpoint" --parent task_001' },
  { type: 'success', text: '\u2713 Task created: task_002' },
  { type: 'command', text: '$ maestro task create --title "Login form" --parent task_001' },
  { type: 'success', text: '\u2713 Task created: task_003' },
  { type: 'blank', text: '' },
  { type: 'comment', text: '# Step 2 \u2014 Spawn agents' },
  { type: 'command', text: '$ maestro session spawn --task task_002 --role worker' },
  { type: 'active', text: '\u25CF Session spawned: sess_jwt (working on JWT endpoint)' },
  { type: 'command', text: '$ maestro session spawn --task task_003 --role worker' },
  { type: 'active', text: '\u25CF Session spawned: sess_login (working on Login form)' },
  { type: 'blank', text: '' },
  { type: 'comment', text: '# Step 3 \u2014 Watch them work' },
  { type: 'command', text: '$ maestro session list' },
  { type: 'default', text: 'ID          Task             Status     Progress' },
  { type: 'default', text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500' },
  { type: 'active', text: 'sess_jwt    JWT endpoint     active     Implementing token validation...' },
  { type: 'active', text: 'sess_login  Login form       active     Building form components...' },
]

function getLineColor(type: string): string {
  switch (type) {
    case 'comment': return 'var(--color-text-muted)'
    case 'command': return '#E8E9ED'
    case 'success': return '#38BFA7'
    case 'active': return '#5B6CF0'
    case 'warning': return '#E8A44A'
    default: return 'var(--color-text-secondary)'
  }
}

export default function GettingStartedSection() {
  return (
    <Section
      id="get-started"
      eyebrow="GET STARTED"
      title="Up and running in three steps"
      align="center"
      paddingTop="80px"
      paddingBottom="80px"
    >
      {/* Step cards */}
      <div className="getting-started-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        marginBottom: 'var(--space-16)',
        position: 'relative',
      }}>
        {steps.map((step, index) => (
          <div key={step.title} className="card reveal" style={{
            '--stagger-index': index,
            padding: '28px',
            position: 'relative',
          } as React.CSSProperties}>
            {/* Large watermark number */}
            <span style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              fontFamily: 'var(--font-display)',
              fontSize: '3rem',
              fontWeight: 700,
              color: 'var(--color-accent-primary)',
              opacity: 0.15,
              lineHeight: 1,
              pointerEvents: 'none',
            }} aria-hidden="true">
              {step.number}
            </span>

            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 'var(--space-4)',
              position: 'relative',
              zIndex: 1,
            }}>
              {step.title}
            </h4>
            <div className="code-block" style={{ marginBottom: 'var(--space-4)', background: 'var(--color-bg-deep)' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <code>{step.code}</code>
              </pre>
            </div>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              position: 'relative',
              zIndex: 1,
            }}>
              {step.description}
            </p>
          </div>
        ))}

        {/* Dashed connector lines between cards */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 'calc(33.33% + 10px)',
          width: 'calc(33.33% - 20px)',
          borderTop: '1px dashed rgba(91, 108, 240, 0.2)',
          pointerEvents: 'none',
        }} aria-hidden="true" />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 'calc(66.66% + 10px)',
          width: 'calc(33.33% - 20px)',
          borderTop: '1px dashed rgba(91, 108, 240, 0.2)',
          pointerEvents: 'none',
        }} aria-hidden="true" />
      </div>

      {/* First workflow */}
      <div>
        <h3 className="reveal" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 'var(--space-8)',
          textAlign: 'center',
        }}>
          Your first multi-agent workflow
        </h3>

        <div className="reveal-scale" style={{ maxWidth: 680, margin: '0 auto var(--space-8)' }}>
          <div className="code-terminal terminal-tilt-gs">
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

            <div style={{ padding: 'var(--space-5)' }}>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.875rem', lineHeight: 1.65 }}>
                <code>
                  {workflowLines.map((line, i) => (
                    <span key={i} style={{ color: getLineColor(line.type), display: 'block' }}>
                      {line.type === 'blank' ? '\u00A0' : line.text}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>

        <div className="reveal" style={{ maxWidth: 680, margin: '0 auto' }}>
          <MediaPlaceholder id="MP-14" description="Complete first workflow" width={680} height={383} />
        </div>
      </div>

      <style>{`
        .terminal-tilt-gs {
          transform: perspective(1200px) rotateX(2deg);
          transition: transform var(--duration-slow) var(--ease-out);
        }
        .terminal-tilt-gs:hover {
          transform: perspective(1200px) rotateX(0deg);
        }
        @media (max-width: 768px) {
          .getting-started-grid {
            grid-template-columns: 1fr !important;
          }
          .getting-started-grid > div[style*="position: absolute"] {
            display: none !important;
          }
          .terminal-tilt-gs {
            transform: none;
          }
          .terminal-tilt-gs:hover {
            transform: none;
          }
        }
        @media (max-width: 640px) {
          .getting-started-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Section>
  )
}
