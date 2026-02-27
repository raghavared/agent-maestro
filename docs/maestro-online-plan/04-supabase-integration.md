# Supabase Integration: Multi-User Persistent Data Layer

## Overview

Supabase replaces the filesystem-based repositories with PostgreSQL, adds multi-user authentication, and provides cloud-persistent storage. Combined with the existing Redis + Socket.IO plan, this creates a **hybrid architecture** where each technology handles what it does best.

**Redis** = ephemeral, real-time coordination (events, presence, locks)
**Supabase** = durable, multi-user persistent data (projects, tasks, sessions, mail, auth)
**Socket.IO** = push notifications to UI and mobile clients

---

## Why Supabase (Not Firebase)

| Factor | Supabase | Firebase |
|---|---|---|
| **Database** | PostgreSQL (full SQL, JOINs, constraints, migrations) | Firestore (NoSQL, limited queries, denormalization) |
| **Security** | Row Level Security (SQL-based, expressive) | Firestore rules (custom DSL, less flexible) |
| **Open source** | Yes, self-hostable | No |
| **Vendor lock-in** | Low (standard Postgres, can migrate) | High (proprietary APIs) |
| **Pricing** | Generous free tier, predictable scaling | Pay-per-read/write (unpredictable for write-heavy) |
| **Offline support** | Not built-in (not needed — Express server is middleware) | Built-in (overkill when server exists) |
| **Realtime** | Postgres changes via WebSocket | Firestore listeners + RTDB |
| **Auth** | Multi-provider, JWT, RLS integration | Multi-provider, custom tokens |
| **Developer experience** | SQL + REST + client SDK | Custom SDK, NoSQL modeling |

**Key insight:** The Firebase plan (`firebase-integration/`) assumed removing the Express server and having clients talk directly to Firebase. But the Redis + Socket.IO plan **keeps the Express server**. With a server in the middle, Supabase's server-side Postgres client is a better fit than Firebase's client-side-first design.

---

## Architecture: Supabase + Redis Hybrid

```
┌─────────────────────────────────────────────────────────────────────┐
│                          maestro-server                              │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │   Express   │  │  Socket.IO   │  │       Redis Client         │ │
│  │   REST API  │  │  Server      │  │                            │ │
│  │   /api/*    │  │  /mobile ns  │  │  - Pub/Sub (domain events) │ │
│  │             │  │  /ui ns      │  │  - Key expiry (presence)   │ │
│  │             │  │              │  │  - SET NX EX (locks)       │ │
│  └─────────────┘  └──────────────┘  └────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Supabase Client                            │   │
│  │                                                              │   │
│  │  PostgreSQL:  projects, tasks, sessions, mail, team_members  │   │
│  │  Auth:        multi-user, JWT tokens, RLS                    │   │
│  │  Storage:     docs, session recordings, large files          │   │
│  │  Realtime:    DB change notifications (supplemental)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                        Cloudflare Tunnel
                      (maestro.yourdomain.com)
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼─────┐ ┌────────▼────────┐
       │  📱 Phone   │ │  🖥️ Tauri  │ │  Agent CLI       │
       │  Web App    │ │  Desktop   │ │  REST API        │
       │  Socket.IO  │ │  Socket.IO │ │  + Supabase Auth │
       └─────────────┘ └────────────┘ └─────────────────┘
```

### Responsibility Split

| Concern | Technology | Why |
|---|---|---|
| Domain events (pub/sub) | **Redis** | Sub-ms latency, ephemeral, no persistence needed |
| Agent presence / liveness | **Redis key expiry** | TTL-based auto-cleanup, purpose-built |
| Distributed locks | **Redis SET NX EX** | Atomic, fast, battle-tested |
| Projects, tasks, sessions | **Supabase PostgreSQL** | Relational, durable, multi-user, queryable |
| User authentication | **Supabase Auth** | JWT, multi-provider, RLS integration |
| Mail (persistent messages) | **Supabase PostgreSQL** | Durable, queryable, indexed |
| Team members | **Supabase PostgreSQL** | Relational, scoped by project |
| File storage (docs) | **Supabase Storage** | S3-compatible, CDN, access control |
| Real-time push to UI/mobile | **Socket.IO** | Rooms, namespaces, reconnect, already planned |
| Ordering data | **Supabase PostgreSQL** | Simple key-value, durable |

---

## Database Schema (PostgreSQL)

### Profiles (extends Supabase Auth users)

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

### Projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  working_dir TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
```

### Project Members (multi-user access)

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

### Tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed', 'cancelled', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  dependencies TEXT[] DEFAULT '{}',
  reference_task_ids TEXT[] DEFAULT '{}',
  session_ids TEXT[] DEFAULT '{}',
  task_session_statuses JSONB DEFAULT '{}',
  model TEXT,
  agent_tool TEXT,
  initial_prompt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  acceptance_criteria TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(project_id, status);
```

### Sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  task_ids TEXT[] DEFAULT '{}',
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'worker',
  strategy TEXT DEFAULT 'simple',
  agent_id TEXT,
  status TEXT DEFAULT 'spawning' CHECK (status IN ('spawning', 'idle', 'working', 'completed', 'failed', 'stopped')),
  needs_input JSONB DEFAULT '{"active": false}',
  timeline JSONB[] DEFAULT '{}',
  docs JSONB[] DEFAULT '{}',
  queue_state JSONB,
  hostname TEXT,
  platform TEXT,
  env JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  team_member_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(project_id, status);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### Mail

```sql
CREATE TABLE mail (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_session_id TEXT,
  to_session_id TEXT,
  to_team_member_id TEXT,
  type TEXT DEFAULT 'directive' CHECK (type IN ('directive', 'status', 'question', 'response', 'broadcast', 'error')),
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  in_reply_to TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mail_inbox ON mail(to_session_id, created_at DESC);
CREATE INDEX idx_mail_project ON mail(project_id, created_at DESC);
CREATE INDEX idx_mail_broadcast ON mail(project_id, to_session_id) WHERE to_session_id IS NULL;
```

### Team Members

```sql
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  agent_tool TEXT DEFAULT 'claude-code',
  model TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  skills JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_members_project ON team_members(project_id);
```

### Orderings

```sql
CREATE TABLE orderings (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  ordered_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orderings_project ON orderings(project_id, type);
```

---

## Row Level Security (RLS) Policies

```sql
-- Helper function: check project membership
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

-- Tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members see tasks" ON tasks
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Project members manage tasks" ON tasks
  FOR ALL USING (is_project_member(project_id));

-- Sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members see sessions" ON sessions
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Project members manage sessions" ON sessions
  FOR ALL USING (is_project_member(project_id));

-- Mail
ALTER TABLE mail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members see mail" ON mail
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Project members send mail" ON mail
  FOR INSERT WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members delete mail" ON mail
  FOR DELETE USING (is_project_member(project_id));

-- Team Members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members see team members" ON team_members
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Project members manage team members" ON team_members
  FOR ALL USING (is_project_member(project_id));

-- Project Members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see project memberships" ON project_members
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "Owners manage memberships" ON project_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- Orderings
ALTER TABLE orderings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members manage orderings" ON orderings
  FOR ALL USING (is_project_member(project_id));

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
```

---

## Implementation: Repository Layer

### New Files to Create

```
maestro-server/src/infrastructure/supabase/
├── SupabaseClient.ts                  // Connection manager
├── SupabaseProjectRepository.ts       // implements IProjectRepository
├── SupabaseTaskRepository.ts          // implements ITaskRepository
├── SupabaseSessionRepository.ts       // implements ISessionRepository
├── SupabaseMailRepository.ts          // implements IMailRepository
├── SupabaseTeamMemberRepository.ts    // implements ITeamMemberRepository
├── SupabaseOrderingRepository.ts      // implements IOrderingRepository
└── index.ts                           // Barrel export
```

### SupabaseClient.ts

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ILogger } from '../../domain/common/ILogger';

export class SupabaseClientManager {
  private client: SupabaseClient;
  private logger: ILogger;

  constructor(url: string, serviceRoleKey: string, logger: ILogger) {
    this.logger = logger;
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      // Server-side: use service role key to bypass RLS for internal operations
      // Client-side requests will use user JWTs with RLS enforced
    });
    this.logger.info('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  // Create a client scoped to a specific user (for RLS-enforced operations)
  getUserClient(accessToken: string): SupabaseClient {
    // Clone client with user's JWT for RLS
    return createClient(
      this.client.supabaseUrl,
      this.client.supabaseKey,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client.from('projects').select('id').limit(0);
      return !error;
    } catch {
      return false;
    }
  }
}
```

### Example: SupabaseTaskRepository.ts

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { ITaskRepository, TaskFilter } from '../../domain/repositories/ITaskRepository';
import { Task, CreateTaskPayload, UpdateTaskPayload } from '../../types';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

export class SupabaseTaskRepository implements ITaskRepository {
  constructor(
    private supabase: SupabaseClient,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {}

  async create(payload: CreateTaskPayload): Promise<Task> {
    const id = this.idGenerator.generate('task');
    const now = new Date().toISOString();

    const task = {
      id,
      ...payload,
      session_ids: payload.sessionIds || [],
      task_session_statuses: payload.taskSessionStatuses || {},
      parent_id: payload.parentId || null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('tasks')
      .insert(this.toDbRow(task))
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return this.fromDbRow(data);
  }

  async findById(id: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return this.fromDbRow(data);
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to find tasks: ${error.message}`);
    return (data || []).map(this.fromDbRow);
  }

  async findAll(filter?: TaskFilter): Promise<Task[]> {
    let query = this.supabase.from('tasks').select('*');

    if (filter?.projectId) query = query.eq('project_id', filter.projectId);
    if (filter?.status) query = query.eq('status', filter.status);
    if (filter?.parentId !== undefined) {
      query = filter.parentId === null
        ? query.is('parent_id', null)
        : query.eq('parent_id', filter.parentId);
    }
    if (filter?.sessionId) query = query.contains('session_ids', [filter.sessionId]);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to find tasks: ${error.message}`);
    return (data || []).map(this.fromDbRow);
  }

  async update(id: string, updates: UpdateTaskPayload): Promise<Task> {
    const dbUpdates = {
      ...this.toDbUpdates(updates),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new NotFoundError('Task', id);
    return this.fromDbRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('tasks').delete().eq('id', id);
    if (error) throw new NotFoundError('Task', id);
  }

  // ... remaining interface methods (addSession, removeSession, etc.)

  // Column name mapping (camelCase ↔ snake_case)
  private toDbRow(task: any): any { /* camelCase → snake_case */ }
  private fromDbRow(row: any): Task { /* snake_case → camelCase */ }
  private toDbUpdates(updates: any): any { /* map update fields */ }
}
```

All 6 repository implementations follow the same pattern. The `IProjectRepository`, `ISessionRepository`, `IMailRepository`, `ITeamMemberRepository`, and `IOrderingRepository` interfaces are implemented identically.

---

## Authentication Flow

### Supabase Auth Setup

**Providers (phased):**
- **Phase 1:** Email/password
- **Phase 2:** Google OAuth
- **Phase 3:** GitHub OAuth

### Server-Side Auth Middleware

```typescript
// maestro-server/src/middleware/auth.ts
import { createClient } from '@supabase/supabase-js';

export function authMiddleware(supabaseUrl: string, supabaseAnonKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow unauthenticated access for backward compatibility
      // (self-hosted mode without Supabase)
      if (!config.supabase.enabled) return next();
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  };
}
```

### CLI Authentication

The CLI needs to authenticate to access Supabase-backed data:

```typescript
// maestro-cli/src/services/auth.ts

export class CliAuth {
  private tokenPath = path.join(os.homedir(), '.maestro', 'auth-token.json');

  async login(email: string, password: string): Promise<void> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    });
    if (error) throw error;

    // Store tokens locally
    await fs.writeFile(this.tokenPath, JSON.stringify({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Date.now() + (data.session.expires_in * 1000),
    }));
  }

  async getToken(): Promise<string | null> {
    // Read stored token, auto-refresh if expired
    // Return null if not logged in
  }

  async logout(): Promise<void> {
    await fs.unlink(this.tokenPath).catch(() => {});
  }
}
```

**New CLI commands:**
```bash
maestro auth login              # Email/password login
maestro auth login --google     # Opens browser for Google OAuth
maestro auth logout             # Clear stored token
maestro auth whoami             # Show current user
```

### Socket.IO Auth (Mobile/Web)

```typescript
// In SocketIOBridge.setupMobileNamespace():
this.mobileNs.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return next(new Error('Invalid token'));

  socket.data.userId = user.id;
  socket.data.projectId = socket.handshake.auth.projectId;
  next();
});
```

---

## Integration with Existing Plan Phases

### What Changes

| Phase | Original Plan | With Supabase |
|---|---|---|
| **0** | Install Redis, Cloudflare, npm deps | + Create Supabase project, install `@supabase/supabase-js`, run migration SQL |
| **0.5 (NEW)** | — | **Supabase Auth + PostgreSQL repos** (replace all FileSystem repos) |
| **1** | RedisEventBus (replace InMemoryEventBus) | **Unchanged** — Redis still handles domain events |
| **2** | Socket.IO (replace raw ws) | + Add Supabase JWT auth middleware to Socket.IO namespaces |
| **3** | Agent liveness (Redis key expiry) | **Unchanged** — Redis is better for ephemeral presence |
| **4** | Redis Streams mail (replace filesystem) | **Changed** — Use SupabaseMailRepository instead of Redis Streams |
| **5** | Mobile Socket.IO handlers | + Auth required for all mobile connections |
| **6** | Distributed locks | **Unchanged** — Redis is better for locks |
| **7** | Cloudflare Tunnel | **Unchanged** |

### Updated Phase Dependencies

```
Phase 0: Prerequisites (Redis, Cloudflare, Supabase project, npm deps)
   │
   ├──▶ Phase 0.5: Supabase repos + Auth (replace FileSystem repos)
   │       │
   │       └──▶ All subsequent phases use Supabase for persistence
   │
   ▼
Phase 1: RedisEventBus ←── Foundation for real-time
   │
   ├──▶ Phase 2: Socket.IO + Supabase auth middleware
   │       │
   │       └──▶ Phase 5: Mobile handlers (auth-gated)
   │               │
   │               └──▶ Phase 7: Cloudflare Tunnel
   │
   ├──▶ Phase 3: Agent Liveness (Redis key expiry)
   │
   ├──▶ Phase 4: Mail stays in Supabase (already done in 0.5)
   │
   └──▶ Phase 6: Distributed Locks (Redis)
```

**Note:** Phase 4 (Redis Streams Mail) is **absorbed into Phase 0.5** because `SupabaseMailRepository` already handles persistent mail. The `MailService.waitForMail()` long-poll still works via RedisEventBus `mail:received` events — no change needed there.

---

## container.ts Wiring

```typescript
import { SupabaseClientManager } from './infrastructure/supabase/SupabaseClient';
import { SupabaseProjectRepository } from './infrastructure/supabase/SupabaseProjectRepository';
import { SupabaseTaskRepository } from './infrastructure/supabase/SupabaseTaskRepository';
import { SupabaseSessionRepository } from './infrastructure/supabase/SupabaseSessionRepository';
import { SupabaseMailRepository } from './infrastructure/supabase/SupabaseMailRepository';
import { SupabaseTeamMemberRepository } from './infrastructure/supabase/SupabaseTeamMemberRepository';
import { SupabaseOrderingRepository } from './infrastructure/supabase/SupabaseOrderingRepository';

export async function createContainer(): Promise<Container> {
  const config = new Config();
  const logger = new ConsoleLogger(config.log.level);
  const idGenerator = new TimestampIdGenerator();

  // --- Supabase (persistent data) ---
  let supabaseManager: SupabaseClientManager | null = null;
  let projectRepo: IProjectRepository;
  let taskRepo: ITaskRepository;
  let sessionRepo: ISessionRepository;
  let mailRepo: IMailRepository;
  let teamMemberRepo: ITeamMemberRepository;
  let orderingRepo: IOrderingRepository;

  if (config.supabase.enabled) {
    supabaseManager = new SupabaseClientManager(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      logger
    );

    const sb = supabaseManager.getClient();
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

  // --- Redis (real-time coordination) ---
  let redisManager: RedisClientManager | null = null;
  let eventBus: IEventBus;

  if (config.redis.enabled) {
    redisManager = new RedisClientManager(config.redis.url, logger);
    await redisManager.connect();
    eventBus = new RedisEventBus(redisManager, logger);
    logger.info('Using Redis event bus');
  } else {
    eventBus = new InMemoryEventBus(logger);
    logger.info('Using in-memory event bus');
  }

  // ... rest of service wiring unchanged
}
```

---

## Config Changes

### `maestro-server/src/infrastructure/config/Config.ts`

```typescript
export interface SupabaseConfig {
  enabled: boolean;
  url: string;
  anonKey: string;        // For client-side auth
  serviceRoleKey: string; // For server-side operations (bypasses RLS)
}

// In loadFromEnvironment():
supabase: {
  enabled: process.env.SUPABASE_ENABLED === 'true',  // Default: disabled (backward compat)
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
}
```

### Environment Variables

```bash
# .env
SUPABASE_ENABLED=true
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (unchanged)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

---

## npm Dependencies

### maestro-server/package.json

```
@supabase/supabase-js   — Supabase client SDK
```

### maestro-cli/package.json

```
@supabase/supabase-js   — For CLI auth (login, token management)
```

---

## Multi-User Data Model

### How Multi-User Works

```
User A (owner)                    User B (member)
     │                                  │
     ├── Creates Project "MyApp"        │
     │   owner_id = User A              │
     │                                  │
     ├── Invites User B ───────────────▶│
     │   project_members row created    │
     │                                  │
     ├── Creates tasks, sessions        ├── Sees same tasks, sessions
     │   (scoped to project via RLS)    │   (RLS allows via membership)
     │                                  │
     ├── Spawns agents                  ├── Can spawn agents too
     │   (sessions linked to project)   │   (if role allows)
     │                                  │
     └── Both see real-time updates via Socket.IO
```

### API Changes for Multi-User

Current API endpoints are project-scoped but don't require auth. With Supabase:

```
Before:  GET /api/projects              → returns ALL projects (single user)
After:   GET /api/projects              → returns only YOUR projects (via RLS/auth)

Before:  POST /api/sessions             → anyone can create
After:   POST /api/sessions             → requires auth, linked to your user ID

Before:  GET /api/mail/inbox/:sessionId → anyone can read any inbox
After:   GET /api/mail/inbox/:sessionId → only project members can read
```

The REST API routes remain the same. Auth middleware + RLS handle the scoping.

---

## Migration Path

### From Filesystem to Supabase

```bash
# 1. Set up Supabase project and run schema SQL
# 2. Run migration script to move existing data:
maestro migrate to-supabase

# Migration script reads ~/.maestro/data/ JSON files
# and inserts them into Supabase tables.
# After verification, filesystem data can be archived.
```

### Rollback

```bash
# Set SUPABASE_ENABLED=false in .env
# Server falls back to FileSystem repos
# All data still in ~/.maestro/data/
```

---

## File Inventory

### New Files (8 files)

| File | Description |
|---|---|
| `maestro-server/src/infrastructure/supabase/SupabaseClient.ts` | Connection manager |
| `maestro-server/src/infrastructure/supabase/SupabaseProjectRepository.ts` | IProjectRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/SupabaseTaskRepository.ts` | ITaskRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/SupabaseSessionRepository.ts` | ISessionRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/SupabaseMailRepository.ts` | IMailRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/SupabaseTeamMemberRepository.ts` | ITeamMemberRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/SupabaseOrderingRepository.ts` | IOrderingRepository via PostgreSQL |
| `maestro-server/src/infrastructure/supabase/index.ts` | Barrel export |

### Additional New Files (auth)

| File | Description |
|---|---|
| `maestro-server/src/middleware/auth.ts` | Express auth middleware (Supabase JWT) |
| `maestro-cli/src/services/auth.ts` | CLI auth service (login, token storage) |
| `supabase/migrations/001_initial_schema.sql` | Database schema + RLS policies |

### Modified Files (4 files)

| File | Changes |
|---|---|
| `maestro-server/src/infrastructure/config/Config.ts` | Add `SupabaseConfig` |
| `maestro-server/src/container.ts` | Conditional Supabase vs FileSystem repos |
| `maestro-server/src/server.ts` | Add auth middleware to routes |
| `maestro-server/package.json` | Add `@supabase/supabase-js` |

---

## Supabase vs Redis: What Goes Where

```
                    ┌─────────────────────────────┐
                    │        SUPABASE              │
                    │     (persistent, durable)     │
                    │                               │
                    │  ✅ Projects                  │
                    │  ✅ Tasks                     │
                    │  ✅ Sessions                  │
                    │  ✅ Mail                      │
                    │  ✅ Team Members              │
                    │  ✅ User profiles             │
                    │  ✅ Auth (JWT, providers)      │
                    │  ✅ File storage (docs)        │
                    │  ✅ Orderings                  │
                    └─────────────────────────────┘

                    ┌─────────────────────────────┐
                    │          REDIS               │
                    │    (ephemeral, real-time)     │
                    │                               │
                    │  ✅ Domain event pub/sub      │
                    │  ✅ Agent presence (TTL keys)  │
                    │  ✅ Distributed locks          │
                    │  ✅ Session status cache       │
                    │  ❌ NOT persistent data        │
                    │  ❌ NOT mail                   │
                    │  ❌ NOT user data              │
                    └─────────────────────────────┘

                    ┌─────────────────────────────┐
                    │        SOCKET.IO             │
                    │      (push transport)         │
                    │                               │
                    │  ✅ Real-time UI updates      │
                    │  ✅ Mobile push notifications  │
                    │  ✅ Session room subscriptions │
                    │  ❌ NOT data storage           │
                    └─────────────────────────────┘
```

---

## Cost Estimates

### Supabase Free Tier (sufficient for development + small teams)

| Resource | Free Tier Limit | Maestro Usage Estimate |
|---|---|---|
| Database | 500 MB | ~10 MB (thousands of tasks/sessions) |
| Auth | 50,000 MAU | 1-10 users |
| Storage | 1 GB | ~50 MB (docs, files) |
| Realtime | 200 concurrent connections | 5-20 |
| Edge Functions | 500K invocations/month | Minimal |

### Supabase Pro ($25/month — for production teams)

| Resource | Pro Limit | Benefit |
|---|---|---|
| Database | 8 GB | Room to grow |
| Auth | 100,000 MAU | Team access |
| Storage | 100 GB | Full session recordings |
| Daily backups | Included | Data safety |
| Metrics/logging | Included | Debugging |

**Bottom line:** Free tier is more than enough to start. $25/month when you need it.
