import React, { useCallback, useState } from "react";
import { MaestroTask, TaskStatus } from "../../app/types/maestro";
import { TaskCard } from "./TaskCard";
import type { DragState } from "../../hooks/useBoardDrag";

type KanbanColumnProps = {
    status: TaskStatus;
    label: string;
    symbol: string;
    tasks: MaestroTask[];
    dragState: DragState | null;
    isDragOver: boolean;
    registerColumn: (status: string, el: HTMLElement | null) => void;
    onCardPointerDown: (e: React.PointerEvent, taskId: string) => void;
    onSelectTask: (task: MaestroTask) => void;
    onWorkOnTask: (task: MaestroTask) => void;
    projectBadge?: (task: MaestroTask) => { name: string; color: string } | undefined;
    className?: string;
    collapsedClassName?: string;
    headerClassName?: string;
    bodyClassName?: string;
    emptyClassName?: string;
};

export const KanbanColumn = React.memo(function KanbanColumn({
    status,
    label,
    symbol,
    tasks,
    dragState,
    isDragOver,
    registerColumn,
    onCardPointerDown,
    onSelectTask,
    onWorkOnTask,
    projectBadge,
    className = "taskBoardColumn",
    collapsedClassName = "taskBoardColumnCollapsed",
    headerClassName = "taskBoardColumnHeader",
    bodyClassName = "taskBoardColumnBody",
    emptyClassName = "taskBoardColumnEmpty",
}: KanbanColumnProps) {
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

    if (collapsed) {
        return (
            <div
                className={collapsedClassName}
                ref={(el) => registerColumn(status, el)}
                onClick={toggleCollapse}
                title={`${label} (${tasks.length}) — click to expand`}
            >
                <span className={`${collapsedClassName}Label`}>
                    {symbol}
                </span>
                <span className={`${collapsedClassName}Count`}>
                    {tasks.length}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`${className} ${isDragOver ? `${className}--dragOver` : ""}`}
            ref={(el) => registerColumn(status, el)}
        >
            <div
                className={headerClassName}
                onClick={toggleCollapse}
                title="Click to collapse"
            >
                <span className={`taskBoardColumnDot taskBoardColumnDot--${status}`}>
                    {symbol}
                </span>
                <span className={`${headerClassName.replace("Header", "Label")}`}>{label}</span>
                <span className={`${headerClassName.replace("Header", "Count")}`}>{tasks.length}</span>
            </div>
            <div className={bodyClassName}>
                {tasks.length === 0 ? (
                    <div className={emptyClassName}>
                        <span className={`${emptyClassName}Text`}>
                            {dragState ? "drop here" : "no tasks"}
                        </span>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            isDragging={dragState?.taskId === task.id}
                            onPointerDown={onCardPointerDown}
                            onClick={() => onSelectTask(task)}
                            onWorkOn={() => onWorkOnTask(task)}
                            projectBadge={projectBadge?.(task)}
                        />
                    ))
                )}
            </div>
        </div>
    );
});
