import React from "react";
import { MaestroTask } from "../../app/types/maestro";
import { PRIORITY_COLORS } from "./boardConstants";
import type { DragState } from "../../hooks/useBoardDrag";

type DragGhostCardProps = {
    dragState: DragState;
    task: MaestroTask | null;
};

export const DragGhostCard = React.memo(function DragGhostCard({
    dragState,
    task,
}: DragGhostCardProps) {
    if (!task) return null;

    const x = dragState.x - dragState.offsetX;
    const y = dragState.y - dragState.offsetY;

    return (
        <div
            className="dragGhostCard"
            style={{
                position: "fixed",
                left: x,
                top: y,
                width: dragState.width,
                zIndex: 100000,
                pointerEvents: "none",
                transform: "rotate(2deg) scale(1.03)",
                opacity: 0.92,
                transition: "transform 0.1s ease, opacity 0.1s ease",
            }}
        >
            <div className="taskBoardCard taskBoardCard--ghost">
                <div
                    className="taskBoardCardStripe"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                />
                <div className="taskBoardCardContent">
                    <div className="taskBoardCardTitle">
                        {task.title}
                    </div>
                    <div className="taskBoardCardMeta">
                        <span className={`taskBoardCardPriority taskBoardCardPriority--${task.priority}`}>
                            {task.priority.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});
