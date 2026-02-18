import type { ParsedMessage } from './types';

type ActivityType = 'text_output' | 'thinking' | 'tool_use' | 'tool_result' | 'interruption' | 'exit_plan_mode';

interface Activity {
  type: ActivityType;
  index: number;
}

function isShutdownResponse(block: { name?: string; input?: Record<string, unknown> }): boolean {
  return (
    block.name === 'SendMessage' &&
    block.input?.type === 'shutdown_response' &&
    block.input?.approve === true
  );
}

export function checkMessagesOngoing(messages: ParsedMessage[]): boolean {
  const activities: Activity[] = [];
  let activityIndex = 0;
  const shutdownToolIds = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'thinking' && block.thinking) {
          activities.push({ type: 'thinking', index: activityIndex++ });
        } else if (block.type === 'tool_use' && block.id) {
          if (block.name === 'ExitPlanMode') {
            activities.push({ type: 'exit_plan_mode', index: activityIndex++ });
          } else if (isShutdownResponse(block)) {
            shutdownToolIds.add(block.id);
            activities.push({ type: 'interruption', index: activityIndex++ });
          } else {
            activities.push({ type: 'tool_use', index: activityIndex++ });
          }
        } else if (block.type === 'text' && block.text && String(block.text).trim().length > 0) {
          activities.push({ type: 'text_output', index: activityIndex++ });
        }
      }
    } else if (msg.type === 'user' && Array.isArray(msg.content)) {
      const isRejection = msg.toolUseResult === ('User rejected tool use' as unknown);

      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          if (shutdownToolIds.has(block.tool_use_id) || isRejection) {
            activities.push({ type: 'interruption', index: activityIndex++ });
          } else {
            activities.push({ type: 'tool_result', index: activityIndex++ });
          }
        }
        if (
          block.type === 'text' &&
          typeof block.text === 'string' &&
          block.text.startsWith('[Request interrupted by user')
        ) {
          activities.push({ type: 'interruption', index: activityIndex++ });
        }
      }
    }
  }

  if (activities.length === 0) return false;

  let lastEndingIndex = -1;
  for (let i = activities.length - 1; i >= 0; i--) {
    const t = activities[i].type;
    if (t === 'text_output' || t === 'interruption' || t === 'exit_plan_mode') {
      lastEndingIndex = activities[i].index;
      break;
    }
  }

  if (lastEndingIndex === -1) {
    return activities.some(a => a.type === 'thinking' || a.type === 'tool_use' || a.type === 'tool_result');
  }

  return activities.some(
    a => a.index > lastEndingIndex && (a.type === 'thinking' || a.type === 'tool_use' || a.type === 'tool_result')
  );
}
