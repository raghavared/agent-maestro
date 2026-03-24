# Performance Audit: Session Management at Scale

**Scope:** `sessionRoutes.ts` (1509 LOC), `SessionService.ts` (454 LOC), `LogDigestService.ts` (839 LOC), `FileSystemSessionRepository.ts` (667 LOC), `container.ts` (215 LOC), supporting utils.

**Focus:** Behavior with 200+ sessions, O(n) scans, log digest cost, spawn latency, concurrent ops, memory per session, cleanup/archival.

---

## 1. Repository Layer — FileSystemSessionRepository

### 1.1 Initialization: Full Scan on Startup

**File:** `FileSystemSessionRepository.ts:292-350`

On startup, `initialize()` reads **every** session JSON file from disk via `loadFilesParallel()`:

```
const files = await fs.readdir(this.sessionsDir);
const sessionFiles = files.filter(f => f.endsWith('.json'));
// ... loads ALL files with concurrency=50
```

**Impact at scale:**
- 500 sessions × ~5KB avg = 2.5MB of JSON parsed at boot
- Each session runs through `migrateSession()` which may trigger disk writes
- Migrations apply sequentially per session (await inside for-loop at line 321-336)
- **Boot time**: ~2-5s for 500 sessions (I/O bound by readdir + 500 file reads)

**Severity: MEDIUM** — Startup is one-time, but restarts during active orchestration cause downtime. Parallel file loading (concurrency=50) is a good optimization already in place.

**Recommendation:**
- Persist a lightweight index file (e.g., `sessions-index.json`) to avoid parsing every JSON on boot. Only load full sessions for active (non-terminal) entries.
- Consider lazy initialization: load the index synchronously, defer full session loads until first access.

### 1.2 In-Memory Architecture: Dual-Layer Index

The repo maintains two data structures:

| Structure | Contents | Memory |
|-----------|----------|--------|
| `sessions` (Map) | Full Session objects for **active** sessions only | ~5-10KB per active session |
| `sessionIndex` (Map) | Lightweight `SessionIndexEntry` for **all** sessions | ~200 bytes per entry |

**Strengths:**
- Terminal sessions (completed/failed/stopped) are evicted from `sessions` Map — only the lightweight index remains
- Secondary indexes (`projectSessionIndex`, `taskSessionIndex`) enable O(1) lookups for `findByProjectId` and `findByTaskId`
- 7-day pruning of stale terminal sessions from the index (line 55, runs every 30 min)

**Memory estimate at 500 sessions (50 active, 450 terminal):**
- Active sessions in memory: 50 × 8KB avg = ~400KB
- Index entries: 500 × 200B = ~100KB
- Secondary indexes: ~50KB overhead
- **Total: ~550KB** — very reasonable

**Severity: LOW** — The dual-layer design is well-optimized. Memory scales linearly but with small constants.

### 1.3 findAll() — O(n) Index Scan

**File:** `FileSystemSessionRepository.ts:461-479`

```typescript
async findAll(filter?: SessionFilter): Promise<Session[]> {
    const matchingIds: string[] = [];
    for (const [id, entry] of this.sessionIndex) {  // O(n) scan
        if (filter) {
            if (filter.projectId && entry.projectId !== filter.projectId) continue;
            if (filter.taskId && !entry.taskIds.includes(filter.taskId)) continue;
            // ...
        }
        matchingIds.push(id);
    }
    return this.resolveSessionIds(matchingIds);  // Loads terminal sessions from disk
}
```

**Issue:** When called with `parentSessionId` or `rootSessionId` or `teamSessionId` filters, there's no secondary index — falls through to full scan. These are the most common coordinator queries.

**Impact:** At 500 sessions, this is still fast (~1ms for index scan). The expensive part is `resolveSessionIds()` which lazy-loads terminal sessions from disk. If a coordinator queries children and 20 of 50 are terminal, that's 20 file reads.

**Severity: MEDIUM** — The lack of `parentSessionId` and `teamSessionId` secondary indexes causes unnecessary disk I/O for common coordinator patterns.

**Recommendation:**
- Add secondary indexes for `parentSessionId` and `teamSessionId` (same pattern as `projectSessionIndex`)
- Add `rootSessionId` index if cross-tree queries are common

### 1.4 countByStatus() — O(n) Scan

**File:** `FileSystemSessionRepository.ts:576-583`

```typescript
async countByStatus(status: SessionStatus): Promise<number> {
    let count = 0;
    for (const entry of this.sessionIndex.values()) {
        if (entry.status === status) count++;
    }
    return count;
}
```

Called from `SessionService.getRunningSessionCount()` which invokes it twice (for 'idle' and 'working'). Two O(n) scans.

**Severity: LOW** — Fast on in-memory Map. Could be replaced with a `Map<SessionStatus, number>` counter maintained on writes.

### 1.5 Write Batching

**File:** `utils/writeBatcher.ts`

The `WriteBatcher` debounces writes with a 500ms flush interval. Multiple updates to the same session within 500ms coalesce into a single disk write.

**Strengths:**
- Reduces disk I/O during rapid session updates (status changes during spawning)
- Uses atomic write (temp file + rename) for crash safety

**Concern:** The batcher stores serialized JSON strings in memory. During burst updates (e.g., 20 sessions spawning simultaneously), this could temporarily hold 20 × 8KB = 160KB of pending writes. Not a real concern.

**Severity: NONE** — Well-designed.

### 1.6 Lazy Loading from Disk

**File:** `FileSystemSessionRepository.ts:207-222, 260-286`

Terminal sessions are loaded from disk on demand via `loadSessionFromDisk()`. The `resolveSessionIds()` method batches these loads with `loadFilesParallel(concurrency: 50)`.

**Issue:** Each `findAll()` call with a broad filter may trigger many disk reads for terminal sessions. There's no LRU cache for recently-accessed terminal sessions — repeated queries for the same terminal session hit disk every time.

**Severity: MEDIUM** — For list views that show completed sessions, repeated API calls cause redundant disk reads.

**Recommendation:** Add a small LRU cache (e.g., 100 entries) for recently-loaded terminal sessions.

---

## 2. Service Layer — SessionService

### 2.1 createSession(): Sequential Task Verification

**File:** `SessionService.ts:44-51`

```typescript
if (input.taskIds && input.taskIds.length > 0) {
    for (const taskId of input.taskIds) {
        const task = await this.taskRepo.findById(taskId);  // Sequential!
        if (!task) throw new NotFoundError('Task', taskId);
    }
}
```

**Issue:** Task verification is sequential. For a session with 5 tasks, this is 5 sequential repo lookups.

**Severity: LOW** — Most sessions have 1-2 tasks. Could be parallelized with `Promise.all()` for coordinator sessions with many tasks.

### 2.2 createSession(): Sequential Event Emission

**File:** `SessionService.ts:56-78`

After creation, the service sequentially:
1. Adds session to each task (`addSession` per task)
2. Creates a timeline event per task
3. Emits `session:created` event
4. Emits `task:session_added` per task

For a session with N tasks: **2N + 1 sequential await calls** (plus disk writes for each).

**Severity: LOW-MEDIUM** — Could batch task updates and timeline events. The event emissions should be fire-and-forget or batched.

### 2.3 updateSession(): Cascading Task Updates

**File:** `SessionService.ts:137-159`

When a session reaches terminal status, the service updates `taskSessionStatuses` on every associated task:

```typescript
for (const taskId of session.taskIds) {
    const task = await this.taskRepo.findById(taskId);     // Read
    // ... check status
    await this.taskRepo.update(taskId, { ... });            // Write
    const updatedTask = await this.taskRepo.findById(taskId); // Read again
    await this.eventBus.emit('task:updated', updatedTask);  // Event
}
```

**Issue:** For each task: 2 reads + 1 write + 1 event emission = 4 async operations, all sequential. A session with 5 tasks = 20 sequential async operations.

**Severity: MEDIUM** — This runs on every session completion. For a coordinator shutting down 10 workers simultaneously, this creates 10 × (tasks per worker × 4) sequential operations.

**Recommendation:**
- Parallelize task updates with `Promise.all()`
- Eliminate the redundant second `findById()` — the update already returns the updated task (or should)
- Batch event emissions

### 2.4 addTimelineEvent(): Triple Read

**File:** `SessionService.ts:330-376`

```typescript
const session = await this.sessionRepo.findById(sessionId);  // 1st read
// ... create event
await this.sessionRepo.addTimelineEvent(sessionId, event);   // Write (reads again internally)
// ... update needsInput
const updatedSession = await this.sessionRepo.findById(sessionId); // 2nd explicit read
await this.eventBus.emit('session:updated', updatedSession);
```

**Issue:** 2-3 reads of the same session per timeline event addition. With active sessions posting timeline events every few seconds, this is wasteful.

**Severity: LOW** — The in-memory cache makes reads O(1) for active sessions, but this still triggers unnecessary Map lookups and status checks.

---

## 3. Routes Layer — sessionRoutes.ts (1509 LOC)

### 3.1 GET /sessions: N+1 Query for Team Member Enrichment

**File:** `sessionRoutes.ts:352-409`

The list endpoint performs:
1. `sessionService.listSessions(filter)` — returns all matching sessions
2. Preloads team members per project (good batching)
3. `enrichSessionWithSnapshots()` per session via `Promise.all()`

**Issue:** The `enrichSessionWithSnapshots()` function calls `teamMemberRepo.findByProjectId()` as a fallback when no map is provided (line 330-331). While the batched preload mitigates this in the list endpoint, the `GET /sessions/:id` endpoint (line 450-458) always hits the fallback path — loading ALL team members for the project just to enrich one session.

**Severity: LOW-MEDIUM** — Single session GETs are frequent (polling, detail views). Each one loads all team members for the project.

**Recommendation:** Cache team members per project with short TTL, or pass the project's member map through.

### 3.2 POST /sessions/spawn: High Latency Path

**File:** `sessionRoutes.ts:767-1308`

The spawn endpoint is the most complex handler (541 lines). Its latency profile:

| Step | Estimated Latency | Notes |
|------|-------------------|-------|
| Input validation + mode resolution | ~1ms | CPU-bound |
| Parent session lookup | ~1ms | In-memory for active sessions |
| Task verification (parallel) | ~2-10ms | `Promise.all()` — good |
| Team member fetch | ~2-5ms | `findByProjectId()` — single batch |
| Session creation | ~5-15ms | JSON serialization + batched write |
| Manifest generation via CLI | **500-5000ms** | **Subprocess spawn + CLI boot + disk I/O** |
| Session env update | ~2-5ms | |
| Event emission | ~1-2ms | |

**Total: ~550-5100ms**, dominated by manifest generation.

**Critical bottleneck:** `generateManifestViaCLI()` (line 62-204) spawns a child process (`/bin/sh -c 'ulimit ... exec maestro manifest generate ...'`) with a 60-second timeout. This is the primary latency contributor:

1. Shell initialization overhead
2. Node.js CLI boot time (loading maestro-cli package)
3. CLI reads config, resolves skills, generates manifest JSON
4. File I/O: write manifest to `~/.maestro/sessions/<id>/manifest.json`

**Severity: HIGH** — At scale, spawning 10 sessions concurrently means 10 CLI subprocesses. Each consumes ~50-100MB of memory (Node.js process), and the shell/boot overhead is unavoidable.

**Recommendations:**
- **Move manifest generation in-process**: The CLI is called just to generate a JSON manifest. This could be done as a library call within the server process, eliminating subprocess overhead entirely. Estimated savings: ~400-2000ms per spawn.
- **Pre-generate manifests**: For coordinator-spawned workers, the coordinator already knows the task/skill configuration. Pre-compute manifests in bulk.
- **Pool CLI processes**: If in-process isn't feasible, maintain a warm pool of CLI processes that accept manifest generation requests over stdin/stdout.

### 3.3 POST /sessions/:id/resume: Similar Overhead

**File:** `sessionRoutes.ts:1312-1506`

Resume also calls `generateManifestViaCLI()` for fresh manifest. Same latency concerns as spawn.

### 3.4 GET /sessions: Response Size

The list endpoint returns all matching sessions with `toSessionSummary()` stripping env/events/timeline. Good optimization. However, with 200 sessions for a project, the JSON response could still be ~100-200KB.

**Severity: LOW** — Pagination is available (`?limit=&offset=`) but not enforced. Clients fetching all sessions get the full list.

**Recommendation:** Default pagination limit (e.g., 50) with explicit opt-out for clients that need the full list.

---

## 4. LogDigestService — On-Demand JSONL Processing

### 4.1 resolveJsonlPath(): Filesystem Scan

**File:** `LogDigestService.ts:176-243`

To find a session's JSONL log file, the service:
1. Checks a path cache (60s TTL, max 500 entries)
2. **Scans ALL Claude project directories** under `~/.claude/projects/`
3. For each directory: `readdir()` → filter `.jsonl` files → read first 256KB of each file → regex match session ID
4. Falls back to scanning `~/.codex/sessions/` recursively

**Impact at scale:** With 50+ JSONL files across multiple project dirs:
- Cache miss = scan all dirs × all files × 256KB reads
- A single `getWorkerDigests()` call for a coordinator with 10 workers = 10 cache misses in parallel = 10 × (N directories × M files × 256KB) reads

**Severity: HIGH** — This is the most expensive operation in the session management stack. A coordinator polling worker digests every 5-10 seconds will saturate disk I/O.

**Key issues:**
1. **No naming convention**: JSONL files don't encode the session ID in their filename, requiring content scanning
2. **Fallback scan scans ALL project dirs**: Even with a `workingDir` hint, `getClaudeProjectsDirs()` falls back to scanning all directories (line 262-277)
3. **256KB read per file**: Reading 256KB of each JSONL just to find a session ID in the header
4. **Codex recursive walk**: `getCodexSessionFiles()` does a full recursive directory walk

**Mitigations already in place:**
- Path cache with 60s TTL (good)
- Max 500 cache entries with LRU-like eviction (good)

**Recommendations:**
- **Store JSONL path on the session object**: When a session starts, the agent knows its JSONL path. Store it in `session.metadata.jsonlPath` and skip filesystem scanning entirely.
- **Index JSONL files by session ID**: Maintain a persistent index mapping session IDs to file paths, updated by a file watcher or on session creation.
- **Reduce read window**: Instead of 256KB, use a 4KB read — session ID tags appear in the first few lines of JSONL files.
- **Skip fallback scan**: If `workingDir` is known, don't scan other project directories.

### 4.2 readTail(): Adaptive Window

**File:** `LogDigestService.ts:338-389`

Reads the last 100KB of a JSONL file, with fallback up to 1MB for files with large tool output lines. Uses `open()` + `read()` with explicit offset — avoids reading the entire file.

**Issue:** The retry loop (line 346-353) can double the read window up to 1MB if no valid parsed lines are found. For JSONL files dominated by huge tool_result blocks, this means reading 1MB of data and parsing hundreds of JSON lines.

**Severity: LOW-MEDIUM** — The 1MB cap is reasonable. But parsing happens on every digest request (no caching of parsed entries).

**Recommendation:** Cache the last N parsed entries per session with a file-size watermark (invalidate when file grows).

### 4.3 getWorkerDigests(): Cascading Queries

**File:** `LogDigestService.ts:152-168`

```typescript
async getWorkerDigests(coordinatorSessionId: string, options) {
    const sessions = await this.sessionService.listSessions({
        parentSessionId: coordinatorSessionId,  // O(n) index scan (no secondary index!)
    });
    const activeIds = sessions.filter(s => ...).map(s => s.id);
    return this.getDigests(activeIds, options);  // Parallel: N × (resolveJsonlPath + readTail + parse)
}
```

**Combined impact for a coordinator with 10 workers:**
1. `listSessions({parentSessionId})` — O(n) scan of session index + disk loads for terminal sessions
2. `getDigests(10 ids)` — 10 parallel calls, each doing:
   - `sessionService.getSession()` — 1 read
   - `projectRepo.findById()` — 1 read
   - `resolveJsonlPath()` — cache hit (fast) or filesystem scan (slow)
   - `readTail()` — 100KB-1MB file read
   - `extractTextEntries()` — JSON parse + text extraction

**Total cost per poll:** ~10-50ms cached, **200-2000ms on cache miss**

**Severity: HIGH** — This is called frequently by coordinators monitoring workers.

### 4.4 isCodexLog(): Redundant Scan

**File:** `LogDigestService.ts:485-509`

`isCodexLog()` is called in both `extractTextEntries()` and `detectStuck()`, scanning the parsed lines array twice to determine the log format.

**Severity: NEGLIGIBLE** — `Array.some()` is fast and short-circuits.

---

## 5. Concurrent Session Operations

### 5.1 Race Conditions in Session Updates

**File:** `FileSystemSessionRepository.ts:490-526`

The `update()` method follows a read-modify-write pattern:
```typescript
const session = await this.getSessionOrThrow(id);
// ... apply updates to session object
await this.saveAndCache(session);
```

**Issue:** No locking. Two concurrent updates to the same session (e.g., status update from agent + timeline event from coordinator) can cause lost updates. The last writer wins.

**Mitigations:**
- The `WriteBatcher` coalesces writes, so rapid sequential updates only produce one disk write
- Active sessions are cached in memory, so reads are consistent within a single Node.js event loop turn

**Severity: LOW-MEDIUM** — Node.js single-threaded nature prevents true concurrent access within one process. But interleaved async operations can still race:
```
Update A reads session → Update B reads session → Update A writes → Update B writes (overwrites A's changes)
```

### 5.2 Burst Spawning

When a coordinator spawns 10 workers simultaneously:
1. 10 session creates (parallelized in coordinator)
2. 10 manifest generation subprocesses (each ~50-100MB memory)
3. 10 session env updates
4. 10 `session:spawn` events

**Memory impact:** 10 CLI processes × 80MB = ~800MB temporary memory spike
**CPU impact:** 10 processes competing for CPU during Node.js boot
**Disk impact:** 10 manifest writes + 10 session JSON writes (batched)

**Severity: HIGH** — The subprocess-based manifest generation is the primary bottleneck for concurrent spawning. This is a hard limit on parallel spawn throughput.

---

## 6. Memory Per Session

| Component | Active Session | Terminal Session (indexed) | Terminal Session (pruned) |
|-----------|---------------|--------------------------|--------------------------|
| Full Session object | ~5-10KB | 0 (evicted) | 0 |
| SessionIndexEntry | ~200B | ~200B | 0 |
| Secondary index refs | ~100B | ~100B | 0 |
| WriteBatcher pending | 0-10KB (burst) | 0 | 0 |
| LogDigest path cache | ~100B | ~100B | 0 |
| **Total** | **~5.5-10.5KB** | **~400B** | **0** |

**At 50 active + 450 terminal sessions:** ~575KB total. Very efficient.

**At 200 active + 800 terminal sessions:** ~2.3MB total. Still fine.

---

## 7. Cleanup and Archival

### 7.1 Index Pruning

**File:** `FileSystemSessionRepository.ts:123-136`

Terminal sessions older than 7 days are pruned from the in-memory index every 30 minutes. Data remains on disk.

**Issue:** Pruned sessions are invisible to `findAll()` — they won't appear in any query results. There's no way to access archived sessions without direct file access.

**Severity: LOW** — By design. But could surprise users looking for old session history.

### 7.2 No Disk Cleanup

There is no mechanism to delete old session JSON files from disk. Over months of use, the `sessions/` directory will accumulate thousands of files.

**Impact:**
- `readdir()` during initialization becomes slower
- Filesystem inode exhaustion on some systems (ext4 default: ~millions, so unlikely)

**Severity: LOW** — Disk space is cheap, and the index pruning prevents memory growth. But initialization time grows linearly.

**Recommendation:** Add optional disk archival (compress + move old sessions to `sessions/archive/`) or a retention policy.

---

## 8. Container Initialization

**File:** `container.ts:184-202`

All repositories initialize in parallel:
```typescript
await Promise.all([
    projectRepo.initialize(),
    taskRepo.initialize(),
    taskListRepo.initialize(),
    sessionRepo.initialize(),  // The slowest — reads all session files
    orderingRepo.initialize(),
    teamMemberRepo.initialize(),
    teamRepo.initialize(),
]);
```

**Good:** Parallel initialization. Container boot time is bounded by the slowest repository (sessions).

**Issue:** The post-init migration (`migrateTeamMemberTasks`) runs sequentially after all repos initialize. It scans all tasks — O(n) for number of tasks.

**Severity: LOW** — Migration is idempotent and uses a sentinel file to skip on subsequent boots.

---

## 9. WebSocket Event Propagation

### 9.1 Session Update Throttling

**File:** `WebSocketBridge.ts:56-60`

```typescript
'session:updated': 500,          // Max 2/sec per session
'session:status_changed': 500,
'task:updated': 300,
'notify:progress': 1000,
```

**Good:** Per-entity throttling prevents flooding clients with rapid session updates. Batching (50ms window) further reduces message count.

### 9.2 Full Session Object in Events

`session:updated` events emit the **entire session object**. For a session with a large timeline (100+ events), this can be 10-50KB per WebSocket message.

The `session:status_changed` lightweight event only sends `{id, status, lastActivity, needsInput}` — much better.

**Severity: LOW-MEDIUM** — The throttling limits frequency, but the payload size for `session:updated` is still large. Most consumers only need the status change.

**Recommendation:** Emit `session:status_changed` for most updates. Reserve `session:updated` for structural changes. (This is already partially done in `SessionService.updateSession()` lines 162-176.)

---

## 10. Summary of Findings

| # | Finding | Severity | Impact Area |
|---|---------|----------|-------------|
| 1 | `generateManifestViaCLI()` subprocess overhead: 500-5000ms per spawn | **HIGH** | Spawn latency, concurrent spawning, memory |
| 2 | `resolveJsonlPath()` filesystem scan on cache miss: scans all project dirs | **HIGH** | Log digest latency, disk I/O |
| 3 | `getWorkerDigests()` cascading cost: O(n) index scan + N parallel digest fetches | **HIGH** | Coordinator polling latency |
| 4 | No secondary index for `parentSessionId` / `teamSessionId` | **MEDIUM** | `findAll()` with common filters |
| 5 | `updateSession()` cascading task updates: sequential reads/writes per task | **MEDIUM** | Session completion latency |
| 6 | No LRU cache for terminal sessions loaded from disk | **MEDIUM** | Repeated list queries |
| 7 | Single-session GET enrichment loads all project team members | **LOW-MEDIUM** | API response latency |
| 8 | `session:updated` events emit full session objects | **LOW-MEDIUM** | WebSocket bandwidth |
| 9 | No disk cleanup for old session files | **LOW** | Long-term disk usage, init time |
| 10 | `countByStatus()` O(n) double scan | **LOW** | Minor CPU |

### Top 3 Recommendations

1. **Move manifest generation in-process** — Eliminate CLI subprocess by calling manifest generation as a library function. Saves ~400-2000ms per spawn and eliminates memory spikes from concurrent CLI processes.

2. **Store JSONL path on session metadata** — When agent writes its JSONL path to the session, `LogDigestService` can skip filesystem scanning entirely. Reduces digest latency from 200-2000ms to ~10-50ms.

3. **Add `parentSessionId` secondary index** — Most coordinator queries filter by parent. An O(1) index lookup replaces O(n) scan + disk loads. Pattern already exists for `projectSessionIndex`.
