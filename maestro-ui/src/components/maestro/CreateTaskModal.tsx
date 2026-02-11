import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { MentionsInput, Mention } from 'react-mentions';
import { TaskPriority, AgentSkill, MaestroProject, MaestroTask, ModelType } from "../../app/types/maestro";
import { maestroClient } from "../../utils/MaestroClient";
import { Icon } from "../Icon";
import { AgentSelector } from "./AgentSelector";
import { ClaudeCodeSkillsSelector } from "./ClaudeCodeSkillsSelector";
import { useTaskBreadcrumb } from "../../hooks/useTaskBreadcrumb";
import { useSubtaskProgress } from "../../hooks/useSubtaskProgress";
import { useTaskSessions } from "../../hooks/useTaskSessions";

const STATUS_LABELS: Record<string, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
};

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type CreateTaskModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (task: {
        title: string;
        description: string;
        priority: TaskPriority;
        startImmediately?: boolean;
        skillIds?: string[];
        parentId?: string;
        model?: ModelType;
    }) => void;
    project: MaestroProject;
    parentId?: string;
    parentTitle?: string;
    // Edit mode props
    mode?: "create" | "edit";
    task?: MaestroTask;
    onUpdateTask?: (taskId: string, updates: Partial<MaestroTask>) => void;
    onAddSubtask?: (title: string) => void;
    onToggleSubtask?: (subtaskId: string) => void;
    onDeleteSubtask?: (subtaskId: string) => void;
    onWorkOn?: () => void;
    onNavigateToTask?: (taskId: string) => void;
    onJumpToSession?: (sessionId: string) => void;
    onWorkOnSubtask?: (subtask: MaestroTask) => void;
    selectedAgentId?: string;
    onAgentSelect?: (agentId: string) => void;
};

export function CreateTaskModal({
    isOpen,
    onClose,
    onCreate,
    project,
    parentId,
    parentTitle,
    mode = "create",
    task,
    onUpdateTask,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
    onWorkOn,
    onNavigateToTask,
    onJumpToSession,
    onWorkOnSubtask,
    selectedAgentId,
    onAgentSelect,
}: CreateTaskModalProps) {
    const isEditMode = mode === "edit" && !!task;

    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [prompt, setPrompt] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [files, setFiles] = useState<{ id: string, display: string }[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Edit mode state
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);

    // Hooks for edit mode (always called, but only used in edit mode)
    const breadcrumb = useTaskBreadcrumb(isEditMode ? task!.id : null);
    const subtaskProgress = useSubtaskProgress(isEditMode ? task!.id : null);
    const { sessions } = useTaskSessions(isEditMode ? task!.id : null);

    // Pre-fill form when task changes in edit mode
    useEffect(() => {
        if (isEditMode && task) {
            setTitle(task.title);
            setPrompt(task.description || "");
            setPriority(task.priority);
            setModel(task.model || "sonnet");
            setSelectedSkills(task.skillIds || []);
        }
    }, [isEditMode, task?.id, task?.title, task?.description, task?.priority, task?.model]);

    // Reset form when switching to create mode
    useEffect(() => {
        if (mode === "create" && isOpen) {
            setTitle("");
            setPrompt("");
            setPriority("medium");
            setModel("sonnet");
            setSelectedSkills([]);
            setShowAdvanced(false);
        }
    }, [mode, isOpen]);

    const hasUnsavedContent = mode === "create"
        ? (title.trim() !== "" || prompt.trim() !== "")
        : (isEditMode && task && (
            title !== task.title ||
            prompt !== (task.description || "") ||
            priority !== task.priority ||
            model !== (task.model || "sonnet")
        ));

    const handleClose = () => {
        if (hasUnsavedContent) {
            setShowConfirmDialog(true);
        } else {
            onClose();
        }
    };

    const handleConfirmDiscard = () => {
        setShowConfirmDialog(false);
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setModel("sonnet");
        setShowAdvanced(false);
        setSelectedSkills([]);
        onClose();
    };

    const handleCancelDiscard = () => {
        setShowConfirmDialog(false);
    };

    useEffect(() => {
        if (isOpen && !isEditMode && titleInputRef.current) {
            setTimeout(() => titleInputRef.current?.focus(), 100);
        }

        // Load files for autocomplete
        if (isOpen && project?.basePath) {
            invoke<string[]>("list_project_files", { root: project?.basePath })
                .then(fileList => {
                    const formattedFiles = fileList.map(f => ({ id: f, display: f }));
                    setFiles(formattedFiles);
                })
                .catch(err => console.error("Failed to list project files:", err));
        }
    }, [isOpen, project?.basePath]);

    if (!isOpen) return null;

    const handleSubmit = (startImmediately: boolean) => {
        if (!title.trim() || !prompt.trim()) return;

        onCreate({
            title: title.trim(),
            description: prompt,
            priority,
            startImmediately,
            skillIds: selectedSkills.length > 0 ? selectedSkills : undefined,
            parentId,
            model,
        });

        // Reset form
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setModel("sonnet");
        setShowAdvanced(false);
        setSelectedSkills([]);
        onClose();
    };

    const handleSave = () => {
        if (!isEditMode || !task) return;
        const updates: Partial<MaestroTask> = {};
        if (title.trim() && title !== task.title) updates.title = title.trim();
        if (prompt !== (task.description || "")) updates.description = prompt;
        if (priority !== task.priority) updates.priority = priority;
        if (model !== (task.model || "sonnet")) updates.model = model;
        if (JSON.stringify(selectedSkills) !== JSON.stringify(task.skillIds || [])) updates.skillIds = selectedSkills;

        if (Object.keys(updates).length > 0) {
            onUpdateTask?.(task.id, updates);
        }
        onClose();
    };

    const handleAddSubtask = () => {
        if (newSubtaskTitle.trim()) {
            onAddSubtask?.(newSubtaskTitle);
            setNewSubtaskTitle("");
            setShowSubtaskInput(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (isEditMode) {
                handleSave();
            } else {
                handleSubmit(false);
            }
        }
    };

    // Safely handle subtasks
    const subtasks = isEditMode && task ? (task.subtasks || []) : [];

    // Style for react-mentions
    const mentionsStyle = {
        control: {
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 'normal' as const,
            lineHeight: '1.5',
            minHeight: '250px',
            maxHeight: '400px',
        },
        '&multiLine': {
            control: {
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minHeight: '250px',
                maxHeight: '400px',
            },
            highlighter: {
                padding: '8px 10px',
                border: '1px solid transparent',
                color: 'transparent',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                pointerEvents: 'none' as const,
                overflow: 'hidden' as const,
            },
            input: {
                padding: '8px 10px',
                border: '1px solid transparent',
                outline: 'none',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                maxHeight: '400px',
                overflow: 'auto' as const,
            },
        },
        suggestions: {
            list: {
                zIndex: 9999,
                width: '100%',
                maxWidth: '100%',
                left: 0,
                right: 0,
                boxSizing: 'border-box' as const,
            },
            item: {
                boxSizing: 'border-box' as const,
            },
        },
    };

    const modalTitle = isEditMode
        ? 'EDIT TASK'
        : parentId
            ? 'NEW SUBTASK'
            : 'NEW TASK';

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
                <div className="themedModalHeader">
                    <span className="themedModalTitle">[ {modalTitle} ]</span>
                    <button className="themedModalClose" onClick={handleClose}>×</button>
                </div>

                <div className="themedModalContent">
                    {/* Breadcrumb for edit mode */}
                    {isEditMode && breadcrumb.length > 1 && (
                        <div className="themedFormHint" style={{ marginBottom: '8px' }}>
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

                    {/* Status info for edit mode */}
                    {isEditMode && task && (
                        <div className="themedFormRow">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="themedTaskStatusBadge" data-status={task.status}>
                                    {STATUS_LABELS[task.status] || task.status}
                                </span>
                                <span className="themedFormHint">
                                    Created {formatDate(task.createdAt)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Subtitle for create mode */}
                    {!isEditMode && parentId && parentTitle && (
                        <div className="themedFormHint" style={{ marginBottom: '10px' }}>
                            Creating subtask of: {parentTitle}
                        </div>
                    )}

                    {/* Title Input */}
                    <div className="themedFormRow">
                        <div className="themedFormLabel">Title</div>
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="themedFormInput"
                            placeholder="e.g., Build user authentication system"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Prompt/Description Textarea */}
                    <div className="themedFormRow">
                        <div className="themedFormLabel">Description</div>
                        <div className="mentionsWrapper">
                            <MentionsInput
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                style={mentionsStyle}
                                placeholder="Describe the requirements... Use @ to tag files"
                                className="mentionsInput"
                                onKeyDown={handleKeyDown}
                            >
                                <Mention
                                    trigger="@"
                                    data={files}
                                    renderSuggestion={(entry, search, highlightedDisplay, index, focused) => (
                                        <div className={`suggestionItem ${focused ? 'focused' : ''}`}>
                                            {entry.display}
                                        </div>
                                    )}
                                />
                            </MentionsInput>
                        </div>
                        <div className="themedFormHint">
                            Tip: Be specific about requirements. Use @ to tag files.
                        </div>
                    </div>

                    {/* Advanced Options */}
                    <button
                        type="button"
                        className="themedBrowseToggle"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <span className={`themedBrowseToggleArrow${showAdvanced ? " themedBrowseToggleArrow--open" : ""}`}>
                            &#9654;
                        </span>
                        Advanced options
                    </button>

                    {showAdvanced && (
                        <div style={{ paddingLeft: '12px', borderLeft: '1px solid var(--theme-border)' }}>
                            <div className="themedFormRow" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                <div className="themedFormLabel" style={{ marginBottom: 0, flexShrink: 0 }}>Priority</div>
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${priority === "low" ? "active" : ""}`}
                                        onClick={() => setPriority("low")}
                                    >
                                        Low
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${priority === "medium" ? "active" : ""}`}
                                        onClick={() => setPriority("medium")}
                                    >
                                        Medium
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${priority === "high" ? "active" : ""}`}
                                        onClick={() => setPriority("high")}
                                    >
                                        High
                                    </button>
                                </div>
                            </div>
                            <div className="themedFormRow">
                                <ClaudeCodeSkillsSelector
                                    selectedSkills={selectedSkills}
                                    onSelectionChange={setSelectedSkills}
                                />
                            </div>
                        </div>
                    )}

                    {/* Edit mode: Subtasks Section */}
                    {isEditMode && (
                        <div className="themedFormRow" style={{ borderTop: '1px solid var(--theme-border)', paddingTop: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div className="themedFormLabel" style={{ marginBottom: 0 }}>
                                    &gt; Subtasks
                                    {subtaskProgress.total > 0 && (
                                        <span style={{ fontWeight: 400, marginLeft: '8px' }}>
                                            ({subtaskProgress.completed}/{subtaskProgress.total} — {subtaskProgress.percentage}%)
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="themedBtn"
                                    onClick={() => setShowSubtaskInput(!showSubtaskInput)}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                >
                                    + add
                                </button>
                            </div>

                            {showSubtaskInput && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                                    <input
                                        type="text"
                                        className="themedFormInput"
                                        placeholder="$ enter subtask title..."
                                        value={newSubtaskTitle}
                                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddSubtask();
                                            if (e.key === "Escape") {
                                                setShowSubtaskInput(false);
                                                setNewSubtaskTitle("");
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            className="themedBtn"
                                            onClick={() => {
                                                setShowSubtaskInput(false);
                                                setNewSubtaskTitle("");
                                            }}
                                        >
                                            cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="themedBtn themedBtnPrimary"
                                            onClick={handleAddSubtask}
                                            disabled={!newSubtaskTitle.trim()}
                                        >
                                            add
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                                {subtasks.length === 0 ? (
                                    <div className="themedFormHint">No subtasks yet</div>
                                ) : (
                                    subtasks.map((subtask) => (
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
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Edit mode: Sessions Section */}
                    {isEditMode && sessions.length > 0 && (
                        <div className="themedFormRow" style={{ borderTop: '1px solid var(--theme-border)', paddingTop: '14px' }}>
                            <div className="themedFormLabel">
                                &gt; Sessions ({sessions.length})
                            </div>
                            {sessions.map(session => (
                                <div key={session.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '4px 0', borderBottom: '1px solid var(--theme-border)'
                                }}>
                                    <span className="themedTaskStatusBadge" data-status={session.status}>
                                        {session.status}
                                    </span>
                                    <span style={{ flex: 1, fontSize: '11px', color: 'var(--theme-primary)' }}>
                                        {session.name || session.id}
                                    </span>
                                    {onJumpToSession && (
                                        <button
                                            type="button"
                                            className="themedBtn"
                                            onClick={() => onJumpToSession(session.id)}
                                            title="Jump to session"
                                            style={{ padding: '0 4px', fontSize: '11px' }}
                                        >
                                            ↗
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Edit mode: Activity Stats */}
                    {isEditMode && task && (task.sessionCount ?? 0) > 0 && (
                        <div className="themedFormRow" style={{ borderTop: '1px solid var(--theme-border)', paddingTop: '14px' }}>
                            <div className="themedFormLabel">&gt; Activity</div>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                                <span>
                                    <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)' }}>sessions:</span>{' '}
                                    <span style={{ color: 'var(--theme-primary)' }}>{task.sessionCount}</span>
                                </span>
                                <span>
                                    <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)' }}>updated:</span>{' '}
                                    <span style={{ color: 'var(--theme-primary)' }}>{formatDate(task.updatedAt)}</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="themedFormActions">
                    {isEditMode ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span className="themedFormHint">model:</span>
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "haiku" ? "active" : ""}`}
                                        onClick={() => setModel("haiku")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Haiku
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "sonnet" ? "active" : ""}`}
                                        onClick={() => setModel("sonnet")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Sonnet
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "opus" ? "active" : ""}`}
                                        onClick={() => setModel("opus")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Opus
                                    </button>
                                </div>
                            </div>
                            <button type="button" className="themedBtn" onClick={handleClose}>
                                Close
                            </button>
                            <button type="button" className="themedBtn themedBtnPrimary" onClick={handleSave}>
                                Save
                            </button>
                            <button
                                type="button"
                                className="themedBtn themedBtnSuccess"
                                onClick={() => {
                                    onWorkOn?.();
                                    onClose();
                                }}
                            >
                                $ exec
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span className="themedFormHint">model:</span>
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "haiku" ? "active" : ""}`}
                                        onClick={() => setModel("haiku")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Haiku
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "sonnet" ? "active" : ""}`}
                                        onClick={() => setModel("sonnet")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Sonnet
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${model === "opus" ? "active" : ""}`}
                                        onClick={() => setModel("opus")}
                                        style={{ padding: '2px 8px', fontSize: '10px' }}
                                    >
                                        Opus
                                    </button>
                                </div>
                            </div>
                            <button type="button" className="themedBtn" onClick={handleClose}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="themedBtn themedBtnPrimary"
                                onClick={() => handleSubmit(false)}
                                disabled={!title.trim() || !prompt.trim()}
                            >
                                Create Task
                            </button>
                            <button
                                type="button"
                                className="themedBtn themedBtnSuccess"
                                onClick={() => handleSubmit(true)}
                                disabled={!title.trim() || !prompt.trim()}
                            >
                                Create &amp; Run
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="themedModalBackdrop" onClick={handleCancelDiscard}>
                    <div className="themedModal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="themedModalHeader">
                            <span className="themedModalTitle">[ UNSAVED CHANGES ]</span>
                        </div>
                        <div className="themedModalContent">
                            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(var(--theme-primary-rgb), 0.7)' }}>
                                You have unsaved task details. Are you sure you want to discard them?
                            </p>
                        </div>
                        <div className="themedFormActions">
                            <button type="button" className="themedBtn" onClick={handleCancelDiscard}>
                                Keep Editing
                            </button>
                            <button type="button" className="themedBtn themedBtnDanger" onClick={handleConfirmDiscard}>
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
