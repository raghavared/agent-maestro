# Workspace Openness — Design Proposal

> Status: **DRAFT for review** · Owner: Master Coordinator session `sess_1780205274263_vhtrzvk9x` · Date: 2026-05-31
>
> Supersedes and absorbs:
> - `docs/master-coordinator-architecture.md` (Phase 2 — cross-project messaging)
> - `docs/any-session-can-coordinate.md` (boundary relaxation)
> - `docs/master-commands-fixes.md` (Phase 1 bugs)

---

## 1. Goal in one sentence

Every session can call every read/messaging API across the whole workspace; **only `POST /api/sessions/spawn` stays gated**, and that gate is unlocked by an explicit, sender-initiated promotion command (`maestro coordinator enable`).

This is what makes the gate the "infinite-recursion firewall": a spawned session is a worker by default, so each new link in a spawn chain must explicitly promote itself before it can fan out further. No depth counter, no quota — just a manual ratchet.

---

## 2. Why this shape

Three observations forcing the redesign:

1. **The team-boundary check has outlived its purpose.** It was designed when modes meant "execution authority." Today most useful workflows want a worker to ping a peer, read a sibling's logs, or list a related project. The boundary blocks these and forces awkward routing through a parent.
2. **The master-session gate is duplicate plumbing.** `Project.isMaster` exists to flag "this project is the workspace control plane." Every `/api/master/*` route then re-checks `isMasterSession` to gate access. With workspace-wide openness, that gate disappears — `Project.isMaster` becomes a UX label (used by the prompt composer and UI), not an auth signal.
3. **The real risk isn't "who can talk" — it's "who can spawn."** Free messaging is bounded by the number of live sessions. Free spawning is unbounded: any session that can spawn can create a session that can also spawn, recursively. The right place to draw the line is the spawn boundary, and the right mechanism is an explicit-opt-in promotion.

---

## 3. The model

### 3.1 The four modes stay; the spawn axis is now mutable

The existing four-mode model is preserved as-is in the data layer and the prompt composer. Internally, treat it as a pair on two orthogonal axes:

```
mode = (relation, role)

relation ∈ { standalone, coordinated }   ← fixed at spawn time (structural)
role     ∈ { worker, coordinator }       ← MUTABLE via `maestro coordinator enable/disable`
```

The four mode labels are the cross product:

| Label | relation | role |
|---|---|---|
| `worker` | standalone | worker |
| `coordinator` | standalone | coordinator |
| `coordinated-worker` | coordinated | worker |
| `coordinated-coordinator` | coordinated | coordinator |

**Promotion / demotion flips only `role`.** The `relation` axis is a structural property of how the session was spawned (was the spawner a coordinator at the time?) and never changes after spawn.

#### Promotion transitions

| Starting mode | After `coordinator enable` | After `coordinator disable` |
|---|---|---|
| `worker` | `coordinator` | (no-op) |
| `coordinated-worker` | `coordinated-coordinator` | (no-op) |
| `coordinator` | (no-op, idempotent) | `worker` |
| `coordinated-coordinator` | (no-op, idempotent) | `coordinated-worker` |

Server returns `{ mode, previousMode, changed: bool }` so the CLI can render "already a coordinator, no change" vs. "promoted from worker → coordinator."

#### What each axis controls

| Concern | Driven by |
|---|---|
| Can call `POST /api/sessions/spawn`? | `role === 'coordinator'` (mode ∈ {coordinator, coordinated-coordinator}) |
| What `<commands_reference>` and `<capability_summary>` advertise | `mode` via `promptModes` (refreshed on `coordinator enable/disable`) |
| What appears under `session logs --my-workers` | sessions whose `parentSessionId === self.id` |
| Whether the session is considered "part of a coordinator's tree" | `relation === 'coordinated'` (set at spawn, immutable) |

#### Spawn behavior after promotion — child's mode

When session S spawns a new session N for team-member T:

- N's `relation` is **always `coordinated`** when S's current `role === 'coordinator'` — because S is, at this moment, acting as a coordinator. So a *promoted* worker spawning a child produces a `coordinated-*` child, exactly like a born-coordinator would.
- N's `role` is sourced from T's team-member config (T may be a worker team-member or a coordinator team-member). N can later self-promote independently.
- N's `parentSessionId = S.id`, `rootSessionId = S.rootSessionId ?? S.id`. So N counts under S in `--my-workers`.

If S then runs `coordinator disable`, S returns to worker `role`, but N's `relation = coordinated` remains — that's frozen at N's spawn time. S's already-spawned children keep their tree position.

#### Worked examples

1. **Standalone worker promotes, spawns a worker team-member, demotes**
   - Start: S = `worker`
   - After `coordinator enable`: S = `coordinator`
   - S spawns team-member-W (worker): N = `coordinated-worker`, parent = S
   - After `coordinator disable`: S = `worker` again; N is unchanged = `coordinated-worker`

2. **Coordinated worker promotes, spawns a coordinator team-member, that child promotes too**
   - Start: S = `coordinated-worker` (was spawned by some upstream coordinator U)
   - After `coordinator enable`: S = `coordinated-coordinator`
   - S spawns team-member-C (coordinator): N = `coordinated-coordinator`, parent = S
   - N runs `coordinator enable` → no-op (already coordinator)
   - N spawns team-member-W: M = `coordinated-worker`, parent = N
   - Tree: U → S → N → M, all coordinated. Each promotion was explicit and audit-logged.

3. **Born coordinator runs `coordinator enable`**
   - Start: S = `coordinator`
   - `coordinator enable` → no-op, `changed: false`
   - CLI prints: "Already a coordinator."

4. **Born coordinator demotes**
   - Start: S = `coordinator`
   - `coordinator disable` → S = `worker`. Children S already has are unaffected (they have their own modes). Future spawn calls from S return 403 until S re-promotes.

#### Spawn gate decision table

| Sender mode | `POST /api/sessions/spawn` |
|---|---|
| `worker` | **403** `spawn_requires_coordinator` |
| `coordinator` | **OK** |
| `coordinated-worker` | **403** |
| `coordinated-coordinator` | **OK** |

### 3.2 The promotion command

```bash
maestro coordinator enable    # promote: flip role → coordinator (unlocks spawn)
maestro coordinator disable   # demote: flip role → worker (re-locks spawn; children untouched)
maestro coordinator status    # report current mode
```

These flip the `role` axis only; the `relation` axis (standalone vs. coordinated) stays put — see §3.1 transition table.

Server endpoint shape (see §4.1): `POST /api/sessions/:id/mode { role: 'coordinator' | 'worker' }`. The server computes the new full mode by combining the requested `role` with the session's current `relation`, persists `Session.mode`, and emits `session:mode_changed { sessionId, mode, previousMode, changed, timestamp }` so the UI mode chip updates in real time.

The CLI command refreshes its in-memory capability snapshot and prints a confirmation line the agent can read:

```
✔ Mode: coordinator (was: worker)
You can now run `maestro session spawn ...`.
```

This printed confirmation is intentional — it's how the running agent learns its new capability, since the system prompt was assembled at session start and cannot be rewritten.

Re-locking via `disable` only affects future `POST /api/sessions/spawn` calls. It does not retroactively orphan, kill, or detach children that were spawned while the session was a coordinator.

#### 3.2.1 Why a manual command, not auto-promote-on-need

- **Intentional**: spawning is a non-trivial action (cost, complexity). Forcing the agent to type one extra command is a useful speed bump that surfaces the decision.
- **Auditable**: the timeline gets a `mode_changed → coordinator` event before every spawn chain. Easy to see who chose to fan out.
- **Recursion firewall**: a spawned worker cannot spawn until *it* runs the promotion command. So an infinite recursion would require the LLM to issue `coordinator enable` at every step — an explicit, model-visible, observable behavior, not a silent runaway.

### 3.3 What's open (no gate)

Every endpoint below works for any session id in any project, with no `isMasterSession` / boundary / mode check:

| Endpoint | New rule |
|---|---|
| `GET /api/projects` (+ `:id`, list-children) | open |
| `GET /api/tasks` (+ filters) | open |
| `GET /api/sessions` (+ `:id`, logs, timeline, siblings) | open |
| `POST /api/sessions/:id/prompt` | open — no `canCommunicateWithinTeamBoundary` check |
| `GET /api/master/projects \| tasks \| sessions \| context` | open — same as plain endpoints, kept as aliases for the CLI UX |
| `GET /api/teams`, `GET /api/team-members` | open |
| Task report/progress/complete/block on a task you don't "own" | open |

### 3.4 What's gated (the only gates)

| Endpoint | Gate |
|---|---|
| `POST /api/sessions/spawn` | sender's `Session.mode` has `role === 'coordinator'` (mode ∈ {coordinator, coordinated-coordinator}) |
| `POST /api/sessions/:id/mode` | `X-Session-Id` header must equal `:id` — you can only flip your own role |
| `POST /api/sessions/:id/mode` | request body may only touch `role`; attempts to mutate `relation` are ignored (or rejected with 400, TBD) |

Everything else — task delete, project create, team-member edits, etc. — is open per the answer "None — fully open." If a user-level destructive guard is wanted later, it's a separate, additive design.

### 3.5 What survives of "master"

- `Project.isMaster` — **kept**, purely as a UX/cosmetic flag. The prompt composer reads it to decide whether to include the `<master_project_context>` section; the UI uses it to surface a workspace-overview view. **No API consults it.**
- `Session.isMasterSession` — **deprecated**. Field stays on disk for backward compat but is no longer read by any route. Phase out at a future cleanup.
- `MAESTRO_IS_MASTER` env var — **kept** for prompt composition (it tells the spawned shell whether to emit the master-context block). No auth meaning.
- `maestro master {projects|tasks|sessions|context}` — **kept as ergonomic aliases.** Internally the CLI calls the canonical endpoints (`/api/projects`, `/api/tasks`, etc.). The `master` namespace is a UX grouping, not a permission boundary.
- `MASTER_COMMAND_IDS` gating in `guardCommand` — **removed**. The commands are always allowed; `promptModes` decides whether they show up in a given mode's prompt.

---

## 4. API surface — concrete changes

### 4.1 New

```
POST /api/sessions/:id/mode
  body: { role: 'worker' | 'coordinator' }
  auth: X-Session-Id header must equal :id (self-only mutation)
  semantics:
    - server reads current Session.mode, splits into (relation, role)
    - replaces role with body.role
    - persists the recombined mode (relation never changes here)
    - returns { id, mode, previousMode, changed }
    - emits session:mode_changed { sessionId, mode, previousMode, changed, timestamp }
    - if role is unchanged (idempotent call), changed=false; no event emitted
```

```
GET  /api/sessions/:id/mode    # convenience for `maestro coordinator status`
  returns: { id, mode, relation, role }
```

### 4.2 Modified — spawn gate

`POST /api/sessions/spawn` reads `X-Session-Id` (sender). If sender is missing → 400. If sender's `mode` is not coordinator-ish → **403** with body:

```json
{
  "error": true,
  "code": "spawn_requires_coordinator",
  "message": "Spawning requires coordinator mode. Run `maestro coordinator enable` first."
}
```

(The error code is machine-readable; the CLI maps it to a friendly hint.)

### 4.3 Modified — gate removals

- `maestro-server/src/api/masterRoutes.ts` — drop `authMiddleware` from every route. Routes still exist as aliases.
- `maestro-server/src/api/sessionRoutes.ts` — drop `canCommunicateWithinTeamBoundary` from `POST /api/sessions/:id/prompt`. Sender-identity prepending (`[From: <name> (sess_xxx)]`) **stays** — it's informational, not auth.
- `maestro-server/src/api/sessionRoutes.ts` — drop the mode-based 403 on spawn (already removed in the any-session worktree); replace with the new gate above.

### 4.4 New optional query parameters

- `GET /api/sessions?active=true` — convenience filter, status ∈ {spawning, idle, working}. (Already valuable independent of openness.)
- `POST /api/sessions/spawn` accepts `projectId` in the body to spawn into any project (previously implicit from sender's project). Server validates the project exists; no other check.

### 4.5 Persistence fixes folded in (Phase 1 from the existing analysis)

Both bugs identified in `docs/master-commands-fixes.md` must still ship, even though the master gate is being removed — they're orthogonal correctness fixes:

1. **`FileSystemSessionRepository.create` must persist `isMasterSession`** (it's still read by the prompt composer to decide whether to emit `<master_project_context>`, even after auth is gone).
2. **CLI `api.ts` must attach `X-Session-Id`** — required by the new mode endpoint and by sender-identity in the prompt route, regardless of openness.

---

## 5. CLI surface

### 5.1 New

```
maestro coordinator enable
maestro coordinator disable
maestro coordinator status
```

Catalog entry: `coordinator:enable`, `coordinator:disable`, `coordinator:status` — `allowedModes: ALL_MODES`, `promptModes: ALL_MODES` (visible in every mode's prompt — workers need to discover it).

### 5.2 Modified

- `maestro session spawn` — gains `--project <id>` to spawn into a different project.
- `maestro session list`, `maestro session logs`, `maestro session prompt`, `maestro task list` — no flag changes; they already accept arbitrary ids and now succeed for any cross-project target.
- `maestro master *` — unchanged surface; internally point at canonical endpoints; no longer guarded by `master:*` mode checks.

### 5.3 Removed

- `MASTER_COMMAND_IDS` in `command-permissions.ts` — the special permission group is unused; the commands ride on regular `allowedModes`.

---

## 6. Prompt composition

### 6.1 `promptModes` applied globally

Per `docs/any-session-can-coordinate.md`, every command in the catalog gets a `promptModes` field defaulting to `allowedModes`. The composer renders `<commands_reference>` and `<capability_summary>` against `promptModes`, not `allowedModes`.

So a worker prompt continues to look like a worker prompt — focused, no spawn noise — even though the worker *could* call spawn after promotion.

### 6.2 `<master_project_context>` becomes `<workspace_context>`

Rename + repurpose. Emitted when **either** the project is master **or** there are >1 projects in the workspace (the latter so that even non-master projects know they can reach across). Body:

```xml
<workspace_context>
  <description>You can reach any session in any project in this workspace.</description>
  <projects>
    <project id="..." name="..." workingDir="..." isMaster="true" />
    ...
  </projects>
  <commands>
    Use `maestro master projects` to list all projects.
    Use `maestro master sessions --active` to see live sessions across the workspace.
    Use `maestro session prompt &lt;id&gt; --message "..."` to message any session in any project.
    Use `maestro session logs &lt;id&gt;` to read any session's recent output.
    Use `maestro session spawn --project &lt;id&gt; ...` to spawn into another project (requires coordinator mode).
  </commands>
</workspace_context>
```

### 6.3 New `<coordinator_promotion>` block for workers

Workers' prompts get a short instruction near `<commands_reference>`:

```xml
<coordinator_promotion>
  You are a worker. You can ping, read, and observe any session, but you cannot spawn new ones.
  If your task requires spawning helpers, run `maestro coordinator enable` first.
  This converts you to a coordinator for the rest of the session.
</coordinator_promotion>
```

Coordinators don't get this block.

---

## 7. UI implications (sketch — implementation TBD)

- Session chip shows live `mode` (worker | coordinator), updates via the new `session:mode_changed` event.
- Project switcher's "master" badge is purely visual.
- Add a workspace-level "All Sessions" view (cross-project) using the now-open `GET /api/sessions`.
- "Send directive" affordance on any session row (cross-project) — wired to the regular `/sessions/:id/prompt` route.

### 7.1 Coordinator terminal glow

The middle-panel terminal view gets a **glowing line border** whenever the displayed session's current `role === 'coordinator'` (i.e., mode ∈ {`coordinator`, `coordinated-coordinator`}). Workers (`worker`, `coordinated-worker`) render with the normal flat border.

Behavioral details:

- **Live**: the glow appears/disappears on the `session:mode_changed` WebSocket event without a refresh, so a worker that runs `maestro coordinator enable` sees its own terminal light up within a few hundred ms.
- **Independent of focus/selection**: existing focus/selection borders stay; the coordinator glow is an additional, outer (or layered) effect so a coordinator session looks coordinator-y whether or not it's the active pane.
- **Subtle by default**: a soft outer-glow (e.g., 8–12px blur, low alpha), not a hard ring — the goal is at-a-glance recognition without competing with terminal content.
- **Color**: take from the workspace accent / team-member avatar color rather than hardcoding. Falls back to a neutral coordinator-accent (e.g., warm amber) if no team-member color is available. Final palette pick is a UI-design call.
- **Consistency with chip**: the same color used for the glow is used for the mode chip's "coordinator" state, so the two affordances read as one signal.

Implementation outline (no code, just the wiring):

- A small selector in the Zustand session store derives `isCoordinatorRole(session.mode)` and exposes it.
- The terminal panel component reads that selector and conditionally applies a `coordinator-glow` class (or styled-component variant).
- The class is a CSS box-shadow / outline, animated only on transition (fade-in / fade-out over ~200ms) to make promotion/demotion feel intentional.
- No new prop drilling: the selector subscribes to `useSessionStore`, which is already updated by the WebSocket bridge when `session:mode_changed` arrives.

---

## 8. Data model deltas

| Type | Field | Change |
|---|---|---|
| `Session` | `mode` | already exists; semantics now include runtime mutation (was set-once at spawn) |
| `Session` | `isMasterSession` | **deprecated** (kept on disk for backward compat; not read) |
| `Session` | (no new fields) | — |
| Event bus | `session:mode_changed` | new event type |

No migrations required. Existing sessions keep their `mode` and continue to work.

---

## 9. Migration / rollout

1. **Phase A — Persistence + gate refactor (server)**
   - Fix `FileSystemSessionRepository.create` to persist `isMasterSession` (Phase 1 fix; needed for the prompt composer to keep working).
   - Drop `authMiddleware` from `masterRoutes.ts`.
   - Drop `canCommunicateWithinTeamBoundary` from sessionRoutes prompt handler.
   - Replace the spawn mode-block with the new "sender must be coordinator" gate.
   - Add `POST/GET /api/sessions/:id/mode`.
   - Add `?active=true`, `?status=` to `/api/sessions` and `/api/master/sessions`.

2. **Phase B — CLI surface**
   - Attach `X-Session-Id` in `api.ts`.
   - Add `maestro coordinator {enable,disable,status}`.
   - Add `--project` to `maestro session spawn`.
   - Add `--active` to `maestro master sessions`.
   - Drop `MASTER_COMMAND_IDS` gating.

3. **Phase C — Prompt composer**
   - Apply `promptModes` globally (folds in the any-session-coordinator worktree work).
   - Rename `<master_project_context>` → `<workspace_context>` with revised body.
   - Add `<coordinator_promotion>` for worker mode.

4. **Phase D — UI**
   - Mode chip + live update.
   - Cross-project session view.
   - Cross-project send-directive affordance.

Phases A and B are independent and can ship in either order. Phase C depends on B (the catalog edits). Phase D depends on A.

---

## 10. Security & blast radius

- **Free messaging** — bounded by live sessions; no new resource axis.
- **Free reads** — bounded by data already on disk; recipient can be observed but not modified.
- **Free spawn (after promotion)** — bounded by the manual-promotion ratchet. To go N levels deep, an agent must issue `coordinator enable` N times across N different sessions. Each promotion is a timeline event and a `session:mode_changed` ws event, so a runaway tree is visible in real time.
- **No destructive guards** — per the chosen "None — fully open" answer. If we later want to gate delete-project or set-master, that's a separate additive proposal.

---

## 11. Open questions for review

1. **Should `coordinator disable` be allowed at all?** Pro: symmetry. Con: a session that promoted itself to spawn children, then disables, would be in an odd state (children running, parent can't spawn more). Recommend: allow, no special semantics.
2. **Should we audit-log promotions to a workspace-level log** (not just per-session timeline)? Useful if many sessions self-promote and we want an aggregate view. Easy to add via the same event bus.
3. **Should the `master:*` CLI namespace be renamed to `workspace:*`** to match the renamed prompt block? Better consistency, but a CLI breaking change. Recommend: alias `maestro workspace *` to `maestro master *`, keep both for one or two releases.
4. **Cross-project spawn — should target project's working dir be validated?** Today spawn copies project working dir to the shell; a typo'd project id would fail at shell-start. Recommend: server-side check that `projectId` exists; rely on existing shell error for missing working dir.
5. **What's the right error message when a worker calls `POST /sessions/spawn`?** Proposal above is `403 spawn_requires_coordinator` with a hint. Should the CLI auto-offer to run the promotion? Probably not — the speed bump is the point.

---

## 12. Files this design will touch (preview, no code)

```
maestro-server/
  src/api/masterRoutes.ts                       (drop authMiddleware; remain aliases)
  src/api/sessionRoutes.ts                      (drop boundary; replace spawn gate; add mode endpoint)
  src/api/validation.ts                         (add modeBodySchema)
  src/infrastructure/repositories/
      FileSystemSessionRepository.ts            (persist isMasterSession; persist mode mutations)
  src/application/services/SessionService.ts    (changeMode method; emit event)
  src/types.ts                                  (no shape change; comment Session.mode as mutable)

maestro-cli/
  src/api.ts                                    (attach X-Session-Id header)
  src/commands/coordinator.ts                   (NEW: enable/disable/status)
  src/commands/session.ts                       (spawn --project flag)
  src/commands/master.ts                        (point at canonical endpoints)
  src/services/command-permissions.ts           (remove MASTER_COMMAND_IDS gating)
  src/prompting/command-catalog.ts              (add coordinator:* commands; apply promptModes globally)
  src/prompting/capability-policy.ts            (canSpawnSessions reads live mode)
  src/services/prompt-builder.ts                (rename block; add coordinator_promotion)

maestro-ui/
  (mode chip + workspace view + send-directive affordance — separate UI design pass)
```

---

## 13. Decision log (answers from the design conversation)

1. Reach: **workspace-wide** — any session, any project.
2. Modes: **four-mode model kept as-is** — but the spawn-capability axis (`role`) is now mutable; the parentage axis (`relation`) stays structural and immutable.
3. Guards surviving full openness: **none** — fully open, except…
4. …**spawn gate via manual self-promotion command** (`maestro coordinator enable`) — this flips `role` only; `relation` is preserved. All four current mode labels remain reachable through promotion/demotion (see §3.1 transition table).
