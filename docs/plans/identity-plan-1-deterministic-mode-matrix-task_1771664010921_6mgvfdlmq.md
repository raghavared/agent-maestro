# Plan 1: Deterministic Mode Matrix (Clean, Fast, Explicit)

## Intent

Make identity and team-member prompt behavior deterministic by mode, with zero ambiguity.

This plan directly matches your requested behavior:
- Worker modes get full team expertise context.
- Coordinator modes get separated coordinator identity + slim team roster.
- Coordinator self-identity is single-owner (exactly one coordinator persona).

---

## Target Prompt Contract

Use distinct XML blocks (no overload of one tag for multiple meanings):

```xml
<agent_identity>...</agent_identity>
<self_identity>...</self_identity>
<team_roster>...</team_roster>
<team_expertise>...</team_expertise>
<coordination_context>...</coordination_context>
```

### Block semantics
- `<agent_identity>`: base role identity (`worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator`).
- `<self_identity>`: this session's team-member persona (if assigned).
- `<team_roster>`: slim list for delegation/discovery (`id`, `name`, `role` only).
- `<team_expertise>`: full context per member (`identity`, `memory`, model/tool/capabilities/permission mode).
- `<coordination_context>`: parent coordinator linkage for coordinated modes (`coordinator_session_id`, directive summary).

---

## Four-Mode Matrix

| Mode | agent identity | self identity | team roster | team expertise | parent context |
|---|---|---|---|---|---|
| `worker` | worker | optional (single or merged) | optional slim | full (all available members) | no |
| `coordinator` | coordinator | required, exactly 1 | slim (all team members except self) | no | no |
| `coordinated-worker` | coordinated-worker | optional (single or merged) | optional slim | full (all available members) | yes |
| `coordinated-coordinator` | coordinated-coordinator | required, exactly 1 | slim (all team members except self) | no | yes |

---

## Validation Rules

1. `coordinator` and `coordinated-coordinator` must resolve to exactly one self coordinator persona.
2. `worker` and `coordinated-worker` may have 0..N self profiles.
3. `availableTeamMembers` are always deduped by `id`.
4. Self IDs are removed from team lists unless explicitly included via override flag.
5. Coordinated modes require `coordinatorSessionId`; if missing, hard warning + fallback behavior.

---

## Data Handling Rules

### Self identity resolution
- Primary source: `teamMemberProfiles`.
- Legacy fallback: `teamMemberId/name/role/avatar/identity/memory`.
- Worker modes: if multiple profiles, merged into one `<self_identity>` with `expertise` subentries.
- Coordinator modes: if multiple profiles provided, validation error (or explicit strict fallback to first profile, configurable).

### Team expertise rendering (worker modes only)
Each member entry includes:
- `id`, `name`, `role`, `identity`
- `memory[]`
- `mode`, `permission_mode`, `model`, `agent_tool`
- `capabilities` and `command_permissions` snapshots

### Team roster rendering (coordinator modes only)
Each member entry includes only:
- `id`, `name`, `role`

---

## Implementation Scope

### Refactor targets
- `maestro-cli/src/services/prompt-builder.ts`
  - split `buildTeamMemberIdentity()` into:
    - `buildSelfIdentityBlock()`
    - `buildTeamRosterBlock()`
    - `buildTeamExpertiseBlock()`
    - `buildCoordinationContextBlock()`
- `maestro-cli/src/types/manifest.ts`
  - add normalized helper for "single coordinator self identity required"
- `maestro-cli/src/schemas/manifest-schema.ts`
  - add optional strict validation fields if needed (phase 2)
- `maestro-cli/tests/prompting/*.test.ts`
  - snapshot tests for all four modes and multi-profile/multi-member cases

---

## Rollout Plan

1. Introduce new XML blocks behind `IDENTITY_PROMPT_V2=true`.
2. Keep old `<available_team_members>` compatibility during transition.
3. Add full snapshot coverage for 4 modes x 3 scenarios:
   - no self identity
   - single self identity
   - multi self profiles + multi team members
4. Flip default to V2 after test stabilization.
5. Remove legacy ambiguous block names.

---

## Why pick Plan 1

- Most explicit and easiest to reason about.
- Minimal policy complexity.
- Fastest path to production-safe behavior aligned with your request.

