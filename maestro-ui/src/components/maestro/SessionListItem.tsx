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
import { useUIStore } from "../../stores/useUIStore";
import type { TeamColor } from "../../app/constants/teamColors";
import type { SessionSubTab } from "../../utils/sessionLifecycle";
import { willOpenStatsOnClick } from "../../utils/sessionClickRouting";
import { copyToClipboard } from "../../utils/domUtils";

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  completed: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

const SESSION_STATUS_SYMBOLS: Record<MaestroSessionStatus, string> = {
  spawning: "◐",
  idle: "○",
  working: "◉",
  completed: "✓",
  failed: "✗",
  stopped: "■",
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

// Cycling accent palette so each linked task line gets a visually distinct border.
const TASK_LINE_COLORS = [
  "#6B8AFD",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
  "#22d3ee",
  "#f472b6",
];

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
  isSelected: boolean;
  maestroTasks: Record<string, MaestroTask>;
  tab: SessionSubTab;
  onOpenDetail: (sessionId: string) => void;
  onSelect: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onJumpToTerminal: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onStop: (session: MaestroSession, link: SessionTileLinkInfo | null) => void;
  onResume: (sessionId: string) => void;
  onRestore: (session: MaestroSession) => void;
  onToggleHumanComplete: (session: MaestroSession) => void;
  onOpenTeamView: (session: MaestroSession) => void;
  isResuming: boolean;
}

export const SessionListItem = React.memo(function SessionListItem({
  session,
  depth,
  teamColor,
  childCount,
  isCollapsed,
  onToggleCollapse,
  link,
  isSelected,
  maestroTasks,
  tab,
  onOpenDetail,
  onSelect,
  onJumpToTerminal,
  onStop,
  onResume,
  onRestore,
  onToggleHumanComplete,
  onOpenTeamView,
  isResuming,
}: SessionListItemProps) {
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const [modeDropdownPos, setModeDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const updateSessionMode = useMaestroStore((s) => s.updateSessionMode);
  const setDocOverlay = useUIStore((s) => s.setDocOverlay);
  const showTaskDetails = useUIStore((s) => s.sessionShowTaskDetails);

  const status = session.status;
  const needsInput = session.needsInput?.active;
  // Liveness comes from the local terminal (linkMap), NOT the unreliable `status`
  // field. No live terminal (exited, or never reopened this session) → non-live.
  const isLinkedLive = Boolean(link && !link.exited);
  const hasChildren = childCount > 0;
  const isHumanCompleted = Boolean(session.humanCompletedAt);
  const isArchived = Boolean(session.archivedAt);
  // A child whose own lifecycle state disagrees with the tab it's being shown
  // in (e.g. an archived child rendered under an active root). We keep it in the
  // tree for spawn-chain context but mark it as out-of-place rather than hiding.
  const isOutOfTab = depth > 0 && isArchived && tab !== 'archived';

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

  // Rich hover tooltip: session identity + every linked task's full details.
  const detailsTooltip = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Session: ${title}`);
    lines.push(`Status: ${SESSION_STATUS_LABELS[status]}${session.needsInput?.active ? " (needs input)" : ""}`);
    if (mode) lines.push(`Mode: ${MODE_LABELS[mode]}`);
    if (session.model) lines.push(`Model: ${session.model}`);
    if (linkedTasks.length > 0) {
      lines.push("");
      lines.push(linkedTasks.length === 1 ? "Task:" : "Tasks:");
      for (const t of linkedTasks) {
        lines.push(`• ${t.title}  [${t.status}]`);
        if (t.description?.trim()) lines.push(`   ${t.description.trim()}`);
      }
    }
    return lines.join("\n");
  }, [title, status, session.needsInput?.active, session.model, mode, linkedTasks]);

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

  const handleCopyReference = useCallback(async () => {
    const ok = await copyToClipboard(`${title} (${session.id})`);
    if (ok) {
      setCopiedRef(true);
      window.setTimeout(() => setCopiedRef(false), 1200);
    }
  }, [title, session.id]);

  const canResume = (session.metadata?.agentTool || "claude-code") === "claude-code";

  // The dot is a *click-affordance* signal, not a raw PTY-alive signal. The
  // Resume button uses the same predicate — both come from a single helper so
  // they can never drift apart.
  const willOpenStats = willOpenStatsOnClick(session, link);
  const isShowingTerminalOnClick = !willOpenStats;

  return (
    <div
      className={`sessionTile sessionTile--${status} ${needsInput ? "sessionTile--needsInput" : ""} ${isSelected ? "sessionTile--selected" : ""} ${depth > 0 ? "sessionTile--child" : ""} ${isArchived ? "sessionTile--archived" : ""} ${isOutOfTab ? "sessionTile--outOfTab" : ""}`}
      style={teamColor ? ({ "--session-team-color": teamColor.primary } as React.CSSProperties) : undefined}
      onClick={() => onSelect(session, link)}
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

        {/* Leading control.
            Open/Done → "mark done" radio. Marking done is a pure intent marker:
            it stamps humanCompletedAt (moving the session to the Done tab) and does
            NOT touch any terminal — liveness stays as decoration. Clicking again
            clears the stamp and moves it back to Open.
            Archived → static archive glyph (archived precedence wins). */}
        {isArchived ? (
          <span
            className="sessionTile__radio sessionTile__radio--archived"
            title="Archived — use Restore to bring it back"
            aria-hidden="true"
          >
            ▫
          </span>
        ) : (
          <button
            type="button"
            className={`sessionTile__radio ${isHumanCompleted ? "sessionTile__radio--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHumanComplete(session);
            }}
            title={isHumanCompleted ? "Marked done — click to move back to Open" : "Mark done — moves to the Done tab (terminal keeps running)"}
            aria-pressed={isHumanCompleted}
          >
            {isHumanCompleted ? "✓" : "○"}
          </button>
        )}

        {/* Title folds into the whole-tile select (handled on the root). Live
            tiles switch to their terminal; non-live tiles just get selected. */}
        <span
          className="sessionTile__title"
          title={isLinkedLive ? `Switch to ${title}` : `Select ${title}`}
        >
          {avatars && <span className="sessionTile__avatar">{avatars}</span>}
          <span className="sessionTile__titleText">{title}</span>
        </span>

        {isOutOfTab && (
          <span className="sessionTile__tag sessionTile__tag--archived" title="This sub-session is archived">
            archived
          </span>
        )}
        {isHumanCompleted && !isArchived && (
          <span className="sessionTile__tag sessionTile__tag--done" title="Marked done by you">
            done
          </span>
        )}
        {/* Click-affordance dot. Green whenever a live PTY exists, since clicking
            opens that terminal (even an idle one — resumed sessions stay
            reachable between turns). Stopped only when the terminal has exited,
            where clicking surfaces stats and Resume revives it. */}
        {!isArchived && (
          isShowingTerminalOnClick ? (
            <span className="sessionTile__linkedDot" title="Live terminal — click to open" />
          ) : (
            <span
              className="sessionTile__stoppedDot"
              title="No live terminal — Resume to reactivate"
            />
          )
        )}
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

        {/* Agent status (read-only) — symbol + color, trailing like the task tile's session indicator */}
        <span
          className={`sessionTile__status sessionTile__status--${status} ${needsInput ? "sessionTile__status--needsInput" : ""}`}
          title={needsInput ? "Needs input" : SESSION_STATUS_LABELS[status]}
          data-status-anchor
        >
          {needsInput ? "!" : SESSION_STATUS_SYMBOLS[status]}
        </span>

        {/* Actions */}
        <div className="sessionTile__actions">
          {/* Team view (terminals) — only when this node has children */}
          {hasChildren && (
            <button
              type="button"
              className="sessionTile__btn sessionTile__btn--teamView"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTeamView(session);
              }}
              title="Open team view (terminals)"
            >
              ⊞
            </button>
          )}

          {/* Resume — visibility locked to the click-routing predicate (see
              utils/sessionClickRouting). Shown ⟺ clicking would open the
              stats view. Covers Archived tiles too — resumeSessionFlow clears
              archivedAt/humanCompletedAt as part of the resume. */}
          {willOpenStats && (
            <button
              type="button"
              className="sessionTile__resumeBtn"
              disabled={!canResume || isResuming}
              onClick={(e) => {
                e.stopPropagation();
                if (canResume) onResume(session.id);
              }}
              title={
                canResume
                  ? isResuming
                    ? "Resuming…"
                    : "Resume this session (revives its terminal)"
                  : "Resume is only available for Claude Code sessions"
              }
            >
              <span className="sessionTile__resumeBtnIcon" aria-hidden="true">↻</span>
              <span className="sessionTile__resumeBtnLabel">{isResuming ? "Resuming…" : "Resume"}</span>
            </button>
          )}

          {/* Close — every non-archived tile. Stops the terminal (if live) and archives. */}
          {!isArchived && (
            <button
              type="button"
              className="sessionTile__btn sessionTile__btn--stop"
              onClick={(e) => {
                e.stopPropagation();
                onStop(session, link);
              }}
              title={hasChildren ? "Close session + all sub-sessions (move to Archived)" : isLinkedLive ? "Stop & close session" : "Close session (move to Archived)"}
            >
              ✕
            </button>
          )}

          {/* Restore — only archived tiles. Clears archivedAt across the subtree,
              un-archiving the session (it returns to Open, or Done if it was also
              marked done before being archived). Works for every agent type, unlike
              Resume (which also revives the terminal). */}
          {isArchived && (
            <button
              type="button"
              className="sessionTile__btn sessionTile__btn--restore"
              onClick={(e) => {
                e.stopPropagation();
                onRestore(session);
              }}
              title={hasChildren ? "Restore session + all sub-sessions (un-archive)" : "Restore session (un-archive)"}
            >
              ↩
            </button>
          )}

          {/* Copy a reference (Name + id) to paste into another session */}
          <button
            type="button"
            className={`sessionTile__btn sessionTile__btn--copyRef ${copiedRef ? "sessionTile__btn--copied" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              void handleCopyReference();
            }}
            title={copiedRef ? "Copied reference" : "Copy session reference"}
            aria-label="Copy session reference"
          >
            {copiedRef ? "✓" : "⧉"}
          </button>

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

      {showTaskDetails && linkedTasks.length > 0 && (
        <div className="sessionTile__taskLines">
          {linkedTasks.map((task, i) => (
            <div
              key={task.id}
              className={`sessionTile__taskLine sessionTile__taskLine--${task.status}`}
              style={{ "--task-accent": TASK_LINE_COLORS[i % TASK_LINE_COLORS.length] } as React.CSSProperties}
              title={detailsTooltip}
            >
              <span className="sessionTile__taskLineSymbol">{TASK_STATUS_SYMBOLS[task.status] || "○"}</span>
              <span className="sessionTile__taskLineLabel">{task.title}</span>
            </div>
          ))}
        </div>
      )}

      {isMetaExpanded && (
        <div className="sessionTile__meta" onClick={(e) => e.stopPropagation()}>
          {/* Status / mode / model */}
          <div className="sessionTile__metaSection">
            <span className="sessionTile__metaLabel">Status</span>
            <div className="sessionTile__metaContent">
              <span className={`sessionTile__badge sessionTile__badge--status sessionTile__badge--status-${status}`}>
                <span className="sessionTile__badgeSymbol">{needsInput ? "!" : SESSION_STATUS_SYMBOLS[status]}</span>
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

              <span className="sessionTile__time" title={`Started ${new Date(session.startedAt).toLocaleString()}`}>
                {session.completedAt
                  ? formatDuration(session.startedAt, session.completedAt)
                  : formatTimeAgo(session.lastActivity)}
              </span>
            </div>
          </div>

          {/* Linked tasks */}
          {linkedTasks.length > 0 && (
            <div className="sessionTile__metaSection">
              <span className="sessionTile__metaLabel">Tasks</span>
              <div className="sessionTile__metaContent">
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
            </div>
          )}

          {/* Docs */}
          {docs.length > 0 && (
            <div className="sessionTile__metaSection">
              <span className="sessionTile__metaLabel">Docs</span>
              <div className="sessionTile__metaContent">
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
                          setDocOverlay(doc);
                        }}
                      >
                        <span className="sessionTile__docIcon">{isMarkdown ? "M↓" : "{ }"}</span>
                        <span className="sessionTile__docTitle">{doc.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="sessionTile__metaSection">
            <span className="sessionTile__metaLabel">Actions</span>
            <div className="sessionTile__metaContent">
              <button
                type="button"
                className="sessionTile__actionBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(session.id);
                }}
                title="Open full session details"
              >
                ⓘ Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
