# Zustand Store Performance Audit

**Date:** 2026-03-09
**Scope:** `useMaestroStore.ts`, `useSessionStore.ts`, `useProjectStore.ts`, `useUIStore.ts`, `persistence.ts`
**Scale concern:** 200+ simultaneous sessions

---

## Executive Summary

The Zustand stores have several architectural strengths (batched WebSocket updates via `batchSet`, debounced persistence, `Record<id, entity>` shape for O(1) lookups in `useMaestroStore`). However, there are **critical performance issues** that compound at scale: components subscribing to entire entity maps, `useSessionStore` using an **array** instead of a map for sessions causing O(n) updates on hot paths, missing `useShallow` across the codebase, and derived data recomputed without memoization.

**Estimated impact at 200+ sessions:** Every WebSocket `session:status_changed` event (which fires frequently for active agents) triggers re-renders in 8+ components that subscribe to the full `sessions` record/array, each performing O(n) filtering/mapping on 200+ entries.

---

## Finding 1: `useSessionStore` Uses Array for Sessions — O(n) on Every Update

**Impact: HIGH** | **Files:** `useSessionStore.ts`

### Problem

`useSessionStore` stores sessions as `sessions: TerminalSession[]` (line 71). Nearly every mutation requires a full `sessions.map()` to find and update a single session:

```ts
// Line ~408 – called on EVERY terminal output chunk
set((s) => ({
  sessions: s.sessions.map((s2) =>
    s2.id === id ? { ...s2, agentWorking: true, ... } : s2,
  ),
}));
```

**Hot paths affected:**
- `markAgentWorkingFromOutput` (line 408) — called on every terminal output chunk. With 10 active agents producing output, this fires hundreds of times per second, each doing O(n) map over 200+ sessions.
- `onCwdChange` (line 460) — called on every directory change OSC event
- `onCommandChange` (line 480) — called on every command lifecycle OSC event
- `onSessionResize` (line 450) — called on terminal resize

### Impact at Scale

With 200 sessions and 10 active agents outputting data:
- ~100+ `set()` calls/sec × O(200) map = **20,000+ array operations/sec**
- Each creates a new 200-element array + new session object
- Every subscriber re-renders because array reference changes

### Fix Recommendation

Convert `sessions` from `TerminalSession[]` to `Record<string, TerminalSession>` (matching `useMaestroStore`'s pattern). Updates become O(1):

```ts
set((prev) => ({
  sessions: { ...prev.sessions, [id]: { ...prev.sessions[id], agentWorking: true } }
}));
```

Components that need arrays can derive them via selectors. The exported imperative selectors (`getProjectSessions`, `getSortedSessions`, etc.) would need updating but benefit from the same O(1) lookup.

---

## Finding 2: Components Subscribe to Entire Entity Maps

**Impact: HIGH** | **Files:** `SessionsSection.tsx`, `App.tsx`, `MultiProjectBoard.tsx`, `CreateTaskModal.tsx`, `ExportToTaskPicker.tsx`

### Problem

Multiple components subscribe to entire `Record<string, T>` objects from `useMaestroStore`. Any change to ANY entity in the map causes a re-render, even if the component only cares about entities for the current project.

**Worst offenders:**

| File | Line(s) | Selector | Impact |
|------|---------|----------|--------|
| `SessionsSection.tsx` | 554-562 | `s.tasks`, `s.sessions`, `s.teams`, `s.teamMembers` | **4 full-map subscriptions** — re-renders on any entity change |
| `App.tsx` | 273, 308 | `s.sessions`, `s.teams` | **Root component** — cascades to entire tree |
| `MultiProjectBoard.tsx` | 72-73 | `s.sessions`, `s.teamMembers` | Re-renders on any session update |
| `ExportToTaskPicker.tsx` | 14 | `s.tasks` | Re-renders on any task change |
| `CreateTaskModal.tsx` | 90-91 | `s.tasks`, `s.teamMembers` | Re-renders when modal is open |
| `SessionDetailModal.tsx` | 51 | `s.tasks` | Full task map subscription |

### Impact at Scale

With 200+ sessions sending status updates every few seconds, `useMaestroStore(s => s.sessions)` causes continuous re-renders in 6+ components simultaneously. The `sessions` Record reference changes on every WebSocket event.

### Fix Recommendation

1. **Create project-scoped selectors** that return stable references:

```ts
// In useMaestroStore or a selectors file
export const useProjectTasks = (projectId: string) =>
  useMaestroStore(useShallow((s) => {
    const result: MaestroTask[] = [];
    for (const task of Object.values(s.tasks)) {
      if (task.projectId === projectId) result.push(task);
    }
    return result;
  }));
```

2. **For single-entity access**, use ID-based selectors (already done well in some places):
```ts
const session = useMaestroStore((s) => s.sessions[sessionId]); // Good ✓
```

3. **For `App.tsx`**, move entity-map subscriptions into child components that actually need them.

---

## Finding 3: Missing `useShallow` Across Codebase

**Impact: HIGH** | **Files:** `App.tsx`, `AppModals.tsx`, `AppWorkspace.tsx`, `CommandPalette.tsx`, `SessionsSection.tsx`

### Problem

Many components use multiple individual selectors on the same store instead of a single `useShallow` call. Each selector creates a separate subscription that checks for updates independently. While individual scalar selectors (returning strings, booleans) are actually fine, object-returning selectors without `useShallow` break reference equality.

**Examples:**

`App.tsx` lines 197-206 — 9 separate `useProjectStore` subscriptions:
```ts
const projects = useProjectStore((s) => s.projects);     // returns array — new ref
const activeProjectId = useProjectStore((s) => s.activeProjectId);  // scalar — ok
const selectProject = useProjectStore((s) => s.selectProject);      // function — stable
// ... 6 more
```

`App.tsx` lines 226-232 — 7 separate `useSessionStore` subscriptions:
```ts
const sessions = useSessionStore((s) => s.sessions);    // returns array — new ref every update
const activeId = useSessionStore((s) => s.activeId);
// ... 5 more
```

`AppModals.tsx` lines 54-70 — **17 separate** `useSessionStore` subscriptions.

### Fix Recommendation

Consolidate with `useShallow` where selectors return objects/arrays:

```ts
const { sessions, activeId, setActiveId, onClose } = useSessionStore(
  useShallow((s) => ({
    sessions: s.sessions,
    activeId: s.activeId,
    setActiveId: s.setActiveId,
    onClose: s.onClose,
  }))
);
```

**Note:** Selectors returning scalars or stable function references are fine as individual selectors. Focus `useShallow` on selectors returning arrays, objects, or multiple values.

---

## Finding 4: Derived Data Computed Without Memoization in Selectors

**Impact: MEDIUM** | **Files:** `useSessionStore.ts` (exported selectors), `SessionsSection.tsx`, `ExportToTaskPicker.tsx`

### Problem

Exported imperative selectors in `useSessionStore` perform filtering and sorting on every call without caching:

| Selector | Line | Operation | Cost |
|----------|------|-----------|------|
| `getProjectSessions(projectId)` | 170 | `sessions.filter()` | O(n) |
| `getSessionCountByProject(projectId)` | 175 | calls `getProjectSessions` | O(n) |
| `getWorkingAgentCountByProject(projectId)` | 179 | calls `getProjectSessions` + filter | O(n) + O(m) |
| `getSortedSessions(projectId)` | 264 | `filter() + sort()` | O(n) + O(m log m) |
| `getCommandSuggestions(ids)` | 223 | `slice().sort()` + dedup | O(n log n) |

If a component calls both `getSessionCountByProject` and `getWorkingAgentCountByProject`, it filters the sessions array **twice**.

Components also re-derive data from full maps:

```ts
// SessionsSection.tsx:583-588
const historySessions = useMemo(() => {
  return Object.values(maestroSessions)           // O(n) — creates new array from 200+ sessions
    .filter(s => s.projectId === activeProjectId)  // O(n)
    .sort((a, b) => b.lastActivity - a.lastActivity); // O(m log m)
}, [maestroSessions, activeProjectId]);
// ^^^ `maestroSessions` changes on every WS event, so this recomputes constantly
```

### Fix Recommendation

1. **Create memoized selector hooks** for common derivations:

```ts
export function useProjectSessions(projectId: string) {
  return useMaestroStore(
    useCallback((s) => {
      // Only re-renders when the specific sessions for this project change
      const result: MaestroSession[] = [];
      for (const session of Object.values(s.sessions)) {
        if (session.projectId === projectId) result.push(session);
      }
      return result;
    }, [projectId]),
    shallow
  );
}
```

2. **Cache imperative selectors** using a simple memoization pattern if they're called repeatedly in the same render cycle.

---

## Finding 5: `useMaestroStore` Is a God Store (~1150 lines)

**Impact: MEDIUM** | **File:** `useMaestroStore.ts`

### Problem

`useMaestroStore` manages 6 different entity types (tasks, taskLists, sessions, teamMembers, teams, workflowTemplates) plus ordering, modals, loading/error states, WebSocket connection, and `lastUsedTeamMember`. Every entity update notifies every subscriber.

**State shape:**
```ts
interface MaestroState {
  tasks: Record<string, MaestroTask>;          // Can be 100s of tasks
  taskLists: Record<string, TaskList>;
  sessions: Record<string, MaestroSession>;    // 200+ sessions
  teamMembers: Record<string, TeamMember>;
  teams: Record<string, Team>;
  activeModals: AgentModal[];
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  wsConnected: boolean;
  taskOrdering: Record<string, string[]>;
  sessionOrdering: Record<string, string[]>;
  taskListOrdering: Record<string, string[]>;
  workflowTemplates: WorkflowTemplate[];
  lastUsedTeamMember: Record<string, string>;
  // + 40+ action methods
}
```

A `session:status_changed` WebSocket event updates `sessions`, which triggers re-evaluation of selectors for components that only care about `tasks` or `teams`.

### Fix Recommendation

Consider splitting into domain-specific stores:
- `useMaestroTaskStore` — tasks, taskLists, taskOrdering
- `useMaestroSessionStore` — sessions (maestro-side), sessionOrdering
- `useMaestroTeamStore` — teams, teamMembers
- Keep `useMaestroStore` as a thin coordinator for WebSocket + shared state

This isolates update notifications to their domain. A `session:updated` event won't trigger re-renders in task-only components.

**Alternative (lower effort):** Keep the single store but enforce that all consumers use narrow selectors (e.g., `s => s.tasks[taskId]` instead of `s => s.tasks`). Zustand's `Object.is` comparison means scalar/reference-stable selectors won't cause re-renders.

---

## Finding 6: WebSocket `session:status_changed` Spreads Entire Sessions Map

**Impact: MEDIUM** | **File:** `useMaestroStore.ts:289-296`

### Problem

```ts
case 'session:status_changed': {
  const { id, status, lastActivity, needsInput } = message.data;
  const existing = get().sessions[id];
  if (existing) {
    const updated = { ...existing, status, lastActivity, needsInput };
    batchSet((prev) => ({ sessions: { ...prev.sessions, [id]: updated } }));
  }
  break;
}
```

This creates `{ ...prev.sessions, [id]: updated }` — a **shallow copy of the entire sessions map** (200+ entries) for every status change. With 10 active agents sending status changes every few seconds, this creates significant GC pressure.

### Fix Recommendation

Use an **immer-like patch** approach or a **normalized map with reference stability**:

```ts
// Option A: Check if values actually changed before spreading
if (existing.status === status && existing.lastActivity === lastActivity &&
    existing.needsInput === needsInput) break;

// Option B: Use Map instead of plain object for O(1) updates without spreading
// (requires custom equality in selectors)
```

The `batchSet` mechanism already helps (batching N events into 1 `set()`), but the merged update still creates a new sessions object.

---

## Finding 7: Persistence Subscribes to Entire Stores

**Impact: MEDIUM** | **File:** `persistence.ts:164-173`

### Problem

```ts
const unsubs = [
  useProjectStore.subscribe(markDirtyAndSave('project')),
  useSessionStore.subscribe(markDirtyAndSave('session')),
  // ... 5 more stores
];
```

Every state change in `useSessionStore` (including `agentWorking` toggles, terminal output markers, form field changes) triggers `scheduleSave()`. While `scheduleSave` has a quick-hash check and 400ms debounce, it still:

1. Calls `useSessionStore.getState()` to build the hash
2. Calls `sessions.map()` to build persist IDs
3. If hash changed: calls `buildPersistedState()` which does **another** `sessions.map()` with field extraction

At 200+ sessions with active terminal output, `markDirtyAndSave('session')` fires hundreds of times per second. The debounce prevents actual saves, but the hash computation runs on every fire.

### Fix Recommendation

1. **Subscribe with a selector** instead of the full store:
```ts
useSessionStore.subscribe(
  (state) => state.sessions.length, // Only trigger on session count change
  markDirtyAndSave('session')
);
```

2. **Or use `subscribeWithSelector` middleware** to only react to persist-relevant fields (session count, persist IDs, closing status).

3. **Move the quick-hash into the subscription selector** so it short-circuits before `scheduleSave` is even called.

---

## Finding 8: `useSessionStore` Exported Selectors Have O(n²) Patterns

**Impact: LOW** | **File:** `useSessionStore.ts:1221-1237`

### Problem

`reorderSessions` uses `projectSessionPersistIds.includes()` inside a filter loop:

```ts
// Conceptually:
sessions.filter(s => projectSessionPersistIds.includes(s.persistId))
```

`Array.includes()` is O(m) per call, inside an O(n) filter = O(n×m). With 200 sessions and 50 project sessions, this is 10,000 comparisons.

### Fix Recommendation

Convert `projectSessionPersistIds` to a `Set` for O(1) lookups.

---

## Finding 9: `useProjectStore` Cross-Store Access in Actions

**Impact: LOW** | **File:** `useProjectStore.ts`

### Problem

Multiple actions call `useSessionStore.getState()` for imperative reads (lines 48, 81, 101, 118, etc.) and `useUIStore.getState()`. This is the correct Zustand pattern for cross-store access (no subscription, just a snapshot read), so it does **not** cause re-renders.

However, `pickActiveSessionId` (line 47-55) does `sessions.find()` every time it's called. With 200 sessions, this is O(200) per project switch.

### Fix Recommendation

No urgent fix needed. If project switching feels slow, add an index/map of `projectId → sessionIds` to `useSessionStore`.

---

## Finding 10: `lastUsedTeamMember` Grows Unbounded

**Impact: LOW** | **File:** `useMaestroStore.ts:1049-1064`

### Problem

`lastUsedTeamMember: Record<string, string>` maps `taskId → teamMemberId` and is persisted to `localStorage`. Over time, as tasks are created and deleted, this map grows with stale entries that are never cleaned up. Each `setLastUsedTeamMember` call spreads the entire map.

### Fix Recommendation

1. Add periodic cleanup that removes entries for deleted task IDs.
2. Cap the map size (e.g., LRU of last 500 entries).
3. Consider using `Map` with a size limit.

---

## Summary Table

| # | Finding | Impact | Effort to Fix |
|---|---------|--------|---------------|
| 1 | `useSessionStore` uses array instead of map | HIGH | Medium — requires updating all consumers |
| 2 | Components subscribe to entire entity maps | HIGH | Low — add project-scoped selectors |
| 3 | Missing `useShallow` across codebase | HIGH | Low — mechanical refactor |
| 4 | Derived data computed without memoization | MEDIUM | Low — create memoized hooks |
| 5 | `useMaestroStore` is a god store | MEDIUM | High — store splitting |
| 6 | `session:status_changed` copies entire map | MEDIUM | Low — add equality check |
| 7 | Persistence subscribes to entire stores | MEDIUM | Low — use selective subscriptions |
| 8 | O(n²) in `reorderSessions` | LOW | Trivial — use Set |
| 9 | Cross-store reads in actions (correct pattern) | LOW | N/A |
| 10 | `lastUsedTeamMember` grows unbounded | LOW | Low — add cleanup |

---

## Recommended Priority Order

1. **Finding 2 + 3** (Quick wins): Add `useShallow` and project-scoped selectors. Immediate reduction in unnecessary re-renders.
2. **Finding 6** (Quick win): Add equality check in `session:status_changed` handler to skip no-op updates.
3. **Finding 1** (Biggest impact): Convert `useSessionStore.sessions` from array to `Record<string, TerminalSession>`. Eliminates O(n) maps on hot paths.
4. **Finding 4** (Medium effort): Create memoized selector hooks for common derivations.
5. **Finding 7** (Medium effort): Optimize persistence subscriptions to use selectors.
6. **Finding 5** (Long-term): Consider splitting `useMaestroStore` by domain.
