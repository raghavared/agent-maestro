# Feature Overview

Everything Maestro offers, at a glance.

---

## Work Organization

Structure your work before any agent touches it.

| Feature | What It Does |
|---------|-------------|
| **Tasks** | Create tasks with titles, descriptions, and priorities. |
| **Subtasks** | Break tasks into smaller pieces. Nest as deep as you need. |
| **Priorities** | Mark tasks as low, medium, or high priority. |
| **Dependencies** | Define which tasks must finish before others can start. |
| **Task Lists** | Group and order tasks into custom lists. |
| **Statuses** | Track tasks through todo, in progress, in review, completed, blocked, cancelled, and archived. |
| **Task Trees** | Visualize your entire task hierarchy with `maestro task tree`. |

> **Deep dive:** [Work Organization Guide](../03-features/work-organization.md)

---

## Agent Management

Control who does what and how.

| Feature | What It Does |
|---------|-------------|
| **Session Spawning** | Launch Claude sessions with one command or one click. |
| **Worker Mode** | Sessions that execute tasks directly. Heads-down. |
| **Coordinator Mode** | Sessions that break down work, spawn workers, and monitor progress. |
| **Team Members** | Define reusable agent profiles with roles, identities, and tools. |
| **Teams** | Organize team members into groups with leaders and sub-teams. |
| **Agent Tool Selection** | Choose between Claude Code, Codex, or Gemini per session. |
| **Permission Modes** | Set sessions to accept edits, interactive, read-only, or bypass permissions. |
| **Skills** | Attach skill plugins to give agents specialized capabilities. |

> **Deep dive:** [Agent Management Guide](../03-features/agent-management.md)

---

## Real-Time Coordination

See everything as it happens.

| Feature | What It Does |
|---------|-------------|
| **Live Progress** | Agents report progress as they work. Updates appear instantly. |
| **Session Timelines** | Every session has a timeline of events and status changes. |
| **WebSocket Sync** | All changes push to every connected client in real time. |
| **Inter-Session Messaging** | Sessions can message each other with `maestro session prompt`. |
| **Blocker Reporting** | Stuck agents surface blockers immediately. |
| **Session Watching** | Monitor multiple sessions with `maestro session watch`. |
| **Log Streaming** | Tail session logs live with `maestro session logs --follow`. |

> **Deep dive:** [Real-Time Coordination Guide](../03-features/real-time-coordination.md)

---

## Desktop App

A full visual workspace built with Tauri and React.

| Feature | What It Does |
|---------|-------------|
| **Session Terminals** | Embedded terminals for every running session. |
| **File Explorer** | Browse project files without leaving the app. |
| **Code Editor** | View and edit code in context. |
| **Kanban Boards** | Drag-and-drop task management. |
| **Task Views** | See tasks as lists, trees, or boards. |
| **Real-Time Dashboard** | Live overview of all sessions and tasks. |

> **Deep dive:** [Desktop App Guide](../04-desktop-app/overview.md)

---

## CLI

Do everything from the terminal. 47+ commands. Full `--json` output.

| Category | Commands | What They Cover |
|----------|----------|----------------|
| **Project** | 6 commands | Create, list, delete, set master projects. |
| **Task** | 13+ commands | Full task lifecycle — create, edit, complete, block, delete, tree view. |
| **Session** | 16+ commands | Spawn, watch, prompt, log, report status. |
| **Team** | 12 commands | Create teams, add members, manage sub-teams. |
| **Team Member** | 11 commands | Create profiles, set roles, manage memory. |
| **Task List** | 4 commands | Create and reorder task lists. |
| **Skill** | 5 commands | List, install, browse, and validate skills. |
| **Master** | 4 commands | Cross-project views for tasks, sessions, and context. |

Every command supports `--json` for scripting and automation.

> **Deep dive:** [CLI Reference](../05-cli/reference.md)

---

## At A Glance

```
Maestro
├── Organize    → Tasks, subtasks, priorities, dependencies
├── Assign      → Spawn sessions, pick agent tools, set roles
├── Coordinate  → Real-time sync, messaging, blocker alerts
├── Visualize   → Desktop app with terminals, kanban, dashboards
└── Automate    → CLI with 47+ commands, JSON output, scriptable
```

> **Next:** [How It Works](./how-it-works.md) — The architecture in 30 seconds.
