import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MaestroSession } from "../../app/types/maestro";
import { useSessionStore } from "../../stores/useSessionStore";
import { TerminalSession } from "../../app/types/session";
import { SessionTimeline } from "./SessionTimeline";

type ColumnView = "terminal" | "timeline";

type MultiProjectSessionsViewProps = {
    selectedProjectIds: Set<string>;
    projectNames: Map<string, string>;
    projectColors: Map<string, string>;
    maestroSessions: Map<string, MaestroSession>;
    layoutMode?: "grouped" | "unified";
};

const UNIFIED_ORDER_STORAGE_KEY = "maestro-board-session-order";

function loadSessionOrder(): string[] {
    try {
        const raw = localStorage.getItem(UNIFIED_ORDER_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return [];
}

function saveSessionOrder(order: string[]) {
    try {
        localStorage.setItem(UNIFIED_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {}
}

export const MultiProjectSessionsView = React.memo(function MultiProjectSessionsView({
    selectedProjectIds,
    projectNames,
    projectColors,
    maestroSessions,
    layoutMode = "grouped",
}: MultiProjectSessionsViewProps) {
    const terminalSessions = useSessionStore((s) => s.sessions);
    const activeTerminalId = useSessionStore((s) => s.activeId);

    // All active sessions across selected projects
    const allActiveSessions = useMemo(() => {
        return terminalSessions.filter(
            (s) => !s.exited && !s.closing && selectedProjectIds.has(s.projectId),
        );
    }, [terminalSessions, selectedProjectIds]);

    // Group active terminal sessions by project
    const sessionsByProject = useMemo(() => {
        const grouped = new Map<string, TerminalSession[]>();
        for (const projectId of selectedProjectIds) {
            grouped.set(projectId, []);
        }
        for (const session of allActiveSessions) {
            const list = grouped.get(session.projectId);
            if (list) list.push(session);
        }
        return grouped;
    }, [allActiveSessions, selectedProjectIds]);

    const hasAnySessions = allActiveSessions.length > 0;

    if (!hasAnySessions) {
        return (
            <div className="mpbSessionsEmpty">
                <span className="mpbEmptyText">No active sessions for selected projects</span>
            </div>
        );
    }

    if (layoutMode === "unified") {
        return (
            <UnifiedSessionsView
                sessions={allActiveSessions}
                activeTerminalId={activeTerminalId}
                maestroSessions={maestroSessions}
                projectNames={projectNames}
                projectColors={projectColors}
            />
        );
    }

    return (
        <div className="mpbSessionsView">
            {Array.from(sessionsByProject.entries()).map(([projectId, sessions]) => {
                if (sessions.length === 0) return null;
                return (
                    <SessionProjectGroup
                        key={projectId}
                        projectId={projectId}
                        projectName={projectNames.get(projectId) ?? "Unknown"}
                        projectColor={projectColors.get(projectId) ?? "#00d9ff"}
                        sessions={sessions}
                        activeTerminalId={activeTerminalId}
                        maestroSessions={maestroSessions}
                    />
                );
            })}
        </div>
    );
});

// ── Unified Sessions View (all projects combined, reorderable) ──

type UnifiedSessionsViewProps = {
    sessions: TerminalSession[];
    activeTerminalId: string | null;
    maestroSessions: Map<string, MaestroSession>;
    projectNames: Map<string, string>;
    projectColors: Map<string, string>;
};

const UnifiedSessionsView = React.memo(function UnifiedSessionsView({
    sessions,
    activeTerminalId,
    maestroSessions,
    projectNames,
    projectColors,
}: UnifiedSessionsViewProps) {
    // Maintain user-defined order. Store session IDs in order.
    const [sessionOrder, setSessionOrder] = useState<string[]>(() => loadSessionOrder());

    // Reconcile order with actual sessions: remove closed ones, append new ones
    const orderedSessions = useMemo(() => {
        const activeIds = new Set(sessions.map((s) => s.id));
        const sessionMap = new Map(sessions.map((s) => [s.id, s]));

        // Filter out closed sessions from saved order
        const validOrder = sessionOrder.filter((id) => activeIds.has(id));

        // Find new sessions not in the order yet
        const orderedSet = new Set(validOrder);
        const newSessions = sessions.filter((s) => !orderedSet.has(s.id));

        // Combine: existing order + new sessions at the end
        const finalOrder = [...validOrder, ...newSessions.map((s) => s.id)];
        return finalOrder.map((id) => sessionMap.get(id)!).filter(Boolean);
    }, [sessions, sessionOrder]);

    // Persist order whenever it changes (only save IDs that are still active)
    useEffect(() => {
        const activeIds = new Set(sessions.map((s) => s.id));
        const cleanedOrder = sessionOrder.filter((id) => activeIds.has(id));
        // Add any new sessions
        const orderedSet = new Set(cleanedOrder);
        const newIds = sessions.filter((s) => !orderedSet.has(s.id)).map((s) => s.id);
        const finalOrder = [...cleanedOrder, ...newIds];
        if (JSON.stringify(finalOrder) !== JSON.stringify(sessionOrder)) {
            setSessionOrder(finalOrder);
            saveSessionOrder(finalOrder);
        }
    }, [sessions, sessionOrder]);

    // Drag-to-reorder state
    const [dragSessionId, setDragSessionId] = useState<string | null>(null);
    const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, sessionId: string) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", sessionId);
        setDragSessionId(sessionId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, sessionId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverSessionId(sessionId);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverSessionId(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetSessionId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData("text/plain");
        if (!sourceId || sourceId === targetSessionId) {
            setDragSessionId(null);
            setDragOverSessionId(null);
            return;
        }

        setSessionOrder((prev) => {
            const activeIds = new Set(sessions.map((s) => s.id));
            let order = prev.filter((id) => activeIds.has(id));
            // Ensure all sessions are in the order
            const orderSet = new Set(order);
            for (const s of sessions) {
                if (!orderSet.has(s.id)) order.push(s.id);
            }

            const sourceIdx = order.indexOf(sourceId);
            const targetIdx = order.indexOf(targetSessionId);
            if (sourceIdx === -1 || targetIdx === -1) return prev;

            // Move source to target position
            const newOrder = [...order];
            newOrder.splice(sourceIdx, 1);
            newOrder.splice(targetIdx, 0, sourceId);
            saveSessionOrder(newOrder);
            return newOrder;
        });

        setDragSessionId(null);
        setDragOverSessionId(null);
    }, [sessions]);

    const handleDragEnd = useCallback(() => {
        setDragSessionId(null);
        setDragOverSessionId(null);
    }, []);

    return (
        <div className="mpbSessionsView">
            <div className="mpbSessionColumns mpbSessionColumns--unified">
                {orderedSessions.map((session) => {
                    const projectName = projectNames.get(session.projectId) ?? "Unknown";
                    const projectColor = projectColors.get(session.projectId) ?? "#00d9ff";
                    const isDragOver = dragOverSessionId === session.id && dragSessionId !== session.id;

                    return (
                        <div
                            key={session.id}
                            className={`mpbUnifiedSessionWrapper ${isDragOver ? "mpbUnifiedSessionWrapper--dragOver" : ""} ${dragSessionId === session.id ? "mpbUnifiedSessionWrapper--dragging" : ""}`}
                            {...(session.maestroSessionId ? { 'data-maestro-session-id': session.maestroSessionId } : {})}
                            draggable
                            onDragStart={(e) => handleDragStart(e, session.id)}
                            onDragOver={(e) => handleDragOver(e, session.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, session.id)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="mpbUnifiedSessionBadge" style={{ borderColor: projectColor }}>
                                <span className="mpbUnifiedSessionBadgeDot" style={{ background: projectColor }} />
                                <span className="mpbUnifiedSessionBadgeName">{projectName}</span>
                                <span className="mpbUnifiedSessionDragHandle" title="Drag to reorder">⋮⋮</span>
                            </div>
                            <ResizableSessionColumn
                                session={session}
                                isActiveTerminal={session.id === activeTerminalId}
                                maestroSession={
                                    session.maestroSessionId
                                        ? maestroSessions.get(session.maestroSessionId) ?? null
                                        : null
                                }
                                width={0}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// ── Session Project Group (with resizable columns) ──

type SessionProjectGroupProps = {
    projectId: string;
    projectName: string;
    projectColor: string;
    sessions: TerminalSession[];
    activeTerminalId: string | null;
    maestroSessions: Map<string, MaestroSession>;
};

const MIN_COL_WIDTH = 80;

const SessionProjectGroup = React.memo(function SessionProjectGroup({
    projectId,
    projectName,
    projectColor,
    sessions,
    activeTerminalId,
    maestroSessions,
}: SessionProjectGroupProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="mpbSessionProjectGroup">
            <div
                className="mpbSessionProjectHeader"
                onClick={() => setCollapsed((v) => !v)}
                style={{ cursor: "pointer" }}
            >
                <span className="mpbProjectRowColor" style={{ background: projectColor }} />
                <span className="mpbSessionProjectName">{projectName}</span>
                <span className="mpbSessionProjectCount">
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                </span>
                <span className={`mpbProjectRowChevron ${collapsed ? "mpbProjectRowChevron--collapsed" : ""}`}>
                    ▼
                </span>
            </div>
            {!collapsed && (
                <div className="mpbSessionColumns">
                    {sessions.map((session) => (
                        <ResizableSessionColumn
                            key={session.id}
                            session={session}
                            isActiveTerminal={session.id === activeTerminalId}
                            maestroSession={
                                session.maestroSessionId
                                    ? maestroSessions.get(session.maestroSessionId) ?? null
                                    : null
                            }
                            width={0}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

// ── Resizable Session Column with collapse ──

type ResizableSessionColumnProps = {
    session: TerminalSession;
    isActiveTerminal: boolean;
    maestroSession: MaestroSession | null;
    width: number;
};

const ResizableSessionColumn = React.memo(function ResizableSessionColumn({
    session,
    isActiveTerminal,
    maestroSession,
    width,
}: ResizableSessionColumnProps) {
    const [view, setView] = useState<ColumnView>("terminal");
    const [columnCollapsed, setColumnCollapsed] = useState(false);
    const terminalHostRef = useRef<HTMLDivElement>(null);

    const isWorking = session.agentWorking ?? false;
    const hasTimeline = maestroSession != null && maestroSession.timeline.length > 0;

    // DOM reparenting: move the terminal element into our host div
    useEffect(() => {
        if (view !== "terminal" || columnCollapsed) return;

        const host = terminalHostRef.current;
        if (!host) return;

        const terminalEl = document.querySelector(
            `[data-terminal-id="${session.id}"]`,
        ) as HTMLElement | null;
        if (!terminalEl) return;

        const originalParent = terminalEl.parentElement;
        const wasHidden = terminalEl.classList.contains("terminalHidden");

        host.appendChild(terminalEl);
        terminalEl.classList.remove("terminalHidden");
        terminalEl.classList.add("terminalInBoard");

        return () => {
            if (originalParent) {
                originalParent.appendChild(terminalEl);
            }
            terminalEl.classList.remove("terminalInBoard");
            if (wasHidden) {
                terminalEl.classList.add("terminalHidden");
            }
        };
    }, [session.id, view, columnCollapsed]);

    if (columnCollapsed) {
        return (
            <div
                className="mpbSessionColumnCollapsed"
                onClick={() => setColumnCollapsed(false)}
                title={`${session.name} — click to expand`}
            >
                <span
                    className="mpbSessionColumnCollapsedDot"
                    style={{ color: isWorking ? "#00d9ff" : "rgba(var(--theme-primary-rgb), 0.5)" }}
                >
                    {isWorking ? "◉" : "○"}
                </span>
                <span className="mpbSessionColumnCollapsedName">
                    {session.name}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`sessionBoardColumn sessionBoardColumn--terminal ${isWorking ? "sessionBoardColumn--working" : ""}`}
            style={{ minWidth: `${MIN_COL_WIDTH}px`, flex: '1 1 0' }}
            {...(session.maestroSessionId ? { 'data-maestro-session-id': session.maestroSessionId } : {})}
        >
            {/* Header — click to collapse */}
            <div
                className="sessionColumnHeader"
                onClick={() => setColumnCollapsed(true)}
                style={{ cursor: "pointer" }}
                title="Click to minimize"
            >
                <div className="sessionColumnHeaderTop">
                    <span
                        className={`sessionColumnStatusDot ${isWorking ? "sessionColumnStatusDot--working" : ""}`}
                        style={{ color: isWorking ? "#00d9ff" : "rgba(var(--theme-primary-rgb), 0.5)" }}
                    >
                        {isWorking ? "◉" : "○"}
                    </span>
                    <span className="sessionColumnName" title={session.name}>
                        {session.name}
                    </span>
                    <div className="sessionColumnToggle" onClick={(e) => e.stopPropagation()}>
                        <button
                            className={`sessionColumnToggleBtn ${view === "terminal" ? "sessionColumnToggleBtn--active" : ""}`}
                            onClick={() => setView("terminal")}
                            title="Terminal view"
                        >
                            &gt;_
                        </button>
                        {hasTimeline && (
                            <button
                                className={`sessionColumnToggleBtn ${view === "timeline" ? "sessionColumnToggleBtn--active" : ""}`}
                                onClick={() => setView("timeline")}
                                title="Timeline view"
                            >
                                TL
                            </button>
                        )}
                    </div>
                </div>
                {maestroSession && (
                    <div className="sessionColumnHeaderBottom">
                        <span className="sessionColumnMeta">
                            {maestroSession.mode ?? "worker"} | {maestroSession.strategy ?? "simple"}
                        </span>
                    </div>
                )}
            </div>

            {/* Body */}
            {view === "terminal" ? (
                <div className="sessionColumnTerminalHost" ref={terminalHostRef} />
            ) : hasTimeline && maestroSession ? (
                <div className="sessionColumnTimeline sessionColumnTimeline--full">
                    <SessionTimeline
                        events={maestroSession.timeline}
                        compact
                        showFilters={false}
                        title="Timeline"
                    />
                </div>
            ) : (
                <div className="sessionColumnTerminalHost" ref={terminalHostRef} />
            )}
        </div>
    );
});
