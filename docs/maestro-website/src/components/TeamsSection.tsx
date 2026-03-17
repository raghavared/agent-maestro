import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const features = [
  {
    title: 'Preconfigured roles',
    description: 'Ship with built-in defaults (Simple Worker, Coordinator, Batch Coordinator, DAG Coordinator, Recruiter) ready to use out of the box.',
  },
  {
    title: 'Custom specialists',
    description: 'Create agents tailored to your workflow: API owner, test engineer, release coordinator. Set model, tools, permissions, and identity per member.',
  },
  {
    title: 'Persistent memory',
    description: 'Team members accumulate project-specific knowledge across sessions. Heuristics, preferences, and lessons learned survive session boundaries.',
  },
  {
    title: 'Capability boundaries',
    description: 'Fine-grained permissions control what each agent can do: spawn sessions, edit tasks, access commands. Powerful agents with clear guardrails.',
  },
  {
    title: 'Team topology',
    description: 'Organize members under leaders, nest sub-teams, and reuse the same structure across many tasks instead of re-defining instructions per session.',
  },
]

const teamMembers = [
  { emoji: '\uD83C\uDFAF', name: 'Coordinator', role: 'Leader' },
  { emoji: '\u26A1', name: 'API Worker', role: 'Worker' },
  { emoji: '\uD83E\uDDEA', name: 'Test Engineer', role: 'Worker' },
  { emoji: '\uD83C\uDFA8', name: 'Frontend Dev', role: 'Worker' },
]

export default function TeamsSection() {
  return (
    <Section
      id="teams"
      eyebrow="TEAMS"
      title="Reusable agents. Predictable results."
      description="Define agent identities once and reuse them across sessions. Team members carry their role, permissions, model preferences, and memory — so you get consistent behavior without re-prompting every time."
      align="left"
      paddingTop="48px"
      paddingBottom="96px"
    >
      <div className="teams-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-12)',
        alignItems: 'start',
      }}>
        {/* Visual: Team hierarchy card — offset 32px lower */}
        <div className="reveal-left" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: '32px' }}>
          <div style={{
            background: 'var(--color-surface-1)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 'var(--space-4)',
            }}>
              Team: auth-feature
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {teamMembers.map((member, i) => (
                <div
                  key={member.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: i === 0 ? 'var(--color-accent-muted)' : 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: i === 0 ? '1px solid rgba(91, 108, 240, 0.15)' : '1px solid rgba(255, 255, 255, 0.05)',
                    marginLeft: i === 0 ? 0 : 24,
                    position: 'relative',
                  }}
                >
                  {i > 0 && (
                    <span style={{
                      position: 'absolute',
                      left: -16,
                      top: '50%',
                      width: 12,
                      height: 1,
                      background: 'var(--color-border)',
                    }} aria-hidden="true" />
                  )}
                  <span style={{ fontSize: '16px' }} aria-hidden="true">{member.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      display: 'block',
                    }}>{member.name}</span>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <MediaPlaceholder id="MP-10" description="Team member management" width={420} height={560} />
        </div>

        {/* Numbered feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="reveal"
              style={{
                '--stagger-index': index,
                display: 'flex',
                gap: 'var(--space-4)',
                alignItems: 'flex-start',
              } as React.CSSProperties}
            >
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-accent-primary)',
                opacity: 0.6,
                lineHeight: 1,
                flexShrink: 0,
                width: 28,
                textAlign: 'right',
              }}>
                {index + 1}
              </span>
              <div>
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
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .teams-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Section>
  )
}
