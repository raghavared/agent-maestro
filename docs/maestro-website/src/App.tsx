import { type CSSProperties } from 'react'
import './App.css'

type Feature = {
  id: string
  title: string
  summary: string
  bullets: string[]
}

type Section = {
  id: string
  title: string
  intro: string
  bullets: string[]
  callouts?: string[]
}

const navSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'pillars', label: 'Core Pillars' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'teams', label: 'Teams' },
  { id: 'terminal', label: 'Terminal & Logs' },
  { id: 'cta', label: 'Get Started' },
]

const pillars: Feature[] = [
  {
    id: 'ui',
    title: 'UI Features',
    summary:
      'The UI keeps execution centered on live terminals while keeping tasks, teams, and status visible.',
    bullets: [
      'Project tabs keep workspace context explicit and fast to switch.',
      'Sessions panel controls active terminals with ordering, details, and log access.',
      'Central terminal workspace is the primary action surface for real-time execution.',
      'Right-side Maestro panel manages tasks, lists, teams, and orchestration controls.',
      'Board overlay supports cross-project visibility and grouped views.',
    ],
  },
  {
    id: 'backend',
    title: 'Backend Features',
    summary:
      'A write-safe system of record with real-time updates to UI and CLI clients.',
    bullets: [
      'Predictable CRUD for projects, tasks, sessions, team members, ordering, and mail.',
      'Session lifecycle from spawning to working to completed/failed with timeline events.',
      'Event bus + WebSocket bridge pushes live updates for tasks and sessions.',
      'Local JSON persistence keeps data transparent and easy to inspect or recover.',
      'Reliability patterns include retries, validation gates, and best-effort updates.',
    ],
  },
  {
    id: 'cli',
    title: 'CLI Features',
    summary:
      'Scriptable control over tasks, sessions, teams, and manifests for automation-heavy workflows.',
    bullets: [
      '`maestro task` and `maestro session` manage task trees, status, logs, and mail.',
      '`maestro team` and `maestro team-member` manage roles, membership, and memory.',
      '`maestro report` keeps progress, blocked, and completion status in sync.',
      'Manifest-driven spawn flow makes context explicit and reproducible.',
      'Hooks enable lifecycle automation at startup and shutdown boundaries.',
    ],
  },
  {
    id: 'coordination',
    title: 'Coordination and Multi-Agent',
    summary:
      'Coordinator and worker modes parallelize execution without losing visibility.',
    bullets: [
      'Coordinators plan, assign tasks, monitor progress, and resolve blockers.',
      'Workers execute assigned tasks and publish artifacts with task docs.',
      'Session spawning passes role-specific context, task scope, and directives.',
      'Progress, blocked, and completion reports keep real-time visibility.',
      'Prompt is for immediate direction; mail is durable async handoff.',
    ],
  },
]

const splitPanels: Section[] = [
  {
    id: 'tasks',
    title: 'Tasks and Project Hierarchy',
    intro:
      'A project-centered hierarchy keeps planning and execution connected, even across parallel sessions.',
    bullets: [
      'Projects are top-level workspaces; tasks can be nested via parent/child links.',
      'Tasks and sessions are many-to-many with explicit linking and sync.',
      'Task status is user-owned while session status tracks execution state.',
      'Parent deletion cascades through descendants for clean hierarchy maintenance.',
      'Sessions can run multiple tasks, and tasks can be executed by multiple sessions.',
    ],
    callouts: [
      'Hierarchy: Project -> Task tree -> Session graph (many-to-many task links).',
    ],
  },
  {
    id: 'teams',
    title: 'Teams and Team Members',
    intro:
      'Teams provide reusable agent identities and leadership structure for consistent coordination.',
    bullets: [
      'Team members define role, mode, model/tool, permissions, and memory.',
      'Teams group members under a leader to drive coordinated execution.',
      'Default members are available immediately and can be customized or reset.',
      'Capability and command-permission controls keep execution safe and scoped.',
      'Teams can be nested with sub-teams for larger org structures.',
    ],
    callouts: [
      'Spawn workers with a team member ID so sessions inherit role defaults.',
    ],
  },
]

const terminalSection: Section = {
  id: 'terminal',
  title: 'Terminal, Logs, and Permissions',
  intro:
    'Terminal sessions are real PTY-backed shells with persistence, logs, and capability controls.',
  bullets: [
    'PTY terminals support interactive tools, ANSI output, and long-running commands.',
    'Persistent sessions survive UI reconnects with preserved context.',
    'Transcript viewer captures input/output timelines for audits and handoffs.',
    'Needs-input state pauses execution until a human response is provided.',
    'Command permissions and launch rights enforce safe, predictable boundaries.',
  ],
  callouts: [
    'Together: real execution, durable context, traceable logs, and guarded permissions.',
  ],
}

function App() {
  const delayStyle = (index: number): CSSProperties => ({ ['--delay' as never]: `${index * 0.08}s` })

  return (
    <div className="page">
      <div className="background-glow" aria-hidden="true" />

      <header className="hero reveal" id="overview" style={delayStyle(0)}>
        <div className="hero-content">
          <p className="eyebrow reveal" style={delayStyle(1)}>
            Maestro
          </p>
          <h1 className="reveal" style={delayStyle(2)}>
            One control plane for agent execution
          </h1>
          <p className="lede reveal" style={delayStyle(3)}>
            Maestro is a public platform for orchestrating work across tasks, sessions, and teams. It
            blends a real terminal, a structured task system, and multi-agent coordination so you can
            plan, execute, and track outcomes without losing context.
          </p>
          <div className="hero-actions reveal" style={delayStyle(4)}>
            <button className="primary">Explore Capabilities</button>
            <button className="secondary">See Workflow</button>
          </div>
          <div className="hero-meta reveal" style={delayStyle(5)}>
            <span>UI + CLI parity</span>
            <span>Session-first execution</span>
            <span>Team-driven orchestration</span>
          </div>
        </div>
      </header>

      <nav className="section-nav reveal" aria-label="Feature sections" style={delayStyle(6)}>
        {navSections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.label}
          </a>
        ))}
      </nav>

      <main className="content">
        <section className="pillars" id="pillars">
          <header className="section-heading reveal" style={delayStyle(7)}>
            <h2>Core Pillars</h2>
            <p>
              A marketing-ready snapshot of how Maestro connects UI, backend, CLI, and coordination
              into one operational fabric.
            </p>
          </header>
          <div className="pillar-grid">
            {pillars.map((pillar, index) => (
              <article
                key={pillar.id}
                className="pillar-card reveal"
                id={pillar.id}
                style={delayStyle(index)}
              >
                <h3>{pillar.title}</h3>
                <p>{pillar.summary}</p>
                <ul>
                  {pillar.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="split-panels" id="coordination">
          <header className="section-heading reveal" style={delayStyle(1)}>
            <h2>Coordination Built In</h2>
            <p>
              Coordinators and workers operate on shared context, keeping visibility and ownership
              intact across parallel sessions.
            </p>
          </header>
          <div className="panel">
            <div className="panel-block reveal" style={delayStyle(2)}>
              <h3>Coordinator vs Worker Modes</h3>
              <ul>
                <li>Coordinators plan, assign tasks, and resolve blockers.</li>
                <li>Workers execute assigned tasks and publish artifacts with task docs.</li>
                <li>Session spawning passes role context, task scope, and directives.</li>
                <li>Prompt is for immediate direction; mail is durable async handoff.</li>
              </ul>
            </div>
            <div className="panel-block reveal" style={delayStyle(3)}>
              <h3>Monitoring and Control</h3>
              <ul>
                <li>Progress, blocked, and completion reports keep visibility current.</li>
                <li>Session lifecycle captures spawning, working, completed, and failed.</li>
                <li>Batching and DAG workflows enable parallel execution at scale.</li>
                <li>Artifacts and logs provide traceability for handoffs and audits.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="split-panels" aria-label="Tasks and teams">
          <div className="panel">
            {splitPanels.map((section, index) => (
              <article
                key={section.id}
                id={section.id}
                className="panel-card reveal"
                style={delayStyle(index + 1)}
              >
                <h3>{section.title}</h3>
                <p>{section.intro}</p>
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {section.callouts && (
                  <div className="panel-callout">
                    {section.callouts.map((callout) => (
                      <p key={callout}>{callout}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="feature reveal" id={terminalSection.id} style={delayStyle(2)}>
          <header className="feature-header">
            <h2>{terminalSection.title}</h2>
            <p>{terminalSection.intro}</p>
          </header>
          <ul className="feature-list">
            {terminalSection.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          {terminalSection.callouts && (
            <div className="feature-callouts">
              {terminalSection.callouts.map((callout) => (
                <p key={callout}>{callout}</p>
              ))}
            </div>
          )}
        </section>
      </main>

      <section className="cta reveal" id="cta" style={delayStyle(3)}>
        <div className="cta-inner">
          <h2>Move from plan to execution without losing context</h2>
          <p>
            Maestro keeps your tasks, sessions, and teams aligned so every run is tracked, auditable,
            and ready for handoff.
          </p>
          <div className="hero-actions">
            <button className="primary">Request a Demo</button>
            <button className="secondary">Read the Docs</button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <h3>Operational clarity, end to end</h3>
          <p>
            Maestro connects planning, execution, and reporting through a consistent task/session
            model, live terminal workflows, and team-based coordination.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
