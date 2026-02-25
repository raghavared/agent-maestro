import React, { useRef, useEffect } from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { useTaskBreadcrumb } from "../../../hooks/useTaskBreadcrumb";

const STATUS_LABELS: Record<string, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
};

type TaskFormHeaderProps = {
    title: string;
    onTitleChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    isEditMode: boolean;
    task?: MaestroTask;
    isOverlay: boolean;
    onClose: () => void;
    parentId?: string;
    parentTitle?: string;
    onNavigateToTask?: (taskId: string) => void;
    autoFocus?: boolean;
};

export function TaskFormHeader({
    title,
    onTitleChange,
    onKeyDown,
    isEditMode,
    task,
    isOverlay,
    onClose,
    parentId,
    parentTitle,
    onNavigateToTask,
    autoFocus,
}: TaskFormHeaderProps) {
    const titleInputRef = useRef<HTMLInputElement>(null);
    const breadcrumb = useTaskBreadcrumb(isEditMode ? task?.id ?? null : null);

    useEffect(() => {
        if (autoFocus && titleInputRef.current) {
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }
    }, [autoFocus]);

    return (
        <>
            <div className="themedModalHeader">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    {isOverlay && (
                        <button
                            className="taskDetailOverlay__backBtn"
                            onClick={onClose}
                            title="Back to terminal"
                            style={{ flexShrink: 0 }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 12L6 8l4-4" />
                            </svg>
                            Back
                        </button>
                    )}
                    {isEditMode && task ? (
                        <span className="themedTaskStatusBadge" data-status={task.status} style={{ flexShrink: 0, padding: '6px 10px', fontSize: '12px', lineHeight: '1' }}>
                            {STATUS_LABELS[task.status] || task.status}
                        </span>
                    ) : (
                        <span className="themedModalTitle" style={{ flexShrink: 0 }}>
                            [ {parentId ? 'NEW SUBTASK' : 'NEW TASK'} ]
                        </span>
                    )}
                    <input
                        ref={titleInputRef}
                        type="text"
                        className="themedFormInput"
                        style={{ flex: 1, margin: 0, padding: '6px 8px', fontSize: '13px', fontWeight: 600 }}
                        placeholder={isEditMode ? "Task title..." : "e.g., Build user authentication system"}
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                </div>
                {!isOverlay && (
                    <button className="themedModalClose" onClick={onClose}>×</button>
                )}
            </div>

            {/* Breadcrumb for edit mode */}
            {isEditMode && breadcrumb.length > 1 && (
                <div className="themedFormHint" style={{ marginBottom: '4px', padding: '0 16px' }}>
                    {breadcrumb.slice(0, -1).map(t => (
                        <span
                            key={t.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onNavigateToTask?.(t.id)}
                        >
                            {t.title} &rsaquo;{' '}
                        </span>
                    ))}
                </div>
            )}

            {/* Subtitle for create mode */}
            {!isEditMode && parentId && parentTitle && (
                <div className="themedFormHint" style={{ marginBottom: '4px', padding: '0 16px' }}>
                    Subtask of: {parentTitle}
                </div>
            )}
        </>
    );
}
