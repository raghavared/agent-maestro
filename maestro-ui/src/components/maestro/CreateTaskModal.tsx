import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { MentionsInput, Mention } from 'react-mentions';
import { TaskPriority, AgentSkill, MaestroProject, MaestroTask, ModelType, AgentTool, DocEntry } from "../../app/types/maestro";
import { maestroClient } from "../../utils/MaestroClient";
import { Icon } from "../Icon";
import { AgentSelector } from "./AgentSelector";
import { ClaudeCodeSkillsSelector } from "./ClaudeCodeSkillsSelector";
import { SessionInTaskView } from "./SessionInTaskView";
import { AggregatedTimeline } from "./SessionTimeline";
import { useTaskBreadcrumb } from "../../hooks/useTaskBreadcrumb";
import { useSubtaskProgress } from "../../hooks/useSubtaskProgress";
import { useTaskSessions } from "../../hooks/useTaskSessions";
import { useMaestroStore } from "../../stores/useMaestroStore";

// Models available per agent tool
const AGENT_MODELS: Record<string, { value: string; label: string }[]> = {
    "claude-code": [
        { value: "haiku", label: "Haiku" },
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
    ],
    "codex": [
        { value: "gpt-5.3-codex", label: "5.3-codex" },
        { value: "gpt-5.2-codex", label: "5.2-codex" },
    ],
};

// Default model per agent tool
const DEFAULT_MODEL: Record<string, string> = {
    "claude-code": "sonnet",
    "codex": "gpt-5.3-codex",
};

// Agent tool display labels
const AGENT_TOOL_LABELS: Record<string, string> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
};

const AGENT_TOOLS: AgentTool[] = ["claude-code", "codex"];

const STATUS_LABELS: Record<string, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
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
        referenceTaskIds?: string[];
        parentId?: string;
        model?: ModelType;
        agentTool?: AgentTool;
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
    const [agentTool, setAgentTool] = useState<AgentTool>("claude-code");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [prompt, setPrompt] = useState("");
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [files, setFiles] = useState<{ id: string, display: string }[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Team member fields (deprecated - team members are now separate entities)
    const isTeamMemberMode = false;
    const [tmRole, setTmRole] = useState("");
    const [tmAvatar, setTmAvatar] = useState("");

    // Reference tasks state
    const [selectedReferenceTasks, setSelectedReferenceTasks] = useState<MaestroTask[]>([]);
    const [showRefTaskPicker, setShowRefTaskPicker] = useState(false);
    const [refTaskCandidates, setRefTaskCandidates] = useState<(MaestroTask & { docCount: number })[]>([]);
    const [refTasksLoading, setRefTasksLoading] = useState(false);
    const [refTasksDisplayCount, setRefTasksDisplayCount] = useState(5);
    const refPickerBtnRef = useRef<HTMLButtonElement>(null);
    const [refPickerPos, setRefPickerPos] = useState<{ top: number; left: number } | null>(null);

    // Agent tool dropdown state
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const agentBtnRef = useRef<HTMLButtonElement>(null);
    const [agentDropdownPos, setAgentDropdownPos] = useState<{ top: number; left: number } | null>(null);

    const computeAgentDropdownPos = useCallback(() => {
        const btn = agentBtnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    }, []);

    useLayoutEffect(() => {
        if (showAgentDropdown) {
            setAgentDropdownPos(computeAgentDropdownPos());
        }
    }, [showAgentDropdown, computeAgentDropdownPos]);

    const computeRefPickerPos = useCallback(() => {
        const btn = refPickerBtnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    }, []);

    useLayoutEffect(() => {
        if (showRefTaskPicker) {
            setRefPickerPos(computeRefPickerPos());
        }
    }, [showRefTaskPicker, computeRefPickerPos]);

    // Fetch tasks with docs when picker opens
    useEffect(() => {
        if (!showRefTaskPicker || !project?.id) return;
        let cancelled = false;
        setRefTasksLoading(true);

        (async () => {
            try {
                const tasks = await maestroClient.getTasks(project.id);
                // Sort by updatedAt descending
                const sorted = tasks.sort((a, b) => b.updatedAt - a.updatedAt);
                // Check which tasks have docs
                const withDocs: (MaestroTask & { docCount: number })[] = [];
                for (const t of sorted) {
                    if (cancelled) return;
                    try {
                        const docs = await maestroClient.getTaskDocs(t.id);
                        if (docs.length > 0) {
                            withDocs.push({ ...t, docCount: docs.length });
                        }
                    } catch {
                        // skip tasks where docs fetch fails
                    }
                    // Stop after finding enough candidates to be useful
                    if (withDocs.length >= 20) break;
                }
                if (!cancelled) {
                    setRefTaskCandidates(withDocs);
                    setRefTasksLoading(false);
                }
            } catch {
                if (!cancelled) setRefTasksLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [showRefTaskPicker, project?.id]);

    // Task docs state
    const [taskDocs, setTaskDocs] = useState<DocEntry[]>([]);

    // Edit mode state
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);

    // Hooks for edit mode (always called, but only used in edit mode)
    const breadcrumb = useTaskBreadcrumb(isEditMode ? task!.id : null);
    const subtaskProgress = useSubtaskProgress(isEditMode ? task!.id : null);
    const { sessions, loading: loadingSessions } = useTaskSessions(isEditMode ? task!.id : null);
    const tasks = useMaestroStore(s => s.tasks);

    // Aggregated timeline data from all sessions
    const aggregatedTimelineData = useMemo(() => {
        const data = new Map<string, { sessionName: string; events: typeof sessions[0]['timeline'] }>();
        sessions.forEach(session => {
            data.set(session.id, {
                sessionName: session.name || session.id.slice(0, 8),
                events: session.timeline || []
            });
        });
        return data;
    }, [sessions]);

    const hasTimelineEvents = useMemo(() => {
        return sessions.some(session =>
            session.timeline?.some(event => event.taskId === (task?.id) || !event.taskId)
        );
    }, [sessions, task?.id]);

    // Pre-fill form when task changes in edit mode
    useEffect(() => {
        if (isEditMode && task) {
            setTitle(task.title);
            setPrompt(task.description || "");
            setPriority(task.priority);
            setAgentTool(task.agentTool || "claude-code");
            setModel(task.model || "sonnet");
            setSelectedSkills(task.skillIds || []);
            // Load reference tasks by ID
            if (task.referenceTaskIds && task.referenceTaskIds.length > 0) {
                (async () => {
                    const refTasks: MaestroTask[] = [];
                    for (const refId of task.referenceTaskIds!) {
                        try {
                            const t = await maestroClient.getTask(refId);
                            refTasks.push(t);
                        } catch { /* skip if task not found */ }
                    }
                    setSelectedReferenceTasks(refTasks);
                })();
            } else {
                setSelectedReferenceTasks([]);
            }
        }
    }, [isEditMode, isOpen, task?.id, task?.title, task?.description, task?.priority, task?.model, task?.agentTool, JSON.stringify(task?.referenceTaskIds)]);

    // Fetch task docs in edit mode
    useEffect(() => {
        if (isEditMode && task?.id) {
            maestroClient.getTaskDocs(task.id).then(setTaskDocs).catch(() => setTaskDocs([]));
        } else {
            setTaskDocs([]);
        }
    }, [isEditMode, task?.id]);

    // Reset form when switching to create mode
    useEffect(() => {
        if (mode === "create" && isOpen) {
            setTitle("");
            setPrompt("");
            setPriority("medium");
            setAgentTool("claude-code");
            setModel("sonnet" as ModelType);
            setSelectedSkills([]);
            setSelectedReferenceTasks([]);
            setActiveTab(null);
        }
    }, [mode, isOpen]);

    const hasUnsavedContent = mode === "create"
        ? (title.trim() !== "" || prompt.trim() !== "")
        : (isEditMode && task && (
            title !== task.title ||
            prompt !== (task.description || "") ||
            priority !== task.priority ||
            agentTool !== (task.agentTool || "claude-code") ||
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
        setAgentTool("claude-code");
        setModel("sonnet");
        setActiveTab(null);
        setSelectedSkills([]);
        setSelectedReferenceTasks([]);
        setTmRole("");
        setTmAvatar("");
        onClose();
    };

    const handleCancelDiscard = () => {
        setShowConfirmDialog(false);
    };

    const toggleTab = (tab: string) => {
        setActiveTab(prev => prev === tab ? null : tab);
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
        if (!title.trim()) return;
        // For team members, description can be the identity prompt
        if (!isTeamMemberMode && !prompt.trim()) return;

        const createPayload: Parameters<typeof onCreate>[0] = {
            title: title.trim(),
            description: prompt,
            priority: isTeamMemberMode ? 'medium' as TaskPriority : priority,
            startImmediately: isTeamMemberMode ? false : startImmediately,
            skillIds: selectedSkills.length > 0 ? selectedSkills : undefined,
            referenceTaskIds: selectedReferenceTasks.length > 0 ? selectedReferenceTasks.map(t => t.id) : undefined,
            parentId,
            model,
            agentTool,
        };

        if (isTeamMemberMode) {
            // Team members are now separate entities, not tasks
            // This code path is deprecated
            // createPayload.taskType = 'team-member';
            // createPayload.teamMemberMetadata = {
            //     role: tmRole.trim() || 'agent',
            //     identity: prompt,
            //     avatar: tmAvatar.trim() || '?',
            //     mailId: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            // };
        }

        onCreate(createPayload);

        // Reset form
        setTitle("");
        setPrompt("");
        setPriority("medium");
        setAgentTool("claude-code");
        setModel("sonnet");
        setActiveTab(null);
        setSelectedSkills([]);
        setSelectedReferenceTasks([]);
        setTmRole("");
        setTmAvatar("");
        onClose();
    };

    const handleSave = () => {
        if (!isEditMode || !task) return;
        const updates: Partial<MaestroTask> = {};
        if (title.trim() && title !== task.title) updates.title = title.trim();
        if (prompt !== (task.description || "")) updates.description = prompt;
        if (priority !== task.priority) updates.priority = priority;
        if (agentTool !== (task.agentTool || "claude-code")) updates.agentTool = agentTool;
        if (model !== (task.model || "sonnet")) updates.model = model;
        if (JSON.stringify(selectedSkills) !== JSON.stringify(task.skillIds || [])) updates.skillIds = selectedSkills;
        const newRefIds = selectedReferenceTasks.map(t => t.id);
        if (JSON.stringify(newRefIds) !== JSON.stringify(task.referenceTaskIds || [])) updates.referenceTaskIds = newRefIds;

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

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
                <div className="themedModalHeader">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        {isEditMode && task ? (
                            <span className="themedTaskStatusBadge" data-status={task.status} style={{ flexShrink: 0, padding: '6px 10px', fontSize: '12px', lineHeight: '1' }}>
                                {STATUS_LABELS[task.status] || task.status}
                            </span>
                        ) : (
                            <span className="themedModalTitle" style={{ flexShrink: 0 }}>
                                [ {isTeamMemberMode ? 'NEW TEAM MEMBER' : parentId ? 'NEW SUBTASK' : 'NEW TASK'} ]
                            </span>
                        )}
                        <input
                            ref={titleInputRef}
                            type="text"
                            className="themedFormInput"
                            style={{ flex: 1, margin: 0, padding: '6px 8px', fontSize: '13px', fontWeight: 600 }}
                            placeholder={isTeamMemberMode ? "e.g., Senior Frontend Dev" : isEditMode ? "Task title..." : "e.g., Build user authentication system"}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button className="themedModalClose" onClick={handleClose}>×</button>
                </div>

                <div className="themedModalContent">
                    {/* Breadcrumb for edit mode */}
                    {isEditMode && breadcrumb.length > 1 && (
                        <div className="themedFormHint" style={{ marginBottom: '4px' }}>
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
                        <div className="themedFormHint" style={{ marginBottom: '4px' }}>
                            Subtask of: {parentTitle}
                        </div>
                    )}

                    {/* Team member fields */}
                    {isTeamMemberMode && !isEditMode && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ flex: 1 }}>
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Role</div>
                                <input
                                    type="text"
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '4px 8px', fontSize: '12px' }}
                                    placeholder="e.g., frontend developer, tester"
                                    value={tmRole}
                                    onChange={(e) => setTmRole(e.target.value)}
                                />
                            </div>
                            <div style={{ width: '80px' }}>
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Avatar</div>
                                <input
                                    type="text"
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '4px 8px', fontSize: '16px', textAlign: 'center' }}
                                    placeholder="?"
                                    value={tmAvatar}
                                    onChange={(e) => setTmAvatar(e.target.value)}
                                    maxLength={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Prompt/Description Textarea */}
                    <div className="themedFormRow" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="themedFormLabel" style={{ marginBottom: 0 }}>{isTeamMemberMode ? 'Identity Prompt' : 'Description'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {/* Reference task chips */}
                                {selectedReferenceTasks.map(rt => (
                                    <span
                                        key={rt.id}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '2px 8px',
                                            fontSize: '10px',
                                            border: '1px solid var(--theme-border)',
                                            borderRadius: '3px',
                                            backgroundColor: 'rgba(var(--theme-primary-rgb), 0.05)',
                                            color: 'var(--theme-primary)',
                                        }}
                                    >
                                        <span style={{ opacity: 0.5 }}>ref:</span>
                                        {rt.title.length > 30 ? rt.title.slice(0, 30) + '...' : rt.title}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedReferenceTasks(prev => prev.filter(t => t.id !== rt.id))}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--theme-primary)',
                                                cursor: 'pointer',
                                                padding: '0 2px',
                                                fontSize: '12px',
                                                opacity: 0.6,
                                            }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <button
                                    ref={refPickerBtnRef}
                                    type="button"
                                    className="themedBtn"
                                    style={{ padding: '1px 6px', fontSize: '10px' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRefTaskPicker(!showRefTaskPicker);
                                        setRefTasksDisplayCount(5);
                                    }}
                                    title="Add reference tasks for context"
                                >
                                    + ref tasks
                                </button>
                            </div>
                        </div>

                        {/* Reference task picker dropdown */}
                        {showRefTaskPicker && refPickerPos && createPortal(
                            <>
                                <div
                                    className="themedDropdownOverlay"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRefTaskPicker(false);
                                    }}
                                />
                                <div
                                    className="themedDropdownMenu"
                                    style={{
                                        top: refPickerPos.top,
                                        left: refPickerPos.left,
                                        maxHeight: '240px',
                                        overflowY: 'auto',
                                        minWidth: '320px',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{ padding: '4px 8px', fontSize: '10px', opacity: 0.5, borderBottom: '1px solid var(--theme-border)' }}>
                                        Reference tasks (select for context)
                                    </div>
                                    {refTasksLoading ? (
                                        <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                            Loading tasks...
                                        </div>
                                    ) : refTaskCandidates.length === 0 ? (
                                        <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                            No tasks with docs found
                                        </div>
                                    ) : (
                                        <>
                                            {refTaskCandidates.slice(0, refTasksDisplayCount).map(candidate => {
                                                const isSelected = selectedReferenceTasks.some(t => t.id === candidate.id);
                                                return (
                                                    <button
                                                        key={candidate.id}
                                                        className={`themedDropdownOption ${isSelected ? 'themedDropdownOption--current' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isSelected) {
                                                                setSelectedReferenceTasks(prev => prev.filter(t => t.id !== candidate.id));
                                                            } else {
                                                                setSelectedReferenceTasks(prev => [...prev, candidate]);
                                                            }
                                                        }}
                                                        style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}
                                                    >
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span className="themedDropdownLabel" style={{ flex: 1 }}>
                                                                {candidate.title.length > 45 ? candidate.title.slice(0, 45) + '...' : candidate.title}
                                                            </span>
                                                            <span style={{ fontSize: '9px', opacity: 0.5, flexShrink: 0 }}>
                                                                {candidate.docCount} doc{candidate.docCount !== 1 ? 's' : ''}
                                                            </span>
                                                            {isSelected && (
                                                                <span className="themedDropdownCheck">{'\u2713'}</span>
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {refTaskCandidates.length > refTasksDisplayCount && (
                                                <button
                                                    className="themedDropdownOption"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRefTasksDisplayCount(prev => prev + 5);
                                                    }}
                                                    style={{ textAlign: 'center', opacity: 0.6, fontSize: '10px' }}
                                                >
                                                    Load more ({refTaskCandidates.length - refTasksDisplayCount} remaining)
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>,
                            document.body
                        )}

                        <div className="mentionsWrapper" style={{ flex: 1, minHeight: 0 }}>
                            <MentionsInput
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                style={mentionsStyle}
                                placeholder={isTeamMemberMode ? "Describe this team member's persona, expertise, and how they should approach tasks..." : "Describe the requirements... Use @ to tag files"}
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
                    </div>

                </div>

                {/* Tab Content - between content and footer */}
                {activeTab && (
                    <div className="themedModalTabContent" style={{ maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid var(--theme-border)' }}>
                        {/* Subtasks Tab */}
                        {activeTab === 'subtasks' && isEditMode && (
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
                                        onClick={() => setShowSubtaskInput(!showSubtaskInput)}
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
                        )}

                        {/* Skills Tab */}
                        {activeTab === 'skills' && (
                            <ClaudeCodeSkillsSelector
                                selectedSkills={selectedSkills}
                                onSelectionChange={setSelectedSkills}
                            />
                        )}

                        {/* Sessions Tab */}
                        {activeTab === 'sessions' && isEditMode && (
                            <div className="terminalTabPane terminalTabPane--sessions">
                                {loadingSessions ? (
                                    <div className="terminalLoading">Loading sessions...</div>
                                ) : sessions.length === 0 ? (
                                    <div className="themedFormHint">No sessions working on this task</div>
                                ) : (
                                    <div className="terminalSessionsList">
                                        {sessions.map(session => (
                                            <SessionInTaskView
                                                key={session.id}
                                                session={session}
                                                taskId={task!.id}
                                                tasks={tasks}
                                                onJumpToSession={onJumpToSession}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Referenced Docs Tab */}
                        {activeTab === 'ref-docs' && (
                            <div>
                                {selectedReferenceTasks.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {selectedReferenceTasks.map(rt => (
                                            <div
                                                key={rt.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '4px 0',
                                                    borderBottom: '1px solid var(--theme-border)',
                                                    fontSize: '11px',
                                                }}
                                            >
                                                <span style={{ opacity: 0.5, flexShrink: 0 }}>ref</span>
                                                <span style={{ flex: 1, color: 'var(--theme-primary)' }}>
                                                    {rt.title}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="themedBtn themedBtnDanger"
                                                    style={{ padding: '0 4px', fontSize: '12px' }}
                                                    onClick={() => setSelectedReferenceTasks(prev => prev.filter(t => t.id !== rt.id))}
                                                    title="Remove reference"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="themedFormHint">No reference tasks. Use "+ ref tasks" above to add.</div>
                                )}
                            </div>
                        )}

                        {/* Generated Docs Tab */}
                        {activeTab === 'gen-docs' && isEditMode && (
                            <div>
                                {taskDocs.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {taskDocs.map(doc => (
                                            <div
                                                key={doc.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '4px 0',
                                                    borderBottom: '1px solid var(--theme-border)',
                                                    fontSize: '11px',
                                                }}
                                            >
                                                <span style={{ opacity: 0.5, flexShrink: 0 }}>doc</span>
                                                <span style={{ flex: 1, color: 'var(--theme-primary)' }}>
                                                    {doc.title}
                                                </span>
                                                <span className="themedFormHint" style={{ flexShrink: 0, fontSize: '10px' }}>
                                                    {doc.filePath}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="themedFormHint">No generated docs yet</div>
                                )}
                            </div>
                        )}

                        {/* Timeline Tab */}
                        {activeTab === 'timeline' && isEditMode && task && (
                            <div className="terminalTabPane terminalTabPane--timeline">
                                {sessions.length === 0 ? (
                                    <div className="themedFormHint">No sessions to show timeline for</div>
                                ) : !hasTimelineEvents ? (
                                    <div className="themedFormHint">No timeline events recorded yet</div>
                                ) : (
                                    <AggregatedTimeline
                                        sessionEvents={aggregatedTimelineData}
                                        taskId={task.id}
                                        compact
                                        maxEvents={15}
                                    />
                                )}
                            </div>
                        )}

                        {/* Details Tab */}
                        {activeTab === 'details' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        )}
                    </div>
                )}

                {/* Tab Bar - attached to footer */}
                <div className="themedModalTabBar" style={{ borderTop: '1px solid var(--theme-border)', marginTop: 'auto' }}>
                    {isEditMode && (
                        <button
                            type="button"
                            className={`themedModalTab ${activeTab === 'subtasks' ? 'themedModalTab--active' : ''}`}
                            onClick={() => toggleTab('subtasks')}
                        >
                            Subtasks
                            {subtaskProgress.total > 0 && (
                                <span className="themedModalTabBadge">
                                    {subtaskProgress.completed}/{subtaskProgress.total}
                                </span>
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`themedModalTab ${activeTab === 'skills' ? 'themedModalTab--active' : ''}`}
                        onClick={() => toggleTab('skills')}
                    >
                        Skills
                        {selectedSkills.length > 0 && (
                            <span className="themedModalTabBadge">{selectedSkills.length}</span>
                        )}
                    </button>
                    {isEditMode && sessions.length > 0 && (
                        <button
                            type="button"
                            className={`themedModalTab ${activeTab === 'sessions' ? 'themedModalTab--active' : ''}`}
                            onClick={() => toggleTab('sessions')}
                        >
                            Sessions
                            <span className="themedModalTabBadge">{sessions.length}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className={`themedModalTab ${activeTab === 'ref-docs' ? 'themedModalTab--active' : ''}`}
                        onClick={() => toggleTab('ref-docs')}
                    >
                        Ref Tasks
                        {selectedReferenceTasks.length > 0 && (
                            <span className="themedModalTabBadge">{selectedReferenceTasks.length}</span>
                        )}
                    </button>
                    {isEditMode && (
                        <button
                            type="button"
                            className={`themedModalTab ${activeTab === 'gen-docs' ? 'themedModalTab--active' : ''}`}
                            onClick={() => toggleTab('gen-docs')}
                        >
                            Gen Docs
                            {taskDocs.length > 0 && (
                                <span className="themedModalTabBadge">{taskDocs.length}</span>
                            )}
                        </button>
                    )}
                    {isEditMode && (
                        <button
                            type="button"
                            className={`themedModalTab ${activeTab === 'timeline' ? 'themedModalTab--active' : ''}`}
                            onClick={() => toggleTab('timeline')}
                        >
                            Timeline
                        </button>
                    )}
                    <button
                        type="button"
                        className={`themedModalTab ${activeTab === 'details' ? 'themedModalTab--active' : ''}`}
                        onClick={() => toggleTab('details')}
                    >
                        Details
                    </button>
                    {activeTab && (
                        <button
                            type="button"
                            className="themedModalTab themedModalTabClose"
                            onClick={() => setActiveTab(null)}
                            title="Collapse tab panel"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="themedFormActions" style={{ flexWrap: 'wrap' }}>
                    {isEditMode ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                                <div className="themedDropdownPicker" style={{ position: 'relative' }}>
                                    <button
                                        ref={agentBtnRef}
                                        type="button"
                                        className={`themedDropdownButton ${showAgentDropdown ? 'themedDropdownButton--open' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAgentDropdown(!showAgentDropdown);
                                        }}
                                    >
                                        {AGENT_TOOL_LABELS[agentTool]}
                                        <span className="themedDropdownCaret">{showAgentDropdown ? '\u25B4' : '\u25BE'}</span>
                                    </button>
                                    {showAgentDropdown && agentDropdownPos && createPortal(
                                        <>
                                            <div
                                                className="themedDropdownOverlay"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAgentDropdown(false);
                                                }}
                                            />
                                            <div
                                                className="themedDropdownMenu"
                                                style={{ top: agentDropdownPos.top, left: agentDropdownPos.left }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {AGENT_TOOLS.map(tool => (
                                                    <button
                                                        key={tool}
                                                        className={`themedDropdownOption ${tool === agentTool ? 'themedDropdownOption--current' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAgentTool(tool);
                                                            setModel(DEFAULT_MODEL[tool] as ModelType);
                                                            setShowAgentDropdown(false);
                                                        }}
                                                    >
                                                        <span className="themedDropdownLabel">{AGENT_TOOL_LABELS[tool]}</span>
                                                        {tool === agentTool && (
                                                            <span className="themedDropdownCheck">{'\u2713'}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </div>
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    {(AGENT_MODELS[agentTool] || []).map(m => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            className={`themedSegmentedBtn ${model === m.value ? "active" : ""}`}
                                            onClick={() => setModel(m.value as ModelType)}
                                            style={{ padding: '2px 8px', fontSize: '10px' }}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                                <div className="themedDropdownPicker" style={{ position: 'relative' }}>
                                    <button
                                        ref={agentBtnRef}
                                        type="button"
                                        className={`themedDropdownButton ${showAgentDropdown ? 'themedDropdownButton--open' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAgentDropdown(!showAgentDropdown);
                                        }}
                                    >
                                        {AGENT_TOOL_LABELS[agentTool]}
                                        <span className="themedDropdownCaret">{showAgentDropdown ? '\u25B4' : '\u25BE'}</span>
                                    </button>
                                    {showAgentDropdown && agentDropdownPos && createPortal(
                                        <>
                                            <div
                                                className="themedDropdownOverlay"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAgentDropdown(false);
                                                }}
                                            />
                                            <div
                                                className="themedDropdownMenu"
                                                style={{ top: agentDropdownPos.top, left: agentDropdownPos.left }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {AGENT_TOOLS.map(tool => (
                                                    <button
                                                        key={tool}
                                                        className={`themedDropdownOption ${tool === agentTool ? 'themedDropdownOption--current' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAgentTool(tool);
                                                            setModel(DEFAULT_MODEL[tool] as ModelType);
                                                            setShowAgentDropdown(false);
                                                        }}
                                                    >
                                                        <span className="themedDropdownLabel">{AGENT_TOOL_LABELS[tool]}</span>
                                                        {tool === agentTool && (
                                                            <span className="themedDropdownCheck">{'\u2713'}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>,
                                        document.body
                                    )}
                                </div>
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    {(AGENT_MODELS[agentTool] || []).map(m => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            className={`themedSegmentedBtn ${model === m.value ? "active" : ""}`}
                                            onClick={() => setModel(m.value as ModelType)}
                                            style={{ padding: '2px 8px', fontSize: '10px' }}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button type="button" className="themedBtn" onClick={handleClose}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="themedBtn themedBtnPrimary"
                                onClick={() => handleSubmit(false)}
                                disabled={isTeamMemberMode ? !title.trim() : (!title.trim() || !prompt.trim())}
                            >
                                {isTeamMemberMode ? 'Create Team Member' : 'Create Task'}
                            </button>
                            {!isTeamMemberMode && (
                                <button
                                    type="button"
                                    className="themedBtn themedBtnSuccess"
                                    onClick={() => handleSubmit(true)}
                                    disabled={!title.trim() || !prompt.trim()}
                                >
                                    Create &amp; Run
                                </button>
                            )}
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
