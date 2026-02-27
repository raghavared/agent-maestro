# maestro-server Code Quality Report

**Generated:** 2026-02-27
**Reviewer:** Backend Engineer Agent
**Scope:** `maestro-server/src/` — all TypeScript source files
**Overall Score: 7.2 / 10**

---

## Executive Summary

The maestro-server codebase demonstrates strong architectural foundations: a well-structured DDD layout (domain / application / infrastructure), centralized configuration, Zod-based input validation, consistent error hierarchy, and proper use of dependency injection. The core services (TaskService, SessionService, ProjectService) are clean and well-factored.

The primary concerns for open-source launch are:
1. A 1,217-line `sessionRoutes.ts` that contains business logic that should live in application services
2. Inconsistent validation coverage across routes (some routes lack `validateBody`/`validateParams`)
3. The `notify:task_in_review` event emitted but not bridged to WebSocket clients
4. Several `as any` casts that could be replaced with proper typing
5. Direct `process.env` access in a route file that should use `config` instead

The codebase has no hardcoded secrets, no debug code, proper security headers, and good test coverage of the API layer.

---

## Critical Issues (Must Fix)

### C1 — `notify:task_in_review` event not bridged to WebSocket clients
**File:** `src/infrastructure/websocket/WebSocketBridge.ts:81-115` and `src/application/services/TaskService.ts:159`

`TaskService.emitTaskStatusNotifications()` emits `notify:task_in_review` when a task transitions to `in_review` status. However, `WebSocketBridge.setupEventHandlers()` only subscribes to `notify:task_completed`, `notify:task_failed`, and `notify:task_blocked` — **not** `notify:task_in_review`. Additionally, `notify:task_in_review` is absent from the `TypedEventMap` key list in `DomainEvents.ts` (the interface `NotifyTaskInReviewEvent` exists at line 113 but its key is never added to `TypedEventMap`).

**Impact:** Real-time UI updates are silently dropped when a task transitions to `in_review`. Open-source contributors will be confused by a missing event in the type system.

**Fix:** Add `'notify:task_in_review': { taskId: string; title: string }` to `TypedEventMap` and add `'notify:task_in_review'` to the events array in `WebSocketBridge.setupEventHandlers()`.

---

### C2 — `sessionRoutes.ts` is 1,217 lines with business logic in a route file
**File:** `src/api/sessionRoutes.ts`

The spawn session handler (`POST /sessions/spawn`, lines 717–1213) contains ~500 lines of business logic:
- Team member resolution and model power ranking
- Mode normalization
- MemberOverrides inheritance from parent sessions
- Manifest generation via CLI subprocess
- Session creation, coordinator self-linking, teamSessionId propagation

This logic belongs in a `SpawnSessionService` in the application layer, not in the route file. Routes should do: validate → delegate to service → return response.

Inner helper functions `enrichSessionWithSnapshots`, `resolveSessionMode`, `canCommunicateWithinTeamBoundary`, and `resolveSenderName` are also defined inside `createSessionRoutes()`, making them untestable in isolation.

**Impact:** This is the #1 contributor to maintenance complexity and is the first file a new contributor will look at when debugging session spawning. It looks unprofessional for an open-source project.

**Fix:** Extract spawn logic into `src/application/services/SpawnSessionService.ts`. Extract the 4 helper functions to module scope or a separate utility module.

---

### C3 — Direct `process.env` access in route file bypasses Config class
**File:** `src/api/sessionRoutes.ts:34-35, 77-78, 1163`

```typescript
// sessionRoutes.ts:34-35
if (process.env.MAESTRO_CLI_PATH) {
  return { maestroBin: process.env.MAESTRO_CLI_PATH, monorepoRoot: null };
}

// sessionRoutes.ts:77-78
const sessionDir = process.env.SESSION_DIR
  ? (process.env.SESSION_DIR.startsWith('~') ? ... : process.env.SESSION_DIR)
  : join(homedir(), '.maestro', 'sessions');
```

The `Config` class already centralizes `SESSION_DIR` → `config.sessionDir` and `MAESTRO_CLI_PATH` → `config.manifestGenerator.cliPath`. The route file re-implements environment variable access including its own tilde-expansion logic.

**Impact:** Configuration is split between `Config` and route-level code. Changes to session directory handling must be made in two places. `config.sessionDir` is also already passed into `generateManifestViaCLI` indirectly — the route should use `config` directly.

**Fix:** Pass `config` into `generateManifestViaCLI` or `createSessionRoutes`. Replace all direct `process.env` reads in session routes with `config.*` equivalents.

---

### C4 — `UpdateTaskPayload` missing `images` field causes `as any` casts
**File:** `src/api/taskRoutes.ts:271-273, 332`

```typescript
// taskRoutes.ts:271-273
await taskService.updateTask(taskId, {
  ...({} as any),
  images: [...currentImages, imageEntry],
} as any);

// taskRoutes.ts:332
await taskService.updateTask(taskId, { ...({} as any), images: updatedImages } as any);
```

`images?: TaskImage[]` is defined on the `Task` interface but is absent from `UpdateTaskPayload` in `types.ts`. This forces an `as any` cast that bypasses all type safety. The `FileSystemTaskRepository.update()` method also handles images via `(updates as any).images` at line 216.

**Impact:** Type errors hidden at compile time, silent failures if field name changes.

**Fix:** Add `images?: TaskImage[]` to `UpdateTaskPayload` in `src/types.ts` and update `FileSystemTaskRepository.update()` to use the typed field.

---

### C5 — `memberOverrides` not updated in `FileSystemTaskRepository.update()`
**File:** `src/infrastructure/repositories/FileSystemTaskRepository.ts:194-239`

The `update()` method handles almost all `UpdateTaskPayload` fields but **does not handle `memberOverrides`**. The `create()` method at line 136 sets `memberOverrides: input.memberOverrides` on creation, but `PATCH /tasks/:id` with `memberOverrides` in the body will silently ignore it.

**Impact:** Task-level member overrides cannot be updated after creation. This is a silent data loss bug.

**Fix:** Add `if (updates.memberOverrides !== undefined) task.memberOverrides = updates.memberOverrides;` to the `update()` method.

---

## Important Issues (Should Fix)

### I1 — Missing request body validation on `POST /team-members` and `PATCH /team-members/:id`
**File:** `src/api/teamMemberRoutes.ts:40-47, 77-80`

```typescript
// POST /team-members — no validateBody middleware
router.post('/team-members', async (req: Request, res: Response) => {
  const member = await teamMemberService.createTeamMember(req.body);
```

All other CRUD routes in the codebase use Zod `validateBody()` middleware. Team member creation and update routes do not validate the request body at all. Any shape of data can be passed and will reach the service layer.

**Fix:** Add Zod schemas for team member create/update to `validation.ts` and apply `validateBody()` middleware to these routes.

---

### I2 — Missing `validateParams(idParamSchema)` on several session sub-routes
**File:** `src/api/sessionRoutes.ts`

The following routes use `:id` path parameters but do not apply `validateParams(idParamSchema)`:
- `POST /sessions/:id/docs` (line 441)
- `GET /sessions/:id/docs` (line 476)
- `POST /sessions/:id/modal` (line 513)
- `POST /sessions/:id/modal/:modalId/actions` (line 567)
- `POST /sessions/:id/modal/:modalId/close` (line 599)
- `POST /sessions/:id/prompt` (line 617)
- `POST /sessions/:id/mail` (line 673)
- `GET /sessions/:id/mail` (line 703)
- `GET /sessions/:id/log-digest` (line 346)

The `safeId` pattern in `idParamSchema` prevents command injection characters in path parameters. Skipping it on these routes is a security gap.

**Fix:** Apply `validateParams(idParamSchema)` to all routes with `:id` parameters.

---

### I3 — `server.ts` startup error is swallowed silently
**File:** `src/server.ts:219-221`

```typescript
startServer().catch(err => {
  process.exit(1);
});
```

If the server fails to start (e.g., port already in use, config error, repository initialization failure), it exits with code 1 but prints no error message. A contributor or operator running the server will see nothing in the logs and won't know what went wrong.

**Fix:**
```typescript
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

---

### I4 — One-time migration code in production boot path
**File:** `src/container.ts:44-71`

`migrateTeamMemberTasks()` runs on every server start to clean up old `taskType === 'team-member'` entries. It uses `task as any` to access a field that no longer exists in the type system. While it's idempotent, it:
- Adds latency to every startup (scans all tasks)
- Uses `as any` to access a deprecated field
- Contains a comment saying "one-time migration" but runs on every boot

**Fix:** Either remove it (if the migration window has passed), or add a migration version file to track which migrations have run, or at minimum document in a `MIGRATIONS.md` why it remains.

---

### I5 — `Config.fromObject()` mutates private readonly state
**File:** `src/infrastructure/config/Config.ts:237-241`

```typescript
static fromObject(overrides: Partial<ConfigOptions>): Config {
  const config = new Config();
  Object.assign(config.config, overrides);  // Mutates private readonly state
  config.validate();
  return config;
}
```

`Config` implements `Readonly<ConfigOptions>` and its internal `config` property is `private readonly`. `Object.assign` bypasses TypeScript's readonly guarantee. This is a leaky abstraction — if used in tests with unsafe overrides, the `validate()` call may still pass but with inconsistent internal state.

**Fix:** Build a `ConfigOptions` object with overrides applied, then construct a new `Config` from it using a private constructor overload.

---

### I6 — `_suppressCreatedEvent` is a public API field
**File:** `src/types.ts:428`, `src/api/validation.ts:162`

```typescript
// types.ts
export interface CreateSessionPayload {
  _suppressCreatedEvent?: boolean;  // Internal: suppress session:created event
}

// validation.ts (createSessionSchema)
_suppressCreatedEvent: z.boolean().optional(),
```

An internal implementation detail is exposed in the public API schema. External callers of `POST /sessions` can pass `_suppressCreatedEvent: true` to suppress domain events. This is an implementation leak.

**Fix:** Remove `_suppressCreatedEvent` from `createSessionSchema`. Handle it only in internal code paths (`POST /sessions/spawn` can set it programmatically via `sessionService.createSession()` without going through the validation schema).

---

### I7 — `enrichSessionWithSnapshots` mutates session objects passed by reference
**File:** `src/api/sessionRoutes.ts:255-280`

```typescript
async function enrichSessionWithSnapshots(session: any): Promise<void> {
  // ...
  session.teamMemberIds = tmIds;
  session.teamMemberSnapshots = snapshots;
}
```

This function mutates the session object in place. Since repositories return objects from an in-memory Map (e.g., `FileSystemSessionRepository`), mutating the returned object directly modifies the stored data without calling `save()`. This could lead to phantom data in memory that isn't persisted to disk if a server restart occurs.

**Fix:** Return a new enriched object rather than mutating in place, or ensure sessions returned from the repository are cloned before enrichment.

---

### I8 — `Session` type missing in `api/index.ts` barrel
**File:** `src/api/index.ts`

The barrel file only exports `projectRoutes`, `taskRoutes`, and `sessionRoutes`. Missing: `skillRoutes`, `orderingRoutes`, `teamMemberRoutes`, `teamRoutes`, `taskListRoutes`, `masterRoutes`, `workflowTemplateRoutes`. The barrel is inconsistent and would mislead contributors about what's available.

**Fix:** Either export all routes or remove the barrel file and use direct imports everywhere (as `server.ts` already does).

---

### I9 — `SessionService.removeTaskFromSession` uses `task_completed` timeline event type
**File:** `src/application/services/SessionService.ts:265-269`

```typescript
const event: SessionTimelineEvent = {
  type: 'task_completed',  // Or could be task_skipped depending on context
  message: `Removed task from session`,
};
```

Removing a task from a session is not the same as completing it. This creates misleading timeline data. The comment acknowledges the ambiguity but leaves it unresolved.

**Fix:** Add a `task_removed` event type to `SessionTimelineEventType`, or use `task_skipped` which is semantically closer.

---

## Minor Issues (Nice to Fix)

### M1 — `any` types in LogDigestService are appropriate but undocumented
**File:** `src/application/services/LogDigestService.ts`

The `any` types throughout `LogDigestService` are justified because the service parses third-party JSONL formats (Claude and Codex) with no fixed schema. However, this should be documented with a comment explaining why `any` is appropriate here (external, untyped log formats).

---

### M2 — Redundant blank lines in route files
**File:** `src/api/masterRoutes.ts:67`, `src/api/teamMemberRoutes.ts:11`

Minor style inconsistency — extra blank lines inside router factory functions. Not a functional issue but visible to open-source contributors reviewing code.

---

### M3 — `WebSocketBridge.broadcast()` serializes before checking for clients
**File:** `src/infrastructure/websocket/WebSocketBridge.ts:151-157`

```typescript
private broadcast(event: string, data: any): void {
  const message = JSON.stringify({ ... });  // Always serialized
  // ...
  this.wss.clients.forEach((client) => {   // Clients may be empty
```

JSON serialization happens unconditionally even when there are zero connected clients. For high-frequency events (e.g., `task:updated`, `session:updated`), this is wasted CPU.

**Fix:** Check `this.wss.clients.size === 0` before serializing.

---

### M4 — Missing `.env.example` file
**File:** `maestro-server/` root

There is no `.env.example` file documenting the available environment variables (`PORT`, `DATA_DIR`, `SESSION_DIR`, `LOG_LEVEL`, etc.). Open-source contributors discovering the project won't know how to configure it without reading `Config.ts`.

**Fix:** Add a `.env.example` with all documented env vars and their defaults.

---

### M5 — `getClientStatus` can produce undefined `readyStateText`
**File:** `src/infrastructure/websocket/WebSocketBridge.ts:192`

```typescript
readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][client.readyState]
```

If `client.readyState` is outside 0–3 (possible in edge cases), this returns `undefined`. The return type `{ readyState: number; readyStateText: string }` would be violated.

**Fix:** Add a fallback: `['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][client.readyState] ?? 'UNKNOWN'`.

---

### M6 — `taskRoutes.ts:POST /tasks/:id/docs` uses inline validation instead of `validateBody`
**File:** `src/api/taskRoutes.ts:153-192`

Three manual `if (!field)` checks instead of a Zod schema. Inconsistent with the rest of the codebase which uses `validateBody(schema)`.

**Fix:** Create a `addTaskDocSchema` in `validation.ts` and apply `validateBody(addTaskDocSchema)`.

---

### M7 — `server.ts` logger not available in startup catch
**File:** `src/server.ts:162-171`

The server URL write failure on startup is silently ignored (`// Ignore write failures`). The `logger` is available in scope and could log a warning.

---

## Architecture Assessment

### Strengths
- **DDD layer separation is clean.** Domain → Application → Infrastructure dependency flow is properly enforced. Services depend on interfaces, not concrete implementations.
- **Dependency injection via `container.ts`** is clear and explicit. No magic IoC container — easy to understand and trace.
- **Config class** is well-designed: loads from env, validates on construction, provides typed accessors. The `isProduction`/`isDevelopment` helpers are useful.
- **Zod validation** is consistently applied to most routes with sensible schemas, including injection-safe `safeId` patterns.
- **Error hierarchy** (`AppError` → `ValidationError`, `NotFoundError`, etc.) is clean and maps correctly to HTTP status codes.
- **WebSocket bridge** cleanly separates domain events from transport layer. The subscription filter feature is a nice addition.
- **FileSystem repositories** follow a consistent initialize/in-memory-cache/persist pattern. Migration code (while needing cleanup) shows attention to backward compatibility.
- **Security posture** is solid: `helmet`, CORS configuration, rate limiting (separate general/write limiters), `safeId` regex on all path params.
- **No hardcoded secrets or credentials** found anywhere in the codebase.
- **No debug code** (`console.log`, `debugger`, etc.) present.

### Weaknesses
- **`sessionRoutes.ts` concentration of complexity.** The spawn endpoint is the most complex operation in the system and needs its own service class.
- **In-memory store mutation risk.** All repositories use Map objects that are mutated directly. `enrichSessionWithSnapshots` (and potentially the `update()` methods) mutate cached objects. This is a latent consistency bug — particularly relevant if/when concurrent writes increase.
- **Missing Postgres implementation.** `Config` supports `database.type: 'postgres'` and `DatabaseConfig` has a full Postgres options interface, but there are no Postgres repository implementations. Contributors will be confused by incomplete features.
- **No rate limiting per-session or per-IP for WebSocket** — a single malicious client could subscribe to all events.

---

## File-by-File Issue Summary

| File | Issues |
|------|--------|
| `src/server.ts` | M7 (silent startup error), M7 (logger not used in catch) |
| `src/container.ts` | I4 (migration code), `as any` on line 54 |
| `src/types.ts` | C4 (missing `images` in UpdateTaskPayload), I6 (`_suppressCreatedEvent` public) |
| `src/api/sessionRoutes.ts` | C2 (fat route), C3 (process.env), I2 (missing validateParams), I6 (_suppressCreatedEvent), I7 (mutation), `as any` on lines 1056-1060 |
| `src/api/taskRoutes.ts` | C4 (`as any` for images), M6 (inline validation) |
| `src/api/teamMemberRoutes.ts` | I1 (missing validateBody), M2 (blank lines) |
| `src/api/masterRoutes.ts` | M2 (blank lines) |
| `src/api/validation.ts` | I6 (`_suppressCreatedEvent` in schema) |
| `src/api/index.ts` | I8 (incomplete barrel) |
| `src/application/services/TaskService.ts` | C1 (task_in_review not bridged) |
| `src/application/services/SessionService.ts` | I9 (wrong timeline event type) |
| `src/application/services/LogDigestService.ts` | M1 (undocumented `any`) |
| `src/infrastructure/config/Config.ts` | I5 (fromObject mutates private state) |
| `src/infrastructure/repositories/FileSystemTaskRepository.ts` | C5 (memberOverrides not updated) |
| `src/infrastructure/websocket/WebSocketBridge.ts` | C1 (missing notify:task_in_review), M3 (serialize before client check), M5 (readyStateText undefined) |
| `src/domain/events/DomainEvents.ts` | C1 (notify:task_in_review not in TypedEventMap) |

---

## Prioritized Fix List

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 Critical | C1: Add notify:task_in_review to WebSocket bridge and TypedEventMap | 15 min |
| 🔴 Critical | C4: Add `images` to UpdateTaskPayload | 10 min |
| 🔴 Critical | C5: Add `memberOverrides` to FileSystemTaskRepository.update() | 5 min |
| 🔴 Critical | I3: Log startup errors before exit | 5 min |
| 🟠 Important | I1: Add validateBody to team member routes | 30 min |
| 🟠 Important | I2: Add validateParams to session sub-routes | 20 min |
| 🟠 Important | I6: Remove `_suppressCreatedEvent` from public schema | 20 min |
| 🟠 Important | I7: Clone sessions before enrichment mutation | 30 min |
| 🟠 Important | C3: Use config.* instead of process.env in sessionRoutes | 30 min |
| 🟡 Minor | M4: Add .env.example | 20 min |
| 🟡 Minor | M5: Fix readyStateText fallback | 5 min |
| 🟡 Minor | M3: Skip serialization when no clients | 5 min |
| 🟡 Minor | M6: Use validateBody for task docs endpoint | 20 min |
| 🔵 Long-term | C2: Extract SpawnSessionService | 2-3 hours |
| 🔵 Long-term | I4: Add migration versioning | 1 hour |
| 🔵 Long-term | I5: Fix Config.fromObject | 30 min |

---

*Report generated by Backend Engineer agent — maestro-server review, 2026-02-27*
