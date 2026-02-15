# 04. Module Port And Rewrite Plan

## Strategy
Port logic by behavior, not by file copy fidelity. Preserve algorithms where useful; rebind interfaces and types to Maestro domain.

## Target Namespace
All imported/reworked logic should live under:
- `maestro-server/src/intelligence/`

## Module Mapping (Source -> Maestro)

1. Session parsing
- Source: `src/main/utils/jsonl.ts`, `src/main/services/parsing/SessionParser.ts`
- Target:
  - `intelligence/parsing/jsonlParser.ts`
  - `intelligence/parsing/sessionParser.ts`
  - `intelligence/types/messages.ts`

Rewrite requirements:
- Remove source-specific type imports and aliasing.
- Keep streaming parser behavior.
- Normalize to Maestro-owned message DTOs.

2. Tool extraction
- Source: `src/main/utils/toolExtraction.ts`
- Target:
  - `intelligence/parsing/toolExtraction.ts`

Rewrite requirements:
- Keep extraction behavior for `tool_use`/`tool_result`.
- Add adapter hooks for non-Claude tools where needed.

3. Discovery and session resolution
- Source: `src/main/services/discovery/ProjectScanner.ts`, `src/main/utils/pathDecoder.ts`
- Target:
  - `intelligence/discovery/logLocator.ts`
  - `intelligence/discovery/sessionSourceResolver.ts`

Rewrite requirements:
- Replace raw `~/.claude` assumptions with Maestro config-driven roots.
- Support local and SSH-aware resolution through existing Maestro abstractions.

4. Subagent resolution
- Source: `src/main/services/discovery/SubagentResolver.ts`, `src/main/services/analysis/ProcessLinker.ts`
- Target:
  - `intelligence/analysis/subagentResolver.ts`
  - `intelligence/analysis/processLinker.ts`

Rewrite requirements:
- Preserve task-id-first linking and fallback strategy.
- Align IDs with Maestro session/task identities.

5. Chunk/group builders
- Source: `src/main/services/analysis/ChunkBuilder.ts` and classifier stack
- Target:
  - `intelligence/analysis/messageClassifier.ts`
  - `intelligence/analysis/chunkBuilder.ts`
  - `intelligence/analysis/groupBuilder.ts`

Rewrite requirements:
- Keep category semantics: user/system/ai/hard-noise/compact.
- Use Maestro DTO naming conventions.

6. Context/token attribution
- Source (mixed main/renderer logic): tokenizer + context tracker
- Target:
  - `intelligence/analysis/contextAttribution.ts`
  - `intelligence/analysis/tokenEstimator.ts`

Rewrite requirements:
- Move to server-side implementation.
- Keep estimator pluggable and versioned.

## New Glue Required In Maestro
- `SessionIntelligenceService` to orchestrate discovery+parse+analysis.
- `SessionIntelligenceRepository` (optional) for persisted snapshots/indexes.
- API mappers from internal analysis models to UI DTOs.

## Code Rewrite Rules
- Do not introduce source path aliases (`@main`, `@renderer`, `@shared`).
- Keep domain models local to `maestro-server`.
- Prefer pure functions for parser/analysis modules.
- Keep side effects at service layer only.
