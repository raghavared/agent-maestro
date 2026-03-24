# Performance Audit: FileSystem Repository I/O

**Date:** 2026-03-09
**Scope:** All `FileSystem*Repository.ts` files + `utils/` (`parallelFileLoader.ts`, `atomicWrite.ts`, `writeBatcher.ts`)

---

## Executive Summary

The FileSystem repository layer has already undergone significant optimization (in-memory caching, secondary indexes, write batching, LRU eviction, parallel file loading). However, several remaining issues become bottlenecks at scale (200+ sessions with frequent updates). The most impactful are: **JSON.stringify on every write** (including batched), **startup I/O storm**, **no write coalescing for rapid session updates**, and **missing batching in several repositories**.

**Estimated severity:** Medium-High at 200+ sessions with active concurrent updates.

---

## 1. Architecture Overview

| Repository | Caching | Secondary Indexes | Write Strategy | LRU Eviction |
|---|---|---|---|---|
| **Session** | Active-only in-memory + lightweight index for all | project, task | WriteBatcher (500ms) | Terminal sessions evicted from memory (not index) |
| **Task** | Full in-memory (up to 5000) | project, status, parent, session | WriteBatcher (500ms) | LRU eviction of completed/cancelled (batch 500) |
| **Project** | Full in-memory | None | Direct atomicWrite | None (small dataset) |
| **TaskList** | Full in-memory | project, task→taskList | Direct atomicWrite | None |
| **Team** | Lazy per-project + cache | project→team | Direct atomicWrite | None |
| **TeamMember** | Lazy per-project + cache | project→member | Direct atomicWrite | None |
| **Ordering** | Full in-memory | None (key-based lookup) | Direct atomicWrite | None |

### Utility Layer
- **`atomicWrite.ts`** — Write-to-temp + `rename()` (POSIX atomic). Correct and minimal.
- **`parallelFileLoader.ts`** — Bounded concurrency (`Promise.allSettled` in chunks of 50). Correct.
- **`writeBatcher.ts`** — Debounce dirty entities with 500ms timer, flush with `Promise.allSettled`. Correct.

---

## 2. Findings

### 2.1 JSON.stringify Called on Every Mutation (HIGH Impact)

**Files:** `FileSystemSessionRepository.ts:367`, `FileSystemTaskRepository.ts:229`

Every call to `saveSession()` / `saveTask()` immediately calls `JSON.stringify(session)` to produce the data string, then passes it to `WriteBatcher.markDirty()`. If a session is updated 10 times in 500ms (common during active agent work — timeline events, status changes, lastActivity updates), `JSON.stringify` is called 10 times, but only the **last** serialized string is written.

```typescript
// FileSystemSessionRepository.ts:366-367
private async saveSession(session: Session): Promise<void> {
  const filePath = path.join(this.sessionsDir, `${session.id}.json`);
  this.writeBatcher.markDirty(session.id, filePath, JSON.stringify(session)); // stringify every call
}
```

**Cost:** For a session with 100+ timeline events + docs metadata, `JSON.stringify` can take 0.5–2ms per call. At 200 active sessions with frequent updates, this creates measurable CPU overhead.

**Recommendation:** Defer serialization to flush time. Store the object reference in `WriteBatcher` and serialize only when flushing. This requires `WriteBatcher` to accept `() => string` (lazy serializer) instead of `string`:

```typescript
markDirty(entityId: string, filePath: string, serialize: () => string): void {
  this.dirtyEntities.set(entityId, { filePath, serialize });
  this.scheduleFlush();
}
```

### 2.2 Startup I/O Storm — All Repos Load Simultaneously (MEDIUM-HIGH Impact)

**File:** `container.ts:188-196`

All 7 repositories initialize in parallel (`Promise.all`), each reading their directory, loading all JSON files, and parsing them. With 200+ sessions + 500+ tasks + ordering files + task lists, this means:

- ~700+ `fs.readFile` calls
- ~700+ `JSON.parse` calls
- Multiple `fs.readdir` calls (some nested for task/task-list project dirs)

All happening within the first few hundred milliseconds of server start. On spinning disk or NFS, this can take 5-10 seconds. On SSD it's still ~1-2 seconds.

**Recommendation:**
1. **Stagger initialization** — Load critical repos first (project, session) then others.
2. **Composite index file** — Write a single `_index.json` file on shutdown containing all session/task metadata. On startup, load just this file instead of N individual files. Fall back to full scan if index is missing/stale.
3. **Lazy initialization** — Team/TeamMember repos already use lazy loading per-project. Session and Task repos could defer loading terminal/completed entities until first access.

### 2.3 Session Repository: All Sessions Loaded on Init, Even Terminal (MEDIUM Impact)

**File:** `FileSystemSessionRepository.ts:299-336`

At startup, **every** session file is read and parsed, even completed/failed/stopped ones. Only active sessions are kept in the full `sessions` Map, but all are parsed to build the `sessionIndex`. With 200+ sessions where most are terminal, this means parsing ~180+ session JSONs just to extract 7 fields for the index.

```typescript
// Line 304-311: Loads ALL files
const { successes, failures } = await loadFilesParallel(
  filePaths,
  async (filePath) => {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as any;  // Full parse for index extraction
  },
  { concurrency: 50 }
);
```

**Recommendation:** Persist the lightweight `SessionIndexEntry` data in a separate `_session-index.json` file. On startup, load only this index. Full session files are loaded on-demand (already supported via `loadSessionFromDisk`). Rebuild the index if the file is missing.

### 2.4 Repositories Without WriteBatcher (MEDIUM Impact)

**Files:** `FileSystemProjectRepository.ts:81`, `FileSystemTaskListRepository.ts:129`, `FileSystemTeamRepository.ts:162,197`, `FileSystemTeamMemberRepository.ts:444,492,584`, `FileSystemOrderingRepository.ts:98`

Only Session and Task repos use `WriteBatcher`. All other repos call `atomicWriteFile` directly (synchronous-in-effect — `await` blocks the caller). For TaskList and Ordering, which can be updated in bursts (drag-and-drop reorder), this means each reorder triggers an immediate disk write.

**Recommendation:** Add `WriteBatcher` to TaskList and Ordering repos. Project/Team/TeamMember are low-frequency enough that direct writes are acceptable.

### 2.5 Task Repository: findByProjectId Misses Evicted Tasks (MEDIUM Impact)

**File:** `FileSystemTaskRepository.ts:296-306`

When tasks are evicted from the LRU cache, they're removed from secondary indexes too (`unindexTask` in line 96). So `findByProjectId` only returns cached tasks — evicted completed tasks are invisible until individually accessed by ID.

```typescript
async findByProjectId(projectId: string): Promise<Task[]> {
  const taskIds = this.projectIndex.get(projectId);
  if (!taskIds) return [];
  const tasks: Task[] = [];
  for (const id of taskIds) {
    const task = this.tasks.get(id);  // Won't find evicted tasks
    if (task) tasks.push(task);
  }
  return tasks;
}
```

**Impact:** After LRU eviction, queries like "get all tasks for project X" silently omit completed tasks. This is a **correctness bug** as well as a performance design issue.

**Recommendation:** Keep secondary indexes intact across eviction (like `taskProjectIndex` already is). On query, check if any indexed IDs are missing from cache and lazy-load them.

### 2.6 Directory Scan for Task/TaskList Initialization (MEDIUM Impact)

**Files:** `FileSystemTaskRepository.ts:119-134`, `FileSystemTaskListRepository.ts:77-89`

Task and TaskList repos use a two-level directory structure (`tasks/{projectId}/{taskId}.json`). Initialization requires:
1. `readdir(tasksDir)` to get project directories
2. For each project dir, `readdir(projectDir)` to get task files

With 20 projects, that's 21 `readdir` calls (sequential inner loop), plus the file reads.

```typescript
for (const entry of entries) {
  if (entry.isDirectory()) {
    const projectTasksDir = path.join(this.tasksDir, entry.name);
    const taskFiles = await fs.readdir(projectTasksDir);  // Sequential!
    ...
  }
}
```

**Recommendation:** Parallelize the inner `readdir` calls:
```typescript
const dirEntries = entries.filter(e => e.isDirectory());
const allFilePaths = (await Promise.all(
  dirEntries.map(async (entry) => {
    const dir = path.join(this.tasksDir, entry.name);
    const files = await fs.readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
  })
)).flat();
```

### 2.7 Team/TeamMember: Sequential File Reads in loadTeams/loadCustomMembers (LOW-MEDIUM Impact)

**Files:** `FileSystemTeamRepository.ts:87-99`, `FileSystemTeamMemberRepository.ts:336-346`

Both repos load files in a sequential `for` loop instead of using `loadFilesParallel`:

```typescript
// FileSystemTeamRepository.ts:87-99
for (const file of teamFiles) {
  try {
    const data = await fs.readFile(path.join(projectDir, file), 'utf-8');
    const team = JSON.parse(data) as Team;
    ...
```

**Recommendation:** Use `loadFilesParallel` (already available) for consistency and better throughput when a project has many teams/members.

### 2.8 Session Migration Writes During Init (LOW-MEDIUM Impact)

**File:** `FileSystemSessionRepository.ts:320-336`

During initialization, sessions needing migration are written back with `saveSessionDirect` (direct atomic write, not batched). If many sessions need migration on a fresh startup after a schema change, this creates a burst of sequential writes.

```typescript
for (const session of successes) {
  const migrated = await this.migrateSession(session);
  ...
  if (migrated) {
    await this.saveSessionDirect(session as Session); // Blocks on each write
  }
}
```

**Recommendation:** Collect migrated sessions and write them in parallel after the loop:
```typescript
const migratedSessions: Session[] = [];
for (const session of successes) { ... if (migrated) migratedSessions.push(session); }
await Promise.allSettled(migratedSessions.map(s => this.saveSessionDirect(s)));
```

### 2.9 WriteBatcher Flush Concurrency (LOW Impact)

**File:** `writeBatcher.ts:26-36`

`flush()` writes all dirty entities in parallel with `Promise.allSettled`. With 200 dirty sessions, this fires 200 concurrent `atomicWriteFile` calls (each = writeFile + rename = 400 syscalls). No concurrency limit.

**Recommendation:** Add bounded concurrency to flush, similar to `loadFilesParallel`:
```typescript
// Flush in chunks of 50
for (let i = 0; i < entries.length; i += 50) {
  await Promise.allSettled(entries.slice(i, i + 50).map(...));
}
```

### 2.10 atomicWrite Creates a Temp File Per Write (LOW Impact)

**File:** `atomicWrite.ts:9`

Each write creates a random temp file (`crypto.randomBytes(4)`). This is correct for atomicity, but `crypto.randomBytes` has minor overhead. Could use a counter or timestamp instead.

**Impact:** Negligible — `randomBytes(4)` is fast. Mentioned for completeness.

### 2.11 Session saveAndCache Always Rebuilds Index Entry (LOW Impact)

**File:** `FileSystemSessionRepository.ts:243-254`

Every `saveAndCache` call rebuilds the `SessionIndexEntry` (copies taskIds array) and updates secondary indexes, even if nothing relevant changed (e.g., only `lastActivity` was updated).

**Recommendation:** Only rebuild index entry when indexed fields change (status, projectId, taskIds, parentSessionId, rootSessionId, teamSessionId).

---

## 3. Concurrency & Data Integrity

### 3.1 No Read-Write Locking

There's no locking mechanism across repositories. If two concurrent requests update the same session:
1. Both read the session from memory (same reference)
2. Both mutate it
3. Both call `saveAndCache` → `writeBatcher.markDirty`
4. Last write wins

Since objects are shared by reference in the in-memory Map, mutations are visible to concurrent readers immediately (JavaScript is single-threaded for CPU, so this is mostly safe in Node.js). The risk is limited to edge cases with `await` points between read and write.

**Assessment:** Low risk in Node.js single-threaded model. The WriteBatcher's last-write-wins semantic is acceptable.

### 3.2 WriteBatcher: No Error Reporting

**File:** `writeBatcher.ts:33-35`

`flush()` uses `Promise.allSettled` but discards all results, including errors:
```typescript
await Promise.allSettled(
  entries.map(([_, { filePath, data }]) => atomicWriteFile(filePath, data))
);
// No error handling — silent data loss
```

**Recommendation:** Log failed writes so operators can detect disk issues.

---

## 4. Impact at Scale (200+ Sessions)

| Scenario | Bottleneck | Current Cost | After Fixes |
|---|---|---|---|
| **Server startup** | Parse all session/task JSONs | ~1-3s (500+ files) | ~100-300ms (index file) |
| **Active session update** | JSON.stringify per mutation | ~0.5-2ms × updates/sec | ~0.5-2ms × 1 (at flush) |
| **10 sessions updated in 500ms** | 10 × stringify, 1 × write | 10 × stringify overhead | 1 × stringify, 1 × write |
| **findByProjectId (tasks)** | Misses evicted tasks | Incorrect results | Correct with index fix |
| **Burst task list reorder** | Direct atomicWrite each | N disk writes | 1 batched write |

---

## 5. Recommendations Priority

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| **P0** | 2.5 — Evicted tasks invisible in queries (correctness bug) | Medium | High (data correctness) |
| **P1** | 2.1 — Lazy JSON.stringify in WriteBatcher | Low | High (CPU reduction) |
| **P1** | 2.3 — Persist session index for fast startup | Medium | High (startup time) |
| **P2** | 2.4 — Add WriteBatcher to TaskList + Ordering | Low | Medium |
| **P2** | 2.6 — Parallelize inner readdir in Task/TaskList init | Low | Medium |
| **P2** | 2.7 — Use loadFilesParallel in Team/TeamMember repos | Low | Low-Medium |
| **P3** | 2.8 — Parallelize migration writes | Low | Low-Medium |
| **P3** | 2.9 — Bounded concurrency in WriteBatcher flush | Low | Low |
| **P3** | 2.11 — Skip index rebuild for non-indexed field changes | Low | Low |
| **P3** | 3.2 — Log WriteBatcher flush errors | Low | Low (observability) |
