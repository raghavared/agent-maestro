# Memory Leaks & Resource Cleanup Analysis

**Date:** 2026-03-09
**Scope:** All 3 packages (maestro-server, maestro-cli, maestro-ui)
**Focus:** Session create/destroy lifecycle, unbounded collections, event listener leaks, process handles

---

## Executive Summary

Found **25+ distinct memory leak / resource cleanup issues** across the codebase. The most critical are:
1. **WebSocketBridge** subscribes to 17 events but never unsubscribes
2. **FileSystemSessionRepository.sessionIndex** grows unbounded (every session ever created)
3. **Child processes** spawned without kill/cleanup mechanisms
4. **Container shutdown** only cleans EventBus, ignoring all caches and repositories
5. **Audio event listeners** in UI soundManager never removed

---

## CRITICAL Issues

### 1. WebSocketBridge Event Listener Accumulation
**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` (lines 79-127)

In `setupEventHandlers()`, the bridge subscribes to **17 domain events** via `eventBus.on()`, but these listeners are **NEVER removed**. No `shutdown()` method exists.

```typescript
// Line 121: Subscribes with NO unsubscribe
this.eventBus.on(event, (data) => {
  this.broadcast(event, data);
});
```

Events: project:created/updated/deleted, task:created/updated/deleted, session:created/spawn/resume/updated/deleted, notify:*, team_member:*

**Impact:** If multiple bridge instances are created or server restarts within process, listeners accumulate in InMemoryEventBus indefinitely.

**Fix:** Add `shutdown()` method that calls `eventBus.off()` for all registered handlers. Store handler references at registration time.

---

### 2. FileSystemSessionRepository - Unbounded sessionIndex
**File:** `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` (lines 38-40)

```typescript
private sessions: Map<string, Session>;              // Active sessions only
private sessionIndex: Map<string, SessionIndexEntry>; // ALL sessions (ever)
```

`sessionIndex` is populated during init (line 212) and saves (line 160), but entries are only removed on explicit delete (line 419). Terminal sessions (completed/failed/stopped) are never evicted.

**Impact:** After months of uptime with high session turnover, sessionIndex contains millions of entries. Every `findAll`/`findByProjectId`/`findByTaskId` iterates the entire index (lines 344-363).

**Fix:** Implement TTL-based eviction for terminal sessions, or periodically prune entries older than N days. Add max size cap.

---

### 3. Container Shutdown is Incomplete
**File:** `maestro-server/src/container.ts` (lines 191-195)

```typescript
async shutdown() {
  logger.info('Shutting down container...');
  eventBus.removeAllListeners();
  logger.info('Container shutdown complete');
}
```

Only cleans `eventBus`. **Not cleaned:**
- `loaderCache` in `MultiScopeSkillLoader`
- `cache` in `FileSystemSkillLoader` / `ClaudeCodeSkillLoader`
- `pathCache` in `LogDigestService`
- All repository Map collections (`sessions`, `sessionIndex`, `tasks`, `projects`, etc.)
- WebSocketBridge (17 event listener subscriptions)

**Fix:** Implement `shutdown()` on all services and repositories. Call them from container shutdown.

---

### 4. Child Processes Spawned Without Cleanup
**Files:**
- `maestro-cli/src/services/claude-spawner.ts` (line 216)
- `maestro-cli/src/services/codex-spawner.ts`
- `maestro-cli/src/services/gemini-spawner.ts` (line 132)
- `maestro-cli/src/services/hook-executor.ts` (line 109)
- `maestro-cli/src/services/spawn-with-ulimit.ts` (lines 42-59)
- `maestro-server/src/api/sessionRoutes.ts` (lines 138-182)

Child processes are spawned but:
- No `.unref()` on child process (keeps event loop alive)
- No timeout mechanism to kill hung processes
- No signal handler to kill children on parent crash
- stdout/stderr listeners never explicitly removed
- If parent crashes, children become orphans

**Fix:** Add process tracking, timeout-based kill, and SIGTERM forwarding on parent exit.

---

## HIGH Severity Issues

### 5. LogDigestService pathCache Unbounded
**File:** `maestro-server/src/application/services/LogDigestService.ts` (line 73)

```typescript
private pathCache = new Map<string, PathCacheEntry>();
```

Cache entries are set but only re-validated on TTL expiry; old entries are never proactively removed. No `clear()` method. Not cleaned on shutdown.

**Impact:** O(number of unique sessions ever queried) memory growth.

**Fix:** Add max cache size with LRU eviction, or periodic cleanup of stale entries.

---

### 6. MultiScopeSkillLoader - Unbounded Nested Caches
**File:** `maestro-server/src/infrastructure/skills/MultiScopeSkillLoader.ts` (line 32)

```typescript
private loaderCache: Map<string, ClaudeCodeSkillLoader> = new Map();
```

Loaders created per directory, never evicted. Each loader has its own unbounded `cache: Map<string, Skill>`.

**Fix:** Add cache size limit or TTL-based eviction.

---

### 7. All In-Memory Repository Collections Lack Eviction
**Files:**
- `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` (lines 38, 40, 50-51)
- `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts` (line 24)
- `maestro-server/src/infrastructure/repositories/FileSystemTaskListRepository.ts` (line 24)
- `maestro-server/src/infrastructure/repositories/FileSystemProjectRepository.ts` (line 19)
- `maestro-server/src/infrastructure/repositories/FileSystemOrderingRepository.ts` (line 20)

All repositories use in-memory Maps that grow with data volume. No eviction, no max size, no cleanup on shutdown.

---

### 8. WebSocket Subscriptions Map - Stale Client References
**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` (line 17)

```typescript
private subscriptions = new Map<WebSocket, Set<string>>();
```

Only cleaned on 'close' event (line 31-33). If a client disconnects ungracefully or error handling fires before 'close', the Map entry persists. Each broadcast iterates ALL entries.

**Fix:** Also delete on 'error' event. Add periodic sweep for dead connections.

---

### 9. CLI Storage Maps Load Entire Dataset
**File:** `maestro-cli/src/storage.ts` (lines 16-18)

```typescript
private projects = new Map<string, StoredProject>();
private tasks = new Map<string, StoredTask>();
private sessions = new Map<string, StoredSession>();
```

All populated from disk reads during init (lines 29-73). No eviction policy. For large datasets, all data sits in memory for entire CLI process lifetime.

---

### 10. CLI Fetch Requests Without Timeout
**File:** `maestro-cli/src/api.ts` (lines 25-90)

`node-fetch` used without explicit timeout. Response body read (`response.text()`, `response.json()`) without timeout. Retry loop has exponential backoff but no total timeout cap.

**Fix:** Add AbortController with timeout, add max total retry duration.

---

### 11. CLI WebSocket Connections - Race Conditions & Dangling Promises
**Files:**
- `maestro-cli/src/commands/session.ts` (lines 416-534)
- `maestro-cli/src/commands/modal.ts` (lines 220-303)

Issues:
- Duplicate 'close' listeners registered (line 301, 533)
- Race condition: readyState check before close (ws state may change between check and close)
- Promise waiting for 'close' event may never resolve if connection reset
- No SIGTERM/SIGINT handlers for graceful shutdown
- Timeout only cleared in `cleanup()` - if 'open' never fires, cleanup never called

---

## MEDIUM Severity Issues

### 12. Process Signal Handlers Accumulate
**File:** `maestro-server/src/server.ts` (lines 211-212)

```typescript
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
```

No `process.removeListener()`. If server restarts within same process (tests), handlers accumulate.

---

### 13. InMemoryEventBus MaxListeners
**File:** `maestro-server/src/infrastructure/events/InMemoryEventBus.ts` (line 18)

Hardcoded to 100. With 17 events from WebSocketBridge + 6+ services, could be exceeded with multiple instances.

---

### 14. Stale Closure in sessionRoutes Child Process
**File:** `maestro-server/src/api/sessionRoutes.ts` (lines 138-182)

Promise closure captures child process handle, stdout/stderr buffers (unbounded string growth), and full environment object. If process hangs, all captured references leak.

---

### 15. CLI Hook Executor - stdout/stderr Accumulation
**File:** `maestro-cli/src/services/hook-executor.ts` (lines 114-120)

```typescript
let stdout = '';
let stderr = '';
child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
```

String concatenation accumulates entire command output. For commands with large output, memory usage spikes.

---

### 16. UI soundManager - Audio Event Listeners Never Removed
**File:** `maestro-ui/src/services/soundManager.ts` (lines 662, 689, 693)

```typescript
audio.addEventListener('error', () => { ... });
audio.addEventListener('ended', () => { ... });
```

Event listeners added to audio elements but never removed when playback completes or component unmounts.

**Fix:** Remove listeners in cleanup or use `{ once: true }` option.

---

### 17. UI activeModals Array Can Grow Unbounded
**File:** `maestro-ui/src/stores/useMaestroStore.ts` (line 49)

```typescript
activeModals: AgentModal[];
```

No maximum size cap. In long-running sessions with many modal interactions, memory grows linearly.

---

### 18. UI useKeyboardShortcuts - Excessive Re-registration
**File:** `maestro-ui/src/hooks/useKeyboardShortcuts.ts` (lines 414-439)

23-item dependency array causes event listener to be removed and re-added on every modal state change.

---

## LOW Severity Issues

### 19. CLI Worker/Orchestrator Exit Listeners
**Files:**
- `maestro-cli/src/commands/worker-init.ts` (line 195)
- `maestro-cli/src/commands/orchestrator-init.ts` (line 180)
- `maestro-cli/src/commands/worker-resume.ts` (line 53)

Exit listeners registered on spawned processes but have no cleanup logic. Persist for entire process lifetime.

### 20. CLI spawn-with-ulimit - stdio Streams Not Destroyed
**File:** `maestro-cli/src/services/spawn-with-ulimit.ts` (lines 42-59)

stdio set to 'pipe' creates streams that are never explicitly destroyed if child crashes.

### 21. CLI sessionStatuses Map Growth
**File:** `maestro-cli/src/commands/session.ts` (line 411)

Map grows with watched session IDs throughout entire watch session. No TTL or size limits.

### 22. UI useMaestroWebSocket Global Listeners
**File:** `maestro-ui/src/hooks/useMaestroWebSocket.ts` (lines 8-10)

Global listener set could accumulate if cleanup doesn't fire properly between component remounts.

---

## Session Create/Destroy Lifecycle Analysis

### Session Creation Path:
1. Session created via API → saved to FileSystemSessionRepository
2. Added to `sessions` Map (active) AND `sessionIndex` Map (permanent)
3. WebSocketBridge broadcasts `session:created` event to all connected clients
4. Event handlers fire in TaskListService, TeamService, etc.

### Session Destruction Path (ISSUES):
1. Session deleted via API → removed from `sessions` Map
2. `sessionIndex` entry removed (only on explicit delete, NOT on session completion/failure)
3. **Missing cleanup:**
   - No event listener cleanup in WebSocketBridge (listeners live forever)
   - No cache cleanup in LogDigestService (pathCache entries persist)
   - No cleanup signal to CLI spawned processes
   - UI WebSocket receives `session:deleted` but audio listeners may persist
   - If session transitions to terminal state (completed/failed) WITHOUT delete, sessionIndex entry is permanent

### Recommended Lifecycle Fixes:
1. Add `onSessionTerminated` hook that cleans up all related caches
2. Implement periodic sweep of terminal sessions from sessionIndex
3. Add WebSocketBridge cleanup for session-scoped subscriptions
4. Forward SIGTERM to child processes when session is destroyed
5. Clear LogDigestService pathCache entries for destroyed sessions

---

## Priority Recommendations

### P0 (Fix Immediately):
1. Add `WebSocketBridge.shutdown()` with listener cleanup
2. Add eviction to `FileSystemSessionRepository.sessionIndex`
3. Expand `container.shutdown()` to clean all resources
4. Add child process timeout + kill mechanism

### P1 (Fix Soon):
5. Add max size to `LogDigestService.pathCache`
6. Add max size to `MultiScopeSkillLoader.loaderCache`
7. Add fetch timeout in CLI api.ts
8. Fix CLI WebSocket race conditions and dangling promises

### P2 (Fix When Convenient):
9. Add eviction to all repository Maps
10. Fix soundManager audio listener cleanup
11. Add SIGTERM handlers to CLI WebSocket commands
12. Cap activeModals array size
