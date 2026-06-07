import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AgentMode,
  DocEntry,
  MaestroSession,
  MaestroSessionStatus,
  MaestroTask,
} from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useSpacesStore } from "../../stores/useSpacesStore";
import { useSessionStore } from "../../stores/useSessionStore";
import type { TeamColor } from "../../app/constants/teamColors";

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  completed: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

const MODE_LABELS: Record<AgentMode, string> = {
  worker: "Worker",
  coordinator: "Coordinator",
  "coordinated-worker": "Co-Worker",
  "coordinated-coordinator": "Co-Coordinator",
};

const MODE_OPTIONS: AgentMode[] = [
  "worker",
  "coordinator",
  "coordinated-worker",
  "coordinated-coordinator",
];

const TASK_STATUS_SYMBOLS: Record<string, string> = {
  todo: "○",
  in_progress: "◉",
  in_review: "◎",
  completed: "✓",
  cancelled: "⊘",
  blocked: "✗",
  archived: "▫",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(startedAt: number, endedAt: number): string {
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export interface SessionTileLinkInfo {
  localSessionId: string;
  exited: boolean;
}

export interface SessionListItemProps {
  session: MaestroSession;
  depth: number;
  teamColor: TeamColor | null;
  childCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  link: SessionTileLinkInfo | null;
  isActiveTerminal: boolean;
  maestroTasks: Record<string, MaestroTask>;
  onOpenDetail: (sessionId: string) => void;
  onJumpToTerminal: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onStop: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onResume: (sessionId: string) => void;
  isResuming: boolean;
}

const TERMINAL_STATUSES: MaestroSessionStatus[] = ["completed", "failed", "stopped"];

export const SessionListItem = React.memo(function SessionListItem({
  session,
  depth,
  teamColor,
  childCount,
  isCollapsed,
  onToggleCollapse,
  link,
  isActiveTerminal,
  maestroTasks,
  onOpenDetail,
  onJumpToTerminal,
  onStop,
  onResume,
  isResuming,
}: SessionListItemProps) {
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const [modeDropdownPos, setModeDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const updateSessionMode = useMaestroStore((s) => s.updateSessionMode);
  const openDocument = useSpacesStore((s) => s.openDocument);
  const setActiveId = useSessionStore((s) => s.setActiveId);

  const status = session.status;
  const needsInput = session.needsInput?.active;
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const isLinkedLive = Boolean(link && !link.exited);
  const hasChildren = childCount > 0;

  const snapshots = session.teamMemberSnapshots?.length
    ? session.teamMemberSnapshots
    : session.teamMemberSnapshot
      ? [session.teamMemberSnapshot]
      : [];
  const avatars = snapshots.map((m) => m.avatar).join("");
  const memberNames = snapshots.map((m) => m.name).join(", ");
  const title = memberNames || session.name || session.id.slice(0, 12);

  const linkedTasks = useMemo(
    () =>
      session.taskIds
        .map((tid) => maestroTasks[tid])
        .filter((t): t is MaestroTask => t !== undefined),
    [session.taskIds, maestroTasks],
  );

  const docs: DocEntry[] = session.docs ?? [];
  const mode = session.mode;

  useEffect(() => {
    if (showModeDropdown && modeBtnRef.current) {
      const rect = modeBtnRef.current.getBoundingClientRect();
      setModeDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [showModeDropdown]);

  const handleModeChange = useCallback(
    (newMode: AgentMode) => {
      if (newMode !== mode) updateSessionMode(session.id, newMode);
      setShowModeDropdown(false);
    },
    [mode, session.id, updateSessionMode],
  );

  const canResume = (session.metadata?.agentTool || "claude-code") === "claude-code";

  return (
    <div
      className={`sessionTile sessionTile--${status} ${needsInput ? "sessionTile--needsInput" : ""} ${isActiveTerminal ? "sessionTile--activeTerminal" : ""} ${depth > 0 ? "sessionTile--child" : ""}`}
      style={teamColor ? ({ "--session-team-color": teamColor.primary } as React.CSSProperties) : undefined}
    >
      {teamColor && <span className="sessionTile__accent" aria-hidden="true" />}

      <div className="sessionTile__main">
        {/* Sub-session arrow + count */}
        <button
          type="button"
          className={`sessionTile__arrow ${hasChildren ? (isCollapsed ? "sessionTile__arrow--collapsed" : "sessionTile__arrow--expanded") : "sessionTile__arrow--empty"}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleCollapse();
          }}
          disabled={!hasChildren}
          title={hasChildren ? (isCollapsed ? `Expand ${childCount} sub-sessions` : "Collapse sub-sessions") : "No sub-sessions"}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
          {childCount > 0 && <span className="sessionTile__arrowCount">{childCount}</span>}
        </button>

        {/* Status dot (read-only) */}
        <span
          className={`sessionTile__statusDot sessionTile__statusDot--${status} ${needsInput ? "sessionTile__statusDot--needsInput" : ""}`}
          title={needsInput ? "Needs input" : SESSION_STATUS_LABELS[status]}
        />

        {/* Title — switches to / resumes the session's terminal */}
        <span
          className="sessionTile__title"
          onClick={(e) => {
            e.stopPropagation();
            onJumpToTerminal(session, link);
          }}
          title={isLinkedLive ? `Switch to ${title}` : `Resume ${title}`}
        >
          {avatars && <span className="sessionTile__avatar">{avatars}</span>}
          <span className="sessionTile__titleText">{title}</span>
        </span>

        {isLinkedLive && <span className="sessionTile__linkedDot" title="Live terminal" />}
        {docs.length > 0 && (
          <span
            className="sessionTile__docBadge"
            title={`${docs.length} doc${docs.length !== 1 ? "s" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMetaExpanded(true);
            }}
          >
            {docs.length}
          </span>
        )}

        {/* Actions */}
        <div className="sessionTile__actions">
          {/* Open detail overlay */}
          <button
            type="button"
            className="sessionTile__btn sessionTile__btn--info"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(session.id);
            }}
            title="Session details"
          >
            ⓘ
          </button>

          {/* Stop/close (secondary) — only when there is a live terminal */}
          {isLinkedLive && (
            <button
              type="button"
              className="sessionTile__btn sessionTile__btn--stop"
              onClick={(e) => {
                e.stopPropagation();
                onStop(session, link);
              }}
              title="Stop / close session"
            >
              ✕
            </button>
          )}

          {/* Expand meta caret (rightmost) */}
          <button
            type="button"
            className={`sessionTile__btn sessionTile__btn--caret ${isMetaExpanded ? "sessionTile__btn--caretOpen" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMetaExpanded((v) => !v);
            }}
            title={isMetaExpanded ? "Collapse details" : "Expand details"}
          >
            ▾
          </button>
        </div>
      </div>

      {isMetaExpanded && (
        <div className="sessionTile__meta" onClick={(e) => e.stopPropagation()}>
          {/* Badges row */}
          <div className="sessionTile__metaRow">
            <span className={`sessionTile__badge sessionTile__badge--status sessionTile__badge--status-${status}`}>
              {needsInput ? "NEEDS INPUT" : (SESSION_STATUS_LABELS[status] || status).toUpperCase()}
            </span>

            {/* Editable mode */}
            <div className="sessionTile__modePicker">
              <button
                type="button"
                ref={modeBtnRef}
                className={`sessionTile__badge sessionTile__badge--mode sessionTile__badge--clickable ${showModeDropdown ? "sessionTile__badge--open" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModeDropdown((v) => !v);
                }}
                title="Click to change mode"
              >
                {mode ? MODE_LABELS[mode] : "Mode"}
                <span className="sessionTile__badgeCaret">{showModeDropdown ? "▴" : "▾"}</span>
              </button>
              {showModeDropdown && modeDropdownPos && createPortal(
                <>
                  <div className="terminalInlineStatusOverlay" onClick={(e) => { e.stopPropagation(); setShowModeDropdown(false); }} />
                  <div
                    className="sessionTile__modeDropdown"
                    style={{ position: "fixed", top: modeDropdownPos.top, left: modeDropdownPos.left }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {MODE_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        className={`sessionTile__modeOption ${opt === mode ? "sessionTile__modeOption--current" : ""}`}
                        onClick={(e) => { e.stopPropagation(); handleModeChange(opt); }}
                      >
                        <span>{MODE_LABELS[opt]}</span>
                        {opt === mode && <span className="terminalStatusCheck">✓</span>}
                      </button>
                    ))}
                  </div>
                </>,
                document.body,
              )}
            </div>

            {session.model && (
              <span className="sessionTile__badge sessionTile__badge--model">{session.model.toUpperCase()}</span>
            )}
            {session.strategy && (
              <span className="sessionTile__badge sessionTile__badge--strategy">{session.strategy}</span>
            )}

            <span className="sessionTile__metaFill" />
            <span className="sessionTile__time" title={`Started ${new Date(session.startedAt).toLocaleString()}`}>
              {session.completedAt
                ? formatDuration(session.startedAt, session.completedAt)
                : formatTimeAgo(session.lastActivity)}
            </span>
          </div>

          {/* Linked task chips */}
          {linkedTasks.length > 0 && (
            <div className="sessionTile__metaRow">
              <div className="sessionTile__taskChips">
                {linkedTasks.slice(0, 4).map((task) => (
                  <span
                    key={task.id}
                    className={`sessionTile__taskChip sessionTile__taskChip--${task.status}`}
                    title={`${task.title} (${task.status})`}
                  >
                    <span className="sessionTile__taskChipSymbol">{TASK_STATUS_SYMBOLS[task.status] || "○"}</span>
                    <span className="sessionTile__taskChipLabel">{task.title}</span>
                  </span>
                ))}
                {linkedTasks.length > 4 && (
                  <span className="sessionTile__taskChip sessionTile__taskChip--more">+{linkedTasks.length - 4}</span>
                )}
              </div>
            </div>
          )}

          {/* Docs row */}
          {docs.length > 0 && (
            <div className="sessionTile__metaRow">
              <div className="sessionTile__docsList">
                {docs.map((doc) => {
                  const ext = doc.filePath.split(".").pop()?.toLowerCase() || "";
                  const isMarkdown = ["md", "mdx", "markdown"].includes(ext);
                  return (
                    <button
                      type="button"
                      key={doc.id}
                      className="sessionTile__docItem"
                      title={doc.filePath}
                      onClick={(e) => {
                        e.stopPropagation();
                        const spaceId = openDocument(session.projectId, doc);
                        setActiveId(spaceId);
                      }}
                    >
                      <span className="sessionTile__docIcon">{isMarkdown ? "M↓" : "{ }"}</span>
                      <span className="sessionTile__docTitle">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resume for stopped/completed sessions */}
          {isTerminal && canResume && (
            <div className="sessionTile__metaRow">
              <button
                type="button"
                className="sessionTile__resumeBtn"
                disabled={isResuming}
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(session.id);
                }}
              >
                {isResuming ? "Resuming…" : "↻ Resume session"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
