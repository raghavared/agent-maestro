import { useState, useCallback } from "react";
import { MaestroTask, MaestroProject, AgentTool, ModelType, MemberLaunchOverride } from "../app/types/maestro";

type CreateSessionFn = (input: any) => Promise<any>;

export function useExecutionMode(
    projectId: string,
    project: MaestroProject,
    normalizedTasks: MaestroTask[],
    regularTasks: MaestroTask[],
    onCreateMaestroSession: CreateSessionFn,
    createTeamFn: (payload: any) => Promise<any>,
    onError: (msg: string) => void,
) {
    const [executionMode, setExecutionMode] = useState(false);
    const [activeBarMode, setActiveBarMode] = useState<'none' | 'execute' | 'orchestrate'>('none');
    const [selectedForExecution, setSelectedForExecution] = useState<Set<string>>(new Set());
    const [selectedAgentByTask, setSelectedAgentByTask] = useState<Record<string, string>>({});

    const handleToggleTaskSelection = useCallback((taskId: string) => {
        setSelectedForExecution(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const handleCancelExecution = useCallback(() => {
        setExecutionMode(false);
        setActiveBarMode('none');
        setSelectedForExecution(new Set());
    }, []);

    const handleAgentSelect = useCallback((taskId: string, agentId: string) => {
        setSelectedAgentByTask(prev => ({ ...prev, [taskId]: agentId }));
    }, []);

    const handleBatchExecute = useCallback(async (teamMemberId?: string, override?: { agentTool: AgentTool; model: ModelType }, memberOverrides?: Record<string, MemberLaunchOverride>) => {
        const selectedTasks = normalizedTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                teamMemberId,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
                ...(memberOverrides && Object.keys(memberOverrides).length > 0 ? { memberOverrides } : {}),
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
        } catch (err: any) {
            onError(`Failed to create session: ${err.message}`);
        }
    }, [normalizedTasks, selectedForExecution, project, onCreateMaestroSession, onError]);

    const handleBatchOrchestrate = useCallback(async (coordinatorId?: string, workerIds?: string[], override?: { agentTool: AgentTool; model: ModelType }, memberOverrides?: Record<string, MemberLaunchOverride>) => {
        const selectedTasks = regularTasks.filter(t => selectedForExecution.has(t.id));
        if (selectedTasks.length === 0) return;

        try {
            await onCreateMaestroSession({
                tasks: selectedTasks,
                project,
                mode: 'coordinator',
                skillIds: ['maestro-orchestrator'],
                teamMemberId: coordinatorId,
                delegateTeamMemberIds: workerIds && workerIds.length > 0 ? workerIds : undefined,
                ...(override ? { agentTool: override.agentTool, model: override.model } : {}),
                ...(memberOverrides && Object.keys(memberOverrides).length > 0 ? { memberOverrides } : {}),
            });
            setExecutionMode(false);
            setActiveBarMode('none');
            setSelectedForExecution(new Set());
        } catch (err: any) {
            onError(`Failed to create orchestrator session: ${err.message}`);
        }
    }, [regularTasks, selectedForExecution, project, onCreateMaestroSession, onError]);

    const handleSaveAsTeam = useCallback(async (teamName: string, coordinatorId: string | null, workerIds: string[], _overrides: Record<string, MemberLaunchOverride>) => {
        try {
            const allMemberIds = [coordinatorId, ...workerIds].filter(Boolean) as string[];
            await createTeamFn({
                projectId,
                name: teamName,
                leaderId: coordinatorId || allMemberIds[0] || '',
                memberIds: allMemberIds,
            });
        } catch (err: any) {
            onError(`Failed to save team: ${err.message}`);
        }
    }, [projectId, createTeamFn, onError]);

    return {
        executionMode,
        activeBarMode,
        selectedForExecution,
        selectedAgentByTask,
        setExecutionMode,
        setActiveBarMode,
        handleToggleTaskSelection,
        handleCancelExecution,
        handleAgentSelect,
        handleBatchExecute,
        handleBatchOrchestrate,
        handleSaveAsTeam,
    };
}
