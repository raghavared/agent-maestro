import type { ParsedMessage } from './types';

export interface ContextCategory {
  label: string;
  tokenCount: number;
  items: ContextItem[];
}

export interface ContextItem {
  name: string;
  tokens: number;
  count: number;
}

/** Tool names that constitute task coordination */
const TASK_COORD_TOOLS = new Set([
  'SendMessage', 'TeamCreate', 'TeamDelete', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
]);

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function getResultTokens(msg: ParsedMessage): number {
  for (const tr of msg.toolResults) {
    if (typeof tr.content === 'string') return estimateTokens(tr.content);
  }
  return 0;
}

export function trackContext(messages: ParsedMessage[]): ContextCategory[] {
  // Accumulators
  let thinkingTokens = 0;
  let textOutputTokens = 0;
  let userMessageTokens = 0;
  const toolTokens = new Map<string, { tokens: number; count: number }>();
  const taskCoordTokens = new Map<string, { tokens: number; count: number }>();
  const mentionedFiles = new Map<string, number>();

  for (const msg of messages) {
    if (msg.type === 'assistant') {
      // Count from usage metadata if available
      if (msg.usage) {
        // We don't double-count, we attribute via content analysis below
      }

      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'thinking') {
            thinkingTokens += estimateTokens(block.thinking);
          } else if (block.type === 'text') {
            textOutputTokens += estimateTokens(block.text);
          } else if (block.type === 'tool_use') {
            const inputStr = JSON.stringify(block.input ?? {});
            const tokens = estimateTokens(inputStr);
            const toolName = block.name;

            if (TASK_COORD_TOOLS.has(toolName)) {
              const existing = taskCoordTokens.get(toolName) ?? { tokens: 0, count: 0 };
              existing.tokens += tokens;
              existing.count += 1;
              taskCoordTokens.set(toolName, existing);
            } else {
              const existing = toolTokens.get(toolName) ?? { tokens: 0, count: 0 };
              existing.tokens += tokens;
              existing.count += 1;
              toolTokens.set(toolName, existing);
            }

            // Track file mentions from Read/Edit/Write/Glob/Grep
            if (['Read', 'Edit', 'Write'].includes(toolName)) {
              const filePath = String(block.input?.file_path ?? block.input?.path ?? '');
              if (filePath) {
                mentionedFiles.set(filePath, (mentionedFiles.get(filePath) ?? 0) + 1);
              }
            }
          }
        }
      }
    } else if (msg.type === 'user') {
      if (!msg.isMeta) {
        // Real user message
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        userMessageTokens += estimateTokens(content);
      } else {
        // Tool results - attribute to the tool
        for (const tr of msg.toolResults) {
          const resultContent = typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content);
          const tokens = estimateTokens(resultContent);

          // Find which tool this result belongs to by matching through all messages
          // For simplicity, just add to a generic "tool results" bucket
          const existing = toolTokens.get('_results') ?? { tokens: 0, count: 0 };
          existing.tokens += tokens;
          existing.count += 1;
          toolTokens.set('_results', existing);
        }
      }
    }
  }

  // Build categories
  const categories: ContextCategory[] = [];

  // 1. User Messages
  if (userMessageTokens > 0) {
    categories.push({
      label: 'User Messages',
      tokenCount: userMessageTokens,
      items: [{ name: 'User input', tokens: userMessageTokens, count: 1 }],
    });
  }

  // 2. Tool Outputs
  const toolItems: ContextItem[] = [];
  let totalToolTokens = 0;
  for (const [name, data] of toolTokens) {
    if (name === '_results') continue;
    toolItems.push({ name, tokens: data.tokens, count: data.count });
    totalToolTokens += data.tokens;
  }
  // Add results
  const results = toolTokens.get('_results');
  if (results) {
    toolItems.push({ name: 'Tool Results', tokens: results.tokens, count: results.count });
    totalToolTokens += results.tokens;
  }
  toolItems.sort((a, b) => b.tokens - a.tokens);
  if (toolItems.length > 0) {
    categories.push({ label: 'Tool Usage', tokenCount: totalToolTokens, items: toolItems });
  }

  // 3. Task Coordination
  const coordItems: ContextItem[] = [];
  let totalCoordTokens = 0;
  for (const [name, data] of taskCoordTokens) {
    coordItems.push({ name, tokens: data.tokens, count: data.count });
    totalCoordTokens += data.tokens;
  }
  coordItems.sort((a, b) => b.tokens - a.tokens);
  if (coordItems.length > 0) {
    categories.push({ label: 'Task Coordination', tokenCount: totalCoordTokens, items: coordItems });
  }

  // 4. Thinking & Text
  if (thinkingTokens > 0 || textOutputTokens > 0) {
    const items: ContextItem[] = [];
    if (thinkingTokens > 0) items.push({ name: 'Thinking', tokens: thinkingTokens, count: 1 });
    if (textOutputTokens > 0) items.push({ name: 'Text Output', tokens: textOutputTokens, count: 1 });
    categories.push({
      label: 'Thinking & Text',
      tokenCount: thinkingTokens + textOutputTokens,
      items,
    });
  }

  // 5. Mentioned Files
  if (mentionedFiles.size > 0) {
    const fileItems: ContextItem[] = [];
    let totalFileTokens = 0;
    for (const [path, count] of mentionedFiles) {
      const fileName = path.split('/').pop() ?? path;
      fileItems.push({ name: fileName, tokens: 0, count });
      totalFileTokens += count;
    }
    fileItems.sort((a, b) => b.count - a.count);
    categories.push({
      label: 'Files Touched',
      tokenCount: totalFileTokens,
      items: fileItems.slice(0, 20), // Limit to top 20
    });
  }

  return categories;
}
