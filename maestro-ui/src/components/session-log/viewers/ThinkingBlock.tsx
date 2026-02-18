import React, { useState } from 'react';

interface ThinkingBlockProps {
  text: string;
}

export function ThinkingBlock({ text }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = text.slice(0, 80) + (text.length > 80 ? '...' : '');

  return (
    <div className="sessionLogThinking">
      <div
        className="sessionLogThinkingHeader"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sessionLogThinkingChevron">{expanded ? '▾' : '▸'}</span>
        <span className="sessionLogThinkingLabel">Thinking...</span>
        {!expanded && <span className="sessionLogThinkingPreview">{preview}</span>}
      </div>
      {expanded && (
        <div className="sessionLogThinkingBody">
          {text}
        </div>
      )}
    </div>
  );
}
