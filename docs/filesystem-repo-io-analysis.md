# FileSystem Repository I/O Performance Analysis

**Scope**: All 7 FileSystem repositories in `maestro-server/src/infrastructure/repositories/`
**Focus**: I/O bottlenecks at scale, missing caching, linear scans, serialization overhead

---

## Summary of Critical Findings

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 8 | No caching / all data read from disk on every access |
| HIGH | 11 | Sequential I/O during initialization / linear scans |
| MEDIUM | 10 | No write batching / excessive serialization / no pagination |
| LOW | 7 | Pretty-printed JSON / redundant mkdir / no file locking |

---

## 1. FileSystemSessionRepository

**File**: `FileSystemSessionRepository.ts` (551 lines)

**Already Implemented Well:**
- In-memory cache for active sessions (`Map<string, Session>`)
- Lightweight `SessionIndexEntry` for fast filtering without full object load
- Terminal session eviction (completed/failed/stopped not kept in memory)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 1.1 | 204-229 | HIGH | **Sequential file reads on `initialize()`** — sessions loaded one-by-one in a `for` loop. With 1000+ sessions, startup is extremely slow (1 disk I/O per file, serially). | Batch reads with `Promise.all()` (e.g., chunks of 50). Use `Promise.allSettled` to handle individual failures. |
| 1.2 | 173-185 | HIGH | **Sequential disk loads in `resolveSessionIds()`** — terminal sessions lazy-loaded one at a time. A query matching 100 terminal sessions = 100 sequential file reads. | Use `Promise.all()` to load all matching IDs in parallel. |
| 1.3 | 159-167 | MEDIUM | **Full disk write on every mutation via `saveAndCache()`** — every `update()`, `addEvent()`, `addTimelineEvent()`, `addDoc()` triggers full JSON serialize + `fs.writeFile`. No debouncing or batching. | Implement write debouncing: queue dirty sessions and flush every N ms or on explicit `flush()`. |
| 1.4 | 245-248 | MEDIUM | **Full session re-serialization on every save** — the entire session (including potentially large `events[]` and `timeline[]` arrays) is `JSON.stringify`'d and rewritten even for single-field changes. | Consider append-only event log for events/timeline, or delta writes. |
| 1.5 | 326-332 | MEDIUM | **O(n) scan with nested O(m) for `findByTaskId()`** — iterates all index entries, each calling `entry.taskIds.includes(taskId)`. No reverse index `taskId → sessionId[]`. | Build secondary index: `Map<taskId, Set<sessionId>>` maintained on index updates. |
| 1.6 | 317-323 | LOW | **O(n) scan for `findByProjectId()`** — linear scan through all index entries. | Build secondary index: `Map<projectId, Set<sessionId>>`. |
| 1.7 | 344-362 | MEDIUM | **No pagination on `findAll()`** — returns all matching sessions. At scale, this is unbounded memory. | Add `limit`/`offset` to `SessionFilter` and apply before `resolveSessionIds()`. |
| 1.8 | 245-248 | LOW | **Pretty-printed JSON** — `JSON.stringify(session, null, 2)` adds ~30-40% size overhead. | Use compact `JSON.stringify(session)` for production; pretty-print only in debug mode. |
| 1.9 | 123-137 | LOW | **Migration runs on every disk load** — `migrateSession()` called each time `loadSessionFromDisk()` is invoked, even if already migrated. | Add a `schemaVersion` field; skip migration if at current version. |
| 1.10 | N/A | LOW | **No file locking** — concurrent `fs.writeFile` calls to same path can corrupt. | Use write-rename pattern (`writeFile` to `.tmp`, then `rename`) for atomic writes. |

---

## 2. FileSystemTaskRepository

**File**: `FileSystemTaskRepository.ts` (299 lines)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 2.1 | 37-52 | HIGH | **Sequential nested file reads on `initialize()`** — reads directories, then reads files in each directory one-by-one. Doubly serial. | Collect all file paths first, then `Promise.all()` in batches. |
| 2.2 | 15 | HIGH | **ALL tasks kept in memory with no eviction** — `Map<string, Task>` holds every task ever created. With thousands of tasks across projects, this is an unbounded memory leak. | Implement LRU eviction for completed tasks (similar to session terminal eviction). Keep only active/recent tasks in memory, lazy-load completed from disk. |
| 2.3 | 153-155 | MEDIUM | **O(n) filter for `findByProjectId()`** — `Array.from(this.tasks.values()).filter(...)` copies entire Map to array, then filters. | Build secondary index: `Map<projectId, Set<taskId>>`. |
| 2.4 | 158-161 | MEDIUM | **O(n) filter for `findByStatus()`** — same full-copy + filter pattern. | Build secondary index: `Map<status, Set<taskId>>`. |
| 2.5 | 163-166 | MEDIUM | **O(n) filter for `findByParentId()`** — same pattern. | Build secondary index: `Map<parentId, Set<taskId>>`. |
| 2.6 | 168-171 | HIGH | **O(n) scan with nested O(m) for `findBySessionId()`** — iterates all tasks, calling `.includes(sessionId)` on each task's `sessionIds` array. | Build reverse index: `Map<sessionId, Set<taskId>>`. |
| 2.7 | 173-193 | MEDIUM | **`findAll()` creates intermediate arrays** — chained `.filter()` calls create a new array for each filter condition applied. | Use single-pass filtering with combined predicate, or use indexed lookups to pre-narrow. |
| 2.8 | 96-101 | LOW | **`saveTask()` calls `mkdir` on every save** — `fs.mkdir(projectTasksDir, { recursive: true })` called on every single task save, even if directory already exists. | Track created directories in a `Set<string>`; skip mkdir if already created. |
| 2.9 | 100 | LOW | **Pretty-printed JSON** — same overhead as sessions. | Use compact JSON. |
| 2.10 | 290-293 | LOW | **`existsByProjectId()` creates full array copy** — `Array.from(this.tasks.values()).some(...)`. | Iterate Map directly with `for...of` + early return, or use secondary index. |
| 2.11 | N/A | MEDIUM | **No pagination** — all find methods return unbounded results. | Add `limit`/`offset` to `TaskFilter`. |
| 2.12 | N/A | LOW | **No write batching** — every update writes immediately to disk. | Debounce writes similar to session repo recommendation. |

---

## 3. FileSystemProjectRepository

**File**: `FileSystemProjectRepository.ts` (167 lines)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 3.1 | 45-53 | LOW | **Sequential file reads on `initialize()`** — same serial read pattern. Lower severity because projects are typically few (< 100). | Parallel reads with `Promise.all()`. |
| 3.2 | 71 | LOW | **Pretty-printed JSON**. | Compact JSON. |
| 3.3 | N/A | LOW | **No file locking** — lower risk given low write frequency. | Atomic write pattern. |

*Note: This repo is relatively well-designed for its scale. Projects are few and always cached.*

---

## 4. FileSystemTeamMemberRepository

**File**: `FileSystemTeamMemberRepository.ts` (477 lines)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 4.1 | 183 | **CRITICAL** | **No in-memory cache at all** — unlike every other repository, this has ZERO caching. Every single `findById()` and `findByProjectId()` goes straight to disk. | Add `Map<string, TeamMember>` cache, populated on first access per project. |
| 4.2 | 282-312 | **CRITICAL** | **`loadCustomMembers()` does full directory scan + file reads every call** — every call to `findByProjectId()` triggers `fs.readdir()` + `fs.readFile()` for ALL custom member files. | Cache loaded members per project. Invalidate on create/update/delete. |
| 4.3 | 241-277 | HIGH | **`createDefaultTeamMember()` reads override file from disk every time** — 5 defaults × disk read per override = up to 5 file reads per `findByProjectId()` call, even for the same project. | Cache override data in memory; invalidate on `saveDefaultOverride()`. |
| 4.4 | 334-347 | HIGH | **`findByProjectId()` is extremely expensive** — combines issues 4.1, 4.2, and 4.3: 5 default constructions (each potentially hitting disk) + full directory scan + all custom files read. Called frequently from APIs. | Single cache lookup after first load. |
| 4.5 | 403-431 | HIGH | **`delete()` scans ALL project directories** — `fs.readdir(this.teamMembersDir)` then iterates every project, calling `findById()` for each (which itself hits disk!). O(projects × files). | Accept `projectId` parameter to avoid scanning. Or maintain a global `id → projectId` index. |
| 4.6 | 314-332 | MEDIUM | **`findById()` loops through 5 default types before disk** — minor, but adds up on hot paths. | Use a Set or prefix check instead of loop. |
| 4.7 | 360 | LOW | **Pretty-printed JSON**. | Compact JSON. |

---

## 5. FileSystemTeamRepository

**File**: `FileSystemTeamRepository.ts` (171 lines)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 5.1 | 17-27 | **CRITICAL** | **No in-memory cache** — same as TeamMemberRepository. Every access reads from disk. | Add `Map<string, Team>` cache. |
| 5.2 | 61-88 | **CRITICAL** | **`loadTeams()` reads all files from disk every time** — `findByProjectId()` triggers full directory scan + file reads with no caching. | Cache teams per project after first load. |
| 5.3 | 90-99 | HIGH | **`findById()` reads from disk every time** — no cache check, goes straight to `fs.readFile`. | Check cache first, lazy-load from disk on miss. |
| 5.4 | 148-170 | HIGH | **`delete()` scans ALL project directories** — `fs.readdir(this.teamsDir)` + iterates each project. Same pattern as TeamMemberRepository. | Accept `projectId` parameter or maintain global index. |
| 5.5 | 114 | LOW | **Pretty-printed JSON**. | Compact JSON. |
| 5.6 | N/A | LOW | **No file locking**. | Atomic write pattern. |

---

## 6. FileSystemOrderingRepository

**File**: `FileSystemOrderingRepository.ts` (91 lines)

**Already Implemented Well:**
- Has `Map` cache
- `findByProjectAndType()` is O(1) from cache
- All orderings loaded into cache on initialize

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 6.1 | 39-55 | LOW | **Sequential file reads on `initialize()`** — same serial pattern, but ordering files are typically few. | Parallel reads with `Promise.all()`. |
| 6.2 | 73 | LOW | **`mkdir` on every `save()`** — redundant after first call. | Track created dirs. |
| 6.3 | 74 | LOW | **Pretty-printed JSON**. | Compact JSON. |

*Note: This is the best-designed repository. Cache is properly maintained.*

---

## 7. FileSystemTaskListRepository

**File**: `FileSystemTaskListRepository.ts` (185 lines)

### Issues

| # | Line(s) | Severity | Issue | Fix |
|---|---------|----------|-------|-----|
| 7.1 | 33-49 | MEDIUM | **Sequential file reads on `initialize()`** — serial directory traversal + file reads. | Parallel reads with `Promise.all()`. |
| 7.2 | 109-111 | MEDIUM | **O(n) filter for `findByProjectId()`** — `Array.from(this.taskLists.values()).filter(...)`. | Build secondary index: `Map<projectId, Set<taskListId>>`. |
| 7.3 | 158-174 | HIGH | **`removeTaskReferences()` scans ALL task lists + writes each** — iterates every task list, checks for taskId inclusion, writes to disk for each match. No reverse index. | Build reverse index: `Map<taskId, Set<taskListId>>`. |
| 7.4 | 69-72 | LOW | **`saveTaskList()` calls mkdir on every save**. | Track created dirs. |
| 7.5 | 72 | LOW | **Pretty-printed JSON**. | Compact JSON. |
| 7.6 | 176-179 | LOW | **`existsByProjectId()` creates full array copy**. | Iterate Map directly or use secondary index. |
| 7.7 | N/A | MEDIUM | **No pagination** — all find methods return unbounded results. | Add `limit`/`offset` to `TaskListFilter`. |

---

## Cross-Cutting Issues

### 1. No Write Batching (ALL repositories)
Every mutation triggers an immediate `fs.writeFile`. Under high concurrency (e.g., 10 agents updating sessions simultaneously), this creates:
- Disk I/O contention
- Potential data loss if process crashes mid-write
- Unnecessary overhead for rapid successive updates

**Fix**: Implement a `DirtyTracker` that marks entities as dirty and flushes to disk on a timer (e.g., every 500ms) or on explicit `flush()` call.

### 2. No Atomic Writes (ALL repositories)
All repos use `fs.writeFile()` directly. If the process crashes during a write, the file is corrupted (partial write).

**Fix**: Write to `${filename}.tmp`, then `fs.rename()` to `${filename}`. `rename()` is atomic on POSIX systems.

### 3. Pretty-Printed JSON Everywhere (ALL repositories)
All repos use `JSON.stringify(obj, null, 2)`. For a session with 500 events, this adds significant size.

**Fix**: Use compact `JSON.stringify(obj)` for production. Pretty-print only for debug/export.

### 4. No Pagination (5/7 repositories)
Only OrderingRepository (single-result) and ProjectRepository (typically few items) are acceptable without pagination. All others return unbounded results.

**Fix**: Add `{ limit?: number; offset?: number }` to all filter types.

### 5. Sequential Initialization (ALL repositories)
Every repository reads files one-by-one during `initialize()`. Server startup time scales linearly with data volume.

**Fix**: Parallel file reads with bounded concurrency (e.g., `p-limit` or manual batching with `Promise.all()`).

---

## Priority Recommendations

### P0 — Fix Immediately (prevents production issues)
1. **Add caching to TeamMemberRepository** (4.1, 4.2, 4.3, 4.4) — every API call triggers disk reads
2. **Add caching to TeamRepository** (5.1, 5.2, 5.3) — same disk-on-every-access problem
3. **Add task eviction to TaskRepository** (2.2) — unbounded memory growth

### P1 — Fix Soon (improves scalability)
4. **Parallel file reads on initialize** (1.1, 2.1, 7.1) — slow server startup
5. **Parallel resolveSessionIds** (1.2) — slow queries for terminal sessions
6. **Secondary indexes for TaskRepository** (2.3-2.6) — O(n) lookups on hot paths
7. **Fix delete() scanning in TeamMember/Team repos** (4.5, 5.4) — O(projects) scan

### P2 — Improve Later (optimization)
8. **Write batching/debouncing** — reduce disk I/O under concurrency
9. **Atomic writes** — prevent corruption on crash
10. **Pagination support** — prevent unbounded memory on large result sets
11. **Compact JSON serialization** — reduce file sizes and write times
12. **Secondary indexes for SessionRepository** (1.5, 1.6) — optimize filtered queries
