import React, { useEffect, useRef, useCallback } from "react";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { MaestroSessionStatus } from "../../app/types/maestro";
import { SessionTimeline } from "./SessionTimeline";
import { StrategyBadge } from "./StrategyBadge";

interface SessionDetailModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
  "needs-user-input": "Needs Input",
};

const TASK_STATUS_SYMBOLS: Record<string, string> = {
  todo: "○",
  in_progress: "◉",
  completed: "✓",
  cancelled: "⊘",
  blocked: "✗",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SessionDetailModal({ sessionId, isOpen, onClose }: SessionDetailModalProps) {
  const session = useMaestroStore((s) => s.sessions.get(sessionId));
  const tasks = useMaestroStore((s) => s.tasks);
  const fetchSession = useMaestroStore((s) => s.fetchSession);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledToBottomRef = useRef(true);

  // Fetch full session data on open
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchSession(sessionId);
    }
  }, [isOpen, sessionId, fetchSession]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = timelineContainerRef.current;
    if (!el) return;
    const threshold = 50;
    isUserScrolledToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll when new timeline events arrive
  const timelineLength = session?.timeline?.length ?? 0;
  useEffect(() => {
    const el = timelineContainerRef.current;
    if (!el) return;
    if (isUserScrolledToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [timelineLength]);

  if (!isOpen) return null;

  // Resolve linked tasks
  const linkedTasks = session?.taskIds
    ?.map((taskId) => tasks.get(taskId))
    .filter((t) => t !== undefined) ?? [];

  return (
    <div className="maestroModalOverlay" onClick={onClose}>
      <div className="terminalTaskModal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="terminalModalHeader">
          <div className="terminalModalHeaderContent">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="terminalModalTitle">
                {session?.name || sessionId.slice(0, 12)}
              </h2>
              <button className="terminalModalBtn" onClick={onClose} title="Close">
                ✕
              </button>
            </div>
            {session && (
              <div className="terminalModalMeta">
                <span className={`sessionDetailStatusBadge sessionDetailStatusBadge--${session.status}`}>
                  {SESSION_STATUS_LABELS[session.status]}
                </span>
                <StrategyBadge strategy={session.strategy} orchestratorStrategy={session.orchestratorStrategy} />
                {session.model && (
                  <span className="sessionDetailModelBadge">
                    {session.model.toUpperCase()}
                  </span>
                )}
                {session.role && (
                  <span className="sessionDetailRoleBadge">
                    {session.role.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="terminalModalBody">
          {!session ? (
            <div className="terminalEmptyState">Loading session data...</div>
          ) : (
            <>
              {/* Info Grid */}
              <div className="terminalModalSection">
                <h3 className="terminalModalSectionTitle">▸ Info</h3>
                <div className="sessionDetailInfoGrid">
                  <div className="sessionDetailInfoRow">
                    <span className="terminalDetailLabel">Started:</span>
                    <span className="terminalDetailValue">{formatDate(session.startedAt)}</span>
                  </div>
                  <div className="sessionDetailInfoRow">
                    <span className="terminalDetailLabel">Last Activity:</span>
                    <span className="terminalDetailValue">{formatTimeAgo(session.lastActivity)}</span>
                  </div>
                  {session.completedAt && (
                    <div className="sessionDetailInfoRow">
                      <span className="terminalDetailLabel">Completed:</span>
                      <span className="terminalDetailValue">{formatDate(session.completedAt)}</span>
                    </div>
                  )}
                  {session.agentId && (
                    <div className="sessionDetailInfoRow">
                      <span className="terminalDetailLabel">Agent:</span>
                      <span className="terminalDetailValue">{session.agentId}</span>
                    </div>
                  )}
                  <div className="sessionDetailInfoRow">
                    <span className="terminalDetailLabel">Hostname:</span>
                    <span className="terminalDetailValue">{session.hostname || "—"}</span>
                  </div>
                  <div className="sessionDetailInfoRow">
                    <span className="terminalDetailLabel">Platform:</span>
                    <span className="terminalDetailValue">{session.platform || "—"}</span>
                  </div>
                  {session.spawnSource && (
                    <div className="sessionDetailInfoRow">
                      <span className="terminalDetailLabel">Spawn Source:</span>
                      <span className="terminalDetailValue">{session.spawnSource}</span>
                    </div>
                  )}
                  {session.spawnedBy && (
                    <div className="sessionDetailInfoRow">
                      <span className="terminalDetailLabel">Spawned By:</span>
                      <span className="terminalDetailValue">{session.spawnedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Tasks */}
              {linkedTasks.length > 0 && (
                <div className="terminalModalSection">
                  <h3 className="terminalModalSectionTitle">
                    ▸ Linked Tasks
                    <span className="terminalModalSubtaskCount">({linkedTasks.length})</span>
                  </h3>
                  <div>
                    {linkedTasks.map((task) => (
                      <div key={task.id} className="sessionDetailTaskItem">
                        <span className={`terminalStatusSymbol terminalStatusSymbol--${task.status}`}>
                          {TASK_STATUS_SYMBOLS[task.status] || "○"}
                        </span>
                        <span className="sessionDetailTaskTitle">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="terminalModalSection">
                <h3 className="terminalModalSectionTitle">▸ Timeline</h3>
                <div
                  ref={timelineContainerRef}
                  className="sessionDetailTimelineScroller"
                  onScroll={handleScroll}
                >
                  {session.timeline && session.timeline.length > 0 ? (
                    <SessionTimeline
                      events={session.timeline}
                      showFilters
                      compact={false}
                    />
                  ) : (
                    <div className="terminalEmptyState">No timeline events yet</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="terminalModalFooter">
          <div className="terminalModalFooterLeft">
            <span className="terminalModalFooterLabel">Session</span>
            <span className="terminalModalMetaItem" title={sessionId}>
              {sessionId.slice(0, 12)}…
            </span>
          </div>
          <div className="terminalModalFooterRight">
            <button className="terminalModalBtn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
