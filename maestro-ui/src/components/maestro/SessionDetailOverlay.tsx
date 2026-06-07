import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useUIStore } from "../../stores/useUIStore";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { MaestroSessionStatus } from "../../app/types/maestro";
import { SessionTimeline } from "./SessionTimeline";
import { DocsList } from "./DocsList";
import { StrategyBadge } from "./StrategyBadge";
import { SessionDetailsSection } from "./SessionDetailsSection";

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const TASK_STATUS_SYMBOLS: Record<string, string> = {
  todo: "○",
  in_progress: "◉",
  in_review: "◎",
  completed: "✓",
  cancelled: "⊘",
  blocked: "✗",
  archived: "▫",
};

type Tab = "info" | "subsessions" | "tasks" | "docs";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "subsessions", label: "Sub-sessions" },
  { id: "tasks", label: "Tasks" },
  { id: "docs", label: "Docs + Timeline" },
];

export function SessionDetailOverlay() {
  const overlay = useUIStore((s) => s.sessionDetailOverlay);
  const setOverlay = useUIStore((s) => s.setSessionDetailOverlay);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const sessions = useMaestroStore((s) => s.sessions);
  const tasks = useMaestroStore((s) => s.tasks);
  const fetchSession = useMaestroStore((s) => s.fetchSession);

  const [tab, setTab] = useState<Tab>("info");

  const sessionId = overlay?.sessionId;
  const session = sessionId ? sessions[sessionId] : undefined;

  const timelineRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    if (overlay?.sessionId) fetchSession(overlay.sessionId);
  }, [overlay?.sessionId, fetchSession]);

  // Reset to Info tab when the overlay target changes
  useEffect(() => {
    setTab("info");
  }, [overlay?.sessionId]);

  useEffect(() => {
    if (!overlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOverlay(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [overlay, setOverlay]);

  const handleScroll = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const timelineLength = session?.timeline?.length ?? 0;
  useEffect(() => {
    const el = timelineRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [timelineLength, tab]);

  const subSessions = useMemo(() => {
    if (!sessionId) return [];
    return Object.values(sessions).filter((s) => s.parentSessionId === sessionId);
  }, [sessions, sessionId]);

  const linkedTasks = useMemo(() => {
    if (!session) return [];
    return session.taskIds.map((tid) => tasks[tid]).filter((t) => t !== undefined);
  }, [session, tasks]);

  if (!overlay || (activeProjectId && overlay.projectId !== activeProjectId)) return null;

  const handleClose = () => setOverlay(null);

  return (
    <div className="taskDetailOverlay sessionDetailOverlay">
      <div className="maestroModalOverlay" onClick={handleClose}>
        <div className="terminalTaskModal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="terminalModalHeader">
            <div className="terminalModalHeaderContent">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 className="terminalModalTitle">
                  {session?.name || (sessionId ? sessionId.slice(0, 12) : "Session")}
                </h2>
                <button type="button" className="terminalModalBtn" onClick={handleClose} title="Close">
                  ✕
                </button>
              </div>
              {session && (
                <div className="terminalModalMeta">
                  <span className={`sessionDetailStatusBadge sessionDetailStatusBadge--${session.status} ${session.needsInput?.active ? "sessionDetailStatusBadge--needsInput" : ""}`}>
                    {session.needsInput?.active ? "Needs Input" : SESSION_STATUS_LABELS[session.status]}
                  </span>
                  <StrategyBadge strategy={session.strategy} orchestratorStrategy={session.orchestratorStrategy} />
                  {session.model && <span className="sessionDetailModelBadge">{session.model.toUpperCase()}</span>}
                  {session.mode && <span className="sessionDetailModeBadge">{session.mode.toUpperCase()}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="sessionDetailTabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`sessionDetailTabs__btn ${tab === t.id ? "sessionDetailTabs__btn--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === "subsessions" && subSessions.length > 0 && (
                  <span className="sessionDetailTabs__count">{subSessions.length}</span>
                )}
                {t.id === "tasks" && linkedTasks.length > 0 && (
                  <span className="sessionDetailTabs__count">{linkedTasks.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="terminalModalBody">
            {!session ? (
              <div className="terminalEmptyState">Loading session data…</div>
            ) : tab === "info" ? (
              <SessionDetailsSection session={session} compact={false} />
            ) : tab === "subsessions" ? (
              subSessions.length === 0 ? (
                <div className="terminalEmptyState">No sub-sessions spawned from this session.</div>
              ) : (
                <div className="sessionDetailSubList">
                  {subSessions.map((sub) => {
                    const subTaskCount = sub.taskIds.length;
                    return (
                      <button
                        type="button"
                        key={sub.id}
                        className="sessionDetailSubItem"
                        onClick={() => setOverlay({ sessionId: sub.id, projectId: overlay.projectId })}
                      >
                        <span className={`sessionTile__statusDot sessionTile__statusDot--${sub.status}`} />
                        <span className="sessionDetailSubItem__name">{sub.name || sub.id.slice(0, 12)}</span>
                        <span className="sessionDetailSubItem__meta">
                          {SESSION_STATUS_LABELS[sub.status]}
                          {subTaskCount > 0 ? ` · ${subTaskCount} task${subTaskCount !== 1 ? "s" : ""}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : tab === "tasks" ? (
              linkedTasks.length === 0 ? (
                <div className="terminalEmptyState">No linked tasks.</div>
              ) : (
                <div>
                  {linkedTasks.map((task) => (
                    <div key={task!.id} className="sessionDetailTaskItem">
                      <span className={`terminalStatusSymbol terminalStatusSymbol--${task!.status}`}>
                        {TASK_STATUS_SYMBOLS[task!.status] || "○"}
                      </span>
                      <span className="sessionDetailTaskTitle">{task!.title}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {session.docs && session.docs.length > 0 && (
                  <div className="terminalModalSection">
                    <DocsList docs={session.docs} />
                  </div>
                )}
                <div className="terminalModalSection">
                  <h3 className="terminalModalSectionTitle">▸ Timeline</h3>
                  <div ref={timelineRef} className="sessionDetailTimelineScroller" onScroll={handleScroll}>
                    {session.timeline && session.timeline.length > 0 ? (
                      <SessionTimeline events={session.timeline} showFilters compact={false} />
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
                {sessionId ? `${sessionId.slice(0, 12)}…` : ""}
              </span>
            </div>
            <div className="terminalModalFooterRight">
              <button type="button" className="terminalModalBtn" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
