# Sessions in Maestro: Status, Resume, and Task Relations

A reference for how Maestro models sessions, the badges shown on task tiles, the
sessions/history panel, the resume feature, and the relationship between a
**Maestro session** (server record) and the underlying **Claude session** (the
Claude Code CLI conversation).

---

## 1. Two kinds of "status"

There are two distinct status concepts. Don't confuse them.

### a) `SessionStatus` — the session's own lifecycle
`maestro-server/src/types.ts:403`
```
'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped'
```
- Set when the session spawns (`spawning`), runs (`working`/`idle`), and ends
  (`completed`/`failed`/`stopped`).
- "Active" = `idle` + `working` (`SessionService.getRunningSessionCount`,
  `SessionService.ts:333`).
- Guard: a `completed` session is never overwritten with `stopped`
  (`SessionService.ts:128`).

### b) `TaskSessionStatus` — per-(task, session) badge
`maestro-server/src/types.ts:401`
```
'working' | 'blocked' | 'completed' | 'failed' | 'skipped'
```
- A task can be worked by many sessions. Each session's progress on that task is
  tracked separately in `Task.taskSessionStatuses: Record<sessionId, status>`
  (`types.ts:311`).
- These are the badges you see on a task tile ("working", "completed", etc.).

**Propagation:** when a session reaches a terminal `SessionStatus`
(`stopped`/`completed`/`failed`), the server maps it onto the task's per-session
status — `completed` → `completed`, everything else → `failed` — but only if that
task-session entry is still active (`SessionService.ts:138-160`). It then emits
`task:updated`.

---

## 2. Task ↔ Session relation (many-to-many)

- `Task.sessionIds: string[]` ←→ `Session.taskIds: string[]` (`types.ts:320`, `363`).
- Wiring is kept on both sides: `createSession` calls `taskRepo.addSession` for
  each task and seeds a `task_started` timeline event per task
  (`SessionService.ts:57-69`). `addTaskToSession` / `removeTaskFromSession` keep
  both ends in sync and emit `session:task_added` / `task:session_added`
  (`SessionService.ts:251-308`).
- Per-session progress lives in `Task.taskSessionStatuses` keyed by session id
  (see §1b).

### Task-tile badges (UI)
- Labels: `maestro-ui/src/components/maestro/TaskStatusControl.tsx:33` —
  `{ queued:"Queued", working:"Working", blocked:"Blocked", completed:"Completed",
  failed:"Failed", skipped:"Skipped" }`.
- Symbols/colors: `maestro-ui/src/components/maestro/boardConstants.ts:17` —
  `working` ◉ `#00d9ff`, `completed` ✓ theme-primary, `blocked`/`failed` ✗
  `#ef4444`, `skipped` ⊘, `queued` ○.
- Driven by `MaestroTask.taskSessionStatuses` (UI type `maestro.ts:346`),
  normalized to always be an object in `useMaestroStore.ts`.

> Note: the UI also recognizes a `queued` value; the server's union is the five
> values above. Treat `queued` as a UI-only/pre-start label.

---

## 3. Maestro session vs Claude session

| | Maestro session | Claude session |
|---|---|---|
| What | Server entity / JSON record | A Claude Code CLI conversation (transcript + REPL state) |
| Id | `Session.id` (`sess_...`) | `Session.claudeSessionId` (a UUID) |
| Created | `POST /api/sessions/spawn` | by the `claude` process at launch |
| Tracks | tasks, timeline, docs, team, status | the actual agent conversation |

**The bridge is `claudeSessionId`** — one UUID that ties the two together:

1. On spawn the server pre-generates it: `claudeSessionId = randomUUID()`
   (`sessionRoutes.ts:1393`) and passes it to the agent as env var
   `MAESTRO_CLAUDE_SESSION_ID` (`sessionRoutes.ts:1565`).
2. The CLI launches Claude with that exact id so the new conversation *adopts* it:
   `args.push('--session-id', claudeSessionId)`
   (`maestro-cli/src/services/claude-spawner.ts:160-163`).
3. Because Maestro chose the id up front, it can later ask Claude to **resume**
   that same conversation by id (see §4).

Env handoff at spawn also includes `MAESTRO_SESSION_ID` (the Maestro id),
`MAESTRO_SERVER_URL`, `MAESTRO_MODE`, manifest path, auth keys, etc.

---

## 4. Resume feature

**Goal:** restart a finished/stopped session and continue the *same* Claude
conversation instead of starting fresh.

**Endpoint:** `POST /api/sessions/:id/resume` (`sessionRoutes.ts:1692`).

Flow:
1. Session must be resumable: status ∈ `completed | stopped | failed | idle`
   (`sessionRoutes.ts:1707`). Otherwise `400 session_not_resumable`.
2. Only `claude-code` agent tool can resume; others → `400 agent_tool_not_resumable`
   (`sessionRoutes.ts:1726`).
3. If the session predates the feature and has no `claudeSessionId`, one is
   generated now — that session will do a *fresh* spawn rather than a true resume
   (`sessionRoutes.ts:1716-1723`).
4. Manifest is regenerated so `MAESTRO_MANIFEST_PATH` is valid (best-effort;
   non-fatal if it fails) (`sessionRoutes.ts:1768-1795`).
5. Command chosen by whether it *had* a claude session id
   (`sessionRoutes.ts:1816-1820`):
   - had one → `maestro worker resume` (or `orchestrator resume` for coordinators)
   - none → `maestro worker init` (fresh)
6. Env rebuilt from stored `session.env` with refreshed dynamic values
   (`MAESTRO_CLAUDE_SESSION_ID`, server url, mode, worktree vars…)
   (`sessionRoutes.ts:1822-1850`).
7. Status set back to `spawning`, a `session_resumed`-style timeline event added,
   and a `session:resume` event emitted (reuses the spawn event shape). UI then
   spawns the terminal.

**CLI side of a true resume** (`maestro worker resume`):
`maestro-cli/src/commands/worker-resume.ts` — reads `MAESTRO_SESSION_ID` +
`MAESTRO_CLAUDE_SESSION_ID`, PATCHes session status to `working`, then launches
`claude --resume <claudeSessionId>` (line 37) with the mode's plugin dir. The
`--resume` flag is what makes Claude reopen the prior conversation. Contrast with
initial spawn which uses `--session-id` to *create* a conversation with that id.

**UI trigger:** "Resume" button appears for sessions in
`completed|stopped|failed|idle` whose agent tool is `claude-code`
(`SessionsSection.tsx:453`); calls `MaestroClient.resumeSession` →
`POST /sessions/:id/resume` (`MaestroClient.ts:382`).

---

## 5. Sessions panel & history (right panel)

- Main component: `maestro-ui/src/components/SessionsSection.tsx`.
- **History = resumable past sessions.** `historySessions` filters the project's
  sessions to status ∈ `completed | stopped | failed | idle`, sorted by
  `lastActivity` desc (`SessionsSection.tsx:602`). Shown in a virtualized dropdown
  with a count badge; each row shows avatar/name, status, time-ago, and tasks.
- **Active sessions** are grouped by team (coordinator + workers), see §6.
- `SessionTimeline.tsx` renders a session's `timeline[]` events
  (`task_started`, `progress`, `needs_input`, `doc_added`, `error`, etc.; types at
  `types.ts:406`).

---

## 6. Session linking (coordinator + workers)

Linking fields on `Session` (`types.ts:392-396`):
- `parentSessionId` — who spawned this session.
- `rootSessionId` — top-most session in a nested spawn chain.
- `teamSessionId` — shared id linking a coordinator + its workers; equals the
  coordinator's own session id (set on the coordinator's first spawn,
  `sessionRoutes.ts:1453`).
- `teamId` — optional saved Team reference.

UI grouping (`maestro-ui/src/utils/teamGrouping.ts`):
- Primary: group by `teamSessionId` (coordinator = the session whose id equals the
  `teamSessionId`; the rest are workers).
- Fallback: if `teamSessionId` is missing, group `coordinator`-mode sessions and
  attach workers via `parentSessionId` / `spawnedBy`.
- Rendered by `TeamSessionGroup.tsx` (collapsible team header, member chips, group
  status, task-progress bar). Each group gets a cycling team color.

---

## 7. Relevant APIs (quick index)

Server (`maestro-server/src/api/sessionRoutes.ts`):
- `POST   /api/sessions` — create record (`:510`)
- `GET    /api/sessions` — list; `?active=` filters to `spawning|idle|working` (`:570`, `:600`)
- `GET    /api/sessions/:id` (`:672`)
- `PATCH  /api/sessions/:id` — status/tasks/timeline/needsInput (`:684`)
- `DELETE /api/sessions/:id` (`:695`)
- `POST   /api/sessions/:id/timeline` (`:727`), `/docs` (`:754`), `/tasks/:taskId` (`:800`)
- `POST   /api/sessions/:id/prompt` — send a prompt to a running session (`:930`)
- `POST   /api/sessions/spawn` — create + spawn agent (`:989`)
- `POST   /api/sessions/:id/resume` — resume (`:1692`)

Events emitted: `session:created`, `session:updated`,
`session:status_changed` (lightweight, status/lastActivity/needsInput only),
`session:spawn`, `session:resume`, `session:deleted`, plus `task:session_added`
/ `task:session_removed` and `notify:*` notifications.
</content>
</invoke>
