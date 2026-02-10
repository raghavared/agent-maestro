# Domain Events and Event Bus System Review

## 1. Architecture Overview

The domain events system follows a **publish-subscribe pattern** that bridges server-side state changes to real-time UI updates via WebSocket. The architecture has three layers:

1. **Domain Layer** - Type-safe event definitions (`DomainEvents.ts`, `IEventBus.ts`)
2. **Infrastructure Layer** - In-memory event bus implementation (`InMemoryEventBus.ts`)
3. **Transport Layer** - WebSocket bridge that broadcasts events to connected clients (`WebSocketBridge.ts`)

```
  Application Services          InMemoryEventBus          WebSocketBridge         UI (Browser)
  (ProjectService, etc.)        (Node EventEmitter)       (ws broadcast)          (Zustand store)
         |                            |                        |                       |
         |--- eventBus.emit() ------->|                        |                       |
         |                            |--- handler(data) ----->|                       |
         |                            |                        |--- ws.send(JSON) ---->|
         |                            |                        |                       |-- update store
```

---

## 2. Complete List of Domain Event Types

### 2.1 Formally Defined Events (in DomainEvents.ts)

These events have full TypeScript type definitions in `TypedEventMap`:

| Event Name | Payload Type | Description |
|---|---|---|
| `project:created` | `Project` | A new project was created |
| `project:updated` | `Project` | A project was modified |
| `project:deleted` | `{ id: string }` | A project was deleted |
| `task:created` | `Task` | A new task was created |
| `task:updated` | `Task` | A task was modified (status, title, sessionStatus, etc.) |
| `task:deleted` | `{ id: string }` | A task was deleted |
| `task:session_added` | `{ taskId: string; sessionId: string }` | A session was associated with a task |
| `task:session_removed` | `{ taskId: string; sessionId: string }` | A session was disassociated from a task |
| `session:created` | `Session` | A new session was created |
| `session:spawn` | `SpawnRequestEvent` | A session spawn request (triggers terminal creation in UI) |
| `session:updated` | `Session` | A session was modified |
| `session:deleted` | `{ id: string }` | A session was deleted |
| `session:task_added` | `{ sessionId: string; taskId: string }` | A task was added to a session |
| `session:task_removed` | `{ sessionId: string; taskId: string }` | A task was removed from a session |

### 2.2 Undeclared Events (emitted but NOT in DomainEvents.ts)

These events are emitted by services but have **no formal type definitions** in `DomainEvents.ts` or `TypedEventMap`:

| Event Name | Payload | Emitted By | Declared? |
|---|---|---|---|
| `template:created` | `{ template: Template }` | `TemplateService` | NO |
| `template:updated` | `{ template: Template }` | `TemplateService` | NO |
| `template:deleted` | `{ id: string }` | `TemplateService` | NO |
| `template:reset` | `{ template: Template }` | `TemplateService` | NO |
| `queue:created` | `{ sessionId: string; queue: QueueState }` | `QueueService` | NO |
| `queue:item_started` | `{ sessionId: string; taskId: string }` | `QueueService` | NO |
| `queue:item_completed` | `{ sessionId: string; taskId: string }` | `QueueService` | NO |
| `queue:item_failed` | `{ sessionId: string; taskId: string; reason?: string }` | `QueueService` | NO |
| `queue:item_skipped` | `{ sessionId: string; taskId: string }` | `QueueService` | NO |
| `queue:item_pushed` | `{ sessionId: string; taskId: string }` | `QueueService` | NO |
| `queue:deleted` | `{ sessionId: string }` | `QueueService` | NO |

**Total: 11 undeclared events** that bypass the type system entirely.

### 2.3 SpawnRequestEvent Payload (special case)

The `session:spawn` event carries the richest payload:

```typescript
interface SpawnRequestEvent {
  session: Session;              // Full session object (with env vars injected)
  projectId: string;
  taskIds: string[];
  command: string;               // Shell command to execute
  cwd: string;                   // Working directory
  envVars: Record<string, string>;
  manifest?: any;                // Session manifest (skills, config)
  spawnSource: 'ui' | 'session'; // Who initiated: user or another session
  parentSessionId?: string;       // Parent session if session-initiated
  _isSpawnCreated?: boolean;      // Backward compatibility flag
}
```

---

## 3. Event Bus Interface and Implementation

### 3.1 IEventBus Interface

Defined in `maestro-server/src/domain/events/IEventBus.ts`:

| Method | Signature | Description |
|---|---|---|
| `emit` | `emit<T>(event: string, data: T): Promise<void>` | Publish an event (async, awaits all handlers) |
| `on` | `on<T>(event: string, handler: EventHandler<T>): void` | Subscribe to an event |
| `off` | `off(event: string, handler: EventHandler): void` | Unsubscribe from an event |
| `once` | `once<T>(event: string, handler: EventHandler<T>): void` | One-time subscription |
| `removeAllListeners` | `removeAllListeners(event?: string): void` | Remove all handlers |
| `listenerCount` | `listenerCount?(event: string): number` | Get handler count (optional) |

**Key observation**: The interface uses `string` for event names, not the typed `EventName` union. This means any arbitrary string can be used as an event name without compile-time checks, which is why the undeclared template/queue events work without errors.

### 3.2 InMemoryEventBus Implementation

Defined in `maestro-server/src/infrastructure/events/InMemoryEventBus.ts`:

- Wraps Node.js `EventEmitter` with async error handling
- Max listeners set to **100** (good for busy applications)
- `emit()` calls all handlers concurrently via `Promise.all()`, catching errors per-handler so one failing handler doesn't block others
- All operations are logged at debug level
- Provides a deprecated `getEmitter()` for backward compatibility

**Error handling**: Individual handler errors are caught and logged but do not propagate. This means a failing WebSocket broadcast won't break the service that emitted the event.

---

## 4. Who Publishes What Events

### 4.1 ProjectService

| Method | Events Emitted |
|---|---|
| `createProject()` | `project:created` (full Project) |
| `updateProject()` | `project:updated` (full Project) |
| `deleteProject()` | `project:deleted` ({ id }) |

### 4.2 TaskService

| Method | Events Emitted |
|---|---|
| `createTask()` | `task:created` (full Task) |
| `updateTask()` | `task:updated` (full Task) -- emitted for both user and session updates |
| `deleteTask()` | `task:deleted` ({ id }) |
| `addSessionToTask()` | `task:session_added` ({ taskId, sessionId }) |
| `removeSessionFromTask()` | `task:session_removed` ({ taskId, sessionId }) |

### 4.3 SessionService

| Method | Events Emitted |
|---|---|
| `createSession()` | `session:created` (full Session) + `task:session_added` per task -- **unless `_suppressCreatedEvent` is set** |
| `updateSession()` | `session:updated` (full Session) |
| `deleteSession()` | `session:deleted` ({ id }) |
| `addTaskToSession()` | `session:task_added` + `task:session_added` (both directions) |
| `removeTaskFromSession()` | `session:task_removed` + `task:session_removed` (both directions) |
| `addEventToSession()` | `session:updated` (full Session) |
| `addTimelineEvent()` | `session:updated` (full Session) |

### 4.4 Session Routes (Direct Event Bus Usage)

The spawn endpoint in `sessionRoutes.ts` directly accesses the event bus (bypassing SessionService):

| Route | Events Emitted |
|---|---|
| `POST /sessions/spawn` | `session:spawn` (SpawnRequestEvent) + `task:session_added` per task |

### 4.5 TemplateService

| Method | Events Emitted |
|---|---|
| `createTemplate()` | `template:created` ({ template }) |
| `updateTemplate()` | `template:updated` ({ template }) |
| `deleteTemplate()` | `template:deleted` ({ id }) |
| `resetTemplate()` | `template:reset` ({ template }) |

### 4.6 QueueService

| Method | Events Emitted |
|---|---|
| `initializeQueue()` | `queue:created` ({ sessionId, queue }) |
| `startItem()` | `queue:item_started` ({ sessionId, taskId }) |
| `completeItem()` | `queue:item_completed` ({ sessionId, taskId }) |
| `failItem()` | `queue:item_failed` ({ sessionId, taskId, reason }) |
| `skipItem()` | `queue:item_skipped` ({ sessionId, taskId }) |
| `pushItem()` | `queue:item_pushed` ({ sessionId, taskId }) |
| `deleteQueue()` | `queue:deleted` ({ sessionId }) |

---

## 5. Who Subscribes to Events

### 5.1 Server-Side Subscribers

The **only** server-side subscriber is the **WebSocketBridge**. It subscribes to exactly 14 events (the formally declared ones) and broadcasts them to all connected WebSocket clients:

```
Subscribed events (WebSocketBridge.setupEventHandlers):
  project:created, project:updated, project:deleted
  task:created, task:updated, task:deleted
  task:session_added, task:session_removed
  session:created, session:spawn, session:updated, session:deleted
  session:task_added, session:task_removed
```

**Not subscribed**: All `template:*` and `queue:*` events are emitted but never listened to by anyone on the server. They are fire-and-forget.

### 5.2 Client-Side Consumers

Two WebSocket consumers exist in the UI:

#### useMaestroWebSocket.ts (React hook)
A reusable hook with typed callbacks. Handles these events:
- `task:created`, `task:updated`, `task:deleted`
- `session:created`, `session:updated`, `session:deleted`
- `session:task_added`, `session:task_removed`
- `task:session_added`, `task:session_removed`
- `subtask:created`, `subtask:updated`, `subtask:deleted` (declared in types but never emitted by server)

#### useMaestroStore.ts (Zustand store - primary consumer)
The main state management store. Handles:

| Event | Action Taken |
|---|---|
| `task:created` / `task:updated` | Upsert task into store Map |
| `task:deleted` | Remove task from store Map |
| `session:created` | Extract `data.session \|\| data` and upsert into store |
| `session:updated` | Upsert session into store Map |
| `session:deleted` | Remove session from store Map |
| `session:spawn` | Upsert session + **trigger terminal spawn** via `useSessionStore.handleSpawnTerminalSession()` |
| `task:session_added` / `task:session_removed` | Re-fetch the affected task from API |
| `session:task_added` / `session:task_removed` | Re-fetch the affected session from API |

**Critical**: The `session:spawn` event is what actually causes the UI to open a new terminal window. It extracts the command, cwd, and env vars to spawn a terminal process.

---

## 6. Event Flow Diagrams

### 6.1 Task Creation Flow

```
User (UI)
  |
  |--> POST /api/tasks  (REST)
  |       |
  |       v
  |    TaskService.createTask()
  |       |
  |       |--> taskRepo.create()
  |       |--> eventBus.emit('task:created', task)
  |              |
  |              v
  |           WebSocketBridge.broadcast('task:created', task)
  |              |
  |              v
  |           All WS clients receive: { event: 'task:created', data: task }
  |              |
  |              v
  |           useMaestroStore: tasks.set(task.id, task)
  |
  |<-- 201 { task }  (REST response)
```

### 6.2 Session Spawn Flow (the most complex)

```
User (UI) or Session (CLI)
  |
  |--> POST /api/sessions/spawn  (REST)
  |       |
  |       v
  |    sessionRoutes handler (direct)
  |       |
  |       |--> sessionService.createSession({ _suppressCreatedEvent: true })
  |       |       |--> sessionRepo.create()
  |       |       |--> taskRepo.addSession() per task
  |       |       |--> (NO events emitted due to suppress flag)
  |       |
  |       |--> eventBus.emit('session:spawn', spawnEvent)
  |       |       |
  |       |       v
  |       |    WebSocketBridge.broadcast('session:spawn', spawnEvent)
  |       |       |
  |       |       v
  |       |    useMaestroStore:
  |       |       |--> sessions.set(session.id, session)
  |       |       |--> useSessionStore.handleSpawnTerminalSession()
  |       |              |--> Creates terminal in UI
  |       |              |--> Runs command in spawned terminal
  |       |
  |       |--> eventBus.emit('task:session_added', ...) per task
  |              |
  |              v
  |           WebSocketBridge.broadcast('task:session_added', ...)
  |              |
  |              v
  |           useMaestroStore: fetchTask(taskId) -- re-fetches from API
  |
  |<-- 201 { sessionId, session }  (REST response)
```

### 6.3 Bidirectional Task-Session Association Flow

```
User (UI)
  |
  |--> POST /api/sessions/:id/tasks/:taskId  (REST)
  |       |
  |       v
  |    SessionService.addTaskToSession()
  |       |
  |       |--> sessionRepo.addTask()
  |       |--> taskRepo.addSession()
  |       |--> sessionRepo.addTimelineEvent()
  |       |
  |       |--> eventBus.emit('session:task_added', { sessionId, taskId })
  |       |       |--> WS broadcast --> UI re-fetches session
  |       |
  |       |--> eventBus.emit('task:session_added', { taskId, sessionId })
  |               |--> WS broadcast --> UI re-fetches task
  |
  |<-- 200  (REST response)
```

### 6.4 Queue Item Lifecycle Flow

```
Session (CLI)
  |
  |--> POST /api/queue/:sessionId/start
  |       |
  |       v
  |    QueueService.startItem()
  |       |--> queueRepo.updateItem(status: 'processing')
  |       |--> taskRepo.update(sessionStatus: 'working')
  |       |--> eventBus.emit('queue:item_started', ...)
  |              |
  |              v
  |           (NO LISTENER - event is lost)
  |
  |--> POST /api/queue/:sessionId/complete
  |       |
  |       v
  |    QueueService.completeItem()
  |       |--> queueRepo.updateItem(status: 'completed')
  |       |--> taskRepo.update(sessionStatus: 'completed')
  |       |--> eventBus.emit('queue:item_completed', ...)
  |              |
  |              v
  |           (NO LISTENER - event is lost)
```

---

## 7. WebSocket Bridge Details

### 7.1 Message Format

Messages broadcast to WebSocket clients have this format:

```json
{
  "type": "task:updated",
  "event": "task:updated",
  "data": { ... payload ... },
  "timestamp": 1707500000000
}
```

Note: Both `type` and `event` contain the event name (redundant). The UI store reads `message.event` while the hook reads `message.event`.

### 7.2 Connection Handling

- Logs connection/disconnection with origin and remote address
- Handles `ping` messages from clients with `pong` responses
- Filters "heartbeat" and "keepalive" from detailed logging
- Broadcasts to all clients with `readyState === OPEN`
- Logs broadcast delivery count: `"Broadcast task:updated -> 2/3 clients"`

### 7.3 Client-Side Reconnection

Both the hook and store implement exponential backoff reconnection:
- Initial delay: 1000ms
- Backoff: `1000 * 2^attempts`
- Max delay: 30000ms (30 seconds)
- On reconnect: re-fetches tasks and sessions for the active project

---

## 8. Issues, Gaps, and Inconsistencies

### 8.1 CRITICAL: Type Safety Gap

**11 events have no type definitions.** The `IEventBus.emit()` method accepts `string` for the event name, not `EventName`. This means:
- `template:*` and `queue:*` events bypass `TypedEventMap` completely
- No compile-time errors if an event name is misspelled
- The `TypedEventMap` and `EventPayload<K>` types exist but are barely used

**Recommendation**: Either add template/queue events to `TypedEventMap` and use typed overloads on `IEventBus`, or acknowledge these as "internal" events that don't need type safety.

### 8.2 CRITICAL: Queue and Template Events Are Dead

All 11 `queue:*` and `template:*` events are emitted but **never subscribed to**:
- The WebSocketBridge only subscribes to the 14 formally declared events
- No other server-side component subscribes to them
- The UI has no handlers for queue or template events

These events are pure overhead -- they execute `Promise.all([])` on zero handlers. If they're intended for future use, this should be documented. If not, they should be removed.

### 8.3 Duplicate Event Emission for task:session_added

The `task:session_added` event can be emitted from **three separate code paths**:

1. `SessionService.createSession()` -- emits per task on session creation
2. `SessionService.addTaskToSession()` -- emits when explicitly linking
3. `sessionRoutes.ts` spawn handler -- emits per task during spawn
4. `TaskService.addSessionToTask()` -- emits when called directly

During a spawn, **both** the spawn route handler AND the session creation can emit this event for the same task-session pair, depending on the `_suppressCreatedEvent` flag. The spawn route suppresses the creation event but then emits `task:session_added` itself, which is correct but fragile.

### 8.4 Inconsistency: session:created vs session:spawn

Two events exist for session creation:
- `session:created` -- emitted for normal session creation (via `SessionService.createSession`)
- `session:spawn` -- emitted for spawn-based creation (via `sessionRoutes.ts`)

The spawn flow **suppresses** `session:created` via `_suppressCreatedEvent: true` and emits `session:spawn` instead. The UI handles both:
- `session:created`: just upserts the session
- `session:spawn`: upserts the session AND spawns a terminal

This design is intentional but creates a subtle contract: if `_suppressCreatedEvent` is forgotten, the UI would receive both events and potentially double-add the session.

### 8.5 UI Has Handlers for Non-Existent Events

The `useMaestroWebSocket.ts` hook declares types and handlers for:
- `subtask:created`, `subtask:updated`, `subtask:deleted`

These events are **never emitted** by the server. They appear to be leftover from a planned subtask feature.

### 8.6 Duplicate WebSocket Implementations

Two separate WebSocket consumer implementations exist in the UI:
1. `useMaestroWebSocket.ts` -- A React hook with callbacks
2. `useMaestroStore.ts` -- Zustand store with inline WebSocket management

Both maintain their own global WebSocket singleton (`globalWs`). If both are active simultaneously, they could create **two separate WebSocket connections** to the server. It's unclear which one is the "primary" consumer or if one is deprecated.

### 8.7 No Event Ordering or Idempotency Guarantees

The in-memory event bus provides no:
- Event ordering guarantees (handlers run concurrently via `Promise.all`)
- Idempotency keys or deduplication
- Event persistence or replay capability

For a single-server, in-memory system this is acceptable, but it means:
- If a WebSocket message is lost (client reconnection gap), there's no way to replay missed events
- The UI compensates by re-fetching all data on reconnect, which is a reasonable strategy

### 8.8 No Backpressure Handling

The WebSocket bridge broadcasts to all clients unconditionally. If a client has a slow connection, `ws.send()` could buffer extensively. There's no check for `ws.bufferedAmount` or any backpressure mechanism.

### 8.9 Inconsistent Payload Wrapping

- Template events wrap the entity: `{ template: Template }` or `{ id: string }`
- Project/Task/Session events send the entity directly: `Project`, `Task`, `Session`
- Queue events use a mixed format: `{ sessionId, queue }` or `{ sessionId, taskId }`

The UI store has to handle this inconsistency with `message.data.session || message.data` for `session:created`.

---

## 9. Summary

The domain events system is a well-structured pub-sub architecture that effectively bridges server state changes to the UI in real-time. The core 14 events for project/task/session CRUD and association management work correctly end-to-end.

**Key strengths**:
- Clean separation of domain events, bus implementation, and transport
- Async error isolation (one failing handler doesn't break others)
- WebSocket bridge is simple and transparent
- Client reconnection with exponential backoff

**Key concerns**:
- 11 queue/template events are dead code (emitted, never consumed)
- Type safety is aspirational -- `TypedEventMap` exists but `IEventBus` accepts raw strings
- Two competing WebSocket implementations in the UI (hook vs store)
- Subtle spawn flow depends on `_suppressCreatedEvent` flag to avoid duplicate events
- No event replay for missed WebSocket messages during disconnection

**Files reviewed**:
- `maestro-server/src/domain/events/DomainEvents.ts` -- Event type definitions
- `maestro-server/src/domain/events/IEventBus.ts` -- Event bus interface
- `maestro-server/src/infrastructure/events/InMemoryEventBus.ts` -- Implementation
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` -- WS bridge
- `maestro-server/src/application/services/ProjectService.ts` -- Publisher
- `maestro-server/src/application/services/TaskService.ts` -- Publisher
- `maestro-server/src/application/services/SessionService.ts` -- Publisher
- `maestro-server/src/application/services/TemplateService.ts` -- Publisher
- `maestro-server/src/application/services/QueueService.ts` -- Publisher
- `maestro-server/src/api/sessionRoutes.ts` -- Direct publisher (spawn)
- `maestro-server/src/container.ts` -- Dependency wiring
- `maestro-server/src/server.ts` -- Server startup, bridge creation
- `maestro-ui/src/hooks/useMaestroWebSocket.ts` -- UI consumer (hook)
- `maestro-ui/src/stores/useMaestroStore.ts` -- UI consumer (store)
