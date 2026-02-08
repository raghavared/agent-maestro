# Session Status Flows

## Overview

Session status represents the **lifecycle state** of an agent session (is it running or not). Separate from agent work status (what the agent is doing on each task).

---

## Status Values

| Status | Description |
|--------|-------------|
| `spawning` | Session is being created |
| `active` | Session is running |
| `stopped` | Terminated gracefully |
| `failed` | Crashed or errored |

---

## State Machine

```
spawning → active → stopped
              ↓
           failed → (restart) → spawning
```

| From | To | Trigger |
|------|-----|---------|
| - | `spawning` | User spawns session |
| `spawning` | `active` | Agent started successfully |
| `spawning` | `failed` | Agent failed to start |
| `active` | `stopped` | User stops or agent exits |
| `active` | `failed` | Crash or error |
| `failed` | `spawning` | User restarts |
| `stopped` | `spawning` | User restarts |

---

## Relationship with Task

Session status is independent of task's `sessionProgress`:

| Session Status | sessionProgress | Meaning |
|----------------|-----------------|---------|
| `spawning` | `working` | Agent starting up |
| `active` | `working` | Normal operation |
| `active` | `blocked` | Agent running but blocked |
| `failed` | any | Session crashed, progress stale |
| `stopped` | `completed` | Work done, session closed |

When session fails/stops, the `sessionProgress` entry remains on the task (historical record).

---

## API

```typescript
// Stop session
POST /api/sessions/:sessionId/stop

// Restart session
POST /api/sessions/:sessionId/restart

// WebSocket events
'session:spawn'    // { session, taskIds, spawnSource }
'session:active'   // { sessionId }
'session:stopped'  // { sessionId }
'session:failed'   // { sessionId, error }
```
