import React, { useMemo, useState } from 'react';
import type { LinkedTool } from '../../../utils/claude-log';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { TextBlock } from './TextBlock';
import { TokenUsageBadge } from './TokenUsageBadge';

interface SubagentCardProps {
  tool: LinkedTool;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface SubagentResult {
  status?: string;
  durationMs?: number;
  totalTokens?: number;
  usage?: { input_tokens?: number; output_tokens?: number };
  content?: string;
}

export function SubagentCard({ tool }: SubagentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [traceExpanded, setTraceExpanded] = useState(false);

  const description = tool.call.taskDescription ?? String(tool.call.input.description ?? 'Subagent');
  const subagentType = tool.call.taskSubagentType ?? String(tool.call.input.subagent_type ?? 'Task');
  const truncatedDesc = description.length > 60 ? description.slice(0, 60) + '...' : description;

  // Parse result data
  const resultData = useMemo((): SubagentResult => {
    if (!tool.result) return {};
    const content = tool.result.content;
    if (typeof content !== 'string') return {};

    // The result might contain structured data or just text
    // Try to extract useful info
    return {
      content: typeof content === 'string' ? content : '',
      status: tool.result.isError ? 'error' : 'completed',
    };
  }, [tool.result]);

  // Try to extract tool use result metadata (duration, tokens etc)
  const metadata = useMemo(() => {
    if (!tool.resultMessage?.toolUseResult) return null;
    const r = tool.resultMessage.toolUseResult;
    return {
      durationMs: r.totalDurationMs as number | undefined,
      totalTokens: r.totalTokens as number | undefined,
      usage: r.usage as { input_tokens?: number; output_tokens?: number } | undefined,
    };
  }, [tool.resultMessage]);

  const isError = tool.result?.isError ?? false;
  const isCompleted = !!tool.result;

  return (
    <div className={`sessionLogSubagent ${isError ? 'sessionLogSubagentError' : ''}`}>
      {/* Header */}
      <div
        className="sessionLogSubagentHeader"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sessionLogToolCardChevron">{expanded ? '▾' : '▸'}</span>
        <span className="sessionLogSubagentIcon">
          {isCompleted ? (isError ? '✗' : '✓') : '⟳'}
        </span>
        <span className="sessionLogSubagentTypeBadge">{subagentType}</span>
        <span className="sessionLogSubagentDesc">{truncatedDesc}</span>

        {/* Metrics */}
        {metadata?.totalTokens && (
          <span className="sessionLogSubagentMetric">
            {formatTokenCount(metadata.totalTokens)} tok
          </span>
        )}
        {metadata?.durationMs && (
          <span className="sessionLogSubagentMetric">
            {formatDuration(metadata.durationMs)}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="sessionLogSubagentBody">
          {/* Meta info row */}
          <div className="sessionLogSubagentMeta">
            <span>Type: <strong>{subagentType}</strong></span>
            {metadata?.durationMs && <span> · Duration: <strong>{formatDuration(metadata.durationMs)}</strong></span>}
            {metadata?.totalTokens && <span> · Tokens: <strong>{metadata.totalTokens.toLocaleString()}</strong></span>}
          </div>

          {/* Description */}
          <div className="sessionLogSubagentFullDesc">{description}</div>

          {/* Usage breakdown */}
          {metadata?.usage && (
            <div className="sessionLogSubagentUsage">
              <div className="sessionLogSubagentUsageTitle">Context Usage</div>
              {metadata.usage.input_tokens && (
                <div className="sessionLogSubagentUsageRow">
                  <span>Input</span>
                  <span>{metadata.usage.input_tokens.toLocaleString()}</span>
                </div>
              )}
              {metadata.usage.output_tokens && (
                <div className="sessionLogSubagentUsageRow">
                  <span>Output</span>
                  <span>{metadata.usage.output_tokens.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Result content preview */}
          {resultData.content && (
            <div className="sessionLogSubagentResult">
              <div
                className="sessionLogSubagentTraceToggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setTraceExpanded(!traceExpanded);
                }}
              >
                <span>{traceExpanded ? '▾' : '▸'}</span>
                <span>Result Output</span>
              </div>
              {traceExpanded && (
                <div className="sessionLogSubagentTraceContent">
                  {resultData.content.slice(0, 5000)}
                  {resultData.content.length > 5000 && (
                    <div className="sessionLogCodeTruncated">
                      ... {resultData.content.length - 5000} more characters
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
