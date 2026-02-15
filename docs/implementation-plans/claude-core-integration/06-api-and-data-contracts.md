# 06. API And Data Contracts

## Proposed API Endpoints

1. Summary
- `GET /api/sessions/:id/intelligence/summary`
- Returns:
  - message counts
  - tool count
  - subagent count
  - token totals
  - first/last timestamp

2. Trace groups
- `GET /api/sessions/:id/intelligence/groups`
- Returns grouped conversation/tool execution model for UI trace tab.

3. Context attribution
- `GET /api/sessions/:id/intelligence/context`
- Returns per-turn context breakdown and totals.

4. Subagents
- `GET /api/sessions/:id/intelligence/subagents`
- Returns resolved subagent tree and linkage metadata.

5. Search
- `GET /api/sessions/:id/intelligence/search?q=<query>`
- Search across parsed message text/tool payload summaries.

## DTO Sketches

```ts
export interface SessionIntelligenceSummaryDto {
  sessionId: string;
  source: 'claude-jsonl' | 'maestro-events' | 'hybrid';
  messageCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  subagentCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  startedAt: number;
  endedAt: number;
}

export interface SessionTraceGroupDto {
  id: string;
  startedAt: number;
  endedAt: number;
  userMessage?: string;
  assistantMessages: Array<{ id: string; text: string; model?: string }>;
  tools: Array<{
    callId: string;
    name: string;
    inputSummary: string;
    resultSummary?: string;
    isError?: boolean;
    startedAt: number;
    endedAt?: number;
  }>;
  subagents: Array<{
    id: string;
    parentTaskCallId?: string;
    label?: string;
    startedAt: number;
    endedAt: number;
    isParallel: boolean;
  }>;
}

export interface SessionContextTurnDto {
  turnIndex: number;
  estimatedTotal: number;
  categories: {
    userMessage: number;
    toolIO: number;
    thinking: number;
    coordination: number;
    mentions: number;
    claudeMd: number;
    other: number;
  };
  compactedAfterTurn?: boolean;
}
```

## Server Service Contract

```ts
interface SessionIntelligenceService {
  getSummary(sessionId: string): Promise<SessionIntelligenceSummaryDto>;
  getGroups(sessionId: string): Promise<SessionTraceGroupDto[]>;
  getContext(sessionId: string): Promise<SessionContextTurnDto[]>;
  getSubagents(sessionId: string): Promise<SubagentTreeDto>;
  search(sessionId: string, q: string): Promise<SearchResultDto[]>;
  invalidate(sessionId: string): Promise<void>;
}
```

## Caching
- Key by `sessionId + sourceFingerprint`.
- Invalidate when:
  - related session files change
  - explicit session refresh invoked
  - session status transitions to completed and final parse requested
