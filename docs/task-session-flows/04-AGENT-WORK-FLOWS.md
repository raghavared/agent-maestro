# Session Status Flows (on Task)

## Overview

Session status tracks **what a session is doing on a specific task**. Stored in `task.sessionProgress[]`. Updated via CLI only.

---

## Status Values

| Status | Description |
|--------|-------------|
| `queued` | Task in session's queue, not started |
| `working` | Session actively working |
| `needs_input` | Session needs human input |
| `blocked` | Session blocked on something |
| `completed` | Session finished work |
| `failed` | Session failed |
| `cancelled` | Work was cancelled |

---

## State Machine

```
queued → working → completed
            ↓
    blocked / needs_input / failed

Any state → cancelled
```

| From | To | Trigger |
|------|-----|---------|
| - | `queued` | `task queue <taskId>` |
| `queued` | `working` | `task update --status working` |
| `working` | `completed` | `task update --status completed` |
| `working` | `blocked` | `task update --status blocked --notes "..."` |
| `working` | `needs_input` | `task update --status needs_input --notes "..."` |
| `working` | `failed` | `task update --status failed` |
| `blocked` | `working` | `task update --status working` |
| `needs_input` | `working` | `task update --status working` |
| `failed` | `working` | `task update --status working` (retry) |
| any | `cancelled` | `task update --status cancelled` |

---

## Data Structure

```typescript
type SessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'cancelled';

interface SessionProgress {
  sessionId: string;
  status: SessionStatus;
  lastUpdated: string;
  notes?: string;  // Reason for blocked/needs_input/failed/cancelled
}

// Embedded in Task
interface Task {
  sessionProgress: SessionProgress[];
}
```

---

## CLI Commands

```bash
# Queue tasks (sets status to 'queued')
maestro task queue <taskId> [taskId2]...

# Update status (must be run from session context)
maestro task update <taskId> --status working
maestro task update <taskId> --status blocked --notes "Need API credentials"
maestro task update <taskId> --status needs_input --notes "Choose A or B?"
maestro task update <taskId> --status completed

# If no session context:
# Error: "No session found. This command must be run from a session."
```

---

## Blocked vs Needs Input

| | `blocked` | `needs_input` |
|-|-----------|---------------|
| What | External resource/dependency | Human decision needed |
| Example | "Need API key" | "Use approach A or B?" |
| Resolution | Provide resource | Make choice |
| UI | Warning banner | Interactive prompt |

---

## Deriving Aggregate Status

For UI display:

```typescript
function getAggregateStatus(task: Task): string {
  const statuses = task.sessionProgress.map(p => p.status);

  if (statuses.length === 0) return 'no_sessions';
  if (statuses.includes('needs_input')) return 'needs_input';
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('working')) return 'working';
  if (statuses.includes('queued')) return 'queued';
  if (statuses.every(s => s === 'completed')) return 'all_completed';
  if (statuses.every(s => s === 'failed')) return 'all_failed';

  return 'working';
}
```

---

## API

```typescript
// Queue task for session
POST /api/tasks/:taskId/queue
{ "sessionId": "session-123" }

// Update session status on task
PUT /api/tasks/:taskId/sessions/:sessionId/status
{
  "status": "blocked",
  "notes": "Need database credentials"
}

// WebSocket event
{
  "type": "task:session_status",
  "payload": {
    "taskId": "task-1",
    "sessionId": "session-1",
    "status": "blocked",
    "notes": "Need API key"
  }
}
```

---

## Multi-Session Example

```
Task: "Build feature"
├── Session-1: working
├── Session-2: blocked (needs API key)
└── Session-3: completed

Aggregate: blocked (urgent states surface first)
```
