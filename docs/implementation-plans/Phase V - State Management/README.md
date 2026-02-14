# Phase V: State Management Standard

## Overview

Phase V establishes the **standard architecture** for state management in the Agent Maestro application. This ensures consistent, reliable synchronization between the UI and Maestro Server.

**Core Principles:**
- ✅ **Simple:** Minimal API, easy to understand
- ✅ **Powerful:** Handles all edge cases automatically
- ✅ **Consistent:** Single pattern throughout the app
- ✅ **Reliable:** Proper resource cleanup and error handling

---

## Documentation

Read the documentation in order:

### 1. [Architecture Overview](./01-ARCHITECTURE-OVERVIEW.md)
**Start here** to understand the big picture.

- Three state layers (Server, App, Component)
- Single source of truth principle
- Data flow patterns
- Component responsibilities
- Edge cases handled

### 2. [Event Flow Documentation](./02-EVENT-FLOW.md)
**Complete event flow diagrams** for every user action.

- Create task flow
- Work on task (create session) flow
- Close terminal (delete session) flow
- Expand session/task flows
- Remove task from session flow
- Update/delete task flows

### 3. [State Synchronization Patterns](./03-STATE-SYNC.md)
**Best practices** for keeping UI synchronized.

- Optimistic updates with rollback
- Lazy loading with cache
- Server as source of truth
- Debounced WebSocket updates
- Cache management strategies
- Edge case handling

### 4. [API & WebSocket Reference](./04-API-REFERENCE.md)
**Complete API documentation**.

- All REST endpoints with examples
- All WebSocket events with payloads
- Error response formats
- Type definitions

### 5. [Framework Design](./05-FRAMEWORK-DESIGN.md)
**Proposed framework** for simplified state management.

- MaestroStore (global context)
- Resource hooks (`useTasks`, `useTaskSessions`, etc.)
- Optimistic updates hook
- Component integration examples

### 6. [Implementation Guide](./06-IMPLEMENTATION.md)
**Step-by-step implementation** instructions.

- Phase 1: Foundation
- Phase 2: Left Panel Integration
- Phase 3: Right Panel Integration
- Phase 4: Optimistic Updates
- Phase 5: Polish & Testing

### 7. [Multi-Client Real-Time Sync](./07-MULTI-CLIENT-SYNC.md)
**Real-time synchronization across multiple clients**.

- How ANY client (CLI, LLM, API) updates ALL clients
- Complete flow diagrams
- Real-world examples
- Edge case handling
- Testing scenarios

---

## Quick Reference

### Current Architecture (Manual)

```typescript
// ❌ Verbose, manual state management
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
```

### Proposed Framework (Simple)

```typescript
// ✅ Clean, declarative
const { tasks, loading, error } = useTasks(projectId);
```

---

## API Quick Reference

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/tasks?projectId=...` | Get all tasks for project |
| `GET` | `/api/tasks/:id` | Get single task |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `GET` | `/api/sessions?taskId=...` | Get sessions for task |
| `GET` | `/api/sessions/:id` | Get single session |
| `POST` | `/api/sessions` | Create session |
| `PATCH` | `/api/sessions/:id` | Update session |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `POST` | `/api/sessions/:sid/tasks/:tid` | Add task to session |
| `DELETE` | `/api/sessions/:sid/tasks/:tid` | Remove task from session |

### WebSocket Events

| Event | Triggered By | Data |
|-------|--------------|------|
| `task:created` | Create task | Full Task object |
| `task:updated` | Update task, session changes | Updated Task |
| `task:deleted` | Delete task | `{ id }` |
| `session:created` | Create session | Full Session object |
| `session:updated` | Update session, task changes | Updated Session |
| `session:deleted` | Delete session | `{ id }` |
| `session:task_added` | Add task to session | `{ sessionId, taskId }` |
| `session:task_removed` | Remove task from session | `{ sessionId, taskId }` |

---

## State Sync Patterns

### Pattern 1: Optimistic Update
```typescript
// Update UI immediately
setData(newValue);

try {
  await api.update();
  // Success - WebSocket confirms
} catch (error) {
  // Rollback
  setData(oldValue);
}
```

### Pattern 2: Lazy Load with Cache
```typescript
useEffect(() => {
  if (expanded && cacheAge > 30000) {
    fetchData();
  }
}, [expanded]);
```

### Pattern 3: WebSocket Sync
```typescript
useMaestroWebSocket({
  onDataUpdated: (data) => {
    setCache(prev => prev.map(item =>
      item.id === data.id ? data : item
    ));
  },
});
```

---

## Implementation Status

### ✅ Completed (Phase IV)
- [x] Bidirectional task-session relationships
- [x] Sessions expand to show tasks
- [x] Tasks expand to show sessions
- [x] WebSocket real-time sync
- [x] Manual state management in components

### 🚧 To Be Implemented (Phase V)
- [ ] MaestroContext global store
- [ ] Resource hooks (`useTasks`, `useTaskSessions`, etc.)
- [ ] Optimistic updates hook
- [ ] Error boundaries
- [ ] Reconnect handling
- [ ] Performance monitoring

---

## Benefits After Phase V

### Before (Current)
- ❌ Manual cache management in each component
- ❌ Duplicate WebSocket event handling
- ❌ Inconsistent error handling
- ❌ No optimistic updates
- ❌ Complex component code

### After (Phase V)
- ✅ Automatic cache management
- ✅ Single WebSocket subscription (global)
- ✅ Consistent error handling
- ✅ Built-in optimistic updates
- ✅ Clean, simple component code

---

## Decision Points

### Why Global State (Context)?
- Single WebSocket connection
- Automatic cache invalidation
- Centralized error handling
- Easier testing
- Better performance

### Why Not Redux/Zustand?
- **Simpler:** Context + hooks is sufficient
- **Less boilerplate:** No actions, reducers, etc.
- **TypeScript:** Better type inference with Context
- **React-native:** Context is standard React

### Why Resource Hooks?
- **Declarative:** Components describe what they need
- **Composable:** Hooks can be combined
- **Testable:** Easy to mock in tests
- **Reusable:** Same pattern everywhere

---

## Future Enhancements

### Phase VI (Future)
- Persistent cache (localStorage/IndexedDB)
- Offline support
- Conflict resolution
- Undo/redo
- Time-travel debugging

### Phase VII (Future)
- Server-side session timeout
- Automatic cleanup of orphaned sessions
- Session migration on reconnect
- Multi-user collaboration

---

## Contributing

When adding new features:

1. **Follow the patterns** defined in this documentation
2. **Use resource hooks** instead of manual state
3. **Handle errors** consistently
4. **Add tests** for edge cases
5. **Update documentation** if patterns change

---

## Questions?

If you have questions about:
- **Architecture:** See [01-ARCHITECTURE-OVERVIEW.md](./01-ARCHITECTURE-OVERVIEW.md)
- **Event flows:** See [02-EVENT-FLOW.md](./02-EVENT-FLOW.md)
- **Sync patterns:** See [03-STATE-SYNC.md](./03-STATE-SYNC.md)
- **API reference:** See [04-API-REFERENCE.md](./04-API-REFERENCE.md)
- **Framework design:** See [05-FRAMEWORK-DESIGN.md](./05-FRAMEWORK-DESIGN.md)
- **Implementation:** See [06-IMPLEMENTATION.md](./06-IMPLEMENTATION.md)

---

## Summary

Phase V provides a **complete, well-documented standard** for state management in Agent Maestro.

**Key Takeaways:**
- Maestro Server is the source of truth
- WebSocket provides real-time sync
- Resource hooks simplify component code
- Optimistic updates improve UX
- Edge cases are handled automatically

**Result:** Simple, powerful, consistent state management! ✨
