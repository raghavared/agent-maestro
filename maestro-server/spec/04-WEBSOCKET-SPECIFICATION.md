# Maestro Server - WebSocket Specification

**Version:** 2.0.0
**Last Updated:** 2026-02-08
**Purpose:** Complete WebSocket protocol and event catalog

---

## Overview

Maestro Server broadcasts real-time events to connected clients via WebSocket. The protocol is **primarily unidirectional**: server broadcasts events to clients, with limited client-to-server messaging support (ping/pong heartbeat).

### Key Characteristics

- **Direction:** Primarily Server → Client (with ping/pong support from clients)
- **Transport:** WebSocket over HTTP upgrade
- **Format:** JSON messages with `timestamp` field
- **Connection:** Long-lived, persistent
- **URL:** `ws://localhost:3000` (same port as HTTP server)
- **Bridge:** `WebSocketBridge` class subscribes to `InMemoryEventBus` and broadcasts to all connected clients

---

## Connection Management

### Connection Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant EventBus as InMemoryEventBus
    participant Bridge as WebSocketBridge

    Client->>Server: HTTP Upgrade (WebSocket)
    Server->>Client: 101 Switching Protocols
    Note over Bridge: Track client via wss.clients

    loop Domain Events
        EventBus->>Bridge: emit('task:created', task)
        Bridge->>Client: broadcast('task:created', task)
    end

    Client->>Server: { type: 'ping' }
    Server->>Client: { type: 'pong', timestamp }

    Client->>Server: close()
    Note over Bridge: Client removed from wss.clients
```

### Connecting

**WebSocket URL:**
```
ws://localhost:3000
```

**Example (Node.js):**
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('Connected to Maestro Server');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Event:', message.event, message.data);
});

ws.on('close', () => {
  console.log('Disconnected');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

**Example (Browser):**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Connected to Maestro Server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message.event, message.data);
};

ws.onclose = () => {
  console.log('Disconnected');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Connection Lifecycle

1. **Connection:** Client opens WebSocket to server
2. **Active:** Client receives broadcast events, can send ping messages
3. **Disconnection:** Client closes connection or network failure
4. **Cleanup:** Server removes client from `wss.clients` set automatically

### Server-Side Connection Tracking

Connection tracking is handled by the `WebSocketBridge` class which wraps the `WebSocketServer`:

```typescript
// WebSocketBridge class (src/infrastructure/websocket/WebSocketBridge.ts)
export class WebSocketBridge {
  constructor(
    private wss: WebSocketServer,
    private eventBus: IEventBus,
    logger: ILogger
  ) {
    this.setupEventHandlers();
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const origin = req.headers.origin || 'unknown';
      const remoteAddr = req.socket.remoteAddress || 'unknown';
      console.log(`🔌 WebSocket client connected (origin=${origin}, addr=${remoteAddr}, total=${this.wss.clients.size})`);

      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket client disconnected (origin=${origin}, code=${code}, total=${this.wss.clients.size})`);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket client error:', error);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (err) {
          this.logger.warn('Failed to parse WebSocket message');
        }
      });
    });
  }
}
```

### Client-to-Server Messages

The server accepts limited client messages:

#### Ping/Pong

Clients can send `ping` messages and receive `pong` responses:

```typescript
// Client sends:
{ "type": "ping" }

// Server responds:
{ "type": "pong", "timestamp": 1738713800000 }
```

#### Other Messages

Other client messages are logged but not acted upon. High-frequency messages (`heartbeat`, `keepalive`) are silently ignored.

---

## Message Format

All messages follow a consistent JSON structure:

```typescript
interface WebSocketMessage {
  type: string;      // Event type (same as event)
  event: string;     // Event type (redundant for compatibility)
  data: any;         // Event payload
  timestamp: number; // Unix milliseconds when broadcast was sent
}
```

### Example Message

```json
{
  "type": "task:created",
  "event": "task:created",
  "data": {
    "id": "task_1738713700000_p9q2r5t8w",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "title": "Build API",
    "status": "pending"
  },
  "timestamp": 1738713700050
}
```

**Note:** Both `type` and `event` fields contain the same value for backward compatibility. The `timestamp` field is added by the `WebSocketBridge` at broadcast time.

---

## Event Catalog

### Project Events

#### `project:created`

**Emitted When:** New project created via `POST /api/projects`

**Data Schema:**
```typescript
{
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}
```

**Example:**
```json
{
  "type": "project:created",
  "event": "project:created",
  "data": {
    "id": "proj_1738713600000_x7k9m2p4q",
    "name": "agents-ui",
    "workingDir": "/Users/john/Projects/agents-ui",
    "description": "Multi-agent UI framework",
    "createdAt": 1738713600000,
    "updatedAt": 1738713600000
  }
}
```

---

#### `project:updated`

**Emitted When:** Project updated via `PUT /api/projects/:id`

**Data Schema:** Same as `project:created`

**Example:**
```json
{
  "type": "project:updated",
  "event": "project:updated",
  "data": {
    "id": "proj_1738713600000_x7k9m2p4q",
    "name": "agents-ui (updated)",
    "workingDir": "/Users/john/Projects/agents-ui",
    "description": "Updated description",
    "createdAt": 1738713600000,
    "updatedAt": 1738713700000
  }
}
```

---

#### `project:deleted`

**Emitted When:** Project deleted via `DELETE /api/projects/:id`

**Data Schema:**
```typescript
{
  id: string;
}
```

**Example:**
```json
{
  "type": "project:deleted",
  "event": "project:deleted",
  "data": {
    "id": "proj_1738713600000_x7k9m2p4q"
  }
}
```

---

### Task Events

#### `task:created`

**Emitted When:** New task created via `POST /api/tasks`

**Data Schema:**
```typescript
{
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  sessionStatus?: TaskSessionStatus;
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
  model?: 'haiku' | 'sonnet' | 'opus';
  // NOTE: timeline moved to Session - each session has its own timeline
}
```

**Example:**
```json
{
  "type": "task:created",
  "event": "task:created",
  "data": {
    "id": "task_1738713700000_p9q2r5t8w",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "parentId": null,
    "title": "Build API",
    "description": "Implement REST API",
    "status": "pending",
    "priority": "high",
    "createdAt": 1738713700000,
    "updatedAt": 1738713700000,
    "startedAt": null,
    "completedAt": null,
    "initialPrompt": "Create REST API with Express",
    "sessionIds": [],
    "skillIds": [],
    "agentIds": [],
    "dependencies": [],
    "model": "sonnet"
  },
  "timestamp": 1738713700050
}
```

---

#### `task:updated`

**Emitted When:** Task updated via `PATCH /api/tasks/:id` or `POST /api/tasks/:id/timeline`

**Data Schema:** Same as `task:created`

**Example:**
```json
{
  "type": "task:updated",
  "event": "task:updated",
  "data": {
    "id": "task_1738713700000_p9q2r5t8w",
    "status": "in_progress",
    "startedAt": 1738713750000,
    "updatedAt": 1738713750000
  }
}
```

---

#### `task:deleted`

**Emitted When:** Task deleted via `DELETE /api/tasks/:id`

**Data Schema:**
```typescript
{
  id: string;
}
```

**Example:**
```json
{
  "type": "task:deleted",
  "event": "task:deleted",
  "data": {
    "id": "task_1738713700000_p9q2r5t8w"
  }
}
```

---

#### `task:session_added`

**Emitted When:**
- Session created with task in `taskIds` (via `POST /api/sessions`)
- Task added to session (via `POST /api/sessions/:id/tasks/:taskId`)
- Session spawned with task (via `POST /api/sessions/spawn`)

**Data Schema:**
```typescript
{
  taskId: string;
  sessionId: string;
}
```

**Example:**
```json
{
  "type": "task:session_added",
  "event": "task:session_added",
  "data": {
    "taskId": "task_1738713700000_p9q2r5t8w",
    "sessionId": "sess_1738713800000_a1b2c3d4e"
  }
}
```

---

#### `task:session_removed`

**Emitted When:**
- Session deleted (via `DELETE /api/sessions/:id`)
- Task removed from session (via `DELETE /api/sessions/:id/tasks/:taskId`)

**Data Schema:**
```typescript
{
  taskId: string;
  sessionId: string;
}
```

**Example:**
```json
{
  "type": "task:session_removed",
  "event": "task:session_removed",
  "data": {
    "taskId": "task_1738713700000_p9q2r5t8w",
    "sessionId": "sess_1738713800000_a1b2c3d4e"
  }
}
```

---

### Session Events

#### `session:created`

**Emitted When:**
- Regular session created (via `POST /api/sessions`)
- **NOT emitted** for spawned sessions (spawn uses `_suppressCreatedEvent: true` and emits `session:spawn` instead)

**Data Schema:**
```typescript
{
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  strategy: WorkerStrategy;
  status: SessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: SessionEvent[];
  timeline: SessionTimelineEvent[];
  metadata?: Record<string, any>;
}
```

**Example:**
```json
{
  "type": "session:created",
  "event": "session:created",
  "data": {
    "id": "sess_1738713800000_a1b2c3d4e",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "name": "Worker Session",
    "env": {},
    "strategy": "simple",
    "status": "idle",
    "startedAt": 1738713800000,
    "lastActivity": 1738713800000,
    "completedAt": null,
    "hostname": "johns-macbook.local",
    "platform": "darwin",
    "events": [],
    "timeline": [],
    "metadata": null
  },
  "timestamp": 1738713800050
}
```

---

#### `session:spawn`

**Emitted When:**
- **ALWAYS emitted** for all session spawns via `POST /api/sessions/spawn`
- Emitted for both `spawnSource: "ui"` and `spawnSource: "session"` spawns
- The `spawnSource` field in the data indicates who initiated the spawn

**Purpose:**
This event tells the UI to spawn a new terminal with the session's configuration. The UI receives this event and creates the terminal.

**Data Schema:**
```typescript
{
  session: Session;                    // Full session object with env vars
  command: string;                     // Command to run (e.g., "maestro worker init")
  cwd: string;                         // Working directory
  envVars: Record<string, string>;     // Environment variables
  manifest: any;                       // Generated manifest object
  projectId: string;                   // Project ID
  taskIds: string[];                   // Task IDs
  spawnSource: 'ui' | 'session';       // Who initiated the spawn
  parentSessionId?: string;            // Parent session ID if session-initiated
  _isSpawnCreated: true;               // Backward compatibility flag
}
```

**Example:**
```json
{
  "type": "session:spawn",
  "event": "session:spawn",
  "data": {
    "session": {
      "id": "sess_1738714000000_x9y8z7w6v",
      "projectId": "proj_1738713600000_x7k9m2p4q",
      "taskIds": ["task_1738713700000_p9q2r5t8w"],
      "name": "Worker for task_1738713700000_p9q2r5t8w",
      "env": {
        "MAESTRO_SESSION_ID": "sess_1738714000000_x9y8z7w6v",
        "MAESTRO_MANIFEST_PATH": "/Users/john/.maestro/sessions/sess_1738714000000_x9y8z7w6v/manifest.json",
        "MAESTRO_SERVER_URL": "http://localhost:3000",
        "MAESTRO_STRATEGY": "simple"
      },
      "strategy": "simple",
      "status": "spawning",
      "metadata": {
        "skills": ["maestro-worker"],
        "role": "worker",
        "spawnSource": "session",
        "spawnedBy": "sess_parent_123",
        "strategy": "simple",
        "context": {}
      }
    },
    "command": "maestro worker init",
    "cwd": "/Users/john/Projects/my-app",
    "envVars": {
      "MAESTRO_SESSION_ID": "sess_1738714000000_x9y8z7w6v",
      "MAESTRO_MANIFEST_PATH": "/Users/john/.maestro/sessions/sess_1738714000000_x9y8z7w6v/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000",
      "MAESTRO_STRATEGY": "simple"
    },
    "manifest": {
      "manifestVersion": "1.0",
      "role": "worker",
      "session": { "model": "claude-sonnet-4-5-20250929" },
      "tasks": [...]
    },
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "spawnSource": "session",
    "parentSessionId": "sess_parent_123",
    "_isSpawnCreated": true
  },
  "timestamp": 1738714000050
}
```

**UI Handling:**
When receiving this event, the UI should:
1. Extract `command`, `cwd`, and `envVars` from the event data
2. Create new terminal window
3. Set environment variables from `envVars`
4. Change directory to `cwd`
5. Execute `command`

**Difference from `session:created`:**
- `session:spawn` - Emitted for all spawned sessions (via `/sessions/spawn`), includes full spawn data (command, cwd, envVars, manifest)
- `session:created` - Emitted for regular session creation (via `/sessions`), contains only the session object

---

#### `session:updated`

**Emitted When:** Session updated via `PATCH /api/sessions/:id`

**Data Schema:** Same as `session:created` (regular format)

**Example:**
```json
{
  "type": "session:updated",
  "event": "session:updated",
  "data": {
    "id": "sess_1738713800000_a1b2c3d4e",
    "status": "completed",
    "lastActivity": 1738713900000
  }
}
```

---

#### `session:deleted`

**Emitted When:** Session deleted via `DELETE /api/sessions/:id`

**Data Schema:**
```typescript
{
  id: string;
}
```

**Example:**
```json
{
  "type": "session:deleted",
  "event": "session:deleted",
  "data": {
    "id": "sess_1738713800000_a1b2c3d4e"
  }
}
```

---

#### `session:task_added`

**Emitted When:**
- Session created with tasks (via `POST /api/sessions`)
- Task added to session (via `POST /api/sessions/:id/tasks/:taskId`)
- Session spawned with tasks (via `POST /api/sessions/spawn`)

**Data Schema:**
```typescript
{
  sessionId: string;
  taskId: string;
}
```

**Example:**
```json
{
  "type": "session:task_added",
  "event": "session:task_added",
  "data": {
    "sessionId": "sess_1738713800000_a1b2c3d4e",
    "taskId": "task_1738713700000_p9q2r5t8w"
  }
}
```

---

#### `session:task_removed`

**Emitted When:**
- Session deleted (via `DELETE /api/sessions/:id`)
- Task removed from session (via `DELETE /api/sessions/:id/tasks/:taskId`)

**Data Schema:**
```typescript
{
  sessionId: string;
  taskId: string;
}
```

**Example:**
```json
{
  "type": "session:task_removed",
  "event": "session:task_removed",
  "data": {
    "sessionId": "sess_1738713800000_a1b2c3d4e",
    "taskId": "task_1738713700000_p9q2r5t8w"
  }
}
```

---

## Event Emission Flow

### CRUD Operation Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Service as Application Service
    participant Repo as Repository
    participant EventBus as InMemoryEventBus
    participant Bridge as WebSocketBridge
    participant UI

    Client->>API: POST /api/tasks
    API->>Service: createTask()
    Service->>Repo: save(task)
    Repo->>Repo: Save to memory + disk
    Service->>EventBus: emit('task:created', task)
    EventBus->>Bridge: on('task:created')
    Bridge->>UI: broadcast('task:created', task)
    API->>Client: 201 Created
```

### Many-to-Many Association Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Service as SessionService
    participant EventBus as InMemoryEventBus
    participant Bridge as WebSocketBridge
    participant UI

    Client->>API: POST /api/sessions/:id/tasks/:taskId
    API->>Service: addTaskToSession()

    Note over Service: Update session.taskIds
    Note over Service: Update task.sessionIds
    Note over Service: Save both to disk

    Service->>EventBus: emit('session:task_added')
    Service->>EventBus: emit('task:session_added')

    EventBus->>Bridge: on('session:task_added')
    EventBus->>Bridge: on('task:session_added')

    Bridge->>UI: broadcast('session:task_added')
    Bridge->>UI: broadcast('task:session_added')

    API->>Client: 200 OK
```

### Session Spawn Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Service as SessionService
    participant CLI
    participant EventBus as InMemoryEventBus
    participant Bridge as WebSocketBridge
    participant UI

    Client->>API: POST /api/sessions/spawn
    API->>Service: createSession(_suppressCreatedEvent=true)
    Note over Service: No session:created event emitted

    API->>CLI: maestro manifest generate
    CLI->>CLI: Generate manifest.json
    CLI->>API: Return manifest path

    API->>Service: updateSession(env vars)

    API->>EventBus: emit('session:spawn', spawnData)
    EventBus->>Bridge: on('session:spawn')
    Bridge->>UI: broadcast('session:spawn', spawnData)

    Note over UI: Extract command, cwd, envVars
    Note over UI: Create terminal
    Note over UI: Run command with env

    API->>EventBus: emit('task:session_added') for each task
    EventBus->>Bridge: on('task:session_added')
    Bridge->>UI: broadcast('task:session_added')

    API->>Client: 201 Created
```

**Note:** The `session:spawn` event is emitted for ALL spawn requests (both `spawnSource: "ui"` and `spawnSource: "session"`). The `spawnSource` field in the event data indicates who initiated the spawn.

---

## Broadcast Implementation

### WebSocketBridge Class

The `WebSocketBridge` class (in `src/infrastructure/websocket/WebSocketBridge.ts`) bridges domain events from the `InMemoryEventBus` to WebSocket clients:

```typescript
export class WebSocketBridge {
  constructor(
    private wss: WebSocketServer,
    private eventBus: IEventBus,
    logger: ILogger
  ) {
    this.setupEventHandlers();
    this.setupConnectionHandlers();
  }

  private setupEventHandlers(): void {
    // List of all domain events to bridge
    const events: EventName[] = [
      'project:created',
      'project:updated',
      'project:deleted',
      'task:created',
      'task:updated',
      'task:deleted',
      'task:session_added',
      'task:session_removed',
      'session:created',
      'session:spawn',
      'session:updated',
      'session:deleted',
      'session:task_added',
      'session:task_removed'
    ];

    // Subscribe to each event
    for (const event of events) {
      this.eventBus.on(event, (data) => {
        this.broadcast(event, data);
      });
    }
  }

  private broadcast(event: string, data: any): void {
    const message = JSON.stringify({
      type: event,
      event,
      data,
      timestamp: Date.now()
    });

    let sent = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    console.log(`📡 Broadcast ${event} → ${sent}/${this.wss.clients.size} clients`);
  }
}
```

### Bridged Events (14 Total)

| Category | Event | Data |
|----------|-------|------|
| Project | `project:created` | Full project object |
| Project | `project:updated` | Full project object |
| Project | `project:deleted` | `{ id: string }` |
| Task | `task:created` | Full task object |
| Task | `task:updated` | Full task object |
| Task | `task:deleted` | `{ id: string }` |
| Task | `task:session_added` | `{ taskId, sessionId }` |
| Task | `task:session_removed` | `{ taskId, sessionId }` |
| Session | `session:created` | Full session object |
| Session | `session:spawn` | SpawnRequestEvent (full spawn data) |
| Session | `session:updated` | Full session object |
| Session | `session:deleted` | `{ id: string }` |
| Session | `session:task_added` | `{ sessionId, taskId }` |
| Session | `session:task_removed` | `{ sessionId, taskId }` |

**Note:** Queue events (`queue:created`, `queue:updated`, etc.) are NOT bridged to WebSocket. Queue state is only accessible via the REST API.

---

## Client Implementation Examples

### Basic WebSocket Client (Node.js)

```javascript
const WebSocket = require('ws');

class MaestroClient {
  constructor(url = 'ws://localhost:3000') {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('Connected to Maestro Server');
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      this.handleEvent(message.event, message.data);
    });

    this.ws.on('close', () => {
      console.log('Disconnected from Maestro Server');
      // Implement reconnection logic
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  handleEvent(event, data) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const client = new MaestroClient();

client.on('task:created', (task) => {
  console.log('New task:', task.title);
});

client.on('session:spawn', (data) => {
  console.log('Spawn event received!');
  console.log('Command:', data.command);
  console.log('Working directory:', data.cwd);
  console.log('Environment:', data.envVars);
  console.log('Spawn source:', data.spawnSource);
  // Create terminal and run command
});

client.connect();
```

### React Hook Example

```typescript
import { useEffect, useState } from 'react';

export function useMaestroWebSocket(url = 'ws://localhost:3000') {
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket(url);

    websocket.onopen = () => {
      console.log('Connected to Maestro Server');
      setConnected(true);
    };

    websocket.onclose = () => {
      console.log('Disconnected from Maestro Server');
      setConnected(false);
      // Reconnect after 5 seconds
      setTimeout(() => {
        setWs(new WebSocket(url));
      }, 5000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [url]);

  return { ws, connected };
}

// Usage in component
function TaskList() {
  const { ws, connected } = useMaestroWebSocket();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.event === 'task:created') {
        setTasks(prev => [...prev, message.data]);
      } else if (message.event === 'task:updated') {
        setTasks(prev => prev.map(t =>
          t.id === message.data.id ? message.data : t
        ));
      } else if (message.event === 'task:deleted') {
        setTasks(prev => prev.filter(t => t.id !== message.data.id));
      }
    };
  }, [ws]);

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {tasks.map(task => (
        <div key={task.id}>{task.title}</div>
      ))}
    </div>
  );
}
```

---

## Reconnection Strategy

Clients should implement exponential backoff for reconnection:

```javascript
class ReconnectingWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.reconnectAttempts = 0;
    this.ws = null;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.ws.onclose = () => {
      console.log('Disconnected. Reconnecting...');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage(message);
    };
  }

  reconnect() {
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  onMessage(message) {
    // Override in subclass or set handler
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

---

## Event Ordering Guarantees

### Guarantee 1: Session Spawn Order

For session spawn:
1. `session:spawn` (with full spawn data) emitted **first**
2. `task:session_added` emitted **after** for each task

### Guarantee 2: Bidirectional Events

When associating task with session:
1. `session:task_added` emitted
2. `task:session_added` emitted
(Order not guaranteed between these two)

### Guarantee 3: Delete Cascade

When deleting session:
1. Session removed from all tasks
2. `session:deleted` emitted
3. Timeline events added to tasks

---

## Debugging

### Enable Debug Logging

Set `DEBUG` environment variable:

```bash
DEBUG=true npm start
```

Output shows broadcast details:

```
Broadcast to 3/3 clients: task:created (2ms)
Broadcast to 3/3 clients: session:created (1ms)
```

### Monitor WebSocket Traffic (wscat)

```bash
npm install -g wscat
wscat -c ws://localhost:3000
```

You'll see all broadcast events in real-time.

### Test Broadcasts

```bash
# Create task (triggers task:created)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj_123","title":"Test"}'

# Update task (triggers task:updated)
curl -X PATCH http://localhost:3000/api/tasks/task_123 \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```

---

## Error Handling

### Client-Side Error Handling

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Log to error tracking service
  // Show user notification
  // Attempt reconnection
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);

  if (event.code === 1006) {
    // Abnormal closure - likely network issue
    // Implement reconnection
  }
};
```

### Server-Side Error Handling

The `WebSocketBridge` logs errors but continues broadcasting to other clients:

```typescript
this.wss.clients.forEach((client) => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(message);
    sent++;
  }
});
```

Connection-level errors are handled per-client:

```typescript
ws.on('error', (error) => {
  this.logger.error('WebSocket client error:', error);
});
```

---

## Performance Characteristics

### Broadcast Latency

- **Typical:** < 10ms to broadcast to all clients
- **Depends on:** Number of clients, message size, network conditions

### Connection Limit

- **Recommended:** 10-50 concurrent WebSocket clients
- **Tested:** Up to 100 clients (single machine)
- **Not designed for:** High-scale production (100+ clients)

### Message Size

- **Typical:** < 5KB per message (entity updates)
- **Largest:** Session spawn events with full manifest (10-50KB)

---

## Related Specifications

- **03-API-SPECIFICATION.md** - HTTP endpoints that trigger events
- **05-STORAGE-SPECIFICATION.md** - Storage layer that emits events
- **08-SESSION-SPAWNING-SPECIFICATION.md** - Spawn event details
- **02-CORE-CONCEPTS.md** - Entity schemas in event payloads
