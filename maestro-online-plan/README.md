# Express + Redis + Socket.IO + Supabase + Cloudflare Integration

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          maestro-server                          │
│                                                                  │
│  Express REST API  +  Socket.IO Server  +  Redis Client          │
│  (agents use this)    (/mobile, /ui ns)    (events, presence,    │
│                                             locks)               │
│                                                                  │
│                     Supabase Client                              │
│                     (PostgreSQL repos, Auth, Storage)             │
└──────────────────────────────┬───────────────────────────────────┘
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

## Documents

| # | Document | Description |
|---|---|---|
| 01 | [Initial Zookeeper Analysis](./01-initial-zookeeper-analysis.md) | Analysis of current codebase architecture, communication layers, and initial Zookeeper integration study. Concluded ZK is outdated for this use case. |
| 02 | [Implementation Plan](./02-implementation-plan.md) | Comprehensive 7-phase plan for Express + Redis + Socket.IO + Cloudflare. Covers RedisEventBus, Socket.IO namespaces, agent liveness, Redis Streams mail, distributed locks, and Cloudflare Tunnel. |
| 03 | [Web App Plan](./03-web-app-plan.md) | Plan to compile the existing maestro-ui (React/Vite/Zustand) as a standalone web app for phone browser access. Same codebase, no terminal, responsive layout. |
| 04 | [Supabase Integration](./04-supabase-integration.md) | Multi-user persistent data layer via Supabase PostgreSQL. Replaces FileSystem repos. Adds auth, RLS, cloud storage. Hybrid with Redis for real-time. |

## Decision Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Coordination backbone | **Redis** | Zookeeper, NATS, Firebase RTDB | Redis serves as both event bus AND data store. Single dependency. No JVM. |
| Persistent data layer | **Supabase (PostgreSQL)** | Firebase Firestore, filesystem JSON | Full SQL, JOINs, RLS, open source, self-hostable. Server-side fits Express architecture. |
| Authentication | **Supabase Auth** | Firebase Auth, custom JWT | Multi-provider, RLS integration, same SDK as data layer. |
| Client push layer | **Socket.IO** | Raw WebSocket | Auto-reconnect, rooms, namespaces, mobile SDKs, fallback transport |
| Internet bridge | **Cloudflare Tunnel** | ngrok, Tailscale, VPS | Free, stable URL, zero open ports, auto-TLS |
| Phone app approach | **Web app (same repo)** | Native iOS/Android, React Native | 70-80% of UI code reusable. Ship in ~1 day. |

## Implementation Phases

```
Phase 0: Prerequisites (Redis, Cloudflare, Supabase project, npm deps)
   │
   ├──▶ Phase 0.5: Supabase repos + Auth (replace FileSystem repos)
   │
   ▼
Phase 1: RedisEventBus (replace InMemoryEventBus)
   │
   ├──▶ Phase 2: Socket.IO (replace raw ws) + Supabase auth middleware
   │       │
   │       └──▶ Phase 5: Mobile Socket.IO handlers (auth-gated)
   │               │
   │               └──▶ Phase 7: Cloudflare Tunnel
   │
   ├──▶ Phase 3: Agent Liveness (Redis key expiry)
   │
   ├──▶ Phase 4: Mail (already in Supabase from Phase 0.5)
   │
   └──▶ Phase 6: Distributed Locks (Redis)

Parallel: Web App Build (vite.config.web.ts, WebApp.tsx, stubs)
```

### Technology Split

| Layer | Technology | What It Handles |
|---|---|---|
| Persistent data | **Supabase PostgreSQL** | Projects, tasks, sessions, mail, team members, users |
| Authentication | **Supabase Auth** | Multi-user, JWT, OAuth providers, RLS |
| Real-time events | **Redis Pub/Sub** | Domain event bus (ephemeral, sub-ms) |
| Agent presence | **Redis key expiry** | Liveness detection, auto-cleanup |
| Distributed locks | **Redis SET NX EX** | Task assignment race prevention |
| Push to clients | **Socket.IO** | UI/mobile real-time updates, rooms, namespaces |
| File storage | **Supabase Storage** | Docs, session recordings, large files |
| Internet access | **Cloudflare Tunnel** | Expose localhost to phone, auto-TLS |

## Quick Start (After Implementation)

```bash
# 1. Start Redis
brew services start redis

# 2. Configure Supabase (set env vars)
export SUPABASE_ENABLED=true
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_ANON_KEY=eyJ...
export SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 3. Build web app
cd maestro-ui && npm run build:web

# 4. Start server (serves API + web app)
cd maestro-server && bun run src/server.ts

# 5. Start Cloudflare tunnel
cloudflared tunnel run maestro

# 6. Open on phone
# → https://maestro.yourdomain.com
```
