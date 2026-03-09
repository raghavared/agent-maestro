# Consolidated Performance Audit — Agent Maestro
**Date:** 2026-03-09
**Workers:** 10 parallel analysis agents
**Target:** Optimize for 200+ concurrent sessions

---

## Executive Summary

10 parallel workers analyzed every code path across maestro-ui, maestro-server, and maestro-cli. **150+ performance issues** were identified across 10 categories. The most critical findings fall into 5 themes:

1. **WebSocket broadcast storms** — Every event triggers immediate serialization + fan-out to all clients with full entity payloads, no batching, no throttling, no diffing
2. **Zustand Map cloning** — 57 occurrences of `new Map()` copies on every WebSocket message, triggering cascading React re-renders
3. **Zero virtualization** — No list virtualization library installed; 200+ sessions/tasks render all DOM nodes
4. **FileSystem I/O bottlenecks** — Two repositories have ZERO caching (every access hits disk), sequential file reads on startup, no write batching
5. **Memory leaks** — Unbounded session indexes, event listener accumulation, child processes without cleanup

---

## All Findings by Category

### 1. UI Re-render Analysis (Worker 1) — 34 Issues

**CRITICAL:**
- `SessionsSection` — Not wrapped in `React.memo`, massive inline `renderSessionItem` function recreated every render (lines 113, 365-644)
- `MaestroPanel` — 12+ handler functions not `useCallback`'d, `renderTaskNode` recreated every render (lines 245-360, 402)
- `TaskListItem` — No `React.memo`, direct Zustand store subscriptions per list item (line 102)

**HIGH:**
- `UnifiedKanbanView` — Inline onClick/onWorkOn/projectBadge per TaskCard defeats memo (lines 546-552)
- `ProjectKanbanRow` — Same inline function pattern (lines 140-141)
- `KanbanColumn` — Same pattern (lines 95-97)
- 9+ inline arrow function closures in MaestroPanel.renderTaskNode (lines 412-427)

**MEDIUM:**
- `MaestroSessionContent` not memoized (line 127)
- `SortableTaskItem`/`SortableSessionItem` not memoized
- `TaskStatusControl` not memoized (line 42)
- `SortableContext` items arrays not memoized
- `AGENT_TOOL_ICONS` constant defined inside component body
- `activeRoots`/`completedRoots`/`pinnedRoots` computed without `useMemo`

**Quick Wins:**
1. Add `React.memo` to 7+ components
2. Move static constants to module scope
3. Wrap handlers in `useCallback`
4. Extract `SessionItem` and `TaskNodeRenderer` as memoized components

---

### 2. Zustand Store Performance (Worker 2) — 19 Issues

**CRITICAL:**
- **57 `new Map()` clones** in `useMaestroStore` — every WebSocket event copies entire Map to update 1 entry (lines 192, 198, 204, etc.)
- `markAgentWorkingFromOutput` called on every PTY output chunk, replacing entire sessions array even when nothing changes (useSessionStore)
- `persistence.ts` subscribes to 7 stores including session store — every terminal output chunk triggers persistence build
- Sessions stored as flat array — O(n) lookups, O(n) copies on every update

**HIGH:**
- Monolithic `useMaestroStore` with 18+ state fields
- 16+ components subscribe to entire Maps (tasks, sessions, teamMembers)
- Zero `useShallow` usage across 11+ files with multiple selectors
- `useProjectStore` mixes persistent data with transient dialog state
- `useUIStore` has 40+ fields in one store

**MEDIUM:**
- No WebSocket message batching in store handler
- `getSpacesByProject` creates new array every call
- `getReplayFlow` not memoized
- `lastUsedTeamMember` does synchronous localStorage write inside state updater
- `buildPersistedState()` creates expensive copies every 400ms

**Priority Fixes:**
1. Guard `markAgentWorkingFromOutput` (prevent no-op updates)
2. Replace `new Map()` pattern with Immer or Records
3. Filter persistence triggers for transient state
4. Add `useShallow` to multi-selector components

---

### 3. WebSocket & Real-time Pipeline (Worker 3) — 16 Issues

**CRITICAL/HIGH:**
- **No message batching** — every domain event triggers separate `JSON.stringify` + send (WebSocketBridge:120-124)
- **Full entity payloads** on every update — Session objects are 5-50KB with unbounded events/timeline arrays
- **No throttling** on high-frequency `session:updated` events — 200 sessions = 200+ updates/sec
- **No backpressure handling** — `client.send()` is fire-and-forget, no `bufferedAmount` check
- **Client-side no state diffing** — every update creates new Map reference (see Worker 2)

**MEDIUM:**
- Duplicate WebSocket singleton implementations (useMaestroWebSocket.ts AND useMaestroStore.ts)
- REST refetch on every relationship event (task:session_added, etc.) without debounce
- Full data refetch on reconnect (thundering herd with multiple clients)
- `InMemoryEventBus.emit()` blocks until WebSocket broadcast completes
- No WebSocket connection limit
- Subscription filter bypasses non-session events entirely
- Memory leak in `globalListeners` Set

**Priority Fixes:**
1. Implement 50ms message batching queue
2. Add per-entity throttling (session:updated max 2/sec)
3. Add backpressure check (`bufferedAmount > 1MB → skip`)
4. Send lightweight status events instead of full entities
5. Consolidate WebSocket singletons

---

### 4. FileSystem Repository I/O (Worker 4) — 36 Issues

**CRITICAL:**
- **TeamMemberRepository has ZERO caching** — every `findById()` and `findByProjectId()` hits disk, including full directory scan + file reads (FileSystemTeamMemberRepository:183, 282-312)
- **TeamRepository has ZERO caching** — same issue (FileSystemTeamRepository:17-27, 61-88)
- **TaskRepository keeps ALL tasks in memory with no eviction** — unbounded memory growth (FileSystemTaskRepository:15)

**HIGH:**
- Sequential file reads on startup for all repositories (200+ session files read serially)
- Sequential `resolveSessionIds` for terminal sessions (100+ serial file reads)
- `findBySessionId` does O(n) scan with nested O(m) — no reverse index
- `delete()` in TeamMember/Team repos scans ALL project directories
- `removeTaskReferences` in TaskListRepository scans ALL task lists

**MEDIUM:**
- No write batching — every mutation triggers immediate `fs.writeFile`
- O(n) filters for `findByProjectId`, `findByStatus`, `findByParentId`
- No pagination on any find method
- Full session serialization on every save (pretty-printed JSON)
- No atomic writes (crash during write = corruption)

**Priority Fixes:**
1. Add in-memory cache to TeamMemberRepository and TeamRepository
2. Add LRU eviction to TaskRepository
3. Parallelize file reads on startup (`Promise.all` in batches)
4. Build secondary indexes (projectId → entityIds, taskId → sessionIds)

---

### 5. API Route Handlers (Worker 5) — 22 Issues

**CRITICAL:**
- **N+1 in GET /tasks/:id/docs** — sequential session doc fetching (taskRoutes:123-150)
- **N+1 in enrichSessionWithSnapshots** — sequential team member lookups × all sessions (sessionRoutes:274-299)
- **Spawn handler fetches tasks TWICE** — verification loop (line 852) + reference collection (line 1073) re-read same tasks
- **Spawn handler re-fetches team members individually** after already fetching all project members

**HIGH:**
- No pagination on ANY list endpoint (12 endpoints)
- Full session objects returned in list views (including env vars, events, timeline)

**MEDIUM:**
- No cache headers on any response (except task images)
- No response compression middleware
- No request deduplication on spawn/resume
- Master auth middleware does DB lookup on every request
- Sequential session lookups that could be parallelized

**Priority Fixes:**
1. Reuse already-fetched data in spawn handler (zero-cost fix)
2. Parallelize session/team-member lookups with `Promise.all`
3. Add pagination to all list endpoints
4. Add cache headers to stable endpoints (skills, workflow-templates)

---

### 6. Session Service & Log Processing (Worker 6) — 28 Issues

**Server-side CRITICAL:**
- `LogDigestService` scans filesystem + reads 256KB file headers to find JSONL files per session
- `SessionService.updateSession` does 3+ sequential I/O ops per task with redundant double-load
- Full session JSON serialization + pretty-print on every write
- Sequential startup loading of all session files

**UI-side CRITICAL:**
- `parseJsonlText` re-parses entire JSONL file from scratch (no incremental parsing)
- `allMessages` state grows unboundedly with `[...prev, ...newMessages]` copy on every 2-second poll
- All parsing/grouping runs on main thread (no Web Worker)

**HIGH:**
- `groupMessages` does O(N) on every render cycle
- `trackContext` does full pass with `JSON.stringify` on every message change
- No caching of parsed log entries
- Session timeline arrays grow unbounded

**Priority Fixes:**
1. Build persistent session-to-JSONL-file mapping
2. Implement incremental log parsing
3. Move log parsing to Web Worker
4. Cap in-memory message count and use virtualized list
5. Remove pretty-print from production writes

---

### 7. UI List Virtualization & DOM (Worker 7) — 17 Issues

**CRITICAL:**
- **No virtualization library installed** (no react-window, react-virtuoso, @tanstack/react-virtual)
- SessionsSection renders all sessions: 200 sessions = 3000-5000 DOM nodes
- SortableTaskList renders all tasks with dnd-kit overhead per item
- MultiProjectBoard renders all tasks in all columns: 500 tasks = 5000-7500 DOM nodes
- MermaidDiagram calls `mermaid.initialize()` + `getComputedStyle()` on EVERY render

**HIGH:**
- No CSS `contain` or `content-visibility` on any list container
- Dashboard renders all charts simultaneously without lazy loading
- DOM reparenting in MultiProjectSessionsView causes forced reflows

**MEDIUM:**
- Multiple `.filter()` passes over same arrays (could be single-pass)
- Layout thrashing from `getBoundingClientRect` in `useLayoutEffect`
- Inline SVGs duplicated per item instead of using sprite sheets

**Priority Fixes:**
1. Install @tanstack/react-virtual and virtualize SessionsSection, SortableTaskList, kanban columns
2. Initialize mermaid once, cache SVG output by chart string
3. Add CSS `contain: content` to all scrollable list containers
4. Add `content-visibility: auto` for off-screen items
5. Lazy-load Dashboard charts

---

### 8. CLI Performance & Process Spawning (Worker 8) — 15 Issues

**HIGH:**
- **Triple manifest normalization** — `normalizeManifest()` with `JSON.parse(JSON.stringify())` called 3x per spawn
- **Sequential API calls in worker-init** — `1 + 2*N` sequential HTTP requests for status updates (5 tasks = ~110ms)
- **Session spawn makes 3-5+ sequential HTTP round-trips**

**MEDIUM:**
- Skill loader does full filesystem discovery on every spawn
- No compiled prompt caching
- `config.apiUrl` does `readFileSync()` on every access
- Redundant manifest file reads (no caching)
- Eager instantiation of all 3 spawners (Claude, Codex, Gemini)

**Estimated savings from P0+P1 fixes: 100-285ms per spawn**

---

### 9. Memory Leaks & Resource Cleanup (Worker 9) — 25 Issues

**CRITICAL:**
- **WebSocketBridge subscribes to 17 events, never unsubscribes** — no `shutdown()` method
- **sessionIndex grows unbounded** — every session ever created stays in index
- **Container shutdown only cleans EventBus** — ignores all caches, repositories, WebSocket bridge
- **Child processes spawned without kill/cleanup** — no timeout, no SIGTERM forwarding

**HIGH:**
- `LogDigestService.pathCache` unbounded
- `MultiScopeSkillLoader.loaderCache` unbounded with nested caches
- All repository Map collections lack eviction
- WebSocket subscriptions Map retains stale client references
- CLI fetch requests have no timeout

**MEDIUM:**
- Process signal handlers accumulate on restart
- InMemoryEventBus max listeners may be exceeded
- Audio event listeners in soundManager never removed
- `activeModals` array can grow unbounded
- `useKeyboardShortcuts` 23-item dependency array causes excessive re-registration

---

### 10. Build, Bundle & Startup (Worker 10) — 11 Issues

**CRITICAL:**
- **No chunk splitting** — zero `manualChunks` config in vite.config.ts. All vendors in one chunk.

**HIGH:**
- Dashboard (recharts ~500KB) not lazy-loaded — static import in App.tsx
- MermaidDiagram (~2.5MB) eagerly imported in DocViewer

**MEDIUM:**
- Board/MultiProjectBoard statically imported in App.tsx (only shown on Cmd+Shift+B)
- TeamView statically imported (only shown conditionally)
- CommandPalette statically imported (keyboard shortcut triggered)
- Sequential repository initialization on server startup (7 awaits that could be parallel)
- Migration runs on every startup (no sentinel file)

**Estimated initial bundle bloat from non-lazy imports: ~500KB+**

---

## Top 20 Priority Fixes (Impact × Effort)

| # | Fix | Impact | Effort | Area |
|---|-----|--------|--------|------|
| 1 | Guard `markAgentWorkingFromOutput` (early-exit when already true) | Critical | 5 min | Zustand |
| 2 | Reuse already-fetched data in spawn handler (stop re-fetching tasks/members) | Critical | 30 min | API |
| 3 | Add in-memory cache to TeamMemberRepository & TeamRepository | Critical | 2 hr | Server I/O |
| 4 | Replace `new Map()` cloning with Immer or Record spread | Critical | 3 hr | Zustand |
| 5 | Add `React.memo` to SessionsSection, TaskListItem, TaskStatusControl, etc. | High | 1 hr | UI Render |
| 6 | Install @tanstack/react-virtual, virtualize session/task lists | Critical | 4 hr | DOM Perf |
| 7 | Implement WebSocket message batching (50ms window) | Critical | 2 hr | WebSocket |
| 8 | Add throttling on session:updated events (max 2/sec per entity) | Critical | 1 hr | WebSocket |
| 9 | Add backpressure check on WebSocket send | High | 30 min | WebSocket |
| 10 | Normalize manifest once, pass through pipeline (stop 3x deep clone) | High | 1 hr | CLI |
| 11 | Parallelize file reads on server startup | High | 1 hr | Server I/O |
| 12 | Add `manualChunks` to vite.config.ts for vendor splitting | High | 30 min | Bundle |
| 13 | Lazy-load Board/Dashboard (recharts) in App.tsx | High | 30 min | Bundle |
| 14 | Add `useShallow` to multi-selector Zustand subscriptions | High | 2 hr | Zustand |
| 15 | Filter persistence triggers for transient state | High | 1 hr | Zustand |
| 16 | Parallelize sequential API calls in worker-init | High | 1 hr | CLI |
| 17 | Add WebSocketBridge.shutdown() with listener cleanup | High | 1 hr | Memory |
| 18 | Add LRU eviction to TaskRepository in-memory cache | High | 2 hr | Memory |
| 19 | Add pagination to list API endpoints | Medium | 4 hr | API |
| 20 | Move log parsing to Web Worker | Medium | 3 hr | UI Perf |

---

## Individual Worker Reports

| Worker | Focus | Doc Location |
|--------|-------|-------------|
| 1 | UI Re-render Analysis | `docs/ui-rerender-analysis.md` |
| 2 | Zustand Store Performance | `docs/zustand-store-performance-audit.md` |
| 3 | WebSocket Pipeline | Task doc: `websocket-performance-audit.md` |
| 4 | FileSystem Repository I/O | `docs/filesystem-repo-io-analysis.md` |
| 5 | API Route Handlers | `docs/perf-audit-api-routes-middleware.md` |
| 6 | Session & Log Processing | `docs/perf-audit/worker6-session-log-performance.md` |
| 7 | UI List Virtualization & DOM | `docs/ui-list-virtualization-dom-performance.md` |
| 8 | CLI Performance | Task doc: `cli-perf-findings.md` |
| 9 | Memory Leaks & Cleanup | `docs/memory-leaks-analysis.md` |
| 10 | Build, Bundle & Startup | `docs/build-bundle-startup-optimization.md` |
