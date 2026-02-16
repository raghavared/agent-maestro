# 01. Source System Analysis (claude-devtools)

## Core Value Provided By Source System
claude-devtools reconstructs high-fidelity execution traces from Claude session JSONL logs. It turns raw conversation/tool artifacts into:
- parsed message streams
- tool call/result linkage
- subagent tree resolution
- chunked conversation/group views
- token/context attribution heuristics
- searchable, filterable session metadata

## Source Architecture Summary

### Runtime Layers
- Electron main process orchestrates services and file watching.
- ServiceContext abstraction bundles scanner/parser/chunk/subagent/cache/watcher.
- React renderer consumes APIs and computes additional context visuals.

### Key Processing Pipeline
1. Project/session discovery
- `ProjectScanner` scans Claude projects dir and session files.

2. JSONL parsing
- `parseJsonlFile` streams line-by-line; `SessionParser` builds normalized `ParsedMessage[]`.

3. Tool extraction
- Extracts `tool_use` and `tool_result` blocks and links them by tool id.

4. Subagent resolution
- Resolves subagent files and links them to parent Task calls.

5. Visualization model building
- `ChunkBuilder` and group builders produce user/assistant/system/compact chunks and tool execution structures.

6. Context attribution
- Renderer utilities estimate context composition (CLAUDE.md, mentions, tool output, thinking, coordination, user text).

## Source Modules With High Reuse Potential
- Parsing primitives
  - `src/main/utils/jsonl.ts`
  - `src/main/utils/toolExtraction.ts`
- Discovery
  - `src/main/services/discovery/ProjectScanner.ts`
  - `src/main/utils/pathDecoder.ts`
- Subagent linking
  - `src/main/services/discovery/SubagentResolver.ts`
  - `src/main/services/analysis/ProcessLinker.ts`
- Conversation modeling
  - `src/main/services/analysis/ChunkBuilder.ts`
  - message classifier stack
- Safety/validation patterns
  - `src/main/ipc/guards.ts`
  - `src/main/utils/pathValidation.ts`

## Source Modules To Avoid Copying Directly
- Electron-only bootstrapping and IPC wrappers
- Source UI components and store slices
- Source-specific channel names and preload APIs
- Assumptions tightly coupled to source app shell

## Important Source Behaviors To Preserve
- Stream parsing for large logs (avoid loading full file into memory).
- Clear distinction between real user input, internal tool-result messages, assistant output, and noise.
- Task/subagent linking via tool ids first, time-based fallback second.
- Defensive handling of partial or malformed session entries.

## Known Source Limitations To Intentionally Improve In Maestro
- Token counting heuristic (`chars/4`) only. We should maintain this as baseline but make estimator swappable.
- Mixed responsibility: some core context accounting lives in renderer. In Maestro, move heavy logic server-side.
- Package scripts inconsistency in source tests. In Maestro, keep tested module boundaries explicit.
