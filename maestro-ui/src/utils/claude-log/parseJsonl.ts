import type { ContentBlock, MessageType, ParsedMessage, SessionMetrics, UsageMetadata } from './types';
import { isConversationalEntry, isTextContent } from './types';
import { extractToolCalls, extractToolResults } from './toolExtraction';

function parseMessageType(type?: string): MessageType | null {
  switch (type) {
    case 'user': return 'user';
    case 'assistant': return 'assistant';
    case 'system': return 'system';
    case 'summary': return 'summary';
    case 'file-history-snapshot': return 'file-history-snapshot';
    case 'queue-operation': return 'queue-operation';
    default: return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseChatHistoryEntry(entry: any): ParsedMessage | null {
  if (!entry.uuid) return null;

  const type = parseMessageType(entry.type);
  if (!type) return null;

  let content: string | ContentBlock[] = '';
  let role: string | undefined;
  let usage: UsageMetadata | undefined;
  let model: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let agentId: string | undefined;
  let isSidechain = false;
  let isMeta = false;
  let userType: string | undefined;
  let sourceToolUseID: string | undefined;
  let toolUseResult: Record<string, unknown> | undefined;
  let parentUuid: string | null = null;
  let isCompactSummary = false;

  if (isConversationalEntry(entry.type)) {
    cwd = entry.cwd;
    gitBranch = entry.gitBranch;
    isSidechain = entry.isSidechain ?? false;
    userType = entry.userType;
    parentUuid = entry.parentUuid ?? null;

    if (entry.type === 'user') {
      content = entry.message?.content ?? '';
      role = entry.message?.role;
      agentId = entry.agentId;
      isMeta = entry.isMeta ?? false;
      sourceToolUseID = entry.sourceToolUseID;
      toolUseResult = entry.toolUseResult;
      isCompactSummary = entry.isCompactSummary === true;
    } else if (entry.type === 'assistant') {
      content = entry.message?.content ?? [];
      role = entry.message?.role;
      usage = entry.message?.usage;
      model = entry.message?.model;
      agentId = entry.agentId;
    } else if (entry.type === 'system') {
      isMeta = entry.isMeta ?? false;
    }
  }

  const toolCalls = extractToolCalls(content);
  const toolResultsList = extractToolResults(content);

  return {
    uuid: entry.uuid,
    parentUuid,
    type,
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    role,
    content,
    usage,
    model,
    cwd,
    gitBranch,
    agentId,
    isSidechain,
    isMeta,
    userType,
    isCompactSummary,
    toolCalls,
    toolResults: toolResultsList,
    sourceToolUseID,
    toolUseResult,
  };
}

export function parseJsonlLine(line: string): ParsedMessage | null {
  if (!line.trim()) return null;
  const entry = JSON.parse(line);
  return parseChatHistoryEntry(entry);
}

export function parseJsonlText(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = parseJsonlLine(line);
      if (parsed) messages.push(parsed);
    } catch {
      // skip invalid lines
    }
  }
  return messages;
}

export function calculateMetrics(messages: ParsedMessage[]): SessionMetrics {
  if (messages.length === 0) {
    return { durationMs: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, messageCount: 0 };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  const timestamps = messages.map(m => m.timestamp.getTime()).filter(t => !isNaN(t));
  let minTime = 0, maxTime = 0;
  if (timestamps.length > 0) {
    minTime = timestamps[0];
    maxTime = timestamps[0];
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < minTime) minTime = timestamps[i];
      if (timestamps[i] > maxTime) maxTime = timestamps[i];
    }
  }

  for (const msg of messages) {
    if (msg.usage) {
      inputTokens += msg.usage.input_tokens ?? 0;
      outputTokens += msg.usage.output_tokens ?? 0;
      cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
      cacheCreationTokens += msg.usage.cache_creation_input_tokens ?? 0;
    }
  }

  return {
    durationMs: maxTime - minTime,
    totalTokens: inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    messageCount: messages.length,
  };
}

export function extractTextContent(message: ParsedMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .filter(isTextContent)
    .map(block => block.text)
    .join('\n');
}
