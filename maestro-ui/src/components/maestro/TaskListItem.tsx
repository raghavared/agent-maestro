import React, { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { MaestroTask, TaskStatus, TaskPriority, MaestroSessionStatus, DocEntry, WorkerStrategy, OrchestratorStrategy, AgentTool, ModelType, ClaudeModel, CodexModel } from "../../app/types/maestro";
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
    onWorkOnWithOverride?: (agentTool: AgentTool, model: ModelType) => void;
    onWorkOnWithTeamMember?: (teamMemberId: string, strategy?: WorkerStrategy | OrchestratorStrategy) => void;
    onAssignTeamMember?: (teamMemberId: string) => void;
    onOpenCreateTeamMember?: () => void;
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

const AGENT_TOOLS: { id: AgentTool; label: string; symbol: string; models: { id: ModelType; label: string }[] }[] = [
    {
        id: 'claude-code',
        label: 'Claude Code',
        symbol: '◈',
        models: [
            { id: 'haiku' as ClaudeModel, label: 'Haiku' },
            { id: 'sonnet' as ClaudeModel, label: 'Sonnet' },
            { id: 'opus' as ClaudeModel, label: 'Opus' },
        ],
    },
    {
        id: 'codex',
        label: 'Codex',
        symbol: '◇',
        models: [
            { id: 'gpt-5.2-codex' as CodexModel, label: 'GPT 5.2' },
            { id: 'gpt-5.3-codex' as CodexModel, label: 'GPT 5.3' },
        ],
    },
];

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
    onWorkOnWithOverride,
    onWorkOnWithTeamMember,
    onAssignTeamMember,
    onOpenCreateTeamMember,
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
    const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState(false);
    const [isUpdatingTeamMember, setIsUpdatingTeamMember] = useState(false);
    const [showLaunchDropdown, setShowLaunchDropdown] = useState(false);
    const [expandedTool, setExpandedTool] = useState<AgentTool | null>(null);
    const [launchOverride, setLaunchOverride] = useState<{ agentTool: AgentTool; model: ModelType } | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const priorityDropdownRef = useRef<HTMLDivElement>(null);
    const teamMemberDropdownRef = useRef<HTMLDivElement>(null);
    const launchDropdownRef = useRef<HTMLDivElement>(null);
    const statusBtnRef = useRef<HTMLButtonElement>(null);
    const priorityBtnRef = useRef<HTMLButtonElement>(null);
    const teamMemberBtnRef = useRef<HTMLButtonElement>(null);
    const launchBtnRef = useRef<HTMLButtonElement>(null);
    const [statusDropdownPos, setStatusDropdownPos] = useState<{ top?: number; bottom?: number; left: number; openDirection: 'down' | 'up' } | null>(null);
    const [priorityDropdownPos, setPriorityDropdownPos] = useState<{ top?: number; bottom?: number; left: number; openDirection: 'down' | 'up' } | null>(null);
    const [teamMemberDropdownPos, setTeamMemberDropdownPos] = useState<{ top?: number; bottom?: number; left: number; openDirection: 'down' | 'up' } | null>(null);
    // launchDropdownRightPos is declared below with computeLaunchDropdownPos

    const computeDropdownPos = useCallback((btnRef: React.RefObject<HTMLButtonElement | null>, estimatedHeight = 250) => {
        const btn = btnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove) {
            return { top: rect.bottom + 4, left: rect.left, openDirection: 'down' as const };
        } else {
            return { bottom: (window.innerHeight - rect.top) + 4, left: rect.left, openDirection: 'up' as const };
        }
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
        if (showTeamMemberDropdown) {
            setTeamMemberDropdownPos(computeDropdownPos(teamMemberBtnRef));
        }
    }, [showTeamMemberDropdown, computeDropdownPos]);

    const computeLaunchDropdownPos = useCallback(() => {
        const btn = launchBtnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const rightOffset = window.innerWidth - rect.right;

        if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
            return { top: rect.bottom + 4, right: rightOffset, openDirection: 'down' as const };
        } else {
            return { bottom: (window.innerHeight - rect.top) + 4, right: rightOffset, openDirection: 'up' as const };
        }
    }, []);

    const [launchDropdownRightPos, setLaunchDropdownRightPos] = useState<{ top?: number; bottom?: number; right: number; openDirection: 'down' | 'up' } | null>(null);

    useLayoutEffect(() => {
        if (showLaunchDropdown) {
            setLaunchDropdownRightPos(computeLaunchDropdownPos());
        }
    }, [showLaunchDropdown, computeLaunchDropdownPos]);

    const [taskDocs, setTaskDocs] = useState<DocEntry[]>([]);
    const [viewingDoc, setViewingDoc] = useState<DocEntry | null>(null);

    useEffect(() => {
        if (isExpanded && (activeTab === 'context' || activeTab === 'details')) {
            maestroClient.getTaskDocs(task.id).then(setTaskDocs).catch(() => {});
        }
    }, [isExpanded, activeTab, task.id]);

    const { sessions: taskSessions, loading: loadingSessions } = useTaskSessions(task.id);
    const tasks = useMaestroStore(s => s.tasks);
    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const removeTaskFromSession = useMaestroStore(s => s.removeTaskFromSession);
    const deleteTask = useMaestroStore(s => s.deleteTask);
    const updateTask = useMaestroStore(s => s.updateTask);

    const teamMembers = useMemo(() => Array.from(teamMembersMap.values()), [teamMembersMap]);

    // Resolve effective team member IDs (prefer array, fallback to singular)
    const effectiveTeamMemberIds = useMemo(() =>
        task.teamMemberIds && task.teamMemberIds.length > 0
            ? task.teamMemberIds
            : task.teamMemberId ? [task.teamMemberId] : [],
        [task.teamMemberIds, task.teamMemberId]
    );

    const assignedTeamMembers = useMemo(() =>
        effectiveTeamMemberIds.map(id => teamMembersMap.get(id)).filter(Boolean) as typeof teamMembers,
        [effectiveTeamMemberIds, teamMembersMap]
    );

    // Keep backward compat reference for single member
    const assignedTeamMember = assignedTeamMembers.length > 0 ? assignedTeamMembers[0] : undefined;

    // Effective model: launch override takes priority over team member's model
    const effectiveModel = launchOverride?.model || assignedTeamMember?.model || null;

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
        }
    };

    const handleArchiveTask = async () => {
        setIsDeleting(true);
        try {
            await updateTask(task.id, { status: 'archived' });
        } catch (error) {
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
        } finally {
            setIsUpdatingPriority(false);
        }
    };

    const handleInlineTeamMemberToggle = async (teamMemberId: string) => {
        const currentIds = effectiveTeamMemberIds;
        const isAlreadySelected = currentIds.includes(teamMemberId);

        const newIds = isAlreadySelected
            ? currentIds.filter(id => id !== teamMemberId)
            : [...currentIds, teamMemberId];

        setIsUpdatingTeamMember(true);
        try {
            await updateTask(task.id, {
                teamMemberIds: newIds.length > 0 ? newIds : undefined,
                teamMemberId: newIds.length === 1 ? newIds[0] : undefined,
            });
            // Reset launch override — team members changed
            setLaunchOverride(null);
        } catch (error) {
        } finally {
            setIsUpdatingTeamMember(false);
        }
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

    const handleCopyField = useCallback((label: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(label);
            setTimeout(() => setCopiedField(null), 1500);
        }).catch(() => {});
    }, []);

    return (
        <div
            className={`terminalTaskRow terminalTaskRow--${task.status} ${isSubtask ? 'terminalTaskRow--subtask' : ''} ${showStatusDropdown || showPriorityDropdown || showTeamMemberDropdown ? 'terminalTaskRow--dropdownOpen' : ''} ${selectionMode ? 'terminalTaskRow--selectable' : ''}`}
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
                                        className={`terminalInlineStatusDropdown terminalInlineStatusDropdown--fixed ${statusDropdownPos.openDirection === 'up' ? 'terminalInlineDropdown--openUp' : ''}`}
                                        style={{
                                            ...(statusDropdownPos.openDirection === 'down'
                                                ? { top: statusDropdownPos.top }
                                                : { bottom: statusDropdownPos.bottom }),
                                            left: statusDropdownPos.left,
                                        }}
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
                                        className={`terminalInlinePriorityDropdown terminalInlinePriorityDropdown--fixed ${priorityDropdownPos.openDirection === 'up' ? 'terminalInlineDropdown--openUp' : ''}`}
                                        style={{
                                            ...(priorityDropdownPos.openDirection === 'down'
                                                ? { top: priorityDropdownPos.top }
                                                : { bottom: priorityDropdownPos.bottom }),
                                            left: priorityDropdownPos.left,
                                        }}
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

                        {/* Team Member Dropdown */}
                        <div className="terminalInlineTeamMemberPicker" ref={teamMemberDropdownRef}>
                            <button
                                ref={teamMemberBtnRef}
                                className={`terminalMetaBadge terminalMetaBadge--agent terminalMetaBadge--clickable ${showTeamMemberDropdown ? 'terminalMetaBadge--open' : ''} ${isUpdatingTeamMember ? 'terminalMetaBadge--updating' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isUpdatingTeamMember) {
                                        setShowTeamMemberDropdown(!showTeamMemberDropdown);
                                    }
                                }}
                                disabled={isUpdatingTeamMember}
                                title={assignedTeamMembers.length > 0
                                    ? assignedTeamMembers.map(m => `${m.name}${m.agentTool ? ` · ${m.agentTool}` : ''}${m.model ? ` / ${m.model}` : ''}`).join(', ')
                                    : "Click to assign team members"
                                }
                            >
                                {isUpdatingTeamMember ? (
                                    <span className="terminalStatusSpinner">⟳</span>
                                ) : (
                                    <>
                                        {assignedTeamMembers.length > 1 ? (
                                            <>{assignedTeamMembers.map(m => m.avatar).join('')} {assignedTeamMembers.length} members</>
                                        ) : assignedTeamMember ? (
                                            <>{assignedTeamMember.avatar} {assignedTeamMember.name}</>
                                        ) : (
                                            <>👤 Assign</>
                                        )}
                                        <span className="terminalMetaBadgeCaret">{showTeamMemberDropdown ? '▴' : '▾'}</span>
                                    </>
                                )}
                            </button>

                            {showTeamMemberDropdown && !isUpdatingTeamMember && teamMemberDropdownPos && createPortal(
                                <>
                                    <div
                                        className="terminalInlineStatusOverlay"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowTeamMemberDropdown(false);
                                        }}
                                    />
                                    <div
                                        className={`terminalInlineTeamMemberDropdown terminalInlineTeamMemberDropdown--fixed ${teamMemberDropdownPos.openDirection === 'up' ? 'terminalInlineDropdown--openUp' : ''}`}
                                        style={{
                                            ...(teamMemberDropdownPos.openDirection === 'down'
                                                ? { top: teamMemberDropdownPos.top }
                                                : { bottom: teamMemberDropdownPos.bottom }),
                                            left: teamMemberDropdownPos.left,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {teamMembers.filter(m => m.status === 'active' && m.projectId === task.projectId).map((member) => {
                                            const isSelected = effectiveTeamMemberIds.includes(member.id);
                                            return (
                                                <button
                                                    key={member.id}
                                                    className={`terminalInlineTeamMemberOption ${isSelected ? 'terminalInlineTeamMemberOption--current' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleInlineTeamMemberToggle(member.id);
                                                    }}
                                                >
                                                    <span className="terminalTeamMemberAvatar">{member.avatar}</span>
                                                    <span className="terminalTeamMemberLabel">{member.name}</span>
                                                    {isSelected && (
                                                        <span className="terminalStatusCheck">✓</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {onOpenCreateTeamMember && (
                                            <button
                                                className="terminalInlineTeamMemberOption terminalInlineTeamMemberOption--create"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowTeamMemberDropdown(false);
                                                    onOpenCreateTeamMember();
                                                }}
                                            >
                                                <span className="terminalTeamMemberAvatar">+</span>
                                                <span className="terminalTeamMemberLabel">New Member</span>
                                            </button>
                                        )}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>

                        {/* Effective Model Badge */}
                        {effectiveModel && (
                            <span
                                className={`terminalMetaBadge terminalMetaBadge--model ${launchOverride ? 'terminalMetaBadge--model-override' : ''}`}
                                title={launchOverride
                                    ? `Override: ${launchOverride.model} (${launchOverride.agentTool})`
                                    : `From team member: ${effectiveModel}`
                                }
                            >
                                {effectiveModel}
                            </span>
                        )}

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
                                                title={`${session.name || session.id}: ${taskIsTerminal ? 'Completed' : sessionNeedsInput ? 'Needs Input' : taskStatus ? taskStatus.replace('_', ' ') : (SESSION_STATUS_LABELS[session.status] || session.status || 'Unknown')}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSessionModalId(session.id);
                                                }}
                                            >
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
                    {/* Subtask button */}
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

                    {/* Split Play button with launch options */}
                    <div className="terminalSplitPlay" ref={launchDropdownRef}>
                        <button
                            className="terminalSplitPlay__play"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (launchOverride) {
                                    onWorkOnWithOverride?.(launchOverride.agentTool, launchOverride.model);
                                } else {
                                    onWorkOn();
                                }
                            }}
                            title={launchOverride ? `Run with ${launchOverride.model}` : "Run task"}
                        >
                            ▶
                        </button>
                        <button
                            ref={launchBtnRef}
                            className={`terminalSplitPlay__dropdown ${showLaunchDropdown ? 'terminalSplitPlay__dropdown--open' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLaunchDropdown(!showLaunchDropdown);
                                setExpandedTool(null);
                            }}
                            title="Launch options"
                        >
                            ▾
                        </button>

                        {showLaunchDropdown && launchDropdownRightPos && createPortal(
                            <>
                                <div
                                    className="terminalInlineStatusOverlay"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowLaunchDropdown(false);
                                    }}
                                />
                                <div
                                    className={`terminalLaunchDropdown terminalLaunchDropdown--fixed ${launchDropdownRightPos.openDirection === 'up' ? 'terminalInlineDropdown--openUp' : ''}`}
                                    style={{
                                        ...(launchDropdownRightPos.openDirection === 'down'
                                            ? { top: launchDropdownRightPos.top }
                                            : { bottom: launchDropdownRightPos.bottom }),
                                        right: launchDropdownRightPos.right,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="terminalLaunchDropdown__header">Launch With</div>
                                    {AGENT_TOOLS.map((tool) => (
                                        <div key={tool.id} className="terminalLaunchDropdown__toolGroup">
                                            <button
                                                className={`terminalLaunchDropdown__tool ${expandedTool === tool.id ? 'terminalLaunchDropdown__tool--expanded' : ''}`}
                                                onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                                            >
                                                <span className="terminalLaunchDropdown__toolSymbol">{tool.symbol}</span>
                                                <span className="terminalLaunchDropdown__toolLabel">{tool.label}</span>
                                                <span className="terminalLaunchDropdown__toolCaret">{expandedTool === tool.id ? '▴' : '▸'}</span>
                                            </button>
                                            {expandedTool === tool.id && (
                                                <div className="terminalLaunchDropdown__models">
                                                    {tool.models.map((model) => (
                                                        <button
                                                            key={model.id}
                                                            className={`terminalLaunchDropdown__model ${launchOverride?.model === model.id && launchOverride?.agentTool === tool.id ? 'terminalLaunchDropdown__model--selected' : ''}`}
                                                            onClick={() => {
                                                                setShowLaunchDropdown(false);
                                                                setLaunchOverride({ agentTool: tool.id, model: model.id });
                                                            }}
                                                        >
                                                            {model.label}
                                                            {launchOverride?.model === model.id && launchOverride?.agentTool === tool.id && (
                                                                <span className="terminalStatusCheck"> ✓</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>,
                            document.body
                        )}
                    </div>
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
                            className="terminalCopyBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopyField('id', task.id);
                            }}
                            title="Copy task ID"
                        >
                            {copiedField === 'id' ? 'Copied!' : 'Copy ID'}
                        </button>
                        <button
                            className="terminalCopyBtn"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopyField('title', task.title);
                            }}
                            title="Copy task title"
                        >
                            {copiedField === 'title' ? 'Copied!' : 'Copy Title'}
                        </button>
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
