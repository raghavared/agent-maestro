# Worker 6: Session Service & Log Processing Performance Audit

## Scope
- `maestro-server/src/application/services/SessionService.ts`
- `maestro-server/src/application/services/LogDigestService.ts`
- `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`
- `maestro-ui/src/utils/claude-log/*` (parseJsonl, messageClassifier, groupMessages, contextTracker, toolExtraction, sessionState, teammateParser)
- `maestro-ui/src/components/session-log/SessionLogModal.tsx`
- `maestro-ui/src/components/session-log/SessionLogStrip.tsx`

---

## Part A: SessionService (maestro-server)

### Finding A1: Sequential Task Verification in createSession — O(N) serial I/O
**File:** `SessionService.ts:44-51`
**Severity:** Medium
**Description:** When creating a session with multiple taskIds, each task is verified with a separate `findById` call in a sequential `for` loop. At 200+ sessions, if sessions carry many tasks, this becomes a sequential I/O bottleneck.
```ts
for (const taskId of input.taskIds) {
  const task = await this.taskRepo.findById(taskId);
  if (!task) throw new NotFoundError('Task', taskId);
}
```
**Recommendation:** Use `Promise.all()` for parallel task verification or a bulk `findByIds()` method.

### Finding A2: Sequential Event/Task Updates in createSession — O(N) serial writes
**File:** `SessionService.ts:56-68`
**Severity:** Medium
**Description:** After creation, for each taskId, there's a sequential `addSession` + `addTimelineEvent` call (2 disk writes per task). With 5-10 tasks per session, this adds up.
**Recommendation:** Batch writes or use `Promise.all` for independent operations.

### Finding A3: Sequential Event Emission in createSession — O(N) serial emits
**File:** `SessionService.ts:74-78`
**Severity:** Low-Medium
**Description:** Event emission for `task:session_added` is sequential per task. If event handlers are async and slow, this serializes.
**Recommendation:** Emit in parallel or batch.

### Finding A4: updateSession Cascading Task Updates — O(N) serial disk I/O
**File:** `SessionService.ts:137-159`
**Severity:** High
**Description:** When a session reaches terminal status, the code iterates through ALL associated taskIds sequentially, loading each task (`findById`), updating it (`update`), re-loading it again (`findById` — **double load**), and emitting an event. For a session with 10 tasks, that's ~30 sequential I/O operations.
```ts
for (const taskId of session.taskIds) {
  const task = await this.taskRepo.findById(taskId);       // load 1
  await this.taskRepo.update(taskId, { ... });              // write
  const updatedTask = await this.taskRepo.findById(taskId); // load 2 (redundant!)
  await this.eventBus.emit('task:updated', updatedTask);    // emit
}
```
**Recommendation:**
1. `this.taskRepo.update()` likely already returns the updated task — use its return value instead of re-loading.
2. Parallelize across tasks.

### Finding A5: deleteSession Sequential Cleanup — O(N) serial I/O
**File:** `SessionService.ts:187-213`
**Severity:** Medium
**Description:** Deletion loads and verifies each task individually before removing the session association. Sequential loop with multiple I/O per iteration.
**Recommendation:** Parallelize task cleanup.

### Finding A6: addTimelineEvent Double Session Load
**File:** `SessionService.ts:315-361`
**Severity:** Low-Medium
**Description:** `addTimelineEvent` loads the session (`findById`), writes the timeline event, conditionally updates needsInput, then loads the session **again** (`findById` at line 339) to get the "fully updated session." This is 2-3 repository calls per timeline event.
**Recommendation:** The update/addTimelineEvent methods should return the updated object, eliminating the second load.

### Finding A7: Unbounded Timeline/Events Arrays
**File:** `SessionService.ts` (timeline/events arrays never pruned)
**Severity:** Medium-High (at scale)
**Description:** Session timeline events and events arrays grow unboundedly. Over a long session, these arrays can contain hundreds of entries, bloating the session JSON file that gets read/written on every update. The `FileSystemSessionRepository` serializes the entire session on every `saveAndCache`.
**Recommendation:** Cap timeline to last N entries (e.g., 200), or archive old events to a separate file.

---

## Part B: FileSystemSessionRepository

### Finding B1: Full Session Serialization on Every Write
**File:** `FileSystemSessionRepository.ts:245-248`
**Severity:** High
**Description:** Every `saveSession` call serializes the **entire** session object to JSON and writes it to disk:
```ts
await fs.writeFile(filePath, JSON.stringify(session, null, 2));
```
With pretty-printing (`null, 2`), sessions with large timelines, events, and docs arrays produce large files. At 200+ sessions with frequent updates (status changes, timeline events), this is heavy I/O. A session with 200 timeline events could be 50KB+ per write.
**Recommendation:**
1. Remove pretty-printing in production (`JSON.stringify(session)` saves ~30% file size).
2. Consider write-ahead log or append-only for timeline events.
3. Debounce/coalesce rapid writes.

### Finding B2: Initialization Loads ALL Session Files Sequentially
**File:** `FileSystemSessionRepository.ts:191-237`
**Severity:** High (at 200+ sessions)
**Description:** On startup, every session JSON file is loaded and parsed sequentially:
```ts
for (const file of sessionFiles) {
  const data = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
  const session = JSON.parse(data);
  await this.migrateSession(session);
}
```
With 200+ session files (potentially 50KB+ each), startup reads ~10MB+ of JSON sequentially. Each file also triggers migration checks that may write back to disk.
**Recommendation:**
1. Parallel file loading with `Promise.all` (batched, e.g., 20 at a time).
2. Store a lightweight index file that can be loaded once instead of reading every file.
3. Lazy-load terminal sessions only on access (partially done, but index still requires full parse).

### Finding B3: resolveSessionIds Sequential Disk Loading
**File:** `FileSystemSessionRepository.ts:173-185`
**Severity:** Medium-High
**Description:** `resolveSessionIds` loads non-cached sessions sequentially in a `for` loop. For queries like `findAll` that may match 100+ sessions, this means 100+ sequential file reads.
```ts
for (const id of ids) {
  const loaded = await this.loadSessionFromDisk(id);
  if (loaded) results.push(loaded);
}
```
**Recommendation:** Parallel loading with concurrency limit.

### Finding B4: findAll Returns Full Session Objects
**File:** `FileSystemSessionRepository.ts:344-362`
**Severity:** Medium-High
**Description:** `findAll()` filters using the lightweight index (good) but then resolves ALL matching IDs to full session objects. A `listSessions()` call from the API likely only needs summary data. Loading 200 full sessions from disk to return a list view is wasteful.
**Recommendation:** Add a `findAllSummary()` that returns index entries or lightweight summaries without loading full session JSON.

### Finding B5: No Disk Write Coalescing / Debouncing
**File:** `FileSystemSessionRepository.ts:159-167` (`saveAndCache`)
**Severity:** Medium
**Description:** Every mutation (addTask, removeTask, addEvent, addTimelineEvent, update) triggers an immediate `fs.writeFile`. During high-activity periods (e.g., coordinator receiving many worker updates), the same session file may be written multiple times per second.
**Recommendation:** Debounce writes with a short delay (100-500ms), coalescing multiple mutations into a single disk write.

### Finding B6: Linear Index Scan for Filtering
**File:** `FileSystemSessionRepository.ts:317-362` (findByProjectId, findByTaskId, findAll, etc.)
**Severity:** Low-Medium
**Description:** All query methods iterate the entire `sessionIndex` Map. At 200 sessions this is fast (linear scan of 200 entries is <1ms), but at 1000+ it could add up, especially for frequent calls.
**Recommendation:** Secondary indexes (Map<projectId, Set<sessionId>>, etc.) for O(1) lookups on common queries.

---

## Part C: LogDigestService

### Finding C1: Filesystem Scan to Resolve JSONL Path — O(files) per session
**File:** `LogDigestService.ts:168-233` (`resolveJsonlPath`)
**Severity:** High
**Description:** For each session digest request, the service scans Claude project directories and Codex session directories to find the matching JSONL file. This involves:
1. `readdir` on `~/.claude/projects/` and all subdirectories
2. For **each** JSONL file found, read 256KB of the file header to regex-match the session ID
3. If not found in Claude, recursively walk `~/.codex/sessions/` directory tree

With 50+ JSONL files across multiple project directories, each `getDigest()` call reads potentially megabytes of file headers. The 60s cache mitigates repeat calls, but first calls or cache misses are very expensive.
**Recommendation:**
1. Build a persistent session-to-file mapping that's maintained on file creation.
2. Use filename-based lookup if possible (encode session ID in filename).
3. Index JSONL files at startup rather than scanning per-request.

### Finding C2: getWorkerDigests Loads All Child Sessions First
**File:** `LogDigestService.ts:144-160`
**Severity:** Medium-High
**Description:** `getWorkerDigests` first calls `listSessions({ parentSessionId })` which loads ALL matching full session objects from disk (via B3/B4), then filters in memory, then calls `getDigest` for each. This double-loads data.
**Recommendation:** Use a lightweight query that only returns session IDs and status, not full objects.

### Finding C3: readTail Retry Loop Can Read Up to 1MB
**File:** `LogDigestService.ts:328-343`
**Severity:** Medium
**Description:** The `readTail` method starts at 100KB but doubles the window up to 1MB if no parseable lines are found. With large tool outputs in JSONL (common with Read/Bash results), a single digest call may read 1MB of file data. Across 10+ workers polled in parallel, that's 10MB+ of I/O.
**Recommendation:**
1. Start with a smaller initial window (e.g., 32KB) since we only need a few text entries.
2. Consider maintaining a file-position bookmark per session to only read new data.

### Finding C4: isCodexLog Scans Entire Lines Array Twice
**File:** `LogDigestService.ts:475-477`, `681`
**Severity:** Low-Medium
**Description:** `isCodexLog` calls `lines.some(...)` which checks every line to determine the log format. This is called at the start of `extractTextEntries` and again at the start of `detectStuck`, scanning the array twice.
**Recommendation:** Determine log type once during `readTail` or cache the result.

### Finding C5: Regex Compilation in Hot Path
**File:** `LogDigestService.ts:53`, `638-642` (`cleanText`)
**Severity:** Low-Medium
**Description:** `cleanText` is called for every text entry and uses 3 regex replacements. The regexes are constructed inline each call. While JS engines may optimize this, the `[\s\S]*?` patterns can be slow on large text blocks.
**Note:** The regexes at module level (NOISE_TAG_PATTERNS line 47-51) are properly pre-compiled. But `cleanText` creates new regex operations per call with string `.replace()`.
**Recommendation:** Pre-compile and reuse regex patterns.

### Finding C6: getDigests Parallel Execution Without Concurrency Limit
**File:** `LogDigestService.ts:135-139`
**Severity:** Medium
**Description:** `getDigests` fires all digest requests in parallel via `Promise.all`. With 20+ worker sessions, this means 20+ simultaneous file system scans, file reads, and JSON parsing operations. This can spike I/O and memory.
**Recommendation:** Use a concurrency limiter (e.g., `p-limit`) to cap parallel file reads at 5-10.

### Finding C7: Full Directory Walk for Codex Sessions
**File:** `LogDigestService.ts:275-306`
**Severity:** Medium
**Description:** `getCodexSessionFiles` does a recursive directory walk of `~/.codex/sessions/` with `readdir` + `stat` on every entry. This runs on every uncached `resolveJsonlPath` call. Old sessions accumulate over time, making this walk increasingly expensive.
**Recommendation:** Cache the file list with a TTL, or index at startup.

### Finding C8: No Caching of Parsed Text Entries
**File:** `LogDigestService.ts:87-130`
**Severity:** Medium
**Description:** Each `getDigest` call re-reads and re-parses the JSONL tail. For coordinator observation loops that poll every few seconds, the same data is re-read and re-parsed repeatedly. The path cache helps avoid the file discovery step, but the actual content parsing has no caching.
**Recommendation:** Cache parsed entries keyed by (sessionId, fileSize/mtime), invalidating when the file grows.

---

## Part D: UI Claude-Log Utilities

### Finding D1: parseJsonlText — Full Re-parse on Every Call
**File:** `parseJsonl.ts:253-278`
**Severity:** High (UI performance)
**Description:** `parseJsonlText` splits the entire text by newlines and parses every line from scratch. The UI components (SessionLogModal, SessionLogStrip) call this on the initial full load AND on every 2-second poll. While the poll only parses new content (`result.content`), the initial load parses the **entire** JSONL file, which can be 10MB+ for long sessions.
```ts
export function parseJsonlText(text: string): ParsedMessage[] {
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    // parse each line...
  }
}
```
**Recommendation:**
1. Implement incremental parsing that only processes new lines.
2. For initial load, consider streaming/chunked parsing to avoid blocking the UI thread.
3. Consider web workers for parsing large logs.

### Finding D2: allMessages State Grows Unboundedly
**File:** `SessionLogModal.tsx:165`, `SessionLogStrip.tsx:215`
**Severity:** High (memory)
**Description:** Both components accumulate ALL parsed messages in React state:
```ts
setAllMessages((prev) => [...prev, ...newMessages]);
```
Each `...prev` creates a full copy of the array. For a long session with 10,000+ messages, this means:
1. Unbounded memory growth (each ParsedMessage object carries content, toolCalls, toolResults)
2. Every poll creates a new array copying all previous messages
3. React re-renders the entire component tree on each state update
**Recommendation:**
1. Use a virtualized list — only render visible messages.
2. Cap the in-memory message count (e.g., last 2000).
3. Use mutable array with ref instead of spread copying.

### Finding D3: groupMessages O(N) on Every Render
**File:** `groupMessages.ts:18-79`, called from `useMemo` in both Modal and Strip
**Severity:** Medium-High
**Description:** `groupMessages` builds a `toolResultMap` from ALL messages (O(N) scan), then iterates ALL messages again to classify and group them (second O(N) scan). This runs inside `useMemo` which is re-computed whenever `allMessages` changes (every 2 seconds during live polling).
```ts
const toolResultMap = new Map<string, ...>();
for (const msg of messages) {
  for (const tr of msg.toolResults) {
    toolResultMap.set(tr.toolUseId, ...);
  }
}
for (const msg of messages) { ... }
```
**Recommendation:**
1. Incrementally update groups when new messages arrive (only process new messages).
2. Cache intermediate results (toolResultMap) between calls.

### Finding D4: calculateMetrics Called Per Group + Overall
**File:** `groupMessages.ts:38-39`, `parseJsonl.ts:280-319`
**Severity:** Medium
**Description:** `calculateMetrics` is called once per conversation group (inside `groupMessages`) AND once more for the overall metrics. For 100+ groups, that's 100+ iterations over subsets of messages, plus one full pass. Each call maps timestamps and iterates all messages for token counts.
**Recommendation:** Accumulate metrics incrementally during grouping rather than recalculating per group.

### Finding D5: trackContext Full Pass Over All Messages
**File:** `contextTracker.ts:32-176`
**Severity:** Medium
**Description:** `trackContext` iterates ALL messages with nested loops over content blocks. It creates multiple Maps, stringifies tool inputs (`JSON.stringify`), and estimates tokens. Called from SessionLogModal's `useMemo`, it runs on every `allMessages` change.
**Recommendation:** Incrementally update context tracking as new messages arrive.

### Finding D6: classifyMessage Regex in Hot Path
**File:** `messageClassifier.ts:13`, used in `groupMessages` for every message
**Severity:** Low
**Description:** `isTeammateMessage` uses `TEAMMATE_REGEX.test()` on every user message during classification. The regex is pre-compiled (good), but for messages with large content arrays, it tests each block.
**Recommendation:** Minor — acceptable for current scale.

### Finding D7: extractToolCalls/extractToolResults Called During Parsing AND Grouping
**File:** `parseJsonl.ts:65-66`, `toolExtraction.ts:3-36`
**Severity:** Low-Medium
**Description:** Tool calls and results are extracted during initial parsing (stored in ParsedMessage). Then in `groupMessages`, toolCalls are accessed again for linking. This is efficient — the extraction happens once during parse. However, the data is duplicated (stored both in message.content and message.toolCalls/toolResults).
**Recommendation:** Consider lazy extraction or storing only references to reduce memory.

### Finding D8: checkMessagesOngoing Full Scan
**File:** `sessionState.ts:18-81`
**Severity:** Low-Medium
**Description:** `checkMessagesOngoing` iterates ALL messages building an activities array, then searches backwards. Called on every render. For 10,000 messages this builds a large activities array.
**Recommendation:** Only scan the last N messages (e.g., 50) since "ongoing" status only depends on recent activity.

### Finding D9: teammateParser Global Regex Recreation
**File:** `teammateParser.ts:13-16`
**Severity:** Low
**Description:** `parseAllTeammateMessages` creates a new RegExp from `TEAMMATE_BLOCK_RE.source` and `.flags` on every call. This is done because `RegExp.exec` is stateful with the `g` flag.
**Recommendation:** Minor optimization — use `matchAll` instead.

### Finding D10: No Web Worker for Log Parsing
**File:** `SessionLogModal.tsx`, `SessionLogStrip.tsx`
**Severity:** Medium-High (UI responsiveness)
**Description:** All JSONL parsing, grouping, classification, and metrics computation happens on the main thread. For large log files (10MB+), the initial `parseJsonlText` call can freeze the UI for several seconds. The 2-second poll interval with growing message arrays compounds this.
**Recommendation:** Move parsing/grouping to a Web Worker. Send raw text to the worker, receive parsed messages back.

---

## Summary Table

| ID | Component | Severity | Issue |
|----|-----------|----------|-------|
| A1 | SessionService | Medium | Sequential task verification |
| A2 | SessionService | Medium | Sequential event/task writes in createSession |
| A3 | SessionService | Low-Med | Sequential event emission |
| A4 | SessionService | **High** | Cascading task updates with double-load on terminal status |
| A5 | SessionService | Medium | Sequential cleanup on delete |
| A6 | SessionService | Low-Med | Double session load in addTimelineEvent |
| A7 | SessionService | Med-High | Unbounded timeline/events arrays |
| B1 | FSSessionRepo | **High** | Full JSON serialization + pretty-print on every write |
| B2 | FSSessionRepo | **High** | Sequential initialization loading all files |
| B3 | FSSessionRepo | Med-High | Sequential disk loading in resolveSessionIds |
| B4 | FSSessionRepo | Med-High | findAll returns full session objects |
| B5 | FSSessionRepo | Medium | No write coalescing/debouncing |
| B6 | FSSessionRepo | Low-Med | Linear index scan (OK at 200, not at 1000+) |
| C1 | LogDigestService | **High** | Filesystem scan + header reads to resolve JSONL path |
| C2 | LogDigestService | Med-High | getWorkerDigests loads full session objects |
| C3 | LogDigestService | Medium | readTail retry can read up to 1MB per session |
| C4 | LogDigestService | Low-Med | isCodexLog scans array twice |
| C5 | LogDigestService | Low-Med | Regex in cleanText hot path |
| C6 | LogDigestService | Medium | Unbounded parallel I/O in getDigests |
| C7 | LogDigestService | Medium | Recursive directory walk for Codex sessions |
| C8 | LogDigestService | Medium | No caching of parsed text entries |
| D1 | parseJsonl (UI) | **High** | Full re-parse on every call, no incremental |
| D2 | SessionLog* (UI) | **High** | Unbounded allMessages growth + array copying |
| D3 | groupMessages (UI) | Med-High | O(N) grouping on every render |
| D4 | calculateMetrics (UI) | Medium | Per-group + overall recalculation |
| D5 | contextTracker (UI) | Medium | Full pass with JSON.stringify on every render |
| D6 | messageClassifier (UI) | Low | Regex in hot path (acceptable) |
| D7 | toolExtraction (UI) | Low-Med | Data duplication in parsed messages |
| D8 | sessionState (UI) | Low-Med | Full message scan for ongoing check |
| D9 | teammateParser (UI) | Low | Regex recreation |
| D10 | SessionLog* (UI) | Med-High | No Web Worker for parsing |

## Critical Path Issues (Top 5 for 200+ Sessions)

1. **C1 + C6:** LogDigestService file discovery is the biggest bottleneck. Each coordinator observation loop triggers parallel file scans across all workers, reading megabytes of file headers to find JSONL files.

2. **B1 + B5 + A7:** Every session mutation writes the entire session JSON to disk. With unbounded timeline arrays and no debouncing, high-activity sessions generate excessive I/O.

3. **B2 + B3 + B4:** Session repository initialization and queries load full session files sequentially. At 200+ sessions, startup is slow and list queries expensive.

4. **D1 + D2 + D3:** UI log viewer accumulates all messages in memory, re-parses on polls, and recomputes grouping on every render cycle. Long sessions will freeze the UI.

5. **A4:** Session terminal status propagation does 3+ I/O operations per task sequentially, with a redundant second load.
