# Maestro Website — Content Specification

> Tone: Professional but approachable. Developer-focused. Concise. Every word earns its place.
> Think Vercel/Linear marketing copy — clean, sharp, zero fluff.

---

## 1. Hero Section

**Main Headline** (max 8 words):
> Orchestrate AI agents. Ship faster.

**Subheadline** (1-2 sentences):
> Maestro coordinates multiple Claude sessions across your projects — break work into tasks, spawn agents in parallel, and track everything from one place.

**Meta Tags** (3 short badges):
1. `Open Source`
2. `Multi-Agent`
3. `Local-First`

**Primary CTA:**
> Get Started

**Secondary CTA:**
> View on GitHub

---

## 2. Navigation Labels

Sticky nav section names (clean, scannable):

| Nav Item        | Anchors To                 |
| --------------- | -------------------------- |
| Overview        | Hero / intro               |
| Pillars         | Core Pillars section       |
| Coordination    | Coordination Deep-Dive     |
| Tasks           | Tasks & Projects           |
| Teams           | Teams section              |
| Terminal        | Terminal & Logs            |
| Get Started     | Getting Started / CTA      |

---

## 3. Core Pillars Section

**Section Heading:**
> Built for how you actually work

**Section Intro:**
> Maestro is a desktop app, a CLI, a server, and a coordination engine — designed to work together. Pick the interface that fits your workflow. Everything stays in sync.

### Pillar Cards

**Card 1 — Desktop App**
- **Title:** Desktop App
- **Icon suggestion:** monitor/window
- **Description:** A full workspace with terminals, task boards, and real-time session monitoring. See what every agent is doing at a glance. Jump between sessions without losing context. Built with Tauri for native performance on macOS, Linux, and Windows.

**Card 2 — Server**
- **Title:** Server & API
- **Icon suggestion:** server/database
- **Description:** The coordination backbone. Express + WebSocket server that manages tasks, sessions, and projects. Real-time event streaming keeps every client in sync. All data stored as plain JSON files on disk — no database required.

**Card 3 — CLI**
- **Title:** CLI
- **Icon suggestion:** terminal/command-line
- **Description:** Full control from the terminal. Create tasks, spawn sessions, report progress, manage queues. Every command supports `--json` for scripting. Built for power users and CI/CD automation.

**Card 4 — Coordination Engine**
- **Title:** Coordination
- **Icon suggestion:** network/nodes
- **Description:** The layer that makes multi-agent work actually work. Coordinators plan and delegate. Workers execute and report back. DAG workflows, batch parallelism, and inter-session messaging keep complex projects moving without manual bookkeeping.

---

## 4. Coordination Deep-Dive Section

**Section Heading:**
> Multi-agent orchestration, not multi-agent chaos

**Section Intro:**
> Running multiple AI agents is easy. Keeping them coordinated is hard. Maestro gives you a control plane for planning, execution, and tracking — so agents work in parallel without stepping on each other.

### Panel 1 — Coordinator & Worker Modes

**Panel Title:** Two roles, one workflow

**Bullet Points:**
- **Coordinators** plan work, create subtasks, spawn workers, and resolve blockers
- **Workers** execute tasks directly — writing code, running tests, producing artifacts
- Coordinators spawn workers with role-specific context: task IDs, constraints, acceptance criteria
- Workers report progress in real-time: progress updates, completion summaries, blocker alerts
- Planning stays centralized. Execution runs in parallel.

### Panel 2 — Monitoring & Control

**Panel Title:** Full visibility, zero interruptions

**Bullet Points:**
- Real-time progress tracking across all active sessions
- `blocked` and `needs-input` states surface problems immediately
- Attached docs and artifacts maintain a clear audit trail
- Session prompt for live direction; session mail for async handoffs
- DAG orchestration and batch parallelism for structured multi-task workflows

---

## 5. Tasks & Projects Section

**Section Heading:**
> Plan once, execute everywhere

**Section Description:**
> Tasks are the unit of work in Maestro. Organize them into hierarchies, link them to sessions, and track status from backlog to completion. Projects keep everything scoped and isolated.

**Key Points (5 bullets):**
1. **Hierarchical task trees** — parent/child relationships for decomposing complex objectives into independently executable subtasks
2. **Many-to-many linking** — multiple sessions can work the same task; one session can work multiple tasks. Parallel attempts, retries, and comparisons built in.
3. **Full lifecycle tracking** — `todo` → `in_progress` → `in_review` → `completed`, with `blocked` and `cancelled` states. Timestamps on every transition.
4. **Automatic session sync** — task-session links update bidirectionally. Progress reported by agents flows back to the task board in real-time.
5. **Project isolation** — each project is a self-contained workspace with its own tasks, sessions, and team structure. No cross-contamination.

---

## 6. Teams Section

**Section Heading:**
> Reusable agents. Predictable results.

**Section Description:**
> Define agent identities once and reuse them across sessions. Team members carry their role, permissions, model preferences, and memory — so you get consistent behavior without re-prompting every time.

**Key Points (5 bullets):**
1. **Preconfigured roles** — ship with built-in defaults (Simple Worker, Coordinator, Batch Coordinator, DAG Coordinator, Recruiter) ready to use out of the box
2. **Custom specialists** — create agents tailored to your workflow: API owner, test engineer, release coordinator. Set model, tools, permissions, and identity per member.
3. **Persistent memory** — team members accumulate project-specific knowledge across sessions. Heuristics, preferences, and lessons learned survive session boundaries.
4. **Capability boundaries** — fine-grained permissions control what each agent can do: spawn sessions, edit tasks, access commands. Powerful agents with clear guardrails.
5. **Team topology** — organize members under leaders, nest sub-teams, and reuse the same structure across many tasks instead of re-defining instructions per session.

---

## 7. Terminal & Logs Section

**Section Heading:**
> Real terminals. Full transparency.

**Section Description:**
> Every session runs in a real PTY-backed shell — not a simulated console. Commands behave exactly as they would in your native terminal. Session output is captured, logged, and available for replay.

**Key Points (4 bullets):**
1. **Persistent sessions** — leave and come back without losing state. Context, command history, and active work survive UI transitions and reconnects.
2. **Session transcripts** — full input/output timeline captured as an execution log. Faster debugging, cleaner handoffs, auditable records.
3. **Human checkpoints** — `needs-input` states pause execution safely when human judgment is required. Automation keeps moving; you decide when to intervene.
4. **Command permissions** — capability-based controls govern what agents can execute. Sensitive operations require explicit authorization.

**Callout:**
> Agents get real shells. You get full logs. Everyone stays accountable.

---

## 8. CTA Section

**Closing Headline:**
> Stop managing agents. Start orchestrating them.

**Supporting Text:**
> Maestro is open source and runs entirely on your machine. Set up in minutes, coordinate dozens of agents, and keep everything local.

**Button 1 (Primary):**
> Get Started

**Button 2 (Secondary):**
> Star on GitHub

---

## 9. Footer

**Footer Tagline:**
> Maestro — Multi-agent orchestration for developers.

**Footer Description:**
> Open-source task orchestration for AI coding agents. Desktop app, CLI, and server — all in one.

### Link Groups

**Product**
- Desktop App
- CLI
- Server & API
- Documentation

**Resources**
- Getting Started
- Architecture Guide
- GitHub Repository
- Changelog

**Community**
- GitHub Discussions
- Contributing Guide
- License (AGPL-3.0)

---

## 10. Getting Started Content

**Section Heading:**
> Up and running in three steps

### Quick-Start Steps

**Step 1 — Install**
```bash
git clone https://github.com/anthropics/agent-maestro.git
cd agent-maestro
npm install
```

**Step 2 — Start**
```bash
npm run dev:all
```
> This launches the desktop app and server together. You're running.

**Step 3 — Set up the CLI**
```bash
cd maestro-cli
npm run build && npm link
maestro --help
```
> Now `maestro` is available globally from any terminal.

### First Workflow Example

**Heading:** Your first multi-agent workflow

**Step 1 — Create tasks**
```bash
maestro task create --title "Build authentication system"
maestro task create --title "JWT endpoint" --parent <parent-id>
maestro task create --title "Login form" --parent <parent-id>
```

**Step 2 — Spawn agents**
```bash
maestro session spawn --task <jwt-task-id> --role worker
maestro session spawn --task <login-task-id> --role worker
```

**Step 3 — Watch them work**
```bash
maestro session list    # See all active sessions
maestro status          # Project overview
```

> Both agents work in parallel. Progress appears in the desktop app in real-time. Tasks update automatically as agents report completion.

---

## Content Notes for Implementation

### Tone Guidelines
- Lead with verbs and outcomes, not features
- Avoid: "leverage", "empower", "seamless", "revolutionary", "cutting-edge"
- Prefer: "run", "track", "spawn", "coordinate", "ship"
- Short sentences. Active voice. No filler.
- Technical accuracy matters — developers will verify claims

### Content Hierarchy
- Hero: hook and orient (5 seconds)
- Pillars: establish scope (what Maestro is)
- Coordination: the differentiator (why Maestro exists)
- Tasks/Teams/Terminal: depth for evaluators (how it works)
- CTA: convert interest into action
- Getting Started: remove friction from first use

### Copy Length Targets
- Headlines: 3-8 words
- Descriptions: 2-4 sentences max
- Bullet points: 1-2 sentences each
- Section intros: 1-2 sentences
