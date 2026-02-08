import React, { useState, useRef, useEffect } from "react";
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
        initialPrompt: string;
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
            setPrompt(task.initialPrompt || "");
            setPriority(task.priority);
            setModel(task.model || "sonnet");
            setSelectedSkills(task.skillIds || []);
        }
    }, [isEditMode, task?.id, task?.title, task?.initialPrompt, task?.priority, task?.model]);

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
            prompt !== (task.initialPrompt || "") ||
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
            initialPrompt: prompt,
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
        if (prompt !== (task.initialPrompt || "")) updates.initialPrompt = prompt;
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
            fontSize: '14px',
            fontWeight: 'normal',
            lineHeight: '1.5',
            minHeight: '150px',
        },
        '&multiLine': {
            control: {
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minHeight: '150px',
            },
            highlighter: {
                padding: '12px',
                border: '1px solid transparent',
                color: 'transparent',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '14px',
                lineHeight: '1.5',
            },
            input: {
                padding: '12px',
                border: '1px solid transparent',
                outline: 'none',
                color: '#e0e0e0',
                backgroundColor: 'transparent',
                caretColor: '#e0e0e0',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '14px',
                lineHeight: '1.5',
            },
        },
        suggestions: {
            list: {
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                fontSize: '13px',
                maxHeight: '200px',
                overflowY: 'auto' as const,
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                borderRadius: '4px',
                zIndex: 9999,
            },
            item: {
                padding: '8px 12px',
                borderBottom: '1px solid #333',
                color: '#ccc',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                '&focused': {
                    backgroundColor: '#2a4a3a',
                    color: '#fff',
                },
            },
        },
    };

    return (
        <div className="maestroModalOverlay terminalModal" onClick={isEditMode ? onClose : undefined}>
            <div className="createTaskModal terminalTheme" onClick={isEditMode ? (e) => e.stopPropagation() : undefined}>
                <div className="createTaskModalHeader">
                    <div className="createTaskModalHeaderContent">
                        <div className="createTaskModalIcon">
                            <Icon name="terminal" />
                        </div>
                        <div>
                            {isEditMode && breadcrumb.length > 1 && (
                                <div className="terminalModalBreadcrumb" style={{ marginBottom: '4px' }}>
                                    {breadcrumb.slice(0, -1).map(t => (
                                        <span
                                            key={t.id}
                                            className="terminalBreadcrumbItem"
                                            onClick={() => onNavigateToTask?.(t.id)}
                                            style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '12px' }}
                                        >
                                            {t.title} ›{' '}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <h2 className="createTaskModalTitle">
                                {isEditMode ? 'Edit Task' : (parentId ? 'New Subtask' : 'New Agent Task')}
                            </h2>
                            <p className="createTaskModalSubtitle">
                                {isEditMode && task ? (
                                    <>
                                        <span className={`terminalModalStatusBadge terminalModalStatusBadge--${task.status}`} style={{ marginRight: '8px' }}>
                                            {STATUS_LABELS[task.status] || task.status}
                                        </span>
                                        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                            Created {formatDate(task.createdAt)}
                                        </span>
                                    </>
                                ) : parentId && parentTitle
                                    ? `Creating subtask of: ${parentTitle}`
                                    : 'Give your task a title and describe what you want Claude to build'
                                }
                            </p>
                        </div>
                    </div>
                    <button className="createTaskModalClose" onClick={handleClose}>
                        <Icon name="close" />
                    </button>
                </div>

                <div className="createTaskModalBody">
                    {/* Title Input */}
                    <div className="createTaskTitleContainer">
                        <label className="createTaskLabel">Task Title</label>
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="createTaskTitleInput"
                            placeholder="e.g., Build user authentication system"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Prompt/Description Textarea */}
                    <div className="createTaskPromptContainer">
                        <label className="createTaskLabel">Task Description</label>
                        <div className="createTaskPromptWrapper mentionsWrapper">
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
                            <div className="createTaskPromptGlow"></div>
                        </div>
                        <div className="createTaskPromptHint">
                            <Icon name="message" />
                            <span>Tip: Be specific about requirements. Use <strong>@</strong> to tag files.</span>
                        </div>
                    </div>

                    <div className="createTaskOptions">
                        <div className="createTaskOptionRow">
                            <span className="createTaskOptionLabel">Priority</span>
                            <div className="createTaskPrioritySelector">
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "low" ? "active" : ""}`}
                                    onClick={() => setPriority("low")}
                                >
                                    Low
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "medium" ? "active" : ""}`}
                                    onClick={() => setPriority("medium")}
                                >
                                    Medium
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${priority === "high" ? "active" : ""}`}
                                    onClick={() => setPriority("high")}
                                >
                                    High
                                </button>
                            </div>
                        </div>

                        <div className="createTaskOptionRow">
                            <span className="createTaskOptionLabel">Model</span>
                            <div className="createTaskPrioritySelector">
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "haiku" ? "active" : ""}`}
                                    onClick={() => setModel("haiku")}
                                >
                                    Haiku
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "sonnet" ? "active" : ""}`}
                                    onClick={() => setModel("sonnet")}
                                >
                                    Sonnet
                                </button>
                                <button
                                    type="button"
                                    className={`createTaskPriorityBtn ${model === "opus" ? "active" : ""}`}
                                    onClick={() => setModel("opus")}
                                >
                                    Opus
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="createTaskAdvancedToggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            Advanced options
                            <span className={`createTaskAdvancedChevron ${showAdvanced ? "open" : ""}`}>›</span>
                        </button>

                        {showAdvanced && (
                            <div className="createTaskAdvancedOptions">
                                <div className="createTaskAdvancedSection">
                                    <label className="createTaskAdvancedLabel">Claude Code Skills</label>
                                    <ClaudeCodeSkillsSelector
                                        selectedSkills={selectedSkills}
                                        onSelectionChange={setSelectedSkills}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Edit mode: Subtasks Section */}
                    {isEditMode && (
                        <div className="terminalModalSection" style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '16px' }}>
                            <div className="terminalModalSectionHeader">
                                <h3 className="terminalModalSectionTitle">
                                    &gt; Subtasks
                                    {subtaskProgress.total > 0 && (
                                        <span className="terminalModalSubtaskCount">
                                            ({subtaskProgress.completed}/{subtaskProgress.total} — {subtaskProgress.percentage}%)
                                        </span>
                                    )}
                                </h3>
                                <button
                                    className="terminalModalAddBtn"
                                    onClick={() => setShowSubtaskInput(!showSubtaskInput)}
                                >
                                    + add
                                </button>
                            </div>

                            {showSubtaskInput && (
                                <div className="terminalModalSubtaskInput">
                                    <input
                                        type="text"
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
                                    <div className="terminalModalSubtaskInputActions">
                                        <button
                                            className="terminalModalBtn terminalModalBtnSecondary"
                                            onClick={() => {
                                                setShowSubtaskInput(false);
                                                setNewSubtaskTitle("");
                                            }}
                                        >
                                            cancel
                                        </button>
                                        <button
                                            className="terminalModalBtn terminalModalBtnPrimary"
                                            onClick={handleAddSubtask}
                                            disabled={!newSubtaskTitle.trim()}
                                        >
                                            add
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="terminalModalSubtaskList">
                                {subtasks.length === 0 ? (
                                    <div className="terminalModalEmptyState">
                                        <p>No subtasks yet</p>
                                    </div>
                                ) : (
                                    subtasks.map((subtask) => (
                                        <div
                                            key={subtask.id}
                                            className={`terminalModalSubtaskItem ${subtask.status === "completed" ? "completed" : ""}`}
                                            onClick={() => onNavigateToTask?.(subtask.id)}
                                            style={{ cursor: onNavigateToTask ? 'pointer' : undefined }}
                                        >
                                            <div
                                                className="terminalModalSubtaskCheckbox"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleSubtask?.(subtask.id);
                                                }}
                                            >
                                                {subtask.status === "completed" ? "[✓]" : "[ ]"}
                                            </div>
                                            <span className="terminalModalSubtaskTitle">{subtask.title}</span>
                                            <span className="terminalModalSubtaskTime">
                                                {formatDate(subtask.createdAt)}
                                            </span>
                                            {onWorkOnSubtask && (
                                                <button
                                                    className="terminalPlayBtn"
                                                    style={{ fontSize: '10px', padding: '0 4px' }}
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
                                                className="terminalModalSubtaskDelete"
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
                        <div className="terminalModalSection" style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '16px' }}>
                            <h3 className="terminalModalSectionTitle">
                                &gt; Sessions ({sessions.length})
                            </h3>
                            {sessions.map(session => (
                                <div key={session.id} className="terminalModalSessionItem" style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '6px 8px', borderBottom: '1px solid #333'
                                }}>
                                    <span className={`terminalSessionStatusBadge terminalSessionStatusBadge--${session.status}`}
                                        style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '2px' }}>
                                        {session.status}
                                    </span>
                                    <span style={{ flex: 1, fontSize: '13px' }}>{session.name || session.id}</span>
                                    {onJumpToSession && (
                                        <button
                                            className="terminalSessionBtn"
                                            onClick={() => onJumpToSession(session.id)}
                                            title="Jump to session"
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green, #00ff00)' }}
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
                        <div className="terminalModalSection" style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '16px' }}>
                            <h3 className="terminalModalSectionTitle">
                                &gt; Activity
                            </h3>
                            <div className="terminalModalStats">
                                <div className="terminalModalStatItem">
                                    <span className="terminalModalStatLabel">sessions:</span>
                                    <span className="terminalModalStatValue">{task.sessionCount}</span>
                                </div>
                                <div className="terminalModalStatItem">
                                    <span className="terminalModalStatLabel">updated:</span>
                                    <span className="terminalModalStatValue">{formatDate(task.updatedAt)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="createTaskModalFooter">
                    {isEditMode ? (
                        <>
                            <div className="createTaskModalFooterLeft" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="terminalModalFooterLabel" style={{ fontSize: '12px', color: 'var(--muted)' }}>agent:</span>
                                {selectedAgentId && onAgentSelect && (
                                    <AgentSelector
                                        selectedAgentId={selectedAgentId}
                                        onSelectAgent={onAgentSelect}
                                        compact={true}
                                    />
                                )}
                            </div>
                            <div className="createTaskModalFooterRight">
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnSecondary"
                                    onClick={handleClose}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnPrimary"
                                    onClick={handleSave}
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnSuccess"
                                    onClick={() => {
                                        onWorkOn?.();
                                        onClose();
                                    }}
                                >
                                    $ exec
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="createTaskModalFooterLeft">
                                <span className="createTaskModalKeyboardHint">
                                    ⌘↵ to create
                                </span>
                            </div>
                            <div className="createTaskModalFooterRight">
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnSecondary"
                                    onClick={handleClose}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnPrimary"
                                    onClick={() => handleSubmit(false)}
                                    disabled={!title.trim() || !prompt.trim()}
                                >
                                    <Icon name="plus" />
                                    Create Task
                                </button>
                                <button
                                    type="button"
                                    className="createTaskBtn createTaskBtnSuccess"
                                    onClick={() => handleSubmit(true)}
                                    disabled={!title.trim() || !prompt.trim()}
                                >
                                    <Icon name="play" />
                                    Create & Run
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="maestroModalOverlay confirmDialogOverlay" onClick={handleCancelDiscard}>
                    <div className="confirmDialog terminalTheme" onClick={(e) => e.stopPropagation()}>
                        <div className="confirmDialogHeader">
                            <span className="confirmDialogIcon">⚠</span>
                            <span>Unsaved Changes</span>
                        </div>
                        <div className="confirmDialogBody">
                            You have unsaved task details. Are you sure you want to discard them?
                        </div>
                        <div className="confirmDialogFooter">
                            <button
                                type="button"
                                className="createTaskBtn createTaskBtnSecondary"
                                onClick={handleCancelDiscard}
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                className="createTaskBtn createTaskBtnDanger"
                                onClick={handleConfirmDiscard}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
