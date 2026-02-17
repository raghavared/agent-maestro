# Comprehensive Implementation Plan: Express + Redis + Socket.IO + Cloudflare Tunnel

## Final Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       maestro-server                           │
│                                                                │
│  ┌────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │  Express   │  │  Socket.IO    │  │    Redis Client       │ │
│  │  REST API  │  │  Server       │  │                       │ │
│  │            │  │               │  │  - Pub/Sub (events)   │ │
│  │  /api/*    │  │  /mobile ns   │  │  - Streams (mail)     │ │
│  │  (agents   │  │  /ui ns       │  │  - Hashes (data)      │ │
│  │   use      │  │               │  │  - Key expiry         │ │
│  │   this)    │  │  (phones +    │  │    (presence)         │ │
│  │            │  │   desktop     │  │  - SET NX EX (locks)  │ │
│  │            │  │   use this)   │  │                       │ │
│  └────────────┘  └──────┬────────┘  └───────────┬───────────┘ │
│                         │                        │             │
│                    ┌────▼────────────────────────▼────┐        │
│                    │        RedisEventBus             │        │
│                    │    (replaces InMemoryEventBus)   │        │
│                    └─────────────────────────────────┘        │
└───────────────────────────────┬────────────────────────────────┘
                                │
                         Cloudflare Tunnel
                      (maestro.yourdomain.com)
                                │
               ┌────────────────┼────────────────┐
               │                │                │
        ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
        │  📱 Phone   │  │  🖥️ Tauri  │  │  Agent CLI  │
        │  Socket.IO  │  │  Socket.IO │  │  REST only  │
        │  /mobile ns │  │  /ui ns    │  │  /api/*     │
        └─────────────┘  └────────────┘  └─────────────┘
```

---

## Phase 0: Prerequisites & Setup

### 0.1 Install Redis
```bash
# macOS
brew install redis
brew services start redis

# Verify
redis-cli ping  # → PONG
```

### 0.2 Install Cloudflare Tunnel
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create maestro
```

### 0.3 Add npm Dependencies

**maestro-server/package.json:**
```
ioredis             — Redis client (better than 'redis' for Pub/Sub, Lua scripts, Streams)
socket.io           — Socket.IO server
@socket.io/redis-adapter  — Multi-instance Socket.IO via Redis (future-proofing)
```

**maestro-cli/package.json:**
```
ioredis             — Redis client (for presence heartbeat, optional mail wait)
```

---

## Phase 1: RedisEventBus (Replace InMemoryEventBus)

**Goal:** Drop-in replacement for `InMemoryEventBus`. All existing services, WebSocketBridge, and MailService continue working unchanged because they depend on the `IEventBus` interface.

**Risk:** Low — the `IEventBus` interface is clean and well-defined.

### Files to Create

#### `maestro-server/src/infrastructure/redis/RedisClient.ts`

Singleton Redis connection manager. Handles:
- Connection to `REDIS_URL` (default `redis://localhost:6379`)
- Reconnect logic with exponential backoff
- Health check method
- Separate pub/sub clients (Redis requires dedicated connection for subscriptions)
- Graceful shutdown (disconnect on SIGINT)

```typescript
// Key exports:
export class RedisClientManager {
  constructor(redisUrl: string, logger: ILogger)

  getClient(): Redis              // For commands (GET, SET, XADD, etc.)
  getPubClient(): Redis           // For PUBLISH
  getSubClient(): Redis           // For SUBSCRIBE (dedicated connection)
  isConnected(): boolean

  async connect(): Promise<void>
  async disconnect(): Promise<void>
  async healthCheck(): Promise<boolean>
}
```

**Design decisions:**
- Use `ioredis` (not `redis`) — better TypeScript support, native Promises, built-in reconnect
- Create 3 connections: general commands, pub, sub (Redis requirement: subscriber connections can't run other commands)
- Connection pooling via ioredis defaults (sufficient for single-server)

#### `maestro-server/src/infrastructure/redis/RedisEventBus.ts`

Implements `IEventBus` using Redis Pub/Sub. Must match the exact `IEventBus` interface.

```typescript
export class RedisEventBus implements IEventBus {
  private pubClient: Redis;
  private subClient: Redis;
  private logger: ILogger;

  // Local handler registry (maps channel → Set<handler>)
  // Needed because Redis SUBSCRIBE is per-connection, not per-handler
  private handlers: Map<string, Set<EventHandler>>;

  // Channel prefix to namespace events
  private prefix = 'maestro:events:';

  constructor(redisManager: RedisClientManager, logger: ILogger)

  async emit<T>(event: string, data: T): Promise<void>
    // PUBLISH maestro:events:<event> JSON.stringify(data)
    // Also call local handlers (for in-process subscribers like MailService.waitForMail)

  on<T>(event: string, handler: EventHandler<T>): void
    // Register in local handlers map
    // If first handler for this channel, call subClient.subscribe(channel)
    // On message, deserialize and fan out to all registered handlers

  off(event: string, handler: EventHandler): void
    // Remove from local handlers map
    // If no handlers left for channel, call subClient.unsubscribe(channel)

  once<T>(event: string, handler: EventHandler<T>): void
    // Wrap handler to auto-remove after first call

  removeAllListeners(event?: string): void
    // Clear handlers map, unsubscribe from Redis channels

  listenerCount(event: string): number
    // Return handlers.get(event)?.size || 0
}
```

**Critical design detail — local + remote delivery:**
The current `InMemoryEventBus` delivers events synchronously within the process. `MailService.waitForMail()` depends on this — it subscribes to `mail:received` and resolves a Promise when a matching event arrives. With Redis Pub/Sub, the message goes out to Redis and comes back on the subscriber connection. This works but adds ~1ms latency. The key requirement is that `RedisEventBus.emit()` must:
1. PUBLISH to Redis (for cross-process / future multi-server)
2. Also deliver to local in-process handlers (for MailService.waitForMail and WebSocketBridge)

This dual-delivery is important. Implementation: when `emit()` is called, also iterate local handlers directly (like InMemoryEventBus does), AND publish to Redis. The Redis subscriber will ignore messages that originated from the same process (use a `sourceId` field to deduplicate).

### Files to Modify

#### `maestro-server/src/infrastructure/config/Config.ts`

Add Redis configuration:

```typescript
// New interface
export interface RedisConfig {
  enabled: boolean;
  url: string;
  keyPrefix: string;
}

// In ConfigOptions, add:
redis: RedisConfig;

// In loadFromEnvironment(), add:
redis: {
  enabled: process.env.REDIS_ENABLED !== 'false',  // Default: enabled
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'maestro:',
}

// Add getter:
get redis(): RedisConfig { return this.config.redis; }
```

**Environment variables:**
- `REDIS_ENABLED` — `true` (default) or `false` (falls back to InMemoryEventBus)
- `REDIS_URL` — `redis://localhost:6379` (default)
- `REDIS_KEY_PREFIX` — `maestro:` (default)

#### `maestro-server/src/container.ts`

Conditional wiring based on config:

```typescript
// Import new classes
import { RedisClientManager } from './infrastructure/redis/RedisClient';
import { RedisEventBus } from './infrastructure/redis/RedisEventBus';

// In createContainer():
let redisManager: RedisClientManager | null = null;
let eventBus: IEventBus;

if (config.redis.enabled) {
  redisManager = new RedisClientManager(config.redis.url, logger);
  await redisManager.connect();
  eventBus = new RedisEventBus(redisManager, logger);
  logger.info('Using Redis event bus');
} else {
  eventBus = new InMemoryEventBus(logger);
  logger.info('Using in-memory event bus (Redis disabled)');
}

// In shutdown():
if (redisManager) {
  await redisManager.disconnect();
}
```

#### `maestro-server/src/server.ts`

No changes needed in Phase 1 — the `eventBus` variable is already passed everywhere via the container. WebSocketBridge receives it via constructor injection.

### Testing Phase 1

1. Start Redis: `redis-cli ping`
2. Start maestro-server with `REDIS_ENABLED=true`
3. Verify all existing functionality works:
   - Session spawn (events flow to UI via WebSocketBridge)
   - Mail send + mail wait (MailService long-poll still works)
   - Task updates propagate to UI
4. Verify fallback: `REDIS_ENABLED=false` uses InMemoryEventBus
5. Monitor Redis: `redis-cli MONITOR` to see PUBLISH commands

---

## Phase 2: Socket.IO Server (Replace Raw WebSocket)

**Goal:** Replace the raw `ws` WebSocketServer with Socket.IO. Add namespaces for mobile and UI clients. Maintain backward compatibility with existing Tauri UI during migration.

**Risk:** Medium — WebSocketBridge is tightly coupled to `ws` library. Tauri UI must be updated to use Socket.IO client.

### Files to Create

#### `maestro-server/src/infrastructure/socketio/SocketIOBridge.ts`

Replaces `WebSocketBridge`. Uses Socket.IO server with namespaces and rooms.

```typescript
import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { IEventBus } from '../../domain/events/IEventBus';
import { ILogger } from '../../domain/common/ILogger';
import { EventName } from '../../domain/events/DomainEvents';

export class SocketIOBridge {
  private io: SocketIOServer;
  private mobileNs: Namespace;   // /mobile — phone clients
  private uiNs: Namespace;       // /ui — desktop Tauri clients
  private logger: ILogger;

  constructor(
    httpServer: http.Server,
    eventBus: IEventBus,
    redisManager: RedisClientManager | null,
    logger: ILogger,
    corsOrigins: string[]
  ) {
    this.logger = logger;

    // Create Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigins,
        credentials: true,
      },
      // Allow both WebSocket and long-polling (fallback for restrictive networks)
      transports: ['websocket', 'polling'],
      // Ping interval/timeout for connection health
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    // Redis adapter for multi-server support (future-proofing)
    if (redisManager) {
      const pubClient = redisManager.getPubClient().duplicate();
      const subClient = redisManager.getSubClient().duplicate();
      this.io.adapter(createAdapter(pubClient, subClient));
    }

    // Create namespaces
    this.mobileNs = this.io.of('/mobile');
    this.uiNs = this.io.of('/ui');

    this.setupMobileNamespace();
    this.setupUINamespace();
    this.subscribeToEvents(eventBus);
  }

  private setupMobileNamespace(): void {
    this.mobileNs.use((socket, next) => {
      // Auth middleware — validate token from handshake
      const { token, projectId } = socket.handshake.auth;
      // TODO: Implement auth validation
      // For now, require projectId
      if (!projectId) {
        return next(new Error('projectId required'));
      }
      socket.data.projectId = projectId;
      next();
    });

    this.mobileNs.on('connection', (socket) => {
      const projectId = socket.data.projectId;

      // Auto-join project room
      socket.join(`project:${projectId}`);

      this.logger.info(`Mobile client connected (project=${projectId})`);

      // Handle mobile-specific events:
      // - subscribe to specific sessions
      // - send mail to agents
      // - respond to needs_input
      // - request session spawn
      // (handlers registered here)

      socket.on('session:subscribe', (sessionIds: string[]) => {
        for (const id of sessionIds) {
          socket.join(`session:${id}`);
        }
      });

      socket.on('disconnect', (reason) => {
        this.logger.info(`Mobile client disconnected: ${reason}`);
      });
    });
  }

  private setupUINamespace(): void {
    // Similar to mobile but with UI-specific features
    this.uiNs.on('connection', (socket) => {
      // Replicate existing WebSocketBridge behavior:
      // - subscribe message with sessionIds
      // - ping/pong
      // - unsubscribe

      socket.on('subscribe', (data: { sessionIds: string[] }) => {
        for (const id of data.sessionIds) {
          socket.join(`session:${id}`);
        }
        socket.emit('subscribed', {
          sessionIds: data.sessionIds,
          timestamp: Date.now()
        });
      });
    });
  }

  private subscribeToEvents(eventBus: IEventBus): void {
    const events: EventName[] = [
      'project:created', 'project:updated', 'project:deleted',
      'task:created', 'task:updated', 'task:deleted',
      'task:session_added', 'task:session_removed',
      'session:created', 'session:spawn', 'session:updated', 'session:deleted',
      'session:task_added', 'session:task_removed',
      'notify:task_completed', 'notify:task_failed', 'notify:task_blocked',
      'notify:task_session_completed', 'notify:task_session_failed',
      'notify:session_completed', 'notify:session_failed',
      'notify:needs_input', 'notify:progress',
      'session:modal', 'session:modal_action', 'session:modal_closed',
      'team_member:created', 'team_member:updated', 'team_member:deleted', 'team_member:archived',
      'mail:received', 'mail:deleted',
    ];

    for (const event of events) {
      eventBus.on(event, (data: any) => {
        const sessionId = this.extractSessionId(event, data);
        const projectId = this.extractProjectId(data);

        const payload = { type: event, event, data, timestamp: Date.now() };

        // Broadcast to project rooms (mobile gets everything for their project)
        if (projectId) {
          this.mobileNs.to(`project:${projectId}`).emit(event, payload);
        }

        // Session-scoped events go to session rooms
        if (sessionId) {
          this.uiNs.to(`session:${sessionId}`).emit(event, payload);
          this.mobileNs.to(`session:${sessionId}`).emit(event, payload);
        }

        // Non-session-scoped events (project, team_member, mail) broadcast to all UI clients
        if (!sessionId) {
          this.uiNs.emit(event, payload);
        }
      });
    }
  }

  // Same logic as current WebSocketBridge.extractSessionId
  private extractSessionId(event: string, data: any): string | undefined { ... }

  // New: extract projectId for room-based routing
  private extractProjectId(data: any): string | undefined {
    return data?.projectId || data?.session?.projectId;
  }

  getClientCount(): number {
    return this.io.engine.clientsCount;
  }

  getMobileClientCount(): number { ... }
  getUIClientCount(): number { ... }
}
```

### Files to Modify

#### `maestro-server/src/server.ts`

Replace WebSocket setup with Socket.IO:

```typescript
// Remove:
import { WebSocketServer } from 'ws';
import { WebSocketBridge } from './infrastructure/websocket/WebSocketBridge';

// Add:
import { SocketIOBridge } from './infrastructure/socketio/SocketIOBridge';

// Replace WebSocket setup block:
// OLD:
//   const wss = new WebSocketServer({ server });
//   wsBridge = new WebSocketBridge(wss, eventBus, logger);
// NEW:
const socketIOBridge = new SocketIOBridge(
  server,
  eventBus,
  container.redisManager,  // null if Redis disabled
  logger,
  [
    'tauri://localhost',
    'http://localhost:1420',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://maestro.yourdomain.com',  // Cloudflare tunnel
  ]
);

// Update /ws-status endpoint to use socketIOBridge
// Update shutdown to call socketIOBridge.close()
```

#### `maestro-server/src/container.ts`

Export `redisManager` from the container so `server.ts` can pass it to `SocketIOBridge`:

```typescript
export interface Container {
  // ... existing fields
  redisManager: RedisClientManager | null;
}
```

### Backward Compatibility Note

The Tauri UI currently uses raw WebSocket (`new WebSocket('ws://localhost:3000')`). Two options:
1. **Recommended:** Update Tauri UI to use `socket.io-client` (add `socket.io-client` to UI dependencies, connect to `/ui` namespace). This is a small change in the UI's WebSocket connection code.
2. **Temporary:** Keep raw `ws` WebSocketServer alongside Socket.IO during migration. Socket.IO can coexist on the same HTTP server.

---

## Phase 3: Agent Liveness via Redis Key Expiry

**Goal:** Detect crashed agents automatically. Each agent creates a presence key with TTL. Server watches for key expiry.

### Files to Create

#### `maestro-server/src/infrastructure/redis/SessionPresenceWatcher.ts`

Watches Redis keyspace events for presence key expiry.

```typescript
export class SessionPresenceWatcher {
  constructor(
    private redisManager: RedisClientManager,
    private sessionService: SessionService,
    private eventBus: IEventBus,
    private logger: ILogger
  )

  async start(): Promise<void>
    // 1. Enable keyspace notifications: CONFIG SET notify-keyspace-events Ex
    // 2. Subscribe to __keyevent@0__:expired
    // 3. On expiry of 'maestro:presence:<sessionId>':
    //    - Check if session is still 'working' or 'idle'
    //    - If yes, mark as 'failed' with reason 'agent_disconnected'
    //    - Emit notify:session_failed event
    //    - Log warning

  async getActiveAgents(): Promise<string[]>
    // KEYS maestro:presence:* → extract session IDs

  async isAlive(sessionId: string): Promise<boolean>
    // EXISTS maestro:presence:<sessionId>

  async stop(): Promise<void>
    // Unsubscribe from keyspace events
```

#### `maestro-cli/src/services/heartbeat.ts`

CLI-side heartbeat that keeps the presence key alive.

```typescript
export class AgentHeartbeat {
  private interval: NodeJS.Timeout | null = null;
  private redis: Redis;

  constructor(redisUrl: string, private sessionId: string)

  async start(): Promise<void>
    // 1. Connect to Redis
    // 2. SET maestro:presence:<sessionId> JSON({pid, host, startedAt}) EX 15
    // 3. setInterval every 10s: EXPIRE maestro:presence:<sessionId> 15
    // 4. Register process.on('exit') to DEL key and clearInterval
    // 5. Register process.on('SIGINT', 'SIGTERM') for cleanup

  async stop(): Promise<void>
    // clearInterval, DEL key, disconnect Redis
```

### Files to Modify

#### `maestro-cli/src/commands/session.ts`

In the `register` command handler, start heartbeat:

```typescript
// After successful session registration:
if (config.redisUrl) {
  const heartbeat = new AgentHeartbeat(config.redisUrl, sessionId);
  await heartbeat.start();
  // Heartbeat auto-cleans up on process exit
}
```

#### `maestro-cli/src/config.ts`

Add Redis URL resolution:

```typescript
get redisUrl(): string | null {
  return process.env.REDIS_URL ||
         process.env.MAESTRO_REDIS_URL ||
         null;  // null = Redis not available for CLI
}
```

#### `maestro-server/src/container.ts`

Wire up SessionPresenceWatcher:

```typescript
// After creating sessionService:
let presenceWatcher: SessionPresenceWatcher | null = null;
if (redisManager) {
  presenceWatcher = new SessionPresenceWatcher(
    redisManager, sessionService, eventBus, logger
  );
}

// In initialize():
if (presenceWatcher) {
  await presenceWatcher.start();
}

// In shutdown():
if (presenceWatcher) {
  await presenceWatcher.stop();
}
```

---

## Phase 4: Redis Streams for Mail (Replace Filesystem Mail)

**Goal:** Replace `FileSystemMailRepository` with Redis Streams. Enable native blocking reads that replace the EventBus-based long-poll in `MailService.waitForMail()`.

### Files to Create

#### `maestro-server/src/infrastructure/redis/RedisMailRepository.ts`

Implements `IMailRepository` using Redis Streams and Hashes.

```typescript
export class RedisMailRepository implements IMailRepository {
  constructor(private redis: Redis, private logger: ILogger, private keyPrefix: string)

  // Storage model:
  // - Hash: maestro:mail:<id> → full mail object
  // - Stream: maestro:mail:inbox:<sessionId> → references to mail IDs
  // - Stream: maestro:mail:broadcast:<projectId> → broadcast mail IDs
  // - Sorted Set: maestro:mail:project:<projectId> → all mail IDs sorted by createdAt

  async create(mail: MailMessage): Promise<MailMessage>
    // 1. HSET maestro:mail:<id> (serialize all fields)
    // 2. If toSessionId: XADD maestro:mail:inbox:<toSessionId> * mailId <id>
    //    If toSessionId is null: XADD maestro:mail:broadcast:<projectId> * mailId <id>
    // 3. ZADD maestro:mail:project:<projectId> <createdAt> <id>

  async findById(id: string): Promise<MailMessage | null>
    // HGETALL maestro:mail:<id>

  async findInbox(sessionId: string, projectId: string, filter?: MailFilter): Promise<MailMessage[]>
    // 1. XRANGE maestro:mail:inbox:<sessionId> - +  (direct messages)
    // 2. XRANGE maestro:mail:broadcast:<projectId> - +  (broadcasts)
    // 3. Merge, fetch full objects from hashes, sort by createdAt
    // 4. Apply filter if provided

  async findSince(sessionId: string, projectId: string, since: number): Promise<MailMessage[]>
    // Similar to findInbox but with XRANGE <since>-0 +

  async delete(id: string): Promise<void>
    // DEL maestro:mail:<id>
    // Note: Stream entries remain but reference deleted hash (handled gracefully)

  async count(sessionId: string, projectId: string): Promise<number>
    // XLEN maestro:mail:inbox:<sessionId> + count from broadcast stream

  async initialize(): Promise<void>
    // No-op for Redis (no directory creation needed)
```

### Files to Modify

#### `maestro-server/src/application/services/MailService.ts`

The `waitForMail()` method can be simplified. With Redis Streams, the repository itself can do a blocking read:

```typescript
// Option A: Keep current approach (EventBus-based wait)
// Works unchanged because RedisEventBus still delivers mail:received events
// This is the RECOMMENDED approach for Phase 4 — minimal change

// Option B: Add blocking read to repository (future optimization)
// Add to IMailRepository: waitForMail(sessionId, projectId, timeout): Promise<MailMessage[]>
// Implementation: XREAD BLOCK <timeout> STREAMS maestro:mail:inbox:<sessionId> $
```

**Recommendation:** Keep `MailService.waitForMail()` unchanged in Phase 4. The `RedisEventBus` already handles the `mail:received` event delivery that makes it work. This minimizes risk.

#### `maestro-server/src/container.ts`

Conditional mail repository wiring:

```typescript
let mailRepo: IMailRepository;
if (redisManager && config.redis.enabled) {
  mailRepo = new RedisMailRepository(redisManager.getClient(), logger, config.redis.keyPrefix);
} else {
  mailRepo = new FileSystemMailRepository(config.dataDir, logger);
}
```

---

## Phase 5: Socket.IO Mobile Client Integration

**Goal:** Enable phone app to connect via Socket.IO, receive real-time updates, and interact with agents.

### Server-Side: Add Mobile Event Handlers

#### Extend `SocketIOBridge.setupMobileNamespace()`:

```typescript
// Phone sends mail to agent
socket.on('mail:send', async (payload, ack) => {
  try {
    const mail = await this.mailService.sendMail({
      projectId: socket.data.projectId,
      fromSessionId: 'mobile-user',  // Special sender ID for phone
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

// Phone responds to "needs input"
socket.on('session:reply-input', async (payload, ack) => {
  try {
    await this.sessionService.update(payload.sessionId, {
      needsInput: { active: false },
    });
    ack({ success: true });
  } catch (err) {
    ack({ success: false, error: err.message });
  }
});

// Phone requests state snapshot (on initial connect or reconnect)
socket.on('state:sync', async (ack) => {
  const projectId = socket.data.projectId;
  const [sessions, tasks] = await Promise.all([
    this.sessionService.findAll({ projectId }),
    this.taskService.findAll({ projectId }),
  ]);
  ack({ sessions, tasks });
});

// Phone spawns agent
socket.on('session:spawn', async (payload, ack) => {
  // Forward to session spawn endpoint logic
  ack({ success: true, sessionId: result.sessionId });
});
```

### Modify `SocketIOBridge` Constructor

Pass services to the bridge so it can handle mobile actions:

```typescript
constructor(
  httpServer: http.Server,
  eventBus: IEventBus,
  redisManager: RedisClientManager | null,
  services: {
    mailService: MailService,
    sessionService: SessionService,
    taskService: TaskService,
  },
  logger: ILogger,
  corsOrigins: string[]
)
```

---

## Phase 6: Distributed Locks for Task Assignment

**Goal:** Prevent race conditions when multiple agents claim the same task.

### Files to Create

#### `maestro-server/src/infrastructure/redis/DistributedLock.ts`

```typescript
export class DistributedLock {
  constructor(private redis: Redis, private keyPrefix: string)

  async acquire(resource: string, owner: string, ttlMs: number = 30000): Promise<boolean>
    // SET maestro:lock:<resource> <owner> NX PX <ttlMs>

  async release(resource: string, owner: string): Promise<boolean>
    // Lua script: if GET key == owner then DEL key

  async isLocked(resource: string): Promise<string | null>
    // GET maestro:lock:<resource> → returns owner or null

  async withLock<T>(resource: string, owner: string, fn: () => Promise<T>, ttlMs?: number): Promise<T>
    // Acquire, run fn, release (with try/finally)
```

### Files to Modify

#### `maestro-server/src/application/services/TaskService.ts`

Add optional lock parameter to `updateTask()`:

```typescript
// In updateTask method, when updating taskSessionStatuses:
if (this.lock && updates.taskSessionStatuses) {
  return this.lock.withLock(`task:${id}`, sessionId, async () => {
    // ... existing update logic
  });
}
```

---

## Phase 7: Cloudflare Tunnel Setup

**Goal:** Expose maestro-server to the internet securely for phone access.

### Configuration Files to Create

#### `~/.cloudflared/config.yml`

```yaml
tunnel: maestro
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: maestro.yourdomain.com
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
      keepAliveTimeout: 90s
      # WebSocket/Socket.IO support
      noTLSVerify: false
  - service: http_status:404
```

#### Add DNS route

```bash
cloudflared tunnel route dns maestro maestro.yourdomain.com
```

#### Run as service (macOS)

```bash
# Run in foreground (dev)
cloudflared tunnel run maestro

# Install as system service (production)
sudo cloudflared service install
```

### Files to Modify

#### `maestro-server/src/infrastructure/config/Config.ts`

Add tunnel/external URL config:

```typescript
// In ConfigOptions:
externalUrl?: string;  // The public URL (Cloudflare tunnel domain)

// In loadFromEnvironment():
externalUrl: process.env.EXTERNAL_URL || process.env.CLOUDFLARE_TUNNEL_URL,
```

#### `maestro-server/src/server.ts`

Add Cloudflare tunnel domain to CORS allowlist. Already handled if `CORS_ORIGINS` env var is used, but add explicit support:

```typescript
const allowedOrigins = [
  'tauri://localhost',
  'http://localhost:1420',
  'http://localhost:3000',
  'http://localhost:5173',
  ...(config.externalUrl ? [config.externalUrl] : []),
  ...(config.cors.origins || []),
];
```

---

## Complete File Inventory

### New Files (10 files)

| File | Phase | Description |
|---|---|---|
| `maestro-server/src/infrastructure/redis/RedisClient.ts` | 1 | Redis connection manager |
| `maestro-server/src/infrastructure/redis/RedisEventBus.ts` | 1 | IEventBus via Redis Pub/Sub |
| `maestro-server/src/infrastructure/redis/index.ts` | 1 | Barrel export |
| `maestro-server/src/infrastructure/socketio/SocketIOBridge.ts` | 2 | Socket.IO server with namespaces |
| `maestro-server/src/infrastructure/socketio/index.ts` | 2 | Barrel export |
| `maestro-server/src/infrastructure/redis/SessionPresenceWatcher.ts` | 3 | Agent liveness detection |
| `maestro-cli/src/services/heartbeat.ts` | 3 | CLI-side presence heartbeat |
| `maestro-server/src/infrastructure/redis/RedisMailRepository.ts` | 4 | IMailRepository via Redis Streams |
| `maestro-server/src/infrastructure/redis/DistributedLock.ts` | 6 | Distributed lock primitive |
| `~/.cloudflared/config.yml` | 7 | Cloudflare tunnel config |

### Modified Files (8 files)

| File | Phase | Changes |
|---|---|---|
| `maestro-server/src/infrastructure/config/Config.ts` | 1,7 | Add `RedisConfig`, `externalUrl` |
| `maestro-server/src/container.ts` | 1,3,4 | Wire Redis client, event bus, mail repo, presence watcher |
| `maestro-server/src/server.ts` | 2,7 | Replace ws with Socket.IO, update CORS |
| `maestro-server/package.json` | 1,2 | Add `ioredis`, `socket.io`, `@socket.io/redis-adapter` |
| `maestro-cli/src/commands/session.ts` | 3 | Start heartbeat on register |
| `maestro-cli/src/config.ts` | 3 | Add `redisUrl` config |
| `maestro-cli/package.json` | 3 | Add `ioredis` |
| `maestro-server/src/application/services/TaskService.ts` | 6 | Add distributed lock on assignment |

### Unchanged Files (everything else)

All service layer code (`MailService`, `SessionService`, `ProjectService`, `TeamMemberService`), all route handlers, all domain interfaces, all CLI commands — remain untouched. The architecture's DDD/clean architecture interfaces (`IEventBus`, `IMailRepository`) make this possible.

---

## Implementation Order & Dependencies

```
Phase 0: Prerequisites (Redis, Cloudflare, npm deps)
   │
   ▼
Phase 1: RedisEventBus ←── Foundation. Everything depends on this.
   │
   ├──▶ Phase 2: Socket.IO (depends on Phase 1 for event delivery)
   │       │
   │       └──▶ Phase 5: Mobile client handlers (depends on Phase 2)
   │               │
   │               └──▶ Phase 7: Cloudflare Tunnel (depends on Phase 5)
   │
   ├──▶ Phase 3: Agent Liveness (depends on Phase 1 for Redis connection)
   │
   ├──▶ Phase 4: Redis Mail (depends on Phase 1 for Redis connection)
   │
   └──▶ Phase 6: Distributed Locks (depends on Phase 1 for Redis connection)
```

Phases 3, 4, and 6 are independent of each other and can be done in parallel.
Phase 5 requires Phase 2.
Phase 7 requires Phase 5 (but can be set up earlier for testing).

---

## Rollback Strategy

Every phase has a feature flag:
- **Phase 1:** `REDIS_ENABLED=false` → falls back to `InMemoryEventBus`
- **Phase 2:** Keep `WebSocketBridge` alongside `SocketIOBridge` during migration. Remove when UI is migrated.
- **Phase 3:** Don't start heartbeat if `REDIS_URL` not set in CLI env
- **Phase 4:** `REDIS_ENABLED=false` → falls back to `FileSystemMailRepository`
- **Phase 6:** Lock is injected as optional dependency. If null, no locking (current behavior).
- **Phase 7:** Cloudflare Tunnel is external infrastructure. Remove config to disable.

No phase requires a database migration or destructive change. All phases are additive.

---

## Redis Memory Estimation

| Data Type | Count Estimate | Size Per Item | Total |
|---|---|---|---|
| Presence keys | ~10 active agents | ~200 bytes | ~2 KB |
| Event bus channels | ~30 channels | ~100 bytes/msg (transient) | ~3 KB |
| Mail streams | ~100 messages | ~500 bytes | ~50 KB |
| Mail hashes | ~100 messages | ~500 bytes | ~50 KB |
| Lock keys | ~5 concurrent | ~100 bytes | ~500 bytes |
| **Total** | | | **~105 KB** |

Redis memory usage will be negligible. The free tier of any Redis hosting (or local install) is more than sufficient.
