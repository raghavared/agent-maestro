import { maestroClient } from "../utils/MaestroClient";

import { TerminalSession } from "../app/types/session";
import { MaestroProject, MaestroTask, WorkerStrategy, OrchestratorStrategy, AgentTool } from "../app/types/maestro";

export async function createMaestroSession(input: {
    task?: MaestroTask;              // Single task (backward compatible)
    tasks?: MaestroTask[];           // Multiple tasks (PHASE IV-A)
    project: MaestroProject;
    skillIds?: string[];      // NEW: Skill IDs to load
    strategy?: WorkerStrategy;       // Worker strategy
    role?: 'worker' | 'orchestrator';
    orchestratorStrategy?: OrchestratorStrategy;
  }): Promise<TerminalSession> {
    const { task, tasks, skillIds, project, strategy, role, orchestratorStrategy } = input;

    // Normalize to array (support both single and multi-task)
    const taskList = tasks || (task ? [task] : []);
    if (taskList.length === 0) {
      throw new Error('At least one task is required');
    }

    const resolvedRole = role || 'worker';

    console.log('[App.createMaestroSession] Using server spawn flow');
    console.log('[App.createMaestroSession] Tasks:', taskList.map(t => t.id).join(', '));
    console.log('[App.createMaestroSession] Role:', resolvedRole);

    // NEW: Use server spawn endpoint (Server-Generated Manifests architecture)
    // The server will:
    // 1. Generate manifest via CLI
    // 2. Emit spawn_request via WebSocket
    // 3. MaestroContext will receive and spawn terminal automatically
    const taskIds = taskList.map(t => t.id);

    // Get model from the first task (for multi-task sessions, use the first task's model)
    const model = taskList[0].model || 'sonnet';

    // Get agent tool from the first task
    const agentTool: AgentTool | undefined = taskList[0].agentTool;

    // Determine skill based on role
    const defaultSkill = resolvedRole === 'orchestrator' ? 'maestro-orchestrator' : 'maestro-worker';

    try {
      const response = await maestroClient.spawnSession({
        projectId: project.id,
        taskIds,
        role: resolvedRole,
        strategy: strategy || 'simple',
        ...(resolvedRole === 'orchestrator' && orchestratorStrategy ? { orchestratorStrategy } : {}),
        spawnSource: 'ui',      // CHANGED: from 'manual' to 'ui'
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
