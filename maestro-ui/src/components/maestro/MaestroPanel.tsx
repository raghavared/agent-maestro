import React, { useMemo, useEffect, useRef } from "react";
import { MaestroTask, MaestroProject, TaskTreeNode, WorkerStrategy, OrchestratorStrategy } from "../../app/types/maestro";
import { TaskListItem } from "./TaskListItem";
import { TaskFilters } from "./TaskFilters";
import { CreateTaskModal } from "./CreateTaskModal";
import { ExecutionBar } from "./ExecutionBar";
import { AddSubtaskInput } from "./AddSubtaskInput";
import { TeamMemberList } from "./TeamMemberList";
import { PanelIconBar, PrimaryTab, TaskSubTab, SkillSubTab, TeamSubTab } from "./PanelIconBar";
import { CommandBar } from "./CommandBar";
import { TaskTabContent } from "./TaskTabContent";
import { PanelErrorState, NoProjectState } from "./PanelErrorState";
import { useTasks } from "../../hooks/useTasks";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useTaskTree } from "../../hooks/useTaskTree";
import { useUIStore } from "../../stores/useUIStore";
import { Board } from "./MultiProjectBoard";

// Tab types are imported from PanelIconBar

type MaestroPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    project: MaestroProject;
    onCreateMaestroSession: (input: { task?: MaestroTask; tasks?: MaestroTask[]; project: MaestroProject; skillIds?: string[]; strategy?: string; mode?: 'execute' | 'coordinate'; teamMemberIds?: string[] }) => Promise<any>;
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

    // ==================== UI STATE ====================

    const [primaryTab, setPrimaryTab] = React.useState<PrimaryTab>("tasks");
    const [taskSubTab, setTaskSubTab] = React.useState<TaskSubTab>("active");
    const [skillSubTab, setSkillSubTab] = React.useState<SkillSubTab>("browse");
    const [teamSubTab, setTeamSubTab] = React.useState<TeamSubTab>("members");
    const [componentError, setComponentError] = React.useState<Error | null>(null);
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
    const [statusFilter, setStatusFilter] = React.useState<MaestroTask["status"][]>([]);
    const [priorityFilter, setPriorityFilter] = React.useState<MaestroTask["priority"][]>([]);
    const [sortBy, setSortBy] = React.useState<"updatedAt" | "createdAt" | "priority">("updatedAt");
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
    const [selectedTeamMembers, setSelectedTeamMembers] = React.useState<Set<string>>(new Set());
    const [showTeamMembers, setShowTeamMembers] = React.useState(false);

    // Listen for global create-task shortcut trigger
    const createTaskRequested = useUIStore(s => s.createTaskRequested);
    useEffect(() => {
        if (createTaskRequested) {
            setShowCreateModal(true);
            useUIStore.getState().setCreateTaskRequested(false);
        }
    }, [createTaskRequested]);

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

    // Separate team members from regular tasks
    const teamMembers = useMemo(() => {
        return normalizedTasks.filter(t => t.taskType === 'team-member');
    }, [normalizedTasks]);

    const regularTasks = useMemo(() => {
        return normalizedTasks.filter(t => t.taskType !== 'team-member');
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
                model: taskData.model,
                agentTool: taskData.agentTool,
                ...(taskData.taskType ? { taskType: taskData.taskType } : {}),
                ...(taskData.teamMemberMetadata ? { teamMemberMetadata: taskData.teamMemberMetadata } : {}),
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

    const handleWorkOnTask = async (task: MaestroTask) => {
        console.log('[MaestroPanel.handleWorkOnTask] ========================================');
        console.log('[MaestroPanel.handleWorkOnTask] Starting work on task');
        console.log('[MaestroPanel.handleWorkOnTask] Task ID:', task.id);
        console.log('[MaestroPanel.handleWorkOnTask] Mode: execute');
        console.log('[MaestroPanel.handleWorkOnTask] Strategy: simple');
        console.log('[MaestroPanel.handleWorkOnTask] ========================================');

        try {
            const selectedAgentId = selectedAgentByTask[task.id] || 'claude';
            console.log('[MaestroPanel.handleWorkOnTask] Selected agent:', selectedAgentId);

            await onCreateMaestroSession({
                task,
                project,
                skillIds: [selectedAgentId],
                strategy: 'simple',
                mode: 'execute',
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

    const handleBatchExecute = async (strategy: WorkerStrategy) => {
        const selectedTasks = normalizedTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                strategy,
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
        } catch (err: any) {
            console.error('[MaestroPanel] Failed to create batch session:', err);
            setError(`Failed to create session: ${err.message}`);
        }
    };

    const handleBatchOrchestrate = async (orchestratorStrategy: OrchestratorStrategy) => {
        const selectedTasks = regularTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        const teamMemberIds = Array.from(selectedTeamMembers);

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                mode: 'coordinate',
                strategy: orchestratorStrategy,
                skillIds: ['maestro-orchestrator'],
                teamMemberIds: teamMemberIds.length > 0 ? teamMemberIds : undefined,
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
            setSelectedTeamMembers(new Set());
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

    const activeRoots = roots
        .filter((node) => node.status !== 'completed' && node.status !== 'archived')
        .filter((node) => statusFilter.length === 0 || statusFilter.includes(node.status))
        .filter((node) => priorityFilter.length === 0 || priorityFilter.includes(node.priority))
        .sort((a, b) => {
            if (sortBy === "priority") {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return b[sortBy] - a[sortBy];
        });

    const completedRoots = roots
        .filter((node) => node.status === 'completed')
        .sort((a, b) => {
            return (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt);
        });

    const pinnedRoots = roots
        .filter((node) => node.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const archivedRoots = roots
        .filter((node) => node.status === 'archived')
        .sort((a, b) => b.updatedAt - a.updatedAt);

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
                    onRefresh={async () => {
                        if (!projectId) return;
                        setError(null);
                        try {
                            await hardRefresh(projectId);
                        } catch (err) {
                            console.error('[MaestroPanel] Hard refresh failed:', err);
                            setError("Failed to refresh");
                        }
                    }}
                    onShowBoard={() => setShowBoard(true)}
                    loading={loading}
                    projectId={projectId}
                />

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
                        {/* Active / New Task sub-tab */}
                        {taskSubTab === "active" && (
                            <>
                                <CommandBar
                                    onNewTask={() => setShowCreateModal(true)}
                                    loading={loading}
                                    projectId={projectId}
                                    tasks={normalizedTasks}
                                />

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
                                    onActivateOrchestrate={() => { setExecutionMode(true); setActiveBarMode('orchestrate'); setShowTeamMembers(true); }}
                                    onCancel={handleCancelExecution}
                                    onExecute={handleBatchExecute}
                                    onOrchestrate={handleBatchOrchestrate}
                                    selectedCount={selectedForExecution.size}
                                    selectedTasks={regularTasks.filter(t => selectedForExecution.has(t.id))}
                                    projectId={projectId}
                                    teamMemberCount={selectedTeamMembers.size}
                                />

                                {activeBarMode === 'orchestrate' && showTeamMembers && teamMembers.length > 0 && (
                                    <TeamMemberList
                                        teamMembers={teamMembers}
                                        selectedIds={selectedTeamMembers}
                                        onToggleSelect={(id) => {
                                            setSelectedTeamMembers(prev => {
                                                const next = new Set(prev);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                        }}
                                        onSelectAll={() => setSelectedTeamMembers(new Set(teamMembers.map(m => m.id)))}
                                        onDeselectAll={() => setSelectedTeamMembers(new Set())}
                                    />
                                )}

                                <TaskTabContent
                                    loading={loading}
                                    emptyMessage="NO TASKS IN QUEUE"
                                    emptySubMessage="$ maestro new task"
                                    roots={activeRoots}
                                    renderTaskNode={renderTaskNode}
                                    showNewTaskButton
                                    onNewTask={() => setShowCreateModal(true)}
                                />
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
                    <div className="terminalContent">
                        <div className="terminalEmptyState">
                            <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        SKILLS COMING SOON             ║
    ║                                       ║
    ║    Create, browse, and manage         ║
    ║    reusable skill configurations      ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                            `}</pre>
                        </div>
                    </div>
                )}

                {/* ==================== TEAM PRIMARY TAB ==================== */}
                {primaryTab === "team" && (
                    <>
                        {/* Members sub-tab */}
                        {teamSubTab === "members" && (
                            <div className="terminalContent">
                                <div className="terminalCommandBar">
                                    <div className="terminalCommands">
                                        <button
                                            className="terminalCmd terminalCmdPrimary"
                                            onClick={() => setShowCreateTeamMemberModal(true)}
                                        >
                                            <span className="terminalPrompt">$</span> add team member
                                        </button>
                                    </div>
                                    <div className="terminalStats">
                                        <span className="terminalStat terminalStatActive">
                                            ◉ {teamMembers.filter(t => t.status !== 'archived').length}
                                        </span>
                                    </div>
                                </div>
                                {teamMembers.filter(t => t.status !== 'archived').length === 0 ? (
                                    <div className="terminalEmptyState">
                                        <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        NO TEAM MEMBERS                ║
    ║                                       ║
    ║    Add team members to use in         ║
    ║    orchestration mode                 ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                        `}</pre>
                                        <button
                                            className="terminalCmd terminalCmdPrimary"
                                            onClick={() => setShowCreateTeamMemberModal(true)}
                                        >
                                            <span className="terminalPrompt">$</span> add team member
                                        </button>
                                    </div>
                                ) : (
                                    <TeamMemberList
                                        teamMembers={teamMembers.filter(t => t.status !== 'archived')}
                                        selectedIds={selectedTeamMembers}
                                        onToggleSelect={(id) => {
                                            setSelectedTeamMembers(prev => {
                                                const next = new Set(prev);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                        }}
                                        onSelectAll={() => setSelectedTeamMembers(new Set(teamMembers.map(m => m.id)))}
                                        onDeselectAll={() => setSelectedTeamMembers(new Set())}
                                    />
                                )}
                            </div>
                        )}

                        {/* Pinned team sub-tab */}
                        {teamSubTab === "pinned" && (
                            <div className="terminalContent">
                                {teamMembers.filter(t => t.pinned).length === 0 ? (
                                    <div className="terminalEmptyState">
                                        <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO PINNED TEAM MEMBERS          ║
    ║                                       ║
    ║    Pin team members for quick         ║
    ║    access                             ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                        `}</pre>
                                    </div>
                                ) : (
                                    <TeamMemberList
                                        teamMembers={teamMembers.filter(t => t.pinned)}
                                        selectedIds={selectedTeamMembers}
                                        onToggleSelect={(id) => {
                                            setSelectedTeamMembers(prev => {
                                                const next = new Set(prev);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                        }}
                                        onSelectAll={() => {}}
                                        onDeselectAll={() => setSelectedTeamMembers(new Set())}
                                    />
                                )}
                            </div>
                        )}

                        {/* Archived team sub-tab */}
                        {teamSubTab === "archived" && (
                            <div className="terminalContent">
                                {teamMembers.filter(t => t.status === 'archived').length === 0 ? (
                                    <div className="terminalEmptyState">
                                        <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO ARCHIVED TEAM MEMBERS        ║
    ║                                       ║
    ║    Archived members will appear       ║
    ║    here                               ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                        `}</pre>
                                    </div>
                                ) : (
                                    <TeamMemberList
                                        teamMembers={teamMembers.filter(t => t.status === 'archived')}
                                        selectedIds={selectedTeamMembers}
                                        onToggleSelect={(id) => {
                                            setSelectedTeamMembers(prev => {
                                                const next = new Set(prev);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                        }}
                                        onSelectAll={() => {}}
                                        onDeselectAll={() => setSelectedTeamMembers(new Set())}
                                    />
                                )}
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

            <CreateTaskModal
                isOpen={showCreateTeamMemberModal}
                onClose={() => setShowCreateTeamMemberModal(false)}
                onCreate={handleCreateTask}
                project={project}
                taskType="team-member"
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
