import React from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { useSubtaskProgress } from "../../../hooks/useSubtaskProgress";
import { Icon } from "../redesign/kit";

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type SubtasksTabProps = {
    taskId: string;
    subtasks: MaestroTask[];
    newSubtaskTitle: string;
    onNewSubtaskTitleChange: (value: string) => void;
    showSubtaskInput: boolean;
    onToggleSubtaskInput: (show: boolean) => void;
    onAddSubtask: () => void;
    onToggleSubtask?: (subtaskId: string) => void;
    onDeleteSubtask?: (subtaskId: string) => void;
    onNavigateToTask?: (taskId: string) => void;
    onWorkOnSubtask?: (subtask: MaestroTask) => void;
};

export function SubtasksTab({
    taskId,
    subtasks,
    newSubtaskTitle,
    onNewSubtaskTitleChange,
    showSubtaskInput,
    onToggleSubtaskInput,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
    onNavigateToTask,
    onWorkOnSubtask,
}: SubtasksTabProps) {
    const subtaskProgress = useSubtaskProgress(taskId);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div className="pn-fhint" style={{ margin: 0 }}>
                    {subtaskProgress.total > 0
                        ? `${subtaskProgress.completed}/${subtaskProgress.total} completed (${subtaskProgress.percentage}%)`
                        : 'No subtasks yet'}
                </div>
                <button
                    type="button"
                    className="pn-mchip"
                    onClick={() => onToggleSubtaskInput(!showSubtaskInput)}
                >
                    <Icon name="plus" size={12} /> Add
                </button>
            </div>

            {showSubtaskInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    <input
                        type="text"
                        className="pn-input"
                        placeholder="Subtask title…"
                        value={newSubtaskTitle}
                        onChange={(e) => onNewSubtaskTitleChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onAddSubtask();
                            if (e.key === "Escape") {
                                onToggleSubtaskInput(false);
                                onNewSubtaskTitleChange("");
                            }
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="pn-btn pn-btn--ghost"
                            onClick={() => {
                                onToggleSubtaskInput(false);
                                onNewSubtaskTitleChange("");
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
                            onClick={onAddSubtask}
                            disabled={!newSubtaskTitle.trim()}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {subtasks.map((subtask) => (
                    <div
                        key={subtask.id}
                        className="themedSubtaskItem"
                        data-completed={subtask.status === "completed"}
                        onClick={() => onNavigateToTask?.(subtask.id)}
                        style={{ cursor: onNavigateToTask ? 'pointer' : undefined }}
                    >
                        <span
                            className="themedSubtaskCheckbox"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSubtask?.(subtask.id);
                            }}
                        >
                            {subtask.status === "completed" ? "[✓]" : "[ ]"}
                        </span>
                        <span className="themedSubtaskTitle">{subtask.title}</span>
                        <span className="pn-fhint" style={{ flexShrink: 0 }}>
                            {formatDate(subtask.createdAt)}
                        </span>
                        {onWorkOnSubtask && (
                            <button
                                type="button"
                                className="pn-mchip"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onWorkOnSubtask(subtask);
                                }}
                                title="Work on subtask"
                            >
                                <Icon name="play" size={12} />
                            </button>
                        )}
                        <button
                            type="button"
                            className="pn-mchip"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSubtask?.(subtask.id);
                            }}
                            title="Delete subtask"
                        >
                            <Icon name="x" size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
