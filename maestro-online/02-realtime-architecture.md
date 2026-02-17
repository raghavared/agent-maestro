# Real-time Architecture: Socket.IO & Event System Design

## 1. Overview

This document defines the complete real-time communication architecture for Maestro Online. It replaces the current raw `ws` WebSocket setup with Socket.IO, adds multi-client support across desktop (Tauri), web (phone browser), and CLI agents, and introduces terminal streaming over the network.

### Current State

```
InMemoryEventBus ──► WebSocketBridge (raw ws) ──► Single Tauri WebView
                           │
                     Broadcasts ALL events
                     Session-filter via subscribe/unsubscribe messages
                     Raw JSON over ws
```

### Target State

```
RedisEventBus ──► SocketIOBridge ──┬──► /ui namespace    (Tauri desktop)
                                   ├──► /mobile namespace (web app / phone)
                                   ├──► /cli namespace    (CLI heartbeat)
                                   └──► /terminal namespace (PTY proxy)

                  Socket.IO Rooms:
                    project:{projectId}  — all events for a project
                    session:{sessionId}  — session-scoped events
                    terminal:{sessionId} — PTY output stream
```

---

## 2. Socket.IO Server Architecture

### 2.1 Server Setup

Socket.IO attaches to the existing Express HTTP server. No separate port needed.

```typescript
// maestro-server/src/infrastructure/socketio/SocketIOBridge.ts

import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import http from 'http';

export class SocketIOBridge {
  private io: SocketIOServer;
  private uiNs: Namespace;
  private mobileNs: Namespace;
  private cliNs: Namespace;
  private terminalNs: Namespace;

  constructor(
    httpServer: http.Server,
    private eventBus: IEventBus,
    private redisManager: RedisClientManager | null,
    private services: {
      sessionService: SessionService;
      taskService: TaskService;
      mailService: MailService;
      projectService: ProjectService;
    },
    private logger: ILogger,
    private config: SocketIOConfig
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigins,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 20000,
      maxHttpBufferSize: 1e6, // 1MB max message
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 min
        skipMiddlewares: false,
      },
    });

    // Redis adapter for horizontal scaling
    if (redisManager) {
      const pubClient = redisManager.getPubClient().duplicate();
      const subClient = redisManager.getSubClient().duplicate();
      this.io.adapter(createAdapter(pubClient, subClient));
    }

    this.uiNs = this.io.of('/ui');
    this.mobileNs = this.io.of('/mobile');
    this.cliNs = this.io.of('/cli');
    this.terminalNs = this.io.of('/terminal');

    this.setupUINamespace();
    this.setupMobileNamespace();
    this.setupCLINamespace();
    this.setupTerminalNamespace();
    this.subscribeToDomainEvents();
  }
}
```

### 2.2 Configuration

```typescript
export interface SocketIOConfig {
  corsOrigins: string[];
  jwtSecret?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

// Default CORS origins
const defaultOrigins = [
  'tauri://localhost',           // Tauri desktop app
  'http://localhost:1420',       // Vite dev server (Tauri)
  'http://localhost:3000',       // Express server
  'http://localhost:5173',       // Vite dev server (web app)
  'http://127.0.0.1:1420',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  // Cloudflare tunnel domain added via EXTERNAL_URL env var
];
```

### 2.3 server.ts Integration

```typescript
// maestro-server/src/server.ts changes:

// REMOVE:
// import { WebSocketServer } from 'ws';
// import { WebSocketBridge } from './infrastructure/websocket/WebSocketBridge';

// ADD:
import { SocketIOBridge } from './infrastructure/socketio/SocketIOBridge';

// REPLACE WebSocket setup:
// OLD: const wss = new WebSocketServer({ server });
//      wsBridge = new WebSocketBridge(wss, eventBus, logger);
// NEW:
const socketIOBridge = new SocketIOBridge(
  server,
  eventBus,
  container.redisManager,
  {
    sessionService: container.sessionService,
    taskService: container.taskService,
    mailService: container.mailService,
    projectService: container.projectService,
  },
  logger,
  {
    corsOrigins: [
      ...defaultOrigins,
      ...(config.externalUrl ? [config.externalUrl] : []),
    ],
    supabaseUrl: config.supabase?.url,
    supabaseAnonKey: config.supabase?.anonKey,
  }
);

// UPDATE /ws-status endpoint:
app.get('/ws-status', (req, res) => {
  res.json(socketIOBridge.getStatus());
});

// UPDATE shutdown:
socketIOBridge.close();
```

---

## 3. Namespace Design

### 3.1 `/ui` — Desktop Tauri Clients

Replaces the current raw WebSocket connection. Maintains backward compatibility with existing event payload shapes.

```typescript
private setupUINamespace(): void {
  // No auth middleware for local Tauri — it connects from localhost
  // In production, Supabase JWT validation is added

  this.uiNs.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const user = await this.validateSupabaseToken(token);
        socket.data.userId = user.id;
        socket.data.authenticated = true;
      } catch {
        // Allow unauthenticated for local Tauri (no token = local mode)
      }
    }
    socket.data.authenticated = socket.data.authenticated || this.isLocalConnection(socket);
    next();
  });

  this.uiNs.on('connection', (socket) => {
    this.logger.info(`UI client connected (id=${socket.id})`);

    // --- Replicate current WebSocketBridge behavior ---

    // Subscribe to session-scoped events
    socket.on('subscribe', (data: { sessionIds: string[] }) => {
      if (!Array.isArray(data.sessionIds)) return;
      for (const id of data.sessionIds) {
        if (typeof id === 'string') {
          socket.join(`session:${id}`);
        }
      }
      socket.emit('subscribed', {
        sessionIds: data.sessionIds,
        timestamp: Date.now(),
      });
    });

    // Unsubscribe from session-scoped events
    socket.on('unsubscribe', () => {
      // Leave all session rooms (keep project rooms)
      for (const room of socket.rooms) {
        if (room.startsWith('session:')) {
          socket.leave(room);
        }
      }
      socket.emit('unsubscribed', { timestamp: Date.now() });
    });

    // Subscribe to a project (for project-level events)
    socket.on('project:subscribe', (data: { projectId: string }) => {
      socket.join(`project:${data.projectId}`);
      socket.data.projectId = data.projectId;
    });

    // Ping/pong (Socket.IO has built-in heartbeat, but keep app-level for compatibility)
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      this.logger.info(`UI client disconnected: ${reason} (id=${socket.id})`);
    });
  });
}
```

**Client-side migration (Tauri):**
```typescript
// OLD (maestro-ui):
// const ws = new WebSocket('ws://localhost:3000');
// ws.send(JSON.stringify({ type: 'subscribe', sessionIds: [...] }));

// NEW:
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000/ui', {
  transports: ['websocket'],
  auth: { token: supabaseToken }, // optional for local
});
socket.emit('subscribe', { sessionIds: [...] });
socket.on('session:updated', (payload) => { /* handle */ });
```

### 3.2 `/mobile` — Web App / Phone Browser Clients

Requires authentication. Auto-joins project room.

```typescript
private setupMobileNamespace(): void {
  // Auth middleware — REQUIRED for mobile
  this.mobileNs.use(async (socket, next) => {
    const { token, projectId } = socket.handshake.auth;

    if (!token) {
      return next(new Error('Authentication required'));
    }
    if (!projectId) {
      return next(new Error('projectId required'));
    }

    try {
      const user = await this.validateSupabaseToken(token);
      socket.data.userId = user.id;
      socket.data.projectId = projectId;
      socket.data.authenticated = true;
      next();
    } catch (err) {
      next(new Error('Invalid authentication token'));
    }
  });

  this.mobileNs.on('connection', (socket) => {
    const { projectId, userId } = socket.data;

    // Auto-join project room
    socket.join(`project:${projectId}`);

    this.logger.info(`Mobile client connected (user=${userId}, project=${projectId})`);

    // --- Session subscription ---
    socket.on('session:subscribe', (sessionIds: string[]) => {
      for (const id of sessionIds) {
        socket.join(`session:${id}`);
      }
    });

    socket.on('session:unsubscribe', (sessionIds: string[]) => {
      for (const id of sessionIds) {
        socket.leave(`session:${id}`);
      }
    });

    // --- State sync (initial load + reconnect) ---
    socket.on('state:sync', async (ack) => {
      try {
        const [sessions, tasks, teamMembers] = await Promise.all([
          this.services.sessionService.findAll({ projectId }),
          this.services.taskService.findAll({ projectId }),
          // teamMemberService if available
        ]);
        ack({ success: true, sessions, tasks, teamMembers });
      } catch (err) {
        ack({ success: false, error: err.message });
      }
    });

    // --- Mail operations ---
    socket.on('mail:send', async (payload, ack) => {
      try {
        const mail = await this.services.mailService.sendMail({
          projectId,
          fromSessionId: `mobile:${userId}`,
          toSessionId: payload.toSessionId,
          type: payload.type || 'directive',
          subject: payload.subject,
          body: payload.body,
        });
        ack({ success: true, mail });
      } catch (err) {
        ack({ success: false, error: err.message });
      }
    });

    // --- Respond to needs_input ---
    socket.on('session:reply-input', async (payload, ack) => {
      try {
        await this.services.sessionService.update(payload.sessionId, {
          needsInput: { active: false },
        });
        // The input text itself is written to terminal via terminal namespace
        ack({ success: true });
      } catch (err) {
        ack({ success: false, error: err.message });
      }
    });

    // --- Spawn agent ---
    socket.on('session:spawn', async (payload, ack) => {
      try {
        // Delegate to session service spawn logic
        const result = await this.services.sessionService.create({
          projectId,
          ...payload,
        });
        ack({ success: true, session: result });
      } catch (err) {
        ack({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      this.logger.info(`Mobile client disconnected: ${reason} (user=${userId})`);
    });
  });
}
```

**Client-side (web app):**
```typescript
import { io } from 'socket.io-client';

const socket = io('https://maestro.yourdomain.com/mobile', {
  transports: ['websocket', 'polling'], // polling fallback for mobile networks
  auth: {
    token: supabaseSession.access_token,
    projectId: currentProjectId,
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
});

// Initial state sync on connect
socket.on('connect', () => {
  socket.emit('state:sync', (response) => {
    if (response.success) {
      store.setState({ sessions: response.sessions, tasks: response.tasks });
    }
  });
});

// Listen for real-time updates
socket.on('task:updated', (payload) => {
  store.updateTask(payload.data);
});
```

### 3.3 `/cli` — CLI Agent Heartbeat & Status

Lightweight namespace for agent processes to maintain presence and receive directives.

```typescript
private setupCLINamespace(): void {
  this.cliNs.use((socket, next) => {
    const { sessionId, projectId } = socket.handshake.auth;
    if (!sessionId || !projectId) {
      return next(new Error('sessionId and projectId required'));
    }
    socket.data.sessionId = sessionId;
    socket.data.projectId = projectId;
    next();
  });

  this.cliNs.on('connection', (socket) => {
    const { sessionId, projectId } = socket.data;

    // Join session and project rooms
    socket.join(`session:${sessionId}`);
    socket.join(`project:${projectId}`);

    this.logger.info(`CLI agent connected (session=${sessionId})`);

    // Heartbeat — agent sends periodically, server tracks presence
    socket.on('heartbeat', (data: { status: string; taskId?: string }) => {
      // Update session lastHeartbeat in store/Redis
      // This replaces the Redis key-expiry approach when Socket.IO is available
      socket.data.lastHeartbeat = Date.now();
      socket.data.agentStatus = data.status;
    });

    // Agent reports progress
    socket.on('session:report', (data: { type: string; message: string }) => {
      // Forward to event bus
      this.eventBus.emit(`notify:progress`, {
        sessionId,
        message: data.message,
      });
    });

    socket.on('disconnect', (reason) => {
      this.logger.info(`CLI agent disconnected: ${reason} (session=${sessionId})`);
      // If unexpected disconnect, mark session as potentially failed
      if (reason === 'transport close' || reason === 'transport error') {
        // Start a grace period timer before marking failed
        setTimeout(async () => {
          const sockets = await this.cliNs.in(`session:${sessionId}`).fetchSockets();
          if (sockets.length === 0) {
            // Agent didn't reconnect — mark session as disconnected
            this.logger.warn(`CLI agent failed to reconnect (session=${sessionId})`);
            this.eventBus.emit('notify:session_failed', {
              sessionId,
              name: 'agent',
              reason: 'agent_disconnected',
            });
          }
        }, 30000); // 30s grace period
      }
    });
  });
}
```

### 3.4 `/terminal` — PTY Streaming Proxy

See Section 5 for full design.

---

## 4. Domain Event Routing

### 4.1 Complete Event Map

All 27 domain events are subscribed to and routed based on scope:

```typescript
private subscribeToDomainEvents(): void {
  // All events from DomainEvents.ts
  const events: EventName[] = [
    // Project events — project-scoped, broadcast to project room
    'project:created', 'project:updated', 'project:deleted',
    // Task events — project-scoped (tasks belong to projects)
    'task:created', 'task:updated', 'task:deleted',
    'task:session_added', 'task:session_removed',
    // Session events — session-scoped
    'session:created', 'session:spawn', 'session:updated', 'session:deleted',
    'session:task_added', 'session:task_removed',
    // Notification events — session-scoped
    'notify:task_completed', 'notify:task_failed', 'notify:task_blocked',
    'notify:task_session_completed', 'notify:task_session_failed',
    'notify:session_completed', 'notify:session_failed',
    'notify:needs_input', 'notify:progress',
    // Modal events — session-scoped
    'session:modal', 'session:modal_action', 'session:modal_closed',
    // Team member events — project-scoped
    'team_member:created', 'team_member:updated',
    'team_member:deleted', 'team_member:archived',
    // Mail events — session-scoped or broadcast
    'mail:received', 'mail:deleted',
  ];

  for (const event of events) {
    this.eventBus.on(event, (data: any) => {
      this.routeEvent(event, data);
    });
  }

  this.logger.info(`SocketIOBridge subscribed to ${events.length} domain events`);
}
```

### 4.2 Event Routing Strategy

Events are routed to rooms based on their scope. The routing logic determines which rooms receive each event:

```typescript
private routeEvent(event: string, data: any): void {
  const payload = { type: event, event, data, timestamp: Date.now() };
  const sessionId = this.extractSessionId(event, data);
  const projectId = this.extractProjectId(event, data);

  // ── Project-scoped events ──
  // These go to ALL clients watching a project
  if (this.isProjectScopedEvent(event)) {
    if (projectId) {
      this.mobileNs.to(`project:${projectId}`).emit(event, payload);
      this.uiNs.to(`project:${projectId}`).emit(event, payload);
    }
    // Fallback: broadcast to all UI clients (backward compat with current behavior)
    if (!projectId) {
      this.uiNs.emit(event, payload);
    }
    return;
  }

  // ── Session-scoped events ──
  // These go to clients subscribed to the specific session
  if (sessionId) {
    this.uiNs.to(`session:${sessionId}`).emit(event, payload);
    this.mobileNs.to(`session:${sessionId}`).emit(event, payload);
    this.cliNs.to(`session:${sessionId}`).emit(event, payload);
  }

  // ── Also route to project room for mobile clients ──
  // Mobile clients want ALL events for their project (dashboard view)
  if (projectId) {
    this.mobileNs.to(`project:${projectId}`).emit(event, payload);
  }

  // ── Notification events also broadcast broadly ──
  if (event.startsWith('notify:')) {
    // All UI clients get notifications regardless of session subscription
    this.uiNs.emit(event, payload);
  }
}

private isProjectScopedEvent(event: string): boolean {
  return event.startsWith('project:') ||
         event.startsWith('team_member:') ||
         event === 'task:created' ||
         event === 'task:deleted';
}

private extractSessionId(event: string, data: any): string | undefined {
  if (!data) return undefined;
  // Non-session-scoped events
  if (event.startsWith('team_member:') || event.startsWith('mail:') || event.startsWith('project:')) {
    return undefined;
  }
  if (data.sessionId) return data.sessionId;
  if (data.id && typeof data.status === 'string') return data.id;
  if (data.session?.id) return data.session.id;
  return undefined;
}

private extractProjectId(event: string, data: any): string | undefined {
  if (!data) return undefined;
  return data.projectId || data.session?.projectId || data.project?.id;
}
```

### 4.3 Event Flow Diagram

```
                           ┌──────────────────────────────────┐
                           │         Domain Services          │
                           │  (SessionService, TaskService,   │
                           │   MailService, etc.)              │
                           └──────────────┬───────────────────┘
                                          │ emit()
                                          ▼
                           ┌──────────────────────────────────┐
                           │        RedisEventBus             │
                           │   (IEventBus implementation)     │
                           │                                  │
                           │  1. Deliver to local handlers    │
                           │  2. PUBLISH to Redis channel     │
                           └──────────────┬───────────────────┘
                                          │ local handler
                                          ▼
                           ┌──────────────────────────────────┐
                           │        SocketIOBridge            │
                           │     routeEvent(name, data)       │
                           └──┬──────┬──────┬──────┬──────────┘
                              │      │      │      │
               ┌──────────────┘      │      │      └──────────────┐
               ▼                     ▼      ▼                     ▼
    ┌──────────────────┐  ┌────────────┐ ┌────────────┐  ┌──────────────┐
    │   /ui namespace  │  │  /mobile   │ │   /cli     │  │  /terminal   │
    │                  │  │  namespace │ │  namespace │  │  namespace   │
    │  session:{id}    │  │            │ │            │  │              │
    │  project:{id}    │  │ project:{} │ │ session:{} │  │ terminal:{}  │
    │  rooms           │  │ session:{} │ │ rooms      │  │ rooms        │
    │                  │  │ rooms      │ │            │  │              │
    └────────┬─────────┘  └─────┬──────┘ └─────┬──────┘  └──────┬───────┘
             │                  │               │                │
             ▼                  ▼               ▼                ▼
        Tauri Desktop      Phone Browser    CLI Agent       Terminal Viewer
        (local/remote)     (via Cloudflare)  (local)        (remote xterm.js)
```

### 4.4 Event Payload Format

All events use a consistent envelope format (matching current WebSocketBridge):

```typescript
interface SocketEventPayload<T = any> {
  type: string;      // Event name (e.g., 'session:updated')
  event: string;     // Same as type (backward compat)
  data: T;           // Event-specific payload from DomainEvents.ts
  timestamp: number; // Server timestamp (Date.now())
}
```

---

## 5. Terminal Streaming over Socket.IO

### 5.1 The Challenge

The PTY (pseudo-terminal) runs in the Rust backend of the Tauri desktop app. Currently:
- Rust spawns PTY via `portable_pty` crate
- PTY output is emitted as `pty-output` Tauri events to the local WebView
- User input from the WebView is sent to PTY via `invoke("write_to_session")`
- Resize events sent via `invoke("resize_session")`

For remote web clients, we need to proxy this PTY I/O through the Express server via Socket.IO.

### 5.2 Architecture: Terminal Proxy

```
LOCAL MACHINE                    EXPRESS SERVER               REMOTE CLIENT
┌──────────────────┐            ┌──────────────────┐        ┌──────────────────┐
│   Tauri App      │            │   maestro-server  │        │   Web Browser    │
│                  │            │                   │        │                  │
│  ┌─────────┐    │   Socket   │  ┌─────────────┐  │ Socket │  ┌────────────┐ │
│  │  PTY    │────┤───.IO────►│  │  Terminal   │──┤──.IO──►│  │  xterm.js  │ │
│  │ (Rust)  │◄───┤───────────┤◄─│  Proxy      │◄─┤────────┤◄─│  renderer  │ │
│  └─────────┘    │   /ui ns   │  │  Module     │  │ /term  │  └────────────┘ │
│                  │            │  └─────────────┘  │  ns    │                  │
│  pty-output ──► │            │                   │        │                  │
│  pty-exit  ──► │            │  Ring buffer per  │        │                  │
│  write_to ◄── │            │  session (scrollback)      │                  │
│  resize   ◄── │            │                   │        │                  │
└──────────────────┘            └──────────────────┘        └──────────────────┘
```

### 5.3 Terminal Proxy Flow

**Step 1: Tauri registers terminal session with server**

When the Tauri app creates a PTY session (local), it also connects to the `/ui` namespace and announces the terminal:

```typescript
// Tauri-side (TypeScript in WebView):
const uiSocket = io('http://localhost:3000/ui');

// When PTY created locally:
uiSocket.emit('terminal:register', {
  ptyId: localPtyId,         // Rust PTY session ID
  sessionId: maestroSessionId, // Maestro session ID (links to task)
  cols: 80,
  rows: 24,
});

// Forward PTY output to server:
window.__TAURI__.event.listen('pty-output', (event) => {
  const { id, data } = event.payload;
  uiSocket.emit('terminal:output', {
    ptyId: id,
    data: data, // raw terminal output (ANSI sequences included)
  });
});

// Forward PTY exit:
window.__TAURI__.event.listen('pty-exit', (event) => {
  uiSocket.emit('terminal:exit', {
    ptyId: event.payload.id,
    exitCode: event.payload.exit_code,
  });
});

// Receive input from remote clients (forwarded by server):
uiSocket.on('terminal:input', (payload) => {
  window.__TAURI__.invoke('write_to_session', {
    id: payload.ptyId,
    data: payload.data,
    source: 'remote',
  });
});

// Receive resize from remote clients:
uiSocket.on('terminal:resize', (payload) => {
  window.__TAURI__.invoke('resize_session', {
    id: payload.ptyId,
    cols: payload.cols,
    rows: payload.rows,
  });
});
```

**Step 2: Server-side Terminal Proxy Module**

```typescript
// Inside SocketIOBridge

private terminalSessions = new Map<string, TerminalSession>();

interface TerminalSession {
  ptyId: string;
  sessionId: string;
  ownerSocketId: string; // The Tauri /ui socket that owns the PTY
  cols: number;
  rows: number;
  buffer: RingBuffer;    // Scrollback buffer for late-joining clients
  createdAt: number;
}

private setupTerminalNamespace(): void {
  // Auth middleware (Supabase JWT required for remote terminal access)
  this.terminalNs.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required for terminal access'));
    }
    try {
      const user = await this.validateSupabaseToken(token);
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  this.terminalNs.on('connection', (socket) => {
    this.logger.info(`Terminal viewer connected (user=${socket.data.userId})`);

    // Client subscribes to a terminal session
    socket.on('terminal:watch', (data: { sessionId: string }, ack) => {
      const terminal = this.findTerminalBySessionId(data.sessionId);
      if (!terminal) {
        return ack({ success: false, error: 'Terminal session not found' });
      }

      socket.join(`terminal:${data.sessionId}`);

      // Send scrollback buffer to catch up
      ack({
        success: true,
        cols: terminal.cols,
        rows: terminal.rows,
        scrollback: terminal.buffer.getAll(), // Recent output
      });
    });

    // Remote client sends input
    socket.on('terminal:input', (data: { sessionId: string; input: string }) => {
      const terminal = this.findTerminalBySessionId(data.sessionId);
      if (!terminal) return;

      // Forward input to the Tauri owner socket
      const ownerSocket = this.uiNs.sockets.get(terminal.ownerSocketId);
      if (ownerSocket) {
        ownerSocket.emit('terminal:input', {
          ptyId: terminal.ptyId,
          data: data.input,
        });
      }
    });

    // Remote client sends resize
    socket.on('terminal:resize', (data: { sessionId: string; cols: number; rows: number }) => {
      const terminal = this.findTerminalBySessionId(data.sessionId);
      if (!terminal) return;

      const ownerSocket = this.uiNs.sockets.get(terminal.ownerSocketId);
      if (ownerSocket) {
        ownerSocket.emit('terminal:resize', {
          ptyId: terminal.ptyId,
          cols: data.cols,
          rows: data.rows,
        });
      }
    });

    socket.on('disconnect', () => {
      this.logger.info(`Terminal viewer disconnected (user=${socket.data.userId})`);
    });
  });

  // Handle terminal registration from /ui namespace
  this.uiNs.on('connection', (socket) => {
    socket.on('terminal:register', (data) => {
      this.terminalSessions.set(data.sessionId, {
        ptyId: data.ptyId,
        sessionId: data.sessionId,
        ownerSocketId: socket.id,
        cols: data.cols || 80,
        rows: data.rows || 24,
        buffer: new RingBuffer(50000), // ~50KB scrollback
        createdAt: Date.now(),
      });
    });

    socket.on('terminal:output', (data: { ptyId: string; data: string }) => {
      const terminal = this.findTerminalByPtyId(data.ptyId);
      if (!terminal) return;

      // Buffer for late-joining clients
      terminal.buffer.write(data.data);

      // Broadcast to all watchers in the terminal room
      this.terminalNs.to(`terminal:${terminal.sessionId}`).emit('terminal:output', {
        sessionId: terminal.sessionId,
        data: data.data,
      });
    });

    socket.on('terminal:exit', (data: { ptyId: string; exitCode?: number }) => {
      const terminal = this.findTerminalByPtyId(data.ptyId);
      if (!terminal) return;

      this.terminalNs.to(`terminal:${terminal.sessionId}`).emit('terminal:exit', {
        sessionId: terminal.sessionId,
        exitCode: data.exitCode,
      });

      this.terminalSessions.delete(terminal.sessionId);
    });

    socket.on('disconnect', () => {
      // Clean up terminals owned by this socket
      for (const [sessionId, terminal] of this.terminalSessions) {
        if (terminal.ownerSocketId === socket.id) {
          this.terminalNs.to(`terminal:${sessionId}`).emit('terminal:exit', {
            sessionId,
            exitCode: null,
            reason: 'owner_disconnected',
          });
          this.terminalSessions.delete(sessionId);
        }
      }
    });
  });
}
```

### 5.4 Ring Buffer for Scrollback

Remote clients joining mid-session need to see recent terminal output:

```typescript
class RingBuffer {
  private chunks: string[] = [];
  private totalSize = 0;

  constructor(private maxSize: number) {}

  write(data: string): void {
    this.chunks.push(data);
    this.totalSize += data.length;

    // Evict oldest chunks when over max
    while (this.totalSize > this.maxSize && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.totalSize -= removed.length;
    }
  }

  getAll(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }
}
```

### 5.5 Backpressure Handling

Terminal output can be bursty (e.g., `cat large-file.txt`). We need to avoid overwhelming slow mobile connections:

```typescript
// Server-side: batch and throttle terminal output
private terminalOutputBuffers = new Map<string, { data: string; timer: NodeJS.Timeout | null }>();

private bufferTerminalOutput(sessionId: string, data: string): void {
  let buf = this.terminalOutputBuffers.get(sessionId);
  if (!buf) {
    buf = { data: '', timer: null };
    this.terminalOutputBuffers.set(sessionId, buf);
  }

  buf.data += data;

  // Flush every 16ms (~60fps) or when buffer exceeds 4KB
  if (!buf.timer) {
    buf.timer = setTimeout(() => {
      const flushed = buf!.data;
      buf!.data = '';
      buf!.timer = null;

      if (flushed.length > 0) {
        this.terminalNs.to(`terminal:${sessionId}`).emit('terminal:output', {
          sessionId,
          data: flushed,
        });
      }
    }, 16);
  }

  // Immediate flush for large buffers
  if (buf.data.length > 4096) {
    if (buf.timer) clearTimeout(buf.timer);
    const flushed = buf.data;
    buf.data = '';
    buf.timer = null;
    this.terminalNs.to(`terminal:${sessionId}`).emit('terminal:output', {
      sessionId,
      data: flushed,
    });
  }
}
```

### 5.6 Reconnection Handling

When a remote client reconnects after a brief disconnect:

1. Socket.IO's `connectionStateRecovery` replays missed events (up to 2 minutes)
2. If beyond recovery window, client re-emits `terminal:watch` and receives the full scrollback buffer
3. The scrollback buffer (~50KB) is enough for ~2000 lines of terminal output

```typescript
// Client-side reconnection:
socket.on('connect', () => {
  if (socket.recovered) {
    // Missed events were replayed automatically
    console.log('Reconnected with state recovery');
  } else {
    // Full resync needed
    socket.emit('terminal:watch', { sessionId }, (response) => {
      terminal.reset();
      terminal.write(response.scrollback);
      terminal.resize(response.cols, response.rows);
    });
  }
});
```

---

## 6. Authentication on Socket.IO

### 6.1 Supabase JWT Validation

All external (non-localhost) connections must authenticate via Supabase JWT:

```typescript
// Inside SocketIOBridge

private async validateSupabaseToken(token: string): Promise<{ id: string; email: string }> {
  // Option 1: Use Supabase Admin client (recommended)
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid token');
  }
  return { id: data.user.id, email: data.user.email! };
}

private isLocalConnection(socket: Socket): boolean {
  const addr = socket.handshake.address;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}
```

### 6.2 Auth Flow Per Namespace

| Namespace | Auth Required? | Auth Method | Notes |
|-----------|---------------|-------------|-------|
| `/ui` | Optional | Supabase JWT in `auth.token` | Local Tauri connections bypass auth |
| `/mobile` | **Required** | Supabase JWT in `auth.token` + `auth.projectId` | Always remote |
| `/cli` | Optional | `auth.sessionId` + `auth.projectId` | Local CLI agents identified by session |
| `/terminal` | **Required** | Supabase JWT in `auth.token` | Remote terminal access must be authenticated |

### 6.3 Token Refresh

Socket.IO connections are long-lived. Supabase JWTs expire (default: 1 hour). Clients must handle token refresh:

```typescript
// Client-side token refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    // Update the socket's auth token
    socket.auth = { ...socket.auth, token: session.access_token };
    // Reconnect to apply new token
    socket.disconnect().connect();
  }
});
```

---

## 7. Multi-Client Sync

### 7.1 Consistency Model

Maestro uses **eventual consistency** with the Express server as the source of truth:

1. All mutations go through REST API (Express → Service → Repository → Database)
2. Mutations emit domain events via RedisEventBus
3. SocketIOBridge distributes events to all connected clients
4. Clients update their local state stores from events

```
Client A (web)                    Server                    Client B (Tauri)
     │                              │                              │
     │──── POST /api/tasks ────────►│                              │
     │                              │── task:created ──► EventBus  │
     │◄── HTTP 201 (task) ─────────│                              │
     │                              │── Socket.IO emit ───────────►│
     │◄── Socket.IO emit ──────────│                              │
     │                              │                              │
     │   Both clients now have      │                              │
     │   the same task state        │                              │
```

### 7.2 Conflict Resolution

Since all mutations go through the server's REST API, true conflicts are rare. The server is the arbiter:

| Scenario | Resolution |
|----------|-----------|
| Two clients update same task | Last write wins at the API level. Both receive `task:updated` with final state. |
| Two clients claim same task | Server uses distributed lock (Redis SET NX). First request succeeds, second gets 409 Conflict. |
| Client has stale state | `state:sync` event on reconnect fetches full fresh state from server. |
| Network partition | Socket.IO auto-reconnects. On reconnect, client calls `state:sync` to catch up. |

### 7.3 Optimistic Updates

For responsiveness, clients can apply changes optimistically and reconcile:

```typescript
// Client-side optimistic update pattern:
async function updateTask(taskId: string, updates: Partial<Task>) {
  // 1. Apply optimistically
  store.updateTask(taskId, updates);

  try {
    // 2. Send to server
    await api.updateTask(taskId, updates);
    // 3. Server event will arrive via Socket.IO confirming the change
  } catch (err) {
    // 4. Rollback on failure
    store.rollbackTask(taskId);
    showError(err.message);
  }
}
```

### 7.4 State Sync on Reconnect

When a client reconnects after being offline:

```typescript
socket.on('connect', () => {
  if (!socket.recovered) {
    // Full state resync
    socket.emit('state:sync', (response) => {
      store.replaceState({
        sessions: response.sessions,
        tasks: response.tasks,
        teamMembers: response.teamMembers,
      });
    });
  }
});
```

---

## 8. Room Strategy Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Room Hierarchy                              │
│                                                                     │
│  project:{projectId}                                                │
│  ├── All project-level events (project:*, team_member:*, task:*)   │
│  ├── Mobile clients auto-join on connect                           │
│  └── UI clients join via project:subscribe                         │
│                                                                     │
│  session:{sessionId}                                                │
│  ├── Session-scoped events (session:*, notify:*)                   │
│  ├── Clients join via subscribe / session:subscribe                │
│  └── CLI agents auto-join their own session                        │
│                                                                     │
│  terminal:{sessionId}                                               │
│  ├── PTY output stream                                              │
│  ├── Remote clients join via terminal:watch                        │
│  └── Only in /terminal namespace                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Room | Namespace(s) | Who Joins | Events Received |
|------|-------------|-----------|----------------|
| `project:{id}` | `/mobile`, `/ui` | Mobile (auto), UI (explicit) | project:*, task:created/deleted, team_member:* |
| `session:{id}` | `/ui`, `/mobile`, `/cli` | UI (subscribe), Mobile (subscribe), CLI (auto) | session:*, notify:*, modal:* |
| `terminal:{id}` | `/terminal` | Remote terminal viewers | terminal:output, terminal:exit |

---

## 9. Status & Monitoring Endpoint

Replace the current `/ws-status` endpoint:

```typescript
getStatus(): SocketIOStatus {
  return {
    engine: {
      totalClients: this.io.engine.clientsCount,
    },
    namespaces: {
      ui: {
        connected: this.uiNs.sockets.size,
        rooms: this.getRoomSummary(this.uiNs),
      },
      mobile: {
        connected: this.mobileNs.sockets.size,
        rooms: this.getRoomSummary(this.mobileNs),
      },
      cli: {
        connected: this.cliNs.sockets.size,
        rooms: this.getRoomSummary(this.cliNs),
      },
      terminal: {
        connected: this.terminalNs.sockets.size,
        activeSessions: this.terminalSessions.size,
      },
    },
  };
}
```

---

## 10. Graceful Shutdown

```typescript
async close(): Promise<void> {
  // Notify all clients
  this.io.emit('server:shutdown', { timestamp: Date.now() });

  // Close all terminal sessions
  for (const [sessionId] of this.terminalSessions) {
    this.terminalNs.to(`terminal:${sessionId}`).emit('terminal:exit', {
      sessionId,
      reason: 'server_shutdown',
    });
  }
  this.terminalSessions.clear();

  // Close Socket.IO server
  await new Promise<void>((resolve) => {
    this.io.close(() => {
      this.logger.info('Socket.IO server closed');
      resolve();
    });
  });
}
```

---

## 11. Dependencies

### Server (maestro-server/package.json)

```json
{
  "socket.io": "^4.7.0",
  "@socket.io/redis-adapter": "^8.3.0"
}
```

### Clients (maestro-ui & web app)

```json
{
  "socket.io-client": "^4.7.0"
}
```

### CLI (maestro-cli/package.json)

```json
{
  "socket.io-client": "^4.7.0"
}
```

---

## 12. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `maestro-server/src/infrastructure/socketio/SocketIOBridge.ts` | Main Socket.IO bridge class |
| `maestro-server/src/infrastructure/socketio/RingBuffer.ts` | Terminal scrollback buffer |
| `maestro-server/src/infrastructure/socketio/index.ts` | Barrel export |
| `maestro-server/src/infrastructure/socketio/types.ts` | SocketIO config and type interfaces |

### Modified Files

| File | Changes |
|------|---------|
| `maestro-server/src/server.ts` | Replace ws with Socket.IO, pass services to bridge |
| `maestro-server/src/container.ts` | Export redisManager for Socket.IO adapter |
| `maestro-server/package.json` | Add socket.io, @socket.io/redis-adapter |
| `maestro-ui/package.json` | Add socket.io-client |
| `maestro-ui/src/services/useMaestroWebSocket.ts` | Replace raw WebSocket with socket.io-client |
| `maestro-cli/package.json` | Add socket.io-client (for heartbeat) |

### Removed Files (after migration complete)

| File | Reason |
|------|--------|
| `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | Replaced by SocketIOBridge |

---

## 13. Migration Strategy

### Phase 1: Dual-Mode (Recommended)

Run both WebSocketBridge and SocketIOBridge simultaneously during migration:

```typescript
// server.ts during migration:
const wss = new WebSocketServer({ server });
const wsBridge = new WebSocketBridge(wss, eventBus, logger);
const socketIOBridge = new SocketIOBridge(server, eventBus, ...);
// Both subscribe to domain events, both broadcast
// Old clients use ws://, new clients use socket.io
```

### Phase 2: UI Migration

Update `useMaestroWebSocket.ts` to use `socket.io-client`. Test with Tauri desktop app.

### Phase 3: Remove WebSocketBridge

Once all clients are migrated, remove `ws` dependency and `WebSocketBridge`.

---

## 14. Security Considerations

1. **Rate limiting**: Apply per-socket rate limits on input events (terminal:input, mail:send) to prevent abuse
2. **Input validation**: All incoming Socket.IO payloads are validated before processing
3. **Project isolation**: Mobile clients can only access rooms for their authenticated project
4. **Terminal access control**: Only authenticated users with project access can watch/interact with terminals
5. **CORS**: Strict origin allowlist, Cloudflare tunnel domain added via env var
6. **Transport security**: Cloudflare tunnel provides TLS. Local connections use plain HTTP (acceptable for localhost)
