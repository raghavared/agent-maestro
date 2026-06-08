# Review findings — Workspace Openness + Cross-Project Access

> Source: Tech Lead review (`sess_1780218229260_s5clgrsek`, 2026-05-31 15:00).
> Verdict: **NEEDS FIXES**

## 🔴 BLOCKER

### B1 — UI spawning is broken
The new spawn gate in `maestro-server/src/api/sessionRoutes.ts:1042` unconditionally requires `X-Session-Id`. The desktop UI spawns via `MaestroClient.fetch` which never attaches such a header (UI spawns are user-initiated, not session-initiated). Result: every Spawn-button click returns **400 `sender_session_required`**.

The test `maestro-server/test/spawn-mode.test.ts:181` enshrines this broken behavior as expected.

**Recommended fix:** treat missing `X-Session-Id` as a user-initiated spawn (no gate). The gate's purpose is to prevent recursive worker self-promotion, not to block UI users. The 400 should fire only when `X-Session-Id` is **present but invalid** (session not found). Update the test accordingly.

Alternative: UI sends `spawnSource:'ui'` flag in the body — also acceptable, but adds protocol noise.

## 🟡 ISSUES

### I1 — `<workspace_context>` "projects > 1" branch is dead for non-master sessions
Design §6.2 says emit `<workspace_context>` when **either** `project.isMaster` **or** `projects.length > 1`. But `masterProjects` is only populated when `MAESTRO_IS_MASTER==='true'`. Non-master sessions in a multi-project workspace will never see the block. Violates §6.2.

### I2 — `team-member --all-projects` returns only global members, not all
The relax of `/api/team-members` works for the "no filter" case, but `--all-projects` from the CLI is mapped to a server query that only returns the `__global__` bucket. Cross-project listing is therefore incomplete.

### I3 — `getTeamMemberById` 404s on project-scoped members
The new uncached path returns 404 instead of looking across project partitions. The integration test tolerates 404, which masks the bug. Add a test that resolves a project-scoped member by id only.

### I4 — Spawn parentage authorized on `X-Session-Id` but derived from body `sessionId`
The gate checks `X-Session-Id` for coordinator role, but `parentSessionId` is taken from the request body. No test asserts the spawned child has `relation === 'coordinated'` and `parentSessionId === sender`. Tighten: use `X-Session-Id` as the canonical sender, ignore body `sessionId` for parentage. Add the assertion.

### I5 — Scope creep (mark for follow-up or revert)
Files touched outside the two design docs' scope:
- `maestro-cli/src/prompts/identity.ts` — subtask-before-spawn rewrite
- `maestro-ui/src/components/maestro/MultiProjectSessionsView.tsx` — column-collapse layout
- `maestro-ui/src/styles-multi-project-board.css` — same

Confirm intent with the user. If keeping, document why. If not, revert.

## ✅ GOOD

- Mode endpoint: idempotency, relation preservation, exact event payload `{ sessionId, mode, previousMode, changed, timestamp }`, self-only `X-Session-Id` gate — all correct.
- `promptModes` design is clean and faithful to the design doc.
- All gate removals (master auth middleware, team-boundary check, mode-block on spawn) match §3.3–3.4.
- CLI: `X-Session-Id` attach, `coordinator {enable,disable,status}` command, `resolveProjectScope` resolver — well-implemented.

## Build / test status

| Suite | Result |
|---|---|
| server build (`bun run build:server`) | clean |
| cli build (`bun run build:cli`) | clean |
| ui build (`bun run build:ui`) | clean |
| server tests (`maestro-server`) | 59 passed, 8 todo |
| ui tests (`maestro-ui`) | 62/62 passed |
| cli tests (`maestro-cli`) | 199 passed; only `hermes-spawner.test.ts` fails (**pre-existing on main**, module-mock hoisting bug, unrelated to this work) |

Heads-up: `identity.ts`'s blob hash changed mid-review (a sibling worker was editing concurrently). Treat as a moving target until that worker reports complete.
