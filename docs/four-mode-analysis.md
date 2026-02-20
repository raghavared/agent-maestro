# Four-Mode Analysis: Session & Team Member Modes

## Current State

Today, Maestro has **two modes**: `execute` and `coordinate` (defined in `AgentMode` type).

The system implicitly handles "coordinated" vs "standalone" by checking for the presence of `coordinatorSessionId` in the manifest:
- **Has `coordinatorSessionId`** → agent knows to report back to a parent coordinator
- **No `coordinatorSessionId`** → agent is standalone (top-level)

This works, but the **identity instructions and workflow phases don't fully differentiate** between these scenarios. A standalone worker gets the same identity prompt as a coordinated worker — the only difference is conditional behavior baked into the workflow phases ("If `<coordinator_session_id>` is present...").

---

## The Four-Mode Proposal

The proposed four modes map to a **2×2 matrix**:

|                    | **Standalone** (no parent) | **Coordinated** (has parent coordinator) |
|--------------------|---------------------------|------------------------------------------|
| **Worker**         | `worker`                  | `coordinated-worker`                     |
| **Coordinator**    | `coordinator`             | `coordinated-coordinator`                |

### Mode Descriptions

#### 1. `worker` (Standalone Worker)
- **Who**: A session launched directly by a user (via `maestro session create` or UI)
- **Behavior**: Works on assigned tasks independently. Reports progress via `maestro task report`. No upstream coordinator to notify.
- **Identity**: "You are an autonomous agent. Work through your tasks independently."
- **Workflow**: init → execute → complete
- **Communication**: Can still use `maestro session siblings` for peer discovery, but no parent to report to.

#### 2. `coordinator` (Standalone Coordinator)
- **Who**: A top-level orchestrator launched by a user
- **Behavior**: Decomposes tasks, spawns workers, monitors progress, recovers from failures, verifies completion.
- **Identity**: "You are a team coordination agent. Decompose, delegate, monitor, verify."
- **Workflow**: analyze → decompose → spawn → monitor → recover → verify → complete
- **Communication**: Sends directives to spawned workers. No parent to report to.

#### 3. `coordinated-worker` (Worker under a Coordinator)
- **Who**: A worker spawned by a coordinator via `maestro session spawn --task <id>`
- **Behavior**: Same as worker, BUT also reports back to parent coordinator on completion, blocking, or errors.
- **Identity**: "You are a worker in a coordinated team. Execute your assigned tasks and report back to your coordinator."
- **Workflow**: init (includes reading coordinator directive) → execute (includes reporting to coordinator) → complete (notifies coordinator)
- **Communication**: Reports to `coordinatorSessionId`. Can discover and message siblings.

#### 4. `coordinated-coordinator` (Sub-Coordinator under a Parent Coordinator)
- **Who**: A mid-tier coordinator spawned by a higher-level coordinator for hierarchical orchestration
- **Behavior**: Acts as coordinator for its sub-team, BUT also reports back to its parent coordinator.
- **Identity**: "You are a sub-coordinator in a hierarchical team. Manage your workers and report progress to your parent coordinator."
- **Workflow**: Same as coordinator phases + parent reporting at completion/blocking
- **Communication**: Spawns its own workers, monitors them, AND reports up to parent coordinator.

---

## Analysis: Is This the Right Model?

### YES — This is correct and covers all scenarios

The 2×2 matrix is **exhaustive** for the current architecture. Every session falls into exactly one of these four categories based on two independent axes:

1. **What does the agent do?** → Execute tasks (worker) vs. Decompose & delegate (coordinator)
2. **Who spawned it?** → User/standalone vs. Another coordinator (coordinated)

### Benefits of Making This Explicit

1. **Cleaner identity prompts**: No more "if coordinator_session_id is present..." conditionals scattered throughout workflow phases. Each mode gets a tailored identity.

2. **Better behavioral separation**: A standalone worker doesn't need the "report to coordinator" instructions cluttering its prompt. A coordinated coordinator needs clear guidance on dual responsibilities (manage sub-team AND report up).

3. **Clearer for the AI agent**: Instead of inferring its role from context clues, the agent knows exactly what it is from the `<profile>` tag.

4. **Foundation for future features**: Explicit modes make it easier to add mode-specific capabilities, permissions, and workflow strategies.

### What Changes

#### Type Definition
```typescript
// Before
export type AgentMode = 'execute' | 'coordinate';

// After
export type AgentMode = 'worker' | 'coordinator' | 'coordinated-worker' | 'coordinated-coordinator';
```

#### Identity Prompts
```typescript
// Four distinct identity instructions instead of two
export const WORKER_IDENTITY = '...';
export const COORDINATOR_IDENTITY = '...';
export const COORDINATED_WORKER_IDENTITY = '...';
export const COORDINATED_COORDINATOR_IDENTITY = '...';
```

#### Workflow Phases
- `worker`: init → execute → complete (no coordinator reporting)
- `coordinator`: analyze → decompose → spawn → monitor → recover → verify → complete
- `coordinated-worker`: init → execute → complete (WITH coordinator reporting baked in, not conditional)
- `coordinated-coordinator`: analyze → decompose → spawn → monitor → recover → verify → complete + parent-report

#### Prompt Builder
- `buildIdentity()` switches on 4 modes instead of 2
- `getWorkflowPhases()` returns mode-specific phases
- `buildSessionContext()` includes `coordinatorSessionId` for coordinated modes

#### Manifest Generator
- Can auto-derive mode: if `coordinatorSessionId` is present AND mode is `execute` → `coordinated-worker`; if `coordinatorSessionId` AND mode is `coordinate` → `coordinated-coordinator`

---

## Alternative Considered: Keep 2 Modes + "coordinated" Flag

Instead of 4 modes, keep `execute`/`coordinate` and add a boolean `isCoordinated`:

```typescript
type AgentMode = 'execute' | 'coordinate';
interface MaestroManifest {
  mode: AgentMode;
  isCoordinated?: boolean; // derived from coordinatorSessionId presence
}
```

**Verdict**: This is essentially what we have today (the boolean is implicit via `coordinatorSessionId`). The 4-mode approach is better because:
- It's more explicit and self-documenting
- The mode name itself conveys the full role
- It simplifies prompt selection (direct lookup vs. mode + flag combination)

---

## Backward Compatibility

For backward compat, we can:
1. Accept `execute`/`coordinate` as aliases for `worker`/`coordinator`
2. Auto-map: if old manifest has `mode: 'execute'` + `coordinatorSessionId` → treat as `coordinated-worker`
3. Deprecation path: log warnings for old mode names, remove after N versions

---

## Recommendation

**Go with the four-mode model.** It's the natural, complete decomposition of the current implicit behavior. The implementation is straightforward:

1. Update `AgentMode` type
2. Add four identity prompts
3. Adjust workflow phase selection
4. Add backward-compat mapping in manifest generator
5. Update prompt builder's `buildIdentity()` and `getWorkflowPhases()`

This is a clean refactor that makes the system more explicit without adding complexity — it's removing hidden conditionals and replacing them with clear mode selection.
