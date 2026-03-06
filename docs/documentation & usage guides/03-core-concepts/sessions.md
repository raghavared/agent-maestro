# Sessions

**A session is a Claude instance working on one or more tasks. It's the executing agent — the thing that actually does the work.**

---

## What is a Session?

When you spawn a session, Maestro starts a new Claude process in its own terminal, gives it context about what to do (via a manifest), and lets it run. Each session is isolated — it has its own PTY, its own task assignments, and its own timeline of events.

```bash
maestro session spawn --task <task-id>
```

That command creates a session, generates a manifest, and launches Claude with full Maestro context. The session knows its tasks, its project directory, and how to report progress back.

## Why Sessions Matter

Sessions are how work gets done. A task is just a description; a session is the Claude that reads it and writes the code. Without sessions, tasks sit there forever.

Sessions also give you **visibility**. Every session records a timeline of events — when it started, what progress it reported, when it got blocked, when it finished. You can watch sessions in real time, inspect their logs, and intervene when needed.

## The Session Lifecycle

```
spawning → working → completed
                  ↘ failed
                  ↘ stopped
```

| Status | Meaning |
|--------|---------|
| `spawning` | Session created, manifest being generated, Claude starting up. |
| `idle` | Session is alive but not actively processing. |
| `working` | Claude is actively executing tasks. |
| `completed` | All assigned tasks finished successfully. |
| `failed` | Session encountered an unrecoverable error. |
| `stopped` | Session was manually terminated. |

## Session Data Model

```typescript
interface Session {
  id: string;
  projectId: string;
  taskIds: string[];                    // Assigned tasks
  name: string;
  status: SessionStatus;
  env: Record<string, string>;          // Environment variables
  events: SessionEvent[];               // Legacy event log
  timeline: SessionTimelineEvent[];     // Chronological event history
  docs: DocEntry[];                     // Attached documents
  needsInput?: {                        // Human input request
    active: boolean;
    message?: string;
  };
  teamMemberId?: string;               // Assigned team member profile
  teamMemberSnapshot?: TeamMemberSnapshot;
  parentSessionId?: string | null;      // Coordinator that spawned this
  rootSessionId?: string | null;        // Top-level ancestor session
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
}
```

Sessions are stored at `~/.maestro/data/sessions/<session-id>.json`.

## How Sessions Start: The Spawn Flow

When you spawn a session, here's what happens under the hood:

1. **API call.** The UI or CLI calls `POST /api/sessions/spawn`.
2. **Session record created.** Server creates a session with status `spawning`.
3. **Manifest generated.** Server runs `maestro manifest generate` to create the session's configuration file.
4. **Manifest written.** Saved to `~/.maestro/sessions/<session-id>/manifest.json`.
5. **WebSocket event.** Server emits `session:created` so the UI knows.
6. **PTY spawned.** The UI creates a pseudo-terminal and launches Claude.
7. **Claude starts.** The CLI runs `maestro worker init` (or `orchestrator init`), reads the manifest, and injects the Maestro system prompt.
8. **Work begins.** Claude reads its tasks and starts executing.

## The Three Environment Variables

Every session gets three critical environment variables that connect it to the Maestro system:

| Variable | Purpose | Example |
|----------|---------|---------|
| `MAESTRO_SESSION_ID` | Identifies this session | `sess_abc123` |
| `MAESTRO_MANIFEST_PATH` | Path to the manifest JSON | `~/.maestro/sessions/sess_abc123/manifest.json` |
| `MAESTRO_API_URL` | Server endpoint for API calls | `http://localhost:3000` |

Additional environment variables:

| Variable | Purpose |
|----------|---------|
| `MAESTRO_PROJECT_ID` | Current project ID |
| `MAESTRO_TASK_IDS` | Comma-separated list of assigned task IDs |
| `MAESTRO_ROLE` | `worker` or `orchestrator` |

These are how Claude knows who it is, what it's supposed to do, and where to report back. Without them, a Claude session would be just a generic terminal.

## The `needsInput` Flag

Sometimes Claude gets stuck and needs a human decision. When that happens, the session sets the `needsInput` flag:

```bash
maestro session needs-input --message "Should I use PostgreSQL or SQLite for the database?"
```

This does two things:
1. Sets `needsInput.active = true` on the session record
2. Broadcasts a WebSocket event so the UI can show a notification

The human responds (via the UI or CLI), and the session resumes:

```bash
maestro session resume-working
```

**Why this matters:** It's the mechanism for human-in-the-loop workflows. Claude doesn't guess — it asks.

## Session Timeline

Every session records a chronological timeline of events. Each event has a type, message, and timestamp:

```typescript
interface SessionTimelineEvent {
  type: 'progress' | 'blocked' | 'error' | 'complete' | 'info';
  message: string;
  timestamp: number;
  taskId?: string;    // Which task this relates to
}
```

From inside a session, Claude reports to the timeline:

```bash
# Report progress
maestro session report progress "Finished implementing the API routes"

# Report a blocker
maestro session report blocked "Need database credentials"

# Report an error
maestro session report error "Build failed — missing dependency"

# Report completion
maestro session report complete "All tasks done"
```

The timeline is visible in the Maestro UI, giving you a real-time feed of what each session is doing.

## Working with Sessions

### Spawn a session

```bash
# Basic — one task, worker mode
maestro session spawn --task <task-id>

# Multiple tasks
maestro session spawn --tasks <task-id-1>,<task-id-2>

# With specific mode
maestro session spawn --task <task-id> --mode coordinator

# With a team member profile
maestro session spawn --task <task-id> --team-member-id <member-id>

# With specific model and skills
maestro session spawn --task <task-id> --model opus --skill my-custom-skill

# With a specific agent tool
maestro session spawn --task <task-id> --agent-tool codex

# With custom permission mode
maestro session spawn --task <task-id> --permission-mode bypassPermissions
```

### List sessions

```bash
# All sessions in the current project
maestro session list

# Filter by status
maestro session list --status working

# Filter by task
maestro session list --task <task-id>
```

### View session info

```bash
maestro session info <session-id>
```

### Watch sessions in real time

```bash
# Watch one or more sessions until they complete
maestro session watch <session-id-1> <session-id-2> --timeout 3600
```

### View session logs

```bash
# View logs
maestro session logs <session-id>

# Follow logs in real time
maestro session logs <session-id> --follow

# Tail the last N lines
maestro session logs <session-id> --tail 50
```

### Communicate between sessions

```bash
# Send a message to another session
maestro session prompt <target-session-id> --message "Can you also add input validation?"
```

### See sibling sessions

```bash
# If you're inside a coordinated session, see your peers
maestro session siblings
```

## Sessions and Coordinators

When a coordinator spawns worker sessions, the parent-child relationship is tracked:

- The worker's `parentSessionId` points to the coordinator
- The worker's `rootSessionId` points to the top-level session in the chain
- The coordinator can monitor its children via `session list` or `session watch`

This creates a tree of sessions — a coordinator at the top, workers underneath, and optionally sub-coordinators managing their own workers.

> **Next:** [Workers vs Orchestrators](./workers-vs-orchestrators.md) — The two fundamental roles.
