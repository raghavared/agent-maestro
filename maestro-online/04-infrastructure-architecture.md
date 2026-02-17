# Infrastructure Architecture: Auth, Cloudflare Tunnel, Server & CLI

## Overview

This document covers the infrastructure layer that makes Maestro accessible beyond localhost: authentication, internet tunneling, server changes for static serving and CORS, CLI heartbeat, and environment configuration.

**Current state:** Express server on port 3000. CLI connects via HTTP. No auth. No CORS for external origins. No health-check beyond basic `/health`. Raw `ws` WebSocket.

**Target state:** Supabase auth on all routes + Socket.IO. Cloudflare Tunnel exposes the server. Server serves the web app statically. CLI sends heartbeat via API. Full environment/config system.

---

## 1. Supabase Authentication System

### 1.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Authentication Flow                            │
│                                                                       │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│  │  Supabase   │    │  Express     │    │  Socket.IO               │ │
│  │  Auth       │◄───│  Auth        │    │  Auth                    │ │
│  │  (JWT issuer│    │  Middleware   │    │  Middleware               │ │
│  │   + user DB)│    │  (validates  │    │  (validates JWT on        │ │
│  │            │    │   JWT on API) │    │   connection handshake)   │ │
│  └──────┬──────┘    └──────┬───────┘    └───────────┬──────────────┘ │
│         │                  │                        │                 │
│    Issues JWT         Checks JWT              Checks JWT             │
│         │                  │                        │                 │
│  ┌──────▼──────────────────▼────────────────────────▼──────────────┐ │
│  │                    Clients                                      │ │
│  │  CLI: maestro auth login → stores token in ~/.maestro/          │ │
│  │  Web: Supabase Auth UI → stores token in localStorage           │ │
│  │  Mobile: Same web app via Cloudflare tunnel                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Express Auth Middleware

**File:** `maestro-server/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { createClient, User } from '@supabase/supabase-js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

export interface AuthMiddlewareOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;          // false = skip auth (backward-compat / self-hosted)
}

export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // If auth is disabled, allow all requests (self-hosted / dev mode)
    if (!options.enabled) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: true,
        message: 'Missing or invalid Authorization header',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
      const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          error: true,
          message: 'Invalid or expired token',
          code: 'AUTH_INVALID_TOKEN'
        });
      }

      req.user = user;
      req.userId = user.id;
      next();
    } catch (err) {
      return res.status(500).json({
        error: true,
        message: 'Auth verification failed',
        code: 'AUTH_ERROR'
      });
    }
  };
}

// Lightweight middleware that allows unauthenticated access but populates user if token exists
export function createOptionalAuthMiddleware(options: AuthMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!options.enabled) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(); // No token = anonymous access allowed
    }

    const token = authHeader.slice(7);
    try {
      const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    } catch {
      // Silently continue without user
    }
    next();
  };
}
```

**Integration in server.ts:**

```typescript
// After creating Express app, before API routes:
const authMiddleware = createAuthMiddleware({
  supabaseUrl: config.supabase.url,
  supabaseAnonKey: config.supabase.anonKey,
  enabled: config.supabase.enabled,
});

// Apply to all /api routes
app.use('/api', authMiddleware);

// Health and static routes remain unauthenticated
```

**Backward compatibility:** When `SUPABASE_ENABLED=false` (default), the middleware calls `next()` immediately — no auth required. Existing CLI agents continue working unchanged.

### 1.3 CLI Authentication

**File:** `maestro-cli/src/services/auth.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // unix ms
  email: string;
  userId: string;
}

export class CliAuth {
  private tokenPath: string;
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.tokenPath = path.join(os.homedir(), '.maestro', 'auth-token.json');
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  async login(email: string, password: string): Promise<{ email: string; userId: string }> {
    const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(`Login failed: ${error.message}`);
    if (!data.session) throw new Error('No session returned');

    const stored: StoredToken = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Date.now() + (data.session.expires_in * 1000),
      email: data.user.email!,
      userId: data.user.id,
    };

    await fs.mkdir(path.dirname(this.tokenPath), { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(stored, null, 2), { mode: 0o600 });

    return { email: stored.email, userId: stored.userId };
  }

  async getToken(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.tokenPath, 'utf-8');
      const stored: StoredToken = JSON.parse(raw);

      // Auto-refresh if token expires within 5 minutes
      if (stored.expiresAt - Date.now() < 5 * 60 * 1000) {
        return await this.refreshToken(stored);
      }

      return stored.accessToken;
    } catch {
      return null; // Not logged in
    }
  }

  private async refreshToken(stored: StoredToken): Promise<string> {
    const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refreshToken,
    });

    if (error || !data.session) {
      // Refresh failed — clear stored token
      await this.logout();
      throw new Error('Session expired. Please run: maestro auth login');
    }

    const updated: StoredToken = {
      ...stored,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Date.now() + (data.session.expires_in * 1000),
    };

    await fs.writeFile(this.tokenPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
    return updated.accessToken;
  }

  async getStoredUser(): Promise<{ email: string; userId: string } | null> {
    try {
      const raw = await fs.readFile(this.tokenPath, 'utf-8');
      const stored: StoredToken = JSON.parse(raw);
      return { email: stored.email, userId: stored.userId };
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    await fs.unlink(this.tokenPath).catch(() => {});
  }

  get isConfigured(): boolean {
    return !!this.supabaseUrl && !!this.supabaseAnonKey;
  }
}
```

**CLI Commands:**

**File:** `maestro-cli/src/commands/auth.ts`

```typescript
import { Command } from 'commander';
import { CliAuth } from '../services/auth';

export function createAuthCommand(auth: CliAuth): Command {
  const cmd = new Command('auth').description('Authentication commands');

  cmd.command('login')
    .description('Log in to Maestro')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .action(async (opts) => {
      // If email/password not provided, prompt interactively
      const email = opts.email || await promptInput('Email: ');
      const password = opts.password || await promptPassword('Password: ');

      const result = await auth.login(email, password);
      console.log(`Logged in as ${result.email}`);
    });

  cmd.command('logout')
    .description('Log out of Maestro')
    .action(async () => {
      await auth.logout();
      console.log('Logged out');
    });

  cmd.command('whoami')
    .description('Show current user')
    .action(async () => {
      const user = await auth.getStoredUser();
      if (user) {
        console.log(`Email: ${user.email}`);
        console.log(`User ID: ${user.userId}`);
      } else {
        console.log('Not logged in. Run: maestro auth login');
      }
    });

  return cmd;
}
```

**Token injection into API requests:**

In `maestro-cli/src/api.ts`, the HTTP client should attach the token to all requests:

```typescript
// Before each API call:
const token = await auth.getToken();
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

### 1.4 Web App Authentication

The web app (compiled from maestro-ui) uses Supabase Auth UI for login.

```typescript
// maestro-ui/src/auth/AuthProvider.tsx (web-only)
import { createClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Login page component
function LoginPage() {
  return (
    <Auth
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={['google', 'github']}
    />
  );
}

// Session management
// On login success, store JWT in memory (not localStorage for security)
// Attach to all fetch() calls and Socket.IO handshake
// Auto-refresh via supabase.auth.onAuthStateChange()
```

**Protected routes:** Wrap app in auth context. If no session, show login page. On session, render main app.

### 1.5 Socket.IO Authentication

```typescript
// In SocketIOBridge constructor — mobile namespace auth:
this.mobileNs.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const projectId = socket.handshake.auth?.projectId;

  if (!config.supabase.enabled) {
    // No auth mode — just require projectId
    if (!projectId) return next(new Error('projectId required'));
    socket.data.projectId = projectId;
    return next();
  }

  if (!token) return next(new Error('Authentication required'));

  try {
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return next(new Error('Invalid token'));

    socket.data.userId = user.id;
    socket.data.projectId = projectId;
    next();
  } catch {
    next(new Error('Auth verification failed'));
  }
});

// UI namespace auth (same pattern):
this.uiNs.use(async (socket, next) => {
  // Same JWT validation logic
});
```

### 1.6 Device Registration

Devices are tracked per user via a `devices` table in Supabase:

```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT '',           -- "Subhang's iPhone", "Work MacBook"
  type TEXT DEFAULT 'unknown',    -- 'phone', 'desktop', 'cli'
  platform TEXT DEFAULT '',       -- 'ios', 'android', 'macos', 'linux'
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  push_token TEXT,                -- For future push notifications
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices" ON devices
  FOR ALL USING (user_id = auth.uid());
```

**Registration flow:**
1. On Socket.IO connect, client sends device info in handshake auth
2. Server upserts device record (INSERT ON CONFLICT UPDATE last_seen)
3. Device ID stored in socket.data for session tracking

---

## 2. Cloudflare Tunnel Setup

### 2.1 Installation & Configuration

```bash
# Install cloudflared
brew install cloudflared

# Authenticate with Cloudflare account
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create maestro

# Route DNS
cloudflared tunnel route dns maestro maestro.yourdomain.com
```

### 2.2 Tunnel Configuration

**File:** `~/.cloudflared/config.yml`

```yaml
tunnel: maestro
credentials-file: /Users/<username>/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: maestro.yourdomain.com
    service: http://localhost:3000
    originRequest:
      # WebSocket/Socket.IO support
      connectTimeout: 30s
      keepAliveTimeout: 90s
      # Disable TLS verification for localhost
      noTLSVerify: false
      # HTTP/2 support
      http2Origin: false
  - service: http_status:404
```

**Key settings for Socket.IO compatibility:**
- `keepAliveTimeout: 90s` — Socket.IO uses long-lived connections; default 90s is sufficient since Socket.IO pings every 25s
- `connectTimeout: 30s` — allows time for initial handshake including auth validation
- No special WebSocket config needed — Cloudflare Tunnel natively proxies WebSocket upgrade requests

### 2.3 Running the Tunnel

```bash
# Development: foreground
cloudflared tunnel run maestro

# Production: background service (macOS)
sudo cloudflared service install
# This creates a launchd service at /Library/LaunchDaemons/com.cloudflare.cloudflared.plist

# Verify tunnel is running
cloudflared tunnel info maestro
```

### 2.4 HTTPS/TLS Handling

Cloudflare Tunnel handles TLS termination automatically:
- Phone browser connects to `https://maestro.yourdomain.com` (TLS by Cloudflare)
- Tunnel proxies to `http://localhost:3000` (plain HTTP locally)
- No SSL certificates needed on the local machine
- Socket.IO client connects to `wss://maestro.yourdomain.com` (automatic upgrade)

### 2.5 Health Check Endpoint for Tunnel Monitoring

Cloudflare can be configured to probe a health endpoint:

```typescript
// Already exists in server.ts at /health
// Extend with readiness info:
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    services: {
      redis: redisManager?.isConnected() ?? 'disabled',
      supabase: config.supabase.enabled ? 'enabled' : 'disabled',
      socketio: socketIOBridge ? 'running' : 'not_started',
    }
  });
});

// Readiness endpoint (for load balancers / monitoring)
app.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {};

  if (redisManager) {
    checks.redis = await redisManager.healthCheck();
  }
  if (supabaseManager) {
    checks.supabase = await supabaseManager.healthCheck();
  }

  const allHealthy = Object.values(checks).every(v => v);
  res.status(allHealthy ? 200 : 503).json({
    ready: allHealthy,
    checks,
    timestamp: Date.now(),
  });
});
```

---

## 3. Express Server Changes (server.ts)

### 3.1 Full Modified server.ts Design

The following changes are applied to `maestro-server/src/server.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createContainer } from './container';
import { createAuthMiddleware } from './middleware/auth';
import { SocketIOBridge } from './infrastructure/socketio/SocketIOBridge';
// ... existing route imports ...

async function startServer() {
  const container = await createContainer();
  await container.initialize();

  const { config, logger, eventBus, redisManager, supabaseManager, ...services } = container;

  const app = express();

  // ── 1. CORS Configuration ─────────────────────────────────────────
  const allowedOrigins = [
    'tauri://localhost',
    'http://localhost:1420',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:1420',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    // Cloudflare tunnel origin
    ...(config.externalUrl ? [config.externalUrl] : []),
    // Custom CORS origins from env
    ...(config.cors.origins.filter(o => o !== '*')),
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (config.isDevelopment) {
        // In development, allow all origins
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
  }));

  app.use(express.json());

  // ── 2. Health & Readiness Endpoints (no auth) ─────────────────────
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      services: {
        redis: redisManager?.isConnected() ?? 'disabled',
        supabase: config.supabase.enabled ? 'enabled' : 'disabled',
      }
    });
  });

  app.get('/ready', async (req: Request, res: Response) => {
    const checks: Record<string, boolean> = {};
    if (redisManager) checks.redis = await redisManager.healthCheck();
    if (supabaseManager) checks.supabase = await supabaseManager.healthCheck();

    const allHealthy = Object.values(checks).every(v => v);
    res.status(allHealthy ? 200 : 503).json({ ready: allHealthy, checks });
  });

  // ── 3. Auth Middleware (applied to /api routes) ────────────────────
  const authMiddleware = createAuthMiddleware({
    supabaseUrl: config.supabase.url,
    supabaseAnonKey: config.supabase.anonKey,
    enabled: config.supabase.enabled,
  });

  // ── 4. API Routes ─────────────────────────────────────────────────
  // Request logging
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusIcon = res.statusCode >= 400 ? '❌' : '✅';
      console.log(`${statusIcon} ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Auth on all API routes
  app.use('/api', authMiddleware);

  // Mount routes (unchanged)
  app.use('/api', createProjectRoutes(services.projectService));
  app.use('/api', createTaskRoutes(services.taskService, services.sessionService));
  app.use('/api', createSessionRoutes({ ... }));
  app.use('/api', createMailRoutes({ mailService: services.mailService }));
  app.use('/api', createSkillRoutes(services.skillLoader));
  app.use('/api', createOrderingRoutes(services.orderingService));
  app.use('/api', createTeamMemberRoutes(services.teamMemberService));
  app.use('/api/workflow-templates', createWorkflowTemplateRoutes());

  // ── 5. Static File Serving (Web App) ──────────────────────────────
  const webAppDir = path.resolve(__dirname, '../../maestro-ui/dist-web');
  if (existsSync(webAppDir)) {
    // Serve static assets (JS, CSS, images)
    app.use(express.static(webAppDir, {
      maxAge: config.isProduction ? '1d' : 0,
      index: false, // We handle index.html via SPA fallback
    }));

    // SPA fallback: serve index.html for all non-API, non-socket.io routes
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API routes, socket.io, and health endpoints
      if (req.path.startsWith('/api') ||
          req.path.startsWith('/socket.io') ||
          req.path === '/health' ||
          req.path === '/ready' ||
          req.path === '/ws-status') {
        return next();
      }
      res.sendFile(path.join(webAppDir, 'index.html'));
    });

    logger.info(`Static web app served from ${webAppDir}`);
  } else {
    logger.info('No web app build found at dist-web/ — skipping static serving');
  }

  // ── 6. Error Handling ─────────────────────────────────────────────
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Server error:', err);
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    res.status(500).json({ error: true, message: err.message, code: 'INTERNAL_ERROR' });
  });

  // ── 7. Start HTTP Server ──────────────────────────────────────────
  const server = app.listen(config.port, () => {
    console.log(`🚀 Maestro Server running on http://localhost:${config.port}`);
    if (config.externalUrl) {
      console.log(`   External URL: ${config.externalUrl}`);
    }
    // Write server URL for CLI auto-discovery
    try {
      const serverUrlFile = `${config.dataDir}/server-url`;
      mkdirSync(dirname(serverUrlFile), { recursive: true });
      writeFileSync(serverUrlFile, config.serverUrl, 'utf-8');
    } catch (err) {
      console.warn('   Failed to write server-url file:', err);
    }
  });

  // ── 8. Socket.IO Server ───────────────────────────────────────────
  const socketIOBridge = new SocketIOBridge(
    server,
    eventBus,
    redisManager,
    {
      mailService: services.mailService,
      sessionService: services.sessionService,
      taskService: services.taskService,
    },
    logger,
    allowedOrigins,
    config
  );
  console.log('✅ Socket.IO server started');

  // ── 9. Graceful Shutdown ──────────────────────────────────────────
  // (unchanged from current implementation)
}
```

### 3.2 Key Changes Summary

| Change | What | Why |
|---|---|---|
| CORS update | Add `config.externalUrl` to allowed origins | Cloudflare tunnel domain must be allowed |
| Auth middleware | `app.use('/api', authMiddleware)` before routes | Protect API endpoints |
| Static serving | `express.static(webAppDir)` + SPA fallback | Serve web app for phone access |
| Socket.IO | Replace `WebSocketServer` with `SocketIOBridge` | Rooms, namespaces, mobile support |
| Health endpoint | Extend with service status | Tunnel monitoring |
| Readiness endpoint | New `/ready` endpoint | Load balancer / monitoring |

### 3.3 Static File Serving Details

The web app is built by `maestro-ui` into `dist-web/`:

```
maestro-ui/dist-web/
├── index.html
├── assets/
│   ├── index-abc123.js
│   ├── index-abc123.css
│   └── ...
└── favicon.ico
```

**SPA routing:** All non-API paths (e.g., `/project/abc`, `/settings`) serve `index.html`. The React Router in the web app handles client-side routing.

**Cache strategy:**
- Development: `maxAge: 0` (no caching)
- Production: `maxAge: '1d'` for static assets (they have content hashes in filenames)
- `index.html` is never cached (served fresh via SPA fallback, not static middleware)

---

## 4. CLI Heartbeat Service

### 4.1 Design

The CLI heartbeat is an HTTP-based keep-alive signal. The CLI periodically calls the Express server API to report liveness. The server stores presence in Redis with TTL.

**Why HTTP API instead of direct Redis?**
- CLI only needs `node-fetch` (already a dependency) — no `ioredis` needed
- Server controls Redis schema centrally
- Works through Cloudflare tunnel without exposing Redis
- Simpler CLI dependency tree

### 4.2 Server-Side: Heartbeat API Endpoint

**File:** `maestro-server/src/api/heartbeatRoutes.ts`

```typescript
import { Router, Request, Response } from 'express';

export function createHeartbeatRoutes(
  redisManager: RedisClientManager | null,
  logger: ILogger
): Router {
  const router = Router();

  // POST /api/heartbeat/:sessionId
  router.post('/heartbeat/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { pid, hostname, startedAt } = req.body;

    if (!redisManager) {
      // Redis not available — accept heartbeat but don't store
      return res.json({ status: 'accepted', stored: false });
    }

    const redis = redisManager.getClient();
    const key = `maestro:presence:${sessionId}`;
    const payload = JSON.stringify({
      pid,
      hostname,
      startedAt,
      lastHeartbeat: Date.now(),
    });

    // SET with 15s TTL — if no heartbeat within 15s, key expires
    await redis.set(key, payload, 'EX', 15);

    res.json({ status: 'accepted', stored: true, ttl: 15 });
  });

  // DELETE /api/heartbeat/:sessionId
  router.delete('/heartbeat/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (redisManager) {
      await redisManager.getClient().del(`maestro:presence:${sessionId}`);
    }

    res.json({ status: 'removed' });
  });

  // GET /api/heartbeat/:sessionId
  router.get('/heartbeat/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!redisManager) {
      return res.json({ alive: true, stored: false }); // Can't check without Redis
    }

    const data = await redisManager.getClient().get(`maestro:presence:${sessionId}`);
    res.json({
      alive: data !== null,
      data: data ? JSON.parse(data) : null,
    });
  });

  return router;
}
```

**Mount in server.ts:**
```typescript
app.use('/api', createHeartbeatRoutes(redisManager, logger));
```

### 4.3 CLI-Side: Heartbeat Service

**File:** `maestro-cli/src/services/heartbeat.ts`

```typescript
import os from 'os';

export class AgentHeartbeat {
  private interval: NodeJS.Timeout | null = null;
  private serverUrl: string;
  private sessionId: string;
  private startedAt: number;

  constructor(serverUrl: string, sessionId: string) {
    this.serverUrl = serverUrl;
    this.sessionId = sessionId;
    this.startedAt = Date.now();
  }

  async start(): Promise<void> {
    // Send initial heartbeat
    await this.sendHeartbeat();

    // Refresh every 10s (key expires in 15s, so 5s buffer)
    this.interval = setInterval(() => {
      this.sendHeartbeat().catch(() => {
        // Silently fail — server may be temporarily unavailable
      });
    }, 10_000);

    // Cleanup on process exit
    const cleanup = () => this.stop();
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  private async sendHeartbeat(): Promise<void> {
    const url = `${this.serverUrl}/api/heartbeat/${this.sessionId}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: this.startedAt,
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Clean up presence key
    try {
      await fetch(`${this.serverUrl}/api/heartbeat/${this.sessionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Best effort
    }
  }
}
```

### 4.4 Integration with Session Registration

**File:** `maestro-cli/src/commands/session.ts` (register command)

```typescript
// After successful session registration:
const heartbeat = new AgentHeartbeat(config.serverUrl, sessionId);
await heartbeat.start();
// Heartbeat auto-cleans up on process exit via signal handlers
```

### 4.5 Server-Side: Presence Watcher

**File:** `maestro-server/src/infrastructure/redis/SessionPresenceWatcher.ts`

Watches Redis keyspace events for presence key expiry:

```typescript
export class SessionPresenceWatcher {
  private subClient: Redis;

  constructor(
    private redisManager: RedisClientManager,
    private sessionService: SessionService,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  async start(): Promise<void> {
    const client = this.redisManager.getClient();

    // Enable keyspace notifications for expired events
    await client.config('SET', 'notify-keyspace-events', 'Ex');

    // Subscribe to key expiry events
    this.subClient = this.redisManager.getSubClient().duplicate();
    await this.subClient.subscribe('__keyevent@0__:expired');

    this.subClient.on('message', async (channel, expiredKey) => {
      // Only handle presence keys
      if (!expiredKey.startsWith('maestro:presence:')) return;

      const sessionId = expiredKey.replace('maestro:presence:', '');
      this.logger.warn(`Agent heartbeat expired for session ${sessionId}`);

      try {
        // Check session status — only mark failed if still active
        const session = await this.sessionService.findById(sessionId);
        if (session && (session.status === 'working' || session.status === 'idle')) {
          await this.sessionService.update(sessionId, {
            status: 'failed',
            timeline: [
              ...(session.timeline || []),
              {
                type: 'error',
                message: 'Agent disconnected (heartbeat expired)',
                timestamp: new Date().toISOString(),
              }
            ]
          });

          await this.eventBus.emit('notify:session_failed', {
            sessionId,
            reason: 'agent_disconnected',
          });
        }
      } catch (err) {
        this.logger.error(`Failed to handle expired session ${sessionId}:`, err);
      }
    });

    this.logger.info('Session presence watcher started');
  }

  async getActiveAgents(): Promise<string[]> {
    const keys = await this.redisManager.getClient().keys('maestro:presence:*');
    return keys.map(k => k.replace('maestro:presence:', ''));
  }

  async isAlive(sessionId: string): Promise<boolean> {
    const exists = await this.redisManager.getClient().exists(`maestro:presence:${sessionId}`);
    return exists === 1;
  }

  async stop(): Promise<void> {
    if (this.subClient) {
      await this.subClient.unsubscribe();
      this.subClient.disconnect();
    }
  }
}
```

---

## 5. Environment & Configuration

### 5.1 Config.ts Extensions

**File:** `maestro-server/src/infrastructure/config/Config.ts`

New interfaces to add:

```typescript
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
```

New fields in `ConfigOptions`:

```typescript
export interface ConfigOptions {
  // ... existing fields ...

  // Redis
  redis: RedisConfig;

  // Supabase
  supabase: SupabaseConfig;

  // External URL (Cloudflare tunnel)
  externalUrl?: string;
}
```

New `loadFromEnvironment()` entries:

```typescript
// Redis
redis: {
  enabled: process.env.REDIS_ENABLED !== 'false',  // Default: enabled
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'maestro:',
},

// Supabase
supabase: {
  enabled: process.env.SUPABASE_ENABLED === 'true',  // Default: disabled
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
},

// External URL
externalUrl: process.env.EXTERNAL_URL || process.env.CLOUDFLARE_TUNNEL_URL,
```

New getters:

```typescript
get redis(): RedisConfig { return this.config.redis; }
get supabase(): SupabaseConfig { return this.config.supabase; }
get externalUrl(): string | undefined { return this.config.externalUrl; }
```

New validation:

```typescript
// Supabase validation
if (this.config.supabase.enabled) {
  if (!this.config.supabase.url) throw new ConfigError('SUPABASE_URL required when SUPABASE_ENABLED=true');
  if (!this.config.supabase.anonKey) throw new ConfigError('SUPABASE_ANON_KEY required');
  if (!this.config.supabase.serviceRoleKey) throw new ConfigError('SUPABASE_SERVICE_ROLE_KEY required');
}
```

### 5.2 CLI Config Extensions

**File:** `maestro-cli/src/config.ts`

Add:

```typescript
get supabaseUrl(): string | null {
  return process.env.SUPABASE_URL || process.env.MAESTRO_SUPABASE_URL || null;
}

get supabaseAnonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY || process.env.MAESTRO_SUPABASE_ANON_KEY || null;
}

get authEnabled(): boolean {
  return !!this.supabaseUrl && !!this.supabaseAnonKey;
}
```

### 5.3 Environment Variables Reference

```bash
# ─── Server Core ──────────────────────────────────────────
PORT=3000                          # Express server port
HOST=0.0.0.0                      # Bind address
SERVER_URL=http://localhost:3000   # Server URL for CLI discovery
NODE_ENV=development               # development | production | test

# ─── Data Storage ────────────────────────────────────────
DATA_DIR=~/.maestro/data           # Filesystem data directory
SESSION_DIR=~/.maestro/sessions    # Session working directories
SKILLS_DIR=~/.claude/skills        # Claude skills directory
DATABASE_TYPE=filesystem           # filesystem | postgres

# ─── Redis ────────────────────────────────────────────────
REDIS_ENABLED=true                 # Enable Redis event bus (default: true)
REDIS_URL=redis://localhost:6379   # Redis connection string
REDIS_KEY_PREFIX=maestro:          # Key namespace prefix

# ─── Supabase ─────────────────────────────────────────────
SUPABASE_ENABLED=false             # Enable Supabase (default: false)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...          # Public anon key (for client auth)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role key (server-side, bypasses RLS)

# ─── Cloudflare Tunnel ───────────────────────────────────
EXTERNAL_URL=https://maestro.yourdomain.com  # Public URL via tunnel
# Alternative env var name:
CLOUDFLARE_TUNNEL_URL=https://maestro.yourdomain.com

# ─── CORS ─────────────────────────────────────────────────
CORS_ENABLED=true                  # Enable CORS (default: true)
CORS_ORIGINS=https://custom.domain.com  # Additional allowed origins (comma-separated)
CORS_CREDENTIALS=true              # Allow credentials

# ─── Logging ──────────────────────────────────────────────
LOG_LEVEL=info                     # error | warn | info | debug
LOG_FORMAT=pretty                  # json | pretty
DEBUG=false                        # Enable debug mode
```

### 5.4 .env.example Template

**File:** `maestro-server/.env.example`

```bash
# Maestro Server Configuration
# Copy to .env and fill in values

# ── Core ──
PORT=3000
NODE_ENV=development

# ── Redis (required for real-time features) ──
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# ── Supabase (required for multi-user / cloud mode) ──
SUPABASE_ENABLED=false
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── Cloudflare Tunnel (for phone access) ──
# EXTERNAL_URL=https://maestro.yourdomain.com

# ── Logging ──
LOG_LEVEL=info
```

### 5.5 Docker Compose for Local Dev

**File:** `docker-compose.dev.yml`

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Optional: Local PostgreSQL (instead of Supabase cloud)
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: maestro
      POSTGRES_USER: maestro
      POSTGRES_PASSWORD: maestro_dev
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U maestro"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis-data:
  pg-data:
```

**Usage:**

```bash
# Start dev infrastructure
docker compose -f docker-compose.dev.yml up -d

# Verify
redis-cli ping        # → PONG
psql -h localhost -U maestro -d maestro  # → connected

# Stop
docker compose -f docker-compose.dev.yml down
```

---

## 6. Deployment Guide

### 6.1 Local Development (Single User, No Auth)

```bash
# 1. Start Redis
brew services start redis
# OR: docker compose -f docker-compose.dev.yml up redis -d

# 2. Start server
cd maestro-server
REDIS_ENABLED=true bun run src/server.ts

# 3. Use CLI normally — no auth needed
maestro task list
```

### 6.2 Cloud Mode (Multi-User, Auth + Tunnel)

```bash
# 1. Start Redis
docker compose -f docker-compose.dev.yml up redis -d

# 2. Set up Supabase project at https://supabase.com
#    Run schema migration SQL from supabase/migrations/

# 3. Configure environment
cp maestro-server/.env.example maestro-server/.env
# Fill in SUPABASE_URL, keys, EXTERNAL_URL

# 4. Build web app
cd maestro-ui && npm run build:web

# 5. Start server
cd maestro-server
source .env && bun run src/server.ts

# 6. Start tunnel
cloudflared tunnel run maestro

# 7. CLI auth
maestro auth login --email you@example.com

# 8. Phone: open https://maestro.yourdomain.com
```

### 6.3 Feature Flag Matrix

| Feature | Env Var | Default | Effect When Disabled |
|---|---|---|---|
| Redis events | `REDIS_ENABLED` | `true` | Falls back to InMemoryEventBus |
| Auth | `SUPABASE_ENABLED` | `false` | No auth required (backward-compat) |
| Supabase repos | `SUPABASE_ENABLED` | `false` | Uses FileSystem repos |
| External access | `EXTERNAL_URL` | unset | No tunnel CORS entry |
| Static web app | (auto-detected) | — | Skipped if dist-web/ missing |
| Heartbeat | (auto) | — | Only runs if server URL available |

---

## 7. File Inventory

### New Files

| File | Purpose |
|---|---|
| `maestro-server/src/middleware/auth.ts` | Express JWT auth middleware |
| `maestro-server/src/api/heartbeatRoutes.ts` | Heartbeat API endpoints |
| `maestro-server/src/infrastructure/redis/SessionPresenceWatcher.ts` | Agent liveness via key expiry |
| `maestro-cli/src/services/auth.ts` | CLI auth (login, token storage, refresh) |
| `maestro-cli/src/services/heartbeat.ts` | CLI heartbeat service |
| `maestro-cli/src/commands/auth.ts` | CLI auth commands |
| `maestro-server/.env.example` | Environment template |
| `docker-compose.dev.yml` | Local Redis + Postgres |
| `~/.cloudflared/config.yml` | Tunnel config (template) |

### Modified Files

| File | Changes |
|---|---|
| `maestro-server/src/server.ts` | CORS for tunnel, auth middleware, static serving, Socket.IO, health endpoints |
| `maestro-server/src/infrastructure/config/Config.ts` | Add `RedisConfig`, `SupabaseConfig`, `externalUrl` |
| `maestro-server/src/container.ts` | Wire Redis, Supabase, presence watcher |
| `maestro-server/package.json` | Add `@supabase/supabase-js`, `ioredis`, `socket.io` |
| `maestro-cli/src/config.ts` | Add `supabaseUrl`, `supabaseAnonKey`, `authEnabled` |
| `maestro-cli/src/commands/session.ts` | Start heartbeat on register |
| `maestro-cli/src/api.ts` | Attach auth token to API requests |
| `maestro-cli/src/index.ts` | Register `auth` command |
| `maestro-cli/package.json` | Add `@supabase/supabase-js` |

---

## 8. Coordination Notes

### For Realtime Engineer (Socket.IO)
- Auth middleware spec for Socket.IO is in Section 1.5
- Socket.IO CORS origins come from the same `allowedOrigins` array used by Express
- Namespace auth can be optional (`config.supabase.enabled` check)

### For Web App Engineer (Login UI)
- Use `@supabase/auth-ui-react` for login page
- Supabase URL and anon key come from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- After auth, attach JWT to all fetch() and Socket.IO handshake
- Protected routes: check `supabase.auth.getSession()` on mount

### For Redis Backend Engineer (Device Model)
- Device table schema is in Section 1.6
- Device registration happens server-side on Socket.IO connect
- CLI devices register via heartbeat API with device metadata

### For All Team Members (Cloudflare Tunnel)
- Public URL format: `https://maestro.yourdomain.com`
- WebSocket/Socket.IO works natively through the tunnel
- No special client-side config needed — just use the HTTPS URL
- Server detects tunnel via `EXTERNAL_URL` env var
