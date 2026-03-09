# Zustand Store Performance Audit

**Date:** 2026-03-09
**Scope:** All stores in `maestro-ui/src/stores/`
**Stores analyzed:** 19 files (16 Zustand stores, persistence.ts, initApp.ts)

---

## Executive Summary

The codebase correctly uses **selectors everywhere** (zero instances of subscribing to entire stores), which is excellent. However, there are **critical performance issues** in how state is structured, how Maps are cloned on every WebSocket event, and how high-frequency updates trigger cascading re-renders. The biggest wins come from:

1. Fixing the `new Map()` cloning pattern in `useMaestroStore` (57 occurrences)
2. Reducing re-renders from high-frequency PTY output in `useSessionStore`
3. Splitting oversized stores that mix unrelated concerns
4. Adding `useShallow` where multiple selectors hit the same store

---

## CRITICAL Issues

### C1. useMaestroStore: `new Map()` cloning on every WebSocket event

**File:** `maestro-ui/src/stores/useMaestroStore.ts`
**Lines:** 192, 198, 204, 211, 221, 230, 248, 364, 374, 389, 393, 404, 409, 511-519, 537, 551-558, 601-603, 619, 636, 645, 651, 656, 669-670, 686-693, 700, 706, 721-723, 729, 742-743, 750, 854, 866, 877, 890, 903, 914, 934-942, 954, 960, 967-969, 1008-1016, 1028, 1035, 1041-1043
**Count:** **57 occurrences**

**Issue:** Every WebSocket message (task:updated, session:updated, etc.) creates a new Map copy:
```ts
set((prev) => ({ tasks: new Map(prev.tasks).set(taskData.id, taskData) }));
```
`new Map(prev.tasks)` iterates and copies **all entries** into a new Map. With 100 tasks, each task update copies 100 entries just to update 1. This happens for tasks, sessions, teamMembers, teams, taskLists, loading (Set), errors, and orderings.

**Impact:** With active WebSocket events (especially session:updated for agent heartbeats), this creates significant GC pressure and triggers re-renders in every component subscribing to the Map — even if they only care about 1 specific item.

**Fix:**
Option A (Minimal) — Use Immer middleware or zustand's `produce`:
```ts
import { produce } from 'immer';
set(produce((state) => { state.tasks.set(taskData.id, taskData); }));
```

Option B (Better) — Switch from `Map<string, T>` to plain `Record<string, T>` with shallow spreads. Plain objects work better with React's shallow comparison:
```ts
// State type
tasks: Record<string, MaestroTask>;
// Update
set((prev) => ({ tasks: { ...prev.tasks, [task.id]: task } }));
```

Option C (Best) — Use a normalized store with entity adapters that only update the specific slice.

---

### C2. useMaestroStore: `loading` and `errors` cloned on every fetch

**File:** `maestro-ui/src/stores/useMaestroStore.ts`
**Lines:** 146-151 (setLoading), 153-158 (setError)

**Issue:**
```ts
const setLoading = (key: string, isLoading: boolean) => {
  set((prev) => {
    const loading = new Set(prev.loading); // copies entire Set
    if (isLoading) loading.add(key); else loading.delete(key);
    return { loading };
  });
};
```
Every API call creates a copy of the entire `loading` Set and `errors` Map, triggering re-renders for all loading subscribers.

**Fix:** Use a simple `Record<string, boolean>` for loading state, and batch loading start/end into the same `set()` call with the data:
```ts
// Combine into single set call:
set((prev) => ({
  tasks: updatedTaskMap,
  loading: { ...prev.loading, [key]: false },
}));
```

---

### C3. useSessionStore: `markAgentWorkingFromOutput` called on EVERY PTY output chunk

**File:** `maestro-ui/src/stores/useSessionStore.ts`
**Lines:** ~103 (interface), implementation in store

**Issue:** `markAgentWorkingFromOutput(id, text)` is called from the `pty-output` listener for every single output chunk. Inside, it does:
```ts
setSessions((prev) => prev.map((s) =>
  s.id === id ? { ...s, agentWorking: true } : s
));
```
This replaces the entire `sessions` array on every PTY chunk, even when `agentWorking` is already `true`. With multiple active sessions producing output, this causes constant re-renders.

**Fix:** Add an early-exit guard:
```ts
markAgentWorkingFromOutput: (id, data) => {
  const session = get().sessions.find(s => s.id === id);
  if (!session || session.agentWorking) return; // Already marked
  // ... only update if actually changing
}
```

---

### C4. useSessionStore: Sessions as flat array (O(n) lookups)

**File:** `maestro-ui/src/stores/useSessionStore.ts`
**Lines:** 71 (sessions: TerminalSession[])

**Issue:** `sessions` is a flat array. Every operation does `.find()` (O(n)) or `.map()` (O(n) copy) to update a single session. With many sessions, this is inefficient. Every `.map()` creates a new array reference, triggering re-renders for ALL subscribers to `sessions`.

**Fix:** Normalize sessions into a `Record<string, TerminalSession>` (or Map) with a separate `sessionOrder: string[]` for ordering:
```ts
sessionsById: Record<string, TerminalSession>;
sessionIds: string[]; // for ordering
```

---

### C5. persistence.ts: Subscribes to 7 stores, rebuilds full state on every change

**File:** `maestro-ui/src/stores/persistence.ts`
**Lines:** 126-135 (initCentralPersistence)

**Issue:**
```ts
const unsubs = [
  useProjectStore.subscribe(scheduleSave),    // triggers on any project change
  useSessionStore.subscribe(scheduleSave),     // triggers on EVERY pty output (via markAgentWorking)
  usePromptStore.subscribe(scheduleSave),
  useEnvironmentStore.subscribe(scheduleSave),
  useAssetStore.subscribe(scheduleSave),
  useAgentShortcutStore.subscribe(scheduleSave),
  useSecureStorageStore.subscribe(scheduleSave),
];
```
`scheduleSave()` calls `buildPersistedState()` which reads from ALL 7 stores and creates serializable copies. Combined with C3 (pty output calling `markAgentWorkingFromOutput`), this means **every terminal output chunk triggers a persistence build** (throttled to 400ms, but still creates new objects).

**Fix:**
1. Filter out transient state changes in subscriptions:
```ts
useSessionStore.subscribe(
  (state) => state.sessions.map(s => s.persistId), // Only persist-relevant fields
  scheduleSave,
  { equalityFn: shallow }
);
```
2. Or mark `agentWorking` as non-persisted and exclude it from the persistence trigger.

---

## HIGH Impact Issues

### H1. useMaestroStore: Monolithic store with 18+ state fields

**File:** `maestro-ui/src/stores/useMaestroStore.ts`
**Lines:** 44-115 (interface), 487-502 (initial state)

**Issue:** Single store contains: `tasks`, `taskLists`, `sessions`, `teamMembers`, `teams`, `activeModals`, `loading`, `errors`, `wsConnected`, `activeProjectIdRef`, `taskOrdering`, `sessionOrdering`, `taskListOrdering`, `workflowTemplates`, `lastUsedTeamMember`. Any change to any field triggers Zustand's internal notification, though selectors mitigate component-level re-renders.

**Impact:** While selectors prevent unnecessary component re-renders, the `new Map()` copy pattern (C1) means all Maps are recreated on any entity update, and subscription callbacks (like in persistence) are invoked too frequently.

**Fix:** Split into domain-specific stores:
- `useTaskStore` (tasks, taskOrdering, taskLists, taskListOrdering)
- `useMaestroSessionStore` (sessions, sessionOrdering) — rename to avoid clash with useSessionStore
- `useTeamStore` (teamMembers, teams)
- `useWebSocketStore` (wsConnected, loading, errors)

---

### H2. useProjectStore: Mixes persistent data with transient dialog state

**File:** `maestro-ui/src/stores/useProjectStore.ts`
**Lines:** 17-60 (interface)

**Issue:** Mixes persistent state (`projects`, `activeProjectId`, `activeSessionByProject`, `closedProjectIds`) with transient UI state (`projectOpen`, `projectMode`, `projectTitle`, `projectBasePath`, `projectEnvironmentId`, `projectAssetsEnabled`, `projectSoundInstrument`, `projectSoundConfig`, `confirmDeleteProjectOpen`, `deleteProjectError`, `deleteProjectId`).

**Impact:** Opening/closing the project dialog triggers the persistence subscription (via `useProjectStore.subscribe(scheduleSave)` in persistence.ts), causing unnecessary disk writes.

**Fix:** Move dialog state into a separate `useProjectDialogStore` or use local component state.

---

### H3. useUIStore: 40+ state fields in one store

**File:** `maestro-ui/src/stores/useUIStore.ts`
**Lines:** 107-193 (interface)

**Issue:** Contains: error/notice notifications, icon rail state, maestro sidebar width, spaces panel, layout dimensions (4 fields), slide panel (3 fields), command palette, create task trigger, board trigger, team view overlay, task detail overlay, app update (4 fields), responsive layout (2 fields), home directory. Total: ~40 fields + actions.

**Impact:** Changing any field (e.g., showing a notice) triggers all subscriptions. Combined with persistence, this creates unnecessary work.

**Fix:** Split into focused stores:
- `useNotificationStore` (error, notice)
- `useLayoutStore` (sidebar widths, responsive mode, panel states)
- `useAppUpdateStore` (appInfo, updateCheckState, etc.)

---

### H4. Components subscribing to entire Maps/arrays from useMaestroStore

**File/Lines:**

| Pattern | File | Line |
|---------|------|------|
| `tasks` Map | `hooks/useTasks.ts` | 12 |
| `tasks` Map | `hooks/useSessionTasks.ts` | 13 |
| `tasks` Map | `hooks/useTaskBreadcrumb.ts` | 6 |
| `tasks` Map | `hooks/useSubtaskProgress.ts` | 5 |
| `tasks` Map | `components/maestro/CreateTaskModal.tsx` | 90 |
| `tasks` Map | `components/maestro/TaskListItem.tsx` | 227 |
| `sessions` Map | `hooks/useTaskSessionCount.ts` | 14 |
| `sessions` Map | `hooks/useSessionTasks.ts` | 12 |
| `sessions` Map | `hooks/useTaskSessions.ts` | 12 |
| `sessions` Map | `components/maestro/MaestroPanel.tsx` | 74 |
| `teamMembers` Map | `hooks/useTeamMemberActions.ts` | 6 |
| `teamMembers` Map | `components/maestro/TeamModal.tsx` | 27 |
| `teamMembers` Map | `components/maestro/TeamListItem.tsx` | 49 |
| `teamMembers` Map | `components/maestro/CreateTaskModal.tsx` | 91 |
| `teamMembers` Map | `components/maestro/TaskListItem.tsx` | 228 |
| `sessions` array | `components/maestro/MaestroPanel.tsx` | 73 |

**Issue:** These selectors return Map/Array references that change on EVERY update to ANY item in the collection (due to C1's `new Map()` pattern). Every task update re-renders all 6 components subscribing to `tasks`, every session update re-renders all 4 components subscribing to `sessions`, etc.

**Fix:**
1. For components that need a single item: use `useMaestroStore(s => s.tasks.get(taskId))`
2. For components that need a filtered list: use `useMemo` in the component or create memoized selectors
3. Consider `subscribeWithSelector` middleware for more granular subscriptions

---

### H5. No `useShallow` usage anywhere (0 instances)

**Files with multiple selectors from same store:**

| File | Store | Selector count |
|------|-------|----------------|
| `hooks/useTasks.ts` | useMaestroStore | 4 |
| `hooks/useSessionTasks.ts` | useMaestroStore | 5 |
| `hooks/useTaskLists.ts` | useMaestroStore | 6 |
| `hooks/useMultiProjectTasks.ts` | useMaestroStore | 4 |
| `hooks/useTeamActions.ts` | useMaestroStore | 3 |
| `hooks/useTeamMemberActions.ts` | useMaestroStore | 6+ |
| `components/maestro/MaestroPanel.tsx` | useMaestroStore | 7+ |
| `components/maestro/TaskDetailOverlay.tsx` | useMaestroStore | 6 |
| `components/app/AppTopbar.tsx` | multiple | 10+ |
| `components/app/AppLeftPanel.tsx` | multiple | 15+ |
| `components/maestro/MultiProjectBoard.tsx` | useMaestroStore | 3 |

**Issue:** Each individual selector creates a separate subscription. When multiple selectors read from the same store, the component checks equality for each selector independently. With `useShallow`, multiple fields can be selected in a single subscription with shallow equality.

**Fix:**
```ts
import { useShallow } from 'zustand/react/shallow';

// Before (4 subscriptions):
const tasks = useMaestroStore(s => s.tasks);
const loading = useMaestroStore(s => s.loading);
const errors = useMaestroStore(s => s.errors);
const fetchTasks = useMaestroStore(s => s.fetchTasks);

// After (1 subscription):
const { tasks, loading, errors, fetchTasks } = useMaestroStore(
  useShallow(s => ({ tasks: s.tasks, loading: s.loading, errors: s.errors, fetchTasks: s.fetchTasks }))
);
```

---

## MEDIUM Impact Issues

### M1. useMaestroStore: WebSocket handler — no message batching

**File:** `maestro-ui/src/stores/useMaestroStore.ts`
**Lines:** 179-421 (handleMessage)

**Issue:** Each WebSocket message triggers an independent `set()` call. If the server sends a burst of 10 task updates, each one:
1. Creates a new Map copy (C1)
2. Triggers all subscribers
3. Triggers persistence (C5)

**Fix:** Batch WebSocket messages using `queueMicrotask` or `requestAnimationFrame`:
```ts
let pendingUpdates: Array<(state: MaestroState) => Partial<MaestroState>> = [];
let batchScheduled = false;

function batchSet(updater: (state: MaestroState) => Partial<MaestroState>) {
  pendingUpdates.push(updater);
  if (!batchScheduled) {
    batchScheduled = true;
    queueMicrotask(() => {
      batchScheduled = false;
      const updates = pendingUpdates;
      pendingUpdates = [];
      set((state) => {
        let merged = {};
        for (const updater of updates) {
          Object.assign(merged, updater(state));
        }
        return merged;
      });
    });
  }
}
```

---

### M2. useSpacesStore: `getSpacesByProject` creates new array every call

**File:** `maestro-ui/src/stores/useSpacesStore.ts`
**Lines:** 162-164

**Issue:**
```ts
getSpacesByProject: (projectId) => {
  return get().spaces.filter((s) => s.projectId === projectId);
},
```
This is a store action (not a selector), so it creates a new array reference every time it's called. If used inside a render path, it would cause re-renders.

**Fix:** Consumers should use a memoized selector:
```ts
const spaces = useSpacesStore(
  useCallback(s => s.spaces.filter(sp => sp.projectId === projectId), [projectId])
);
```
Or use `useMemo` in the component.

---

### M3. useRecordingStore: `getReplayFlow()` not memoized

**File:** `maestro-ui/src/stores/useRecordingStore.ts`
**Lines:** 162-201

**Issue:** `getReplayFlow()` iterates all recording events, builds groups with string operations, and returns a new array — but it's defined as a store action, not memoized. Every call rebuilds the entire structure.

**Fix:** Cache the result and invalidate when `replayRecording` changes:
```ts
// Store field:
_replayFlowCache: { recording: LoadedRecording | null; result: ReplayFlowGroup[] } | null;

getReplayFlow: () => {
  const rec = get().replayRecording;
  const cache = get()._replayFlowCache;
  if (cache && cache.recording === rec) return cache.result;
  // ... build result ...
  set({ _replayFlowCache: { recording: rec, result } });
  return result;
},
```

---

### M4. useSecureStorageStore: Duplicate `buildPersistedState()` function

**File:** `maestro-ui/src/stores/useSecureStorageStore.ts`
**Lines:** 39-78

**Issue:** Contains its own copy of `buildPersistedState()` that's nearly identical to the one in `persistence.ts` (lines 31-85). This one is missing some fields (`closedProjectIds`, `backendSessionId` mapping), creating inconsistency and violating DRY.

**Fix:** Extract a shared `buildPersistedState()` utility or import from persistence.ts.

---

### M5. persistence.ts: `buildPersistedState()` creates expensive copies

**File:** `maestro-ui/src/stores/persistence.ts`
**Lines:** 31-85

**Issue:** Every save cycle creates:
- A new array from `sessions.filter().map().sort()`
- A new array from `projects.map()`
- A new object with all fields spread

This runs every 400ms during active use (due to C3/C5 interaction).

**Fix:**
1. Increase debounce to 1000-2000ms for non-critical state
2. Use a dirty flag per store to skip unchanged stores
3. Cache the last persisted state and diff before writing

---

### M6. useMaestroStore: `lastUsedTeamMember` persists to localStorage on every change

**File:** `maestro-ui/src/stores/useMaestroStore.ts`
**Lines:** 988-997

**Issue:**
```ts
setLastUsedTeamMember: (taskId, teamMemberId) => {
  set((prev) => {
    const lastUsedTeamMember = { ...prev.lastUsedTeamMember, [taskId]: teamMemberId };
    try {
      localStorage.setItem('maestro:lastUsedTeamMember', JSON.stringify(lastUsedTeamMember));
    } catch {}
    return { lastUsedTeamMember };
  });
},
```
Synchronous `JSON.stringify` + `localStorage.setItem` inside a state updater. This blocks the main thread during the state transition.

**Fix:** Debounce the localStorage write:
```ts
let lastUsedTimer: number | null = null;
setLastUsedTeamMember: (taskId, teamMemberId) => {
  set((prev) => ({
    lastUsedTeamMember: { ...prev.lastUsedTeamMember, [taskId]: teamMemberId },
  }));
  if (lastUsedTimer) clearTimeout(lastUsedTimer);
  lastUsedTimer = window.setTimeout(() => {
    const data = get().lastUsedTeamMember;
    try { localStorage.setItem('maestro:lastUsedTeamMember', JSON.stringify(data)); } catch {}
  }, 500);
},
```

---

## LOW Impact Issues

### L1. useSpacesStore: `loadSpaces()` reads localStorage synchronously at module load

**File:** `maestro-ui/src/stores/useSpacesStore.ts`
**Lines:** 11-27

**Issue:** `loadSpaces()` does `localStorage.getItem()` + `JSON.parse()` during store creation (module initialization). For large whiteboard data, this could delay initial render.

**Impact:** Low — typically only a few whiteboards. But worth noting.

---

### L2. useUIStore/useWorkspaceStore: Multiple `readClampedFromStorage` calls at init

**Files:** `useUIStore.ts:66-77`, `useWorkspaceStore.ts:34-42`

**Issue:** Multiple synchronous localStorage reads during store initialization. Each is small, but collectively they add up.

**Impact:** Low — one-time cost at startup.

---

### L3. Cross-store `getState()` calls in actions

**Files:** Many stores (useProjectStore, useSessionStore, useRecordingStore, etc.)

**Issue:** Actions call `useOtherStore.getState()` synchronously. This creates tight coupling and makes it hard to trace state flow. It's not a performance issue per se, but makes optimization harder.

**Example:** `useProjectStore.selectProject()` calls `useSessionStore.getState().setActiveId()` — changing two stores in one synchronous call.

---

### L4. usePromptAnimationStore: `setTimeout` for auto-cleanup

**File:** `maestro-ui/src/stores/usePromptAnimationStore.ts`
**Lines:** 22-31

**Issue:** Each animation creates a `setTimeout` that calls `set()`. With many rapid prompt animations, this creates many pending timers.

**Impact:** Low — animations are infrequent.

---

## Summary of Recommended Fixes (Priority Order)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | C3: Guard `markAgentWorkingFromOutput` | Low | High |
| **P0** | C1: Replace `new Map()` pattern in useMaestroStore | Medium | Critical |
| **P0** | C5: Filter persistence triggers for transient state | Medium | High |
| **P1** | H5: Add `useShallow` to multi-selector components | Medium | High |
| **P1** | H4: Use item-specific selectors instead of entire Maps | Medium | High |
| **P1** | C2: Replace Set/Map for loading/errors with Records | Low | Medium |
| **P2** | M1: Batch WebSocket messages | Medium | Medium |
| **P2** | H2: Separate dialog state from useProjectStore | Medium | Medium |
| **P2** | C4: Normalize sessions into Record | High | High |
| **P3** | H1/H3: Split monolithic stores | High | Medium |
| **P3** | M3: Memoize getReplayFlow | Low | Low |
| **P3** | M4: Deduplicate buildPersistedState | Low | Low |
| **P3** | M6: Debounce lastUsedTeamMember localStorage write | Low | Low |
