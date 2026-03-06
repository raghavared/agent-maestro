# Session Management

**Spawn agent sessions, monitor their progress, and manage them all from one place.**

---

## Spawning a Session

There are several ways to start a new agent session from the UI:

### From a Task Card

The most common flow. On any task card with status `todo` or `blocked`, click the **`$ work on`** button. This opens the spawn configuration.

[screenshot placeholder: Task card with the "$ work on" button highlighted]

### From the Split Play Button

Each task card also has a **split play button** (▶ ▾). The left half starts the session immediately with the default or assigned team member. The right half opens a dropdown where you can:

- Pick a specific **team member** to assign the task to
- Create a new team member on the fly

[screenshot placeholder: Split play button dropdown showing available team members with their roles and models]

### From the Session Section

In the left sidebar's sessions section, click **+ New Session** to open a fresh terminal. This creates a bare terminal without a Maestro task assignment — useful for manual work.

### From Agent Shortcuts

Click **Agent Shortcuts** in the sidebar to launch pre-configured workflows (like "start coordinator for all tasks" or "quick bug fix").

---

## Session Spawn Configuration

When spawning from a task, you can configure:

| Option | Description |
|--------|-------------|
| **Team member** | Which agent profile to use (defines model, permissions, identity) |
| **Agent tool** | Claude Code, OpenAI Codex, or Google Gemini |
| **Model** | Which model to use (e.g., Haiku, Sonnet, Opus for Claude) |
| **Mode** | Worker, Coordinator, Coordinated Worker, or Coordinated Coordinator |
| **Strategy** | Execution strategy (simple, tree-based, batching, DAG) |
| **Skills** | Which skill plugins to attach to the session |
| **Permission mode** | How the agent handles tool permissions (safe vs bypass) |

The spawn flow:
1. UI sends spawn request to the Maestro server
2. Server creates a session record and generates a manifest
3. Server emits a WebSocket event
4. UI receives the event and creates a PTY (pseudo-terminal)
5. The agent tool starts with the full Maestro context

---

## Session List

All sessions for the current project appear in the **Sessions** section of the left sidebar.

[screenshot placeholder: Sessions list in sidebar showing multiple sessions with status indicators]

Each session entry shows:
- **Session name** — Auto-generated or custom name
- **Status indicator** — Color-coded dot showing current state
- **Active highlight** — The currently selected session is highlighted

Click a session to switch the main content area to its terminal.

### Session Statuses

| Status | Visual | Meaning |
|--------|--------|---------|
| Spawning | Pulsing dot | Session is being set up |
| Idle | Dim dot | Agent is waiting for input |
| Working | Green dot | Agent is actively running |
| Completed | Checkmark | Agent finished its task |
| Failed | Red dot | Agent encountered a fatal error |
| Stopped | Gray dot | Session was manually stopped |
| Needs Input | Orange pulse | Agent is waiting for user response |

When a session has **needs input** active, the project tab also pulses to draw your attention.

---

## Session Detail Modal

Click the info icon on a session (or access it from the task's Sessions tab) to open the full session detail modal.

[screenshot placeholder: Session detail modal showing info grid, linked tasks, and timeline]

### Header
- Session name
- Status badge (Spawning, Idle, Working, Completed, Failed, Stopped)
- Strategy badge (shows execution strategy if applicable)
- Model badge (e.g., SONNET, OPUS)
- Mode badge (e.g., WORKER, COORDINATOR)

### Info Section
| Field | Description |
|-------|-------------|
| Started | When the session was created |
| Last Activity | Time since the most recent event |
| Completed | When the session finished (if applicable) |
| Needs Input | Message about what the agent needs (if waiting) |
| Agent | The agent tool identifier |
| Hostname | Machine the session is running on |
| Platform | Operating system |
| Spawn Source | How the session was spawned (UI, CLI, coordinator) |
| Spawned By | Parent session ID if spawned by a coordinator |

### Linked Tasks
Shows all tasks assigned to this session with their current status symbols:
- `○` Todo
- `◉` In Progress
- `✓` Completed
- `⊘` Blocked
- `✕` Cancelled

### Documents
Any docs the session has generated or been given as reference.

### Timeline
A scrolling chronological log of all session events:
- Progress reports from the agent
- Task status changes
- Error messages
- Completion summaries

The timeline auto-scrolls to the bottom as new events arrive. Scroll up to browse history — auto-scroll pauses until you scroll back to the bottom.

Press **Escape** or click outside to close the modal.

---

## Multi-Project Sessions View

Access this from the multi-project board. It shows sessions across all open projects in a single view, so you can monitor everything without switching project tabs.

---

## Session Log Viewer

For deeper inspection, the session log viewer shows the full conversation between the system and the agent:

[screenshot placeholder: Session log viewer showing tool calls, code blocks, and thinking blocks]

- **Text blocks** — Agent's text output
- **Thinking blocks** — Agent's reasoning (when available)
- **Tool call cards** — Expandable cards showing each tool invocation and its result
- **Code block viewer** — Syntax-highlighted code with copy button
- **Diff viewer** — File changes shown as unified diffs
- **Subagent cards** — When the agent spawns sub-agents, shown as nested cards
- **Teammate message cards** — Messages exchanged between coordinated agents
- **Token usage badges** — Shows token consumption per message

---

## Managing Sessions

### Close a Session
Click the **×** button on a session in the sidebar list, or close it from the terminal.

### Reorder Sessions
Drag sessions in the sidebar to reorder them. Or open **Manage Terminals** from the session section header for arrow-button reordering.

### Jump to Session
From the task detail modal's Sessions tab, click a session to jump directly to its terminal in the main content area.

> **Next:** [Terminal Sessions](./terminal-sessions.md) — Persistent terminals, tmux, and SSH.
