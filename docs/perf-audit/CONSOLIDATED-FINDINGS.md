# Consolidated Performance Audit — Agent Maestro

**Date:** 2026-03-09
**Scope:** Full-stack performance audit across 10 parallel workers
**Target:** Optimize for 200+ concurrent sessions

---

## Executive Summary

10 parallel workers audited every layer of the app: Zustand stores, React components, WebSocket pipeline, filesystem I/O, session management, CSS/rendering, memory leaks, API routes, data hooks, and build/bundle. **67 distinct issues** were identified across all workers.

### Impact Distribution

| Severity | Count | Key Theme |
|----------|-------|-----------|
| CRITICAL / HIGH | 22 | Store subscriptions, O(n) scans, CLI subprocess spawning, missing memoization |
| MEDIUM | 28 | Missing React.memo, CSS animation overhead, unbounded data structures, validation gaps |
| LOW | 17 | Code cleanup, minor optimizations, housekeeping |

### Top 5 Systemic Issues (Cross-Cutting)

1. **Broad store subscriptions** — Components subscribe to entire entity maps (`s.sessions`, `s.tasks`), causing cascade re-renders on every WebSocket update. Found in stores, components, and hooks.
2. **O(n) scans in hot paths** — `useSessionStore` uses arrays instead of maps; hooks scan all entities inside selectors; dashboard does 15+ filter passes over tasks.
3. **CLI subprocess for manifest generation** — Each session spawn calls a CLI subprocess (500-5000ms, ~80MB memory). At 10 concurrent spawns = 800MB memory spike.
4. **Missing memoization** — `subtaskCount`, `totalDescendantCount`, session counts all recomputed without caching on every render cycle.
5. **CSS animation overhead** — 150+ `transition: all` instances, 40+ infinite animations, animated `backdrop-filter`, `box-shadow` keyframes causing continuous repaints.

---

## P0 — Critical Fixes (Do First)

### 1. Convert `useSessionStore.sessions` from Array to Record/Map
**Source:** Worker 1, Finding 1 | **Impact:** HIGH | **Effort:** Medium
Every mutation (terminal output, status change, resize) does `sessions.map()` over 200+ entries. With 10 active agents, that's ~20,000 array operations/sec creating GC pressure.
**Fix:** Convert to `Record<string, TerminalSession>` with O(1) updates.

### 2. Fix TaskListItem store selectors — cascade re-renders
**Source:** Worker 2, Finding 2 | **Impact:** CRITICAL | **Effort:** Low
Every TaskListItem subscribes to entire `tasks` and `teamMembers` maps. With 200+ tasks, a single task update re-renders every TaskListItem. `subtaskCount` does `Object.values(tasks).filter()` on every render = O(n^2).
**Fix:** Use `useShallow` + pass derived data as props from parent.

### 3. Move manifest generation in-process
**Source:** Worker 5, Finding 1 | **Impact:** HIGH | **Effort:** High
`generateManifestViaCLI()` spawns a child process per session (500-5000ms, ~80MB memory). 10 concurrent spawns = 800MB memory spike + 10 competing Node.js processes.
**Fix:** Call manifest generation as a library function within the server process.

### 4. Store JSONL path on session metadata
**Source:** Worker 5, Finding 2 | **Impact:** HIGH | **Effort:** Low
`LogDigestService.resolveJsonlPath()` scans ALL Claude project directories on cache miss. A coordinator polling 10 workers = 10 filesystem scans (200-2000ms each).
**Fix:** Store the JSONL path on `session.metadata.jsonlPath` at agent startup.

### 5. Fix evicted tasks invisible in queries (correctness bug)
**Source:** Worker 4, Finding 2.5 | **Impact:** HIGH | **Effort:** Medium
When tasks are LRU-evicted from cache, they're removed from secondary indexes. `findByProjectId` silently omits completed tasks.
**Fix:** Keep indexes intact across eviction; lazy-load missing entries.

### 6. Wrap `ExecutionBar` in React.memo
**Source:** Worker 2, Finding 4 | **Impact:** HIGH | **Effort:** Trivial
Re-renders on every MaestroPanel state change (search typing, filter toggles) despite props not changing. Single-line fix.

### 7. Add `useShallow` across component store selectors
**Source:** Worker 1, Finding 3 | **Impact:** HIGH | **Effort:** Low
`App.tsx` has 16 separate store subscriptions, `AppModals.tsx` has 17, `SessionsSection.tsx` subscribes to 4 full entity maps. Every WebSocket update triggers re-renders in all.
**Fix:** Consolidate with `useShallow` where selectors return objects/arrays.

---

## P1 — High-Impact Improvements (Do Soon)

### 8. Defer JSON.stringify in WriteBatcher
**Source:** Worker 4, Finding 2.1 | **Impact:** HIGH | **Effort:** Low
`saveSession()` calls `JSON.stringify` immediately, even though 9 out of 10 serializations are discarded (only last write in 500ms window persisted). At scale: wasted CPU.
**Fix:** Pass a lazy `() => string` serializer to `markDirty()`, serialize only at flush.

### 9. Add `parentSessionId` secondary index
**Source:** Worker 5, Finding 4 | **Impact:** MEDIUM | **Effort:** Low
Most coordinator queries filter by `parentSessionId` — currently O(n) scan of entire session index.
**Fix:** Add `parentSessionIndex: Map<string, Set<string>>` matching existing pattern.

### 10. Eliminate 23-dep keyboard shortcuts effect
**Source:** Worker 9, Finding 6 | **Impact:** MEDIUM | **Effort:** Low
`useKeyboardShortcuts` subscribes to 23 store selectors, re-registering the keydown listener on every modal open/close.
**Fix:** Use `getState()` inside handler instead of reactive subscriptions. Zero deps.

### 11. Fix O(n) scans inside hook selectors
**Source:** Worker 9, Findings 1-3 | **Impact:** HIGH | **Effort:** Low-Medium
`useSubtaskProgress`, `useTaskSessionCount`, `useTaskSessions` all scan entire entity maps inside selectors, running on every store mutation.
**Fix:** Move computation to `useMemo`; add store-level reverse indexes.

### 12. Replace `transition: all` with explicit properties
**Source:** Worker 6, Finding 2 | **Impact:** HIGH | **Effort:** Low
150+ instances force browser to check all animatable properties on every hover. Mechanical find-and-replace.

### 13. Fix/remove expensive CSS animations
**Source:** Worker 6, Findings 3a-3c | **Impact:** MEDIUM-HIGH | **Effort:** Low
Scanline animation runs continuously on full panel. `errorPulse` animates `box-shadow` (triggers paint per frame). `statusPulse` runs on every in-progress task simultaneously.
**Fix:** Add `will-change: transform`, use `opacity` instead of `box-shadow`, pause off-screen animations.

### 14. Split TaskListItem (832 lines, 13+ useState)
**Source:** Worker 2, Finding 2.2 | **Impact:** HIGH | **Effort:** Medium
Opening one dropdown re-renders the entire 832-line component. Should be split into CollapsedRow, StatusDropdown, PriorityDropdown, TeamMemberDropdown, LaunchModelDropdown, SessionChips, DocsList.

### 15. Send WebSocket `subscribe` message on connect
**Source:** Worker 3, Finding 6a | **Impact:** MEDIUM | **Effort:** Low
The subscription filtering system exists server-side but the client never uses it. Every client receives ALL events for ALL projects.
**Fix:** Send `{ type: 'subscribe', projectId }` on `ws.onopen`.

---

## P2 — Medium-Impact Improvements (Do Later)

### 16. Persist session index for fast startup
**Source:** Worker 4, Finding 2.3 | **Effort:** Medium
All session files parsed on startup to build index. Persist `_session-index.json` on shutdown; load it instead of parsing 500+ files.

### 17. Single-pass dashboard data computation
**Source:** Worker 9, Finding 4 | **Effort:** Medium
`useDashboardData` does ~15 `.filter()` passes over tasks + per-day filtering for 90-day range. Replace with single-pass accumulator.

### 18. `useMaestroStore` god store splitting
**Source:** Worker 1, Finding 5 | **Effort:** High
1150-line store managing 6 entity types. A session update triggers re-evaluation in task-only components. Split into domain-specific stores.

### 19. Prune `useMaestroStore.tasks` across projects
**Source:** Worker 7, Finding 1a | **Effort:** Low
`fetchTasks` adds tasks to the record without removing stale entries from previous projects. Memory grows monotonically.

### 20. Add equality check in `session:status_changed` handler
**Source:** Worker 1, Finding 6 | **Effort:** Trivial
Shallow-copies the entire sessions map (200+ entries) even when values haven't changed.

### 21. Lazy-load AppModals (18 eagerly imported modals)
**Source:** Worker 10, Finding 10-2 | **Effort:** Low
SSH manager, recordings, replay, secure storage modals are rarely opened but always bundled. ~50-100KB savings.

### 22. Lazy-load SessionTerminal / xterm (282 KB)
**Source:** Worker 10, Finding 10-3 | **Effort:** Low
xterm loads before user creates any session. Defer until first session render.

### 23. Add pagination defaults
**Source:** Worker 8, Finding 3a | **Effort:** Low
11 endpoints return unbounded collections without default limits. `GET /master/context` loads ALL tasks + sessions.

### 24. Push pagination to repository layer
**Source:** Worker 8, Finding 3b | **Effort:** Medium
`paginate()` helper loads ALL items then slices. A `?limit=10` still loads all N items from disk.

### 25. Add WriteBatcher to TaskList and Ordering repos
**Source:** Worker 4, Finding 2.4 | **Effort:** Low
Drag-and-drop reorder triggers immediate disk write per operation instead of batching.

### 26. Wrap `VirtualizedColumnBody` in React.memo
**Source:** Worker 2, Finding 3.1 | **Effort:** Trivial
During drag, `dragState` changes cause ALL columns to re-render and re-virtualize.

### 27. Delete deprecated `useMaestroWebSocket.ts`
**Source:** Worker 3, Finding 8 + Worker 7, Finding 3a | **Effort:** Trivial
Dead code that can accidentally create a duplicate WebSocket connection.

### 28. Trim WS payloads (strip timeline/events/docs)
**Source:** Worker 3, Finding 2a | **Effort:** Medium
`session:updated` sends full session including `events[]`, `timeline[]`, `docs[]` — 5-50KB per message. Only status fields are needed for UI updates.

### 29. Clear debounced refetch timers in `destroyWebSocket`
**Source:** Worker 7, Finding 3c | **Effort:** Trivial
Module-level `taskRefetchTimer` and `sessionRefetchTimer` can fire on stale store after destroy.

### 30. LRU cache for terminal sessions loaded from disk
**Source:** Worker 5, Finding 6 | **Effort:** Low
Repeated list queries re-load terminal sessions from disk each time.

---

## P3 — Low-Impact / Housekeeping

| # | Finding | Source |
|---|---------|--------|
| 31 | Fix hooks after early returns in MaestroPanel (rules of hooks bug) | Worker 2 |
| 32 | Parallelize inner `readdir` calls in Task/TaskList init | Worker 4 |
| 33 | Use `loadFilesParallel` in Team/TeamMember repos | Worker 4 |
| 34 | Parallelize session migration writes at startup | Worker 4 |
| 35 | Bounded concurrency in WriteBatcher flush | Worker 4 |
| 36 | Log WriteBatcher flush errors (silent data loss) | Worker 4 |
| 37 | Replace `:has()` selector with JS class toggle | Worker 6 |
| 38 | Replace `body.dragging-active *` with CSS inheritance | Worker 6 |
| 39 | Reduce/eliminate animated `backdrop-filter` | Worker 6 |
| 40 | Batch scroll reads in SessionLogModal (forced reflow) | Worker 6 |
| 41 | Add `will-change` to animated pseudo-elements | Worker 6 |
| 42 | Memoize `remarkPlugins` array in DocViewer | Worker 6 |
| 43 | Prune `lastUsedTeamMember` unbounded map | Worker 7 |
| 44 | Clean `commandLifecycleSessionsRef` for exited sessions | Worker 7 |
| 45 | Add LRU eviction to `soundManager.audioContext` Map | Worker 7 |
| 46 | Stabilize `useMultiProjectTasks` `projectIds` dependency | Worker 9 |
| 47 | Use Set for `useTaskLists` ordering lookup (O(n^2) → O(n)) | Worker 9 |
| 48 | Debounce `wsConnected` refetch in team hooks | Worker 9 |
| 49 | Add body size limit `express.json({ limit: '10mb' })` | Worker 8 |
| 50 | Add Zod validation to image upload endpoint | Worker 8 |
| 51 | Strip API keys from spawn response | Worker 8 |
| 52 | Parallelize sequential fetches in spawn handler | Worker 8 |
| 53 | Lazy-load DnD components (187 KB) | Worker 10 |
| 54 | Defer `soundManager` singleton initialization | Worker 10 |
| 55 | Move feature CSS into lazy components | Worker 10 |
| 56 | Add `optimizeDeps.include` for dev-mode | Worker 10 |
| 57 | Wrap Dashboard sub-components in React.memo | Worker 2 |
| 58 | Pre-serialize WS payload for unfiltered clients | Worker 3 |
| 59 | Add `content-visibility: auto` on task cards | Worker 6 |
| 60 | Optimize persistence subscriptions with selectors | Worker 1 |

---

## Architecture Recommendations

### Store-Level Reverse Indexes
Many findings stem from the same root cause: flat `Record<id, entity>` maps forcing O(n) scans. Adding reverse indexes eliminates the majority of hook performance issues:

```typescript
// In useMaestroStore:
tasksByProjectId: Record<string, Set<string>>;     // projectId → taskIds
tasksByParentId: Record<string, Set<string>>;       // parentId → childTaskIds
sessionsByTaskId: Record<string, Set<string>>;      // taskId → sessionIds
```

Maintained atomically alongside entity mutations. Addresses Findings 11, 14, 17, and multiple hook scan issues.

### Server-Side Session Index
Persist a lightweight `_session-index.json` file containing `SessionIndexEntry` data. Reduces startup from ~2-5s (parsing 500+ files) to ~100-300ms (parsing one index file).

### In-Process Manifest Generation
The single highest-latency operation in the system. Moving from CLI subprocess to library call saves ~400-2000ms per spawn and eliminates ~80MB memory per concurrent spawn.

---

## Estimated Impact Summary

| Category | Current (200+ sessions) | After P0+P1 Fixes |
|----------|------------------------|-------------------|
| Store re-renders per WS event | 8+ components × O(n) scans | 1-2 targeted components |
| Session spawn latency | 500-5000ms | ~50-200ms |
| Memory per concurrent spawn | ~80MB (CLI process) | ~0 (in-process) |
| Initial JS bundle (eager) | ~1,150 KB | ~430-530 KB |
| Server startup time | ~2-5s | ~100-300ms |
| Dashboard computation | ~3000 iterations + 360 per-day passes | Single-pass ~200 iterations |
| CSS animation overhead | 40+ infinite animations, 150+ `transition: all` | Explicit transitions, paused off-screen |

---

## Individual Worker Reports

| # | Focus Area | Doc | Issues Found |
|---|-----------|-----|-------------|
| 1 | Zustand Store Performance | [01-zustand-stores.md](./01-zustand-stores.md) | 10 |
| 2 | React Component Re-renders | [02-component-rerenders.md](./02-component-rerenders.md) | 15 |
| 3 | WebSocket & Real-time Pipeline | [03-websocket-pipeline.md](./03-websocket-pipeline.md) | 8 |
| 4 | FileSystem Repository I/O | [04-filesystem-io.md](./04-filesystem-io.md) | 11 |
| 5 | Session Management at Scale | [05-session-management.md](./05-session-management.md) | 10 |
| 6 | CSS & Rendering Performance | [06-css-rendering.md](./06-css-rendering.md) | 11 |
| 7 | Memory Leaks & Cleanup | [07-memory-leaks.md](./07-memory-leaks.md) | 12 |
| 8 | API Routes & Validation | [08-api-validation.md](./08-api-validation.md) | 13 |
| 9 | Data Hooks & Derived State | [09-data-hooks.md](./09-data-hooks.md) | 10 |
| 10 | Build, Bundle & Code Splitting | [10-build-bundle.md](./10-build-bundle.md) | 9 |
