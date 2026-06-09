import React, { useMemo, useState, useCallback } from "react";
import { MaestroTask, TaskStatus, TaskPriority } from "../../app/types/maestro";
import type { BoardTask } from "../../hooks/useMultiProjectTasks";
import { useBoardDrag } from "../../hooks/useBoardDrag";
import { DragGhostCard } from "./DragGhostCard";
import { TaskCard } from "./TaskCard";
import { COLUMNS } from "./boardConstants";
import { Icon, Glyph } from "./redesign/kit";

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

    const handleSelectTask = useCallback((task: MaestroTask) => onSelectTask(task.id), [onSelectTask]);

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
        <div className="pn-mpr">
            {/* Project header */}
            <div className="pn-mpr__hd" onClick={toggleCollapse}>
                <span className="pn-mpr__dot" style={{ background: projectColor }} />
                <span className="pn-mpr__name">{projectName}</span>
                <span className="pn-mpr__count">{rootTaskCount} tasks</span>
                <span className="pn-mpr__chev">
                    <Icon name={collapsed ? "chevronR" : "chevronD"} size={14} />
                </span>
            </div>

            {/* Kanban columns */}
            {!collapsed && (
                <div className="pn-bcols">
                    {COLUMNS.map((col) => {
                        const colTasks = columnData.get(col.status) ?? [];
                        const isDragOver = dragOverColumn === col.status;
                        const isColumnCollapsed = collapsedColumns.has(col.status);

                        if (isColumnCollapsed) {
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
                                <div className="pn-bcol__body">
                                    {colTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            isDragging={dragState?.taskId === task.id}
                                            onPointerDown={onCardPointerDown}
                                            onClick={handleSelectTask}
                                            onWorkOn={onWorkOnTask}
                                        />
                                    ))}
                                    {colTasks.length === 0 && (
                                        <div className="pn-bcol__empty">
                                            {dragState ? "drop here" : "no tasks"}
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
