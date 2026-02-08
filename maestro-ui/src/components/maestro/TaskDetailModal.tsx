import React, { useState, useEffect } from "react";
import { Icon } from "../Icon";
import { MaestroTask, MaestroSubtask, TaskStatus, TaskPriority, AgentSkill } from "../../app/types/maestro";
import { AgentSelector } from "./AgentSelector";
import { useTaskBreadcrumb } from "../../hooks/useTaskBreadcrumb";
import { useSubtaskProgress } from "../../hooks/useSubtaskProgress";
import { useTaskSessions } from "../../hooks/useTaskSessions";
import { maestroClient } from "../../utils/MaestroClient";

type TaskDetailModalProps = {
    task: MaestroTask;
    isOpen: boolean;
    onClose: () => void;
    onAddSubtask: (title: string) => void;
    onToggleSubtask: (subtaskId: string) => void;
    onDeleteSubtask: (subtaskId: string) => void;
    onWorkOn: () => void;
    selectedAgentId: string;
    onAgentSelect: (agentId: string) => void;
    onNavigateToTask?: (taskId: string) => void;
    onJumpToSession?: (sessionId: string) => void;
    onWorkOnSubtask?: (subtask: MaestroTask) => void;
    onUpdateTask?: (taskId: string, updates: { title?: string; initialPrompt?: string }) => void;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: "Low Priority",
    medium: "Medium Priority",
    high: "High Priority",
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

export function TaskDetailModal({
    task,
    isOpen,
    onClose,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
    onWorkOn,
    selectedAgentId,
    onAgentSelect,
    onNavigateToTask,
    onJumpToSession,
    onWorkOnSubtask,
    onUpdateTask,
}: TaskDetailModalProps) {
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [editedPrompt, setEditedPrompt] = useState(task.initialPrompt || "");
    const [availableSkills, setAvailableSkills] = useState<AgentSkill[]>([]);
    const [skillsLoading, setSkillsLoading] = useState(true);
    const [showAllSkills, setShowAllSkills] = useState(false);

    const breadcrumb = useTaskBreadcrumb(task?.id ?? null);
    const subtaskProgress = useSubtaskProgress(task?.id ?? null);
    const { sessions } = useTaskSessions(task?.id ?? null);

    // Fetch available skills
    useEffect(() => {
        const loadSkills = async () => {
            try {
                setSkillsLoading(true);
                const skills = await maestroClient.getSkills();
                setAvailableSkills(skills);
            } catch (error) {
                console.error('[TaskDetailModal] Failed to load skills:', error);
                setAvailableSkills([]);
            } finally {
                setSkillsLoading(false);
            }
        };

        if (isOpen) {
            loadSkills();
        }
    }, [isOpen]);

    // Sync edited values when task changes
    useEffect(() => {
        setEditedTitle(task.title);
        setEditedPrompt(task.initialPrompt || "");
        setIsEditingTitle(false);
        setIsEditingPrompt(false);
    }, [task.id, task.title, task.initialPrompt]);

    if (!isOpen) return null;

    const handleSaveTitle = () => {
        if (editedTitle.trim() && editedTitle !== task.title) {
            onUpdateTask?.(task.id, { title: editedTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    const handleSavePrompt = () => {
        if (editedPrompt !== (task.initialPrompt || "")) {
            onUpdateTask?.(task.id, { initialPrompt: editedPrompt });
        }
        setIsEditingPrompt(false);
    };

    const handleCancelTitleEdit = () => {
        setEditedTitle(task.title);
        setIsEditingTitle(false);
    };

    const handleCancelPromptEdit = () => {
        setEditedPrompt(task.initialPrompt || "");
        setIsEditingPrompt(false);
    };

    const handleAddSubtask = () => {
        if (newSubtaskTitle.trim()) {
            onAddSubtask(newSubtaskTitle);
            setNewSubtaskTitle("");
            setShowSubtaskInput(false);
        }
    };

    // Safely handle subtasks - API might not return this field
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.status === "completed").length;

    return (
        <div className="maestroModalOverlay" onClick={onClose}>
            <div className="terminalTaskModal" onClick={(e) => e.stopPropagation()}>
                {/* Header with title and status */}
                <div className="terminalModalHeader">
                    <div className="terminalModalHeaderContent">
                        {breadcrumb.length > 1 && (
                            <div className="terminalModalBreadcrumb">
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
                        {isEditingTitle ? (
                            <div className="terminalModalEditableTitle">
                                <input
                                    type="text"
                                    className="terminalModalTitleInput"
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveTitle();
                                        if (e.key === "Escape") handleCancelTitleEdit();
                                    }}
                                    autoFocus
                                />
                                <div className="terminalModalEditActions">
                                    <button className="terminalModalEditBtn" onClick={handleSaveTitle}>save</button>
                                    <button className="terminalModalEditBtn terminalModalEditBtnCancel" onClick={handleCancelTitleEdit}>cancel</button>
                                </div>
                            </div>
                        ) : (
                            <h2
                                className="terminalModalTitle terminalModalTitleEditable"
                                onClick={() => onUpdateTask && setIsEditingTitle(true)}
                                title={onUpdateTask ? "Click to edit" : undefined}
                            >
                                {task.title}
                            </h2>
                        )}
                        <div className="terminalModalMeta">
                            <span className={`terminalModalStatusBadge terminalModalStatusBadge--${task.status}`}>
                                {STATUS_LABELS[task.status]}
                            </span>
                            {task.sessionStatus && (
                                <span className={`terminalSessionStatus terminalSessionStatus--${task.sessionStatus}`}>
                                    {task.sessionStatus}
                                </span>
                            )}
                            <span className={`terminalModalPriorityBadge terminalModalPriorityBadge--${task.priority}`}>
                                {PRIORITY_LABELS[task.priority]}
                            </span>
                            <span className="terminalModalMetaItem">
                                {formatDate(task.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="terminalModalBody">
                    {/* Prompt Section */}
                    <div className="terminalModalSection">
                        <h3 className="terminalModalSectionTitle">
                            &gt; Task Prompt
                        </h3>
                        {isEditingPrompt ? (
                            <div className="terminalModalEditablePrompt">
                                <textarea
                                    className="terminalModalPromptTextarea"
                                    value={editedPrompt}
                                    onChange={(e) => setEditedPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") handleCancelPromptEdit();
                                    }}
                                    rows={5}
                                    autoFocus
                                />
                                <div className="terminalModalEditActions">
                                    <button className="terminalModalEditBtn" onClick={handleSavePrompt}>save</button>
                                    <button className="terminalModalEditBtn terminalModalEditBtnCancel" onClick={handleCancelPromptEdit}>cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`terminalModalPromptBox ${onUpdateTask ? 'terminalModalPromptBoxEditable' : ''}`}
                                onClick={() => onUpdateTask && setIsEditingPrompt(true)}
                                title={onUpdateTask ? "Click to edit" : undefined}
                            >
                                {task.initialPrompt || "No prompt provided"}
                            </div>
                        )}
                    </div>

                    {/* Subtasks Section */}
                    <div className="terminalModalSection">
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
                                                onToggleSubtask(subtask.id);
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
                                                onDeleteSubtask(subtask.id);
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

                    {/* Sessions Section */}
                    {sessions.length > 0 && (
                        <div className="terminalModalSection">
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

                    {/* Available Skills Section */}
                    <div className="terminalModalSection">
                        <div className="terminalModalSectionHeader">
                            <h3 className="terminalModalSectionTitle">
                                &gt; Available Skills
                                {!skillsLoading && (
                                    <span className="terminalModalSubtaskCount">
                                        ({availableSkills.length})
                                    </span>
                                )}
                            </h3>
                            {!skillsLoading && availableSkills.length > 10 && (
                                <button
                                    className="terminalModalAddBtn"
                                    onClick={() => setShowAllSkills(!showAllSkills)}
                                >
                                    {showAllSkills ? 'show less' : 'show all'}
                                </button>
                            )}
                        </div>

                        {skillsLoading ? (
                            <div className="terminalModalEmptyState">
                                <p>Loading skills...</p>
                            </div>
                        ) : availableSkills.length === 0 ? (
                            <div className="terminalModalEmptyState">
                                <p>No skills available</p>
                            </div>
                        ) : (
                            <div className="terminalModalSkillsList" style={{
                                maxHeight: showAllSkills ? 'none' : '300px',
                                overflowY: showAllSkills ? 'visible' : 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}>
                                {availableSkills
                                    .slice(0, showAllSkills ? undefined : 10)
                                    .map((skill) => {
                                        const isAssigned = task.skillIds && task.skillIds.includes(skill.id);
                                        return (
                                            <div
                                                key={skill.id}
                                                className="terminalModalSkillItem"
                                                style={{
                                                    padding: '8px 10px',
                                                    border: isAssigned ? '1px solid var(--green, #00ff00)' : '1px solid #333',
                                                    borderRadius: '2px',
                                                    backgroundColor: isAssigned ? 'rgba(0, 255, 0, 0.08)' : 'rgba(0, 255, 0, 0.03)',
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'baseline',
                                                    gap: '8px',
                                                    marginBottom: '4px',
                                                }}>
                                                    <span style={{
                                                        fontWeight: 'bold',
                                                        color: 'var(--green, #00ff00)',
                                                        fontSize: '13px',
                                                    }}>
                                                        {isAssigned && '[✓] '}{skill.name}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: 'var(--muted)',
                                                        padding: '2px 6px',
                                                        border: '1px solid #444',
                                                        borderRadius: '2px',
                                                    }}>
                                                        {skill.type}
                                                    </span>
                                                    {isAssigned && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            color: 'var(--green, #00ff00)',
                                                            padding: '2px 6px',
                                                            border: '1px solid var(--green, #00ff00)',
                                                            borderRadius: '2px',
                                                        }}>
                                                            assigned
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{
                                                    fontSize: '12px',
                                                    color: 'var(--muted)',
                                                    margin: 0,
                                                    lineHeight: '1.4',
                                                }}>
                                                    {skill.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                {!showAllSkills && availableSkills.length > 10 && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '8px',
                                        color: 'var(--muted)',
                                        fontSize: '12px',
                                    }}>
                                        ... and {availableSkills.length - 10} more
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats Section */}
                    {(task.sessionCount ?? 0) > 0 && (
                        <div className="terminalModalSection">
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

                <div className="terminalModalFooter">
                    <div className="terminalModalFooterLeft">
                        <span className="terminalModalFooterLabel">agent:</span>
                        <AgentSelector
                            selectedAgentId={selectedAgentId}
                            onSelectAgent={onAgentSelect}
                            compact={true}
                        />
                    </div>
                    <div className="terminalModalFooterRight">
                        <button
                            className="terminalModalBtn terminalModalBtnSecondary"
                            onClick={onClose}
                        >
                            close
                        </button>
                        <button
                            className="terminalModalBtn terminalModalBtnSuccess"
                            onClick={() => {
                                console.log('[TaskDetailModal] ========================================');
                                console.log('[TaskDetailModal] Work on Task button clicked');
                                console.log('[TaskDetailModal] Task ID:', task.id);
                                console.log('[TaskDetailModal] Task title:', task.title);
                                console.log('[TaskDetailModal] Calling onWorkOn()...');
                                console.log('[TaskDetailModal] ========================================');
                                onWorkOn();
                                console.log('[TaskDetailModal] onWorkOn() called, now closing modal...');
                                onClose();
                            }}
                        >
                            $ exec
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
