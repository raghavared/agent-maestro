# I built a desktop app to coordinate multiple Claude Code sessions — tasks, agents, orchestration, all in one UI [Project]

Hey r/ClaudeAI!

I've been using Claude Code heavily across multiple projects and kept running into the same problem: 5+ Claude sessions in separate terminals, no visibility into what any of them were doing, copy-pasting context between windows. So I built something to fix it.

**Maestro** is an open source (AGPL-3.0) desktop app + CLI + server for running and coordinating multiple Claude Code agents from a single workspace. It's free — no paid tiers, no accounts, runs entirely on your machine.

**GitHub:** https://github.com/subhangR/agent-maestro

---

## Built with Claude, for Claude

Most of Maestro was built *using* Claude Code itself. The irony isn't lost on me — I used Claude to build a tool for managing Claude. In practice, building Maestro was one of the best stress tests for the tool because I was constantly running into the exact coordination problems it's designed to solve. Claude helped write the server, UI components, CLI commands, and the orchestration logic. I'd estimate 80%+ of the codebase was written by Claude sessions coordinated through Maestro itself (dogfooding from day one).

---

## What It Does

Maestro gives you **one UI** where you can see and manage everything:

- **Create and organize tasks** — hierarchies, subtasks, priorities, dependencies, kanban boards
- **Spawn Claude Code sessions** and assign them tasks — each agent gets a manifest with exactly what to work on
- **Watch everything in real time** — every session reports progress, blockers, and completions live via WebSocket
- **Coordinate agents** — orchestrators break down work, spawn workers, monitor their logs, and verify results
- **Define team members** — reusable agent profiles with custom roles, identities, models, and skills

---

## How the Coordination Architecture Works

This is the part I'm most interested in getting feedback on. Maestro has two agent modes:

**Workers** execute tasks directly — write code, run tests, fix bugs.

**Coordinators** plan and delegate. A coordinator Claude will:
1. Analyze your high-level task
2. Break it into subtasks
3. Spawn worker sessions for each subtask
4. Watch worker logs and send messages when dependencies are met
5. Verify everything works when all workers finish

### How session spawning works under the hood

1. **Server creates a session** and generates a manifest (JSON with task details, role, skills, strategy)
2. **CLI reads the manifest** and builds Claude Code process arguments — system prompt, environment variables, skill plugins
3. **Claude Code launches** in a tmux terminal with full context about its assignment
4. **Agent reports back** via CLI (`maestro task report progress/complete/blocked`)
5. **Everything syncs** via WebSocket — UI, CLI, and all other sessions see updates instantly

Coordinators can watch workers in real time:
```bash
maestro session logs --my-workers           # See worker output
maestro session watch sess_w1,sess_w2       # Watch specific sessions
maestro session prompt sess_w2 --message "Schema ready, start building endpoints"
```

Workers can discover and message each other:
```bash
maestro session siblings                    # See peer sessions
maestro session prompt <sibling> --message "Need the auth middleware you built"
```

---

## Key Features

### Unified UI
- Embedded terminals for every running session
- Kanban board with drag-and-drop task management
- Session timelines showing events, status changes, progress
- Multi-project support — manage different codebases from one app
- Command palette with keyboard shortcuts

### Task Management
- Subtask hierarchies (nest as deep as you need)
- Dependencies, priorities, task lists
- Full status lifecycle: todo -> in progress -> in review -> completed / blocked
- `maestro task tree` for a visual hierarchy

### Team Members
- Reusable agent profiles with custom names, avatars, roles, system prompts
- Model per agent (Haiku / Sonnet / Opus)
- Agent tool choice (Claude Code, Codex, or Gemini)
- Persistent memory — agents remember context across sessions
- Sound instruments per member (piano, guitar, violin, etc.) — you hear an ensemble when multiple agents work

### Session Coordination
- Workers execute, coordinators delegate
- Orchestration strategies: default, intelligent-batching, DAG-based
- Inter-session messaging — agents talk to each other
- Live log streaming and session watching

### CLI (47+ Commands)
```bash
maestro whoami                    # What am I working on?
maestro task report progress <id> "Finished login route"
maestro task report blocked <id>  "Need database credentials"
maestro task report complete <id> "Auth system done"
maestro session spawn --task <id> # Spawn a new Claude on a task
maestro task tree                 # Full task hierarchy
maestro session watch <ids>       # Monitor sessions live
```

Every command supports `--json` for scripting.

---

## Tech Stack

- **Desktop app**: Tauri + React, xterm.js terminals, Monaco editor
- **Server**: Express + WebSocket, JSON files on disk (`~/.maestro/data/`) — no database
- **CLI**: Node.js, 47+ commands
- **Sessions**: tmux-backed, persist through app restarts

---

## Getting Started (Free, Local, Open Source)

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh
```

The install script handles dependencies (bun, Node.js, Rust), builds everything, and installs the app to /Applications. All data stays on your machine as plain JSON files.

For development:
```bash
bun install
bun run dev:all    # Server + desktop app with hot reload
```

---

## Example: Coordinated API Build

```bash
# Create tasks
maestro task create "Build blog post API" --priority high
maestro task create "Set up database schema" --parent <id>
maestro task create "Build GET endpoints" --parent <id>
maestro task create "Build mutation endpoints" --parent <id>
maestro task create "Write integration tests" --parent <id>

# Option A: Spawn workers yourself on each subtask
maestro session spawn --task <schema-id>
maestro session spawn --task <get-id>

# Option B: Let a coordinator handle everything
maestro session spawn --task <parent-id> --skill maestro-orchestrator
# Coordinator decomposes, spawns workers, monitors, verifies
```

---

## What I'd Love Feedback On

- The coordination architecture — is the worker/coordinator split intuitive?
- Session spawning UX — what would make spinning up agents easier?
- What workflows would you use this for?
- Missing features you'd want to see?

This is actively being developed. Contributions and ideas are welcome.

**GitHub:** https://github.com/subhangR/agent-maestro
