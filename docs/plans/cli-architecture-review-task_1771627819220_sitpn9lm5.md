# CLI Architecture Plan Review

Task ID: `task_1771627819220_sitpn9lm5`  
Date: 2026-02-20

## Summary
The proposed prompt-first CLI architecture direction is strong and aligns with the current codebase pain points.  
Before implementation, the plan should include explicit migration and contract details to avoid regressions.

## Findings To Incorporate

1. Legacy normalization order must be explicit
- Run manifest normalization immediately after manifest read.
- Preserve legacy alias acceptance during migration (`execute`, `coordinate`), normalize internally to four-mode.
- Define when strict rejection of deprecated forms begins.

2. Command catalog must become truly single-source
- Keep command metadata and syntax in one canonical catalog.
- Ensure both policy resolution and prompt command rendering consume the same source.
- Remove split ownership that can cause syntax/policy drift.

3. Add PromptEnvelope compatibility contract tests
- Validate equivalent prompt semantics across Claude/Codex/Gemini during rollout.
- Preserve current system/task split behavior while migrating away from string replacement injection.
- Restrict differences to adapter layer transport and flags.

4. Expand workflow deprecation scope to all active surfaces
- Include prompt path, team-member CLI options, manifest generation, and manifest schema/types.
- Track these as Phase 3 acceptance criteria to prevent partial deprecation.

5. Make permission fallback policy explicit
- Current implementation allows broad command access when manifest loading fails.
- Decide and document whether permissive fallback is intentional or should fail safer.

## Open Decision
- Keep deprecated fields for one release (recommended) or indefinitely with warnings.
