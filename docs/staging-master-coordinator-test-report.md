# Staging Master-Coordinator Test — Results Report

**Date:** 2026-06-07
**Target:** staging server `http://localhost:4569`, data `~/.maestro-staging/data/`
**Runbook:** `docs/staging-master-coordinator-test.md`
**Method:** Executed by the Agent-maestro coordinator session (`sess_1780837763860_7830gi9ix`) via direct CLI + API calls, plus a live WebSocket capture and source-level verification. A spawned worker (session A, `sess_1780837865153_l8lpoe303`) ran §1–§4.5 before crashing; the coordinator re-ran and extended every section authoritatively.

---

## Summary table

| Section | Result | One-line verdict |
|---|---|---|
| 1. Mode model | ✅ PASS | enable/disable/idempotent correct; cross-session promote → 403 `mode_self_only` |
| 2. Spawn gate | ✅ PASS (1 caveat) | worker spawn → 403 `spawn_requires_coordinator`; coordinator + cross-project spawn → 201 |
| 3. Free messaging | ⚠️ PASS w/ defects | cross-project messaging works both ways; `prompt_scope_violation` gone; sharp 404 codes unreachable |
| 4. Cross-project list/get | ❌ PARTIAL | session/task/team-member OK; **spell list rejects `projectId`/`allProjects` (400)** |
| 5. Master aliases | ✅ PASS | all 4 aliases + `--active` return 200, ungated even for non-master sender |
| 6. Persistence | ✅ PASS | `isMasterSession` persisted; `X-Session-Id` attached; `completedAt` accepted |
| 7. Prompt composition | ✅ PASS | `workspace_context` present, `master_project_context` gone, promotion block worker-only, promptModes correct |
| 8. UI chip + glow | ❌ FAIL | live update cannot work — its driving WS event is never delivered (see §9). Not visually tested (headless). |
| 9. WS event | ❌ FAIL | `session:mode_changed` emitted but **not forwarded by WebSocketBridge** → 0 events reach clients |
| 10. Regression sanity | ✅ PASS | task create/list, session siblings/logs, team-member list all OK |

**Score: 6 pass / 1 partial-pass / 1 partial-fail / 2 fail.**

---

## Bugs found (actionable)

### 🔴 BUG-1 (HIGH) — `session:mode_changed` is never delivered over WebSocket
The route emits the event correctly:
`maestro-server/src/api/sessionRoutes.ts:712` →
`{ sessionId, mode, previousMode, changed: true, timestamp }`.

But `session:mode_changed` is **missing from the WebSocketBridge forwarded-events list**
(`maestro-server/src/infrastructure/websocket/WebSocketBridge.ts:146-197`). The bridge only
subscribes to the events in that array, so the event is emitted on the in-process bus and dropped.

`SessionService.changeMode` (`SessionService.ts:313-321`) writes the repo directly and emits **no**
`session:updated` either, so there is no fallback event.

**Live proof:** WS client connected to `ws://localhost:4569`, two real mode flips
(`changed=true` twice) → **0** `session:mode_changed` frames received.

**Impact:** §9 fails outright, and §8 (UI mode chip + coordinator glow) cannot update live —
the design says both are "driven by the `session:mode_changed` WS event," which never arrives.
A manual page refresh would still show the new mode (it's persisted), but no live update.

**Fix:** add `'session:mode_changed'` to the `events` array in `WebSocketBridge.ts:146`.

### 🟠 BUG-2 (MEDIUM) — `spell list` has no cross-project parity
`maestro spell list --project-id <X>` and the param-injected bare call return **400**:
```
GET /api/spells/definitions?projectId=… → 400 VALIDATION_ERROR "Unrecognized key: projectId"
GET /api/spells/definitions?allProjects=true → 400 "Unrecognized key: allProjects"
GET /api/spells/definitions (no params) → 200 ✅
```
Root cause: `listSpellDefinitionsQuerySchema` (`maestro-server/src/api/validation.ts:420`) is a
strict object that does not accept `projectId` / `allProjects`, unlike the session/task list schemas.

**Fix:** extend `listSpellDefinitionsQuerySchema` to accept optional `projectId` and `allProjects`
and honor them in `spellRoutes.ts` `/spells/definitions`.

### 🟡 BUG-3 (LOW) — `sender_not_found` / `target_not_found` codes are unreachable
The sharp codes exist (`sessionRoutes.ts:996`, `:1003`) but the route resolves both sessions with
`sessionService.getSession()` (`sessionRoutes.ts:988-991`), which **throws** `NotFoundError` for a
missing id. The throw is caught by `handleRouteError` and returned as a generic
`404 NOT_FOUND` *before* the `if (!senderSession)` / `if (!session)` null-checks ever run.

Observed:
```
bogus senderSessionId → 404 {code:"NOT_FOUND","message":"Session with id 'nope' not found"}
bogus target          → 404 {code:"NOT_FOUND", …}   (expected sender_not_found / target_not_found)
self-prompt           → 400 {code:"self_prompt_not_allowed"}   ✅ reachable
missing senderSessionId → 400 {"error":"senderSessionId is required…"}  ✅ (legacy string shape, no code)
```
**Fix:** have the prompt route resolve sessions in a way that returns null (or catch the
`NotFoundError`) so the intended sharp codes are emitted.

### ⓘ OBS-1 (INFO) — spawn gate is advisory at the raw API boundary
The gate only fires when `req.body.spawnSource === 'session'` (`sessionRoutes.ts:1048`). A direct API
caller that omits it (defaults to `'ui'`) bypasses the coordinator check — a worker session
successfully spawned via curl until `spawnSource:'session'` was supplied. This is intentional for
UI-initiated spawns, but means the gate is not enforced for arbitrary API callers. The `maestro`
CLI always sets `spawnSource:'session'`, so CLI-level behavior is correct.

### ⓘ OBS-2 (INFO) — `--project` spawn routing is non-deterministic for child spawns
Spawning the test worker with `--project proj_1771195352171_il3webvyx` landed it in the **master**
project `proj_1770533548982_3bgizuthk` (`isMasterSession=true`) instead — the child inherited the
coordinator's project context. A later `--project proj_1770724584130_90pgyter1` (Resume) spawn
routed correctly. Worth confirming whether `--project` should always win over inherited context.

---

## Per-section detail

### §1 Mode model — ✅ PASS
- `coordinator status` reflects `role: coordinator`, `relation: standalone`.
- `enable` → `disable` → `enable` flips role; idempotent enable returns `changed:false`.
- Cross-session promote: `POST /sessions/<B>/mode` with `X-Session-Id: <A>` →
  **403 `{code:"mode_self_only","message":"You can only flip your own role"}`** (`sessionRoutes.ts:694`).

### §2 Spawn gate — ✅ PASS (see OBS-1)
- Worker (`spawnSource:session`, sender = a `coordinated-worker`) → **403 `spawn_requires_coordinator`**.
- Coordinator sender → **201** spawn created.
- Cross-project spawn into the Resume project → **201**, session recorded under
  `proj_1770724584130_90pgyter1`, `isMasterSession:false`, linked to the target task.

### §3 Free messaging — ⚠️ PASS with defects (BUG-3)
- **Cross-project, both directions: 200.** Coordinator (master) ↔ Resume worker exchanged prompts
  live, each delivered with correct `[From: <name> (sess_…)]` attribution.
- `prompt_scope_violation` is **fully removed** from the codebase (0 occurrences). ✅
- Negative cases: self-prompt and missing-sender rejected correctly; bogus/missing ids fall through
  to generic `NOT_FOUND` instead of the intended sharp codes — see BUG-3.

### §4 Cross-project list/get — ❌ PARTIAL (BUG-2)
- `session list`: scoped 6, `--project-id` 6, `--all-projects` 15 → scoping works (verified against
  `/api/sessions` counts).
- `task list` parity; `task list --all` prints `Warning: --all is deprecated, use --all-projects`.
- `team-member list` (bare, no flag) → **200** (previously 400). ✅
- `*:get` / `session info` project-agnostic → 200. ✅
- **`spell list` bare / `--project-id` → 400** (BUG-2); only `--all-projects` works.

### §5 Master aliases — ✅ PASS
- `master projects | tasks | sessions | context` and `master sessions --active` all 200.
- Verified **ungated**: `/api/master/{projects,sessions,context}` return 200 even with a
  non-master session id in `X-Session-Id`.

### §6 Persistence — ✅ PASS
- `isMasterSession` persisted on create: master-project session = `true`, Resume session = `false`.
- `X-Session-Id` attached by the CLI api client (`maestro-cli/src/api.ts:44`).
- `completedAt` accepted by `updateSessionSchema` — cleanup PATCH returned 200 (the §0 fix).

### §7 Prompt composition — ✅ PASS (source-verified + this session's own prompt)
- `<workspace_context>` block built in `prompt-builder.ts`; `master_project_context` has **0**
  occurrences in CLI src. This coordinator's own system prompt shows `<workspace_context>` and no
  `<master_project_context>`.
- `<coordinator_promotion>` is worker-only: `buildCoordinatorPromotionBlock` returns `null` for
  coordinator modes (`prompt-builder.ts:893-896`).
- `promptModes`: all `session:{list,info,watch,spawn,logs}` are `COORDINATOR_MODES`
  (filtered out of worker prompts); `coordinator:{enable,disable,status}` are `ALL_MODES`
  (`command-catalog.ts:50-83`).

### §8 UI chip + glow — ❌ FAIL (consequence of BUG-1)
Not visually verified (headless run). The data path that drives it is broken: the
`session:mode_changed` WS event never reaches clients (BUG-1), so the chip/glow cannot update within
~300 ms without a refresh. Needs a human pass **after** BUG-1 is fixed.

### §9 WS event — ❌ FAIL (BUG-1)
Event shape in source is correct (`sessionRoutes.ts:712`), and the idempotent path correctly returns
`changed:false` with no emit (`:707`). But live capture over `ws://localhost:4569` received **0**
`session:mode_changed` frames across two real mode changes, because the bridge does not forward it.

### §10 Regression sanity — ✅ PASS
`task create` + `task list`, `session siblings`, `session logs <id>`, and
`team-member list --project-id` all returned successful structured output.

---

## Environment caveats
- The runner session executed from the **master** project (`isMasterSession=true`); non-master
  assertions in §5 were verified indirectly via curl with a non-master `X-Session-Id`.
- §8 was not visually verified (no Tauri UI in this run); reported from the server/data path.
- Test artifacts created during the run (two probe sessions, one smoke task) were stopped/deleted.
