# State Synchronization Patterns

## Overview

This document defines the **patterns and best practices** for keeping UI state synchronized with Maestro Server state.

---

## Core Patterns

### Pattern 1: Optimistic Update with Confirmation

**When to use:** User actions that are likely to succeed

**Example:** Remove task from session

```typescript
// 1. Update UI immediately (optimistic)
setTaskSessions(prev => prev.filter(s => s.id !== sessionId));

// 2. Call API
try {
  await maestroClient.removeTaskFromSession(sessionId, taskId);
  // Success - WebSocket event will confirm
} catch (error) {
  // 3. Rollback on failure
  setTaskSessions(prev => [...prev, removedSession]);
  showError('Failed to remove task from session');
}
```

**Benefits:**
- ✅ Instant UI feedback
- ✅ Perceived performance
- ✅ Handles failures gracefully

---

### Pattern 2: Lazy Loading with Cache

**When to use:** Expensive data that's not always needed

**Example:** Fetch sessions for a task when expanded

```typescript
const [taskSessions, setTaskSessions] = useState<Session[]>([]);
const [lastFetchTime, setLastFetchTime] = useState<number>(0);

useEffect(() => {
  if (showSessions && !loadingSessions) {
    const cacheAge = Date.now() - lastFetchTime;

    // Fetch if cache is stale (> 30s) or never fetched
    if (cacheAge > 30000 || lastFetchTime === 0) {
      fetchSessions();
    }
  }
}, [showSessions]);

const fetchSessions = async () => {
  setLoadingSessions(true);
  try {
    const sessions = await maestroClient.getSessions(task.id);
    setTaskSessions(sessions);
    setLastFetchTime(Date.now());
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
  } finally {
    setLoadingSessions(false);
  }
};
```

**Cache Invalidation:**

```typescript
// Invalidate cache when WebSocket event arrives
useMaestroWebSocket({
  onTaskSessionAdded: (data) => {
    if (data.taskId === task.id && showSessions) {
      // Fetch the new session and add to cache
      maestroClient.getSession(data.sessionId).then(session => {
        setTaskSessions(prev => {
          if (!prev.find(s => s.id === session.id)) {
            return [...prev, session];
          }
          return prev;
        });
      });
    }
  },

  onTaskSessionRemoved: (data) => {
    if (data.taskId === task.id) {
      // Remove from cache
      setTaskSessions(prev => prev.filter(s => s.id !== data.sessionId));
    }
  },

  onSessionDeleted: (data) => {
    // Remove from cache
    setTaskSessions(prev => prev.filter(s => s.id !== data.id));
  },

  onSessionUpdated: (session) => {
    // Update in cache if exists
    setTaskSessions(prev => {
      const index = prev.findIndex(s => s.id === session.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = session;
        return next;
      }
      return prev;
    });
  },
});
```

**Benefits:**
- ✅ Avoids unnecessary fetches
- ✅ Fresh data when expanded
- ✅ Real-time sync via WebSocket

---

### Pattern 3: Server as Source of Truth

**When to use:** Critical data that must be accurate

**Example:** Task list in MaestroPanel

```typescript
const [tasks, setTasks] = useState<Task[]>([]);

// Initial load
useEffect(() => {
  maestroClient.getTasks(projectId).then(setTasks);
}, [projectId]);

// Real-time updates
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

**Key Points:**
- Never mutate task data client-side
- All updates go through server
- WebSocket events update UI

---

### Pattern 4: Debounced WebSocket Updates

**When to use:** Rapid updates that could cause performance issues

**Example:** Batch multiple task updates

```typescript
const debouncedTaskUpdateRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

useMaestroWebSocket({
  onTaskUpdated: (task) => {
    // Clear existing debounce timer for this task
    const existingTimer = debouncedTaskUpdateRef.current.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      debouncedTaskUpdateRef.current.delete(task.id);
    }, 100);

    debouncedTaskUpdateRef.current.set(task.id, timer);
  },
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    debouncedTaskUpdateRef.current.forEach(timer => clearTimeout(timer));
    debouncedTaskUpdateRef.current.clear();
  };
}, []);
```

**Benefits:**
- ✅ Prevents excessive re-renders
- ✅ Batches rapid updates
- ✅ Maintains final state

---

## Cache Management Strategies

### Strategy 1: Simple Map Cache

```typescript
// Cache structure
const [sessionTasks, setSessionTasks] = useState<Map<string, Task[]>>(new Map());

// Add to cache
setSessionTasks(prev => {
  const next = new Map(prev);
  next.set(sessionId, tasks);
  return next;
});

// Remove from cache
setSessionTasks(prev => {
  const next = new Map(prev);
  next.delete(sessionId);
  return next;
});

// Update item in cache
setSessionTasks(prev => {
  const next = new Map(prev);
  for (const [sessionId, tasks] of next.entries()) {
    const taskIndex = tasks.findIndex(t => t.id === updatedTask.id);
    if (taskIndex !== -1) {
      const updatedTasks = [...tasks];
      updatedTasks[taskIndex] = updatedTask;
      next.set(sessionId, updatedTasks);
    }
  }
  return next;
});
```

---

### Strategy 2: Cache with Expiry

```typescript
type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const [cache, setCache] = useState<Map<string, CacheEntry<Session[]>>>(new Map());

// Add with timestamp
setCache(prev => {
  const next = new Map(prev);
  next.set(taskId, { data: sessions, fetchedAt: Date.now() });
  return next;
});

// Check if cache is valid
function isCacheValid(entry: CacheEntry<any> | undefined, maxAge: number): boolean {
  if (!entry) return false;
  return (Date.now() - entry.fetchedAt) < maxAge;
}

// Use cache or fetch
const getCachedSessions = async (taskId: string) => {
  const entry = cache.get(taskId);

  if (isCacheValid(entry, 30000)) {
    return entry!.data;
  }

  const sessions = await maestroClient.getSessions(taskId);
  setCache(prev => {
    const next = new Map(prev);
    next.set(taskId, { data: sessions, fetchedAt: Date.now() });
    return next;
  });

  return sessions;
};
```

---

### Strategy 3: Loading State Management

```typescript
const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

// Start loading
setLoadingTasks(prev => new Set(prev).add(sessionId));

try {
  const tasks = await fetchTasks(sessionId);
  setSessionTasks(prev => prev.set(sessionId, tasks));
} finally {
  // Always stop loading
  setLoadingTasks(prev => {
    const next = new Set(prev);
    next.delete(sessionId);
    return next;
  });
}

// Render loading state
{loadingTasks.has(sessionId) ? (
  <div>Loading tasks...</div>
) : (
  <div>{/* Render tasks */}</div>
)}
```

---

## WebSocket Event Handling

### Best Practices

#### 1. **Idempotent Updates**

```typescript
// BAD: Blindly add to array
onTaskCreated: (task) => {
  setTasks(prev => [...prev, task]);  // Could create duplicates!
};

// GOOD: Check existence first
onTaskCreated: (task) => {
  setTasks(prev => {
    if (prev.find(t => t.id === task.id)) {
      return prev;  // Already exists
    }
    return [...prev, task];
  });
};
```

#### 2. **Conditional Updates**

```typescript
// Only update if relevant to current view
onTaskCreated: (task) => {
  if (task.projectId === currentProjectId) {
    setTasks(prev => [...prev, task]);
  }
  // Otherwise ignore - not our project
};
```

#### 3. **Cascade Updates**

```typescript
// Session deleted → Update all related caches
onSessionDeleted: (data) => {
  // 1. Remove from session list
  setSessions(prev => prev.filter(s => s.id !== data.id));

  // 2. Remove from task caches
  setTaskSessions(prev => {
    const next = new Map(prev);
    for (const [taskId, sessions] of next.entries()) {
      next.set(taskId, sessions.filter(s => s.id !== data.id));
    }
    return next;
  });

  // 3. Refetch tasks to update session counts
  maestroClient.getTasks(projectId).then(setTasks);
};
```

#### 4. **Error Handling**

```typescript
useMaestroWebSocket({
  onTaskUpdated: (task) => {
    try {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    } catch (error) {
      console.error('Failed to update task in UI:', error);
      // Don't crash - just log the error
    }
  },
});
```

---

## Edge Case Handling

### Case 1: Stale Cache During Rapid Changes

**Problem:** User expands task, sees sessions list, session is deleted, list not updated

**Solution:** WebSocket event invalidates cache

```typescript
onSessionDeleted: (data) => {
  // Remove from ALL task session caches
  setTaskSessions(prev => {
    const next = new Map(prev);
    for (const [taskId, sessions] of next.entries()) {
      const filtered = sessions.filter(s => s.id !== data.id);
      if (filtered.length !== sessions.length) {
        next.set(taskId, filtered);
      }
    }
    return next;
  });
};
```

---

### Case 2: Race Condition (Create + Delete)

**Problem:** Session created and immediately deleted before UI updates

**Solution:** Check existence before adding to cache

```typescript
onSessionCreated: (session) => {
  // Verify session still exists before adding
  maestroClient.getSession(session.id)
    .then(verifiedSession => {
      setSessions(prev => [...prev, verifiedSession]);
    })
    .catch(() => {
      // Session already deleted - ignore
      console.log('Session deleted before UI could add it');
    });
};
```

---

### Case 3: Network Failure During Update

**Problem:** PATCH request fails, UI shows stale state

**Solution:** Optimistic update with rollback

```typescript
const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
  const original = tasks.find(t => t.id === taskId);

  // Optimistic update
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, ...updates } : t
  ));

  try {
    await maestroClient.updateTask(taskId, updates);
  } catch (error) {
    // Rollback
    if (original) {
      setTasks(prev => prev.map(t => t.id === taskId ? original : t));
    }
    showError('Failed to update task');
  }
};
```

---

### Case 4: WebSocket Disconnect

**Problem:** Missed events during disconnect

**Solution:** Refetch on reconnect

```typescript
useMaestroWebSocket({
  onConnected: () => {
    console.log('WebSocket reconnected - refreshing data');

    // Refetch visible data
    if (projectId) {
      maestroClient.getTasks(projectId).then(setTasks);
    }

    // Refetch expanded sessions
    for (const sessionId of expandedSessions) {
      const uiSession = sessions.find(s => s.id === sessionId);
      if (uiSession?.maestroSessionId) {
        fetchMaestroData(sessionId, uiSession.maestroSessionId);
      }
    }
  },

  onDisconnected: () => {
    console.warn('WebSocket disconnected - data may be stale');
    // Show warning to user
  },
});
```

---

### Case 5: Terminal Close Without Cleanup

**Problem:** User force-closes app, Maestro session not deleted

**Solution:** Server-side session timeout (future enhancement)

```typescript
// In Maestro Server (future):
// - Track session lastActivity timestamp
// - Auto-delete sessions inactive for > 1 hour
// - Broadcast session:deleted event

// Client-side: Always attempt cleanup
window.addEventListener('beforeunload', () => {
  // Best effort cleanup
  sessions.forEach(s => {
    if (s.maestroSessionId) {
      navigator.sendBeacon(
        `/api/sessions/${s.maestroSessionId}`,
        JSON.stringify({ status: 'completed' })
      );
    }
  });
});
```

---

## Resource Cleanup

### 1. WebSocket Cleanup

```typescript
useEffect(() => {
  const ws = connect();

  return () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    if (ws) {
      ws.close();
    }
  };
}, []);
```

### 2. Cache Cleanup

```typescript
// Clear cache when component unmounts
useEffect(() => {
  return () => {
    setSessionTasks(new Map());
    setTaskSessions(new Map());
  };
}, []);
```

### 3. Abort Ongoing Requests

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const fetchSessions = async () => {
  // Cancel previous request
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  abortControllerRef.current = new AbortController();

  try {
    const sessions = await maestroClient.getSessions(taskId, {
      signal: abortControllerRef.current.signal,
    });
    setTaskSessions(sessions);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
    } else {
      throw error;
    }
  }
};

useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

---

## Performance Optimization

### 1. Memoization

```typescript
// Avoid re-creating callbacks on every render
const handleTaskUpdated = useCallback((task: Task) => {
  setTasks(prev => prev.map(t => t.id === task.id ? task : t));
}, []);

useMaestroWebSocket({
  onTaskUpdated: handleTaskUpdated,
});
```

### 2. Virtual Scrolling

```typescript
// For large task lists (100+)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={filteredTasks.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TaskListItem task={filteredTasks[index]} {...} />
    </div>
  )}
</FixedSizeList>
```

### 3. Selective Re-renders

```typescript
// Use React.memo to prevent unnecessary re-renders
const TaskListItem = React.memo(({
  task,
  onWorkOn,
  ...
}: TaskListItemProps) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Only re-render if task data changed
  return prevProps.task.id === nextProps.task.id &&
         prevProps.task.status === nextProps.task.status &&
         prevProps.task.updatedAt === nextProps.task.updatedAt;
});
```

---

## Summary: State Sync Checklist

✅ **Always:**
- Update server first, then UI
- Handle WebSocket events for sync
- Check existence before adding to cache
- Invalidate cache on delete events
- Clean up resources on unmount

✅ **Optimizations:**
- Lazy load expensive data
- Cache with expiry
- Debounce rapid updates
- Memoize callbacks
- Use optimistic updates

✅ **Error Handling:**
- Rollback optimistic updates on failure
- Catch and log WebSocket errors
- Refetch on reconnect
- Show user-friendly errors

---

## Next: API & WebSocket Reference

See **[04-API-REFERENCE.md](./04-API-REFERENCE.md)** for complete API documentation.
