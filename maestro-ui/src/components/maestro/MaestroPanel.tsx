import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { MaestroTask, MaestroProject, TaskTreeNode, WorkerStrategy, OrchestratorStrategy, AgentTool, ModelType } from "../../app/types/maestro";
import { TaskListItem } from "./TaskListItem";
import { TaskFilters, SortByOption } from "./TaskFilters";
import { SortableTaskList } from "./SortableTaskList";
import { CreateTaskModal } from "./CreateTaskModal";
import { ExecutionBar } from "./ExecutionBar";
import { AddSubtaskInput } from "./AddSubtaskInput";
import { TeamMemberList } from "./TeamMemberList";
import { CreateTeamMemberModal } from "./CreateTeamMemberModal";
import { EditTeamMemberModal } from "./EditTeamMemberModal";
import { PanelIconBar, PrimaryTab, TaskSubTab, SkillSubTab, TeamSubTab } from "./PanelIconBar";
import { TaskTabContent } from "./TaskTabContent";
import { PanelErrorState, NoProjectState } from "./PanelErrorState";
import { useTasks } from "../../hooks/useTasks";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useTaskTree } from "../../hooks/useTaskTree";
import { useUIStore } from "../../stores/useUIStore";
import { Board } from "./MultiProjectBoard";
import { SkillsPanel } from "./SkillsPanel";

// Tab types are imported from PanelIconBar

type MaestroPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    project: MaestroProject;
    onCreateMaestroSession: (input: { task?: MaestroTask; tasks?: MaestroTask[]; project: MaestroProject; skillIds?: string[]; strategy?: WorkerStrategy | OrchestratorStrategy; mode?: 'execute' | 'coordinate'; teamMemberIds?: string[]; teamMemberId?: string; agentTool?: AgentTool; model?: ModelType }) => Promise<any>;
    onJumpToSession?: (maestroSessionId: string) => void;
    onAddTaskToSession?: (taskId: string) => void;
};

export const MaestroPanel = React.memo(function MaestroPanel({
    isOpen,
    onClose,
    projectId,
    project,
    onCreateMaestroSession,
    onJumpToSession,
    onAddTaskToSession
}: MaestroPanelProps) {

    // ==================== STATE MANAGEMENT (PHASE V) ====================

    // Use new framework hooks
    const { tasks, loading, error: fetchError } = useTasks(projectId);
    const createTask = useMaestroStore(s => s.createTask);
    const updateTask = useMaestroStore(s => s.updateTask);
    const deleteTask = useMaestroStore(s => s.deleteTask);
    const removeTaskFromSession = useMaestroStore(s => s.removeTaskFromSession);
    const hardRefresh = useMaestroStore(s => s.hardRefresh);
    const taskOrdering = useMaestroStore(s => s.taskOrdering);
    const fetchTaskOrdering = useMaestroStore(s => s.fetchTaskOrdering);
    const saveTaskOrdering = useMaestroStore(s => s.saveTaskOrdering);

    // ==================== UI STATE ====================

    const [primaryTab, setPrimaryTab] = React.useState<PrimaryTab>("tasks");
    const [taskSubTab, setTaskSubTab] = React.useState<TaskSubTab>("current");
    const [skillSubTab, setSkillSubTab] = React.useState<SkillSubTab>("browse");
    const [teamSubTab, setTeamSubTab] = React.useState<TeamSubTab>("members");
    const [componentError, setComponentError] = React.useState<Error | null>(null);
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
    const [statusFilter, setStatusFilter] = React.useState<MaestroTask["status"][]>([]);
    const [priorityFilter, setPriorityFilter] = React.useState<MaestroTask["priority"][]>([]);
    const [sortBy, setSortBy] = React.useState<SortByOption>("custom");
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [showDetailModal, setShowDetailModal] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [executionMode, setExecutionMode] = React.useState(false);
    const [activeBarMode, setActiveBarMode] = React.useState<'none' | 'execute' | 'orchestrate'>('none');
    const [selectedForExecution, setSelectedForExecution] = React.useState<Set<string>>(new Set());
    const [selectedAgentByTask, setSelectedAgentByTask] = React.useState<Record<string, string>>({});
    const [subtaskParentId, setSubtaskParentId] = React.useState<string | null>(null);
    const [collapsedTasks, setCollapsedTasks] = React.useState<Set<string>>(new Set());
    const [addingSubtaskTo, setAddingSubtaskTo] = React.useState<string | null>(null);
    const [slidingOutTasks, setSlidingOutTasks] = React.useState<Set<string>>(new Set());
    const [showBoard, setShowBoard] = React.useState(false);
    const [showCreateTeamMemberModal, setShowCreateTeamMemberModal] = React.useState(false);
    const [showEditTeamMemberModal, setShowEditTeamMemberModal] = React.useState(false);
    const [editingTeamMember, setEditingTeamMember] = React.useState<any | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    // Team member selection is now handled inside ExecutionBar via dropdowns

    // Fetch task ordering on mount
    useEffect(() => {
        if (projectId) {
            fetchTaskOrdering(projectId);
        }
    }, [projectId, fetchTaskOrdering]);

    // Listen for global create-task shortcut trigger
    const createTaskRequested = useUIStore(s => s.createTaskRequested);
    useEffect(() => {
        if (createTaskRequested) {
            setShowCreateModal(true);
            useUIStore.getState().setCreateTaskRequested(false);
        }
    }, [createTaskRequested]);

    // Listen for global show-board trigger (from SessionsSection)
    const showBoardRequested = useUIStore(s => s.showBoardRequested);
    useEffect(() => {
        if (showBoardRequested) {
            setShowBoard(true);
            useUIStore.getState().setShowBoardRequested(false);
        }
    }, [showBoardRequested]);

    // Track previous task statuses to detect completions
    const prevTaskStatusesRef = useRef<Map<string, string>>(new Map());

    // Normalize tasks to ensure they have all required fields
    const normalizedTasks = useMemo(() => {
        return tasks.map(task => ({
            ...task,
            subtasks: task.subtasks || [],
            lastUpdate: task.lastUpdate || null,
            completedAt: task.completedAt || null,
        }));
    }, [tasks]);

    // Team members are now separate entities, not tasks
    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const fetchTeamMembers = useMaestroStore(s => s.fetchTeamMembers);
    const archiveTeamMember = useMaestroStore(s => s.archiveTeamMember);
    const unarchiveTeamMember = useMaestroStore(s => s.unarchiveTeamMember);
    const deleteTeamMember = useMaestroStore(s => s.deleteTeamMember);

    // Fetch team members when projectId changes or WebSocket reconnects
    const wsConnected = useMaestroStore(s => s.wsConnected);
    useEffect(() => {
        if (projectId) {
            fetchTeamMembers(projectId);
        }
    }, [projectId, fetchTeamMembers, wsConnected]);

    const teamMembersLoading = useMaestroStore(s => s.loading.has(`teamMembers:${projectId}`));

    const teamMembers = useMemo(() => {
        return Array.from(teamMembersMap.values()).filter(tm => tm.projectId === projectId);
    }, [teamMembersMap, projectId]);

    const regularTasks = useMemo(() => {
        return normalizedTasks;
    }, [normalizedTasks]);

    // Detect when tasks become completed and trigger slide-out animation
    useEffect(() => {
        const newlyCompleted: string[] = [];

        normalizedTasks.forEach(task => {
            const prevStatus = prevTaskStatusesRef.current.get(task.id);
            // Task just became completed or archived (was something else before)
            if (prevStatus && prevStatus !== 'completed' && prevStatus !== 'archived' &&
                (task.status === 'completed' || task.status === 'archived')) {
                newlyCompleted.push(task.id);
            }
        });

        // Update previous statuses
        const newStatuses = new Map<string, string>();
        normalizedTasks.forEach(task => {
            newStatuses.set(task.id, task.status);
        });
        prevTaskStatusesRef.current = newStatuses;

        // Add newly completed tasks to sliding out set
        if (newlyCompleted.length > 0) {
            setSlidingOutTasks(prev => {
                const next = new Set(prev);
                newlyCompleted.forEach(id => next.add(id));
                return next;
            });

            // Remove from sliding set after animation (500ms)
            setTimeout(() => {
                setSlidingOutTasks(prev => {
                    const next = new Set(prev);
                    newlyCompleted.forEach(id => next.delete(id));
                    return next;
                });
            }, 500);
        }
    }, [normalizedTasks]);

    // Initialize collapsed state - all parent tasks collapsed by default
    const hasInitializedCollapsedRef = useRef(false);
    useEffect(() => {
        hasInitializedCollapsedRef.current = false;
        setCollapsedTasks(new Set());
    }, [projectId]);
    useEffect(() => {
        if (!hasInitializedCollapsedRef.current && regularTasks.length > 0) {
            const parentIds = new Set<string>(
                regularTasks
                    .filter(task => task.parentId)
                    .map(task => task.parentId as string)
            );
            if (parentIds.size > 0) {
                hasInitializedCollapsedRef.current = true;
                setCollapsedTasks(parentIds);
            }
        }
    }, [regularTasks]);

    // Show component error if any
    if (componentError) {
        return (
            <PanelErrorState
                error={componentError}
                onRetry={() => setComponentError(null)}
                onClose={onClose}
            />
        );
    }

    if (!isOpen) return null;

    // Show message if no project is selected
    if (!projectId) {
        return <NoProjectState onClose={onClose} />;
    }

    // Build task tree for hierarchical display (excludes team members)
    const { roots } = useTaskTree(regularTasks);

    // Search all tasks (not just roots) so subtasks can be selected
    const selectedTask = normalizedTasks.find((t) => t.id === selectedTaskId);

    // ==================== EVENT HANDLERS ====================

    const handleCreateTask = async (taskData: any) => {
        try {
            const newTask = await createTask({
                projectId,
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority,
                skillIds: taskData.skillIds,
                referenceTaskIds: taskData.referenceTaskIds,
                parentId: taskData.parentId,
                teamMemberId: taskData.teamMemberId,
                teamMemberIds: taskData.teamMemberIds,
            });

            // Task will be added via WebSocket event automatically

            if (taskData.startImmediately) {
                console.log("Start working on task:", newTask.id);
                await handleWorkOnTask(newTask);
            }
        } catch (err: any) {
            console.error("[Maestro] Failed to create task:", err);
            setError("Failed to create task");
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<MaestroTask>) => {
        try {
            await updateTask(taskId, updates);
        } catch (err: any) {
            console.error("[Maestro] Failed to update task:", err);
            setError("Failed to update task");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await deleteTask(taskId);
        } catch (err: any) {
            console.error("[Maestro] Failed to delete task:", err);
            setError("Failed to delete task");
        }
    };

    const handleRemoveTaskFromSession = async (sessionId: string, taskId: string) => {
        try {
            await removeTaskFromSession(sessionId, taskId);
        } catch (err: any) {
            console.error("[Maestro] Failed to remove task from session:", err);
            setError("Failed to remove task from session");
        }
    };

    const handleAssignTeamMember = async (taskId: string, teamMemberId: string) => {
        try {
            // When assigning a single member via this handler, set both fields for backward compat
            await updateTask(taskId, { teamMemberId, teamMemberIds: [teamMemberId] });
        } catch (err: any) {
            console.error("[Maestro] Failed to assign team member:", err);
            setError("Failed to assign team member");
        }
    };

    const handleWorkOnTask = async (task: MaestroTask, override?: { agentTool: AgentTool; model: ModelType }) => {
        // Resolve effective team member IDs (prefer array over singular)
        const effectiveIds = task.teamMemberIds && task.teamMemberIds.length > 0
            ? task.teamMemberIds
            : task.teamMemberId ? [task.teamMemberId] : [];
        const teamMemberId = effectiveIds.length === 1 ? effectiveIds[0] : undefined;
        const teamMemberIds = effectiveIds.length > 1 ? effectiveIds : undefined;
        const member = teamMemberId ? teamMembersMap.get(teamMemberId) : null;

        const mode = member?.mode || 'execute';

        console.log('[MaestroPanel.handleWorkOnTask] ========================================');
        console.log('[MaestroPanel.handleWorkOnTask] Task ID:', task.id);
        console.log('[MaestroPanel.handleWorkOnTask] Team Members:', effectiveIds.length > 0 ? effectiveIds.join(', ') : '(default)');
        console.log('[MaestroPanel.handleWorkOnTask] Mode:', mode);
        if (override) {
            console.log('[MaestroPanel.handleWorkOnTask] Override:', override.agentTool, override.model);
        }
        console.log('[MaestroPanel.handleWorkOnTask] ========================================');

        try {
            await onCreateMaestroSession({
                task,
                project,
                mode,
                teamMemberId,
                teamMemberIds,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
            });

            console.log('[MaestroPanel.handleWorkOnTask] ✓ Session created successfully!');
        } catch (err: any) {
            console.error('[MaestroPanel.handleWorkOnTask] ✗ CAUGHT ERROR:', err);
            setError(`Failed to open terminal: ${err.message}`);
        }
    };

    const handleAgentSelect = (taskId: string, agentId: string) => {
        setSelectedAgentByTask(prev => ({
            ...prev,
            [taskId]: agentId,
        }));
    };

    const handleBatchExecute = async (teamMemberId?: string, override?: { agentTool: AgentTool; model: ModelType }) => {
        const selectedTasks = normalizedTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                teamMemberId,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
        } catch (err: any) {
            console.error('[MaestroPanel] Failed to create batch session:', err);
            setError(`Failed to create session: ${err.message}`);
        }
    };

    const handleBatchOrchestrate = async (coordinatorId?: string, workerIds?: string[], override?: { agentTool: AgentTool; model: ModelType }) => {
        const selectedTasks = regularTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                mode: 'coordinate',
                skillIds: ['maestro-orchestrator'],
                teamMemberId: coordinatorId,
                teamMemberIds: workerIds && workerIds.length > 0 ? workerIds : undefined,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
        } catch (err: any) {
            console.error('[MaestroPanel] Failed to create orchestrate session:', err);
            setError(`Failed to create orchestrator session: ${err.message}`);
        }
    };

    const handleToggleTaskSelection = (taskId: string) => {
        setSelectedForExecution(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const handleCancelExecution = () => {
        setExecutionMode(false);
        setActiveBarMode('none');
        setSelectedForExecution(new Set());
    };

    const handleAddSubtask = (parentId: string) => {
        setSubtaskParentId(parentId);
        setShowCreateModal(true);
    };

    const handleInlineAddSubtask = async (parentId: string, title: string) => {
        try {
            await createTask({
                projectId,
                parentId,
                title,
                description: "",
                priority: "medium",
            });
            // Ensure children are expanded after adding
            setCollapsedTasks(prev => {
                const next = new Set(prev);
                next.delete(parentId);
                return next;
            });
        } catch (err: any) {
            console.error("[Maestro] Failed to create subtask:", err);
            setError("Failed to create subtask");
            throw err;
        }
    };

    const handleToggleCollapse = (taskId: string) => {
        setCollapsedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const handleToggleAddSubtask = (taskId: string, hasChildren: boolean) => {
        if (hasChildren) {
            handleToggleCollapse(taskId);
        } else {
            setAddingSubtaskTo(prev => prev === taskId ? null : taskId);
        }
    };

    // Team member handlers
    const handleEditTeamMember = (member: any) => {
        setEditingTeamMember(member);
        setShowEditTeamMemberModal(true);
    };

    const handleArchiveTeamMember = async (memberId: string) => {
        try {
            await archiveTeamMember(memberId, projectId);
        } catch (err) {
            console.error("Failed to archive team member:", err);
            setError("Failed to archive team member");
        }
    };

    const handleUnarchiveTeamMember = async (memberId: string) => {
        try {
            await unarchiveTeamMember(memberId, projectId);
        } catch (err) {
            console.error("Failed to unarchive team member:", err);
            setError("Failed to unarchive team member");
        }
    };

    const handleDeleteTeamMember = async (memberId: string) => {
        try {
            await deleteTeamMember(memberId, projectId);
        } catch (err) {
            console.error("Failed to delete team member:", err);
            setError("Failed to delete team member");
        }
    };

    const handleRunTeamMember = async (member: any) => {
        try {
            // Create an ad-hoc task for this team member session
            const task = await createTask({
                projectId,
                title: `Session with ${member.name}`,
                description: `Ad-hoc session started from team member: ${member.name}`,
                priority: 'medium',
                teamMemberId: member.id,
            });

            const mode = member.mode || 'execute';

            await onCreateMaestroSession({
                task,
                project,
                mode,
                teamMemberId: member.id,
            });
        } catch (err: any) {
            console.error('[MaestroPanel] Failed to run team member:', err);
            setError(`Failed to start session: ${err.message}`);
        }
    };

    const handleToggleSubtask = async (_taskId: string, subtaskId: string) => {
        try {
            const subtask = normalizedTasks.find(t => t.id === subtaskId);
            if (!subtask) return;
            const newStatus = subtask.status === 'completed' ? 'todo' : 'completed';
            await updateTask(subtaskId, { status: newStatus });
        } catch (err: any) {
            console.error("[Maestro] Failed to toggle subtask:", err);
            setError("Failed to toggle subtask");
        }
    };

    const handleDeleteSubtask = async (_taskId: string, subtaskId: string) => {
        try {
            await deleteTask(subtaskId);
        } catch (err: any) {
            console.error("[Maestro] Failed to delete subtask:", err);
            setError("Failed to delete subtask");
        }
    };

    const handleTogglePin = async (taskId: string) => {
        try {
            const task = normalizedTasks.find(t => t.id === taskId);
            if (!task) return;
            await updateTask(taskId, { pinned: !task.pinned });
        } catch (err: any) {
            console.error("[Maestro] Failed to toggle pin:", err);
            setError("Failed to toggle pin");
        }
    };

    // ==================== DERIVED DATA ====================

    // Search filter helper: recursively filters tree nodes by search query
    const filterBySearch = useCallback((nodes: TaskTreeNode[]): TaskTreeNode[] => {
        if (!searchQuery.trim()) return nodes;
        const query = searchQuery.toLowerCase().trim();

        const matches = (node: TaskTreeNode): boolean => {
            if (node.title.toLowerCase().includes(query)) return true;
            if (node.description?.toLowerCase().includes(query)) return true;
            return node.children.some(child => matches(child));
        };

        return nodes.filter(node => matches(node));
    }, [searchQuery]);

    const customOrder = taskOrdering.get(projectId) || [];

    const activeRoots = filterBySearch(roots
        .filter((node) => node.status !== 'completed' && node.status !== 'archived')
        .filter((node) => statusFilter.length === 0 || statusFilter.includes(node.status))
        .filter((node) => priorityFilter.length === 0 || priorityFilter.includes(node.priority))
        .sort((a, b) => {
            if (sortBy === "custom") {
                const aIdx = customOrder.indexOf(a.id);
                const bIdx = customOrder.indexOf(b.id);
                // Items not in custom order go to the end, sorted by updatedAt
                if (aIdx === -1 && bIdx === -1) return b.updatedAt - a.updatedAt;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            }
            if (sortBy === "priority") {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return b[sortBy] - a[sortBy];
        }));

    const handleTaskReorder = useCallback((orderedIds: string[]) => {
        saveTaskOrdering(projectId, orderedIds);
    }, [projectId, saveTaskOrdering]);

    const completedRoots = filterBySearch(roots
        .filter((node) => node.status === 'completed')
        .sort((a, b) => {
            return (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt);
        }));

    const pinnedRoots = filterBySearch(roots
        .filter((node) => node.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt));

    const archivedRoots = filterBySearch(roots
        .filter((node) => node.status === 'archived')
        .sort((a, b) => b.updatedAt - a.updatedAt));

    // Recursive rendering function for task tree
    const renderTaskNode = (node: TaskTreeNode, depth: number = 0, options?: { showPermanentDelete?: boolean }): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsedTasks.has(node.id);
        const isSlidingOut = slidingOutTasks.has(node.id);
        const isAddingSubtask = addingSubtaskTo === node.id;

        const taskItem = (
            <div className={isSlidingOut ? 'terminalTaskSlideOut' : ''}>
                <TaskListItem
                    task={node}
                    onSelect={() => {
                        setSelectedTaskId(node.id);
                        setShowDetailModal(true);
                    }}
                    onWorkOn={() => handleWorkOnTask(node)}
                    onWorkOnWithOverride={(agentTool: AgentTool, model: ModelType) => handleWorkOnTask(node, { agentTool, model })}
                    onAssignTeamMember={(teamMemberId: string) => handleAssignTeamMember(node.id, teamMemberId)}
                    onOpenCreateTeamMember={() => setShowCreateTeamMemberModal(true)}
                    onJumpToSession={(sid) => onJumpToSession?.(sid)}
                    onNavigateToTask={(taskId: string) => {
                        setSelectedTaskId(taskId);
                        setShowDetailModal(true);
                    }}
                    depth={depth}
                    hasChildren={hasChildren}
                    isChildrenCollapsed={isCollapsed}
                    isAddingSubtask={isAddingSubtask}
                    onToggleChildrenCollapse={() => handleToggleAddSubtask(node.id, hasChildren)}
                    onTogglePin={() => handleTogglePin(node.id)}
                    selectionMode={executionMode}
                    isSelected={selectedForExecution.has(node.id)}
                    onToggleSelect={() => handleToggleTaskSelection(node.id)}
                    showPermanentDelete={options?.showPermanentDelete}
                />
            </div>
        );

        const subtaskInput = (isAddingSubtask || (hasChildren && !isCollapsed)) ? (
            <AddSubtaskInput
                parentTaskId={node.id}
                onAddSubtask={handleInlineAddSubtask}
                depth={depth + 1}
            />
        ) : null;

        // Wrap parent tasks (depth 0) with children in a grouping box
        if (depth === 0 && (hasChildren || isAddingSubtask)) {
            return (
                <div key={node.id} className={`terminalTaskGroup ${isCollapsed && !isAddingSubtask ? 'terminalTaskGroup--collapsed' : 'terminalTaskGroup--expanded'} ${isSlidingOut ? 'terminalTaskSlideOut' : ''}`}>
                    {taskItem}
                    {(!isCollapsed || isAddingSubtask) && (
                        <div className="terminalTaskGroupChildren">
                            {!isCollapsed && node.children.map(child => renderTaskNode(child, depth + 1, options))}
                            {subtaskInput}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <React.Fragment key={node.id}>
                {taskItem}
                {!isCollapsed && node.children.map(child => renderTaskNode(child, depth + 1, options))}
                {subtaskInput}
            </React.Fragment>
        );
    };

    // Get subtask parent title for the create modal
    const subtaskParentTitle = subtaskParentId
        ? normalizedTasks.find(t => t.id === subtaskParentId)?.title
        : undefined;

    return (
        <>
            <div className={`maestroPanel terminalTheme ${executionMode ? 'maestroPanel--executionMode' : ''}`}>
                <PanelIconBar
                    primaryTab={primaryTab}
                    onPrimaryTabChange={setPrimaryTab}
                    taskSubTab={taskSubTab}
                    onTaskSubTabChange={setTaskSubTab}
                    skillSubTab={skillSubTab}
                    onSkillSubTabChange={setSkillSubTab}
                    teamSubTab={teamSubTab}
                    onTeamSubTabChange={setTeamSubTab}
                    roots={roots}
                    teamMembers={teamMembers}
                    loading={loading}
                    projectId={projectId}
                    onNewTask={() => setShowCreateModal(true)}
                    onNewTeamMember={() => setShowCreateTeamMemberModal(true)}
                />

                {primaryTab === "tasks" && (
                    <div className="taskSearchBar">
                        <span className="taskSearchBar__icon">⌕</span>
                        <input
                            type="text"
                            className="taskSearchBar__input"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="taskSearchBar__clear"
                                onClick={() => setSearchQuery("")}
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}

                {(error || fetchError) && (
                    <div className="terminalErrorBanner">
                        <span className="terminalErrorSymbol">[ERROR]</span>
                        <span className="terminalErrorText">{error || fetchError}</span>
                        <button className="terminalErrorClose" onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* ==================== TASKS PRIMARY TAB ==================== */}
                {primaryTab === "tasks" && (
                    <>
                        {/* Current task list sub-tab */}
                        {taskSubTab === "current" && (
                            <>
                                <TaskFilters
                                    statusFilter={statusFilter}
                                    priorityFilter={priorityFilter}
                                    sortBy={sortBy}
                                    onStatusFilterChange={setStatusFilter}
                                    onPriorityFilterChange={setPriorityFilter}
                                    onSortChange={setSortBy}
                                />

                                <ExecutionBar
                                    isActive={executionMode}
                                    activeMode={activeBarMode}
                                    onActivate={() => { setExecutionMode(true); setActiveBarMode('execute'); }}
                                    onActivateOrchestrate={() => { setExecutionMode(true); setActiveBarMode('orchestrate'); }}
                                    onCancel={handleCancelExecution}
                                    onExecute={handleBatchExecute}
                                    onOrchestrate={handleBatchOrchestrate}
                                    selectedCount={selectedForExecution.size}
                                    selectedTasks={regularTasks.filter(t => selectedForExecution.has(t.id))}
                                    projectId={projectId}
                                    teamMembers={teamMembers}
                                />

                                {sortBy === "custom" ? (
                                    loading ? (
                                        <div className="terminalContent">
                                            <div className="terminalLoadingState">
                                                <div className="terminalSpinner">
                                                    <span className="terminalSpinnerDot">●</span>
                                                    <span className="terminalSpinnerDot">●</span>
                                                    <span className="terminalSpinnerDot">●</span>
                                                </div>
                                                <p className="terminalLoadingText">
                                                    <span className="terminalCursor">█</span> Loading tasks...
                                                </p>
                                            </div>
                                        </div>
                                    ) : activeRoots.length === 0 ? (
                                        <TaskTabContent
                                            loading={false}
                                            emptyMessage="NO TASKS IN QUEUE"
                                            emptySubMessage="$ maestro new task"
                                            roots={[]}
                                            renderTaskNode={renderTaskNode}
                                            showNewTaskButton
                                            onNewTask={() => setShowCreateModal(true)}
                                        />
                                    ) : (
                                        <div className="terminalContent">
                                            <SortableTaskList
                                                roots={activeRoots}
                                                renderTaskNode={renderTaskNode}
                                                onReorder={handleTaskReorder}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <TaskTabContent
                                        loading={loading}
                                        emptyMessage="NO TASKS IN QUEUE"
                                        emptySubMessage="$ maestro new task"
                                        roots={activeRoots}
                                        renderTaskNode={renderTaskNode}
                                        showNewTaskButton
                                        onNewTask={() => setShowCreateModal(true)}
                                    />
                                )}
                            </>
                        )}

                        {/* Pinned sub-tab */}
                        {taskSubTab === "pinned" && (
                            <TaskTabContent
                                loading={loading}
                                emptyMessage="NO PINNED TASKS"
                                emptySubMessage="Pin tasks you run frequently"
                                roots={pinnedRoots}
                                renderTaskNode={renderTaskNode}
                            />
                        )}

                        {/* Completed sub-tab */}
                        {taskSubTab === "completed" && (
                            <TaskTabContent
                                loading={loading}
                                emptyMessage="NO COMPLETED TASKS YET"
                                emptySubMessage="Tasks will appear here when"
                                roots={completedRoots}
                                renderTaskNode={renderTaskNode}
                                listClassName="terminalTaskListCompleted"
                            />
                        )}

                        {/* Archived sub-tab */}
                        {taskSubTab === "archived" && (
                            <TaskTabContent
                                loading={loading}
                                emptyMessage="NO ARCHIVED TASKS"
                                emptySubMessage="Archived tasks will appear here"
                                roots={archivedRoots}
                                renderTaskNode={renderTaskNode}
                                listClassName="terminalTaskListArchived"
                                showPermanentDelete
                            />
                        )}
                    </>
                )}

                {/* ==================== SKILLS PRIMARY TAB ==================== */}
                {primaryTab === "skills" && (
                    <SkillsPanel project={project} />
                )}

                {/* ==================== TEAM PRIMARY TAB ==================== */}
                {primaryTab === "team" && (
                    <>
                        {/* Members sub-tab */}
                        {teamSubTab === "members" && (
                            <>
                                <div className="terminalContent">
                                    {teamMembersLoading && teamMembers.length === 0 ? (
                                        <div className="terminalLoadingState">
                                            <div className="terminalSpinner">
                                                <span className="terminalSpinnerDot">●</span>
                                                <span className="terminalSpinnerDot">●</span>
                                                <span className="terminalSpinnerDot">●</span>
                                            </div>
                                            <p className="terminalLoadingText">
                                                <span className="terminalCursor">█</span> Loading team members...
                                            </p>
                                        </div>
                                    ) : (
                                        <TeamMemberList
                                            teamMembers={teamMembers}
                                            onEdit={handleEditTeamMember}
                                            onArchive={handleArchiveTeamMember}
                                            onUnarchive={handleUnarchiveTeamMember}
                                            onDelete={handleDeleteTeamMember}
                                            onNewMember={() => setShowCreateTeamMemberModal(true)}
                                            onRun={handleRunTeamMember}
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {/* Pinned team sub-tab - TODO: implement pinned feature */}
                        {teamSubTab === "pinned" && (
                            <div className="terminalContent">
                                <div className="terminalEmptyState">
                                    <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       PINNED COMING SOON              ║
    ║                                       ║
    ║    Pin team members for quick         ║
    ║    access                             ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                    `}</pre>
                                </div>
                            </div>
                        )}

                        {/* Archived team sub-tab - handled by TeamMemberList component */}
                        {teamSubTab === "archived" && (
                            <div className="terminalContent">
                                <div className="terminalEmptyState">
                                    <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       ARCHIVED TAB DEPRECATED         ║
    ║                                       ║
    ║    Archived members now appear        ║
    ║    in the Members tab                 ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                    `}</pre>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <CreateTaskModal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setSubtaskParentId(null);
                }}
                onCreate={handleCreateTask}
                project={project}
                parentId={subtaskParentId ?? undefined}
                parentTitle={subtaskParentTitle}
            />

            <CreateTeamMemberModal
                isOpen={showCreateTeamMemberModal}
                onClose={() => setShowCreateTeamMemberModal(false)}
                projectId={projectId}
            />

            <EditTeamMemberModal
                isOpen={showEditTeamMemberModal}
                onClose={() => {
                    setShowEditTeamMemberModal(false);
                    setEditingTeamMember(null);
                }}
                teamMember={editingTeamMember}
                projectId={projectId}
            />

            {selectedTask && showDetailModal && (
                <CreateTaskModal
                    isOpen={showDetailModal}
                    mode="edit"
                    task={selectedTask}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedTaskId(null);
                    }}
                    onCreate={handleCreateTask}
                    project={project}
                    onUpdateTask={async (taskId, updates) => {
                        await updateTask(taskId, updates);
                    }}
                    onAddSubtask={(title: string) => handleAddSubtask(selectedTask.id)}
                    onToggleSubtask={(subtaskId: string) => handleToggleSubtask(selectedTask.id, subtaskId)}
                    onDeleteSubtask={(subtaskId: string) => handleDeleteSubtask(selectedTask.id, subtaskId)}
                    onWorkOn={() => handleWorkOnTask(selectedTask)}
                    onNavigateToTask={(taskId: string) => {
                        setSelectedTaskId(taskId);
                    }}
                    onJumpToSession={(sessionId: string) => onJumpToSession?.(sessionId)}
                    onWorkOnSubtask={(subtask: MaestroTask) => handleWorkOnTask(subtask)}
                    selectedAgentId={selectedAgentByTask[selectedTask.id] || 'claude'}
                    onAgentSelect={(agentId) => handleAgentSelect(selectedTask.id, agentId)}
                />
            )}

            {showBoard && (
                <Board
                    focusProjectId={projectId}
                    onClose={() => setShowBoard(false)}
                    onSelectTask={(taskId, _projectId) => {
                        setSelectedTaskId(taskId);
                        setShowDetailModal(true);
                    }}
                    onUpdateTaskStatus={(taskId, status) => {
                        void handleUpdateTask(taskId, { status });
                    }}
                    onWorkOnTask={(task, _project) => handleWorkOnTask(task)}
                    onCreateMaestroSession={onCreateMaestroSession}
                />
            )}

        </>
    );
});
