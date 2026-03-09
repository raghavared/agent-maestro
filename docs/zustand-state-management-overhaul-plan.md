# Zustand State Management Overhaul — Implementation Plan

**Date:** 2026-03-09
**Status:** Draft
**Reference:** `docs/zustand-store-performance-audit.md`

---

## Table of Contents

1. [Migration Strategy Overview](#1-migration-strategy-overview)
2. [Phase 1: Quick Wins (No API Changes)](#2-phase-1-quick-wins-no-api-changes)
3. [Phase 2: Data Structure Migration](#3-phase-2-data-structure-migration)
4. [Phase 3: Store Splitting](#4-phase-3-store-splitting)
5. [Phase 4: Consumer Optimization](#5-phase-4-consumer-optimization)
6. [Phase 5: WebSocket & Persistence](#6-phase-5-websocket--persistence)
7. [File Change Matrix](#7-file-change-matrix)
8. [Risk Mitigation](#8-risk-mitigation)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Migration Strategy Overview

### Principles
- **Incremental phases** — each phase produces a working, shippable state
- **Zero functionality loss** — every behavioral change must be verified against existing behavior
- **Backwards-compatible selectors** — existing `useMaestroStore(s => s.tasks)` patterns continue to work during migration; deprecated selectors are removed only after all consumers migrate
- **One concern per PR** — each numbered step below maps to one PR for clean review

### Dependency Order
```
Phase 1 (Quick Wins) → independent, can ship immediately
  ├── 1A: markAgentWorkingFromOutput early-exit
  ├── 1B: Debounce lastUsedTeamMember localStorage write
  └── 1C: Filter persistence triggers for transient state

Phase 2 (Data Structure) → C1/C2/C4, builds foundation
  ├── 2A: Replace Map/Set with Record for loading/errors
  ├── 2B: Replace Map<string,T> with Record<string,T> for all entities
  └── 2C: Normalize useSessionStore sessions to Record + sessionIds

Phase 3 (Store Splitting) → H1/H2, depends on Phase 2
  ├── 3A: Separate dialog state from useProjectStore
  └── 3B: (Optional) Split useMaestroStore into domain stores

Phase 4 (Consumer Optimization) → H4/H5, depends on Phase 2
  ├── 4A: Add useShallow to all multi-selector hooks/components
  └── 4B: Replace whole-collection selectors with item-specific selectors

Phase 5 (WebSocket & Persistence) → M1/C5, depends on Phase 2
  ├── 5A: Batch WebSocket messages with queueMicrotask
  └── 5B: Optimize persistence with dirty flags
```

---

## 2. Phase 1: Quick Wins (No API Changes)

### 1A. Guard `markAgentWorkingFromOutput` with early-exit

**Priority:** P0 — highest impact-to-effort ratio
**Effort:** ~15 min
**Files:**
- `maestro-ui/src/stores/useSessionStore.ts` (lines 408–449)

**Current code (line 408–430):**
```ts
markAgentWorkingFromOutput: (id, data) => {
  const { sessions, activeId } = get();
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  if (!session.effectId || session.exited || session.closing) return;
  if (!data) return;
  // ... resize check, meaningful output check ...
  if (session.persistent && !session.agentWorking && activeId !== id) return;
  if (!session.agentWorking) {
    set((s) => ({
      sessions: s.sessions.map((s2) =>
        s2.id === id ? { ...s2, agentWorking: true } : s2,
      ),
    }));
  }
  // Schedule agent idle timer...
}
```

**Change:** The `set()` call is already guarded by `if (!session.agentWorking)`, but the idle timer reschedule still happens every call. Add early exit for the timer reset when `agentWorking` is already true and a timer is already running:

```ts
markAgentWorkingFromOutput: (id, data) => {
  const { sessions, activeId } = get();
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  if (!session.effectId || session.exited || session.closing) return;
  if (!data) return;

  const lastResize = lastResizeAtRef.get(id);
  if (lastResize !== undefined && Date.now() - lastResize < RESIZE_OUTPUT_SUPPRESS_MS) return;
  if (!hasMeaningfulOutput(data)) return;
  if (session.persistent && !session.agentWorking && activeId !== id) return;

  // Only call set() if agentWorking is actually changing
  if (!session.agentWorking) {
    set((s) => ({
      sessions: s.sessions.map((s2) =>
        s2.id === id ? { ...s2, agentWorking: true } : s2,
      ),
    }));
  }

  // Reschedule agent idle timer (this is cheap — just a setTimeout swap)
  get().clearAgentIdleTimer(id);
  if (session.effectId) {
    const effect = getProcessEffectById(session.effectId);
    const idleAfterMs = effect?.idleAfterMs ?? DEFAULTS.AGENT_IDLE_TIMEOUT_MS;
    const timeout = window.setTimeout(() => {
      agentIdleTimersRef.delete(id);
      set((s) => ({
        sessions: s.sessions.map((s2) => {
          if (s2.id !== id) return s2;
          if (!s2.agentWorking) return s2;
          return { ...s2, agentWorking: false };
        }),
      }));
    }, idleAfterMs);
    agentIdleTimersRef.set(id, timeout);
  }
},
```

**Impact:** The `set()` call that replaces the entire sessions array is now only called when `agentWorking` changes from `false` to `true`. Previously it was already guarded (line 424), so the main fix here is confirming this guard works and documenting the existing early-exit behavior is correct. The idle timer reschedule is lightweight (just clearTimeout + setTimeout) and should remain as-is.

**Verification:** Monitor re-render count on `sessions` subscribers when PTY output is flowing. Should see `set()` called once per idle→working transition instead of on every chunk.

---

### 1B. Debounce `lastUsedTeamMember` localStorage write

**Priority:** P3
**Effort:** ~10 min
**Files:**
- `maestro-ui/src/stores/useMaestroStore.ts` (lines 988–997)

**Current code:**
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

**Change:** Move localStorage write outside the `set()` updater and debounce it:

```ts
// Module-level debounce timer (near top of store creation)
let lastUsedTeamMemberSaveTimer: number | null = null;

setLastUsedTeamMember: (taskId, teamMemberId) => {
  set((prev) => ({
    lastUsedTeamMember: { ...prev.lastUsedTeamMember, [taskId]: teamMemberId },
  }));
  // Debounced localStorage persistence
  if (lastUsedTeamMemberSaveTimer) clearTimeout(lastUsedTeamMemberSaveTimer);
  lastUsedTeamMemberSaveTimer = window.setTimeout(() => {
    lastUsedTeamMemberSaveTimer = null;
    try {
      localStorage.setItem(
        'maestro:lastUsedTeamMember',
        JSON.stringify(get().lastUsedTeamMember),
      );
    } catch {}
  }, 500);
},
```

**Impact:** Removes synchronous `JSON.stringify + localStorage.setItem` from inside the Zustand `set()` updater. Under rapid team member switching, localStorage writes are batched.

**Verification:** Open DevTools Performance tab, rapidly switch team members, confirm no synchronous jank from localStorage writes.

---

### 1C. Filter persistence triggers for transient state changes

**Priority:** P0
**Effort:** ~30 min
**Files:**
- `maestro-ui/src/stores/persistence.ts` (lines 126–135)

**Current code:**
```ts
const unsubs = [
  useProjectStore.subscribe(scheduleSave),
  useSessionStore.subscribe(scheduleSave),
  // ... 5 more stores
];
```

**Problem:** `useSessionStore.subscribe(scheduleSave)` triggers on **every** state change, including transient `agentWorking` toggling, `newOpen` form state, etc. This calls `buildPersistedState()` which reads all 7 stores.

**Change:** Use Zustand's `subscribe` with a selector to only trigger persistence for persist-relevant fields:

```ts
export function initCentralPersistence(): () => void {
  const unsubs = [
    useProjectStore.subscribe(
      (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        activeSessionByProject: state.activeSessionByProject,
        closedProjectIds: state.closedProjectIds,
      }),
      scheduleSave,
      { equalityFn: shallow }
    ),
    useSessionStore.subscribe(
      // Only persist-relevant session fields — exclude agentWorking, form state, etc.
      (state) => ({
        sessions: state.sessions.map(s => s.persistId),
        sessionCount: state.sessions.length,
      }),
      scheduleSave,
      { equalityFn: shallow }
    ),
    usePromptStore.subscribe(scheduleSave),
    useEnvironmentStore.subscribe(scheduleSave),
    useAssetStore.subscribe(scheduleSave),
    useAgentShortcutStore.subscribe(scheduleSave),
    useSecureStorageStore.subscribe(scheduleSave),
  ];
  // ...rest unchanged
}
```

**Important:** This requires `subscribeWithSelector` middleware on `useSessionStore` and `useProjectStore`, OR using the Zustand v4+ built-in `subscribe(selector, listener, options)` overload. Check Zustand version first.

**Alternative (simpler):** Instead of selective subscriptions, add a hash/fingerprint check inside `scheduleSave()`:

```ts
let lastPersistedHash = '';

function scheduleSave() {
  const { hydrated } = useSessionStore.getState();
  const { persistenceDisabledReason } = useSecureStorageStore.getState();
  if (!hydrated || persistenceDisabledReason) return;

  // Quick check: has persist-relevant state actually changed?
  const sessions = useSessionStore.getState().sessions;
  const quickHash = sessions.length + ':' + sessions.map(s => s.persistId).join(',');
  const projects = useProjectStore.getState();
  const fullHash = quickHash + ':' + projects.activeProjectId + ':' + projects.projects.length;

  if (fullHash === lastPersistedHash) return; // Skip — no persist-relevant change
  lastPersistedHash = fullHash;

  if (saveTimerRef !== null) clearTimeout(saveTimerRef);
  pendingSaveRef = buildPersistedState();
  saveTimerRef = window.setTimeout(() => { /* ...existing save logic... */ }, 400);
}
```

**Recommended approach:** The hash-check approach because it doesn't require middleware changes and is backwards-compatible.

**Impact:** Prevents `buildPersistedState()` from running on every PTY output chunk, `agentWorking` toggle, or form field change. Only actual persist-relevant changes (session add/remove, project switch, etc.) trigger saves.

**Verification:** Add `console.count('buildPersistedState')` temporarily. With active agent sessions, should see dramatically fewer calls (from hundreds/sec to near-zero during idle output).

---

## 3. Phase 2: Data Structure Migration

### 2A. Replace `Set<string>` and `Map<string, string>` for `loading`/`errors` with `Record`

**Priority:** P1
**Effort:** ~1 hour
**Files:**
- `maestro-ui/src/stores/useMaestroStore.ts` — state definition + setLoading/setError helpers + all callers

**Current types:**
```ts
loading: Set<string>;
errors: Map<string, string>;
```

**New types:**
```ts
loading: Record<string, boolean>;
errors: Record<string, string>;
```

**Changes required:**

1. **State interface** (line 50–51):
```ts
// Before
loading: Set<string>;
errors: Map<string, string>;
// After
loading: Record<string, boolean>;
errors: Record<string, string>;
```

2. **Initial state** (lines 494–495):
```ts
// Before
loading: new Set(),
errors: new Map(),
// After
loading: {},
errors: {},
```

3. **setLoading helper** (lines 145–151):
```ts
// Before
const setLoading = (key: string, isLoading: boolean) => {
  set((prev) => {
    const loading = new Set(prev.loading);
    if (isLoading) loading.add(key); else loading.delete(key);
    return { loading };
  });
};
// After
const setLoading = (key: string, isLoading: boolean) => {
  set((prev) => {
    if (isLoading === !!prev.loading[key]) return prev; // No change
    const loading = { ...prev.loading, [key]: isLoading || undefined };
    if (!isLoading) delete loading[key]; // Clean up false entries
    return { loading };
  });
};
```

4. **setError helper** (lines 153–158):
```ts
// Before
const setError = (key: string, error: string | null) => {
  set((prev) => {
    const errors = new Map(prev.errors);
    if (error) errors.set(key, error); else errors.delete(key);
    return { errors };
  });
};
// After
const setError = (key: string, error: string | null) => {
  set((prev) => {
    if (!error && !prev.errors[key]) return prev; // No change
    if (error) return { errors: { ...prev.errors, [key]: error } };
    const errors = { ...prev.errors };
    delete errors[key];
    return { errors };
  });
};
```

5. **Consumer selectors** — update all `loading.has(key)` to `!!loading[key]` and `errors.get(key)` to `errors[key]`:

| File | Change |
|------|--------|
| `hooks/useTasks.ts` | `loading.has(...)` → `!!loading[...]` |
| `hooks/useSessionTasks.ts` | same |
| `hooks/useTaskLists.ts` | same |
| `hooks/useMultiProjectTasks.ts` | same |
| `hooks/useTaskSessions.ts` | same |
| `hooks/useTeamMemberActions.ts` | `loading.has(...)` → `!!loading[...]` |
| Any component directly using `loading` or `errors` | same pattern |

6. **clearCache** (line 821–834): `loading: new Set()` → `loading: {}`, `errors: new Map()` → `errors: {}`

7. **Batch loading into data set()**: Where possible, combine loading state with data in a single `set()`:
```ts
// Before (3 separate set() calls):
setLoading(key, true);
// ... await
set((prev) => ({ tasks: new Map(prev.tasks).set(task.id, task) }));
setLoading(key, false);

// After (2 set() calls — data + loading combined):
set((prev) => ({
  tasks: { ...prev.tasks, [task.id]: task },
  loading: { ...prev.loading, [key]: undefined },
}));
```

**Impact:** Eliminates `new Set()` / `new Map()` cloning for loading/errors. Plain objects work with React's shallow comparison and Zustand's default `===` check on individual properties.

---

### 2B. Replace `Map<string, T>` with `Record<string, T>` for all entity collections

**Priority:** P0 — this is the biggest single fix
**Effort:** ~3–4 hours
**Files:**
- `maestro-ui/src/stores/useMaestroStore.ts` — all 57 `new Map()` patterns
- All consumer hooks (10+ files)
- All consumer components (15+ files)

**Current types:**
```ts
tasks: Map<string, MaestroTask>;
taskLists: Map<string, TaskList>;
sessions: Map<string, MaestroSession>;
teamMembers: Map<string, TeamMember>;
teams: Map<string, Team>;
taskOrdering: Map<string, string[]>;
sessionOrdering: Map<string, string[]>;
taskListOrdering: Map<string, string[]>;
```

**New types:**
```ts
tasks: Record<string, MaestroTask>;
taskLists: Record<string, TaskList>;
sessions: Record<string, MaestroSession>;
teamMembers: Record<string, TeamMember>;
teams: Record<string, Team>;
taskOrdering: Record<string, string[]>;
sessionOrdering: Record<string, string[]>;
taskListOrdering: Record<string, string[]>;
```

**Migration pattern for each entity type:**

**A. Single-item upsert (most common — ~35 occurrences):**
```ts
// Before
set((prev) => ({ tasks: new Map(prev.tasks).set(taskData.id, taskData) }));
// After
set((prev) => ({ tasks: { ...prev.tasks, [taskData.id]: taskData } }));
```

**B. Single-item delete (~8 occurrences):**
```ts
// Before
set((prev) => { const tasks = new Map(prev.tasks); tasks.delete(id); return { tasks }; });
// After
set((prev) => {
  const { [id]: _, ...tasks } = prev.tasks;
  return { tasks };
});
```

**C. Bulk fetch with project-scoped cleanup (~4 occurrences):**
```ts
// Before (fetchTeamMembers, fetchTeams, fetchTaskLists)
set((prev) => {
  const teamMemberMap = new Map(prev.teamMembers);
  for (const [id, tm] of teamMemberMap) {
    if (tm.projectId === projectId) teamMemberMap.delete(id);
  }
  teamMembers.forEach((tm) => teamMemberMap.set(tm.id, tm));
  return { teamMembers: teamMemberMap };
});
// After
set((prev) => {
  // Remove old entries for this project
  const filtered: Record<string, TeamMember> = {};
  for (const [id, tm] of Object.entries(prev.teamMembers)) {
    if (tm.projectId !== projectId) filtered[id] = tm;
  }
  // Add fresh data
  for (const tm of teamMembers) {
    filtered[tm.id] = tm;
  }
  return { teamMembers: filtered };
});
```

**D. Bulk fetch additive (~2 occurrences, fetchTasks/fetchSessions):**
```ts
// Before
set((prev) => {
  const taskMap = new Map(prev.tasks);
  tasks.forEach((task) => taskMap.set(task.id, task));
  return { tasks: taskMap };
});
// After
set((prev) => {
  const updated = { ...prev.tasks };
  for (const task of tasks) {
    updated[task.id] = task;
  }
  return { tasks: updated };
});
```

**E. Multi-field updates (fetchTaskLists, createTaskList, deleteTaskList — ~6 occurrences):**
Same pattern as above but updating multiple Records in a single `set()`.

**F. Consumer migration — `.get()` → bracket access, `.values()` → `Object.values()`, `.has()` → `in` operator:**

| Old Pattern | New Pattern |
|---|---|
| `tasks.get(id)` | `tasks[id]` |
| `tasks.has(id)` | `id in tasks` or `!!tasks[id]` |
| `tasks.set(id, val)` | (only in store actions, use spread) |
| `Array.from(tasks.values())` | `Object.values(tasks)` |
| `tasks.size` | `Object.keys(tasks).length` |
| `for (const [id, task] of tasks)` | `for (const [id, task] of Object.entries(tasks))` |
| `new Map()` (initial state) | `{}` |

**Consumer files requiring `.get()` → `[id]` changes:**

| File | Estimated Changes |
|------|-------------------|
| `hooks/useTasks.ts` | 2–3 |
| `hooks/useSessionTasks.ts` | 3–4 |
| `hooks/useTaskLists.ts` | 3–4 |
| `hooks/useMultiProjectTasks.ts` | 2–3 |
| `hooks/useTeamMemberActions.ts` | 2–3 |
| `hooks/useTeamActions.ts` | 2–3 |
| `hooks/useTaskSessions.ts` | 2–3 |
| `hooks/useSubtaskProgress.ts` | 1–2 |
| `hooks/useTaskBreadcrumb.ts` | 1–2 |
| `hooks/useTaskSessionCount.ts` | 1–2 |
| `components/maestro/CreateTaskModal.tsx` | 2–3 |
| `components/maestro/TaskListItem.tsx` | 2–3 |
| `components/maestro/MaestroPanel.tsx` | 3–4 |
| `components/maestro/TeamModal.tsx` | 1–2 |
| `components/maestro/TeamListItem.tsx` | 1–2 |
| `components/maestro/TaskDetailOverlay.tsx` | 3–4 |
| `components/maestro/MultiProjectBoard.tsx` | 1–2 |
| + ~10 more components | 1–2 each |

**Impact:** Eliminates all 57 `new Map()` clones. Object spread (`{ ...prev.tasks, [id]: task }`) is faster and creates a new reference only for the container, not deep copies.

**Risk:** This is a large refactor touching ~30+ files. Mitigate with:
1. TypeScript will catch all `.get()` / `.has()` / `.values()` calls at compile time since `Record` doesn't have Map methods
2. Do the type change first, then fix all compilation errors — TypeScript guarantees completeness
3. One entity type at a time (tasks first, then sessions, then teamMembers, etc.)

---

### 2C. Normalize `useSessionStore` sessions from flat array to `Record<string, TerminalSession>` + `sessionIds`

**Priority:** P2
**Effort:** ~3–4 hours
**Files:**
- `maestro-ui/src/stores/useSessionStore.ts` — core restructure
- `maestro-ui/src/stores/persistence.ts` — session reading
- All consumers of `useSessionStore(s => s.sessions)`

**Current type:**
```ts
sessions: TerminalSession[];
```

**New types:**
```ts
sessionsById: Record<string, TerminalSession>;
sessionIds: string[];  // preserves insertion/ordering
```

**Migration approach:**

1. **Add new fields alongside old one:**
```ts
interface SessionState {
  sessions: TerminalSession[];           // DEPRECATED — kept for compat
  sessionsById: Record<string, TerminalSession>;  // NEW
  sessionIds: string[];                            // NEW
  // ...
}
```

2. **Update `setSessions`** to maintain both representations:
```ts
setSessions: (sessions) => {
  const resolved = typeof sessions === 'function' ? sessions(get().sessions) : sessions;
  const byId: Record<string, TerminalSession> = {};
  const ids: string[] = [];
  for (const s of resolved) {
    byId[s.id] = s;
    ids.push(s.id);
  }
  set({ sessions: resolved, sessionsById: byId, sessionIds: ids });
},
```

3. **Migrate consumers** one-by-one to use `sessionsById` / `sessionIds`

4. **Remove deprecated `sessions` array** once all consumers are migrated

**Key consumers to update:**
- `markAgentWorkingFromOutput` — `sessions.find(s => s.id === id)` → `sessionsById[id]`
- `persistence.ts buildPersistedState()` — `sessions.filter().map()` → `Object.values(sessionsById).filter().map()`
- All `.find()` / `.filter()` / `.map()` calls on sessions

**Impact:** Converts O(n) lookups to O(1). Stops full-array replacement on single-session updates.

**Note:** This is the highest-effort item. Consider deferring to a later phase if time is constrained. The Phase 1 fixes (1A, 1C) mitigate the worst symptoms.

---

## 4. Phase 3: Store Splitting

### 3A. Separate dialog state from `useProjectStore`

**Priority:** P2
**Effort:** ~1.5 hours
**Files:**
- `maestro-ui/src/stores/useProjectStore.ts` — extract dialog fields
- `maestro-ui/src/stores/useProjectDialogStore.ts` — **new file**
- All components that use dialog fields from `useProjectStore`

**Fields to extract:**
```ts
// Move to useProjectDialogStore:
projectOpen: boolean;
projectMode: 'new' | 'rename';
projectTitle: string;
projectBasePath: string;
projectEnvironmentId: string;
projectAssetsEnabled: boolean;
projectSoundInstrument: string;
projectSoundConfig: ProjectSoundConfig | undefined;
confirmDeleteProjectOpen: boolean;
deleteProjectError: string | null;
deleteProjectId: string | null;

// Keep in useProjectStore:
projects: MaestroProject[];
activeProjectId: string;
activeSessionByProject: Record<string, string>;
closedProjectIds: string[];
```

**New store:**
```ts
// maestro-ui/src/stores/useProjectDialogStore.ts
import { create } from 'zustand';
import type { ProjectSoundConfig } from '../app/types/maestro';
import { DEFAULT_SOUND_INSTRUMENT } from '../app/constants/defaults';

interface ProjectDialogState {
  projectOpen: boolean;
  projectMode: 'new' | 'rename';
  projectTitle: string;
  projectBasePath: string;
  projectEnvironmentId: string;
  projectAssetsEnabled: boolean;
  projectSoundInstrument: string;
  projectSoundConfig: ProjectSoundConfig | undefined;
  confirmDeleteProjectOpen: boolean;
  deleteProjectError: string | null;
  deleteProjectId: string | null;
  // setters...
}

export const useProjectDialogStore = create<ProjectDialogState>((set) => ({
  projectOpen: false,
  projectMode: 'new',
  projectTitle: '',
  projectBasePath: '',
  projectEnvironmentId: '',
  projectAssetsEnabled: true,
  projectSoundInstrument: DEFAULT_SOUND_INSTRUMENT,
  projectSoundConfig: undefined,
  confirmDeleteProjectOpen: false,
  deleteProjectError: null,
  deleteProjectId: null,
  // setters matching existing API...
}));
```

**Consumer migration:**
- Components that import dialog fields from `useProjectStore` → import from `useProjectDialogStore`
- Actions that combine dialog + persistent state (e.g., `onProjectSubmit`) stay in `useProjectStore` but read dialog state via `useProjectDialogStore.getState()`

**Impact:** Dialog state changes (opening/closing project modal, typing in project name) no longer trigger persistence subscription in `persistence.ts`.

---

### 3B. (Optional/Deferred) Split `useMaestroStore` into domain stores

**Priority:** P3
**Effort:** ~6–8 hours
**Risk:** High — 30+ consumer files

**Proposed split:**
- `useTaskStore` — tasks, taskOrdering, taskLists, taskListOrdering
- `useMaestroSessionStore` — sessions (Maestro API sessions), sessionOrdering
- `useTeamStore` — teamMembers, teams, lastUsedTeamMember
- `useWebSocketStore` — wsConnected, loading, errors, WebSocket lifecycle

**Recommendation:** **Defer this to a future phase.** The Phase 2 `Map→Record` migration eliminates the core performance issue (unnecessary cloning). Store splitting is architectural cleanup that doesn't provide proportional performance benefit once `new Map()` cloning is gone. The risk of breaking 30+ consumer files outweighs the marginal gain.

If pursued later, use a facade pattern during migration:
```ts
// Temporary facade — re-export from new stores
export const useMaestroStore = {
  tasks: useTaskStore(s => s.tasks),
  sessions: useMaestroSessionStore(s => s.sessions),
  // ... etc
};
```

---

## 5. Phase 4: Consumer Optimization

### 4A. Add `useShallow` to all multi-selector hooks/components

**Priority:** P1
**Effort:** ~2–3 hours
**Files:** 11+ hooks and components

**Pattern:**
```ts
// Before — 4 separate subscriptions:
const tasks = useMaestroStore(s => s.tasks);
const loading = useMaestroStore(s => s.loading);
const errors = useMaestroStore(s => s.errors);
const fetchTasks = useMaestroStore(s => s.fetchTasks);

// After — 1 subscription with shallow equality:
import { useShallow } from 'zustand/react/shallow';

const { tasks, loading, errors, fetchTasks } = useMaestroStore(
  useShallow(s => ({ tasks: s.tasks, loading: s.loading, errors: s.errors, fetchTasks: s.fetchTasks }))
);
```

**Files to update:**

| File | Current Selectors | After |
|------|-------------------|-------|
| `hooks/useTasks.ts` | 4 selectors | 1 useShallow |
| `hooks/useSessionTasks.ts` | 5 selectors | 1 useShallow |
| `hooks/useTaskLists.ts` | 6 selectors | 1 useShallow |
| `hooks/useMultiProjectTasks.ts` | 4 selectors | 1 useShallow |
| `hooks/useTeamActions.ts` | 3 selectors | 1 useShallow |
| `hooks/useTeamMemberActions.ts` | 6+ selectors | 1 useShallow |
| `components/maestro/MaestroPanel.tsx` | 7+ selectors | 1 useShallow |
| `components/maestro/TaskDetailOverlay.tsx` | 6 selectors | 1 useShallow |
| `components/app/AppTopbar.tsx` | 10+ selectors (multiple stores) | 1 useShallow per store |
| `components/app/AppLeftPanel.tsx` | 15+ selectors (multiple stores) | 1 useShallow per store |
| `components/maestro/MultiProjectBoard.tsx` | 3 selectors | 1 useShallow |

**Zustand version check:** `useShallow` is available in Zustand v4.4+. Check `package.json` to confirm.

**Impact:** Reduces subscription count from ~70+ to ~11 for these files. Each store update only triggers 1 equality check per component instead of N.

---

### 4B. Replace whole-collection selectors with item-specific selectors

**Priority:** P1 (depends on Phase 2)
**Effort:** ~3–4 hours
**Files:** Per-row hooks and components

**Target hooks (used per-row, subscribe to full collections):**

1. **`useSubtaskProgress(taskId)`** — subscribes to entire `tasks` Map
```ts
// Before
const tasks = useMaestroStore(s => s.tasks);
const subtasks = useMemo(() =>
  Array.from(tasks.values()).filter(t => t.parentId === taskId), [tasks, taskId]);

// After — use a stable selector with shallow equality
const subtasks = useMaestroStore(
  useCallback(s => {
    return Object.values(s.tasks).filter(t => t.parentId === taskId);
  }, [taskId]),
  shallow // only re-render if the filtered array actually changes
);
```

2. **`useTaskBreadcrumb(taskId)`** — subscribes to entire `tasks` Map for parent chain
```ts
// After — select only the specific task's parent chain
const breadcrumb = useMaestroStore(
  useCallback(s => {
    const result: MaestroTask[] = [];
    let current = s.tasks[taskId];
    while (current?.parentId) {
      current = s.tasks[current.parentId];
      if (current) result.unshift(current);
    }
    return result;
  }, [taskId]),
  (a, b) => a.length === b.length && a.every((t, i) => t.id === b[i].id)
);
```

3. **`useTaskSessionCount(taskId)`** — subscribes to entire `sessions` Map
```ts
// After — return just the count, which is a primitive and stable
const sessionCount = useMaestroStore(
  useCallback(s => {
    let count = 0;
    for (const session of Object.values(s.sessions)) {
      if (session.taskIds?.includes(taskId)) count++;
    }
    return count;
  }, [taskId])
);
```

**Impact:** Per-row hooks go from "re-render on ANY store change" to "re-render only when the derived value changes". With 100 task rows, this prevents ~99 unnecessary re-renders per store update.

---

## 6. Phase 5: WebSocket & Persistence

### 5A. Batch WebSocket messages with `queueMicrotask`

**Priority:** P2
**Effort:** ~2 hours
**Files:**
- `maestro-ui/src/stores/useMaestroStore.ts` — `handleMessage` function (lines 179–421)

**Current behavior:** Each WebSocket message triggers an independent `set()` call. A burst of 10 task updates = 10 `set()` calls = 10 subscriber notification cycles.

**Change:** Accumulate updates in a microtask batch:

```ts
// Inside the store creation, before handleMessage
type PendingUpdate = (state: MaestroState) => Partial<MaestroState>;
let pendingUpdates: PendingUpdate[] = [];
let batchScheduled = false;

function batchSet(updater: PendingUpdate) {
  pendingUpdates.push(updater);
  if (!batchScheduled) {
    batchScheduled = true;
    queueMicrotask(() => {
      batchScheduled = false;
      const updates = pendingUpdates;
      pendingUpdates = [];
      if (updates.length === 0) return;
      if (updates.length === 1) {
        set(updates[0]);
        return;
      }
      set((state) => {
        let merged: Partial<MaestroState> = {};
        for (const updater of updates) {
          Object.assign(merged, updater(state));
        }
        return merged;
      });
    });
  }
}
```

Then replace `set(...)` calls in `handleMessage` with `batchSet(...)`:
```ts
// Before
set((prev) => ({ tasks: { ...prev.tasks, [taskData.id]: taskData } }));
// After
batchSet((prev) => ({ tasks: { ...prev.tasks, [taskData.id]: taskData } }));
```

**Note:** Sound effects (`playEventSound`, `playSessionAwareSound`) should remain synchronous and NOT be batched — they need to fire immediately for user feedback. Only the `set()` calls are batched.

**Note:** Side effects like `useSessionStore.getState().handleSpawnTerminalSession(...)` for `session:spawn` events must NOT be batched — they need immediate execution. Only pure state updates are batch-safe.

**Events safe to batch:** `task:created`, `task:updated`, `task:deleted`, `session:created`, `session:updated`, `session:deleted`, `team_member:created/updated/archived/deleted`, `team:created/updated/archived/deleted`, `task_list:created/updated/reordered/deleted`

**Events that need immediate execution (keep using `set()` directly):** `session:spawn`, `session:resume`, `session:prompt_send`

**Impact:** A burst of N WebSocket messages in the same event loop tick results in 1 `set()` call instead of N.

---

### 5B. Optimize persistence with dirty flags

**Priority:** P2
**Effort:** ~1 hour
**Files:**
- `maestro-ui/src/stores/persistence.ts`

**Change:** Track which stores have changed since last save:

```ts
const dirtyStores = new Set<string>();

function markDirty(storeName: string) {
  return () => { dirtyStores.add(storeName); scheduleSave(); };
}

export function initCentralPersistence(): () => void {
  const unsubs = [
    useProjectStore.subscribe(markDirty('project')),
    useSessionStore.subscribe(markDirty('session')),
    usePromptStore.subscribe(markDirty('prompt')),
    useEnvironmentStore.subscribe(markDirty('environment')),
    useAssetStore.subscribe(markDirty('asset')),
    useAgentShortcutStore.subscribe(markDirty('shortcut')),
    useSecureStorageStore.subscribe(markDirty('secure')),
  ];
  // ...
}

function scheduleSave() {
  if (dirtyStores.size === 0) return;
  // ... existing debounce logic
  saveTimerRef = window.setTimeout(() => {
    dirtyStores.clear();
    // ... existing save logic
  }, 400);
}
```

**This combines with 1C** (the hash-check approach) to prevent unnecessary `buildPersistedState()` calls from transient state changes.

---

## 7. File Change Matrix

| File | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|---------|---------|---------|---------|---------|
| `stores/useMaestroStore.ts` | 1B | 2A, 2B | — | — | 5A |
| `stores/useSessionStore.ts` | 1A | 2C | — | — | — |
| `stores/useProjectStore.ts` | — | — | 3A | — | — |
| `stores/useProjectDialogStore.ts` (new) | — | — | 3A | — | — |
| `stores/persistence.ts` | 1C | — | — | — | 5B |
| `hooks/useTasks.ts` | — | 2A, 2B | — | 4A, 4B | — |
| `hooks/useSessionTasks.ts` | — | 2A, 2B | — | 4A | — |
| `hooks/useTaskLists.ts` | — | 2A, 2B | — | 4A | — |
| `hooks/useMultiProjectTasks.ts` | — | 2A, 2B | — | 4A | — |
| `hooks/useTeamMemberActions.ts` | — | 2A, 2B | — | 4A | — |
| `hooks/useTeamActions.ts` | — | 2B | — | 4A | — |
| `hooks/useTaskSessions.ts` | — | 2A, 2B | — | 4A | — |
| `hooks/useSubtaskProgress.ts` | — | 2B | — | 4B | — |
| `hooks/useTaskBreadcrumb.ts` | — | 2B | — | 4B | — |
| `hooks/useTaskSessionCount.ts` | — | 2B | — | 4B | — |
| `components/maestro/MaestroPanel.tsx` | — | 2B | — | 4A | — |
| `components/maestro/TaskDetailOverlay.tsx` | — | 2B | — | 4A | — |
| `components/app/AppTopbar.tsx` | — | — | — | 4A | — |
| `components/app/AppLeftPanel.tsx` | — | — | — | 4A | — |
| `components/maestro/CreateTaskModal.tsx` | — | 2B | — | — | — |
| `components/maestro/TaskListItem.tsx` | — | 2B | — | — | — |
| `components/maestro/TeamModal.tsx` | — | 2B | — | — | — |
| `components/maestro/TeamListItem.tsx` | — | 2B | — | — | — |
| `components/maestro/MultiProjectBoard.tsx` | — | 2B | — | 4A | — |
| `stores/useSecureStorageStore.ts` | — | — | — | — | — |

**Total files touched:** ~25–30

---

## 8. Risk Mitigation

### Highest-risk items

1. **Phase 2B (Map→Record):** Touches 30+ files. TypeScript compilation will catch all `.get()` / `.has()` / `.values()` usage, making this mechanically safe but review-intensive.
   - **Mitigation:** Do one entity type per PR (tasks first, then sessions, teamMembers, teams, taskLists, orderings)
   - **Mitigation:** Run full TypeScript compilation after each entity migration

2. **Phase 2C (session normalization):** Changes the core data structure consumers depend on.
   - **Mitigation:** Use dual-write pattern (keep `sessions` array alongside `sessionsById`) during migration
   - **Mitigation:** Deprecation warnings in dev mode for `sessions` array access

3. **Phase 5A (WebSocket batching):** Could introduce subtle timing bugs where a consumer reads stale state.
   - **Mitigation:** Only batch pure state updates; keep side-effect-bearing events (spawn, resume, prompt_send) immediate
   - **Mitigation:** Verify sound effects still fire on correct timing

### Rollback strategy
Each phase/step is a separate PR. If a regression is found:
1. Revert the specific PR
2. The previous phase continues to work independently
3. No cross-phase dependencies except where explicitly noted

---

## 9. Testing Strategy

### Manual testing checklist (per phase)

**Phase 1:**
- [ ] Start agent session → confirm agentWorking indicator toggles on/off correctly
- [ ] Rapid PTY output → confirm no visible jank
- [ ] Switch team members rapidly → confirm localStorage is eventually written
- [ ] Check persistence calls with `console.count('buildPersistedState')` → should be <1/sec during idle output

**Phase 2:**
- [ ] Create, update, delete tasks → verify store state matches
- [ ] Create, update, delete sessions → verify store state matches
- [ ] WebSocket events → verify real-time updates work
- [ ] Reload app → verify persisted state restores correctly
- [ ] Multi-project → verify cross-project filtering works
- [ ] Optimistic updates + rollback on API error → verify rollback works

**Phase 3:**
- [ ] Open/close project dialog → verify persistence is NOT triggered
- [ ] Create/rename project → verify persistence IS triggered

**Phase 4:**
- [ ] React DevTools Profiler → verify fewer re-renders on store updates
- [ ] Task list with 50+ items → verify scroll performance

**Phase 5:**
- [ ] Burst of WebSocket messages (e.g., start 5 sessions) → verify single render cycle
- [ ] Sound effects fire immediately on each event (not batched)
- [ ] Session spawn/resume works correctly (not batched)

### Automated testing
- TypeScript strict compilation — catches all Map→Record consumer migration issues
- Existing test suite (if any) — run before/after each phase
- Add unit tests for critical store actions (`setLoading`, `setError`, `batchSet`) if not already covered

---

## Summary: Implementation Order

| Step | Issue | Effort | Impact | Risk |
|------|-------|--------|--------|------|
| **1A** | Guard markAgentWorkingFromOutput | 15 min | High | Very Low |
| **1B** | Debounce lastUsedTeamMember write | 10 min | Low | Very Low |
| **1C** | Filter persistence triggers | 30 min | High | Low |
| **2A** | loading/errors → Record | 1 hr | Medium | Low |
| **2B** | All entities Map→Record | 3–4 hr | Critical | Medium |
| **4A** | Add useShallow everywhere | 2–3 hr | High | Low |
| **4B** | Item-specific selectors | 3–4 hr | High | Low |
| **3A** | Separate project dialog state | 1.5 hr | Medium | Low |
| **5A** | Batch WebSocket messages | 2 hr | Medium | Medium |
| **5B** | Persistence dirty flags | 1 hr | Medium | Low |
| **2C** | Normalize sessions to Record | 3–4 hr | High | High |
| **3B** | Split useMaestroStore (DEFERRED) | 6–8 hr | Medium | High |

**Total estimated effort:** ~18–22 hours (excluding deferred 3B)
