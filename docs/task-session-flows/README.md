# Task and Session Status Flows

## Overview

Architecture for managing task and session statuses in a multi-agent system.

---

## Key Design Decisions

### Two Separate Status Types

| Type | Values | Controlled By | Updated Via |
|------|--------|---------------|-------------|
| **Task Status** | `todo`, `inprogress`, `completed`, `cancelled` | User | UI only |
| **Session Status** | `queued`, `working`, `needs_input`, `blocked`, `completed`, `failed`, `cancelled` | Session | CLI only |

### Task Status (User, UI)

```
todo → inprogress → completed
          ↓
       cancelled
```

### Session Status (CLI)

```
queued → working → completed
            ↓
    blocked / needs_input / failed

Any → cancelled
```

---

## Data Model

```typescript
// Task status (user-controlled, UI only)
type TaskStatus = 'todo' | 'inprogress' | 'completed' | 'cancelled';

// Session status on task (CLI only)
type SessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'cancelled';

interface SessionProgress {
  sessionId: string;
  status: SessionStatus;
  lastUpdated: string;
  notes?: string;
}

interface Task {
  status: TaskStatus;
  sessionProgress: SessionProgress[];
  // ... other fields
}
```

---

## CLI Commands

```bash
# Queue tasks for this session (sets status to 'queued')
maestro task queue <taskId> [taskId2]...

# Update session status on task
maestro task update <taskId> --status working
maestro task update <taskId> --status blocked --notes "Need API key"
maestro task update <taskId> --status completed

# Must run from session context, otherwise:
# Error: "No session found."
```

---

## Summary Table

| Layer | Field | Values | Owner |
|-------|-------|--------|-------|
| **Task** | `status` | todo, inprogress, completed, cancelled | User (UI) |
| **Task** | `sessionProgress[].status` | queued, working, needs_input, blocked, completed, failed, cancelled | Session (CLI) |
| **Session** | `status` | spawning, active, stopped, failed | System |

---

## Documentation

| Doc | Content |
|-----|---------|
| [01-STATUS-ARCHITECTURE.md](./01-STATUS-ARCHITECTURE.md) | Data model, update rules, API |
| [02-TASK-STATUS-FLOWS.md](./02-TASK-STATUS-FLOWS.md) | Task status transitions (UI) |
| [03-SESSION-STATUS-FLOWS.md](./03-SESSION-STATUS-FLOWS.md) | Session lifecycle |
| [04-AGENT-WORK-FLOWS.md](./04-AGENT-WORK-FLOWS.md) | Session status on task (CLI) |
| [05-SYNC-STRATEGIES.md](./05-SYNC-STRATEGIES.md) | WebSocket sync |
| [06-UI-IMPLEMENTATION.md](./06-UI-IMPLEMENTATION.md) | UI components |
| [07-DATA-MODEL-CHANGES.md](./07-DATA-MODEL-CHANGES.md) | Migration |

---

## Quick Start

1. Change `Task.status` to: `todo | inprogress | completed | cancelled`
2. Add `Task.sessionProgress[]` with per-session status
3. Remove `Task.agentStatus` (deprecated)
4. Add CLI command `task queue`
5. Modify CLI `task update --status` to update session status
6. Add WebSocket event `task:session_status`
