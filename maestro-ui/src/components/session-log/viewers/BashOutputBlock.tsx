import React, { useState } from 'react';

interface BashOutputBlockProps {
  command: string;
  output: string;
  isError?: boolean;
}

const MAX_LINES = 200;

export function BashOutputBlock({ command, output, isError }: BashOutputBlockProps) {
  const [showAll, setShowAll] = useState(false);
  const lines = output.split('\n');
  const truncated = lines.length > MAX_LINES && !showAll;
  const displayLines = truncated ? lines.slice(0, MAX_LINES) : lines;

  return (
    <div className="sessionLogBash">
      <div className="sessionLogBashCommand">
        <span className="sessionLogBashPrompt">$</span>
        <span>{command}</span>
      </div>
      {output && (
        <div className={`sessionLogBashOutput ${isError ? 'sessionLogBashError' : ''}`}>
          {displayLines.map((line, i) => (
            <div key={i}>{line || ' '}</div>
          ))}
          {truncated && (
            <button
              className="sessionLogShowMore"
              onClick={() => setShowAll(true)}
            >
              Show {lines.length - MAX_LINES} more lines
            </button>
          )}
        </div>
      )}
    </div>
  );
}
