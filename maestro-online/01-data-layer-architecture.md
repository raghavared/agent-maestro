# Maestro Online: Data Layer & Redis Architecture

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Supabase/PostgreSQL Schema Design](#2-supabasepostgresql-schema-design)
3. [Redis Architecture](#3-redis-architecture)
4. [Data Flow: Supabase vs Redis](#4-data-flow-supabase-vs-redis)
5. [Device Registration Model](#5-device-registration-model)
6. [Interface Mapping: Domain to Infrastructure](#6-interface-mapping-domain-to-infrastructure)
7. [Migration Strategy](#7-migration-strategy)
8. [Key Implementation Details](#8-key-implementation-details)

---

## 1. Architecture Overview

### Hybrid Data Layer

Maestro Online uses a **three-tier data architecture** where each technology handles what it does best:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           maestro-server                                │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │   Express   │  │  Socket.IO   │  │         Redis (ioredis)        │ │
│  │   REST API  │  │  Server      │  │                                │ │
│  │   /api/*    │  │  /mobile ns  │  │  - Pub/Sub   → domain events   │ │
│  │             │  │  /ui ns      │  │  - Key TTL   → agent presence  │ │
│  │  (agents +  │  │              │  │  - SET NX PX → distrib. locks  │ │
│  │   web app)  │  │  (phones +   │  │  - Hashes    → session cache   │ │
│  │             │  │   desktop)   │  │  - Streams   → terminal output │ │
│  └─────────────┘  └──────────────┘  └────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Client (service role)                 │   │
│  │                                                                   │   │
│  │  PostgreSQL: projects, tasks, sessions, mail, team_members,       │   │
│  │              orderings, profiles, devices, project_members        │   │
│  │  Auth:       JWT tokens, multi-provider, RLS integration          │   │
│  │  Storage:    docs, session recordings                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                          Cloudflare Tunnel
                        (maestro.yourdomain.com)
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
         ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼────────┐
         │  Phone/Web  │ │  Tauri      │ │  Agent CLI     │
         │  Socket.IO  │ │  Desktop    │ │  REST + Redis  │
         │  /mobile ns │ │  /ui ns     │ │  (heartbeat)   │
         └─────────────┘ └─────────────┘ └────────────────┘
```

### Responsibility Matrix

| Concern | Technology | Rationale |
|---|---|---|
| Projects, tasks, sessions, mail | **Supabase (PostgreSQL)** | Relational, durable, multi-user, queryable with RLS |
| Team members, orderings | **Supabase (PostgreSQL)** | Durable, project-scoped, needs FK constraints |
| User profiles & auth | **Supabase Auth** | JWT, multi-provider, auto-RLS integration |
| Domain event pub/sub | **Redis Pub/Sub** | Sub-ms latency, ephemeral, cross-process delivery |
| Agent presence/liveness | **Redis key expiry** | TTL-based auto-cleanup, purpose-built |
| Distributed locks | **Redis SET NX PX** | Atomic, fast, battle-tested |
| Session status cache | **Redis Hashes** | Fast reads for hot data, write-through to Supabase |
| Terminal output streaming | **Redis Streams** | Ordered, appendable, consumable by multiple clients |
| Real-time push to clients | **Socket.IO** | Rooms, namespaces, auto-reconnect |
| File/doc storage | **Supabase Storage** | S3-compatible, CDN, access-controlled |

---

## 2. Supabase/PostgreSQL Schema Design

### 2.1 Profiles (extends Supabase Auth)

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 2.2 Projects

Maps to existing `IProjectRepository` interface.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,              -- format: proj_{timestamp}_{random}
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  working_dir TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL,       -- epoch ms (matches existing createdAt: number)
  updated_at BIGINT NOT NULL        -- epoch ms (matches existing updatedAt: number)
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
```

**Design note:** We use `BIGINT` for timestamps (not `TIMESTAMPTZ`) to match the existing domain model where `createdAt`/`updatedAt` are epoch milliseconds (`number`). This avoids conversion logic in every repository method.

### 2.3 Project Members (multi-user access)

```sql
CREATE TABLE project_members (
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### 2.4 Tasks

Maps to existing `ITaskRepository` interface with `TaskFilter`.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,                         -- task_{timestamp}_{random}
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed', 'cancelled', 'blocked', 'archived')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  initial_prompt TEXT DEFAULT '',
  session_ids TEXT[] DEFAULT '{}',
  skill_ids TEXT[] DEFAULT '{}',
  agent_ids TEXT[] DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  reference_task_ids TEXT[] DEFAULT '{}',
  task_session_statuses JSONB DEFAULT '{}',    -- Record<sessionId, TaskSessionStatus>
  pinned BOOLEAN DEFAULT FALSE,
  team_member_id TEXT,
  team_member_ids TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  started_at BIGINT,                           -- null until work begins
  completed_at BIGINT                          -- null until completed/cancelled
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_session ON tasks USING GIN(session_ids);
```

**Key decisions:**
- `session_ids` as `TEXT[]` with GIN index enables the `findBySessionId` query: `WHERE session_ids @> ARRAY[sessionId]`
- `task_session_statuses` as `JSONB` stores the per-session status map natively
- `parent_id` self-references for task hierarchy

### 2.5 Sessions

Maps to existing `ISessionRepository` interface with `SessionFilter`.

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                         -- sess_{timestamp}_{random}
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_ids TEXT[] DEFAULT '{}',
  name TEXT DEFAULT '',
  agent_id TEXT,
  status TEXT DEFAULT 'spawning'
    CHECK (status IN ('spawning', 'idle', 'working', 'completed', 'failed', 'stopped')),
  env JSONB DEFAULT '{}',
  hostname TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  events JSONB DEFAULT '[]',                   -- SessionEvent[]
  timeline JSONB DEFAULT '[]',                 -- SessionTimelineEvent[]
  docs JSONB DEFAULT '[]',                     -- DocEntry[]
  needs_input JSONB DEFAULT '{"active": false}',
  metadata JSONB DEFAULT '{}',
  team_member_id TEXT,
  team_member_snapshot JSONB,                  -- TeamMemberSnapshot
  team_member_ids TEXT[] DEFAULT '{}',
  team_member_snapshots JSONB DEFAULT '[]',    -- TeamMemberSnapshot[]
  started_at BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  completed_at BIGINT
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(project_id, status);
CREATE INDEX idx_sessions_task ON sessions USING GIN(task_ids);
```

**Key decisions:**
- `events`, `timeline`, `docs` stored as JSONB arrays. These grow unbounded per session but are typically small (<1000 entries). JSONB is queryable if needed.
- `needs_input` as JSONB preserves the existing `{active, message?, since?}` structure.
- `team_member_snapshot` captures the team member state at session creation time (denormalized for historical accuracy).

### 2.6 Mail

Maps to existing `IMailRepository` interface with `MailFilter`.

```sql
CREATE TABLE mail (
  id TEXT PRIMARY KEY,                         -- mail_{timestamp}_{random}
  project_id TEXT NOT NULL,
  from_session_id TEXT NOT NULL,
  to_session_id TEXT,                          -- null = broadcast
  reply_to_mail_id TEXT,
  type TEXT DEFAULT 'directive'
    CHECK (type IN ('assignment', 'status_update', 'query', 'response', 'directive', 'notification')),
  subject TEXT DEFAULT '',
  body JSONB DEFAULT '{}',                     -- Record<string, any>
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_mail_inbox ON mail(to_session_id, created_at DESC);
CREATE INDEX idx_mail_project ON mail(project_id, created_at DESC);
CREATE INDEX idx_mail_broadcast ON mail(project_id)
  WHERE to_session_id IS NULL;
```

**Key decisions:**
- `body` is `JSONB` (not `TEXT`) because the existing `MailMessage.body` is `Record<string, any>`
- Partial index on broadcasts (`WHERE to_session_id IS NULL`) optimizes the common `findInbox` query that unions direct + broadcast mail
- `created_at` as `BIGINT` (epoch ms) matches existing domain model

### 2.7 Team Members

Maps to existing `ITeamMemberRepository` interface. Includes the default-member-with-override system.

```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,                         -- tm_{projectId}_{type} for defaults, custom IDs for custom
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  identity TEXT DEFAULT '',                    -- system prompt / identity description
  avatar TEXT DEFAULT '',
  model TEXT,
  agent_tool TEXT DEFAULT 'claude-code'
    CHECK (agent_tool IN ('claude-code', 'codex', 'gemini')),
  mode TEXT DEFAULT 'execute'
    CHECK (mode IN ('execute', 'coordinate')),
  skill_ids TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  capabilities JSONB DEFAULT '{}',
  command_permissions JSONB DEFAULT '{}',
  workflow_template_id TEXT,
  custom_workflow TEXT,
  created_at TEXT NOT NULL,                    -- ISO 8601 string (matches existing)
  updated_at TEXT NOT NULL                     -- ISO 8601 string (matches existing)
);

CREATE INDEX idx_team_members_project ON team_members(project_id);
CREATE INDEX idx_team_members_default ON team_members(project_id, is_default);
```

**Default member handling:**
- The 5 default team members (Simple Worker, Coordinator, Batch Coordinator, DAG Coordinator, Recruiter) are seeded per-project on first access.
- `is_default = TRUE` prevents deletion via the API.
- Override logic: `SupabaseTeamMemberRepository.saveDefaultOverride()` does an `UPSERT` on the default row. `resetDefault()` restores hardcoded values.
- IDs follow the deterministic pattern `tm_{projectId}_{type}` (e.g. `tm_proj_123_simple-worker`).

### 2.8 Orderings

Maps to existing `IOrderingRepository` interface.

```sql
CREATE TABLE orderings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'session')),
  ordered_ids TEXT[] DEFAULT '{}',
  updated_at BIGINT NOT NULL,
  UNIQUE (project_id, entity_type)
);

CREATE INDEX idx_orderings_project ON orderings(project_id, entity_type);
```

### 2.9 Devices

New table for mobile/web device registration.

```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT '',                        -- "Subhang's iPhone", "Chrome on Mac"
  type TEXT NOT NULL
    CHECK (type IN ('mobile', 'desktop', 'web', 'cli')),
  platform TEXT DEFAULT '',                    -- "ios", "android", "macos", "linux", "windows", "web"
  push_token TEXT,                             -- FCM/APNS token for push notifications
  socket_id TEXT,                              -- current Socket.IO socket ID (null if disconnected)
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'                  -- device info, OS version, app version
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_push ON devices(push_token) WHERE push_token IS NOT NULL;
```

---

### 2.10 Row Level Security (RLS) Policies

```sql
-- Helper: check project membership
CREATE OR REPLACE FUNCTION is_project_member(p_project_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own and member projects" ON projects
  FOR SELECT USING (
    owner_id = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Users create own projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners delete projects" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- Tasks (project-scoped)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage tasks" ON tasks
  FOR ALL USING (is_project_member(project_id));

-- Sessions (project-scoped)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage sessions" ON sessions
  FOR ALL USING (is_project_member(project_id));

-- Mail (project-scoped)
ALTER TABLE mail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage mail" ON mail
  FOR ALL USING (is_project_member(project_id));

-- Team Members (project-scoped)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage team members" ON team_members
  FOR ALL USING (is_project_member(project_id));

-- Orderings (project-scoped)
ALTER TABLE orderings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage orderings" ON orderings
  FOR ALL USING (is_project_member(project_id));

-- Project Members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see memberships" ON project_members
  FOR SELECT USING (is_project_member(project_id));
CREATE POLICY "Owners manage memberships" ON project_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- Profiles (self-only)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Devices (self-only)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices" ON devices
  FOR ALL USING (user_id = auth.uid());
```

**Service role bypass:** The Express server uses the Supabase `service_role` key for all internal operations (session creation by agents, task updates, mail delivery). RLS is enforced only when using user JWTs (mobile/web direct access or user-scoped API middleware).

---

## 3. Redis Architecture

### 3.1 Key Namespace Design

All Redis keys use a configurable prefix (default `maestro:`) with logical grouping:

```
maestro:                              ← configurable via REDIS_KEY_PREFIX
├── events:{eventName}                ← Pub/Sub channels for domain events
│   ├── events:task:created
│   ├── events:session:updated
│   ├── events:mail:received
│   └── ... (30+ event types)
│
├── presence:{sessionId}              ← Agent liveness TTL keys
│   ├── presence:sess_123_abc         → { pid, hostname, startedAt }  TTL=15s
│   └── presence:sess_456_def         → { pid, hostname, startedAt }  TTL=15s
│
├── lock:{resource}                   ← Distributed locks
│   ├── lock:task:task_123            → owner_session_id              TTL=30s
│   └── lock:session:sess_456        → owner_string                  TTL=30s
│
├── cache:session:{sessionId}         ← Session status cache (write-through)
│   ├── cache:session:sess_123        → { status, lastActivity, needsInput }
│   └── cache:session:sess_456        → { status, lastActivity, needsInput }
│
└── terminal:{sessionId}              ← Terminal output streams
    ├── terminal:sess_123             → Redis Stream (append-only log)
    └── terminal:sess_456             → Redis Stream (append-only log)
```

### 3.2 RedisClientManager (Singleton Connection Manager)

Three dedicated connections per Redis requirement (subscriber connections cannot execute commands):

```typescript
// maestro-server/src/infrastructure/redis/RedisClientManager.ts

import Redis from 'ioredis';
import { ILogger } from '../../domain/common/ILogger';

export class RedisClientManager {
  private commandClient: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private connected = false;

  constructor(
    private redisUrl: string,
    private logger: ILogger,
    private keyPrefix: string = 'maestro:'
  ) {}

  async connect(): Promise<void> {
    const options = {
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    this.commandClient = new Redis(this.redisUrl, options);
    this.pubClient = new Redis(this.redisUrl, options);
    this.subClient = new Redis(this.redisUrl, options);

    await Promise.all([
      this.commandClient.connect(),
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);

    // Enable keyspace notifications for presence expiry detection
    await this.commandClient.config('SET', 'notify-keyspace-events', 'Ex');

    this.connected = true;
    this.logger.info('Redis connected (3 clients: command, pub, sub)');
  }

  getClient(): Redis { return this.commandClient; }
  getPubClient(): Redis { return this.pubClient; }
  getSubClient(): Redis { return this.subClient; }
  getKeyPrefix(): string { return this.keyPrefix; }
  isConnected(): boolean { return this.connected; }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.commandClient.ping();
      return result === 'PONG';
    } catch { return false; }
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.commandClient.quit(),
      this.pubClient.quit(),
      this.subClient.quit(),
    ]);
    this.connected = false;
    this.logger.info('Redis disconnected');
  }
}
```

### 3.3 RedisEventBus (IEventBus Implementation)

**Critical design: dual delivery.** When `emit()` is called, the event is delivered to both local in-process handlers AND published to Redis. A `sourceId` prevents duplicate delivery when the Redis subscriber receives its own published message.

```
 emit("task:updated", data)
       │
       ├──► Local delivery: iterate handlers Map, call each handler
       │    (immediate, synchronous-like, for MailService.waitForMail)
       │
       └──► PUBLISH maestro:events:task:updated { sourceId, data }
                │
                ▼
         Redis Pub/Sub
                │
       ┌────────┴────────┐
       ▼                 ▼
  This process        Other processes
  (SKIP: same         (DELIVER: different
   sourceId)           sourceId)
```

```typescript
// maestro-server/src/infrastructure/redis/RedisEventBus.ts

import Redis from 'ioredis';
import { IEventBus, EventHandler } from '../../domain/events/IEventBus';
import { ILogger } from '../../domain/common/ILogger';
import { v4 as uuidv4 } from 'uuid';

export class RedisEventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private sourceId = uuidv4();  // unique per process instance
  private channelPrefix: string;

  constructor(
    private redisManager: RedisClientManager,
    private logger: ILogger
  ) {
    this.channelPrefix = `${redisManager.getKeyPrefix()}events:`;
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    const sub = this.redisManager.getSubClient();

    sub.on('message', (channel: string, rawMessage: string) => {
      const eventName = channel.slice(this.channelPrefix.length);
      const envelope = JSON.parse(rawMessage);

      // Skip messages from this process (already delivered locally)
      if (envelope.sourceId === this.sourceId) return;

      // Deliver to local handlers
      const eventHandlers = this.handlers.get(eventName);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          try { handler(envelope.data); }
          catch (err) { this.logger.error(`Event handler error: ${eventName}`, err as Error); }
        }
      }
    });
  }

  async emit<T>(event: string, data: T): Promise<void> {
    // 1. Local delivery (synchronous, for in-process consumers)
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      const promises = Array.from(eventHandlers).map(handler => {
        try { return Promise.resolve(handler(data)); }
        catch (err) {
          this.logger.error(`Event handler error: ${event}`, err as Error);
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    }

    // 2. Redis publish (for cross-process consumers)
    const channel = `${this.channelPrefix}${event}`;
    const envelope = JSON.stringify({ sourceId: this.sourceId, data });
    await this.redisManager.getPubClient().publish(channel, envelope);

    this.logger.debug(`Event emitted: ${event}`);
  }

  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
      // Subscribe to Redis channel on first handler
      this.redisManager.getSubClient().subscribe(
        `${this.channelPrefix}${event}`
      );
    }
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  off(event: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
        this.redisManager.getSubClient().unsubscribe(
          `${this.channelPrefix}${event}`
        );
      }
    }
  }

  once<T>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = (data) => {
      this.off(event, wrapper as EventHandler);
      handler(data);
    };
    this.on(event, wrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.redisManager.getSubClient().unsubscribe(
        `${this.channelPrefix}${event}`
      );
    } else {
      for (const evt of this.handlers.keys()) {
        this.redisManager.getSubClient().unsubscribe(
          `${this.channelPrefix}${evt}`
        );
      }
      this.handlers.clear();
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size || 0;
  }
}
```

### 3.4 Agent Presence/Liveness

**Flow:**

```
Agent CLI (maestro-cli)                    Server (maestro-server)
─────────────────────                      ──────────────────────
 Session registered                         SessionPresenceWatcher started
       │                                          │
       ▼                                          │
 SET maestro:presence:sess_123               Subscribed to
   { pid, host, startedAt }                  __keyevent@0__:expired
   EX 15                                          │
       │                                          │
       ├──── every 10s ────►                      │
       │  EXPIRE maestro:presence:sess_123 15     │
       │                                          │
       │                                          │
  [Agent crashes / disconnects]                   │
       │                                          │
       ✗  No more EXPIRE commands                 │
       │                                          │
       └──── after 15s TTL ────────────────►      │
                                            Key expired!
                                            "maestro:presence:sess_123"
                                                  │
                                                  ▼
                                            Session status → 'failed'
                                            Emit notify:session_failed
```

**Redis keys:**
```
maestro:presence:{sessionId} → JSON({ pid: number, hostname: string, startedAt: number })
TTL: 15 seconds
Heartbeat interval: 10 seconds (provides 5s buffer)
```

```typescript
// maestro-server/src/infrastructure/redis/SessionPresenceWatcher.ts

export class SessionPresenceWatcher {
  constructor(
    private redisManager: RedisClientManager,
    private sessionService: SessionService,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  async start(): Promise<void> {
    const sub = this.redisManager.getSubClient();
    const prefix = this.redisManager.getKeyPrefix();

    // Subscribe to key expiry events
    await sub.subscribe('__keyevent@0__:expired');

    sub.on('message', async (_channel: string, expiredKey: string) => {
      const presencePrefix = `${prefix}presence:`;
      if (!expiredKey.startsWith(presencePrefix)) return;

      const sessionId = expiredKey.slice(presencePrefix.length);
      this.logger.warn(`Presence expired for session: ${sessionId}`);

      try {
        const session = await this.sessionService.findById(sessionId);
        if (session && (session.status === 'working' || session.status === 'idle')) {
          await this.sessionService.update(sessionId, { status: 'failed' });
          await this.eventBus.emit('notify:session_failed', {
            sessionId,
            name: session.name,
          });
          this.logger.warn(`Session ${sessionId} marked as failed (agent disconnected)`);
        }
      } catch (err) {
        this.logger.error(`Failed to handle presence expiry for ${sessionId}`, err as Error);
      }
    });
  }

  async isAlive(sessionId: string): Promise<boolean> {
    const key = `${this.redisManager.getKeyPrefix()}presence:${sessionId}`;
    return (await this.redisManager.getClient().exists(key)) === 1;
  }

  async stop(): Promise<void> {
    await this.redisManager.getSubClient().unsubscribe('__keyevent@0__:expired');
  }
}
```

### 3.5 Distributed Locks

Used for task assignment protection when multiple agents claim the same task.

```typescript
// maestro-server/src/infrastructure/redis/DistributedLock.ts

export class DistributedLock {
  // Lua script for atomic release (only release if you own the lock)
  private static RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(
    private redis: Redis,
    private keyPrefix: string
  ) {}

  async acquire(resource: string, owner: string, ttlMs: number = 30000): Promise<boolean> {
    const key = `${this.keyPrefix}lock:${resource}`;
    const result = await this.redis.set(key, owner, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async release(resource: string, owner: string): Promise<boolean> {
    const key = `${this.keyPrefix}lock:${resource}`;
    const result = await this.redis.eval(
      DistributedLock.RELEASE_SCRIPT, 1, key, owner
    );
    return result === 1;
  }

  async withLock<T>(
    resource: string,
    owner: string,
    fn: () => Promise<T>,
    ttlMs: number = 30000
  ): Promise<T> {
    const acquired = await this.acquire(resource, owner, ttlMs);
    if (!acquired) throw new Error(`Failed to acquire lock: ${resource}`);
    try {
      return await fn();
    } finally {
      await this.release(resource, owner);
    }
  }
}
```

### 3.6 Session Status Cache

Write-through cache for fast reads of hot session data (status, lastActivity, needsInput). Every `SessionService.update()` writes to both Supabase and Redis.

```
maestro:cache:session:{sessionId} → Hash {
  status: "working",
  lastActivity: "1708123456789",
  needsInput: '{"active":false}',
  projectId: "proj_123_abc"
}
TTL: 1 hour (auto-refresh on activity, stale data reclaimed)
```

**Read path:**
```
Client request → Redis cache → HIT? return cached → MISS? read Supabase, cache result
```

**Write path:**
```
Service update → write Supabase → write Redis cache (fire-and-forget)
```

### 3.7 Terminal Output Streaming

Redis Streams provide ordered, appendable, multi-consumer terminal output buffering.

```
maestro:terminal:{sessionId} → Stream
  Entries:
    1708123456789-0 { type: "stdout", data: "Building project...", ts: "..." }
    1708123456789-1 { type: "stdout", data: "Tests passed", ts: "..." }
    1708123456790-0 { type: "stderr", data: "Warning: ...", ts: "..." }
```

**Producer (agent CLI):**
```
XADD maestro:terminal:sess_123 MAXLEN ~1000 * type stdout data "..."
```

**Consumer (Socket.IO bridge → mobile/desktop):**
```
XREAD BLOCK 5000 STREAMS maestro:terminal:sess_123 $last_id
```

- `MAXLEN ~1000` caps at ~1000 entries per session (auto-trims old output)
- `XREAD BLOCK` enables efficient long-polling for new output
- Multiple consumers (mobile + desktop) read independently using consumer groups

---

## 4. Data Flow: Supabase vs Redis

### 4.1 What Goes Where and Why

```
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                          │
│                  Persistent, Durable, Queryable                   │
│                                                                   │
│  WRITE PATH:                                                      │
│  Agent CLI → REST API → Service Layer → SupabaseRepo → PostgreSQL │
│                                                                   │
│  READ PATH:                                                       │
│  Client → REST API → Service Layer → SupabaseRepo → PostgreSQL    │
│                                                                   │
│  Stored:                                                          │
│  - Projects (full lifecycle)                                      │
│  - Tasks (full lifecycle, history, hierarchy)                     │
│  - Sessions (full lifecycle, timeline, docs)                      │
│  - Mail (full message history)                                    │
│  - Team Members (config, defaults, overrides)                     │
│  - Orderings (UI display order)                                   │
│  - Profiles (user settings)                                       │
│  - Devices (registration, push tokens)                            │
│  - Project Members (access control)                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         REDIS                                     │
│                  Ephemeral, Real-time, Fast                        │
│                                                                   │
│  DATA FLOW:                                                       │
│  Service emit → RedisEventBus → Pub/Sub → SocketIOBridge → Client │
│  Agent CLI → SET presence key → TTL expiry → Server detects crash  │
│  Service update → write-through cache → fast reads for hot data    │
│  Agent CLI → XADD terminal stream → XREAD → Socket.IO → Client    │
│                                                                   │
│  Stored (ephemeral):                                              │
│  - Domain events (transient, not persisted)                       │
│  - Agent presence keys (TTL 15s, auto-expiring)                   │
│  - Distributed locks (TTL 30s, auto-expiring)                     │
│  - Session status cache (TTL 1h, write-through)                   │
│  - Terminal output streams (capped at ~1000 entries per session)   │
│                                                                   │
│  NOT stored in Redis:                                             │
│  - Mail (persistent data → Supabase)                              │
│  - Task history (persistent → Supabase)                           │
│  - User data (persistent → Supabase)                              │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Complete Request Flow: Task Update Example

```
1. Agent CLI calls: PATCH /api/tasks/:id { status: "completed" }

2. Express route → TaskService.update(id, { status: "completed" })
       │
       ├─► SupabaseTaskRepository.update()
       │     → UPDATE tasks SET status='completed', updated_at=... WHERE id=...
       │     → Returns updated Task
       │
       ├─► EventBus.emit('task:updated', task)
       │     │
       │     ├─► LOCAL: SocketIOBridge handler
       │     │     → io.to(`session:${sid}`).emit('task:updated', payload)
       │     │     → io.to(`project:${pid}`).emit('task:updated', payload)
       │     │
       │     ├─► LOCAL: Any other in-process subscribers
       │     │
       │     └─► REDIS PUBLISH: maestro:events:task:updated
       │           → Other server instances receive and fan out
       │
       └─► Return updated task to REST response

3. Socket.IO delivers to connected clients:
   - Mobile app receives 'task:updated' event
   - Desktop Tauri app receives 'task:updated' event
   - Both update their UI state
```

### 4.3 Mail Send + Wait Flow

```
Agent A sends mail:                        Agent B waits for mail:
─────────────────                          ──────────────────────
POST /api/mail/send                        GET /api/mail/wait?timeout=30000
  { to: "sess_B", ... }                     │
       │                                     │  MailService.waitForMail()
       ▼                                     │    subscribes to 'mail:received'
  MailService.send()                         │    via EventBus.once()
       │                                     │
       ├─► SupabaseMailRepo.create()         │    [waiting...]
       │     INSERT INTO mail ...            │
       │                                     │
       ├─► EventBus.emit('mail:received')    │
       │     │                               │
       │     ├─► LOCAL delivery ─────────────┤
       │     │   (triggers waitForMail        │
       │     │    Promise resolution)         ▼
       │     │                          Mail received!
       │     └─► REDIS PUBLISH              Returns to agent B
       │         (for other processes)
       │
       └─► Return 201 Created
```

**Why this works:** The `emit()` method does LOCAL delivery first (synchronous), which immediately resolves the `waitForMail()` Promise. The Redis PUBLISH is for cross-process scenarios only.

---

## 5. Device Registration Model

### 5.1 Device Registration Flow

```
Phone opens app
       │
       ▼
  Supabase Auth login
  (email/password or OAuth)
       │
       ▼
  JWT access token obtained
       │
       ▼
  Socket.IO connect to /mobile namespace
  { auth: { token: jwt, projectId: "proj_123" } }
       │
       ▼
  Server validates JWT
       │
       ├─► Register/update device record in Supabase
       │     INSERT INTO devices (user_id, type, platform, socket_id, ...)
       │     ON CONFLICT (id) DO UPDATE SET socket_id = ..., last_seen_at = NOW()
       │
       ├─► Join Socket.IO rooms:
       │     socket.join(`project:${projectId}`)
       │     socket.join(`user:${userId}`)
       │
       └─► Emit initial state snapshot
            { sessions, tasks, teamMembers }
```

### 5.2 Device Table Schema

See Section 2.9 above. Key fields:

| Field | Purpose |
|---|---|
| `id` | Unique device identifier (persisted across sessions) |
| `user_id` | Owner (FK to auth.users) |
| `type` | mobile, desktop, web, cli |
| `platform` | ios, android, macos, linux, windows, web |
| `push_token` | FCM/APNS token for background push notifications |
| `socket_id` | Current Socket.IO connection (null when disconnected) |
| `last_seen_at` | Last activity timestamp for stale device cleanup |
| `metadata` | OS version, app version, screen size, etc. |

### 5.3 Session-Device Associations

Devices don't directly own sessions. Instead:

```
User ──owns──► Device (phone, desktop, CLI)
User ──member of──► Project
Project ──contains──► Sessions

Device connects to Socket.IO → joins project room → receives all session events
Device can subscribe to specific sessions → joins session rooms
```

The `devices` table tracks which devices are connected and what projects they're watching. This enables:
- Push notifications to offline devices
- "Last seen" tracking per device
- Device management (revoke access, list active devices)

---

## 6. Interface Mapping: Domain to Infrastructure

### 6.1 Repository Interface → Implementation Mapping

| Domain Interface | FileSystem (current) | Supabase (new) |
|---|---|---|
| `IProjectRepository` | `FileSystemProjectRepository` | `SupabaseProjectRepository` |
| `ITaskRepository` | `FileSystemTaskRepository` | `SupabaseTaskRepository` |
| `ISessionRepository` | `FileSystemSessionRepository` | `SupabaseSessionRepository` |
| `IMailRepository` | `FileSystemMailRepository` | `SupabaseMailRepository` |
| `ITeamMemberRepository` | `FileSystemTeamMemberRepository` | `SupabaseTeamMemberRepository` |
| `IOrderingRepository` | `FileSystemOrderingRepository` | `SupabaseOrderingRepository` |

### 6.2 Event Bus Interface → Implementation Mapping

| Domain Interface | In-Memory (current) | Redis (new) |
|---|---|---|
| `IEventBus` | `InMemoryEventBus` (EventEmitter) | `RedisEventBus` (Pub/Sub + local) |

### 6.3 New Infrastructure (no existing interface)

| Component | File | Purpose |
|---|---|---|
| `RedisClientManager` | `redis/RedisClientManager.ts` | Singleton connection manager (3 clients) |
| `SessionPresenceWatcher` | `redis/SessionPresenceWatcher.ts` | Agent crash detection via key expiry |
| `DistributedLock` | `redis/DistributedLock.ts` | Task assignment race condition protection |
| `SocketIOBridge` | `socketio/SocketIOBridge.ts` | Replaces WebSocketBridge with namespaces/rooms |
| `SupabaseClientManager` | `supabase/SupabaseClientManager.ts` | Supabase connection manager |

### 6.4 container.ts Conditional Wiring

```typescript
// Simplified container wiring logic

export async function createContainer(): Promise<Container> {
  const config = new Config();
  const logger = new ConsoleLogger(config.log.level);
  const idGenerator = new TimestampIdGenerator();

  // ── Supabase (persistent data) ──
  let projectRepo: IProjectRepository;
  let taskRepo: ITaskRepository;
  let sessionRepo: ISessionRepository;
  let mailRepo: IMailRepository;
  let teamMemberRepo: ITeamMemberRepository;
  let orderingRepo: IOrderingRepository;

  if (config.supabase.enabled) {
    const sbManager = new SupabaseClientManager(
      config.supabase.url, config.supabase.serviceRoleKey, logger
    );
    const sb = sbManager.getClient();

    taskRepo = new SupabaseTaskRepository(sb, idGenerator, logger);
    sessionRepo = new SupabaseSessionRepository(sb, idGenerator, logger);
    projectRepo = new SupabaseProjectRepository(sb, idGenerator, logger, taskRepo, sessionRepo);
    mailRepo = new SupabaseMailRepository(sb, logger);
    teamMemberRepo = new SupabaseTeamMemberRepository(sb, idGenerator, logger);
    orderingRepo = new SupabaseOrderingRepository(sb, logger);
    logger.info('Using Supabase repositories (PostgreSQL)');
  } else {
    // Fallback: filesystem repos (self-hosted, no cloud)
    taskRepo = new FileSystemTaskRepository(config.dataDir, idGenerator, logger);
    sessionRepo = new FileSystemSessionRepository(config.dataDir, idGenerator, logger);
    projectRepo = new FileSystemProjectRepository(config.dataDir, idGenerator, logger,
      (pid) => taskRepo.existsByProjectId(pid),
      (pid) => sessionRepo.existsByProjectId(pid)
    );
    mailRepo = new FileSystemMailRepository(config.dataDir, logger);
    teamMemberRepo = new FileSystemTeamMemberRepository(config.dataDir, idGenerator, logger);
    orderingRepo = new FileSystemOrderingRepository(config.dataDir, logger);
    logger.info('Using filesystem repositories (local mode)');
  }

  // ── Redis (real-time coordination) ──
  let redisManager: RedisClientManager | null = null;
  let eventBus: IEventBus;
  let distributedLock: DistributedLock | null = null;
  let presenceWatcher: SessionPresenceWatcher | null = null;

  if (config.redis.enabled) {
    redisManager = new RedisClientManager(config.redis.url, logger, config.redis.keyPrefix);
    await redisManager.connect();
    eventBus = new RedisEventBus(redisManager, logger);
    distributedLock = new DistributedLock(redisManager.getClient(), config.redis.keyPrefix);
    logger.info('Using Redis event bus + locks');
  } else {
    eventBus = new InMemoryEventBus(logger);
    logger.info('Using in-memory event bus (Redis disabled)');
  }

  // ── Services (unchanged — depend on interfaces, not implementations) ──
  const taskService = new TaskService(taskRepo, eventBus, idGenerator, logger, distributedLock);
  const sessionService = new SessionService(sessionRepo, eventBus, idGenerator, logger);
  // ... remaining services

  // ── Presence watcher (requires Redis + SessionService) ──
  if (redisManager) {
    presenceWatcher = new SessionPresenceWatcher(redisManager, sessionService, eventBus, logger);
    await presenceWatcher.start();
  }

  return { /* all dependencies */ };
}
```

---

## 7. Migration Strategy

### 7.1 Migration Path: FileSystem → Supabase

```
Phase 0: Both systems running in parallel
─────────────────────────────────────────
  SUPABASE_ENABLED=false  (filesystem only)
  REDIS_ENABLED=false     (in-memory events only)

Phase 1: Redis event bus (no data migration needed)
───────────────────────────────────────────────────
  REDIS_ENABLED=true      → RedisEventBus replaces InMemoryEventBus
  SUPABASE_ENABLED=false  → filesystem repos unchanged
  Rollback: REDIS_ENABLED=false

Phase 2: Supabase repos (data migration required)
──────────────────────────────────────────────────
  Step 2a: Create Supabase project, run schema SQL
  Step 2b: Run migration script (see below)
  Step 2c: SUPABASE_ENABLED=true → Supabase repos active
  Rollback: SUPABASE_ENABLED=false (filesystem data still intact)

Phase 3: Full stack
────────────────────
  SUPABASE_ENABLED=true
  REDIS_ENABLED=true
  Both active, all features available
```

### 7.2 Migration Script

```typescript
// scripts/migrate-to-supabase.ts

async function migrateToSupabase() {
  const fsConfig = { dataDir: '~/.maestro/data', sessionDir: '~/.maestro/sessions' };
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Migrate projects
  const projects = await readJsonDir(`${fsConfig.dataDir}/projects`);
  for (const project of projects) {
    await supabase.from('projects').upsert({
      id: project.id,
      name: project.name,
      description: project.description || '',
      working_dir: project.workingDir,
      owner_id: DEFAULT_USER_ID,  // assign to initial user
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });
  }

  // 2. Migrate tasks (per project directory)
  for (const project of projects) {
    const tasks = await readJsonDir(`${fsConfig.dataDir}/tasks/${project.id}`);
    for (const task of tasks) {
      await supabase.from('tasks').upsert(mapTaskToRow(task));
    }
  }

  // 3. Migrate sessions
  const sessions = await readJsonDir(fsConfig.sessionDir);
  for (const session of sessions) {
    await supabase.from('sessions').upsert(mapSessionToRow(session));
  }

  // 4. Migrate mail
  const mails = await readJsonDir(`${fsConfig.dataDir}/mail`);
  for (const mail of mails) {
    await supabase.from('mail').upsert(mapMailToRow(mail));
  }

  // 5. Migrate team members (per project directory)
  for (const project of projects) {
    const members = await readJsonDir(`${fsConfig.dataDir}/team-members/${project.id}`);
    for (const member of members) {
      await supabase.from('team_members').upsert(mapTeamMemberToRow(member));
    }
  }

  // 6. Migrate orderings
  for (const project of projects) {
    for (const type of ['task', 'session']) {
      const ordering = await readJsonFile(
        `${fsConfig.dataDir}/ordering/${type}/${project.id}.json`
      );
      if (ordering) {
        await supabase.from('orderings').upsert(mapOrderingToRow(ordering));
      }
    }
  }

  console.log('Migration complete. Verify data, then set SUPABASE_ENABLED=true');
}
```

### 7.3 Rollback Capability

Every phase has a feature flag:

| Phase | Feature Flag | Rollback Action |
|---|---|---|
| Redis event bus | `REDIS_ENABLED=false` | Falls back to `InMemoryEventBus` |
| Supabase repos | `SUPABASE_ENABLED=false` | Falls back to `FileSystem*Repository` |
| Agent presence | No `REDIS_URL` in CLI env | Heartbeat not started, no presence tracking |
| Distributed locks | `REDIS_ENABLED=false` | Lock is `null`, no locking (current behavior) |
| Socket.IO | N/A (separate migration) | Keep WebSocketBridge alongside during transition |

**Critical:** No phase requires a destructive change. Filesystem data remains intact even after enabling Supabase. The migration is additive.

### 7.4 Handling camelCase ↔ snake_case

All Supabase repositories implement a mapping layer:

```typescript
// Example: SupabaseTaskRepository

private toDbRow(task: Task): Record<string, any> {
  return {
    id: task.id,
    project_id: task.projectId,
    parent_id: task.parentId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    initial_prompt: task.initialPrompt,
    session_ids: task.sessionIds,
    skill_ids: task.skillIds,
    agent_ids: task.agentIds,
    dependencies: task.dependencies,
    reference_task_ids: task.referenceTaskIds,
    task_session_statuses: task.taskSessionStatuses,
    pinned: task.pinned,
    team_member_id: task.teamMemberId,
    team_member_ids: task.teamMemberIds,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    started_at: task.startedAt,
    completed_at: task.completedAt,
  };
}

private fromDbRow(row: Record<string, any>): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority || 'medium',
    initialPrompt: row.initial_prompt || '',
    sessionIds: row.session_ids || [],
    skillIds: row.skill_ids || [],
    agentIds: row.agent_ids || [],
    dependencies: row.dependencies || [],
    referenceTaskIds: row.reference_task_ids || [],
    taskSessionStatuses: row.task_session_statuses || {},
    pinned: row.pinned || false,
    teamMemberId: row.team_member_id,
    teamMemberIds: row.team_member_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
```

---

## 8. Key Implementation Details

### 8.1 Config.ts Additions

```typescript
// New interfaces in Config.ts

export interface RedisConfig {
  enabled: boolean;
  url: string;
  keyPrefix: string;
}

export interface SupabaseConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

// Environment variable mapping:
// REDIS_ENABLED        → redis.enabled (default: false)
// REDIS_URL            → redis.url (default: redis://localhost:6379)
// REDIS_KEY_PREFIX     → redis.keyPrefix (default: maestro:)
// SUPABASE_ENABLED     → supabase.enabled (default: false)
// SUPABASE_URL         → supabase.url
// SUPABASE_ANON_KEY    → supabase.anonKey
// SUPABASE_SERVICE_ROLE_KEY → supabase.serviceRoleKey
```

### 8.2 File Inventory

**New files (Supabase repos):**

```
maestro-server/src/infrastructure/supabase/
├── SupabaseClientManager.ts           // Connection manager
├── SupabaseProjectRepository.ts       // IProjectRepository
├── SupabaseTaskRepository.ts          // ITaskRepository
├── SupabaseSessionRepository.ts       // ISessionRepository
├── SupabaseMailRepository.ts          // IMailRepository
├── SupabaseTeamMemberRepository.ts    // ITeamMemberRepository
├── SupabaseOrderingRepository.ts      // IOrderingRepository
└── index.ts
```

**New files (Redis):**

```
maestro-server/src/infrastructure/redis/
├── RedisClientManager.ts              // Singleton connection manager (3 clients)
├── RedisEventBus.ts                   // IEventBus via Redis Pub/Sub
├── SessionPresenceWatcher.ts          // Agent crash detection
├── DistributedLock.ts                 // SET NX PX pattern
└── index.ts
```

**New files (auth + migration):**

```
maestro-server/src/middleware/auth.ts          // Express auth middleware
maestro-cli/src/services/auth.ts               // CLI auth service
scripts/migrate-to-supabase.ts                 // Data migration script
supabase/migrations/001_initial_schema.sql     // Full DDL + RLS
```

**Modified files:**

| File | Changes |
|---|---|
| `maestro-server/src/infrastructure/config/Config.ts` | Add `RedisConfig`, `SupabaseConfig` |
| `maestro-server/src/container.ts` | Conditional wiring for Supabase/FileSystem repos and Redis/InMemory event bus |
| `maestro-server/src/server.ts` | Auth middleware, Socket.IO setup, CORS for tunnel |
| `maestro-server/package.json` | Add `ioredis`, `socket.io`, `@supabase/supabase-js`, `uuid` |
| `maestro-cli/package.json` | Add `ioredis`, `@supabase/supabase-js` |

### 8.3 Concurrency Notes

**SupabaseTaskRepository.addSession / removeSession:**
These use PostgreSQL array operations to avoid read-modify-write races:

```sql
-- addSession: atomic array append
UPDATE tasks
SET session_ids = array_append(session_ids, $sessionId),
    updated_at = $now
WHERE id = $taskId
  AND NOT ($sessionId = ANY(session_ids));  -- idempotent

-- removeSession: atomic array remove
UPDATE tasks
SET session_ids = array_remove(session_ids, $sessionId),
    updated_at = $now
WHERE id = $taskId;
```

**Task assignment with distributed lock:**
When `distributedLock` is available, `TaskService.updateTaskSessionStatus()` wraps the status update in a lock:

```typescript
async updateTaskSessionStatus(taskId: string, sessionId: string, status: TaskSessionStatus) {
  if (this.lock) {
    return this.lock.withLock(`task:${taskId}`, sessionId, async () => {
      return this._doUpdateTaskSessionStatus(taskId, sessionId, status);
    });
  }
  return this._doUpdateTaskSessionStatus(taskId, sessionId, status);
}
```

### 8.4 Memory Estimation

**Redis:**

| Data Type | Count (typical) | Size Per Item | Total |
|---|---|---|---|
| Presence keys | ~10 active agents | ~200 bytes | ~2 KB |
| Event channels | ~30 channels | transient msgs | ~3 KB |
| Distributed locks | ~5 concurrent | ~100 bytes | ~500 bytes |
| Session cache | ~50 sessions | ~500 bytes | ~25 KB |
| Terminal streams | ~10 active | ~100 KB each | ~1 MB |
| **Total** | | | **~1 MB** |

**Supabase (PostgreSQL):**

| Table | Rows (after 6 months) | Est. Size |
|---|---|---|
| projects | ~20 | ~10 KB |
| tasks | ~2,000 | ~2 MB |
| sessions | ~5,000 | ~10 MB |
| mail | ~10,000 | ~5 MB |
| team_members | ~100 | ~50 KB |
| orderings | ~40 | ~10 KB |
| **Total** | | **~17 MB** |

Both are well within free tier limits.

---

## Appendix: Environment Variable Reference

```bash
# .env (maestro-server)

# Supabase
SUPABASE_ENABLED=true
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=maestro:

# Cloudflare Tunnel
EXTERNAL_URL=https://maestro.yourdomain.com

# Existing (unchanged)
PORT=3000
HOST=0.0.0.0
DATA_DIR=~/.maestro/data
SESSION_DIR=~/.maestro/sessions
LOG_LEVEL=info
NODE_ENV=production
```
