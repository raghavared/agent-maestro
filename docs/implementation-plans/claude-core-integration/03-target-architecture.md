# 03. Target Architecture In Maestro

## New Subsystem: Session Intelligence

Add a new server module namespace:
- `maestro-server/src/intelligence/`

Suggested structure:
- `domain/` core types for parsed logs, tools, chunks, subagents
- `parsing/` JSONL parser + message normalization
- `discovery/` session log location + file resolution
- `analysis/` chunking, tool linkage, token/context accounting
- `cache/` read-through cache for parsed session artifacts
- `api/` route handlers for intelligence endpoints

## Runtime Data Flow
1. UI requests intelligence data for a Maestro session id.
2. Server resolves source session artifacts (Claude logs and/or Maestro session artifacts).
3. Server parses and normalizes messages.
4. Server performs analysis:
- tool calls/results
- subagent relationships
- token/context attribution
- optional search index
5. Server returns pre-shaped DTOs for UI consumption.
6. Server emits WebSocket update events when intelligence snapshots change.

## Integration With Existing Server Layers

### Routes
Add route group:
- `GET /api/sessions/:id/intelligence/summary`
- `GET /api/sessions/:id/intelligence/groups`
- `GET /api/sessions/:id/intelligence/tools`
- `GET /api/sessions/:id/intelligence/subagents`
- `GET /api/sessions/:id/intelligence/context`
- `GET /api/sessions/:id/intelligence/search?q=`

### Services
Add service:
- `SessionIntelligenceService` (application-facing orchestration)

### Event bus
Add optional events:
- `session:intelligence_updated`
- `session:intelligence_error`

## UI Integration Pattern
- New client methods in `maestro-ui/src/utils/MaestroClient.ts`
- New Zustand slice or extension to `useMaestroStore` for intelligence data + loading states
- Lazy-load heavy panels to avoid startup regression

## Compatibility Strategy
- No breaking changes to existing session/task routes.
- New endpoints optional and additive.
- UI feature behind a runtime flag until stabilization.
