import type { ParsedMessage, ToolCall, ToolResult, SessionMetrics } from './types';
import { classifyMessage } from './messageClassifier';
import { calculateMetrics } from './parseJsonl';

export interface LinkedTool {
  call: ToolCall;
  result?: ToolResult;
  resultMessage?: ParsedMessage;
}

export interface ConversationGroup {
  userMessage: ParsedMessage | null;
  aiMessages: ParsedMessage[];
  linkedTools: LinkedTool[];
  metrics: SessionMetrics;
}

export function groupMessages(messages: ParsedMessage[]): ConversationGroup[] {
  const groups: ConversationGroup[] = [];
  let currentGroup: ConversationGroup | null = null;

  // Build a map of tool_use_id -> ToolResult for quick lookup
  const toolResultMap = new Map<string, { result: ToolResult; message: ParsedMessage }>();
  for (const msg of messages) {
    for (const tr of msg.toolResults) {
      toolResultMap.set(tr.toolUseId, { result: tr, message: msg });
    }
  }

  for (const msg of messages) {
    const category = classifyMessage(msg);

    if (category === 'HARD_NOISE') continue;

    if (category === 'USER') {
      // Finish previous group
      if (currentGroup) {
        currentGroup.metrics = calculateMetrics(currentGroup.aiMessages);
        groups.push(currentGroup);
      }
      currentGroup = {
        userMessage: msg,
        aiMessages: [],
        linkedTools: [],
        metrics: { durationMs: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, messageCount: 0 },
      };
    } else if (category === 'AI' || category === 'SYSTEM') {
      if (!currentGroup) {
        // AI messages before first user message
        currentGroup = {
          userMessage: null,
          aiMessages: [],
          linkedTools: [],
          metrics: { durationMs: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, messageCount: 0 },
        };
      }
      currentGroup.aiMessages.push(msg);

      // Link tool calls to results
      for (const tc of msg.toolCalls) {
        const linked: LinkedTool = { call: tc };
        const resultEntry = toolResultMap.get(tc.id);
        if (resultEntry) {
          linked.result = resultEntry.result;
          linked.resultMessage = resultEntry.message;
        }
        currentGroup.linkedTools.push(linked);
      }
    }
  }

  // Finish last group
  if (currentGroup) {
    currentGroup.metrics = calculateMetrics(currentGroup.aiMessages);
    groups.push(currentGroup);
  }

  return groups;
}
