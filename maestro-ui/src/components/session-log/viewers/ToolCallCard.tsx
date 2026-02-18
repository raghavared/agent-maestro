import React, { useState } from 'react';
import type { LinkedTool } from '../../../utils/claude-log';
import { DiffViewer } from './DiffViewer';
import { CodeBlockViewer } from './CodeBlockViewer';
import { BashOutputBlock } from './BashOutputBlock';
import { SubagentCard } from './SubagentCard';

interface ToolCallCardProps {
  tool: LinkedTool;
}

function getToolSummary(tool: LinkedTool): string {
  const input = tool.call.input;
  switch (tool.call.name) {
    case 'Read':
      return String(input.file_path ?? input.path ?? '');
    case 'Edit':
      return String(input.file_path ?? '');
    case 'Write':
      return String(input.file_path ?? '');
    case 'Bash':
      return String(input.command ?? '').slice(0, 80);
    case 'Glob':
      return String(input.pattern ?? '');
    case 'Grep':
      return String(input.pattern ?? '');
    case 'Task':
      return tool.call.taskDescription ?? String(input.description ?? '');
    default:
      return '';
  }
}

function getResultContent(tool: LinkedTool): string {
  if (!tool.result) return '';
  const c = tool.result.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .filter((b: unknown) => typeof b === 'object' && b !== null && 'type' in b && (b as {type: string}).type === 'text')
      .map((b: unknown) => (b as {text: string}).text)
      .join('\n');
  }
  return '';
}

function getToolIcon(name: string): string {
  switch (name) {
    case 'Read': return '📄';
    case 'Edit': return '✏️';
    case 'Write': return '📝';
    case 'Bash': return '⌨️';
    case 'Glob': return '🔍';
    case 'Grep': return '🔎';
    case 'Task': return '🤖';
    case 'WebFetch': return '🌐';
    case 'WebSearch': return '🔍';
    case 'SendMessage': return '💬';
    default: return '🔧';
  }
}

export function ToolCallCard({ tool }: ToolCallCardProps) {
  // Task tool calls get special subagent rendering
  if (tool.call.isTask) {
    return <SubagentCard tool={tool} />;
  }

  const [expanded, setExpanded] = useState(false);
  const summary = getToolSummary(tool);
  const isError = tool.result?.isError ?? false;

  return (
    <div className={`sessionLogToolCard ${isError ? 'sessionLogToolCardError' : ''}`}>
      <div
        className="sessionLogToolCardHeader"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sessionLogToolCardChevron">{expanded ? '▾' : '▸'}</span>
        <span className="sessionLogToolCardIcon">{getToolIcon(tool.call.name)}</span>
        <span className="sessionLogToolCardName">{tool.call.name}</span>
        {summary && <span className="sessionLogToolCardSummary">{summary}</span>}
        {isError && <span className="sessionLogToolCardErrorBadge">ERROR</span>}
      </div>
      {expanded && (
        <div className="sessionLogToolCardBody">
          <ToolCallContent tool={tool} />
        </div>
      )}
    </div>
  );
}

function ToolCallContent({ tool }: { tool: LinkedTool }) {
  const input = tool.call.input;
  const resultContent = getResultContent(tool);

  switch (tool.call.name) {
    case 'Edit': {
      const filePath = String(input.file_path ?? '');
      const oldStr = String(input.old_string ?? '');
      const newStr = String(input.new_string ?? '');
      return <DiffViewer fileName={filePath} oldString={oldStr} newString={newStr} />;
    }
    case 'Read': {
      const filePath = String(input.file_path ?? '');
      return <CodeBlockViewer filePath={filePath} content={resultContent} />;
    }
    case 'Write': {
      const filePath = String(input.file_path ?? '');
      const content = String(input.content ?? '');
      return <CodeBlockViewer filePath={filePath} content={content} />;
    }
    case 'Bash': {
      const command = String(input.command ?? '');
      return <BashOutputBlock command={command} output={resultContent} isError={tool.result?.isError} />;
    }
    case 'Glob':
    case 'Grep': {
      if (resultContent) {
        return <CodeBlockViewer content={resultContent} />;
      }
      return <pre className="sessionLogJsonBlock">{JSON.stringify(input, null, 2)}</pre>;
    }
    default: {
      return (
        <div>
          <div className="sessionLogJsonSection">
            <div className="sessionLogJsonLabel">Input:</div>
            <pre className="sessionLogJsonBlock">{JSON.stringify(input, null, 2)}</pre>
          </div>
          {resultContent && (
            <div className="sessionLogJsonSection">
              <div className="sessionLogJsonLabel">Output:</div>
              <pre className="sessionLogJsonBlock">{resultContent.slice(0, 5000)}</pre>
            </div>
          )}
        </div>
      );
    }
  }
}
