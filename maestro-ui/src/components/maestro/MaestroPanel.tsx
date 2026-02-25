import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { MaestroTask, MaestroProject, TaskTreeNode, WorkerStrategy, OrchestratorStrategy, AgentTool, ModelType, MemberLaunchOverride, AgentModeInput } from "../../app/types/maestro";
import { TaskListItem } from "./TaskListItem";
import { TaskFilters, SortByOption } from "./TaskFilters";
import { SortableTaskList } from "./SortableTaskList";
import { CreateTaskModal } from "./CreateTaskModal";
import { ExecutionBar } from "./ExecutionBar";
import { AddSubtaskInput } from "./AddSubtaskInput";
import { PanelIconBar, PrimaryTab, TaskSubTab, SkillSubTab, TeamSubTab } from "./PanelIconBar";
import { TaskTabContent } from "./TaskTabContent";
import { PanelErrorState, NoProjectState } from "./PanelErrorState";
import { useTaskSearch } from "../../hooks/useTaskSearch";
import { useTasks } from "../../hooks/useTasks";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTaskTree } from "../../hooks/useTaskTree";
import { useUIStore } from "../../stores/useUIStore";
import { Board } from "./MultiProjectBoard";
import { SkillsPanel } from "./SkillsPanel";
import { TaskListsPanel } from "./TaskListsPanel";
import { useTaskLists } from "../../hooks/useTaskLists";

// Extracted hooks
import { useExecutionMode } from "../../hooks/useExecutionMode";
import { useTeamMemberActions } from "../../hooks/useTeamMemberActions";
import { useTeamActions } from "../../hooks/useTeamActions";

// Extracted panels
import { TeamMembersPanel } from "./panels/TeamMembersPanel";
import { TeamsPanel } from "./panels/TeamsPanel";

type MaestroPanelProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    project: MaestroProject;
    onCreateMaestroSession: (input: { task?: MaestroTask; tasks?: MaestroTask[]; project: MaestroProject; skillIds?: string[]; strategy?: WorkerStrategy | OrchestratorStrategy; mode?: AgentModeInput; teamMemberIds?: string[]; teamMemberId?: string; delegateTeamMemberIds?: string[]; agentTool?: AgentTool; model?: ModelType; memberOverrides?: Record<string, MemberLaunchOverride> }) => Promise<any>;
    onJumpToSession?: (maestroSessionId: string) => void;
    onAddTaskToSession?: (taskId: string) => void;
    forcedPrimaryTab?: PrimaryTab;
    forcedTeamSubTab?: TeamSubTab;
};

export const MaestroPanel = React.memo(function MaestroPanel({
    isOpen,
    onClose,
    projectId,
    project,
    onCreateMaestroSession,
    onJumpToSession,
    onAddTaskToSession,
    forcedPrimaryTab,
    forcedTeamSubTab,
}: MaestroPanelProps) {

    // ==================== CORE DATA ====================

    const { tasks, loading, error: fetchError } = useTasks(projectId);
    const createTask = useMaestroStore(s => s.createTask);
    const updateTask = useMaestroStore(s => s.updateTask);
    const deleteTask = useMaestroStore(s => s.deleteTask);
    const removeTaskFromSession = useMaestroStore(s => s.removeTaskFromSession);
    const taskOrdering = useMaestroStore(s => s.taskOrdering);
    const fetchTaskOrdering = useMaestroStore(s => s.fetchTaskOrdering);
    const saveTaskOrdering = useMaestroStore(s => s.saveTaskOrdering);
    const createTeam = useMaestroStore(s => s.createTeam);

    const { taskLists: taskListArray } = useTaskLists(projectId);

    // Session task highlighting
    const activeTerminalId = useSessionStore(s => s.activeId);
    const terminalSessions = useSessionStore(s => s.sessions);
    const maestroSessions = useMaestroStore(s => s.sessions);

    const currentSessionTaskIds = useMemo(() => {
        const terminal = terminalSessions.find(s => s.id === activeTerminalId);
        if (!terminal?.maestroSessionId) return new Set<string>();
        const maestroSession = maestroSessions.get(terminal.maestroSessionId);
        return new Set(maestroSession?.taskIds || []);
    }, [activeTerminalId, terminalSessions, maestroSessions]);

    // ==================== UI STATE ====================

    const [internalPrimaryTab, setInternalPrimaryTab] = React.useState<PrimaryTab>("tasks");
    const [taskSubTab, setTaskSubTab] = React.useState<TaskSubTab>("current");
    const [skillSubTab, setSkillSubTab] = React.useState<SkillSubTab>("browse");
    const [internalTeamSubTab, setInternalTeamSubTab] = React.useState<TeamSubTab>("members");
    const primaryTab = forcedPrimaryTab ?? internalPrimaryTab;
    const setPrimaryTab = forcedPrimaryTab ? () => {} : setInternalPrimaryTab;
    const teamSubTab = forcedTeamSubTab ?? internalTeamSubTab;
    const setTeamSubTab = forcedTeamSubTab ? () => {} : setInternalTeamSubTab;

    const [componentError, setComponentError] = React.useState<Error | null>(null);
    const [statusFilter, setStatusFilter] = React.useState<MaestroTask["status"][]>([]);
    const [priorityFilter, setPriorityFilter] = React.useState<MaestroTask["priority"][]>([]);
    const [sortBy, setSortBy] = React.useState<SortByOption>("custom");
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [subtaskParentId, setSubtaskParentId] = React.useState<string | null>(null);
    const [collapsedTasks, setCollapsedTasks] = React.useState<Set<string>>(new Set());
    const [addingSubtaskTo, setAddingSubtaskTo] = React.useState<string | null>(null);
    const [slidingOutTasks, setSlidingOutTasks] = React.useState<Set<string>>(new Set());
    const [showBoard, setShowBoard] = React.useState(false);
    const [taskListCreateSignal, setTaskListCreateSignal] = React.useState(0);
    const [searchQuery, setSearchQuery] = React.useState("");

    // ==================== EXTRACTED HOOKS ====================

    const normalizedTasks = useMemo(() => {
        return tasks.map(task => ({
            ...task,
            subtasks: task.subtasks || [],
            lastUpdate: task.lastUpdate || null,
            completedAt: task.completedAt || null,
        }));
    }, [tasks]);

    const regularTasks = normalizedTasks;

    const { teamMembers, teamMembersMap, teamMembersLoading, handleArchive: handleArchiveTeamMember, handleUnarchive: handleUnarchiveTeamMember, handleDelete: handleDeleteTeamMember, handleRun: handleRunTeamMember } = useTeamMemberActions(projectId, project, onCreateMaestroSession, createTask, (msg) => setError(msg));

    const { teams, activeTeams, topLevelTeams, handleRun: handleRunTeam } = useTeamActions(projectId, project, teamMembersMap, onCreateMaestroSession, createTask, (msg) => setError(msg));

    const execution = useExecutionMode(projectId, project, normalizedTasks, regularTasks, onCreateMaestroSession, createTeam, (msg) => setError(msg));

    // ==================== TASK TREE & SEARCH ====================

    const { roots } = useTaskTree(regularTasks);
    const searchMatchIds = useTaskSearch(regularTasks, searchQuery);

    const filterBySearch = useCallback((nodes: TaskTreeNode[]): TaskTreeNode[] => {
        if (!searchMatchIds) return nodes;
        const matches = (node: TaskTreeNode): boolean => {
            if (searchMatchIds.has(node.id)) return true;
            return node.children.some(child => matches(child));
        };
        return nodes.filter(node => matches(node));
    }, [searchMatchIds]);

    // ==================== EFFECTS ====================

    useEffect(() => {
        if (projectId) fetchTaskOrdering(projectId);
    }, [projectId, fetchTaskOrdering]);

    const createTaskRequested = useUIStore(s => s.createTaskRequested);
    useEffect(() => {
        if (createTaskRequested) {
            setShowCreateModal(true);
            useUIStore.getState().setCreateTaskRequested(false);
        }
    }, [createTaskRequested]);

    const showBoardRequested = useUIStore(s => s.showBoardRequested);
    useEffect(() => {
        if (showBoardRequested) {
            setShowBoard(true);
            useUIStore.getState().setShowBoardRequested(false);
        }
    }, [showBoardRequested]);

    // Slide-out animation for completed tasks
    const prevTaskStatusesRef = useRef<Map<string, string>>(new Map());
    useEffect(() => {
        const newlyCompleted: string[] = [];
        normalizedTasks.forEach(task => {
            const prevStatus = prevTaskStatusesRef.current.get(task.id);
            if (prevStatus && prevStatus !== 'completed' && prevStatus !== 'archived' &&
                (task.status === 'completed' || task.status === 'archived')) {
                newlyCompleted.push(task.id);
            }
        });
        const newStatuses = new Map<string, string>();
        normalizedTasks.forEach(task => newStatuses.set(task.id, task.status));
        prevTaskStatusesRef.current = newStatuses;

        if (newlyCompleted.length > 0) {
            setSlidingOutTasks(prev => {
                const next = new Set(prev);
                newlyCompleted.forEach(id => next.add(id));
                return next;
            });
            setTimeout(() => {
                setSlidingOutTasks(prev => {
                    const next = new Set(prev);
                    newlyCompleted.forEach(id => next.delete(id));
                    return next;
                });
            }, 500);
        }
    }, [normalizedTasks]);

    // Initialize collapsed state
    const hasInitializedCollapsedRef = useRef(false);
    useEffect(() => {
        hasInitializedCollapsedRef.current = false;
        setCollapsedTasks(new Set());
    }, [projectId]);
    useEffect(() => {
        if (!hasInitializedCollapsedRef.current && regularTasks.length > 0) {
            const parentIds = new Set<string>(
                regularTasks.filter(task => task.parentId).map(task => task.parentId as string)
            );
            if (parentIds.size > 0) {
                hasInitializedCollapsedRef.current = true;
                setCollapsedTasks(parentIds);
            }
        }
    }, [regularTasks]);

    // Move useCallback before early returns to satisfy Rules of Hooks
    const handleTaskReorder = useCallback((orderedIds: string[]) => {
        saveTaskOrdering(projectId, orderedIds);
    }, [projectId, saveTaskOrdering]);

    // ==================== EARLY RETURNS ====================

    if (componentError) {
        return <PanelErrorState error={componentError} onRetry={() => setComponentError(null)} onClose={onClose} />;
    }
    if (!isOpen) return null;
    if (!projectId) return <NoProjectState onClose={onClose} />;

    // ==================== TASK HANDLERS ====================

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
                memberOverrides: taskData.memberOverrides,
            });
            if (taskData.startImmediately) await handleWorkOnTask(newTask);
        } catch (err: any) {
            setError("Failed to create task");
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<MaestroTask>) => {
        try { await updateTask(taskId, updates); } catch { setError("Failed to update task"); }
    };

    const handleDeleteTask = async (taskId: string) => {
        try { await deleteTask(taskId); } catch { setError("Failed to delete task"); }
    };

    const handleWorkOnTask = async (task: MaestroTask, override?: { agentTool: AgentTool; model: ModelType }) => {
        const effectiveIds = task.teamMemberIds && task.teamMemberIds.length > 0
            ? task.teamMemberIds
            : task.teamMemberId ? [task.teamMemberId] : [];
        const teamMemberId = effectiveIds.length === 1 ? effectiveIds[0] : undefined;
        const teamMemberIds = effectiveIds.length > 1 ? effectiveIds : undefined;
        const member = teamMemberId ? teamMembersMap.get(teamMemberId) : null;
        const mode = member?.mode || 'worker';

        try {
            await onCreateMaestroSession({
                task, project, mode, teamMemberId, teamMemberIds,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
                ...(task.memberOverrides ? { memberOverrides: task.memberOverrides } : {}),
            });
        } catch (err: any) {
            setError(`Failed to open terminal: ${err.message}`);
        }
    };

    const handleAssignTeamMember = async (taskId: string, teamMemberId: string) => {
        try { await updateTask(taskId, { teamMemberId, teamMemberIds: [teamMemberId] }); } catch { setError("Failed to assign team member"); }
    };

    const handleAddSubtask = (parentId: string) => {
        setSubtaskParentId(parentId);
        setShowCreateModal(true);
    };

    const handleInlineAddSubtask = async (parentId: string, title: string) => {
        try {
            await createTask({ projectId, parentId, title, description: "", priority: "medium" });
            setCollapsedTasks(prev => { const next = new Set(prev); next.delete(parentId); return next; });
        } catch (err: any) {
            setError("Failed to create subtask");
            throw err;
        }
    };

    const handleToggleCollapse = (taskId: string) => {
        setCollapsedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const handleToggleAddSubtask = (taskId: string, hasChildren: boolean) => {
        if (hasChildren) handleToggleCollapse(taskId);
        else setAddingSubtaskTo(prev => prev === taskId ? null : taskId);
    };

    const handleToggleSubtask = async (_taskId: string, subtaskId: string) => {
        try {
            const subtask = normalizedTasks.find(t => t.id === subtaskId);
            if (!subtask) return;
            await updateTask(subtaskId, { status: subtask.status === 'completed' ? 'todo' : 'completed' });
        } catch { setError("Failed to toggle subtask"); }
    };

    const handleDeleteSubtask = async (_taskId: string, subtaskId: string) => {
        try { await deleteTask(subtaskId); } catch { setError("Failed to delete subtask"); }
    };

    const handleTogglePin = async (taskId: string) => {
        try {
            const task = normalizedTasks.find(t => t.id === taskId);
            if (task) await updateTask(taskId, { pinned: !task.pinned });
        } catch { setError("Failed to toggle pin"); }
    };

    // ==================== DERIVED DATA ====================

    const customOrder = taskOrdering.get(projectId) || [];

    const activeRoots = filterBySearch(roots
        .filter(n => n.status !== 'completed' && n.status !== 'archived')
        .filter(n => statusFilter.length === 0 || statusFilter.includes(n.status))
        .filter(n => priorityFilter.length === 0 || priorityFilter.includes(n.priority))
        .sort((a, b) => {
            if (sortBy === "custom") {
                const aIdx = customOrder.indexOf(a.id);
                const bIdx = customOrder.indexOf(b.id);
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

    const completedRoots = filterBySearch(roots.filter(n => n.status === 'completed').sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt)));
    const pinnedRoots = filterBySearch(roots.filter(n => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt));
    const archivedRoots = filterBySearch(roots.filter(n => n.status === 'archived').sort((a, b) => b.updatedAt - a.updatedAt));

    const subtaskParentTitle = subtaskParentId ? normalizedTasks.find(t => t.id === subtaskParentId)?.title : undefined;

    // ==================== RENDER TASK NODE ====================

    const renderTaskNode = (node: TaskTreeNode, depth: number = 0, options?: { showPermanentDelete?: boolean }): React.ReactNode => {
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsedTasks.has(node.id);
        const isSlidingOut = slidingOutTasks.has(node.id);
        const isAddingSubtask = addingSubtaskTo === node.id;

        const taskItem = (
            <div className={isSlidingOut ? 'terminalTaskSlideOut' : ''}>
                <TaskListItem
                    task={node}
                    onSelect={() => useUIStore.getState().setTaskDetailOverlay({ taskId: node.id, projectId })}
                    onWorkOn={() => handleWorkOnTask(node)}
                    onWorkOnWithOverride={(agentTool: AgentTool, model: ModelType) => handleWorkOnTask(node, { agentTool, model })}
                    onAssignTeamMember={(tmId: string) => handleAssignTeamMember(node.id, tmId)}
                    onOpenCreateTeamMember={() => {}}
                    onJumpToSession={(sid) => onJumpToSession?.(sid)}
                    onNavigateToTask={(taskId: string) => useUIStore.getState().setTaskDetailOverlay({ taskId, projectId })}
                    depth={depth}
                    hasChildren={hasChildren}
                    isChildrenCollapsed={isCollapsed}
                    isAddingSubtask={isAddingSubtask}
                    onToggleChildrenCollapse={() => handleToggleAddSubtask(node.id, hasChildren)}
                    onTogglePin={() => handleTogglePin(node.id)}
                    selectionMode={execution.executionMode}
                    isSelected={execution.selectedForExecution.has(node.id)}
                    onToggleSelect={() => execution.handleToggleTaskSelection(node.id)}
                    showPermanentDelete={options?.showPermanentDelete}
                    isSessionTask={currentSessionTaskIds.has(node.id)}
                />
            </div>
        );

        const subtaskInput = (isAddingSubtask || (hasChildren && !isCollapsed)) ? (
            <AddSubtaskInput parentTaskId={node.id} onAddSubtask={handleInlineAddSubtask} depth={depth + 1} />
        ) : null;

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

    // ==================== RENDER ====================

    return (
        <>
            <div className={`maestroPanel terminalTheme ${execution.executionMode ? 'maestroPanel--executionMode' : ''}`}>
                <PanelIconBar
                    primaryTab={primaryTab}
                    onPrimaryTabChange={forcedPrimaryTab ? () => {} : setPrimaryTab}
                    taskSubTab={taskSubTab}
                    onTaskSubTabChange={setTaskSubTab}
                    skillSubTab={skillSubTab}
                    onSkillSubTabChange={setSkillSubTab}
                    teamSubTab={teamSubTab}
                    onTeamSubTabChange={setTeamSubTab}
                    activeCount={activeRoots.length}
                    pinnedCount={pinnedRoots.length}
                    completedCount={completedRoots.length}
                    archivedCount={archivedRoots.length}
                    teamMembers={teamMembers}
                    loading={loading}
                    projectId={projectId}
                    onNewTask={() => setShowCreateModal(true)}
                    onNewTaskList={() => setTaskListCreateSignal(prev => prev + 1)}
                    onNewTeamMember={() => {}}
                    onNewTeam={() => {}}
                    teamCount={activeTeams.length}
                    taskListCount={taskListArray.length}
                    {...(forcedPrimaryTab ? { hidePrimaryTabs: true } : {})}
                />

                {primaryTab === "tasks" && (
                    <div className="taskSearchBar">
                        <span className="taskSearchBar__icon">⌕</span>
                        <input type="text" className="taskSearchBar__input" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        {searchQuery && <button className="taskSearchBar__clear" onClick={() => setSearchQuery("")}>×</button>}
                    </div>
                )}

                {(error || fetchError) && (
                    <div className="terminalErrorBanner">
                        <span className="terminalErrorSymbol">[ERROR]</span>
                        <span className="terminalErrorText">{error || fetchError}</span>
                        <button className="terminalErrorClose" onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Tasks Tab */}
                {primaryTab === "tasks" && (
                    <>
                        {taskSubTab === "current" && (
                            <>
                                <TaskFilters statusFilter={statusFilter} priorityFilter={priorityFilter} sortBy={sortBy} onStatusFilterChange={setStatusFilter} onPriorityFilterChange={setPriorityFilter} onSortChange={setSortBy} />
                                <ExecutionBar
                                    isActive={execution.executionMode}
                                    activeMode={execution.activeBarMode}
                                    onActivate={() => { execution.setExecutionMode(true); execution.setActiveBarMode('execute'); }}
                                    onActivateOrchestrate={() => { execution.setExecutionMode(true); execution.setActiveBarMode('orchestrate'); }}
                                    onCancel={execution.handleCancelExecution}
                                    onExecute={execution.handleBatchExecute}
                                    onOrchestrate={execution.handleBatchOrchestrate}
                                    selectedCount={execution.selectedForExecution.size}
                                    projectId={projectId}
                                    teamMembers={teamMembers}
                                    onSaveAsTeam={execution.handleSaveAsTeam}
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
                                                <p className="terminalLoadingText"><span className="terminalCursor">█</span> Loading tasks...</p>
                                            </div>
                                        </div>
                                    ) : activeRoots.length === 0 ? (
                                        <TaskTabContent loading={false} emptyMessage="NO TASKS IN QUEUE" emptySubMessage="$ maestro new task" roots={[]} renderTaskNode={renderTaskNode} showNewTaskButton onNewTask={() => setShowCreateModal(true)} />
                                    ) : (
                                        <div className="terminalContent">
                                            <SortableTaskList roots={activeRoots} renderTaskNode={renderTaskNode} onReorder={handleTaskReorder} />
                                        </div>
                                    )
                                ) : (
                                    <TaskTabContent loading={loading} emptyMessage="NO TASKS IN QUEUE" emptySubMessage="$ maestro new task" roots={activeRoots} renderTaskNode={renderTaskNode} showNewTaskButton onNewTask={() => setShowCreateModal(true)} />
                                )}
                            </>
                        )}
                        {taskSubTab === "pinned" && <TaskTabContent loading={loading} emptyMessage="NO PINNED TASKS" emptySubMessage="Pin tasks you run frequently" roots={pinnedRoots} renderTaskNode={renderTaskNode} />}
                        {taskSubTab === "completed" && <TaskTabContent loading={loading} emptyMessage="NO COMPLETED TASKS YET" emptySubMessage="Tasks will appear here when" roots={completedRoots} renderTaskNode={renderTaskNode} listClassName="terminalTaskListCompleted" />}
                        {taskSubTab === "archived" && <TaskTabContent loading={loading} emptyMessage="NO ARCHIVED TASKS" emptySubMessage="Archived tasks will appear here" roots={archivedRoots} renderTaskNode={renderTaskNode} listClassName="terminalTaskListArchived" showPermanentDelete />}
                    </>
                )}

                {/* Skills Tab */}
                {primaryTab === "skills" && <SkillsPanel project={project} />}

                {/* Lists Tab */}
                {primaryTab === "lists" && <TaskListsPanel projectId={projectId} createListSignal={taskListCreateSignal} />}

                {/* Team Tab */}
                {primaryTab === "team" && (
                    <>
                        {teamSubTab === "members" && (
                            <TeamMembersPanel
                                projectId={projectId}
                                teamMembers={teamMembers}
                                teamMembersLoading={teamMembersLoading}
                                onEdit={() => {}}
                                onArchive={handleArchiveTeamMember}
                                onUnarchive={handleUnarchiveTeamMember}
                                onDelete={handleDeleteTeamMember}
                                onRun={handleRunTeamMember}
                            />
                        )}
                        {teamSubTab === "teams" && (
                            <TeamsPanel
                                projectId={projectId}
                                teams={teams}
                                topLevelTeams={topLevelTeams}
                                onEdit={() => {}}
                                onRun={handleRunTeam}
                            />
                        )}
                    </>
                )}
            </div>

            <CreateTaskModal
                isOpen={showCreateModal}
                onClose={() => { setShowCreateModal(false); setSubtaskParentId(null); }}
                onCreate={handleCreateTask}
                project={project}
                parentId={subtaskParentId ?? undefined}
                parentTitle={subtaskParentTitle}
            />

            {showBoard && (
                <Board
                    focusProjectId={projectId}
                    onClose={() => setShowBoard(false)}
                    onSelectTask={(taskId, _projectId) => useUIStore.getState().setTaskDetailOverlay({ taskId, projectId })}
                    onUpdateTaskStatus={(taskId, status) => { void handleUpdateTask(taskId, { status }); }}
                    onWorkOnTask={(task, _project) => handleWorkOnTask(task)}
                    onCreateMaestroSession={onCreateMaestroSession}
                />
            )}
        </>
    );
});
