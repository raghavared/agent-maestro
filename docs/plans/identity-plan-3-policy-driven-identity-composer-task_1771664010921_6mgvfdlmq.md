# Plan 3: Policy-Driven Identity Composer (Maximum Control)

## Intent

Provide full control via policy configuration, while shipping a strong default policy that matches your desired behavior.

This is the most powerful approach.

---

## Policy Schema

Add an internal/default policy map (optionally manifest-overridable later):

```ts
type TeamContextLevel = 'none' | 'slim' | 'full';

interface IdentityPromptPolicy {
  requireSingleSelfIdentity: boolean;
  allowSelfIdentityMerge: boolean;
  teamContextLevel: TeamContextLevel;
  includeCoordinationContext: boolean;
  includeSelfInTeamContext: boolean;
}
```

### Default policy by mode

| Mode | require single self | self merge | team context | include parent context |
|---|---|---|---|---|
| `worker` | false | true | `full` | false |
| `coordinator` | true | false | `slim` | false |
| `coordinated-worker` | false | true | `full` | true |
| `coordinated-coordinator` | true | false | `slim` | true |

---

## Prompt Blocks

```xml
<agent_identity>...</agent_identity>
<self_identity>...</self_identity>
<team_context level="full|slim|none">...</team_context>
<coordination_context>...</coordination_context>
<identity_policy_trace>...</identity_policy_trace> <!-- optional debug only -->
```

`identity_policy_trace` is debug-only (for `debug-prompt`) to explain why each block appeared.

---

## Cardinality and Conflict Rules

1. If `requireSingleSelfIdentity=true` and multiple self profiles exist:
   - strict mode: fail manifest validation
   - permissive mode: choose deterministic primary + emit warning
2. If `teamContextLevel=full`, include complete member context.
3. If `teamContextLevel=slim`, include only `id`, `name`, `role`.
4. If `includeCoordinationContext=true`, require `coordinatorSessionId` and attach directive summary when present.

---

## Why this plan is "full power + full control"

1. Behavior is not scattered in `if mode` branches across the codebase.
2. One policy table controls all mode behavior.
3. Easy to add special team types later without refactoring the core prompt builder.
4. Easier to expose controlled user overrides in future UI/server settings.

---

## Implementation Blueprint

### New components
- `identity-policy.ts`
  - exports policy table and resolver.
- `identity-context-normalizer.ts`
  - resolves self profiles, team members, dedupe, self filtering.
- `identity-context-renderer.ts`
  - renders XML blocks based on resolved policy + normalized context.

### Existing code touchpoints
- `maestro-cli/src/services/prompt-builder.ts`
  - delegate identity/team rendering to new modules.
- `maestro-cli/src/types/manifest.ts`
  - optional future policy override type.
- `maestro-cli/src/schemas/manifest-schema.ts`
  - optional policy override validation.
- tests:
  - policy unit tests
  - renderer snapshot tests
  - full prompt contract tests per mode.

---

## Migration Strategy

1. Phase 1: internal policy only; no manifest changes.
2. Phase 2: optional manifest policy override for advanced control.
3. Phase 3: deprecate legacy ambiguous tags and old dual-use blocks.

---

## Why pick Plan 3

- Best if you want maximum configurability and future-proofing.
- Highest upfront implementation effort, but strongest long-term control plane.

