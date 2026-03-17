# Performance Audit: API Routes & Validation Layer

**Scope:** `validation.ts`, all route handlers (`taskRoutes`, `teamRoutes`, `teamMemberRoutes`, `projectRoutes`, `masterRoutes`, `skillRoutes`, `orderingRoutes`, `workflowTemplateRoutes`, `taskListRoutes`, `sessionRoutes`), `middleware/`, `DomainEvents.ts`

---

## Executive Summary

The API layer is reasonably well-structured with Zod validation middleware, proper error handling, and some pagination support. However, several performance issues exist around **N+1 query patterns**, **redundant validation**, **heavy payloads without pagination**, **synchronous/sequential operations in hot paths**, and **missing validation on critical endpoints**. The most impactful issues are in `sessionRoutes.ts` (the largest and most complex route file at ~1500 lines).

---

## 1. N+1 Query Patterns

### 1a. `GET /tasks/:id/docs` — Serial session doc hydration
**File:** `taskRoutes.ts:130-162`
**Severity:** HIGH
**Impact:** For tasks with N sessions, triggers N+1 reads (1 to list sessions, N to fetch+hydrate docs per session).

```typescript
const sessions = await sessionService.listSessionsByTask(taskId);
const allSessionDocs = await Promise.all(
  sessions.map(async (session) => {
    const sessionDocs = await sessionService.getSessionDocsWithContent(session.id);
    // ...
  })
);
```

While `Promise.all` parallelizes, each `getSessionDocsWithContent()` call internally reads files from disk. With many sessions, this creates a burst of filesystem reads. The `taskService.getTask(taskId)` call on line 135 is also redundant — it's only used to verify existence but the task data isn't used.

**Recommendation:** Add a `getDocsForTask(taskId)` method to the service layer that batch-loads docs. Consider caching hydrated doc content.

---

### 1b. `POST /sessions/spawn` — Sequential entity fetches
**File:** `sessionRoutes.ts:767-1308`
**Severity:** MEDIUM
**Impact:** The spawn endpoint makes 5-7 sequential async calls before responding.

Sequential call chain:
1. `sessionService.getSession(sessionId)` — parent validation (line 865)
2. `taskRepo.findById(taskId)` × N — task verification loop (line 928-935)
3. `teamMemberRepo.findByProjectId(projectId)` — batch fetch (line 989)
4. `projectRepo.findById(projectId)` — project lookup (line 1085)
5. `sessionService.createSession(...)` — session creation (line 1107)
6. `sessionService.getSession(resolvedParentSessionId!)` — coordinator check (line 1137)
7. `generateManifestViaCLI(...)` — CLI subprocess (line 1171)
8. `sessionService.updateSession(...)` — env update (line 1269)

Steps 1-4 could be parallelized. The parent session fetch (step 1) and project fetch (step 4) are independent. Task verification (step 2) is already parallelized via `Promise.all` — good.

**Recommendation:** Parallelize independent fetches:
```typescript
const [parentSession, verifiedTasks, projectTeamMembers, project] = await Promise.all([
  spawnSource === 'session' ? sessionService.getSession(sessionId) : null,
  Promise.all(taskIds.map(id => taskRepo.findById(id))),
  teamMemberRepo.findByProjectId(projectId),
  projectRepo.findById(projectId),
]);
```

---

### 1c. `GET /sessions` — Team member enrichment per-project
**File:** `sessionRoutes.ts:352-409`
**Severity:** LOW (already optimized)
**Note:** This endpoint correctly batches team member lookups per-project and passes the map to `enrichSessionWithSnapshots()`. Good pattern.

---

### 1d. `GET /sessions/:id` — Single session enrichment fallback
**File:** `sessionRoutes.ts:316-350, 450-458`
**Severity:** LOW
**Impact:** `enrichSessionWithSnapshots()` without a map falls back to `teamMemberRepo.findByProjectId()` per call (line 330). For single-session GET this is acceptable, but if called in a loop it would be N+1.

---

### 1e. `POST /sessions/:id/resume` — Sequential task re-fetch
**File:** `sessionRoutes.ts:1373`
**Severity:** LOW
**Impact:** `Promise.all(session.taskIds.map(taskId => taskRepo.findById(taskId)))` — parallel, but each task read is still a separate filesystem read. Non-blocking since resume is infrequent.

---

## 2. Redundant Validation

### 2a. Post-Zod manual re-validation in `POST /sessions/spawn`
**File:** `sessionRoutes.ts:827-849`
**Severity:** LOW
**Impact:** After `validateBody(spawnSessionSchema)` middleware already validates `projectId`, `taskIds`, and `spawnSource`, the handler re-validates all three:

```typescript
if (!projectId) { ... }                        // line 827 — already validated by Zod (safeId)
if (!taskIds || !Array.isArray(taskIds) || ...) // line 835 — already validated by z.array(safeId).min(1)
if (spawnSource !== 'ui' && ...) {              // line 843 — already validated by z.enum(['ui', 'session'])
```

The Zod schema `spawnSessionSchema` already enforces all these constraints. The redundant checks add ~zero cost but indicate validation confusion.

**Recommendation:** Remove redundant manual checks that duplicate Zod schema constraints.

---

### 2b. Manual validation instead of Zod in `teamRoutes.ts`
**File:** `teamRoutes.ts` — multiple endpoints
**Severity:** MEDIUM (consistency, not perf)
**Impact:** `POST /teams` (line 43) has **no body validation middleware** at all. `PATCH /teams/:id` (line 80) validates params but not body. Most team endpoints manually check `projectId` instead of using a Zod schema. The `POST /teams/:id/members` (line 176) manually validates `memberIds` array.

**Recommendation:** Create `createTeamSchema`, `updateTeamSchema`, `addTeamMembersSchema` etc. in validation.ts and use `validateBody()`.

---

### 2c. Manual validation in `teamMemberRoutes.ts`
**File:** `teamMemberRoutes.ts:57, 105, 129, 153, 177, 219`
**Severity:** LOW
**Impact:** Several endpoints (`GET /team-members/:id`, `DELETE /team-members/:id`, `POST .../archive`, `POST .../unarchive`, `POST .../reset`) lack `validateParams(idParamSchema)`. The `POST .../memory` endpoint manually validates `entries` array instead of using Zod.

---

### 2d. Missing validation on `POST /tasks/:id/images`
**File:** `taskRoutes.ts:212-266`
**Severity:** MEDIUM (security)
**Impact:** Image upload endpoint does manual validation but **no Zod validation middleware**. The `filename`, `data`, and `mimeType` fields are not length-constrained. A malicious request could send an arbitrarily large base64 `data` field, consuming memory before the handler even processes it.

**Recommendation:** Add Zod schema with size limits, especially for `data` (e.g., max 10MB base64 = ~14M chars).

---

### 2e. Missing validation on `POST /sessions/:id/docs`
**File:** `sessionRoutes.ts:532-564`
**Severity:** LOW
**Impact:** Manual `if (!title)` and `if (!filePath)` checks instead of Zod. Content field is unconstrained.

---

## 3. Missing Pagination

### 3a. Endpoints returning unbounded collections without pagination defaults

| Endpoint | File | Issue |
|----------|------|-------|
| `GET /tasks` | taskRoutes.ts:32 | Pagination optional — returns ALL tasks if no limit/offset |
| `GET /sessions` | sessionRoutes.ts:352 | Pagination optional — returns ALL sessions |
| `GET /master/tasks` | masterRoutes.ts:86 | Cross-project query, no default limit |
| `GET /master/sessions` | masterRoutes.ts:111 | Cross-project query, no default limit |
| `GET /master/context` | masterRoutes.ts:133 | Loads ALL tasks + ALL sessions into memory |
| `GET /tasks/:id/docs` | taskRoutes.ts:130 | Pagination optional |
| `GET /tasks/:id/children` | taskRoutes.ts:339 | Pagination optional |
| `GET /skills` | skillRoutes.ts:18 | Pagination optional |
| `GET /teams` | teamRoutes.ts:16 | Pagination optional |
| `GET /team-members` | teamMemberRoutes.ts:17 | Pagination optional |
| `GET /task-lists` | taskListRoutes.ts:26 | Pagination optional |

**Severity:** MEDIUM
**Impact:** In production with many entities, unpaginated responses can be very large. `GET /master/context` is the worst offender — it loads ALL tasks and ALL sessions across ALL projects into memory to compute counts.

**Recommendation:**
- Apply default pagination (limit=100) when no explicit limit is provided
- For `/master/context`, compute counts via a dedicated repository method instead of loading full entities

---

### 3b. `paginate()` loads all then slices
**File:** `validation.ts:426-438`
**Severity:** MEDIUM
**Impact:** The `paginate()` helper loads ALL items into memory first, then slices. This means a query for `?limit=10&offset=0` still loads all N items from the repository.

```typescript
export function paginate<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  const total = items.length;
  const sliced = items.slice(params.offset, params.offset + params.limit);
  // ...
}
```

**Recommendation:** Push pagination down to the repository layer so only the requested page is loaded from disk.

---

## 4. Heavy Response Payloads

### 4a. `GET /sessions` returns full session objects by default
**File:** `sessionRoutes.ts:396-399`
**Severity:** LOW (already mitigated)
**Note:** The endpoint uses `toSessionSummary()` by default and only returns full objects with `?fields=full`. Good pattern.

### 4b. `GET /skills` returns full skill content
**File:** `skillRoutes.ts:18-97`
**Severity:** LOW
**Impact:** Skill list includes all metadata fields. Content is only included with `?fields=full`. Acceptable.

### 4c. `POST /sessions/spawn` response includes full session + env vars
**File:** `sessionRoutes.ts:1293-1298`
**Severity:** LOW
**Impact:** Returns the full session object including env vars (which contain API keys like `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). While this is an internal API, the response leaks auth credentials.

**Recommendation:** Strip sensitive env vars from spawn response, or only return session ID + status.

---

## 5. Synchronous Operations in Request Handlers

### 5a. `POST /sessions/spawn` — CLI subprocess blocks response
**File:** `sessionRoutes.ts:1171-1212`
**Severity:** HIGH
**Impact:** `generateManifestViaCLI()` spawns a child process and blocks the request handler for up to 60 seconds (MANIFEST_TIMEOUT_MS). The HTTP response is held open while the CLI runs. If multiple spawn requests arrive concurrently, each ties up an Express connection.

**Recommendation:** Consider making manifest generation async — return the session ID immediately, then generate the manifest and emit the spawn event via a background job/queue. Update session status from `spawning` to `ready` when done.

### 5b. `POST /sessions/:id/modal` — Synchronous file write
**File:** `sessionRoutes.ts:629-632`
**Severity:** LOW
**Impact:** `mkdir()` and `writeFile()` are async (good), but creating directories on every modal open is wasteful. Use `mkdirSync` once at startup or cache the `modalsDir` existence check.

### 5c. `POST /tasks/:id/images` — Synchronous base64 decode + disk write
**File:** `taskRoutes.ts:243-246`
**Severity:** LOW
**Impact:** `Buffer.from(data, 'base64')` is synchronous and blocks the event loop for large images. Combined with unbounded `data` field size (no Zod validation), this is a potential DoS vector.

---

## 6. DomainEvents.ts Overhead

### 6a. Large union type and duplicated interface definitions
**File:** `DomainEvents.ts:1-381`
**Severity:** NEGLIGIBLE (compile-time only)
**Impact:** The `DomainEvent` union type has 35+ variants, and `TypedEventMap` duplicates the same structure. This is purely a TypeScript compile-time concern — no runtime overhead.

### 6b. Event emission on every CRUD operation
**Severity:** LOW
**Impact:** Every task/session/project create/update/delete emits domain events which propagate via the event bus to WebSocket subscribers. This is the intended architecture. The main concern is that `session:spawn` events include the full manifest object, which can be large.

**Recommendation:** Consider stripping large fields (manifest content, env vars) from events, or only including them when subscribers need them.

---

## 7. Middleware Observations

### 7a. `cacheControl` middleware — applied inconsistently
**File:** `middleware/cacheControl.ts`
**Severity:** LOW
**Impact:** Cache headers are applied to some read endpoints but not others:
- Applied: `GET /projects` (30s), `GET /projects/:id` (30s), `GET /skills` (300s), `GET /ordering` (5s), `GET /workflow-templates` (86400s)
- Missing: `GET /tasks`, `GET /sessions`, `GET /teams`, `GET /team-members`, `GET /task-lists`

For frequently-polled list endpoints, even a 1-2s cache-control could reduce redundant fetches from the UI.

### 7b. No request body size limit
**Severity:** MEDIUM
**Impact:** Express's default body parser has no explicit size limit set. The image upload endpoint (`POST /tasks/:id/images`) accepts base64-encoded images in JSON body with no size constraint. A large upload could exhaust server memory.

**Recommendation:** Set `express.json({ limit: '10mb' })` globally, or per-route for image uploads.

---

## 8. Pattern Summary & Prioritized Recommendations

| Priority | Issue | Impact | Fix Effort |
|----------|-------|--------|------------|
| **P0** | `paginate()` loads all items then slices | Memory/latency scales with total count | Medium — push to repo layer |
| **P0** | Spawn endpoint blocks on CLI subprocess (60s timeout) | Ties up Express connections | High — async job pattern |
| **P1** | No body size limit for image upload / JSON parser | DoS risk | Low — add `express.json({ limit })` |
| **P1** | Missing Zod validation on image upload endpoint | Security — unbounded fields | Low — add schema |
| **P1** | `/master/context` loads ALL tasks + sessions for counts | Memory spike on large workspaces | Medium — add count methods |
| **P1** | Spawn response leaks API keys in env vars | Security | Low — strip sensitive keys |
| **P2** | Redundant manual validation in spawn handler | Code clarity | Low — remove duplicates |
| **P2** | Missing Zod schemas for team routes body validation | Consistency | Low — add schemas |
| **P2** | No default pagination limit | Large responses possible | Low — default limit=100 |
| **P2** | Parallelizable fetches in spawn are sequential | ~100-300ms added latency | Low — Promise.all |
| **P3** | Inconsistent cache-control headers | Extra fetches from UI | Low — add to list endpoints |
| **P3** | Task docs N+1 hydration | Slow with many sessions | Medium — batch load |
| **P3** | Synchronous base64 decode for large images | Event loop blocking | Low — stream or chunk |
