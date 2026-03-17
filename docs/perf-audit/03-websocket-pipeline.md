# Performance Audit: WebSocket & Real-time Pipeline

**Scope:** `WebSocketBridge.ts`, `useMaestroWebSocket.ts`, `DomainEvents.ts`, `useMaestroStore.ts` (active WS handler)
**Date:** 2026-03-09

---

## Architecture Overview

```
EventBus (InMemoryEventBus)
  │  emit('session:updated', fullSessionObject)
  ▼
WebSocketBridge (server)
  │  queueMicrotask → queueBroadcast() or broadcastImmediate()
  │  50ms batch window + per-entity throttling
  │  per-client subscription filtering
  │  backpressure detection (1MB buffer)
  ▼
WebSocket transport (JSON.stringify per client batch)
  ▼
useMaestroStore.handleMessage (client)
  │  JSON.parse → handleSingleMessage() per message
  │  batchSet() accumulates updates → single queueMicrotask flush
  ▼
Zustand store → React subscribers re-render
```

---

## Findings

### 1. MESSAGE BATCHING — Well Implemented ✅

**Server side (WebSocketBridge.ts:48-52, 205-228):**
- 50ms batch window via `setTimeout` coalesces rapid-fire events into a single `JSON.stringify` + `send()` per client.
- Per-entity throttling on high-frequency events prevents flooding:
  - `session:updated`: 500ms (max 2/sec per session)
  - `task:updated`: 300ms (max ~3/sec per task)
  - `notify:progress`: 1000ms (max 1/sec per session)
- Throttle replaces pending data with latest state (last-write-wins), so clients always get newest data.
- `queueMicrotask()` decouples the EventBus emit from WS processing — emit() doesn't block the caller.

**Client side (useMaestroStore.ts:152-181):**
- `batchSet()` accumulates Zustand state mutations within a single microtask, then applies all as one `set()` call.
- N WebSocket messages in a batch → 1 subscriber notification → 1 React re-render cycle.

**No issues found.**

---

### 2. THROTTLING/DEBOUNCING — Good, Minor Gaps ⚠️

**What works:**
- Server throttles `session:updated`, `task:updated`, `session:status_changed`, `notify:progress` per entity.
- Client debounces HTTP refetches (task/session) at 200ms for relationship change events (`task:session_added`, `session:task_added`).

**Issue 2a — `session:updated` sends full Session object every time**
- `SessionService.updateSession()` emits `session:updated` with the **entire Session object** including `events[]`, `timeline[]`, `docs[]`, and `metadata`.
- A session with 100+ timeline events or large docs creates payloads of 5-50KB per update.
- With 200 active sessions, even throttled at 2/sec each, worst case = 400 messages/sec × avg 10KB = **~4MB/s raw JSON** before filtering.

**Mitigation already in place:** `session:status_changed` was added as a lightweight alternative (~150 bytes) for status-only changes (L162-176 SessionService.ts). This is good — it handles the most common update path.

**Remaining risk:** Structural updates (name change, taskIds change, docs added) still send the full Session blob. Timeline events accumulate unboundedly.

**Recommendation:**
- Cap `timeline[]` and `events[]` in the WS payload (send only last N entries or omit entirely, let client fetch on demand).
- Consider a `session:updated:patch` event that sends only changed fields via `Object.keys(updates)`.

---

### 3. BROADCAST STORMS WITH 200+ SESSIONS — Medium Risk ⚠️

**Scenario analysis (200 sessions, 1 UI client):**

| Event pattern | Rate | Payload | Bandwidth |
|---|---|---|---|
| status_changed (heartbeat-like) | 200 × 2/sec = 400/sec → throttled to 200 × 1/500ms = 400/sec | ~150B each | ~60KB/s |
| But batched at 50ms | 400/sec in 50ms windows = ~20 msgs/batch × 20 batches/sec | JSON array | ~60KB/s |
| session:updated (structural) | Rare, ~1/min/session = 3.3/sec | ~10KB each | ~33KB/s |
| task:updated | Throttled 3/sec/task, maybe 50 active tasks = 150/sec | ~2KB each | ~300KB/s |

**Total estimate for 200 sessions:** ~400KB/s sustained → manageable for single client.

**Multi-client concern:** Each connected UI client gets its own filtered copy of the batch. `JSON.stringify` is called per-batch (not per-client), but subscription filtering creates per-client message arrays that are then re-serialized.

**Issue 3a — Redundant JSON.stringify per client (L274-282 WebSocketBridge.ts):**
```typescript
const payload = JSON.stringify(
  clientMessages.map((m) => ({ type: m.event, event: m.event, data: m.data, timestamp: now }))
);
```
This serializes the **filtered subset** per client. If 10 clients have no subscription filter (get all events), the **same payload is serialized 10 times**.

**Recommendation:** Pre-serialize the full batch once for unsubscribed clients; only re-serialize for clients with active subscription filters.

**Issue 3b — Subscription filter does not support project-level filtering for sessions:**
Session events only filter by `sessionIds` (L328-331). A client interested in project X must subscribe to all session IDs for that project and keep the subscription updated. There's no `projectId` filter for session events.

**Recommendation:** Add `projectId` matching for `session:*` events using `data.projectId`.

---

### 4. JSON PARSE/SERIALIZE OVERHEAD — Low Risk ✅

**Server:**
- `JSON.stringify` is called once per batch flush (50ms), not per event. Cost amortized.
- Incoming client messages parsed individually (`data.toString()` + `JSON.parse`), but client→server traffic is minimal (subscribe, ping).

**Client:**
- Single `JSON.parse` per WS message (useMaestroStore.ts:503). The parsed result is an array iterated without re-parsing.
- No redundant serialization on the client side.

**Concern:** Full `Session` and `Task` objects are parsed/serialized including `events[]`, `timeline[]`, `docs[]` which are unused for most UI updates (status indicators, name display). This is a payload size issue (see Finding #2a), not a parse CPU issue.

---

### 5. RECONNECTION HANDLING — Well Implemented ✅

**Active implementation (useMaestroStore.ts:552-563):**
- Exponential backoff: `min(1000 * 2^attempts, 30000)` → 1s, 2s, 4s, 8s, 16s, 30s cap.
- 0-50% jitter prevents thundering herd on server restart.
- Stale WebSocket guard (L544-550): ignores `onclose` from replaced connections. Correctly prevents React StrictMode double-invoke from creating phantom reconnections.
- On reconnect success: fetches all data (`fetchTasks`, `fetchSessions`, `fetchTeamMembers`, `fetchTeams`, `fetchTaskLists`) to resync state.

**Issue 5a — No subscription re-establishment on reconnect:**
When the WebSocket reconnects, the client does a full data fetch but does **not** re-send a `subscribe` message. If the client was previously subscribed to specific sessionIds/projectId, it reverts to receiving ALL events until it re-subscribes.

**Impact:** Low — the current client never sends `subscribe` messages (the subscription filtering is unused by the UI). But if subscription filtering is adopted, this will become a bug.

**Issue 5b — No message gap detection:**
Between disconnect and reconnect, events are lost. The full-fetch-on-reconnect compensates for CRUD state, but intermediate events (notifications, modals, prompts) are permanently lost.

**Impact:** Low — notifications are transient UI events. Lost `session:prompt_send` during reconnect could miss a PTY write, but reconnection windows are typically <2s.

---

### 6. MESSAGE FILTERING / SUBSCRIPTION SYSTEM — Unused but Ready ⚠️

**WebSocketBridge.ts** implements per-client subscription filtering (L26-30, 99-134, 326-356) supporting:
- `sessionIds` — filter session events
- `projectId` — filter task/project/team events
- `taskIds` — filter task events

**Issue 6a — UI client never subscribes:**
`useMaestroStore.ts` connects to WS but never sends a `subscribe` message. Every client receives ALL events for ALL projects. With multiple projects, this means unnecessary event processing and wasted bandwidth.

**Impact at scale:** With 5 projects × 200 sessions each = 1000 sessions, the client processes events for 800 sessions it doesn't care about.

**Recommendation:** On `ws.onopen`, send `{ type: 'subscribe', projectId: activeProjectId }`. Update subscription when the user switches projects.

---

### 7. SERIALIZATION COST — Medium Issue ⚠️

**Issue 7a — Full entity serialization on every update:**
- `session:updated` sends the complete `Session` object (types.ts:279-309): `id`, `projectId`, `taskIds[]`, `name`, `env{}`, `status`, timestamps, `events[]`, `timeline[]`, `docs[]`, `metadata{}`, `needsInput`, `teamMemberSnapshot`.
- `task:updated` sends the complete `Task` object (types.ts:231-261): includes `sessionIds[]`, `skillIds[]`, `agentIds[]`, `dependencies[]`, `initialPrompt` (potentially large), `taskSessionStatuses{}`.
- `initialPrompt` alone can be 1-5KB of text.

**Issue 7b — Duplicate event emission in SessionService.updateSession():**
When a session status changes, the service emits up to **4 events** for a single update:
1. `task:updated` — for each associated task (L146-152)
2. `session:status_changed` OR `session:updated` (L167-176)
3. `notify:session_completed` or `notify:session_failed` (L180-184)
4. `notify:needs_input` (L188-194)

With 5 tasks per session, one status change → 5 `task:updated` + 1 `session:status_changed` + 1 `notify:*` = **7 events**.

**Mitigated by:** Batching (50ms window coalesces these) and throttling (task:updated at 300ms). But the events are still queued in the pending array and iterated during flush.

---

### 8. DEPRECATED HOOK — Dead Code ⚠️

**`useMaestroWebSocket.ts` is marked `@deprecated` (L1-4)** and is unused. The active implementation lives in `useMaestroStore.ts`.

**Recommendation:** Delete `useMaestroWebSocket.ts` to reduce confusion and bundle size.

---

### 9. `lastQueued` MAP MEMORY LEAK — Low Risk ✅

The throttle map (`lastQueued`) is pruned on every `flushBatch()` call, removing entries older than 10 seconds (L286-289). With 200 sessions and ~4 throttled event types, max entries ≈ 800 — negligible memory.

---

## Summary Table

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 2a | Full Session blob in `session:updated` payloads | Medium | Medium |
| 3a | Redundant JSON.stringify for unfiltered clients | Low | Low |
| 3b | No projectId filter for session events | Low | Low |
| 5a | No subscription re-establishment on reconnect | Low | Low |
| 6a | UI never sends `subscribe` — receives all events | Medium | Low |
| 7a | Full entity serialization (large payloads) | Medium | Medium |
| 7b | Multi-event emission per single update | Low | Low |
| 8 | Dead `useMaestroWebSocket.ts` hook | Low | Trivial |

## Priority Recommendations

### Quick Wins (< 1 hour each)
1. **Delete `useMaestroWebSocket.ts`** — dead code removal.
2. **Send `subscribe` on connect** — add `{ type: 'subscribe', projectId }` in `ws.onopen`. Immediately reduces unnecessary event processing.
3. **Cache serialized payload for unsubscribed clients** — serialize full batch once, reuse for all clients without filters.

### Medium-term (1-4 hours each)
4. **Trim payloads** — strip `events[]`, `timeline[]`, `docs[]`, and `initialPrompt` from WS payloads for `session:updated` and `task:updated`. Let client fetch these on demand (already available via REST).
5. **Add projectId filter for session events** — trivial change to `shouldFilterOut()` to check `data.projectId`.

### Long-term (if scale demands)
6. **Delta/patch events** — emit only changed fields instead of full entities.
7. **Binary serialization** — switch from JSON to MessagePack or protobuf for high-throughput scenarios (200+ concurrent sessions with multiple UI clients).
