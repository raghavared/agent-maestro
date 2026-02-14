# Documentation for Session Improvements

## Executive Summary

This document identifies critical issues in session state management that cause **stale data** and **improper session cleanup** in the Agent Maestro application. The root cause is a **missing session deletion mechanism** that prevents sessions from being properly cleaned up when terminals close.

**Impact**:
- Sessions accumulate indefinitely in server storage and UI cache
- Stale session data persists in the UI after terminals close
- Session counts may show incorrect data
- Memory usage grows unbounded over time

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Session Lifecycle](#session-lifecycle)
3. [Identified Issues](#identified-issues)
4. [Root Cause Analysis](#root-cause-analysis)
5. [Current State Management Flow](#current-state-management-flow)
6. [Recommendations](#recommendations)

---

## Architecture Overview

### Components Involved

#### UI Layer
- **App.tsx**: Main application component, manages terminal sessions
- **MaestroContext.tsx**: Global state management for tasks and sessions
- **useMaestroWebSocket.ts**: WebSocket connection and event handling
- **SessionsSection.tsx**: Displays terminal sessions with expandable task info
- **TaskListItem.tsx**: Shows tasks with session counts
- **useTaskSessionCount.ts**: Hook to count active sessions for a task
- **useTaskSessions.ts**: Hook to fetch sessions for a task

#### Server Layer
- **maestro-server/src/storage.ts**: In-memory data store for projects, tasks, sessions
- **maestro-server/src/api/sessions.ts**: REST API endpoints for session operations
- **maestro-server/src/websocket.ts**: WebSocket event broadcasting
- **maestro-server/src/types.ts**: TypeScript type definitions

#### Integration Layer
- **src/utils/MaestroClient.ts**: API client for Maestro server
- **src/utils/maestroHelpers.ts**: Helper functions for Maestro session management

---

## Session Lifecycle

### Expected Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Lifecycle                        │
└─────────────────────────────────────────────────────────────┘

1. CREATE SESSION
   ├─ UI: User starts working on task
   ├─ Server: POST /api/sessions → Create session record
   ├─ Server: Emit 'session:created' WebSocket event
   ├─ UI: MaestroContext adds session to cache
   └─ UI: Terminal spawns with session ID

2. UPDATE SESSION
   ├─ Server: PATCH /api/sessions/:id → Update session status/data
   ├─ Server: Emit 'session:updated' WebSocket event
   └─ UI: MaestroContext updates session in cache

3. CLOSE/DELETE SESSION (❌ BROKEN)
   ├─ UI: User closes terminal
   ├─ UI: App.tsx calls completeMaestroSession()
   ├─ Server: PATCH /api/sessions/:id → Mark as 'completed'
   ├─ Server: Emit 'session:updated' WebSocket event
   └─ ❌ MISSING: DELETE session & emit 'session:deleted' event
```

### Current (Broken) Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│           What Actually Happens (Broken)                    │
└─────────────────────────────────────────────────────────────┘

1. Terminal Closes
   └─ App.tsx:4760 onClose(id) called

2. Complete Maestro Session
   ├─ App.tsx:4769 completeMaestroSession(maestroSessionId)
   ├─ maestroHelpers.ts:411 → PATCH /api/sessions/:id
   ├─ Set status='completed', completedAt=timestamp
   └─ Note: "Not deleting the session" (line 419)

3. Server Updates Session
   ├─ storage.ts:438 updateSession() called
   ├─ Session marked as completed in memory
   ├─ Session saved to disk
   └─ Emit 'session:updated' event

4. UI Receives Update
   ├─ useMaestroWebSocket.ts:170 'session:updated' handler
   ├─ MaestroContext.tsx:229 onSessionUpdated()
   └─ Session updated in cache (still present!)

5. Result: STALE DATA
   ├─ ✅ Session status = 'completed'
   ├─ ❌ Session still in server storage (grows unbounded)
   ├─ ❌ Session still in UI cache (stale data visible)
   └─ ❌ No cleanup event fired
```

---

## Identified Issues

### Issue 1: Missing DELETE Session Endpoint

**Location**: `maestro-server/src/storage.ts`

**Problem**: The `Storage` class has NO `deleteSession` method.

**Available Methods**:
- `createSession()` - ✅ Exists (line 372)
- `getSession()` - ✅ Exists (line 413)
- `listSessions()` - ✅ Exists (line 417)
- `updateSession()` - ✅ Exists (line 438)
- `addTaskToSession()` - ✅ Exists (line 456)
- `removeTaskFromSession()` - ✅ Exists (line 486)
- **`deleteSession()`** - ❌ **MISSING**

**Impact**:
- Sessions can never be deleted from storage
- Storage grows unbounded over time
- No way to clean up old/completed sessions

**Evidence**:
```typescript
// maestro-server/src/storage.ts - NO deleteSession method exists
// Only these methods are available for sessions:
- createSession(sessionData: CreateSessionPayload): Session
- getSession(id: string): Session | undefined
- listSessions(filter): Session[]
- updateSession(id: string, updates: UpdateSessionPayload): Session
- addTaskToSession(sessionId: string, taskId: string): Promise<void>
- removeTaskFromSession(sessionId: string, taskId: string): Promise<void>
```

---

### Issue 2: No DELETE API Endpoint

**Location**: `maestro-server/src/api/sessions.ts`

**Problem**: No `DELETE /api/sessions/:id` endpoint defined.

**Available Endpoints**:
```
POST   /api/sessions              → createSession     ✅
GET    /api/sessions              → listSessions      ✅
GET    /api/sessions/:id          → getSession        ✅
PATCH  /api/sessions/:id          → updateSession     ✅
POST   /api/sessions/:id/tasks/:taskId    → addTaskToSession    ✅
DELETE /api/sessions/:id/tasks/:taskId   → removeTaskFromSession ✅
POST   /api/sessions/spawn        → spawnSession      ✅
DELETE /api/sessions/:id          → ❌ MISSING
```

**Impact**:
- UI cannot delete sessions even if it wanted to
- `maestroClient.deleteSession()` would return 404

---

### Issue 3: Missing `session:deleted` WebSocket Event

**Location**: `maestro-server/src/websocket.ts`

**Problem**: The WebSocket server never emits `session:deleted` event because delete is never called.

**Available Events**:
```typescript
// maestro-server/src/websocket.ts
storage.on('task:created', (task) => broadcast('task:created', task))
storage.on('task:updated', (task) => broadcast('task:updated', task))
storage.on('task:deleted', (data) => broadcast('task:deleted', data))
storage.on('session:created', (session) => broadcast('session:created', session))
storage.on('session:updated', (session) => broadcast('session:updated', session))
storage.on('session:deleted', ...)  // ❌ NEVER FIRED (no emit in storage)
```

**Impact**:
- UI never receives notification to remove session from cache
- `MaestroContext.onSessionDeleted()` is never invoked
- Sessions remain in UI state indefinitely

---

### Issue 4: Improper Session Cleanup on Terminal Close

**Location**: `src/App.tsx:4760-4773`

**Problem**: When a terminal closes, the session is only marked as "completed", not deleted.

**Current Flow**:
```typescript
// src/App.tsx line 4760
async function onClose(id: string) {
  const session = sessionsRef.current.find((s) => s.id === id) ?? null;

  // Complete Maestro session if this is a Maestro terminal
  if (session?.maestroSessionId) {
    console.log('[App.onClose] Completing Maestro session:', session.maestroSessionId);
    void completeMaestroSession(session.maestroSessionId).catch((err) => {
      console.error('[App.onClose] Failed to complete Maestro session:', err);
    });
  }

  // ... rest of terminal cleanup
  // ❌ MISSING: Delete the Maestro session
}
```

**What completeMaestroSession does** (`src/utils/maestroHelpers.ts:411-424`):
```typescript
export async function completeSession(sessionId: string): Promise<void> {
    try {
        await maestroClient.updateSession(sessionId, {
            status: 'completed',
            completedAt: Date.now(),
        });
        console.log('[Maestro] ✓ Session marked as completed:', sessionId);

        // Note: Not deleting the session
        // If you want to delete, implement DELETE /api/sessions/:id on the server
    } catch (err) {
        console.error('[Maestro] Failed to complete session:', err);
    }
}
```

**Impact**:
- Sessions marked "completed" but never removed
- Terminal closes but Maestro session persists
- UI cache contains completed sessions indefinitely

---

### Issue 5: Stale Session Data in UI Cache

**Location**: `src/contexts/MaestroContext.tsx`

**Problem**: Completed sessions remain in the global state cache forever.

**State Structure**:
```typescript
// src/contexts/MaestroContext.tsx:105-110
type MaestroState = {
    tasks: Map<string, Task>;           // taskId -> Task
    sessions: Map<string, Session>;     // sessionId -> Session  ← GROWS FOREVER
    loading: Set<string>;
    errors: Map<string, string>;
};
```

**Cache Operations**:
```typescript
// Add to cache (line 221-226)
onSessionCreated: (session: Session) => {
    setState(prev => ({
        ...prev,
        sessions: new Map(prev.sessions).set(session.id, session),
    }));
}

// Update in cache (line 229-234)
onSessionUpdated: (session: Session) => {
    setState(prev => ({
        ...prev,
        sessions: new Map(prev.sessions).set(session.id, session),
    }));
}

// ❌ Delete from cache - NEVER CALLED
onSessionDeleted: (data: { id: string }) => {
    console.log('[MaestroContext] WebSocket: Session deleted', data.id);
    setState(prev => {
        const sessions = new Map(prev.sessions);
        const deleted = sessions.delete(data.id);
        console.log('[MaestroContext] Session deleted from cache?', deleted);
        return { ...prev, sessions };
    });
}
```

**Impact**:
- `state.sessions` Map grows unbounded
- Completed sessions remain in cache
- Memory usage increases over time
- UI may display stale session data

---

### Issue 6: Session Count Filter Masks the Problem

**Location**: `src/hooks/useTaskSessionCount.ts:19-29`

**Problem**: The hook filters out completed sessions, hiding the cache bloat.

```typescript
export function useTaskSessionCount(taskId: string | null | undefined): number {
    const { state } = useMaestroContext();

    return useMemo(() => {
        if (!taskId) return 0;

        // Count ACTIVE sessions (not completed) that contain this task
        let count = 0;
        for (const session of state.sessions.values()) {
            // Only count active sessions (running or failed, not completed)
            if (session.status !== 'completed' && session.taskIds.includes(taskId)) {
                count++;
            }
        }
        return count;
    }, [state.sessions, taskId]);
}
```

**Why This Masks the Issue**:
- Completed sessions are filtered out, so count appears correct
- BUT completed sessions still consume memory in cache
- Cache size grows: `state.sessions.size` includes all sessions
- Only active sessions are counted, giving false impression cleanup works

---

### Issue 7: Stale Data in Right Panel Session View

**Location**: `src/components/SessionsSection.tsx:84-110`

**Problem**: When sessions are expanded to show tasks, stale data persists.

**Flow**:
```typescript
// SessionsSection.tsx line 84
const sessionTasks = React.useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const session of sessions) {  // ← Terminal sessions from App.tsx
      if (session.maestroSessionId && expandedSessions.has(session.id)) {
        const maestroSession = state.sessions.get(session.maestroSessionId);  // ← From global cache

        if (maestroSession) {
          const tasks = maestroSession.taskIds  // ← May be stale!
            .map(taskId => state.tasks.get(taskId))
            .filter((task): task is Task => task !== undefined);

          map.set(session.id, tasks);
        }
      }
    }
    return map;
}, [state.sessions, state.tasks, sessions, expandedSessions]);
```

**Scenario**:
1. User opens terminal for Task A
2. Maestro session created with `taskIds: ['task_A']`
3. Session is expanded in UI, shows Task A
4. User closes terminal
5. Session marked `status='completed'` but remains in cache
6. **If session is still expanded**, it still shows Task A (stale!)
7. No cleanup happens because `session:deleted` never fires

---

## Root Cause Analysis

### Primary Root Cause

**Missing Session Deletion Mechanism**

The fundamental issue is that the system has **NO WAY** to delete sessions:

1. **Server** lacks `deleteSession()` method in Storage
2. **API** lacks `DELETE /api/sessions/:id` endpoint
3. **Events** never emit `session:deleted` WebSocket event
4. **UI** never removes sessions from cache

### Secondary Issues

These stem from the primary root cause:

1. **Terminal Closure**: Only marks session as "completed", doesn't delete
2. **Cache Bloat**: Completed sessions accumulate in UI state
3. **Memory Leak**: Both server storage and UI cache grow unbounded
4. **Stale UI**: Completed sessions may show outdated task associations

### Design Decision History

From `src/utils/maestroHelpers.ts:406-421`:

```typescript
/**
 * Completes a Maestro session when terminal closes
 *
 * Note: We only mark as completed, not delete, because:
 * 1. The DELETE endpoint may not exist on the server
 * 2. Keeping completed sessions provides history
 * 3. The UI filters out completed sessions from active counts
 */
```

**Analysis**:
- Reason 1: DELETE endpoint indeed doesn't exist (this doc confirms)
- Reason 2: Valid for audit trail, BUT should have time-based cleanup
- Reason 3: Filters mask the issue but don't solve memory growth

---

## Current State Management Flow

### 1. Session Creation Flow

```
┌────────────────────────────────────────────────────────────┐
│                  Session Creation                          │
└────────────────────────────────────────────────────────────┘

User Action: Start work on task
    │
    ├─> App.tsx: onCreateMaestroSession()
    │       │
    │       └─> buildMaestroSessionConfig()
    │               │
    │               └─> maestroClient.createSession()
    │                       │
    │                       └─> POST /api/sessions
    │
Server: storage.createSession()
    │
    ├─> Create session object
    ├─> Add to sessions Map
    ├─> Add sessionId to tasks' sessionIds arrays
    ├─> Save to disk
    └─> Emit 'session:created' event
    │
WebSocket: Broadcast 'session:created'
    │
UI: MaestroContext.onSessionCreated()
    │
    └─> Add session to state.sessions Map ✅
```

### 2. Session Update Flow

```
┌────────────────────────────────────────────────────────────┐
│                  Session Update                            │
└────────────────────────────────────────────────────────────┘

Terminal Activity: Status change
    │
    └─> PATCH /api/sessions/:id
    │
Server: storage.updateSession()
    │
    ├─> Update session in sessions Map
    ├─> Save to disk
    └─> Emit 'session:updated' event
    │
WebSocket: Broadcast 'session:updated'
    │
UI: MaestroContext.onSessionUpdated()
    │
    └─> Update session in state.sessions Map ✅
```

### 3. Session Deletion Flow (BROKEN)

```
┌────────────────────────────────────────────────────────────┐
│             Session Deletion (BROKEN)                      │
└────────────────────────────────────────────────────────────┘

User Action: Close terminal
    │
    └─> App.tsx: onClose(terminalSessionId)
            │
            └─> completeMaestroSession(maestroSessionId)
                    │
                    └─> PATCH /api/sessions/:id
                        { status: 'completed', completedAt: timestamp }
                            │
Server: storage.updateSession()  (NOT deleteSession!)
    │
    ├─> Update session.status = 'completed'
    ├─> Save to disk (session persists!)
    └─> Emit 'session:updated' event
    │
WebSocket: Broadcast 'session:updated' (NOT 'session:deleted'!)
    │
UI: MaestroContext.onSessionUpdated()
    │
    └─> Update session in cache (session still there!)

❌ MISSING STEPS:
    │
    └─> DELETE /api/sessions/:id  ← Endpoint doesn't exist
            │
            └─> storage.deleteSession()  ← Method doesn't exist
                    │
                    └─> Emit 'session:deleted'  ← Never happens
                            │
                            └─> UI: Remove from cache  ← Never called
```

### 4. Session-Task Relationship Management

```
┌────────────────────────────────────────────────────────────┐
│         Session-Task Bidirectional Relationship            │
└────────────────────────────────────────────────────────────┘

Data Model:
    Session {
        id: string
        taskIds: string[]  ← Array of task IDs
    }

    Task {
        id: string
        sessionIds: string[]  ← Array of session IDs
    }

Add Task to Session:
    POST /api/sessions/:sessionId/tasks/:taskId
        │
        └─> storage.addTaskToSession()
                │
                ├─> session.taskIds.push(taskId)
                ├─> task.sessionIds.push(sessionId)
                ├─> Emit 'session:task_added'
                └─> Emit 'task:session_added'

Remove Task from Session:
    DELETE /api/sessions/:sessionId/tasks/:taskId
        │
        └─> storage.removeTaskFromSession()
                │
                ├─> session.taskIds = session.taskIds.filter(id !== taskId)
                ├─> task.sessionIds = task.sessionIds.filter(id !== sessionId)
                ├─> Emit 'session:task_removed'
                └─> Emit 'task:session_removed'

❌ ISSUE: When session closes:
    - Session taskIds remain in cache (stale data)
    - Task sessionIds still reference dead session
    - No cleanup of bidirectional references
```

---

## Recommendations

### Priority 1: Implement Session Deletion (CRITICAL)

#### 1.1 Add deleteSession Method to Storage

**File**: `maestro-server/src/storage.ts`

**Add Method**:
```typescript
deleteSession(id: string): { success: boolean; id: string } {
  const session = this.sessions.get(id);
  if (!session) {
    throw new Error('Session not found');
  }

  // Remove session from all associated tasks
  for (const taskId of session.taskIds) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.sessionIds = task.sessionIds.filter(sid => sid !== id);
      task.timeline.push({
        id: this.makeId('evt'),
        type: 'session_ended',
        timestamp: Date.now(),
        sessionId: id
      });
      this.tasks.set(taskId, task);
    }
  }

  // Delete session
  this.sessions.delete(id);
  this.save();
  this.emit('session:deleted', { id });

  return { success: true, id };
}
```

#### 1.2 Add DELETE API Endpoint

**File**: `maestro-server/src/api/sessions.ts`

**Add Endpoint**:
```typescript
// Delete session
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const result = storage.deleteSession(req.params.id as string);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Session not found') {
      return res.status(404).json({
        error: true,
        message: 'Session not found'
      });
    }
    res.status(500).json({ error: true, message: err.message });
  }
});
```

#### 1.3 Add WebSocket Event Handler

**File**: `maestro-server/src/websocket.ts`

**Add Handler**:
```typescript
storage.on('session:deleted', (data: { id: string }) => {
  broadcast('session:deleted', data);
});
```

### Priority 2: Update Terminal Close Flow (CRITICAL)

#### 2.1 Change completeMaestroSession to deleteMaestroSession

**File**: `src/utils/maestroHelpers.ts`

**Replace Function**:
```typescript
/**
 * Deletes a Maestro session when terminal closes
 *
 * This ensures proper cleanup of session data from server and UI cache.
 */
export async function deleteMaestroSession(sessionId: string): Promise<void> {
    try {
        await maestroClient.deleteSession(sessionId);
        console.log('[Maestro] ✓ Session deleted:', sessionId);
    } catch (err) {
        console.error('[Maestro] Failed to delete session:', err);
        // Still try to mark as completed as fallback
        try {
            await maestroClient.updateSession(sessionId, { status: 'completed' });
        } catch (fallbackErr) {
            console.error('[Maestro] Fallback update also failed:', fallbackErr);
        }
    }
}
```

#### 2.2 Update App.tsx Terminal Close Handler

**File**: `src/App.tsx:4760-4773`

**Change**:
```typescript
// OLD:
import { completeSession as completeMaestroSession } from "./utils/maestroHelpers";

// NEW:
import { deleteMaestroSession } from "./utils/maestroHelpers";

// In onClose function:
async function onClose(id: string) {
  clearAgentIdleTimer(id);
  lastResizeAtRef.current.delete(id);
  const session = sessionsRef.current.find((s) => s.id === id) ?? null;

  // Delete Maestro session if this is a Maestro terminal
  if (session?.maestroSessionId) {
    console.log('[App.onClose] Deleting Maestro session:', session.maestroSessionId);
    void deleteMaestroSession(session.maestroSessionId).catch((err) => {
      console.error('[App.onClose] Failed to delete Maestro session:', err);
      // Don't block terminal closing on this error
    });
  }

  // ... rest of cleanup
}
```

### Priority 3: Add Session Cleanup Policies (HIGH)

#### 3.1 Time-Based Cleanup

**Purpose**: Auto-delete old completed sessions

**Implementation**: Add cron job or periodic cleanup

```typescript
// maestro-server/src/storage.ts

cleanupOldSessions(olderThanMs: number = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [id, session] of this.sessions) {
    if (session.status === 'completed' && session.completedAt) {
      const age = now - session.completedAt;
      if (age > olderThanMs) {
        toDelete.push(id);
      }
    }
  }

  console.log(`[Storage] Cleaning up ${toDelete.length} old sessions`);
  for (const id of toDelete) {
    this.deleteSession(id);
  }
}

// Run cleanup daily
setInterval(() => {
  storage.cleanupOldSessions(7 * 24 * 60 * 60 * 1000); // 7 days
}, 24 * 60 * 60 * 1000);
```

#### 3.2 UI Cache Eviction

**Purpose**: Prevent unbounded cache growth

```typescript
// src/contexts/MaestroContext.tsx

// Add cache size limit
const MAX_CACHED_SESSIONS = 100;
const MAX_COMPLETED_SESSIONS = 20;

// In cleanup effect:
useEffect(() => {
  const interval = setInterval(() => {
    setState(prev => {
      const sessions = new Map(prev.sessions);
      const completed = Array.from(sessions.values())
        .filter(s => s.status === 'completed')
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      // Keep only recent completed sessions
      const toRemove = completed.slice(MAX_COMPLETED_SESSIONS);
      toRemove.forEach(s => sessions.delete(s.id));

      return { ...prev, sessions };
    });
  }, 60000); // Every minute

  return () => clearInterval(interval);
}, []);
```

### Priority 4: Add Monitoring and Debugging (MEDIUM)

#### 4.1 Cache Size Metrics

```typescript
// Add to MaestroContext
const getCacheMetrics = useCallback(() => {
  const total = state.sessions.size;
  const byStatus = {
    running: 0,
    completed: 0,
    failed: 0,
    spawning: 0
  };

  for (const session of state.sessions.values()) {
    byStatus[session.status]++;
  }

  console.log('[MaestroContext] Cache metrics:', { total, byStatus });
  return { total, byStatus };
}, [state.sessions]);

// Expose in context value
return { state, getCacheMetrics, ... };
```

#### 4.2 Session Lifecycle Logging

Add comprehensive logging at each stage:
- Session creation
- Session update
- Session deletion
- Cache add/update/remove
- WebSocket event receipt

### Priority 5: Add Tests (MEDIUM)

#### 5.1 Server Tests

```typescript
describe('Session Deletion', () => {
  it('should delete session and clean up task references', async () => {
    const session = storage.createSession({ ... });
    const task = storage.getTask(session.taskIds[0]);

    expect(task.sessionIds).toContain(session.id);

    storage.deleteSession(session.id);

    const updatedTask = storage.getTask(task.id);
    expect(updatedTask.sessionIds).not.toContain(session.id);
    expect(storage.getSession(session.id)).toBeUndefined();
  });

  it('should emit session:deleted event', async () => {
    const emitSpy = jest.spyOn(storage, 'emit');
    const session = storage.createSession({ ... });

    storage.deleteSession(session.id);

    expect(emitSpy).toHaveBeenCalledWith('session:deleted', { id: session.id });
  });
});
```

#### 5.2 UI Tests

```typescript
describe('MaestroContext Session Deletion', () => {
  it('should remove session from cache on session:deleted event', async () => {
    const { result } = renderHook(() => useMaestroContext());

    // Simulate session creation
    act(() => {
      result.current.onSessionCreated(mockSession);
    });

    expect(result.current.state.sessions.has(mockSession.id)).toBe(true);

    // Simulate session deletion
    act(() => {
      result.current.onSessionDeleted({ id: mockSession.id });
    });

    expect(result.current.state.sessions.has(mockSession.id)).toBe(false);
  });
});
```

---

## Summary

### Critical Issues

1. ❌ **No DELETE session endpoint** - sessions cannot be deleted
2. ❌ **No session:deleted WebSocket event** - UI never notified of deletions
3. ❌ **Terminal close only marks completed** - sessions never removed
4. ❌ **UI cache grows unbounded** - memory leak
5. ❌ **Stale session data persists** - incorrect UI state

### Required Changes

1. ✅ Implement `storage.deleteSession()` method
2. ✅ Add `DELETE /api/sessions/:id` endpoint
3. ✅ Add `session:deleted` WebSocket event broadcast
4. ✅ Change terminal close to DELETE session (not just mark completed)
5. ✅ Verify UI cache cleanup on `session:deleted` event
6. ✅ Add session cleanup policies (time-based, cache limits)

### Implementation Order

1. **Server changes** (deleteSession, API endpoint, WebSocket event)
2. **UI changes** (update terminal close flow)
3. **Cleanup policies** (time-based cleanup, cache limits)
4. **Monitoring** (metrics, logging)
5. **Tests** (server and UI tests)

---

## Related Files

### Server Files
- `maestro-server/src/storage.ts` - Add deleteSession method
- `maestro-server/src/api/sessions.ts` - Add DELETE endpoint
- `maestro-server/src/websocket.ts` - Add session:deleted broadcast
- `maestro-server/src/types.ts` - Type definitions (no changes needed)

### UI Files
- `src/App.tsx` - Update onClose to delete sessions
- `src/utils/maestroHelpers.ts` - Replace completeSession with deleteSession
- `src/contexts/MaestroContext.tsx` - Verify onSessionDeleted handler
- `src/hooks/useMaestroWebSocket.ts` - Verify session:deleted event handling
- `src/components/SessionsSection.tsx` - Verify UI updates after deletion
- `src/hooks/useTaskSessionCount.ts` - Should automatically work after fix
- `src/hooks/useTaskSessions.ts` - Should automatically work after fix

---

## Conclusion

The session state inconsistency issues are **entirely caused by the missing session deletion mechanism**. Implementing proper session deletion with WebSocket events will resolve:

- ✅ Stale session data in UI
- ✅ Improper cleanup when terminals close
- ✅ Unbounded cache growth
- ✅ Memory leaks in server and UI
- ✅ Incorrect session counts

This is a **straightforward fix** with clear implementation steps and high impact on application reliability and performance.
