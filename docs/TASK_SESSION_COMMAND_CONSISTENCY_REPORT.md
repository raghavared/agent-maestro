# Task/Session Status + Command/API Consistency Report

## Scope
Analyzed current implementation in:
- CLI: `maestro-cli/src/commands/{task,session,report}.ts`
- Server API: `maestro-server/src/api/{taskRoutes,sessionRoutes}.ts`
- Services/Models: `maestro-server/src/{types.ts,application/services/{TaskService,SessionService}.ts,infrastructure/repositories/{FileSystemTaskRepository,FileSystemSessionRepository}.ts}`

## 1) Which commands update session state

Session-level updates:
- `maestro report progress "..."`
  - API: `POST /api/sessions/:id/timeline` with `type=progress`
- `maestro report complete "..."`
  - API: `POST /api/sessions/:id/timeline` with `type=task_completed`
  - Then API: `PATCH /api/sessions/:id` with `status=completed`
- `maestro report blocked "..."`
  - API: `POST /api/sessions/:id/timeline` with `type=task_blocked`
- `maestro report error "..."`
  - API: `POST /api/sessions/:id/timeline` with `type=error`

Session lifecycle commands:
- `maestro session register`
  - If exists: `PATCH /api/sessions/:id` => `status=working`
  - Else: `POST /api/sessions` => create with `status=working`
- `maestro session complete`
  - `PATCH /api/sessions/:id` => `status=completed`, `completedAt`
- Hidden but implemented: `maestro session needs-input`, `maestro session resume-working`
  - `PATCH /api/sessions/:id` with `needsInput` and/or `status=working`

Task-session (per-session on task) updates:
- `maestro task report progress <taskId> "..."` => task `taskSessionStatuses[sessionId]=working`
- `maestro task report complete <taskId> "..."` => task `taskSessionStatuses[sessionId]=completed`
- `maestro task report blocked <taskId> "..."` => task `taskSessionStatuses[sessionId]=blocked`
- `maestro task report error <taskId> "..."` => task `taskSessionStatuses[sessionId]=failed`
- All above also append session timeline events.

## 2) Status model actually used

Task lifecycle status (`TaskStatus`):
- `todo | in_progress | in_review | completed | cancelled | blocked`

Task per-session status (`TaskSessionStatus`):
- `queued | working | blocked | completed | failed | skipped`

Session status (`SessionStatus`):
- `spawning | idle | working | completed | failed | stopped`

Notes:
- `TaskService` enforces session updates can only change per-session task status (`taskSessionStatuses`), not task lifecycle status.
- `SessionService` propagates terminal session state (`completed`/`failed`/`stopped`) to linked tasks' `taskSessionStatuses[sessionId]` where still active.

## 3) Many-to-many relationship between tasks and sessions

Implemented as bidirectional arrays:
- Task has `sessionIds: string[]`
- Session has `taskIds: string[]`

Association operations:
- Session creation with `taskIds` adds session to every task (`taskRepo.addSession`) and adds timeline events.
- `POST /api/sessions/:id/tasks/:taskId` and `DELETE /api/sessions/:id/tasks/:taskId` maintain both sides.
- `listSessionsByTask` filters `session.taskIds.includes(taskId)`.
- `findBySessionId` filters `task.sessionIds.includes(sessionId)`.

This is true many-to-many (N tasks per session, N sessions per task), with per-edge state stored in:
- `task.taskSessionStatuses[sessionId]`.

## 4) Task/session docs behavior

- Session docs:
  - Add: `maestro session docs add "<title>" --file <path>` => `POST /api/sessions/:id/docs`
  - List: `maestro session docs list` => `GET /api/sessions/:id/docs`
- Task docs:
  - Add: `maestro task docs add <taskId> "<title>" --file <path>`
    - Internally writes to current session docs with `taskId` tag via `POST /api/sessions/:sessionId/docs`
  - List: `maestro task docs list <taskId>`
    - Aggregated across all sessions via `GET /api/tasks/:id/docs`

Implication: task docs are session-scoped entries tagged by task, then aggregated by task query.

## 5) Are CLI commands consistent with APIs?

Mostly yes for active code paths, with notable inconsistencies:

1. Session status naming mismatch in docs/spec:
- Code uses `working`; older docs/spec frequently say `running`.
- `maestro status` still treats active sessions as `running || spawning`, which undercounts active `working` sessions.

2. CLI docs/spec are outdated vs implementation:
- `maestro-cli/docs/spec/07-CLI-COMMANDS-REFERENCE.md` describes older options/flows (`--task` on report commands, `running` status, etc.) not matching current command handlers.

3. API docs are outdated vs model:
- `maestro-server/docs/02-API-REFERENCE.md` and `API-COMPLETE.md` still document legacy status values and old task timeline concepts.

4. Validation module drift:
- `maestro-server/src/api/validation.ts` lacks `doc_added` in timeline enum while runtime types include it.
- Route files currently do not apply this validation middleware, so drift is latent but real.

5. Command visibility mismatch:
- `session needs-input` and `session resume-working` exist in CLI implementation but are not listed in user-facing `maestro commands` registry.

## 6) Short recommendations

1. Normalize status terminology to `working` everywhere (CLI docs, server docs, specs).
2. Fix `maestro status` active-session filter to include `working` (and optionally `idle`).
3. Regenerate CLI/API reference docs from command/route sources or add contract tests for doc/enum parity.
4. Either wire `api/validation.ts` into routes or remove stale schema definitions.
5. Add `session needs-input` and `session resume-working` to command registry (or remove hidden commands).

## Bottom line
- The runtime code supports many-to-many task/session relationships correctly with per-session task status tracking.
- Core CLI-to-API mutations are mostly aligned.
- Documentation and a few status/command-surface details are currently inconsistent with the live implementation.
