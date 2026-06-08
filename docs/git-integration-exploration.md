# Git Integration in Maestro — Exploration & Roadmap

Task: integrate git into Maestro as a first-class feature — worktrees, git diff, branches, PRs — all inbuilt.

This document maps **what already exists**, **what is broken**, and a **recommended architecture + phased roadmap** to get there.

---

## 1. Current State (verified in code, 2026-06-08)

Maestro already has a partial worktree integration. The **write path** (create a worktree when a session spawns) works; the **read/manage path** (diff, branch info, PR, merge) is absent.

| Capability | Status | Evidence |
|---|---|---|
| Detect git repo | ✅ | `GitWorktreeService.isGitRepo()` |
| Create worktree on spawn | ✅ | `sessionRoutes.ts:1522-1540` → `createWorktree()` (branch `maestro/<sessionId>`, dir `~/.maestro/worktrees/<sessionId>`) |
| Session runs inside worktree | ✅ | spawn sets `cwd = worktreeResult.worktreePath` (`:1639`); env `MAESTRO_WORKTREE_PATH/BRANCH/PROJECT_DIR` |
| Resume into worktree | ✅ (but fragile, see §2) | `:1789`, `:1900-1902` read `session.metadata?.worktreePath` |
| Cleanup worktree+branch on session delete | ✅ | `SessionService.deleteSession()` → `removeWorktree()` |
| `useWorktree` flag on Task / spawn payload | ✅ | `types.ts`, `validation.ts` (create/update/spawn schemas) |
| Persist worktree metadata to disk | ❌ **BUG** | see §2 |
| Worktree visibility in UI (branch/path badges) | ❌ | only `SessionStatsView.tsx` references it; no badges in session views |
| `useWorktree` toggle in CreateTaskModal | ❌ | `useTaskForm.ts` has no `useWorktree` state |
| git diff (summary or full) | ❌ | no service method, no endpoint, no UI |
| Branch listing / switching | ❌ | none |
| PR creation | ❌ | none |
| Merge / discard worktree back to base | ❌ | `removeWorktree` exists but no merge; no UI to trigger |
| CLI git commands (`maestro git ...`) | ❌ | no CLI command group |

Net: **~40% of "worktree", ~0% of diff/branch/PR.** An older `WORKTREE_IMPLEMENTATION_PLAN.md` (April) describes phases 1–3; most of phase 2/3 was never landed, and its "blocker" (metadata persistence) is still open.

---

## 2. The blocking bug: worktree metadata is never persisted

At spawn the worktree path/branch are written **only to the in-memory session object**:

```ts
// sessionRoutes.ts:1536-1539
if (!session.metadata) (session as any).metadata = {};
(session as any).metadata.worktreePath = worktreeResult.worktreePath;
(session as any).metadata.worktreeBranch = worktreeResult.branchName;
```

The `updateSession({ env })` call right above it persists `env` but not `metadata`. And `FileSystemSessionRepository.update()` only merges **one** metadata key:

```ts
// FileSystemSessionRepository.ts:537-539  — only handles mode!
if (updates.mode !== undefined) {
  if (!session.metadata) session.metadata = {};
  session.metadata.mode = updates.mode;
}
```

There is **no generic `updates.metadata` merge**. Consequence: `worktreePath`/`worktreeBranch` survive only until the session is evicted from cache or the server restarts. After that, **resume falls back to `project.workingDir`** (`:1789`) — the session silently runs in the main repo instead of its worktree, and cleanup can't find the worktree to remove it (leak). The env vars *do* survive, so `MAESTRO_WORKTREE_PATH` and `session.metadata.worktreePath` can disagree.

**Fix (prerequisite for everything else):**
1. `FileSystemSessionRepository.update()` — add generic merge:
   ```ts
   if (updates.metadata !== undefined) {
     session.metadata = { ...session.metadata, ...updates.metadata };
   }
   ```
2. Spawn — persist via the update call instead of mutating in place:
   ```ts
   await sessionService.updateSession(session.id, {
     env: { ...session.env, MAESTRO_WORKTREE_PATH: ..., MAESTRO_WORKTREE_BRANCH: ..., MAESTRO_PROJECT_DIR: ... },
     metadata: { ...session.metadata, worktreePath: ..., worktreeBranch: ... },
   });
   ```
   `updateSessionSchema` already allows `metadata` (`validation.ts:308`), so no validation change needed.

---

## 3. Recommended architecture

Keep the clean-architecture layering the server already uses. Generalize the narrow `GitWorktreeService` into a broader git capability, but keep the worktree logic intact.

```
GitService (application/services)            ← new, or rename/extend GitWorktreeService
  ├─ repo:     isGitRepo, currentBranch, listBranches, defaultBranch, remoteUrl
  ├─ worktree: createWorktree, removeWorktree, worktreeExists, listWorktrees
  ├─ diff:     statusSummary(cwd), diffStat(base..head), fullDiff(file?), changedFiles
  ├─ commit:   log(base..head), commitCount
  ├─ branch:   createBranch, checkout, mergeBranch(base, source)
  └─ pr:       hasGh(), push(branch), createPR(title, body, base) → {url, number}
```

Design points:
- **All git calls use `execFile('git', [...args])`** (already the pattern) — never string-interpolate into a shell. PR creation shells to `gh`; guard with a `hasGh()` capability check and return a clear error if missing.
- **Base for diff/log** = the commit the worktree branched from. Record it at creation time: capture `git rev-parse HEAD` of the project before `worktree add`, store as `session.metadata.worktreeBaseCommit`. Diffing `baseCommit..HEAD` (plus uncommitted via `git status --porcelain`) is far more reliable than guessing `HEAD~1` or `@{upstream}` (the old plan's draft used fragile bases).
- **Surface via REST** under the session it belongs to, mirroring the existing route style:
  - `GET  /sessions/:id/git`            → `{ hasWorktree, branch, base, ahead, dirty, diffStat }`
  - `GET  /sessions/:id/git/diff?file=` → full unified diff (committed + uncommitted)
  - `POST /sessions/:id/git/pr`         → `{ title, body, base? }` → `{ prUrl, prNumber }`
  - `POST /sessions/:id/git/merge`      → `{ targetBranch? }` → `{ success, message }`
  - `DELETE /sessions/:id/git/worktree` → discard worktree + branch
- **WebSocket**: emit a `session:git_changed` event after merge/PR/discard so the UI panel refreshes without polling (reuse the existing bridge).
- **Concurrency guard**: only expose merge/discard/PR actions when `session.status ∈ {completed, stopped, failed}`. Running sessions must not have their worktree mutated underneath them.

UI:
- `MaestroClient` gets matching methods (`getGitStatus`, `getGitDiff`, `createPR`, `mergeWorktree`, `discardWorktree`).
- New `WorktreeManagementPanel` component: diff summary header (`N files, +x −y, k commits`), changed-file list, expandable diff viewer, and action buttons (Create PR / Merge / Keep / Discard). Render it inline in `SessionInTaskView` and from `SessionDetailModal` for completed worktree sessions.
- Add the missing **visibility**: a 🌿 branch badge wherever sessions render (`SessionInTaskView`, `SessionDetailModal`, `TeamSessionGroup`) reading `session.metadata.worktreeBranch`.
- Add the **CreateTaskModal toggle** so worktree isolation can be chosen at task creation (wire `useWorktree` through `useTaskForm` → `DetailsTab`).

Optional CLI parity (`maestro git ...`) so agents inside a session can self-report diff/PR — thin wrappers over the same endpoints. Lower priority than UI.

---

## 4. Phased roadmap

**Phase 0 — Fix persistence (blocker, ~30 min).** Generic `metadata` merge in repo `update()`; persist worktree metadata + `worktreeBaseCommit` at spawn. Without this, every later phase reads stale/missing data.

**Phase 1 — Visibility & creation toggle (~1–2 h).** Branch/path badges in session views; `useWorktree` toggle in CreateTaskModal. Pure UI, no new git logic. Immediate user value, low risk.

**Phase 2 — Diff (read-only) (~half day).** `GitService` diff/status/log methods; `GET /git` + `/git/diff` endpoints; `WorktreeManagementPanel` showing summary + viewer. Read-only, so safe to ship.

**Phase 3 — Branch + Merge + Discard (~half day).** Merge endpoint with conflict reporting; discard wired to `removeWorktree`; status guards. Mutating — gate behind confirmation dialogs.

**Phase 4 — PRs (~half day).** `gh`-based push + PR create; `hasGh()` capability check + graceful error; PR sub-form in the panel; store `prUrl` on session metadata and show a link.

**Phase 5 (optional) — CLI parity + hygiene.** `maestro git {status,diff,pr}`; worktree disk-usage / stale-worktree cleanup reminder.

---

## 5. Risks & decisions to confirm

- **`gh` dependency** for PRs — acceptable to require it, or implement a provider-token fallback later? (Recommend: require `gh`, detect + clear error.)
- **Default merge target** — `main`? Detect repo default branch (`git symbolic-ref refs/remotes/origin/HEAD`) rather than hardcoding.
- **Worktree disk growth** — large repos × many sessions. Recommend auto-cleanup of worktrees for archived sessions older than N days.
- **Non-git projects** — toggle/badges must degrade gracefully (already validated at spawn with a clear error).
- **Naming** — keep `maestro/<sessionId>` branches, or human-readable `maestro/<task-slug>`? Slugs are friendlier in PRs but risk collisions; could combine: `maestro/<slug>-<short-id>`.
