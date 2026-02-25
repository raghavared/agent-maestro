import React from "react";
import { TaskPriority, MaestroTask } from "../../../app/types/maestro";

const STATUS_LABELS: Record<string, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
};

type DetailsTabProps = {
    priority: TaskPriority;
    onPriorityChange: (priority: TaskPriority) => void;
    isEditMode: boolean;
    task?: MaestroTask;
};

export function DetailsTab({ priority, onPriorityChange, isEditMode, task }: DetailsTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="themedFormRow" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <div className="themedFormLabel" style={{ marginBottom: 0, flexShrink: 0 }}>Priority</div>
                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                    <button
                        type="button"
                        className={`themedSegmentedBtn ${priority === "low" ? "active" : ""}`}
                        onClick={() => onPriorityChange("low")}
                    >
                        Low
                    </button>
                    <button
                        type="button"
                        className={`themedSegmentedBtn ${priority === "medium" ? "active" : ""}`}
                        onClick={() => onPriorityChange("medium")}
                    >
                        Medium
                    </button>
                    <button
                        type="button"
                        className={`themedSegmentedBtn ${priority === "high" ? "active" : ""}`}
                        onClick={() => onPriorityChange("high")}
                    >
                        High
                    </button>
                </div>
            </div>
            {isEditMode && task && (
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                    <span>
                        <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)' }}>status:</span>{' '}
                        <span className="themedTaskStatusBadge" data-status={task.status}>
                            {STATUS_LABELS[task.status] || task.status}
                        </span>
                    </span>
                    <span>
                        <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)' }}>id:</span>{' '}
                        <span style={{ color: 'var(--theme-primary)', fontSize: '10px' }}>{task.id}</span>
                    </span>
                </div>
            )}
        </div>
    );
}
