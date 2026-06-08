# Session Stats — Research & Design Discussion

**Task:** `task_1780900247851_cysy3g64k` — Session Stats
**Date:** 2026-06-08
**Status:** Research complete; awaiting product decisions before design

---

## Goal

When a session is INACTIVE, render a stats view in the center panel (instead of the dead/frozen terminal). Before designing the view, we need a precise picture of (a) what "inactive" means on this branch, (b) what data exists to show, and (c) where the stats view plugs in.

---

## 1. Session lifecycle on this branch

The branch deliberately splits lifecycle into **two orthogonal axes**:

### Routing axis (persisted, drives Open/Done/Archived tabs)
- `humanCompletedAt` — set by user "Mark done" (`maestro-ui/src/stores/useMaestroStore.ts:1296-1306`)
- `archivedAt` — set by user Close ✕ (cascades through subtree, stops PTYs) (`useMaestroStore.ts:1319-1330`)
- Persisted in `FileSystemSessionRepository.ts:540-544`
- Tab resolution (precedence archived → done → open): `maestro-ui/src/utils/sessionLifecycle.ts:10-16`

### Liveness axis (local-only, drives the "live dot")
- Derived from `linkMap` (PTY exited flag) — **not** server `status`
- Per-tile: `SessionsSection.tsx:328` (`isWorking || status==='working'`, gated by `!isExited && !isClosing`)
- Aggregate: `SessionsSection.tsx:948-955`
- `linkMap` maps `maestroSessionId → { localSessionId, exited }` from the PTY list

### The `status` enum exists but is explicitly treated as UNRELIABLE
`SessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped'`
- Defined: `maestro-server/src/types.ts:409`, mirrored `maestro-ui/src/app/types/maestro.ts:6`
- Excluded from routing intentionally (`maestro-ui/src/__tests__/sessionLifecycle.test.ts:24-31`)
- Can be stale indefinitely: `status:'working'` survives a dead PTY if the app isn't running. The 30s orphan reaper (`initApp.ts:661-689`) only runs while the UI is open.

| Status | Meaning | Who sets it (file:line) |
|---|---|---|
| `spawning` | Session row created, terminal not yet live | `sessionRoutes.ts:1497` |
| `idle` | Default on plain create | `FileSystemSessionRepository.ts:400` |
| `working` | Agent actively running | CLI `worker-init.ts:117`, `worker-resume.ts:53` |
| `completed` | Agent reported done | CLI `session.ts:909`, `report.ts:56`; guarded `SessionService.ts:128-133` |
| `failed` | Session failed | PATCH; notify in `SessionService.ts:183-185` |
| `stopped` | Terminal exited / orphan reaped | `useSessionStore.ts:383,569`, `initApp.ts:175,681,814` |

### State machine
```
                    POST /sessions/spawn
                  (status='spawning', sessionRoutes.ts:1497)
                            │
                            ▼
   CLI worker-init/resume PATCH status='working'
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
   needs_input         (working ⇄ idle)      report progress
                                              (timeline only)
        │
        ▼
   agent finishes ──► CLI report complete
                      PATCH status='completed'

   ── LIVENESS (orthogonal) ──
   terminal PTY exits ──► UI PATCH status='stopped'
   app restart / orphan ─► cleanupOrphanedSessions every 30s

   ── ROUTING (human intent) ──
   "Mark done"  ──► humanCompletedAt=now → Done tab
                    (leaves terminals RUNNING, SessionsSection.tsx:1010-1014)
   "Close" (✕)  ──► stop PTYs + archivedAt=now → Archived tab
   "Restore"    ──► archivedAt=null → back to Open
   delete       ──► session_stopped timeline + worktree cleanup + row removed
```

---

## 2. Center panel UI today

**The center panel is `AppWorkspace.tsx`, NOT `SessionsSection.tsx`.** SessionsSection / SessionListItem are the **left list**; selecting a tile only switches the active terminal.

### Active vs inactive branching today
There is no active/inactive branch. All local terminals are mounted simultaneously as absolutely-positioned containers at `AppWorkspace.tsx:282-300`:
- Inactive terminals: hidden via `.terminalHidden` (`:286`)
- Exited terminals: render read-only (`:291`) — no placeholder, no stats

### Recommended seam
Branch inside the `sessions.map` at `AppWorkspace.tsx:282-300` on `s.exited / s.closing` to render `<SessionStatsView session={maestroSession}/>` instead of `<SessionTerminal>`. Minimal blast radius, no selection-model change.

### CSS gotcha
Center-pane layout lives in `styles-update-banner.css` (misnamed) — `.terminalPane` has `contain: strict`, so the stats view must self-scroll. `styles-maestro-sessions-v2.css` is sidebar-only.

### Reuse inventory
Already built and usable as stats primitives:
- `SessionDetailOverlay` — tabbed Info / Sub-sessions / Tasks / Docs+Timeline (full stats view)
- `SessionDetailModal` — similar
- `SessionTimeline`, `DocsList`, `SessionDetailsSection`, `StrategyBadge` — individually reusable

Not present:
- Chart/sparkline primitives
- Token/cost/turn metrics on `MaestroSession`

---

## 3. Metric inventory — what we can show

All on the `Session` entity unless noted (`maestro-server/src/types.ts:362-403`).

### Free (already persisted)
| Metric | Source field / derivation | file:line |
|---|---|---|
| Start time | `startedAt` | `types.ts:376`, `FileSystemSessionRepository.ts:401` |
| Last activity | `lastActivity` (re-stamped on update) | `types.ts:377`, `FileSystemSessionRepository.ts:547` |
| End time | `completedAt` (set on completed/failed/stopped) | `types.ts:378`, `FileSystemSessionRepository.ts:516-518` |
| Duration | derive `completedAt - startedAt` | — |
| Human-done time | `humanCompletedAt` | `types.ts:379` |
| Archived time | `archivedAt` | `types.ts:380` |
| Status | `status` | `types.ts:375` |
| Host / platform | `hostname`, `platform` | `types.ts:381`, `FileSystemSessionRepository.ts:404-405` |
| Timeline events | `timeline: SessionTimelineEvent[]` (append-only) | `types.ts:384` |
| Timeline counts by type | group `timeline` by `.type` (12 types) | `types.ts:412-425` |
| Reports filed | timeline entries `progress`/`task_completed`/`task_blocked`/`error` | `maestro-cli/src/commands/report.ts:17-20` |
| Errors | timeline entries `type:'error'` | `types.ts:423` |
| Blockers | timeline entries `type:'task_blocked'` | `types.ts:419` |
| Docs produced | `docs: DocEntry[]` (count + titles/paths) | `types.ts:385`, `SessionService.ts:413-456` |
| Tasks worked on | `taskIds[]` (count + list) | `types.ts:367` |
| Per-task outcome | `task.taskSessionStatuses[sessionId]` | `types.ts:315`, `SessionService.ts:138-159` |
| Children sessions (coordinator) | sessions where `parentSessionId === id`; subtree via `collectSubtreeIds` | `types.ts:398`, `sessionLifecycle.ts:19-49` |
| needsInput episodes | `needsInput` + `needs_input` timeline events | `types.ts:387-391` |
| Team identity | `teamMemberId(s)`, `teamMemberSnapshot(s)` | `types.ts:392-397` |
| Model / agentTool / mode / skills | `metadata.{model,agentTool,mode,skills,...}` | `sessionRoutes.ts:1499-1515` |
| Worktree | `metadata.worktreePath/worktreeBranch` | `sessionRoutes.ts:1528+` |

### Would need new instrumentation
- Message count
- Tool-call count
- Token usage (input/output/cache)
- Cost

None of these are persisted server-side. They live only in the Claude CLI transcript (referenced by `claudeSessionId`, `types.ts:371`) which the server does not parse.

---

## 4. Ambiguities & edge cases for "INACTIVE"

1. **"Inactive" is not a stored state.** Two candidate definitions can conflict:
   - **Liveness:** no live PTY (`linkMap` missing or `exited`)
   - **Status:** `status ∈ {completed, failed, stopped}`
   A session can be `status:'working'` with a dead terminal, or `status:'stopped'` with `humanCompletedAt` set.

2. **Done ≠ dead.** "Mark done" sets `humanCompletedAt` but deliberately leaves terminals running (`SessionsSection.tsx:1010-1014`). A Done session can still be live.

3. **`status:'working'` can be stale indefinitely.** Only flips to `stopped` via UI PTY exit observation or the 30s orphan reaper (`initApp.ts:661-689`). If the app isn't running, the server keeps a dead session as `working`.

4. **No heartbeat / PID / WS-liveness on the server.** The server has no ground truth that an agent is alive — only `lastActivity` (last write time). Server-side "dead" would need `now - lastActivity > threshold` heuristics (none exists).

5. **`idle` is effectively unused as a runtime signal.** Create-default only; agents PATCH to `working` immediately. Nothing transitions `working→idle`.

6. **Archived-but-live edge case.** Close (✕) stops PTYs then archives; if stop fails or a child PTY respawns, an archived node could still have a live terminal.

7. **Spawn race window.** Reaper skips `spawning` sessions <60s old. Stats for a sub-60s session may be incomplete.

---

## 5. Open product decisions (need user input)

### Q1 — What counts as "inactive" for showing stats?
- **(a) PTY exited (liveness axis)** — recommended, consistent with how the branch treats `status` as unreliable
- (b) `status ∈ {completed, failed, stopped}` — server-side but can lie
- (c) In the Done tab (`humanCompletedAt` set) — but Done sessions intentionally keep terminals running

### Q2 — New `SessionStatsView` vs reuse `SessionDetailOverlay`?
- (a) Extract overlay body into a shared component used both inline and in the modal
- (b) Build a new dashboard-style stats view from scratch (cards, big numbers)
- (c) Just open the overlay inline as-is

### Q3 — MVP metric set?
- Stick to free metrics (duration, task outcomes, timeline counts, docs, errors, sub-sessions) — ship fast
- Or instrument message/tool-call/token counts now — server work, ships slower

### Q4 — Done-but-still-live sessions?
- (a) Ignore Done-ness — only flip to stats on PTY exit
- (b) Show stats over a live terminal once user marks Done (overlay?)

---

## 6. Source workers

Research was done by two parallel workers:
- Lifecycle / liveness: `sess_1780900365524_mrhhagvpl` (Session Engineer, task `task_1780900339080_jmbzfdldh`)
- Center-panel UI: `sess_1780900379185_8l9m97xys` (Tech Lead, task `task_1780900347336_1iinnb63y`)

Both reports posted inline to their session logs; key citations consolidated here.
