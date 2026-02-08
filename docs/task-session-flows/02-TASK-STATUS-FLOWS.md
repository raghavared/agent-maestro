# Task Status Flows

## Overview

Task status is **user-controlled** with a simple 4-state model. Updated via **UI only**. Separate from session status (updated via CLI).

---

## Status Values

| Status | Description |
|--------|-------------|
| `todo` | Task created, not yet started |
| `inprogress` | Work is happening |
| `completed` | Task is finished |
| `cancelled` | Task was cancelled |

---

## State Machine

```
┌────────┐     ┌─────────────┐     ┌───────────┐
│  todo  │────▶│ inprogress  │────▶│ completed │
└────────┘     └─────────────┘     └───────────┘
    │               │
    └───────────────┴──────▶ cancelled
```

### Valid Transitions

| From | To | Trigger |
|------|-----|---------|
| `todo` | `inprogress` | User starts, or session starts working (auto) |
| `todo` | `completed` | User marks complete directly |
| `todo` | `cancelled` | User cancels |
| `inprogress` | `completed` | User marks complete |
| `inprogress` | `todo` | User moves back to queue |
| `inprogress` | `cancelled` | User cancels |
| `completed` | `inprogress` | User reopens task |
| `cancelled` | `todo` | User restores task |

---

## Automatic Transitions

### `todo` → `inprogress`

When the first session starts working on the task:

```typescript
function onSessionStatusChange(taskId: string, sessionId: string, status: SessionStatus) {
  if (status === 'working') {
    const task = getTask(taskId);
    if (task.status === 'todo') {
      updateTask(taskId, { status: 'inprogress' });
    }
  }
}
```

This is the **only** automatic transition. All others require user action via UI.

---

## API (UI Only)

```typescript
PUT /api/tasks/:taskId
{
  "status": "completed"
}
```

---

## UI Component

```tsx
type TaskStatus = 'todo' | 'inprogress' | 'completed' | 'cancelled';

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  todo: { color: 'bg-gray-100 text-gray-600', label: 'To Do' },
  inprogress: { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  cancelled: { color: 'bg-gray-200 text-gray-500', label: 'Cancelled' },
};

function TaskStatusControl({ task, onStatusChange }: Props) {
  return (
    <select value={task.status} onChange={(e) => onStatusChange(e.target.value)}>
      <option value="todo">To Do</option>
      <option value="inprogress">In Progress</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );
}
```

---

## Relationship with Session Status

Task status and session status are **independent**:

| Task Status | Session Status | Meaning |
|-------------|----------------|---------|
| `todo` | no sessions | Task waiting |
| `todo` | `working` | Session started → auto-transition to `inprogress` |
| `inprogress` | `working` | Normal operation |
| `inprogress` | `completed` (all) | Sessions done, user decides when to complete |
| `inprogress` | `blocked` | Session blocked, task still in progress |
| `completed` | any | Task done from user's perspective |
| `cancelled` | any | Task cancelled |

**Key point:** When all sessions complete, the task does NOT auto-complete. The user decides when to mark it `completed` via UI.
