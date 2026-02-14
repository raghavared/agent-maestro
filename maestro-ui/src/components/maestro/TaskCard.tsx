import React, { useCallback, useEffect, useRef } from "react";
import { MaestroTask } from "../../app/types/maestro";
import { PRIORITY_COLORS, timeAgo } from "./boardConstants";

type TaskCardProps = {
    task: MaestroTask;
    isDragging: boolean;
    onPointerDown: (e: React.PointerEvent, taskId: string) => void;
    onClick: () => void;
    onWorkOn: () => void;
    projectBadge?: { name: string; color: string };
};

export const TaskCard = React.memo(function TaskCard({
    task,
    isDragging,
    onPointerDown,
    onClick,
    onWorkOn,
    projectBadge,
}: TaskCardProps) {
    const wasDraggingRef = useRef(false);

    const subtaskCount = task.subtasks?.length ?? 0;
    const completedSubtasks = task.subtasks?.filter((s) => s.status === "completed").length ?? 0;
    const isActive = task.status === "in_progress";
    const isBlocked = task.status === "blocked";
    const isCancelled = task.status === "cancelled";
    const isDone = task.status === "completed";

    useEffect(() => {
        if (isDragging) {
            wasDraggingRef.current = true;
        }
    }, [isDragging]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        onPointerDown(e, task.id);
    }, [onPointerDown, task.id]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (wasDraggingRef.current) {
            wasDraggingRef.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        onClick();
    }, [onClick]);

    return (
        <div
            className={`taskBoardCard ${isDragging ? "taskBoardCard--dragging" : ""} ${isActive ? "taskBoardCard--active" : ""} ${isBlocked ? "taskBoardCard--blocked" : ""} ${isDone ? "taskBoardCard--done" : ""} ${isCancelled ? "taskBoardCard--cancelled" : ""}`}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
        >
            <div
                className="taskBoardCardStripe"
                style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            />
            <div className="taskBoardCardContent">
                {projectBadge && (
                    <span
                        className="mpbProjectBadge"
                        style={{ borderColor: projectBadge.color, color: projectBadge.color }}
                    >
                        {projectBadge.name}
                    </span>
                )}
                <div className={`taskBoardCardTitle ${isCancelled ? "taskBoardCardTitle--cancelled" : ""}`}>
                    {task.title}
                </div>
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
                {task.sessionIds.length > 0 && (
                    <div className="taskBoardCardSessions">
                        <span className={`taskBoardCardSessionDot ${isActive ? "taskBoardCardSessionDot--active" : ""}`} />
                        <span className="taskBoardCardSessionCount">
                            {task.sessionIds.length} session{task.sessionIds.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                )}
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
