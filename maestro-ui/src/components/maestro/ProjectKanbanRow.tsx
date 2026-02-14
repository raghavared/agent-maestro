import React, { useMemo, useState, useCallback } from "react";
import { MaestroTask, TaskStatus, TaskPriority } from "../../app/types/maestro";
import type { BoardTask } from "../../hooks/useMultiProjectTasks";
import { useBoardDrag } from "../../hooks/useBoardDrag";
import { DragGhostCard } from "./DragGhostCard";
import { TaskCard } from "./TaskCard";
import { COLUMNS } from "./boardConstants";

type ProjectKanbanRowProps = {
    projectId: string;
    projectName: string;
    projectColor: string;
    tasks: BoardTask[];
    onSelectTask: (taskId: string) => void;
    onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
    onWorkOnTask: (task: MaestroTask) => void;
};

export const ProjectKanbanRow = React.memo(function ProjectKanbanRow({
    projectId,
    projectName,
    projectColor,
    tasks,
    onSelectTask,
    onUpdateTaskStatus,
    onWorkOnTask,
}: ProjectKanbanRowProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());

    // Pointer-based drag scoped to this row
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

    const rootTaskCount = useMemo(() => tasks.filter((t) => !t.parentId).length, [tasks]);

    const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

    const toggleColumnCollapse = useCallback((status: TaskStatus) => {
        setCollapsedColumns((prev) => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    }, []);

    return (
        <div className="mpbProjectRow">
            {/* Project header */}
            <div className="mpbProjectRowHeader" onClick={toggleCollapse}>
                <span className="mpbProjectRowColor" style={{ background: projectColor }} />
                <span className="mpbProjectRowName">{projectName}</span>
                <span className="mpbProjectRowCount">{rootTaskCount} tasks</span>
                <span className={`mpbProjectRowChevron ${collapsed ? "mpbProjectRowChevron--collapsed" : ""}`}>
                    ▼
                </span>
            </div>

            {/* Kanban columns */}
            {!collapsed && (
                <div className="mpbProjectRowColumns">
                    {COLUMNS.map((col) => {
                        const colTasks = columnData.get(col.status) ?? [];
                        const isDragOver = dragOverColumn === col.status;
                        const isColumnCollapsed = collapsedColumns.has(col.status);

                        if (isColumnCollapsed) {
                            return (
                                <div
                                    key={col.status}
                                    className="mpbKanbanColumnCollapsed"
                                    ref={(el) => registerColumn(col.status, el)}
                                    onClick={() => toggleColumnCollapse(col.status)}
                                    title={`${col.label} (${colTasks.length}) — click to expand`}
                                >
                                    <span className="mpbKanbanColumnCollapsedSymbol">
                                        {col.symbol}
                                    </span>
                                    <span className="mpbKanbanColumnCollapsedCount">
                                        {colTasks.length}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={col.status}
                                className={`mpbKanbanColumn ${isDragOver ? "mpbKanbanColumn--dragOver" : ""}`}
                                ref={(el) => registerColumn(col.status, el)}
                            >
                                <div
                                    className="mpbKanbanColumnHeader"
                                    onClick={() => toggleColumnCollapse(col.status)}
                                    title="Click to collapse"
                                >
                                    <span className={`taskBoardColumnDot taskBoardColumnDot--${col.status}`}>
                                        {col.symbol}
                                    </span>
                                    <span className="mpbKanbanColumnLabel">{col.label}</span>
                                    <span className="mpbKanbanColumnCount">{colTasks.length}</span>
                                </div>
                                <div className="mpbKanbanColumnBody">
                                    {colTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            isDragging={dragState?.taskId === task.id}
                                            onPointerDown={onCardPointerDown}
                                            onClick={() => onSelectTask(task.id)}
                                            onWorkOn={() => onWorkOnTask(task)}
                                        />
                                    ))}
                                    {colTasks.length === 0 && (
                                        <div className="mpbKanbanColumnEmpty">
                                            {dragState ? "drop here" : "—"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {dragState && (
                        <DragGhostCard
                            dragState={dragState}
                            task={tasks.find((t) => t.id === dragState.taskId) ?? null}
                        />
                    )}
                </div>
            )}
        </div>
    );
});
