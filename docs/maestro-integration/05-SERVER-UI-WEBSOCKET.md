# Server → UI Integration (WebSocket)

The server broadcasts real-time events to the UI via WebSocket for state synchronization.

## Connection

| Aspect | Value |
|--------|-------|
| **Server** | `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` |
| **Client (Hook)** | `maestro-ui/src/hooks/useMaestroWebSocket.ts` |
| **Client (Store)** | `maestro-ui/src/stores/useMaestroStore.ts` |
| **Client (Context)** | `maestro-ui/src/contexts/MaestroContext.tsx` |
| **URL** | `ws://localhost:3000` |

## Connection Pattern

- **Singleton**: Single WebSocket shared across all UI instances
- **Auto-reconnect**: Exponential backoff (max 30s delay)
- **Heartbeat**: Client can send `{type: 'ping'}` messages

## Event List

### Project Events

| Event | Payload | Description |
|-------|---------|-------------|
| `project:created` | `Project` | New project created |
| `project:updated` | `Project` | Project modified |
| `project:deleted` | `{id: string}` | Project deleted |

### Task Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task:created` | `Task` | New task created |
| `task:updated` | `Task` | Task modified |
| `task:deleted` | `{id: string}` | Task deleted |
| `task:session_added` | `{taskId, sessionId}` | Session linked to task |
| `task:session_removed` | `{taskId, sessionId}` | Session unlinked from task |

### Session Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `Session` | New session created |
| `session:spawn` | `SpawnRequestEvent` | Session spawn requested |
| `session:updated` | `Session` | Session modified |
| `session:deleted` | `{id: string}` | Session deleted |
| `session:task_added` | `{sessionId, taskId}` | Task linked to session |
| `session:task_removed` | `{sessionId, taskId}` | Task unlinked from session |

## Message Format

```json
{
  "type": "task:created",
  "event": "task:created",
  "data": { /* payload */ },
  "timestamp": 1704067200000
}
```

## Payload Schemas

### Task

```typescript
interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  initialPrompt: string;
  sessionIds: string[];
  skillIds: string[];
  agentIds: string[];
  dependencies: string[];
  timeline: TimelineEvent[];
}
```

### Session

```typescript
interface Session {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  status: SessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: SessionEvent[];
  metadata?: Record<string, any>;
}
```

### SpawnRequestEvent

```typescript
interface SpawnRequestEvent {
  session: Session;
  projectId: string;
  taskIds: string[];
  command: string;
  cwd: string;
  envVars: Record<string, string>;
  manifest?: any;
  spawnSource: 'ui' | 'session';
  parentSessionId?: string;
}
```

## Event Handling in UI

### Hook Callbacks (useMaestroWebSocket)

```typescript
useMaestroWebSocket({
  onTaskCreated: (task) => { /* handle */ },
  onTaskUpdated: (task) => { /* handle */ },
  onTaskDeleted: (data) => { /* handle */ },
  onSessionCreated: (data) => { /* handle */ },
  onSessionUpdated: (session) => { /* handle */ },
  onSessionDeleted: (data) => { /* handle */ },
  onSessionTaskAdded: (data) => { /* handle */ },
  onSessionTaskRemoved: (data) => { /* handle */ },
  onTaskSessionAdded: (data) => { /* handle */ },
  onTaskSessionRemoved: (data) => { /* handle */ },
  onConnected: () => { /* handle */ },
  onDisconnected: () => { /* handle */ },
});
```

### Store Handling (useMaestroStore)

| Event | Action |
|-------|--------|
| `task:created` | Add task to cache |
| `task:updated` | Update task in cache |
| `task:deleted` | Remove task from cache |
| `session:created` | Add session to cache |
| `session:spawn` | Add session + trigger terminal spawn |
| `session:updated` | Update session in cache |
| `session:deleted` | Remove session from cache |
| `task:session_added` | Refetch full task |
| `task:session_removed` | Refetch full task |
| `session:task_added` | Refetch full session |
| `session:task_removed` | Refetch full session |

## Session Spawn Flow

The `session:spawn` event is critical for spawning terminal sessions:

```
1. Client calls POST /sessions/spawn
   │
   ▼
2. Server creates session (suppresses session:created)
   │
   ▼
3. Server generates manifest via CLI
   │
   ▼
4. Server emits session:spawn event
   │                    ┌──────────────────────────────┐
   └───────────────────►│  {                           │
                        │    session: Session,          │
                        │    projectId: string,         │
                        │    taskIds: string[],         │
                        │    command: string,           │
                        │    cwd: string,               │
                        │    envVars: {...},            │
                        │    manifest: {...}            │
                        │  }                           │
                        └──────────────────────────────┘
   │
   ▼
5. UI receives event
   │
   ├──► useMaestroStore: Updates session cache
   │
   └──► useSessionStore.handleSpawnTerminalSession():
        Opens new terminal tab with command/env
```

## Relationship Events

When a task-session relationship changes, **two events** are emitted:

```
addTaskToSession(sessionId, taskId)
   │
   ├──► session:task_added {sessionId, taskId}
   │
   └──► task:session_added {taskId, sessionId}
```

Both perspectives are emitted so UI components listening to either entity get notified.

## Event Emission (Server Side)

```typescript
// WebSocketBridge.ts
const events: EventName[] = [
  'project:created', 'project:updated', 'project:deleted',
  'task:created', 'task:updated', 'task:deleted',
  'task:session_added', 'task:session_removed',
  'session:created', 'session:spawn', 'session:updated', 'session:deleted',
  'session:task_added', 'session:task_removed'
];

// Subscribe to all events and broadcast to connected clients
events.forEach(event => {
  eventBus.on(event, (data) => {
    broadcast({
      type: event,
      event: event,
      data: data,
      timestamp: Date.now()
    });
  });
});
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Maestro Server                       │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐   │
│  │  Service    │───►│  EventBus   │───►│ WebSocket │   │
│  │ (emit)      │    │             │    │  Bridge   │   │
│  └─────────────┘    └─────────────┘    └─────┬─────┘   │
│                                              │         │
└──────────────────────────────────────────────┼─────────┘
                                               │
                                    broadcast  │  ws://
                                               ▼
┌──────────────────────────────────────────────┴─────────┐
│                     Maestro UI                          │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐   │
│  │  Component  │◄───│   Store/    │◄───│ WebSocket │   │
│  │  (render)   │    │   Context   │    │  Handler  │   │
│  └─────────────┘    └─────────────┘    └───────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Reconnection Strategy

```
Disconnect detected
   │
   ▼
Wait: 1s, 2s, 4s, 8s, 16s, 30s (max)
   │
   ▼
Attempt reconnect
   │
   ├──► Success: Reset backoff, emit onConnected
   │
   └──► Failure: Increase backoff, retry
```
