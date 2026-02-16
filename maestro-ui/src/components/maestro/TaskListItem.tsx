import React, { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { MaestroTask, TaskStatus, TaskPriority, MaestroSessionStatus, DocEntry, AgentTool, ModelType } from "../../app/types/maestro";
import { useTaskSessions } from "../../hooks/useTaskSessions";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { maestroClient } from "../../utils/MaestroClient";
import { SessionInTaskView } from "./SessionInTaskView";
import { AggregatedTimeline } from "./SessionTimeline";
import { DocViewer } from "./DocViewer";
import { StrategyBadge } from "./StrategyBadge";
import { SessionDetailModal } from "./SessionDetailModal";
import { ConfirmActionModal } from "../modals/ConfirmActionModal";

type TaskListItemProps = {
    task: MaestroTask;
    onSelect: () => void;
    onWorkOn: () => void;
    onJumpToSession: (maestroSessionId: string) => void;
    onNavigateToTask?: (taskId: string) => void;
    depth?: number;
    hasChildren?: boolean;
    isChildrenCollapsed?: boolean;
    isAddingSubtask?: boolean;
    onToggleChildrenCollapse?: () => void;
    onTogglePin?: () => void;
    selectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    showPermanentDelete?: boolean;
};

// Terminal-style status symbols
const STATUS_SYMBOLS: Record<TaskStatus, string> = {
    todo: "○",
    in_progress: "◉",
    in_review: "◎",
    completed: "✓",
    cancelled: "⊘",
    blocked: "✗",
    archived: "▫",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    completed: "Completed",
    cancelled: "Cancelled",
    blocked: "Blocked",
    archived: "Archived",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: "LOW",
    medium: "MED",
    high: "HIGH",
};

// Session status labels and symbols
const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
    spawning: "Spawning",
    idle: "Idle",
    working: "Working",
    completed: "Done",
    failed: "Failed",
    stopped: "Stopped",
};

// Agent tool / model constants
const AGENT_TOOLS: AgentTool[] = ["claude-code", "codex", "gemini"];

const AGENT_TOOL_LABELS: Record<AgentTool, string> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
    "gemini": "Google Gemini",
};

const AGENT_TOOL_SYMBOLS: Record<AgentTool, string> = {
    "claude-code": "◈",
    "codex": "◇",
    "gemini": "△",
};

const AGENT_MODELS: Record<AgentTool, { value: string; label: string }[]> = {
    "claude-code": [
        { value: "haiku", label: "Haiku" },
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
    ],
    "codex": [
        { value: "gpt-5.3-codex", label: "5.3-codex" },
        { value: "gpt-5.2-codex", label: "5.2-codex" },
    ],
    "gemini": [
        { value: "gemini-3-pro-preview", label: "3-pro" },
        { value: "gemini-3-flash-preview", label: "3-flash" },
    ],
};

const DEFAULT_MODEL: Record<AgentTool, string> = {
    "claude-code": "sonnet",
    "codex": "gpt-5.3-codex",
    "gemini": "gemini-3-pro-preview",
};

// Get short display label for a model value
function getModelDisplayLabel(model?: ModelType, agentTool?: AgentTool): string {
    if (!model || !agentTool) return "";
    const models = AGENT_MODELS[agentTool];
    const found = models?.find(m => m.value === model);
    return found?.label || model;
}

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type TaskTab = 'context' | 'sessions' | 'timeline' | 'details';

export function TaskListItem({
    task,
    onSelect,
    onWorkOn,
    onJumpToSession,
    onNavigateToTask,
    depth = 0,
    hasChildren = false,
    isChildrenCollapsed = false,
    isAddingSubtask = false,
    onToggleChildrenCollapse,
    onTogglePin,
    selectionMode = false,
    isSelected = false,
    onToggleSelect,
    showPermanentDelete = false,
}: TaskListItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sessionModalId, setSessionModalId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TaskTab>('context');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
    const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const [agentDropdownStep, setAgentDropdownStep] = useState<'tool' | 'model'>('tool');
    const [selectedAgentTool, setSelectedAgentTool] = useState<AgentTool | null>(null);
    const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const priorityDropdownRef = useRef<HTMLDivElement>(null);
    const agentDropdownRef = useRef<HTMLDivElement>(null);
    const statusBtnRef = useRef<HTMLButtonElement>(null);
    const priorityBtnRef = useRef<HTMLButtonElement>(null);
    const agentBtnRef = useRef<HTMLButtonElement>(null);
    const [statusDropdownPos, setStatusDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const [priorityDropdownPos, setPriorityDropdownPos] = useState<{ top: number; left: number } | null>(null);
    const [agentDropdownPos, setAgentDropdownPos] = useState<{ top: number; left: number } | null>(null);

    const computeDropdownPos = useCallback((btnRef: React.RefObject<HTMLButtonElement | null>) => {
        const btn = btnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    }, []);

    useLayoutEffect(() => {
        if (showStatusDropdown) {
            setStatusDropdownPos(computeDropdownPos(statusBtnRef));
        }
    }, [showStatusDropdown, computeDropdownPos]);

    useLayoutEffect(() => {
        if (showPriorityDropdown) {
            setPriorityDropdownPos(computeDropdownPos(priorityBtnRef));
        }
    }, [showPriorityDropdown, computeDropdownPos]);

    useLayoutEffect(() => {
        if (showAgentDropdown) {
            setAgentDropdownPos(computeDropdownPos(agentBtnRef));
        }
    }, [showAgentDropdown, computeDropdownPos]);

    const [taskDocs, setTaskDocs] = useState<DocEntry[]>([]);
    const [viewingDoc, setViewingDoc] = useState<DocEntry | null>(null);

    useEffect(() => {
        if (isExpanded && (activeTab === 'context' || activeTab === 'details')) {
            maestroClient.getTaskDocs(task.id).then(setTaskDocs).catch(() => {});
        }
    }, [isExpanded, activeTab, task.id]);

    const { sessions: taskSessions, loading: loadingSessions } = useTaskSessions(task.id);
    const tasks = useMaestroStore(s => s.tasks);
    const removeTaskFromSession = useMaestroStore(s => s.removeTaskFromSession);
    const deleteTask = useMaestroStore(s => s.deleteTask);
    const updateTask = useMaestroStore(s => s.updateTask);

    const isSubtask = task.parentId !== null;

    // For subtasks, also fetch parent task sessions
    const parentTask = isSubtask && task.parentId ? tasks.get(task.parentId) : null;
    const { sessions: parentSessions, loading: loadingParentSessions } = useTaskSessions(parentTask?.id);

    // Combine task's own sessions with parent sessions (for subtasks)
    const allSessions = useMemo(() => {
        const sessionMap = new Map<string, typeof taskSessions[0]>();

        // Add task's own sessions
        taskSessions.forEach(session => sessionMap.set(session.id, session));

        // For subtasks, also add parent sessions
        if (isSubtask && parentSessions) {
            parentSessions.forEach(session => {
                if (!sessionMap.has(session.id)) {
                    sessionMap.set(session.id, session);
                }
            });
        }

        return Array.from(sessionMap.values());
    }, [taskSessions, parentSessions, isSubtask]);

    const sessionCount = allSessions.length;
    const hasSessions = sessionCount > 0;

    // Calculate subtask count (direct children)
    const subtaskCount = Array.from(tasks.values()).filter(t => t.parentId === task.id).length;

    // Calculate total descendant count (recursive) for delete confirmation
    const totalDescendantCount = useMemo(() => {
        const countDescendants = (parentId: string): number => {
            const children = Array.from(tasks.values()).filter(t => t.parentId === parentId);
            return children.reduce((sum, child) => sum + 1 + countDescendants(child.id), 0);
        };
        return countDescendants(task.id);
    }, [tasks, task.id]);

    // Prepare aggregated timeline data from all sessions
    const aggregatedTimelineData = useMemo(() => {
        const data = new Map<string, { sessionName: string; events: typeof allSessions[0]['timeline'] }>();
        allSessions.forEach(session => {
            data.set(session.id, {
                sessionName: session.name || session.id.slice(0, 8),
                events: session.timeline || []
            });
        });
        return data;
    }, [allSessions]);

    // Check if any session has timeline events for this task
    const hasTimelineEvents = useMemo(() => {
        return allSessions.some(session =>
            session.timeline?.some(event => event.taskId === task.id || !event.taskId)
        );
    }, [allSessions, task.id]);

    const handleRemoveSession = async (sessionId: string) => {
        try {
            await removeTaskFromSession(sessionId, task.id);
        } catch (error) {
            console.error("Failed to remove task from session:", error);
        }
    };

    const handleArchiveTask = async () => {
        setIsDeleting(true);
        try {
            await updateTask(task.id, { status: 'archived' });
        } catch (error) {
            console.error("Failed to archive task:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteTask = async () => {
        setShowDeleteConfirm(true);
    };

    const confirmDeleteTask = async () => {
        setIsDeleting(true);
        try {
            await deleteTask(task.id);
            setShowDeleteConfirm(false);
        } catch (error) {
            console.error("Failed to delete task:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleInlineStatusChange = async (newStatus: TaskStatus) => {
        if (newStatus === task.status) {
            setShowStatusDropdown(false);
            return;
        }

        setIsUpdatingStatus(true);
        try {
            await updateTask(task.id, {
                status: newStatus,
                ...(newStatus === 'completed' && { completedAt: Date.now() }),
                ...(newStatus === 'in_progress' && !task.startedAt && { startedAt: Date.now() }),
            });
            setShowStatusDropdown(false);
        } catch (error) {
            console.error("Failed to update task status:", error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const statusOptions: TaskStatus[] = ["todo", "in_progress", "in_review", "completed", "cancelled", "blocked", "archived"];
    const priorityOptions: TaskPriority[] = ["high", "medium", "low"];

    const handleInlinePriorityChange = async (newPriority: TaskPriority) => {
        if (newPriority === task.priority) {
            setShowPriorityDropdown(false);
            return;
        }

        setIsUpdatingPriority(true);
        try {
            await updateTask(task.id, { priority: newPriority });
            setShowPriorityDropdown(false);
        } catch (error) {
            console.error("Failed to update task priority:", error);
        } finally {
            setIsUpdatingPriority(false);
        }
    };

    const handleOpenAgentDropdown = () => {
        if (!isUpdatingAgent) {
            // If task already has an agentTool, go directly to model step
            if (task.agentTool) {
                setSelectedAgentTool(task.agentTool);
                setAgentDropdownStep('model');
            } else {
                setSelectedAgentTool(null);
                setAgentDropdownStep('tool');
            }
            setShowAgentDropdown(!showAgentDropdown);
        }
    };

    const handleSelectAgentTool = (tool: AgentTool) => {
        setSelectedAgentTool(tool);
        setAgentDropdownStep('model');
    };

    const handleSelectModel = async (model: ModelType) => {
        if (!selectedAgentTool) return;

        setIsUpdatingAgent(true);
        try {
            await updateTask(task.id, {
                agentTool: selectedAgentTool,
                model: model,
            });
            setShowAgentDropdown(false);
        } catch (error) {
            console.error("Failed to update task agent/model:", error);
        } finally {
            setIsUpdatingAgent(false);
        }
    };

    const handleAgentDropdownBack = () => {
        setAgentDropdownStep('tool');
        setSelectedAgentTool(null);
    };

    const handleSubtaskAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Always toggle the subtask section - whether to show AddSubtaskInput or existing children
        onToggleChildrenCollapse?.();
    };

    const handleDragStart = useCallback((e: React.DragEvent) => {
        const content = task.initialPrompt || task.description || '';
        const text = `[Task: ${task.title}] ${content}`;
        e.dataTransfer.setData('application/maestro-task', JSON.stringify({
            title: task.title,
            description: task.description,
            initialPrompt: task.initialPrompt,
        }));
        e.dataTransfer.setData('text/plain', text);
        e.dataTransfer.effectAllowed = 'copy';
    }, [task.title, task.description, task.initialPrompt]);

    return (
        <div
            className={`terminalTaskRow terminalTaskRow--${task.status} ${isSubtask ? 'terminalTaskRow--subtask' : ''} ${showStatusDropdown || showPriorityDropdown || showAgentDropdown ? 'terminalTaskRow--dropdownOpen' : ''} ${selectionMode ? 'terminalTaskRow--selectable' : ''}`}
            draggable
            onDragStart={handleDragStart}
        >
            <div className="terminalTaskMain" onClick={() => setIsExpanded(!isExpanded)}>
                {/* Selection checkbox for execution mode */}
                {selectionMode && (
                    <label className="terminalTaskCheckbox" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect?.()}
                        />
                        <span className={`terminalTaskCheckmark ${isSelected ? 'terminalTaskCheckmark--checked' : ''}`}>
                            {isSelected ? '✓' : ''}
                        </span>
                    </label>
                )}
                {/* Primary content area - starts from leftmost */}
                <div className="terminalTaskPrimaryContent">
                    <div className="terminalTaskTitleRow">
                        <span className="terminalTaskTitle">{task.title}</span>
                    </div>

                    <div className="terminalTaskMeta">
                        {/* Task Status Badge - Clickable */}
                        <div className="terminalInlineStatusPicker" ref={statusDropdownRef}>
                            <button
                                ref={statusBtnRef}
                                className={`terminalMetaBadge terminalMetaBadge--status terminalMetaBadge--status-${task.status} terminalMetaBadge--clickable ${showStatusDropdown ? 'terminalMetaBadge--open' : ''} ${isUpdatingStatus ? 'terminalMetaBadge--updating' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isUpdatingStatus) {
                                        setShowStatusDropdown(!showStatusDropdown);
                                    }
                                }}
                                disabled={isUpdatingStatus}
                                title="Click to change status"
                            >
                                {isUpdatingStatus ? (
                                    <span className="terminalStatusSpinner">⟳</span>
                                ) : (
                                    <>
                                        {STATUS_SYMBOLS[task.status]} {STATUS_LABELS[task.status]}
                                        <span className="terminalMetaBadgeCaret">{showStatusDropdown ? '▴' : '▾'}</span>
                                    </>
                                )}
                            </button>

                            {showStatusDropdown && !isUpdatingStatus && statusDropdownPos && createPortal(
                                <>
                                    <div
                                        className="terminalInlineStatusOverlay"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowStatusDropdown(false);
                                        }}
                                    />
                                    <div
                                        className="terminalInlineStatusDropdown terminalInlineStatusDropdown--fixed"
                                        style={{ top: statusDropdownPos.top, left: statusDropdownPos.left }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {statusOptions.map((status) => (
                                            <button
                                                key={status}
                                                className={`terminalInlineStatusOption terminalInlineStatusOption--${status} ${status === task.status ? 'terminalInlineStatusOption--current' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleInlineStatusChange(status);
                                                }}
                                            >
                                                <span className="terminalStatusSymbol">{STATUS_SYMBOLS[status]}</span>
                                                <span className="terminalStatusLabel">{STATUS_LABELS[status]}</span>
                                                {status === task.status && (
                                                    <span className="terminalStatusCheck">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Priority Badge - Clickable */}
                        <div className="terminalInlinePriorityPicker" ref={priorityDropdownRef}>
                            <button
                                ref={priorityBtnRef}
                                className={`terminalMetaBadge terminalMetaBadge--priority terminalMetaBadge--priority-${task.priority} terminalMetaBadge--clickable ${showPriorityDropdown ? 'terminalMetaBadge--open' : ''} ${isUpdatingPriority ? 'terminalMetaBadge--updating' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isUpdatingPriority) {
                                        setShowPriorityDropdown(!showPriorityDropdown);
                                    }
                                }}
                                disabled={isUpdatingPriority}
                                title="Click to change priority"
                            >
                                {isUpdatingPriority ? (
                                    <span className="terminalStatusSpinner">⟳</span>
                                ) : (
                                    <>
                                        {PRIORITY_LABELS[task.priority]}
                                        <span className="terminalMetaBadgeCaret">{showPriorityDropdown ? '▴' : '▾'}</span>
                                    </>
                                )}
                            </button>

                            {showPriorityDropdown && !isUpdatingPriority && priorityDropdownPos && createPortal(
                                <>
                                    <div
                                        className="terminalInlineStatusOverlay"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPriorityDropdown(false);
                                        }}
                                    />
                                    <div
                                        className="terminalInlinePriorityDropdown terminalInlinePriorityDropdown--fixed"
                                        style={{ top: priorityDropdownPos.top, left: priorityDropdownPos.left }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {priorityOptions.map((priority) => (
                                            <button
                                                key={priority}
                                                className={`terminalInlinePriorityOption terminalInlinePriorityOption--${priority} ${priority === task.priority ? 'terminalInlinePriorityOption--current' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleInlinePriorityChange(priority);
                                                }}
                                            >
                                                <span className="terminalPriorityLabel">{PRIORITY_LABELS[priority]}</span>
                                                {priority === task.priority && (
                                                    <span className="terminalStatusCheck">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Agent Tool / Model Badge - Clickable */}
                        <div className="terminalInlineAgentPicker" ref={agentDropdownRef}>
                            <button
                                ref={agentBtnRef}
                                className={`terminalMetaBadge terminalMetaBadge--agent ${task.agentTool ? `terminalMetaBadge--agent-${task.agentTool}` : ''} ${task.model ? `terminalMetaBadge--model-${task.model}` : ''} terminalMetaBadge--clickable ${showAgentDropdown ? 'terminalMetaBadge--open' : ''} ${isUpdatingAgent ? 'terminalMetaBadge--updating' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAgentDropdown();
                                }}
                                disabled={isUpdatingAgent}
                                title={task.agentTool ? `${AGENT_TOOL_LABELS[task.agentTool]}${task.model ? ` / ${getModelDisplayLabel(task.model, task.agentTool)}` : ''}` : 'Set agent tool & model'}
                            >
                                {isUpdatingAgent ? (
                                    <span className="terminalStatusSpinner">⟳</span>
                                ) : (
                                    <>
                                        {task.agentTool ? (
                                            <>
                                                {AGENT_TOOL_SYMBOLS[task.agentTool]}{' '}
                                                {task.model ? getModelDisplayLabel(task.model, task.agentTool) : AGENT_TOOL_LABELS[task.agentTool]}
                                            </>
                                        ) : (
                                            <>⬡ Agent</>
                                        )}
                                        <span className="terminalMetaBadgeCaret">{showAgentDropdown ? '▴' : '▾'}</span>
                                    </>
                                )}
                            </button>

                            {showAgentDropdown && !isUpdatingAgent && agentDropdownPos && createPortal(
                                <>
                                    <div
                                        className="terminalInlineStatusOverlay"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAgentDropdown(false);
                                        }}
                                    />
                                    <div
                                        className="terminalInlineAgentDropdown terminalInlineAgentDropdown--fixed"
                                        style={{ top: agentDropdownPos.top, left: agentDropdownPos.left }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {agentDropdownStep === 'tool' ? (
                                            <>
                                                <div className="terminalAgentDropdownHeader">Select Agent Tool</div>
                                                {AGENT_TOOLS.map((tool) => (
                                                    <button
                                                        key={tool}
                                                        className={`terminalInlineAgentOption terminalInlineAgentOption--${tool} ${tool === task.agentTool ? 'terminalInlineAgentOption--current' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectAgentTool(tool);
                                                        }}
                                                    >
                                                        <span className="terminalAgentSymbol">{AGENT_TOOL_SYMBOLS[tool]}</span>
                                                        <span className="terminalAgentLabel">{AGENT_TOOL_LABELS[tool]}</span>
                                                        <span className="terminalAgentArrow">→</span>
                                                    </button>
                                                ))}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className="terminalAgentDropdownBack"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAgentDropdownBack();
                                                    }}
                                                >
                                                    ← {selectedAgentTool ? AGENT_TOOL_LABELS[selectedAgentTool] : ''}
                                                </button>
                                                <div className="terminalAgentDropdownHeader">Select Model</div>
                                                {selectedAgentTool && AGENT_MODELS[selectedAgentTool].map((model) => (
                                                    <button
                                                        key={model.value}
                                                        className={`terminalInlineAgentOption terminalInlineAgentOption--model terminalInlineAgentOption--model-${model.value} ${model.value === task.model ? 'terminalInlineAgentOption--current' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectModel(model.value as ModelType);
                                                        }}
                                                    >
                                                        <span className="terminalAgentLabel">{model.label}</span>
                                                        {model.value === task.model && (
                                                            <span className="terminalStatusCheck">✓</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Combined session status chips: show task-session status with breathing animation when working */}
                        {sessionCount > 0 && (
                            <div className="terminalSessionStatuses">
                                {(loadingSessions || loadingParentSessions) ? (
                                    <span className="terminalSessionIndicator">
                                        <span className="terminalSessionNumber">{sessionCount}</span>
                                    </span>
                                ) : (
                                    allSessions.slice(0, 3).map(session => {
                                        const taskStatus = task.taskSessionStatuses?.[session.id];
                                        const sessionIsTerminal = ['stopped', 'completed', 'failed'].includes(session.status);
                                        const displayStatus = sessionIsTerminal ? session.status : (taskStatus || session.status);
                                        const taskIsTerminal = task.status === 'completed' || task.status === 'cancelled';
                                        const isWorking = !taskIsTerminal && displayStatus === 'working';
                                        const sessionNeedsInput = !taskIsTerminal && session.needsInput?.active;
                                        return (
                                            <span
                                                key={session.id}
                                                className={`terminalSessionStatusChip terminalSessionStatusChip--${taskIsTerminal ? 'completed' : displayStatus} terminalSessionStatusChip--clickable ${isWorking && !sessionNeedsInput ? 'terminalSessionStatusChip--breathing' : ''} ${sessionNeedsInput ? 'terminalSessionStatusChip--needsInput' : ''}`}
                                                title={`${session.name || session.id}: ${taskIsTerminal ? 'Completed' : sessionNeedsInput ? 'Needs Input' : taskStatus ? taskStatus.replace('_', ' ') : (SESSION_STATUS_LABELS[session.status] || session.status || 'Unknown')}${session.strategy ? ` [${session.strategy}]` : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSessionModalId(session.id);
                                                }}
                                            >
                                                {session.strategy === 'queue' && (
                                                    <span className="terminalSessionStrategyTag">Q</span>
                                                )}
                                                <span className="terminalSessionStatusLabel">
                                                    {taskIsTerminal ? 'DONE' : sessionNeedsInput ? 'NEEDS INPUT' : taskStatus ? taskStatus.toUpperCase().replace('_', ' ') : (SESSION_STATUS_LABELS[session.status] || session.status || 'UNKNOWN').toUpperCase()}
                                                </span>
                                            </span>
                                        );
                                    })
                                )}
                                {allSessions.length > 3 && (
                                    <span className="terminalSessionMore">+{allSessions.length - 3}</span>
                                )}
                            </div>
                        )}

                        {/* Time ago */}
                        <span className="terminalTimeAgo">{formatTimeAgo(task.updatedAt)}</span>
                    </div>
                </div>

                {/* Right-side action buttons */}
                <div className="terminalTaskActions">
                    {/* Subtask button - always visible */}
                    <button
                        className={`terminalSubtaskBtn ${hasChildren ? (isChildrenCollapsed ? 'terminalSubtaskBtn--collapsed' : 'terminalSubtaskBtn--expanded') : (isAddingSubtask ? 'terminalSubtaskBtn--adding' : 'terminalSubtaskBtn--empty')}`}
                        onClick={handleSubtaskAction}
                        title={hasChildren ? (isChildrenCollapsed ? `Expand ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}` : `Collapse ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`) : (isAddingSubtask ? "Cancel adding subtask" : "Add subtask")}
                    >
                        <span className="terminalSubtaskIcon">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M4 3v6c0 1 .5 1.5 1.5 1.5H8" />
                                <path d="M4 6.5h3.5c1 0 1.5.5 1.5 1.5v0" />
                                {!hasChildren && !isAddingSubtask && <path d="M11 9.5l2 2m0-2l-2 2" strokeWidth="1.8" />}
                            </svg>
                        </span>
                        {subtaskCount > 0 && (
                            <span className="terminalSubtaskCount">{subtaskCount}</span>
                        )}
                    </button>

                    {/* Pin button */}
                    <button
                        className={`terminalPinBtn ${task.pinned ? 'terminalPinBtn--pinned' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin?.();
                        }}
                        title={task.pinned ? "Unpin task" : "Pin task"}
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill={task.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.828 1.172a2 2 0 0 1 2.828 0l2.172 2.172a2 2 0 0 1 0 2.828L12 9l-1 4-4-1L4.172 14.828 1.172 11.828 4 9l-1-4 4-1z" />
                        </svg>
                    </button>

                    {/* Play button */}
                    <button
                        className="terminalPlayBtn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onWorkOn();
                        }}
                        title="Execute task"
                    >
                        ▶
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="terminalTaskExpanded">
                    {/* Tab Navigation */}
                    <div className="terminalTaskTabs" onClick={(e) => e.stopPropagation()}>
                        <button
                            className={`terminalTaskTab ${activeTab === 'context' ? 'terminalTaskTab--active' : ''}`}
                            onClick={() => setActiveTab('context')}
                        >
                            [Context]
                        </button>
                        <button
                            className={`terminalTaskTab ${activeTab === 'sessions' ? 'terminalTaskTab--active' : ''}`}
                            onClick={() => setActiveTab('sessions')}
                        >
                            [Sessions{sessionCount > 0 ? ` (${sessionCount})` : ''}]
                        </button>
                        <button
                            className={`terminalTaskTab ${activeTab === 'timeline' ? 'terminalTaskTab--active' : ''}`}
                            onClick={() => setActiveTab('timeline')}
                        >
                            [Timeline]
                        </button>
                        <button
                            className={`terminalTaskTab ${activeTab === 'details' ? 'terminalTaskTab--active' : ''}`}
                            onClick={() => setActiveTab('details')}
                        >
                            [Details]
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="terminalTaskTabContent" onClick={(e) => e.stopPropagation()}>
                        {/* Context Tab */}
                        {activeTab === 'context' && (
                            <div className="terminalTabPane terminalTabPane--context">
                                {/* Referenced Tasks as chips */}
                                {task.referenceTaskIds && task.referenceTaskIds.length > 0 && (
                                    <div className="terminalDetailBlock">
                                        <div className="terminalDetailBlockLabel">Referenced Tasks</div>
                                        <div className="terminalReferenceTaskChips">
                                            {task.referenceTaskIds.map(refId => {
                                                const refTask = tasks.get(refId);
                                                return (
                                                    <span
                                                        key={refId}
                                                        className="terminalReferenceTaskChip"
                                                        title={refTask ? refTask.title : refId}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onNavigateToTask?.(refId);
                                                        }}
                                                    >
                                                        {refTask ? refTask.title : refId}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Description */}
                                {task.description && (
                                    <div className="terminalDetailBlock">
                                        <div className="terminalDetailBlockLabel">Description</div>
                                        <div className="terminalDetailBlockContent terminalDescriptionText">
                                            {task.description}
                                        </div>
                                    </div>
                                )}

                                {/* Docs (moved from Details tab) */}
                                {taskDocs.length > 0 && (
                                    <div className="terminalDetailBlock">
                                        <div className="terminalDetailBlockLabel">Docs</div>
                                        <div className="terminalTaskDocsInline">
                                            {taskDocs.map((doc) => (
                                                <button
                                                    key={doc.id}
                                                    className="terminalTaskDocItem"
                                                    onClick={() => setViewingDoc(doc)}
                                                    title={doc.filePath}
                                                >
                                                    <svg className="terminalTaskDocIcon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z" />
                                                        <path d="M9 1v4h4" />
                                                    </svg>
                                                    <span className="terminalTaskDocTitle">{doc.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Empty state */}
                                {!task.description &&
                                 (!task.referenceTaskIds || task.referenceTaskIds.length === 0) &&
                                 taskDocs.length === 0 && (
                                    <div className="terminalEmptyState">
                                        No context available
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Details Tab */}
                        {activeTab === 'details' && (
                            <div className="terminalTabPane terminalTabPane--details">
                                <div className="terminalDetailGrid">
                                    {/* Dependencies */}
                                    {task.dependencies && task.dependencies.length > 0 && (
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Dependencies:</span>
                                            <span className="terminalDetailValue">
                                                {task.dependencies.join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Skills */}
                                    {task.skillIds && task.skillIds.length > 0 && (
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Skills:</span>
                                            <span className="terminalDetailValue">
                                                {task.skillIds.join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Agents */}
                                    {task.agentIds && task.agentIds.length > 0 && (
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Agents:</span>
                                            <span className="terminalDetailValue">
                                                {task.agentIds.join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="terminalDetailRow">
                                        <span className="terminalDetailLabel">Created:</span>
                                        <span className="terminalDetailValue">
                                            {formatDate(task.createdAt)}
                                        </span>
                                    </div>

                                    <div className="terminalDetailRow">
                                        <span className="terminalDetailLabel">Updated:</span>
                                        <span className="terminalDetailValue">
                                            {formatDate(task.updatedAt)}
                                        </span>
                                    </div>

                                    {task.startedAt && (
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Started:</span>
                                            <span className="terminalDetailValue">
                                                {formatDate(task.startedAt)}
                                            </span>
                                        </div>
                                    )}

                                    {task.completedAt && (
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Completed:</span>
                                            <span className="terminalDetailValue">
                                                {formatDate(task.completedAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {/* Sessions Tab */}
                        {activeTab === 'sessions' && (
                            <div className="terminalTabPane terminalTabPane--sessions">
                                {(loadingSessions || loadingParentSessions) ? (
                                    <div className="terminalLoading">Loading sessions...</div>
                                ) : sessionCount === 0 ? (
                                    <div className="terminalEmptyState">
                                        No sessions working on this task
                                    </div>
                                ) : (
                                    <div className="terminalSessionsList">
                                        {allSessions.map(session => (
                                            <SessionInTaskView
                                                key={session.id}
                                                session={session}
                                                taskId={task.id}
                                                tasks={tasks}
                                                onJumpToSession={onJumpToSession}
                                                onRemoveFromTask={handleRemoveSession}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timeline Tab */}
                        {activeTab === 'timeline' && (
                            <div className="terminalTabPane terminalTabPane--timeline">
                                {!hasSessions ? (
                                    <div className="terminalEmptyState">
                                        No sessions to show timeline for
                                    </div>
                                ) : !hasTimelineEvents ? (
                                    <div className="terminalEmptyState">
                                        No timeline events recorded yet
                                    </div>
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
                    </div>

                    {/* Actions Bar at Bottom Right */}
                    <div className="terminalTaskActionsBar terminalTaskActionsBar--right">
                        <button
                            className="terminalViewDetailsBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect();
                            }}
                            title="View task details"
                        >
                            View Details
                        </button>
                        {task.status === 'archived' ? (
                            <button
                                className="terminalDeleteBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask();
                                }}
                                title="Permanently delete task"
                            >
                                Delete Task
                            </button>
                        ) : (
                            <button
                                className="terminalArchiveBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveTask();
                                }}
                                title="Archive task"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Archiving...' : 'Archive Task'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {viewingDoc && createPortal(
                <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />,
                document.body
            )}

            {sessionModalId && createPortal(
                <SessionDetailModal
                    sessionId={sessionModalId}
                    isOpen={true}
                    onClose={() => setSessionModalId(null)}
                />,
                document.body
            )}

            {showDeleteConfirm && createPortal(
                <ConfirmActionModal
                    isOpen={showDeleteConfirm}
                    title="[ DELETE TASK ]"
                    message={
                        totalDescendantCount > 0
                            ? <>Are you sure you want to delete <strong>"{task.title}"</strong>? This task has <strong>{totalDescendantCount} subtask{totalDescendantCount !== 1 ? 's' : ''}</strong> that will also be deleted.</>
                            : <>Are you sure you want to delete <strong>"{task.title}"</strong>?</>
                    }
                    confirmLabel={totalDescendantCount > 0 ? `Delete All (${totalDescendantCount + 1})` : "Delete"}
                    cancelLabel="Cancel"
                    confirmDanger
                    busy={isDeleting}
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={confirmDeleteTask}
                />,
                document.body
            )}
        </div>
    );
}
