# Framework Design: Simple State Management

## Overview

This framework provides a **simple, powerful abstraction** for managing Maestro state in React components.

**Design Goals:**
- ✅ **Simple:** Minimal API surface, easy to understand
- ✅ **Powerful:** Handles all edge cases automatically
- ✅ **Consistent:** Single pattern for all state management
- ✅ **Type-safe:** Full TypeScript support

---

## Core Concept: Resource Hooks

Instead of manually managing caches, WebSocket events, and API calls, components use **resource hooks** that handle everything automatically.

```typescript
// OLD WAY (manual):
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(false);
useEffect(() => {
  maestroClient.getTasks(projectId).then(setTasks);
}, [projectId]);
useMaestroWebSocket({
  onTaskCreated: (task) => setTasks(prev => [...prev, task]),
  onTaskUpdated: (task) => setTasks(prev => prev.map(t => t.id === task.id ? task : t)),
  onTaskDeleted: (data) => setTasks(prev => prev.filter(t => t.id !== data.id)),
});

// NEW WAY (framework):
const { tasks, loading, error } = useTasks(projectId);
```

---

## Framework Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Component Layer                             │
│  (Uses resource hooks - doesn't know about API/WebSocket)       │
├─────────────────────────────────────────────────────────────────┤
│                     Resource Hooks                              │
│  • useTasks(projectId)                                          │
│  • useSessions(taskId?)                                         │
│  • useTaskSessions(taskId)                                      │
│  • useSessionTasks(sessionId)                                   │
├─────────────────────────────────────────────────────────────────┤
│                  Maestro Store (Context)                        │
│  • Manages global cache                                         │
│  • Subscribes to WebSocket                                      │
│  • Provides resource hooks                                      │
├─────────────────────────────────────────────────────────────────┤
│              MaestroClient + WebSocket                          │
│  • HTTP API calls                                               │
│  • WebSocket connection                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. MaestroStore (Global State)

### Implementation

```typescript
// src/contexts/MaestroContext.tsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { maestroClient, Task, Session } from '../utils/MaestroClient';
import { useMaestroWebSocket } from '../hooks/useMaestroWebSocket';

type MaestroState = {
  tasks: Map<string, Task>;           // taskId -> Task
  sessions: Map<string, Session>;     // sessionId -> Session
  loading: Set<string>;               // Resource IDs currently loading
  errors: Map<string, string>;        // Resource ID -> error message
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

  // API methods
  const fetchTasks = useCallback(async (projectId: string) => {
    const loadingKey = `tasks:${projectId}`;
    setState(prev => ({ ...prev, loading: new Set(prev.loading).add(loadingKey) }));

    try {
      const tasks = await maestroClient.getTasks(projectId);
      setState(prev => {
        const taskMap = new Map(prev.tasks);
        tasks.forEach(task => taskMap.set(task.id, task));
        const loading = new Set(prev.loading);
        loading.delete(loadingKey);
        return { ...prev, tasks: taskMap, loading };
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: new Map(prev.errors).set(loadingKey, error.message),
        loading: new Set(prev.loading),
      }));
    }
  }, []);

  const createTask = useCallback(async (data: CreateTaskPayload) => {
    const task = await maestroClient.createTask(data);
    // Task will be added via WebSocket event
    return task;
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const task = await maestroClient.updateTask(taskId, updates);
    // Task will be updated via WebSocket event
    return task;
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await maestroClient.deleteTask(taskId);
    // Task will be removed via WebSocket event
  }, []);

  // ... Similar methods for sessions ...

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

## 2. Resource Hooks

### `useTasks`

```typescript
// src/hooks/useTasks.ts

import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';
import type { Task } from '../utils/MaestroClient';

export function useTasks(projectId: string) {
  const { state, fetchTasks } = useMaestroContext();

  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks(projectId);
  }, [projectId, fetchTasks]);

  // Filter tasks for this project
  const tasks = useMemo(() => {
    return Array.from(state.tasks.values()).filter(
      task => task.projectId === projectId
    );
  }, [state.tasks, projectId]);

  const loading = state.loading.has(`tasks:${projectId}`);
  const error = state.errors.get(`tasks:${projectId}`);

  return {
    tasks,
    loading,
    error,
  };
}
```

**Usage:**

```typescript
function MaestroPanel({ projectId }: { projectId: string }) {
  const { tasks, loading, error } = useTasks(projectId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
```

---

### `useTaskSessions`

```typescript
// src/hooks/useTaskSessions.ts

import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';

export function useTaskSessions(taskId: string) {
  const { state, fetchSessions } = useMaestroContext();

  // Fetch sessions for this task
  useEffect(() => {
    fetchSessions(taskId);
  }, [taskId, fetchSessions]);

  // Get task to access sessionIds
  const task = state.tasks.get(taskId);

  // Filter sessions that include this task
  const sessions = useMemo(() => {
    if (!task) return [];
    return Array.from(state.sessions.values()).filter(
      session => session.taskIds.includes(taskId)
    );
  }, [state.sessions, taskId, task]);

  const loading = state.loading.has(`sessions:task:${taskId}`);
  const error = state.errors.get(`sessions:task:${taskId}`);

  return {
    sessions,
    loading,
    error,
  };
}
```

**Usage:**

```typescript
function TaskSessionsList({ taskId }: { taskId: string }) {
  const { sessions, loading } = useTaskSessions(taskId);

  if (loading) return <div>Loading sessions...</div>;

  return (
    <div>
      {sessions.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  );
}
```

---

### `useSessionTasks`

```typescript
// src/hooks/useSessionTasks.ts

import { useEffect, useMemo } from 'react';
import { useMaestroContext } from '../contexts/MaestroContext';

export function useSessionTasks(sessionId: string) {
  const { state, fetchSession } = useMaestroContext();

  // Fetch session to get taskIds
  useEffect(() => {
    fetchSession(sessionId);
  }, [sessionId, fetchSession]);

  // Get session
  const session = state.sessions.get(sessionId);

  // Get all tasks for this session
  const tasks = useMemo(() => {
    if (!session) return [];
    return session.taskIds
      .map(taskId => state.tasks.get(taskId))
      .filter((task): task is Task => task !== undefined);
  }, [state.tasks, session]);

  const loading = state.loading.has(`session:${sessionId}`);
  const error = state.errors.get(`session:${sessionId}`);

  return {
    tasks,
    loading,
    error,
  };
}
```

**Usage:**

```typescript
function SessionTasksList({ sessionId }: { sessionId: string }) {
  const { tasks, loading } = useSessionTasks(sessionId);

  if (loading) return <div>Loading tasks...</div>;

  return (
    <div>
      Working on {tasks.length} tasks:
      {tasks.map(task => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
```

---

## 3. Optimistic Updates Hook

```typescript
// src/hooks/useOptimistic.ts

import { useState, useCallback } from 'react';

export function useOptimistic<T, A extends any[]>(
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
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsPending(false);
      }
    },
    [applyAction]
  );

  return { execute, isPending, error };
}
```

**Usage:**

```typescript
function RemoveSessionButton({ sessionId, taskId }: Props) {
  const { removeTaskFromSession } = useMaestroContext();
  const [sessions, setSessions] = useState<Session[]>([...]);

  const { execute, isPending } = useOptimistic(removeTaskFromSession);

  const handleRemove = () => {
    const removedSession = sessions.find(s => s.id === sessionId);

    execute(
      // Optimistic update
      () => setSessions(prev => prev.filter(s => s.id !== sessionId)),
      // Rollback
      () => setSessions(prev => removedSession ? [...prev, removedSession] : prev),
      // Args
      sessionId,
      taskId
    );
  };

  return (
    <button onClick={handleRemove} disabled={isPending}>
      {isPending ? 'Removing...' : 'Remove'}
    </button>
  );
}
```

---

## 4. Component Integration

### App.tsx (Root)

```typescript
import { MaestroProvider } from './contexts/MaestroContext';

function App() {
  return (
    <MaestroProvider>
      {/* Rest of app */}
      <SessionsSection />
      <MaestroPanel />
    </MaestroProvider>
  );
}
```

---

### MaestroPanel (Right Panel)

```typescript
import { useTasks } from '../hooks/useTasks';
import { useMaestroContext } from '../contexts/MaestroContext';

function MaestroPanel({ projectId }: { projectId: string }) {
  const { tasks, loading, error } = useTasks(projectId);
  const { createTask, deleteTask, updateTask } = useMaestroContext();

  return (
    <div>
      <button onClick={() => createTask({ projectId, ... })}>
        + New Task
      </button>

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      {tasks.map(task => (
        <TaskListItem
          key={task.id}
          task={task}
          onDelete={() => deleteTask(task.id)}
          onUpdate={(updates) => updateTask(task.id, updates)}
        />
      ))}
    </div>
  );
}
```

---

### TaskListItem (Expandable Task)

```typescript
import { useState } from 'react';
import { useTaskSessions } from '../hooks/useTaskSessions';

function TaskListItem({ task }: { task: Task }) {
  const [showSessions, setShowSessions] = useState(false);
  const { sessions, loading } = useTaskSessions(task.id);

  return (
    <div>
      <div className="task-header">
        {task.title} ({task.sessionCount} sessions)
      </div>

      <button onClick={() => setShowSessions(!showSessions)}>
        {showSessions ? '▾' : '▸'} Active Sessions ({sessions.length})
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

---

### SessionsSection (Left Panel)

```typescript
import { useSessionTasks } from '../hooks/useSessionTasks';

function SessionItem({ session }: { session: UISession }) {
  const [expanded, setExpanded] = useState(false);
  const { tasks, loading } = useSessionTasks(session.maestroSessionId!);

  if (!session.maestroSessionId) return <NormalSession session={session} />;

  return (
    <div>
      <div onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾' : '▸'} {session.name}
      </div>

      {expanded && (
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

---

## 5. Benefits of Framework

### Before (Manual State Management)

```typescript
// ❌ Verbose, error-prone
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  maestroClient.getTasks(projectId)
    .then(setTasks)
    .catch(setError)
    .finally(() => setLoading(false));
}, [projectId]);

useMaestroWebSocket({
  onTaskCreated: (task) => {
    if (task.projectId === projectId) {
      setTasks(prev => [task, ...prev]);
    }
  },
  onTaskUpdated: (task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
  },
  onTaskDeleted: (data) => {
    setTasks(prev => prev.filter(t => t.id !== data.id));
  },
});
```

### After (Framework)

```typescript
// ✅ Simple, declarative
const { tasks, loading, error } = useTasks(projectId);
```

---

### Before (Optimistic Updates)

```typescript
// ❌ Manual rollback logic
const handleRemove = async () => {
  const backup = sessions.find(s => s.id === sessionId);
  setSessions(prev => prev.filter(s => s.id !== sessionId));

  try {
    await maestroClient.removeTaskFromSession(sessionId, taskId);
  } catch (error) {
    if (backup) {
      setSessions(prev => [...prev, backup]);
    }
    alert('Failed to remove');
  }
};
```

### After (Framework)

```typescript
// ✅ Declarative optimistic updates
const { execute } = useOptimistic(removeTaskFromSession);

execute(
  () => setSessions(prev => prev.filter(s => s.id !== sessionId)),
  () => setSessions(prev => [...prev, backup]),
  sessionId,
  taskId
);
```

---

## 6. Framework Features

### ✅ Automatic Cache Management
- Global cache in MaestroContext
- Automatic invalidation via WebSocket
- No manual cache cleanup needed

### ✅ Optimistic Updates
- `useOptimistic` hook handles rollback
- Type-safe action execution
- Error handling built-in

### ✅ Loading States
- Per-resource loading tracking
- Automatic loading state management
- No manual `setLoading(true/false)`

### ✅ Error Handling
- Per-resource error tracking
- Automatic error state management
- Graceful error recovery

### ✅ Real-time Sync
- WebSocket events auto-update cache
- Components re-render automatically
- No manual event handling

### ✅ Type Safety
- Full TypeScript support
- Type-safe hooks
- Compile-time error checking

---

## Next: Implementation Guide

See **[06-IMPLEMENTATION.md](./06-IMPLEMENTATION.md)** for step-by-step implementation instructions.
