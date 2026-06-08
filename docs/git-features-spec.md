# Maestro Git/GitHub Integration — Feature Spec (for approval)

Goal: make git a first-class, inbuilt part of Maestro — worktrees, diffs, branches, merges, and GitHub PRs — with good UI/UX. Each session that works on a task can run in an isolated worktree, and the user manages the resulting changes (review → merge or open a PR) directly inside Maestro.

Legend: **What** = what it does · **Use** = how a user uses it · **Surface** = where it lives in the app.

---

## Group A — Foundation (must ship first)

### A1. Worktree metadata persistence + base-commit tracking  *(bug fix)*
- **What:** Persist `worktreePath`, `worktreeBranch`, and the `worktreeBaseCommit` (the commit the worktree branched from) to disk on the session. Today they're only set in memory at spawn and lost on cache-evict/restart, which silently drops resumed sessions back into the main repo and leaks worktrees.
- **Use:** Invisible to the user — but it's the prerequisite that makes every diff/merge/PR feature reliable.
- **Surface:** `FileSystemSessionRepository.update()` (generic metadata merge), spawn endpoint, capture base commit at `createWorktree()`.

---

## Group B — Worktree lifecycle

### B1. Worktree isolation toggle at task/session creation
- **What:** Choose "run this in an isolated git worktree" when creating a task or launching a session, not just as a post-hoc toggle.
- **Use:** In the Create Task modal (Details tab) flip **Isolation → 🌿 worktree**. When the session spawns it gets its own branch + working dir; the main repo is never touched.
- **Surface:** `CreateTaskModal` / `DetailsTab` + `useTaskForm`; already-wired spawn path consumes the flag.

### B2. Worktree visibility (branch badges)
- **What:** Every place a session is shown displays its branch (🌿 `maestro/…`) and, on hover, the worktree path + base.
- **Use:** Glance at a session anywhere (task view, session list, team group, detail modal) and instantly see which branch/worktree it's on.
- **Surface:** `SessionInTaskView`, `SessionListItem`, `TeamSessionGroup`, `SessionDetailModal`, `SessionDetailsSection`.

### B3. Discard / keep worktree
- **What:** Remove the worktree + branch (discard), or keep it for later. Guarded so it's only available when the session is finished.
- **Use:** In the session's **Git panel**, click **Discard** (confirm dialog) to throw away changes, or **Keep** to leave the branch in place.
- **Surface:** Git panel in `SessionDetailModal`; `DELETE /sessions/:id/git/worktree`.

---

## Group C — Diff & changes

### C1. Changes summary
- **What:** A compact summary of what the session changed: `N files changed, +X −Y, k commits`, plus a per-file list with M/A/D status and per-file +/− counts (committed **and** uncommitted, relative to the base commit).
- **Use:** Open a worktree session → **Git panel** shows the summary at the top and a scrollable file list.
- **Surface:** Git panel header + file list; `GET /sessions/:id/git`.

### C2. Full diff viewer
- **What:** Syntax-aware unified diff. Click a file to jump to its hunk; additions/removals/headers colored.
- **Use:** In the Git panel, expand **View diff**, or click a file in the list to see just that file's diff.
- **Surface:** Diff viewer in Git panel; `GET /sessions/:id/git/diff?file=`.

---

## Group D — Branch

### D1. Branch info & status
- **What:** Show current branch, base branch, commits ahead/behind base, and whether the worktree has uncommitted (dirty) changes.
- **Use:** Read it at the top of the Git panel; the "ahead/dirty" state also drives which actions are enabled (e.g. can't merge a dirty tree).
- **Surface:** Git panel; part of `GET /sessions/:id/git` payload.

### D2. Branch rename (light)
- **What:** Rename the auto-generated `maestro/<id>` branch to something human-readable before opening a PR.
- **Use:** Click the branch name in the Git panel → edit → save.
- **Surface:** Git panel inline edit; `POST /sessions/:id/git/branch` `{ name }`.

---

## Group E — Merge

### E1. Merge worktree into base
- **What:** Merge the session's branch back into its base branch (e.g. `main` or `staging`), with conflict detection. On conflict it reports the conflicting files instead of leaving a half-merged tree.
- **Use:** In the Git panel, **Merge → <base>**; pick target branch, confirm. Success closes the worktree; conflict shows the file list and tells you to resolve manually.
- **Surface:** Git panel **Merge** button; `POST /sessions/:id/git/merge` `{ targetBranch? }`. Default target auto-detected from repo (`origin/HEAD`), not hardcoded.

---

## Group F — GitHub (PRs)

### F1. Open a Pull Request
- **What:** Push the branch and open a GitHub PR via `gh`. Title/body are pre-filled from the task title/description and the diff (AI-assisted suggestion), editable before submit. Stores `prUrl`/`prNumber` on the session.
- **Use:** Git panel → **Create PR** → review the suggested title/body, pick base branch → **Open PR**. A link appears on the session/task.
- **Surface:** PR sub-form in Git panel; `POST /sessions/:id/git/pr`. Requires `gh` (detected; clear error + install hint if missing).

### F2. PR status tracking
- **What:** Once a PR exists, show its state (open/merged/closed/draft), CI checks (pass/fail/pending), and review state (approved/changes-requested), refreshed periodically.
- **Use:** The session shows a PR chip (e.g. `#123 ✓ checks · approved`). Click to open on GitHub.
- **Surface:** PR chip on `SessionInTaskView`/`SessionDetailModal`; `GET /sessions/:id/git/pr` (polls `gh pr view --json`).

### F3. PR link surfacing
- **What:** The PR URL is surfaced on the session, the task, and in the timeline (a milestone event when the PR is opened).
- **Use:** Click the PR link from anywhere the session/task appears.
- **Surface:** Session/task badges + timeline event.

---

## Group G — Cross-cutting

### G1. Git capability detection & settings
- **What:** Detect `git` + `gh` availability and the repo's default base branch; expose a small settings surface (branch-naming scheme, default base, auto-discard-on-merge). Features degrade gracefully on non-git projects and when `gh` is absent.
- **Use:** Mostly automatic; a Git section in settings lets you tweak defaults.
- **Surface:** `GET /git/capabilities`; settings panel.

### G2. CLI parity *(optional / lower priority)*
- **What:** `maestro git {status,diff,pr,merge}` so an agent inside a session can self-report its diff or open a PR without the UI.
- **Use:** Agents/devs run `maestro git status` in a session terminal.
- **Surface:** New `maestro-cli` command group; thin wrappers over the same endpoints.

---

## Architecture (shared by all features)

- Extend the narrow `GitWorktreeService` into a `GitService` (`repo / worktree / diff / commit / branch / merge / pr`). All calls via `execFile('git'|'gh', [...args])` — never shell-interpolated.
- New REST endpoints namespaced under the owning session: `/sessions/:id/git*` (+ `/git/capabilities`). Reuse existing Zod-validated route style.
- Mutating actions (merge/discard/PR/rename) are gated on `session.status ∈ {completed, stopped, failed}`.
- A `session:git_changed` WebSocket event refreshes the Git panel after any mutation (no polling for local state; PR status polls `gh`).
- UI: `MaestroClient` methods + a single `GitPanel` component reused inline (`SessionInTaskView`) and in `SessionDetailModal`.

## Suggested build order
A1 → B1/B2 → C1/C2 → D1 → E1 → F1 → F2/F3 → D2/G1 → G2

## Open decisions (need your call)
1. **Scope:** build the full set, or start with an MVP (A→C→E, defer PRs/branch-rename/CLI)?
2. **PRs:** require `gh` CLI (recommended), or skip PR features for now?
3. **Branch naming:** keep `maestro/<sessionId>`, or human-readable `maestro/<task-slug>-<shortid>`?
4. **Worker decomposition:** one worker per feature (many parallel) vs. one worker per *group* (A–G) doing plan→implement→review→test.
