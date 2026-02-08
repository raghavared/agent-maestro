# Implementation Guide

## Overview

This guide provides **step-by-step instructions** for implementing the Phase V state management framework.

---

## Implementation Phases

### Phase 1: Foundation
- ✅ Set up MaestroContext
- ✅ Create basic resource hooks
- ✅ Test with MaestroPanel

### Phase 2: Left Panel Integration
- ✅ Integrate with SessionsSection
- ✅ Add useSessionTasks hook
- ✅ Test session expansion

### Phase 3: Right Panel Integration
- ✅ Integrate with TaskListItem
- ✅ Add useTaskSessions hook
- ✅ Test task expansion

### Phase 4: Optimistic Updates
- ✅ Add useOptimistic hook
- ✅ Implement remove operations
- ✅ Test rollback scenarios

### Phase 5: Polish & Testing
- ✅ Error handling
- ✅ Edge case testing
- ✅ Performance optimization

---

## Phase 1: Foundation

### Step 1.1: Create MaestroContext

Create `src/contexts/MaestroContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { maestroClient, Task, Session, CreateTaskPayload, CreateSessionPayload } from '../utils/MaestroClient';
import { useMaestroWebSocket } from '../hooks/useMaestroWebSocket';

type MaestroState = {
  tasks: Map<string, Task>;
  sessions: Map<string, Session>;
  loading: Set<string>;
  errors: Map<string, string>;
};

type MaestroContextValue = {
  state: MaestroState;
  fetchTasks: (projectId: string) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  fetchSessions: (taskId?: string) => Promise<void>;
  fetchSession: (sessionId: string) => Promise<void>;
  createTask: (data: CreateTaskPayload) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  createSession: (data: CreateSessionPayload) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  addTaskToSession: (sessionId: string, taskId: string) => Promise<void>;
  removeTaskFromSession: (sessionId: string, taskId: string) => Promise<void>;
};

const MaestroContext = createContext<MaestroContextValue | null>(null);

export function MaestroProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MaestroState>({
    tasks: new Map(),
    sessions: new Map(),
    loading: new Set(),
    errors: new Map(),
  });

  // Helper to add/remove loading state
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setState(prev => {
      const loading = new Set(prev.loading);
      if (isLoading) {
        loading.add(key);
      } else {
        loading.delete(key);
      }
      return { ...prev, loading };
    });
  }, []);

  // Helper to set error
  const setError = useCallback((key: string, error: string | null) => {
    setState(prev => {
      const errors = new Map(prev.errors);
      if (error) {
        errors.set(key, error);
      } else {
        errors.delete(key);
      }
      return { ...prev, errors };
    });
  }, []);

  // WebSocket event handlers
  useMaestroWebSocket({
    onTaskCreated: (task) => {
      setState(prev => ({
        ...prev,
        tasks: new Map(prev.tasks).set(task.id, task),
      }));
    },

    onTaskUpdated: (task) => {
      setState(prev => ({
        ...prev,
        tasks: new Map(prev.tasks).set(task.id, task),
      }));
    },

    onTaskDeleted: (data) => {
      setState(prev => {
        const tasks = new Map(prev.tasks);
        tasks.delete(data.id);
        return { ...prev, tasks };
      });
    },

    onSessionCreated: (session) => {
      setState(prev => ({
        ...prev,
        sessions: new Map(prev.sessions).set(session.id, session),
      }));
    },

    onSessionUpdated: (session) => {
      setState(prev => ({
        ...prev,
        sessions: new Map(prev.sessions).set(session.id, session),
      }));
    },

    onSessionDeleted: (data) => {
      setState(prev => {
        const sessions = new Map(prev.sessions);
        sessions.delete(data.id);
        return { ...prev, sessions };
      });
    },
  });

  // Fetch methods
  const fetchTasks = useCallback(async (projectId: string) => {
    const key = `tasks:${projectId}`;
    setLoading(key, true);
    setError(key, null);

    try {
      const tasks = await maestroClient.getTasks(projectId);
      setState(prev => {
        const taskMap = new Map(prev.tasks);
        tasks.forEach(task => taskMap.set(task.id, task));
        return { ...prev, tasks: taskMap };
      });
    } catch (err) {
      setError(key, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  const fetchTask = useCallback(async (taskId: string) => {
    const key = `task:${taskId}`;
    setLoading(key, true);
    setError(key, null);

    try {
      const task = await maestroClient.getTask(taskId);
      setState(prev => ({
        ...prev,
        tasks: new Map(prev.tasks).set(task.id, task),
      }));
    } catch (err) {
      setError(key, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  const fetchSessions = useCallback(async (taskId?: string) => {
    const key = taskId ? `sessions:task:${taskId}` : 'sessions';
    setLoading(key, true);
    setError(key, null);

    try {
      const sessions = await maestroClient.getSessions(taskId);
      setState(prev => {
        const sessionMap = new Map(prev.sessions);
        sessions.forEach(session => sessionMap.set(session.id, session));
        return { ...prev, sessions: sessionMap };
      });
    } catch (err) {
      setError(key, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  const fetchSession = useCallback(async (sessionId: string) => {
    const key = `session:${sessionId}`;
    setLoading(key, true);
    setError(key, null);

    try {
      const session = await maestroClient.getSession(sessionId);
      setState(prev => ({
        ...prev,
        sessions: new Map(prev.sessions).set(session.id, session),
      }));
    } catch (err) {
      setError(key, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  // Mutation methods
  const createTask = useCallback(async (data: CreateTaskPayload) => {
    return await maestroClient.createTask(data);
    // Task will be added via WebSocket event
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    return await maestroClient.updateTask(taskId, updates);
    // Task will be updated via WebSocket event
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await maestroClient.deleteTask(taskId);
    // Task will be removed via WebSocket event
  }, []);

  const createSession = useCallback(async (data: CreateSessionPayload) => {
    return await maestroClient.createSession(data);
    // Session will be added via WebSocket event
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await maestroClient.deleteSession(sessionId);
    // Session will be removed via WebSocket event
  }, []);

  const addTaskToSession = useCallback(async (sessionId: string, taskId: string) => {
    await maestroClient.addTaskToSession(sessionId, taskId);
    // Relationship will be updated via WebSocket events
  }, []);

  const removeTaskFromSession = useCallback(async (sessionId: string, taskId: string) => {
    await maestroClient.removeTaskFromSession(sessionId, taskId);
    // Relationship will be updated via WebSocket events
  }, []);

  const value: MaestroContextValue = {
    state,
    fetchTasks,
    fetchTask,
    fetchSessions,
    fetchSession,
    createTask,
    updateTask,
    deleteTask,
    createSession,
    deleteSession,
    addTaskToSession,
    removeTaskFromSession,
  };

  return (
    <MaestroContext.Provider value={value}>
      {children}
    </MaestroContext.Provider>
  );
}

export function useMaestroContext() {
  const context = useContext(MaestroContext);
  if (!context) {
    throw new Error('useMaestroContext must be used within MaestroProvider');
  }
  return context;
}
```

---

### Step 1.2: Wrap App with Provider

In `App.tsx`:

```typescript
import { MaestroProvider } from './contexts/MaestroContext';

function App() {
  return (
    <MaestroProvider>
      {/* Existing app content */}
      <div className="app">
        <SessionsSection ... />
        <MaestroPanel ... />
      </div>
    </MaestroProvider>
  );
}
```

---

### Step 1.3: Create useTasks Hook

Create `src/hooks/useTasks.ts`:

```typescript
import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';

export function useTasks(projectId: string | null | undefined) {
  const { state, fetchTasks } = useMaestroContext();

  // Fetch tasks on mount or when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchTasks(projectId);
    }
  }, [projectId, fetchTasks]);

  // Filter tasks for this project
  const tasks = useMemo(() => {
    if (!projectId) return [];
    return Array.from(state.tasks.values()).filter(
      task => task.projectId === projectId
    );
  }, [state.tasks, projectId]);

  const loading = projectId ? state.loading.has(`tasks:${projectId}`) : false;
  const error = projectId ? state.errors.get(`tasks:${projectId}`) : undefined;

  return {
    tasks,
    loading,
    error,
  };
}
```

---

### Step 1.4: Test with MaestroPanel

Update `MaestroPanel.tsx` to use the new hook:

```typescript
import { useTasks } from '../../hooks/useTasks';
import { useMaestroContext } from '../../contexts/MaestroContext';

export function MaestroPanel({ projectId, ... }: Props) {
  // Replace old state management with hook
  const { tasks, loading, error } = useTasks(projectId);
  const { createTask, updateTask, deleteTask } = useMaestroContext();

  // Remove old useEffect, useState, useMaestroWebSocket calls

  // Rest of component unchanged
  return (
    <div className="maestroPanel">
      {loading && <div>Loading tasks...</div>}
      {error && <div>Error: {error}</div>}
      {tasks.map(task => (
        <TaskListItem
          key={task.id}
          task={task}
          onDelete={() => deleteTask(task.id)}
          {...}
        />
      ))}
    </div>
  );
}
```

**Test:**
- ✅ Tasks load on mount
- ✅ New task appears immediately (via WebSocket)
- ✅ Updated task updates in list
- ✅ Deleted task disappears

---

## Phase 2: Left Panel Integration

### Step 2.1: Create useSessionTasks Hook

Create `src/hooks/useSessionTasks.ts`:

```typescript
import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';
import type { Task } from '../utils/MaestroClient';

export function useSessionTasks(sessionId: string | null | undefined) {
  const { state, fetchSession } = useMaestroContext();

  // Fetch session to ensure we have taskIds
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  // Get session and its tasks
  const { session, tasks } = useMemo(() => {
    if (!sessionId) return { session: null, tasks: [] };

    const session = state.sessions.get(sessionId);
    if (!session) return { session: null, tasks: [] };

    const tasks = session.taskIds
      .map(taskId => state.tasks.get(taskId))
      .filter((task): task is Task => task !== undefined);

    return { session, tasks };
  }, [state.sessions, state.tasks, sessionId]);

  const loading = sessionId ? state.loading.has(`session:${sessionId}`) : false;
  const error = sessionId ? state.errors.get(`session:${sessionId}`) : undefined;

  return {
    session,
    tasks,
    loading,
    error,
  };
}
```

---

### Step 2.2: Update SessionsSection

Update `SessionsSection.tsx`:

```typescript
import { useSessionTasks } from '../hooks/useSessionTasks';

function SessionItem({ session }: { session: UISession }) {
  const [expanded, setExpanded] = useState(false);

  // Use hook instead of manual fetching
  const { tasks, loading } = useSessionTasks(
    expanded ? session.maestroSessionId : null
  );

  // Remove old fetchMaestroData, sessionTasks state

  return (
    <div>
      <div onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾' : '▸'} {session.name}
      </div>

      {expanded && session.maestroSessionId && (
        <div>
          {loading ? (
            <div>Loading tasks...</div>
          ) : (
            <div>
              Working on {tasks.length} tasks:
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Test:**
- ✅ Session expands to show tasks
- ✅ Tasks update when WebSocket event arrives
- ✅ Loading state displays correctly

---

## Phase 3: Right Panel Integration

### Step 3.1: Create useTaskSessions Hook

Create `src/hooks/useTaskSessions.ts`:

```typescript
import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';

export function useTaskSessions(taskId: string | null | undefined) {
  const { state, fetchSessions } = useMaestroContext();

  // Fetch sessions for this task
  useEffect(() => {
    if (taskId) {
      fetchSessions(taskId);
    }
  }, [taskId, fetchSessions]);

  // Filter sessions that include this task
  const sessions = useMemo(() => {
    if (!taskId) return [];
    return Array.from(state.sessions.values()).filter(
      session => session.taskIds.includes(taskId)
    );
  }, [state.sessions, taskId]);

  const loading = taskId ? state.loading.has(`sessions:task:${taskId}`) : false;
  const error = taskId ? state.errors.get(`sessions:task:${taskId}`) : undefined;

  return {
    sessions,
    loading,
    error,
  };
}
```

---

### Step 3.2: Update TaskListItem

Update `TaskListItem.tsx`:

```typescript
import { useTaskSessions } from '../../hooks/useTaskSessions';

export function TaskListItem({ task, ... }: Props) {
  const [showSessions, setShowSessions] = useState(false);

  // Use hook instead of manual fetching
  const { sessions, loading } = useTaskSessions(
    showSessions ? task.id : null
  );

  // Remove old fetchSessions, taskSessions state

  return (
    <div>
      <button onClick={() => setShowSessions(!showSessions)}>
        {showSessions ? '▾' : '▸'} Active Sessions ({task.sessionCount})
      </button>

      {showSessions && (
        <div>
          {loading ? (
            <div>Loading sessions...</div>
          ) : (
            sessions.map(session => (
              <SessionItem key={session.id} session={session} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Test:**
- ✅ Task expands to show sessions
- ✅ Sessions update when WebSocket event arrives
- ✅ Loading state displays correctly

---

## Phase 4: Optimistic Updates

### Step 4.1: Create useOptimistic Hook

Create `src/hooks/useOptimistic.ts`:

```typescript
import { useState, useCallback } from 'react';

export function useOptimistic<A extends any[]>(
  applyAction: (...args: A) => Promise<void>
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (
      optimisticUpdate: () => void,
      rollback: () => void,
      ...args: A
    ) => {
      setIsPending(true);
      setError(null);

      // Apply optimistic update
      optimisticUpdate();

      try {
        // Execute action
        await applyAction(...args);
        // Success - WebSocket will confirm
      } catch (err) {
        // Rollback on failure
        rollback();
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error; // Re-throw for caller to handle
      } finally {
        setIsPending(false);
      }
    },
    [applyAction]
  );

  return { execute, isPending, error };
}
```

---

### Step 4.2: Use in TaskListItem

Update `TaskListItem.tsx` to use optimistic updates for remove:

```typescript
import { useState } from 'react';
import { useTaskSessions } from '../../hooks/useTaskSessions';
import { useOptimistic } from '../../hooks/useOptimistic';
import { useMaestroContext } from '../../contexts/MaestroContext';

export function TaskListItem({ task }: Props) {
  const [showSessions, setShowSessions] = useState(false);
  const { sessions, loading } = useTaskSessions(showSessions ? task.id : null);
  const { removeTaskFromSession } = useMaestroContext();

  const { execute, isPending } = useOptimistic(removeTaskFromSession);

  const handleRemoveSession = async (sessionId: string) => {
    const removedSession = sessions.find(s => s.id === sessionId);
    if (!removedSession) return;

    try {
      await execute(
        // Optimistic: remove from local state (if you have local state)
        () => {
          // The global cache will update via WebSocket
          // If you have component-level state, update it here
        },
        // Rollback: (no-op since we rely on global cache)
        () => {
          // Global cache handles this via WebSocket
        },
        // Args
        sessionId,
        task.id
      );
    } catch (error) {
      console.error('Failed to remove session:', error);
      // Show error to user
    }
  };

  return (
    <div>
      {/* ... */}
      {showSessions && (
        <div>
          {sessions.map(session => (
            <div key={session.id}>
              {session.name}
              <button
                onClick={() => handleRemoveSession(session.id)}
                disabled={isPending}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Test:**
- ✅ Remove session optimistically
- ✅ WebSocket event confirms
- ✅ Error rolls back if needed

---

## Phase 5: Polish & Testing

### Step 5.1: Add Error Boundaries

Create `src/components/ErrorBoundary.tsx`:

```typescript
import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Wrap components:

```typescript
<ErrorBoundary>
  <MaestroPanel />
</ErrorBoundary>
```

---

### Step 5.2: Add Reconnect Handling

Update `MaestroProvider` to refetch on WebSocket reconnect:

```typescript
export function MaestroProvider({ children }: Props) {
  const [state, setState] = useState<MaestroState>(...);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useMaestroWebSocket({
    // ... existing handlers ...

    onConnected: () => {
      console.log('WebSocket reconnected - refreshing data');
      if (activeProjectId) {
        fetchTasks(activeProjectId);
      }
    },

    onDisconnected: () => {
      console.warn('WebSocket disconnected');
    },
  });

  // Track active project (called by useTasks)
  const fetchTasks = useCallback(async (projectId: string) => {
    setActiveProjectId(projectId);
    // ... existing fetch logic ...
  }, []);

  // ...
}
```

---

### Step 5.3: Edge Case Testing

**Test Scenarios:**

1. **Stale Cache**
   - Expand task to see sessions
   - In another tab, delete session
   - Verify session disappears from first tab (WebSocket)

2. **Race Condition**
   - Create session
   - Immediately delete it
   - Verify UI updates correctly

3. **Network Failure**
   - Disconnect network
   - Try to remove session
   - Verify error message shows

4. **Rapid Updates**
   - Update task status multiple times quickly
   - Verify final state is correct

5. **WebSocket Disconnect**
   - Kill Maestro server
   - Verify "Disconnected" indicator
   - Restart server
   - Verify "Connected" and data refreshes

---

## Migration Checklist

### MaestroPanel
- [ ] Remove manual `useState` for tasks
- [ ] Remove manual `useEffect` for fetching
- [ ] Remove manual `useMaestroWebSocket` handlers
- [ ] Replace with `useTasks(projectId)`
- [ ] Use `useMaestroContext()` for mutations

### SessionsSection
- [ ] Remove manual `sessionTasks` state
- [ ] Remove `fetchMaestroData` function
- [ ] Replace with `useSessionTasks(sessionId)`

### TaskListItem
- [ ] Remove manual `taskSessions` state
- [ ] Remove `fetchSessions` function
- [ ] Replace with `useTaskSessions(taskId)`
- [ ] Add optimistic updates with `useOptimistic`

---

## Performance Monitoring

Add performance logging:

```typescript
// In MaestroContext
const fetchTasks = useCallback(async (projectId: string) => {
  const start = performance.now();
  const key = `tasks:${projectId}`;

  try {
    const tasks = await maestroClient.getTasks(projectId);
    const duration = performance.now() - start;
    console.log(`[Perf] fetchTasks(${projectId}): ${duration}ms, ${tasks.length} tasks`);
    // ...
  } catch (err) {
    // ...
  }
}, []);
```

Monitor:
- Fetch times
- Cache hit rates
- WebSocket event frequency
- Re-render counts

---

## Summary

✅ **Phase 1:** Foundation (MaestroContext + useTasks)
✅ **Phase 2:** SessionsSection (useSessionTasks)
✅ **Phase 3:** TaskListItem (useTaskSessions)
✅ **Phase 4:** Optimistic updates (useOptimistic)
✅ **Phase 5:** Polish (error handling, testing, performance)

**Result:** Clean, simple, consistent state management across the entire app!

---

## Next Steps

After implementation:
1. Remove all old state management code
2. Test all user flows
3. Monitor performance
4. Document any edge cases discovered
5. Consider future enhancements (persisted cache, etc.)
