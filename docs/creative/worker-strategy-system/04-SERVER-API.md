# Server API

## Overview

New API endpoints for managing session data structures and worker operations.

## API Structure

```
/api/sessions/{sessionId}/ds              # Data structure operations
/api/sessions/{sessionId}/ds/queue        # Queue-specific operations
/api/sessions/{sessionId}/ds/stack        # Stack-specific operations
/api/sessions/{sessionId}/ds/dag          # DAG-specific operations
/api/sessions/{sessionId}/ds/priority     # Priority queue operations
/api/worker-types                         # Worker type definitions
```

---

## Worker Types API

### GET /api/worker-types

List all available worker types.

```typescript
// Response
{
  "workerTypes": [
    {
      "id": "queue",
      "name": "Queue Worker",
      "description": "Processes tasks in first-in-first-out order",
      "dataStructure": "queue",
      "allowedCommands": ["queue top", "queue start", ...]
    },
    // ... other worker types
  ]
}
```

### GET /api/worker-types/:typeId

Get a specific worker type definition.

```typescript
// Response
{
  "id": "queue",
  "name": "Queue Worker",
  "description": "Processes tasks in first-in-first-out order",
  "dataStructure": "queue",
  "allowedCommands": [...],
  "systemPrompt": "You are a Queue Worker agent..."
}
```

---

## Data Structure API (Generic)

### GET /api/sessions/:sessionId/ds

Get the session's data structure state.

```typescript
// Response
{
  "sessionId": "sess_abc123",
  "type": "queue",
  "items": [
    { "taskId": "task_1", "status": "processing", "addedAt": "..." },
    { "taskId": "task_2", "status": "queued", "addedAt": "..." }
  ],
  "currentItem": { "taskId": "task_1", ... },
  "stats": {
    "total": 5,
    "queued": 3,
    "processing": 1,
    "completed": 1,
    "failed": 0
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

### POST /api/sessions/:sessionId/ds/initialize

Initialize the data structure for a session.

```typescript
// Request
{
  "workerType": "queue",
  "tasks": [
    { "taskId": "task_1", "priority": 3 },
    { "taskId": "task_2", "priority": 5 },
    { "taskId": "task_3", "dependencies": ["task_1"] }
  ]
}

// Response
{
  "success": true,
  "sessionId": "sess_abc123",
  "type": "queue",
  "itemCount": 3,
  "message": "Data structure initialized with 3 tasks"
}
```

### DELETE /api/sessions/:sessionId/ds

Clear/reset the data structure.

```typescript
// Response
{
  "success": true,
  "message": "Data structure cleared"
}
```

---

## Queue API

### GET /api/sessions/:sessionId/ds/queue

Get queue state.

```typescript
// Response
{
  "sessionId": "sess_abc123",
  "type": "queue",
  "size": 5,
  "items": [...],
  "currentItem": {...} | null,
  "front": {...} | null,
  "isEmpty": false
}
```

### GET /api/sessions/:sessionId/ds/queue/front

Peek at the front of the queue.

```typescript
// Response
{
  "item": {
    "taskId": "task_abc123",
    "status": "queued",
    "addedAt": "...",
    "task": {
      "id": "task_abc123",
      "title": "Implement auth",
      "description": "..."
    }
  },
  "position": 1,
  "totalItems": 5
}
```

### POST /api/sessions/:sessionId/ds/queue/enqueue

Add a task to the back of the queue.

```typescript
// Request
{
  "taskId": "task_new123",
  "addedBy": "user",
  "position": "back" | "front" | number  // Optional, default "back"
}

// Response
{
  "success": true,
  "item": { "taskId": "task_new123", "status": "queued", ... },
  "position": 6,
  "totalItems": 6
}
```

### POST /api/sessions/:sessionId/ds/queue/dequeue

Remove and return the front of the queue.

```typescript
// Response
{
  "success": true,
  "item": { "taskId": "task_abc123", ... },
  "remainingItems": 4
}
```

### POST /api/sessions/:sessionId/ds/queue/start

Start processing the front task.

```typescript
// Response
{
  "success": true,
  "item": {
    "taskId": "task_abc123",
    "status": "processing",
    "startedAt": "...",
    "task": {
      "id": "task_abc123",
      "title": "Implement auth",
      "description": "..."
    }
  }
}
```

### POST /api/sessions/:sessionId/ds/queue/complete

Complete the current task.

```typescript
// Request
{
  "message": "Implemented JWT auth successfully"  // Optional
}

// Response
{
  "success": true,
  "completedItem": {
    "taskId": "task_abc123",
    "status": "completed",
    "completedAt": "...",
    "duration": 932000  // ms
  },
  "nextItem": { ... } | null,
  "remainingItems": 4
}
```

### POST /api/sessions/:sessionId/ds/queue/fail

Fail the current task.

```typescript
// Request
{
  "reason": "Missing API credentials",
  "retry": false  // If true, move to back of queue
}

// Response
{
  "success": true,
  "failedItem": {
    "taskId": "task_abc123",
    "status": "failed",
    "failedAt": "...",
    "reason": "Missing API credentials"
  },
  "nextItem": { ... } | null,
  "remainingItems": 4
}
```

### POST /api/sessions/:sessionId/ds/queue/skip

Skip the current task.

```typescript
// Request
{
  "reason": "Blocked by external dependency"
}

// Response
{
  "success": true,
  "skippedItem": { ... },
  "nextItem": { ... } | null
}
```

---

## Stack API

### GET /api/sessions/:sessionId/ds/stack

Get stack state.

### GET /api/sessions/:sessionId/ds/stack/top

Peek at the top of the stack.

### POST /api/sessions/:sessionId/ds/stack/push

Push a task onto the stack.

```typescript
// Request
{
  "taskId": "task_subtask123",
  "addedBy": "agent"
}

// Response
{
  "success": true,
  "item": { ... },
  "stackDepth": 4
}
```

### POST /api/sessions/:sessionId/ds/stack/pop

Pop and return the top task.

### POST /api/sessions/:sessionId/ds/stack/start

Start processing the top task.

### POST /api/sessions/:sessionId/ds/stack/complete

Complete and pop the top task.

### POST /api/sessions/:sessionId/ds/stack/fail

Fail and pop the top task.

---

## DAG API

### GET /api/sessions/:sessionId/ds/dag

Get DAG state.

```typescript
// Response
{
  "sessionId": "sess_abc123",
  "type": "dag",
  "nodes": [...],
  "edges": [...],
  "currentItem": {...} | null,
  "stats": {
    "total": 10,
    "completed": 4,
    "processing": 1,
    "ready": 2,
    "blocked": 3,
    "failed": 0
  }
}
```

### GET /api/sessions/:sessionId/ds/dag/ready

Get tasks ready to be processed (dependencies satisfied).

```typescript
// Response
{
  "readyTasks": [
    {
      "taskId": "task_abc123",
      "task": { ... },
      "dependents": ["task_def456", "task_ghi789"]
    }
  ]
}
```

### POST /api/sessions/:sessionId/ds/dag/add

Add a task with dependencies.

```typescript
// Request
{
  "taskId": "task_new123",
  "dependencies": ["task_abc123", "task_def456"]
}

// Response
{
  "success": true,
  "item": {
    "taskId": "task_new123",
    "status": "blocked",
    "dependencies": ["task_abc123", "task_def456"],
    "dependencyStatus": "pending"
  }
}
```

### POST /api/sessions/:sessionId/ds/dag/start

Start processing a specific ready task.

```typescript
// Request
{
  "taskId": "task_abc123"
}

// Response
{
  "success": true,
  "item": { ... }
}
```

### POST /api/sessions/:sessionId/ds/dag/complete

Complete the current task and update dependents.

```typescript
// Response
{
  "success": true,
  "completedItem": { ... },
  "unlockedTasks": [
    { "taskId": "task_def456", "nowReady": true },
    { "taskId": "task_ghi789", "nowReady": false, "pendingDeps": 1 }
  ]
}
```

### POST /api/sessions/:sessionId/ds/dag/fail

Fail the current task.

```typescript
// Request
{
  "reason": "Schema validation failed",
  "skipDependents": false
}

// Response
{
  "success": true,
  "failedItem": { ... },
  "blockedTasks": ["task_def456", "task_ghi789"]
}
```

### GET /api/sessions/:sessionId/ds/dag/visualize

Get ASCII visualization.

```typescript
// Response
{
  "visualization": "       [task_1] ✓\n           │\n      [task_2] ⚙️\n...",
  "legend": {
    "✓": "completed",
    "⚙️": "processing",
    "⏳": "ready",
    "🔒": "blocked",
    "🚫": "failed"
  }
}
```

---

## Priority Queue API

### GET /api/sessions/:sessionId/ds/priority

Get priority queue state.

### GET /api/sessions/:sessionId/ds/priority/top

Get highest priority task.

### POST /api/sessions/:sessionId/ds/priority/insert

Insert a task with priority.

```typescript
// Request
{
  "taskId": "task_urgent123",
  "priority": 5,
  "addedBy": "user"
}

// Response
{
  "success": true,
  "item": { "taskId": "task_urgent123", "priority": 5, ... },
  "position": 1
}
```

### POST /api/sessions/:sessionId/ds/priority/start

Start processing highest priority task.

### POST /api/sessions/:sessionId/ds/priority/complete

Complete current task.

### POST /api/sessions/:sessionId/ds/priority/fail

Fail current task.

### PATCH /api/sessions/:sessionId/ds/priority/:taskId

Update a task's priority.

```typescript
// Request
{
  "priority": 4
}

// Response
{
  "success": true,
  "item": { "taskId": "...", "priority": 4, ... },
  "previousPosition": 5,
  "newPosition": 2
}
```

---

## WebSocket Events

### Data Structure Events

```typescript
// Item added to data structure
{
  "type": "ds:item_added",
  "sessionId": "sess_abc123",
  "item": { "taskId": "...", "status": "queued", ... },
  "position": 6,
  "dataStructureType": "queue"
}

// Item status changed
{
  "type": "ds:item_status_changed",
  "sessionId": "sess_abc123",
  "taskId": "task_abc123",
  "previousStatus": "queued",
  "newStatus": "processing"
}

// Current item changed (started/completed/failed)
{
  "type": "ds:current_item_changed",
  "sessionId": "sess_abc123",
  "previousTaskId": "task_abc123",
  "currentTaskId": "task_def456"
}

// Item removed (completed/failed/skipped)
{
  "type": "ds:item_removed",
  "sessionId": "sess_abc123",
  "item": { ... },
  "reason": "completed" | "failed" | "skipped"
}

// Data structure reordered (priority bump, etc.)
{
  "type": "ds:reordered",
  "sessionId": "sess_abc123",
  "newOrder": ["task_1", "task_2", "task_3"]
}

// DAG-specific: Tasks unlocked
{
  "type": "ds:dag_unlocked",
  "sessionId": "sess_abc123",
  "completedTaskId": "task_abc123",
  "unlockedTasks": [
    { "taskId": "task_def456", "nowReady": true }
  ]
}
```

---

## Implementation Notes

### Server Structure

```
maestro-server/src/
├── routes/
│   ├── sessions.ts          # Existing session routes
│   ├── sessions-ds.ts       # Data structure routes
│   └── worker-types.ts      # Worker type routes
├── services/
│   ├── data-structures/
│   │   ├── index.ts         # Factory & common logic
│   │   ├── queue.ts         # Queue implementation
│   │   ├── stack.ts         # Stack implementation
│   │   ├── dag.ts           # DAG implementation
│   │   └── priority.ts      # Priority queue implementation
│   └── worker-types.ts      # Worker type registry
├── storage/
│   └── data-structure-store.ts  # Persistence layer
└── events/
    └── ds-events.ts         # WebSocket event emitters
```

### Route Registration

```typescript
// src/routes/sessions-ds.ts
import { Router } from 'express';
import { DataStructureService } from '../services/data-structures';

const router = Router({ mergeParams: true });

// Generic endpoints
router.get('/', getDataStructure);
router.post('/initialize', initializeDataStructure);
router.delete('/', clearDataStructure);

// Queue endpoints
router.get('/queue', getQueue);
router.get('/queue/front', getQueueFront);
router.post('/queue/enqueue', enqueue);
router.post('/queue/dequeue', dequeue);
router.post('/queue/start', queueStart);
router.post('/queue/complete', queueComplete);
router.post('/queue/fail', queueFail);
router.post('/queue/skip', queueSkip);

// ... similar for stack, dag, priority

export default router;
```

### Error Handling

```typescript
// Error types
class DataStructureError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

class EmptyDataStructureError extends DataStructureError {
  constructor(type: string) {
    super(`${type} is empty`, 'DS_EMPTY', 400);
  }
}

class InvalidOperationError extends DataStructureError {
  constructor(operation: string, workerType: string) {
    super(
      `Operation '${operation}' not valid for ${workerType} worker`,
      'INVALID_OPERATION',
      400
    );
  }
}

class NoCurrentItemError extends DataStructureError {
  constructor() {
    super('No task is currently being processed', 'NO_CURRENT_ITEM', 400);
  }
}
```
