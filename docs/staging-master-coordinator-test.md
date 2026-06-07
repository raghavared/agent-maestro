# Staging Master Coordinator Test Plan

> Runbook to validate **workspace openness** + **cross-project access** end-to-end on staging.
>
> Designs being verified:
> - `docs/workspace-openness-design.md`
> - `docs/cross-project-access.md`
> - `docs/any-session-can-coordinate.md`

---

## 0. Environment & setup

| | Value |
|---|---|
| Port | **4569** (`package.json` → `staging:server`) |
| Data dir | `~/.maestro-staging/data/` |
| Sessions dir | `~/.maestro-staging/sessions/` |
| Server start | `bun run staging:server` (or `bun run staging` for server + Tauri UI) |
| UI env | `VITE_API_URL=http://localhost:4569/api`, `VITE_WS_URL=ws://localhost:4569` |

Open **two terminals**:
- **A** = a real spawned session (will play "worker" then "coordinator")
- **B** = a second spawned session (the recipient / cross-project peer)

For each terminal, capture its `MAESTRO_SESSION_ID` after spawn — you'll reference it in later steps.

Pre-flight sanity:

```bash
maestro whoami
maestro status
echo "MAESTRO_SESSION_ID=$MAESTRO_SESSION_ID"
echo "MAESTRO_PROJECT_ID=$MAESTRO_PROJECT_ID"
echo "MAESTRO_IS_MASTER=$MAESTRO_IS_MASTER"
```

Expected: ids populated; `MAESTRO_IS_MASTER` may be `true` or empty depending on which project you spawned in.

---

## 1. Mode model — promotion / demotion

### 1.1 `coordinator status` reflects current mode

In terminal A (spawned with a **worker** team member):

```bash
maestro coordinator status
```

✅ Expected: prints `mode: worker`, `relation: standalone`, `role: worker` (or `coordinated-worker` / `coordinated` if spawned by a coordinator).

### 1.2 `coordinator enable` flips role only

```bash
maestro coordinator enable
maestro coordinator status
```

✅ Expected:
- Confirmation line: `✔ Mode: coordinator (was: worker)` (or `coordinated-coordinator (was: coordinated-worker)`).
- Status shows `role: coordinator`, `relation` **unchanged** from §1.1.
- `changed: true` in server response.

### 1.3 Idempotent enable

```bash
maestro coordinator enable
```

✅ Expected: "Already a coordinator" message, `changed: false`. No WebSocket event in the UI.

### 1.4 `coordinator disable` flips back

```bash
maestro coordinator disable
maestro coordinator status
```

✅ Expected: `role: worker`, `relation` still unchanged. Subsequent spawn attempt should now 403 (see §2.2).

### 1.5 Cross-session promote is rejected

From terminal A, try to promote terminal B:

```bash
curl -X POST http://localhost:4569/api/sessions/<B_SESSION_ID>/mode \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: <A_SESSION_ID>" \
  -d '{"role":"coordinator"}'
```

✅ Expected: **403** — `X-Session-Id` header must equal `:id` (self-only mutation).

---

## 2. Spawn gate — the only real gate

### 2.1 Spawn as coordinator succeeds

Make terminal A a coordinator (§1.2), then:

```bash
maestro coordinator enable
maestro session spawn --team-member-id <any-worker-tm-id> \
  --subject "spawn test" --message "noop"
```

✅ Expected: returns spawn request; terminal pops up; child session has `parentSessionId = A`, `relation = coordinated`.

### 2.2 Spawn as worker is blocked with the new code

```bash
maestro coordinator disable
maestro session spawn --team-member-id <any-tm-id> --subject "x" --message "y"
```

✅ Expected: **403** with body:

```json
{ "error": true, "code": "spawn_requires_coordinator",
  "message": "Spawning requires coordinator mode. Run `maestro coordinator enable` first." }
```

### 2.3 Re-promote and spawn into a **different** project

```bash
maestro coordinator enable
maestro master projects   # pick a target projectId different from current
maestro session spawn --project <other_projectId> \
  --team-member-id <tm-id-in-that-project> \
  --subject "cross-project spawn" --message "hi"
```

✅ Expected: spawn succeeds; the new session appears under the target project (`maestro master sessions --project <other_projectId>` shows it).

---

## 3. Free messaging (no team-boundary gate)

### 3.1 Worker → unrelated session, same project

In terminal A (as worker, demote first if needed):

```bash
maestro session prompt <B_SESSION_ID> --message "ping from A"
```

✅ Expected: 200 OK. Terminal B receives `[From: <A name> (sess_…)]\nping from A`.

### 3.2 Worker → session in **another project**

```bash
maestro master sessions   # pick any sessionId in a different project
maestro session prompt <that_sessionId> --message "cross-project ping"
```

✅ Expected: 200 OK. **Previously this returned 403 `prompt_scope_violation`.**

### 3.3 Negative cases (still rejected, but with clean error codes)

```bash
# Missing sender
curl -X POST http://localhost:4569/api/sessions/<B>/prompt \
  -H "Content-Type: application/json" \
  -d '{"content":"x"}'

# Self-prompt
maestro session prompt <A_SESSION_ID> --message "self"

# Bogus sender id
curl -X POST http://localhost:4569/api/sessions/<B>/prompt \
  -H "Content-Type: application/json" \
  -d '{"content":"x","senderSessionId":"nope"}'
```

✅ Expected codes (cleaned up from the old `prompt_scope_violation`):
- 400 `senderSessionId is required …`
- 400 `self_prompt_not_allowed`
- 404 `sender_not_found`

---

## 4. Cross-project access — list/get flags

### 4.1 `session:list` resolution precedence

```bash
maestro session list                                # current project (env/config)
maestro session list --project-id <other_projectId> # exactly that project
maestro session list --all-projects                 # every project
maestro -p <X> session list --project-id <Y>        # flag wins over global
```

✅ Expected: each resolves to exactly one of (current | flag | env | all). The fourth lists project `Y`, not `X`.

### 4.2 `task:list` mirrors session:list

```bash
maestro task list
maestro task list --project-id <other_projectId>
maestro task list --all-projects
maestro task list --all   # legacy alias → deprecation warning, behaves like --all-projects
```

✅ Expected: parity with §4.1; `--all` prints a one-line deprecation notice.

### 4.3 `team-member:list` no longer requires a project

```bash
maestro team-member list                       # no flag, no env → previously 400
maestro team-member list --all-projects
maestro team-member list --project-id <X>
```

✅ Expected: all three return 200. **Previously the bare call 400'd with "projectId required."**

### 4.4 `*:get` / `*:info` are project-agnostic

```bash
maestro team-member get <tm-id>          # no --project
maestro task get <task-id>
maestro session info <sess-id>
```

✅ Expected: 200 in all three. The old `team-member get --project required` is gone.

### 4.5 `spell:list` parity

```bash
maestro spell list
maestro spell list --project-id <X>
maestro spell list --all-projects
```

✅ Expected: behaves like session/task.

---

## 5. Master aliases stay alive (read-only, ungated)

These are kept for ergonomic UX, but no longer enforce master-session auth.

```bash
maestro master projects
maestro master tasks
maestro master tasks --project <X>
maestro master sessions
maestro master sessions --project <X>
maestro master sessions --active
maestro master context
```

✅ Expected: all return 200 **from a non-master session too**. Compare to plain `/api/sessions`, etc. — output shape should match.

`--active` filter:

```bash
maestro master sessions --active
```

✅ Expected: only sessions with status ∈ {spawning, idle, working}. Stale "working" rows from old sessions are filtered out.

---

## 6. Persistence fixes

### 6.1 `isMasterSession` is persisted on create

```bash
# Spawn a session in a master project, then:
cat ~/.maestro-staging/data/sessions/<new_session_id>.json | jq .isMasterSession
```

✅ Expected: `true` (matches `Project.isMaster`). Previously this field was dropped on first write.

### 6.2 `X-Session-Id` is attached from the CLI

In any session, run a command that calls the server (e.g. `maestro task list`) while tailing the server log:

```bash
# In server process: look for X-Session-Id in the request log
```

✅ Expected: every CLI → server request carries `X-Session-Id: sess_…` matching the calling session. Required by `coordinator enable/disable` and by sender identity in prompt.

---

## 7. Prompt composition

Pick a freshly spawned worker session and view its system prompt (CLI prints it on init, or read from the manifest at `~/.maestro-staging/data/manifests/<sess>.json`):

### 7.1 `<workspace_context>` block (renamed from `<master_project_context>`)

✅ Expected when the project is master **or** the workspace has >1 projects:

```xml
<workspace_context>
  <description>You can reach any session in any project in this workspace.</description>
  <projects> … </projects>
  <commands> … `maestro master sessions --active` …  `maestro session spawn --project …` … </commands>
</workspace_context>
```

✅ The literal string `<master_project_context>` should NOT appear anywhere in the prompt.

### 7.2 `<coordinator_promotion>` block for workers only

In a **worker** prompt:

```xml
<coordinator_promotion>
  You are a worker. … run `maestro coordinator enable` first. …
</coordinator_promotion>
```

✅ In a **coordinator** prompt: this block must be **absent**.

### 7.3 `promptModes` applied globally

In a **worker** prompt:
- `<commands_reference>` must NOT list `session:spawn`, `session:list`, `session:info`, `session:watch`, `session:logs`.
- `<capability_summary>` must show `canSpawnSessions = false` and `canPromptOtherSessions = true`.
- `coordinator:enable`, `coordinator:disable`, `coordinator:status` MUST be present (promptModes = ALL_MODES).

In a **coordinator** prompt:
- All five session:* commands listed.
- `canSpawnSessions = true`.

---

## 8. UI — live mode chip + coordinator glow

(Run with `bun run dev:all` so the Tauri UI is up.)

1. Open the session details for terminal A (worker mode). Verify the **mode chip** reads `worker` and the terminal pane has the **default flat border**.
2. In terminal A: `maestro coordinator enable`.
3. ✅ Within ~300 ms (no refresh): the chip flips to **coordinator** and a soft **glow** appears around the active terminal pane. The `session:mode_changed` WS event drives both.
4. `maestro coordinator disable` → chip flips back, glow fades out (~200 ms fade).
5. Toggle focus to terminal B → terminal B (still worker) has no glow even though A had it. (Glow is per-session, not per-active-pane.)

Inspect via DevTools that the Zustand `sessions[A].mode` field updated without a `GET /api/sessions/:id` fetch (it should — the change comes from the WS event).

---

## 9. WebSocket event shape

Tail WS messages (UI DevTools network panel or a small `wscat` client to `ws://localhost:4569/ws`).

Trigger `maestro coordinator enable`. ✅ Expected event:

```json
{
  "event": "session:mode_changed",
  "data": {
    "sessionId": "sess_…",
    "mode": "coordinator",
    "previousMode": "worker",
    "changed": true,
    "timestamp": "<ISO8601>"
  }
}
```

Idempotent calls (already that role) must emit **no** event.

---

## 10. What should NOT have regressed

Quick sanity to confirm nothing broke:

```bash
maestro task create "test" --desc "smoke" && maestro task list --project-id $MAESTRO_PROJECT_ID
maestro session siblings
maestro session logs <A_SESSION_ID>
maestro team-member list --project-id $MAESTRO_PROJECT_ID
```

✅ Expected: all return successful, structured output.

---

## Result template

When done, fill in:

| Section | Pass | Fail | Notes |
|---|---|---|---|
| 1. Mode model | ✅ | | enable/disable/idempotent correct; cross-session promote → 403 `mode_self_only`. |
| 2. Spawn gate | ✅ | | worker(spawnSource=session) → 403 `spawn_requires_coordinator`; coordinator + cross-project spawn → 201. Caveat: gate skipped when `spawnSource:'ui'` (OBS-1). |
| 3. Free messaging | ⚠️ | | cross-project msg 200 both ways; `prompt_scope_violation` gone. BUG-3: `sender_not_found`/`target_not_found` unreachable → generic 404 `NOT_FOUND`. |
| 4. Cross-project list/get | | ❌ | session/task/team-member OK + `--all` deprecation. **BUG-2: `spell list` bare/`--project-id` → 400** (`/api/spells/definitions` schema strict). |
| 5. Master aliases | ✅ | | projects/tasks/sessions/context + `--active` all 200, ungated for non-master sender. |
| 6. Persistence | ✅ | | `isMasterSession` persisted (true/false); `X-Session-Id` attached (api.ts:44); `completedAt` accepted (200). |
| 7. Prompt composition | ✅ | | `workspace_context` present, `master_project_context` gone, promotion block worker-only, promptModes correct. |
| 8. UI chip + glow | | ❌ | Not visually tested (headless). Live update broken by BUG-1 (driving WS event never delivered). |
| 9. WS event | | ❌ | **BUG-1: `session:mode_changed` not in WebSocketBridge forward list (WebSocketBridge.ts:146-197)** → 0 events reach clients. Idempotent → no emit ✅. |
| 10. Regression sanity | ✅ | | task create/list, session siblings/logs, team-member list all OK. |

Report failures with the exact command, the response body, and the section number.

**Full report with root causes and fixes: `docs/staging-master-coordinator-test-report.md`.**

Bugs: **BUG-1 (HIGH)** add `'session:mode_changed'` to `WebSocketBridge.ts:146` events array · **BUG-2 (MED)** `listSpellDefinitionsQuerySchema` (validation.ts:420) must accept `projectId`/`allProjects` · **BUG-3 (LOW)** prompt route resolves sessions via throwing `getSession`, so sharp 404 codes at sessionRoutes.ts:996/1003 are unreachable.

---

## Result — 2026-06-07 run

Runner session A: `sess_1780843939931_i4ymdahi7` (coordinated-worker, proj_1770533548982_3bgizuthk / master)
Peer session B: `sess_1780843894720_lqtay69w7`
Server: `http://localhost:4569`, data: `~/.maestro-staging/data/`

| Section | Pass | Fail | Notes |
|---|---|---|---|
| 1. Mode model | ✅ | | §1.1 status shows `mode: coordinated-worker, relation: coordinated, role: worker`. §1.2 enable → `coordinated-coordinator`, relation unchanged. §1.3 idempotent → "Already a coordinator", no event. §1.4 disable → back to `coordinated-worker`. §1.5 cross-session promote → **403** `mode_self_only`. All correct. |
| 2. Spawn gate | ✅ | | §2.1 coordinator spawn → **201**, `parentSessionId=A`, `MAESTRO_MODE=coordinated-worker` ✅. §2.2 worker spawn → **403** `spawn_requires_coordinator` ✅. §2.3 coordinator cross-project spawn (proj `ppl416w4l`) → **201**, new session in target project ✅. |
| 3. Free messaging | ⚠️ | | §3.1 worker→B same project → 200, B acknowledged "ping from A" ✅. §3.2 worker→cross-project session → 200 ✅. §3.3 **BUG-3 STILL PRESENT**: missing sender (no header) → 400 ✅; self-prompt → 400 `self_prompt_not_allowed` ✅; bogus `senderSessionId` in body → 404 `NOT_FOUND` ❌ (expected `sender_not_found`). Root cause: `getSession()` throws `NotFoundError` before null-checks at sessionRoutes.ts:993/1000. |
| 4. Cross-project list/get | ⚠️ | | §4.1 session:list current/flag/all-projects all resolve correctly ✅. §4.2 task:list with `--all` deprecation warning ✅. §4.3 team-member bare → 200 ✅; `--all-projects` → 200 but empty (server falls through to `getGlobalTeamMembers()`, no global members exist) ⚠️; `--project-id` → 200 ✅. §4.4 team-member get, task get, session info all 200 without `--project` ✅. §4.5 **BUG-2 STILL PRESENT**: `maestro spell list` → **400** "Invalid query parameters"; `--project-id` → **400**; `--all-projects` → 200 ✅. Root cause: `listSpellDefinitionsQuerySchema` is `.strict()` and rejects `projectId`/`allProjects` params. |
| 5. Master aliases | ✅ | | `master projects/tasks/sessions/context` all 200, ungated for non-master session. `--active` filter correctly returns only spawning/idle/working sessions. `--project` flag passes but filter doesn't narrow results (minor, out of scope). |
| 6. Persistence | ✅ | | §6.1 spawned master-project session: `isMasterSession=true` ✅; cross-project session: `isMasterSession=false` ✅. §6.2 CLI source (api.ts:44) confirms `X-Session-Id: $MAESTRO_SESSION_ID` sent on every request; coordinator enable/disable requires and uses it ✅. |
| 7. Prompt composition | ✅ | | §7.1 current session manifest: `isMaster=true`, 5 masterProjects. System prompt (verified live) contains `<workspace_context>` block with `<description>`, `<projects>`, `<commands>` ✅. `master_project_context` absent ✅. §7.2 `<coordinator_promotion>` present in worker prompt ✅; `buildCoordinatorPromotionBlock` returns null for coordinator modes ✅. §7.3 Worker commands_reference: `session {siblings\|prompt}` only (no spawn/list/info/watch/logs) ✅. `coordinator {enable\|disable\|status}` in ALL_MODES ✅. `canPromptOtherSessions=true` in capability_summary ✅; `canSpawnSessions` omitted (false by omission) ✅. |
| 8. UI chip + glow | ⚠️ | | Not visually verified (headless). Code inspection: `session:mode_changed` absent from WebSocketBridge forward list (WebSocketBridge.ts:146-197), so no WS event reaches the UI store → chip and glow cannot update. BUG-1 drives this failure. |
| 9. WS event | | ❌ | **BUG-1 STILL PRESENT.** Live WS test (Bun WebSocket client to `ws://localhost:4569/ws`): triggered `coordinator enable` (changed) + idempotent `enable` + `coordinator disable`. Zero events of any type received including `session:mode_changed`. Root cause confirmed: event emitted at sessionRoutes.ts:712 but not in WebSocketBridge.ts events array. Idempotent call correctly emits no event ✅ (returns early at line 708). Expected shape verified in source: `{ sessionId, mode, previousMode, changed:true, timestamp }`. |
| 10. Regression sanity | ✅ | | `maestro task create + task list` ✅. `maestro session siblings` returns structured output (empty — no active co-workers) ✅. `maestro session logs` ✅. `maestro team-member list --project-id` ✅. |

### Bug fix status

| Bug | Status |
|---|---|
| **BUG-1** (HIGH) `session:mode_changed` missing from WebSocketBridge forward list | ❌ **STILL PRESENT** — add `'session:mode_changed'` to the `events` array at `WebSocketBridge.ts:146`. |
| **BUG-2** (MED) `spell list` bare/`--project-id` returns 400 | ❌ **STILL PRESENT** — `listSpellDefinitionsQuerySchema` at `validation.ts:420` uses `.strict()`, rejects `projectId`/`allProjects`; add those fields. |
| **BUG-3** (LOW) prompt route sharp 404 codes unreachable | ❌ **STILL PRESENT** — `getSession()` (SessionService.ts:88) throws instead of returning null; `Promise.all` at sessionRoutes.ts:988-990 throws before null-checks at lines 993/1000. Fix: use `sessionRepo.findById()` directly or add a non-throwing `findSession()` method. |

### Fail details

**§3.3 BUG-3** — Bogus senderSessionId:
```
curl -X POST http://localhost:4569/api/sessions/sess_1780843894720_lqtay69w7/prompt \
  -H "Content-Type: application/json" \
  -d '{"content":"x","senderSessionId":"nope"}'
→ {"error":true,"statusCode":404,"code":"NOT_FOUND","message":"Session with id 'nope' not found"}  [HTTP 404]
Expected code: sender_not_found
```

**§4.5 BUG-2** — Spell list bare:
```
maestro spell list
→ Error: Invalid query parameters  [HTTP 400]
maestro spell list --project-id proj_1770533548982_3bgizuthk
→ Error: Invalid query parameters  [HTTP 400]
maestro spell list --all-projects
→ 200 OK (works correctly)
```

**§9 BUG-1** — No WS event after coordinator enable:
```
# WS client connected to ws://localhost:4569/ws
# maestro coordinator enable → "Mode: coordinated-coordinator (was: coordinated-worker)"
# WS client received: 0 events (confirmed with Bun WebSocket client)
# Expected: { "event": "session:mode_changed", "data": { sessionId, mode, previousMode, changed:true, timestamp } }
```

---

## Result — 2026-06-07 run 2

Runner session A: `sess_1780847937740_jr26qdoss` (coordinated-worker, proj_1770533548982_3bgizuthk / master)
Peer session B: `sess_1780847900812_knp9ijx9k`
Server: `http://localhost:4569`, data: `~/.maestro-staging/data/`

Pre-flight: `MAESTRO_SESSION_ID=sess_1780847937740_jr26qdoss`, `MAESTRO_PROJECT_ID=proj_1770533548982_3bgizuthk`, `MAESTRO_IS_MASTER=true`.

| Section | Pass | Fail | Notes |
|---|---|---|---|
| 1. Mode model | ✅ | | §1.1 status → `mode: coordinated-worker, relation: coordinated, role: worker` ✅. §1.2 enable → `coordinated-coordinator (was: coordinated-worker)`, relation unchanged ✅. §1.3 idempotent → "Already a coordinator." ✅. §1.4 disable → back to `coordinated-worker` ✅. §1.5 cross-session promote → **403** `mode_self_only` ✅. |
| 2. Spawn gate | ✅ | | §2.1 coordinator spawn → **201**, `parentSessionId=sess_1780847937740_jr26qdoss`, `MAESTRO_MODE=coordinated-worker` ✅. §2.2 worker spawn → **403** `spawn_requires_coordinator` ✅. §2.3 coordinator cross-project spawn (proj `ppl416w4l`, tm `tm_proj_1770462609768_ppl416w4l_simple_worker`) → **201**, new session `sess_1780848131269_yeslgay9x` in target project, `isMasterSession=false` ✅. |
| 3. Free messaging | ⚠️ | | §3.1 worker→B same project → 200 ✅. §3.2 worker→cross-project session → 200 ✅. §3.3 **BUG-3 STILL PRESENT**: missing sender (no body field) → 400 `senderSessionId is required and must be a string` ✅; self-prompt → 400 `self_prompt_not_allowed` ✅; bogus `senderSessionId:"nope"` → 404 `NOT_FOUND` ❌ (expected `sender_not_found`). Root cause: `getSession()` at SessionService.ts:88 throws `NotFoundError` before null-checks at sessionRoutes.ts:993/1000. |
| 4. Cross-project list/get | ⚠️ | | §4.1 session list: current/--project-id/--all-projects all resolve correctly ✅. §4.2 task list: bare/flag/all-projects ✅; `--all` → deprecation warning + all-projects behaviour ✅. §4.3 team-member bare → 200 ✅; `--all-projects` → 200 but "No team members found." ⚠️ (no global members); `--project-id` → 200 ✅. §4.4 team-member get, task get, session info all 200 without `--project` ✅. §4.5 **BUG-2 STILL PRESENT**: `maestro spell list` → **400** "Invalid query parameters"; `--project-id` → **400**; `--all-projects` → 200 ✅. Root cause: `listSpellDefinitionsQuerySchema` at validation.ts:420 is `.strict()`, rejects `projectId`/`allProjects`. |
| 5. Master aliases | ✅ | | `master projects/tasks/sessions/context` all 200, ungated for non-master session ✅. `--active` returns only working sessions (3 active, stale sessions excluded) ✅. `master tasks --project` passes but filtering not further scoped (minor). |
| 6. Persistence | ✅ | | §6.1 same-project spawned session `isMasterSession=True` ✅; cross-project spawned session `isMasterSession=False` ✅. §6.2 api.ts:44 confirms `X-Session-Id: $MAESTRO_SESSION_ID` header attached to every CLI→server request ✅. |
| 7. Prompt composition | ✅ | | §7.1 manifest: `isMaster=true`, 5 masterProjects. `buildMasterProjectContext()` emits `<workspace_context>` block (description, projects, commands) ✅. Literal string `master_project_context` absent from all CLI source ✅. §7.2 `buildCoordinatorPromotionBlock()` returns `<coordinator_promotion>` for modes worker/coordinated-worker; returns null for coordinator modes ✅. §7.3 Worker promptModes: session:list/info/watch/spawn/logs have `promptModes: COORDINATOR_MODES` (hidden from worker) ✅; coordinator:enable/disable/status have `promptModes: ALL_MODES` ✅; `canSpawnSessions` based on session:spawn visibility (false for workers) ✅. |
| 8. UI chip + glow | ⚠️ | | Not visually verified (headless session). Code: `session:mode_changed` absent from WebSocketBridge events array (websocket/WebSocketBridge.ts:146-197) → no WS event reaches UI → chip and glow cannot update. BUG-1 drives this failure. |
| 9. WS event | | ❌ | **BUG-1 STILL PRESENT.** Live Bun WebSocket client connected to `ws://localhost:4569/ws`. Triggered: coordinator enable (changed) → coordinator disable (changed) → coordinator enable (changed) → coordinator enable (idempotent). Total events received: **0**. Root cause confirmed: `session:mode_changed` not in events array at `websocket/WebSocketBridge.ts:146`. Idempotent call correctly emits no server-side event ✅. |
| 10. Regression sanity | ✅ | | `maestro task create + task list` ✅. `maestro session siblings` → structured output (B appears as sibling) ✅. `maestro session logs <B>` ✅. `maestro team-member list --project-id` ✅. |

### Bug fix status (run 2)

| Bug | Status |
|---|---|
| **BUG-1** (HIGH) `session:mode_changed` missing from WebSocketBridge forward list | ❌ **STILL PRESENT** — add `'session:mode_changed'` to the `events` array at `websocket/WebSocketBridge.ts:146`. Live WS test: 0 events received across 3 enable/disable cycles. |
| **BUG-2** (MED) `spell list` bare/`--project-id` returns 400 | ❌ **STILL PRESENT** — `listSpellDefinitionsQuerySchema` at validation.ts:420 uses `.strict()`, rejects `projectId`/`allProjects`; only `entityType` is accepted. `--all-projects` → 200. |
| **BUG-3** (LOW) prompt route sharp 404 codes unreachable | ❌ **STILL PRESENT** — `getSession()` (SessionService.ts:88) throws `NotFoundError`; `Promise.all` at sessionRoutes.ts:988-990 throws before null-check at line 993. Bogus sender → `NOT_FOUND` instead of `sender_not_found`. |

### Fail details (run 2)

**§3.3 BUG-3** — Bogus senderSessionId:
```
curl -X POST http://localhost:4569/api/sessions/sess_1780847900812_knp9ijx9k/prompt \
  -H "Content-Type: application/json" \
  -d '{"content":"x","senderSessionId":"nope"}'
→ {"error":true,"statusCode":404,"code":"NOT_FOUND","message":"Session with id 'nope' not found"}  [HTTP 404]
Expected code: sender_not_found
```

**§4.5 BUG-2** — Spell list bare and --project-id:
```
maestro spell list
→ Error: Invalid query parameters  [HTTP 400]
maestro spell list --project-id proj_1770533548982_3bgizuthk
→ Error: Invalid query parameters  [HTTP 400]
maestro spell list --all-projects
→ 200 OK (lists spells correctly)
```

**§9 BUG-1** — No WS events after coordinator enable/disable:
```
# Bun WS client connected to ws://localhost:4569/ws
# maestro coordinator enable  → "Mode: coordinated-coordinator (was: coordinated-worker)"
# maestro coordinator disable → "Mode demoted to worker."
# maestro coordinator enable  → "Mode: coordinated-coordinator (was: coordinated-worker)"
# maestro coordinator enable  → "Already a coordinator." (idempotent)
# WS client received: 0 events total (0 session:mode_changed events)
# Expected: { "event": "session:mode_changed", "data": { sessionId, mode, previousMode, changed:true, timestamp } }
# Fix: add 'session:mode_changed' to events[] at websocket/WebSocketBridge.ts:146
```
