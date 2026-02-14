# Phase V: State Management Architecture

## Overview

Phase V establishes a **consistent, simple, and powerful** state management architecture for the Agent Maestro application. This ensures reliable synchronization between the UI state, Maestro server state, and terminal sessions.

---

## Core Principle: Single Source of Truth

**The Maestro Server is the authoritative source of truth for Tasks and Sessions.**

```
┌─────────────────────────────────────────────────────────────┐
│                    MAESTRO SERVER (Port 3000)               │
│                  ✓ Authoritative Source of Truth            │
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │   Tasks Store    │         │  Sessions Store  │        │
│  │  (In-Memory DB)  │         │  (In-Memory DB)  │        │
│  └──────────────────┘         └──────────────────┘        │
│            │                            │                   │
│            └────────────┬───────────────┘                   │
│                         │                                   │
│              ┌──────────▼──────────┐                       │
│              │   REST API + WS     │                       │
│              └─────────────────────┘                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP REST API + WebSocket Events
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    AGENTS UI (Tauri App)                    │
│                   ✓ Local View Layer Only                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    App.tsx State                       │ │
│  │                                                        │ │
│  │  • sessions: Session[] (UI Terminal Sessions)         │ │
│  │  • activeSessionId: string | null                     │ │
│  │                                                        │ │
│  │  Note: Does NOT store Task/Session relationship data │ │
│  │        Fetches on-demand from Maestro Server         │ │
│  └────────────────────┬──────────────────────────────────┘ │
│                       │                                     │
│         ┌─────────────┴─────────────┐                      │
│         │                           │                       │
│  ┌──────▼─────────┐         ┌──────▼──────────┐           │
│  │  SessionsSection│         │  MaestroPanel   │           │
│  │  (Left Panel)   │         │  (Right Panel)  │           │
│  │                 │         │                 │           │
│  │  • Shows UI     │         │  • tasks: Task[]│           │
│  │    sessions     │         │  • Fetches from │           │
│  │  • Expands to   │         │    server       │           │
│  │    show tasks   │         │  • Expands to   │           │
│  │  • Fetches      │         │    show sessions│           │
│  │    lazily       │         │  • Fetches      │           │
│  │                 │         │    lazily       │           │
│  └─────────────────┘         └─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Three State Layers

### 1. **Maestro Server State** (Authoritative)

**Location:** `http://localhost:3000`

**Stores:**
- Tasks (with `sessionIds[]`, `sessionCount`)
- Sessions (with `taskIds[]`)
- Many-to-many relationships

**Persistence:** In-memory (currently)

**Access:**
- REST API for CRUD operations
- WebSocket for real-time event broadcasting

---

### 2. **App UI State** (View Layer)

**Location:** `App.tsx`

**Stores:**
- UI terminal sessions (`sessions: Session[]`)
- Active session pointer (`activeSessionId`)
- Session-to-Maestro mapping (`maestroSessionId`)

**Does NOT Store:**
- Task data (fetched by MaestroPanel)
- Task-Session relationships (fetched on-demand)
- Session task lists (fetched on-demand)

**Persistence:** localStorage (for UI sessions only)

---

### 3. **Component Local State** (Cached Views)

**Locations:**
- `MaestroPanel.tsx` - Caches tasks for the active project
- `SessionsSection.tsx` - Caches task lists for expanded sessions
- `TaskListItem.tsx` - Caches session lists for expanded tasks

**Purpose:** Performance optimization, avoid refetching

**Invalidation:** Via WebSocket events from server

---

## Data Flow Patterns

### Pattern 1: UI Action → Server Update → Broadcast

```
User clicks "Work on Task"
    ↓
App.createMaestroSession()
    ↓
maestroClient.createSession()  ────────→  Maestro Server
                                          Creates Session
                                          Links Task ↔ Session
                                          ↓
                                          Broadcasts WebSocket:
                                          - session:created
                                          - task:updated
                                          - session:task_added
    ↓                                     ↓
UI updates optimistically          ←──── All connected clients receive
(add session to local state)             event and update their caches
```

**Key Principle:** Always update server first, then let WebSocket sync UI

---

### Pattern 2: Lazy Loading with Cache

```
User expands Task to view sessions
    ↓
TaskListItem checks local cache
    ↓
If not cached or stale:
    ↓
maestroClient.getSessions(taskId)  ────→  Maestro Server
                                          Returns Session[]
                                          ↓
    ↓                                ←────
Store in local cache
Render sessions list
```

**Cache Invalidation:**
- WebSocket `task:session_added` → Add to cache
- WebSocket `task:session_removed` → Remove from cache
- WebSocket `session:deleted` → Remove from all caches

---

### Pattern 3: Optimistic UI with Rollback

```
User removes task from session
    ↓
Update UI immediately (optimistic)
Remove session from local cache
    ↓
maestroClient.removeTaskFromSession()  ──→  Maestro Server
                                            ↓
                                         Success/Failure
                                            ↓
    ↓                                  ←────
If fails: Rollback UI change
If succeeds: Confirm via WebSocket event
```

---

## Consistency Guarantees

### 1. **Single Write Path**
- All mutations go through Maestro Server REST API
- No direct client-side state mutations for relationships
- WebSocket events are read-only triggers

### 2. **Eventual Consistency**
- UI may be temporarily out of sync
- WebSocket events ensure all clients converge to same state
- Lazy loading caches are invalidated by events

### 3. **Resource Cleanup**
- Terminal close → Delete Maestro Session
- Session delete → Remove task relationships
- WebSocket disconnect → Automatic reconnect with exponential backoff

### 4. **Idempotency**
- API calls can be safely retried
- Duplicate events are deduplicated by ID
- Cache updates check for existence before adding

---

## Component Responsibilities

| Component | Owns | Fetches | Listens to |
|-----------|------|---------|------------|
| **App.tsx** | UI sessions, active session | - | Terminal events, Session lifecycle |
| **MaestroPanel** | Tasks list cache | `getTasks(projectId)` | `task:*`, `session:*` events |
| **SessionsSection** | Session→Tasks cache | `getSession(id).taskIds` → `getTask(id)` | `session:task_*`, `task:updated` |
| **TaskListItem** | Task→Sessions cache | `getSessions(taskId)` | `task:session_*`, `session:deleted` |

---

## Edge Cases Handled

### 1. **Stale Cache**
- **Problem:** User opens task, sees session list, session is deleted elsewhere
- **Solution:** WebSocket `session:deleted` removes from all caches

### 2. **Race Conditions**
- **Problem:** Create session + Add task happen simultaneously
- **Solution:** Server ensures atomic operations, broadcasts single event

### 3. **Network Failures**
- **Problem:** API call fails mid-operation
- **Solution:** Optimistic updates rollback, user sees error

### 4. **WebSocket Disconnect**
- **Problem:** Missed events during disconnect
- **Solution:** On reconnect, refetch active/visible data

### 5. **Terminal Close**
- **Problem:** Session not cleaned up
- **Solution:** `onSessionClose` handler calls `completeMaestroSession()`

### 6. **Orphaned Sessions**
- **Problem:** All tasks removed, session still exists
- **Solution:** Server allows empty sessions, UI shows count=0

---

## Performance Optimizations

### 1. **Lazy Loading**
- Tasks list loaded only when MaestroPanel opens
- Session tasks loaded only when session expanded
- Task sessions loaded only when task expanded

### 2. **Debouncing**
- WebSocket event handlers debounce rapid updates
- Cache updates batched when possible

### 3. **Selective Re-rendering**
- Components subscribe only to events they care about
- Local state prevents full tree re-renders

---

## Next Steps

- **[02-EVENT-FLOW.md](./02-EVENT-FLOW.md)** - Complete event flow diagrams
- **[03-STATE-SYNC.md](./03-STATE-SYNC.md)** - State synchronization patterns
- **[04-API-REFERENCE.md](./04-API-REFERENCE.md)** - Complete API & WebSocket reference
- **[05-FRAMEWORK-DESIGN.md](./05-FRAMEWORK-DESIGN.md)** - Simplified communication framework
- **[06-IMPLEMENTATION.md](./06-IMPLEMENTATION.md)** - Implementation guide

---

## Summary

✅ **Simple:** Single source of truth (Maestro Server)
✅ **Powerful:** Real-time sync via WebSocket
✅ **Consistent:** Eventual consistency with cache invalidation
✅ **Reliable:** Edge cases handled, resources cleaned up properly
