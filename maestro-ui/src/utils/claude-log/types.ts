// Content block types from Claude Code JSONL format

export type MessageType = 'user' | 'assistant' | 'system' | 'summary' | 'file-history-snapshot' | 'queue-operation';

export interface TextContent { type: 'text'; text: string; }
export interface ThinkingContent { type: 'thinking'; thinking: string; signature: string; }
export interface ToolUseContent { type: 'tool_use'; id: string; name: string; input: Record<string, unknown>; }
export interface ToolResultContent { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[]; is_error?: boolean; }
export interface ImageContent { type: 'image'; source: { type: 'base64'; media_type: string; data: string; }; }

export type ContentBlock = TextContent | ThinkingContent | ToolUseContent | ToolResultContent | ImageContent;

export interface UsageMetadata {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  isTask: boolean;
  taskDescription?: string;
  taskSubagentType?: string;
}

export interface ToolResult {
  toolUseId: string;
  content: string | unknown[];
  isError: boolean;
}

export interface ParsedMessage {
  uuid: string;
  parentUuid: string | null;
  type: MessageType;
  timestamp: Date;
  role?: string;
  content: ContentBlock[] | string;
  usage?: UsageMetadata;
  model?: string;
  cwd?: string;
  gitBranch?: string;
  agentId?: string;
  isSidechain: boolean;
  isMeta: boolean;
  userType?: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  sourceToolUseID?: string;
  toolUseResult?: Record<string, unknown>;
  isCompactSummary?: boolean;
}

export interface SessionMetrics {
  durationMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  messageCount: number;
}

// Type guards
export function isTextContent(block: ContentBlock): block is TextContent {
  return block.type === 'text';
}

export function isToolResultContent(block: ContentBlock): block is ToolResultContent {
  return block.type === 'tool_result';
}

export function isConversationalEntry(type: string): boolean {
  return type === 'user' || type === 'assistant' || type === 'system';
}
