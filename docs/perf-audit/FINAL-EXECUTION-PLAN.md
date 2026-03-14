# Final Execution Plan: Performance Optimization Rollout

**Date:** 2026-03-09
**Total Fix Plans:** 8 groups, 150+ issues
**Goal:** Make the app performant and scalable for 200+ concurrent sessions with zero functionality loss

---

## Execution Order & Dependencies

The 8 fix plan groups have specific dependency relationships. Some can run in parallel, others must be sequential. This plan defines a 5-wave execution strategy.

---

## Wave 1: Foundation — Server-Side Fixes (No UI Changes)
**Can be parallelized. No cross-dependencies.**

These fix the backend bottlenecks that are prerequisites for UI improvements. They are completely independent of each other.

### Wave 1A: Repository Caching & I/O (Plan Group 4)
**Doc:** `docs/fix-plan-group4-server-repo-caching-io.md`

Execute in this order:
1. **Phase 1** — Add in-memory caching to TeamMemberRepository & TeamRepository (P0 — eliminates disk-on-every-access)
2. **Phase 1** — Add LRU eviction to TaskRepository (prevents OOM)
3. **Phase 2** — Parallelize `initialize()` file reads across all 7 repos (`Promise.all` in batches)
4. **Phase 2** — Build secondary indexes (projectId→entityIds, taskId→sessionIds)
5. **Phase 3** — Write batching/debouncing, atomic writes, compact JSON

**Why first:** API routes and WebSocket optimizations depend on efficient repository I/O.

### Wave 1B: API Route N+1 Queries & Pagination (Plan Group 5)
**Doc:** `docs/plan-api-route-n1-queries-pagination.md`

Execute in this order:
1. **Fix N+1** — Reuse already-fetched data in spawn handler (zero-cost)
2. **Fix N+1** — Parallelize session doc fetching, session enrichment, session lookups
3. **Pagination** — Add `limit`/`offset` to all 12 list endpoints
4. **DTOs** — Return summary objects for list views (strip env, events, timeline)
5. **Infrastructure** — Add cache headers, compression middleware
6. **Refactor** — Decompose 534-line spawn handler

**Can run parallel to 1A** — operates on different files (api/ vs repositories/).

### Wave 1C: Memory Leaks & Resource Lifecycle (Plan Group 7)
**Doc:** `docs/fix-plan-memory-leaks.md`

Execute in this order:
1. **WebSocketBridge.shutdown()** — Add listener cleanup
2. **sessionIndex eviction** — Add TTL or max-size to session index
3. **Expand container.shutdown()** — Clean all caches and repositories
4. **Child process management** — Add timeout, kill, SIGTERM forwarding
5. **CLI fixes** — Fetch timeout, WebSocket race conditions

**Can run parallel to 1A and 1B** — addresses lifecycle concerns in different code paths.

---

## Wave 2: WebSocket Pipeline (Depends on Wave 1A partial)
**Must start after repository caching is in place.**

### WebSocket Pipeline Optimization (Plan Group 3)
**Doc:** `/tmp/websocket-pipeline-fix-plan.md` (should be copied to docs/)

Execute in this order:
1. **Message batching** — Add 50ms batch window in WebSocketBridge
2. **Per-entity throttling** — Max 2/sec for session:updated, 3/sec for task:updated
3. **Backpressure handling** — Check `bufferedAmount` before send
4. **Lightweight events** — Add `session:status_changed` with minimal payload
5. **Consolidate WS singletons** — Remove unused useMaestroWebSocket.ts
6. **Debounce relationship refetches** — Batch task:session_added REST calls
7. **Decouple EventBus** — Make WebSocket broadcast fire-and-forget with `queueMicrotask`
8. **Connection limits** — Add `verifyClient` with max connection cap
9. **Subscription filtering** — Extend to support project-scoped filtering
10. **Protocol-level ping** — Replace JSON ping with ws.ping()

**Why Wave 2:** Message batching + throttling depend on efficient broadcast. Repository caching from Wave 1A ensures the EventBus handlers don't bottleneck on I/O.

---

## Wave 3: Zustand Store Overhaul (Can start with Wave 2)
**Core UI state management changes. Should complete before Wave 4.**

### Zustand State Management Overhaul (Plan Group 1)
**Doc:** `docs/zustand-state-management-overhaul-plan.md`

Execute in this order:
1. **Phase 1 Quick Wins** (independent, ship immediately):
   - 1A: Guard `markAgentWorkingFromOutput` early-exit
   - 1B: Debounce `lastUsedTeamMember` localStorage write
   - 1C: Filter persistence triggers for transient state
2. **Phase 2 Data Structure** (foundation for everything else):
   - 2A: Replace Map/Set with Record for loading/errors
   - 2B: Replace `Map<string,T>` with `Record<string,T>` for all entities (kills 57 `new Map()` clones)
   - 2C: Normalize useSessionStore sessions to Record + sessionIds
3. **Phase 3 Store Splitting** (depends on Phase 2):
   - 3A: Separate dialog state from useProjectStore
   - 3B: (Optional) Split useMaestroStore into domain stores
4. **Phase 4 Consumer Optimization** (depends on Phase 2):
   - 4A: Add `useShallow` to all multi-selector hooks/components
   - 4B: Replace whole-collection selectors with item-specific selectors
5. **Phase 5 WebSocket & Persistence**:
   - 5A: WebSocket message batching in store handler
   - 5B: Debounced/dirty-flag persistence

**Why Wave 3:** Zustand changes affect how components receive data, which affects the React memoization strategy in Wave 4.

---

## Wave 4: UI Rendering Optimizations (Depends on Wave 3)
**React memoization + virtualization. These are the visible performance wins.**

### Wave 4A: React Memoization & Re-render Prevention (Plan Group 2)
**Doc:** `docs/plan-react-memoization.md`

Execute in this order:
1. **Phase 1** — Add `React.memo` to 8 components (SessionsSection, TaskListItem, SortableTaskItem, SortableSessionItem, MaestroSessionContent, TreeTaskNodeContent, TaskStatusControl, TeamSessionGroup)
2. **Phase 2** — Move static constants to module scope (AGENT_TOOL_ICONS, presets)
3. **Phase 3** — Memoize computed values with `useMemo` (activeRoots, ids, columnData)
4. **Phase 4** — Convert MaestroPanel handlers to `useCallback`
5. **Phase 5** — Extract `SessionItem` from `renderSessionItem` as memoized component
6. **Phase 6** — Extract `TaskNodeRenderer` from `renderTaskNode` as memoized component
7. **Phase 7** — Replace per-item inline closures in kanban views with ID-based callbacks

**Why after Wave 3:** The `React.memo` strategy depends on stable prop references. After Wave 3 converts Maps to Records, selectors produce more stable references, making `React.memo` effective.

### Wave 4B: UI Virtualization & DOM Performance (Plan Group 6)
**Doc:** `docs/fix-plan-ui-virtualization-dom-performance.md`

Execute in this order:
1. Install `@tanstack/react-virtual`
2. Virtualize SessionsSection (main session list + history dropdown)
3. Virtualize SortableTaskList (with dnd-kit integration)
4. Virtualize MultiProjectBoard kanban columns
5. Virtualize SessionTimeline
6. Cache MermaidDiagram renders (initialize once, cache SVG by chart string)
7. Add CSS `contain: content` to all scrollable list containers
8. Add `content-visibility: auto` for off-screen items
9. Lazy-load Dashboard charts (only render visible charts)
10. Consolidate filter iterations (single-pass categorization)

**Can run parallel to 4A** — virtualization touches different code than memoization. Just coordinate on SessionsSection changes.

---

## Wave 5: Build & Startup Optimizations (Independent)
**Can run anytime, but best after UI changes stabilize.**

### Build Bundle & CLI Startup (Plan Group 8)
**Doc:** `docs/plan-build-bundle-startup-fixes.md`

Execute in this order:
1. **Vite Config** — Add `manualChunks` for vendor splitting
2. **Lazy Loading** — React.lazy for Board, TeamView, CommandPalette in App.tsx
3. **Lazy Loading** — React.lazy for MermaidDiagram inside DocViewer
4. **Server Startup** — Parallelize repository initialization with `Promise.all`
5. **Server Startup** — Add migration sentinel file
6. **CLI** — Fix triple manifest normalization (normalize once, pass through)
7. **CLI** — Parallelize worker-init API calls
8. **CLI** — Cache compiled prompts
9. **CLI** — Lazy spawner instantiation
10. **CLI** — Cache skill discovery results

**Why last:** Bundle optimization is best done after code changes stabilize, so the chunk configuration accurately reflects the final dependency graph.

---

## Summary: Execution Timeline

```
Wave 1 (Parallel — Foundation)
├── 1A: Repository Caching & I/O
├── 1B: API Route Fixes & Pagination
└── 1C: Memory Leaks & Lifecycle
         ↓
Wave 2 (WebSocket Pipeline)
    └── WebSocket batching, throttling, backpressure
         ↓ (can start in parallel)
Wave 3 (Zustand Store Overhaul)
    └── Map→Record, useShallow, persistence fixes
         ↓
Wave 4 (Parallel — UI Rendering)
├── 4A: React Memoization
└── 4B: UI Virtualization & DOM
         ↓
Wave 5 (Build & Startup)
    └── Bundle splitting, lazy loading, CLI optimizations
```

---

## Parallelization Matrix

| Wave | Can Parallel With | Must Wait For |
|------|------------------|---------------|
| 1A (Repo I/O) | 1B, 1C | Nothing |
| 1B (API Routes) | 1A, 1C | Nothing |
| 1C (Memory Leaks) | 1A, 1B | Nothing |
| 2 (WebSocket) | Wave 3 | Wave 1A (partial — caching) |
| 3 (Zustand) | Wave 2 | Wave 1 Quick Wins can start immediately |
| 4A (React Memo) | 4B | Wave 3 (Phase 2 — Record migration) |
| 4B (Virtualization) | 4A | Wave 3 (Phase 1 Quick Wins at minimum) |
| 5 (Build/CLI) | Any | Nothing (but best after 4) |

---

## Risk Mitigation

1. **Each wave produces a shippable, working state** — no half-done migrations
2. **Zustand Phase 2 (Map→Record)** is the riskiest change — requires updating ALL selectors. Use `grep -r "\.get(" --include="*.ts" --include="*.tsx"` to find all Map method calls
3. **Virtualization + dnd-kit** integration may require a compatibility layer — test drag-and-drop thoroughly
4. **Store splitting (Wave 3 Phase 3B)** is optional and highest-risk — skip if Phase 2 delivers sufficient improvement
5. **Always run the full test suite** between waves: `cd maestro-server && npm test`

---

## Plan Document Index

| Group | Title | Doc Path |
|-------|-------|----------|
| 1 | Zustand State Management | `docs/zustand-state-management-overhaul-plan.md` |
| 2 | React Memoization | `docs/plan-react-memoization.md` |
| 3 | WebSocket Pipeline | `/tmp/websocket-pipeline-fix-plan.md` |
| 4 | Repository Caching & I/O | `docs/fix-plan-group4-server-repo-caching-io.md` |
| 5 | API Route N+1 & Pagination | `docs/plan-api-route-n1-queries-pagination.md` |
| 6 | UI Virtualization & DOM | `docs/fix-plan-ui-virtualization-dom-performance.md` |
| 7 | Memory Leaks & Lifecycle | `docs/fix-plan-memory-leaks.md` |
| 8 | Build, Bundle & CLI | `docs/plan-build-bundle-startup-fixes.md` |
| — | Consolidated Analysis (all findings) | `docs/perf-audit/CONSOLIDATED-PERFORMANCE-AUDIT.md` |
