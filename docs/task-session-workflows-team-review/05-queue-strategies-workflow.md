# 05 - Queue System and Worker/Orchestrator Strategies Review

## Overview

The queue system and strategy framework form the execution layer of agent-maestro. Strategies determine **how** tasks are assigned to sessions and **how** sessions process those tasks. The queue is the server-side data structure that enables the `queue` worker strategy's FIFO processing model.

---

## 1. Core Types

### 1.1 QueueItem

**File:** `maestro-server/src/types.ts:5-12`

```typescript
interface QueueItem {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  failReason?: string;
}
```

| Field | Description |
|-------|-------------|
| `taskId` | Reference to the task this queue item represents |
| `status` | Current processing status (see state machine below) |
| `addedAt` | Epoch timestamp when the item was added to the queue |
| `startedAt` | Epoch timestamp when processing began (set on `startItem`) |
| `completedAt` | Epoch timestamp when processing ended (set on complete/fail/skip) |
| `failReason` | Optional reason string, only set when status is `failed` |

**QueueItem Status Transitions:**

```
queued --> processing --> completed
                     --> failed
                     --> skipped
queued --> skipped  (can skip without starting)
```

- `queued`: Initial state when added to the queue
- `processing`: Claimed by the session, actively being worked on. Only one item can be `processing` at a time.
- `completed`: Successfully finished
- `failed`: Could not be completed (has optional `failReason`)
- `skipped`: Deliberately skipped (either while processing or while still queued)

### 1.2 QueueState

**File:** `maestro-server/src/types.ts:14-21`

```typescript
interface QueueState {
  sessionId: string;
  strategy: WorkerStrategy;
  items: QueueItem[];
  currentIndex: number;  // -1 if no item is being processed
  createdAt: number;
  updatedAt: number;
}
```

| Field | Description |
|-------|-------------|
| `sessionId` | The session this queue belongs to (1:1 relationship) |
| `strategy` | Always `'queue'` (hardcoded in `FileSystemQueueRepository.create`) |
| `items` | Ordered array of QueueItem objects |
| `currentIndex` | Index into `items` of the currently processing item; `-1` when idle |
| `createdAt` | Epoch timestamp when the queue was created |
| `updatedAt` | Epoch timestamp of the last modification |

### 1.3 Strategy Types

**File:** `maestro-server/src/types.ts:1-3`

```typescript
type WorkerStrategy = 'simple' | 'queue' | 'tree';
type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';
```

Note: The CLI manifest types (`maestro-cli/src/types/manifest.ts:10`) define `WorkerStrategy` as only `'simple' | 'queue'` -- the `'tree'` variant is missing from the CLI type definition but is present in the server types and validated in the spawn endpoint.

---

## 2. QueueService

**File:** `maestro-server/src/application/services/QueueService.ts`

The QueueService is the application-layer service that manages queue lifecycle and item transitions. It coordinates between the queue repository, task repository, session repository, and event bus.

### Constructor Dependencies

- `IQueueRepository` -- persistence for queue state
- `ITaskRepository` -- to update task sessionStatus in sync with queue transitions
- `ISessionRepository` -- to verify sessions exist during initialization
- `IEventBus` -- to emit queue lifecycle events

### Methods

| Method | Description | Events Emitted |
|--------|-------------|----------------|
| `initializeQueue(sessionId, taskIds)` | Creates a new queue for a session. Validates session and all tasks exist. Fails if queue already exists. | `queue:created` |
| `getQueue(sessionId)` | Returns the QueueState. Throws `NotFoundError` if not found. | -- |
| `getTopItem(sessionId)` | Peeks at the next `queued` item without changing state. Returns `null` if no queued items remain. | -- |
| `getCurrentItem(sessionId)` | Returns the item at `currentIndex` if its status is `processing`, otherwise `null`. | -- |
| `startItem(sessionId)` | Finds the next `queued` item, sets it to `processing`, updates `currentIndex`, and sets the task's `sessionStatus` to `working`. Throws if already processing an item. | `queue:item_started` |
| `completeItem(sessionId)` | Marks the current `processing` item as `completed`, resets `currentIndex` to `-1`, updates task `sessionStatus` to `completed`. | `queue:item_completed` |
| `failItem(sessionId, reason?)` | Marks the current `processing` item as `failed` with optional reason, resets `currentIndex` to `-1`, updates task `sessionStatus` to `failed`. | `queue:item_failed` |
| `skipItem(sessionId)` | Skips either the current `processing` item or the next `queued` item. Resets `currentIndex` if skipping current. Updates task `sessionStatus` to `skipped`. | `queue:item_skipped` |
| `pushItem(sessionId, taskId)` | Adds a new task to an existing queue. Validates task exists and is not a duplicate. | `queue:item_pushed` |
| `listItems(sessionId)` | Returns all items in the queue. | -- |
| `getStats(sessionId)` | Returns counts by status: total, queued, processing, completed, failed, skipped. | -- |
| `hasQueue(sessionId)` | Boolean check for queue existence. | -- |
| `deleteQueue(sessionId)` | Deletes the queue entirely. | `queue:deleted` |

### Key Behaviors

1. **Single-item processing**: Only one item can be in `processing` state at a time. `startItem` enforces this by checking `getCurrentItem` first.
2. **Task status sync**: When a queue item transitions, the corresponding task's `sessionStatus` is updated (e.g., `working`, `completed`, `failed`). However, `skipItem` does NOT update the task's `sessionStatus` -- this appears to be an inconsistency (see Issues section).
3. **FIFO ordering**: `getTopItem` and `startItem` both use `Array.find` to locate the first `queued` item, preserving insertion order.

---

## 3. IQueueRepository and FileSystemQueueRepository

### IQueueRepository Interface

**File:** `maestro-server/src/domain/repositories/IQueueRepository.ts`

Methods: `create`, `findBySessionId`, `update`, `delete`, `addItems`, `updateItem`, `exists`.

### FileSystemQueueRepository

**File:** `maestro-server/src/infrastructure/repositories/FileSystemQueueRepository.ts`

- **Storage**: Each queue is saved as `<dataDir>/queues/<sessionId>.json`
- **In-memory cache**: Uses a `Map<string, QueueState>` for fast reads
- **Lazy initialization**: Loads all queue files on first access via `ensureInitialized()`
- **Write-through**: Every mutation writes to both the in-memory Map and the JSON file

Key implementation details:
- `create()` hardcodes `strategy: 'queue'` in the QueueState
- `update()` only allows updating `items` and `currentIndex` fields (ignores other partial updates)
- `updateItem()` uses spread merge: `{ ...existingItem, ...updates }` which allows any QueueItem field to be overwritten

---

## 4. Queue API Endpoints

**File:** `maestro-server/src/api/queueRoutes.ts`

All endpoints are scoped to a session and verify the session uses the `queue` strategy before proceeding.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/:id/queue` | Get full queue state + stats |
| `GET` | `/api/sessions/:id/queue/top` | Peek at next queued item |
| `POST` | `/api/sessions/:id/queue/start` | Start processing next item. Returns `{ empty: true }` if no items available (does NOT throw) |
| `POST` | `/api/sessions/:id/queue/complete` | Complete current item, returns completed item + next item |
| `POST` | `/api/sessions/:id/queue/fail` | Fail current item (body: `{ reason }`) |
| `POST` | `/api/sessions/:id/queue/skip` | Skip current/next item |
| `GET` | `/api/sessions/:id/queue/items` | List all items with stats |
| `POST` | `/api/sessions/:id/queue/push` | Push new task (body: `{ taskId }`) |

The `start` endpoint has a special guard: it checks `getTopItem` first and returns a success response with `empty: true` and `item: null` if the queue has no queued items. This differs from the service layer which throws a `ValidationError` -- the route provides a friendlier response for the polling pattern used by the CLI.

---

## 5. Queue CLI Commands

**File:** `maestro-cli/src/commands/queue.ts`

All commands require `MAESTRO_SESSION_ID` to be set (injected by the spawner). Commands:

| CLI Command | API Call | Notes |
|-------------|----------|-------|
| `maestro queue top` | `GET /api/sessions/:id/queue/top` | Shows next task info |
| `maestro queue start` | `POST /api/sessions/:id/queue/start` | **Polling mode**: if queue is empty, polls every N seconds (default 10s) for up to M minutes (default 30m). Handles SIGINT/SIGTERM gracefully. |
| `maestro queue complete` | `POST /api/sessions/:id/queue/complete` | Shows completed item + next item |
| `maestro queue fail --reason <reason>` | `POST /api/sessions/:id/queue/fail` | Passes reason in body |
| `maestro queue skip` | `POST /api/sessions/:id/queue/skip` | Shows skipped item + next item |
| `maestro queue list` | `GET /api/sessions/:id/queue/items` | Displays stats + all items with status icons |
| `maestro queue push <taskId>` | `POST /api/sessions/:id/queue/push` | Adds task to queue |
| `maestro queue status` | `GET /api/sessions/:id/queue` | Shows session/queue summary |

### Polling Behavior in `queue start`

The `start` command implements a blocking poll loop:
1. First attempt: POST to `/queue/start` -- if item returned, done
2. If `empty`, enter polling mode
3. Every `--poll-interval` seconds (default 10), GET `/queue/top` to check for new items
4. If item found, POST `/queue/start` to claim it
5. Times out after `--poll-timeout` minutes (default 30) with exit code 1
6. Handles SIGINT/SIGTERM for clean shutdown

This polling design allows orchestrators to push new tasks into a worker's queue while the worker waits.

---

## 6. Worker Strategies Explained

### 6.1 Simple Strategy (`simple`)

**Template:** `maestro-cli/templates/worker-simple-prompt.md`

The default strategy. The session receives all its tasks at once in the prompt and works through them sequentially. There is no server-side queue -- the agent manages task ordering itself.

**Characteristics:**
- All tasks listed in the prompt via `${ALL_TASKS}` template variable
- Agent decides execution order
- Reports progress via `maestro report progress/complete/blocked`
- No queue commands available
- Best for: single tasks or small batches where the agent can handle ordering

### 6.2 Queue Strategy (`queue`)

**Template:** `maestro-cli/templates/worker-queue-prompt.md`

Server-managed FIFO task processing. Tasks are stored in a QueueState on the server. The agent pulls one task at a time using queue commands.

**Characteristics:**
- Server creates a `QueueState` during session spawn (in `sessionRoutes.ts` spawn endpoint, line 446-454)
- Agent uses `maestro queue start` to claim tasks one at a time
- Supports dynamic task addition via `maestro queue push` (orchestrator or external process can add tasks)
- Agent must explicitly complete/fail each task before starting the next
- `queue start` blocks and polls when queue is empty, enabling a long-lived worker pattern
- Best for: long-running workers that process a stream of tasks

**Queue lifecycle during spawn:**
1. `POST /api/sessions/spawn` with `strategy: 'queue'`
2. Server creates session with `strategy: 'queue'`
3. Server calls `queueService.initializeQueue(session.id, taskIds)` to create the queue with all specified tasks
4. Queue starts with all items in `queued` status

### 6.3 Tree Strategy (`tree`)

**Template:** `maestro-cli/templates/worker-tree-prompt.md`

The session receives a root task and its full subtask tree. The agent works through all subtasks holistically, deciding order based on dependencies and logical flow.

**Characteristics:**
- All tasks rendered as a tree hierarchy in the prompt (using `formatTaskTree` in prompt-generator)
- Agent has full autonomy over execution order within the tree
- Reports progress per subtask: `maestro report progress "SUBTASK COMPLETE [task-id]: summary"`
- Can use `maestro task tree` and `maestro task children` to refresh tree state
- No queue commands -- the agent manages the tree internally
- Best for: hierarchical task structures where subtasks have complex interdependencies

**Note on tree rendering:** The `formatTaskTree` method in `prompt-generator.ts` (lines 348-395) builds a visual tree using box-drawing characters, showing status, priority, dependencies, and acceptance criteria for each node.

---

## 7. Orchestrator Strategies Explained

Orchestrators coordinate workers -- they never implement tasks directly.

### 7.1 Default Strategy (`default`)

**Template:** `maestro-cli/templates/orchestrator-default-prompt.md`

The standard orchestrator workflow with 6 phases:
1. **Analysis** -- Review tasks, identify dependencies, assess priorities
2. **Planning/Decomposition** -- Break down complex tasks into atomic subtasks
3. **Delegation** -- Spawn worker sessions for individual tasks
4. **Monitoring** -- Track worker progress, react to changes
5. **Failure Handling** -- Retry, reassign, or escalate failed tasks
6. **Completion** -- Verify all acceptance criteria, summarize, report complete

**Key commands used by default orchestrator:**
- `maestro task create` -- to create subtasks
- `maestro session spawn --task <id> --skill maestro-worker` -- to spawn workers
- `maestro task list`, `maestro task tree`, `maestro session list` -- for monitoring
- `maestro report progress/blocked/complete` -- for status reporting

### 7.2 Intelligent Batching Strategy (`intelligent-batching`)

**No dedicated template** -- uses `orchestrator-default-prompt.md` with `${ORCHESTRATOR_STRATEGY_INSTRUCTIONS}` substitution.

Strategy-specific instructions (from `prompt-generator.ts:253-257`):
> "Group related tasks into optimal batches for parallel execution. Analyze task dependencies and group independent tasks together for maximum throughput."

The orchestrator is expected to analyze the task graph and create batches of independent tasks that can be executed in parallel by multiple workers simultaneously.

### 7.3 DAG Strategy (`dag`)

**No dedicated template** -- uses `orchestrator-default-prompt.md` with `${ORCHESTRATOR_STRATEGY_INSTRUCTIONS}` substitution.

Strategy-specific instructions (from `prompt-generator.ts:259-263`):
> "Tasks are organized as a directed acyclic graph. Respect dependency edges and execute tasks in topological order, parallelizing independent branches."

The orchestrator is expected to perform topological sorting of the task graph and execute tasks respecting dependency edges, parallelizing independent branches.

---

## 8. How Strategies Affect Session Spawn

**File:** `maestro-server/src/api/sessionRoutes.ts` (spawn endpoint, lines 290-549)

When `POST /api/sessions/spawn` is called:

1. **Validation**: `strategy` must be `'simple'`, `'queue'`, or `'tree'`
2. **Session creation**: The strategy is stored on the session object AND in `metadata.strategy`
3. **Queue initialization**: If `strategy === 'queue'`, the server calls `queueService.initializeQueue()` to create a server-side queue with all `taskIds` as initial items
4. **Manifest generation**: The server runs `maestro manifest generate --strategy <strategy>` via CLI
5. **Template selection**: The `PromptGenerator` selects a template based on role + strategy:
   - Worker: `worker-<strategy>-prompt.md` (e.g., `worker-queue-prompt.md`)
   - Orchestrator: `orchestrator-<orchestratorStrategy>-prompt.md` (e.g., `orchestrator-default-prompt.md`)
6. **Variable substitution**: `${STRATEGY_INSTRUCTIONS}` and `${ORCHESTRATOR_STRATEGY_INSTRUCTIONS}` are filled based on strategy
7. **Environment**: `MAESTRO_STRATEGY` env var is set for the spawned process

### Template Resolution Flow

```
PromptGenerator.generatePromptAsync(manifest)
  1. Try server: fetchTemplateById(manifest.templateId)
  2. Try server: fetchTemplateByRole(manifest.role)
  3. Fallback: loadTemplate(role + '-' + strategy)
     e.g., "worker-queue" -> "worker-queue-prompt.md"
```

---

## 9. End-to-End Queue Workflow

### Creation Phase

```
User/Orchestrator                    Server                          Queue
      |                                |                               |
      |-- POST /sessions/spawn ------->|                               |
      |   { strategy: 'queue',         |                               |
      |     taskIds: [t1, t2, t3] }    |                               |
      |                                |-- createSession() ----------->|
      |                                |-- initializeQueue() --------->|
      |                                |   Creates QueueState:          |
      |                                |   items: [t1(queued),          |
      |                                |           t2(queued),          |
      |                                |           t3(queued)]          |
      |                                |   currentIndex: -1             |
      |                                |                               |
      |                                |-- generateManifest() -------->|
      |                                |-- emit session:spawn -------->|
      |<-- { sessionId, manifest } ----|                               |
```

### Processing Phase (Worker Agent Loop)

```
Worker Agent                         Server                         Queue
      |                                |                               |
      |-- maestro queue start -------->|                               |
      |   POST /queue/start            |-- startItem() --------------->|
      |                                |   items[0].status='processing'|
      |                                |   currentIndex=0              |
      |                                |   task.sessionStatus='working'|
      |<-- { item: t1 } --------------|                               |
      |                                |                               |
      |   [... works on task t1 ...]   |                               |
      |                                |                               |
      |-- maestro queue complete ----->|                               |
      |   POST /queue/complete         |-- completeItem() ------------>|
      |                                |   items[0].status='completed' |
      |                                |   currentIndex=-1             |
      |                                |   task.sessionStatus='completed'
      |<-- { completedItem, next } ----|                               |
      |                                |                               |
      |-- maestro queue start -------->|                               |
      |   POST /queue/start            |-- startItem() --------------->|
      |                                |   items[1].status='processing'|
      |                                |   currentIndex=1              |
      |<-- { item: t2 } --------------|                               |
      |                                |                               |
      |   [... repeat until empty ...] |                               |
```

### Dynamic Push Phase (Orchestrator Adds Tasks)

```
Orchestrator                         Server                         Queue (Worker's)
      |                                |                               |
      |-- POST /queue/push ----------->|                               |
      |   { taskId: t4 }              |-- pushItem() ---------------->|
      |                                |   items.push(t4(queued))      |
      |<-- { item: t4 } --------------|                               |
      |                                |                               |
      |   [Worker's queue start poll   |                               |
      |    detects t4 and claims it]   |                               |
```

### Empty Queue Polling Phase

```
Worker Agent                         Server
      |                                |
      |-- POST /queue/start ---------->|
      |<-- { empty: true } -----------|
      |                                |
      |   [enters poll loop]           |
      |   [waits poll-interval]        |
      |                                |
      |-- GET /queue/top ------------->|
      |<-- { hasMore: false } --------|
      |                                |
      |   [waits poll-interval]        |
      |                                |
      |-- GET /queue/top ------------->|  (orchestrator pushed t5)
      |<-- { hasMore: true, item:t5 } |
      |                                |
      |-- POST /queue/start ---------->|
      |<-- { item: t5 } --------------|
      |                                |
      |   [processes t5]               |
```

---

## 10. Issues, Gaps, and Inconsistencies

### 10.1 WorkerStrategy Type Mismatch (CLI vs Server)

- **Server** (`maestro-server/src/types.ts:2`): `WorkerStrategy = 'simple' | 'queue' | 'tree'`
- **CLI** (`maestro-cli/src/types/manifest.ts:10`): `WorkerStrategy = 'simple' | 'queue'`

The `tree` strategy is missing from the CLI type definition, though it is validated and used in the server spawn endpoint. This could cause TypeScript compilation issues if strict typing is enforced on the CLI side.

### 10.2 skipItem Does Not Update Task sessionStatus

In `QueueService.skipItem()` (line 198-236), when an item is skipped, the task's `sessionStatus` is NOT updated (unlike `startItem`, `completeItem`, and `failItem` which all update it). The `TaskSessionStatus` type includes `'skipped'` but it is never set by the queue service during skip operations.

### 10.3 Unused `getQueueInstructions()` Method

The `PromptGenerator` has a private method `getQueueInstructions()` (line 271-308) that generates queue-specific instructions, but it is never called anywhere. The queue workflow instructions are instead embedded directly in the `worker-queue-prompt.md` template file. This is dead code.

### 10.4 Stale `orchestrator-prompt.md` Template

There are two orchestrator templates:
- `orchestrator-prompt.md` -- older, simpler version (no strategy variable substitution)
- `orchestrator-default-prompt.md` -- newer, full 6-phase version with `${STRATEGY}` and `${STRATEGY_INSTRUCTIONS}`

The `PromptGenerator.generatePrompt()` constructs template names as `orchestrator-<strategy>` (e.g., `orchestrator-default`), so it will load `orchestrator-default-prompt.md`. The plain `orchestrator-prompt.md` file appears to be a legacy artifact that is never loaded by the current template resolution logic.

### 10.5 Missing Templates for intelligent-batching and dag

The prompt generator tries to load `orchestrator-intelligent-batching-prompt.md` and `orchestrator-dag-prompt.md` but these files do not exist. The system falls back gracefully: `generatePromptAsync` first tries the server, then falls back to bundled templates. If the server has no template either, it will throw an error from `loadTemplate()`. In practice, the server template fetch likely returns the default template content, but this is fragile.

### 10.6 Queue-Task Status Synchronization Risk

The QueueService updates task `sessionStatus` during item transitions (e.g., `working`, `completed`, `failed`). However, these updates go directly to `this.taskRepo.update()` bypassing the TaskService layer. This means:
- No task lifecycle events are emitted through the TaskService
- No validation logic from TaskService is applied
- If TaskService adds business rules later, queue transitions will bypass them

### 10.7 No Queue Cleanup on Session Completion

There is no automatic mechanism to clean up a queue when its session completes or fails. If a session ends while items are still `queued`, those items remain in the `queued` state permanently. The `deleteQueue` method exists but is never called automatically.

### 10.8 Race Condition in Polling

In the CLI `queue start` polling loop (lines 140-163), there is a potential race condition:
1. `GET /queue/top` returns `hasMore: true`
2. Between the top check and the `POST /queue/start`, another process could modify the queue
3. The `start` call could fail or return a different item

This is unlikely in practice (single worker per queue) but is architecturally possible.

### 10.9 `currentIndex` Tracking is Fragile

The `currentIndex` field tracks position by array index rather than by taskId. If items were ever reordered or removed from the array, `currentIndex` could point to the wrong item. Currently this is safe because items are only appended (via `addItems`) and never removed or reordered.

---

## 11. Summary

The queue system is well-designed for its primary use case: a single worker session processing tasks in FIFO order, with an orchestrator optionally pushing new tasks. The strategy framework provides good separation between simple (all-at-once), queue (server-managed FIFO), and tree (agent-managed hierarchy) execution models. The orchestrator strategies (default, intelligent-batching, dag) are largely prompt-driven differentiation with minimal server-side implementation differences.

The main areas for improvement are: aligning the `WorkerStrategy` types between CLI and server, ensuring consistent task status updates on all queue transitions (especially `skip`), adding dedicated templates for non-default orchestrator strategies, and implementing queue cleanup on session termination.
