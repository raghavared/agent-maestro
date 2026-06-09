import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createPortal } from "react-dom";
import {
    MaestroTask,
    MaestroProject,
    TaskStatus,
    TaskPriority,
    WorkerStrategy,
    OrchestratorStrategy,
    AgentModeInput,
} from "../../app/types/maestro";
import { useProjectStore } from "../../stores/useProjectStore";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useMultiProjectTasks, getProjectColor } from "../../hooks/useMultiProjectTasks";
import type { BoardTask } from "../../hooks/useMultiProjectTasks";
import { ProjectSelectorSidebar } from "./ProjectSelectorSidebar";
import { ProjectKanbanRow } from "./ProjectKanbanRow";
import { MultiProjectSessionsView } from "./MultiProjectSessionsView";
import { useBoardDrag } from "../../hooks/useBoardDrag";
import { DragGhostCard } from "./DragGhostCard";
import { TaskCard } from "./TaskCard";
import { COLUMNS, PRIORITY_COLORS } from "./boardConstants";
import { useTasks } from "../../hooks/useTasks";
import { Dashboard } from "./Dashboard";
import { ErrorBoundary } from "../ErrorBoundary";
import { Icon, Glyph } from "./redesign/kit";

type BoardView = "tasks" | "sessions" | "dashboard";
type LayoutMode = "grouped" | "unified";
type SessionLayoutMode = "grouped" | "unified";

const STORAGE_KEY = "maestro-board-selected-projects";

// inline-flex helper so a Glyph + count read as one chip inside pn-meta
const STAT_CHIP: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5 };

export type BoardProps = {
    onClose: () => void;
    onSelectTask: (taskId: string, projectId: string) => void;
    onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
    onWorkOnTask: (task: MaestroTask, project: MaestroProject) => void;
    onCreateMaestroSession: (input: {
        task?: MaestroTask;
        tasks?: MaestroTask[];
        project: MaestroProject;
        strategy?: WorkerStrategy | OrchestratorStrategy;
        mode?: AgentModeInput;
    }) => Promise<any>;
    focusProjectId?: string;
};

function loadSelectedProjects(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
}

function saveSelectedProjects(ids: Set<string>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch {}
}

export const Board = React.memo(function Board({
    onClose,
    onSelectTask,
    onUpdateTaskStatus,
    onWorkOnTask,
    onCreateMaestroSession,
    focusProjectId,
}: BoardProps) {
    const projects = useProjectStore((s) => s.projects);
    const maestroSessions = useMaestroStore((s) => s.sessions);
    const teamMembers = useMaestroStore((s) => s.teamMembers);
    const terminalSessions = useSessionStore((s) => s.sessions);

    const isSingleProject = !!focusProjectId;

    const [activeView, setActiveView] = useState<BoardView>("tasks");
    const [layoutMode, setLayoutMode] = useState<LayoutMode>("unified");
    const [sessionLayoutMode, setSessionLayoutMode] = useState<SessionLayoutMode>("unified");
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => {
        if (isSingleProject) return new Set([focusProjectId]);
        const saved = loadSelectedProjects();
        if (saved.size === 0) return new Set(projects.map((p) => p.id));
        const existing = new Set(projects.map((p) => p.id));
        const filtered = new Set(Array.from(saved).filter((id) => existing.has(id)));
        return filtered.size > 0 ? filtered : new Set(projects.map((p) => p.id));
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // For single-project mode, also fetch tasks via useTasks to get the same data source as MaestroPanel
    const singleProjectTasks = useTasks(focusProjectId ?? "");

    // Persist selection changes (only in multi-project mode)
    useEffect(() => {
        if (!isSingleProject) saveSelectedProjects(selectedProjectIds);
    }, [selectedProjectIds, isSingleProject]);

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

    // Build project metadata maps
    const { projectNames, projectColors, projectMap } = useMemo(() => {
        const names = new Map<string, string>();
        const colors = new Map<string, string>();
        const map = new Map<string, MaestroProject>();
        projects.forEach((p, i) => {
            names.set(p.id, p.name);
            colors.set(p.id, getProjectColor(i));
            map.set(p.id, p);
        });
        return { projectNames: names, projectColors: colors, projectMap: map };
    }, [projects]);

    const selectedProjectIdArray = useMemo(
        () => Array.from(selectedProjectIds),
        [selectedProjectIds],
    );

    const { tasks: boardTasks, loading } = useMultiProjectTasks(
        selectedProjectIdArray,
        projectNames,
        projectColors,
    );

    // In single-project mode, use tasks from useTasks hook for consistency
    const effectiveTasks: BoardTask[] = useMemo(() => {
        if (isSingleProject && singleProjectTasks.tasks.length > 0) {
            return singleProjectTasks.tasks.map((t) => ({
                ...t,
                projectName: projectNames.get(t.projectId) ?? "Unknown",
                projectColor: projectColors.get(t.projectId) ?? "#00d9ff",
            }));
        }
        return boardTasks;
    }, [isSingleProject, singleProjectTasks.tasks, boardTasks, projectNames, projectColors]);

    // Single-pass task stats + per-project counts
    const { taskStats, taskCountByProject } = useMemo(() => {
        const ts = { total: 0, active: 0, pending: 0, review: 0, done: 0, blocked: 0 };
        const tcp = new Map<string, number>();
        for (const t of effectiveTasks) {
            if (t.parentId) continue;
            ts.total++;
            if (t.status === "in_progress") ts.active++;
            else if (t.status === "todo") ts.pending++;
            else if (t.status === "in_review") ts.review++;
            else if (t.status === "completed") ts.done++;
            else if (t.status === "blocked") ts.blocked++;
            tcp.set(t.projectId, (tcp.get(t.projectId) ?? 0) + 1);
        }
        return { taskStats: ts, taskCountByProject: tcp };
    }, [effectiveTasks]);

    // Single-pass session stats + per-project counts
    const { sessionStats, sessionCountByProject } = useMemo(() => {
        const ss = { total: 0, working: 0, idle: 0 };
        const scp = new Map<string, number>();
        for (const s of terminalSessions) {
            if (s.exited || s.closing) continue;
            if (selectedProjectIds.has(s.projectId)) {
                ss.total++;
                if (s.agentWorking) ss.working++;
                else ss.idle++;
            }
            scp.set(s.projectId, (scp.get(s.projectId) ?? 0) + 1);
        }
        return { sessionStats: ss, sessionCountByProject: scp };
    }, [terminalSessions, selectedProjectIds]);

    // Maestro sessions for selected projects (for dashboard)
    const dashboardSessions = useMemo(() => {
        return Object.values(maestroSessions).filter((s) =>
            selectedProjectIds.has(s.projectId),
        );
    }, [maestroSessions, selectedProjectIds]);

    // Team members for selected projects (for dashboard)
    const dashboardTeamMembers = useMemo(() => {
        return Object.values(teamMembers).filter((m) =>
            selectedProjectIds.has(m.projectId),
        );
    }, [teamMembers, selectedProjectIds]);

    // Group tasks by project for grouped view
    const tasksByProject = useMemo(() => {
        const grouped = new Map<string, typeof effectiveTasks>();
        for (const projectId of selectedProjectIdArray) {
            grouped.set(projectId, []);
        }
        for (const task of effectiveTasks) {
            const list = grouped.get(task.projectId);
            if (list) list.push(task);
        }
        return grouped;
    }, [effectiveTasks, selectedProjectIdArray]);

    const handleToggleProject = useCallback((projectId: string) => {
        setSelectedProjectIds((prev) => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        setSelectedProjectIds(new Set(projects.map((p) => p.id)));
    }, [projects]);

    const handleDeselectAll = useCallback(() => {
        setSelectedProjectIds(new Set());
    }, []);

    const handleWorkOnTask = useCallback(
        (task: MaestroTask) => {
            const project = projectMap.get(task.projectId);
            if (project) onWorkOnTask(task, project);
        },
        [projectMap, onWorkOnTask],
    );

    // Header display
    const headerLabel = isSingleProject
        ? projectNames.get(focusProjectId!) ?? "Project"
        : `${selectedProjectIds.size} / ${projects.length} projects`;

    return createPortal(
        <div className={isSingleProject ? "taskBoardOverlay" : "mpbOverlay"}>
            <div className={isSingleProject ? "taskBoardContainer" : "mpbContainer"}>
                {/* Header */}
                <div className="pn-bd-hd">
                    <div className="pn-tabs">
                        <button type="button"
                            className={`pn-tab ${activeView === "tasks" ? "pn-tab--active" : ""}`}
                            onClick={() => setActiveView("tasks")}
                        >
                            <Icon name="listChecks" size={14} /> Tasks
                        </button>
                        <button type="button"
                            className={`pn-tab ${activeView === "sessions" ? "pn-tab--active" : ""}`}
                            onClick={() => setActiveView("sessions")}
                        >
                            <Icon name="terminal" size={14} /> Sessions
                        </button>
                        <button type="button"
                            className={`pn-tab ${activeView === "dashboard" ? "pn-tab--active" : ""}`}
                            onClick={() => setActiveView("dashboard")}
                        >
                            <Icon name="graph" size={14} /> Dashboard
                        </button>
                    </div>
                    {isSingleProject ? (
                        <span className="pn-bd-hd__title">{headerLabel}</span>
                    ) : (
                        <span className="pn-bd-hd__sub">{headerLabel}</span>
                    )}
                    {!isSingleProject && activeView === "tasks" && (
                        <div className="pn-seg">
                            <button type="button"
                                className={`pn-seg-i ${layoutMode === "grouped" ? "pn-seg-i--active" : ""}`}
                                onClick={() => setLayoutMode("grouped")}
                                title="Grouped by project"
                            >
                                <Icon name="layers" size={14} />
                            </button>
                            <button type="button"
                                className={`pn-seg-i ${layoutMode === "unified" ? "pn-seg-i--active" : ""}`}
                                onClick={() => setLayoutMode("unified")}
                                title="Unified kanban"
                            >
                                <Icon name="grid" size={14} />
                            </button>
                        </div>
                    )}
                    {!isSingleProject && activeView === "sessions" && (
                        <div className="pn-seg">
                            <button type="button"
                                className={`pn-seg-i ${sessionLayoutMode === "grouped" ? "pn-seg-i--active" : ""}`}
                                onClick={() => setSessionLayoutMode("grouped")}
                                title="Grouped by project"
                            >
                                <Icon name="layers" size={14} />
                            </button>
                            <button type="button"
                                className={`pn-seg-i ${sessionLayoutMode === "unified" ? "pn-seg-i--active" : ""}`}
                                onClick={() => setSessionLayoutMode("unified")}
                                title="Unified view"
                            >
                                <Icon name="grid" size={14} />
                            </button>
                        </div>
                    )}
                    <span className="pn-bd-hd__sp" />
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                        {activeView === "tasks" ? (
                            <>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="in_progress" size={14} />{taskStats.active}</span>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="todo" size={14} />{taskStats.pending}</span>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="blocked" size={14} />{taskStats.blocked}</span>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="in_review" size={14} />{taskStats.review}</span>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="completed" size={14} />{taskStats.done}</span>
                            </>
                        ) : activeView === "sessions" ? (
                            <>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="working" size={14} />{sessionStats.working}</span>
                                <span className="pn-meta" style={STAT_CHIP}><Glyph kind="idle" size={14} />{sessionStats.idle}</span>
                                <span className="pn-meta">{sessionStats.total} total</span>
                            </>
                        ) : (
                            <span className="pn-meta">Analytics</span>
                        )}
                    </div>
                    <button type="button" className="pn-ib" onClick={onClose} title="Close board (Esc)">
                        <Icon name="x" />
                    </button>
                </div>

                {/* Body */}
                <div className={isSingleProject ? "taskBoardBody" : "mpbBody"}>
                    {/* Sidebar (multi-project only) */}
                    {!isSingleProject && (
                        <ProjectSelectorSidebar
                            projects={projects}
                            selectedProjectIds={selectedProjectIds}
                            projectColors={projectColors}
                            taskCountByProject={taskCountByProject}
                            sessionCountByProject={sessionCountByProject}
                            collapsed={sidebarCollapsed}
                            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                            onToggleProject={handleToggleProject}
                            onSelectAll={handleSelectAll}
                            onDeselectAll={handleDeselectAll}
                        />
                    )}

                    {/* Content */}
                    <div className={isSingleProject ? "taskBoardContent" : "mpbContent"}>
                        {activeView === "tasks" ? (
                            isSingleProject || layoutMode === "unified" ? (
                                <UnifiedKanbanView
                                    tasks={effectiveTasks}
                                    onSelectTask={onSelectTask}
                                    onUpdateTaskStatus={onUpdateTaskStatus}
                                    onWorkOnTask={handleWorkOnTask}
                                    showProjectBadge={!isSingleProject}
                                />
                            ) : (
                                <div className="mpbGroupedView">
                                    {selectedProjectIdArray.map((projectId) => {
                                        const projectTasks = tasksByProject.get(projectId) ?? [];
                                        const project = projectMap.get(projectId);
                                        if (!project) return null;
                                        return (
                                            <ProjectKanbanRow
                                                key={projectId}
                                                projectId={projectId}
                                                projectName={project.name}
                                                projectColor={projectColors.get(projectId) ?? "#00d9ff"}
                                                tasks={projectTasks}
                                                onSelectTask={(taskId) => onSelectTask(taskId, projectId)}
                                                onUpdateTaskStatus={onUpdateTaskStatus}
                                                onWorkOnTask={handleWorkOnTask}
                                            />
                                        );
                                    })}
                                    {selectedProjectIdArray.length === 0 && (
                                        <div className="pn-empty">
                                            <span className="pn-empty__p">Select projects from the sidebar</span>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : activeView === "sessions" ? (
                            <MultiProjectSessionsView
                                selectedProjectIds={selectedProjectIds}
                                projectNames={projectNames}
                                projectColors={projectColors}
                                maestroSessions={maestroSessions}
                                layoutMode={isSingleProject ? "grouped" : sessionLayoutMode}
                            />
                        ) : (
                            <ErrorBoundary name="Dashboard">
                                <Dashboard
                                    tasks={effectiveTasks}
                                    sessions={dashboardSessions}
                                    teamMembers={dashboardTeamMembers}
                                    isMultiProject={!isSingleProject}
                                />
                            </ErrorBoundary>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
});

// Keep old export name for backwards compatibility
export const MultiProjectBoard = Board;

// ── Virtualized Column Body ──

function VirtualizedColumnBody({
    tasks,
    dragState,
    onCardPointerDown,
    onSelectTask,
    onWorkOnTask,
    showProjectBadge,
}: {
    tasks: BoardTask[];
    dragState: ReturnType<typeof useBoardDrag>["dragState"];
    onCardPointerDown: ReturnType<typeof useBoardDrag>["onCardPointerDown"];
    onSelectTask: (taskId: string, projectId: string) => void;
    onWorkOnTask: (task: MaestroTask) => void;
    showProjectBadge?: boolean;
}) {
    const handleSelectTask = useCallback((task: MaestroTask) => onSelectTask(task.id, task.projectId), [onSelectTask]);

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: tasks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 110,
        overscan: 5,
    });

    if (tasks.length === 0) {
        return (
            <div className="pn-bcol__body">
                <div className="pn-bcol__empty">
                    {dragState ? "drop here" : "no tasks"}
                </div>
            </div>
        );
    }

    return (
        <div ref={parentRef} className="pn-bcol__body">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const task = tasks[virtualRow.index];
                    return (
                        <div
                            key={task.id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <TaskCard
                                task={task}
                                isDragging={dragState?.taskId === task.id}
                                onPointerDown={onCardPointerDown}
                                onClick={handleSelectTask}
                                onWorkOn={onWorkOnTask}
                                projectBadge={
                                    showProjectBadge
                                        ? { name: task.projectName, color: task.projectColor }
                                        : undefined
                                }
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Unified Kanban View (now uses useBoardDrag) ──

type UnifiedKanbanViewProps = {
    tasks: BoardTask[];
    onSelectTask: (taskId: string, projectId: string) => void;
    onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
    onWorkOnTask: (task: MaestroTask) => void;
    showProjectBadge?: boolean;
};

const UnifiedKanbanView = React.memo(function UnifiedKanbanView({
    tasks,
    onSelectTask,
    onUpdateTaskStatus,
    onWorkOnTask,
    showProjectBadge = true,
}: UnifiedKanbanViewProps) {
    const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());

    const handleDrop = useCallback(
        (taskId: string, targetStatus: string) => {
            const task = tasks.find((t) => t.id === taskId);
            if (task && task.status !== targetStatus) {
                onUpdateTaskStatus(taskId, targetStatus as TaskStatus);
            }
        },
        [tasks, onUpdateTaskStatus],
    );

    const { dragState, dragOverColumn, onCardPointerDown, registerColumn } = useBoardDrag(handleDrop);

    const columnData = useMemo(() => {
        const rootTasks = tasks.filter((t) => !t.parentId);
        const grouped = new Map<TaskStatus, BoardTask[]>();
        for (const col of COLUMNS) grouped.set(col.status, []);
        for (const task of rootTasks) {
            const list = grouped.get(task.status);
            if (list) list.push(task);
            else grouped.get("completed")?.push(task);
        }
        for (const [, list] of grouped) {
            list.sort((a, b) => {
                const po: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
                const pDiff = po[a.priority] - po[b.priority];
                if (pDiff !== 0) return pDiff;
                return b.updatedAt - a.updatedAt;
            });
        }
        return grouped;
    }, [tasks]);

    const toggleColumnCollapse = useCallback((status: TaskStatus) => {
        setCollapsedColumns((prev) => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    }, []);

    return (
        <>
            <div className="pn-bcols">
                {COLUMNS.map((col) => {
                    const colTasks = columnData.get(col.status) ?? [];
                    const isDragOver = dragOverColumn === col.status;
                    const isCollapsed = collapsedColumns.has(col.status);

                    if (isCollapsed) {
                        return (
                            <div
                                key={col.status}
                                className="pn-bcol--collapsed"
                                ref={(el) => registerColumn(col.status, el)}
                                onClick={() => toggleColumnCollapse(col.status)}
                                title={`${col.label} (${colTasks.length}) — click to expand`}
                            >
                                <Glyph kind={col.status} size={15} />
                                <span className="pn-bcol__count">
                                    {colTasks.length}
                                </span>
                                <span className="pn-bcol__label">{col.label}</span>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={col.status}
                            className={`pn-bcol ${isDragOver ? "pn-bcol--over" : ""}`}
                            ref={(el) => registerColumn(col.status, el)}
                        >
                            <div
                                className="pn-bcol__hd"
                                onClick={() => toggleColumnCollapse(col.status)}
                                title="Click to collapse"
                                style={{ cursor: "pointer" }}
                            >
                                <Glyph kind={col.status} size={14} />
                                <span className="pn-bcol__label">{col.label}</span>
                                <span className="pn-bcol__count">{colTasks.length}</span>
                            </div>
                            <VirtualizedColumnBody
                                tasks={colTasks}
                                dragState={dragState}
                                onCardPointerDown={onCardPointerDown}
                                onSelectTask={onSelectTask}
                                onWorkOnTask={onWorkOnTask}
                                showProjectBadge={showProjectBadge}
                            />
                        </div>
                    );
                })}
            </div>

            {dragState && (
                <DragGhostCard
                    dragState={dragState}
                    task={tasks.find((t) => t.id === dragState.taskId) ?? null}
                />
            )}
        </>
    );
});
