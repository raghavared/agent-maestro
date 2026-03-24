import Section from './Section'
import MediaPlaceholder from './MediaPlaceholder'

const panel1Bullets = [
  <><strong>Coordinators</strong> plan work, create subtasks, spawn workers, and resolve blockers</>,
  <><strong>Workers</strong> execute tasks directly — writing code, running tests, producing artifacts</>,
  <>Coordinators spawn workers with role-specific context: task IDs, constraints, acceptance criteria</>,
  <>Workers report progress in real-time: progress updates, completion summaries, blocker alerts</>,
  <>Planning stays centralized. Execution runs in parallel.</>,
]

const panel2Bullets = [
  <>Real-time progress tracking across all active sessions</>,
  <><code className="code-inline">blocked</code> and <code className="code-inline">needs-input</code> states surface problems immediately</>,
  <>Attached docs and artifacts maintain a clear audit trail</>,
  <>Session prompt for live direction; session mail for async handoffs</>,
  <>DAG orchestration and batch parallelism for structured multi-task workflows</>,
]

export default function CoordinationSection() {
  return (
    <Section
      id="coordination"
      eyebrow="COORDINATION"
      title="Multi-agent orchestration, not multi-agent chaos"
      description="Running multiple AI agents is easy. Keeping them coordinated is hard. Maestro gives you a control plane for planning, execution, and tracking — so agents work in parallel without stepping on each other."
      align="left"
      paddingTop="48px"
      paddingBottom="80px"
      className="dot-grid-bg"
    >
      {/* Panel 1: Two roles, one workflow — 55% text / 45% visual */}
      <div className="coordination-panel" style={{
        display: 'grid',
        gridTemplateColumns: '55fr 45fr',
        gap: '40px',
        marginBottom: '64px',
        alignItems: 'center',
      }}>
        <div className="reveal-left">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-6)',
            color: 'var(--color-text)',
          }}>
            Two roles, one workflow
          </h3>
          <ul style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.6,
          }}>
            {panel1Bullets.map((bullet, i) => (
              <li key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <span style={{
                  color: 'var(--color-accent-primary)',
                  flexShrink: 0,
                  marginTop: 2,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                }}>{'\u203A'}</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal-right">
          <MediaPlaceholder id="MP-06" description="Coordinator spawning workers" width={480} height={480} />
        </div>
      </div>

      {/* Panel 2: Full visibility — 45% visual / 55% text (zigzag) */}
      <div className="coordination-panel" style={{
        display: 'grid',
        gridTemplateColumns: '45fr 55fr',
        gap: '40px',
        alignItems: 'center',
      }}>
        <div className="reveal-left">
          <MediaPlaceholder id="MP-07" description="Real-time monitoring view" width={520} height={390} />
        </div>
        <div className="reveal-right">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-6)',
            color: 'var(--color-text)',
          }}>
            Full visibility, zero interruptions
          </h3>
          <ul style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.6,
          }}>
            {panel2Bullets.map((bullet, i) => (
              <li key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <span style={{
                  color: 'var(--color-accent-primary)',
                  flexShrink: 0,
                  marginTop: 2,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                }}>{'\u203A'}</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .coordination-panel {
            grid-template-columns: 1fr !important;
            gap: var(--space-8) !important;
          }
        }
      `}</style>
    </Section>
  )
}
