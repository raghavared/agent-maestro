# Maestro CLI Prompt Architecture Implementation Plan

Task ID: `task_1771628041389_toghv22n2`  
Date: 2026-02-20

## Goal
Implement a prompt-first CLI architecture for `maestro-cli` that removes workflow-driven prompt composition, centralizes command policy/syntax ownership, and ensures deterministic cross-spawner prompt behavior.

## Scope
In scope:
- Prompt pipeline redesign in `maestro-cli`
- Command policy/catalog/surface separation
- Manifest normalization and compatibility window handling
- Spawner adapter consistency for Claude/Codex/Gemini
- CLI/schema cleanup for deprecated workflow fields
- Tests and migration docs

Out of scope:
- REST client redesign
- Non-CLI packages (`maestro-server`, `maestro-ui`, etc.)

## Baseline (Current Files)
- Prompt composition: `maestro-cli/src/services/prompt-builder.ts`, `maestro-cli/src/services/whoami-renderer.ts`
- Command permissions + prompt command rendering coupling: `maestro-cli/src/services/command-permissions.ts`, `maestro-cli/src/prompts/commands.ts`
- Workflow abstractions still active in model/surfaces: `maestro-cli/src/services/workflow-templates.ts`, `maestro-cli/src/prompts/workflow-phases.ts`, `maestro-cli/src/commands/team-member.ts`, `maestro-cli/src/commands/manifest-generator.ts`
- Manifest types/schema: `maestro-cli/src/types/manifest.ts`, `maestro-cli/src/schemas/manifest-schema.ts`, `maestro-cli/src/services/manifest-reader.ts`
- Spawners: `maestro-cli/src/services/claude-spawner.ts`, `maestro-cli/src/services/codex-spawner.ts`, `maestro-cli/src/services/gemini-spawner.ts`

## Target Architecture
Deterministic, single-pass pipeline:
1. `ManifestNormalizer` (immediately after manifest read)
2. `CapabilityPolicy` (policy + capabilities)
3. `CommandSurfaceRenderer` (minimal executable command surface)
4. `PromptComposer` (single producer of system/task prompt envelope)
5. Spawner adapter boundary only (tool-specific arg/flag transport)

## Key Decisions Locked In
1. Legacy mode aliases (`execute`, `coordinate`) are accepted only during a bounded migration window and normalized internally to current canonical modes.
2. Command metadata and executable syntax are single-source in one catalog module consumed by both policy and prompt surface rendering.
3. Workflow template/phase entities are removed from runtime prompt composition.
4. Prompt differences across spawners are allowed only at adapter transport level; semantic content must remain equivalent.
5. Manifest read failure fallback policy must be explicit (recommended: safe degraded behavior, not broad permissive allowance).

## Implementation Phases

### Phase 0: Contracts and Feature Flag
Deliverables:
- Add feature flag: `MAESTRO_PROMPT_V2=1` for controlled rollout.
- Define `PromptEnvelope` contract:
  - `system: string`
  - `task: string`
  - `metadata: { mode, commandCount, capabilityFlags }`
- Add compatibility policy note in docs/changelog.

Acceptance:
- Legacy behavior unchanged when flag is off.
- New envelope contract compiled and importable.

### Phase 1: Manifest Normalization Layer
Deliverables:
- Add `maestro-cli/src/prompting/manifest-normalizer.ts`.
- Invoke normalizer immediately in `manifest-reader.ts` output path (before prompt/policy use).
- Normalize legacy aliases and team-member identity into one canonical DTO.
- Emit one-time warning log when deprecated workflow fields are present.

Acceptance:
- Normalized manifest shape is deterministic.
- Legacy aliases parse correctly under migration mode.
- Deprecated fields do not alter composed prompt output.

### Phase 2: Command Catalog + Policy + Surface Split
Deliverables:
- Add `maestro-cli/src/prompting/command-catalog.ts` as canonical source of command id/syntax/description/visibility/applicability.
- Add `maestro-cli/src/prompting/capability-policy.ts` for allow/deny and capability derivation.
- Add `maestro-cli/src/prompting/command-surface-renderer.ts` for compact executable command text.
- Refactor `command-permissions.ts` to delegate or remove duplicated ownership.

Acceptance:
- No duplicated command syntax maps in prompt/policy code.
- CLI runtime guards consume policy output; prompt consumes renderer output only.

### Phase 3: Prompt Composer and Spawner Unification
Deliverables:
- Add `maestro-cli/src/prompting/prompt-composer.ts`.
- Route `claude-spawner.ts`, `codex-spawner.ts`, and `gemini-spawner.ts` through composer output.
- Remove secondary injection responsibilities from `whoami-renderer.ts` and prompt-builder overlap.

Acceptance:
- One composition path generates both `system` and `task` prompts.
- Session context is injected once from composer only.
- Spawners differ only in CLI argument transport.

### Phase 4: Workflow Surface Deprecation Cleanup
Deliverables:
- Remove/disable workflow template options from `team-member.ts` and related output.
- Stop manifest generator from writing workflow template/custom workflow fields.
- Remove workflow prompt references from active prompt path and related comments/docs.
- Update schema/types to move deprecated fields into compatibility layer or remove after window.

Acceptance:
- No workflow template/phase usage in runtime prompt generation path.
- Team-member CLI no longer promotes workflow template selection.

### Phase 5: Migration Finalization
Deliverables:
- Remove legacy prompt composition path once v2 validated.
- Enforce strict rejection of deprecated aliases/fields after migration window.
- Final docs/changelog update with upgrade notes.

Acceptance:
- Prompt v2 is default path.
- Deprecated forms produce deterministic errors post-window.

## Test Plan

### Contract Tests
- `PromptEnvelope` semantic equivalence across Claude/Codex/Gemini for:
  - worker standalone
  - worker coordinated
  - coordinator standalone
  - coordinator coordinated

### Policy Tests
- Core commands remain available as required.
- Group and command override precedence is deterministic.
- Explicit allowlists behave as expected.

### Compatibility Tests
- Legacy aliases normalize during migration window.
- Deprecated workflow fields do not affect final prompt text.

### Integration Tests
- Spawners receive same logical content.
- Adapter differences limited to flags/transport formatting.

## Risks and Mitigations
1. Prompt regressions during dual-path rollout.
- Mitigation: feature flag + snapshot/contract tests before default switch.

2. Command drift between policy and renderer.
- Mitigation: single canonical catalog and tests asserting catalog parity usage.

3. Breaking existing manifests.
- Mitigation: bounded compatibility window with explicit warnings and migration docs.

4. Security regression from permissive fallback.
- Mitigation: explicitly codify fallback as safe degraded mode and test failure path.

## Milestone Checklist
1. Phase 0 contract + flag merged.
2. Phase 1 normalizer merged.
3. Phase 2 catalog/policy/surface split merged.
4. Phase 3 composer + spawner unification merged.
5. Phase 4 workflow cleanup merged.
6. Phase 5 migration finalization merged.

## Suggested Execution Order (PR Strategy)
1. PR1: Prompt envelope contract + normalizer scaffolding + flag.
2. PR2: Command catalog/policy/surface refactor.
3. PR3: Prompt composer + spawner integration.
4. PR4: Workflow field/CLI/schema cleanup.
5. PR5: Remove legacy path and finalize migration.

## Done Criteria
- Deterministic prompt-first pipeline is the only active runtime path.
- Workflow entities removed from runtime prompt composition.
- Command policy and command prompt surface are decoupled and single-source.
- Cross-spawner prompt semantics are contract-tested and stable.
