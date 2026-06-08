# Master Commands — Findings & Implementation Fixes

Task: `task_1780163287046_x310oxhkg` · Project: Agent-maestro (`proj_1770533548982_3bgizuthk`, `isMaster=true`) · Server: `http://localhost:2357` · Date: 2026-05-30

## 1. Findings (validation result)

| Step | What | Result |
|---|---|---|
| 0 | Confirm master context | PASS — `MAESTRO_IS_MASTER=true`; project `isMaster=true` |
| 1 | `maestro master projects` | **FAIL — 403** |
| 2 | `maestro master tasks` (+ `--project`) | **FAIL — 403** |
| 3 | `maestro master sessions` (+ `--project`) | **FAIL — 403** |
| 4 | `maestro master context` | **FAIL — 403** |
| 5 | cross-project `maestro session prompt` | PASS (gap confirmed) — **403** scope violation |

The read-only master layer is **entirely unreachable today** because of two compounding root-cause bugs. The cross-project messaging gap (Step 5) behaves exactly as the master-coordinator design expects.

### Counts (server-observable, from `GET /api/sessions` since master endpoints 403)
- **31 projects total, 2 master**: Agent-maestro (`proj_1770533548982_3bgizuthk`) and Self (`proj_1771613111885_spsnabx7l`).
- **341 sessions** tracked by server (disk holds 2488 files; only ~341 loaded).
- By status: **working 221, spawning 110, completed 10**; working+spawning = **331**, all last updated >7 days ago → none truly live (status never reconciled — known issue).
- Home project: **725 tasks, 43 sessions**.

---

## 2. Root cause 1 — `isMasterSession` is never persisted (server)

`SessionService.createSession` correctly derives the flag (SessionService.ts:39-42):

```ts
if (project.isMaster) {
  input.isMasterSession = true;
  input.env = { ...input.env, MAESTRO_IS_MASTER: 'true' };
}
```

But `FileSystemSessionRepository.create` builds the `Session` literal field-by-field and **never copies `input.isMasterSession`** — only `env` survives (FileSystemSessionRepository.ts:399). That is why the `MAESTRO_IS_MASTER=true` env var reaches the spawned shell while the session record's `isMasterSession` stays `undefined`.

Evidence:
- This session: `isMasterSession: undefined` (via `GET /api/sessions/<id>`).
- **0 of 2488** session files have `"isMasterSession":true`.
- `GET /api/master/projects?sessionId=<thisSession>` → `403 {"code":"FORBIDDEN","message":"Access denied. This endpoint requires a master session."}` (masterRoutes.ts:31).

Both `Session` (types.ts:396) and `CreateSessionPayload` (types.ts:589) already declare the field — only the repository copy is missing.

### Fix
In `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`, inside the `Session` object built by `create` (~line 417-420), add:

```ts
      teamSessionId: input.teamSessionId || null,
      teamId: input.teamId || null,
      isMasterSession: input.isMasterSession ?? false,   // <-- add
    };
```

---

## 3. Root cause 2 — CLI never sends session context (cli)

`maestro-cli/src/api.ts` (`APIClient.request`) sends only `Content-Type`; it never sets `X-Session-Id`. `commands/master.ts` calls `api.get('/api/master/...')` without a `sessionId` query param either. So even a correctly-flagged master session still fails:

`maestro master projects` → `403 "Master session context required. Provide X-Session-Id header or sessionId query param."` (masterRoutes.ts:24).

### Fix
In `maestro-cli/src/api.ts`, attach the session id from the environment on every request. In `request()`, where headers are assembled (~line 41-44):

```ts
        const sessionId = process.env.MAESTRO_SESSION_ID;
        const response = await fetch(url, {
          ...options,
          signal: controller.signal as any,
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
            ...options?.headers,
          },
        });
```

`MAESTRO_SESSION_ID` is already present in every spawned session's env, so no plumbing through `config` is required. (Alternative, narrower fix: have `master.ts` append `?sessionId=${config.sessionId}` to each master endpoint — but the header approach also future-proofs any other session-scoped routes the CLI calls.)

Both fixes are required for `maestro master *` to work end-to-end.

---

## 4. Step 5 — messaging gap (confirmed as expected, no fix here)

`maestro session prompt sess_1772441634055_kz319sh2b --message 'ping from master'` (target in `proj_1771613111885_spsnabx7l`) →

```
403: Session prompt is limited to parent/sibling sessions
     (or direct team sessions for a root coordinator).
```

Cross-project messaging is blocked by the team-boundary check, as designed. This is the gap the master-coordinator design closes via a dedicated `POST /api/master/sessions/:id/prompt` endpoint (out of scope for these two fixes).

---

## 5. Suggested verification after fixes

1. Rebuild server + CLI (`bun run build:server && bun run build:cli`).
2. Spawn a fresh session in a master project; confirm `GET /api/sessions/<id>` shows `isMasterSession: true`.
3. Run `maestro master projects` / `tasks` / `sessions` / `context` — expect tables, no 403.
4. Confirm a session spawned in a **non-master** project still 403s on master commands (negative test).
