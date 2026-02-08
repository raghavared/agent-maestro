# Task and Session Status Architecture

## Overview

Architecture for a multi-agent task management system where:
- Users control task status (todo, inprogress, completed, cancelled) via **UI only**
- Sessions control their work status on tasks via **CLI only**
- Each session's status is tracked per task via `sessionProgress` array
- Sessions can work on multiple tasks (many-to-many)

---

## Core Entities

### Task
A unit of work. Contains embedded `sessionProgress` to track each session's status.

### Session
An agent execution context. References tasks via `taskIds`.

---

## Status Types

### 1. Task Status (User-Controlled, UI Only)

Simple 4-state model:

```
┌────────┐     ┌─────────────┐     ┌───────────┐
│  todo  │────▶│ inprogress  │────▶│ completed │
└────────┘     └─────────────┘     └───────────┘
    │               │
    └───────────────┴──────▶ cancelled
```

| Status | Description |
|--------|-------------|
| `todo` | Task created, not started |
| `inprogress` | Work is happening |
| `completed` | Task is finished |
| `cancelled` | Task was cancelled |

---

### 2. Session Lifecycle Status

```
spawning → active → stopped
              ↓
           failed
```

| Status | Description |
|--------|-------------|
| `spawning` | Session is being created |
| `active` | Session is running |
| `stopped` | Terminated gracefully |
| `failed` | Crashed or errored |

---

### 3. Session Status on Task (CLI Only)

Tracked in `task.sessionProgress[]` for each session working on the task:

```
queued → working → completed
            ↓
    blocked / needs_input / failed

Any state → cancelled
```

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

## Data Model

```typescript
// Task status (user-controlled, UI only)
type TaskStatus = 'todo' | 'inprogress' | 'completed' | 'cancelled';

// Session lifecycle
type SessionLifecycleStatus = 'spawning' | 'active' | 'stopped' | 'failed';

// Session status on task (CLI only)
type SessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'cancelled';

// Session progress entry (embedded in Task)
interface SessionProgress {
  sessionId: string;
  status: SessionStatus;
  lastUpdated: string;
  notes?: string;  // Reason for blocked/needs_input/failed
}

// Task entity
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sessionIds: string[];
  sessionProgress: SessionProgress[];  // Track each session's status
  parentId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

// Session entity
interface Session {
  id: string;
  name?: string;
  status: SessionLifecycleStatus;
  taskIds: string[];
  projectId?: string;
  spawnSource: 'ui' | 'session';
  createdAt: string;
  updatedAt: string;
}
```

---

## Update Rules

### Who Updates What

| Status Type | User (UI) | Session (CLI) | System |
|-------------|-----------|---------------|--------|
| Task Status | ✅ | ❌ | ✅ auto `todo`→`inprogress` |
| Session Lifecycle | ✅ stop | ❌ | ✅ lifecycle events |
| Session Progress | ❌ | ✅ | ❌ |

### Automatic Transitions

1. **Task `todo` → `inprogress`**: When first session starts working
2. **Session lifecycle → `failed`**: On crash/error

---

## CLI Commands

### Queue Tasks

Add tasks to session's queue (sets status to `queued`):

```bash
maestro task queue <taskId> [taskId2] [taskId3]...
```

### Update Session Status

Update the session's status on a task (must be run from session context):

```bash
maestro task update <taskId> --status working
maestro task update <taskId> --status blocked --notes "Need API credentials"
maestro task update <taskId> --status needs_input --notes "Choose approach A or B?"
maestro task update <taskId> --status completed
```

If no session context, command rejects with "No session found".

---

## Derived Aggregate Status

For UI display, derive aggregate from `sessionProgress`:

```typescript
type AggregateSessionStatus =
  | 'no_sessions'
  | 'queued'
  | 'working'
  | 'blocked'
  | 'needs_input'
  | 'all_completed'
  | 'all_failed';

function getAggregateSessionStatus(task: Task): AggregateSessionStatus {
  const progress = task.sessionProgress;

  if (progress.length === 0) return 'no_sessions';

  const statuses = progress.map(p => p.status);

  // Priority order (urgent first)
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

## Keeping sessionProgress in Sync

When session queues a task:
```typescript
function queueTaskForSession(taskId: string, sessionId: string) {
  const task = getTask(taskId);

  // Add to sessionIds if not present
  if (!task.sessionIds.includes(sessionId)) {
    task.sessionIds.push(sessionId);
  }

  // Add to sessionProgress with 'queued' status
  if (!task.sessionProgress.find(p => p.sessionId === sessionId)) {
    task.sessionProgress.push({
      sessionId,
      status: 'queued',
      lastUpdated: new Date().toISOString(),
    });
  }

  saveTask(task);
}
```

When session is removed from task:
```typescript
function removeSessionFromTask(taskId: string, sessionId: string) {
  const task = getTask(taskId);

  task.sessionIds = task.sessionIds.filter(id => id !== sessionId);
  task.sessionProgress = task.sessionProgress.filter(p => p.sessionId !== sessionId);

  saveTask(task);
}
```

---

## API

### Update Session Status (CLI → Server)

```typescript
PUT /api/tasks/:taskId/sessions/:sessionId/status
{
  "status": "blocked",
  "notes": "Need API credentials"
}
```

### Queue Task (CLI → Server)

```typescript
POST /api/tasks/:taskId/queue
{
  "sessionId": "session-123"
}
```

### Get Task (includes sessionProgress)

```typescript
GET /api/tasks/:taskId

// Response
{
  "id": "task-1",
  "title": "Fix bug",
  "status": "inprogress",
  "sessionIds": ["s1", "s2"],
  "sessionProgress": [
    { "sessionId": "s1", "status": "working", "lastUpdated": "..." },
    { "sessionId": "s2", "status": "completed", "lastUpdated": "..." }
  ],
  ...
}
```

### WebSocket Events

```typescript
// Session status changed on task
{
  "type": "task:session_status",
  "payload": {
    "taskId": "task-1",
    "sessionId": "s1",
    "status": "blocked",
    "notes": "Need API key"
  }
}
```

---

## UI Display

### Task List Item

```
┌─────────────────────────────────────────────────────┐
│ Fix authentication bug                              │
│ [inprogress]  Sessions: 🟢 working  🟡 blocked      │
└─────────────────────────────────────────────────────┘
```

### Task Detail

```
┌─────────────────────────────────────────────────────┐
│ Fix authentication bug                              │
│ Status: [inprogress ▼]                              │
├─────────────────────────────────────────────────────┤
│ Sessions:                                           │
│  • Session-001: 🟢 working                          │
│  • Session-002: 🟡 blocked - Need API key           │
│  • Session-003: ✓ completed                         │
└─────────────────────────────────────────────────────┘
```

---

## Summary

| Layer | Field | Values | Controlled By |
|-------|-------|--------|---------------|
| Task | `status` | todo, inprogress, completed, cancelled | User (UI) |
| Session | `status` | spawning, active, stopped, failed | System |
| Task | `sessionProgress[].status` | queued, working, needs_input, blocked, completed, failed, cancelled | Session (CLI) |
