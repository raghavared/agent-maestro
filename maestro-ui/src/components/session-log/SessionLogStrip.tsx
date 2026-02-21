import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { parseJsonlText, groupMessages, checkMessagesOngoing } from '../../utils/claude-log';
import type { ParsedMessage, ConversationGroup } from '../../utils/claude-log';
import { LogMessageGroup } from './LogMessageGroup';

interface ClaudeLogFile {
  filename: string;
  relativePath?: string;
  modifiedAt: number;
  size: number;
  maestroSessionId?: string | null;
}

interface LogTailResult {
  content: string;
  newOffset: number;
  fileSize: number;
}

interface SessionLogStripProps {
  cwd: string;
  maestroSessionId: string;
  agentTool?: string | null;
}

const POLL_INTERVAL = 2000;
type LogProvider = 'claude' | 'codex';

function resolveLogProvider(agentTool?: string | null): LogProvider {
  return agentTool === 'codex' ? 'codex' : 'claude';
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface StripStats {
  /** Current context window size (from last assistant msg) */
  contextTokens: number;
  /** Cache hit % of context */
  cacheHitPct: number;
  /** Cumulative output tokens generated */
  totalOutput: number;
  /** Number of API turns (assistant messages with usage) */
  turns: number;
  /** Total tool calls */
  toolCalls: number;
  /** Total messages in log */
  messageCount: number;
  /** Duration from first to last message */
  durationMs: number;
  /** Model name from last assistant */
  model: string | null;
}

function computeStripStats(messages: ParsedMessage[]): StripStats {
  let totalOutput = 0;
  let turns = 0;
  let toolCalls = 0;
  let contextTokens = 0;
  let cacheHitPct = 0;
  let model: string | null = null;

  const timestamps = messages.map(m => m.timestamp.getTime()).filter(t => !isNaN(t));
  let durationMs = 0;
  if (timestamps.length >= 2) {
    let min = timestamps[0], max = timestamps[0];
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < min) min = timestamps[i];
      if (timestamps[i] > max) max = timestamps[i];
    }
    durationMs = max - min;
  }

  for (const msg of messages) {
    toolCalls += msg.toolCalls.length;

    if (msg.usage) {
      totalOutput += msg.usage.output_tokens ?? 0;
      turns++;

      // Use the latest assistant message's usage as "current context"
      const input = msg.usage.input_tokens ?? 0;
      const cacheRead = msg.usage.cache_read_input_tokens ?? 0;
      const cacheCreate = msg.usage.cache_creation_input_tokens ?? 0;
      contextTokens = input + cacheRead + cacheCreate;
      const totalInput = contextTokens;
      cacheHitPct = totalInput > 0 ? Math.round((cacheRead / totalInput) * 100) : 0;
    }

    if (msg.model) model = msg.model;
  }

  return {
    contextTokens,
    cacheHitPct,
    totalOutput,
    turns,
    toolCalls,
    messageCount: messages.length,
    durationMs,
    model,
  };
}

export function SessionLogStrip({ cwd, maestroSessionId, agentTool }: SessionLogStripProps) {
  const provider = resolveLogProvider(agentTool);
  const [resolvedProvider, setResolvedProvider] = useState<LogProvider>(provider);
  const [allMessages, setAllMessages] = useState<ParsedMessage[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const offsetRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const getLogFilePath = useCallback((f: ClaudeLogFile) => f.relativePath ?? f.filename, []);

  const autoScroll = useCallback(() => {
    const el = bodyRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  }, []);

  // Find the matching log file — retry until found
  useEffect(() => {
    let cancelled = false;

    // Reset discovery state when source inputs change.
    setReady(false);
    setSelectedFile(null);
    setResolvedProvider(provider);

    const providerOrder: LogProvider[] = provider === 'codex'
      ? ['codex', 'claude']
      : ['claude', 'codex'];

    const search = async () => {
      for (const candidate of providerOrder) {
        try {
          const listCommand = candidate === 'codex' ? 'list_codex_session_logs' : 'list_claude_session_logs';
          const files = await invoke<ClaudeLogFile[]>(listCommand, { cwd });
          if (cancelled) return;
          const match = files.find((f) => f.maestroSessionId === maestroSessionId);
          if (match) {
            setSelectedFile(getLogFilePath(match));
            setResolvedProvider(candidate);
            setReady(true);
            return;
          }
        } catch {
          // Try the next provider.
        }
      }

      if (!cancelled) {
        setTimeout(search, POLL_INTERVAL);
      }
    };

    search();
    return () => { cancelled = true; };
  }, [cwd, maestroSessionId, provider, getLogFilePath]);

  // Initial full load
  useEffect(() => {
    if (!selectedFile) return;
    setAllMessages([]);
    offsetRef.current = 0;

    const readCommand = resolvedProvider === 'codex' ? 'read_codex_session_log' : 'read_claude_session_log';
    invoke<string>(readCommand, { cwd, filename: selectedFile })
      .then((content) => {
        const messages = parseJsonlText(content);
        setAllMessages(messages);
        offsetRef.current = new Blob([content]).size;
        setTimeout(autoScroll, 50);
      })
      .catch(() => {});
  }, [cwd, selectedFile, autoScroll, resolvedProvider]);

  // Live polling
  useEffect(() => {
    if (!selectedFile) return;

    const poll = async () => {
      try {
        const tailCommand = resolvedProvider === 'codex' ? 'tail_codex_session_log' : 'tail_claude_session_log';
        const result = await invoke<LogTailResult>(tailCommand, {
          cwd,
          filename: selectedFile,
          offset: offsetRef.current,
        });
        if (result.content.length > 0) {
          const newMessages = parseJsonlText(result.content);
          if (newMessages.length > 0) {
            setAllMessages((prev) => [...prev, ...newMessages]);
            setTimeout(autoScroll, 50);
          }
          offsetRef.current = result.newOffset;
        }
      } catch {
        // ignore poll errors
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedFile, cwd, autoScroll, resolvedProvider]);

  const { groups, isOngoing, stats } = useMemo(() => {
    if (allMessages.length === 0) {
      return {
        groups: [] as ConversationGroup[],
        isOngoing: false,
        stats: { contextTokens: 0, cacheHitPct: 0, totalOutput: 0, turns: 0, toolCalls: 0, messageCount: 0, durationMs: 0, model: null } as StripStats,
      };
    }
    return {
      groups: groupMessages(allMessages),
      isOngoing: checkMessagesOngoing(allMessages),
      stats: computeStripStats(allMessages),
    };
  }, [allMessages]);

  // Don't render until we've found the log file
  if (!ready || !selectedFile) return null;

  return (
    <div className={`sessionLogStrip ${expanded ? 'sessionLogStrip--expanded' : ''}`}>
      {/* Collapsed stats bar - always visible */}
      <div
        className="sessionLogStripBar"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
      >
        <div className="sessionLogStripBarLeft">
          <span className="sessionLogStripChevron">{expanded ? '▾' : '▸'}</span>
          <span className="sessionLogStripLabel">Session Log</span>
          {isOngoing && <span className="sessionLogStripLiveDot" />}
          {isOngoing && <span className="sessionLogStripLiveTag">LIVE</span>}
        </div>
        <div className="sessionLogStripBarStats">
          {stats.contextTokens > 0 && (
            <span className="sessionLogStripStat" title="Current context window">
              ctx {formatTokens(stats.contextTokens)}
            </span>
          )}
          {stats.cacheHitPct > 0 && (
            <span className="sessionLogStripStat sessionLogStripStat--cache" title="Cache hit rate">
              ⚡{stats.cacheHitPct}%
            </span>
          )}
          {stats.totalOutput > 0 && (
            <span className="sessionLogStripStat sessionLogStripStat--dim" title="Total output tokens">
              out {formatTokens(stats.totalOutput)}
            </span>
          )}
          {stats.turns > 0 && (
            <span className="sessionLogStripStat sessionLogStripStat--dim" title="API turns">
              {stats.turns} {stats.turns === 1 ? 'turn' : 'turns'}
            </span>
          )}
          {stats.toolCalls > 0 && (
            <span className="sessionLogStripStat sessionLogStripStat--dim" title="Tool calls">
              {stats.toolCalls} tools
            </span>
          )}
          {stats.durationMs > 0 && (
            <span className="sessionLogStripStat sessionLogStripStat--dim" title="Duration">
              {formatDuration(stats.durationMs)}
            </span>
          )}
          {stats.model && (
            <span className="sessionLogStripStat sessionLogStripStat--model" title="Model">
              {stats.model.replace('claude-', '').replace(/-\d{8}$/, '')}
            </span>
          )}
        </div>
      </div>

      {/* Expanded: full log viewer overlay */}
      {expanded && (
        <div
          className="sessionLogStripOverlay"
          ref={bodyRef}
          onScroll={handleScroll}
        >
          {allMessages.length === 0 ? (
            <div className="sessionLogStripEmpty">Waiting for log data...</div>
          ) : (
            <div className="sessionLogViewer">
              {groups.map((group, i) => (
                <LogMessageGroup key={i} group={group} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
