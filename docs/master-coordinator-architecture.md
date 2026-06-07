# Master Coordinator — Architecture & Feature Plan

> Extends `master-project-architecture.md`. That doc covers the **read-only visibility**
> layer (already shipped). This doc designs the **coordination layer**: a master session
> that can message and orchestrate *any* session in *any* project.

---

## 1. Goal

A *Master Project* hosts *Master Sessions* that act as a cross-project control plane. A
master session must be able to:

1. **See** all projects in the workspace. *(shipped)*
2. **Drill into** a project's tasks and its **active/running** sessions. *(partially shipped — needs active filter)*
3. **Send a message / directive** to any specific session in any project. *(NOT shipped — the core gap)*

This turns the existing read-only "super-agent" into a true orchestrator that can route
work and instructions across project boundaries without being in the same team tree.

---

## 2. Current State (baseline)

| Capability | Status | Where |
|---|---|---|
| `Project.isMaster` flag | ✅ | `types.ts`, `ProjectService.setMasterStatus`, `PUT /api/projects/:id/master` |
| `Session.isMasterSession` derived at spawn | ✅ | `SessionService` (sets flag + `MAESTRO_IS_MASTER=true`) |
| `maestro master {projects,tasks,sessions,context}` | ✅ | `maestro-cli/src/commands/master.ts` |
| `GET /api/master/{projects,tasks,sessions,context}` | ✅ | `maestro-server/src/api/masterRoutes.ts` |
| Master auth middleware (`isMasterSession` gate) | ✅ | `masterRoutes.ts:15` |
| Manifest enrichment (`masterProjects[]`) | ✅ | `manifest-generator.ts:506` |
| `canUseMasterCommands` capability | ✅ | `capability-policy.ts:170` |
| **Cross-project messaging** | ❌ | blocked by `canCommunicateWithinTeamBoundary` |
| **Active-session filtering** | ❌ | `/api/master/sessions` returns all statuses |

### The blocker

`POST /api/sessions/:id/prompt` (sessionRoutes.ts:919) gates every prompt through
`canCommunicateWithinTeamBoundary(sender, target)` (sessionRoutes.ts:438), which permits
**only** parent→child, child→parent, and sibling messaging. A master session has no team
relationship to sessions in other projects, so every cross-project prompt is rejected with
`403 prompt_scope_violation`. This is the single hard barrier to the feature.

---

## 3. Design

### 3.1 Principle: a separate, explicitly-authorized master channel

We do **not** weaken `canCommunicateWithinTeamBoundary`. The team boundary is a correctness
guarantee for normal worker/coordinator messaging and should stay strict. Instead we add a
**dedicated master messaging path** that is authorized by `isMasterSession` (the same gate
already protecting all `/api/master/*` reads). This keeps the two authorization models
cleanly separated and auditable.

```
Normal sessions   ── POST /api/sessions/:id/prompt ──▶ canCommunicateWithinTeamBoundary  (strict team tree)
Master sessions   ── POST /api/master/sessions/:id/prompt ──▶ isMasterSession middleware  (cross-project)
                                       │
                                       └──▶ emits the SAME session:prompt_send event
```

Both paths converge on the existing `session:prompt_send` event + `prompt_received`
timeline entry, so the UI PTY-injection handler (`useMaestroStore`) needs **no change**.

### 3.2 New server endpoint — master prompt

`maestro-server/src/api/masterRoutes.ts`

```
POST /api/master/sessions/:id/prompt
  headers: X-Session-Id: <master session id>     // validated by existing authMiddleware
  body:    { content: string, mode?: 'send'|'paste' }
```

Handler logic (mirrors sessionRoutes.ts:919 minus the boundary check):

```ts
router.post('/master/sessions/:id/prompt', authMiddleware,
  validateParams(idParamSchema), validateBody(masterPromptSchema),
  async (req, res) => {
    const { content, mode = 'send' } = req.body;
    const targetId = req.params.id;
    const senderSessionId = (req.headers['x-session-id'] as string);

    const [target, sender] = await Promise.all([
      sessionService.getSession(targetId),     // 404 if missing
      sessionService.getSession(senderSessionId),
    ]);

    // No team-boundary check — authority comes from sender.isMasterSession (middleware).
    const senderName = resolveSenderName(sender); // e.g. "Master Coordinator"
    const tagged = `[From: ${senderName} (master • ${senderSessionId})] ${content}`;

    await eventBus.emit('session:prompt_send', {
      sessionId: targetId, content: tagged, mode, senderSessionId, timestamp: Date.now(),
    });
    await sessionService.addTimelineEvent(targetId, 'prompt_received',
      `Received master directive from ${senderSessionId}`, undefined,
      { senderSessionId, mode, master: true });

    res.json({ success: true });
  });
```

Notes:
- `resolveSenderName`/`prependSenderIdentity` already exist in sessionRoutes.ts — extract
  them into a shared helper (e.g. `api/helpers/promptIdentity.ts`) so both routes reuse
  them instead of duplicating.
- The `master • ` marker in the sender tag lets the receiving agent recognize a
  cross-project directive vs. a same-team prompt.
- Optionally guard against targeting a *stopped/completed* session (no live PTY) →
  return `409 session_not_active` so the master gets a clear signal rather than a silent drop.

### 3.3 Active-session filtering

Extend `GET /api/master/sessions` with `?status=` and a convenience `?active=true`:

```ts
// active = status ∈ { spawning, idle, working }   (excludes completed, failed, stopped)
const ACTIVE = new Set(['spawning', 'idle', 'working']);
let sessions = projectId
  ? await sessionService.listSessionsByProject(projectId)
  : await sessionService.listSessions();
if (req.query.active === 'true') sessions = sessions.filter(s => ACTIVE.has(s.status));
else if (req.query.status) sessions = sessions.filter(s => s.status === req.query.status);
```

Return the `toSessionSummary` DTO shape (id, name, status, projectId, teamMember…) rather
than full sessions, so the master gets a compact, addressable list.

### 3.4 CLI surface

`maestro-cli/src/commands/master.ts`

```bash
# new — messaging
maestro master prompt <sessionId> --message "<text>" [--mode send|paste]

# enhanced — active filter
maestro master sessions [--project <id>] [--active]
```

`master prompt` calls `POST /api/master/sessions/:id/prompt`; the `X-Session-Id` header is
already attached by the api client when `MAESTRO_SESSION_ID` is set. Guard with
`await guardCommand('master:prompt')`.

### 3.5 Capability & command catalog wiring

- Add `'master:prompt'` to `MASTER_COMMAND_IDS` (`command-catalog.ts:252`) and register a
  catalog entry (`allowedModes: ALL_MODES`, group e.g. `master`).
- `guardCommand` already blocks any `master:*` command when `!config.isMaster`
  (`command-permissions.ts:148`) — `master:prompt` inherits that gate for free.
- Add a capability flag `canCoordinateAcrossProjects` in `capability-policy.ts`:
  ```ts
  canCoordinateAcrossProjects: allowed.has('master:prompt'),
  ```
  Surface it in the manifest `capability_summary` so the prompt composer can describe it.

### 3.6 Prompt-system instructions

Augment the existing `<master_project_context>` block (prompt composer) with a coordination
section so the master agent knows the workflow:

```xml
<master_coordination>
  You can direct any session in any project.
  Workflow:
  1. `maestro master sessions --active`           → find live sessions (note their IDs + project)
  2. `maestro master tasks --project <id>`         → understand what a project is working on
  3. `maestro master prompt <sessionId> --message "<directive>"`  → send instructions
  Messages you send are tagged so the recipient knows they come from the master coordinator.
  Sessions cannot reply through the team channel; ask them to report via their own task/session reports,
  which you then observe through `maestro master sessions` / `master tasks`.
</master_coordination>
```

### 3.7 UI (optional, Phase 2)

- In the master project's session view, a "Send directive" affordance on any cross-project
  session row → `POST /api/master/sessions/:id/prompt`. Reuses existing prompt-injection UI.
- An aggregated "Workspace" board (already sketched in master-project-architecture.md §5.3)
  showing active sessions across projects, each with a quick-message action.

---

## 4. Data contract summary

| Endpoint | Method | Auth | Body / Query | Returns |
|---|---|---|---|---|
| `/api/master/sessions` | GET | master | `?projectId? &active? &status?` | `SessionSummary[]` |
| `/api/master/sessions/:id/prompt` | POST | master | `{content, mode?}` | `{success}` / `409 session_not_active` |

No new entities. No type changes beyond an optional `canCoordinateAcrossProjects`
capability flag mirrored across server/CLI/UI capability definitions.

---

## 5. Security

- Authority is `isMasterSession`, set server-side at spawn from `project.isMaster`; never
  client-supplied. A compromised non-master session cannot reach the master prompt path
  (middleware 403) nor the relaxed boundary (boundary check unchanged for `/api/sessions/*`).
- `isMaster` on a project is user-toggled only (`PUT /api/projects/:id/master`), not
  settable by sessions.
- Master directives are recorded as `prompt_received` timeline events with `master: true`,
  giving an audit trail of cross-project instructions.
- Cross-project *messaging* is in scope; cross-project *spawning* and *task writes* are
  explicitly deferred (§7) to keep blast radius small.

---

## 6. Implementation order

**Phase 1 — Server (the actual unblock)**
1. Extract `resolveSenderName` / `prependSenderIdentity` into a shared helper.
2. Add `POST /api/master/sessions/:id/prompt` (+ `masterPromptSchema` in validation.ts).
3. Add `?active`/`?status` filtering to `GET /api/master/sessions`; return summary DTOs.

**Phase 2 — CLI**
4. `maestro master prompt <sessionId> --message --mode`.
5. `--active` flag on `maestro master sessions`.
6. Register `master:prompt` in catalog + `canCoordinateAcrossProjects` capability.

**Phase 3 — Prompt**
7. `<master_coordination>` instructions in the composer for master sessions.

**Phase 4 — UI (optional)**
8. Per-row "Send directive" action; workspace board with active sessions.

---

## 7. Out of scope (future)

- **Cross-project spawning** — master spawns a session directly into another project.
- **Cross-project task creation / assignment.**
- **Persistent async mail/inbox** — current model is synchronous PTY injection; a durable
  `Mail` entity (sender/recipient/read-state) would let masters queue directives for
  not-yet-running sessions and collect structured replies.
- **Bidirectional reply channel** — today recipients report via their own task/session
  reports, which the master observes through reads; a true reply path is a later iteration.

---

## 8. Open questions

1. **Sender identity for the master** — use a fixed label ("Master Coordinator") or the
   master session's team-member name? (Recommend team-member name + `master` marker.)
2. **Target-not-active handling** — hard `409`, or queue the directive (needs §7 mail)?
   MVP: `409`.
3. **Should `master prompt` support broadcast** (`--project <id>` to all active sessions in a
   project)? Easy add once single-target works; defer to keep MVP tight.
