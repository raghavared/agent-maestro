# Data Model Changes

## Overview

Changes to implement the new status architecture with separate task status (UI) and session status (CLI).

---

## Current → Proposed

### Task

**Current:**
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  agentStatus?: 'working' | 'blocked' | 'needs_input' | 'completed' | 'failed';
  sessionIds: string[];
  parentId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Proposed:**
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
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sessionIds: string[];
  sessionProgress: SessionProgress[];  // NEW: per-session status
  parentId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  // REMOVED: agentStatus (now per-session in sessionProgress)
}
```

### Session (No Changes)

```typescript
type SessionLifecycleStatus = 'spawning' | 'active' | 'stopped' | 'failed';

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

## Migration

### Status Mapping

| Old Task Status | New Task Status |
|-----------------|-----------------|
| `pending` | `todo` |
| `in_progress` | `inprogress` |
| `completed` | `completed` |
| `blocked` | `inprogress` |

### Migration Script

```typescript
async function migrate(projectId: string) {
  const tasks = await loadTasks(projectId);

  for (const task of tasks) {
    const migratedTask = {
      ...task,
      status: mapStatus(task.status),
      sessionProgress: task.sessionIds.map(sessionId => ({
        sessionId,
        status: task.agentStatus || 'queued',
        lastUpdated: task.updatedAt,
      })),
    };

    delete migratedTask.agentStatus;
    await saveTask(migratedTask);
  }
}

function mapStatus(old: string): TaskStatus {
  return {
    'pending': 'todo',
    'in_progress': 'inprogress',
    'completed': 'completed',
    'blocked': 'inprogress',
  }[old] || 'todo';
}
```

---

## API Changes

### Queue Task (CLI)

```typescript
POST /api/tasks/:taskId/queue
{ "sessionId": "session-123" }
```

### Update Session Status (CLI)

```typescript
PUT /api/tasks/:taskId/sessions/:sessionId/status
{
  "status": "blocked",
  "notes": "Need API credentials"
}
```

### WebSocket Event

```typescript
{
  "type": "task:session_status",
  "payload": {
    "taskId": "task-1",
    "sessionId": "session-1",
    "status": "blocked",
    "notes": "Need API credentials",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

---

## CLI Commands

```bash
# Queue tasks (must run from session)
maestro task queue <taskId> [taskId2]...

# Update session status (must run from session)
maestro task update <taskId> --status working
maestro task update <taskId> --status blocked --notes "Need API key"
maestro task update <taskId> --status completed

# Error if no session context
# "No session found. This command must be run from a session."
```

---

## Summary

| Change | Type | Description |
|--------|------|-------------|
| `Task.status` | Modified | Now: `todo`, `inprogress`, `completed`, `cancelled` |
| `Task.agentStatus` | Removed | Deprecated - use sessionProgress |
| `Task.sessionProgress` | New | Per-session status array |
| `SessionProgress.status` | New | `queued`, `working`, `needs_input`, `blocked`, `completed`, `failed`, `cancelled` |
| `task queue` | New CLI | Queue tasks for session |
| `task update --status` | Modified | Updates session status, not task status |
