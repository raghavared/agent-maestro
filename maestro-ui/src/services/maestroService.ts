import { maestroClient } from "../utils/MaestroClient";

import { TerminalSession } from "../app/types/session";
import { MaestroProject, MaestroTask, AgentMode, AgentTool } from "../app/types/maestro";

export async function createMaestroSession(input: {
    task?: MaestroTask;              // Single task (backward compatible)
    tasks?: MaestroTask[];           // Multiple tasks (PHASE IV-A)
    project: MaestroProject;
    skillIds?: string[];      // Skill IDs to load
    strategy?: string;               // Unified strategy
    mode?: AgentMode;                // 'execute' or 'coordinate'
  }): Promise<TerminalSession> {
    const { task, tasks, skillIds, project, strategy, mode } = input;

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

    // Get model from the first task (for multi-task sessions, use the first task's model)
    const model = taskList[0].model || 'sonnet';

    // Get agent tool from the first task
    const agentTool: AgentTool | undefined = taskList[0].agentTool;

    // Determine skill based on mode
    const defaultSkill = resolvedMode === 'coordinate' ? 'maestro-orchestrator' : 'maestro-worker';

    try {
      const response = await maestroClient.spawnSession({
        projectId: project.id,
        taskIds,
        mode: resolvedMode,
        strategy: strategy || 'simple',
        spawnSource: 'ui',
        sessionName: taskList.length > 1
          ? `Multi-Task: ${taskList[0].title}`
          : taskList[0].title,
        skills: skillIds || [defaultSkill],
        model,
        ...(agentTool && agentTool !== 'claude-code' ? { agentTool } : {}),
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
