# 07. Delivery Phases And Testing

## Phase 0: Foundation
- Create intelligence module skeleton in `maestro-server/src/intelligence`.
- Add baseline DTOs and service interface.
- Add feature flag `SESSION_INTELLIGENCE_ENABLED`.

Acceptance:
- Server builds with feature off/on.

## Phase 1: Parse + Summary
- Implement log source resolver + JSONL parser + metrics summary.
- Add `/intelligence/summary` endpoint.

Acceptance:
- Summary endpoint returns deterministic counts on fixture logs.
- Parsing handles malformed lines without crashing.

## Phase 2: Tool Trace + Subagents
- Implement tool extraction and subagent linkage.
- Add `/intelligence/groups` and `/intelligence/subagents` endpoints.

Acceptance:
- Task/subagent linking works with id-based and fallback matching.
- UI renders trace tab for active session.

## Phase 3: Context Attribution
- Implement context estimator and compaction marker detection.
- Add `/intelligence/context` endpoint.

Acceptance:
- Context tab renders per-turn bars and totals.
- Cache invalidation updates values on session growth.

## Phase 4: Search + UX Polish
- Add in-session search endpoint and UI.
- Add lightweight session badges.

Acceptance:
- Search latency acceptable on large sessions.
- UI remains responsive with >10k messages.

## Test Plan

### Server unit tests
- parser classification
- tool extraction/linking
- subagent resolution
- chunk/group construction
- context attribution calculations

### Server integration tests
- endpoint contract and validation
- feature flag behavior
- cache invalidation on synthetic file change

### UI tests
- tab rendering and loading states
- virtualization for large trace lists
- error/empty states

### Fixtures required
- simple worker session
- queue session
- subagent-heavy session
- malformed/partial log session

## Risk Register

1. Session identity ambiguity
- Risk: cannot map Maestro session to underlying Claude session reliably.
- Mitigation: add explicit metadata at spawn time and persist source pointers.

2. Large log performance
- Risk: UI stutters and server memory spikes.
- Mitigation: streaming parse + caching + pagination/virtualization.

3. Multi-agent model variance
- Risk: Codex/Gemini logs differ from Claude JSONL schema.
- Mitigation: adapter model per agent tool; degrade gracefully to Maestro event timeline.

4. UX complexity
- Risk: too many new data panels overwhelm users.
- Mitigation: progressive disclosure, default summary-first UX.
