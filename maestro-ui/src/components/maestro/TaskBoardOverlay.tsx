import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    MaestroTask,
    MaestroSession,
    TaskStatus,
    TaskPriority,
    TaskSessionStatus,
} from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { TerminalSession } from "../../app/types/session";
import { SessionTimeline } from "./SessionTimeline";

type BoardView = "tasks" | "sessions";

type TaskBoardOverlayProps = {
    tasks: MaestroTask[];
    projectName: string;
    onClose: () => void;
    onSelectTask: (taskId: string) => void;
    onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
    onWorkOnTask: (task: MaestroTask) => void;
};

const COLUMNS: { status: TaskStatus; label: string; symbol: string }[] = [
    { status: "todo", label: "BACKLOG", symbol: "○" },
    { status: "blocked", label: "BLOCKED", symbol: "✗" },
    { status: "in_progress", label: "IN PROGRESS", symbol: "◉" },
    { status: "in_review", label: "REVIEW", symbol: "◎" },
    { status: "completed", label: "DONE", symbol: "✓" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    high: "#ff6464",
    medium: "#ffb000",
    low: "rgba(var(--theme-primary-rgb), 0.3)",
};

const TASK_SESSION_STATUS_SYMBOL: Record<TaskSessionStatus, string> = {
    queued: "○",
    working: "◉",
    blocked: "✗",
    completed: "✓",
    failed: "✗",
    skipped: "⊘",
};

const TASK_SESSION_STATUS_COLOR: Record<TaskSessionStatus, string> = {
    queued: "rgba(var(--theme-primary-rgb), 0.4)",
    working: "#00d9ff",
    blocked: "#ef4444",
    completed: "var(--theme-primary)",
    failed: "#ef4444",
    skipped: "rgba(var(--theme-primary-rgb), 0.3)",
};

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export const TaskBoardOverlay = React.memo(function TaskBoardOverlay({
    tasks,
    projectName,
    onClose,
    onSelectTask,
    onUpdateTaskStatus,
    onWorkOnTask,
}: TaskBoardOverlayProps) {
    const maestroSessions = useMaestroStore((s) => s.sessions);
    const storeTasks = useMaestroStore((s) => s.tasks);

    const terminalSessions = useSessionStore((s) => s.sessions);
    const activeTerminalId = useSessionStore((s) => s.activeId);

    const [activeView, setActiveView] = useState<BoardView>("tasks");
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
    const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [onClose]);

    // Group tasks by status (only root tasks, not subtasks)
    const columnData = useMemo(() => {
        const rootTasks = tasks.filter((t) => !t.parentId);
        const grouped = new Map<TaskStatus, MaestroTask[]>();
        for (const col of COLUMNS) {
            grouped.set(col.status, []);
        }
        for (const task of rootTasks) {
            const list = grouped.get(task.status);
            if (list) {
                list.push(task);
            } else {
                const doneList = grouped.get("completed");
                if (doneList) doneList.push(task);
            }
        }
        for (const [, list] of grouped) {
            list.sort((a, b) => {
                const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
                const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (pDiff !== 0) return pDiff;
                return b.updatedAt - a.updatedAt;
            });
        }
        return grouped;
    }, [tasks]);

    // Task stats
    const taskStats = useMemo(() => {
        const rootTasks = tasks.filter((t) => !t.parentId);
        return {
            total: rootTasks.length,
            active: rootTasks.filter((t) => t.status === "in_progress").length,
            pending: rootTasks.filter((t) => t.status === "todo").length,
            review: rootTasks.filter((t) => t.status === "in_review").length,
            done: rootTasks.filter((t) => t.status === "completed").length,
            blocked: rootTasks.filter((t) => t.status === "blocked").length,
        };
    }, [tasks]);

    // Session stats — based on terminal sessions
    const sessionStats = useMemo(() => {
        const active = terminalSessions.filter((s) => !s.exited);
        return {
            total: active.length,
            working: active.filter((s) => s.agentWorking).length,
            idle: active.filter((s) => !s.agentWorking && !s.exited).length,
            exited: terminalSessions.filter((s) => s.exited).length,
        };
    }, [terminalSessions]);

    const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", taskId);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = "0.5";
        }
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        setDraggedTaskId(null);
        setDragOverColumn(null);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = "1";
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverColumn(status);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverColumn(null);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent, targetStatus: TaskStatus) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("text/plain");
            if (taskId && draggedTaskId) {
                const task = tasks.find((t) => t.id === taskId);
                if (task && task.status !== targetStatus) {
                    onUpdateTaskStatus(taskId, targetStatus);
                }
            }
            setDraggedTaskId(null);
            setDragOverColumn(null);
        },
        [draggedTaskId, tasks, onUpdateTaskStatus]
    );

    const toggleColumnCollapse = useCallback((status: TaskStatus) => {
        setCollapsedColumns((prev) => {
            const next = new Set(prev);
            if (next.has(status)) {
                next.delete(status);
            } else {
                next.add(status);
            }
            return next;
        });
    }, []);

    return createPortal(
        <div className="taskBoardOverlay">
            <div className="taskBoardContainer">
                {/* Header */}
                <div className="taskBoardHeader">
                    <div className="taskBoardHeaderLeft">
                        <div className="taskBoardTabs">
                            <button
                                className={`taskBoardTab ${activeView === "tasks" ? "taskBoardTab--active" : ""}`}
                                onClick={() => setActiveView("tasks")}
                            >
                                <span className="taskBoardTabSymbol">⊞</span> Tasks
                            </button>
                            <button
                                className={`taskBoardTab ${activeView === "sessions" ? "taskBoardTab--active" : ""}`}
                                onClick={() => setActiveView("sessions")}
                            >
                                <span className="taskBoardTabSymbol">◈</span> Sessions
                            </button>
                        </div>
                        <span className="taskBoardProjectName">{projectName}</span>
                    </div>
                    <div className="taskBoardHeaderStats">
                        {activeView === "tasks" ? (
                            <>
                                <span className="taskBoardStat taskBoardStatActive">
                                    ◉ {taskStats.active}
                                </span>
                                <span className="taskBoardStat taskBoardStatPending">
                                    ○ {taskStats.pending}
                                </span>
                                <span className="taskBoardStat taskBoardStatBlocked">
                                    ✗ {taskStats.blocked}
                                </span>
                                <span className="taskBoardStat taskBoardStatReview">
                                    ◎ {taskStats.review}
                                </span>
                                <span className="taskBoardStat taskBoardStatDone">
                                    ✓ {taskStats.done}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="taskBoardStat taskBoardStatActive">
                                    ◉ {sessionStats.working}
                                </span>
                                <span className="taskBoardStat taskBoardStatPending">
                                    ○ {sessionStats.idle}
                                </span>
                                <span className="taskBoardStat taskBoardStatDone">
                                    ✓ {sessionStats.total}
                                </span>
                            </>
                        )}
                    </div>
                    <button
                        className="taskBoardCloseBtn"
                        onClick={onClose}
                        title="Close board (Esc)"
                    >
                        ✕
                    </button>
                </div>

                {/* Columns */}
                {activeView === "tasks" ? (
                    <div className="taskBoardColumns">
                        {COLUMNS.map((col) => {
                            const colTasks = columnData.get(col.status) ?? [];
                            const isCollapsed = collapsedColumns.has(col.status);
                            const isDragOver = dragOverColumn === col.status;

                            if (isCollapsed) {
                                return (
                                    <div
                                        key={col.status}
                                        className="taskBoardColumnCollapsed"
                                        onClick={() => toggleColumnCollapse(col.status)}
                                        onDragOver={(e) => handleDragOver(e, col.status)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, col.status)}
                                        title={`${col.label} (${colTasks.length}) — click to expand`}
                                    >
                                        <span className="taskBoardColumnCollapsedLabel">
                                            {col.symbol}
                                        </span>
                                        <span className="taskBoardColumnCollapsedCount">
                                            {colTasks.length}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={col.status}
                                    className={`taskBoardColumn ${isDragOver ? "taskBoardColumn--dragOver" : ""}`}
                                    onDragOver={(e) => handleDragOver(e, col.status)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, col.status)}
                                >
                                    <div
                                        className="taskBoardColumnHeader"
                                        onClick={() => toggleColumnCollapse(col.status)}
                                        title="Click to collapse"
                                    >
                                        <span className={`taskBoardColumnDot taskBoardColumnDot--${col.status}`}>
                                            {col.symbol}
                                        </span>
                                        <span className="taskBoardColumnLabel">{col.label}</span>
                                        <span className="taskBoardColumnCount">{colTasks.length}</span>
                                    </div>
                                    <div className="taskBoardColumnBody">
                                        {colTasks.length === 0 ? (
                                            <div className="taskBoardColumnEmpty">
                                                <span className="taskBoardColumnEmptyText">
                                                    {draggedTaskId ? "drop here" : "no tasks"}
                                                </span>
                                            </div>
                                        ) : (
                                            colTasks.map((task) => (
                                                <TaskBoardCard
                                                    key={task.id}
                                                    task={task}
                                                    isDragging={draggedTaskId === task.id}
                                                    onDragStart={handleDragStart}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={() => onSelectTask(task.id)}
                                                    onWorkOn={() => onWorkOnTask(task)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <TerminalSessionsBoard
                        terminalSessions={terminalSessions}
                        activeTerminalId={activeTerminalId}
                        maestroSessions={maestroSessions}
                    />
                )}
            </div>
        </div>,
        document.body
    );
});

// ── Terminal Sessions Board ──

type TerminalSessionsBoardProps = {
    terminalSessions: TerminalSession[];
    activeTerminalId: string | null;
    maestroSessions: Map<string, MaestroSession>;
};

const TerminalSessionsBoard = React.memo(function TerminalSessionsBoard({
    terminalSessions,
    activeTerminalId,
    maestroSessions,
}: TerminalSessionsBoardProps) {
    const activeSessions = useMemo(() => {
        return terminalSessions.filter((s) => !s.exited);
    }, [terminalSessions]);

    if (activeSessions.length === 0) {
        return (
            <div className="taskBoardColumns">
                <div className="sessionBoardEmpty">
                    <span className="sessionBoardEmptyText">No active sessions</span>
                </div>
            </div>
        );
    }

    return (
        <div className="taskBoardColumns sessionBoardColumns">
            {activeSessions.map((session) => (
                <TerminalSessionColumn
                    key={session.id}
                    session={session}
                    isActiveTerminal={session.id === activeTerminalId}
                    maestroSession={
                        session.maestroSessionId
                            ? maestroSessions.get(session.maestroSessionId) ?? null
                            : null
                    }
                />
            ))}
        </div>
    );
});

// ── Terminal Session Column ──

type TerminalSessionColumnProps = {
    session: TerminalSession;
    isActiveTerminal: boolean;
    maestroSession: MaestroSession | null;
};

type ColumnView = "terminal" | "timeline";

const TerminalSessionColumn = React.memo(function TerminalSessionColumn({
    session,
    isActiveTerminal,
    maestroSession,
}: TerminalSessionColumnProps) {
    const [view, setView] = useState<ColumnView>("terminal");
    const terminalHostRef = useRef<HTMLDivElement>(null);

    const isWorking = session.agentWorking ?? false;
    const hasTimeline = maestroSession != null && maestroSession.timeline.length > 0;

    // DOM reparenting: move the terminal element into our host div
    useEffect(() => {
        if (view !== "terminal") return;

        const host = terminalHostRef.current;
        if (!host) return;

        const terminalEl = document.querySelector(
            `[data-terminal-id="${session.id}"]`
        ) as HTMLElement | null;
        if (!terminalEl) return;

        const originalParent = terminalEl.parentElement;
        const wasHidden = terminalEl.classList.contains("terminalHidden");

        // Move terminal into board column
        host.appendChild(terminalEl);
        terminalEl.classList.remove("terminalHidden");
        terminalEl.classList.add("terminalInBoard");

        return () => {
            // Move back to original parent
            if (originalParent) {
                originalParent.appendChild(terminalEl);
            }
            terminalEl.classList.remove("terminalInBoard");
            if (wasHidden) {
                terminalEl.classList.add("terminalHidden");
            }
        };
    }, [session.id, view]);

    return (
        <div className={`sessionBoardColumn sessionBoardColumn--terminal ${isWorking ? "sessionBoardColumn--working" : ""}`}>
            {/* Header */}
            <div className="sessionColumnHeader">
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
                    <div className="sessionColumnToggle">
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
                            {maestroSession.role ?? "worker"} | {maestroSession.strategy ?? "simple"}
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

// ── Session Task Card ──

type SessionTaskCardProps = {
    task: MaestroTask;
    sessionId: string;
    onClick: () => void;
};

const SessionTaskCard = React.memo(function SessionTaskCard({
    task,
    sessionId,
    onClick,
}: SessionTaskCardProps) {
    const sessionStatus: TaskSessionStatus =
        task.taskSessionStatuses?.[sessionId] ?? "queued";
    const symbol = TASK_SESSION_STATUS_SYMBOL[sessionStatus];
    const color = TASK_SESSION_STATUS_COLOR[sessionStatus];

    return (
        <div className="sessionTaskCard" onClick={onClick}>
            <span className="sessionTaskCardSymbol" style={{ color }}>
                {symbol}
            </span>
            <span className="sessionTaskCardTitle" title={task.title}>
                {task.title}
            </span>
            <span className="sessionTaskCardStatus" style={{ color }}>
                {sessionStatus.toUpperCase()}
            </span>
        </div>
    );
});

// ── Task Card ──

type TaskBoardCardProps = {
    task: MaestroTask;
    isDragging: boolean;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onClick: () => void;
    onWorkOn: () => void;
};

const TaskBoardCard = React.memo(function TaskBoardCard({
    task,
    isDragging,
    onDragStart,
    onDragEnd,
    onClick,
    onWorkOn,
}: TaskBoardCardProps) {
    const subtaskCount = task.subtasks?.length ?? 0;
    const completedSubtasks = task.subtasks?.filter((s) => s.status === "completed").length ?? 0;
    const isActive = task.status === "in_progress";
    const isBlocked = task.status === "blocked";
    const isCancelled = task.status === "cancelled";
    const isDone = task.status === "completed";

    return (
        <div
            className={`taskBoardCard ${isDragging ? "taskBoardCard--dragging" : ""} ${isActive ? "taskBoardCard--active" : ""} ${isBlocked ? "taskBoardCard--blocked" : ""} ${isDone ? "taskBoardCard--done" : ""} ${isCancelled ? "taskBoardCard--cancelled" : ""}`}
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onClick={onClick}
        >
            {/* Priority stripe */}
            <div
                className="taskBoardCardStripe"
                style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            />

            <div className="taskBoardCardContent">
                {/* Title */}
                <div className={`taskBoardCardTitle ${isCancelled ? "taskBoardCardTitle--cancelled" : ""}`}>
                    {task.title}
                </div>

                {/* Meta row */}
                <div className="taskBoardCardMeta">
                    <span className={`taskBoardCardPriority taskBoardCardPriority--${task.priority}`}>
                        {task.priority.toUpperCase()}
                    </span>
                    {subtaskCount > 0 && (
                        <span className="taskBoardCardSubtasks">
                            {completedSubtasks}/{subtaskCount}
                        </span>
                    )}
                    <span className="taskBoardCardTime">
                        {timeAgo(task.updatedAt)}
                    </span>
                </div>

                {/* Sessions indicator */}
                {task.sessionIds.length > 0 && (
                    <div className="taskBoardCardSessions">
                        <span className={`taskBoardCardSessionDot ${isActive ? "taskBoardCardSessionDot--active" : ""}`} />
                        <span className="taskBoardCardSessionCount">
                            {task.sessionIds.length} session{task.sessionIds.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}

                {/* Quick action */}
                {(task.status === "todo" || task.status === "blocked") && (
                    <button
                        className="taskBoardCardAction"
                        onClick={(e) => {
                            e.stopPropagation();
                            onWorkOn();
                        }}
                        title="Start working on this task"
                    >
                        <span className="terminalPrompt">$</span> work on
                    </button>
                )}
            </div>
        </div>
    );
});
