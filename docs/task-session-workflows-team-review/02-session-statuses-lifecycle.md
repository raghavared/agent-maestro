# Session Statuses and Lifecycle Review

## 1. Complete Session Type Definition

**File:** `maestro-server/src/types.ts:60-81`

```typescript
export interface Session {
  id: string;                                          // Unique session identifier (prefix: "sess")
  projectId: string;                                   // Parent project
  taskIds: string[];                                   // Many-to-many: multiple tasks in this session
  name: string;                                        // Human-readable session name
  agentId?: string;                                    // Optional agent running this session (Phase IV-C)
  env: Record<string, string>;                         // Environment variables passed to Claude process
  strategy: WorkerStrategy | OrchestratorStrategy;     // Execution strategy
  status: SessionStatus;                               // Current lifecycle status
  startedAt: number;                                   // Unix timestamp of creation
  lastActivity: number;                                // Unix timestamp of last update
  completedAt: number | null;                          // Unix timestamp when terminal status reached
  hostname: string;                                    // Machine hostname (set at creation)
  platform: string;                                    // OS platform (set at creation)
  events: SessionEvent[];                              // Generic event log
  timeline: SessionTimelineEvent[];                    // Structured activity timeline
  metadata?: Record<string, any>;                      // Extensible metadata (skills, spawnedBy, role, etc.)
}
```

### Supporting Types

**SessionEvent** (generic, untyped events):
```typescript
interface SessionEvent {
  id: string;
  timestamp: number;
  type: string;       // Free-form string
  data?: any;         // Arbitrary payload
}
```

**SessionTimelineEvent** (structured, typed events):
```typescript
interface SessionTimelineEvent {
  id: string;
  type: SessionTimelineEventType;            // Discriminated union (see below)
  timestamp: number;
  message?: string;
  taskId?: string;                           // Which task this event relates to
  metadata?: Record<string, any>;            // Extensible
}
```

**SessionTimelineEventType** values:
| Value | Meaning |
|-------|---------|
| `session_started` | Session was spawned/created |
| `session_stopped` | Session was stopped/deleted |
| `task_started` | Began working on a task |
| `task_completed` | Finished a task |
| `task_failed` | Failed a task |
| `task_skipped` | Skipped a task |
| `task_blocked` | Blocked on a task |
| `needs_input` | Waiting for user input |
| `progress` | General progress update |
| `error` | Error occurred |
| `milestone` | Milestone reached |

---

## 2. Session Status Enum and Transitions

**Type:** `maestro-server/src/types.ts:87`

```typescript
type SessionStatus = 'spawning' | 'idle' | 'working' | 'needs-user-input' | 'completed' | 'failed' | 'stopped';
```

### Status Definitions

| Status | Meaning | Set By |
|--------|---------|--------|
| **spawning** | Session record created, manifest being generated, waiting for Claude process to start | Server spawn endpoint (`sessionRoutes.ts:429`) |
| **idle** | Default creation status; session exists but not actively processing | Repository default (`FileSystemSessionRepository.ts:114`) |
| **working** | Claude is actively executing; session is processing tasks | CLI `resume-working` command (UserPromptSubmit hook) |
| **needs-user-input** | Claude has stopped and is waiting for user interaction | CLI `needs-input` command (Stop hook) |
| **completed** | Session finished all work successfully | CLI `complete` command (SessionEnd hook) |
| **failed** | Session encountered an unrecoverable error | Set via API PATCH (no dedicated CLI command) |
| **stopped** | Session was manually stopped/terminated | Set via API PATCH (no dedicated CLI command) |

### Status Transition Map

```
                    +----------+
                    | spawning |  (spawn endpoint creates session)
                    +----+-----+
                         |
                         v
              +----------+----------+
              |   idle / running    |  (register command sets 'running' -- SEE ISSUE #1)
              +----+-------+-------+
                   |       |
                   v       v
             +-----+   +--+------+
             |working|  |needs-   |
             |       |<>|user-    |
             +---+---+  |input   |
                 |       +---+----+
                 |           |
                 v           v
           +-----+-----+  (user provides input -> resume-working -> working)
           |  completed |
           +------------+
           |  failed    |
           +------------+
           |  stopped   |
           +------------+
```

Terminal statuses (`completed`, `failed`, `stopped`) all set `completedAt` in the repository update logic (`FileSystemSessionRepository.ts:190-193`).

### How Statuses Are Set in Practice (Hook-Driven)

The CLI provides hook-backed commands that drive most transitions:

1. **Spawn endpoint** -> creates session with status `spawning`
2. **`maestro session register`** (SessionStart hook) -> PATCHes to `running` (SEE ISSUE #1)
3. **`maestro session resume-working`** (UserPromptSubmit hook) -> PATCHes to `working`
4. **`maestro session needs-input`** (Stop hook) -> PATCHes to `needs-user-input`
5. **`maestro session complete`** (SessionEnd hook) -> PATCHes to `completed`

---

## 3. Session Strategies

### Worker Strategies

**Type:** `maestro-server/src/types.ts:2`

```typescript
type WorkerStrategy = 'simple' | 'queue' | 'tree';
```

| Strategy | Meaning |
|----------|---------|
| **simple** | Default. Session works on its assigned tasks directly without queue management. |
| **queue** | Tasks are managed via a QueueService. A `QueueState` is initialized with items ordered by taskIds. The session processes tasks sequentially (currentIndex tracks position). Queue items have their own statuses: `queued`, `processing`, `completed`, `failed`, `skipped`. |
| **tree** | Appears in validation (`sessionRoutes.ts:415`) but has no dedicated implementation beyond being an accepted value. Likely intended for hierarchical task decomposition. |

When `strategy === 'queue'`, the spawn endpoint initializes the queue via `queueService.initializeQueue(session.id, taskIds)` (`sessionRoutes.ts:447-454`).

### Orchestrator Strategies

**Type:** `maestro-server/src/types.ts:3`

```typescript
type OrchestratorStrategy = 'default' | 'intelligent-batching' | 'dag';
```

| Strategy | Meaning |
|----------|---------|
| **default** | Standard orchestration. Analyze tasks, decompose, spawn workers. |
| **intelligent-batching** | Group related tasks into batches for efficient parallel execution. |
| **dag** | Directed Acyclic Graph-based execution respecting task dependency ordering. |

Orchestrator strategy is only applied when `role === 'orchestrator'`. It is stored in `session.metadata.orchestratorStrategy` and passed as `MAESTRO_ORCHESTRATOR_STRATEGY` environment variable to the Claude process (`claude-spawner.ts:125`).

**Note:** The `Session.strategy` field accepts `WorkerStrategy | OrchestratorStrategy` as a union type, but the spawn endpoint only passes the worker `strategy` field to `createSession()`. The orchestrator strategy is stored separately in metadata. This dual-storage is a minor design inconsistency.

---

## 4. Session Spawning Flow

The spawning flow is the most complex session operation. Here is the complete sequence:

### Step 1: Spawn Request (Server)
**Endpoint:** `POST /api/sessions/spawn` (`sessionRoutes.ts:290-549`)

1. Validate inputs: `projectId`, `taskIds` (non-empty array), `role` (worker/orchestrator), `strategy`, `spawnSource` (ui/session)
2. If `spawnSource === 'session'`, verify parent session exists
3. Verify all referenced tasks and the project exist
4. Create session via `SessionService.createSession()` with:
   - Status: `spawning`
   - `_suppressCreatedEvent: true` (event is emitted later as `session:spawn`)
   - Metadata includes: skills, spawnedBy (parent session ID), spawnSource, role, strategy, orchestratorStrategy, context
5. If `strategy === 'queue'`, initialize queue via `QueueService`
6. Generate manifest via CLI: `maestro manifest generate --role <role> --project-id <id> --task-ids <ids> --skills <skills> --strategy <strategy> --output <path>`
7. Add `templateId` from server's TemplateService to manifest
8. Prepare environment variables:
   - `MAESTRO_SESSION_ID`, `MAESTRO_MANIFEST_PATH`, `MAESTRO_SERVER_URL`, `MAESTRO_STRATEGY`, `DATA_DIR`, `SESSION_DIR`
9. Update session with env vars
10. Emit `session:spawn` event (includes session, command, cwd, envVars, manifest, spawnSource, parentSessionId)
11. Emit `task:session_added` for each task
12. Return 201 with session data and manifest path

### Step 2: UI/CLI Picks Up Spawn Event
The `session:spawn` event (via SSE/WebSocket) is received by the Agent Maestro, which opens a terminal window.

### Step 3: Claude Process Starts
The `ClaudeSpawner` (`claude-spawner.ts`) handles the actual process creation:

1. **`prepareEnvironment()`**: Sets `MAESTRO_SESSION_ID`, `MAESTRO_TASK_IDS`, `MAESTRO_PROJECT_ID`, `MAESTRO_ROLE`, `MAESTRO_STRATEGY`, `MAESTRO_MANIFEST_PATH`, `MAESTRO_SERVER_URL`, task metadata, and optional acceptance criteria / dependencies
2. **`buildClaudeArgs()`**: Adds `--plugin-dir` for role-specific plugins (hooks + skills), loads additional skills, sets `--model` and optional `--max-turns`
3. **`spawn()` or `spawnInTmux()`**: Launches `claude` with the minimal prompt: `"Run \`maestro whoami\` to understand your assignment and begin working."`

### Step 4: Session Registers (Hook)
When Claude starts, the SessionStart hook fires `maestro session register`, which:
- Checks if session already exists on server (it should, from spawn)
- PATCHes status to `running`

### Step 5: Session Lifecycle (Hooks)
- **UserPromptSubmit hook** -> `maestro session resume-working` -> status `working`
- **Stop hook** -> `maestro session needs-input` -> status `needs-user-input` (+ timeline event)
- **SessionEnd hook** -> `maestro session complete` -> status `completed`

---

## 5. Session-Task Relationships

Sessions and Tasks have a **many-to-many** relationship (Phase IV-A):

- `Session.taskIds: string[]` -- tasks assigned to this session
- `Task.sessionIds: string[]` -- sessions working on this task

### Bidirectional Link Management

When a session is created with taskIds:
1. `SessionService.createSession()` calls `taskRepo.addSession(taskId, sessionId)` for each task
2. A `task_started` timeline event is added to the session for each task

When a task is added to a session:
1. `sessionRepo.addTask(sessionId, taskId)` -- adds taskId to session's taskIds
2. `taskRepo.addSession(taskId, sessionId)` -- adds sessionId to task's sessionIds
3. Timeline event `task_started` added to session
4. Events emitted: `session:task_added`, `task:session_added`

When a task is removed:
1. Both sides updated (removeTask/removeSession)
2. Timeline event `task_completed` added (see Issue #2)
3. Events emitted: `session:task_removed`, `task:session_removed`

When a session is deleted:
1. `session_stopped` timeline event added
2. `taskRepo.removeSession()` called for each associated task
3. Session file deleted from disk
4. `session:deleted` event emitted

---

## 6. Session Timeline and Event Tracking

Sessions have two event systems:

### Generic Events (`events: SessionEvent[]`)
- Free-form type string, arbitrary data payload
- Added via `POST /api/sessions/:id/events`
- Used for low-level event logging

### Structured Timeline (`timeline: SessionTimelineEvent[]`)
- Typed events with discriminated union `SessionTimelineEventType`
- Added via `POST /api/sessions/:id/timeline` or internally by SessionService
- Auto-populated events:
  - `session_started` -- on creation (by repository)
  - `session_stopped` -- on deletion (by service)
  - `task_started` -- when task added to session
  - `task_completed` -- when task removed from session
  - `needs_input` -- when CLI needs-input command fires
- Timeline events can reference a specific `taskId` and carry arbitrary `metadata`

The timeline API endpoint (`POST /api/sessions/:id/timeline`) requires a `message` field and defaults `type` to `'progress'`.

---

## 7. Session Environment and Metadata

### Environment Variables (Passed to Claude Process)

| Variable | Source | Purpose |
|----------|--------|---------|
| `MAESTRO_SESSION_ID` | Spawn endpoint / spawner | Identifies this session |
| `MAESTRO_TASK_IDS` | Spawner | Comma-separated task IDs |
| `MAESTRO_PROJECT_ID` | Spawner | Project context |
| `MAESTRO_ROLE` | Spawner | `worker` or `orchestrator` |
| `MAESTRO_STRATEGY` | Spawn endpoint / spawner | Worker strategy |
| `MAESTRO_MANIFEST_PATH` | Spawn endpoint | Path to manifest JSON |
| `MAESTRO_SERVER_URL` | Spawn endpoint | Server URL for API calls |
| `MAESTRO_TASK_TITLE` | Spawner | Primary task title |
| `MAESTRO_TASK_PRIORITY` | Spawner | Primary task priority |
| `MAESTRO_ALL_TASKS` | Spawner | JSON of all tasks |
| `MAESTRO_TASK_ACCEPTANCE` | Spawner | JSON acceptance criteria |
| `MAESTRO_TASK_DEPENDENCIES` | Spawner | JSON dependencies |
| `MAESTRO_ORCHESTRATOR_STRATEGY` | Spawner | Orchestrator strategy (if orchestrator) |
| `DATA_DIR` | Spawn endpoint | Server data directory |
| `SESSION_DIR` | Spawn endpoint | Session storage directory |

### Metadata (Stored in Session Record)

The `metadata` field is populated during spawn with:
- `skills: string[]` -- skill names loaded
- `spawnedBy: string | null` -- parent session ID (if session-initiated)
- `spawnSource: 'ui' | 'session'` -- who initiated the spawn
- `role: 'worker' | 'orchestrator'` -- agent role
- `strategy: string` -- worker strategy (duplicated from top-level field)
- `orchestratorStrategy?: string` -- orchestrator strategy
- `context: Record<string, any>` -- additional spawn context

---

## 8. API Endpoints

**File:** `maestro-server/src/api/sessionRoutes.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/sessions` | Create a session |
| `GET` | `/api/sessions` | List sessions (filters: `projectId`, `taskId`, `status`, `active=true`) |
| `GET` | `/api/sessions/:id` | Get session by ID |
| `PATCH` | `/api/sessions/:id` | Update session (status, taskIds, agentId, env, events, timeline) |
| `DELETE` | `/api/sessions/:id` | Delete session (cleans up task associations) |
| `POST` | `/api/sessions/:id/events` | Add generic event to session |
| `POST` | `/api/sessions/:id/timeline` | Add structured timeline event |
| `POST` | `/api/sessions/:id/tasks/:taskId` | Add task to session |
| `DELETE` | `/api/sessions/:id/tasks/:taskId` | Remove task from session |
| `POST` | `/api/sessions/spawn` | Spawn a new session (complex: manifest generation, event emission) |

---

## 9. CLI Commands

**File:** `maestro-cli/src/commands/session.ts`

| Command | Description | Trigger |
|---------|-------------|---------|
| `maestro session list` | List sessions (optional `--task` filter) | Manual |
| `maestro session info` | Get current session info (requires `MAESTRO_SESSION_ID`) | Manual |
| `maestro session spawn` | Spawn a new session (`--task`, `--skill`, `--name`, `--reason`, `--include-related`, `--orchestrator-strategy`) | Manual / Orchestrator |
| `maestro session register` | Register session with server (sets status to `running`) | **SessionStart hook** |
| `maestro session complete` | Mark session as completed | **SessionEnd hook** |
| `maestro session needs-input` | Mark session as needing user input | **Stop hook** |
| `maestro session resume-working` | Resume session to working status | **UserPromptSubmit hook** |

The `spawn` command builds comprehensive context including:
- Primary task details with acceptance criteria
- Related/dependent tasks (if `--include-related`)
- Workflow steps based on skill type (worker vs orchestrator)
- Initial commands list (`maestro whoami`, `maestro task get`, optionally `maestro task start`)

---

## 10. Issues and Inconsistencies Found

### ISSUE #1: "running" Status Not in SessionStatus Enum (HIGH)
The `session register` command (`session.ts:291-293`) PATCHes status to `'running'`, but `SessionStatus` only defines: `spawning | idle | working | needs-user-input | completed | failed | stopped`. The value `'running'` is **not a valid SessionStatus**. This means:
- The status is silently accepted (no server-side validation on PATCH)
- `findByStatus('running')` would match these sessions
- But TypeScript type safety is bypassed at runtime
- The intended status is likely `'working'` or `'idle'`

### ISSUE #2: Incorrect Timeline Event on Task Removal (MEDIUM)
In `SessionService.removeTaskFromSession()` (`SessionService.ts:203-207`), a `task_completed` timeline event is added when a task is removed. The comment acknowledges this: `// Or could be task_skipped depending on context`. Removing a task does not necessarily mean it was completed -- it could have been reassigned, cancelled, or skipped. The event type should be context-dependent or use a neutral type like `progress`.

### ISSUE #3: Strategy Field Ambiguity (MEDIUM)
`Session.strategy` is typed as `WorkerStrategy | OrchestratorStrategy`, but:
- The spawn endpoint only passes the worker `strategy` to `createSession()` (line 428)
- Orchestrator strategy is stored separately in `metadata.orchestratorStrategy`
- The top-level `strategy` field always contains a WorkerStrategy value, even for orchestrator sessions
- This makes the union type misleading -- an orchestrator session has `strategy: 'simple'` (the worker default) at the top level

### ISSUE #4: `completedAt` Sent by CLI but Ignored by Repository (LOW)
The `session complete` CLI command sends `completedAt: Date.now()` in its PATCH payload (`session.ts:344`), but the `UpdateSessionPayload` type does not include `completedAt`. The repository already sets `completedAt` automatically when status transitions to a terminal state (`FileSystemSessionRepository.ts:190-193`). The CLI-sent value is silently ignored -- not a bug, but redundant.

### ISSUE #5: Dual Event Systems (LOW / Design Consideration)
Sessions have both `events: SessionEvent[]` (untyped) and `timeline: SessionTimelineEvent[]` (typed). The purpose distinction is unclear. Both are append-only logs. The `events` array appears to be a legacy holdover that could be consolidated into the `timeline` system for clarity.

### ISSUE #6: No Status Transition Validation (MEDIUM)
There is no validation of valid status transitions. Any status can be set from any other status via PATCH. For example, a `completed` session could be PATCHed back to `working` or `spawning` without any guard. The repository simply accepts whatever status is provided.

### ISSUE #7: `tree` Strategy Unimplemented (LOW)
`WorkerStrategy` includes `'tree'` and it passes validation in the spawn endpoint, but there is no tree-specific initialization logic (unlike `queue` which calls `queueService.initializeQueue()`). Spawning with `strategy: 'tree'` would create a session that behaves identically to `simple`.

### ISSUE #8: Session Deletion Adds Timeline Event After "Stop" (LOW)
`SessionService.deleteSession()` adds a `session_stopped` timeline event and then immediately deletes the session. The timeline event is persisted to disk momentarily but then the file is deleted. This event is effectively invisible unless something reads the session between the two operations.
