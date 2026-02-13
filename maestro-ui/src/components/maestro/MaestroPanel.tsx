import React, { useMemo, useEffect, useRef } from "react";
import { MaestroTask, MaestroProject, TaskTreeNode, WorkerStrategy, OrchestratorStrategy } from "../../app/types/maestro";
import { TaskListItem } from "./TaskListItem";
import { TaskFilters } from "./TaskFilters";
import { CreateTaskModal } from "./CreateTaskModal";
import { ExecutionBar } from "./ExecutionBar";
import { AddSubtaskInput } from "./AddSubtaskInput";
import { useTasks } from "../../hooks/useTasks";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useTaskTree } from "../../hooks/useTaskTree";
import { useUIStore } from "../../stores/useUIStore";
import { TaskBoardOverlay } from "./TaskBoardOverlay";

type PanelTab = "tasks" | "pinned" | "completed" | "archived";

type MaestroPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    project: MaestroProject;
    onCreateMaestroSession: (input: { task?: MaestroTask; tasks?: MaestroTask[]; project: MaestroProject; skillIds?: string[]; strategy?: WorkerStrategy; role?: 'worker' | 'orchestrator'; orchestratorStrategy?: OrchestratorStrategy }) => Promise<any>;
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

    const [activeTab, setActiveTab] = React.useState<PanelTab>("tasks");
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
            <div className="maestroPanel terminalTheme">
                <div className="terminalWindowChrome">
                    <div className="terminalWindowButtons">
                        <span className="terminalWindowBtn terminalWindowBtnClose" onClick={onClose}>●</span>
                        <span className="terminalWindowBtn terminalWindowBtnMinimize">●</span>
                        <span className="terminalWindowBtn terminalWindowBtnMaximize">●</span>
                    </div>
                    <div className="terminalWindowTitle">
                        <span className="terminalPromptSymbol">❯</span>
                        maestro-agent [ERROR]
                    </div>
                    <div className="terminalWindowSpacer"></div>
                </div>
                <div className="terminalContent">
                    <div className="terminalErrorState">
                        <pre className="terminalErrorAscii">{`
    ╔═══════════════════════════════════════╗
    ║     ⚠️  FATAL ERROR                   ║
    ╚═══════════════════════════════════════╝
                        `}</pre>
                        <div className="terminalErrorBox">
                            <span className="terminalErrorLabel">[TRACEBACK]</span>
                            <pre className="terminalErrorMessage">{componentError.message}</pre>
                        </div>
                        <p className="terminalErrorHint">
                            → Check DevTools console (Cmd+Option+I) for stack trace
                        </p>
                        <button
                            className="terminalCmd terminalCmdPrimary"
                            onClick={() => setComponentError(null)}
                        >
                            <span className="terminalPrompt">$</span> retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isOpen) return null;

    // Show message if no project is selected
    if (!projectId) {
        return (
            <div className="maestroPanel terminalTheme">
                <div className="terminalWindowChrome">
                    <div className="terminalWindowButtons">
                        <span className="terminalWindowBtn terminalWindowBtnClose" onClick={onClose}>●</span>
                        <span className="terminalWindowBtn terminalWindowBtnMinimize">●</span>
                        <span className="terminalWindowBtn terminalWindowBtnMaximize">●</span>
                    </div>
                    <div className="terminalWindowTitle">
                        <span className="terminalPromptSymbol">❯</span>
                        maestro-agent [IDLE]
                    </div>
                    <div className="terminalWindowSpacer"></div>
                </div>
                <div className="terminalContent">
                    <div className="terminalEmptyState">
                        <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        NO PROJECT LOADED              ║
    ║                                       ║
    ║     Please select or create a         ║
    ║     project to use Maestro            ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                        `}</pre>
                    </div>
                </div>
            </div>
        );
    }

    // Build task tree for hierarchical display
    const { roots, getChildren } = useTaskTree(normalizedTasks);

    // Search all tasks (not just roots) so subtasks can be selected
    const selectedTask = normalizedTasks.find((t) => t.id === selectedTaskId);

    const filteredTasks = normalizedTasks
        .filter((task) => statusFilter.length === 0 || statusFilter.includes(task.status))
        .filter((task) => priorityFilter.length === 0 || priorityFilter.includes(task.priority))
        .sort((a, b) => {
            if (sortBy === "priority") {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return b[sortBy] - a[sortBy];
        });

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
            // Task will be updated via WebSocket event
        } catch (err: any) {
            console.error("[Maestro] Failed to update task:", err);
            setError("Failed to update task");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await deleteTask(taskId);
            // Task will be removed via WebSocket event
        } catch (err: any) {
            console.error("[Maestro] Failed to delete task:", err);
            setError("Failed to delete task");
        }
    };

    const handleRemoveTaskFromSession = async (sessionId: string, taskId: string) => {
        try {
            await removeTaskFromSession(sessionId, taskId);
            // Task/Session update will come via WebSocket
        } catch (err: any) {
            console.error("[Maestro] Failed to remove task from session:", err);
            setError("Failed to remove task from session");
        }
    };

    const handleWorkOnTask = async (task: MaestroTask) => {
        // Directly execute task with 'simple' worker strategy
        console.log('[MaestroPanel.handleWorkOnTask] ========================================');
        console.log('[MaestroPanel.handleWorkOnTask] Starting work on task');
        console.log('[MaestroPanel.handleWorkOnTask] Task ID:', task.id);
        console.log('[MaestroPanel.handleWorkOnTask] Role: worker');
        console.log('[MaestroPanel.handleWorkOnTask] Strategy: simple');
        console.log('[MaestroPanel.handleWorkOnTask] ========================================');

        try {
            // Get selected agent for this task (default to claude)
            const selectedAgentId = selectedAgentByTask[task.id] || 'claude';
            console.log('[MaestroPanel.handleWorkOnTask] Selected agent:', selectedAgentId);

            // Create Maestro session with simple worker strategy
            await onCreateMaestroSession({
                task,
                project,
                skillIds: [selectedAgentId],
                strategy: 'simple',
                role: 'worker',
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
        const selectedTasks = normalizedTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                role: 'orchestrator',
                orchestratorStrategy,
                skillIds: ['maestro-orchestrator'],
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
            // Has children: toggle collapse
            handleToggleCollapse(taskId);
        } else {
            // No children: toggle inline input
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

    // Apply filters/sort to roots only for hierarchical display
    // Separate active tasks (non-completed) from completed tasks
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
            // Sort by completion time, most recent first
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
                {!isCollapsed && node.children.map(child => renderTaskNode(child, depth + 1))}
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
                {/* Tab navigation */}
                <div className="maestroPanelTabs">
                    <button
                        className={`maestroPanelTab ${activeTab === "tasks" ? "maestroPanelTabActive" : ""}`}
                        onClick={() => setActiveTab("tasks")}
                    >
                        <span className="maestroPanelTabIcon">▸</span>
                        Tasks
                        <span className="maestroPanelTabCount">
                            {normalizedTasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length}
                        </span>
                    </button>
                    <button
                        className={`maestroPanelTab ${activeTab === "pinned" ? "maestroPanelTabActive" : ""}`}
                        onClick={() => setActiveTab("pinned")}
                    >
                        <span className="maestroPanelTabIcon">▸</span>
                        Pinned
                        <span className="maestroPanelTabCount">
                            {normalizedTasks.filter(t => t.pinned).length}
                        </span>
                    </button>
                    <button
                        className={`maestroPanelTab ${activeTab === "completed" ? "maestroPanelTabActive" : ""}`}
                        onClick={() => setActiveTab("completed")}
                    >
                        <span className="maestroPanelTabIcon">▸</span>
                        Completed
                        <span className="maestroPanelTabCount">
                            {normalizedTasks.filter(t => t.status === 'completed').length}
                        </span>
                    </button>
                    <button
                        className={`maestroPanelTab ${activeTab === "archived" ? "maestroPanelTabActive" : ""}`}
                        onClick={() => setActiveTab("archived")}
                    >
                        <span className="maestroPanelTabIcon">▸</span>
                        Archived
                        <span className="maestroPanelTabCount">
                            {normalizedTasks.filter(t => t.status === 'archived').length}
                        </span>
                    </button>
                </div>

                {(error || fetchError) && activeTab === "tasks" && (
                    <div className="terminalErrorBanner">
                        <span className="terminalErrorSymbol">[ERROR]</span>
                        <span className="terminalErrorText">{error || fetchError}</span>
                        <button className="terminalErrorClose" onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Tasks Tab */}
                {activeTab === "tasks" && (
                    <>
                {/* Terminal command bar */}
                <div className="terminalCommandBar">
                    <div className="terminalCommands">
                        <button
                            className="terminalCmd terminalCmdPrimary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <span className="terminalPrompt">$</span> new task
                        </button>
                        <button
                            className="terminalCmd"
                            onClick={async () => {
                                if (!projectId) return;
                                setError(null);
                                try {
                                    await hardRefresh(projectId);
                                } catch (err) {
                                    console.error('[MaestroPanel] Hard refresh failed:', err);
                                    setError("Failed to refresh");
                                }
                            }}
                            disabled={loading || !projectId}
                        >
                            <span className="terminalPrompt">$</span> refresh
                        </button>
                        <button
                            className="terminalCmd"
                            onClick={() => setShowBoard(true)}
                            disabled={loading || !projectId}
                        >
                            <span className="terminalPrompt">$</span> board
                        </button>
                    </div>
                    <div className="terminalStats">
                        <span className="terminalStat terminalStatActive">
                            ◉ {normalizedTasks.filter((t) => t.status === "in_progress").length}
                        </span>
                        <span className="terminalStat terminalStatPending">
                            ○ {normalizedTasks.filter((t) => t.status === "todo").length}
                        </span>
                        <span className="terminalStat terminalStatReview">
                            ◎ {normalizedTasks.filter((t) => t.status === "in_review").length}
                        </span>
                        <span className="terminalStat terminalStatDone">
                            ✓ {normalizedTasks.filter((t) => t.status === "completed").length}
                        </span>
                    </div>
                </div>

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
                    selectedTasks={normalizedTasks.filter(t => selectedForExecution.has(t.id))}
                    projectId={projectId}
                />

                <div className="terminalContent">
                    {loading ? (
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
                    ) : activeRoots.length === 0 ? (
                        <div className="terminalEmptyState">
                            <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        NO TASKS IN QUEUE              ║
    ║                                       ║
    ║        $ maestro new task             ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                            `}</pre>
                            <button
                                className="terminalCmd terminalCmdPrimary"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <span className="terminalPrompt">$</span> new task
                            </button>
                        </div>
                    ) : (
                        <div className="terminalTaskList">
                            {/* Task list header - like ls -l */}
                            <div className="terminalTaskHeader">
                                <span>STATUS</span>
                                <span>TASK</span>
                                <span>AGENT</span>
                                <span>ACTIONS</span>
                            </div>
                            {activeRoots.map(node => renderTaskNode(node, 0))}
                        </div>
                    )}
                </div>
                    </>
                )}

                {/* Pinned Tab */}
                {activeTab === "pinned" && (
                    <div className="terminalContent">
                        {loading ? (
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
                        ) : pinnedRoots.length === 0 ? (
                            <div className="terminalEmptyState">
                                <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO PINNED TASKS                 ║
    ║                                       ║
    ║    Pin tasks you run frequently       ║
    ║    for quick access                   ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                `}</pre>
                            </div>
                        ) : (
                            <div className="terminalTaskList">
                                <div className="terminalTaskHeader">
                                    <span>STATUS</span>
                                    <span>TASK</span>
                                    <span>AGENT</span>
                                    <span>ACTIONS</span>
                                </div>
                                {pinnedRoots.map(node => renderTaskNode(node, 0))}
                            </div>
                        )}
                    </div>
                )}

                {/* Completed Tab */}
                {activeTab === "completed" && (
                    <div className="terminalContent">
                        {loading ? (
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
                        ) : completedRoots.length === 0 ? (
                            <div className="terminalEmptyState">
                                <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║      NO COMPLETED TASKS YET           ║
    ║                                       ║
    ║    Tasks will appear here when        ║
    ║    marked as completed                ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                `}</pre>
                            </div>
                        ) : (
                            <div className="terminalTaskList terminalTaskListCompleted">
                                {/* Task list header */}
                                <div className="terminalTaskHeader">
                                    <span>STATUS</span>
                                    <span>TASK</span>
                                    <span>AGENT</span>
                                    <span>ACTIONS</span>
                                </div>
                                {completedRoots.map(node => renderTaskNode(node, 0))}
                            </div>
                        )}
                    </div>
                )}

                {/* Archived Tab */}
                {activeTab === "archived" && (
                    <div className="terminalContent">
                        {loading ? (
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
                        ) : archivedRoots.length === 0 ? (
                            <div className="terminalEmptyState">
                                <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO ARCHIVED TASKS               ║
    ║                                       ║
    ║    Archived tasks will appear here    ║
    ║    You can permanently delete them    ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                `}</pre>
                            </div>
                        ) : (
                            <div className="terminalTaskList terminalTaskListArchived">
                                <div className="terminalTaskHeader">
                                    <span>STATUS</span>
                                    <span>TASK</span>
                                    <span>AGENT</span>
                                    <span>ACTIONS</span>
                                </div>
                                {archivedRoots.map(node => renderTaskNode(node, 0, { showPermanentDelete: true }))}
                            </div>
                        )}
                    </div>
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
                <TaskBoardOverlay
                    tasks={normalizedTasks}
                    projectName={project.name}
                    onClose={() => setShowBoard(false)}
                    onSelectTask={(taskId) => {
                        setSelectedTaskId(taskId);
                        setShowDetailModal(true);
                    }}
                    onUpdateTaskStatus={(taskId, status) => {
                        void handleUpdateTask(taskId, { status });
                    }}
                    onWorkOnTask={handleWorkOnTask}
                />
            )}

        </>
    );
});

