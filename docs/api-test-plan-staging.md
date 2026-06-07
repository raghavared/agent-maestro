# API Test Plan — Workspace Openness + Cross-Project Access (Staging)

> Target: staging server at `http://localhost:4569` (probe `4568` as fallback)
> Method: direct HTTP via `curl` + a small WebSocket node script. Do **not** use the maestro CLI on this box — it's wired to the prod server.
> Source of truth: `docs/workspace-openness-design.md` + `docs/cross-project-access.md`

---

## Pre-flight

1. **Probe the server.**
   - `curl -s http://localhost:4569/health` → expect `{"status":"ok",...}`. If unreachable, try 4568.
   - Capture the working base URL into `BASE=http://localhost:4569`.

2. **Staleness check.** The running staging binary may pre-date the workers' changes.
   - `curl -i -X POST $BASE/api/sessions/__probe__/mode -H 'Content-Type: application/json' -d '{"role":"coordinator"}'` — if 404 (route unknown), the binary is stale. If 403 `mode_self_only` or 400, the route exists.

3. **If stale, rebuild + restart staging.**
   - `cd /Users/subhang/Desktop/Projects/maestro/agent-maestro && bun run build:server`
   - Find old staging PID: `lsof -iTCP:4569 -sTCP:LISTEN | awk 'NR>1{print $2}'` → `kill <pid>`
   - Relaunch: `cd /Users/subhang/Desktop/Projects/maestro/agent-maestro && bun run staging:server &` and wait for `/health` to respond.

4. **Fixture setup (capture IDs for the rest of the run).**
   - Create a test project: `POST $BASE/api/projects` with `{"name":"api-test","workingDir":"/tmp/api-test","isMaster":false}`. Capture `PROJ_ID`.
   - Create a second test project: same shape, name `api-test-other`. Capture `PROJ_ID_OTHER`. Used to verify cross-project spawn.
   - Create one master project: `{"name":"api-test-master","isMaster":true,...}`. Capture `MASTER_PROJ_ID`. Used to verify master-route open access.
   - Create a worker team-member: `POST $BASE/api/team-members` with `mode:"worker"`, projectId=PROJ_ID. Capture `TM_WORKER_ID`.
   - Create a coordinator team-member: same but `mode:"coordinator"`. Capture `TM_COORD_ID`.
   - Create a coordinated-worker session directly via `POST $BASE/api/sessions` (worker mode, no parent): capture `WORKER_SESS`. Also create a session in coordinator mode: capture `COORD_SESS`. And one in `coordinated-worker` mode (`parentSessionId` set to COORD_SESS): capture `CWORKER_SESS`. These three exercise all four mode permutations after role-flip.

---

## Group A — Spawn gate (`POST /api/sessions/spawn`)

| # | Request | Expected |
|---|---|---|
| A1 | Spawn without `X-Session-Id` header | 400, body code `sender_session_required` |
| A2 | Spawn with `X-Session-Id: $WORKER_SESS` | 403, code `spawn_requires_coordinator` |
| A3 | Spawn with `X-Session-Id: $COORD_SESS` | 200, response contains new session id |
| A4 | A3 + body `projectId: $PROJ_ID_OTHER` | 200, new session's `projectId === PROJ_ID_OTHER` (re-fetch via GET /api/sessions/<id> to confirm) |
| A5 | Spawn with `X-Session-Id` of a nonexistent id | 400, code `sender_session_not_found` |

Document for each case: HTTP status, response body, and (for A3/A4) whether the spawned session was actually created with the right `parentSessionId` and `relation=coordinated`.

---

## Group B — Mode endpoint (`/api/sessions/:id/mode`)

For each case, capture HTTP status, response body, and (where applicable) the event payload received over WS.

| # | Request | Expected |
|---|---|---|
| B1 | `POST /:id/mode` without `X-Session-Id` | 403, code `mode_self_only` |
| B2 | `POST /:WORKER_SESS/mode` with `X-Session-Id: $COORD_SESS` | 403, code `mode_self_only` |
| B3 | `POST /:WORKER_SESS/mode` with header self, body `{role:'coordinator'}` | 200, `{mode:'coordinator', previousMode:'worker', changed:true}`. Re-fetch session → mode persisted. WS event emitted. |
| B4 | Same as B3 immediately after (idempotent) | 200, `changed:false`, no WS event. |
| B5 | `POST /:WORKER_SESS/mode` body `{role:'worker'}` (demote) | 200, `{mode:'worker', previousMode:'coordinator', changed:true}`. WS event emitted. |
| B6 | `POST /:CWORKER_SESS/mode` body `{role:'coordinator'}` (preserves relation) | 200, `{mode:'coordinated-coordinator', previousMode:'coordinated-worker', changed:true}`. **Must NOT collapse to `coordinator`.** |
| B7 | `GET /:WORKER_SESS/mode` | 200, `{id, mode, relation, role}` with `relation` and `role` correctly derived. |
| B8 | `POST` with body `{role:'invalid'}` | 400 (zod validation). |
| B9 | `POST` with body `{relation:'coordinated'}` (attempt to mutate relation axis) | Either 400 or 200 but `relation` unchanged. Document actual behavior. |

---

## Group C — `?active=` / `?status=` filters

Create one extra session per status (or use existing). Then:

| # | Request | Expected |
|---|---|---|
| C1 | `GET $BASE/api/sessions?active=true` | Only returns sessions with `status ∈ {spawning, idle, working}`. Confirm sessions with `status=completed` / `failed` are absent. |
| C2 | `GET $BASE/api/sessions?status=working,idle` | CSV filter; only those two statuses returned. |
| C3 | `GET $BASE/api/master/sessions?active=true` | Same behavior as C1 on the master alias. |

---

## Group D — Master routes (auth dropped, kept as aliases)

Hit each without any `X-Session-Id` header.

| # | Request | Expected |
|---|---|---|
| D1 | `GET $BASE/api/master/projects` | 200, list (not 401/403). |
| D2 | `GET $BASE/api/master/sessions` | 200. |
| D3 | `GET $BASE/api/master/tasks` | 200. |
| D4 | `GET $BASE/api/master/context` | 200. |

If any return 401/403/throw, the `authMiddleware` drop wasn't applied — log as blocker.

---

## Group E — Team-member route relax

| # | Request | Expected |
|---|---|---|
| E1 | `GET $BASE/api/team-members` (no `projectId`) | 200, list across all projects. (Was 400 pre-change.) |
| E2 | `GET $BASE/api/team-members/$TM_WORKER_ID` (no `projectId`) | 200, single team-member object. |
| E3 | `GET $BASE/api/team-members?projectId=$PROJ_ID` | 200, list filtered to that project. |
| E4 | `GET $BASE/api/team-members/$TM_WORKER_ID?projectId=anything` | 200; id is globally unique so filter shouldn't matter, but confirm no error. |

---

## Group F — WebSocket `session:mode_changed` event

Write a small node script (or use `wscat`):
```js
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:4569');
ws.on('open', () => ws.send(JSON.stringify({type:'subscribe', sessionIds:['ALL']})));
ws.on('message', (m) => console.log(m.toString()));
```

(Check the existing WS bridge protocol in `maestro-server/src/infrastructure/websocket/` for the actual subscribe shape — use it as the contract.)

| # | Action | Expected event |
|---|---|---|
| F1 | Subscribe; then POST mode B3 (worker→coordinator) | Receive event `{ type:'session:mode_changed', payload:{ sessionId, mode:'coordinator', previousMode:'worker', changed:true, timestamp:<num> } }` within 1s. |
| F2 | Repeat B3 (idempotent) | NO `session:mode_changed` event emitted. |
| F3 | POST demote (B5) | Receive event with `mode:'worker', previousMode:'coordinator', changed:true`. |
| F4 | POST B6 (coordinated-worker → coordinated-coordinator) | Receive event with `mode:'coordinated-coordinator', previousMode:'coordinated-worker'`. |

---

## Group G — End-to-end integration trace

Single happy-path scenario (recorded as one transcript):

1. Subscribe WS to all sessions.
2. Confirm `$WORKER_SESS.mode === 'worker'` via GET.
3. Worker attempts spawn → expect 403 (A2 repeat as smoke).
4. POST `/sessions/$WORKER_SESS/mode` with self-id header, role coordinator → expect 200 changed:true + WS event.
5. GET `/sessions/$WORKER_SESS/mode` → confirm role=coordinator.
6. Worker (now coordinator) POSTs `/sessions/spawn` with self-id header → expect 200, new session N created.
7. GET the new session N → confirm `parentSessionId === $WORKER_SESS`, mode has `relation=coordinated`.
8. POST demote on $WORKER_SESS → expect 200 changed:true.
9. Worker attempts spawn again → expect 403 (re-locked).

Document any deviation step by step.

---

## Cleanup

Delete the fixtures created in pre-flight:
- DELETE the three test projects (cascade should remove team-members and sessions; verify).
- Or note any cleanup gaps for the user to handle later.

---

## Output format (the deliverable)

A single markdown report with:

1. **Pre-flight summary** — staging port confirmed, rebuild required Y/N, server start time.
2. **Per-group results table** — for each row above, ✅ pass / ❌ fail / ⚠️ skipped, plus the actual HTTP status + body snippet for any ❌.
3. **🔴 BLOCKERS / 🟡 ISSUES / 🟢 NITS** — design conformance gaps.
4. **Verdict** — APIs ready / needs fixes / blocked.
5. **Raw curl + WS transcripts** — appended at the bottom so anyone can reproduce.

Be loud about contract violations (status codes, error code strings, payload shape mismatches). They're the whole point of this audit.
