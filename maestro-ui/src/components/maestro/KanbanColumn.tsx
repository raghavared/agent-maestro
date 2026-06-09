import React, { useCallback, useState } from "react";
import { MaestroTask, TaskStatus } from "../../app/types/maestro";
import { TaskCard } from "./TaskCard";
import { Glyph } from "./redesign/kit";
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
    onSelectTask: (task: MaestroTask) => void;  // stable ref — TaskCard calls with task
    onWorkOnTask: (task: MaestroTask) => void;  // stable ref — TaskCard calls with task
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
}: KanbanColumnProps) {
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);
    const glyphKind = status === "todo" ? "todo" : status;

    if (collapsed) {
        return (
            <div
                className="pn-bcol--collapsed"
                ref={(el) => registerColumn(status, el)}
                onClick={toggleCollapse}
                title={`${label} (${tasks.length}) — click to expand`}
            >
                <Glyph kind={glyphKind} size={15} />
                <span className="pn-bcol__count">{tasks.length}</span>
                <span className="pn-bcol__label">{label}</span>
            </div>
        );
    }

    return (
        <div
            className={`pn-bcol ${isDragOver ? "pn-bcol--over" : ""}`}
            ref={(el) => registerColumn(status, el)}
        >
            <div
                className="pn-bcol__hd"
                onClick={toggleCollapse}
                title="Click to collapse"
            >
                <Glyph kind={glyphKind} size={14} />
                <span className="pn-bcol__label">{label}</span>
                <span className="pn-bcol__count">{tasks.length}</span>
            </div>
            <div className="pn-bcol__body">
                {tasks.length === 0 ? (
                    <div className="pn-bcol__empty">
                        {dragState ? "drop here" : "no tasks"}
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            isDragging={dragState?.taskId === task.id}
                            onPointerDown={onCardPointerDown}
                            onClick={onSelectTask}
                            onWorkOn={onWorkOnTask}
                            projectBadge={projectBadge?.(task)}
                        />
                    ))
                )}
            </div>
        </div>
    );
});
