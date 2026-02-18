import React from 'react';

interface CodeBlockViewerProps {
  filePath?: string;
  content: string;
  maxLines?: number;
}

function inferLanguage(filePath: string): string {
  const ext = filePath.match(/(\.[^./]+)$/)?.[1]?.toLowerCase();
  if (!ext) return 'text';
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.py': 'python', '.rs': 'rust', '.go': 'go', '.css': 'css',
    '.html': 'html', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.sh': 'bash', '.md': 'markdown', '.sql': 'sql', '.toml': 'toml',
    '.c': 'c', '.cpp': 'cpp', '.java': 'java', '.rb': 'ruby', '.php': 'php',
  };
  return map[ext] ?? 'text';
}

export function CodeBlockViewer({ filePath, content, maxLines = 200 }: CodeBlockViewerProps) {
  const lines = content.split('\n');
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;
  const lang = filePath ? inferLanguage(filePath) : 'text';

  return (
    <div className="sessionLogCode">
      {filePath && (
        <div className="sessionLogFileHeader">
          <span className="sessionLogFileName">{filePath.split('/').pop()}</span>
          <span className="sessionLogLangBadge">{lang}</span>
        </div>
      )}
      <div className="sessionLogCodeBody">
        {displayLines.map((line, i) => (
          <div key={i} className="sessionLogCodeLine">
            <span className="sessionLogLineNum">{i + 1}</span>
            <span className="sessionLogLineContent">{line || ' '}</span>
          </div>
        ))}
        {truncated && (
          <div className="sessionLogCodeTruncated">
            ... {lines.length - maxLines} more lines
          </div>
        )}
      </div>
    </div>
  );
}
