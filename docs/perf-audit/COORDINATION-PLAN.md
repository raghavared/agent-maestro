# Performance Optimization — Coordination Plan

**Date:** 2026-03-09
**Branch:** `optimize`
**Goal:** Implement all 150+ performance findings across 8 fix plans in a safe, sequential manner with zero functionality loss.

---

## Team Roster

| Role | Team Member ID | Responsibility |
|------|---------------|----------------|
| 🏎️ Server Perf Engineer | `tm_1773042672389_0ezvgwqx3` | Wave 1A (Repo Caching), Wave 1B (API N+1), Wave 1C (Memory Leaks) |
| 📡 WebSocket Pipeline Engineer | `tm_1773042673381_5591kkuak` | Wave 2 (WebSocket batching, throttling, backpressure) |
| 🧬 Zustand State Engineer | `tm_1773042674314_x0mq0kjkh` | Wave 3 (Map→Record, useShallow, persistence, store splitting) |
| ⚛️ React Perf Engineer | `tm_1773042675683_c755mlc5s` | Wave 4A (React.memo, useCallback) + Wave 4B (Virtualization, CSS containment) |
| 📦 Build Bundle Engineer | `tm_1773042677052_zysaa07fn` | Wave 5 (Vite chunks, lazy loading, CLI optimizations) |

---

## Execution Strategy: 5-Wave Sequential Rollout

### Key Principles
1. **Each wave produces a working, shippable state** — no half-done migrations
2. **Zero functionality loss** — existing behavior must be preserved
3. **Run tests after each wave** — `cd maestro-server && npm test`
4. **Sequential waves with parallelism within waves** — waves have dependencies; tasks within a wave can run in parallel where noted

---

## Wave 1: Foundation — Server-Side Fixes (PARALLEL)
**Workers:** 🏎️ Server Perf Engineer (3 parallel tasks)
**Dependencies:** None — this is the foundation
**Estimated scope:** ~1,200 LOC across 15+ files

### Task 1A: Repository Caching & I/O
**Plan Doc:** `docs/fix-plan-group4-server-repo-caching-io.md`
**Files:** `maestro-server/src/infrastructure/repositories/`

Execute in order:
1. **Phase 1 (P0):** Add in-memory cache to TeamMemberRepository & TeamRepository (eliminates disk-on-every-access)
2. **Phase 1 (P0):** Add LRU eviction to TaskRepository (prevents OOM)
3. **Phase 2 (P1):** Parallelize `initialize()` file reads across all 7 repos
4. **Phase 2 (P1):** Build secondary indexes (projectId→entityIds, taskId→sessionIds)
5. **Phase 3 (P2):** Write batching/debouncing, atomic writes, compact JSON

**Verification:** API response times should drop for team-member and team endpoints. Monitor memory usage.

### Task 1B: API Route N+1 Queries & Pagination
**Plan Doc:** `docs/plan-api-route-n1-queries-pagination.md`
**Files:** `maestro-server/src/api/` routes

Execute in order:
1. Reuse already-fetched data in spawn handler (zero-cost fix)
2. Parallelize: task docs fetch, session enrichment, session lookups with `Promise.all`
3. Add pagination schema + `paginate()` helper to `validation.ts`
4. Add pagination to all 12 list endpoints (non-breaking approach)
5. Add summary DTOs for list views (strip env, events, timeline)
6. Add cache headers + compression middleware
7. Decompose 534-line spawn handler into SpawnService (last — after other fixes)

**Verification:** Spawn time should drop. API list calls should have pagination metadata.

### Task 1C: Memory Leaks & Resource Lifecycle
**Plan Doc:** `docs/fix-plan-memory-leaks.md`
**Files:** WebSocketBridge.ts, container.ts, sessionRoutes.ts, api.ts, soundManager.ts, server.ts

Execute in order:
1. WebSocketBridge.shutdown() with listener cleanup
2. sessionIndex eviction (TTL for terminal sessions)
3. Expand container.shutdown() (clean all caches, repos, WS bridge)
4. Child process timeout + kill + SIGTERM forwarding
5. LogDigestService pathCache LRU + MultiScopeSkillLoader cache limits
6. CLI fetch timeout (AbortController)
7. soundManager listener cleanup + signal handler fix

**Verification:** Run server for extended period, monitor `process.memoryUsage()`. Verify graceful shutdown cleans up.

---

## Wave 2: WebSocket Pipeline (After Wave 1A caching is in place)
**Worker:** 📡 WebSocket Pipeline Engineer
**Dependencies:** Wave 1A (repository caching must be done so EventBus handlers don't bottleneck on I/O)
**Plan Doc:** `/tmp/websocket-pipeline-fix-plan.md` (copy to `docs/fix-plan-websocket-pipeline.md`)
**Estimated scope:** ~480 LOC across 8 files

Execute in order:
1. **Phase A (Core):** Message batching (50ms window) + per-entity throttling + backpressure handling + EventBus decoupling — these 4 are tightly coupled
2. **Phase B:** Lightweight `session:status_changed` event (new event type + service changes)
3. **Phase C (Client):** Consolidate WS singletons + debounce relationship refetches + reconnection jitter
4. **Phase D (Hardening):** Extended subscription filtering + connection limits

**CRITICAL:** Client-side message parsing must handle both single-object AND array formats for backward compatibility.

**Verification:** Spawn 50+ sessions, verify UI updates smoothly. Monitor server memory. Verify `session watch` CLI still works.

---

## Wave 3: Zustand Store Overhaul (Can start in parallel with Wave 2)
**Worker:** 🧬 Zustand State Engineer
**Dependencies:** Wave 1 quick wins can start immediately. Full Phase 2 needs Wave 2 client message format changes.
**Plan Doc:** `docs/zustand-state-management-overhaul-plan.md`
**Estimated scope:** ~25-30 files, ~800+ LOC

Execute in order:
1. **Phase 1 Quick Wins** (independent, ship immediately):
   - 1A: Guard `markAgentWorkingFromOutput` early-exit
   - 1B: Debounce `lastUsedTeamMember` localStorage write
   - 1C: Filter persistence triggers for transient state (hash-check approach)
2. **Phase 2 Data Structure** (THE BIGGEST CHANGE — foundation for everything):
   - 2A: Replace `Set<string>`/`Map<string,string>` for loading/errors → `Record`
   - 2B: Replace `Map<string,T>` → `Record<string,T>` for ALL 8 entity collections (kills 57 `new Map()` clones)
   - 2C: (Optional) Normalize useSessionStore sessions to Record + sessionIds
3. **Phase 3 Store Splitting**:
   - 3A: Separate dialog state from useProjectStore
   - 3B: (DEFERRED — too risky for this rollout) Split useMaestroStore
4. **Phase 4 Consumer Optimization**:
   - 4A: Add `useShallow` to 11+ components/hooks
   - 4B: Replace whole-collection selectors with item-specific selectors
5. **Phase 5 WebSocket & Persistence**:
   - 5A: Batch WebSocket messages in store handler with `queueMicrotask`
   - 5B: Persistence dirty flags

**RISK ALERT:** Phase 2B (Map→Record) touches 30+ files. TypeScript compilation will catch all `.get()`/`.has()`/`.values()` calls. Do one entity type per commit. Run full TS compilation after each.

**Verification:** React DevTools Profiler — verify fewer re-renders. Check persistence calls with `console.count('buildPersistedState')`.

---

## Wave 4: UI Rendering Optimizations (After Wave 3 Phase 2)
**Worker:** ⚛️ React Perf Engineer
**Dependencies:** Wave 3 Phase 2 (Map→Record migration) must be complete — React.memo depends on stable prop references from Record selectors.
**Plan Docs:** `docs/plan-react-memoization.md` + `docs/fix-plan-ui-virtualization-dom-performance.md`
**Estimated scope:** ~15-20 files, ~600+ LOC + 1 new package

### Task 4A: React Memoization & Re-render Prevention
Execute in order:
1. Move static constants to module scope (zero-risk)
2. Add `React.memo` to 8+ components
3. Memoize computed values with `useMemo`
4. Convert MaestroPanel/SessionsSection handlers to `useCallback`
5. Extract `SessionItem` from `renderSessionItem` as memoized component
6. Extract `TaskNodeRenderer` from `renderTaskNode` as memoized component
7. Replace per-item inline closures in kanban views with ID-based callbacks

### Task 4B: UI Virtualization & DOM Performance (parallel with 4A)
Execute in order:
1. Install `@tanstack/react-virtual`
2. Virtualize SessionsSection history dropdown
3. Virtualize SortableTaskList (with dnd-kit integration)
4. Virtualize kanban column bodies
5. Virtualize AggregatedTimeline
6. Cache MermaidDiagram renders (init once, SVG cache)
7. Add CSS `contain: content` to scrollable containers
8. Add `content-visibility: auto` for list items
9. Lazy-load Dashboard charts with IntersectionObserver
10. Consolidate filter iterations (single-pass)

**COORDINATE:** Tasks 4A and 4B both touch SessionsSection — coordinate changes.

**Verification:** Load 200+ sessions/tasks, verify smooth scrolling. Test dnd-kit drag reorder across virtual boundaries.

---

## Wave 5: Build & Startup Optimizations (After Wave 4)
**Worker:** 📦 Build Bundle Engineer
**Dependencies:** Best after UI changes stabilize (Wave 4) so chunk config reflects final dependency graph.
**Plan Doc:** `docs/plan-build-bundle-startup-fixes.md`
**Estimated scope:** ~10 files, ~200+ LOC

Execute in order:
1. Add `manualChunks` to `vite.config.ts` for vendor splitting
2. `React.lazy` for Board, TeamView, CommandPalette in App.tsx
3. `React.lazy` for MermaidDiagram in DocViewer.tsx
4. Parallelize repository initialization in container.ts (`Promise.all`)
5. Add migration sentinel file
6. Parallelize worker-init API calls
7. Lazy spawner instantiation
8. Cache skill discovery results

**Verification:** Compare bundle sizes before/after. Verify lazy components load correctly. Measure server startup time.

---

## Task Dependency Graph

```
Wave 1 (PARALLEL — no dependencies)
├── 1A: Repo Caching & I/O ────────────┐
├── 1B: API Route N+1 & Pagination     │ (all independent)
└── 1C: Memory Leaks & Lifecycle ──────┘
                    │
                    ▼
Wave 2: WebSocket Pipeline (needs 1A caching)
                    │
              ┌─────┤ (can overlap)
              ▼     │
Wave 3: Zustand Store Overhaul ◄───────── Quick wins (Phase 1) can start immediately
              │
              ▼
Wave 4 (PARALLEL)
├── 4A: React Memoization ─────────────┐
└── 4B: UI Virtualization ─────────────┘ (coordinate on SessionsSection)
              │
              ▼
Wave 5: Build & Bundle (best after Wave 4)
```

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Zustand Map→Record breaks 30+ files | HIGH | TypeScript catches all `.get()`/`.has()` at compile time. Do one entity at a time. Run TS compilation after each. |
| Virtualization + dnd-kit conflicts | MEDIUM | Keep `SortableContext items` as full array; only virtualize DOM. Test drag at list boundaries. |
| WebSocket batching timing bugs | MEDIUM | Only batch pure state updates. Keep spawn/resume/sound immediate. |
| Store splitting (3B) breaks consumers | HIGH | DEFERRED — skip for this rollout. |
| Build chunk config stale | LOW | Do Wave 5 last after all code changes. |

---

## Testing Protocol (Per Wave)

1. **TypeScript compilation:** `cd maestro-ui && npx tsc --noEmit` + `cd maestro-server && npx tsc --noEmit`
2. **Server tests:** `cd maestro-server && npm test`
3. **Manual UI smoke test:**
   - Create/update/delete tasks
   - Create/resume/close sessions
   - Drag reorder tasks and sessions
   - Open multi-project board
   - View session logs
   - WebSocket real-time updates working
4. **Performance check:** React DevTools Profiler, Network tab, Memory tab

---

## Document Index

| Document | Path | Content |
|----------|------|---------|
| Consolidated Audit (150+ findings) | `docs/perf-audit/CONSOLIDATED-PERFORMANCE-AUDIT.md` | All worker findings |
| Final Execution Plan | `docs/perf-audit/FINAL-EXECUTION-PLAN.md` | 5-wave rollout strategy |
| Group 1: Zustand Overhaul Plan | `docs/zustand-state-management-overhaul-plan.md` | Detailed Map→Record migration |
| Group 2: React Memoization Plan | `docs/plan-react-memoization.md` | Component memoization strategy |
| Group 3: WebSocket Pipeline Plan | `/tmp/websocket-pipeline-fix-plan.md` | Batching, throttling, backpressure |
| Group 4: Repo Caching & I/O Plan | `docs/fix-plan-group4-server-repo-caching-io.md` | Cache additions, indexes, writes |
| Group 5: API N+1 & Pagination Plan | `docs/plan-api-route-n1-queries-pagination.md` | N+1 fixes, pagination, DTOs |
| Group 6: UI Virtualization Plan | `docs/fix-plan-ui-virtualization-dom-performance.md` | Virtual lists, CSS containment |
| Group 7: Memory Leaks Plan | `docs/fix-plan-memory-leaks.md` | Shutdown, eviction, timeouts |
| Group 8: Build & Bundle Plan | `docs/plan-build-bundle-startup-fixes.md` | Chunks, lazy loading, CLI |
| **This Coordination Plan** | `docs/perf-audit/COORDINATION-PLAN.md` | Team roster, task order, dependencies |

---

## Maestro Task Structure

```
Root Task: Performance Optimization Rollout
├── Wave 1A: Repository Caching & I/O
│   ├── Subtask: TeamMember/Team repo caching (P0)
│   ├── Subtask: Task repo LRU eviction (P0)
│   ├── Subtask: Parallel file reads + secondary indexes (P1)
│   └── Subtask: Write batching + atomic writes (P2)
│
├── Wave 1B: API Route N+1 & Pagination
│   ├── Subtask: Fix N+1 queries + reuse data (P0)
│   ├── Subtask: Add pagination to 12 endpoints (P1)
│   ├── Subtask: Summary DTOs + cache headers + compression (P1)
│   └── Subtask: Decompose spawn handler (P2)
│
├── Wave 1C: Memory Leaks & Lifecycle
│   ├── Subtask: WebSocketBridge shutdown + sessionIndex eviction (P0)
│   ├── Subtask: container.shutdown + child process mgmt (P0)
│   └── Subtask: Cache limits + CLI timeout + sound cleanup (P1)
│
├── Wave 2: WebSocket Pipeline
│   ├── Subtask: Core pipeline (batching + throttling + backpressure + decouple) (P0)
│   ├── Subtask: Lightweight status events (P1)
│   ├── Subtask: Client cleanup (consolidate WS + debounce + jitter) (P1)
│   └── Subtask: Server hardening (filters + connection limits) (P2)
│
├── Wave 3: Zustand Store Overhaul
│   ├── Subtask: Quick wins (early-exit, debounce, persistence filter) (P0)
│   ├── Subtask: Map→Record migration for all entities (P0 — biggest change)
│   ├── Subtask: useShallow + item-specific selectors (P1)
│   ├── Subtask: Separate dialog state (P2)
│   └── Subtask: WS batching in store + persistence dirty flags (P2)
│
├── Wave 4A: React Memoization
│   ├── Subtask: React.memo + constants + useMemo (P0)
│   ├── Subtask: useCallback + handler conversion (P1)
│   └── Subtask: Extract SessionItem + TaskNodeRenderer (P1)
│
├── Wave 4B: UI Virtualization
│   ├── Subtask: Install react-virtual + virtualize lists (P0)
│   ├── Subtask: MermaidDiagram cache + CSS containment (P0)
│   └── Subtask: Lazy Dashboard + filter consolidation (P1)
│
└── Wave 5: Build & Bundle
    ├── Subtask: Vite manualChunks + React.lazy (P0)
    ├── Subtask: Server startup parallelization (P1)
    └── Subtask: CLI optimizations (P1)
```

---

## Session Spawning Plan

Each wave spawns maestro sessions with the assigned team member:

| Wave | Team Member | Task Reference | Blocking |
|------|-------------|---------------|----------|
| Wave 1A | 🏎️ Server Perf Engineer | Repo Caching task | — |
| Wave 1B | 🏎️ Server Perf Engineer | API N+1 task | — |
| Wave 1C | 🏎️ Server Perf Engineer | Memory Leaks task | — |
| Wave 2 | 📡 WebSocket Pipeline Engineer | WebSocket task | Wave 1A |
| Wave 3 | 🧬 Zustand State Engineer | Zustand task | Wave 1 (partial) |
| Wave 4A | ⚛️ React Perf Engineer | React Memo task | Wave 3 Phase 2 |
| Wave 4B | ⚛️ React Perf Engineer | Virtualization task | Wave 3 Phase 1 |
| Wave 5 | 📦 Build Bundle Engineer | Build task | Wave 4 |

**Note:** Wave 1 tasks (1A, 1B, 1C) can all be spawned simultaneously as they operate on different files.
Wave 2 and Wave 3 can overlap — Wave 3 Quick Wins (Phase 1) start immediately.
Wave 4A and 4B can run in parallel but must coordinate on SessionsSection changes.
Wave 5 runs last after all UI changes stabilize.
