import { maestroClient } from "../utils/MaestroClient";

import { TerminalSession } from "../app/types/session";
import { MaestroProject, MaestroTask, AgentMode, WorkerStrategy, OrchestratorStrategy, AgentTool, ModelType } from "../app/types/maestro";

export async function createMaestroSession(input: {
    task?: MaestroTask;              // Single task (backward compatible)
    tasks?: MaestroTask[];           // Multiple tasks (PHASE IV-A)
    project: MaestroProject;
    skillIds?: string[];      // Skill IDs to load
    mode?: AgentMode;                // 'execute' or 'coordinate'
    strategy?: WorkerStrategy | OrchestratorStrategy;  // Strategy for this session
    teamMemberIds?: string[];        // Team member task IDs for coordinate mode
    teamMemberId?: string;           // Single team member assigned to this task
    agentTool?: AgentTool;           // Override agent tool for this run
    model?: ModelType;               // Override model for this run
  }): Promise<TerminalSession> {
    const { task, tasks, skillIds, project, mode, teamMemberIds, teamMemberId, agentTool, model } = input;

    // Normalize to array (support both single and multi-task)
    const taskList = tasks || (task ? [task] : []);
    if (taskList.length === 0) {
      throw new Error('At least one task is required');
    }

    const resolvedMode: AgentMode = mode || 'execute';

    // Use server spawn endpoint (Server-Generated Manifests architecture)
    const taskIds = taskList.map(t => t.id);

    // Determine skill based on mode
    const defaultSkill = resolvedMode === 'coordinate' ? 'maestro-orchestrator' : 'maestro-worker';

    // Resolve team member identities:
    // 1. Explicit teamMemberIds from input (multi-identity)
    // 2. Task's teamMemberIds (multi-identity from task)
    // 3. Explicit teamMemberId from input (single)
    // 4. Task's teamMemberId (single, backward compat)
    const resolvedTeamMemberIds = teamMemberIds && teamMemberIds.length > 0
      ? teamMemberIds
      : (taskList[0].teamMemberIds && taskList[0].teamMemberIds.length > 0 ? taskList[0].teamMemberIds : undefined);
    const resolvedTeamMemberId = !resolvedTeamMemberIds ? (teamMemberId || taskList[0].teamMemberId) : undefined;

    try {
      const response = await maestroClient.spawnSession({
        projectId: project.id,
        taskIds,
        mode: resolvedMode,
        spawnSource: 'ui',
        sessionName: taskList.length > 1
          ? `Multi-Task: ${taskList[0].title}`
          : taskList[0].title,
        skills: skillIds || [defaultSkill],
        ...(resolvedTeamMemberIds && resolvedTeamMemberIds.length > 0 ? { teamMemberIds: resolvedTeamMemberIds } : {}),
        ...(resolvedTeamMemberId ? { teamMemberId: resolvedTeamMemberId } : {}),
        ...(agentTool ? { agentTool } : {}),
        ...(model ? { model } : {}),
      });

      // Return a placeholder session - the actual UI session will be created
      // by MaestroContext when it receives the spawn_request WebSocket event
      return {
        id: 'pending',
        maestroSessionId: response.sessionId,
        projectId: project.id,
      } as TerminalSession;

    } catch (error: any) {
      throw new Error(`Failed to spawn session: ${error.message}`);
    }
  }
