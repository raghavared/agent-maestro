# Express + Redis + Socket.IO + Cloudflare Integration

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       maestro-server                       │
│                                                            │
│  Express REST API  +  Socket.IO Server  +  Redis Client   │
│  (agents use this)    (/mobile, /ui ns)    (events, mail,  │
│                                             presence,      │
│                                             locks)         │
└──────────────────────────┬─────────────────────────────────┘
                           │
                    Cloudflare Tunnel
                  (maestro.yourdomain.com)
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  📱 Phone   │ │ 🖥️ Tauri │ │  Agent CLI  │
     │  Web App    │ │ Desktop  │ │  REST API   │
     │  (browser)  │ │ Socket.IO│ │             │
     └─────────────┘ └──────────┘ └─────────────┘
```

## Documents

| # | Document | Description |
|---|---|---|
| 01 | [Initial Zookeeper Analysis](./01-initial-zookeeper-analysis.md) | Analysis of current codebase architecture, communication layers, and initial Zookeeper integration study. Concluded ZK is outdated for this use case. |
| 02 | [Implementation Plan](./02-implementation-plan.md) | Comprehensive 7-phase plan for Express + Redis + Socket.IO + Cloudflare. Covers RedisEventBus, Socket.IO namespaces, agent liveness, Redis Streams mail, distributed locks, and Cloudflare Tunnel. |
| 03 | [Web App Plan](./03-web-app-plan.md) | Plan to compile the existing maestro-ui (React/Vite/Zustand) as a standalone web app for phone browser access. Same codebase, no terminal, responsive layout. |

## Decision Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Coordination backbone | **Redis** | Zookeeper, NATS, Firebase RTDB | Redis serves as both event bus AND data store. Single dependency. No JVM. |
| Client push layer | **Socket.IO** | Raw WebSocket | Auto-reconnect, rooms, namespaces, mobile SDKs, fallback transport |
| Internet bridge | **Cloudflare Tunnel** | ngrok, Tailscale, VPS | Free, stable URL, zero open ports, auto-TLS |
| Phone app approach | **Web app (same repo)** | Native iOS/Android, React Native | 70-80% of UI code reusable. Ship in ~1 day. |

## Implementation Phases

```
Phase 0: Prerequisites (Redis, Cloudflare, npm deps)
   │
   ▼
Phase 1: RedisEventBus (replace InMemoryEventBus)
   │
   ├──▶ Phase 2: Socket.IO (replace raw ws)
   │       │
   │       └──▶ Phase 5: Mobile Socket.IO handlers
   │               │
   │               └──▶ Phase 7: Cloudflare Tunnel
   │
   ├──▶ Phase 3: Agent Liveness (Redis key expiry)
   │
   ├──▶ Phase 4: Redis Streams Mail (replace filesystem)
   │
   └──▶ Phase 6: Distributed Locks

Parallel: Web App Build (vite.config.web.ts, WebApp.tsx, stubs)
```

## Quick Start (After Implementation)

```bash
# 1. Start Redis
brew services start redis

# 2. Build web app
cd maestro-ui && npm run build:web

# 3. Start server (serves API + web app)
cd maestro-server && bun run src/server.ts

# 4. Start Cloudflare tunnel
cloudflared tunnel run maestro

# 5. Open on phone
# → https://maestro.yourdomain.com
```
