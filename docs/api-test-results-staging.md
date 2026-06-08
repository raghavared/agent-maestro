# API Test Results — Workspace Openness + Cross-Project Access (Staging)

> Run date: 2026-05-31
> Tester: Backend Engineer worker session (sess_1780221829559_0wfxwejnm)
> Server: `http://localhost:4569` (staging, confirmed live)
> Method: direct `curl` + node `ws` scripts. Maestro CLI not used.

---

## Pre-flight Summary

| Item | Result |
|---|---|
| Staging port | **4569** ✅ (4568 is Vite dev server, returns HTML) |
| Server alive (`/health`) | `{"status":"ok","timestamp":...,"uptime":4206}` ✅ |
| Staleness check (`POST /api/sessions/__probe__/mode`) | **403 `mode_self_only`** — route exists, server fresh ✅ |
| Rebuild required | **No** |
| Server start time | ~uptime 4206s before test |

### Fixture IDs

| Fixture | ID |
|---|---|
| PROJ_ID | `proj_1780221860371_7sxft90bk` |
| PROJ_ID_OTHER | `proj_1780221860384_6rd5851vt` |
| MASTER_PROJ_ID | `proj_1780221860393_v2xnqzlbf` |
| TM_WORKER_ID | `tm_1780221880275_574a9wbbl` |
| TM_COORD_ID | `tm_1780221880284_q1qdym6u0` |
| WORKER_SESS | `sess_1780221953697_8wcw04f4j` |
| COORD_SESS | `sess_1780221953705_pg5c524qi` |
| CWORKER_SESS | `sess_1780221953713_4xftxbiyj` |

> Note: Sessions created via `POST /api/sessions` with `metadata.mode` set (spawn endpoint wasn't used for fixtures since it requires taskIds and fires actual agent processes). Mode was later verified as correctly readable via the GET mode endpoint.

---

## Group A — Spawn gate

| # | Expected | Actual | Result |
|---|---|---|---|
| A1 | 400 `sender_session_required` | **400** `{"code":"sender_session_required","message":"X-Session-Id required"}` | ✅ matches design — **⚠️ see BLOCKER below** |
| A2 | 403 `spawn_requires_coordinator` | **403** `{"code":"spawn_requires_coordinator","message":"Spawning requires coordinator mode..."}` | ✅ |
| A3 | 200, new session created | **201** `{success:true, sessionId:"sess_1780221999840_..."}` | ✅ |
| A4 | 200, spawned `projectId === PROJ_ID_OTHER` | **201** `projectId: proj_1780221860384_6rd5851vt` ✅; but `parentSessionId: null` ❌ | ⚠️ partial — see Issue I4 |
| A5 | 400 `sender_session_not_found` | **400** `{"code":"sender_session_not_found","message":"Sender session sess_nonexistent_12345 not found"}` | ✅ |

**Note A1 / BLOCKER confirmation**: The test passes against the *code's current behavior*, but this behavior itself breaks UI spawning. When `X-Session-Id` is absent, the server returns 400. Since the desktop UI never sends `X-Session-Id`, every user-initiated spawn click returns 400. See `🔴 BLOCKER 1` below.

**Note A4**: Cross-project spawn works (projectId is honored), but the spawned session has `parentSessionId: null` and `metadata.spawnedBy: null`. The design intent is that `parentSessionId` should be set to the sender's session ID. See `🟡 Issue I4` below.

---

## Group B — Mode endpoint

| # | Expected | Actual | Result |
|---|---|---|---|
| B1 | 403 `mode_self_only` | **403** `{"code":"mode_self_only","message":"You can only flip your own role"}` | ✅ |
| B2 | 403 `mode_self_only` | **403** same | ✅ |
| B3 | 200 `{mode:'coordinator',previousMode:'worker',changed:true}` + mode persisted | **200** `{"id":"...","mode":"coordinator","previousMode":"worker","changed":true}`. Re-fetch confirms `metadata.mode: coordinator` | ✅ |
| B4 | 200 `changed:false` | **200** `{"mode":"coordinator","previousMode":"coordinator","changed":false}` | ✅ |
| B5 | 200 `{mode:'worker',previousMode:'coordinator',changed:true}` | **200** `{"mode":"worker","previousMode":"coordinator","changed":true}` | ✅ |
| B6 | 200 `{mode:'coordinated-coordinator',...}` — must NOT collapse to `coordinator` | **200** `{"mode":"coordinated-coordinator","previousMode":"coordinated-worker","changed":true}` | ✅ |
| B7 | 200 `{id, mode, relation, role}` | **200** `{"id":"...","mode":"worker","relation":"standalone","role":"worker"}` | ✅ |
| B8 | 400 (zod validation) | **400** `{"code":"VALIDATION_ERROR","details":[{"path":"role","message":"Invalid option: expected one of \"worker\"|\"coordinator\""}]}` | ✅ |
| B9 | 400 or 200 relation unchanged | **400** `{"code":"VALIDATION_ERROR","message":"Unrecognized key: \"relation\""}` (schema is strict) | ✅ |

All Group B tests pass. The mode endpoint is implemented correctly.

---

## Group C — `?active=` / `?status=` filters

| # | Expected | Actual | Result |
|---|---|---|---|
| C1 | Only `{spawning,idle,working}` statuses | 56 sessions returned; statuses: `{working, idle, spawning}` — no completed/failed | ✅ |
| C2 | Only `working,idle` statuses | Statuses: `{idle, working}` only | ✅ |
| C3 | Same as C1 on master alias | Statuses: `{idle, working, spawning}` — matches | ✅ |

---

## Group D — Master routes (no auth)

| # | Expected | Actual | Result |
|---|---|---|---|
| D1 | `GET /api/master/projects` → 200 | **200 OK** | ✅ |
| D2 | `GET /api/master/sessions` → 200 | **200 OK** | ✅ |
| D3 | `GET /api/master/tasks` → 200 | **200 OK** | ✅ |
| D4 | `GET /api/master/context` → 200 | **200 OK** | ✅ |

Auth middleware removed from all master routes — confirmed.

---

## Group E — Team-member route relax

| # | Expected | Actual | Result |
|---|---|---|---|
| E1 | 200, list across **all** projects | **200** but returns **empty array** (0 members) — falls back to `getGlobalTeamMembers()` which only returns `scope===global` members | ❌ |
| E2 | 200, single member by ID (no projectId) | **200** `{id: tm_1780221880275_574a9wbbl, name: test-worker}` | ✅ |
| E3 | 200, list filtered to `projectId` | **200** 9 members (7 defaults + 2 custom, all `projectId === PROJ_ID`) | ✅ |
| E4 | 200, no error with arbitrary `projectId` filter | **200** correct member returned | ✅ |

**E1 details**: `GET /api/team-members` (no filter) hits the `else` branch in `teamMemberRoutes.ts:32` which calls `teamMemberService.getGlobalTeamMembers()`. This only returns `scope === 'global'` members. Project-scoped members (the common case) are never returned. This confirms Review Finding I2.

---

## Group F — WebSocket `session:mode_changed` event

**Subscription used**: `{ type: 'subscribe' }` (no filter — receives ALL events)

| # | Action | Expected | Actual | Result |
|---|---|---|---|---|
| F1 | Subscribe; POST B3 (worker→coordinator) | Event `session:mode_changed` with `changed:true` within 1s | **NO event received** | ❌ |
| F2 | Repeat B3 (idempotent) | No event | **No event** (correct outcome, wrong reason) | ⚠️ |
| F3 | POST B5 (demote) | Event `{mode:'worker', previousMode:'coordinator', changed:true}` | **NO event received** | ❌ |
| F4 | POST B6 (coordinated-worker→coordinated-coordinator) | Event `{mode:'coordinated-coordinator', ...}` | **NO event received** | ❌ |

**Root cause**: `session:mode_changed` is **not in the `events` array** in `WebSocketBridge.setupEventHandlers()` (`maestro-server/src/infrastructure/websocket/WebSocketBridge.ts:145-197`). The event IS emitted by the sessionRoutes via `eventBus.emit('session:mode_changed', ...)`, but the bridge never subscribes to it, so no client ever receives it. Additionally, `session:mode_changed` is absent from `TypedEventMap` in `DomainEvents.ts` (though the server builds clean since `IEventBus.emit` accepts `event: string`).

**Fix required** (two files):
1. Add `'session:mode_changed'` to the `events` array in `WebSocketBridge.ts:~197`
2. Add `'session:mode_changed': SessionModeChangedPayload` to `TypedEventMap` in `DomainEvents.ts`

---

## Group G — End-to-end integration trace

| Step | Action | Expected | Actual | Result |
|---|---|---|---|---|
| G1 | Subscribe WS to all sessions | `subscribed` ack | `{"type":"subscribed","timestamp":...}` | ✅ |
| G2 | `GET /:WORKER_SESS/mode` | `mode === 'worker'` | `{"mode":"worker","relation":"standalone","role":"worker"}` | ✅ |
| G3 | Worker attempts spawn | 403 `spawn_requires_coordinator` | **403** `spawn_requires_coordinator` | ✅ |
| G4 | Promote worker→coordinator | HTTP 200 `changed:true` + WS event | HTTP: **200** `changed:true` ✅; WS: **no event** ❌ | ⚠️ |
| G5 | GET mode — confirm `role=coordinator` | `role:coordinator` | `{"role":"coordinator","mode":"coordinator"}` | ✅ |
| G6 | Coordinator spawns new session N | 200/201, new session created | **201** `sessionId: sess_1780222245534_...` | ✅ |
| G7 | GET session N — confirm parentage | `parentSessionId === WORKER_SESS`, `mode` has coordinated relation | `parentSessionId: null` ❌, `metadata.mode: worker` (not coordinated) ❌ | ❌ |
| G8 | Demote coordinator→worker | HTTP 200 `changed:true` + WS event | HTTP: **200** `changed:true` ✅; WS: **no event** ❌ | ⚠️ |
| G9 | Worker (demoted) attempts spawn | 403 re-locked | **403** `spawn_requires_coordinator` | ✅ |

**G7 deviation**: Spawned session N has `parentSessionId: null` and `metadata.spawnedBy: null`. The spawn route uses `spawnSource: 'ui'` (the schema default) even for session-initiated spawns. No code path sets `parentSessionId` from the `X-Session-Id` sender. This confirms Issue I4 from the review.

---

## 🔴 BLOCKERS

### BLOCKER 1 — Spawn gate breaks all UI spawning
**File**: `maestro-server/src/api/sessionRoutes.ts:1044-1049`

When `X-Session-Id` header is absent, the route returns `400 sender_session_required`. The desktop UI spawns sessions via `MaestroClient.fetch` which never attaches this header (user-initiated, not session-initiated). Result: every user Spawn button click returns 400.

**Confirmed by**: A1 returns 400 `sender_session_required` without the header.

**Fix**: Treat absent `X-Session-Id` as a user/UI spawn (pass through without gate). Only block when header IS present but the session doesn't exist (`sender_session_not_found`) or lacks coordinator mode. The 400 for missing header is per the current design spec but the spec itself is broken. Recommended fix from review: no gate when header absent.

### BLOCKER 2 — `session:mode_changed` never delivered over WebSocket
**Files**: 
- `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts:145-197` (event not in subscription list)
- `maestro-server/src/domain/events/DomainEvents.ts` (event absent from `TypedEventMap`)

The `session:mode_changed` event is emitted by `sessionRoutes.ts:720` but the WebSocket bridge never subscribes to it in `setupEventHandlers()`. Clients relying on this event (e.g., a UI that shows real-time mode flips) receive nothing.

**Confirmed by**: F1, F3, F4 — subscribed without filter, promoted/demoted session, received 0 `session:mode_changed` events. HTTP responses confirm the server-side state did change correctly.

**Fix**:
```typescript
// WebSocketBridge.ts events array — add before closing bracket:
'session:mode_changed',

// DomainEvents.ts TypedEventMap — add:
'session:mode_changed': { sessionId: string; mode: AgentMode; previousMode: AgentMode; changed: boolean; timestamp: number };
```

---

## 🟡 ISSUES

### I2 — `GET /api/team-members` (no filter) returns only global-scope members
**File**: `maestro-server/src/api/teamMemberRoutes.ts:32`

The `else` branch (no `projectId`, no `scope`) calls `teamMemberService.getGlobalTeamMembers()` instead of listing all members. Project-scoped members (the common case) are excluded. The "relax" was intended to return all members when no filter is present.

**Confirmed by**: E1 — 0 members returned even with 2 project-scoped members in the DB.

**Fix**: Replace `getGlobalTeamMembers()` call in the else branch with a call that returns all members across all project partitions.

### I4 — Spawned session `parentSessionId` not set from `X-Session-Id`
**File**: `maestro-server/src/api/sessionRoutes.ts` (spawn route, around line 1100+)

The spawn gate correctly validates `X-Session-Id` as the sender-coordinator, but `parentSessionId` on the created session is left `null`. The spawned child should have `parentSessionId === senderSessionId` (and ideally `metadata.mode = 'coordinated-worker'` / `coordinated-coordinator`). Without this, session hierarchy/lineage is lost.

**Confirmed by**: A4, G7 — spawned session always has `parentSessionId: null` regardless of sender.

---

## 🟢 NITS

### N1 — `isMaster` not returned in project create response
Creating a project with `isMaster: true` returns a response without the `isMaster` field. Field may be persisted (D routes show master project appears) but the create response body omits it, making it hard to verify from the client.

### N2 — `DELETE /api/team-members/:id` returns 400 without `projectId`
`DELETE /api/team-members/tm_...` returns 400. The team-member delete route may still require `projectId` even though `GET` by ID works without it. Minor inconsistency since projects cascade-delete their members anyway.

---

## Verdict

**NEEDS FIXES**

The mode endpoint (Group B) and all filter/master-route changes (Groups C, D) are solid and ready. However, two BLOCKERS prevent the feature from being production-ready:

1. **UI spawning is broken** — the spawn gate must not fire when `X-Session-Id` is absent (UI path).
2. **WS events not delivered** — `session:mode_changed` must be added to the WebSocket bridge's subscription list and to `TypedEventMap`.

Beyond the blockers, `parentSessionId` not being set on spawned sessions (I4) means the coordinator → spawned-worker hierarchy is invisible to both the UI and the CLI. This should be fixed alongside the spawn gate fix. And the team-member list "relax" (I2) doesn't achieve what was designed.

Minimum fix set before merge: BLOCKER 1 + BLOCKER 2 + I4 (parentage). I2 can follow.

---

## Raw Transcripts

### Pre-flight
```
$ curl -s http://localhost:4569/health
{"status":"ok","timestamp":1780221841946,"uptime":4206.041078125}

$ curl -si -X POST http://localhost:4569/api/sessions/__probe__/mode -H 'Content-Type: application/json' -d '{"role":"coordinator"}'
HTTP/1.1 403 Forbidden
{"error":true,"code":"mode_self_only","message":"You can only flip your own role"}
# → not stale (route exists)
```

### Group A
```bash
BASE=http://localhost:4569
TASK_ID=task_1780221989497_g91oksw8t
PROJ_ID=proj_1780221860371_7sxft90bk
FRESH_WORKER=sess_1780222015172_vmeviveg9
COORD_SESS=sess_1780221953705_pg5c524qi

# A1 — no X-Session-Id
curl -s -X POST $BASE/api/sessions/spawn -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$PROJ_ID\",\"taskIds\":[\"$TASK_ID\"]}"
# → {"error":true,"code":"sender_session_required","message":"X-Session-Id required"}

# A2 — worker session
curl -s -X POST $BASE/api/sessions/spawn -H 'Content-Type: application/json' \
  -H "X-Session-Id: $FRESH_WORKER" \
  -d "{\"projectId\":\"$PROJ_ID\",\"taskIds\":[\"$TASK_ID\"]}"
# → {"error":true,"code":"spawn_requires_coordinator","message":"Spawning requires coordinator mode..."}

# A3 — coordinator session
curl -s -X POST $BASE/api/sessions/spawn -H 'Content-Type: application/json' \
  -H "X-Session-Id: $COORD_SESS" \
  -d "{\"projectId\":\"$PROJ_ID\",\"taskIds\":[\"$TASK_ID\"]}"
# → HTTP 201 {"success":true,"sessionId":"sess_1780221999840_k1cu5gr2c",...}

# A4 — coordinator, target PROJ_ID_OTHER
curl -s -X POST $BASE/api/sessions/spawn -H 'Content-Type: application/json' \
  -H "X-Session-Id: $COORD_SESS" \
  -d "{\"projectId\":\"proj_1780221860384_6rd5851vt\",\"taskIds\":[\"$TASK_ID\"]}"
# → HTTP 201, projectId=proj_1780221860384_6rd5851vt ✓, parentSessionId=null ✗

# A5 — nonexistent session id
curl -s -X POST $BASE/api/sessions/spawn -H 'Content-Type: application/json' \
  -H "X-Session-Id: sess_nonexistent_12345" \
  -d "{\"projectId\":\"$PROJ_ID\",\"taskIds\":[\"$TASK_ID\"]}"
# → {"error":true,"code":"sender_session_not_found","message":"Sender session sess_nonexistent_12345 not found"}
```

### Group B
```bash
WORKER_SESS=sess_1780221953697_8wcw04f4j
CWORKER_SESS=sess_1780221953713_4xftxbiyj

# B1 — no header
curl -si -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' -d '{"role":"coordinator"}'
# HTTP/1.1 403 {"code":"mode_self_only"}

# B2 — wrong session in header
curl -si -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $COORD_SESS" -d '{"role":"coordinator"}'
# HTTP/1.1 403 {"code":"mode_self_only"}

# B3 — self header, promote
curl -s -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $WORKER_SESS" -d '{"role":"coordinator"}'
# → {"id":"...","mode":"coordinator","previousMode":"worker","changed":true}
# Re-fetch: metadata.mode = "coordinator" ✓

# B4 — idempotent
curl -s -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $WORKER_SESS" -d '{"role":"coordinator"}'
# → {"mode":"coordinator","previousMode":"coordinator","changed":false}

# B5 — demote
curl -s -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $WORKER_SESS" -d '{"role":"worker"}'
# → {"mode":"worker","previousMode":"coordinator","changed":true}

# B6 — coordinated-worker → coordinated-coordinator
curl -s -X POST $BASE/api/sessions/$CWORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $CWORKER_SESS" -d '{"role":"coordinator"}'
# → {"mode":"coordinated-coordinator","previousMode":"coordinated-worker","changed":true}

# B7 — GET mode
curl -s $BASE/api/sessions/$WORKER_SESS/mode
# → {"id":"...","mode":"worker","relation":"standalone","role":"worker"}

# B8 — invalid role
curl -s -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $WORKER_SESS" -d '{"role":"invalid"}'
# → 400 {"code":"VALIDATION_ERROR","details":[{"path":"role","message":"Invalid option: expected one of \"worker\"|\"coordinator\""}]}

# B9 — relation axis
curl -s -X POST $BASE/api/sessions/$WORKER_SESS/mode -H 'Content-Type: application/json' \
  -H "X-Session-Id: $WORKER_SESS" -d '{"relation":"coordinated"}'
# → 400 {"code":"VALIDATION_ERROR","message":"Unrecognized key: \"relation\""}
```

### Group C
```bash
# C1
curl -s "$BASE/api/sessions?active=true" | python3 -c "..."
# statuses in response: {'working', 'idle', 'spawning'} — no completed/failed ✓

# C2
curl -s "$BASE/api/sessions?status=working,idle" | python3 -c "..."
# statuses: {'idle', 'working'} only ✓

# C3
curl -s "$BASE/api/master/sessions?active=true" | python3 -c "..."
# statuses: {'idle', 'working', 'spawning'} ✓
```

### Group D
```bash
# D1–D4 all return HTTP/1.1 200 OK without any auth header
curl -si "$BASE/api/master/projects"   # 200
curl -si "$BASE/api/master/sessions"  # 200
curl -si "$BASE/api/master/tasks"     # 200
curl -si "$BASE/api/master/context"   # 200
```

### Group E
```bash
TM_WORKER_ID=tm_1780221880275_574a9wbbl
PROJ_ID=proj_1780221860371_7sxft90bk

# E1 — no filter
curl -s "$BASE/api/team-members"
# → [] (empty — getGlobalTeamMembers returns 0 project-scoped members) ❌

# E2 — by ID, no projectId
curl -s "$BASE/api/team-members/$TM_WORKER_ID"
# → {"id":"tm_1780221880275_574a9wbbl","name":"test-worker",...} ✓

# E3 — with projectId
curl -s "$BASE/api/team-members?projectId=$PROJ_ID"
# → 9 members (all projectId === PROJ_ID) ✓

# E4 — by ID with wrong projectId
curl -s "$BASE/api/team-members/$TM_WORKER_ID?projectId=anything"
# → {"id":"tm_1780221880275_574a9wbbl",...} ✓ (ID lookup ignores projectId filter)
```

### Group F — WebSocket
```javascript
// Script: /tmp/ws-test2.mjs
// Subscribe without filter (receives ALL events)
// ws.send(JSON.stringify({ type: 'subscribe' }))
// → {"type":"subscribed","timestamp":...}
//
// POST /api/sessions/:id/mode → HTTP 200 changed:true
// Wait 500ms
// All received WS events: ["subscribed"] only
// session:mode_changed events received: 0
//
// ROOT CAUSE: 'session:mode_changed' not in WebSocketBridge setupEventHandlers() events array
// Also absent from TypedEventMap in DomainEvents.ts
```

### Group G — End-to-end trace
```
G1: WS subscribed ✅
G2: GET mode → 200 mode=worker ✅
G3: worker spawn → 403 code=spawn_requires_coordinator ✅
G4: promote → 200 changed=true mode=coordinator ✅; WS event NOT received ❌
G5: GET mode after promote → 200 role=coordinator ✅
G6: coordinator spawn → 201 newSessionId=sess_1780222245534_ipxmokvvg ✅
G7: GET new session → parentSessionId=null ❌, metadata.mode=worker (not coordinated-worker) ❌
G8: demote → 200 changed=true ✅; WS event NOT received ❌
G9: re-locked worker spawn → 403 spawn_requires_coordinator ✅
```

### Cleanup
```bash
# Sessions deleted (200 each): sess_1780221953697_*, sess_1780221953705_*, ...
# Projects deleted (200): proj_1780221860371_*, proj_1780221860384_*, proj_1780221860393_*
# Team members: 400 on direct delete (already cascaded with project delete)
```
