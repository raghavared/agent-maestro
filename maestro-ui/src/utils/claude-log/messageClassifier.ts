import type { ParsedMessage } from './types';

export type MessageCategory = 'USER' | 'AI' | 'SYSTEM' | 'HARD_NOISE';

// Tags that indicate system output
const SYSTEM_OUTPUT_TAGS = ['<local-command-stdout>', '<local-command-stderr>'];
// Tags that indicate hard noise (never display)
const HARD_NOISE_TAGS = ['<local-command-caveat>', '<system-reminder>'];

const EMPTY_STDOUT = '<local-command-stdout></local-command-stdout>';
const EMPTY_STDERR = '<local-command-stderr></local-command-stderr>';

const TEAMMATE_REGEX = /^<teammate-message\s+teammate_id="([^"]+)"/;

function isTeammateMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user' || msg.isMeta) return false;
  const content = msg.content;
  if (typeof content === 'string') return TEAMMATE_REGEX.test(content.trim());
  if (Array.isArray(content)) {
    return content.some(b => b.type === 'text' && TEAMMATE_REGEX.test(b.text.trim()));
  }
  return false;
}

export function isHardNoiseMessage(msg: ParsedMessage): boolean {
  if (msg.type === 'system' || msg.type === 'summary' || msg.type === 'file-history-snapshot' || msg.type === 'queue-operation') return true;
  if (msg.type === 'assistant' && msg.model === '<synthetic>') return true;

  if (msg.type === 'user') {
    const content = msg.content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      for (const tag of HARD_NOISE_TAGS) {
        const closeTag = tag.replace('<', '</');
        if (trimmed.startsWith(tag) && trimmed.endsWith(closeTag)) return true;
      }
      if (trimmed === EMPTY_STDOUT || trimmed === EMPTY_STDERR) return true;
      if (trimmed.startsWith('[Request interrupted by user')) return true;
    }
    if (Array.isArray(content)) {
      if (content.length === 1 && content[0].type === 'text' && typeof content[0].text === 'string' && content[0].text.startsWith('[Request interrupted by user')) return true;
    }
  }
  return false;
}

export function isUserChunkMessage(msg: ParsedMessage): boolean {
  if (msg.type !== 'user') return false;
  if (msg.isMeta === true) return false;
  if (isTeammateMessage(msg)) return false;

  const content = msg.content;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    for (const tag of SYSTEM_OUTPUT_TAGS) {
      if (trimmed.startsWith(tag)) return false;
    }
    return trimmed.length > 0;
  }

  if (Array.isArray(content)) {
    const hasUserContent = content.some(b => b.type === 'text' || b.type === 'image');
    if (!hasUserContent) return false;
    if (content.length === 1 && content[0].type === 'text' && typeof content[0].text === 'string' && content[0].text.startsWith('[Request interrupted by user')) return false;
    for (const block of content) {
      if (block.type === 'text') {
        for (const tag of SYSTEM_OUTPUT_TAGS) {
          if (block.text.startsWith(tag)) return false;
        }
      }
    }
    return true;
  }
  return false;
}

export function classifyMessage(msg: ParsedMessage): MessageCategory {
  if (isHardNoiseMessage(msg)) return 'HARD_NOISE';
  if (isUserChunkMessage(msg)) return 'USER';
  if (msg.type === 'assistant') return 'AI';
  // Internal user messages (tool results) are part of AI flow
  if (msg.type === 'user' && msg.isMeta) return 'AI';
  // System output
  if (msg.type === 'user') {
    const content = msg.content;
    if (typeof content === 'string' && SYSTEM_OUTPUT_TAGS.some(tag => content.startsWith(tag))) return 'SYSTEM';
  }
  return 'AI';
}
