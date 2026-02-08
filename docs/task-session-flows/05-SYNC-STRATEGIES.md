# Sync Strategies

## Overview

How to keep task status, session lifecycle, and session progress in sync across UI, CLI, and server.

---

## WebSocket Events

### Task Events

```typescript
'task:created'          // New task
'task:updated'          // Task fields changed (including status)
'task:deleted'          // Task removed
'task:session_status'   // Session's status on task changed
```

### Session Events

```typescript
'session:spawn'    // New session created
'session:active'   // Session started
'session:stopped'  // Session stopped
'session:failed'   // Session crashed
```

---

## Event Payloads

```typescript
// task:updated
{
  "type": "task:updated",
  "payload": {
    "task": { /* full task object */ }
  }
}

// task:session_status
{
  "type": "task:session_status",
  "payload": {
    "taskId": "task-1",
    "sessionId": "session-1",
    "status": "blocked",
    "notes": "Need API key",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

---

## Client Handling

```typescript
// In store
ws.on('task:updated', ({ task }) => {
  tasks.set(task.id, task);
});

ws.on('task:session_status', ({ taskId, sessionId, status, notes, lastUpdated }) => {
  const task = tasks.get(taskId);
  if (!task) return;

  const progress = task.sessionProgress.find(p => p.sessionId === sessionId);
  if (progress) {
    progress.status = status;
    progress.notes = notes;
    progress.lastUpdated = lastUpdated;
  } else {
    task.sessionProgress.push({ sessionId, status, notes, lastUpdated });
  }
});
```

---

## Keeping sessionProgress in Sync

When session queues a task:
```typescript
function queueTaskForSession(taskId: string, sessionId: string) {
  const task = tasks.get(taskId);

  if (!task.sessionIds.includes(sessionId)) {
    task.sessionIds.push(sessionId);
  }

  if (!task.sessionProgress.find(p => p.sessionId === sessionId)) {
    task.sessionProgress.push({
      sessionId,
      status: 'queued',
      lastUpdated: new Date().toISOString(),
    });
  }
}
```

When session is removed from task:
```typescript
function removeSessionFromTask(taskId: string, sessionId: string) {
  const task = tasks.get(taskId);

  task.sessionIds = task.sessionIds.filter(id => id !== sessionId);
  task.sessionProgress = task.sessionProgress.filter(p => p.sessionId !== sessionId);
}
```

---

## Reconnection

On WebSocket reconnect, refetch all tasks and sessions:

```typescript
async function onReconnect() {
  const [tasks, sessions] = await Promise.all([
    api.getTasks(),
    api.getSessions(),
  ]);

  store.setTasks(tasks);
  store.setSessions(sessions);
}
```

---

## Auto-Transitions

Only one automatic task status transition:

```typescript
// When session starts working, auto-transition task todo → inprogress
function onSessionStatus(taskId: string, sessionId: string, status: string) {
  const task = tasks.get(taskId);

  if (status === 'working' && task.status === 'todo') {
    task.status = 'inprogress';
    api.updateTask(taskId, { status: 'inprogress' });
  }
}
```
