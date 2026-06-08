# Session State Model — Reference for Sessions Panel UX Redesign

**Audience:** Product owner (non-deep-technical)
**Purpose:** Before redesigning the Active / Inactive / Archived panel tabs, document every field, every status value, every timestamp, and every inconsistency in the session data model so design decisions can be made on fact, not assumption.

---

## A. What Is a Session?

A **session** is a single run of an AI agent (e.g., Claude Code) working on one or more tasks. When you spawn a session, Maestro creates a server-side record (stored in a JSON file) and simultaneously opens a terminal window on your Mac. The server record tracks what the agent did — its status, tasks, timestamps, docs. The terminal is a live process. These two things are **independent**: the server record outlives the terminal and persists forever (until you delete it), while the terminal lives only while the process is running.

A session can be in one of six lifecycle states (`spawning`, `idle`, `working`, `completed`, `failed`, `stopped`), but — as documented in section E — that status is **not reliably updated when the terminal exits**. The real source of truth for "is it running right now?" is whether a live terminal tab exists in the UI.

Sessions can spawn child sessions (a coordinator spawning workers). This creates a **spawn tree**. The panel shows tree roots as top-level tiles, with children nested underneath.

Three human-controlled stamps overlay the lifecycle: `archivedAt` (explicit close/hide), `humanCompletedAt` ("done by me" marker), and `completedAt` (agent or UI set when status transitions to a terminal state).

---

## B. Every Session Field

### Core Identity

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `id` | `string` | Server (FileSystemSessionRepository.create) | Creation | ✅ Yes | Stable ID for all references |
| `projectId` | `string` | Spawn payload | Creation | ✅ Yes | Which project this belongs to |
| `name` | `string` | Server (defaulted to `"Execute for <taskId>"` or `sessionName` from payload) | Creation | ✅ Yes | Display name in tile (overridden by team member name) |

*Sources: `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts:392–422`, `maestro-server/src/api/sessionRoutes.ts:1486–1514`*

### Status & Liveness

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `status` | `SessionStatus` enum | Server via PATCH; UI via WS update | Spawn → `'spawning'`; agent CLI reports `'working'`/`'idle'`/`'completed'`/`'failed'`/`'stopped'` | ❌ **Unreliable — frequently stale** (see C & E) | Shows status badge; used for symbol/color only |
| `needsInput` | `{ active, message?, since? }` | Agent CLI via PATCH | Agent detects it's waiting for user input | ⚠️ Mostly reliable, but clears only when user types | Shows "!" badge; drives `sessionTile--needsInput` |

*Sources: `maestro-ui/src/app/types/maestro.ts:6`, `maestro-server/src/types.ts:409`*

### Lifecycle Timestamps

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `startedAt` | `number` (ms epoch) | Server (FileSystemSessionRepository.create) | Creation | ✅ Yes | Duration calculation |
| `lastActivity` | `number` (ms epoch) | Server — every update call | Any PATCH to the session | ✅ Yes | "X ago" display |
| `completedAt` | `number \| null` | Server (FileSystemSessionRepository.update) | Auto-set when status changes to `'completed'`, `'failed'`, or `'stopped'` | ⚠️ Only set when server **receives** a status update — misses silent terminal exits | Duration calculation when non-null |
| `humanCompletedAt` | `number \| null` | UI (useMaestroStore.setSessionHumanComplete → PATCH) | User clicks the ○ radio button to mark "done" | ✅ Persisted; optimistic update guarded with `pendingLifecycle` | Shows "done" tag on tile; does NOT pick a tab |
| `archivedAt` | `number \| null` | UI (useMaestroStore.setSessionArchived → PATCH) | User clicks ✕ close button; also set on resume (if session was archived) | ✅ Persisted; optimistic update guarded with `pendingLifecycle` | **Primary tab driver**: any non-null value → Archived tab |

*Sources:*
- *`completedAt` auto-set: `FileSystemSessionRepository.ts:516–519`*
- *`humanCompletedAt`: `useMaestroStore.ts:1295–1317`*
- *`archivedAt`: `useMaestroStore.ts:1319–1341`*
- *`pendingLifecycle` guard against WS bounce: `useMaestroStore.ts:243–257`*

### Spawn Tree & Team Grouping

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `parentSessionId` | `string \| null` | Server (spawn route) | When `spawnSource === 'session'` | ✅ Yes | Parent→child edges for spawn tree |
| `rootSessionId` | `string \| null` | Server (spawn route; migrated for old sessions) | Set at creation; inherited through spawn chain | ✅ Yes | Groups all sessions in one spawn chain |
| `teamSessionId` | `string \| null` | Server (spawn route) | Workers get coordinator's session ID; coordinator gets its own ID on first spawn | ⚠️ Sometimes null for older sessions | Used by `buildTeamGroups` for color grouping |
| `teamId` | `string \| null` | Optional — only set if a saved Team entity is linked | Spawn payload | ⚠️ Often absent | Unused for tab logic; used for Team entity reference |

*Sources: `maestro-server/src/api/sessionRoutes.ts:1481–1513`, `FileSystemSessionRepository.ts:415–421`*

### Agent Identity

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `teamMemberId` | `string?` | Server (spawn route → stored in metadata, copied to top-level) | Spawn | ✅ Yes | Single team member assignment |
| `teamMemberIds` | `string[]?` | Server (spawn route → metadata) | Spawn | ✅ Yes | Multi-member session |
| `teamMemberSnapshot` | `TeamMemberSnapshot?` | Server (spawn route; fallback via `enrichSessionWithSnapshots`) | Spawn (or lazy at list time) | ✅ Yes | Display name + avatar + role on tile |
| `teamMemberSnapshots` | `TeamMemberSnapshot[]?` | Same | Spawn | ✅ Yes | Multi-member display |
| `mode` | `AgentMode?` | Server stores in `metadata.mode`; WS event `session:mode_changed` updates UI | Spawn; can change at runtime via CLI `maestro coordinator enable` | ✅ Yes | Mode badge; coordinator shows ⊞ button |

*Sources: `maestro-server/src/api/sessionRoutes.ts:1556–1564`, `maestro-ui/src/app/types/maestro.ts:403–446`*

### Agent Tool & Model

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `metadata.agentTool` | `AgentTool` (`'claude-code'` \| `'codex'` \| `'hermes'` \| `'gemini'`) | Server (spawn route, stored in metadata) | Spawn | ✅ Yes | Determines whether Resume is available (only `'claude-code'`) |
| `metadata.launchConfig` | `LaunchConfig?` | Server (spawn route) | Spawn; used by resume to reconstruct the same launch | ✅ Yes | Resume configuration |
| `model` | `string?` | UI type — not a real persisted top-level field; comes via snapshot or metadata | Spawn | ⚠️ Derived | Model badge on tile |
| `claudeSessionId` | `string?` | Server (pre-generated UUID at spawn; recovered from env var on migration) | Spawn | ✅ Yes | `--resume` flag for Claude Code CLI |

*Sources: `sessionRoutes.ts:1484`, `FileSystemSessionRepository.ts:176–178`*

### Runtime Data

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `env` | `Record<string, string>` | Server (spawn/resume builds env vars) | Spawn; updated on resume | ✅ Yes | Reconstructed env for resume |
| `taskIds` | `string[]` | Server (spawn; can add/remove via API) | Creation and ongoing | ✅ Yes | Which tasks this session is working on |
| `timeline` | `SessionTimelineEvent[]` | Agent CLI (append-only PATCH or POST /timeline) | Agent milestones, progress | ✅ Yes | Detail view only |
| `events` | `SessionEvent[]` | Legacy; still appended | Any event | ✅ Yes | Detail view only |
| `docs` | `DocEntry[]` | Agent CLI (POST /sessions/:id/docs) | Agent creates output docs | ✅ Yes | Shows doc badge count on tile |

### Flags

| Field | Type | Set by | When | Reliable? | UX Relevance |
|---|---|---|---|---|---|
| `isMasterSession` | `boolean` | Server (set at spawn if project.isMaster === true) | Spawn | ✅ Yes | Cross-project access |
| `hostname` / `platform` | `string` | Server (os.hostname() / os.platform()) | Creation | ✅ Yes | Detail view only |
| `spawnSource` (in metadata) | `'ui' \| 'session'` | Server (stored in metadata) | Spawn | ✅ Yes | Internal; not shown in UI |

---

## C. The `status` Field — Every Value, Transitions, Reliability

| Value | Meaning | What transitions **in** | What transitions **out** | Reliable? |
|---|---|---|---|---|
| `spawning` | Session created, terminal starting up | `create()` with `status: 'spawning'`; also set by resume route | Agent CLI sends PATCH `{status: 'idle'}` or `{status: 'working'}` when ready | ⚠️ Sticks here if spawn fails silently or terminal closes before CLI init completes |
| `idle` | Agent is running, waiting for input | Agent CLI PATCH after init or finishing a task | Agent CLI PATCH when starting work | ⚠️ May be accurate when agent is truly waiting, but terminal can exit without clearing this |
| `working` | Agent is actively processing | Agent CLI PATCH when starting a task | Agent CLI PATCH to `'idle'`, `'completed'`, or `'failed'` | ❌ **Most commonly stale** — when a terminal crashes or is force-closed, this status stays forever |
| `completed` | Agent reported successful finish | Agent CLI PATCH; or UI when it catches a clean exit | Nothing (terminal state) | ⚠️ Accurate when the agent reported it, but **completedAt is only set if the PATCH reaches the server** |
| `failed` | Agent reported failure | Agent CLI PATCH | Nothing (terminal state) | ⚠️ Same caveat as `completed` |
| `stopped` | Terminal exited — could be user-stopped or crash | UI `applyPendingExit` → PATCH `{status: 'stopped'}` (line 382–385 in useSessionStore.ts) | Resume → PATCH `{status: 'spawning'}` | ⚠️ Only set if the UI catches the exit; missed if UI is closed or crashes |

**The root problem (confirmed in code):**

The server's `status` field is updated **entirely by PATCH calls from the agent CLI or the UI**. There is no heartbeat, no server-side process-watching, no timeout. When a terminal exits without the UI or CLI sending a PATCH:
- If the UI **is** running and catches the PTY exit event → `applyPendingExit` fires → PATCH `{status: 'stopped', completedAt: Date.now()}` is sent (useSessionStore.ts:381–385)
- If the UI **is not** running, or the process was force-killed, or the spawn failed mid-way → **no PATCH is sent** → status stays at `'spawning'` or `'working'` forever

The resume endpoint acknowledges this explicitly: *"Resume is allowed from ANY status. The server-side `status` field is an unreliable, client-driven signal that frequently gets stuck at 'working'/'spawning' when a terminal dies without the UI reporting it."* (sessionRoutes.ts:1748–1752)

The history panel comment also confirms: *"the server-side `status` is unreliable and frequently sticks at 'working'/'spawning' for sessions whose terminal has actually exited, so we never gate the history list on it"* (SessionsSection.tsx:715–718)

---

## D. The Four Independent Axes

A session's display state is the intersection of four independent signals:

### Axis 1: `status` — Agent-reported state (UNRELIABLE)
What the agent CLI last told the server it was doing. Frequently stale. Never use this as the sole source of truth for "is it running?"

### Axis 2: Terminal liveness — Local process state (RELIABLE for tab routing)
Tracked in `useSessionStore` as the local terminal sessions array. Each local terminal has:
- `maestroSessionId: string | null` — links a terminal tab to a server session record
- `exited: boolean` — whether the PTY process has exited

The `linkMap` in SessionsSection.tsx builds a `Map<maestroSessionId, { localSessionId, exited }>` from local terminals. A session is "live" if `linkMap.get(sessionId)?.exited === false`.

**Crucially: a session with no entry in `linkMap` at all (no local terminal tab) is treated the same as one where `exited === true` — both mean Inactive.** This is correct behavior: a session you spawned yesterday, closed the UI, and reopened today has no local terminal and should be Inactive.

### Axis 3: `humanCompletedAt` — Human "done" marker (RELIABLE, marker only)
Set when user clicks the ○ radio. It's a UI note: "I reviewed this, it's done." It does **not** move the session between tabs. The tile shows a "done" tag. Toggling it off just clears the marker; the session stays in whatever tab its liveness dictates.

### Axis 4: `archivedAt` — Explicit archive (RELIABLE, tab-driver with highest precedence)
Set when user clicks ✕ or confirms the close dialog. Overrides liveness. A session with `archivedAt` set **always** lands in Archived, even if a terminal is somehow still live (which shouldn't happen in practice — the close action also stops the terminal).

### Truth Table for Realistic Combinations

| `archivedAt` | Has live terminal | `humanCompletedAt` | `status` | Tab shown | What the panel should say |
|---|---|---|---|---|---|
| null | Yes (exited=false) | null | any | **Active** | Running |
| null | Yes (exited=false) | set | any | **Active** | Running (done tag visible) |
| null | No (exited=true or no tab) | null | any | **Inactive** | No terminal; resume to reactivate |
| null | No | null | `'working'` | **Inactive** | Status stuck; terminal is gone — this is the core bug |
| null | No | set | any | **Inactive** | Done (done tag visible) |
| set | No | any | any | **Archived** | Closed by user |
| set | Yes (shouldn't happen) | any | any | **Archived** | Archived wins regardless |

---

## E. Known Inconsistencies and Footguns

### 1. Status sticks at `'working'` or `'spawning'` after terminal exits
**Frequency:** Common — the comment in resume route says ~24% of sessions were stranded before the gate was removed.
**Cause:** Status is updated by the client; if the terminal exits without the UI sending a PATCH (restart, crash, manual kill), the server never learns. The session stays "working" forever in the database.
**Impact:** Status badges show wrong color/symbol. Anything that gates behavior on `status` (old resume gate) will fail.
**Where confirmed:** `sessionRoutes.ts:1748–1752`; `SessionsSection.tsx:715–718`

### 2. `completedAt` missing for silently-exited sessions
**Cause:** `completedAt` is written by `FileSystemSessionRepository.update()` **only** when `status` changes to `'completed'`, `'failed'`, or `'stopped'` (line 516–519). If the terminal exits without a PATCH, `completedAt` stays null even though the session is finished.
**Impact:** Duration calculation shows nothing or falls back to `lastActivity`. Not a tab-routing issue.

### 3. `teamMemberId` / `teamMemberIds` can disagree with `metadata.teamMemberId` / `metadata.teamMemberIds`
**Cause:** These are stored in `metadata` at spawn (the canonical location) and also copied to top-level fields on the session object for UI convenience. The `enrichSessionWithSnapshots` middleware on GET /sessions tries to reconstruct them from team member records if the top-level fields are missing — but this is a fallback, not authoritative.
**Impact:** Snapshot display can be wrong if a team member was edited after spawn (snapshots are frozen at spawn time by design).

### 4. `teamSessionId` is null for standalone sessions and sometimes for workers in older spawns
**Cause:** `teamSessionId` is set at spawn (sessionRoutes.ts:1512: `teamSessionId: isSessionSpawned ? resolvedParentSessionId! : null`). Coordinators get it back-filled when the first worker spawns (line 1548–1553). Older sessions from before this logic existed have null.
**Impact:** `buildTeamGroups` may miss color-grouping these sessions.

### 5. `mode` is stored in `metadata.mode`, not as a top-level field on the persisted Session
**Cause:** Architecture decision — mode was added after the initial schema. The server `UpdateSessionPayload.mode` writes to `session.metadata.mode` (FileSystemSessionRepository.ts:536–539). The UI type `MaestroSession.mode` is a top-level field but it's populated from the WS event `session:mode_changed` or the spawn response.
**Impact:** A hard reload that hits GET /sessions will get `mode` via whatever is in `metadata.mode`. The UI type has it at top-level, but reading from a stale WS snapshot may show wrong mode until re-fetched.

### 6. `rootSessionId` defaults to `session.id` for solo sessions (not null)
**Confirmed in:** `FileSystemSessionRepository.ts:173`: `if (!session.rootSessionId) { session.rootSessionId = session.id; }`
This means every session is technically a root of itself, which is correct for use in `collectSubtreeIds`.

### 7. Resume un-archives a session but only if the UI checks `archivedAt`
**Confirmed in:** `SessionsSection.tsx:868–880` — after `resumeSession()`, if `maestroSessions[maestroSessionId]?.archivedAt` is set, the UI calls `setSessionArchived(id, false)`. This is a UI-side conditional, not server-side. If the archived session is resumed from the history panel (not the Archived tile), this un-archive might not happen consistently.

---

## F. Design Implications

### The Data That Actually Exists (Summary)

Three clean, reliable signals:
1. **`archivedAt`** — persisted, user-controlled, wins over everything
2. **Local terminal liveness** (`linkMap.get(id)?.exited === false`) — ephemeral, per-device, most truthful indicator of "running right now"
3. **`humanCompletedAt`** — persisted, user-controlled, marker only

One unreliable signal:
- **`status`** — frequently stale; useful for display badge color but not for routing

### Option 1 (Current) — Liveness-Driven Tabs ⟶ Active / Inactive / Archived
- **Active** = has a live local terminal in its spawn subtree
- **Inactive** = no live terminal, not archived
- **Archived** = `archivedAt` set (always wins)
- `humanCompletedAt` = decoration only (done tag, no tab change)

**Pros:** Tabs reflect what's actually happening right now. Active/Inactive distinction is instantly understandable.
**Cons:** Tabs change automatically when a terminal exits, which can be disorienting (session jumps from Active to Inactive without user action). A user who closes the UI and reopens it finds everything in Inactive even if it was "done" — doesn't reflect intent. Pure ephemeral state drives persistent UI organization.

### Option 2 — Status-Driven Tabs ⟶ Running / Done / Archived
- **Running** = `status` is `'spawning'`, `'idle'`, or `'working'`
- **Done** = `status` is `'completed'`, `'failed'`, or `'stopped'`
- **Archived** = `archivedAt` set

**Pros:** Simpler, no per-device liveness dependency; clearer semantics ("this agent is done").
**Cons:** Unreliable — `status` sticks at `'working'` constantly. Users would see sessions stuck in "Running" after their terminals have exited.

### Option 3 — Human-Intent-Driven Tabs ⟶ Open / Done / Archived
- **Open** = no `archivedAt`, no `humanCompletedAt` — these are sessions you haven't explicitly addressed
- **Done** = `humanCompletedAt` is set (user said "I'm done with this")
- **Archived** = `archivedAt` set (user dismissed/closed this)

**Pros:** Reflects human intent perfectly; tabs are stable across restarts; makes liveness a decoration (live dot) rather than a driver.
**Cons:** New sessions always land in Open; users must actively mark things done. The Done tab could fill up. "Open" can include both live sessions and long-dead ones with no distinction.

### Option 4 — Two-Axis Tabs ⟶ Active / History (Archived as modal/filter)
- Collapse Inactive + Archived into a single "History" section
- Active = has live terminal OR spawned within the last N hours
- History = everything else; sortable/filterable within
- Archive becomes a visibility filter, not a hard separation

**Pros:** Simpler tab bar; removes the confusing Inactive tab that most users don't understand.
**Cons:** History becomes a dumping ground; hard to distinguish "just stopped" from "3 months old." Archived-as-filter makes the close action less obviously permanent.

### Option 5 — Hybrid: Liveness + Persisted Intent ⟶ Active / Inactive+Done / Archived
- **Active** = has live terminal (same as current)
- **Inactive** = no live terminal AND neither `humanCompletedAt` nor `archivedAt` — these are "in limbo" (terminal died, still relevant)
- **Done** = `humanCompletedAt` set (user acknowledged, no live terminal)
- **Archived** = `archivedAt` set
- Or collapse Done into Inactive as a sub-filter

**Pros:** Inactive now has a cleaner meaning; human-marked-done sessions are visually distinguished without requiring a whole tab.
**Cons:** Four concepts to learn; Done tab may be redundant with Inactive.

---

### Recommendation: **Option 3 (Human-Intent-Driven: Open / Done / Archived)**

With a live indicator as decoration.

**Why:** The core problem with the current model (Option 1) is that tabs are driven by ephemeral, per-device liveness that resets on every UI restart. This makes tabs feel unstable. The three timestamps we actually have (`humanCompletedAt`, `archivedAt`, and implicitly "neither") map cleanly to three intent states: "I'm still working on this / haven't decided," "I've signed off on this," and "I've dismissed this." Liveness then becomes a visible indicator (live dot, color accent) within the Open tab rather than a routing criterion.

**How to make it work:**
- Open tab: no `archivedAt`, no `humanCompletedAt` — new sessions land here automatically
- Done tab: `humanCompletedAt` set — user must explicitly mark done
- Archived tab: `archivedAt` set — clicking ✕ still works as today
- Add a live dot / active count indicator within the Open tab to show which sessions are currently running
- Rename the ○ radio to something clearer: "Mark done" → moves to Done tab (same as today, but now the Done tab exists)
- Resume from Done tab should un-mark humanCompletedAt and move back to Open

**Tradeoffs:**
- Sessions don't auto-sort between tabs, so the Open tab stays stable between UI restarts ✅
- Users must take an action (mark done or archive) for sessions to leave Open — there's no automatic cleanup ⚠️
- All stale/zombie sessions (crashed terminals, unknown status) stay in Open until acknowledged — could accumulate ⚠️
- Can optionally add a "cleanup old sessions" action or auto-age into a sub-filter

---

*Cited files:*
- *`maestro-ui/src/app/types/maestro.ts` — UI type definitions (MaestroSession, UpdateSessionPayload)*
- *`maestro-server/src/types.ts` — Server types (Session, SessionStatus, normalizeMode)*
- *`maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` — Persistence, migrations, completedAt logic*
- *`maestro-server/src/api/sessionRoutes.ts` — Spawn, resume, PATCH routes; resume reliability comment at line 1748*
- *`maestro-ui/src/stores/useMaestroStore.ts` — WebSocket handling, setSessionArchived, setSessionHumanComplete, pendingLifecycle guard*
- *`maestro-ui/src/utils/sessionLifecycle.ts` — resolveSessionTab, buildChildrenByParent, collectSubtreeIds*
- *`maestro-ui/src/components/SessionsSection.tsx` — linkMap (liveness), tab routing, history panel comments*
- *`maestro-ui/src/components/maestro/SessionListItem.tsx` — Per-tile display logic, canResume check*
