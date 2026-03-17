# Fix Plan: WebSocket Pipeline Optimization

**Group**: 3 of 8
**Priority**: High
**Reference**: WebSocket Performance Audit (16 findings)
**Estimated scope**: ~600 lines changed across 5 files

---

## Executive Summary

The WebSocket pipeline has zero batching, zero throttling, and zero backpressure handling. At 200+ concurrent sessions, this creates broadcast storms (hundreds of individual `JSON.stringify` + `send()` per second), server-side OOM risk from slow clients, and client-side UI freezes from Map reconstruction on every message. This plan addresses all 10 items specified in the task description.

---

## Fix 1: Message Batching (50ms Window) — FINDING 1

**File**: `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Severity**: HIGH | **Priority**: P0

### Problem
Every domain event immediately calls `this.broadcast()` → `JSON.stringify` → `client.send()`. With 200 sessions, `session:updated` and `notify:progress` events create hundreds of individual sends per second.

### Implementation

Add a message queue with a 50ms flush window to `WebSocketBridge`:

```typescript
// New private fields on WebSocketBridge
private pendingMessages: Array<{ event: string; data: any }> = [];
private flushTimer: ReturnType<typeof setTimeout> | null = null;
private readonly BATCH_WINDOW_MS = 50;
```

**Change `setupEventHandlers`**: Replace direct `this.broadcast(event, data)` with `this.queueBroadcast(event, data)`.

```typescript
// In setupEventHandlers loop (line 120-124):
for (const event of events) {
  this.eventBus.on(event, (data) => {
    this.queueBroadcast(event, data);  // Was: this.broadcast(event, data)
  });
}
```

**New method `queueBroadcast`**:
```typescript
private queueBroadcast(event: string, data: any): void {
  this.pendingMessages.push({ event, data });
  if (!this.flushTimer) {
    this.flushTimer = setTimeout(() => this.flushBatch(), this.BATCH_WINDOW_MS);
  }
}
```

**New method `flushBatch`**:
```typescript
private flushBatch(): void {
  this.flushTimer = null;
  if (this.pendingMessages.length === 0) return;
  const batch = this.pendingMessages;
  this.pendingMessages = [];

  // Build per-client filtered message lists, then serialize
  this.wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    // Backpressure check (Fix 3)
    if ((client as any).bufferedAmount > MAX_BUFFER_BYTES) return;

    const sub = this.subscriptions.get(client);
    const clientMessages = batch.filter((m) => {
      const sessionId = this.extractSessionId(m.event, m.data);
      if (sub && sessionId && !sub.has(sessionId)) return false;
      return true;
    });
    if (clientMessages.length === 0) return;

    const payload = JSON.stringify(
      clientMessages.map((m) => ({
        type: m.event,
        event: m.event,
        data: m.data,
        timestamp: Date.now(),
      }))
    );
    client.send(payload);
  });
}
```

**Client-side change** (`useMaestroStore.ts` `handleMessage`): Parse both single-object and array formats:
```typescript
const handleMessage = (event: MessageEvent) => {
  try {
    const parsed = JSON.parse(event.data);
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const message of messages) {
      handleSingleMessage(message);
    }
  } catch { /* best-effort */ }
};
```

Rename the existing `switch` block into a `handleSingleMessage(message)` helper called from the loop.

### Files Changed
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` — add queue, flush, modify event subscription
- `maestro-ui/src/stores/useMaestroStore.ts` — array-aware message parsing
- `maestro-ui/src/hooks/useMaestroWebSocket.ts` — same array-aware parsing (for backward compat if hook is ever used)
- `maestro-cli/src/commands/session.ts` — handle array messages in `session watch`

### Risk
- 50ms latency added to all events. Acceptable: UI updates at 20fps are imperceptible.
- If timer fires mid-flush from previous cycle, guarded by `this.flushTimer = null` at start.

---

## Fix 2: Per-Entity Throttling — FINDING 4

**File**: `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Severity**: HIGH | **Priority**: P0

### Problem
`session:updated` fires on every `lastActivity` timestamp change. 200 sessions = 200+ updates/second with zero deduplication.

### Implementation

Add throttle logic inside `queueBroadcast` (before queuing):

```typescript
private lastQueued = new Map<string, { time: number; data: any }>();
private readonly THROTTLE_MS: Record<string, number> = {
  'session:updated': 500,   // Max 2/sec per session
  'task:updated': 300,       // Max ~3/sec per task
  'notify:progress': 1000,   // Max 1/sec per session
};

private queueBroadcast(event: string, data: any): void {
  const throttleMs = this.THROTTLE_MS[event];
  if (throttleMs) {
    const entityId = data?.id || data?.sessionId || data?.taskId || '';
    const key = `${event}:${entityId}`;
    const now = Date.now();
    const last = this.lastQueued.get(key);
    if (last && now - last.time < throttleMs) {
      // Replace pending data with latest (so flush sends newest state)
      last.data = data;
      // Update in pending queue too
      const idx = this.pendingMessages.findIndex(
        (m) => m.event === event && (m.data?.id || m.data?.sessionId) === entityId
      );
      if (idx >= 0) this.pendingMessages[idx].data = data;
      return;
    }
    this.lastQueued.set(key, { time: now, data });
  }
  this.pendingMessages.push({ event, data });
  if (!this.flushTimer) {
    this.flushTimer = setTimeout(() => this.flushBatch(), this.BATCH_WINDOW_MS);
  }
}
```

**Stale entry cleanup**: In `flushBatch`, after processing, prune `lastQueued` entries older than 10s to prevent unbounded growth:
```typescript
// At end of flushBatch:
const cutoff = Date.now() - 10_000;
for (const [key, entry] of this.lastQueued) {
  if (entry.time < cutoff) this.lastQueued.delete(key);
}
```

### Files Changed
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` — throttle map + logic in `queueBroadcast`

### Risk
- Clients see stale data for up to 500ms. Acceptable for `session:updated` — UI already handles eventual consistency.
- `session:created`/`session:deleted` are NOT throttled — only updates.

---

## Fix 3: Backpressure Handling — FINDING 6

**File**: `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Severity**: HIGH | **Priority**: P0

### Problem
`client.send()` is fire-and-forget. Slow clients accumulate unbounded buffers in the `ws` library, causing server OOM.

### Implementation

Add a constant and check in `flushBatch` (already shown in Fix 1 code):

```typescript
const MAX_BUFFER_BYTES = 1024 * 1024; // 1MB
```

In `flushBatch`, before `client.send(payload)`:
```typescript
if ((client as any).bufferedAmount > MAX_BUFFER_BYTES) {
  this.logger.warn('Skipping slow WebSocket client', {
    buffered: (client as any).bufferedAmount,
  });
  return; // Drop batch for this client
}
```

Additionally, add a `cleanup` method to close clients that have been backpressured for >30s:
```typescript
private backpressuredClients = new Map<WebSocket, number>();

// In flushBatch, when skipping a client:
const now = Date.now();
if (!this.backpressuredClients.has(client)) {
  this.backpressuredClients.set(client, now);
} else if (now - this.backpressuredClients.get(client)! > 30_000) {
  this.logger.warn('Terminating persistently slow WebSocket client');
  client.terminate();
  this.backpressuredClients.delete(client);
  this.subscriptions.delete(client);
}

// In flushBatch, when sending succeeds:
this.backpressuredClients.delete(client);
```

### Files Changed
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`

### Risk
- Slow clients lose events. Acceptable — they'll refetch on reconnect. Better than server OOM.

---

## Fix 4: Lightweight Status Events — FINDING 3

**File**: `maestro-server/src/domain/events/DomainEvents.ts`, services, `WebSocketBridge.ts`
**Severity**: HIGH | **Priority**: P1

### Problem
`session:updated` sends the entire Session object (20+ fields, unbounded arrays). At scale, this is 5-50KB per message.

### Implementation

**Step 1**: Add a new lightweight event type in `DomainEvents.ts`:
```typescript
// New event
export interface SessionStatusChangedEvent {
  id: string;
  status: string;
  lastActivity: string;
  needsInput?: boolean;
}

// Add to EventName union: 'session:status_changed'
// Add to TypedEventMap: 'session:status_changed': SessionStatusChangedEvent
```

**Step 2**: In `SessionService.updateSession()`, emit `session:status_changed` instead of `session:updated` when only status/lastActivity changed:
```typescript
// After save, check what changed
if (onlyStatusOrActivityChanged(existingSession, updatedSession)) {
  await this.eventBus.emit('session:status_changed', {
    id: updatedSession.id,
    status: updatedSession.status,
    lastActivity: updatedSession.lastActivity,
    needsInput: updatedSession.needsInput,
  });
} else {
  await this.eventBus.emit('session:updated', updatedSession);
}
```

**Step 3**: Add `session:status_changed` to the events list in `WebSocketBridge.setupEventHandlers()`.

**Step 4**: Handle on client side in `useMaestroStore.ts`:
```typescript
case 'session:status_changed': {
  const { id, status, lastActivity, needsInput } = message.data;
  const existing = get().sessions.get(id);
  if (existing) {
    const updated = { ...existing, status, lastActivity, needsInput };
    set((prev) => ({ sessions: new Map(prev.sessions).set(id, updated) }));
  }
  break;
}
```

### Files Changed
- `maestro-server/src/domain/events/DomainEvents.ts` — new event type
- `maestro-server/src/application/services/SessionService.ts` — conditional emit
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` — add to events list
- `maestro-ui/src/stores/useMaestroStore.ts` — handle new event
- `maestro-cli/src/commands/session.ts` — handle in watch command

### Risk
- Need to carefully determine "only status changed" logic. Use a whitelist of fields: `status`, `lastActivity`, `needsInput`.
- `session:updated` still fires for full entity changes (name, description, taskIds, etc.)

---

## Fix 5: Consolidate Duplicate WebSocket Singletons — FINDING 5

**File**: `maestro-ui/src/hooks/useMaestroWebSocket.ts`
**Severity**: MEDIUM | **Priority**: P1

### Problem
Two independent WebSocket singleton patterns exist in `useMaestroWebSocket.ts` and `useMaestroStore.ts`. If both are used simultaneously, they create two connections doubling traffic.

### Current State
After codebase analysis: `useMaestroWebSocket` is NOT imported by any component — only the store's WebSocket is active. The hook exists as dead code from an earlier architecture.

### Implementation

**Option A (Recommended)**: Deprecate and remove `useMaestroWebSocket.ts`.

1. Verify no component imports `useMaestroWebSocket` (confirmed — grep shows only docs and the file itself).
2. Add a deprecation comment at the top of the file:
   ```typescript
   /**
    * @deprecated Use useMaestroStore's WebSocket connection instead.
    * This hook is unused and will be removed in a future version.
    * See useMaestroStore.initWebSocket() for the active implementation.
    */
   ```
3. In a follow-up PR, delete the file entirely.

**Note**: We don't delete it outright in this PR to avoid breaking any external integrations we might not see.

### Files Changed
- `maestro-ui/src/hooks/useMaestroWebSocket.ts` — deprecation notice

### Risk
- Minimal. No code uses it.

---

## Fix 6: Debounce Relationship Refetches — FINDING 8

**File**: `maestro-ui/src/stores/useMaestroStore.ts`
**Severity**: MEDIUM | **Priority**: P1

### Problem
`task:session_added`/`task:session_removed` and `session:task_added`/`session:task_removed` each trigger an immediate REST API `fetchTask`/`fetchSession`. Spawning 50 workers causes 100+ REST calls in a burst.

### Implementation

Add a debounced refetch utility at the top of the store file:

```typescript
// Debounced entity refetch — collects IDs for 200ms then fetches once per ID
const pendingTaskRefetches = new Set<string>();
const pendingSessionRefetches = new Set<string>();
let taskRefetchTimer: ReturnType<typeof setTimeout> | null = null;
let sessionRefetchTimer: ReturnType<typeof setTimeout> | null = null;
const REFETCH_DEBOUNCE_MS = 200;

function debouncedFetchTask(taskId: string, fetchFn: (id: string) => void) {
  pendingTaskRefetches.add(taskId);
  if (!taskRefetchTimer) {
    taskRefetchTimer = setTimeout(() => {
      taskRefetchTimer = null;
      const ids = [...pendingTaskRefetches];
      pendingTaskRefetches.clear();
      ids.forEach(fetchFn);
    }, REFETCH_DEBOUNCE_MS);
  }
}

function debouncedFetchSession(sessionId: string, fetchFn: (id: string) => void) {
  pendingSessionRefetches.add(sessionId);
  if (!sessionRefetchTimer) {
    sessionRefetchTimer = setTimeout(() => {
      sessionRefetchTimer = null;
      const ids = [...pendingSessionRefetches];
      pendingSessionRefetches.clear();
      ids.forEach(fetchFn);
    }, REFETCH_DEBOUNCE_MS);
  }
}
```

**Change handlers** (lines 311-326):
```typescript
case 'task:session_added':
case 'task:session_removed': {
  if (message.data?.taskId) debouncedFetchTask(message.data.taskId, get().fetchTask);
  // ... sound handling unchanged
  break;
}
case 'session:task_added':
case 'session:task_removed': {
  if (message.data?.sessionId) debouncedFetchSession(message.data.sessionId, get().fetchSession);
  // ... sound handling unchanged
  break;
}
```

### Files Changed
- `maestro-ui/src/stores/useMaestroStore.ts` — debounce utilities + handler changes

### Risk
- 200ms delay before refetch. Acceptable — UI already shows optimistic data from the event payload.
- Deduplication: same entity ID within the window only fetches once.

---

## Fix 7: Decouple EventBus from Broadcast — FINDING 10

**File**: `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`, `InMemoryEventBus.ts`
**Severity**: MEDIUM | **Priority**: P1

### Problem
`EventBus.emit()` uses `await Promise.all(handlers)`, so the REST API response for `updateSession` blocks until the WebSocket broadcast completes. At 200+ clients, forEach on `wss.clients` takes non-trivial time.

### Implementation

In `WebSocketBridge.setupEventHandlers()`, defer the broadcast to avoid blocking the event bus:

```typescript
for (const event of events) {
  this.eventBus.on(event, (data) => {
    // Defer to next microtask — don't block the emitting service
    queueMicrotask(() => this.queueBroadcast(event, data));
  });
}
```

This is a one-line change per handler registration. The `queueMicrotask` defers execution to after the current microtask completes, so the `emit()` Promise resolves without waiting for broadcast.

**Alternative considered**: Making `emit()` fire-and-forget. Rejected — other EventBus consumers (like notification handlers) may need the await semantics.

### Files Changed
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` — wrap `queueBroadcast` in `queueMicrotask`

### Risk
- Events arrive 1 microtask later to WebSocket clients. Imperceptible.
- Error handling still works — `queueBroadcast` doesn't throw.

---

## Fix 8: Extend Subscription Filtering — FINDING 12

**File**: `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`
**Severity**: MEDIUM | **Priority**: P1

### Problem
Subscription filtering only works for session-scoped events. Task events, team member events, project events, and `notify:*` events are sent to ALL clients regardless of subscription. At 200 sessions with multiple CLI watchers, every watcher gets every task update.

### Implementation

Extend the subscribe message to support `projectId` and `taskIds`:

```typescript
// Enhanced subscribe message format:
// { type: 'subscribe', sessionIds?: string[], projectId?: string, taskIds?: string[] }

// Change subscriptions type:
private subscriptions = new Map<WebSocket, {
  sessionIds?: Set<string>;
  projectId?: string;
  taskIds?: Set<string>;
}>();
```

**Updated `handleClientMessage`**:
```typescript
if (message.type === 'subscribe') {
  const sub: { sessionIds?: Set<string>; projectId?: string; taskIds?: Set<string> } = {};
  if (Array.isArray(message.sessionIds)) {
    sub.sessionIds = new Set(message.sessionIds.filter((id: any) => typeof id === 'string'));
  }
  if (typeof message.projectId === 'string') {
    sub.projectId = message.projectId;
  }
  if (Array.isArray(message.taskIds)) {
    sub.taskIds = new Set(message.taskIds.filter((id: any) => typeof id === 'string'));
  }
  this.subscriptions.set(ws, sub);
  ws.send(JSON.stringify({ type: 'subscribed', ...message, timestamp: Date.now() }));
  return;
}
```

**Updated `extractSessionId` → rename to `shouldFilterOut`**:
```typescript
private shouldFilterOut(event: string, data: any, sub: SubscriptionFilter): boolean {
  // Session events — filter by sessionIds
  if (event.startsWith('session:')) {
    const sessionId = data?.sessionId || data?.id || data?.session?.id;
    if (sub.sessionIds && sessionId && !sub.sessionIds.has(sessionId)) return true;
    return false;
  }

  // Task events — filter by taskIds if specified, or projectId
  if (event.startsWith('task:')) {
    const taskId = data?.taskId || data?.id;
    if (sub.taskIds && taskId && !sub.taskIds.has(taskId)) return true;
    if (sub.projectId && data?.projectId && data.projectId !== sub.projectId) return true;
    return false;
  }

  // Team member / project events — filter by projectId
  if (event.startsWith('team_member:') || event.startsWith('project:') || event.startsWith('team:')) {
    if (sub.projectId && data?.projectId && data.projectId !== sub.projectId) return true;
    return false;
  }

  // Notify events — filter by sessionId if available
  if (event.startsWith('notify:')) {
    const sessionId = data?.sessionId;
    if (sub.sessionIds && sessionId && !sub.sessionIds.has(sessionId)) return true;
    return false;
  }

  return false; // Unknown events pass through
}
```

### Backward Compatibility
- Clients without subscription still receive ALL events (unchanged).
- Clients sending old `{ type: 'subscribe', sessionIds: [...] }` still work — sessionIds field is optional and independent.

### Files Changed
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` — subscription type, filter logic
- `maestro-server/spec/04-WEBSOCKET-SPECIFICATION.md` — document new subscribe fields

### Risk
- Task/team events need `projectId` in their payload for filtering to work. Verify that services include `projectId` in emitted events.
- UI client doesn't use subscribe today (it wants all events). No client-side changes needed.

---

## Fix 9: Reconnection Jitter — FINDING 9

**File**: `maestro-ui/src/stores/useMaestroStore.ts`
**Severity**: MEDIUM | **Priority**: P2

### Problem
All clients use the same exponential backoff formula: `min(1000 * 2^attempts, 30000)`. After a network blip, all clients reconnect at the same instant → thundering herd on the server.

### Implementation

Add random jitter to the reconnect delay:

```typescript
// In ws.onclose handler (line 462):
const baseDelay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
const jitter = Math.random() * baseDelay * 0.5; // 0-50% jitter
const delay = baseDelay + jitter;
```

Same change in `useMaestroWebSocket.ts` (line 124):
```typescript
const baseDelay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
const jitter = Math.random() * baseDelay * 0.5;
const delay = baseDelay + jitter;
```

### Files Changed
- `maestro-ui/src/stores/useMaestroStore.ts` — jitter in reconnect
- `maestro-ui/src/hooks/useMaestroWebSocket.ts` — jitter in reconnect

### Risk
- None. Jitter only adds delay, never reduces it.

---

## Fix 10: Connection Limits — FINDING 11

**File**: `maestro-server/src/server.ts`
**Severity**: MEDIUM | **Priority**: P2

### Problem
`new WebSocketServer({ server })` accepts unlimited connections. A misbehaving client or reconnect loop could open hundreds of connections.

### Implementation

```typescript
// Line 173 — replace:
const wss = new WebSocketServer({ server });

// With:
const MAX_WS_CLIENTS = 50;
const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 1024, // 1MB max inbound message
  verifyClient: (_info, cb) => {
    if (wss.clients.size >= MAX_WS_CLIENTS) {
      logger.warn('WebSocket connection rejected: max clients reached', {
        current: wss.clients.size,
        max: MAX_WS_CLIENTS,
      });
      cb(false, 429, 'Too many WebSocket connections');
    } else {
      cb(true);
    }
  },
});
```

### Files Changed
- `maestro-server/src/server.ts` — WebSocketServer options

### Risk
- 50-client limit may be too low for large teams. Make it configurable via env var `MAX_WS_CLIENTS`.

---

## Implementation Order

| Phase | Fixes | Reason | Est. Lines |
|-------|-------|--------|-----------|
| **Phase A** (Core pipeline) | Fix 1 (batching) + Fix 2 (throttling) + Fix 3 (backpressure) + Fix 7 (decouple) | These 4 are tightly coupled — batching subsumes the broadcast loop where throttle/backpressure checks live | ~200 |
| **Phase B** (Lightweight events) | Fix 4 (status events) | New event type + service changes, independent of pipeline | ~80 |
| **Phase C** (Client cleanup) | Fix 5 (consolidate singletons) + Fix 6 (debounce refetches) + Fix 9 (jitter) | All client-side, no server dependencies | ~80 |
| **Phase D** (Server hardening) | Fix 8 (extended filters) + Fix 10 (connection limits) | Server-side, can be done last | ~120 |

**Total**: ~480 lines of new/changed code across 8 files.

---

## Testing Strategy

1. **Unit tests** for `WebSocketBridge`:
   - Verify batching: emit 5 events rapidly, assert only 1 `client.send` call after 50ms
   - Verify throttling: emit 10 `session:updated` for same ID in 100ms, assert ≤2 sends
   - Verify backpressure: mock `bufferedAmount > 1MB`, assert `send` not called
   - Verify subscription filtering with new `projectId`/`taskIds` fields

2. **Integration tests**:
   - Connect WS client, emit events, verify batched array format
   - Test `session:status_changed` lightweight event pipeline
   - Test reconnection jitter (verify delays are not identical across 10 reconnects)

3. **Manual testing**:
   - Spawn 50+ sessions, verify UI updates smoothly without freezing
   - Monitor server memory during sustained load
   - Verify `session watch` CLI still works with batched messages

---

## Files Changed Summary

| File | Fixes | Type |
|------|-------|------|
| `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | 1, 2, 3, 7, 8 | Major refactor |
| `maestro-server/src/server.ts` | 10 | Minor change |
| `maestro-server/src/domain/events/DomainEvents.ts` | 4 | New event type |
| `maestro-server/src/application/services/SessionService.ts` | 4 | Conditional emit |
| `maestro-ui/src/stores/useMaestroStore.ts` | 1, 4, 6 | Message parsing + handlers |
| `maestro-ui/src/hooks/useMaestroWebSocket.ts` | 5, 9 | Deprecation + jitter |
| `maestro-cli/src/commands/session.ts` | 1 | Array message support |
| `maestro-server/spec/04-WEBSOCKET-SPECIFICATION.md` | 8 | Docs update |

---

## Dependencies & Coordination

- **Depends on Group 1 (Zustand)**: Finding 7 (client-side state diffing/shallow compare) is covered in Group 1's Zustand overhaul. This plan does NOT duplicate that work.
- **Depends on Group 2 (React Memoization)**: Sound throttling (Finding 14) is a UI concern covered in Group 2. Not included here.
- **No blockers**: All fixes in this plan can proceed independently of other groups.
- **Group 5 (API N+1)** benefits from Fix 6 (debounced refetches reduce API call volume).
