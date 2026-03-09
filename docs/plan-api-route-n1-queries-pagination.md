# Plan: Fix API Route N+1 Queries & Pagination

**Task**: Fix Plan Group 5 — API Route N+1 Queries & Pagination
**Reference**: `docs/perf-audit-api-routes-middleware.md`
**Status**: Plan

---

## Table of Contents

1. [Fix N+1 Queries](#1-fix-n1-queries)
2. [Reuse Already-Fetched Data in Spawn](#2-reuse-already-fetched-data-in-spawn)
3. [Add Pagination to All 12 List Endpoints](#3-add-pagination-to-all-12-list-endpoints)
4. [Return Summary DTOs for List Views](#4-return-summary-dtos-for-list-views)
5. [Add Cache Headers](#5-add-cache-headers)
6. [Add Compression Middleware](#6-add-compression-middleware)
7. [Fix Sequential Session Lookups with Promise.all](#7-fix-sequential-session-lookups-with-promiseall)
8. [Decompose 534-Line Spawn Handler](#8-decompose-534-line-spawn-handler)

---

## 1. Fix N+1 Queries

### 1a. `GET /tasks/:id/docs` — taskRoutes.ts:123-150

**Current**: Sequential `await` inside `for` loop fetches docs per session one at a time.

```typescript
// BEFORE (lines 133-141)
const sessions = await sessionService.listSessionsByTask(taskId);
for (const session of sessions) {
  const sessionDocs = await sessionService.getSessionDocsWithContent(session.id);
  for (const doc of sessionDocs) {
    if (!doc.taskId || doc.taskId === taskId) {
      docs.push({ ...doc, sessionId: session.id, sessionName: session.name });
    }
  }
}
```

**Fix**: Parallelize with `Promise.all`.

```typescript
// AFTER
const sessions = await sessionService.listSessionsByTask(taskId);
const allSessionDocs = await Promise.all(
  sessions.map(async (session) => {
    const sessionDocs = await sessionService.getSessionDocsWithContent(session.id);
    return sessionDocs
      .filter((doc) => !doc.taskId || doc.taskId === taskId)
      .map((doc) => ({ ...doc, sessionId: session.id, sessionName: session.name }));
  })
);
const docs = allSessionDocs.flat();
```

**File**: `maestro-server/src/api/taskRoutes.ts` lines 131-141
**Risk**: Low — pure read parallelization, no ordering dependency between sessions.

---

### 1b. `enrichSessionWithSnapshots` — sessionRoutes.ts:274-299

**Current**: Sequential `await` inside `for` loop fetches team members one by one.

```typescript
// BEFORE (lines 282-290)
for (const tmId of tmIds) {
  try {
    const tm = await teamMemberRepo.findById(session.projectId, tmId);
    if (tm) {
      snapshots.push({ name: tm.name, avatar: tm.avatar, role: tm.role, model: tm.model, agentTool: tm.agentTool });
    }
  } catch { /* skip */ }
}
```

**Fix**: Batch-fetch all team members for the project once, then look up from a local map. When called from the list endpoint (`GET /sessions`), hoist the batch fetch to the caller level and pass the map in.

```typescript
// AFTER — enrichSessionWithSnapshots gets optional preloaded map
async function enrichSessionWithSnapshots(
  session: any,
  teamMemberMap?: Map<string, any>
): Promise<any> {
  if (session.teamMemberSnapshots?.length > 0 || session.teamMemberSnapshot) return session;
  const meta = session.metadata;
  if (!meta) return session;
  const tmIds: string[] = meta.teamMemberIds?.length > 0
    ? meta.teamMemberIds
    : (meta.teamMemberId ? [meta.teamMemberId] : []);
  if (tmIds.length === 0) return session;

  let resolveTeamMember: (id: string) => any | undefined;
  if (teamMemberMap) {
    resolveTeamMember = (id) => teamMemberMap.get(id);
  } else {
    // Fallback: batch fetch for this project
    const allMembers = await teamMemberRepo.findByProjectId(session.projectId);
    const localMap = new Map(allMembers.map((m) => [m.id, m]));
    resolveTeamMember = (id) => localMap.get(id);
  }

  const snapshots: TeamMemberSnapshot[] = [];
  for (const tmId of tmIds) {
    const tm = resolveTeamMember(tmId);
    if (tm) {
      snapshots.push({ name: tm.name, avatar: tm.avatar, role: tm.role, model: tm.model, agentTool: tm.agentTool });
    }
  }
  if (snapshots.length === 0) return session;
  const enriched = { ...session, teamMemberIds: tmIds, teamMemberSnapshots: snapshots };
  if (tmIds.length === 1) {
    enriched.teamMemberId = tmIds[0];
    enriched.teamMemberSnapshot = snapshots[0];
  }
  return enriched;
}
```

**Caller change** in `GET /sessions` (line ~331):
```typescript
// Preload team members for all projects in the result set
const projectIds = [...new Set(sessions.map((s) => s.projectId).filter(Boolean))];
const teamMembersByProject = new Map<string, Map<string, any>>();
await Promise.all(
  projectIds.map(async (pid) => {
    const members = await teamMemberRepo.findByProjectId(pid);
    teamMembersByProject.set(pid, new Map(members.map((m) => [m.id, m])));
  })
);
const enrichedSessions = await Promise.all(
  sessions.map((s) => enrichSessionWithSnapshots(s, teamMembersByProject.get(s.projectId)))
);
```

**Files**: `maestro-server/src/api/sessionRoutes.ts` lines 274-299 and ~331
**Risk**: Low — reduces N+1 to a batch fetch per project.

---

### 1c. Sequential Team Member Fetches in Spawn — sessionRoutes.ts:933-979

**Current**: After `teamMemberRepo.findByProjectId(projectId)` is already called at line 908 (which returns ALL members), individual `findById` calls at line 935 are redundant.

**Fix**: Use the `projectTeamMembers` array already fetched at line 908 to build a lookup map, then resolve from the map in the loop at line 933.

```typescript
// Build lookup map from already-fetched project members (line 908)
// If projectTeamMembers not yet fetched, fetch once
const projectTeamMembers = await teamMemberRepo.findByProjectId(projectId);
const teamMemberMap = new Map(projectTeamMembers.map((m) => [m.id, m]));

// Replace loop at line 933
for (const tmId of effectiveTeamMemberIds) {
  const teamMember = teamMemberMap.get(tmId);
  if (teamMember && teamMember.status !== 'archived') {
    // ... existing override + snapshot logic unchanged
  }
}
```

**Note**: The `findByProjectId` call at line 908 only runs for the coordinator mode fallback path. We need to ensure one batch fetch happens unconditionally before the team member loop at line 931. Move the `findByProjectId` call to before line 931 if it hasn't been called yet, and gate the existing line-908 call so it's reused.

**File**: `maestro-server/src/api/sessionRoutes.ts` lines 908, 931-979
**Risk**: Low — uses data already fetched.

---

### 1d. N+1 in Resume — sessionRoutes.ts:1291-1301

**Current**: Sequential task fetch for reference task collection.

```typescript
// BEFORE
for (const taskId of session.taskIds) {
  const task = await taskRepo.findById(taskId);
  if (task?.referenceTaskIds?.length > 0) { ... }
}
```

**Fix**: Parallelize with `Promise.all`.

```typescript
// AFTER
const tasks = await Promise.all(session.taskIds.map((taskId) => taskRepo.findById(taskId)));
const allReferenceTaskIds: string[] = [];
for (const task of tasks) {
  if (task?.referenceTaskIds?.length > 0) {
    for (const refId of task.referenceTaskIds) {
      if (!allReferenceTaskIds.includes(refId)) {
        allReferenceTaskIds.push(refId);
      }
    }
  }
}
```

**File**: `maestro-server/src/api/sessionRoutes.ts` lines 1291-1301
**Risk**: Low — parallel reads, no mutation.

---

## 2. Reuse Already-Fetched Data in Spawn

### 2a. Duplicate Task Fetches at Line 1073

**Current**: Tasks are fetched TWICE — once for verification (line 852), once for reference ID collection (line 1073).

```typescript
// Line 852: verification loop — stores in verifiedTasks[]
for (const taskId of taskIds) {
  const task = await taskRepo.findById(taskId);
  verifiedTasks.push(task);
}

// Line 1073: reference collection — re-fetches the same tasks!
for (const taskId of taskIds) {
  const task = await taskRepo.findById(taskId);
  // uses task.referenceTaskIds
}
```

**Fix**: Use the `verifiedTasks` array (already populated) for reference ID collection.

```typescript
// AFTER — replace lines 1072-1082
const allReferenceTaskIds: string[] = [];
for (const task of verifiedTasks) {
  if (task?.referenceTaskIds && task.referenceTaskIds.length > 0) {
    for (const refId of task.referenceTaskIds) {
      if (!allReferenceTaskIds.includes(refId)) {
        allReferenceTaskIds.push(refId);
      }
    }
  }
}
```

**File**: `maestro-server/src/api/sessionRoutes.ts` lines 1071-1082
**Risk**: None — zero-cost fix, data is already in memory.
**Impact**: Eliminates N redundant disk reads (one per task).

### 2b. Parallelize Task Verification Loop

**Current**: Tasks are verified sequentially at line 852.

**Fix**: Use `Promise.all` but preserve error-on-first-miss semantics:

```typescript
// AFTER
const verifiedTasks = await Promise.all(
  taskIds.map(async (taskId) => {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      throw Object.assign(new Error(`Task ${taskId} not found`), { taskId, statusCode: 404 });
    }
    return task;
  })
);
```

Then catch and return 404 for the thrown error. This parallelizes the reads but still fails on any missing task.

**File**: `maestro-server/src/api/sessionRoutes.ts` lines 851-863
**Risk**: Low — changes error behavior slightly (all tasks are attempted vs fail-fast). Acceptable since task existence checks are non-mutating.

---

## 3. Add Pagination to All 12 List Endpoints

### Pagination Strategy

Use **offset-based pagination** with `limit` and `offset` query params. Default `limit` = 100, max `limit` = 500. This is simpler than cursor-based and sufficient since the data is filesystem-backed (not a live DB cursor).

### Shared Pagination Schema

Add to `validation.ts`:

```typescript
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

// Helper type
export interface PaginationParams {
  limit: number;
  offset: number;
}

// Helper to extract from validated query
export function extractPagination(query: Record<string, any>): PaginationParams {
  return {
    limit: Number(query.limit) || 100,
    offset: Number(query.offset) || 0,
  };
}
```

### Shared Paginated Response Wrapper

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export function paginate<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  const total = items.length;
  const sliced = items.slice(params.offset, params.offset + params.limit);
  return {
    data: sliced,
    pagination: {
      offset: params.offset,
      limit: params.limit,
      total,
      hasMore: params.offset + params.limit < total,
    },
  };
}
```

### Endpoints to Update

| # | Endpoint | File | Current Query Schema | Change |
|---|----------|------|---------------------|--------|
| 1 | `GET /tasks` | taskRoutes.ts:29 | `listTasksQuerySchema` | Merge `paginationQuerySchema` |
| 2 | `GET /sessions` | sessionRoutes.ts:301 | `listSessionsQuerySchema` | Merge `paginationQuerySchema` |
| 3 | `GET /projects` | projectRoutes.ts:20 | None | Add `validateQuery(paginationQuerySchema)` |
| 4 | `GET /teams` | teamRoutes.ts:16 | Manual `projectId` check | Add `validateQuery` with pagination |
| 5 | `GET /team-members` | teamMemberRoutes.ts:17 | Manual `projectId` check | Add `validateQuery` with pagination |
| 6 | `GET /task-lists` | taskListRoutes.ts:23 | `listTaskListsQuerySchema` | Merge `paginationQuerySchema` |
| 7 | `GET /tasks/:id/docs` | taskRoutes.ts:123 | None | Add `validateQuery(paginationQuerySchema)` |
| 8 | `GET /tasks/:id/children` | taskRoutes.ts:327 | None | Add `validateQuery(paginationQuerySchema)` |
| 9 | `GET /master/projects` | masterRoutes.ts:71 | None | Add `validateQuery(paginationQuerySchema)` |
| 10 | `GET /master/tasks` | masterRoutes.ts:81 | Manual query | Add pagination |
| 11 | `GET /master/sessions` | masterRoutes.ts:102 | Manual query | Add pagination |
| 12 | `GET /skills` | skillRoutes.ts:16 | Manual query | Add pagination |

### Implementation Pattern (per endpoint)

```typescript
// Example: GET /tasks
router.get('/tasks', validateQuery(listTasksQuerySchema.merge(paginationQuerySchema)), async (req, res) => {
  const filter = { /* existing filter extraction */ };
  const pag = extractPagination(req.query);
  const tasks = await taskService.listTasks(filter);
  res.json(paginate(tasks, pag));
});
```

**Backward Compatibility**: When `limit` and `offset` are omitted, defaults apply (limit=100, offset=0). Clients that previously expected raw arrays will now receive `{ data: [...], pagination: {...} }`. This is a **breaking change** — the UI must be updated to read `.data` from list responses.

**Alternative (non-breaking)**: Only apply pagination when `limit` or `offset` are explicitly provided. When absent, return the raw array as before. This allows gradual migration.

```typescript
// Non-breaking approach
const pag = extractPagination(req.query);
const tasks = await taskService.listTasks(filter);
if (req.query.limit || req.query.offset) {
  res.json(paginate(tasks, pag));
} else {
  res.json(tasks); // backward compatible
}
```

**Recommendation**: Use the non-breaking approach to avoid coordinating UI changes.

**Files**: `validation.ts`, all 10 route files listed above
**Risk**: Medium — must update both server and client if using breaking approach. Non-breaking approach is safe.

---

## 4. Return Summary DTOs for List Views

### 4a. Session Summary DTO

**Current**: `GET /sessions` returns full session objects including `env` (contains API keys!), `events[]`, `timeline[]`, `metadata`.

**Fix**: Return summary DTO for list view. Add `?fields=full` query param to opt into full objects.

```typescript
interface SessionSummaryDTO {
  id: string;
  name: string;
  status: SessionStatus;
  projectId: string;
  taskIds: string[];
  parentSessionId?: string;
  rootSessionId?: string;
  teamMemberIds?: string[];
  teamMemberSnapshots?: TeamMemberSnapshot[];
  teamMemberSnapshot?: TeamMemberSnapshot;
  createdAt: number;
  updatedAt: number;
}

function toSessionSummary(session: any): SessionSummaryDTO {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    projectId: session.projectId,
    taskIds: session.taskIds,
    parentSessionId: session.parentSessionId,
    rootSessionId: session.rootSessionId,
    teamMemberIds: session.teamMemberIds,
    teamMemberSnapshots: session.teamMemberSnapshots,
    teamMemberSnapshot: session.teamMemberSnapshot,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
```

**Usage in GET /sessions**:
```typescript
const enrichedSessions = await Promise.all(sessions.map(s => enrichSessionWithSnapshots(s, ...)));
const result = req.query.fields === 'full'
  ? enrichedSessions
  : enrichedSessions.map(toSessionSummary);
res.json(result);
```

**Security note**: This also fixes the security concern of leaking `env` (API keys, paths) in list responses.

### 4b. Skill Summary DTO

**Current**: `GET /skills` returns `content: skill.instructions` — full multi-KB instruction text for every skill.

**Fix**: Omit `content` field from list response. Only `GET /skills/:id` returns full content.

```typescript
// In GET /skills — remove content from response
const skills = scopedSkills.map((skill: SkillWithMeta) => ({
  id: skill.manifest.name,
  name: skill.manifest.name,
  description: skill.manifest.description || '',
  // ... other metadata fields
  // content: skill.instructions,  // REMOVED from list
}));
```

### 4c. Master Context — Use Count Queries

**Current**: `GET /master/context` fetches ALL tasks and ALL sessions just to count them.

**Fix**: Add `count()` methods to TaskService and SessionService (or just use `.length` after a lightweight index query). Since the filesystem repos already maintain indices, the list methods are relatively cheap, but we should avoid returning full objects to the route if we only need counts.

```typescript
// Add to TaskService
async countTasks(filter: TaskFilter): Promise<number> {
  const tasks = await this.taskRepo.findAll(filter);
  return tasks.length;
}

// Add to SessionService
async countSessions(filter?: { projectId?: string }): Promise<number> {
  const sessions = filter?.projectId
    ? await this.listSessionsByProject(filter.projectId)
    : await this.listSessions();
  return sessions.length;
}
```

Then in `GET /master/context`:
```typescript
const projects = await projectService.listProjects();
const countResults = await Promise.all(
  projects.map(async (project) => ({
    projectId: project.id,
    taskCount: await taskService.countTasks({ projectId: project.id }),
    sessionCount: await sessionService.countSessions({ projectId: project.id }),
  }))
);
```

**File**: `sessionRoutes.ts`, `skillRoutes.ts`, `masterRoutes.ts`, `SessionService.ts`, `TaskService.ts`
**Risk**: Medium — DTO change is technically breaking for clients relying on full session fields in list responses. Use `?fields=full` escape hatch.

---

## 5. Add Cache Headers

Add `Cache-Control` headers to endpoints with predictable staleness tolerance.

### Implementation

Create a middleware helper:

```typescript
// In a new file: maestro-server/src/api/middleware/cacheControl.ts
export function cacheControl(maxAge: number, options?: { immutable?: boolean; public?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parts = [`max-age=${maxAge}`];
    if (options?.public) parts.unshift('public');
    if (options?.immutable) parts.push('immutable');
    res.set('Cache-Control', parts.join(', '));
    next();
  };
}
```

### Endpoints to Annotate

| Endpoint | Cache Header | Rationale |
|----------|-------------|-----------|
| `GET /projects` | `Cache-Control: max-age=30` | Projects change infrequently |
| `GET /projects/:id` | `Cache-Control: max-age=30` | Same |
| `GET /skills` | `Cache-Control: max-age=300` | Skills are loaded from disk, rarely change at runtime |
| `GET /skills/:id` | `Cache-Control: max-age=300` | Same |
| `GET /skills/mode/:mode` | `Cache-Control: max-age=300` | Same |
| `GET /workflow-templates` | `Cache-Control: public, max-age=86400, immutable` | Built-in, never change |
| `GET /workflow-templates/:id` | `Cache-Control: public, max-age=86400, immutable` | Same |
| `GET /ordering/:entityType/:projectId` | `Cache-Control: max-age=5` | Changes on user interaction |
| `GET /tasks/:id/images/:imageId` | Already has `Cache-Control: public, max-age=31536000` | No change needed |

### Application Pattern

```typescript
// In route registration
router.get('/skills', cacheControl(300), async (req, res) => { ... });
router.get('/workflow-templates', cacheControl(86400, { public: true, immutable: true }), async (req, res) => { ... });
```

**Files**: New `middleware/cacheControl.ts`, `skillRoutes.ts`, `projectRoutes.ts`, `workflowTemplateRoutes.ts`, `orderingRoutes.ts`
**Risk**: Low — purely additive. Clients can override with `Cache-Control: no-cache`.

---

## 6. Add Compression Middleware

### Implementation

```bash
# Install compression package
cd maestro-server && npm install compression && npm install -D @types/compression
```

Add to `server.ts` after JSON body parser:

```typescript
import compression from 'compression';

// ... after express.json()
app.use(compression({
  threshold: 1024,  // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress SSE streams
    if (req.headers.accept === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));
```

**File**: `maestro-server/src/server.ts` line ~64 (after JSON body parser)
**Risk**: Low — standard Express middleware. Transparent to clients that send `Accept-Encoding: gzip`.

---

## 7. Fix Sequential Session Lookups with Promise.all

### 7a. `POST /sessions/:id/prompt` — sessionRoutes.ts:651-652

**Current**: Two sequential session fetches.

```typescript
const session = await sessionService.getSession(sessionId);
const senderSession = await sessionService.getSession(senderSessionId);
```

**Fix**:
```typescript
const [session, senderSession] = await Promise.all([
  sessionService.getSession(sessionId),
  sessionService.getSession(senderSessionId),
]);
```

### 7b. Sequential Event Emissions in Spawn — sessionRoutes.ts:1206-1209

**Current**:
```typescript
for (const taskId of taskIds) {
  await eventBus.emit('task:session_added', { taskId, sessionId: session.id });
}
```

**Fix**:
```typescript
await Promise.all(
  taskIds.map((taskId) => eventBus.emit('task:session_added', { taskId, sessionId: session.id }))
);
```

### 7c. Duplicate Session Updates in Resume — sessionRoutes.ts:1381-1397

**Current**: Two sequential `updateSession` calls.

```typescript
await sessionService.updateSession(session.id, {
  status: 'spawning',
  env: finalEnvVars,
});
await sessionService.updateSession(session.id, {
  timeline: [...]
});
```

**Fix**: Merge into one call.

```typescript
await sessionService.updateSession(session.id, {
  status: 'spawning',
  env: finalEnvVars,
  timeline: [
    ...(session.timeline || []),
    {
      id: randomUUID(),
      type: 'progress' as const,
      timestamp: Date.now(),
      message: 'Session resumed',
    }
  ],
});
```

**File**: `maestro-server/src/api/sessionRoutes.ts`
**Risk**: Low — straightforward parallelization/merge of independent operations.

---

## 8. Decompose 534-Line Spawn Handler

### Current Structure (sessionRoutes.ts:693-1226)

The spawn handler performs 13 distinct responsibilities in a single function. It should be decomposed into a service-layer class.

### Proposed Decomposition

Create `maestro-server/src/application/services/SpawnService.ts`:

```typescript
export class SpawnService {
  constructor(
    private sessionService: SessionService,
    private taskRepo: TaskRepository,
    private teamMemberRepo: TeamMemberRepository,
    private projectRepo: ProjectRepository,
    private eventBus: EventBus,
    private config: Config,
    private skillLoader: ISkillLoader,
  ) {}

  /**
   * Phase 1: Validate and resolve inputs
   */
  async validateAndResolve(input: SpawnInput): Promise<ResolvedSpawnContext> {
    // - Validate spawnSource
    // - Validate parent session (if session-spawned)
    // - Validate parent mode compatibility
    // - Resolve effectiveTeamMemberIds / effectiveDelegateTeamMemberIds
    // - Verify all tasks exist → return verifiedTasks
    // - Resolve memberOverrides inheritance
  }

  /**
   * Phase 2: Resolve team member defaults and build snapshots
   */
  async resolveTeamMembers(
    ctx: ResolvedSpawnContext
  ): Promise<TeamMemberResolution> {
    // - Batch-fetch project team members
    // - Build lookup map
    // - Resolve defaults (mode, model, agentTool, permissionMode)
    // - Build snapshots array
    // - Resolve mode normalization
  }

  /**
   * Phase 3: Create session and generate manifest
   */
  async createSessionAndManifest(
    ctx: ResolvedSpawnContext,
    tmResolution: TeamMemberResolution
  ): Promise<SpawnResult> {
    // - Create session object
    // - Collect reference task IDs from verifiedTasks (no re-fetch!)
    // - Generate manifest via CLI
    // - Assemble env vars
    // - Update session with env
  }

  /**
   * Phase 4: Emit events
   */
  async emitSpawnEvents(result: SpawnResult): Promise<void> {
    // - Emit session:spawn
    // - Emit task:session_added (parallelized)
    // - Update coordinator session if needed
  }

  /**
   * Main orchestrator
   */
  async spawn(input: SpawnInput): Promise<SpawnResponse> {
    const ctx = await this.validateAndResolve(input);
    const tmResolution = await this.resolveTeamMembers(ctx);
    const result = await this.createSessionAndManifest(ctx, tmResolution);
    await this.emitSpawnEvents(result);
    return { sessionId: result.session.id, manifestPath: result.manifestPath, session: result.session };
  }
}
```

### Route Handler After Decomposition

```typescript
router.post('/sessions/spawn', validateBody(spawnSessionSchema), async (req, res) => {
  try {
    const result = await spawnService.spawn(req.body);
    res.status(201).json({ success: true, ...result, message: 'Spawn request sent to Agent Maestro' });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: true, code: err.code, message: err.message, details: err.details });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: true, code: 'spawn_error', message });
  }
});
```

### Phase Boundaries & Types

```typescript
interface SpawnInput {
  projectId: string;
  taskIds: string[];
  sessionName?: string;
  skills?: string[];
  sessionId?: string;       // parent session ID
  spawnSource?: 'ui' | 'session';
  mode?: string;
  context?: string;
  teamMemberIds?: string[];
  delegateTeamMemberIds?: string[];
  teamMemberId?: string;
  agentTool?: string;
  model?: string;
  initialDirective?: any;
  memberOverrides?: Record<string, MemberLaunchOverride>;
  permissionMode?: string;
  delegatePermissionMode?: string;
}

interface ResolvedSpawnContext {
  projectId: string;
  project: Project;
  taskIds: string[];
  verifiedTasks: Task[];
  effectiveTeamMemberIds: string[];
  effectiveDelegateTeamMemberIds: string[];
  resolvedParentSessionId?: string;
  parentSession?: Session;
  parentMode?: string;
  normalizedMemberOverrides?: Record<string, MemberLaunchOverride>;
  requestedMode: string;
  requestedCoordinatorMode: boolean;
  // ... other resolved fields
}

interface TeamMemberResolution {
  teamMemberDefaults: { mode?: AgentMode; model?: string; agentTool?: AgentTool; permissionMode?: string };
  teamMemberSnapshots: TeamMemberSnapshot[];
  resolvedMode: string;
  resolvedModel?: string;
  resolvedAgentTool?: string;
  resolvedPermissionMode?: string;
  resolvedDelegatePermissionMode?: string;
  skillsToUse: string[];
}

interface SpawnResult {
  session: Session;
  manifestPath: string;
  manifest: any;
  envVars: Record<string, string>;
}
```

**Files**: New `maestro-server/src/application/services/SpawnService.ts`, modified `sessionRoutes.ts`
**Risk**: Medium — large refactor, must preserve all existing behavior. Should be done in a separate PR with thorough testing.
**Recommendation**: Do this LAST, after all other fixes in this plan are landed. The other fixes (N+1, reuse data, etc.) can be applied directly to the existing monolith first, then the decomposition moves the already-fixed code into the service.

---

## Execution Order

| Priority | Item | Effort | Impact | Breaking? |
|----------|------|--------|--------|-----------|
| 1 | 2a: Reuse `verifiedTasks` (zero-cost) | 5 min | High | No |
| 2 | 7a-c: Promise.all + merge updates | 15 min | Medium | No |
| 3 | 1a: Parallelize task docs fetch | 10 min | High | No |
| 4 | 1c: Batch team member fetch in spawn | 20 min | High | No |
| 5 | 1b: Batch team member fetch in enrichment | 30 min | High | No |
| 6 | 1d: Parallelize resume task fetch | 10 min | Medium | No |
| 7 | 2b: Parallelize task verification | 10 min | Medium | No |
| 8 | 6: Add compression middleware | 10 min | Medium | No |
| 9 | 5: Add cache headers | 20 min | Medium | No |
| 10 | 4: Summary DTOs | 45 min | High | Soft (opt-in) |
| 11 | 3: Pagination | 60 min | High | Soft (non-breaking) |
| 12 | 8: Decompose spawn handler | 2-3 hrs | Architectural | No |

**Total estimated scope**: ~5-6 hours of implementation work.

Items 1-9 are safe, non-breaking changes that can be shipped immediately.
Items 10-11 are backward-compatible with the opt-in approach described above.
Item 12 is a structural refactor best done in its own PR after the quick wins land.
