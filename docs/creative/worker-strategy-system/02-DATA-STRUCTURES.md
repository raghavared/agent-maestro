# Data Structures

## Overview

Each session owns a data structure that holds references to tasks. The data structure type is determined by the session's worker type.

## Core Types

```typescript
// Base item in any data structure
interface DataStructureItem {
  taskId: string;
  addedAt: string;           // ISO timestamp
  addedBy: 'user' | 'agent'; // Who added this item
  status: ItemStatus;
  metadata: Record<string, unknown>;
}

type ItemStatus =
  | 'queued'      // Waiting to be processed
  | 'processing'  // Currently being worked on
  | 'completed'   // Successfully completed
  | 'failed'      // Failed during processing
  | 'skipped'     // Skipped by worker
  | 'blocked';    // Blocked by dependency (DAG only)

// Base data structure interface
interface SessionDataStructure {
  sessionId: string;
  type: DataStructureType;
  items: DataStructureItem[];
  currentItem: DataStructureItem | null;  // Item being processed
  createdAt: string;
  updatedAt: string;
}

type DataStructureType = 'queue' | 'stack' | 'priority_queue' | 'dag' | 'circular_queue';
```

## Queue Structure

```typescript
interface QueueStructure extends SessionDataStructure {
  type: 'queue';
  // Items are processed FIFO (first in, first out)
  // items[0] is the front of the queue (next to process)
}

// Operations
interface QueueOperations {
  enqueue(item: DataStructureItem): void;  // Add to back
  dequeue(): DataStructureItem | null;      // Remove from front
  peek(): DataStructureItem | null;         // View front without removing
  size(): number;
  isEmpty(): boolean;
}
```

**Example State:**
```json
{
  "sessionId": "sess_abc",
  "type": "queue",
  "items": [
    { "taskId": "task_1", "status": "processing", "addedAt": "..." },
    { "taskId": "task_2", "status": "queued", "addedAt": "..." },
    { "taskId": "task_3", "status": "queued", "addedAt": "..." }
  ],
  "currentItem": { "taskId": "task_1", "status": "processing", ... }
}
```

## Stack Structure

```typescript
interface StackStructure extends SessionDataStructure {
  type: 'stack';
  // Items are processed LIFO (last in, first out)
  // items[0] is the top of the stack (next to process)
}

// Operations
interface StackOperations {
  push(item: DataStructureItem): void;     // Add to top
  pop(): DataStructureItem | null;          // Remove from top
  peek(): DataStructureItem | null;         // View top without removing
  size(): number;
  isEmpty(): boolean;
}
```

**Example State:**
```json
{
  "sessionId": "sess_abc",
  "type": "stack",
  "items": [
    { "taskId": "task_3", "status": "processing", "addedAt": "..." },
    { "taskId": "task_2", "status": "queued", "addedAt": "..." },
    { "taskId": "task_1", "status": "queued", "addedAt": "..." }
  ],
  "currentItem": { "taskId": "task_3", "status": "processing", ... }
}
```

## Priority Queue Structure

```typescript
interface PriorityQueueItem extends DataStructureItem {
  priority: number;  // 1 (low) to 5 (critical)
}

interface PriorityQueueStructure extends SessionDataStructure {
  type: 'priority_queue';
  items: PriorityQueueItem[];
  // Items sorted by priority (highest first), then by addedAt (FIFO for same priority)
}

// Operations
interface PriorityQueueOperations {
  insert(item: PriorityQueueItem): void;  // Insert maintaining priority order
  extractMax(): PriorityQueueItem | null;  // Remove highest priority
  peekMax(): PriorityQueueItem | null;     // View highest priority
  increasePriority(taskId: string, newPriority: number): void;
  size(): number;
  isEmpty(): boolean;
}
```

**Example State:**
```json
{
  "sessionId": "sess_abc",
  "type": "priority_queue",
  "items": [
    { "taskId": "task_2", "priority": 5, "status": "processing", "addedAt": "..." },
    { "taskId": "task_1", "priority": 3, "status": "queued", "addedAt": "..." },
    { "taskId": "task_3", "priority": 1, "status": "queued", "addedAt": "..." }
  ],
  "currentItem": { "taskId": "task_2", "priority": 5, "status": "processing", ... }
}
```

## DAG Structure

```typescript
interface DAGItem extends DataStructureItem {
  dependencies: string[];        // Task IDs this item depends on
  dependents: string[];          // Task IDs that depend on this item
  dependencyStatus: 'pending' | 'satisfied' | 'blocked';
}

interface DAGStructure extends SessionDataStructure {
  type: 'dag';
  items: DAGItem[];
  // Topological order maintained
}

// Operations
interface DAGOperations {
  addNode(item: DAGItem): void;
  addEdge(fromTaskId: string, toTaskId: string): void;  // fromTask must complete before toTask
  getReady(): DAGItem[];                                 // Items with all deps satisfied
  markComplete(taskId: string): void;                    // Updates dependent items
  markFailed(taskId: string, skipDependents: boolean): void;
  getStatus(): DAGStatus;
  toAscii(): string;                                     // ASCII visualization
}

interface DAGStatus {
  total: number;
  completed: number;
  processing: number;
  ready: number;
  blocked: number;
  failed: number;
}
```

**Example State:**
```json
{
  "sessionId": "sess_abc",
  "type": "dag",
  "items": [
    {
      "taskId": "task_1",
      "status": "completed",
      "dependencies": [],
      "dependents": ["task_2", "task_3"],
      "dependencyStatus": "satisfied"
    },
    {
      "taskId": "task_2",
      "status": "processing",
      "dependencies": ["task_1"],
      "dependents": ["task_4"],
      "dependencyStatus": "satisfied"
    },
    {
      "taskId": "task_3",
      "status": "queued",
      "dependencies": ["task_1"],
      "dependents": ["task_4"],
      "dependencyStatus": "satisfied"
    },
    {
      "taskId": "task_4",
      "status": "blocked",
      "dependencies": ["task_2", "task_3"],
      "dependents": [],
      "dependencyStatus": "pending"
    }
  ],
  "currentItem": { "taskId": "task_2", "status": "processing", ... }
}
```

**ASCII Visualization:**
```
    [task_1] ✓
    /       \
[task_2] ⚙️  [task_3] ⏳
    \       /
    [task_4] 🚫
```

## Circular Queue Structure

```typescript
interface CircularQueueStructure extends SessionDataStructure {
  type: 'circular_queue';
  currentIndex: number;  // Current position in rotation
  // Items stay in queue until explicitly completed
}

// Operations
interface CircularQueueOperations {
  add(item: DataStructureItem): void;
  current(): DataStructureItem | null;
  next(): DataStructureItem | null;      // Move to next, wrap around
  previous(): DataStructureItem | null;  // Move to previous
  complete(taskId: string): void;         // Remove from rotation
  size(): number;
  isEmpty(): boolean;
}
```

**Example State:**
```json
{
  "sessionId": "sess_abc",
  "type": "circular_queue",
  "currentIndex": 1,
  "items": [
    { "taskId": "task_1", "status": "queued", "progressNotes": ["Started implementation"] },
    { "taskId": "task_2", "status": "processing", "progressNotes": ["50% done"] },
    { "taskId": "task_3", "status": "queued", "progressNotes": [] }
  ],
  "currentItem": { "taskId": "task_2", "status": "processing", ... }
}
```

## Storage Schema

Data structures are stored per session:

```
~/.maestro/data/
  projects/
    {projectId}/
      sessions/
        {sessionId}.json
      session-data-structures/
        {sessionId}-ds.json      # Data structure state
      tasks/
        {taskId}.json
```

**Session Data Structure File:**
```json
{
  "sessionId": "sess_abc123",
  "type": "queue",
  "items": [...],
  "currentItem": {...},
  "history": [
    { "taskId": "task_0", "status": "completed", "completedAt": "..." },
    { "taskId": "task_x", "status": "failed", "failedAt": "...", "error": "..." }
  ],
  "stats": {
    "totalProcessed": 5,
    "completed": 4,
    "failed": 1,
    "averageProcessingTime": 45000
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Data Structure Events

WebSocket events for real-time updates:

```typescript
// Item added to data structure
interface DSItemAddedEvent {
  type: 'ds:item_added';
  sessionId: string;
  item: DataStructureItem;
  position: number;  // Where in the structure
}

// Item status changed
interface DSItemStatusChangedEvent {
  type: 'ds:item_status_changed';
  sessionId: string;
  taskId: string;
  previousStatus: ItemStatus;
  newStatus: ItemStatus;
}

// Current item changed
interface DSCurrentItemChangedEvent {
  type: 'ds:current_item_changed';
  sessionId: string;
  previousTaskId: string | null;
  currentTaskId: string | null;
}

// Data structure reordered (priority change, etc.)
interface DSReorderedEvent {
  type: 'ds:reordered';
  sessionId: string;
  newOrder: string[];  // Task IDs in new order
}
```

## Concurrency Considerations

1. **Single Writer**: Only one agent (the session's worker) can modify the data structure
2. **Multiple Readers**: UI and other clients can read via API
3. **Optimistic Locking**: Include `updatedAt` in modifications to detect conflicts
4. **Event Sourcing**: Consider storing operations for replay/audit

```typescript
interface DataStructureOperation {
  id: string;
  sessionId: string;
  operation: 'add' | 'remove' | 'update_status' | 'reorder';
  payload: unknown;
  timestamp: string;
  actor: 'user' | 'agent';
}
```
