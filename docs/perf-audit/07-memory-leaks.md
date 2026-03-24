# Perf Audit: Memory Leaks & Cleanup

## Executive Summary

The codebase is **generally well-structured** regarding cleanup. Most `useEffect` hooks return cleanup functions, event listeners are properly removed, and the main `initApp.ts` orchestrator correctly tears down listeners, intervals, and WebSocket connections. However, several **unbounded data structures**, **missing cleanup paths**, and **potential leak vectors** exist that would cause memory growth over long-running sessions (200+ sessions).

**Severity scale**: CRITICAL > HIGH > MEDIUM > LOW

---

## 1. Unbounded Store Growth (HIGH)

### 1a. `useMaestroStore` — Records never pruned across projects

**File**: `maestro-ui/src/stores/useMaestroStore.ts`

The store uses `Record<string, T>` for `tasks`, `sessions`, `teamMembers`, `teams`, `taskLists`. When switching projects, `fetchTasks` **adds** tasks to the existing record without removing stale entries from the previous project:

```ts
// Line ~602: fetchTasks only adds, never removes old project's tasks
set((prev) => {
  const updated = { ...prev.tasks };
  for (const task of tasks) { updated[task.id] = task; }
  return { tasks: updated };
});
```

`fetchTeamMembers` and `fetchTeams` correctly filter by `projectId` before adding, but `fetchTasks` does not. Over time with many projects, the `tasks` record accumulates entries from all visited projects.

**WebSocket handlers** also only add/update — `task:created` / `task:updated` / `session:created` / `session:updated` all insert into records without any eviction. Deleted entries are removed on `*:deleted` events, but if the user never deletes anything, the records grow monotonically.

**Impact**: With 200+ sessions and hundreds of tasks, these records could hold thousands of entries in memory indefinitely.

**Fix**: Add project-scoped cleanup in `fetchTasks` (same pattern used by `fetchTeamMembers`), or implement a `clearCache()` that prunes stale project data when switching projects.

### 1b. `lastUsedTeamMember` — never pruned

**File**: `maestro-ui/src/stores/useMaestroStore.ts:1049-1063`

```ts
setLastUsedTeamMember: (taskId, teamMemberId) => {
  set((prev) => ({
    lastUsedTeamMember: { ...prev.lastUsedTeamMember, [taskId]: teamMemberId },
  }));
```

Maps `taskId → teamMemberId` and persists to localStorage. Entries for deleted tasks are never removed. Over months of use, this grows unboundedly.

**Fix**: Prune entries for task IDs not present in `tasks` record periodically (e.g., during `fetchTasks`).

### 1c. `loading` and `errors` records — keys accumulate

**File**: `maestro-ui/src/stores/useMaestroStore.ts:210-226`

Loading and error keys like `tasks:${projectId}`, `task:${taskId}`, `sessions` etc. are added and removed individually. While `setLoading(key, false)` does remove the key, error keys persist until explicitly cleared by a subsequent successful fetch. If a task is deleted without re-fetching, its error key remains forever.

**Impact**: LOW — these are small strings, but still technically unbounded.

### 1d. `activeModals` array — potential accumulation

**File**: `maestro-ui/src/stores/useMaestroStore.ts`

`showAgentModal` appends to the array. `closeAgentModal` filters by `modalId`. If a modal event arrives but the user never explicitly closes it (or the component unmounts before closing), the entry persists. No TTL or auto-cleanup exists.

**Fix**: Add a maximum modal count or auto-expire old modals.

---

## 2. Module-Level Maps Never Cleaned (MEDIUM)

### 2a. `soundManager` — audioContext, lastPlayedTime, teamMemberInstruments

**File**: `maestro-ui/src/services/soundManager.ts`

- `audioContext: Map<string, HTMLAudioElement>` (line 485): Cached `HTMLAudioElement` instances keyed by `${instrument}:${note}`. Grows as different instrument+note combos are played. Each entry holds a DOM element. The map is cleared on instrument change (`setInstrument`, `setProjectConfig`, `setActiveProject`), but if the user never changes instruments, it accumulates indefinitely.

- `lastPlayedTime: Map<string, number>` (line 520): Debounce timestamps keyed by event type string. Only ~70 possible event types, so bounded in practice.

- `teamMemberInstruments: Map<string, InstrumentType>` (line 517): Grows with team members. Members are unregistered on delete, but if the app is restarted without cleanup, old entries from previous runs persist until `unregisterTeamMember` is called.

- `projectConfigs: Map<string, ProjectSoundConfig>` (line 513): Grows with projects. Persisted to localStorage but never pruned of deleted projects.

**Impact**: The `audioContext` map is the primary concern — each `HTMLAudioElement` holds a decoded audio buffer. With ensemble mode playing multiple instruments, this could accumulate 50-100+ audio elements.

### 2b. `useSessionStore` module-level Maps

**File**: `maestro-ui/src/stores/useSessionStore.ts:35-41`

```ts
export const pendingExitCodes = new Map<string, number | null>();
export const closingSessions = new Map<string, number>();
export const agentIdleTimersRef = new Map<string, number>();
export const lastResizeAtRef = new Map<string, number>();
export const commandLifecycleSessionsRef = new Set<string>();
export const spawningSessionsRef = new Set<string>();
```

These are cleaned up in `initApp.ts` cleanup (lines 799-804), but **only during app shutdown**. During normal operation:
- `pendingExitCodes`: Entries deleted in `applyPendingExit`, but only if a session is restored. Race conditions could leave orphans.
- `closingSessions`: Entries have a 30s self-cleanup timeout, so bounded.
- `agentIdleTimersRef`: Cleared per-session on idle or exit. OK.
- `lastResizeAtRef`: Cleared per-session on exit. OK.
- `commandLifecycleSessionsRef` / `spawningSessionsRef`: Only `.add()` called, never `.delete()` except in shutdown. **Grows monotonically** with every session that reports a command change.

**Fix**: `commandLifecycleSessionsRef` should prune entries for closed/exited sessions.

### 2c. `lastActiveByProject` Map

**File**: `maestro-ui/src/stores/useProjectStore.ts:16`

```ts
export const lastActiveByProject = new Map<string, string>();
```

Entries are added when switching projects but never removed for deleted projects. Bounded by project count, so LOW impact.

---

## 3. WebSocket Lifecycle (MEDIUM)

### 3a. `useMaestroWebSocket.ts` — deprecated but still importable

**File**: `maestro-ui/src/hooks/useMaestroWebSocket.ts`

Marked `@deprecated` but still exported. If accidentally imported, it creates a **second global WebSocket** (`globalWs` at module scope, line 11) independent of the one in `useMaestroStore.ts` (line 29). Both use the same variable name `globalWs` but in different modules, so they'd create duplicate connections.

The hook's `globalListeners: Set<(event: MessageEvent) => void>` (line 13) is a module-level Set. If the hook is used by multiple components, listeners accumulate. They are properly cleaned up on unmount (line 241-244), but the global WebSocket is only closed when `globalListeners.size === 0`.

**Fix**: Delete this deprecated file to prevent accidental double-connection.

### 3b. `useMaestroStore` WebSocket — reconnect timeout leak edge case

**File**: `maestro-ui/src/stores/useMaestroStore.ts:543-566`

The `onclose` handler correctly guards against stale WebSocket references:
```ts
if (globalWs !== ws) return;
```

However, the `globalReconnectTimeout` is stored module-level and only cleared in `destroyWebSocket`. If `initWebSocket` is called twice rapidly (e.g., React StrictMode), the first WS's reconnect timeout could fire after the second WS is established. The guard in `onclose` mitigates this for the close event, but `destroyWebSocket` might not clear a still-pending reconnect from a stale instance.

**Impact**: LOW — the reconnect would create a third connection, but the stale guard prevents cascading issues.

### 3c. Debounced refetch timers — not cleaned up on destroy

**File**: `maestro-ui/src/stores/useMaestroStore.ts:121-148`

```ts
const pendingTaskRefetches = new Set<string>();
const pendingSessionRefetches = new Set<string>();
let taskRefetchTimer: ReturnType<typeof setTimeout> | null = null;
let sessionRefetchTimer: ReturnType<typeof setTimeout> | null = null;
```

These module-level timers and Sets are never cleared in `destroyWebSocket`. If the WebSocket is destroyed while a debounced refetch is pending, the timer fires and calls `fetchTask`/`fetchSession` on a potentially stale store.

**Fix**: Clear `taskRefetchTimer` and `sessionRefetchTimer` in `destroyWebSocket`.

---

## 4. useEffect Cleanup Audit (LOW-MEDIUM)

### 4a. `PromptSendAnimation` — setTimeout without full cleanup

**File**: `maestro-ui/src/components/PromptSendAnimation.tsx:38-85`

The `FlyingDot` component's useEffect creates multiple `setTimeout` calls:
- Line 49: `cleanupTimer` — returned from useEffect for cleanup ✓
- Line 60: `setTimeout(() => senderEl.classList.remove(...), 800)` — **NOT cleaned up**. If component unmounts before 800ms, the callback runs on a potentially unmounted DOM element.
- Line 76: `setTimeout(() => setTargetPulse(...), 700)` — **NOT cleaned up**. Calls `setTargetPulse` after unmount.

**Impact**: LOW — these are cosmetic animations and the DOM manipulation is harmless, but `setTargetPulse` would trigger a React "setState on unmounted component" warning.

### 4b. `useStatePersistence` — timer not cleaned up on unmount

**File**: `maestro-ui/src/hooks/useStatePersistence.ts:127-181`

The `saveTimerRef.current` is set in useEffect but **no cleanup function is returned** from that effect to clear it:
```ts
useEffect(() => {
  if (!hydrated || persistenceDisabledReason) return;
  if (saveTimerRef.current !== null) {
    window.clearTimeout(saveTimerRef.current);
  }
  // ...sets up new timer...
  saveTimerRef.current = window.setTimeout(() => { ... }, 400);
}, [/* many deps */]);
// No return () => clearTimeout(saveTimerRef.current)
```

The timer is cleared on re-runs (line 129-131) but not on unmount. If the component unmounts mid-timer, the callback fires and calls `invoke('save_persisted_state')` — harmless functionally but technically a leak.

**Note**: This appears to be the OLD hook-based persistence, now replaced by `persistence.ts`. If `useStatePersistence` is no longer used, it should be deleted.

### 4c. `useSessionLifecycle` — Maps in useRef never cleaned

**File**: `maestro-ui/src/hooks/useSessionLifecycle.ts:21-23`

```ts
const agentIdleTimersRef = useRef<Map<string, number>>(new Map());
const commandLifecycleSessionsRef = useRef<Set<string>>(new Set());
const lastResizeAtRef = useRef<Map<string, number>>(new Map());
```

This hook appears to be an older version now superseded by the store-level equivalents. The Maps/Sets grow with sessions and are never cleared on unmount. No cleanup effect exists.

**Impact**: LOW if this hook is unused. Should be deleted if superseded.

### 4d. `useMaestroSessions` — spawningSessionsRef never cleared

**File**: `maestro-ui/src/hooks/useMaestroSessions.ts:18`

```ts
const spawningSessionsRef = useRef<Set<string>>(new Set());
```

Entries are added (line 54) and removed after a 2-second delay (line 85-87), but if the component unmounts before the 2-second timeout fires, the timeout runs on an unmounted ref. The Set itself is in a useRef and would be GC'd with the component, so the practical impact is minimal.

---

## 5. Interval/Timer Leaks (LOW)

### 5a. `initApp.ts` — intervals properly cleaned

**File**: `maestro-ui/src/stores/initApp.ts:695-777`

Both `orphanCleanupInterval` (30s) and `updateCheckInterval` (30min) are pushed to `unlisteners` and cleaned up in the return function. ✓

### 5b. `SessionLogModal` — polling interval properly cleaned

**File**: `maestro-ui/src/components/session-log/SessionLogModal.tsx:175-177`

```ts
const interval = setInterval(poll, POLL_INTERVAL);
return () => clearInterval(interval);
```

Properly cleaned up. ✓

### 5c. `usePromptAnimationStore` — auto-remove timer

**File**: `maestro-ui/src/stores/usePromptAnimationStore.ts:27-31`

```ts
setTimeout(() => {
  set((prev) => ({ animations: prev.animations.filter((a) => a.id !== id) }));
}, 1500);
```

This timeout is not cancellable. If the store is destroyed (unlikely — it's a global singleton), the timeout would fire on a stale store. In practice this is fine since Zustand stores are module-level singletons.

### 5d. `TaskStatusControl` — timer cleanup

**File**: `maestro-ui/src/components/maestro/TaskStatusControl.tsx:54`

```ts
const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
```

Timers are pushed to this array (lines 108, 113) but there's no explicit cleanup effect to clear them on unmount. However, since these are short-lived UI timers (500ms, 3000ms), the practical impact is minimal.

---

## 6. Event Listener Audit (OK — generally clean)

### Well-cleaned event listeners:
- `useKeyboardShortcuts.ts:413-414`: `keydown` added/removed correctly ✓
- `App.tsx:134-136`: `keydown` listener with cleanup ✓
- `App.tsx:148-153`: `dragover`/`drop` listeners with cleanup ✓
- `useNotifications.ts:48-53`: `error`/`unhandledrejection` with cleanup ✓
- `useWorkspaceResizeEffect.ts:121-122`: `mousemove`/`mouseup` with cleanup ✓
- `useAppLayoutResizing.ts:69-71,131-133`: `pointermove`/`pointerup` added in handlers, removed in handlers ✓
- `useUIStore.ts:463-478`: `initGlobalErrorHandlers` returns cleanup ✓
- `SessionLogModal.tsx:90-91`: `keydown` with cleanup ✓

### Potential issues:
- `useBoardDrag.ts:141-143`: `pointermove`/`pointerup`/`keydown` are added in `onPointerDown` handler but removed in `onUp`/`onKeyDown`. If the user navigates away mid-drag, listeners may leak until the next mouseup.
- `CodeEditorPanel.tsx:488-489`: `mousedown`/`keydown` listeners — need to verify cleanup exists.
- `FileExplorerPanel.tsx:835`: `mouseup` global listener — need to verify cleanup.

---

## 7. Stale Closure Risks (LOW)

### 7a. `useKeyboardShortcuts` — uses `getState()` pattern correctly

The hook reads modal states reactively as dependencies, but uses `getState()` for session/project data inside the callback (line 184-186). This is the correct pattern to avoid stale closures.

### 7b. `useMaestroStore` WebSocket `handleMessage` — closure captures `get`

The `handleMessage` function captures `get` from the Zustand creator, which always returns current state. No stale closure risk. ✓

### 7c. `initApp.ts` — closure over `cancelled` flag

The `cancelled` flag (line 57) is correctly captured by the async `setup()` function and checked at multiple points. ✓

---

## 8. Recommendations Summary

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `useMaestroStore.tasks` never pruned across projects | HIGH | Filter by projectId in `fetchTasks` like `fetchTeamMembers` does |
| 2 | `lastUsedTeamMember` grows unboundedly | HIGH | Prune deleted task IDs periodically |
| 3 | `commandLifecycleSessionsRef` / `spawningSessionsRef` never pruned | MEDIUM | Clean entries for exited sessions |
| 4 | Deprecated `useMaestroWebSocket.ts` can cause duplicate WS | MEDIUM | Delete the file |
| 5 | Debounced refetch timers not cleared in `destroyWebSocket` | MEDIUM | Clear `taskRefetchTimer`/`sessionRefetchTimer` in destroy |
| 6 | `soundManager.audioContext` Map grows with instrument combos | MEDIUM | Add LRU eviction or periodic cleanup |
| 7 | `PromptSendAnimation` setTimeout not cleaned on unmount | LOW | Track and clear all timeouts |
| 8 | `useStatePersistence` old hook — timer not cleaned on unmount | LOW | Delete if unused (replaced by `persistence.ts`) |
| 9 | `useSessionLifecycle` old hook — refs not cleaned | LOW | Delete if unused |
| 10 | `activeModals` array has no TTL/max-size | LOW | Add auto-expire for old modals |
| 11 | `soundManager.projectConfigs` never pruned of deleted projects | LOW | Prune on project delete |
| 12 | `TaskStatusControl` timers not cleaned on unmount | LOW | Add cleanup effect |

---

## 9. What's Done Well

- **`initApp.ts`**: Comprehensive cleanup function that tears down all Tauri listeners, intervals, timers, and module-level Maps. The `cancelled` flag pattern prevents work after unmount.
- **`persistence.ts`**: Clean subscription-based persistence with proper timer cleanup in the returned function.
- **`initCentralPersistence` / `initWorkspaceViewPersistence`**: Both return cleanup functions that are called in `App.tsx`.
- **`useMaestroStore.initWebSocket` / `destroyWebSocket`**: Proper WebSocket lifecycle with stale-connection guards.
- **Most `useEffect` hooks**: The vast majority return cleanup functions that remove event listeners and clear timers.
- **`useNotifications`**: Timer cleanup on unmount ✓.
- **`useKeyboardShortcuts`**: Proper add/remove of keydown listener ✓.
- **Zustand stores**: Module-level singletons that don't create per-component instances, avoiding hook-based leak patterns.
