# Status Flows

## Overview

The Worker Strategy System introduces a **dual-status model**:

1. **User Status** - Controlled by humans, reflects user's view of the task
2. **Session Item Status** - Controlled by workers, reflects processing state within a session

This separation allows:
- Users to mark tasks "done" independently of agent processing
- Same task to be in different states across different sessions
- Clear ownership of status transitions

## Status Types

### User Status (Task-level)

```typescript
type TaskUserStatus =
  | 'todo'        // Not started
  | 'in_progress' // User is working on it
  | 'done'        // User considers it done
  | 'archived';   // No longer relevant

// Controlled by: User only
// Scope: Global per task
// UI: Task list, task detail
```

### Session Item Status (Per-session)

```typescript
type SessionItemStatus =
  | 'queued'      // In data structure, waiting
  | 'processing'  // Currently being worked on
  | 'completed'   // Successfully finished by worker
  | 'failed'      // Worker couldn't complete
  | 'skipped'     // Intentionally skipped
  | 'blocked';    // Blocked by dependency (DAG only)

// Controlled by: Worker (via CLI commands)
// Scope: Per task-session pair
// UI: Session view, data structure visualization
```

### Session Status (Session-level)

```typescript
type SessionStatus =
  | 'spawning'    // Session starting up
  | 'idle'        // Worker initialized, no task active
  | 'working'     // Processing a task
  | 'completed'   // All tasks processed
  | 'failed'      // Session failed
  | 'stopped';    // Manually stopped

// Controlled by: System based on worker actions
// Scope: Per session
```

## Status Transition Rules

### Session Item Status Transitions

```
                              ┌─────────────────┐
                              │                 │
                              ▼                 │
┌──────────┐    start    ┌─────────────┐       │
│  queued  │ ──────────► │ processing  │       │
└──────────┘             └─────────────┘       │
     ▲                          │              │
     │                          ├─── complete ─┼──► [completed]
     │                          │              │
     │                          ├─── fail ─────┼──► [failed]
     │                          │              │
     │                          └─── skip ─────┼──► [skipped]
     │                                         │
     └────────── retry (fail with --retry) ────┘


DAG-specific:
                              unlock
[blocked] ──────────────────────────────────────► [queued]
     ▲                                               │
     │         dependency failed                     │
     └───────────────────────────────────────────────┘
```

### Valid Transitions by Command

| Command | From Status | To Status | Notes |
|---------|-------------|-----------|-------|
| `queue start` | queued | processing | Sets as current item |
| `queue complete` | processing | completed | Removes from queue |
| `queue fail` | processing | failed | Removes from queue |
| `queue fail --retry` | processing | queued | Moves to back of queue |
| `queue skip` | processing | skipped | Removes from queue |
| `stack push` | n/a | queued | Adds to top |
| `dag complete` | processing | completed | Unlocks dependents |
| `dag fail` | processing | failed | May block dependents |

### Session Status Transitions

```
┌───────────┐    worker init    ┌────────┐
│ spawning  │ ─────────────────►│  idle  │
└───────────┘                   └────────┘
                                    │
                                    │ start task
                                    ▼
                               ┌─────────┐
                               │ working │◄──┐
                               └─────────┘   │
                                    │        │
                          complete/ │        │ start next
                          fail task │        │
                                    ▼        │
                               ┌─────────┐   │
                               │  idle   │───┘
                               └─────────┘
                                    │
                         all tasks  │
                         done       │
                                    ▼
                              ┌───────────┐
                              │ completed │
                              └───────────┘

Any state can transition to 'stopped' or 'failed'
```

## Command-to-Status Mapping

### Queue Worker

| CLI Command | Item Status Change | Session Status Change | WebSocket Events |
|-------------|-------------------|----------------------|------------------|
| `worker init` | All tasks → queued | spawning → idle | `worker:initialized`, `ds:initialized` |
| `queue start` | queued → processing | idle → working | `ds:item_status_changed`, `ds:current_item_changed` |
| `queue complete` | processing → completed | working → idle | `ds:item_removed`, `ds:current_item_changed`, `task:session_status_updated` |
| `queue fail` | processing → failed | working → idle | `ds:item_removed`, `task:session_status_updated` |
| `queue skip` | processing → skipped | working → idle | `ds:item_removed` |
| `queue add` | n/a → queued | - | `ds:item_added` |

### Stack Worker

| CLI Command | Item Status Change | Session Status Change | WebSocket Events |
|-------------|-------------------|----------------------|------------------|
| `stack start` | queued → processing | idle → working | Same as queue |
| `stack complete` | processing → completed | working → idle | Same as queue |
| `stack push` | n/a → queued | - | `ds:item_added` |

### DAG Worker

| CLI Command | Item Status Change | Session Status Change | WebSocket Events |
|-------------|-------------------|----------------------|------------------|
| `dag start <id>` | queued → processing | idle → working | Same as queue |
| `dag complete` | processing → completed, blocked → queued (dependents) | working → idle | `ds:dag_unlocked` |
| `dag fail` | processing → failed, (dependents) → blocked | working → idle | `ds:item_status_changed` (multiple) |

### Priority Worker

Same as Queue Worker, with `priority` prefix.

## Task Session Status

When a task is in a session, we track its status per-session:

```typescript
interface TaskSessionStatus {
  taskId: string;
  sessionId: string;
  status: SessionItemStatus;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  duration?: number;
  notes?: string;
  error?: string;
}
```

This enables:
- Same task in multiple sessions with different statuses
- Historical tracking of task processing
- Aggregation for task progress across sessions

## UI Status Display

### Task List View

```
┌──────────────────────────────────────────────────────────────┐
│ Task: Implement user authentication                    [done] │
│                                                              │
│ Sessions:                                                    │
│   sess_abc123 (Queue): ✓ completed (15m)                     │
│   sess_def456 (DAG):   ⚙️ processing                          │
│   sess_ghi789 (Queue): ⏳ queued (position 3)                 │
└──────────────────────────────────────────────────────────────┘
```

### Session View

```
┌──────────────────────────────────────────────────────────────┐
│ Session: sess_abc123                    Worker Type: Queue   │
│ Status: Working                                              │
├──────────────────────────────────────────────────────────────┤
│ Queue (5 tasks):                                             │
│                                                              │
│  1. [⚙️ processing] Implement auth                            │
│  2. [⏳ queued]      Add user profile                         │
│  3. [⏳ queued]      Write tests                              │
│  4. [⏳ queued]      Update docs                              │
│  5. [⏳ queued]      Deploy                                   │
│                                                              │
│ History:                                                     │
│  ✓ Setup project (12m)                                       │
│  ✓ Install dependencies (2m)                                 │
└──────────────────────────────────────────────────────────────┘
```

## Status Synchronization

### When Worker Completes a Task

```typescript
async function handleTaskComplete(sessionId: string, taskId: string) {
  // 1. Update data structure item
  await dataStructure.markComplete(sessionId, taskId);

  // 2. Update task-session status
  await updateTaskSessionStatus(taskId, sessionId, 'completed');

  // 3. Check if all sessions have completed this task
  const allSessionStatuses = await getTaskSessionStatuses(taskId);
  const allCompleted = allSessionStatuses.every(s => s.status === 'completed');

  // 4. Optionally update user status (configurable)
  if (allCompleted && config.autoUpdateUserStatus) {
    await updateTaskUserStatus(taskId, 'done');
  }

  // 5. Emit events
  emit('ds:item_removed', { sessionId, taskId, reason: 'completed' });
  emit('task:session_status_updated', { taskId, sessionId, status: 'completed' });
}
```

### Status Priority for Display

When showing aggregated status:
1. `processing` > `queued` > `completed` > `failed` > `skipped`
2. If any session is processing, show processing
3. If any session is queued, show queued
4. Otherwise show most recent final status

## Auto-Status Updates (Optional)

Configurable automatic status updates:

```typescript
interface AutoStatusConfig {
  // Auto-update user status when all sessions complete
  autoCompleteTask: boolean;

  // Auto-fail task when all sessions fail
  autoFailTask: boolean;

  // Threshold for auto-complete (e.g., 0.8 = 80% of sessions)
  completionThreshold: number;
}
```

## Error Recovery

### Worker Crashes

If a worker crashes while processing:
1. Session status → `failed`
2. Current item status → `failed` (if `markFailedOnCrash: true`)
3. OR current item status → `queued` (if `retryOnCrash: true`)

```typescript
interface WorkerConfig {
  markFailedOnCrash: boolean;  // Default: false
  retryOnCrash: boolean;       // Default: true
  maxRetries: number;          // Default: 3
}
```

### Timeout Handling

```typescript
interface TimeoutConfig {
  taskTimeout: number;         // Per-task timeout (ms)
  sessionTimeout: number;      // Session-wide timeout (ms)
  onTimeout: 'fail' | 'skip' | 'retry';
}
```

## Status Reporting

### Session Summary

```typescript
interface SessionStatusSummary {
  sessionId: string;
  workerType: string;
  sessionStatus: SessionStatus;
  dataStructure: {
    type: string;
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
  timing: {
    startedAt: string;
    lastActivityAt: string;
    estimatedCompletion?: string;
  };
}
```

### Task Progress Across Sessions

```typescript
interface TaskProgressSummary {
  taskId: string;
  userStatus: TaskUserStatus;
  sessions: Array<{
    sessionId: string;
    workerType: string;
    status: SessionItemStatus;
    duration?: number;
    error?: string;
  }>;
  aggregateStatus: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'mixed';
}
```
