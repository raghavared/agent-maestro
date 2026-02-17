import React, { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    MaestroTask,
    MaestroProject,
    TaskStatus,
    TaskPriority,
    WorkerStrategy,
    OrchestratorStrategy,
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

type BoardView = "tasks" | "sessions";
type LayoutMode = "grouped" | "unified";
type SessionLayoutMode = "grouped" | "unified";

const STORAGE_KEY = "maestro-board-selected-projects";

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
        mode?: "execute" | "coordinate";
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

    // Task stats across all selected projects
    const taskStats = useMemo(() => {
        const rootTasks = effectiveTasks.filter((t) => !t.parentId);
        return {
            total: rootTasks.length,
            active: rootTasks.filter((t) => t.status === "in_progress").length,
            pending: rootTasks.filter((t) => t.status === "todo").length,
            review: rootTasks.filter((t) => t.status === "in_review").length,
            done: rootTasks.filter((t) => t.status === "completed").length,
            blocked: rootTasks.filter((t) => t.status === "blocked").length,
        };
    }, [effectiveTasks]);

    // Session stats
    const sessionStats = useMemo(() => {
        const active = terminalSessions.filter(
            (s) => !s.exited && !s.closing && selectedProjectIds.has(s.projectId),
        );
        return {
            total: active.length,
            working: active.filter((s) => s.agentWorking).length,
            idle: active.filter((s) => !s.agentWorking).length,
        };
    }, [terminalSessions, selectedProjectIds]);

    // Task count per project (for sidebar)
    const taskCountByProject = useMemo(() => {
        const counts = new Map<string, number>();
        for (const task of effectiveTasks) {
            if (!task.parentId) {
                counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
            }
        }
        return counts;
    }, [effectiveTasks]);

    // Session count per project (for sidebar)
    const sessionCountByProject = useMemo(() => {
        const counts = new Map<string, number>();
        for (const s of terminalSessions) {
            if (!s.exited && !s.closing) {
                counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
            }
        }
        return counts;
    }, [terminalSessions]);

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
                <div className={isSingleProject ? "taskBoardHeader" : "mpbHeader"}>
                    <div className={isSingleProject ? "taskBoardHeaderLeft" : "mpbHeaderLeft"}>
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
                        {isSingleProject ? (
                            <span className="taskBoardProjectName">{headerLabel}</span>
                        ) : (
                            <>
                                <span className="mpbProjectCount">{headerLabel}</span>
                                {activeView === "tasks" && (
                                    <div className="mpbLayoutToggle">
                                        <button
                                            className={`mpbLayoutBtn ${layoutMode === "grouped" ? "mpbLayoutBtn--active" : ""}`}
                                            onClick={() => setLayoutMode("grouped")}
                                            title="Grouped by project"
                                        >
                                            ≡
                                        </button>
                                        <button
                                            className={`mpbLayoutBtn ${layoutMode === "unified" ? "mpbLayoutBtn--active" : ""}`}
                                            onClick={() => setLayoutMode("unified")}
                                            title="Unified kanban"
                                        >
                                            ⊞
                                        </button>
                                    </div>
                                )}
                                {activeView === "sessions" && (
                                    <div className="mpbLayoutToggle">
                                        <button
                                            className={`mpbLayoutBtn ${sessionLayoutMode === "grouped" ? "mpbLayoutBtn--active" : ""}`}
                                            onClick={() => setSessionLayoutMode("grouped")}
                                            title="Grouped by project"
                                        >
                                            ≡
                                        </button>
                                        <button
                                            className={`mpbLayoutBtn ${sessionLayoutMode === "unified" ? "mpbLayoutBtn--active" : ""}`}
                                            onClick={() => setSessionLayoutMode("unified")}
                                            title="Unified view"
                                        >
                                            ⊞
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="taskBoardHeaderStats">
                        {activeView === "tasks" ? (
                            <>
                                <span className="taskBoardStat taskBoardStatActive">◉ {taskStats.active}</span>
                                <span className="taskBoardStat taskBoardStatPending">○ {taskStats.pending}</span>
                                <span className="taskBoardStat taskBoardStatBlocked">✗ {taskStats.blocked}</span>
                                <span className="taskBoardStat taskBoardStatReview">◎ {taskStats.review}</span>
                                <span className="taskBoardStat taskBoardStatDone">✓ {taskStats.done}</span>
                            </>
                        ) : (
                            <>
                                <span className="taskBoardStat taskBoardStatActive">◉ {sessionStats.working}</span>
                                <span className="taskBoardStat taskBoardStatPending">○ {sessionStats.idle}</span>
                                <span className="taskBoardStat taskBoardStatDone">✓ {sessionStats.total}</span>
                            </>
                        )}
                    </div>
                    <button className="taskBoardCloseBtn" onClick={onClose} title="Close board (Esc)">
                        ✕
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
                                        <div className="mpbEmptyState">
                                            <span className="mpbEmptyText">Select projects from the sidebar</span>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <MultiProjectSessionsView
                                selectedProjectIds={selectedProjectIds}
                                projectNames={projectNames}
                                projectColors={projectColors}
                                maestroSessions={maestroSessions}
                                layoutMode={isSingleProject ? "grouped" : sessionLayoutMode}
                            />
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
            <div className="taskBoardColumns">
                {COLUMNS.map((col) => {
                    const colTasks = columnData.get(col.status) ?? [];
                    const isDragOver = dragOverColumn === col.status;
                    const isCollapsed = collapsedColumns.has(col.status);

                    if (isCollapsed) {
                        return (
                            <div
                                key={col.status}
                                className="taskBoardColumnCollapsed"
                                ref={(el) => registerColumn(col.status, el)}
                                onClick={() => toggleColumnCollapse(col.status)}
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
                            ref={(el) => registerColumn(col.status, el)}
                            style={{ maxWidth: "none" }}
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
                                            {dragState ? "drop here" : "no tasks"}
                                        </span>
                                    </div>
                                ) : (
                                    colTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            isDragging={dragState?.taskId === task.id}
                                            onPointerDown={onCardPointerDown}
                                            onClick={() => onSelectTask(task.id, task.projectId)}
                                            onWorkOn={() => onWorkOnTask(task)}
                                            projectBadge={
                                                showProjectBadge
                                                    ? { name: (task as BoardTask).projectName, color: (task as BoardTask).projectColor }
                                                    : undefined
                                            }
                                        />
                                    ))
                                )}
                            </div>
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
