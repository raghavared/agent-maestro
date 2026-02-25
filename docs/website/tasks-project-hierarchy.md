# Tasks and Project Hierarchy

Maestro’s task system uses a project-centered hierarchy with explicit task/session links so planning and execution stay connected.

## What It Is

- `Project` is the top-level workspace boundary.
- `Task` belongs to one project and can optionally have a `parentId` (subtask model).
- `Session` belongs to one project and can execute one or many tasks (`taskIds`).
- Tasks and sessions are many-to-many.
- A task can be worked by multiple sessions (`task.sessionIds`).
- A session can work multiple tasks (`session.taskIds`).

## Why This Model Exists

- Support parallel execution without duplicating task definitions.
- Keep a single task backlog while allowing multiple worker runs, retries, and comparisons.
- Preserve traceability from planning (task tree) to execution (session timeline + docs).
- Enable coordinator/worker workflows where one coordinator session can launch many worker sessions against related tasks.

## Task Lifecycle and Priority

### Task priority
- `low`
- `medium`
- `high`

### Task status
- `todo` → default on create
- `in_progress`
- `in_review`
- `completed`
- `blocked`
- `cancelled`

Notes:
- `startedAt` is set when status first becomes `in_progress`.
- `completedAt` is set when status first becomes `completed`.
- Session-reported progress is tracked separately in `taskSessionStatuses` (for example `working`, `blocked`, `completed`, `failed`) so agent execution state does not overwrite user-owned task status.

## Parent/Child Tasks

- Any task can point to a parent via `parentId`.
- Child tasks are fetched via `GET /tasks/:id/children`.
- Deleting a parent task performs cascade deletion of descendants.
- This supports decomposition workflows: one parent objective, many independently executable subtasks.

## Task-to-Session Links

- Links are maintained both ways for consistency.
- When session is created/spawned with tasks, each task gets that session in `sessionIds`.
- When task updates come from a session not yet linked, the server auto-links them.
- Add/remove operations update both entities and emit events (`task:session_added`, `session:task_added`, etc.).

This keeps UI queries consistent from either side:
- “Which sessions worked on this task?”
- “Which tasks are in this session?”

## Multi-Task to Multi-Session Hierarchy

At runtime, hierarchy is:

`Project -> Task tree (parent/child) -> Session graph (many-to-many task links)`

This means:
- One project can contain many related task trees.
- Multiple sessions can execute the same task (parallel attempts or retries).
- One session can execute a batch of tasks.
- Coordinator-spawned workers can be grouped with `parentSessionId`/`teamSessionId` while still linking back to shared task IDs.

## How It Connects to Other Modules

- API routes: `maestro-server/src/api/taskRoutes.ts`, `maestro-server/src/api/sessionRoutes.ts`, `maestro-server/src/api/projectRoutes.ts`
- Business rules: `maestro-server/src/application/services/TaskService.ts`, `maestro-server/src/application/services/SessionService.ts`, `maestro-server/src/application/services/ProjectService.ts`
- Persistence: `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts`, `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`
- Realtime sync: event bus + websocket bridge propagates lifecycle/link updates to clients

## User Value

Users get one coherent model for planning and execution: organize work as task hierarchies, run it in parallel sessions, and keep status, artifacts, and accountability connected without manual bookkeeping.
