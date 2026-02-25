import React from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { useSubtaskProgress } from "../../../hooks/useSubtaskProgress";

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
                <div className="themedFormHint" style={{ margin: 0 }}>
                    {subtaskProgress.total > 0
                        ? `${subtaskProgress.completed}/${subtaskProgress.total} completed (${subtaskProgress.percentage}%)`
                        : 'No subtasks yet'}
                </div>
                <button
                    type="button"
                    className="themedBtn"
                    onClick={() => onToggleSubtaskInput(!showSubtaskInput)}
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                    + add
                </button>
            </div>

            {showSubtaskInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    <input
                        type="text"
                        className="themedFormInput"
                        placeholder="$ enter subtask title..."
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
                            className="themedBtn"
                            onClick={() => {
                                onToggleSubtaskInput(false);
                                onNewSubtaskTitleChange("");
                            }}
                        >
                            cancel
                        </button>
                        <button
                            type="button"
                            className="themedBtn themedBtnPrimary"
                            onClick={onAddSubtask}
                            disabled={!newSubtaskTitle.trim()}
                        >
                            add
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
                        <span className="themedFormHint" style={{ flexShrink: 0 }}>
                            {formatDate(subtask.createdAt)}
                        </span>
                        {onWorkOnSubtask && (
                            <button
                                type="button"
                                className="themedBtn"
                                style={{ padding: '0 4px', fontSize: '10px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onWorkOnSubtask(subtask);
                                }}
                                title="Work on subtask"
                            >
                                ▶
                            </button>
                        )}
                        <button
                            type="button"
                            className="themedBtn themedBtnDanger"
                            style={{ padding: '0 4px', fontSize: '12px' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSubtask?.(subtask.id);
                            }}
                            title="Delete subtask"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
