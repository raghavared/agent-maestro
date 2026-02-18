import React, { useMemo } from 'react';
import type { ConversationGroup } from '../../utils/claude-log';
import { isTextContent, parseAllTeammateMessages } from '../../utils/claude-log';
import { ThinkingBlock } from './viewers/ThinkingBlock';
import { TextBlock } from './viewers/TextBlock';
import { ToolCallCard } from './viewers/ToolCallCard';
import { TokenUsageBadge } from './viewers/TokenUsageBadge';
import { TeammateMessageCard } from './viewers/TeammateMessageCard';

interface LogMessageGroupProps {
  group: ConversationGroup;
  index: number;
}

function extractUserText(group: ConversationGroup): string {
  if (!group.userMessage) return '';
  const content = group.userMessage.content;
  if (typeof content === 'string') return content;
  return content
    .filter(isTextContent)
    .map(b => b.text)
    .join('\n');
}

export function LogMessageGroup({ group, index }: LogMessageGroupProps) {
  const userText = extractUserText(group);

  // Check for teammate messages in AI flow messages
  const teammateMessages = useMemo(() => {
    const results: ReturnType<typeof parseAllTeammateMessages> = [];
    for (const msg of group.aiMessages) {
      if (msg.type !== 'user') continue;
      const raw = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter(isTextContent).map(b => b.text).join('\n');
      const parsed = parseAllTeammateMessages(raw);
      results.push(...parsed);
    }
    return results;
  }, [group.aiMessages]);

  return (
    <div className="sessionLogGroup">
      {/* User message */}
      {group.userMessage && (
        <div className="sessionLogUserMsg">
          <div className="sessionLogUserLabel">User</div>
          <div className="sessionLogUserText">{userText}</div>
        </div>
      )}

      {/* AI content blocks */}
      <div className="sessionLogAiBlock">
        {group.aiMessages.map((msg, msgIdx) => {
          if (typeof msg.content === 'string') return null;
          return msg.content.map((block, blockIdx) => {
            const key = `${msgIdx}-${blockIdx}`;
            if (block.type === 'thinking') {
              return <ThinkingBlock key={key} text={block.thinking} />;
            }
            if (block.type === 'text' && block.text.trim()) {
              return <TextBlock key={key} text={block.text} />;
            }
            return null;
          });
        })}

        {/* Teammate messages */}
        {teammateMessages.map((tm, i) => (
          <TeammateMessageCard key={`tm-${i}`} message={tm} />
        ))}

        {/* Tool calls */}
        {group.linkedTools.map((tool, i) => (
          <ToolCallCard key={`tool-${i}`} tool={tool} />
        ))}

        {/* Metrics */}
        {group.metrics.totalTokens > 0 && (
          <div className="sessionLogGroupFooter">
            <TokenUsageBadge
              inputTokens={group.metrics.inputTokens}
              outputTokens={group.metrics.outputTokens}
            />
          </div>
        )}
      </div>
    </div>
  );
}
