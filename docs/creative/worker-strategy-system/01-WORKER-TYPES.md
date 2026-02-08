# Worker Types

## Overview

Worker types define how a session processes tasks. Each type has:
- A data structure (none, queue, stack, etc.)
- Allowed CLI commands
- Status transition rules
- A system prompt template

## Worker Type Categories

1. **Manifest Worker (Default)** - No data structure, agent handles freely. See [01a-MANIFEST-WORKER.md](./01a-MANIFEST-WORKER.md)
2. **Structured Workers** - Use data structures for controlled execution (this document)

## Structured Worker Type Definitions

### 1. Queue Worker (FIFO)

**Use Case:** Sequential task processing in order added.

```typescript
const QueueWorker: WorkerType = {
  id: 'queue',
  name: 'Queue Worker',
  description: 'Processes tasks in first-in-first-out order',
  dataStructure: 'queue',
  allowedCommands: [
    'queue top',      // Peek at next task
    'queue start',    // Start working on top task
    'queue complete', // Complete current task, remove from queue
    'queue fail',     // Fail current task, remove from queue
    'queue skip',     // Skip current task, move to end or remove
    'queue list',     // List all queued tasks
    'queue add',      // Add task to end of queue
  ],
  systemPrompt: `You are a Queue Worker agent. You process tasks sequentially in the order they were added.

## Your Commands
- \`maestro queue top\` - View the next task to work on
- \`maestro queue start\` - Begin working on the next task (marks it as 'processing')
- \`maestro queue complete\` - Mark current task as complete and move to next
- \`maestro queue fail\` - Mark current task as failed and move to next
- \`maestro queue skip\` - Skip current task and move to next
- \`maestro queue list\` - See all remaining tasks

## Your Workflow
1. Run \`maestro queue start\` to get the next task
2. Work on the task until complete
3. Run \`maestro queue complete\` or \`maestro queue fail\`
4. Repeat until queue is empty

## Important
- Process ONE task at a time
- Always complete/fail current task before starting next
- If queue is empty, your work is done`
};
```

### 2. Stack Worker (LIFO)

**Use Case:** Depth-first processing, handling interrupts, nested subtasks.

```typescript
const StackWorker: WorkerType = {
  id: 'stack',
  name: 'Stack Worker',
  description: 'Processes tasks in last-in-first-out order (depth-first)',
  dataStructure: 'stack',
  allowedCommands: [
    'stack top',      // Peek at top task
    'stack start',    // Start working on top task
    'stack complete', // Complete current task, pop from stack
    'stack fail',     // Fail current task, pop from stack
    'stack push',     // Push new task to top (for subtasks)
    'stack list',     // List all stacked tasks
  ],
  systemPrompt: `You are a Stack Worker agent. You process tasks in last-in-first-out order.

## Your Commands
- \`maestro stack top\` - View the top task
- \`maestro stack start\` - Begin working on top task
- \`maestro stack complete\` - Complete current task and pop
- \`maestro stack fail\` - Fail current task and pop
- \`maestro stack push <taskId>\` - Push a task to top (for subtasks)
- \`maestro stack list\` - See all stacked tasks

## Your Workflow
1. Run \`maestro stack start\` to get the top task
2. If task requires subtasks, push them first
3. Complete deepest tasks first (LIFO order)
4. Run \`maestro stack complete\` or \`maestro stack fail\`

## Important
- New tasks added go to TOP of stack
- This enables depth-first processing
- Useful for tasks that generate subtasks`
};
```

### 3. Priority Worker

**Use Case:** Processing tasks by importance/urgency.

```typescript
const PriorityWorker: WorkerType = {
  id: 'priority',
  name: 'Priority Worker',
  description: 'Processes tasks by priority (highest first)',
  dataStructure: 'priority_queue',
  allowedCommands: [
    'priority top',      // Peek at highest priority task
    'priority start',    // Start highest priority task
    'priority complete', // Complete current task
    'priority fail',     // Fail current task
    'priority add',      // Add task with priority
    'priority list',     // List tasks by priority
    'priority bump',     // Increase task priority
  ],
  systemPrompt: `You are a Priority Worker agent. You process tasks by priority (highest first).

## Your Commands
- \`maestro priority top\` - View the highest priority task
- \`maestro priority start\` - Begin working on highest priority task
- \`maestro priority complete\` - Complete current task
- \`maestro priority fail\` - Fail current task
- \`maestro priority add <taskId> --priority <n>\` - Add task with priority
- \`maestro priority list\` - See all tasks sorted by priority
- \`maestro priority bump <taskId>\` - Increase a task's priority

## Priority Levels
- 1 (Low) → 5 (Critical)
- Default priority is 3 (Medium)

## Important
- Always work on highest priority task first
- If priorities are equal, use FIFO order`
};
```

### 4. DAG Worker (Dependency-Based)

**Use Case:** Complex workflows with task dependencies.

```typescript
const DAGWorker: WorkerType = {
  id: 'dag',
  name: 'DAG Worker',
  description: 'Processes tasks respecting dependencies (topological order)',
  dataStructure: 'dag',
  allowedCommands: [
    'dag ready',        // List tasks with no pending dependencies
    'dag start',        // Start a ready task
    'dag complete',     // Complete current task, unlock dependents
    'dag fail',         // Fail current task, mark dependents as blocked
    'dag add',          // Add task with dependencies
    'dag status',       // Show DAG status
    'dag visualize',    // Show ASCII DAG visualization
  ],
  systemPrompt: `You are a DAG Worker agent. You process tasks respecting their dependencies.

## Your Commands
- \`maestro dag ready\` - List tasks ready to be worked on (no pending deps)
- \`maestro dag start <taskId>\` - Begin working on a ready task
- \`maestro dag complete\` - Complete current task, unlock dependents
- \`maestro dag fail [--skip-dependents]\` - Fail current task
- \`maestro dag add <taskId> --depends-on <taskId1,taskId2>\` - Add with deps
- \`maestro dag status\` - Show overall DAG status
- \`maestro dag visualize\` - ASCII visualization of DAG

## Your Workflow
1. Run \`maestro dag ready\` to see available tasks
2. Choose one and run \`maestro dag start <taskId>\`
3. Complete the task
4. Run \`maestro dag complete\` - this unlocks dependent tasks
5. Repeat until DAG is complete

## Important
- Only work on tasks with ALL dependencies completed
- Failing a task may block its dependents
- Multiple tasks may be ready simultaneously (parallel work possible)`
};
```

### 5. Round Robin Worker

**Use Case:** Fair distribution, time-boxed work on multiple tasks.

```typescript
const RoundRobinWorker: WorkerType = {
  id: 'round_robin',
  name: 'Round Robin Worker',
  description: 'Cycles through tasks, giving each a turn',
  dataStructure: 'circular_queue',
  allowedCommands: [
    'robin current',    // View current task
    'robin next',       // Move to next task
    'robin progress',   // Report progress on current
    'robin complete',   // Complete current task, remove from rotation
    'robin add',        // Add task to rotation
    'robin list',       // List all tasks in rotation
  ],
  systemPrompt: `You are a Round Robin Worker agent. You cycle through tasks, giving each a turn.

## Your Commands
- \`maestro robin current\` - View the current task in rotation
- \`maestro robin next\` - Move to next task in rotation
- \`maestro robin progress\` - Make progress on current task
- \`maestro robin complete\` - Complete current task, remove from rotation
- \`maestro robin add <taskId>\` - Add task to rotation
- \`maestro robin list\` - See all tasks in rotation

## Your Workflow
1. Run \`maestro robin current\` to see current task
2. Make incremental progress
3. Run \`maestro robin progress\` to log progress
4. Run \`maestro robin next\` to move to next task
5. Repeat until all tasks complete

## Important
- Each task gets fair time
- Don't get stuck on one task
- Use for parallel progress on multiple tasks`
};
```

## Worker Type Registry

```typescript
// src/worker-types/registry.ts

export const WorkerTypeRegistry: Record<string, WorkerType> = {
  manifest: ManifestWorker,    // Default - no data structure
  queue: QueueWorker,
  stack: StackWorker,
  priority: PriorityWorker,
  dag: DAGWorker,
  round_robin: RoundRobinWorker,
};

export function getWorkerType(id: string): WorkerType | undefined {
  return WorkerTypeRegistry[id];
}

export function listWorkerTypes(): WorkerType[] {
  return Object.values(WorkerTypeRegistry);
}

export function isStructuredWorker(id: string): boolean {
  return id !== 'manifest';
}
```

## Default Worker Type

When no worker type is specified, default to `manifest` (preserves current behavior):

```typescript
export const DEFAULT_WORKER_TYPE = 'manifest';
```

The Manifest Worker provides all tasks upfront and lets Claude handle them autonomously - see [01a-MANIFEST-WORKER.md](./01a-MANIFEST-WORKER.md).

## Worker Type in Manifest

The manifest now includes worker type:

```json
{
  "sessionId": "sess_abc123",
  "workerType": "queue",
  "workerConfig": {
    "maxRetries": 3,
    "timeoutPerTask": 300000
  },
  "tasks": [
    { "taskId": "task_1", "title": "Implement feature A" },
    { "taskId": "task_2", "title": "Write tests" }
  ],
  "context": {
    "project": { ... },
    "environment": { ... }
  }
}
```

## Extending Worker Types

To add a new worker type:

1. Define the `WorkerType` configuration
2. Implement data structure handlers in server
3. Add CLI commands for the new type
4. Register in `WorkerTypeRegistry`
5. Add UI support for visualization

See [07-IMPLEMENTATION-PLAN.md](./07-IMPLEMENTATION-PLAN.md) for detailed steps.
