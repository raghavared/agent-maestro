# Fix Plan Group 4: Server Repository Caching & I/O

**Task**: `task_1773038419313_2k6clqkjn`
**Reference**: `docs/filesystem-repo-io-analysis.md`
**Scope**: All 7 FileSystem repositories in `maestro-server/src/infrastructure/repositories/`

---

## Current State Summary

| Repository | Cache | Secondary Indexes | Parallel Init | Write Pattern | JSON Format |
|---|---|---|---|---|---|
| Session | Hybrid (active cached, terminal evicted) | None (O(n) scans via index) | No (sequential) | Immediate, no batching | Pretty (indent 2) |
| Task | Full in-memory, no eviction | None (O(n) scans) | No (sequential) | Immediate | Pretty |
| TaskList | Full in-memory | None (O(n) scans) | No (sequential) | Immediate | Pretty |
| Project | Full in-memory | None | No (sequential) | Immediate | Pretty |
| TeamMember | **NONE** (every read = disk) | None | N/A | Immediate | Pretty |
| Team | **NONE** (every read = disk) | None | N/A | Immediate | Pretty |
| Ordering | Full in-memory (well-designed) | Compound key | No (sequential) | Immediate | Pretty |

---

## Plan Overview

### Phase 1 — P0: Critical Cache Additions (Eliminate Disk-on-Every-Access)
### Phase 2 — P1: Parallel I/O & Secondary Indexes (Scalability)
### Phase 3 — P2: Write Optimization & Cross-Cutting (Reliability & Performance)

---

## Phase 1: P0 — Critical Cache Additions

### 1.1 Add In-Memory Cache to TeamMemberRepository

**File**: `FileSystemTeamMemberRepository.ts`
**Issues**: 4.1, 4.2, 4.3, 4.4 (all CRITICAL/HIGH)
**Impact**: Every API call to team members currently triggers disk reads (5 defaults + directory scan + file reads per `findByProjectId()`)

#### Changes

**Add cache data members** (after line ~184):
```typescript
private memberCache: Map<string, TeamMember> = new Map();           // id → TeamMember
private projectMemberIndex: Map<string, Set<string>> = new Map();   // projectId → Set<memberId>
private overrideCache: Map<string, Record<string, any>> = new Map(); // defaultId → override data
private projectsLoaded: Set<string> = new Set();                    // tracks which projects are fully loaded
```

**Modify `findById()`** (lines 314-332):
- Check `memberCache` first → return if found
- On miss: load from disk, populate cache, return
- For default members: check `overrideCache` before disk

**Modify `findByProjectId()`** (lines 334-347):
- Check if `projectsLoaded.has(projectId)` → if yes, return from `projectMemberIndex` + cache
- On first call: load all members (defaults + custom), populate cache + index, mark project as loaded
- All subsequent calls are pure cache reads

**Modify `createDefaultTeamMember()`** (lines 241-277):
- Check `overrideCache` before `fs.readFile` for override
- Cache override data on first load per default member

**Modify `create()`** (lines 349-364):
- After disk write, add to `memberCache` and `projectMemberIndex`

**Modify `update()`** (lines 366-401):
- After disk write, update `memberCache`
- For defaults: update `overrideCache` too

**Modify `delete()`** (lines 403-431):
- Remove from `memberCache` and `projectMemberIndex`
- **Eliminate the all-projects scan**: Accept `projectId` parameter or use `memberCache` to find the project
  - The member is already in cache if it was ever accessed → use cache to find projectId
  - Fallback to directory scan only if not in cache

**Modify `resetDefault()`** (lines 465-476):
- Clear override from `overrideCache`
- Regenerate default member in `memberCache`

**Modify `saveDefaultOverride()`** (lines 433-463):
- Update `overrideCache` after writing to disk

#### Estimated LOC: ~80 lines added/modified

---

### 1.2 Add In-Memory Cache to TeamRepository

**File**: `FileSystemTeamRepository.ts`
**Issues**: 5.1, 5.2, 5.3 (all CRITICAL/HIGH)
**Impact**: Every `findById()` and `findByProjectId()` reads from disk

#### Changes

**Add cache data members** (after line ~18):
```typescript
private teamCache: Map<string, Team> = new Map();                // id → Team
private projectTeamIndex: Map<string, Set<string>> = new Map();  // projectId → Set<teamId>
private projectsLoaded: Set<string> = new Set();                 // tracks fully loaded projects
```

**Modify `findById()`** (lines 90-100):
- Check `teamCache` first → return if found
- On miss: load from disk, populate cache, return

**Modify `findByProjectId()`** (lines 102-105):
- Check if project is loaded → if yes, return from index + cache
- On first call: load all teams via `loadTeams()`, populate cache + index, mark loaded

**Modify `loadTeams()`** (lines 61-88):
- After loading from disk, populate `teamCache` and `projectTeamIndex`

**Modify `create()`** (lines 107-118):
- After disk write, add to `teamCache` and `projectTeamIndex`

**Modify `update()`** (lines 120-146):
- After disk write, update `teamCache`

**Modify `delete()`** (lines 148-170):
- Remove from `teamCache` and `projectTeamIndex`
- **Eliminate all-projects scan**: Use `teamCache` to find projectId from team.id
  - The team is in cache if accessed → look up team.projectId
  - Fallback to directory scan only if not in cache

#### Estimated LOC: ~60 lines added/modified

---

### 1.3 Add LRU Eviction to TaskRepository

**File**: `FileSystemTaskRepository.ts`
**Issue**: 2.2 (HIGH)
**Impact**: All tasks ever created stay in memory forever — unbounded growth

#### Changes

**Implement lightweight LRU eviction**:

Option A — **Simple timestamp-based eviction** (recommended for simplicity):
```typescript
private readonly MAX_CACHED_TASKS = 5000;
private readonly EVICTION_BATCH = 500;  // evict 500 at a time to avoid frequent eviction
private taskAccessTime: Map<string, number> = new Map();  // taskId → last access timestamp
```

**Add eviction logic**:
- On every `findById()` / access: update `taskAccessTime`
- After `create()` or when cache exceeds `MAX_CACHED_TASKS`:
  - Sort completed/cancelled tasks by `taskAccessTime` ascending
  - Remove oldest `EVICTION_BATCH` completed tasks from `tasks` Map and `taskAccessTime`
  - Active (pending/in_progress) tasks are NEVER evicted
- On `findById()` cache miss: lazy-load from disk (add `loadTaskFile()` path similar to session repo)

**Modify `findById()`** (lines 148-151):
- If cache miss: attempt disk load from `{tasksDir}/{projectId}/{taskId}.json`
  - Problem: we need projectId to find the file. Add a lightweight index:
    ```typescript
    private taskProjectIndex: Map<string, string> = new Map();  // taskId → projectId (never evicted)
    ```
  - This index is tiny (just two strings per task) and stays in memory permanently
  - On cache miss: look up projectId from index, load file, add back to cache

**Modify `initialize()`** (lines 30-60):
- Populate `taskProjectIndex` for all tasks
- Only keep active + recently accessed tasks in `tasks` Map
- Completed tasks older than threshold → index only (not cached)

#### Estimated LOC: ~70 lines added/modified

---

## Phase 2: P1 — Parallel I/O & Secondary Indexes

### 2.1 Parallelize File Reads on Startup

**Files**: All repositories with `initialize()` methods
**Issues**: 1.1, 2.1, 3.1, 6.1, 7.1
**Impact**: Server startup time scales linearly with data volume

#### Shared Utility

**Create `maestro-server/src/infrastructure/repositories/utils/parallelFileLoader.ts`**:
```typescript
/**
 * Load multiple files in parallel with bounded concurrency.
 * Uses Promise.allSettled to handle individual file failures gracefully.
 */
export async function loadFilesParallel<T>(
  filePaths: string[],
  loader: (path: string) => Promise<T>,
  options?: { concurrency?: number }  // default: 50
): Promise<{ successes: T[]; failures: { path: string; error: Error }[] }>
```

Implementation:
- Split `filePaths` into chunks of `concurrency` size
- Process each chunk with `Promise.allSettled()`
- Collect successes and failures
- Log failures via caller-provided logger

#### Apply to Each Repository

**SessionRepository `initialize()`** (lines 204-229):
- Collect all session file paths first
- Load in parallel via `loadFilesParallel(paths, loadSessionFromDisk, { concurrency: 50 })`

**TaskRepository `initialize()`** (lines 37-52):
- Collect all task file paths across all project directories first
- Load in parallel

**TaskListRepository `initialize()`** (lines 33-49):
- Collect all task list file paths, load in parallel

**ProjectRepository `initialize()`** (lines 45-53):
- Collect all project file paths, load in parallel (lower priority, few files)

**OrderingRepository `initialize()`** (lines 39-55):
- Collect all ordering file paths, load in parallel (lower priority, few files)

#### Estimated LOC: ~60 lines utility + ~20 lines per repository = ~160 total

---

### 2.2 Parallelize `resolveSessionIds()` in SessionRepository

**File**: `FileSystemSessionRepository.ts`
**Issue**: 1.2 (HIGH)
**Impact**: A query matching 100 terminal sessions = 100 sequential file reads

#### Changes

**Modify `resolveSessionIds()`** (lines 173-185):
```typescript
// BEFORE: Sequential
for (const id of sessionIds) {
  const session = this.sessions.get(id) || await this.loadSessionFromDisk(id);
  if (session) results.push(session);
}

// AFTER: Parallel with cache-first
const cached: Session[] = [];
const toLoad: string[] = [];
for (const id of sessionIds) {
  const session = this.sessions.get(id);
  if (session) cached.push(session);
  else toLoad.push(id);
}
const loaded = await loadFilesParallel(
  toLoad.map(id => path.join(this.sessionsDir, `${id}.json`)),
  async (filePath) => {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as Session;
  },
  { concurrency: 50 }
);
return [...cached, ...loaded.successes];
```

#### Estimated LOC: ~20 lines modified

---

### 2.3 Build Secondary Indexes for TaskRepository

**File**: `FileSystemTaskRepository.ts`
**Issues**: 2.3, 2.4, 2.5, 2.6 (all MEDIUM-HIGH)
**Impact**: All queries are O(n) scans through entire task cache

#### Changes

**Add secondary index data members**:
```typescript
private projectIndex: Map<string, Set<string>> = new Map();    // projectId → Set<taskId>
private statusIndex: Map<string, Set<string>> = new Map();     // status → Set<taskId>
private parentIndex: Map<string, Set<string>> = new Map();     // parentId → Set<taskId>
private sessionIndex: Map<string, Set<string>> = new Map();    // sessionId → Set<taskId>
```

**Add index maintenance helpers**:
```typescript
private addToIndex(index: Map<string, Set<string>>, key: string, taskId: string): void {
  if (!index.has(key)) index.set(key, new Set());
  index.get(key)!.add(taskId);
}

private removeFromIndex(index: Map<string, Set<string>>, key: string, taskId: string): void {
  index.get(key)?.delete(taskId);
  if (index.get(key)?.size === 0) index.delete(key);
}

private indexTask(task: Task): void {
  this.addToIndex(this.projectIndex, task.projectId, task.id);
  this.addToIndex(this.statusIndex, task.status, task.id);
  if (task.parentId) this.addToIndex(this.parentIndex, task.parentId, task.id);
  for (const sid of task.sessionIds ?? []) {
    this.addToIndex(this.sessionIndex, sid, task.id);
  }
}

private unindexTask(task: Task): void {
  this.removeFromIndex(this.projectIndex, task.projectId, task.id);
  this.removeFromIndex(this.statusIndex, task.status, task.id);
  if (task.parentId) this.removeFromIndex(this.parentIndex, task.parentId, task.id);
  for (const sid of task.sessionIds ?? []) {
    this.removeFromIndex(this.sessionIndex, sid, task.id);
  }
}
```

**Modify query methods**:
- `findByProjectId()`: `return [...(this.projectIndex.get(projectId) ?? [])].map(id => this.tasks.get(id)!)`
- `findByStatus()`: Same pattern with `statusIndex`
- `findByParentId()`: Same pattern with `parentIndex`
- `findBySessionId()`: Same pattern with `sessionIndex`
- `findAll()`: Use index intersection when filters provided

**Maintain indexes on mutations**:
- `create()`: call `indexTask(task)` after adding to cache
- `update()`: call `unindexTask(oldTask)` then `indexTask(newTask)` (handles status changes, etc.)
- `delete()`: call `unindexTask(task)` before removing from cache
- `addSession()`: add to `sessionIndex`
- `removeSession()`: remove from `sessionIndex`
- `initialize()`: call `indexTask()` for each loaded task

**Modify `existsByProjectId()`** (lines 290-293):
```typescript
// BEFORE: Array.from(this.tasks.values()).some(...)
// AFTER:
return (this.projectIndex.get(projectId)?.size ?? 0) > 0;
```

#### Estimated LOC: ~80 lines added/modified

---

### 2.4 Build Secondary Indexes for SessionRepository

**File**: `FileSystemSessionRepository.ts`
**Issues**: 1.5, 1.6 (MEDIUM)
**Impact**: `findByProjectId()` and `findByTaskId()` are O(n) scans

#### Changes

**Add secondary index data members**:
```typescript
private projectSessionIndex: Map<string, Set<string>> = new Map();  // projectId → Set<sessionId>
private taskSessionIndex: Map<string, Set<string>> = new Map();     // taskId → Set<sessionId>
```

**Maintain indexes**:
- On `saveAndCache()` / index update: add/update entries in secondary indexes
- On `addTask()` / `removeTask()`: update `taskSessionIndex`
- On `initialize()`: build from `sessionIndex` entries

**Modify query methods**:
- `findByProjectId()`: Use `projectSessionIndex` instead of iterating all entries
- `findByTaskId()`: Use `taskSessionIndex` instead of iterating all entries

#### Estimated LOC: ~50 lines added/modified

---

### 2.5 Build Secondary Index for TaskListRepository

**File**: `FileSystemTaskListRepository.ts`
**Issues**: 7.2, 7.3 (MEDIUM-HIGH)

#### Changes

**Add secondary indexes**:
```typescript
private projectTaskListIndex: Map<string, Set<string>> = new Map();  // projectId → Set<taskListId>
private taskToTaskListIndex: Map<string, Set<string>> = new Map();   // taskId → Set<taskListId>
```

**Maintain indexes on mutations**:
- `create()`: add to projectIndex, add each orderedTaskId to taskToTaskListIndex
- `update()`: if orderedTaskIds changed, rebuild taskToTaskListIndex entries for this taskList
- `delete()`: remove from both indexes
- `initialize()`: build both indexes

**Modify `findByProjectId()`**: Use `projectTaskListIndex`

**Modify `removeTaskReferences()`** (lines 158-174):
```typescript
// BEFORE: Iterate ALL task lists
// AFTER: Use taskToTaskListIndex to find only affected task lists
const affectedIds = this.taskToTaskListIndex.get(taskId);
if (!affectedIds?.size) return;
for (const tlId of affectedIds) {
  const tl = this.taskLists.get(tlId)!;
  tl.orderedTaskIds = tl.orderedTaskIds.filter(id => id !== taskId);
  await this.saveTaskList(tl);
}
this.taskToTaskListIndex.delete(taskId);
```

**Modify `existsByProjectId()`**: Use `projectTaskListIndex`

#### Estimated LOC: ~50 lines added/modified

---

### 2.6 Fix `delete()` Scanning in TeamMember & Team Repos

**Files**: `FileSystemTeamMemberRepository.ts`, `FileSystemTeamRepository.ts`
**Issues**: 4.5, 5.4 (HIGH)

Already addressed by the cache additions in Phase 1:
- With `memberCache` / `teamCache`, `delete()` can look up the entity's `projectId` from cache
- No need to scan all project directories
- Fallback scan only if entity not in cache (rare edge case)

No additional work needed beyond Phase 1.

---

## Phase 3: P2 — Write Optimization & Cross-Cutting

### 3.1 Atomic Writes (All Repositories)

**Issue**: Cross-cutting issue #2
**Impact**: Process crash during `fs.writeFile` corrupts the file (partial write)

#### Changes

**Create `maestro-server/src/infrastructure/repositories/utils/atomicWrite.ts`**:
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Atomic file write using write-to-temp + rename pattern.
 * rename() is atomic on POSIX systems.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmpPath, data, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Clean up tmp file on failure
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}
```

**Apply to all `save*()` methods** across all 7 repositories:
- Replace `fs.writeFile(path, data)` with `atomicWriteFile(path, data)`

#### Estimated LOC: ~20 lines utility + ~7 one-line changes across repos

---

### 3.2 Compact JSON Serialization (All Repositories)

**Issue**: Cross-cutting issue #3
**Impact**: Pretty-printed JSON adds ~30-40% file size overhead

#### Changes

**Replace across all repositories**:
```typescript
// BEFORE (every save method):
JSON.stringify(entity, null, 2)

// AFTER:
JSON.stringify(entity)
```

**Files to modify**:
- `FileSystemSessionRepository.ts` line 247
- `FileSystemTaskRepository.ts` line 100
- `FileSystemTaskListRepository.ts` line 72
- `FileSystemProjectRepository.ts` line 71
- `FileSystemTeamMemberRepository.ts` lines 355, 360, 395, 457
- `FileSystemTeamRepository.ts` line 114
- `FileSystemOrderingRepository.ts` line 74

#### Estimated LOC: ~10 one-line changes

---

### 3.3 Write Batching / Debouncing

**Issue**: Cross-cutting issue #1
**Impact**: Every mutation triggers immediate `fs.writeFile`; under high concurrency this creates I/O contention

#### Changes

**Create `maestro-server/src/infrastructure/repositories/utils/writeBatcher.ts`**:
```typescript
/**
 * Batches and debounces file writes.
 * Marks entities as dirty and flushes on a timer or explicit flush() call.
 */
export class WriteBatcher {
  private dirtyEntities: Map<string, { filePath: string; data: string }> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;

  constructor(options?: { flushIntervalMs?: number }) {
    this.flushIntervalMs = options?.flushIntervalMs ?? 500;
  }

  markDirty(entityId: string, filePath: string, data: string): void {
    this.dirtyEntities.set(entityId, { filePath, data });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const entries = Array.from(this.dirtyEntities.entries());
    this.dirtyEntities.clear();
    await Promise.allSettled(
      entries.map(([_, { filePath, data }]) => atomicWriteFile(filePath, data))
    );
  }

  async destroy(): Promise<void> {
    await this.flush();
  }
}
```

**Apply to high-write repositories**:
- `FileSystemSessionRepository` (highest write volume — events, timeline, status updates)
- `FileSystemTaskRepository` (frequent status updates from agents)

**Integration pattern**:
```typescript
// In save method:
this.writeBatcher.markDirty(entity.id, filePath, JSON.stringify(entity));

// On server shutdown:
await this.writeBatcher.flush();
```

**Important**: Reads always come from in-memory cache, so debounced writes don't affect read consistency. The cache IS the source of truth; disk is durability backup.

#### Estimated LOC: ~50 lines utility + ~20 lines per repo integration

---

### 3.4 Pagination Support

**Issue**: Cross-cutting issue #4
**Impact**: Unbounded result sets at scale

#### Changes

**Add pagination to filter types**:
```typescript
// In domain types or filter interfaces:
interface PaginationOptions {
  limit?: number;   // max results to return
  offset?: number;  // skip first N results
}
```

**Apply to**:
- `SessionFilter` → `findAll()` in SessionRepository
- `TaskFilter` → `findAll()` in TaskRepository
- `TaskListFilter` → `findAll()` in TaskListRepository
- `findByProjectId()` in all repositories that return arrays

**Implementation**:
```typescript
// After filtering, before returning:
let results = /* filtered array */;
if (options?.offset) results = results.slice(options.offset);
if (options?.limit) results = results.slice(0, options.limit);
return results;
```

**Note**: This is a low-risk change — all existing callers that don't pass pagination get the same behavior as before (full results).

#### Estimated LOC: ~15 lines per repository = ~60 total

---

### 3.5 Eliminate Redundant `mkdir` Calls

**Files**: TaskRepository (line 96), TaskListRepository (line 69), OrderingRepository (line 73)
**Issues**: 2.8, 6.2, 7.4

#### Changes

**Add to each repository**:
```typescript
private createdDirs: Set<string> = new Set();

private async ensureDir(dirPath: string): Promise<void> {
  if (this.createdDirs.has(dirPath)) return;
  await fs.mkdir(dirPath, { recursive: true });
  this.createdDirs.add(dirPath);
}
```

**Replace** `fs.mkdir(dir, { recursive: true })` with `this.ensureDir(dir)` in save methods.

#### Estimated LOC: ~10 lines per repo = ~30 total

---

### 3.6 Schema Version for Session Migration

**File**: `FileSystemSessionRepository.ts`
**Issue**: 1.9 (LOW)

#### Changes

Add `schemaVersion: number` field to Session:
```typescript
const CURRENT_SCHEMA_VERSION = 2;

// In loadSessionFromDisk():
if (session.schemaVersion === CURRENT_SCHEMA_VERSION) return session;
// ... run migrations ...
session.schemaVersion = CURRENT_SCHEMA_VERSION;
await this.saveSession(session);
```

#### Estimated LOC: ~10 lines

---

## Implementation Order & Dependencies

```
Phase 1 (P0 - Critical, do first):
  1.1 TeamMemberRepository cache  ← no dependencies
  1.2 TeamRepository cache        ← no dependencies
  1.3 TaskRepository LRU eviction ← no dependencies

Phase 2 (P1 - Scalability, do second):
  2.1 Parallel file loader utility ← no dependencies
  2.2 Parallel resolveSessionIds   ← depends on 2.1
  2.3 Task secondary indexes       ← no dependencies
  2.4 Session secondary indexes    ← no dependencies
  2.5 TaskList secondary indexes   ← no dependencies
  (2.6 already covered by 1.1/1.2)

Phase 3 (P2 - Optimization, do third):
  3.1 Atomic writes utility        ← no dependencies
  3.2 Compact JSON                 ← no dependencies (trivial)
  3.3 Write batching               ← depends on 3.1
  3.4 Pagination                   ← no dependencies
  3.5 Eliminate redundant mkdir    ← no dependencies (trivial)
  3.6 Schema version               ← no dependencies
```

---

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| TeamMember/Team cache | LOW | Cache is always consistent — updated on every mutation, invalidated on delete/reset |
| Task LRU eviction | MEDIUM | Must handle cache miss correctly (lazy-load from disk). taskProjectIndex must never be evicted |
| Parallel file reads | LOW | Using `Promise.allSettled` — individual failures don't affect others. Bounded concurrency prevents fd exhaustion |
| Secondary indexes | LOW | Indexes derived from primary data. Worst case: stale index → incorrect filter result (fixable by rebuild) |
| Atomic writes | LOW | Standard POSIX pattern. Tmp file cleanup on failure |
| Write batching | MEDIUM | Must ensure `flush()` called on shutdown. Cache is source of truth, so no data loss for reads. Risk: crash between cache update and flush → lost writes to disk |
| Compact JSON | LOW | No data loss. Files are slightly harder to manually inspect |
| Pagination | LOW | Additive change. All existing callers unaffected |

---

## Total Estimated Changes

| Phase | Files Modified | New Files | LOC Added/Modified |
|---|---|---|---|
| Phase 1 | 3 | 0 | ~210 |
| Phase 2 | 5 | 1 (parallelFileLoader.ts) | ~360 |
| Phase 3 | 7+ | 2 (atomicWrite.ts, writeBatcher.ts) | ~200 |
| **Total** | **~10** | **3** | **~770** |

---

## Testing Strategy

1. **Unit tests for new utilities**: `parallelFileLoader`, `atomicWrite`, `writeBatcher`
2. **Integration tests per repository**: Verify cache consistency after CRUD operations
3. **LRU eviction test**: Create tasks beyond MAX_CACHED_TASKS, verify eviction + lazy-load
4. **Secondary index test**: Verify indexed queries return same results as full scan
5. **Startup test**: Verify parallel init loads same data as sequential
6. **Crash recovery test**: Verify atomic writes don't corrupt files on simulated crash
