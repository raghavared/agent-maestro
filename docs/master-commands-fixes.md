# Master Commands — Findings & Implementation Fixes

Task: `task_1780163287046_x310oxhkg` · Session: `sess_1780163683887_h5y92m880` · Date: 2026-05-30
Companion to: `docs/master-commands-validation.md` (full validation evidence).

## Findings (summary)

The read-only master layer (`maestro master projects|tasks|sessions|context`) is **unreachable today** because of two compounding bugs. Both must be fixed.

| # | Layer | Bug | Symptom |
|---|---|---|---|
| 1 | CLI | API client never sends `X-Session-Id` | `403 "Master session context required."` |
| 2 | Server | `FileSystemSessionRepository.create` drops `input.isMasterSession` | `403 "requires a master session."` even when header is supplied |

Evidence: this session has `env.MAESTRO_IS_MASTER=true` persisted but **no `isMasterSession` field** on disk; project `Agent-maestro` has `isMaster=true`. Step 5 (cross-project `session prompt` → 403 scope violation) is the separate, by-design messaging gap.

---

## Fix 1 — Persist `isMasterSession` (server)

`SessionService.createSession` already sets the flag (SessionService.ts:39-42), but the repository's `create` builds the `Session` literal field-by-field and never copies it. Only `env` survives, which is why the env var leaks through but the flag does not.

**File:** `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` (~line 416-421)

```diff
       docs: [],
       metadata: input.metadata,
       parentSessionId: input.parentSessionId || null,
       rootSessionId: input.rootSessionId || sessionId,
       teamSessionId: input.teamSessionId || null,
       teamId: input.teamId || null,
+      isMasterSession: input.isMasterSession ?? false,
     };
```

### Backfill for existing sessions (optional but recommended)

Existing master-project sessions already on disk have no flag. Either:

- **Lazy backfill** in `loadSessionFromDisk` (alongside the existing env-recovery migration ~line 169-178): if `session.env?.MAESTRO_IS_MASTER === 'true'` and `isMasterSession` is undefined, set `isMasterSession = true` and mark `needsSave = true`; or
- derive it at read time from the owning project's `isMaster`.

Lazy backfill is preferred — it self-heals the ~330 historical sessions without a migration script.

---

## Fix 2 — Send session context from the CLI (cli)

`config.sessionId` already reads `MAESTRO_SESSION_ID` (config.ts:47-49). The API client just needs to attach it.

**File:** `maestro-cli/src/api.ts` (`APIClient.request`, ~line 41-44)

```diff
 import fetch, { type RequestInit } from 'node-fetch';
 import { config } from './config.js';
 ...
         const response = await fetch(url, {
           ...options,
           signal: controller.signal as any,
           headers: {
             'Content-Type': 'application/json',
+            ...(config.sessionId ? { 'X-Session-Id': config.sessionId } : {}),
             ...options?.headers,
           },
         });
```

Header-based is cleaner than appending `?sessionId=` per-call in `master.ts`, and benefits any future session-scoped endpoint. The server already accepts the header first (masterRoutes.ts:17-19).

---

## Verification after fixing

From a session spawned in a master project (this one, after a respawn or lazy backfill):

```bash
maestro master projects     # → table of 31 projects, Agent-maestro & Self marked master
maestro master tasks --project proj_1770533548982_3bgizuthk   # → 725 tasks
maestro master sessions     # → 341 sessions
maestro master context      # → per-project task/session counts
```

Unit/integration coverage to add:
- `FileSystemSessionRepository.create` persists `isMasterSession` round-trip.
- master auth middleware: 403 without header, 403 for non-master session, 200 for master session.
- CLI api client attaches `X-Session-Id` when `MAESTRO_SESSION_ID` is set.

## Out of scope (separate work)

- **Status reconciliation:** 331 of 341 sessions report working/spawning though all are >7 days stale. Master `sessions`/`context` will surface inflated live counts until a reconciler marks stale sessions.
- **Cross-project messaging** (Step 5): blocked by the team-boundary check by design; the master-coordinator design closes it via `POST /api/master/sessions/:id/prompt`.
