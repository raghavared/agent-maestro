# Teams and Team Members

## Problem
Single-agent execution does not scale well for complex work. Teams need reusable agent roles, clear ownership, and a way to coordinate many sessions without losing context.

## Solution
Maestro separates people-like agent identities (**team members**) from organizational structure (**teams**):
- Team members define how an agent behaves (role, mode, model/tool, permissions, memory).
- Teams group members under a leader so coordination sessions can delegate work predictably.

This gives you a stable staffing model for both day-to-day execution and multi-session orchestration.

## Team Members

### Default members (built in)
Each project starts with default members you can use immediately:
- `Simple Worker` (`execute`)
- `Coordinator` (`coordinate`)
- `Batch Coordinator` (`coordinate`)
- `DAG Coordinator` (`coordinate`)
- `Recruiter` (`execute`)

Defaults are always available and active. You can customize them, and reset them later if needed.

### Custom members
Create custom specialists for recurring work patterns (for example: API owner, test engineer, release coordinator):
- Set `name`, `role`, `avatar`, and `mode` (`execute` or `coordinate`).
- Optionally set `model`, `agent-tool`, `permission-mode`, `skills`, and workflow template.
- Use member-specific identity instructions to shape behavior.

### Roles, capabilities, and permissions
Team members support both high-level and low-level controls:
- `role` and `identity`: what the agent is responsible for and how it should reason/act.
- `capabilities`: what the member is allowed to do (spawn sessions, edit tasks, report levels).
- `commandPermissions`: fine-grained command allow/deny controls by group or command.

These controls let you run powerful agents with narrower operational boundaries.

### Persistent memory
Team members include a persistent memory list for project-specific heuristics and preferences:
- `maestro team-member memory append <id> --entry "..."`
- `maestro team-member memory list <id>`
- `maestro team-member memory clear <id>`

Use this for durable, role-specific instructions that should survive across sessions.

### Lifecycle
- Active by default.
- Custom members can be archived/unarchived.
- Deletion requires archive first.
- Default members cannot be archived or deleted; use `edit` to customize and `reset` to restore defaults.

## Teams

### What a team adds
A team defines collaborative structure:
- `leaderId`: usually a coordinator-type member.
- `memberIds`: who can execute within that team.
- Optional `subTeamIds`: hierarchy for larger org structures.

### Lifecycle and rules
- Active by default; archive before delete.
- Leader must be one of the team members.
- You cannot remove the current leader from membership until leader is changed.
- Teams can be nested (sub-teams), with circular-reference checks for safety.

### Core commands
- `maestro team create "<name>" --leader <tmId> --members <tmA,tmB,...>`
- `maestro team add-member <teamId> <tmId...>`
- `maestro team remove-member <teamId> <tmId...>`
- `maestro team add-sub-team <teamId> <subTeamId>`
- `maestro team tree <teamId>`

## How Teams Support Execution and Coordination
- Assign coordinator members as team leaders to drive decomposition and worker spawning.
- Spawn workers with `--team-member-id` so sessions inherit role defaults (mode/model/tool/permissions) from the selected member.
- Track member snapshots on sessions for clear attribution in UI and logs.
- Reuse the same team structure across many tasks instead of re-defining instructions per session.

## Practical User Value
- Faster setup: reusable, preconfigured agent identities.
- Safer execution: capabilities and command permissions enforce boundaries.
- Better coordination: clear leader/member topology for multi-agent workflows.
- Higher consistency: memory + role templates reduce prompt drift across sessions.
- Cleaner lifecycle: archive/unarchive/reset patterns keep team configs maintainable over time.
