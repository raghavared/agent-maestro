# Performance Audit: API Route Handlers & Middleware

**Scope**: All files in `maestro-server/src/api/`
**Files Analyzed**: sessionRoutes.ts, taskRoutes.ts, projectRoutes.ts, teamRoutes.ts, teamMemberRoutes.ts, taskListRoutes.ts, masterRoutes.ts, orderingRoutes.ts, skillRoutes.ts, workflowTemplateRoutes.ts, validation.ts, middleware/errorHandler.ts, index.ts

---

## Critical Findings

### 1. N+1 Query Pattern in `GET /tasks/:id/docs` (taskRoutes.ts:123-150) — CRITICAL

```typescript
const sessions = await sessionService.listSessionsByTask(taskId);
for (const session of sessions) {
  const sessionDocs = await sessionService.getSessionDocsWithContent(session.id);
  // ...
}
```

**Problem**: Sequential `await` inside a `for` loop. For each session associated with a task, a separate I/O call fetches docs. If a task has 10 sessions, that's 10 sequential disk reads.

**Impact**: Latency grows linearly with the number of sessions per task.

**Fix**: Use `Promise.all()` to parallelize doc fetching across sessions.

---

### 2. N+1 Query Pattern in `enrichSessionWithSnapshots` (sessionRoutes.ts:274-299) — CRITICAL

```typescript
for (const tmId of tmIds) {
  try {
    const tm = await teamMemberRepo.findById(session.projectId, tmId);
    // ...
  } catch { /* skip */ }
}
```

**Problem**: Sequential `await` inside a loop fetching team members one-by-one. The `findById` for custom members hits disk on every call (no caching in TeamMemberRepository).

**Compounded by**: `GET /sessions` (line 331) calls `enrichSessionWithSnapshots` for **every session** in the list:
```typescript
const enrichedSessions = await Promise.all(sessions.map(s => enrichSessionWithSnapshots(s)));
```

While the outer map uses `Promise.all`, each inner `enrichSessionWithSnapshots` still does sequential repo reads. For 20 sessions × 3 team members = 60 sequential disk reads.

**Fix**: Batch-fetch team members once per project, then look up from a local map.

---

### 3. N+1 + Duplicate Reads in `POST /sessions/spawn` (sessionRoutes.ts:692-1226) — CRITICAL

This 534-line handler has multiple sequential await chains that re-fetch the same data:

**a) Task verification loop (line 852):**
```typescript
for (const taskId of taskIds) {
  const task = await taskRepo.findById(taskId);
  // ...
}
```

**b) Reference task collection (line 1073) — re-fetches the same tasks:**
```typescript
for (const taskId of taskIds) {
  const task = await taskRepo.findById(taskId);
  // ...
}
```

**Problem**: Tasks are fetched TWICE — once for verification, once for reference ID collection. The second loop at line 1073 re-reads every task already verified at line 852.

**c) Team member loop (line 933):**
```typescript
for (const tmId of effectiveTeamMemberIds) {
  const teamMember = await teamMemberRepo.findById(projectId, tmId);
  // ...
}
```

After already calling `teamMemberRepo.findByProjectId(projectId)` at line 908 (which returns ALL members), individual `findById` calls are redundant.

**Fix**:
- Use the `verifiedTasks` array (already stored) at line 1073 instead of re-fetching.
- Use the already-fetched `projectTeamMembers` array instead of individual `findById` calls.

---

### 4. N+1 in `POST /sessions/:id/resume` (sessionRoutes.ts:1230-1428) — HIGH

```typescript
for (const taskId of session.taskIds) {
  const task = await taskRepo.findById(taskId);
  // ...
}
```

Same sequential task fetching pattern for reference task collection.

---

### 5. Sequential Event Emissions in Spawn (sessionRoutes.ts:1207-1209) — MEDIUM

```typescript
for (const taskId of taskIds) {
  await eventBus.emit('task:session_added', { taskId, sessionId: session.id });
}
```

**Problem**: Sequential await for each event emission. If event bus has any I/O (e.g., WebSocket broadcast), this serializes unnecessarily.

**Fix**: Use `Promise.all()` for independent event emissions.

---

### 6. Duplicate Session Updates in Resume (sessionRoutes.ts:1381-1397) — MEDIUM

```typescript
await sessionService.updateSession(session.id, {
  status: 'spawning',
  env: finalEnvVars,
});

// Immediately followed by another update:
await sessionService.updateSession(session.id, {
  timeline: [...]
});
```

**Problem**: Two sequential writes to the same session that could be combined into one.

**Fix**: Merge into a single `updateSession` call.

---

## Missing Response Caching

### 7. No Cache Headers on Any Response — MEDIUM

**All routes** return JSON with no caching headers. Several endpoints serve data that changes infrequently:

| Endpoint | Staleness Tolerance | Suggested Cache |
|---|---|---|
| `GET /projects` | High | `Cache-Control: max-age=30` |
| `GET /projects/:id` | High | `Cache-Control: max-age=30` |
| `GET /skills` | Very High | `Cache-Control: max-age=300` |
| `GET /skills/:id` | Very High | `Cache-Control: max-age=300` |
| `GET /skills/mode/:mode` | Very High | `Cache-Control: max-age=300` |
| `GET /workflow-templates` | Immutable | `Cache-Control: max-age=86400, immutable` |
| `GET /workflow-templates/:id` | Immutable | `Cache-Control: max-age=86400, immutable` |
| `GET /ordering/:entityType/:projectId` | Medium | `Cache-Control: max-age=5` + ETag |
| `GET /tasks/:id/images/:imageId` | Immutable | Already has `Cache-Control: public, max-age=31536000` ✓ |

**Note**: The image serving endpoint (taskRoutes.ts:274) already correctly sets cache headers — this is the only endpoint that does.

---

### 8. No ETags/Conditional Requests — LOW-MEDIUM

No endpoints support `If-None-Match` / `ETag` or `If-Modified-Since` / `Last-Modified`. For frequently polled endpoints like `GET /sessions` and `GET /tasks`, ETags based on `updatedAt` timestamps would allow 304 responses and reduce payload transfer.

---

## Missing Pagination

### 9. Unbounded List Endpoints — HIGH

**Every list endpoint returns ALL matching results with no pagination:**

| Endpoint | File | Line |
|---|---|---|
| `GET /tasks` | taskRoutes.ts | 29 |
| `GET /sessions` | sessionRoutes.ts | 301 |
| `GET /projects` | projectRoutes.ts | 20 |
| `GET /teams` | teamRoutes.ts | 16 |
| `GET /team-members` | teamMemberRoutes.ts | 17 |
| `GET /task-lists` | taskListRoutes.ts | 23 |
| `GET /tasks/:id/docs` | taskRoutes.ts | 123 |
| `GET /tasks/:id/children` | taskRoutes.ts | 327 |
| `GET /master/projects` | masterRoutes.ts | 71 |
| `GET /master/tasks` | masterRoutes.ts | 81 |
| `GET /master/sessions` | masterRoutes.ts | 102 |
| `GET /skills` | skillRoutes.ts | 16 |

**Impact**: As data grows, response payloads grow unboundedly. The master routes are especially concerning — they're designed for cross-project queries and could return thousands of items.

**Fix**: Add `limit` and `offset` (or cursor-based) pagination to query schemas and filter logic.

---

## Oversized Response Payloads

### 10. Full Session Objects Returned on List (sessionRoutes.ts:301-337) — HIGH

`GET /sessions` returns full session objects including:
- `env` (contains API keys, paths — security concern too)
- `events[]` (can be large)
- `timeline[]` (grows over session lifetime)
- `metadata` (complex nested object)

For a list view, only summary fields (id, name, status, projectId, taskIds, timestamps) are needed.

**Fix**: Add a `fields` query parameter or return summary DTOs for list endpoints.

---

### 11. Full Task Objects in `GET /master/context` (masterRoutes.ts:120-158) — MEDIUM

```typescript
const [allTasks, allSessions] = await Promise.all([
  taskService.listTasks({}),
  sessionService.listSessions(),
]);
```

Fetches ALL tasks and ALL sessions just to compute counts. The full objects are loaded into memory only to be iterated for counting.

**Fix**: Add `count()` methods to repositories, or at minimum use a lightweight index query.

---

### 12. Skill Content in List Response (skillRoutes.ts:40) — MEDIUM

`GET /skills` returns `content: skill.instructions` — the full instruction text for every skill. This can be very large (multi-KB per skill).

**Fix**: Omit `content` from list response; only include it in `GET /skills/:id`.

---

## No Request Deduplication

### 13. No Deduplication on Spawn/Resume — MEDIUM

`POST /sessions/spawn` and `POST /sessions/:id/resume` have no idempotency protection. If a client retries (network timeout, UI double-click), duplicate sessions can be created or duplicate resume events emitted.

**Fix**: Accept a client-provided idempotency key, or use `sessionId` as a dedup key for spawn requests from sessions.

---

## Validation Issues

### 14. Inconsistent Validation Coverage — LOW-MEDIUM

Some endpoints use Zod validation middleware, others do manual checks:

**Using Zod validation (good):**
- `POST /sessions` ✓
- `POST /tasks` ✓
- `PATCH /tasks/:id` ✓
- `POST /sessions/spawn` ✓

**Manual/No validation:**
- `POST /tasks/:id/images` — manual validation, no Zod schema
- `POST /sessions/:id/docs` — manual validation for title/filePath
- `POST /sessions/:id/modal` — manual validation for modalId/html
- `POST /sessions/:id/prompt` — manual validation for content/mode/senderSessionId
- `POST /sessions/:id/resume` — no body validation at all
- All `teamRoutes.ts` POST/PATCH/DELETE endpoints — manual `projectId` validation (not using Zod middleware)

**Impact**: Inconsistent error formats. Manual validation is more error-prone and doesn't benefit from Zod's type coercion/stripping.

---

### 15. Zod Schema Compilation Not Cached (validation.ts) — LOW

Zod schemas are defined at module level (good — parsed once), but the middleware factories create new closures on each `validateBody(schema)` call. This is fine since Express registers middleware once per route, but if schemas were created dynamically per-request it would be wasteful.

**Current status**: Acceptable. Schemas are module-level constants.

---

## Missing Compression

### 16. No Response Compression Middleware — MEDIUM

No `compression()` middleware is applied in the Express app setup (verified in `index.ts` which only re-exports routes). JSON responses for large lists (tasks, sessions, skills) could be significantly smaller with gzip/brotli.

**Fix**: Add `compression` middleware at the app level.

---

## Middleware Chain Efficiency

### 17. Error Handler Duplication (middleware/errorHandler.ts) — LOW

Two nearly identical error handlers exist:
- `errorHandler()` — Express error middleware (4-arg signature)
- `handleRouteError()` — Manual helper used in try/catch blocks

Every route handler manually wraps logic in try/catch and calls `handleRouteError()`. The Express error middleware (`errorHandler`) is registered but never actually reached because errors are caught in route handlers.

**Impact**: Code duplication. Not a performance issue per se, but using `next(err)` instead of manual try/catch would simplify routes and consolidate error handling.

---

### 18. Double Validation in Some Routes — LOW

Some routes validate both via Zod middleware AND manual checks:
- `POST /sessions/spawn`: Zod validates `spawnSessionSchema`, but handler re-validates `projectId`, `taskIds`, `spawnSource` manually (lines 753-775)
- `POST /sessions/:id/timeline`: Zod validates `sessionTimelineSchema` (which requires `message`), but handler re-checks `if (!message)` (line 438)

**Fix**: Trust Zod validation; remove redundant manual checks.

---

## Slow Middleware Patterns

### 19. Master Auth Middleware Does DB Lookup on Every Request (masterRoutes.ts:14-54) — MEDIUM

```typescript
function createMasterAuthMiddleware(sessionService: SessionService) {
  return async (req, res, next) => {
    const session = await sessionService.getSession(sessionId);
    if (!session.isMasterSession) { ... }
  };
}
```

**Problem**: Every request to `/master/*` does a full session lookup to verify master status. No caching of auth decisions.

**Fix**: Cache master session IDs in a `Set<string>` with TTL, or use a lightweight check.

---

### 20. `POST /sessions/:id/prompt` Does Two Sequential Session Lookups (sessionRoutes.ts:636-689) — MEDIUM

```typescript
const session = await sessionService.getSession(sessionId);         // target
const senderSession = await sessionService.getSession(senderSessionId); // sender
```

Two sequential session fetches. These could be parallelized:
```typescript
const [session, senderSession] = await Promise.all([
  sessionService.getSession(sessionId),
  sessionService.getSession(senderSessionId),
]);
```

---

### 21. `PATCH /tasks/:id` Conditionally Fetches Session (taskRoutes.ts:74-93) — LOW

```typescript
if (sessionService && req.body?.updateSource === 'session' && req.body?.sessionId) {
  const session = await sessionService.getSession(sessionId);
  if (!session.taskIds.includes(id)) {
    await sessionService.addTaskToSession(sessionId, id);
  }
}
const task = await taskService.updateTask(id, req.body);
```

The session fetch and task update are sequential but independent — could be parallelized when `addTaskToSession` is not needed.

---

## Spawn Route Complexity

### 22. `POST /sessions/spawn` Is a 534-Line God Handler — ARCHITECTURAL

This single route handler (sessionRoutes.ts:693-1226) performs:
1. Complex mode resolution logic
2. Team member ID resolution (4 different fallback strategies)
3. Task verification loop
4. Team member fetching + snapshot building
5. Mode normalization
6. Permission mode inheritance
7. CLI subprocess spawn for manifest generation
8. Session creation
9. Coordinator session update
10. Reference task collection (duplicate fetch)
11. Env var assembly
12. Session update
13. Event emission

**Impact**: Hard to test, hard to optimize, hard to maintain. Any performance fix requires understanding the entire flow.

**Fix**: Decompose into service-layer methods. The route handler should be a thin orchestrator.

---

## Summary by Severity

| Severity | Count | Key Issues |
|---|---|---|
| **CRITICAL** | 4 | N+1 in task docs, session enrichment, spawn duplicate reads, spawn sequential team member fetches |
| **HIGH** | 2 | No pagination on any list endpoint, oversized session payloads |
| **MEDIUM** | 8 | No cache headers, no compression, no request deduplication, master auth uncached, sequential session lookups, full object loads for counts, skill content in list, duplicate session updates |
| **LOW** | 4 | Double validation, inconsistent validation coverage, error handler duplication, conditional sequential fetches |
| **ARCHITECTURAL** | 1 | Spawn route is a 534-line monolith |

**Top 5 Quick Wins (effort vs impact):**
1. Reuse `verifiedTasks` array instead of re-fetching tasks in spawn (zero cost fix)
2. Parallelize session lookups in `POST /sessions/:id/prompt` with `Promise.all`
3. Add `Cache-Control` headers to workflow-templates and skills endpoints
4. Merge duplicate `updateSession` calls in resume handler
5. Parallelize `enrichSessionWithSnapshots` inner loop with `Promise.all`
