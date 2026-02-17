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

    console.log('[App.createMaestroSession] Using server spawn flow');
    console.log('[App.createMaestroSession] Tasks:', taskList.map(t => t.id).join(', '));
    console.log('[App.createMaestroSession] Mode:', resolvedMode);

    // Use server spawn endpoint (Server-Generated Manifests architecture)
    const taskIds = taskList.map(t => t.id);

    // Determine skill based on mode
    const defaultSkill = resolvedMode === 'coordinate' ? 'maestro-orchestrator' : 'maestro-worker';

    // Resolve teamMemberId from the first task if not explicitly provided
    const resolvedTeamMemberId = teamMemberId || taskList[0].teamMemberId;

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
        ...(teamMemberIds && teamMemberIds.length > 0 ? { teamMemberIds } : {}),
        ...(resolvedTeamMemberId ? { teamMemberId: resolvedTeamMemberId } : {}),
        ...(agentTool ? { agentTool } : {}),
        ...(model ? { model } : {}),
      });

      console.log('[App.createMaestroSession] ✓ Server spawn request sent:', response.sessionId);
      console.log('[App.createMaestroSession] Manifest:', response.manifestPath);

      // Return a placeholder session - the actual UI session will be created
      // by MaestroContext when it receives the spawn_request WebSocket event
      return {
        id: 'pending',
        maestroSessionId: response.sessionId,
        projectId: project.id,
      } as TerminalSession;

    } catch (error: any) {
      console.error('[App.createMaestroSession] ✗ Failed to spawn session:', error);
      throw new Error(`Failed to spawn session: ${error.message}`);
    }
  }
