# Agent Maestro: Consolidated Workflow Review

> **Definitive reference document** for understanding task lifecycle, session management, queue processing, event-driven updates, CLI commands, and end-to-end workflows in the agent-maestro system.

---

## Executive Summary

Agent Maestro is a multi-agent orchestration platform that manages the lifecycle of **projects**, **tasks**, **sessions**, and **queues** to coordinate AI agent workers and orchestrators. The system follows a layered architecture: a Node.js/Express server persists state to the filesystem, exposes REST APIs, and broadcasts real-time updates via WebSocket. A Commander.js CLI provides the primary interface for both human operators and AI agents (Claude sessions). A React/Zustand UI consumes WebSocket events for live dashboard updates. The core design philosophy separates **user-controlled task status** (`TaskStatus`) from **agent-reported session status** (`TaskSessionStatus`), allowing orchestrators to maintain authoritative control over task lifecycle while workers report their own progress independently.

The system supports three worker strategies -- **simple** (all tasks in prompt), **queue** (server-managed FIFO), and **tree** (hierarchical subtask processing) -- and three orchestrator strategies -- **default** (6-phase workflow), **intelligent-batching** (parallel task grouping), and **dag** (topological dependency execution). Sessions are spawned via a sophisticated flow that generates manifests, selects role-specific prompt templates, injects environment variables, and launches Claude processes in tmux panes. Hook-driven status transitions (`SessionStart`, `Stop`, `UserPromptSubmit`, `SessionEnd`) keep the server synchronized with each Claude process's lifecycle.

This review consolidates findings from five focused analyses covering task statuses, session lifecycle, domain events, CLI commands, and queue/strategy workflows. While the core architecture is sound and functional, we identified **38 issues** across the system, including dead fields (`dependencies`), type safety gaps (11 untyped domain events), status enum inconsistencies (`running` not in `SessionStatus`), missing transition validation, and incomplete bidirectional sync between tasks and sessions. The sections below provide the complete picture.

---

## High-Level Architecture

```
+-------------------------------------------------------------------+
|                        AGENT MAESTRO SYSTEM                       |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+    REST API     +------------------------+  |
|  |   Maestro CLI    |<-------------->|    Maestro Server       |  |
|  |  (Commander.js)  |    (HTTP)      |    (Express + Node)     |  |
|  +------------------+                |                         |  |
|  | - whoami          |               | Application Services:   |  |
|  | - task *          |               |  ProjectService         |  |
|  | - session *       |               |  TaskService            |  |
|  | - report *        |               |  SessionService         |  |
|  | - queue *         |               |  QueueService           |  |
|  | - manifest *      |               |  TemplateService        |  |
|  | - project *       |               |                         |  |
|  | - worker init     |               | Domain Events:          |  |
|  | - orchestrator    |               |  InMemoryEventBus       |  |
|  |   init            |               |  (pub-sub)              |  |
|  +------------------+                |                         |  |
|         ^                            | Infrastructure:         |  |
|         |  Hooks                     |  FileSystem Repos       |  |
|         |  (SessionStart,            |  WebSocketBridge        |  |
|         |   Stop,                    |  ClaudeSpawner          |  |
|         |   UserPromptSubmit,        +----------+--------------+  |
|         |   SessionEnd)                         |                 |
|         v                                       | WebSocket (SSE) |
|  +------------------+                           v                 |
|  |  Claude Process  |               +------------------------+   |
|  |  (AI Agent)      |               |    Maestro UI          |   |
|  |  - Worker role   |               |    (React + Zustand)   |   |
|  |  - Orchestrator  |               |    - Live dashboard    |   |
|  |    role          |               |    - Terminal spawning  |   |
|  +------------------+               |    - Task/Session mgmt  |   |
|                                     +------------------------+   |
+-------------------------------------------------------------------+
|                     FILE SYSTEM STORAGE                            |
|  ~/.maestro/data/                                                 |
|    projects/<id>.json  tasks/<id>.json  sessions/<id>.json        |
|    queues/<sessionId>.json  templates/<id>.json                   |
+-------------------------------------------------------------------+
```

### Data Flow Summary

```
User/Agent Action --> CLI Command --> REST API --> Application Service
                                                        |
                                                        +--> Repository (FileSystem JSON)
                                                        |
                                                        +--> EventBus.emit()
                                                                |
                                                                +--> WebSocketBridge.broadcast()
                                                                        |
                                                                        +--> UI Store (Zustand) updates
```

---

## Complete Status State Machines

### 1. TaskStatus (User-Controlled)

```
Type: 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked'

                         +-------+
              +--------->| todo  |<----------+
              |          +---+---+           |
              |              |               |
              |    (no validation enforced)  |
              |              |               |
              |              v               |
              |        +-----------+         |
              +--------|in_progress|-------->+
              |        +-----+-----+        |
              |              |              |
              |              v              |
              |       +-----------+        |
              |       | completed |        |
              |       +-----------+        |
              |                            |
              |       +-----------+        |
              +-------| cancelled |--------+
              |       +-----------+
              |
              |       +-----------+
              +-------| blocked   |
                      +-----------+

Side Effects:
  todo -> in_progress:  Sets startedAt = Date.now() (first time only)
  * -> completed:       Sets completedAt = Date.now() (first time only)

WARNING: No transition validation exists. Any state can reach any other state.
         Re-opening a completed task leaves stale completedAt.

Set by: CLI (maestro task update/complete/block), UI, Orchestrator
NOT set by: Worker sessions (stripped by TaskService)
```

### 2. TaskSessionStatus (Agent-Reported)

```
Type: 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'skipped'

        +--------+
        | queued |  (set by queue system)
        +---+----+
            |
            v
        +---------+
        | working |<-------+
        +----+----+        |
             |              |
             +------+-------+---+--------+
             |      |           |        |
             v      v           v        v
       +-----+ +------+ +----------+ +-------+
       |compl.| |failed| |needs_    | |blocked|
       +------+ +------+ |input    | +-------+
                          +----------+
                               |
                               v (user provides input)
                          +---------+
                          | working |
                          +---------+

       +--------+
       | skipped|  (can be set from queued or working)
       +--------+

Set by: CLI (maestro report *), Queue system
Updates: PATCH /api/tasks/:id with updateSource='session'

WARNING: Single field on Task, but multiple sessions can work on same task.
         Last writer wins -- unreliable for many-to-many.
```

### 3. SessionStatus (Session Lifecycle)

```
Type: 'spawning' | 'idle' | 'working' | 'needs-user-input' | 'completed' | 'failed' | 'stopped'

Note: 'running' is used by session register but is NOT in the enum.

        +----------+
        | spawning |  (POST /api/sessions/spawn creates session)
        +----+-----+
             |
             v
        +---------+        +----------------+
        | idle    |------->|   running (*)  |  (*) NOT IN ENUM - set by register hook
        +---------+        +-------+--------+
                                   |
                    +--------------+----------------+
                    |                               |
                    v                               v
             +-----------+                 +------------------+
             |  working  |<--------------->| needs-user-input |
             +-----+-----+                +--------+---------+
                   |                                |
                   v                                v
            +------+-------+-------+        (user provides input
            |              |       |         -> resume-working
            v              v       v           -> working)
       +---------+   +------+  +--------+
       |completed|   |failed|  |stopped |
       +---------+   +------+  +--------+
          (terminal)  (terminal) (terminal)

Terminal states set completedAt = Date.now()

Hook-Driven Transitions:
  SessionStart hook  --> maestro session register   --> 'running' (BUG: should be 'working' or 'idle')
  UserPromptSubmit   --> maestro session resume-working --> 'working'
  Stop hook          --> maestro session needs-input    --> 'needs-user-input'
  SessionEnd hook    --> maestro session complete       --> 'completed'

WARNING: No server-side transition validation. Any status accepted via PATCH.
```

### 4. QueueItem Status

```
Type: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped'

        +--------+
        | queued |
        +---+----+
            |
            +------------------+
            |                  |
            v                  v
       +------------+     +---------+
       | processing |     | skipped |  (skip without starting)
       +-----+------+     +---------+
             |
             +----------+----------+
             |          |          |
             v          v          v
        +---------+ +------+ +---------+
        |completed| |failed| | skipped |
        +---------+ +------+ +---------+

Side Effects on Task:
  queued -> processing:  task.sessionStatus = 'working'
  processing -> completed: task.sessionStatus = 'completed'
  processing -> failed:    task.sessionStatus = 'failed'
  processing -> skipped:   (BUG: task.sessionStatus NOT updated)
  queued -> skipped:       (BUG: task.sessionStatus NOT updated)

Constraint: Only ONE item can be 'processing' at a time per queue.
```

---

## End-to-End Workflow Walkthrough

### Phase 1: Project and Task Creation

```
1. User creates a project:
   CLI:  maestro project create "My Project" --dir /path/to/code
   API:  POST /api/projects { name, workingDir, description }
   Result: Project record created, project:created event emitted

2. User creates tasks:
   CLI:  maestro task create "Implement auth" --priority high --parent <parentId>
   API:  POST /api/tasks { projectId, title, description, priority, parentId }
   Result: Task created with status='todo', task:created event emitted

   Tasks can form a hierarchy via parentId (parent-child tree).
   Dependencies field exists but is completely inert (never enforced).
```

### Phase 2: Session Spawning

```
3. User/Orchestrator spawns a session:
   CLI:  maestro session spawn --task <taskId> --skill maestro-worker
   UI:   Clicks "Spawn Worker" button
   API:  POST /api/sessions/spawn {
           projectId, taskIds, role, strategy, spawnSource, skills
         }

   Server-side spawn flow:
   a) Validate all inputs (project exists, tasks exist)
   b) Create Session record (status: 'spawning')
   c) If strategy='queue': initialize QueueState with all taskIds
   d) Generate manifest via CLI: maestro manifest generate ...
   e) Prepare environment variables (MAESTRO_SESSION_ID, etc.)
   f) Emit session:spawn event (carries full SpawnRequestEvent payload)
   g) UI receives event -> opens terminal window
   h) ClaudeSpawner launches: claude --plugin-dir <hooks+skills>
      with initial prompt: "Run `maestro whoami` to understand your assignment"
```

### Phase 3: Session Registration and Work

```
4. Claude process starts:
   Hook (SessionStart): maestro session register
   -> PATCH /api/sessions/:id { status: 'running' }  (BUG: 'running' not in enum)

5. Agent begins work:
   Hook (UserPromptSubmit): maestro session resume-working
   -> PATCH /api/sessions/:id { status: 'working' }

   Agent reads assignment:
   CLI:  maestro whoami  (shows context: server, project, session, tasks, strategy)
   CLI:  maestro task get (shows primary task details)
```

### Phase 4: Task Processing (varies by strategy)

#### Simple Strategy:
```
6a. Agent works through all tasks listed in prompt.
    Reports progress: maestro report progress "Working on auth" --task <id>
    -> PATCH /api/tasks/:id { sessionStatus: 'working', updateSource: 'session' }
    -> POST /api/sessions/:id/timeline { type: 'progress', message }

    Completes tasks: maestro report complete "Auth done" --task <id>
    -> PATCH /api/tasks/:id { sessionStatus: 'completed' }
```

#### Queue Strategy:
```
6b. Agent enters queue processing loop:
    maestro queue start  -->  POST /queue/start
    (claims next queued item, sets it to 'processing')

    [works on task]

    maestro queue complete  -->  POST /queue/complete
    (marks item 'completed', resets currentIndex)

    maestro queue start  -->  (claims next item)
    [repeat until empty]

    If empty: enters polling loop (10s interval, 30min timeout)
    Orchestrator can push new tasks: POST /queue/push { taskId }
```

#### Tree Strategy:
```
6c. Agent receives full subtask tree in prompt.
    Works through subtasks holistically.
    Reports per subtask: maestro report progress "SUBTASK COMPLETE [id]: summary"
    Uses: maestro task tree, maestro task children --recursive
```

### Phase 5: Handling Blocks and Input Needs

```
7. If agent is blocked:
   CLI:  maestro report blocked "Waiting for API key" --task <id>
   -> task.sessionStatus = 'blocked'
   -> Timeline event: task_blocked

8. If agent needs user input (see detailed flow below):
   Claude process stops -> Stop hook fires
   -> maestro session needs-input
   -> session.status = 'needs-user-input'
   -> Timeline event: needs_input
   -> UI shows session as needing input
```

### Phase 6: Monitoring (Orchestrator)

```
9. Orchestrator monitors workers:
   CLI:  maestro task list --status in_progress
   CLI:  maestro session list
   CLI:  maestro task tree --depth 3
   CLI:  maestro status  (project-wide summary)

   Orchestrator can:
   - Spawn additional workers: maestro session spawn --task <id>
   - Create subtasks: maestro task create "Subtask" --parent <parentId>
   - Mark tasks complete: maestro task complete <id>
   - Block tasks: maestro task block <id> --reason "..."
   - Push tasks to worker queues: POST /queue/push
```

### Phase 7: Completion

```
10. Worker completes all work:
    CLI:  maestro report complete "All tasks finished"
    (without --task flag: marks SESSION as completed)
    -> PATCH /api/sessions/:id { status: 'completed' }

    OR: Claude process exits naturally
    Hook (SessionEnd): maestro session complete
    -> PATCH /api/sessions/:id { status: 'completed' }

11. Orchestrator verifies and reports:
    Checks all tasks are completed.
    CLI: maestro report complete "All workers finished, criteria met"
    -> Session marked completed
```

---

## The "needs_input" / "needs-user-input" Flow

This is one of the most important workflows -- it handles the case where an AI agent cannot proceed without human intervention.

### Terminology Note

Two related but distinct values exist:
- **`TaskSessionStatus: 'needs_input'`** (underscore) -- the task-level agent status
- **`SessionStatus: 'needs-user-input'`** (hyphens) -- the session-level status
- **`SessionTimelineEventType: 'needs_input'`** (underscore) -- the timeline event type

### Detailed Flow

```
Step 1: Claude agent encounters something requiring human decision.
        Agent stops responding / exits prompt loop.

Step 2: Claude Code's Stop hook fires automatically.
        Hook command: maestro session needs-input

Step 3: CLI executes:
        PATCH /api/sessions/:id {
          status: 'needs-user-input',
          timeline: [{ type: 'needs_input', message: '...', timestamp: ... }]
        }

Step 4: Server updates session record.
        EventBus emits: session:updated (full Session object)

Step 5: WebSocketBridge broadcasts to all connected clients.

Step 6: UI receives event:
        useMaestroStore: sessions.set(session.id, updatedSession)
        Dashboard shows session with "Needs Input" indicator.

Step 7: User reviews the situation in UI or terminal.
        Provides input to the Claude process (types in terminal).

Step 8: UserPromptSubmit hook fires when user sends input.
        Hook command: maestro session resume-working

Step 9: CLI executes:
        PATCH /api/sessions/:id { status: 'working' }

Step 10: Session resumes normal operation.
         working <-> needs-user-input can cycle multiple times.
```

### Task-Level needs_input

```
Separately, an agent can report needs_input at the task level:

CLI: maestro report needs-input "Which database should I use?" --task <id>

This does:
1. PATCH /api/tasks/:id { sessionStatus: 'needs_input', updateSource: 'session' }
2. POST /api/sessions/:id/timeline { type: 'needs_input', message: '...', taskId: id }

The task's sessionStatus becomes 'needs_input' while the session itself
may remain 'working' (if it has other tasks to process).
```

---

## Event-Driven Update Flow

### Architecture

```
Application Services ----emit()----> InMemoryEventBus ----handler()----> WebSocketBridge ----ws.send()----> UI Store
     (publish)                    (Node EventEmitter)                  (broadcast to all)              (Zustand update)
```

### Formally Typed Events (14 events -- subscribed by WebSocketBridge)

| Event | Payload | Emitted By |
|-------|---------|------------|
| `project:created` | `Project` | ProjectService |
| `project:updated` | `Project` | ProjectService |
| `project:deleted` | `{ id }` | ProjectService |
| `task:created` | `Task` | TaskService |
| `task:updated` | `Task` | TaskService |
| `task:deleted` | `{ id }` | TaskService |
| `task:session_added` | `{ taskId, sessionId }` | TaskService, SessionService, spawn route |
| `task:session_removed` | `{ taskId, sessionId }` | TaskService, SessionService |
| `session:created` | `Session` | SessionService |
| `session:spawn` | `SpawnRequestEvent` | spawn route (suppresses session:created) |
| `session:updated` | `Session` | SessionService |
| `session:deleted` | `{ id }` | SessionService |
| `session:task_added` | `{ sessionId, taskId }` | SessionService |
| `session:task_removed` | `{ sessionId, taskId }` | SessionService |

### Untyped Events (11 events -- emitted but NEVER subscribed to)

| Event | Payload | Emitted By | Status |
|-------|---------|------------|--------|
| `template:created` | `{ template }` | TemplateService | DEAD |
| `template:updated` | `{ template }` | TemplateService | DEAD |
| `template:deleted` | `{ id }` | TemplateService | DEAD |
| `template:reset` | `{ template }` | TemplateService | DEAD |
| `queue:created` | `{ sessionId, queue }` | QueueService | DEAD |
| `queue:item_started` | `{ sessionId, taskId }` | QueueService | DEAD |
| `queue:item_completed` | `{ sessionId, taskId }` | QueueService | DEAD |
| `queue:item_failed` | `{ sessionId, taskId, reason? }` | QueueService | DEAD |
| `queue:item_skipped` | `{ sessionId, taskId }` | QueueService | DEAD |
| `queue:item_pushed` | `{ sessionId, taskId }` | QueueService | DEAD |
| `queue:deleted` | `{ sessionId }` | QueueService | DEAD |

### How Status Changes Propagate

```
Example: Worker reports task complete

1. Agent runs: maestro report complete "Done" --task task-123
2. CLI sends: PATCH /api/tasks/task-123 { sessionStatus: 'completed', updateSource: 'session' }
3. TaskService.updateTask():
   - Detects updateSource='session', strips all fields except sessionStatus
   - Calls taskRepo.update() (persists to ~/.maestro/data/tasks/task-123.json)
   - Emits eventBus.emit('task:updated', updatedTask)
4. InMemoryEventBus: calls all handlers for 'task:updated' concurrently
5. WebSocketBridge handler: broadcasts { event: 'task:updated', data: task } to all WS clients
6. UI (useMaestroStore): receives WS message, calls tasks.set(task.id, task)
7. React re-renders any component showing task-123 with new sessionStatus
```

### WebSocket Message Format

```json
{
  "type": "task:updated",
  "event": "task:updated",
  "data": { "id": "task-123", "status": "todo", "sessionStatus": "completed", ... },
  "timestamp": 1707500000000
}
```

### Reconnection Strategy

Both UI WebSocket implementations use exponential backoff:
- Initial delay: 1000ms
- Formula: `1000 * 2^attempts`
- Max delay: 30000ms
- On reconnect: re-fetches all tasks and sessions for active project

---

## CLI Command Reference

### Top-Level Commands

| Command | Description | Requires Session |
|---------|-------------|-----------------|
| `maestro whoami` | Print current context (server, project, session, tasks, strategy) | No |
| `maestro commands` | Show available commands from manifest permissions | No |
| `maestro commands --check <cmd>` | Check if a specific command is permitted | No |
| `maestro status` | Project summary: tasks by status/priority, active sessions | No |
| `maestro track-file <path>` | Track file modification (PostToolUse hook) | Yes |

### Project Commands

| Command | Description | API Call |
|---------|-------------|---------|
| `maestro project list` | List all projects | `GET /api/projects` |
| `maestro project create <name>` | Create project (`-d, --dir`, `--desc`) | `POST /api/projects` |
| `maestro project get <id>` | Get project details | `GET /api/projects/:id` |
| `maestro project delete <id>` | Delete project | `DELETE /api/projects/:id` |

### Task Commands

| Command | Description | Permission |
|---------|-------------|-----------|
| `maestro task list [taskId]` | List tasks (`--status`, `--priority`, `--all`) | worker, orchestrator |
| `maestro task create [title]` | Create task (`-t`, `-d`, `--priority`, `--parent`) | worker, orchestrator |
| `maestro task get [id]` | Get task (falls back to context taskIds[0]) | worker, orchestrator |
| `maestro task update <id>` | Update task (`--status`, `--priority`, `--title`) | orchestrator only |
| `maestro task complete <id>` | Set status=completed + timeline event | orchestrator only |
| `maestro task block <id>` | Set status=blocked (`--reason` required) + timeline | orchestrator only |
| `maestro task children <taskId>` | List children (`--recursive`) | worker, orchestrator |
| `maestro task tree` | Full task tree (`--root`, `--depth`, `--status`) | orchestrator only |

### Session Commands

| Command | Description | Trigger |
|---------|-------------|---------|
| `maestro session list` | List sessions (`--task` filter) | Manual |
| `maestro session info` | Current session details | Manual |
| `maestro session spawn` | Spawn worker/orchestrator (`--task`, `--skill`, `--name`, `--reason`, `--include-related`, `--orchestrator-strategy`) | Manual / Agent |
| `maestro session register` | Register with server (status -> 'running') | SessionStart hook |
| `maestro session complete` | Mark session completed | SessionEnd hook |
| `maestro session needs-input` | Mark session needs-user-input | Stop hook |
| `maestro session resume-working` | Resume to working status | UserPromptSubmit hook |

### Report Commands (Agent Status Reporting)

| Command | Session Status Set | Timeline Event Type | Notes |
|---------|-------------------|-------------------|-------|
| `maestro report progress <msg>` | `working` | `progress` | -- |
| `maestro report complete <msg>` | `completed` | `task_completed` | Without `--task`: also marks session completed |
| `maestro report blocked <msg>` | `blocked` | `task_blocked` | -- |
| `maestro report error <msg>` | `failed` | `error` | -- |
| `maestro report needs-input <msg>` | `needs_input` | `needs_input` | -- |

All accept `--task <id1,id2,...>` to target specific tasks. Without `--task`, only a session timeline event is posted.

### Queue Commands (Queue Strategy Only)

| Command | Description | API Call |
|---------|-------------|---------|
| `maestro queue top` | Peek at next queued item | `GET /queue/top` |
| `maestro queue start` | Claim next item (polls if empty: `--poll-interval`, `--poll-timeout`) | `POST /queue/start` |
| `maestro queue complete` | Complete current item | `POST /queue/complete` |
| `maestro queue fail` | Fail current item (`--reason`) | `POST /queue/fail` |
| `maestro queue skip` | Skip current/next item | `POST /queue/skip` |
| `maestro queue list` | List all items with stats | `GET /queue/items` |
| `maestro queue push <taskId>` | Add task to queue | `POST /queue/push` |
| `maestro queue status` | Queue summary | `GET /queue` |

### Other Commands

| Command | Description |
|---------|-------------|
| `maestro worker init` | Initialize worker session from manifest (7-step flow) |
| `maestro orchestrator init` | Initialize orchestrator session from manifest (6-step flow) |
| `maestro coordinate shared-session <name>` | Create shared tmux session |
| `maestro coordinate spawn-pane` | Spawn agent in new tmux pane (`-s`, `-v`, `--cwd`) |
| `maestro skill list` | List discovered skills |
| `maestro skill info <name>` | Skill details |
| `maestro skill validate` | Validate all skills |
| `maestro manifest generate` | Generate manifest JSON (`--role`, `--project-id`, `--task-ids`, `--skills`, `--strategy`, `--output`) |

### Deprecated Commands (to be removed)

| Deprecated | Replacement |
|-----------|-------------|
| `maestro update <msg>` | `maestro report progress` |
| `maestro update:progress <msg>` | `maestro report progress` |
| `maestro update:blocked <msg>` | `maestro report blocked` |
| `maestro update:needs-input <msg>` | `maestro report needs-input` |
| `maestro update:complete <msg>` | `maestro report complete` |
| `maestro update:error <msg>` | `maestro report error` |

---

## Cross-Cutting Concerns and Patterns

### 1. Dual-Status Design (TaskStatus vs TaskSessionStatus)

The system separates **authority** over task state:
- **TaskStatus** (`todo`, `in_progress`, `completed`, `cancelled`, `blocked`): Controlled by orchestrators and humans. Workers cannot modify this via CLI permission guards AND server-side stripping.
- **TaskSessionStatus** (`queued`, `working`, `needs_input`, `blocked`, `completed`, `failed`, `skipped`): Reported by agent sessions. Reflects what the agent thinks is happening.

This allows an orchestrator to keep a task as `in_progress` even if a worker reports `sessionStatus: 'failed'`, enabling retry/reassignment workflows.

### 2. Hook-Driven Lifecycle

Claude Code hooks drive session status transitions automatically:

| Hook | Command Executed | Status Set |
|------|-----------------|-----------|
| SessionStart | `maestro session register` | `running` (bug) |
| UserPromptSubmit | `maestro session resume-working` | `working` |
| Stop | `maestro session needs-input` | `needs-user-input` |
| SessionEnd | `maestro session complete` | `completed` |
| PostToolUse | `maestro track-file <path>` | (file tracking only) |

### 3. Manifest-Driven Configuration

Sessions are configured via a JSON manifest generated at spawn time:
- **Role** (worker/orchestrator) determines available commands and prompt template
- **Strategy** determines task processing model and CLI commands available
- **Skills** add capabilities via Claude Code plugin directories
- **Template variables** (`${TASK_TITLE}`, `${ALL_TASKS}`, `${STRATEGY_INSTRUCTIONS}`) customize the prompt

Template resolution: Server template by ID -> Server template by role -> Bundled file (`{role}-{strategy}-prompt.md`)

### 4. File-System Persistence

All data is stored as JSON files under `~/.maestro/data/`:
- Repositories use in-memory cache + write-through pattern
- No database, no transactions, no locking
- Lazy initialization on first access

### 5. Permission Model

```
Worker permissions:   task:list, task:get, task:create, task:children,
                      session:list, session:info,
                      report:*, queue:*, worker:init

Orchestrator adds:    task:update, task:complete, task:block, task:tree,
                      session:spawn, orchestrator:init
```

Enforced at CLI level (`guardCommand()`) and server level (update source stripping).

### 6. Event Suppression Pattern

The spawn flow uses `_suppressCreatedEvent: true` to prevent `session:created` from firing, then emits `session:spawn` instead. This ensures the UI receives one event (spawn) rather than two (created + spawn), but creates a fragile implicit contract.

---

## Identified Gaps, Inconsistencies, and Issues

### Critical Issues

| # | Source | Issue | Impact |
|---|--------|-------|--------|
| 1 | Sessions | `'running'` status not in `SessionStatus` enum | Type safety bypass at runtime; `session register` sets an invalid status |
| 2 | Events | 11 queue/template events have no type definitions | Complete bypass of `TypedEventMap`; no compile-time safety |
| 3 | Events | All 11 queue/template events are never subscribed to | Dead code; events fire into the void with zero listeners |
| 4 | Tasks | No status transition validation on TaskStatus | `completed->todo`, `cancelled->blocked` possible; stale timestamps |
| 5 | Sessions | No status transition validation on SessionStatus | `completed->spawning` possible via PATCH |

### High Issues

| # | Source | Issue | Impact |
|---|--------|-------|--------|
| 6 | Tasks | Single `sessionStatus` field for many-to-many | Last writer wins when multiple sessions work on same task |
| 7 | Tasks | No bidirectional sync for Task-Session association | `addSessionToTask` does not update session's `taskIds`; manual sync required |
| 8 | Tasks | No cascade delete for parent tasks | Orphaned children with dangling `parentId` references |
| 9 | Events | `task:session_added` emitted from 3-4 separate code paths | Fragile; risk of duplicate events |
| 10 | Queue | `skipItem` does not update task `sessionStatus` | Inconsistent: start/complete/fail all update it, skip does not |
| 11 | Queue | Queue-Task status sync bypasses TaskService | No events emitted, no validation applied during queue transitions |
| 12 | CLI | Orchestrator init does not update session status to 'running' | Orchestrator sessions may stay in 'spawning' until register hook fires |
| 13 | CLI | Manifest generator reads from local storage, not server API | Potential stale data if local storage is out of sync |

### Medium Issues

| # | Source | Issue | Impact |
|---|--------|-------|--------|
| 14 | Sessions | Incorrect timeline event on task removal (always `task_completed`) | Misleading audit trail; removal is not always completion |
| 15 | Sessions | Strategy field ambiguity (union type but always WorkerStrategy) | `Session.strategy` is misleading for orchestrator sessions |
| 16 | Queue | `WorkerStrategy` type mismatch: server has `'tree'`, CLI does not | Potential TypeScript errors; inconsistent validation |
| 17 | Queue | No queue cleanup on session completion | Orphaned queues with items stuck in `queued` state forever |
| 18 | Queue | Race condition in CLI polling (top check -> start claim gap) | Unlikely in single-worker model but architecturally unsafe |
| 19 | Events | Duplicate WebSocket implementations in UI (hook vs store) | Could create two connections; unclear which is primary |
| 20 | Events | Inconsistent payload wrapping across event types | UI must handle `data.session || data` workaround |
| 21 | CLI | `report complete` without `--task` silently marks session completed | Surprising side effect; non-obvious conditional behavior |
| 22 | CLI | `session needs-input` sends timeline in PATCH body (unique pattern) | Inconsistent with other commands that use POST /timeline |
| 23 | CLI | `session register` creates sparse sessions when not found | Sessions without proper manifest context |
| 24 | CLI | No error recovery reset in queue polling timeout | Connectivity issues count against timeout budget |
| 25 | Sessions | No validation of SessionStatus transitions server-side | Any status can be set from any other status |

### Low Issues

| # | Source | Issue | Impact |
|---|--------|-------|--------|
| 26 | Tasks | `dependencies: string[]` is completely inert | Dead field; no API, CLI, or enforcement anywhere |
| 27 | Tasks | `priority` has no functional impact | Stored and displayed but never used for ordering/scheduling |
| 28 | Tasks | No `maestro task cancel` CLI command | Must use `maestro task update --status cancelled` |
| 29 | Tasks | Server-side priority filtering not supported | CLI does client-side filtering |
| 30 | Tasks | `task:tree` makes N+1 API calls | Performance issue for deep task trees |
| 31 | Tasks | `parentId=null` string encoding is fragile | No validation rejects an actual ID of "null" |
| 32 | Sessions | `completedAt` sent by CLI but ignored by repository | Redundant; repository auto-sets it |
| 33 | Sessions | Dual event systems (events[] + timeline[]) | Unclear purpose distinction; events[] appears legacy |
| 34 | Sessions | `tree` worker strategy is unimplemented server-side | Behaves identically to `simple` (no tree-specific init) |
| 35 | Sessions | Deletion adds timeline event then immediately deletes | Timeline event is effectively invisible |
| 36 | Queue | `currentIndex` tracks by array position not taskId | Fragile if items were ever reordered/removed |
| 37 | Queue | Unused `getQueueInstructions()` in PromptGenerator | Dead code |
| 38 | Queue | Missing templates for intelligent-batching and dag strategies | Falls back to server template or throws error |
| 39 | Events | UI has handlers for never-emitted subtask events | Dead code from planned feature |
| 40 | Events | No event ordering/idempotency/replay guarantees | Compensated by full re-fetch on reconnect |
| 41 | CLI | `session spawn` hardcodes `spawnSource: 'session'` | Cannot distinguish manual CLI spawns from agent-initiated |
| 42 | CLI | 6 deprecated `update:*` commands still in codebase | Should be removed after template migration |
| 43 | CLI | `track-file` silently exits on no session | Invisible misconfiguration |
| 44 | Queue | Stale `orchestrator-prompt.md` template | Never loaded by current template resolution logic |

---

## Recommendations for Improvement

### Priority 1: Fix Type Safety and Enum Issues

1. **Add `'running'` to `SessionStatus` enum** or change `session register` to use `'working'`/`'idle'`. This is the most impactful single fix -- it eliminates a runtime type violation on every session start.

2. **Add queue/template events to `TypedEventMap`** in `DomainEvents.ts`. Either make them formally typed or remove the emit calls if they have no consumers.

3. **Align `WorkerStrategy` type** between server (`'simple' | 'queue' | 'tree'`) and CLI (`'simple' | 'queue'`). Add `'tree'` to the CLI type definition.

### Priority 2: Add Status Transition Validation

4. **Implement a state machine** for both `TaskStatus` and `SessionStatus` that validates transitions. Reject invalid transitions at the service layer. Key rules:
   - `completed` and `cancelled` tasks cannot return to `todo` or `in_progress` without explicit "reopen"
   - Terminal session statuses (`completed`, `failed`, `stopped`) cannot transition to non-terminal states
   - Clear `completedAt` if a completed task is reopened

### Priority 3: Fix Data Integrity Issues

5. **Fix single `sessionStatus` for many-to-many**: Either make `sessionStatus` a `Record<sessionId, TaskSessionStatus>` or document that only the most recent session's status is tracked.

6. **Implement bidirectional sync** in a single transactional method (or at minimum, ensure both `addSessionToTask` and `addTaskToSession` are always called together).

7. **Add cascade handling** for parent task deletion (orphan children or block deletion if children exist).

8. **Fix `skipItem`** in QueueService to update task `sessionStatus` to `'skipped'`, matching the behavior of start/complete/fail.

### Priority 4: Clean Up Dead Code and Inconsistencies

9. **Remove or implement the `dependencies` field** on Task. If task dependencies are a planned feature, create an issue. Otherwise, remove the field to reduce confusion.

10. **Subscribe to queue/template events** in the WebSocketBridge (so the UI can show real-time queue progress), or remove the emit calls.

11. **Remove the 6 deprecated `update:*` commands** and the unused `getQueueInstructions()` method.

12. **Consolidate the dual event systems** (`events[]` and `timeline[]`) on Session. Migrate to timeline-only.

13. **Consolidate the two WebSocket implementations** in the UI (hook vs store). Choose one as canonical.

### Priority 5: Operational Improvements

14. **Add queue cleanup** on session completion/failure (mark remaining `queued` items as `skipped` or `cancelled`).

15. **Route queue-task status updates through TaskService** instead of directly calling `taskRepo.update()`, so events are emitted and validation applies.

16. **Add a batch endpoint** for task tree fetching to eliminate N+1 API calls.

17. **Create dedicated templates** for `intelligent-batching` and `dag` orchestrator strategies, or implement proper fallback to `orchestrator-default-prompt.md`.

---

## Appendix: File Index

### Server (`maestro-server/src/`)

| File | Purpose |
|------|---------|
| `types.ts` | All type definitions (Task, Session, QueueItem, QueueState, enums) |
| `api/taskRoutes.ts` | Task REST endpoints |
| `api/sessionRoutes.ts` | Session REST endpoints + spawn flow |
| `api/queueRoutes.ts` | Queue REST endpoints |
| `application/services/TaskService.ts` | Task business logic |
| `application/services/SessionService.ts` | Session business logic |
| `application/services/QueueService.ts` | Queue business logic |
| `application/services/TemplateService.ts` | Template management |
| `application/services/ProjectService.ts` | Project business logic |
| `domain/events/DomainEvents.ts` | Typed event definitions |
| `domain/events/IEventBus.ts` | Event bus interface |
| `infrastructure/events/InMemoryEventBus.ts` | Event bus implementation |
| `infrastructure/websocket/WebSocketBridge.ts` | WebSocket broadcast bridge |
| `infrastructure/repositories/FileSystem*.ts` | File-based persistence |
| `container.ts` | Dependency injection wiring |
| `server.ts` | Express server startup |

### CLI (`maestro-cli/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | CLI entry point, top-level commands, deprecated aliases |
| `api.ts` | HTTP client with retry logic |
| `config.ts` | Environment variable resolution |
| `commands/task.ts` | Task commands |
| `commands/session.ts` | Session commands |
| `commands/report.ts` | Agent status reporting commands |
| `commands/queue.ts` | Queue processing commands |
| `commands/project.ts` | Project commands |
| `commands/worker-init.ts` | Worker initialization flow |
| `commands/orchestrator-init.ts` | Orchestrator initialization flow |
| `commands/coordinate.ts` | Tmux coordination commands |
| `commands/skill.ts` | Skill discovery commands |
| `commands/manifest-generator.ts` | Manifest generation |
| `commands/prompt-generator.ts` | Prompt template rendering |
| `commands/session-brief-generator.ts` | Session brief display |
| `commands/command-permissions.ts` | Role-based permission definitions |
| `types/manifest.ts` | Manifest type definitions |

### UI (`maestro-ui/src/`)

| File | Purpose |
|------|---------|
| `stores/useMaestroStore.ts` | Main Zustand store + WebSocket consumer |
| `hooks/useMaestroWebSocket.ts` | Alternative WebSocket hook |

---

*Generated from 5 focused reviews: Task Statuses & Lifecycle, Session Statuses & Lifecycle, Domain Events System, CLI Commands & Report System, Queue Strategies & Workflow.*
