import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const taskTree = [
  { label: 'Build authentication system', status: 'in-progress' as const, depth: 0 },
  { label: 'JWT endpoint', status: 'completed' as const, depth: 1 },
  { label: 'Token validation middleware', status: 'completed' as const, depth: 2 },
  { label: 'Refresh token flow', status: 'completed' as const, depth: 2 },
  { label: 'Login form', status: 'in-progress' as const, depth: 1 },
  { label: 'Form validation', status: 'completed' as const, depth: 2 },
  { label: 'Error handling', status: 'in-progress' as const, depth: 2 },
  { label: 'OAuth integration', status: 'pending' as const, depth: 1 },
  { label: 'Google provider', status: 'pending' as const, depth: 2 },
  { label: 'GitHub provider', status: 'pending' as const, depth: 2 },
]

const statusConfig = {
  'completed': { icon: '\u2713', color: 'var(--color-success)' },
  'in-progress': { icon: '\u25CF', color: 'var(--color-accent-primary)' },
  'pending': { icon: '\u25CB', color: 'var(--color-text-muted)' },
}

const featuresRow1 = [
  {
    title: 'Hierarchical task trees',
    description: 'Parent/child relationships for decomposing complex objectives into independently executable subtasks.',
  },
  {
    title: 'Many-to-many linking',
    description: 'Multiple sessions can work the same task; one session can work multiple tasks. Parallel attempts, retries, and comparisons built in.',
  },
]

const featuresRow2 = [
  {
    title: 'Full lifecycle tracking',
    description: 'todo \u2192 in_progress \u2192 in_review \u2192 completed, with blocked and cancelled states. Timestamps on every transition.',
  },
  {
    title: 'Automatic session sync',
    description: 'Task-session links update bidirectionally. Progress reported by agents flows back to the task board in real-time.',
  },
  {
    title: 'Project isolation',
    description: 'Each project is a self-contained workspace with its own tasks, sessions, and team structure. No cross-contamination.',
  },
]

export default function TasksSection() {
  return (
    <Section
      id="tasks"
      eyebrow="TASKS"
      title="Plan once, execute everywhere"
      description="Tasks are the unit of work in Maestro. Organize them into hierarchies, link them to sessions, and track status from backlog to completion. Projects keep everything scoped and isolated."
      align="center"
      paddingTop="96px"
      paddingBottom="80px"
    >
      {/* Zone 1: Task tree visualization */}
      <div className="reveal-scale" style={{ maxWidth: 480, margin: '0 auto var(--space-12)' }}>
        <div style={{
          background: 'var(--color-bg-deep)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-6)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
        }}>
          {taskTree.map((task, i) => {
            const config = statusConfig[task.status]
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '6px 0',
                  paddingLeft: task.depth * 24,
                  position: 'relative',
                }}
              >
                {task.depth > 0 && (
                  <span style={{
                    position: 'absolute',
                    left: (task.depth - 1) * 24 + 8,
                    top: 0,
                    bottom: '50%',
                    borderLeft: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)',
                    width: 12,
                    height: '100%',
                    pointerEvents: 'none',
                  }} aria-hidden="true" />
                )}
                <span className={task.status === 'in-progress' ? 'status-in-progress' : ''} style={{
                  color: config.color,
                  fontSize: task.status === 'completed' ? '12px' : '10px',
                  fontWeight: 700,
                  width: 16,
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {config.icon}
                </span>
                <span style={{
                  color: task.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  opacity: task.status === 'completed' ? 0.7 : 1,
                }}>
                  {task.label}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <MediaPlaceholder id="MP-08" description="Task board kanban view" width={420} height={560} />
        </div>
      </div>

      {/* Zone 2: Feature grid — 2 row + 3 row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="tasks-features-row-1">
          {featuresRow1.map((feature, index) => (
            <div
              key={feature.title}
              className="card reveal"
              style={{
                '--stagger-index': index,
                padding: 'var(--space-5)',
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
        <div className="tasks-features-row-2">
          {featuresRow2.map((feature, index) => (
            <div
              key={feature.title}
              className="card reveal"
              style={{
                '--stagger-index': index + 2,
                padding: 'var(--space-5)',
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
      </div>

      <style>{`
        .tasks-features-row-1 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .tasks-features-row-2 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 768px) {
          .tasks-features-row-1,
          .tasks-features-row-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Section>
  )
}
