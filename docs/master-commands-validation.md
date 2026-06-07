# Master Commands Validation Report

Session: `sess_1780163683887_h5y92m880` (independent re-validation; original run `sess_1780163303127_wurwk1emv`) · Project: Agent-maestro (`proj_1770533548982_3bgizuthk`, `isMaster=true`) · Server: `http://localhost:2357` (prod data `~/.maestro/data`) · Date: 2026-05-30

> Re-validated 2026-05-30 in a fresh master session. Both root-cause bugs reproduce identically; counts refreshed below.

## Result summary

| Step | What | Result |
|---|---|---|
| 0 | Confirm master context | PASS — `MAESTRO_IS_MASTER=true`; project `isMaster=true` |
| 1 | `maestro master projects` | **FAIL — 403** |
| 2 | `maestro master tasks` (+ `--project`) | **FAIL — 403** |
| 3 | `maestro master sessions` (+ `--project`) | **FAIL — 403** |
| 4 | `maestro master context` | **FAIL — 403** |
| 5 | cross-project `maestro session prompt` | PASS (gap confirmed) — **403**, scope violation |

The read-only master layer is **entirely unreachable today** — not because of the env, but because of two compounding root-cause bugs.

## Root cause 1 — `isMasterSession` is never persisted (server)

`SessionService.createSession` correctly derives the flag from the project:

```
// SessionService.ts:39-42
if (project.isMaster) {
  input.isMasterSession = true;
  input.env = { ...input.env, MAESTRO_IS_MASTER: 'true' };
}
```

But `FileSystemSessionRepository.create` (FileSystemSessionRepository.ts:392-421) builds the `Session` object field-by-field and **never copies `input.isMasterSession`**. Only `env` survives (line 399), which is why the `MAESTRO_IS_MASTER=true` env var reached this shell while the session record's `isMasterSession` is `undefined`.

Evidence:
- This session: `isMasterSession: undefined` (via `GET /api/sessions/<id>`).
- **0 of 2488** session files on disk have `"isMasterSession":true`.
- `GET /api/master/projects?sessionId=<thisSession>` → `403 {"code":"FORBIDDEN","message":"Access denied. This endpoint requires a master session."}` (masterRoutes.ts:31).

Fix: add `isMasterSession: input.isMasterSession` to the `Session` literal in `FileSystemSessionRepository.create`.

## Root cause 2 — CLI never sends session context (cli)

`maestro-cli/src/api.ts` (`APIClient.request`) sends only `Content-Type`; it never sets `X-Session-Id`. `commands/master.ts` calls `api.get('/api/master/...')` without adding a `sessionId` query param either.

So even a correctly-flagged master session would still fail:
`maestro master projects` → `403 "Master session context required. Provide X-Session-Id header or sessionId query param."` (masterRoutes.ts:24).

Fix: have the CLI api client attach `X-Session-Id: $MAESTRO_SESSION_ID` (available in env) on every request, or have `master.ts` append `?sessionId=...`.

Both bugs must be fixed for `maestro master *` to work.

## Step 3 / 4 counts (server-observable equivalents)

Master endpoints 403, so these come from `GET /api/sessions` (the same data the master layer would read):

- **Total sessions tracked by server: 341** (matches the task's "~330" note).
- By status: **working 221, spawning 110, completed 10**.
- working+spawning = **331**, and **all 331** were last updated more than 7 days ago → confirms the known issue: session status is never reconciled, so none are truly live.
- **31 projects total, 2 master**: Agent-maestro (`proj_1770533548982_3bgizuthk`) and Self (`proj_1771613111885_spsnabx7l`).
- Home project (`proj_1770533548982_3bgizuthk`): **725 tasks, 43 sessions**.

## Step 5 — messaging gap (confirmed as expected)

`maestro session prompt sess_1772441634055_kz319sh2b --message 'ping from master'` (target in `proj_1771613111885_spsnabx7l`, a different project) →

```
403: Session prompt is limited to parent/sibling sessions
     (or direct team sessions for a root coordinator).
```

Cross-project messaging is blocked by the team-boundary check, as designed. This is the gap the master-coordinator design closes via `POST /api/master/sessions/:id/prompt`.
