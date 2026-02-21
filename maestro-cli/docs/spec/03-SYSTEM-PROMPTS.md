# System Prompt Contract

## Status

As of February 21, 2026, Maestro supports two identity contracts:

- `MAESTRO_PROMPT_IDENTITY_V2=true`: Identity Kernel + Context Lens (Plan 2, current target contract)
- `MAESTRO_PROMPT_IDENTITY_V2` unset/false: legacy identity rendering (compatibility mode)

## V2 System Prompt Structure

```xml
<maestro_system_prompt mode="worker|coordinator|coordinated-worker|coordinated-coordinator" version="3.0">
  <identity_kernel>
    <mode_identity>
      <profile>...</profile>
      <instruction>...</instruction>
    </mode_identity>
    <self_identity>...</self_identity>
  </identity_kernel>

  <team_context lens="full_expertise|slim_roster">...</team_context>
  <coordination_context>...</coordination_context> <!-- coordinated modes only -->

  <capability_summary>...</capability_summary>
  <commands_reference>...</commands_reference>
</maestro_system_prompt>
```

## V2 Task Prompt Structure

```xml
<maestro_task_prompt mode="..." version="3.0">
  <tasks>...</tasks>
  <task_tree>...</task_tree> <!-- optional -->
  <context>...</context> <!-- optional -->
  <skills>...</skills> <!-- optional -->
  <session_context>
    <session_id>...</session_id>
    <project_id>...</project_id>
    <mode>...</mode>
  </session_context>
  <reference_tasks>...</reference_tasks> <!-- optional -->
</maestro_task_prompt>
```

`<session_context>` intentionally excludes coordinator linkage in V2. Parent linkage is represented only in `<coordination_context>`.

## Mode Matrix

| Mode | Self Identity | Team Lens | Coordination Context |
|---|---|---|---|
| `worker` | optional (0..N profiles merged when N>1) | `full_expertise` | no |
| `coordinator` | required, exactly 1 profile (strict policy) | `slim_roster` | no |
| `coordinated-worker` | optional (0..N profiles merged when N>1) | `full_expertise` | yes |
| `coordinated-coordinator` | required, exactly 1 profile (strict policy) | `slim_roster` | yes |

## Normalization Rules

- Legacy mode aliases (`execute`, `coordinate`) normalize to canonical four-mode values.
- `teamMemberProfiles` are preferred for self identity resolution.
- Legacy single self fields (`teamMemberId`, `teamMemberName`, etc.) are normalized into one profile when needed.
- `availableTeamMembers` are deduped deterministically by `id`.
- Self members are filtered from `availableTeamMembers` by default.
- Coordinator single-self policy:
  - strict (default for V2): invalid cardinality is an error
  - permissive: deterministic-first profile with warning

## Legacy Notes (Stale Sections)

Older references to `<identity>`, `<available_team_members>`, and template-only orchestrator/worker role split are legacy compatibility paths. Keep them only for migration context; do not use them as the authoritative contract for new work.

Next: [04-STANDARD-SKILLS.md](./04-STANDARD-SKILLS.md)
