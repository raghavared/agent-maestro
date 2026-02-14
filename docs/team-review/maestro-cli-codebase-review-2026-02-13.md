# Maestro CLI Codebase Review (2026-02-13)

## Scope
- Command structure in `maestro-cli/src/commands/*`
- API client in `maestro-cli/src/api.ts`
- CLI utilities in `maestro-cli/src/utils/*`
- TypeScript implementation quality, modularity, and tests in `maestro-cli/tests/*`

## Findings (Ordered by Severity)

### 1. High: Task tree rendering is structurally broken for nested tasks
- Evidence:
  - Tree/list builders populate `children` objects: `maestro-cli/src/commands/task.ts:34`, `maestro-cli/src/commands/task.ts:643`
  - Renderer only reads `subtasks`: `maestro-cli/src/utils/formatter.ts:37`
- Impact:
  - `maestro task list <id>` and `maestro task tree` can silently drop nested structure in text output.
  - Operators get incomplete hierarchy views during orchestration.
- Recommendation:
  - Normalize on one field (`children`) across command outputs and renderers.
  - Make renderer recursive and status-aware for the current task schema.

### 2. High: Hook lifecycle commands hide server failures by exiting with success
- Evidence:
  - `session register` failure path exits `0`: `maestro-cli/src/commands/session.ts:404-409`
  - `session complete` failure path exits `0`: `maestro-cli/src/commands/session.ts:443-448`
  - Same pattern in `needs-input` and `resume-working`: `maestro-cli/src/commands/session.ts:491-495`, `maestro-cli/src/commands/session.ts:530-534`
- Impact:
  - Automation reports success even when session state updates fail.
  - Session/task status can drift from actual runtime behavior and become harder to recover.
- Recommendation:
  - Return non-zero for transport/server failures, optionally behind a `--best-effort` flag for hook callers.

### 3. Medium: Permission-denied failures bypass standardized error handling
- Evidence:
  - `guardCommand(...)` is called before local `try/catch` in handlers, e.g. `maestro-cli/src/commands/task.ts:19`, `maestro-cli/src/commands/task.ts:76`, `maestro-cli/src/commands/task.ts:602`.
- Impact:
  - Denied commands can escape `handleError(...)` and produce inconsistent UX/JSON output.
- Recommendation:
  - Move guard calls inside `try/catch` or wrap actions in a shared command executor that consistently maps errors.

### 4. Medium: API error object shape is inconsistent with error formatter expectations
- Evidence:
  - API client writes URL under `err.response.config.url`: `maestro-cli/src/api.ts:48-52`
  - Error formatter reads `err.config?.url` and `err.config?.baseURL`: `maestro-cli/src/utils/errors.ts:48`, `maestro-cli/src/utils/errors.ts:97`, `maestro-cli/src/utils/errors.ts:108`
- Impact:
  - Error details/suggestions may be incomplete or wrong, reducing diagnosability.
- Recommendation:
  - Normalize to one error shape (e.g., axios-like top-level `config`) and update formatter accordingly.

### 5. Medium: Test suite is heavily stale against current manifest model
- Evidence:
  - Current model requires `tasks[]`: `maestro-cli/src/types/manifest.ts:33`, `maestro-cli/src/schemas/manifest-schema.ts:34`, `maestro-cli/src/schemas/manifest-schema.ts:212`
  - Tests still use singular `task`: `maestro-cli/tests/services/prompt-generator.test.ts:23`, `maestro-cli/tests/commands/manifest-generator.test.ts:32`, `maestro-cli/tests/schemas/manifest-schema.test.ts:10`
  - Current run: `39 failed / 176 total` (`npm test -- --run`).
- Impact:
  - CI signal is degraded; regressions in active paths can be masked by legacy failures.
- Recommendation:
  - Migrate tests to `tasks[]` and current templates, then enforce green baseline before further feature work.

## Code Organization and Modularity Assessment

### What is working well
- Clear command-module separation (`task`, `session`, `project`, `queue`, `report`).
- Service-layer extraction for critical concerns (`command-permissions`, spawners, prompt generation).
- Manifest schema + TypeScript types provide a strong contract foundation.

### Current modularity friction
- Repeated command boilerplate (spinner setup, context extraction, JSON/plain branching, error handling).
- Spawner implementations duplicate environment mapping logic across Claude/Codex/Gemini.
- Broad use of `any` in command/services reduces static guarantees and increases runtime risk.

## Refactoring Opportunities

1. Introduce a shared command action wrapper
- Centralize: `guardCommand`, spinner lifecycle, JSON mode, standardized error mapping.
- Expected result: less duplicated branching and fewer inconsistent exits.

2. Consolidate spawner shared logic
- Extract common base for environment construction and prompt wiring.
- Keep only tool-specific argument mapping in concrete spawners.

3. Replace `any` with DTOs for API responses
- Start with high-traffic entities (`Task`, `Session`, queue payloads).
- This will catch schema drift earlier and simplify review/debug cycles.

4. Reduce N+1 task-tree fetch pattern
- Current tree builder fetches each node and children recursively (`maestro-cli/src/commands/task.ts:633-643`).
- Prefer one bulk endpoint or batched retrieval to improve large-project responsiveness.

## Error Handling Quality
- Positive: there is a centralized `handleError(...)` with exit-code mapping.
- Gaps: not all paths flow through it; some hook paths intentionally suppress failures, and API error metadata is inconsistent.

## TypeScript Quality
- `strict` mode is enabled in `maestro-cli/tsconfig.json`, which is good.
- Effective strictness is diluted by extensive `any` usage in command and service logic.

## Test/Verification Notes
- Executed: `cd maestro-cli && npm test -- --run`
- Result: failed (39 failing tests), primarily due to legacy `task` schema expectations and template naming assumptions.

