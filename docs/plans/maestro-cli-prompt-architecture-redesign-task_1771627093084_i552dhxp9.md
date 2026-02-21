# Maestro CLI Prompt Architecture Redesign Plan

## Objective
Simplify Maestro CLI prompt architecture so it is:
- Simple: one predictable prompt pipeline
- Intuitive: minimal concepts (manifest + permissions + context)
- Powerful: still supports worker/coordinator and multiple agent tools
- Robust: deterministic output, testable contracts, fewer hidden couplings

Primary focus areas:
- Manifest generation
- Prompt building (highest priority)
- Command management from manifest + permissions

Constraint from request:
- Remove workflow template and workflow phase abstractions from runtime prompt composition
- Prefer prompt-first architecture over many workflow entities

## Current Problems (Codebase Findings)

1. Prompt model has drift and mixed abstractions
- `src/services/prompt-builder.ts` builds XML blocks for identity/tasks/context/team info.
- `src/services/whoami-renderer.ts` injects command blocks and appends extra session context again.
- Result: prompt content split across multiple layers with duplicated responsibilities.

2. Workflow/template system exists but is effectively disconnected
- `src/services/workflow-templates.ts` and `src/prompts/workflow-phases.ts` are large conceptual surfaces.
- Current `PromptBuilder.buildSystemXml()` no longer includes workflow phases, but workflow fields still exist in types/schema and team-member commands.
- Result: dead-weight complexity and confusing mental model.

3. Manifest is carrying too many legacy/optional modeling paths
- `src/types/manifest.ts` includes legacy aliases + team-member workflow fields + multiple identity forms.
- Schema accepts `strategy`, legacy modes, and team-member workflow template fields even though runtime value is limited.
- Result: hard-to-reason prompt contract and fragile compatibility matrix.

4. Command permission logic is broad but tightly coupled to rendering style
- `src/services/command-permissions.ts` mixes: registry, policy evaluation, grouping, display formatting.
- Result: one module doing policy + presentation + serialization.

5. Per-agent spawner prompt injection is duplicated
- Claude/Codex/Gemini each call `WhoamiRenderer` and perform similar prompt composition steps.
- Result: avoidable duplication and harder consistency guarantees.

## Target Architecture (Prompt-First, No Workflow Entities)

Use a 4-stage deterministic pipeline:

1. `ManifestNormalizer`
- Input: raw manifest JSON
- Output: normalized manifest DTO (single mode model, resolved defaults, no legacy ambiguity)
- Responsibilities:
  - Normalize legacy mode aliases once
  - Normalize team-member identity into one internal shape
  - Validate required fields for prompt construction

2. `CapabilityPolicy`
- Input: normalized manifest + command registry
- Output: `CapabilitySet`
- Responsibilities:
  - Resolve allowed commands from mode/defaults + overrides + explicit allowlists
  - Derive high-level boolean capabilities from allowed commands (spawn, task edit, report, docs, messaging)

3. `CommandSurface`
- Input: `CapabilitySet`
- Output: compact executable command surface for prompt
- Responsibilities:
  - Emit only executable syntax agents should run
  - Hide internal/infra commands
  - Keep rendering minimal and deterministic

4. `PromptComposer`
- Input: normalized manifest + capabilities + command surface + runtime context
- Output:
  - `systemPrompt`
  - `taskPrompt`
- Responsibilities:
  - Build final prompt sections in a fixed order
  - No workflow phases/templates
  - No additional implicit injections outside this composer

## Design Patterns

1. Pipeline pattern for prompt construction
- Strict stage ordering, each stage pure and testable.

2. Policy object for permissions
- All command allow/deny logic in one policy layer.

3. Registry pattern for command catalog
- One command catalog source of truth:
  - command id
  - syntax
  - description
  - visibility
  - mode applicability

4. Adapter pattern only at final agent-tool boundary
- Claude/Codex/Gemini spawners adapt *same* `PromptEnvelope` to CLI flags.
- No tool-specific prompt logic before adapter boundary.

## New Prompt Contract (Minimal)

System prompt should contain only:
- Identity block (mode + role instructions + optional team identity)
- Capability summary (high-level affordances)
- Command surface (executable commands only)
- Hard operating constraints (reporting, docs discipline, communication)

Task prompt should contain only:
- Task list (and optional tree if present)
- Session context (session/project/parent coordinator IDs)
- Coordinator directive (if any)
- Reference tasks block
- Codebase/project context

Explicitly removed:
- Workflow template IDs
- Workflow phases and phase sequencing blocks
- Strategy-specific workflow narration as first-class entities

If strategy-like behavior is needed later, model it as a plain `operatingGuidance` text snippet in prompt constraints, not as a workflow object model.

## Manifest Simplification Plan

Keep now (core):
- `manifestVersion`
- `mode`
- `tasks`
- `session` (model, permissionMode, maxTurns, workingDirectory)
- `context`
- `referenceTaskIds`
- team-member identity/roster fields required for coordination

Deprecate and remove:
- `teamMemberWorkflowTemplateId`
- `teamMemberCustomWorkflow`
- `strategy` as schema-level workflow selector for prompt builder
- legacy aliases in public generation APIs after migration window

Compatibility approach:
- Accept deprecated fields in reader during migration window
- Ignore them in prompt composition
- Emit warning once in debug logs when deprecated fields are present

## Command Management Redesign

Split `command-permissions.ts` into:
- `command-catalog.ts` (pure data registry)
- `capability-policy.ts` (allow/deny resolution + capability derivation)
- `command-surface-renderer.ts` (compact prompt text output)

Rules:
- Prompt consumes only renderer output from policy result.
- CLI runtime guards consume only policy result.
- No direct prompt formatting inside policy evaluation code.

## Prompt Builder Redesign

Replace `PromptBuilder + WhoamiRenderer` overlap with:
- `PromptComposer` (single source for system/task prompt composition)
- `PromptEnvelope` return type:
  - `system: string`
  - `task: string`
  - `metadata: { mode, commandCount, capabilityFlags }`

Spawner flow:
- Spawner asks composer for `PromptEnvelope`
- Spawner-specific adapter injects envelope into Claude/Codex/Gemini args

Result:
- No secondary injection of session context outside composer
- No duplicated XML transformations

## Phased Implementation Plan

Phase 1: Introduce new modules without breaking behavior
- Add:
  - `src/prompting/manifest-normalizer.ts`
  - `src/prompting/capability-policy.ts`
  - `src/prompting/command-surface-renderer.ts`
  - `src/prompting/prompt-composer.ts`
- Wire spawners behind feature flag `MAESTRO_PROMPT_V2=1`

Phase 2: Remove workflow abstractions from prompt path
- Stop importing workflow phase constants from prompt path
- Remove workflow rendering references from docs/code comments in active path
- Mark workflow template APIs deprecated

Phase 3: Schema and CLI cleanup
- Remove workflow template options from team-member CLI commands
- Remove deprecated manifest fields from schema/types (or move to compatibility layer)
- Keep migration note in docs and changelog

Phase 4: Finalize and delete legacy prompt path
- Remove old prompt composition path (`WhoamiRenderer` composition responsibilities)
- Keep whoami as consumer of `PromptComposer` output

## Test Strategy

1. Snapshot tests for final prompt envelope
- Worker standalone
- Worker coordinated
- Coordinator standalone
- Coordinator coordinated
- With and without team-member identity
- With explicit allowedCommands overrides

2. Policy tests
- Core commands never removed
- Group override and command override precedence
- Explicit allowlist behavior

3. Backward compatibility tests
- Legacy mode aliases normalize correctly
- Deprecated workflow fields do not affect final prompt output

4. Spawner integration tests
- Claude/Codex/Gemini receive same logical prompt content
- Tool-specific injection differences only at adapter layer

## Proposed Immediate Scope (Best ROI)

If you want fastest impact first:
1. Build `PromptComposer` and route all spawners through it
2. Split command policy from command prompt rendering
3. Remove workflow fields from active prompt composition and team-member CLI options

This gives the biggest simplification quickly without touching REST client behavior.

## Success Criteria

- Prompt output is generated by one deterministic composition pipeline
- No workflow phase/template entities in runtime prompt generation
- Command permissions are policy-driven and presentation-agnostic
- Spawners share one prompt envelope contract
- Manifest surface area reduced to what the prompt system actually uses

## Architecture Review Addendum (2026-02-20)

### Required Additions Before Implementation

1. Manifest normalization order must be explicit
- Define that `ManifestNormalizer` runs immediately after manifest read and before any prompt/policy use.
- Keep schema compatibility for legacy mode aliases during migration (`execute`, `coordinate`) and normalize to four-mode internally.
- State whether strict schema rejection happens only after migration window ends.

2. Command catalog must be truly single-source
- Consolidate command metadata and executable syntax into one canonical catalog module.
- `CapabilityPolicy` and `CommandSurface` must both consume that same catalog.
- Eliminate split ownership between policy registry and separate syntax maps to prevent drift.

3. PromptEnvelope migration needs compatibility contract tests
- Add contract tests ensuring equivalent prompt semantics across all spawners (Claude/Codex/Gemini) during rollout.
- Preserve current system/task split behavior while replacing string-level injection paths.
- Validate adapter-layer-only differences (CLI flags and system-prompt transport format).

4. Workflow deprecation scope must include CLI and schema surfaces
- In addition to prompt path cleanup, include:
  - team-member CLI options/printing for workflow template/custom workflow
  - manifest generator population of workflow template fields
  - manifest types/schema fields carrying workflow template/custom workflow
- Track these in Phase 3 acceptance criteria, not only as “follow-up cleanup.”

5. Permission failure behavior must be an explicit policy decision
- Current behavior falls back to broad command allowance if manifest cannot be loaded.
- Decide and document whether this permissive fallback is retained intentionally or replaced with safer degraded behavior.

### Open Decision
- Compatibility window: accept deprecated workflow/legacy fields for one release only, or indefinitely with warnings?
