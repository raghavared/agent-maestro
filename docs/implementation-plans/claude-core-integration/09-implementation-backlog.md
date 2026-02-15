# 09. Implementation Backlog (File-By-File Execution Plan)

This is the execution sequence for the next coding pass.

## Stage 1: Server Scaffolding

1. Create intelligence module root
- Add: `maestro-server/src/intelligence/index.ts`
- Add: `maestro-server/src/intelligence/types.ts`
- Add: `maestro-server/src/intelligence/contracts.ts`

2. Add service shell
- Add: `maestro-server/src/intelligence/SessionIntelligenceService.ts`
- Export from `maestro-server/src/application/services/index.ts` only after wiring.

3. Add route shell
- Add: `maestro-server/src/api/intelligenceRoutes.ts`
- Register in `maestro-server/src/server.ts`

## Stage 2: Parser Port

4. Add parser types
- Add: `maestro-server/src/intelligence/parsing/types.ts`

5. Port and rewrite streaming JSONL parser
- Add: `maestro-server/src/intelligence/parsing/jsonlParser.ts`
- Source behavior reference: `claude-devtools/src/main/utils/jsonl.ts`

6. Port and rewrite tool extraction
- Add: `maestro-server/src/intelligence/parsing/toolExtraction.ts`
- Source behavior reference: `claude-devtools/src/main/utils/toolExtraction.ts`

7. Add session parser orchestration
- Add: `maestro-server/src/intelligence/parsing/sessionParser.ts`
- Source behavior reference: `claude-devtools/src/main/services/parsing/SessionParser.ts`

## Stage 3: Discovery + Linking

8. Add source resolution layer
- Add: `maestro-server/src/intelligence/discovery/sessionSourceResolver.ts`
- Input: Maestro session id
- Output: source paths + source type + confidence

9. Add subagent resolver
- Add: `maestro-server/src/intelligence/analysis/subagentResolver.ts`
- Source behavior reference: `claude-devtools/src/main/services/discovery/SubagentResolver.ts`

10. Add process linking
- Add: `maestro-server/src/intelligence/analysis/processLinker.ts`
- Source behavior reference: `claude-devtools/src/main/services/analysis/ProcessLinker.ts`

## Stage 4: Analysis Models

11. Add classifier
- Add: `maestro-server/src/intelligence/analysis/messageClassifier.ts`

12. Add chunk/group builders
- Add: `maestro-server/src/intelligence/analysis/chunkBuilder.ts`
- Add: `maestro-server/src/intelligence/analysis/groupBuilder.ts`

13. Add metrics + context attribution
- Add: `maestro-server/src/intelligence/analysis/tokenEstimator.ts`
- Add: `maestro-server/src/intelligence/analysis/contextAttribution.ts`

## Stage 5: API + Cache

14. Add cache module
- Add: `maestro-server/src/intelligence/cache/sessionIntelligenceCache.ts`

15. Implement service methods
- `getSummary`
- `getGroups`
- `getSubagents`
- `getContext`
- `search`

16. Implement intelligence routes
- `GET /sessions/:id/intelligence/summary`
- `GET /sessions/:id/intelligence/groups`
- `GET /sessions/:id/intelligence/subagents`
- `GET /sessions/:id/intelligence/context`
- `GET /sessions/:id/intelligence/search`

## Stage 6: UI Integration

17. Extend API client
- Update: `maestro-ui/src/utils/MaestroClient.ts`
- Add typed methods for intelligence endpoints.

18. Extend store
- Update: `maestro-ui/src/stores/useMaestroStore.ts`
- Add fetch/load/error/data state for intelligence by session.

19. Add UI tabs in session detail
- Update: `maestro-ui/src/components/maestro/MaestroSessionContent.tsx`
- Add `Trace` and `Context` tabs with lazy data fetch.

20. Add initial trace/context components
- Add: `maestro-ui/src/components/maestro/intelligence/TraceTab.tsx`
- Add: `maestro-ui/src/components/maestro/intelligence/ContextTab.tsx`

## Stage 7: Optional Enhancements

21. Right panel mode for cross-session trace browsing
- Update: `maestro-ui/src/components/AppRightPanel.tsx`
- Add new mode and entry affordance.

22. Session badges
- Update: `maestro-ui/src/components/SessionsSection.tsx`
- Add high-token/error/subagent indicators.

## Test Backlog

23. Server parser tests
- Add: `maestro-server/test/intelligence/jsonlParser.test.ts`
- Add: `maestro-server/test/intelligence/sessionParser.test.ts`

24. Server analysis tests
- Add: `maestro-server/test/intelligence/subagentResolver.test.ts`
- Add: `maestro-server/test/intelligence/chunkBuilder.test.ts`
- Add: `maestro-server/test/intelligence/contextAttribution.test.ts`

25. Server route tests
- Add: `maestro-server/test/intelligence/routes.test.ts`

26. UI component/store tests
- Add: `maestro-ui/src/components/maestro/intelligence/*.test.tsx`
- Add store tests for fetch/error/cache behavior.

## Gating Checklist Before Merge
- Feature flag enabled in development only.
- No regression in existing session/task orchestration flows.
- Large session parse stress-tested.
- UX decisions in `08-open-ux-questions.md` resolved.
