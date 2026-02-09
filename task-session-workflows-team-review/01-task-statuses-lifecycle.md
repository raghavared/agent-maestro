# Task Statuses & Lifecycle Review

## 1. Task Type Definition

**File:** `maestro-server/src/types.ts` (lines 33-58)

```typescript
interface Task {
  id: string;                    // Generated with 'task' prefix by IIdGenerator
  projectId: string;             // Required - parent project
  parentId: string | null;       // Hierarchical parent task (null = root task)
  title: string;                 // Required, trimmed on create
  description: string;           // Defaults to '' on create
  status: TaskStatus;            // User-controlled workflow status
  sessionStatus?: TaskSessionStatus;  // Session's working status (optional)
  priority: TaskPriority;        // Defaults to 'medium' on create
  createdAt: number;             // Epoch ms, set on create
  updatedAt: number;             // Epoch ms, updated on every mutation
  startedAt: number | null;      // Set when status first becomes 'in_progress'
  completedAt: number | null;    // Set when status first becomes 'completed'
  initialPrompt: string;         // Defaults to '' on create

  // Many-to-many relationships (Phase IV-A)
  sessionIds: string[];          // Sessions working on this task
  skillIds: string[];            // Skills assigned (Phase IV-B)
  agentIds: string[];            // Agents assigned (Phase IV-C)

  dependencies: string[];        // Task IDs this task depends on
  model?: 'haiku' | 'sonnet' | 'opus';  // Optional model override
}
```

**Notes:**
- Timeline was removed from Task and moved to Session.
- `sessionIds`, `skillIds`, `agentIds` are initialized to `[]` on create and also back-filled during load for legacy data (`loadTaskFile`).
- `dependencies` is initialized to `[]` but there is **no code that reads, enforces, or manages dependencies** anywhere in TaskService, the repository, or the API routes. It is a dead field.

---

## 2. TaskStatus Enum

**File:** `maestro-server/src/types.ts` (line 84)

```typescript
type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
```

| Value | Meaning | Side Effects (in repository `update`) |
|---|---|---|
| `todo` | Task created, not yet started | None |
| `in_progress` | Actively being worked on | Sets `startedAt = Date.now()` (first time only) |
| `completed` | Work finished successfully | Sets `completedAt = Date.now()` (first time only) |
| `cancelled` | Task was cancelled by user | None |
| `blocked` | Task is blocked on something | None |

### Valid Transitions

**There are NO enforced transition rules.** The repository `update` method accepts any `TaskStatus` value at any time. The following transitions are implied by usage patterns but not validated:

- `todo` -> `in_progress` (start work)
- `todo` -> `cancelled` (cancel before starting)
- `in_progress` -> `completed` (finish work)
- `in_progress` -> `blocked` (hit a blocker)
- `in_progress` -> `cancelled` (cancel during work)
- `blocked` -> `in_progress` (unblocked)
- `blocked` -> `cancelled` (cancel while blocked)

**Issue: No transition validation.** A task can go from `completed` back to `todo`, `cancelled` to `in_progress`, etc. The `startedAt` and `completedAt` timestamps have a `!task.startedAt` / `!task.completedAt` guard so they only get set once, but the status itself is unconstrained.

**Issue: Re-opening a completed task.** If a completed task is set back to `in_progress`, `startedAt` retains its original value (correct) but `completedAt` also retains its old value (incorrect -- it now shows a completion time for a task that isn't completed).

---

## 3. TaskSessionStatus Enum

**File:** `maestro-server/src/types.ts` (line 85)

```typescript
type TaskSessionStatus = 'queued' | 'working' | 'needs_input' | 'blocked' | 'completed' | 'failed' | 'skipped';
```

This is the **session's view** of a task -- how the agent/session perceives its work on that task. It is separate from the user-controlled `status`.

| Value | Meaning | When Set |
|---|---|---|
| `queued` | Task is queued for processing | Set by queue system when task is added to a session's queue |
| `working` | Session is actively working on this task | Set by session via API when starting work |
| `needs_input` | Session needs user input to proceed | Set by session when it encounters something requiring human decision |
| `blocked` | Session is blocked on this task | Set by session when it hits a blocker |
| `completed` | Session considers this task done | Set by session when it finishes work |
| `failed` | Session failed on this task | Set by session when work fails |
| `skipped` | Session skipped this task | Set by session/queue when task is skipped |

### Relationship to TaskStatus

`sessionStatus` and `status` are **independent**. A session can mark `sessionStatus: 'completed'` without changing `status` (which remains controlled by users/orchestrators). This is by design -- the enforcement in `TaskService.updateTask` (lines 103-123) strips `status` from session-sourced updates:

```typescript
if (updates.updateSource === 'session') {
  // Sessions can ONLY update sessionStatus, not status/title/description/priority
}
```

**Issue: Single sessionStatus for many-to-many.** The `sessionStatus` field is a single value on the Task, but multiple sessions can work on the same task (`sessionIds: string[]`). If Session A sets `sessionStatus: 'working'` and Session B sets `sessionStatus: 'completed'`, Session B's value wins. There's no per-session status tracking.

---

## 4. TaskService Lifecycle Management

**File:** `maestro-server/src/application/services/TaskService.ts`

### Create (`createTask`)
1. Validates `projectId` is present
2. Validates `title` is non-empty (trims whitespace)
3. Verifies project exists via `projectRepo.findById`
4. Verifies parent task exists if `parentId` provided
5. Delegates to `taskRepo.create` (which sets defaults)
6. Emits `task:created` event
7. Returns created task

**Default values set by repository on create:**
- `status: 'todo'`
- `priority: input.priority || 'medium'`
- `description: input.description || ''`
- `initialPrompt: input.initialPrompt || ''`
- `sessionIds: []`, `skillIds: input.skillIds || []`, `agentIds: []`
- `dependencies: []`
- `startedAt: null`, `completedAt: null`
- `parentId: input.parentId || null`

### Update (`updateTask`)
1. Validates title is non-empty if provided
2. **Enforces update source permissions:**
   - If `updateSource === 'session'`: strips all fields except `sessionStatus`
   - If user update: allows all fields (strips internal `updateSource`/`sessionId`)
3. Delegates to `taskRepo.update`
4. Emits `task:updated` event

### Delete (`deleteTask`)
1. Verifies task exists (throws `NotFoundError` if not)
2. Delegates to `taskRepo.delete`
3. Emits `task:deleted` event

**Issue: No cascade delete.** Deleting a parent task does not delete or orphan child tasks. Children retain their `parentId` pointing to a non-existent task.

### Session Association
- `addSessionToTask(taskId, sessionId)` -- adds sessionId to `task.sessionIds` (deduped), emits `task:session_added`
- `removeSessionFromTask(taskId, sessionId)` -- filters sessionId out, emits `task:session_removed`

**Missing: No `completeTask` or `cancelTask` convenience methods** in TaskService. The CLI commands (`task complete`, `task block`) call `updateTask` with the appropriate status directly.

---

## 5. Task-Session Relationships (Many-to-Many)

Tasks and Sessions have a bidirectional many-to-many relationship:

- **Task side:** `task.sessionIds: string[]` -- which sessions work on this task
- **Session side:** `session.taskIds: string[]` -- which tasks this session works on

### Association Management

**Task -> Session:** `TaskService.addSessionToTask()` / `removeSessionFromTask()` updates the Task's `sessionIds`.

**Session -> Task:** Managed by `SessionService` / `CreateSessionPayload.taskIds`.

**Issue: No referential integrity enforcement.** Adding a session to a task does not automatically add the task to the session's `taskIds` (and vice versa). These must be kept in sync manually by calling code. There is no transaction or consistency guarantee.

---

## 6. Task Dependencies

**Field:** `task.dependencies: string[]`

This field exists in the type definition and is initialized to `[]` on creation. However:

- **No API endpoint** exposes dependency management (no add/remove dependency routes)
- **No CLI command** to manage dependencies
- **No enforcement** -- dependencies are never checked when starting a task
- **TaskFilter** does not support filtering by dependency
- **CreateTaskPayload** does not include `dependencies`

**Verdict: Completely inert.** The field is declared but never used anywhere in the system.

---

## 7. Task Priority System

**Type:** `TaskPriority = 'low' | 'medium' | 'high'`

- Default on create: `'medium'`
- Can be set via `CreateTaskPayload.priority`
- Can be updated via `UpdateTaskPayload.priority` (user updates only, not session updates)
- CLI: `maestro task create --priority <priority>` and `maestro task update <id> --priority <priority>`
- Filterable in CLI via `maestro task list --priority <priority>` (client-side filter)

**Issue: Priority is not used for ordering or scheduling.** No code sorts by priority or uses it to determine task processing order. It is purely informational/display metadata.

---

## 8. API Endpoints

**File:** `maestro-server/src/api/taskRoutes.ts`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List tasks. Query params: `projectId`, `status`, `parentId` (use `'null'` for root tasks) |
| `POST` | `/api/tasks` | Create task. Body: `CreateTaskPayload` |
| `GET` | `/api/tasks/:id` | Get single task by ID |
| `PATCH` | `/api/tasks/:id` | Update task. Body: `UpdateTaskPayload` |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/tasks/:id/children` | List direct child tasks |
| `POST` | `/api/tasks/:id/timeline` | Add timeline event (proxied to session timeline). Requires `message` and `sessionId` in body |

**Note on timeline proxy:** `POST /api/tasks/:id/timeline` is a backward-compatibility route. It verifies the task exists, then forwards the event to `SessionService.addTimelineEvent()`. If `sessionService` is not injected, it returns success without persisting.

---

## 9. CLI Commands

**File:** `maestro-cli/src/commands/task.ts`

| Command | Description | Role Access |
|---|---|---|
| `maestro task list [taskId]` | List tasks or show a specific task's subtree. Options: `--status`, `--priority`, `--all` | worker, orchestrator |
| `maestro task create [title]` | Create a task. Options: `--title`, `--desc`, `--priority`, `--parent` | worker, orchestrator |
| `maestro task get [id]` | Get task details. Falls back to context `taskIds[0]` if no ID given | worker, orchestrator |
| `maestro task update <id>` | Update task. Options: `--status`, `--priority`, `--title` | **orchestrator only** |
| `maestro task complete <id>` | Sets `status: 'completed'`, posts timeline event | **orchestrator only** |
| `maestro task block <id>` | Sets `status: 'blocked'`, requires `--reason`, posts timeline event | **orchestrator only** |
| `maestro task children <taskId>` | List child tasks. Option: `--recursive` | worker, orchestrator |
| `maestro task tree` | Full hierarchical task tree. Options: `--root`, `--depth`, `--status` | **orchestrator only** |

### Permission Model (from `command-permissions.ts`)

Workers can: `task:list`, `task:get`, `task:create`, `task:children`
Orchestrators can: all of the above plus `task:update`, `task:complete`, `task:block`, `task:tree`

**Workers cannot change task status** -- this is enforced at two levels:
1. CLI: `guardCommand()` blocks workers from running `task:update`, `task:complete`, `task:block`
2. Server: `TaskService.updateTask()` strips `status` from session-sourced updates

### Timeline Audit Trail

When running from a session context (`config.sessionId` is set), the CLI commands `task update`, `task complete`, and `task block` also post a timeline event to the session:
```
POST /api/sessions/:sessionId/timeline
{ type: 'task_status_changed', message: '...', taskId: id }
```

---

## 10. Gaps, Inconsistencies, and Issues Summary

### Design Issues

1. **No status transition validation.** Any status can transition to any other status. This allows nonsensical flows like `completed -> todo` or `cancelled -> blocked`. The `startedAt`/`completedAt` one-time guards are a partial mitigation but create their own inconsistency (a re-opened task has a stale `completedAt`).

2. **Single `sessionStatus` for many-to-many.** The Task has one `sessionStatus` field but can have multiple sessions. Last writer wins, which means the field is unreliable when multiple sessions work on the same task.

3. **No cascade delete.** Deleting a parent task leaves orphaned children with dangling `parentId` references.

4. **No bidirectional sync for Task-Session association.** `addSessionToTask` updates the task but not the session. Callers must manually keep both sides consistent.

### Dead/Unused Features

5. **`dependencies: string[]` is completely inert.** No creation, management, enforcement, or query support exists for this field.

6. **Priority has no functional impact.** It is stored and displayed but never used for ordering, scheduling, or any business logic.

### Missing Functionality

7. **No `cancel` CLI command.** The `cancelled` status exists but there is no `maestro task cancel <id>` shortcut (must use `maestro task update <id> --status cancelled`).

8. **No dependency management API.** Cannot add/remove/query task dependencies through any route or CLI command.

9. **Server-side filtering gaps.** Status and priority filtering in `task list` is done client-side in the CLI rather than via query parameters (status is supported server-side but priority is not).

### Minor Issues

10. **`task:tree` command makes N+1 API calls.** The `buildTree` function fetches each task and its children individually, resulting in a large number of HTTP requests for deep trees. A single batch endpoint would be more efficient.

11. **`parentId` query param encoding.** Using `parentId=null` as a string to mean "root tasks" works but is fragile -- there's no validation that rejects an actual task ID of `"null"`.

12. **`sessionStatus` naming inconsistency.** The type is `TaskSessionStatus` and the field comment says "renamed from agentStatus", but `UpdateTaskPayload` still has a comment referencing "Renamed from agentStatus". The rename appears complete in code but the comments could be cleaner.
