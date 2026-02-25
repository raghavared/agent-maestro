# Root Implementation Plan: Plan 2 (Identity Kernel + Context Lens)

Task ID: `task_1771667843998_nkngn2ppg`
Project ID: `proj_1770533548982_3bgizuthk`
Scope: Identity, expertise, and team-member prompt architecture only (commands/capabilities out of scope for now).

---

## Objective

Implement a clean prompt architecture for all four modes where:

1. Worker modes receive full team expertise context.
2. Coordinator modes receive slim team roster only.
3. Coordinator self identity is explicitly separated and singular.
4. Coordinated modes include parent coordination context cleanly.
5. XML semantics are unambiguous (no overloading one block name for unrelated concepts).

---

## Plan 2 Architecture

### A. Identity Kernel (always role-first)

```xml
<identity_kernel>
  <mode_identity>
    <profile>...</profile>
    <instruction>...</instruction>
  </mode_identity>
  <self_identity>...</self_identity>
</identity_kernel>
```

### B. Team Context Lens (mode-selected)

```xml
<team_context lens="full_expertise|slim_roster">
  ...
</team_context>
```

### C. Coordination Context (coordinated modes)

```xml
<coordination_context>
  <coordinator_session_id>...</coordinator_session_id>
  <directive>...</directive>
</coordination_context>
```

---

## Four-Mode Prompt Matrix

| Mode | Self Identity | Team Context Lens | Coordination Context |
|---|---|---|---|
| `worker` | optional (single/merged) | `full_expertise` | none |
| `coordinator` | required (exactly 1) | `slim_roster` | none |
| `coordinated-worker` | optional (single/merged) | `full_expertise` | required |
| `coordinated-coordinator` | required (exactly 1) | `slim_roster` | required |

---

## Detailed Behavior Rules

### 1) Self Identity Rules

- Source priority:
1. `teamMemberProfiles`
2. legacy single fields (`teamMemberId`, `teamMemberName`, etc.)

- Worker modes:
  - allow multiple self profiles
  - merge into one self identity block with per-profile expertise attribution

- Coordinator modes:
  - must resolve exactly one self profile
  - if >1 self profiles exist: fail in strict mode (default), or deterministic-first with explicit warning in permissive mode

### 2) Team Context Rules

- `full_expertise` (worker modes):
  - include all available members (excluding self unless explicit override)
  - include full details:
    - `id`, `name`, `role`, `identity`, `memory`
    - `mode`, `permission_mode`, `model`, `agent_tool`
    - `capabilities`, `command_permissions` (if present)

- `slim_roster` (coordinator modes):
  - include all available members (excluding self)
  - only:
    - `id`, `name`, `role`

### 3) Coordinated Rules

- Coordinated modes must carry:
  - `coordinatorSessionId`
  - directive (when provided)

- These are rendered under a dedicated `coordination_context` block.

---

## File-Level Implementation Plan

### Phase 1: Prompt Contract Foundation

Files:
- `maestro-cli/src/services/prompt-builder.ts`
- `maestro-cli/src/prompts/identity.ts` (only if wording updates needed)

Actions:
- Add new render path with explicit blocks:
  - `buildIdentityKernel()`
  - `buildSelfIdentity()`
  - `buildTeamContext()`
  - `buildCoordinationContext()`
- Keep existing path behind temporary compatibility shim.

### Phase 2: Normalization + Validation

Files:
- `maestro-cli/src/prompting/manifest-normalizer.ts`
- `maestro-cli/src/types/manifest.ts`

Actions:
- Add resolver for self identity cardinality.
- Enforce coordinator single-self rule.
- Add deterministic dedupe and self-filter rules for team members.

### Phase 3: Team Lens Renderer

Files:
- `maestro-cli/src/services/prompt-builder.ts` (or extracted helper module)

Actions:
- Implement lens mapping:
  - worker/coordinated-worker -> `full_expertise`
  - coordinator/coordinated-coordinator -> `slim_roster`
- Ensure renderer output is mode-deterministic and stable.

### Phase 4: Coordinated Context Integration

Files:
- `maestro-cli/src/services/prompt-builder.ts`
- `maestro-cli/src/prompting/prompt-composer.ts`

Actions:
- Add dedicated `coordination_context`.
- Keep task prompt `<session_context>` clean and single-source.
- Prevent duplicate parent-context fields.

### Phase 5: Compatibility + Migration

Files:
- `maestro-cli/src/services/prompt-builder.ts`
- `maestro-cli/src/index.ts` (`debug-prompt` visibility)

Actions:
- Add temporary compatibility flag:
  - `MAESTRO_PROMPT_IDENTITY_V2=true`
- Provide fallback old rendering while tests migrate.

### Phase 6: Testing

Files:
- `maestro-cli/tests/prompting/prompt-composer.test.ts`
- add new snapshots/fixtures under `maestro-cli/tests/fixtures/manifests/`

Required test matrix:
- 4 modes x:
  - no self profile
  - single self profile
  - multi self profiles
  - multi available members with self overlap
  - coordinated with and without directive

Assertions:
- correct lens per mode
- single coordinator self cardinality enforcement
- no ambiguous duplicate semantic blocks
- deterministic output ordering

### Phase 7: Documentation and Contract Update

Files:
- `docs/PROMPT_FLOWS_REFERENCE.md`
- `docs/PROMPT_GENERATION_DEEP_DIVE.md`
- `maestro-cli/docs/spec/03-SYSTEM-PROMPTS.md` (mark stale sections clearly)

Actions:
- document new blocks and mode matrix.
- remove stale references to old overloaded tags.

---

## Engineering Instructions (Execution Rules)

1. Do not mix command/capability redesign into this task.
2. Preserve backward compatibility until full test matrix is green.
3. Make rendering deterministic:
   - stable ordering by input order (or explicit sort by `id`).
4. Keep strict coordinator single-self policy by default.
5. Add warnings only when in permissive fallback paths.
6. Use `debug-prompt` outputs as golden validation artifact before merge.

---

## Acceptance Criteria

1. Four-mode matrix behavior matches exactly.
2. Worker modes receive full team expertise context.
3. Coordinator modes receive slim roster only.
4. Coordinator self identity is explicit and singular.
5. Coordinated modes include dedicated coordination context.
6. Prompt XML no longer overloads one block name for multiple meanings.
7. Snapshot tests pass for all matrix scenarios.
8. Docs updated to reflect the new contract.

---

## Suggested Delivery Sequence

1. Contract + renderers
2. Normalization/validation
3. Tests
4. Migration flag + debug verification
5. Docs refresh
6. Flip default and remove legacy path in a follow-up cleanup task

