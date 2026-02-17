# Maestro Online: Technical Lead Design Review

**Reviewer:** Integration Lead
**Date:** 2026-02-17
**Documents Reviewed:**
- `01-data-layer-architecture.md` — Redis Backend Engineer
- `02-realtime-architecture.md` — Realtime Engineer
- `03-web-app-architecture.md` — Web App Engineer
- `04-infrastructure-architecture.md` — CLI & Infra Engineer

---

## Executive Summary

The four architecture documents collectively define a coherent system for taking Maestro from a single-user local desktop app to a multi-device, multi-user online platform. The team has produced ~192KB of specification covering data persistence (Supabase/PostgreSQL), real-time communication (Socket.IO + Redis Pub/Sub), a dual-target web app (Vite + PlatformService abstraction), and infrastructure (auth, Cloudflare Tunnel, CLI heartbeat).

**Overall verdict: Strong foundation, ready for implementation with targeted fixes.** The architecture respects Maestro's existing domain-driven design, leverages clean interface boundaries for non-breaking migration, and provides feature-flag rollback at every phase. Below I identify cross-cutting issues, gaps, conflicts, risks, and recommendations.

---

## 1. Architecture Strengths

### 1.1 Interface-Driven Migration
The single strongest architectural decision across all documents is preserving the existing `I*Repository` and `IEventBus` interfaces. Every new implementation (SupabaseTaskRepository, RedisEventBus, SocketIOBridge) implements the same contracts. This means:
- Zero domain layer changes
- Feature-flag rollback to filesystem/in-memory at any time
- Incremental adoption — each subsystem can be enabled independently

### 1.2 Dual-Delivery EventBus Pattern
The RedisEventBus design (Doc 01, Section 3.3) with `sourceId`-based dedup is elegant. Local delivery ensures `MailService.waitForMail()` continues working synchronously within a single process, while Redis Pub/Sub enables cross-process fan-out. This is the right pattern for a system that may or may not have multiple server instances.

### 1.3 PlatformService Abstraction (Doc 03)
The `PlatformService` interface with build-time `import()` switching is the correct approach for dual-target builds. It avoids `if (__IS_WEB__)` checks scattered throughout components and enables Vite to tree-shake the unused platform entirely. The interface surface is comprehensive — covering PTY, filesystem, window management, and secure storage.

### 1.4 Feature-Flag Rollback Matrix
Every document independently defines rollback mechanisms via environment variables. The combined matrix (REDIS_ENABLED, SUPABASE_ENABLED, EXTERNAL_URL) allows any combination of local-only, Redis-only, full-cloud, or hybrid deployments. This is critical for a system that must remain functional as a local desktop app.

### 1.5 Terminal Proxy Design
The terminal proxy architecture (Doc 02, Section 5) correctly identifies that PTY lives in Tauri's Rust backend and cannot be directly accessed from the web. The Tauri → Socket.IO → Server → Socket.IO → Browser pipeline with a RingBuffer for scrollback is a practical solution. The 16ms batching + 4KB flush threshold for backpressure is well-calibrated for 60fps rendering.

---

## 2. Cross-Cutting Concerns & Consistency Issues

### 2.1 Duplicate Terminal Proxy Definitions

**Conflict:** Doc 02 (Realtime) and Doc 03 (Web App) both define terminal proxy implementations, and they are architecturally different:

- **Doc 02** designs the terminal proxy as Tauri forwarding PTY output to the server via `/ui` namespace, with the server buffering in a RingBuffer and re-broadcasting to `/terminal` namespace watchers. No `node-pty` on the server.
- **Doc 03** (Section 12.2) proposes a `TerminalProxy.ts` using `node-pty` directly on the server, spawning PTY processes server-side for web clients.

**Resolution:** Doc 02's approach is correct. The PTY already runs in Tauri's Rust backend. The server should NOT spawn its own PTY processes via `node-pty` — this would create a second, disconnected terminal that the desktop user can't see. The server acts as a relay, not a PTY host. Doc 03's `TerminalProxy.ts` with `node-pty` should be removed from the plan.

**Exception:** If we want web-only users (no desktop app running) to spawn terminal sessions, then server-side PTY via `node-pty` becomes necessary. This should be explicitly scoped as a Phase 2 feature, not the initial architecture.

### 2.2 Duplicate Device Table Definitions

Both Doc 01 (Section 2.9) and Doc 04 (Section 1.6) define the `devices` table schema with slightly different column sets:

| Column | Doc 01 | Doc 04 |
|--------|--------|--------|
| `type` CHECK values | `mobile, desktop, web, cli` | `phone, desktop, cli` |
| `platform` values | `ios, android, macos, linux, windows, web` | `ios, android, macos, linux` |
| `socket_id` | Present | Absent |
| `push_token` | Present | Present |
| `last_seen_at` vs `last_seen` | `last_seen_at` | `last_seen` |

**Resolution:** Adopt Doc 01's schema as canonical — it's more complete. Normalize `type` values to `mobile, desktop, web, cli` (not `phone`). Include `socket_id` for tracking active Socket.IO connections.

### 2.3 Supabase Client Creation Pattern

**Doc 04** creates a new `createClient()` instance per auth middleware invocation:
```typescript
const supabase = createClient(options.supabaseUrl, options.supabaseAnonKey);
const { data: { user } } = await supabase.auth.getUser(token);
```

This is wasteful — each `createClient()` call initializes internal state. The client should be created once and reused.

**Resolution:** Create the Supabase client once in the middleware factory (closure scope) or inject it from the container. The `SupabaseClientManager` from Doc 01 should be the single source of Supabase client instances.

### 2.4 Auth Token Storage on Web — localStorage vs In-Memory

**Doc 03** stores JWT in `localStorage`:
```typescript
localStorage.setItem('maestro-auth-token', token);
```

**Doc 04** mentions:
> "After auth, store JWT in memory (not localStorage for security)"

**Resolution:** For an internal tool accessed via Cloudflare tunnel, `localStorage` is acceptable and pragmatically better (survives page refreshes). The "in-memory only" approach would force re-login on every tab close, which is a poor UX. Use `localStorage` but ensure the token is a short-lived JWT (1 hour) with refresh token flow.

### 2.5 SessionPresenceWatcher — Duplicate Subscriber Issue

Both Doc 01 (Section 3.4) and Doc 04 (Section 4.5) define `SessionPresenceWatcher`. They subscribe to `__keyevent@0__:expired` on the sub client, but Doc 04 also calls `.duplicate()` to create a separate subscriber connection.

**Conflict:** The RedisEventBus (Doc 01) already uses the sub client for event channel subscriptions. If the SessionPresenceWatcher also subscribes on the same sub client, Redis subscriber mode restrictions may cause issues (subscriber clients can only run SUBSCRIBE/UNSUBSCRIBE/PONG commands).

**Resolution:** The SessionPresenceWatcher MUST use a dedicated (4th) Redis connection for keyspace event subscriptions, separate from the EventBus subscriber. Doc 04's `.duplicate()` approach is correct. Update `RedisClientManager` to expose a `createDedicatedSubscriber()` method, or document that presence watching requires its own connection.

---

## 3. Gaps & Missing Pieces

### 3.1 No Project Access Control in API Routes

The auth middleware validates the JWT and populates `req.userId`, but **no route checks whether the user has access to the requested project**. For example:

```
GET /api/tasks?projectId=proj_123
```

Currently, any authenticated user can read any project's tasks. The RLS policies in Supabase handle this at the database level if using the user's JWT, but the server uses `service_role` key (bypasses RLS).

**Recommendation:** Add a `projectAccessMiddleware` that checks `project_members` table membership before allowing project-scoped operations. This is critical for multi-user deployments.

### 3.2 No Token Refresh Strategy for Socket.IO

Doc 02 (Section 6.3) mentions token refresh for Socket.IO but proposes `socket.disconnect().connect()` which drops the connection and all room subscriptions. During reconnection, the client loses events.

**Recommendation:** Use Socket.IO's `auth` update mechanism without full disconnect:
```typescript
socket.auth = { ...socket.auth, token: newToken };
socket.emit('auth:refresh', { token: newToken });
```
The server middleware should re-validate on this event rather than requiring reconnection. If full reconnect is unavoidable, use `connectionStateRecovery` to replay missed events.

### 3.3 No Rate Limiting

None of the documents define rate limiting for:
- REST API endpoints (task creation, mail sending)
- Socket.IO events (terminal:input, mail:send)
- Auth endpoints (login attempts)

Doc 02 mentions rate limiting in Section 14 (Security) as a bullet point but provides no implementation.

**Recommendation:** Add rate limiting as a concrete requirement:
- Auth endpoints: 5 attempts per minute per IP
- REST API: 100 requests per minute per user
- Socket.IO terminal:input: 100 events per second per session (prevent key-flooding)
- Use `express-rate-limit` for REST, Socket.IO middleware for socket events

### 3.4 No Data Validation Layer for Socket.IO Events

Socket.IO events from mobile/web clients accept payloads without schema validation. For example, `session:spawn` accepts arbitrary `payload` and passes it to `sessionService.create()`. This is an injection risk.

**Recommendation:** Add `zod` or `joi` validation schemas for all client-to-server Socket.IO events. Validate before processing.

### 3.5 No Offline/Queuing Strategy for Mobile

When the phone loses network connectivity:
- REST calls fail silently
- Socket.IO disconnects and queues events via `connectionStateRecovery` (2 min window)
- No local persistence of pending actions

**Recommendation:** For Phase 1, the 2-minute recovery window is acceptable. For Phase 2, consider a lightweight action queue in localStorage that replays pending mutations on reconnect.

### 3.6 File System REST API Security (Doc 03, Section 12.3)

The proposed `/api/fs/list`, `/api/fs/read`, `/api/fs/write` endpoints accept arbitrary filesystem paths. This is a **critical security vulnerability** — an authenticated user could read `/etc/passwd`, `~/.ssh/id_rsa`, or write to system files.

**Recommendation:** Either:
1. **Restrict to project working directories only** — validate that the requested path is within the project's `workingDir`
2. **Remove entirely** — the web app doesn't strictly need filesystem access. Task/session/team management works via REST API. Terminal access handles command execution. File browsing can be deferred to a future phase with proper sandboxing.

I strongly recommend option 2 for the initial release.

### 3.7 Missing Auth Endpoints on Server

Doc 04 defines CLI auth commands and Doc 03 defines `AuthGate` with `POST /api/auth/login` and `POST /api/auth/signup`, but neither document includes the server-side implementation of these endpoints.

**Recommendation:** Add an `authRoutes.ts` to maestro-server that proxies to Supabase Auth:
```typescript
router.post('/auth/login', async (req, res) => {
  const { data, error } = await supabase.auth.signInWithPassword(req.body);
  // Return session token
});
```
These routes should be excluded from the auth middleware (they're pre-auth).

### 3.8 No Monitoring/Observability

No document mentions:
- Structured logging format
- Error tracking (Sentry, etc.)
- Metrics (connection counts, event throughput, latency)
- Alerting on session failures

**Recommendation:** Add as a Phase 2 concern. For Phase 1, ensure the existing console logging is sufficient and that the `/health` and `/ready` endpoints provide basic monitoring.

---

## 4. Risks & Mitigations

### 4.1 Redis as Single Point of Failure

**Risk:** With Redis handling events, presence, locks, and session cache, a Redis crash takes down all real-time features.

**Mitigation (already addressed):** Feature flags allow fallback to InMemoryEventBus. The application continues functioning without Redis — just loses cross-process events and presence tracking. This is acceptable for single-server deployments.

**Additional mitigation:** Add Redis reconnection logic in `RedisClientManager` with exponential backoff. The `ioredis` library handles this natively via `retryStrategy`, which is already configured.

### 4.2 Terminal Proxy Latency

**Risk:** Terminal I/O traverses: Rust PTY → Tauri event → JS WebView → Socket.IO `/ui` → Server → Socket.IO `/terminal` → Remote Browser. Each hop adds latency. For interactive shells, >100ms round-trip makes typing feel sluggish.

**Mitigation:**
- The 16ms batching helps with output rendering
- Input events are fire-and-forget (no ack needed), so perceived input latency is just network RTT
- Cloudflare tunnel adds ~10-30ms. Total round-trip should be 50-80ms for most cases — acceptable but not instant
- Document the latency expectations for users

### 4.3 Large State Sync on Mobile Connect

**Risk:** `state:sync` fetches ALL sessions, tasks, and team members for a project. For projects with thousands of tasks, this could be a multi-MB payload on a slow mobile connection.

**Mitigation:** Add pagination or filtering to `state:sync`:
- Only return active/recent sessions (last 7 days)
- Only return non-archived tasks
- Send task counts per status instead of full task objects for initial load
- Lazy-load full details on demand

### 4.4 Cloudflare Tunnel Stability

**Risk:** Cloudflare tunnel disconnections cause all remote clients to lose access. Unlike a proper deployment, the tunnel runs on the developer's machine and depends on their internet connection.

**Mitigation:**
- Socket.IO's reconnection logic handles brief outages
- Document that this is a "personal cloud" setup, not production hosting
- Consider adding connection status indicators prominently in the web UI (already designed in TopBar)

### 4.5 container.ts Merge Conflicts

**Risk:** Multiple engineers modifying `container.ts` simultaneously (Supabase repos, Redis services, Socket.IO bridge, presence watcher) will create merge conflicts.

**Mitigation:** Define a clear ordering for container.ts changes:
1. Redis Backend Engineer: Add RedisClientManager, RedisEventBus, DistributedLock, SupabaseRepos
2. Realtime Engineer: Add SocketIOBridge (depends on #1)
3. CLI & Infra Engineer: Add SessionPresenceWatcher, auth middleware (depends on #1)
4. Web App Engineer: No container.ts changes (works at UI level)

Execute these in sequence or use well-defined injection points.

---

## 5. Architectural Recommendations

### 5.1 Consolidate Terminal Strategy

Create a single, canonical terminal proxy design document that merges Doc 02's relay approach with Doc 03's component design. The architecture should be:

```
Phase 1 (Desktop-relayed): PTY in Tauri → Socket.IO relay → Remote browser
Phase 2 (Server-native):   PTY in node-pty → Socket.IO direct → Any browser
```

Phase 1 requires the desktop app to be running. Phase 2 enables headless/server-only operation.

### 5.2 Add an API Gateway Pattern

Currently, auth validation happens per-request via Supabase API call (`getUser(token)`). For high-frequency Socket.IO events, this is expensive.

**Recommendation:** Cache validated tokens in Redis with short TTL (5 minutes):
```
maestro:auth:{tokenHash} → { userId, email, expiresAt }  TTL=300s
```
First validation hits Supabase, subsequent requests hit Redis cache. This reduces Supabase API calls by ~95% for active sessions.

### 5.3 Define a Clear Error Contract

All four documents use different error response formats. Standardize on:

```typescript
interface ApiError {
  error: true;
  code: string;        // Machine-readable: AUTH_REQUIRED, NOT_FOUND, VALIDATION_ERROR
  message: string;     // Human-readable description
  details?: unknown;   // Optional validation details
}
```

Apply consistently across REST API and Socket.IO ack responses.

### 5.4 Add Integration Test Strategy

None of the documents address testing. For a system with this many moving parts (Express + Socket.IO + Redis + Supabase + Cloudflare), integration tests are essential.

**Recommendation:**
- Unit tests: Each new repository, event bus, and service (mock Redis/Supabase)
- Integration tests: Full server boot with real Redis, mock Supabase
- E2E tests: Socket.IO client connects, subscribes, receives events
- Use `testcontainers` for Redis in CI

### 5.5 Implement Connection Health UI

The web app should show connection state prominently — users on phones need to know if they're connected, reconnecting, or offline. Doc 03's `ConnectionIndicator` in the TopBar is the right pattern. Ensure it reflects:
- Socket.IO connection state (connected/reconnecting/disconnected)
- Last successful sync timestamp
- Pending actions count (if implementing offline queue)

---

## 6. Implementation Phasing Recommendation

Based on dependency analysis and risk assessment, I recommend the following execution order:

### Phase 0: Prerequisites (1 day)
- Install Redis locally, verify docker-compose.dev.yml works
- Add npm dependencies to maestro-server and maestro-cli
- Create `.env.example` files
- **Owner:** CLI & Infra Engineer

### Phase 1: Redis Foundation (2-3 days)
- `RedisClientManager` + `RedisEventBus` + `DistributedLock`
- `container.ts` conditional wiring (Redis/InMemory)
- `Config.ts` additions (RedisConfig)
- Unit tests for RedisEventBus
- **Owner:** Redis Backend Engineer
- **Blocks:** Everything else

### Phase 2: Supabase Data Layer (3-4 days, parallel with Phase 3)
- All 6 `Supabase*Repository` implementations
- Schema SQL migration file
- `container.ts` conditional wiring (Supabase/FileSystem)
- camelCase ↔ snake_case mapping layer
- Migration script (FileSystem → Supabase)
- **Owner:** Redis Backend Engineer
- **Requires:** Phase 1

### Phase 3: Socket.IO Bridge (3-4 days, parallel with Phase 2)
- `SocketIOBridge` with 4 namespaces
- Event routing for all 27 domain events
- Replace WebSocketBridge in server.ts
- Terminal relay (Tauri → Server → Remote)
- RingBuffer + backpressure
- **Owner:** Realtime Engineer
- **Requires:** Phase 1

### Phase 4: Auth & Infrastructure (2-3 days, parallel with Phases 2-3)
- Express auth middleware
- CLI auth service + commands
- Server-side auth routes (`/api/auth/login`, `/api/auth/signup`)
- Socket.IO namespace auth
- CLI heartbeat service + server heartbeat API
- SessionPresenceWatcher
- **Owner:** CLI & Infra Engineer
- **Requires:** Phase 1

### Phase 5: Web App (5-6 days, can start during Phases 2-4)
- Vite web config + build system
- PlatformService interface + Web/Tauri implementations
- WebApp shell, MobileLayout, BottomNav, TopBar
- AuthGate + auth service
- Socket.IO event bridge
- Session/Task/Team tab views
- WebTerminal component
- PWA manifest
- **Owner:** Web App Engineer
- **Requires:** Phase 3 (Socket.IO), Phase 4 (Auth endpoints)

### Phase 6: Cloudflare Tunnel + Integration (1-2 days)
- Cloudflare tunnel setup + config
- CORS configuration for tunnel domain
- Static file serving in server.ts
- End-to-end testing: Phone → Tunnel → Server → Desktop
- **Owner:** CLI & Infra Engineer
- **Requires:** Phases 2-5

### Phase 7: Hardening (2-3 days)
- Rate limiting (REST + Socket.IO)
- Input validation (zod schemas for Socket.IO events)
- Remove or sandbox filesystem REST API
- Project access control middleware
- Error response standardization
- Integration tests
- **Owner:** All engineers

**Total estimated effort: ~20-25 engineering days across 4 engineers, with ~3 weeks calendar time (due to parallelism).**

---

## 7. Open Questions for Project Owner

1. **Server-side PTY:** Should web clients be able to spawn terminal sessions when the desktop app is NOT running? If yes, we need `node-pty` on the server (Phase 2 scope). If no, the terminal proxy relay is sufficient.

2. **Multi-user scope:** Is this initially single-user (your devices only) or multi-user from day one? Single-user simplifies auth significantly (could skip project_members, RLS, and some access control).

3. **Filesystem API:** Do web/phone clients need to browse files on the server machine? This is a significant security surface. Can it be deferred?

4. **Push notifications:** Doc 01 includes `push_token` in the devices table. Is FCM/APNS push notification support needed for Phase 1, or can it wait?

5. **Supabase vs self-hosted Postgres:** The architecture supports both (via `SUPABASE_ENABLED` flag), but should we prioritize Supabase cloud or local PostgreSQL with a direct connection?

---

## 8. Conclusion

The team has produced a comprehensive and well-reasoned architecture. The key strengths — interface preservation, feature-flag rollback, dual-delivery event bus, and platform abstraction — demonstrate mature engineering judgment. The identified issues (terminal proxy conflict, missing access control, filesystem API security, rate limiting gaps) are all addressable without architectural changes.

The system is ready to move from design to implementation. I recommend starting with Phase 1 (Redis foundation) immediately, as it unblocks all subsequent parallel work.

**Sign-off:** Approved for implementation with the noted fixes.
