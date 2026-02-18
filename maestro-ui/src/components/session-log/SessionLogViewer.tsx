import React from 'react';
import type { ConversationGroup } from '../../utils/claude-log';
import { LogMessageGroup } from './LogMessageGroup';

interface SessionLogViewerProps {
  groups: ConversationGroup[];
}

export function SessionLogViewer({ groups }: SessionLogViewerProps) {
  if (groups.length === 0) {
    return <div className="terminalEmptyState">No conversation messages found in this log.</div>;
  }

  return (
    <div className="sessionLogViewer">
      {groups.map((group, i) => (
        <LogMessageGroup key={i} group={group} index={i} />
      ))}
    </div>
  );
}
