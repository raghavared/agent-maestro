# 05. UI/UX Integration Plan

## Current UI Surfaces That Can Host Intelligence

1. Right panel mode switcher
- File: `maestro-ui/src/components/AppRightPanel.tsx`
- Current modes: `maestro`, `files`
- Proposed: add `trace` mode

2. Session detail content
- File: `maestro-ui/src/components/maestro/MaestroSessionContent.tsx`
- Current tabs: `tasks`, `timeline`, `details`
- Proposed tabs:
  - `trace` (tool/subagent timeline)
  - `context` (token/context attribution)

3. Lightweight live badges
- Files: `maestro-ui/src/components/ProjectTabBar.tsx`, `maestro-ui/src/components/SessionsSection.tsx`
- Proposed badges:
  - high token usage warning
  - unresolved tool error
  - subagent count

## Recommended UX Shape (Phase 1)
Implement intelligence inside existing Session Details before creating new global panel.

Reason:
- Lowest navigation cost for users already inspecting sessions.
- Reuses existing data relationship (session-centric UX).
- Lower layout complexity than adding a full third right-panel mode immediately.

### Phase 1 screens
- In `MaestroSessionContent`, add two tabs:
  - `Trace`
  - `Context`
- `Trace` content:
  - chronological grouped rows
  - tool call/result pairs
  - subagent branches
- `Context` content:
  - per-turn context bars
  - category breakdown table
  - compaction markers if detected

### Phase 2 screens
- Dedicated right-panel mode `trace` for cross-session browsing and search.

## State Management Plan (UI)
- Add new store section in `useMaestroStore`:
  - `intelligenceBySessionId`
  - `intelligenceLoadingBySessionId`
  - `intelligenceErrorBySessionId`
- Fetch lazily when session detail opens or tab changes.

## Interaction/Performance Requirements
- Keep initial session detail render under 150ms for cached data.
- Debounce search queries.
- Virtualize long trace lists.
- Separate summary fetch from heavy detail fetch.
