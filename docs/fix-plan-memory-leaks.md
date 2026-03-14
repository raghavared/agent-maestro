# Fix Plan: Memory Leaks & Resource Lifecycle (Group 7)

**Date:** 2026-03-09
**Reference:** docs/memory-leaks-analysis.md
**Scope:** maestro-server, maestro-cli, maestro-ui

---

## Fix 1: WebSocketBridge — Add `shutdown()` with Listener Cleanup

**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Priority:** P0
**Risk:** Low — additive change, no behavior change until shutdown is called

### Current Problem
`setupEventHandlers()` subscribes to 30+ domain events via `eventBus.on()` using anonymous arrow functions. These listeners are never removed. No `shutdown()` method exists.

### Plan
1. Store handler references in a `Map<string, EventHandler>` field (`private handlers`) during `setupEventHandlers()`.
2. Add `shutdown()` method that:
   - Iterates `this.handlers` and calls `this.eventBus.off(event, handler)` for each.
   - Clears `this.handlers`.
   - Clears `this.subscriptions`.
3. In `setupConnectionHandlers()`, also delete from `this.subscriptions` on `'error'` event (currently only on `'close'`).

### Code Sketch
```typescript
// Field
private handlers = new Map<string, (data: any) => void>();

// In setupEventHandlers():
for (const event of events) {
  const handler = (data: any) => this.broadcast(event, data);
  this.handlers.set(event, handler);
  this.eventBus.on(event, handler);
}

// New method:
shutdown(): void {
  for (const [event, handler] of this.handlers) {
    this.eventBus.off(event, handler);
  }
  this.handlers.clear();
  this.subscriptions.clear();
  this.logger.info('WebSocketBridge shut down');
}
```

### Integration
In `server.ts` graceful shutdown, call `wsBridge.shutdown()` before `container.shutdown()`.

---

## Fix 2: FileSystemSessionRepository — sessionIndex Eviction

**File:** `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`
**Priority:** P0
**Risk:** Low — only evicts terminal sessions from in-memory index; data remains on disk

### Current Problem
`sessionIndex` grows unbounded. Every session ever created stays in memory. Terminal sessions (completed/failed/stopped) are never evicted except on explicit delete.

### Plan
1. Add a `MAX_INDEX_AGE_MS` constant (e.g., 7 days = `7 * 24 * 60 * 60 * 1000`).
2. Add a `createdAt` field to `SessionIndexEntry` (populated from session.startedAt during buildIndexEntry).
3. Add a private `pruneStaleIndex()` method:
   - Iterates `sessionIndex`, removes entries where status is terminal AND `createdAt` is older than `MAX_INDEX_AGE_MS`.
   - Called periodically via `setInterval` (e.g., every 30 minutes) started in `initialize()`.
4. Store the interval handle and clear it in a new `shutdown()` method.
5. During `initialize()`, skip indexing sessions with terminal status older than MAX_INDEX_AGE_MS (so we don't load millions of old entries on startup).

### Code Sketch
```typescript
interface SessionIndexEntry {
  // ...existing fields...
  createdAt: number;  // NEW
}

private pruneTimer: NodeJS.Timeout | null = null;
private static readonly MAX_INDEX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
private static readonly PRUNE_INTERVAL_MS = 30 * 60 * 1000;

private pruneStaleIndex(): void {
  const cutoff = Date.now() - FileSystemSessionRepository.MAX_INDEX_AGE_MS;
  for (const [id, entry] of this.sessionIndex) {
    if (TERMINAL_STATUSES.has(entry.status) && entry.createdAt < cutoff) {
      this.sessionIndex.delete(id);
    }
  }
}

// In initialize():
this.pruneTimer = setInterval(() => this.pruneStaleIndex(), FileSystemSessionRepository.PRUNE_INTERVAL_MS);

shutdown(): void {
  if (this.pruneTimer) clearInterval(this.pruneTimer);
}
```

### Fallback
Any query that doesn't find a session in the index can still load from disk via `loadSessionFromDisk()` — no data loss.

---

## Fix 3: Expand `container.shutdown()`

**File:** `maestro-server/src/container.ts`
**Priority:** P0
**Risk:** Low — only runs at process exit

### Current Problem
`shutdown()` only calls `eventBus.removeAllListeners()`. All caches and repository Maps are leaked.

### Plan
1. Add `shutdown()` methods to:
   - `FileSystemSessionRepository` (clear pruneTimer, clear maps)
   - `LogDigestService` (clear pathCache)
   - `MultiScopeSkillLoader` (clear loaderCache, and each loader's cache)
2. Update `Container` interface to expose these shutdown-capable services.
3. In `container.shutdown()`, call them in order:
   ```typescript
   async shutdown() {
     logger.info('Shutting down container...');
     logDigestService.shutdown();
     (skillLoader as MultiScopeSkillLoader).shutdown();
     sessionRepo.shutdown();
     eventBus.removeAllListeners();
     logger.info('Container shutdown complete');
   }
   ```

### Service shutdown methods

**LogDigestService:**
```typescript
shutdown(): void {
  this.pathCache.clear();
}
```

**MultiScopeSkillLoader:**
```typescript
shutdown(): void {
  for (const loader of this.loaderCache.values()) {
    loader.clearCache();
  }
  this.loaderCache.clear();
}
```

**FileSystemSessionRepository:**
```typescript
shutdown(): void {
  if (this.pruneTimer) clearInterval(this.pruneTimer);
  this.sessions.clear();
  this.sessionIndex.clear();
}
```

---

## Fix 4: Child Process Timeout + Kill + SIGTERM Forwarding

**Files:**
- `maestro-server/src/api/sessionRoutes.ts` (generateManifestViaCLI)
- `maestro-cli/src/services/spawn-with-ulimit.ts`
- `maestro-cli/src/services/hook-executor.ts`

**Priority:** P0
**Risk:** Medium — needs careful timeout values to avoid killing long-running legitimate processes

### Current Problem
Child processes are spawned without timeout, kill mechanism, or parent-exit signal forwarding.

### Plan

#### 4a: `generateManifestViaCLI` in sessionRoutes.ts
1. Add a `MANIFEST_TIMEOUT_MS` constant (60 seconds — manifest generation should be fast).
2. After spawning `child`, start a timeout that calls `child.kill('SIGTERM')`.
3. If SIGTERM doesn't kill within 5s, send `SIGKILL`.
4. Cap stdout/stderr buffers to prevent unbounded string growth (e.g., keep last 10KB).
5. Clear timeout on exit/error.

```typescript
const MANIFEST_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 10 * 1024;

// After spawn:
const killTimer = setTimeout(() => {
  child.kill('SIGTERM');
  setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
}, MANIFEST_TIMEOUT_MS);

child.on('exit', () => clearTimeout(killTimer));
child.on('error', () => clearTimeout(killTimer));

// Cap output:
child.stdout?.on('data', (data) => {
  stdout += data.toString();
  if (stdout.length > MAX_OUTPUT_BYTES) stdout = stdout.slice(-MAX_OUTPUT_BYTES);
});
```

#### 4b: hook-executor.ts
Already has `options.timeout` via spawn timeout, but stdout/stderr accumulate unbounded.
1. Cap stdout/stderr the same way (keep last 10KB).

#### 4c: spawn-with-ulimit.ts
This is a low-level utility — timeout/kill logic should be added by callers (claude-spawner, etc.), not here. No change needed to this file.

---

## Fix 5: LogDigestService pathCache — LRU with Max Size

**File:** `maestro-server/src/application/services/LogDigestService.ts`
**Priority:** P1
**Risk:** Low — only affects caching behavior, not correctness

### Current Problem
`pathCache` is unbounded. Every unique session ID queried adds an entry that's never removed.

### Plan
1. Add `MAX_PATH_CACHE_SIZE` constant (e.g., 500).
2. After setting a new entry, if `pathCache.size > MAX_PATH_CACHE_SIZE`, delete the oldest entry. Since `Map` preserves insertion order, use `pathCache.keys().next().value` to get the oldest key.
3. Add `shutdown()` method (already planned in Fix 3).

```typescript
private static readonly MAX_PATH_CACHE_SIZE = 500;

// After pathCache.set():
if (this.pathCache.size > LogDigestService.MAX_PATH_CACHE_SIZE) {
  const oldestKey = this.pathCache.keys().next().value;
  if (oldestKey) this.pathCache.delete(oldestKey);
}
```

---

## Fix 6: MultiScopeSkillLoader Cache Limits

**File:** `maestro-server/src/infrastructure/skills/MultiScopeSkillLoader.ts`
**Priority:** P1
**Risk:** Low

### Current Problem
`loaderCache` creates a new `ClaudeCodeSkillLoader` per directory, never evicted. Each loader has its own unbounded skill cache.

### Plan
1. Add `MAX_LOADER_CACHE_SIZE` constant (e.g., 20 — there shouldn't be many unique project dirs).
2. In `getLoader()`, after adding a new entry, evict oldest if over limit.
3. Add `shutdown()` method (already planned in Fix 3).

```typescript
private static readonly MAX_LOADER_CACHE_SIZE = 20;

private getLoader(dir: string): ClaudeCodeSkillLoader {
  let loader = this.loaderCache.get(dir);
  if (!loader) {
    loader = new ClaudeCodeSkillLoader(dir, this.logger);
    this.loaderCache.set(dir, loader);
    if (this.loaderCache.size > MultiScopeSkillLoader.MAX_LOADER_CACHE_SIZE) {
      const oldest = this.loaderCache.keys().next().value;
      if (oldest) {
        this.loaderCache.get(oldest)?.clearCache();
        this.loaderCache.delete(oldest);
      }
    }
  }
  return loader;
}
```

---

## Fix 7: Stale WebSocket Subscriptions

**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Priority:** P1
**Risk:** Low

### Current Problem
`subscriptions` map only cleaned on `'close'` event. If a client errors without firing `'close'`, the entry persists.

### Plan
1. In `setupConnectionHandlers()`, add `this.subscriptions.delete(ws)` in the `'error'` handler (before logging).
2. In `broadcast()`, clean up clients with `readyState !== OPEN` from subscriptions as a side effect during iteration.

```typescript
ws.on('error', (error) => {
  this.subscriptions.delete(ws);
  this.logger.error('WebSocket client error:', error);
});
```

---

## Fix 8: CLI Fetch Timeout (AbortController)

**File:** `maestro-cli/src/api.ts`
**Priority:** P1
**Risk:** Low — adds safety net, doesn't change happy path

### Current Problem
`node-fetch` requests have no timeout. If server is unresponsive, CLI hangs indefinitely. No total retry duration cap.

### Plan
1. Add per-request timeout using `AbortController` (30 seconds).
2. Add total retry timeout (2 minutes).
3. Handle `AbortError` in catch block.

```typescript
private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const REQUEST_TIMEOUT_MS = 30_000;
  const MAX_TOTAL_MS = 120_000;
  const totalStart = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check total timeout
    if (Date.now() - totalStart > MAX_TOTAL_MS) {
      throw new Error(`Request to ${endpoint} exceeded total timeout of ${MAX_TOTAL_MS}ms`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal as any,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
      });
      clearTimeout(timeoutId);
      // ...existing response handling...
    } catch (error) {
      clearTimeout(timeoutId);
      // ...existing error handling + AbortError case...
    }
  }
}
```

---

## Fix 9: soundManager Listener Cleanup

**File:** `maestro-ui/src/services/soundManager.ts`
**Priority:** P2
**Risk:** Very Low

### Current Problem
`audio.addEventListener('ended', ...)` and `audio.addEventListener('error', ...)` are added on cloned audio elements in `playNote()` but never explicitly removed. The `'error'` handler on the original audio element in `getAudioElement()` already uses `{ once: true }`.

### Plan
1. Add `{ once: true }` to both `'ended'` and `'error'` listeners in `playNote()` since they should only fire once per cloned element.

```typescript
audio.addEventListener('ended', () => {
  this.activeSounds.delete(audio);
}, { once: true });

audio.addEventListener('error', () => {
  this.activeSounds.delete(audio);
}, { once: true });
```

This is a one-line change per listener. The `{ once: true }` option auto-removes the listener after it fires.

---

## Fix 10: Process Signal Handler Accumulation

**File:** `maestro-server/src/server.ts`
**Priority:** P2
**Risk:** Low

### Current Problem
`process.on('SIGINT', gracefulShutdown)` and `process.on('SIGTERM', gracefulShutdown)` are registered but never removed. If `startServer()` is called multiple times (e.g., in tests), handlers accumulate.

### Plan
1. Store handler references and use `process.once()` instead of `process.on()` to auto-remove after first invocation.

```typescript
process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);
```

Since `gracefulShutdown` already handles double-invocation (the `isShuttingDown` guard), using `once` is safe and prevents accumulation.

---

## Implementation Order

1. **Fix 1** (WebSocketBridge shutdown) + **Fix 7** (stale subscriptions) — same file, do together
2. **Fix 2** (sessionIndex eviction) + **Fix 3** (container shutdown) — coupled changes
3. **Fix 4** (child process timeout/kill) — independent, server + CLI
4. **Fix 5** (pathCache LRU) + **Fix 6** (loaderCache limits) — similar pattern
5. **Fix 8** (CLI fetch timeout) — independent CLI change
6. **Fix 9** (soundManager) + **Fix 10** (signal handlers) — quick wins

## Testing Strategy

- **Unit tests:** Verify `shutdown()` methods clear all maps, verify LRU eviction at boundary, verify timeout kills child process.
- **Integration:** Start server → create sessions → shut down → verify no leaked listeners/timers.
- **Manual:** Run server for extended period with session churn, monitor memory via `process.memoryUsage()`.

## Out of Scope (Tracked in Analysis)

- Repository Maps eviction (issue #7, #9) — broader change, separate task
- CLI WebSocket race conditions (issue #11) — separate task
- activeModals array cap (issue #17) — separate task
- useKeyboardShortcuts re-registration (issue #18) — separate task
