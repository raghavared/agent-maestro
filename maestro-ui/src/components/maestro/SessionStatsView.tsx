import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useProjectStore } from "../../stores/useProjectStore";
import type {
  MaestroSession,
  MaestroSessionStatus,
  SessionTimelineEventType,
  TaskSessionStatus,
} from "../../app/types/maestro";
import { SessionDetailsSection } from "./SessionDetailsSection";
import { DocsList } from "./DocsList";
import { SessionTimeline } from "./SessionTimeline";
import { StrategyBadge } from "./StrategyBadge";
import { buildChildrenByParent, collectSubtreeIds } from "../../utils/sessionLifecycle";
import { isCoordinatorRole } from "../../utils/coordinatorRole";
import {
  parseJsonlText,
  calculateMetrics,
  extractTextContent,
  type ParsedMessage,
} from "../../utils/claude-log";

interface ClaudeLogFile {
  filename: string;
  relativePath?: string;
  modifiedAt: number;
  size: number;
  maestroSessionId?: string | null;
}

type LogProvider = "claude" | "codex";

interface TranscriptStats {
  source: LogProvider;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  assistantMessages: number;
  userMessages: number;
  toolCallCount: number;
  toolUsage: Array<{ name: string; count: number }>;
  models: string[];
  firstMessageAt: number | null;
  lastMessageAt: number | null;
  lastMessages: Array<{
    timestamp: number;
    text: string;
    source: "assistant" | "user";
  }>;
}

function computeTranscriptStats(
  messages: ParsedMessage[],
  source: LogProvider,
  lastN: number,
): TranscriptStats {
  const metrics = calculateMetrics(messages);
  const toolCounts = new Map<string, number>();
  const models = new Set<string>();
  let assistantCount = 0;
  let userCount = 0;
  let toolCallCount = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  const recent: TranscriptStats["lastMessages"] = [];

  for (const msg of messages) {
    if (msg.model) models.add(msg.model);

    const ts = msg.timestamp instanceof Date ? msg.timestamp.getTime() : 0;
    if (Number.isFinite(ts) && ts > 0) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }

    toolCallCount += msg.toolCalls.length;
    for (const call of msg.toolCalls) {
      toolCounts.set(call.name, (toolCounts.get(call.name) ?? 0) + 1);
    }

    const text = extractTextContent(msg).trim();
    if (msg.type === "assistant") {
      assistantCount++;
      if (text) {
        recent.push({ timestamp: ts, text, source: "assistant" });
      }
    } else if (msg.type === "user") {
      // Skip synthetic user messages that only carry tool_result blocks —
      // they're not real prompts.
      const hasToolResult = msg.toolResults.length > 0;
      const hasText = text.length > 0;
      if (hasText && !hasToolResult) {
        userCount++;
        recent.push({ timestamp: ts, text, source: "user" });
      } else if (!hasToolResult) {
        // Possibly empty user — count it but don't render.
        userCount++;
      }
    }
  }

  const toolUsage = Array.from(toolCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    source,
    totalTokens: metrics.totalTokens,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    cacheReadTokens: metrics.cacheReadTokens,
    cacheCreationTokens: metrics.cacheCreationTokens,
    assistantMessages: assistantCount,
    userMessages: userCount,
    toolCallCount,
    toolUsage,
    models: Array.from(models),
    firstMessageAt: firstTs,
    lastMessageAt: lastTs,
    lastMessages: recent.slice(-lastN),
  };
}

async function loadTranscriptStats(
  cwd: string,
  maestroSessionId: string,
  preferred: LogProvider,
  lastN: number,
): Promise<TranscriptStats | null> {
  const order: LogProvider[] = preferred === "codex" ? ["codex", "claude"] : ["claude", "codex"];
  for (const candidate of order) {
    try {
      const listCommand =
        candidate === "codex" ? "list_codex_session_logs" : "list_claude_session_logs";
      const files = await invoke<ClaudeLogFile[]>(listCommand, { cwd });
      const match = files.find((f) => f.maestroSessionId === maestroSessionId);
      if (!match) continue;
      const filename = match.relativePath ?? match.filename;
      const readCommand =
        candidate === "codex" ? "read_codex_session_log" : "read_claude_session_log";
      const content = await invoke<string>(readCommand, { cwd, filename });
      const parsed = parseJsonlText(content);
      if (parsed.length === 0) return null;
      return computeTranscriptStats(parsed, candidate, lastN);
    } catch {
      // try the next provider
    }
  }
  return null;
}

interface SessionStatsViewProps {
  session: MaestroSession;
}

const OUTCOME_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Stopped while Working",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const TASK_STATUS_SYMBOLS: Record<TaskSessionStatus, string> = {
  queued: "○",
  working: "◉",
  completed: "✓",
  failed: "✗",
  blocked: "▲",
  skipped: "⊘",
};

const TASK_STATUS_LABELS: Record<TaskSessionStatus, string> = {
  queued: "queued",
  working: "working",
  completed: "completed",
  failed: "failed",
  blocked: "blocked",
  skipped: "skipped",
};

const ERROR_EVENT_TYPES: SessionTimelineEventType[] = ["error", "task_failed"];
const PROGRESS_EVENT_TYPES: SessionTimelineEventType[] = [
  "progress",
  "milestone",
  "task_completed",
  "task_started",
];

export function formatStatsDuration(startMs: number, endMs: number | null | undefined): string {
  const end = typeof endMs === "number" && endMs > 0 ? endMs : Date.now();
  const seconds = Math.max(0, Math.floor((end - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function formatTimestampShort(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const TIMELINE_EVENT_LABELS: Record<SessionTimelineEventType, string> = {
  session_started: "Session started",
  session_stopped: "Session stopped",
  task_started: "Task started",
  task_completed: "Task completed",
  task_failed: "Task failed",
  task_skipped: "Task skipped",
  task_blocked: "Task blocked",
  needs_input: "Needs input",
  progress: "Progress",
  error: "Error",
  milestone: "Milestone",
  doc_added: "Doc added",
};

export function getSessionOutcome(session: MaestroSession): {
  status: MaestroSessionStatus;
  label: string;
  variant: "success" | "failure" | "neutral" | "human-done" | "archived";
} {
  if (session.archivedAt) {
    return { status: session.status, label: "Archived", variant: "archived" };
  }
  if (session.humanCompletedAt) {
    return { status: session.status, label: "Marked Done", variant: "human-done" };
  }
  if (session.status === "failed") {
    return { status: "failed", label: OUTCOME_LABELS.failed, variant: "failure" };
  }
  if (session.status === "completed") {
    return { status: "completed", label: OUTCOME_LABELS.completed, variant: "success" };
  }
  return { status: session.status, label: OUTCOME_LABELS[session.status] ?? session.status, variant: "neutral" };
}

interface StatCardProps {
  value: number | string;
  label: string;
  tone?: "default" | "error" | "warn" | "success" | "accent" | "info";
  icon?: string;
  hint?: string;
}

function StatCard({ value, label, tone = "default", icon, hint }: StatCardProps) {
  return (
    <div className={`sessionStatsCard sessionStatsCard--${tone}`} title={hint}>
      {icon && <span className="sessionStatsCardIcon" aria-hidden="true">{icon}</span>}
      <div className="sessionStatsCardValue">{value}</div>
      <div className="sessionStatsCardLabel">{label}</div>
    </div>
  );
}

interface TokenBreakdownBarProps {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function TokenBreakdownBar({ input, output, cacheRead, cacheWrite }: TokenBreakdownBarProps) {
  const total = input + output + cacheRead + cacheWrite;
  if (total === 0) return null;
  const segments: Array<{ key: string; value: number; label: string }> = [
    { key: "input", value: input, label: "input" },
    { key: "output", value: output, label: "output" },
    { key: "cache-read", value: cacheRead, label: "cache read" },
    { key: "cache-write", value: cacheWrite, label: "cache write" },
  ];
  return (
    <div className="sessionStatsTokenBar" role="img" aria-label="Token usage breakdown">
      {segments.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <span
            key={seg.key}
            className={`sessionStatsTokenBarSeg sessionStatsTokenBarSeg--${seg.key}`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${formatCompactNumber(seg.value)} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

const TIMELINE_EVENT_ICONS: Record<SessionTimelineEventType, string> = {
  session_started: "▶",
  session_stopped: "■",
  task_started: "→",
  task_completed: "✓",
  task_failed: "✕",
  task_skipped: "⊘",
  task_blocked: "▲",
  needs_input: "?",
  progress: "•",
  error: "✕",
  milestone: "★",
  doc_added: "≡",
};

export function SessionStatsView({ session }: SessionStatsViewProps) {
  const tasks = useMaestroStore((s) => s.tasks);
  const allSessions = useMaestroStore((s) => s.sessions);
  const projects = useProjectStore((s) => s.projects);
  const resumeSessionFlow = useMaestroStore((s) => s.resumeSessionFlow);
  const resumingSessionId = useMaestroStore((s) => s.resumingSessionId);
  const setSessionArchived = useMaestroStore((s) => s.setSessionArchived);

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [stats, setStats] = useState<TranscriptStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const agentTool = (session.metadata as { agentTool?: string } | undefined)?.agentTool ?? "claude-code";
  const canResume = agentTool === "claude-code";
  const isResuming = resumingSessionId === session.id;
  const isArchived = Boolean(session.archivedAt);

  const handleResumeClick = () => {
    if (!canResume || isResuming) return;
    void resumeSessionFlow(session.id);
  };

  const handleRestoreClick = () => {
    void setSessionArchived(session.id, false);
  };

  // Resolve cwd the same way SessionLogStrip does: prefer worktree path,
  // fall back to the project's workingDir.
  const sessionCwd = useMemo(() => {
    const metadata = session.metadata as { worktreePath?: string } | undefined;
    if (metadata?.worktreePath) return metadata.worktreePath;
    const project = projects.find((p) => p.id === session.projectId);
    return project?.workingDir ?? "";
  }, [session.metadata, session.projectId, projects]);

  // Read the Claude/Codex JSONL transcript via Tauri (same approach as
  // SessionLogStrip — works for archived sessions because we just need the
  // local file). Recompute when the session or cwd changes.
  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setStatsError(null);

    if (!sessionCwd) {
      setStatsLoading(false);
      return;
    }

    const metadata = session.metadata as { agentTool?: string } | undefined;
    const preferred: LogProvider = metadata?.agentTool === "codex" ? "codex" : "claude";

    setStatsLoading(true);
    loadTranscriptStats(sessionCwd, session.id, preferred, 12)
      .then((res) => {
        if (cancelled) return;
        setStats(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, session.metadata, sessionCwd]);

  const outcome = getSessionOutcome(session);

  const timeline = session.timeline ?? [];
  const docs = session.docs ?? [];
  const taskIds = session.taskIds ?? [];

  const timelineCounts = useMemo(() => {
    let errors = 0;
    let progress = 0;
    let needsInput = 0;
    let docsAdded = 0;
    const byType = new Map<SessionTimelineEventType, number>();
    for (const ev of timeline) {
      if (ERROR_EVENT_TYPES.includes(ev.type)) errors++;
      if (PROGRESS_EVENT_TYPES.includes(ev.type)) progress++;
      if (ev.type === "needs_input") needsInput++;
      if (ev.type === "doc_added") docsAdded++;
      byType.set(ev.type, (byType.get(ev.type) ?? 0) + 1);
    }
    const byTypeSorted = Array.from(byType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return { errors, progress, needsInput, docsAdded, total: timeline.length, byType: byTypeSorted };
  }, [timeline]);

  const linkedTasks = useMemo(
    () =>
      taskIds
        .map((tid) => tasks[tid])
        .filter((t): t is NonNullable<typeof t> => t !== undefined),
    [taskIds, tasks],
  );

  const isCoordinator = isCoordinatorRole(session.mode);

  const childRollup = useMemo(() => {
    if (!isCoordinator) return null;
    const allList = Object.values(allSessions);
    const map = buildChildrenByParent(allList);
    const subtree = collectSubtreeIds(session.id, map);
    const childIds = subtree.filter((id) => id !== session.id);
    if (childIds.length === 0) return null;
    const counts: Record<MaestroSessionStatus, number> = {
      spawning: 0,
      idle: 0,
      working: 0,
      completed: 0,
      failed: 0,
      stopped: 0,
    };
    for (const id of childIds) {
      const child = allSessions[id];
      if (child) counts[child.status]++;
    }
    return { total: childIds.length, counts };
  }, [isCoordinator, allSessions, session.id]);

  const snapshot = session.teamMemberSnapshots?.[0] ?? session.teamMemberSnapshot;
  const displayName =
    snapshot?.name ?? session.name ?? session.id.slice(0, 12);
  const avatar = snapshot?.avatar ?? "◆";
  const role = snapshot?.role;
  const metadata = (session.metadata ?? {}) as {
    agentTool?: string;
    skills?: string[];
    worktreePath?: string;
    worktreeBranch?: string;
  };
  const skills = Array.isArray(metadata.skills) ? metadata.skills : [];

  const isEmptyState =
    timeline.length === 0 && docs.length === 0 && taskIds.length === 0;

  return (
    <div className="sessionStatsView" data-session-id={session.id}>
      <header className="sessionStatsHeader">
        <div className="sessionStatsHeaderIdentity">
          <span className="sessionStatsAvatar" aria-hidden="true">{avatar}</span>
          <div className="sessionStatsIdentityText">
            <div className="sessionStatsName">{displayName}</div>
            {role && <div className="sessionStatsRole">{role}</div>}
          </div>
        </div>
        <div className="sessionStatsHeaderMeta">
          <span
            className={`sessionStatsOutcomeBadge sessionStatsOutcomeBadge--${outcome.variant}`}
            title={`Status: ${session.status}`}
          >
            {outcome.label}
          </span>
          <StrategyBadge
            strategy={session.strategy}
            orchestratorStrategy={session.orchestratorStrategy}
          />
          {session.model && (
            <span className="sessionStatsChip sessionStatsChip--model">
              {String(session.model).toUpperCase()}
            </span>
          )}
          {metadata.agentTool && (
            <span className="sessionStatsChip sessionStatsChip--tool">
              {metadata.agentTool}
            </span>
          )}
          {session.mode && (
            <span className="sessionStatsChip sessionStatsChip--mode">{session.mode}</span>
          )}
          <span className="sessionStatsDuration" title="Total duration">
            {formatStatsDuration(session.startedAt, session.completedAt)}
          </span>
          <div className="sessionStatsActionBar" role="group" aria-label="Session actions">
            {isArchived && (
              <button
                type="button"
                className="sessionStatsActionBtn sessionStatsActionBtn--secondary"
                onClick={handleRestoreClick}
                title="Restore — move this session back to Open"
              >
                <span className="sessionStatsActionBtnIcon" aria-hidden="true">↺</span>
                <span className="sessionStatsActionBtnLabel">Restore</span>
              </button>
            )}
            <button
              type="button"
              className="sessionStatsActionBtn sessionStatsActionBtn--primary"
              disabled={!canResume || isResuming}
              onClick={handleResumeClick}
              title={
                canResume
                  ? isResuming
                    ? "Resuming…"
                    : "Resume this session (revives its terminal)"
                  : "Resume is only available for Claude Code sessions"
              }
            >
              <span className="sessionStatsActionBtnIcon" aria-hidden="true">↻</span>
              <span className="sessionStatsActionBtnLabel">
                {isResuming ? "Resuming…" : "Resume"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <section className="sessionStatsCardsRow sessionStatsCardsRow--hero" aria-label="Key statistics">
        <StatCard
          value={taskIds.length}
          label={`task${taskIds.length === 1 ? "" : "s"}`}
          tone="accent"
          icon="◧"
        />
        <StatCard
          value={docs.length}
          label={`doc${docs.length === 1 ? "" : "s"}`}
          tone="info"
          icon="≡"
        />
        <StatCard
          value={timelineCounts.errors}
          label={`error${timelineCounts.errors === 1 ? "" : "s"}`}
          tone={timelineCounts.errors > 0 ? "error" : "default"}
          icon="✕"
        />
        <StatCard
          value={timelineCounts.total}
          label="timeline events"
          tone="success"
          icon="◷"
        />
      </section>

      {/* Transcript stats (tokens, messages, tool calls — parsed locally via Tauri) */}
      {stats && (
        <section className="sessionStatsSection sessionStatsSection--transcript">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Token usage</span>
            <span className="sessionStatsSectionCount">{stats.source}</span>
          </h3>

          <div className="sessionStatsTokenHeadline">
            <div className="sessionStatsTokenHeadlineMain">
              <span className="sessionStatsTokenHeadlineValue">
                {formatCompactNumber(stats.totalTokens)}
              </span>
              <span className="sessionStatsTokenHeadlineLabel">total tokens</span>
            </div>
            <div className="sessionStatsTokenHeadlineMeta">
              <span className="sessionStatsTokenLegend sessionStatsTokenLegend--input">
                <span className="sessionStatsTokenLegendSwatch" />
                <span className="sessionStatsTokenLegendLabel">input</span>
                <span className="sessionStatsTokenLegendValue">{formatCompactNumber(stats.inputTokens)}</span>
              </span>
              <span className="sessionStatsTokenLegend sessionStatsTokenLegend--output">
                <span className="sessionStatsTokenLegendSwatch" />
                <span className="sessionStatsTokenLegendLabel">output</span>
                <span className="sessionStatsTokenLegendValue">{formatCompactNumber(stats.outputTokens)}</span>
              </span>
              <span className="sessionStatsTokenLegend sessionStatsTokenLegend--cache-read">
                <span className="sessionStatsTokenLegendSwatch" />
                <span className="sessionStatsTokenLegendLabel">cache read</span>
                <span className="sessionStatsTokenLegendValue">{formatCompactNumber(stats.cacheReadTokens)}</span>
              </span>
              <span className="sessionStatsTokenLegend sessionStatsTokenLegend--cache-write">
                <span className="sessionStatsTokenLegendSwatch" />
                <span className="sessionStatsTokenLegendLabel">cache write</span>
                <span className="sessionStatsTokenLegendValue">{formatCompactNumber(stats.cacheCreationTokens)}</span>
              </span>
            </div>
          </div>

          <TokenBreakdownBar
            input={stats.inputTokens}
            output={stats.outputTokens}
            cacheRead={stats.cacheReadTokens}
            cacheWrite={stats.cacheCreationTokens}
          />

          <div className="sessionStatsCardsRow sessionStatsCardsRow--three">
            <StatCard
              value={stats.assistantMessages}
              label="assistant msgs"
              icon="◆"
              tone="success"
            />
            <StatCard
              value={stats.userMessages}
              label="user msgs"
              icon="◇"
              tone="accent"
            />
            <StatCard
              value={stats.toolCallCount}
              label="tool calls"
              icon="⚙"
              tone="info"
            />
          </div>

          {stats.models.length > 0 && (
            <div className="sessionStatsModelStrip">
              {stats.models.map((m) => (
                <span key={m} className="sessionStatsChip sessionStatsChip--model">{m}</span>
              ))}
            </div>
          )}
        </section>
      )}
      {statsLoading && !stats && (
        <div className="sessionStatsLoading">Loading transcript stats…</div>
      )}
      {statsError && (
        <div className="sessionStatsErrorBanner" title={statsError}>
          Transcript stats unavailable
        </div>
      )}
      {!stats && !statsLoading && !statsError && sessionCwd && (
        <div className="sessionStatsErrorBanner sessionStatsErrorBanner--info">
          No transcript file found for this session
        </div>
      )}

      {isEmptyState && !stats && (
        <div className="sessionStatsEmpty">
          This session did not produce any tasks, docs, or timeline events.
        </div>
      )}

      {/* Last messages (transcript) */}
      {stats?.lastMessages && stats.lastMessages.length > 0 && (
        <section className="sessionStatsSection">
          <button
            type="button"
            className="sessionStatsCollapsible"
            onClick={() => setTranscriptOpen((v) => !v)}
            aria-expanded={transcriptOpen}
          >
            <span className="sessionStatsCollapsibleToggle">{transcriptOpen ? "▾" : "▸"}</span>
            <span className="sessionStatsCollapsibleTitle">Last messages</span>
            <span className="sessionStatsSectionCount">
              ({stats.lastMessages.length})
            </span>
          </button>
          {transcriptOpen && (
            <div className="sessionStatsTranscript">
              {stats.lastMessages.map((m, idx) => (
                <div
                  key={`${m.timestamp}-${idx}`}
                  className={`sessionStatsMessage sessionStatsMessage--${m.source}`}
                >
                  <div
                    className="sessionStatsMessageAvatar"
                    aria-hidden="true"
                    title={m.source === "assistant" ? "Assistant" : "User"}
                  >
                    {m.source === "assistant" ? "◆" : "◇"}
                  </div>
                  <div className="sessionStatsMessageContent">
                    <div className="sessionStatsMessageHeader">
                      <span className="sessionStatsMessageRole">
                        {m.source === "assistant" ? "Assistant" : "User"}
                      </span>
                      <span className="sessionStatsMessageTime">
                        {formatTimestampShort(m.timestamp)}
                      </span>
                    </div>
                    <div className="sessionStatsMessageBody">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tool usage breakdown */}
      {stats?.toolUsage && stats.toolUsage.length > 0 && (
        <section className="sessionStatsSection">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Tool usage</span>
            <span className="sessionStatsSectionCount">
              ({stats.toolCallCount} call{stats.toolCallCount === 1 ? "" : "s"})
            </span>
          </h3>
          <div className="sessionStatsToolBars">
            {(() => {
              const max = stats.toolUsage[0]?.count ?? 1;
              return stats.toolUsage.map((t) => (
                <div key={t.name} className="sessionStatsToolBar">
                  <span className="sessionStatsToolBarName">{t.name}</span>
                  <div className="sessionStatsToolBarTrack">
                    <div
                      className="sessionStatsToolBarFill"
                      style={{ width: `${Math.max(4, (t.count / max) * 100)}%` }}
                    />
                  </div>
                  <span className="sessionStatsToolBarCount">{t.count}</span>
                </div>
              ));
            })()}
          </div>
        </section>
      )}

      {(linkedTasks.length > 0 || taskIds.length > 0) && (
        <section className="sessionStatsSection">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Task outcomes</span>
          </h3>
          <div className="sessionStatsTaskList">
            {linkedTasks.length === 0 ? (
              <div className="sessionStatsEmptyInline">
                {taskIds.length} task{taskIds.length === 1 ? "" : "s"} (not loaded)
              </div>
            ) : (
              linkedTasks.map((task) => {
                const status: TaskSessionStatus | undefined =
                  task.taskSessionStatuses?.[session.id];
                const sym = status ? TASK_STATUS_SYMBOLS[status] : "○";
                const lbl = status ? TASK_STATUS_LABELS[status] : "unknown";
                return (
                  <div
                    key={task.id}
                    className={`sessionStatsTaskRow sessionStatsTaskRow--${status ?? "unknown"}`}
                  >
                    <span className="sessionStatsTaskSymbol" aria-hidden="true">{sym}</span>
                    <span className="sessionStatsTaskTitle">{task.title}</span>
                    <span className="sessionStatsTaskStatus">{lbl}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {childRollup && (
        <section className="sessionStatsSection">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Sub-sessions</span>
            <span className="sessionStatsSectionCount">
              ({childRollup.total} in subtree)
            </span>
          </h3>
          <div className="sessionStatsRollup">
            {(Object.entries(childRollup.counts) as Array<[MaestroSessionStatus, number]>)
              .filter(([, n]) => n > 0)
              .map(([status, n]) => (
                <span key={status} className={`sessionStatsRollupChip sessionStatsRollupChip--${status}`}>
                  <span className="sessionStatsRollupCount">{n}</span>
                  <span className="sessionStatsRollupLabel">{status}</span>
                </span>
              ))}
          </div>
        </section>
      )}

      {/* Timeline breakdown by event type */}
      {timelineCounts.byType.length > 0 && (
        <section className="sessionStatsSection">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Timeline breakdown</span>
            <span className="sessionStatsSectionCount">
              ({timelineCounts.total} event{timelineCounts.total === 1 ? "" : "s"})
            </span>
          </h3>
          <div className="sessionStatsBreakdownGrid">
            {timelineCounts.byType.map(({ type, count }) => (
              <div
                key={type}
                className={`sessionStatsBreakdownChip sessionStatsBreakdownChip--${type}`}
              >
                <span className="sessionStatsBreakdownIcon" aria-hidden="true">
                  {TIMELINE_EVENT_ICONS[type] ?? "·"}
                </span>
                <span className="sessionStatsBreakdownCount">{count}</span>
                <span className="sessionStatsBreakdownLabel">
                  {TIMELINE_EVENT_LABELS[type] ?? type}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {docs.length > 0 && (
        <section className="sessionStatsSection">
          <DocsList docs={docs} />
        </section>
      )}

      {timeline.length > 0 && (
        <section className="sessionStatsSection">
          <button
            type="button"
            className="sessionStatsCollapsible"
            onClick={() => setTimelineOpen((v) => !v)}
            aria-expanded={timelineOpen}
          >
            <span className="sessionStatsCollapsibleToggle">{timelineOpen ? "▾" : "▸"}</span>
            <span className="sessionStatsCollapsibleTitle">Timeline</span>
            <span className="sessionStatsSectionCount">
              ({timeline.length} event{timeline.length === 1 ? "" : "s"})
            </span>
          </button>
          {timelineOpen && (
            <div className="sessionStatsTimelineScroll">
              <SessionTimeline events={timeline} showFilters compact={false} />
            </div>
          )}
        </section>
      )}

      {(metadata.worktreePath || metadata.worktreeBranch || skills.length > 0) && (
        <section className="sessionStatsSection">
          <h3 className="sessionStatsSectionTitle">
            <span className="sessionStatsSectionTitleAccent">Run configuration</span>
          </h3>
          <div className="sessionStatsConfigGrid">
            {metadata.worktreeBranch && (
              <div className="sessionStatsConfigRow">
                <span className="sessionStatsConfigLabel">Worktree branch</span>
                <span className="sessionStatsConfigValue sessionStatsConfigValue--mono">
                  {metadata.worktreeBranch}
                </span>
              </div>
            )}
            {metadata.worktreePath && (
              <div className="sessionStatsConfigRow">
                <span className="sessionStatsConfigLabel">Worktree path</span>
                <span className="sessionStatsConfigValue sessionStatsConfigValue--mono">
                  {metadata.worktreePath}
                </span>
              </div>
            )}
            {skills.length > 0 && (
              <div className="sessionStatsConfigRow">
                <span className="sessionStatsConfigLabel">Skills</span>
                <span className="sessionStatsConfigValue">
                  {skills.join(", ")}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="sessionStatsSection sessionStatsSection--identity">
        <SessionDetailsSection session={session} compact showEnv={false} showSystemInfo />
      </section>
    </div>
  );
}
