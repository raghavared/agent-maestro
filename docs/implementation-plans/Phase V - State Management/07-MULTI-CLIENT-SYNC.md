# Multi-Client Real-Time Synchronization

## Overview

The Maestro architecture supports **real-time synchronization across multiple clients**. Any client that updates the Maestro Server state will trigger WebSocket events that update ALL connected clients, including the Agents UI.

---

## Supported Clients

### 1. **Agents UI** (This Application)
The primary UI for managing tasks and sessions.

### 2. **Maestro CLI**
Command-line interface for task management:
```bash
maestro task create "Implement login"
maestro task update task_123 --status completed
maestro session delete sess_456
```

### 3. **Other LLMs**
AI agents (Claude, GPT-4, Gemini, etc.) calling the Maestro API:
```python
import requests

# Claude updates a task
requests.patch('http://localhost:3000/api/tasks/task_123', json={
    'status': 'completed',
    'completedAt': int(time.time() * 1000)
})
```

### 4. **Other Web Apps**
Any application using the Maestro REST API:
```javascript
// Another web app
fetch('http://localhost:3000/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'proj_123',
    title: 'New task from external app',
    priority: 'high'
  })
});
```

### 5. **Direct API Calls**
Manual API calls via curl, Postman, etc.:
```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_789
```

---

## Real-Time Sync Flow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT A (Maestro CLI)                        │
│  $ maestro task update task_123 --status completed              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   PATCH /api/tasks/task_123
                   { status: "completed" }
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAESTRO SERVER                                │
│                                                                  │
│  1. Validates request                                           │
│  2. Updates task in database/memory                             │
│  3. Generates WebSocket event                                   │
│  4. Broadcasts to ALL WebSocket connections                     │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
              WebSocket Broadcast to ALL Clients
                            │
           ┌────────────────┼────────────────┬────────────────┐
           │                │                │                │
           ▼                ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Client A │    │ Client B │    │ Client C │    │ Client D │
    │   (CLI)  │    │ (UI Tab1)│    │ (UI Tab2)│    │  (LLM)   │
    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                            │
                            ▼
                    (AGENTS UI - CLIENT B)
                            │
                            ▼
              MaestroContext.useMaestroWebSocket()
                            │
                            ▼
                  onTaskUpdated(task) fires
                            │
                            ▼
              Updates global cache: state.tasks
                            │
                            ▼
              Components automatically re-render:
              - MaestroPanel (tasks list)
              - SessionsSection (if task in session)
              - TaskListItem (if showing this task)
```

---

## Real-Time Update Examples

### Example 1: CLI Updates Task Status

**Scenario:** Developer uses CLI to mark task as completed while UI is open.

```bash
# Developer runs CLI command
$ maestro task update task_abc123 --status completed
✓ Task updated successfully
```

**What happens in the UI:**

```typescript
// 1. Server broadcasts WebSocket event
{
  event: "task:updated",
  data: {
    id: "task_abc123",
    status: "completed",
    completedAt: 1234567890,
    updatedAt: 1234567890
  }
}

// 2. MaestroContext receives event
useMaestroWebSocket({
  onTaskUpdated: (task) => {
    console.log('[WebSocket] Task updated remotely:', task.id);
    setState(prev => ({
      ...prev,
      tasks: new Map(prev.tasks).set(task.id, task)
    }));
  }
});

// 3. MaestroPanel re-renders
const { tasks } = useTasks(projectId);
// tasks array now includes updated task
// UI shows: [IDLE] → [OK] ✓

// 4. SessionsSection updates (if session expanded)
const { tasks: sessionTasks } = useSessionTasks(sessionId);
// sessionTasks array includes updated task
// Session's task list shows new status

// 5. TaskListItem updates (if task visible)
// Task card shows completed status with checkmark
```

---

### Example 2: LLM Creates New Task

**Scenario:** Claude creates a task via API while user has MaestroPanel open.

```python
# Claude's code
import requests

response = requests.post('http://localhost:3000/api/tasks', json={
    'projectId': 'proj_123',
    'title': 'Refactor authentication service',
    'description': 'Split auth into microservice',
    'priority': 'high',
    'prompt': 'Refactor the monolithic auth...'
})

task = response.json()
print(f"Created task: {task['id']}")
```

**What happens in the UI:**

```typescript
// 1. Server broadcasts WebSocket event
{
  event: "task:created",
  data: {
    id: "task_def456",
    projectId: "proj_123",
    title: "Refactor authentication service",
    status: "pending",
    priority: "high",
    sessionIds: [],
    sessionCount: 0,
    createdAt: 1234567890,
    updatedAt: 1234567890
  }
}

// 2. MaestroContext receives event
useMaestroWebSocket({
  onTaskCreated: (task) => {
    console.log('[WebSocket] New task created remotely:', task.title);
    if (task.projectId === currentProjectId) {
      setState(prev => ({
        ...prev,
        tasks: new Map(prev.tasks).set(task.id, task)
      }));
    }
  }
});

// 3. MaestroPanel re-renders
const { tasks } = useTasks(projectId);
// New task appears at top of list!
// User sees: "Refactor authentication service" [HIGH] [IDLE]
```

---

### Example 3: Another UI Tab Deletes Session

**Scenario:** User has Agents UI open in two browser tabs. In Tab 1, they close a terminal session. Tab 2 should update immediately.

**Tab 1:**
```typescript
// User clicks × to close terminal
onCloseSession('sess_789');
  ↓
completeMaestroSession('sess_789');
  ↓
DELETE /api/sessions/sess_789
```

**What happens in Tab 2:**

```typescript
// 1. Server broadcasts WebSocket event
{
  event: "session:deleted",
  data: { id: "sess_789" }
}

{
  event: "task:updated",  // For each task that was in the session
  data: {
    id: "task_abc123",
    sessionCount: 1,  // Decremented
    sessionIds: [],   // sess_789 removed
    updatedAt: 1234567890
  }
}

// 2. MaestroContext updates cache
useMaestroWebSocket({
  onSessionDeleted: (data) => {
    console.log('[WebSocket] Session deleted remotely:', data.id);
    setState(prev => {
      const sessions = new Map(prev.sessions);
      sessions.delete(data.id);
      return { ...prev, sessions };
    });
  },

  onTaskUpdated: (task) => {
    setState(prev => ({
      ...prev,
      tasks: new Map(prev.tasks).set(task.id, task)
    }));
  }
});

// 3. Components update in Tab 2

// SessionsSection: If session list is visible
// Session disappears from left panel

// TaskListItem: If task is expanded showing sessions
const { sessions } = useTaskSessions(taskId);
// sessions array no longer includes sess_789
// UI removes session from task's session list

// MaestroPanel: Task's session count updates
// [2x] → [1x]
```

---

### Example 4: Maestro CLI Adds Task to Existing Session

**Scenario:** Developer uses CLI to add a task to an existing session.

```bash
$ maestro session add-task sess_123 task_new789
✓ Task added to session
```

**What happens in the UI:**

```typescript
// 1. Server broadcasts multiple WebSocket events
{
  event: "session:updated",
  data: {
    id: "sess_123",
    taskIds: ["task_abc", "task_def", "task_new789"],  // New task added
    ...
  }
}

{
  event: "task:updated",
  data: {
    id: "task_new789",
    sessionCount: 1,
    sessionIds: ["sess_123"],
    ...
  }
}

{
  event: "session:task_added",
  data: {
    sessionId: "sess_123",
    taskId: "task_new789"
  }
}

// 2. MaestroContext updates caches
useMaestroWebSocket({
  onSessionUpdated: (session) => {
    setState(prev => ({
      ...prev,
      sessions: new Map(prev.sessions).set(session.id, session)
    }));
  },

  onTaskUpdated: (task) => {
    setState(prev => ({
      ...prev,
      tasks: new Map(prev.tasks).set(task.id, task)
    }));
  }
});

// 3. Components update

// SessionsSection: If sess_123 is expanded
const { tasks } = useSessionTasks('sess_123');
// tasks array now includes task_new789
// New task appears in session's task list!

// TaskListItem: If task_new789 is expanded
const { sessions } = useTaskSessions('task_new789');
// sessions array now includes sess_123
// Session appears in task's session list!

// MaestroPanel: Task list updates
// task_new789 now shows [1x] session count
```

---

## Cache Synchronization

### How Caches Stay Synchronized

```typescript
// Global cache in MaestroContext
state = {
  tasks: Map<string, Task>,      // ← Single source of truth
  sessions: Map<string, Session>, // ← Single source of truth
  ...
}

// Component-level derived state
const { tasks } = useSessionTasks(sessionId);
// ↑ Automatically re-computes when state.tasks or state.sessions change

const { sessions } = useTaskSessions(taskId);
// ↑ Automatically re-computes when state.sessions change
```

### Example: Task Updated by External Client

```typescript
// BEFORE: Initial state
state.tasks = Map {
  "task_123" => { id: "task_123", status: "in_progress", ... }
}

// Component A: SessionsSection (session expanded)
const { tasks } = useSessionTasks("sess_1");
// tasks = [{ id: "task_123", status: "in_progress" }]

// Component B: TaskListItem (showing task_123)
const task = state.tasks.get("task_123");
// task.status = "in_progress"

// ──────────────────────────────────────────────────────────

// EXTERNAL CLIENT: CLI updates task
// $ maestro task update task_123 --status completed

// ──────────────────────────────────────────────────────────

// WebSocket event arrives
onTaskUpdated({
  id: "task_123",
  status: "completed",
  completedAt: 1234567890,
  ...
});

// MaestroContext updates global cache
state.tasks = Map {
  "task_123" => { id: "task_123", status: "completed", ... }
}

// ──────────────────────────────────────────────────────────

// AFTER: Components automatically re-render

// Component A: SessionsSection
const { tasks } = useSessionTasks("sess_1");
// tasks = [{ id: "task_123", status: "completed" }]  ← Updated!
// UI shows: [RUN] → [OK] ✓

// Component B: TaskListItem
const task = state.tasks.get("task_123");
// task.status = "completed"  ← Updated!
// Status badge updates automatically
```

---

## Edge Cases

### Case 1: WebSocket Disconnected During External Update

**Problem:** External client updates task while UI WebSocket is disconnected.

**Solution:** On reconnect, refetch visible data.

```typescript
useMaestroWebSocket({
  onConnected: () => {
    console.log('[WebSocket] Reconnected - refreshing data');

    // Refetch tasks for active project
    if (activeProjectId) {
      fetchTasks(activeProjectId);
    }

    // Refetch expanded sessions
    for (const sessionId of expandedSessions) {
      fetchSession(sessionId);
    }
  }
});
```

---

### Case 2: Race Condition (Multiple Clients Update Same Resource)

**Problem:** Two clients update the same task simultaneously.

**Solution:** Server processes requests sequentially, broadcasts final state.

```typescript
// Client A: Updates task status
PATCH /api/tasks/task_123 { status: "in_progress" }

// Client B: Updates task priority (at same time)
PATCH /api/tasks/task_123 { priority: "high" }

// Server processes sequentially (request order may vary)
// Broadcasts two events:
task:updated { id: "task_123", status: "in_progress", updatedAt: 1000 }
task:updated { id: "task_123", priority: "high", updatedAt: 1001 }

// All clients receive both events in order
// Final state: { status: "in_progress", priority: "high" }
```

---

### Case 3: Missed Events During Network Outage

**Problem:** UI loses network connection, misses several events.

**Solution:** Refetch on reconnect to ensure consistency.

```typescript
let missedEventWindow = false;

useMaestroWebSocket({
  onDisconnected: () => {
    missedEventWindow = true;
    console.warn('[WebSocket] Disconnected - may miss updates');
  },

  onConnected: () => {
    if (missedEventWindow) {
      console.log('[WebSocket] Reconnected after disconnect - refetching all data');
      refetchAllVisibleData();
      missedEventWindow = false;
    }
  }
});
```

---

## Testing Multi-Client Sync

### Test Scenario 1: CLI + UI

```bash
# Terminal 1: Start Maestro server
$ npm run maestro:server

# Terminal 2: Open Agents UI
$ npm run dev

# Terminal 3: Use CLI to create task
$ maestro task create "Test task from CLI" --priority high

# ✅ Verify: Task appears in Agents UI immediately
```

---

### Test Scenario 2: Multiple Browser Tabs

```
1. Open Agents UI in Tab 1 and Tab 2
2. In Tab 1: Work on a task (creates session)
3. ✅ Verify: Session appears in Tab 2's SessionsSection
4. In Tab 2: Close the session
5. ✅ Verify: Session disappears from Tab 1
```

---

### Test Scenario 3: External API Call

```bash
# While Agents UI is open, make API call with curl
curl -X PATCH http://localhost:3000/api/tasks/task_abc123 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

# ✅ Verify: Task status updates in UI immediately
# ✅ Verify: If session expanded, task status updates in session's task list
```

---

## Benefits

### ✅ True Multi-User Collaboration
Multiple developers can work on the same project simultaneously.

### ✅ LLM Integration
AI agents can manage tasks while developers monitor progress in the UI.

### ✅ CLI + UI Workflow
Developers can use CLI for automation and UI for visualization.

### ✅ Consistent State Across All Clients
No matter how state changes, all clients converge to the same view.

### ✅ No Manual Refresh Required
Updates appear instantly without user action.

---

## Summary

✅ **ANY client** can update Maestro Server state
✅ **ALL connected clients** receive WebSocket events
✅ **UI components** automatically update their caches
✅ **No user intervention** required
✅ **Works across**: Agents UI, Maestro CLI, LLM APIs, external apps

**Result:** True real-time, multi-client synchronization! 🎉
