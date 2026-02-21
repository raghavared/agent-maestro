# Plan 2: Identity Kernel + Context Lens (Balanced Flexibility)

## Intent

Separate "who the agent is" from "how much team context it sees."

This plan gives cleaner architecture than hardcoding everything, while still mapping to your mode requirements.

---

## Core Model

### Identity Kernel
Always emitted:

```xml
<identity_kernel>
  <mode_identity>...</mode_identity>
  <self_identity>...</self_identity>
</identity_kernel>
```

### Context Lens
Mode picks one lens:
- `full_expertise`
- `slim_roster`

```xml
<team_context lens="full_expertise|slim_roster">...</team_context>
```

### Coordination Link
Coordinated modes add:

```xml
<coordination_context>...</coordination_context>
```

---

## Four-Mode Matrix

| Mode | Identity Kernel | Team Context Lens | Notes |
|---|---|---|---|
| `worker` | worker + optional self identity | `full_expertise` | direct access to full team context |
| `coordinator` | coordinator + required single self identity | `slim_roster` | delegation-oriented, no verbose member descriptions |
| `coordinated-worker` | coordinated-worker + optional self identity | `full_expertise` | worker under parent, still full member context |
| `coordinated-coordinator` | coordinated-coordinator + required single self identity | `slim_roster` | sub-coordinator behavior, hierarchical |

---

## Multi-Profile / Multi-Member Handling

### Self identity
- Coordinator modes: exactly one self profile.
- Worker modes: one or more self profiles; if multiple, emit merged self identity with explicit expertise attribution.

### Team members
- Team members are normalized once (dedupe, self filtering, field normalization).
- `full_expertise` lens renders complete detail.
- `slim_roster` lens renders only `id`, `name`, `role`.

---

## Benefits vs Plan 1

1. Cleaner conceptual boundary:
   - identity concerns vs context detail concerns.
2. Easier future extension:
   - add lens types (for example `focused_expertise`) without changing identity architecture.
3. Better testability:
   - test kernel and lens independently.

---

## Risks

1. Slightly more abstraction than Plan 1.
2. Requires disciplined naming and block ownership to avoid regressions.

---

## Implementation Steps

1. Add a new internal resolver in prompt builder:
   - `resolveIdentityKernel()`
   - `resolveTeamContextLensForMode(mode)`
2. Implement renderers:
   - `renderIdentityKernel()`
   - `renderTeamContext(lens)`
   - `renderCoordinationContext()`
3. Add strict mode rules:
   - coordinator self-profile cardinality enforcement.
4. Snapshot tests:
   - kernel-only assertions
   - lens-specific assertions per mode
5. Migration shim:
   - map old `<available_team_members>` to new blocks for one release window.

---

## Why pick Plan 2

- Best long-term maintainability with moderate complexity.
- Meets your requested behavior while keeping a clean extensible architecture.

