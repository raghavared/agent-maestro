# Cross-Project Access (Foundational)

## Summary

Today, sessions are effectively single-tenant: a worker sees only entities in its own project, and crossing the boundary requires a master session hitting `/api/master/*` routes. We want any session to be able to **list, fetch, spawn against, and message** entities (sessions, tasks, team members) in any project, while keeping the **default scope** tight to the current project so a worker's context isn't flooded.

The selector pattern is a single `--projectId` flag on every list/get command:

- **No flag** → current project (from `MAESTRO_PROJECT_ID` env / `config.projectId`). Today's behavior.
- **`--projectId <id>`** → that project. New.
- **`--all-projects`** → no project filter. New, sparingly used.

This is the foundation. With it in place, follow-up work — cross-project spawn flows, cross-project recruiting, master-session deprecation — becomes mostly UX, not infrastructure.

## Why

The "any session can be coordinator" change (see [any-session-can-coordinate.md](./any-session-can-coordinate.md)) removed mode guard rails. But it stopped at the project boundary: a worker can spawn a peer in *its own project*, but still can't see or talk to sessions in another project without master powers. Real coordination across projects (e.g., a session in `agent-maestro` spawning a helper in `agent-maestro-website` to check a doc) is blocked.

The two anti-patterns we want to avoid:

1. **Context overload by default.** If a worker calls `maestro session list` and gets every session across every project, prompts and pickers become unusable.
2. **Two parallel API surfaces.** The current `/api/sessions` vs `/api/master/sessions` split means every consumer (UI, CLI, agents) has to know which to call. One surface with an explicit selector is simpler.

## Current state (from research)

| Entity | CLI default scope | `--projectId` accepted? | Server: required? |
|---|---|---|---|
| `session:list` | `globalOpts.project \|\| config.projectId` | No (global `--project` only) | **Optional** query param |
| `session:info` | none (by id) | n/a | n/a |
| `task:list` | `globalOpts.project \|\| config.projectId`, `--all` bypasses | No (global only) | **Optional** query param |
| `task:get` | none (by id) | n/a | n/a |
| `team-member:list` | required: opt or env | No (global only) | **REQUIRED** (400 if missing) |
| `team-member:get` | required: opt or env | No (global only) | **REQUIRED** (400 if missing) |
| `spell:list` | optional | No (global only) | n/a |
| `project:list` | n/a | n/a | n/a |

Storage is already global: `FileSystemSessionRepository`, `FileSystemTaskRepository` keep entities in flat dirs with `projectId` as a field. `FileSystemTeamMemberRepository` partitions by `projectId/` with a `__global__` bucket. **No disk-level project isolation exists** — the gate is purely API-layer.

Master-session capability today: `Session.isMasterSession` is set at spawn time from `Project.isMaster`, and `createMasterAuthMiddleware` (`maestro-server/src/api/masterRoutes.ts:15`) gates `/api/master/*` routes. That mechanism stays — this change widens the regular routes; it does not remove the master surface.

## Design

### 1. CLI flag pattern

Add a uniform `--projectId <id>` option to every list/get command, plus `--all-projects` for the rare cross-project case:

| Command | Resolution |
|---|---|
| `session:list [--projectId X] [--all-projects]` | flag > global `--project` > env > current; `--all-projects` overrides all |
| `task:list [--projectId X] [--all-projects]` | same. Deprecate `--all` (alias to `--all-projects` for one release) |
| `team-member:list [--projectId X] [--all-projects]` | same |
| `spell:list [--projectId X] [--all-projects]` | same |
| `project:list` | unchanged (already global) |

`*:get` / `*:info` commands take an id and stay project-agnostic — IDs are globally unique. The current `team-member:get` requirement of `--project` becomes vestigial and is dropped.

**Resolution helper** in `maestro-cli/src/utils/project-scope.ts` (new):

```ts
export interface ProjectScope {
  projectId?: string;   // undefined ⇒ all projects
  source: 'flag' | 'global' | 'env' | 'config' | 'all-projects';
}

export function resolveProjectScope(cmdOpts: {
  projectId?: string;
  allProjects?: boolean;
}, globalOpts: { project?: string }): ProjectScope {
  if (cmdOpts.allProjects) return { source: 'all-projects' };
  if (cmdOpts.projectId)   return { projectId: cmdOpts.projectId, source: 'flag' };
  if (globalOpts.project)  return { projectId: globalOpts.project, source: 'global' };
  if (process.env.MAESTRO_PROJECT_ID) return { projectId: process.env.MAESTRO_PROJECT_ID, source: 'env' };
  if (config.projectId)    return { projectId: config.projectId, source: 'config' };
  return { source: 'all-projects' };  // logged as "no scope resolved"
}
```

### 2. Server changes

- **`/api/team-members` GET (list)** and **`/api/team-members/:id` GET**: drop the 400 when `projectId` is missing. Behave like sessions/tasks — optional filter.
- **`/api/sessions`, `/api/tasks`**: already optional. No change.
- Master routes `/api/master/*`: **untouched**. They remain a convenience layer; isMaster gating stays. Internal consumers (UI master views, master commands in CLI) keep working.

Permission-wise, this is a strict widening: regular routes already return whatever entities you query; we're just removing a 400 on missing scope.

### 3. Prompt impact

Following the precedent set by `any-session-can-coordinate`:

- **Do not add a `canAccessOtherProjects` capability flag** to the worker prompt. Keeps the capability summary focused.
- Document `--projectId` / `--all-projects` in the command help text (visible via `maestro <cmd> --help`), so it's discoverable when an agent goes looking.
- Coordinator-mode prompts may mention the flag in the spawn/coordination section since coordinators routinely need it.

### 4. Backward compatibility

| Existing usage | New behavior |
|---|---|
| `maestro session list` (no flags) | Same — current project |
| `maestro -p X session list` | Same — project X |
| `maestro task list --all` | Now aliases `--all-projects`; deprecation warning for one release |
| `maestro team-member list` with no project | **Newly works** (was 400 error). Lists all team members |
| `maestro session list --projectId X` | **New** — project X, overrides env/global |

### 5. Out of scope (deliberately)

- **Removing `isMaster` / `/api/master/*` routes.** Separate task, depends on UI migration.
- **Cross-project session spawn semantics.** Spawn already accepts `projectId` in its body; no change needed here. Whether a worker *should* spawn into a foreign project is a UX choice, not gated by this change.
- **Pagination / large list handling.** `--all-projects` should not be the default and is for explicit use; if list sizes become a problem, that's a separate paginated-list task.
- **Cross-project permission model.** Today there are no per-entity ACLs; this task does not introduce one. If the workspace adds multi-user tenancy later, that's where ACLs land.

## File-level change estimate

**CLI** (`maestro-cli/`):
- `src/utils/project-scope.ts` — new, ~40 LOC
- `src/commands/session.ts`, `task.ts`, `team-member.ts`, `spell.ts` — wire `--projectId` / `--all-projects` options; replace inline `globalOpts.project || config.projectId` with `resolveProjectScope(...)`. ~5 LOC each.
- `src/index.ts` — no change (global `--project` stays).
- Tests: extend existing command tests to cover `--projectId` precedence and `--all-projects`.

**Server** (`maestro-server/`):
- `src/api/teamMemberRoutes.ts` — make `projectId` optional on list + get. ~10 LOC removed (400-throwing blocks).
- Tests: add list-without-projectId and list-with-different-projectId cases.

**Docs**:
- This file.
- README / cli-help touch-ups.

Estimated total: ~150 LOC + tests, single PR.

## Risks

- **Accidental wide listings.** Mitigation: default stays scoped; `--all-projects` is the only way to broaden, and is explicit.
- **UI assumptions about master routes.** Not affected — `/api/master/*` stays. UI can migrate to plain routes incrementally.
- **`team-member:list` callers relying on the 400.** Low — the 400 was a UX hint, not an authorization check; relaxing it cannot break any well-formed client.

## Follow-up tasks (unblocked by this)

1. Coordinator prompts: mention `--projectId` in the spawn / coordination section.
2. UI: surface "project switcher" in session and team-member lists; migrate master-views to plain routes with `--all-projects` equivalent.
3. Eventual deprecation of `/api/master/*` once UI no longer depends on it.
4. Cross-project session-prompt UX (already permitted server-side after the `any-session-can-coordinate` change, but no UI for it yet).
