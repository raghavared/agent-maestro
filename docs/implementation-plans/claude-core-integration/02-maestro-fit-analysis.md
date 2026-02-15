# 02. Maestro Fit Analysis

## Current Maestro Product Shape (Observed)

### UI
- Single desktop app (`maestro-ui`) with:
  - primary terminal workspace (`SessionTerminal` per local terminal session)
  - right panel (`MaestroPanel` or `FileExplorerPanel`)
  - task/session orchestration UX
- State architecture: multiple Zustand stores (`useSessionStore`, `useMaestroStore`, `useProjectStore`, etc.)
- Session identity bridge:
  - local terminal session id (`TerminalSession.id`)
  - maestro session id (`TerminalSession.maestroSessionId`)

### Backend
- `maestro-server` exposes REST + WebSocket events.
- Domain-centric session/task/project model.
- Session routes currently handle orchestration state, docs, timeline, queue, spawn.
- No dedicated “session intelligence” parsing service yet.

### CLI
- `maestro-cli` spawns Claude/Codex/Gemini and sets environment context.
- Relevant for future mapping between spawned Maestro sessions and agent-specific logs.

## Highest-Impact Integration Points

### Backend insertion point
`maestro-server` should host the new session intelligence engine.

Why:
- Heavy parsing and indexing are compute/IO bound.
- Existing API/WebSocket patterns already in place.
- UI can stay thin and request normalized views.

### UI insertion points
1. Right panel view system (`maestro-ui/src/components/AppRightPanel.tsx`)
- Add a new panel mode for “Session Intelligence” or “Trace”.

2. Session detail area (`maestro-ui/src/components/maestro/MaestroSessionContent.tsx`)
- Add tabs/sections for:
  - tool trace
  - context usage
  - subagent tree
  - compaction boundaries (if available)

3. Terminal workspace overlays (`maestro-ui/src/components/app/AppWorkspace.tsx`)
- Optional quick badges on active terminal (high token, errors, subagent activity).

## Required Identity Mapping In Maestro
To parse the correct Claude logs for each Maestro session, we need deterministic linkage:
- Maestro session id -> execution cwd(s)
- Maestro session id -> agent tool (`claude-code|codex|gemini`)
- For Claude-specific deep parsing: maestro session id -> Claude session file(s)

Current status:
- `maestroSessionId` is stored in UI session model.
- Direct pointer to underlying Claude JSONL path is not explicitly persisted in server types.

## Fit Conclusion
Maestro can absorb source core logic well, but only after introducing a dedicated server-side intelligence module and a robust session identity mapping contract.
