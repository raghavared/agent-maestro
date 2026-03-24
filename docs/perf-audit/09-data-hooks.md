# Data Hooks & Derived State Performance Audit

**Date:** 2026-03-09
**Scope:** `useDashboardData.ts`, `useMultiProjectTasks.ts`, `useSessionTasks.ts`, `useTaskSessions.ts`, `useSubtaskProgress.ts`, `useTaskBreadcrumb.ts`, `useKeyboardShortcuts.ts`, `useTaskLists.ts`, `useTeamActions.ts`, `useTeamMemberActions.ts`, `useTasks.ts`, `useTaskSessionCount.ts`
**Scale concern:** 200+ tasks, 200+ sessions, frequent WebSocket updates

---

## Executive Summary

The data hooks layer shows a mixed picture. Several hooks correctly use `useShallow` and `useMemo` for derived state. However, there are **significant performance issues** across the hook family: selectors inside `useShallow` that perform O(n) full-map scans on every state change, missing referential stability causing cascading re-renders, expensive dashboard computations that re-run on any task/session mutation, and a keyboard shortcuts hook that re-registers listeners on 23 separate state changes. The hooks also trigger redundant API fetches and lack deduplication.

**Estimated impact at scale:** With 200+ tasks and frequent WebSocket-driven store updates, hooks like `useSubtaskProgress`, `useTaskSessionCount`, and `useTaskSessions` perform full `Object.values()` scans inside selectors — these run on *every* store update, not just relevant ones. The dashboard hook performs ~15 separate array filter/map passes over the full task set on each recomputation.

---

## Finding 1: `useSubtaskProgress` — Expensive Computation Inside Selector

**Impact: HIGH** | **File:** `useSubtaskProgress.ts`

### Problem

The selector passed to `useShallow` iterates over **all tasks** in the store on every state change:

```ts
useShallow((s) => {
  if (!taskId) return EMPTY;
  let total = 0, completed = 0;
  for (const t of Object.values(s.tasks)) {  // O(n) over ALL tasks
    if (t.parentId === taskId) { total++; ... }
  }
  ...
})
```

This selector runs every time *any* part of `useMaestroStore` changes (task created, session updated, team member modified, etc.), not just when subtasks of the target task change. With 200+ tasks, this is an O(200) scan on every store mutation.

**Compounding factor:** This hook is used in `TaskTabBar` and `SubtasksTab` — components rendered inside task modals. If the modal is open while agents are actively updating sessions, the selector fires continuously.

### Fix

Replace with a `useMemo` approach that subscribes only to `s.tasks`:

```ts
export function useSubtaskProgress(taskId: string | null) {
  const tasks = useMaestroStore(s => s.tasks);
  return useMemo(() => {
    if (!taskId) return EMPTY;
    let total = 0, completed = 0;
    for (const t of Object.values(tasks)) {
      if (t.parentId === taskId) { total++; if (t.status === 'completed') completed++; }
    }
    if (total === 0) return EMPTY;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [tasks, taskId]);
}
```

Better yet, maintain a `childrenByParent` index in the store for O(1) lookup.

---

## Finding 2: `useTaskSessionCount` — O(n) Session Scan in Selector

**Impact: HIGH** | **File:** `useTaskSessionCount.ts`

### Problem

Uses `useCallback` as a selector (correct for primitive return), but scans all sessions on every store mutation:

```ts
useCallback((s) => {
  if (!taskId) return 0;
  let count = 0;
  for (const session of Object.values(s.sessions)) {
    if (session.taskIds?.includes(taskId)) count++;  // O(sessions × taskIds)
  }
  return count;
}, [taskId])
```

`session.taskIds?.includes(taskId)` is itself O(k) where k = number of tasks per session. Total cost: O(sessions × avgTasksPerSession) on every store change.

Since this returns a primitive number, Zustand correctly skips re-render when the count hasn't changed. However, the computation itself still runs on every state update.

### Fix

Subscribe only to `s.sessions` via a separate selector, then compute in `useMemo`:

```ts
const sessions = useMaestroStore(s => s.sessions);
return useMemo(() => {
  if (!taskId) return 0;
  let count = 0;
  for (const session of Object.values(sessions)) {
    if (session.taskIds?.includes(taskId)) count++;
  }
  return count;
}, [sessions, taskId]);
```

Or maintain a `sessionsByTaskId` reverse index in the store.

---

## Finding 3: `useTaskSessions` — Full Session Scan + Redundant Fetch

**Impact: HIGH** | **File:** `useTaskSessions.ts`

### Problem

1. **O(n) full scan:** `Object.values(sessions).filter(s => s.taskIds.includes(taskId))` scans all sessions, not just those for the target task.

2. **Fetch on every mount:** `fetchSessions(taskId)` fires on every mount. Multiple components use this hook for the same task simultaneously (`TaskListItem`, `TaskTabBar`, `SessionsTab`, `TimelineTab`) — all fire separate API calls for the same data.

3. **Broad subscription:** Uses `useShallow` on `{ sessions, loadingSet, errors, fetchSessions }` — the `sessions` record reference changes on any session mutation, triggering recomputation even for unrelated sessions.

### Consumers (all fire separate fetches for same taskId)
- `TaskListItem.tsx:226` — renders for every task in a list
- `TaskTabBar.tsx:28`
- `SessionsTab.tsx:13`
- `TimelineTab.tsx:10`

### Fix

- Add fetch deduplication: track in-flight requests by key to prevent duplicate API calls.
- Use a narrower selector: subscribe to a derived `sessionsByTaskId` index instead of the full sessions map.
- Consider a `useQuery`-style cache with stale-while-revalidate.

---

## Finding 4: `useDashboardData` — ~15 Array Passes on Every Task Change

**Impact: MEDIUM-HIGH** | **File:** `useDashboardData.ts`

### Problem

The single `useMemo` block performs approximately **15 separate `.filter()` and `.map()` passes** over the tasks array and **4 passes** over sessions:

```ts
// Filtering passes over filteredTasks (lines 178-183):
filteredTasks.filter(t => t.status === 'completed')   // pass 1
filteredTasks.filter(t => t.status === 'in_progress')  // pass 2
filteredTasks.filter(t => t.status === 'blocked')      // pass 3
filteredTasks.filter(t => t.status === 'todo')         // pass 4
filteredTasks.filter(t => t.status === 'in_review')    // pass 5
filteredTasks.filter(t => t.status === 'cancelled')    // pass 6
filteredTasks.filter(t => t.dueDate)                   // pass 7
// ... plus priority filters (3 more), team member filters (N more)
```

With 200 tasks, that's ~3000 iterations just for the status/priority counts. The `dailyData` section creates **per-day** filter passes: for a 90-day range, that's 4 filters × 90 days = 360 additional passes.

### Additional Issues

- **`eachDayOfInterval` for "all" time range** (line 217-223): Uses `Math.min(...filteredTasks.map(...))` with spread operator — this creates a temporary array, then spreads it as arguments. For 200+ tasks, this can hit stack limits.
- **`format()` called inside loops** (lines 290-298): `date-fns` `format()` is relatively expensive. Called once per task per day for calendar heatmap construction.
- **No short-circuit:** If no dashboard is visible, the computation still runs because it's unconditionally executed by the parent `Dashboard` component.

### Fix

Replace multiple `.filter()` passes with a single-pass accumulator:

```ts
const counts = { completed: 0, in_progress: 0, blocked: 0, todo: 0, in_review: 0, cancelled: 0 };
const priorityCounts = { high: 0, medium: 0, low: 0 };
for (const task of filteredTasks) {
  counts[task.status]++;
  priorityCounts[task.priority]++;
}
```

For `dailyData`, build a date-indexed Map in a single pass instead of per-day filtering.

---

## Finding 5: `useMultiProjectTasks` — `projectIds` Array Reference Instability

**Impact: MEDIUM** | **File:** `useMultiProjectTasks.ts`

### Problem

The `useEffect` depends on `projectIds` (an array). If the caller creates a new array reference on every render (e.g., `[id1, id2]` inline), the effect runs on every render, triggering `fetchTasks` for all projects:

```ts
useEffect(() => {
  for (const projectId of projectIds) {
    fetchTasks(projectId);  // fires for ALL projects on every render
  }
}, [projectIds, fetchTasks]);  // new array ref = new effect
```

The `useMemo` for `boardTasks` also depends on `projectNames` and `projectColors` (Maps) — if the caller recreates these Maps each render, the memo is invalidated every time.

### Fix

- Use `useMemo` or `useRef` at the call site to stabilize `projectIds`/`projectNames`/`projectColors`.
- Inside the hook, serialize `projectIds` to a string key for effect comparison:

```ts
const projectIdsKey = projectIds.join(',');
useEffect(() => {
  for (const projectId of projectIds) fetchTasks(projectId);
}, [projectIdsKey, fetchTasks]);
```

---

## Finding 6: `useKeyboardShortcuts` — 23-Dependency Effect Re-registration

**Impact: MEDIUM** | **File:** `useKeyboardShortcuts.ts`

### Problem

The hook subscribes to **23 individual store selectors** as reactive state, all used as effect dependencies:

```ts
const newOpen = useSessionStore(s => s.newOpen);
const sshManagerOpen = useSshStore(s => s.sshManagerOpen);
// ... 21 more individual subscriptions
```

These are all used as dependencies of a single `useEffect` that adds/removes a `keydown` listener:

```ts
useEffect(() => {
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}, [newOpen, sshManagerOpen, agentShortcutsOpen, ... /* 23 deps */]);
```

**Every time any modal opens/closes**, the event listener is torn down and re-attached. This means:
1. During rapid modal transitions, the listener bounces repeatedly.
2. Each re-registration creates a new closure capturing all 23 state values.

### What's Done Right

The handler correctly uses `getState()` for non-modal data (sessions, projects) to avoid stale closures — line 184-186. This is the correct pattern and should be extended to modal state.

### Fix

Move modal-open checks inside the handler using `getState()`, eliminating all 23 reactive subscriptions:

```ts
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    const modalOpen =
      useSessionStore.getState().newOpen ||
      useSshStore.getState().sshManagerOpen ||
      // ... check all modals via getState()
    ;
    // ... handler logic
  };
  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}, []); // stable — never re-registers
```

This reduces 23 subscriptions and effect re-runs to zero, while maintaining correctness since the handler runs on every keypress anyway.

---

## Finding 7: `useSessionTasks` — Broad Store Subscription

**Impact: MEDIUM** | **File:** `useSessionTasks.ts`

### Problem

Subscribes to `sessions` and `tasks` maps via `useShallow`:

```ts
useShallow(s => ({ sessions: s.sessions, tasks: s.tasks, ... }))
```

The `useMemo` correctly filters, but the memo dependency on `sessions` and `tasks` means it recomputes whenever *any* session or task changes, not just the ones relevant to the target `sessionId`.

### Fix

Extract only the needed session first, then use its `taskIds` to pull specific tasks:

```ts
const session = useMaestroStore(s => sessionId ? s.sessions[sessionId] : null);
const tasks = useMaestroStore(s => s.tasks);
const sessionTasks = useMemo(() => {
  if (!session) return [];
  return session.taskIds.map(id => tasks[id]).filter(Boolean);
}, [session, tasks]);
```

This way changes to unrelated sessions don't trigger recomputation.

---

## Finding 8: `useTaskLists` — Missing List Ordering O(n²)

**Impact: LOW-MEDIUM** | **File:** `useTaskLists.ts`

### Problem

The ordering logic has an O(n²) step:

```ts
const missing = lists.filter(list => !ordering.includes(list.id));
//                                    ^^^^^^^^^^^^^^^^ O(n) per list
```

`ordering.includes(list.id)` is O(m) where m = ordering length. For n lists with m ordering entries, this is O(n×m). Should use a Set.

Also, both `fetchTaskLists` and `fetchTaskListOrdering` fire on mount — two separate API calls that could potentially be combined.

### Fix

```ts
const orderingSet = new Set(ordering);
const missing = lists.filter(list => !orderingSet.has(list.id));
```

---

## Finding 9: `useTeamActions` / `useTeamMemberActions` — `wsConnected` as Fetch Trigger

**Impact: LOW-MEDIUM** | **Files:** `useTeamActions.ts`, `useTeamMemberActions.ts`

### Problem

Both hooks use `wsConnected` as an effect dependency for fetching:

```ts
useEffect(() => {
  if (projectId) fetchTeams(projectId);
}, [projectId, fetchTeams, wsConnected]);  // refetches on WS reconnect
```

While the intent (refetch on reconnect) is valid, `wsConnected` toggles multiple times during connection setup (false → true), and during reconnection cycles it can bounce rapidly, causing redundant fetches.

Additionally, `useTeamActions` computes three derived arrays:

```ts
const teams = useMemo(() => Object.values(teamsMap).filter(...), [teamsMap, projectId]);
const activeTeams = useMemo(() => teams.filter(t => t.status === 'active'), [teams]);
const topLevelTeams = useMemo(() => { ... }, [teams]);
```

The memo chain is correct — `activeTeams` and `topLevelTeams` depend on `teams`, so they only recompute when `teams` changes. However, `teamsMap` changes on any team update across all projects.

### Fix

- Debounce the `wsConnected` refetch or use a `wsReconnectCount` counter that only increments.
- Filter `teamsMap` by projectId inside the selector to narrow the subscription.

---

## Finding 10: `useTasks` — Redundant with `useMultiProjectTasks` Pattern

**Impact: LOW** | **File:** `useTasks.ts`

### Problem

`useTasks` subscribes to the full `tasks` record and filters by `projectId`:

```ts
const filteredTasks = useMemo(() => {
  return Object.values(tasks).filter(task => task.projectId === projectId);
}, [tasks, projectId]);
```

This is the same pattern as `useMultiProjectTasks` but for a single project. Both subscribe to the entire `tasks` record, meaning any task update (even for unrelated projects) triggers recomputation.

The hook is architecturally correct but would benefit from a store-level index.

### Fix

Maintain a `tasksByProjectId: Record<string, string[]>` index in the store for O(1) lookup.

---

## Summary Matrix

| # | Hook | Issue | Impact | Fix Complexity |
|---|------|-------|--------|----------------|
| 1 | `useSubtaskProgress` | O(n) scan inside selector runs on every store change | HIGH | Low — move to useMemo |
| 2 | `useTaskSessionCount` | O(n×k) scan inside selector on every store change | HIGH | Low — move to useMemo |
| 3 | `useTaskSessions` | Full session scan + no fetch deduplication, 4 consumers | HIGH | Medium — add dedup + index |
| 4 | `useDashboardData` | ~15 array filter passes, per-day filtering, no lazy eval | MED-HIGH | Medium — single-pass accumulation |
| 5 | `useMultiProjectTasks` | Array ref instability triggers refetch on every render | MEDIUM | Low — stabilize deps |
| 6 | `useKeyboardShortcuts` | 23 reactive subs, listener re-registration on modal toggle | MEDIUM | Low — use getState() |
| 7 | `useSessionTasks` | Subscribes to all sessions/tasks, recomputes on any change | MEDIUM | Low — narrow selector |
| 8 | `useTaskLists` | O(n²) ordering lookup | LOW-MED | Trivial — use Set |
| 9 | `useTeamActions/MemberActions` | wsConnected bounce triggers redundant fetches | LOW-MED | Low — debounce/counter |
| 10 | `useTasks` | Full task map subscription | LOW | Medium — store index |

---

## Recommended Priority Order

1. **Finding 6** (useKeyboardShortcuts) — Quickest win, eliminates 23 subscriptions with a simple refactor to `getState()`.
2. **Finding 1 & 2** (useSubtaskProgress, useTaskSessionCount) — Move expensive computation out of selectors into `useMemo`. Eliminates unnecessary work on every store mutation.
3. **Finding 3** (useTaskSessions) — Add fetch deduplication to prevent 4× redundant API calls from sibling components.
4. **Finding 4** (useDashboardData) — Single-pass accumulation. Only matters when dashboard is visible but significant when it is.
5. **Finding 5 & 7** (useMultiProjectTasks, useSessionTasks) — Stabilize deps and narrow selectors.
6. **Findings 8-10** — Lower priority quality improvements.

---

## Architectural Recommendation: Store-Level Indexes

Many findings stem from the same root cause: the store holds flat `Record<id, entity>` maps, forcing hooks to perform O(n) scans to find related entities. Adding reverse indexes would eliminate most of these issues:

```ts
// In useMaestroStore:
tasksByProjectId: Record<string, Set<string>>;     // projectId → taskIds
tasksByParentId: Record<string, Set<string>>;       // parentId → childTaskIds
sessionsByTaskId: Record<string, Set<string>>;      // taskId → sessionIds
```

These indexes should be maintained atomically alongside entity mutations (in `createTask`, `updateTask`, WebSocket handlers, etc.). This is a larger refactor but addresses Findings 1, 2, 3, 7, and 10 at the root.
