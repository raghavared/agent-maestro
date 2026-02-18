import React from 'react';

interface DiffViewerProps {
  fileName: string;
  oldString: string;
  newString: string;
}

interface DiffLine {
  type: 'removed' | 'added' | 'context';
  content: string;
  lineNumber: number;
}

function computeLCSMatrix(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const matrix: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }
  return matrix;
}

function generateDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const matrix = computeLCSMatrix(oldLines, newLines);
  const temp: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: 'context', content: oldLines[i - 1], lineNumber: 0 });
      i--; j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      temp.push({ type: 'added', content: newLines[j - 1], lineNumber: 0 });
      j--;
    } else if (i > 0) {
      temp.push({ type: 'removed', content: oldLines[i - 1], lineNumber: 0 });
      i--;
    }
  }

  temp.reverse();
  let lineNumber = 1;
  for (const line of temp) {
    line.lineNumber = lineNumber++;
  }
  return temp;
}

function computeStats(diffLines: DiffLine[]): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const line of diffLines) {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
  }
  return { added, removed };
}

export function DiffViewer({ fileName, oldString, newString }: DiffViewerProps) {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const diffLines = generateDiff(oldLines, newLines);
  const stats = computeStats(diffLines);
  const baseName = fileName.split('/').pop() ?? fileName;

  return (
    <div className="sessionLogDiff">
      <div className="sessionLogFileHeader">
        <span className="sessionLogFileName">{baseName}</span>
        <span className="sessionLogDiffStats">
          {stats.added > 0 && <span className="sessionLogDiffAdded">+{stats.added}</span>}
          {stats.removed > 0 && <span className="sessionLogDiffRemoved">-{stats.removed}</span>}
        </span>
      </div>
      <div className="sessionLogDiffBody">
        {diffLines.map((line, idx) => (
          <div
            key={idx}
            className={`sessionLogDiffLine ${
              line.type === 'added' ? 'sessionLogDiffLineAdded' :
              line.type === 'removed' ? 'sessionLogDiffLineRemoved' : ''
            }`}
          >
            <span className="sessionLogLineNum">{line.lineNumber}</span>
            <span className="sessionLogDiffPrefix">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="sessionLogLineContent">{line.content || ' '}</span>
          </div>
        ))}
        {diffLines.length === 0 && (
          <div className="sessionLogDiffEmpty">No changes detected</div>
        )}
      </div>
    </div>
  );
}
