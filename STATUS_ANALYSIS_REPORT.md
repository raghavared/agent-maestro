# Status Architecture Report
**Analysis of Task Status, Session Status, and Task Session Status across UI, Server, and CLI**

Generated: 2026-02-10

---

## Executive Summary

The Maestro system uses three distinct status types to track work across different dimensions:

1. **Task Status** - User-controlled overall task state (`todo`, `in_progress`, `completed`, `cancelled`, `blocked`)
2. **Session Status** - Session lifecycle state (`spawning`, `idle`, `working`, `completed`, `failed`, `stopped`)
3. **Task Session Status** - Per-session task progress tracking (`queued`, `working`, `blocked`, `completed`, `failed`, `skipped`)

This report analyzes how each component (UI, Server, CLI) defines, uses, displays, updates, and deletes these statuses.

---

## 1. Status Type Definitions

### 1.1 UI Component (`maestro-ui/src/app/types/maestro.ts`)

```typescript
// Task Status - User-controlled overall status
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

// Session Status - Session lifecycle
export type MaestroSessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';

// Task Session Status - Per-session task tracking
export type TaskSessionStatus = 'queued' | 'working' | 'blocked' | 'completed' | 'failed' | 'skipped';

// Task interface with both status types
export interface MaestroTask {
  id: string;
  status: TaskStatus;                                    // User-controlled
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Per-session map
  // ... other fields
}

// Session interface
export interface MaestroSession {
  id: string;
  status: MaestroSessionStatus;  // Session lifecycle status
  // ... other fields
}
```

### 1.2 Server Component (`maestro-server/src/types.ts`)

```typescript
// Task Status - Canonical definition
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

// Session Status
export type SessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';

// Task Session Status - Per-session tracking
export type TaskSessionStatus = 'queued' | 'working' | 'blocked' | 'completed' | 'failed' | 'skipped';

// Task model with status enforcement
export interface Task {
  id: string;
  status: TaskStatus;
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Map of sessionId -> status
  // ... other fields
}

// Session model
export interface Session {
  id: string;
  status: SessionStatus;
  // ... other fields
}

// Queue item status (for queue strategy)
export interface QueueItem {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  // ... other fields
}
```

### 1.3 CLI Component (`maestro-cli/src/types/manifest.ts`)

```typescript
// Task Status - Unified definition
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

// Task data in manifest
export interface TaskData {
  id: string;
  status?: TaskStatus;  // Optional in manifests
  sessionIds?: string[];
  activeSessionId?: string;
  // ... other fields
}

// Update source tracking
export type UpdateSource = 'user' | 'session';

export interface StatusUpdate {
  status: TaskStatus;
  updateSource: UpdateSource;
  sessionId?: string;
  reason?: string;
}
```

**Note:** CLI does not directly define Session Status or Task Session Status types, but works with them via API calls.

---

## 2. Component-by-Component Analysis

### 2.1 SERVER COMPONENT

#### 2.1.1 Task Status Management

**Location: `maestro-server/src/application/services/TaskService.ts`**

**Creating Tasks:**
```typescript
// Line 46-49: Tasks always start with 'todo' status
const task = await this.taskRepo.create({
  ...input,
  title: input.title.trim()
});
```

**Updating Tasks with Enforcement:**
```typescript
// Lines 96-128: Strict enforcement of who can update what
async updateTask(id: string, updates: UpdateTaskPayload): Promise<Task> {
  // Sessions can ONLY update taskSessionStatuses
  if (updates.updateSource === 'session') {
    const sessionAllowedUpdates: UpdateTaskPayload = {};

    // Map sessionStatus + sessionId -> taskSessionStatuses[sessionId]
    if (updates.sessionStatus !== undefined && updates.sessionId) {
      const existingTask = await this.taskRepo.findById(id);
      const existing = existingTask?.taskSessionStatuses || {};
      sessionAllowedUpdates.taskSessionStatuses = {
        ...existing,
        [updates.sessionId]: updates.sessionStatus,
      };
    }

    const task = await this.taskRepo.update(id, sessionAllowedUpdates);
    await this.eventBus.emit('task:updated', task);
    return task;
  }

  // User updates - allow all fields
  const { updateSource, sessionId, sessionStatus: _ss, ...userUpdates } = updates;
  const task = await this.taskRepo.update(id, userUpdates);
  // ...
}
```

**Key Principle:** Sessions cannot modify user-controlled task status, only their own session-specific status.

#### 2.1.2 Session Status Management

**Location: `maestro-server/src/application/services/SessionService.ts`**

**Creating Sessions:**
```typescript
// Line 47: Sessions created via repository
const session = await this.sessionRepo.create(input);
```

**Updating Session Status:**
```typescript
// Lines 112-122: Sessions can update their own status
async updateSession(id: string, updates: UpdateSessionPayload): Promise<Session> {
  const session = await this.sessionRepo.update(id, updates);

  if (session.needsInput) {
    console.log(`[SessionService] Emitting session:updated with needsInput...`);
  }

  await this.eventBus.emit('session:updated', session);
  return session;
}
```

#### 2.1.3 Task Session Status Management

**Location: `maestro-server/src/application/services/QueueService.ts`**

**Queue Strategy - Starting an Item:**
```typescript
// Lines 90-127: Updates both queue item status AND task session status
async startItem(sessionId: string): Promise<QueueItem> {
  // Update queue item status
  await this.queueRepo.updateItem(sessionId, item.taskId, {
    status: 'processing',
    startedAt: now,
  });

  // Update task session status for this session
  const startTask = await this.taskRepo.findById(item.taskId);
  await this.taskRepo.update(item.taskId, {
    taskSessionStatuses: {
      ...(startTask?.taskSessionStatuses || {}),
      [sessionId]: 'working'
    },
  });

  await this.eventBus.emit('queue:item_started', { sessionId, taskId: item.taskId });
}
```

#### 2.1.4 API Routes - Status Updates

**Session Routes (`maestro-server/src/api/sessionRoutes.ts`):**
```typescript
// Line 194-202: PATCH /sessions/:id - Update session status
router.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = await sessionService.updateSession(id, req.body);
    res.json(session);
  } catch (err: any) {
    handleError(err, res);
  }
});
```

**Task Routes (`maestro-server/src/api/taskRoutes.ts`):**
```typescript
// Line 71-78: PATCH /tasks/:id - Update task status
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const task = await taskService.updateTask(id, req.body);
    res.json(task);
  } catch (err: any) {
    handleError(err, res);
  }
});
```

#### 2.1.5 Repository Layer - Persistence

**Location: `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`**

```typescript
// Lines 73-80: Migration of legacy sessionStatus to taskSessionStatuses
if ((task as any).sessionStatus && !task.taskSessionStatuses) {
  if (task.sessionIds.length > 0) {
    task.taskSessionStatuses = { [task.sessionIds[0]]: (task as any).sessionStatus };
  }
  delete (task as any).sessionStatus;
}
if (!task.taskSessionStatuses) task.taskSessionStatuses = {};

// Lines 110-138: Creating tasks - always start with 'todo' status
async create(input: CreateTaskPayload): Promise<Task> {
  const task: Task = {
    id: this.idGenerator.generate('task'),
    status: 'todo' as TaskStatus,  // Default status
    taskSessionStatuses: {},        // Empty session status map
    // ...
  };

  this.tasks.set(task.id, task);
  await this.saveTask(task);
  return task;
}
```

**Server Component Summary:**
- ✅ Defines all three status types
- ✅ Enforces separation: sessions can only update taskSessionStatuses
- ✅ Persists all statuses to filesystem
- ✅ Emits events on status changes
- ✅ Provides API endpoints for status updates

---

### 2.2 CLI COMPONENT

#### 2.2.1 Task Status Operations

**Location: `maestro-cli/src/commands/task.ts`**

**Displaying Task Status:**
```typescript
// Lines 148-164: task get [id] - Shows both task status and session statuses
outputKeyValue('ID', t.id);
outputKeyValue('Title', t.title);
outputKeyValue('Status', t.status);

// Display per-session statuses
if (t.taskSessionStatuses && Object.keys(t.taskSessionStatuses).length > 0) {
  const entries = Object.entries(t.taskSessionStatuses as Record<string, string>);
  if (entries.length === 1) {
    outputKeyValue('Session Status', `${entries[0][1]} (${entries[0][0]})`);
  } else {
    outputKeyValue('Session Statuses', '');
    for (const [sid, status] of entries) {
      outputKeyValue(`  ${sid}`, status as string);
    }
  }
}
```

**Updating Task Status:**
```typescript
// Lines 171-200: task update <id> - Updates task status
router.command('update <id>')
  .option('--status <status>', 'New status (todo, in_progress, completed, cancelled, blocked)')
  .action(async (id, cmdOpts) => {
    const updateData: Record<string, any> = {};
    if (cmdOpts.status) updateData.status = cmdOpts.status;

    // Update via server API
    const updated = await api.patch(`/api/tasks/${id}`, updateData);

    // Post timeline event if running from a session
    if (sessionId && cmdOpts.status) {
      await api.post(`/api/sessions/${sessionId}/timeline`, {
        type: 'task_status_changed',
        message: `Status changed to ${cmdOpts.status}`,
        taskId: id,
      });
    }
  });
```

#### 2.2.2 Session Status Operations

**Location: `maestro-cli/src/commands/session.ts`**

**Displaying Session Status:**
```typescript
// Lines 153-157: session info - Shows session status
outputKeyValue('ID', s.id);
outputKeyValue('Name', s.name);
outputKeyValue('Status', s.status);
outputKeyValue('Tasks', (s.taskIds || []).join(', '));
```

**Listing Sessions with Status:**
```typescript
// Lines 88-127: session list - Shows sessions with their status
outputTable(
  ['ID', 'Name', 'Status', 'Tasks'],
  sessions.map(s => [s.id, s.name, s.status, (s.taskIds || []).length])
);
```

#### 2.2.3 Reporting Commands (Updates Session Status)

**Location: `maestro-cli/src/commands/report.ts`**

```typescript
// Lines 27-79: Report commands update session timeline and status
async function executeReport(subcommand: string, message: string, opts) {
  const def = REPORT_SUBCOMMANDS[subcommand];

  // Post session timeline event
  await api.post(`/api/sessions/${sessionId}/timeline`, {
    type: def.timelineType,
    message,
  });

  // Special case: report complete marks session as completed
  if (subcommand === 'complete') {
    await api.patch(`/api/sessions/${sessionId}`, {
      status: 'completed',  // Updates session status
    });
  }
}

// Available report commands:
// - maestro report progress <message>   -> timeline event only
// - maestro report complete <summary>   -> marks session as 'completed'
// - maestro report blocked <reason>     -> timeline event only
// - maestro report error <description>  -> timeline event only
```

**CLI Component Summary:**
- ✅ Reads and displays all three status types
- ✅ Updates task status via API (user updates)
- ✅ Updates session status via report commands
- ✅ Does NOT directly update taskSessionStatuses (handled by server/queue)
- ✅ Shows session statuses when displaying tasks

---

### 2.3 UI COMPONENT

#### 2.3.1 Task Status Display & Update

**Location: `maestro-ui/src/components/maestro/TaskStatusControl.tsx`**

```typescript
// Lines 4-9: Component props
type TaskStatusControlProps = {
  taskId: string;
  currentStatus: TaskStatus;
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // Per-session status
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
};

// Lines 12-28: Status symbols and labels for display
const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  todo: "○",
  in_progress: "◉",
  completed: "✓",
  cancelled: "⊘",
  blocked: "✗",
};

const SESSION_STATUS_LABELS: Record<TaskSessionStatus, string> = {
  queued: "Queued",
  working: "Working",
  blocked: "Blocked",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

// Lines 84-105: User status update handler
const handleStatusSelect = async (newStatus: TaskStatus) => {
  setIsUpdating(true);
  try {
    await onStatusChange(taskId, newStatus);  // Calls store method
    setSuccessFlash(true);
    setIsOpen(false);
  } catch (err) {
    setError(errorMessage);
  } finally {
    setIsUpdating(false);
  }
};

// Lines 167-182: Session status display (read-only)
{taskSessionStatuses && Object.keys(taskSessionStatuses).length > 0 ? (
  Object.entries(taskSessionStatuses).map(([sid, sstatus]) => (
    <div key={sid} className={`terminalSessionStatusDisplay--${sstatus}`}>
      <span className="terminalSessionStatusPrefix">SESSION:</span>
      <span className="terminalSessionStatusLabel">
        {SESSION_STATUS_LABELS[sstatus] || sstatus}
      </span>
    </div>
  ))
) : (
  <div className="terminalSessionStatusDisplay--none">
    <span>SESSION: NONE</span>
  </div>
)}
```

#### 2.3.2 Store - Status Management

**Location: `maestro-ui/src/stores/useMaestroStore.ts`**

**Task Status Update:**
```typescript
// State includes task and session maps
interface MaestroState {
  tasks: Map<string, MaestroTask>;
  sessions: Map<string, MaestroSession>;
  updateTask: (taskId: string, updates: UpdateTaskPayload) => Promise<MaestroTask>;
}

// updateTask implementation (calls API)
updateTask: async (taskId, updates) => {
  const updated = await maestroClient.updateTask(taskId, updates);
  set((prev) => ({ tasks: new Map(prev.tasks).set(taskId, updated) }));
  return updated;
}
```

**WebSocket Event Handlers:**
```typescript
// Lines 93-192: Real-time status updates via WebSocket
const handleMessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);

  switch (message.event) {
    case 'task:created':
    case 'task:updated': {
      const taskData = message.data;
      // Ensure taskSessionStatuses is always an object
      if (!taskData.taskSessionStatuses || typeof taskData.taskSessionStatuses !== 'object') {
        taskData.taskSessionStatuses = {};
      }
      set((prev) => ({ tasks: new Map(prev.tasks).set(taskData.id, taskData) }));
      break;
    }

    case 'session:updated': {
      const updatedSession = normalizeSession(message.data);
      if (updatedSession.needsInput) {
        console.log('[useMaestroStore] session:updated has needsInput:', updatedSession.id);
      }
      set((prev) => ({ sessions: new Map(prev.sessions).set(updatedSession.id, updatedSession) }));
      break;
    }
  }
}
```

**Session Status Normalization:**
```typescript
// Lines 57-75: Ensures session data integrity
const normalizeSession = (session: any): any => {
  if (!session) return session;
  if (!Array.isArray(session.taskIds)) {
    session.taskIds = [];
  }
  if (!session.status) {
    console.warn('[useMaestroStore] Session missing status, defaulting to "spawning"');
    session.status = 'spawning';
  }
  return session;
};
```

**UI Component Summary:**
- ✅ Displays all three status types
- ✅ User can change task status via dropdown
- ✅ Session statuses shown read-only per session
- ✅ Real-time updates via WebSocket
- ✅ Normalizes and validates status data
- ❌ Does NOT allow direct editing of session status or task session status

---

## 3. Status Flow Diagrams

### 3.1 Task Status Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION (UI or CLI)                                     │
│  - Click status dropdown in UI                              │
│  - Run: maestro task update <id> --status in_progress       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ API CALL                                                     │
│  PATCH /api/tasks/:id                                        │
│  { status: 'in_progress' }                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: TaskService.updateTask()                            │
│  - Validates updateSource !== 'session'                      │
│  - Allows user to update task.status                         │
│  - Saves to filesystem                                       │
│  - Emits 'task:updated' event                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ WEBSOCKET BROADCAST                                          │
│  Event: 'task:updated'                                       │
│  Data: { id, status: 'in_progress', ... }                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ UI UPDATE                                                    │
│  - useMaestroStore handles 'task:updated'                    │
│  - Updates tasks Map                                         │
│  - Re-renders TaskStatusControl with new status              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Session Status Flow

```
┌─────────────────────────────────────────────────────────────┐
│ SESSION ACTION (CLI command in running session)             │
│  - maestro report complete "Task finished"                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ CLI: executeReport('complete', message)                      │
│  1. POST /api/sessions/:id/timeline                          │
│     { type: 'task_completed', message }                      │
│  2. PATCH /api/sessions/:id                                  │
│     { status: 'completed' }  ← Updates session status        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: SessionService.updateSession()                       │
│  - Updates session.status = 'completed'                      │
│  - Saves to filesystem                                       │
│  - Emits 'session:updated' event                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ WEBSOCKET BROADCAST                                          │
│  Event: 'session:updated'                                    │
│  Data: { id, status: 'completed', ... }                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ UI UPDATE                                                    │
│  - useMaestroStore handles 'session:updated'                 │
│  - Updates sessions Map                                      │
│  - Session component shows 'completed' status                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Task Session Status Flow (Queue Strategy)

```
┌─────────────────────────────────────────────────────────────┐
│ QUEUE OPERATION (CLI command)                               │
│  - maestro queue start                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVER: QueueService.startItem(sessionId)                   │
│  1. Update queue item: status = 'processing'                 │
│  2. Update task session status:                              │
│     task.taskSessionStatuses[sessionId] = 'working'          │
│  3. Save task to filesystem                                  │
│  4. Emit 'queue:item_started' event                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ TASK UPDATE EVENT                                            │
│  - TaskRepo.update() triggers 'task:updated' event           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ WEBSOCKET BROADCAST                                          │
│  Event: 'task:updated'                                       │
│  Data: {                                                     │
│    id: 'task_123',                                           │
│    taskSessionStatuses: {                                    │
│      'sess_456': 'working'  ← Session-specific status        │
│    }                                                         │
│  }                                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ UI UPDATE                                                    │
│  - TaskStatusControl shows "SESSION: Working"                │
│  - Displayed separately from user task status                │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Status Usage Summary

### 4.1 Task Status Usage

| Component | Create | Read | Update | Delete | Notes |
|-----------|--------|------|--------|--------|-------|
| **Server** | ✅ Always 'todo' | ✅ Repository | ✅ User only | ✅ Cascade delete | Enforces updateSource |
| **CLI** | ❌ Server creates | ✅ Display | ✅ Via API | ❌ Server handles | Shows in task get/list |
| **UI** | ❌ Server creates | ✅ Display | ✅ Dropdown | ❌ Server handles | Real-time updates |

**Lifecycle:**
1. Task created → status = 'todo'
2. User changes to 'in_progress' (via UI or CLI)
3. User marks 'completed' or 'blocked'
4. Task deleted → status deleted with task

### 4.2 Session Status Usage

| Component | Create | Read | Update | Delete | Notes |
|-----------|--------|------|--------|--------|-------|
| **Server** | ✅ Default 'spawning' | ✅ Repository | ✅ Via API | ✅ With session | Lifecycle management |
| **CLI** | ❌ Server creates | ✅ Display | ✅ report commands | ❌ Server handles | Updates via report complete |
| **UI** | ❌ Server creates | ✅ Display | ❌ Read-only | ❌ Server handles | Real-time updates |

**Lifecycle:**
1. Session spawned → status = 'spawning'
2. Session becomes 'idle' or 'working'
3. Session completes → status = 'completed'
4. Session stops → status = 'stopped' or 'failed'
5. Session deleted → status deleted with session

### 4.3 Task Session Status Usage

| Component | Create | Read | Update | Delete | Notes |
|-----------|--------|------|--------|--------|-------|
| **Server** | ✅ Queue init | ✅ Repository | ✅ QueueService | ✅ With session/task | Per-session tracking |
| **CLI** | ❌ Server creates | ✅ Display | ❌ Server automatic | ❌ Server handles | Shows in task get |
| **UI** | ❌ Server creates | ✅ Display | ❌ Read-only | ❌ Server handles | Per-session badges |

**Lifecycle:**
1. Queue initialized → task.taskSessionStatuses[sessionId] = 'queued'
2. Queue starts item → 'working'
3. Queue completes item → 'completed'
4. Session deleted → entry removed from taskSessionStatuses map

---

## 5. Key Findings

### 5.1 Separation of Concerns

✅ **Well-Designed Separation:**
- **Task Status** = User-controlled, reflects overall task state
- **Session Status** = System-controlled, reflects session lifecycle
- **Task Session Status** = Per-session tracking, reflects work progress

### 5.2 Update Enforcement

✅ **Server enforces strict rules:**
- Sessions can ONLY update `taskSessionStatuses[sessionId]`
- Sessions CANNOT update user-controlled `task.status`
- Updates tracked by `updateSource` field ('user' | 'session')

**Location:** `maestro-server/src/application/services/TaskService.ts:96-128`

### 5.3 Status Display

✅ **UI clearly differentiates statuses:**
- Task status shown with dropdown selector
- Session statuses shown as read-only badges
- Per-session status shown separately per session

**Location:** `maestro-ui/src/components/maestro/TaskStatusControl.tsx:167-182`

### 5.4 Real-time Synchronization

✅ **WebSocket ensures consistency:**
- All status changes broadcast to UI
- UI updates immediately
- No polling required

**Location:** `maestro-ui/src/stores/useMaestroStore.ts:93-192`

### 5.5 Legacy Migration

✅ **Backward compatibility handled:**
- Old `sessionStatus` migrated to `taskSessionStatuses`
- Migration happens at repository load time

**Location:** `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts:73-80`

---

## 6. Status Value Reference

### 6.1 Task Status Values

| Value | Meaning | Set By | CLI Display | UI Symbol |
|-------|---------|--------|-------------|-----------|
| `todo` | Not started | System (default) | Todo | ○ |
| `in_progress` | Being worked on | User | In Progress | ◉ |
| `completed` | Finished | User | Completed | ✓ |
| `cancelled` | Cancelled | User | Cancelled | ⊘ |
| `blocked` | Blocked | User | Blocked | ✗ |

### 6.2 Session Status Values

| Value | Meaning | Set By | Typical Flow |
|-------|---------|--------|--------------|
| `spawning` | Session starting | Server | Initial state |
| `idle` | Waiting for input | Session | Between tasks |
| `working` | Actively processing | Session | During work |
| `completed` | Finished successfully | Session/User | Terminal state |
| `failed` | Ended with error | Session | Terminal state |
| `stopped` | Manually stopped | User | Terminal state |

### 6.3 Task Session Status Values

| Value | Meaning | Set By | Queue Context |
|-------|---------|--------|---------------|
| `queued` | Waiting in queue | QueueService | Item added to queue |
| `working` | Currently processing | QueueService | Item started |
| `blocked` | Blocked by dependency | Session | Manual report |
| `completed` | Finished by session | QueueService | Item completed |
| `failed` | Failed by session | QueueService | Item failed |
| `skipped` | Skipped by session | QueueService | Item skipped |

---

## 7. Recommendations

### 7.1 Current State Assessment

✅ **Strengths:**
1. Clear separation between user and system statuses
2. Strict enforcement prevents sessions from corrupting user data
3. Per-session tracking enables multi-session task handling
4. Real-time synchronization works well
5. Good migration path from legacy schema

⚠️ **Potential Improvements:**
1. Add TypeScript enums instead of string unions for better type safety
2. Document status transition rules (which statuses can transition to which)
3. Add validation for invalid status transitions
4. Consider adding status history/audit trail
5. Add status change webhooks for external integrations

### 7.2 Documentation Gaps

📝 **Areas needing better documentation:**
1. Status transition state machines
2. When to use each status type
3. How queue strategy affects task session status
4. Impact of deleting sessions on taskSessionStatuses
5. Conflict resolution when multiple sessions work on same task

---

## 8. File Reference Index

### 8.1 Type Definitions

- **UI:** `maestro-ui/src/app/types/maestro.ts:4-8`
- **Server:** `maestro-server/src/types.ts:89-92`
- **CLI:** `maestro-cli/src/types/manifest.ts:50-70`

### 8.2 Status Update Logic

- **Server Task Updates:** `maestro-server/src/application/services/TaskService.ts:96-128`
- **Server Session Updates:** `maestro-server/src/application/services/SessionService.ts:112-122`
- **Server Queue Updates:** `maestro-server/src/application/services/QueueService.ts:90-127`
- **CLI Task Updates:** `maestro-cli/src/commands/task.ts:171-200`
- **CLI Report Commands:** `maestro-cli/src/commands/report.ts:27-79`
- **UI Status Control:** `maestro-ui/src/components/maestro/TaskStatusControl.tsx:84-105`

### 8.3 Status Display

- **UI Task Status Control:** `maestro-ui/src/components/maestro/TaskStatusControl.tsx:109-192`
- **UI Store Handler:** `maestro-ui/src/stores/useMaestroStore.ts:93-192`
- **CLI Task Display:** `maestro-cli/src/commands/task.ts:148-164`
- **CLI Session Display:** `maestro-cli/src/commands/session.ts:153-157`

### 8.4 Repository/Persistence

- **Task Repository:** `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`
- **Session Repository:** `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`
- **Queue Repository:** `maestro-server/src/infrastructure/repositories/FileSystemQueueRepository.ts`

---

## 9. Conclusion

The Maestro status architecture is well-designed with clear separation of concerns:

1. **Task Status** provides user-controlled task lifecycle management
2. **Session Status** tracks the lifecycle of worker/orchestrator sessions
3. **Task Session Status** enables per-session progress tracking for multi-session scenarios

The enforcement at the server level ensures data integrity, while the UI provides clear visual distinction between status types. The CLI offers complete access to all status information and appropriate update capabilities.

The use of `taskSessionStatuses` as a map (sessionId → status) is particularly elegant, allowing a single task to be worked on by multiple sessions simultaneously while maintaining independent progress tracking.

**Overall Assessment:** ✅ Well-architected, properly enforced, clearly displayed across all components.
