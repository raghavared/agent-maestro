# UI Implementation

## Overview

UI components for displaying task status (user-controlled) and session status on tasks.

---

## Components

### TaskStatusBadge

```tsx
type TaskStatus = 'todo' | 'inprogress' | 'completed' | 'cancelled';

const config: Record<TaskStatus, { color: string; label: string }> = {
  todo: { color: 'bg-gray-100 text-gray-600', label: 'To Do' },
  inprogress: { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  cancelled: { color: 'bg-gray-200 text-gray-500', label: 'Cancelled' },
};

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { color, label } = config[status];
  return <span className={`px-2 py-1 rounded-full text-sm ${color}`}>{label}</span>;
}
```

### TaskStatusControl

```tsx
function TaskStatusControl({ task, onChange }: Props) {
  return (
    <select value={task.status} onChange={(e) => onChange(e.target.value)}>
      <option value="todo">To Do</option>
      <option value="inprogress">In Progress</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );
}
```

### SessionStatusIndicator

Shows session status on a task:

```tsx
type SessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'cancelled';

const sessionConfig: Record<SessionStatus, { color: string; icon: string }> = {
  queued: { color: 'text-gray-400', icon: '○' },
  working: { color: 'text-blue-500', icon: '●' },
  needs_input: { color: 'text-purple-500', icon: '?' },
  blocked: { color: 'text-orange-500', icon: '⊘' },
  completed: { color: 'text-green-500', icon: '✓' },
  failed: { color: 'text-red-500', icon: '✗' },
  cancelled: { color: 'text-gray-400', icon: '○' },
};

function SessionStatusIndicator({ status }: { status: SessionStatus }) {
  const { color, icon } = sessionConfig[status];
  return <span className={color}>{icon}</span>;
}
```

### SessionProgressList

Shows each session's status on a task:

```tsx
function SessionProgressList({ task }: { task: Task }) {
  if (task.sessionProgress.length === 0) {
    return <span className="text-gray-400">No sessions</span>;
  }

  return (
    <div className="space-y-1">
      {task.sessionProgress.map((p) => (
        <div key={p.sessionId} className="flex items-center gap-2">
          <SessionStatusIndicator status={p.status} />
          <span className="text-sm">{p.sessionId.slice(0, 8)}</span>
          {p.notes && <span className="text-xs text-gray-500">— {p.notes}</span>}
        </div>
      ))}
    </div>
  );
}
```

---

## Task List Item

```tsx
function TaskListItem({ task }: { task: Task }) {
  const aggregate = getAggregateStatus(task);

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex justify-between">
        <span className="font-medium">{task.title}</span>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
        <SessionStatusIndicator status={aggregate} />
        <span>{task.sessionProgress.length} sessions</span>
      </div>
    </div>
  );
}
```

---

## Task Detail View

```tsx
function TaskDetail({ task }: { task: Task }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{task.title}</h2>
        <TaskStatusControl task={task} onChange={handleStatusChange} />
      </div>

      <section>
        <h3 className="font-medium mb-2">Sessions</h3>
        <SessionProgressList task={task} />
      </section>
    </div>
  );
}
```

---

## Hooks

### useTaskSessionStatus

```tsx
function useTaskSessionStatus(task: Task) {
  return useMemo(() => {
    const statuses = task.sessionProgress.map(p => p.status);

    if (statuses.length === 0) return 'no_sessions';
    if (statuses.includes('needs_input')) return 'needs_input';
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('working')) return 'working';
    if (statuses.includes('queued')) return 'queued';
    if (statuses.every(s => s === 'completed')) return 'all_completed';
    if (statuses.every(s => s === 'failed')) return 'all_failed';

    return 'working';
  }, [task.sessionProgress]);
}
```

---

## Display Examples

### Task List

```
┌─────────────────────────────────────────┐
│ Fix auth bug              [In Progress] │
│ ● 2 sessions                            │
├─────────────────────────────────────────┤
│ Add dark mode                   [To Do] │
│ No sessions                             │
├─────────────────────────────────────────┤
│ Update docs               [Completed]   │
│ ✓ 1 session                             │
└─────────────────────────────────────────┘
```

### Task Detail

```
┌─────────────────────────────────────────┐
│ Fix auth bug          [In Progress ▼]   │
├─────────────────────────────────────────┤
│ Sessions:                               │
│  ○ session-a1b2 — queued                │
│  ● session-c3d4 — working               │
│  ⊘ session-e5f6 — blocked: Need API key │
│  ✓ session-g7h8 — completed             │
└─────────────────────────────────────────┘
```
