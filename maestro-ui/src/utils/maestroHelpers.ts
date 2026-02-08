import { invoke } from '@tauri-apps/api/core';
import { maestroClient, type Task, type Session } from './MaestroClient';
import { MaestroProject } from '../app/types/maestro';
import { PromptTemplateEngine } from './promptTemplate';
import { ClaudeCliBuilder, type ClaudeCliConfig } from './claudeCliBuilder';
import { SERVER_URL } from './serverConfig';

/**
 * Maestro Terminal Integration Helpers
 * 
 * This module handles spawning terminals with Maestro context using the
 * robust architecture defined in Phase VI.
 */

/**
 * Generate a unique session ID for Maestro
 */
function generateSessionId(prefix: string = 'sess'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get home directory path
 */
async function getHomeDir(): Promise<string> {
    try {
        const { homeDir } = await import('@tauri-apps/api/path');
        return await homeDir();
    } catch (err) {
        console.error('[Maestro] Failed to get home directory:', err);
        return '/tmp';
    }
}

/**
 * Start working on a single task
 */
export async function startWorkingOnTask(
    task: Task,
    project: MaestroProject,
    options?: {
        sessionName?: string;
        skillIds?: string[];
        agentId?: string;
        mode?: 'interactive' | 'non-interactive';
        cliConfig?: Partial<ClaudeCliConfig>;
    }
): Promise<string> {
    console.log('[Maestro] Starting work on task:', task.id);

    // 1. Create session in Maestro server
    const sessionId = generateSessionId('sess');
    const session = await maestroClient.createSession({
        id: sessionId,
        projectId: project.id,
        taskIds: [task.id],
        name: options?.sessionName || `Session: ${task.title}`,
        agentId: options?.agentId,
    });
    console.log('[Maestro] Session created:', session.id);

    // 2. Prepare environment variables
    const homeDir = await getHomeDir();
    
    // Core Maestro Context
    const envVars: Record<string, string> = {
        MAESTRO_TASK_DATA: JSON.stringify({
            id: task.id,
            title: task.title,
            description: task.description,
            prompt: task.initialPrompt,
            status: task.status,
            priority: task.priority,
        }),
        MAESTRO_TASK_IDS: task.id,
        MAESTRO_PRIMARY_TASK_ID: task.id,
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_PROJECT_ID: project.id,
        MAESTRO_API_URL: SERVER_URL,

        // Skills & Agent
        MAESTRO_SKILL_IDS: options?.skillIds?.join(',') || '',
        MAESTRO_AGENT_ID: options?.agentId || '',

        // System Prompts
        MAESTRO_SYSTEM_PROMPT: task.initialPrompt,
        MAESTRO_APPEND_SYSTEM_PROMPT: 'Report progress using Maestro hooks. Update task status via API.',
        
        // CLI Config
        CLAUDE_CLI_MODE: options?.mode || 'interactive',
        CLAUDE_CLI_ARGS: '--permission-mode acceptEdits --model sonnet',
        
        // Path augmentation
        PATH: `${homeDir}/.agents-ui/maestro-skills/bin:${''}`,
    };

    // 3. Render prompt template
    const templatePath = `${homeDir}/.agents-ui/maestro-templates/worker-prompt.template`;
    const systemPrompt = await PromptTemplateEngine.renderTemplate(templatePath, envVars);

    // 4. Build Claude CLI configuration
    // Convert skill IDs to plugin directories
    const skillDirs: string[] = [];
    if (options?.skillIds) {
        for (const skillId of options.skillIds) {
            skillDirs.push(`${homeDir}/.agents-ui/maestro-skills/${skillId}`);
        }
    }

    const cliConfig: ClaudeCliConfig = {
        mode: options?.mode || 'interactive',
        model: 'sonnet',
        systemPrompt,
        permissionMode: 'acceptEdits',
        sessionId: session.id,
        skillDirs,
        ...options?.cliConfig,
    };

    const claudeCli = new ClaudeCliBuilder(cliConfig);
    const { command, args } = claudeCli.buildCommand();
    
    const isClaudeAgent = options?.agentId === 'claude' || !options?.agentId;
    const finalCommand = isClaudeAgent ? command : null;
    const finalArgs = isClaudeAgent ? args : [];

    // 5. Spawn terminal via Tauri
    const terminalSessionId = await invoke<string>('create_session', {
        name: options?.sessionName || task.title,
        command: finalCommand,
        args: finalArgs,
        cwd: project.basePath || homeDir,
        env_vars: envVars,
        persistent: false,
    });

    return terminalSessionId;
}

/**
 * Spawn a terminal for an existing Maestro session (e.g. triggered via CLI)
 */
export async function spawnWorkerSession(
    session: Session,
    projectId: string,
    taskIds: string[],
    skillIds: string[] = ['maestro-worker']
): Promise<string> {
    console.log('[Maestro] Spawning worker for existing session:', session.id);

    // 1. Fetch project and tasks (needed for context)
    let project;
    try {
        project = await maestroClient.getProject(projectId);
    } catch (err) {
        console.warn('[Maestro] Project not found, using defaults:', projectId);
        // Use sensible defaults when project doesn't exist
        project = {
            id: projectId,
            name: 'Unknown Project',
            workingDir: null
        };
    }

    const tasks = await Promise.all(taskIds.map(id => maestroClient.getTask(id)));
    const primaryTask = tasks[0];

    if (!primaryTask) {
        throw new Error('No tasks found for session');
    }

    // 2. Prepare environment variables
    const homeDir = await getHomeDir();
    
    const envVars: Record<string, string> = {
        MAESTRO_TASK_DATA: JSON.stringify({
            id: primaryTask.id,
            title: primaryTask.title,
            description: primaryTask.description,
            prompt: primaryTask.initialPrompt,
            status: primaryTask.status,
            priority: primaryTask.priority,
        }),
        MAESTRO_TASK_IDS: taskIds.join(','),
        MAESTRO_PRIMARY_TASK_ID: primaryTask.id,
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_PROJECT_ID: projectId,
        MAESTRO_API_URL: SERVER_URL,

        // Skills & Agent
        MAESTRO_SKILL_IDS: skillIds.join(','),
        MAESTRO_AGENT_ID: session.agentId || 'claude',

        // System Prompts
        MAESTRO_SYSTEM_PROMPT: primaryTask.initialPrompt || primaryTask.description,
        MAESTRO_APPEND_SYSTEM_PROMPT: 'Report progress using Maestro hooks. Update task status via API.',
        
        // CLI Config
        CLAUDE_CLI_MODE: 'interactive',
        CLAUDE_CLI_ARGS: '--permission-mode acceptEdits --model sonnet',
        
        // Path augmentation
        PATH: `${homeDir}/.agents-ui/maestro-skills/bin:${''}`,
    };

    // 3. Render prompt template
    const templatePath = `${homeDir}/.agents-ui/maestro-templates/worker-prompt.template`;
    const systemPrompt = await PromptTemplateEngine.renderTemplate(templatePath, envVars);

    // 4. Build Claude CLI configuration
    const skillDirs: string[] = skillIds.map(id => `${homeDir}/.agents-ui/maestro-skills/${id}`);

    const cliConfig: ClaudeCliConfig = {
        mode: 'interactive',
        model: 'sonnet',
        systemPrompt,
        permissionMode: 'acceptEdits',
        sessionId: session.id,
        skillDirs,
    };

    const claudeCli = new ClaudeCliBuilder(cliConfig);
    const { command, args } = claudeCli.buildCommand();

    // 5. Spawn terminal via Tauri
    const terminalSessionId = await invoke<string>('create_session', {
        name: session.name,
        command,
        args,
        cwd: project.workingDir || homeDir,
        env_vars: envVars,
        persistent: false,
    });

    return terminalSessionId;
}

/**
 * Build configuration for a Maestro session (env vars, command)
 * usage by App.tsx which manages the session lifecycle.
 */
export async function buildMaestroSessionConfig(
    taskOrTasks: Task | Task[],
    project: { id: string; basePath?: string | null },
    agentId: string = 'claude',
    skillIds: string[] = []
): Promise<{
    envVars: Record<string, string>;
    launchCommand: string | null;
    sessionName: string;
    maestroSessionId: string;
}> {
    const tasks = Array.isArray(taskOrTasks) ? taskOrTasks : [taskOrTasks];
    const primaryTask = tasks[0];
    const taskIds = tasks.map(t => t.id);
    
    // 1. Create session in Maestro server
    const sessionId = generateSessionId('sess');
    const session = await maestroClient.createSession({
        id: sessionId,
        projectId: project.id,
        taskIds,
        name: tasks.length > 1 ? `Multi-Task: ${primaryTask.title}` : primaryTask.title,
        agentId,
    });

    // 2. Prepare environment variables
    const homeDir = await getHomeDir();
    
    const envVars: Record<string, string> = {
        MAESTRO_TASK_DATA: JSON.stringify({
            id: primaryTask.id,
            title: primaryTask.title,
            description: primaryTask.description,
            prompt: primaryTask.initialPrompt,
            status: primaryTask.status,
            priority: primaryTask.priority,
        }),
        MAESTRO_TASK_IDS: taskIds.join(','),
        MAESTRO_PRIMARY_TASK_ID: primaryTask.id,
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_PROJECT_ID: project.id,
        MAESTRO_API_URL: SERVER_URL,
        MAESTRO_AGENT_ID: agentId,
        MAESTRO_SKILL_IDS: skillIds.join(','),
        MAESTRO_SYSTEM_PROMPT: tasks.length > 1 
            ? `You are working on ${tasks.length} tasks simultaneously:\n` + tasks.map(t => `- ${t.title}`).join('\n')
            : primaryTask.initialPrompt || primaryTask.description,
        MAESTRO_APPEND_SYSTEM_PROMPT: 'Report progress using Maestro hooks.',
        PATH: `${homeDir}/.agents-ui/maestro-skills/bin:${''}`,
    };

    // 3. Render prompt template
    const templatePath = `${homeDir}/.agents-ui/maestro-templates/worker-prompt.template`;
    const systemPrompt = await PromptTemplateEngine.renderTemplate(templatePath, envVars);

    // 4. Build Launch Command
    let launchCommand: string | null = null;
    
    if (['claude', 'gemini', 'codex'].includes(agentId)) {
        // Use CLI builder for Claude
        if (agentId === 'claude') {
            const skillDirs = skillIds.map(id => `${homeDir}/.agents-ui/maestro-skills/${id}`);
            
            const cliConfig: ClaudeCliConfig = {
                mode: 'interactive',
                model: 'sonnet',
                systemPrompt,
                permissionMode: 'acceptEdits',
                sessionId: session.id,
                skillDirs,
            };
            const builder = new ClaudeCliBuilder(cliConfig);
            const { command, args } = builder.buildCommand();
            // App.tsx expects a shell command string
            launchCommand = `${command} ${args.join(' ')}; exec $SHELL -l`;
        } else {
            // Generic agent fallback
            launchCommand = `echo "Agent ${agentId} not yet fully supported"; exec $SHELL`;
        }
    }

    return {
        envVars,
        launchCommand,
        sessionName: session.name,
        maestroSessionId: session.id
    };
}

export async function launchMultiTaskSession(
    tasks: Task[],
    project: { id: string; basePath?: string | null },
    options?: {
        sessionName?: string;
        skillIds?: string[];
        agentId?: string;
        mode?: 'interactive' | 'non-interactive';
    }
): Promise<string> {
    const taskIds = tasks.map(t => t.id);
    console.log('[Maestro] Starting multi-task session:', taskIds);

    // 1. Create session
    const sessionId = generateSessionId('sess');
    const session = await maestroClient.createSession({
        id: sessionId,
        projectId: project.id,
        taskIds,
        name: options?.sessionName || `Multi-Task Session`,
        agentId: options?.agentId,
    });

    // 2. Prepare environment variables
    const homeDir = await getHomeDir();

    const envVars: Record<string, string> = {
        MAESTRO_TASK_IDS: taskIds.join(','),
        MAESTRO_PRIMARY_TASK_ID: tasks[0].id,
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_PROJECT_ID: project.id,
        MAESTRO_API_URL: SERVER_URL,

        MAESTRO_SYSTEM_PROMPT: `You are working on ${tasks.length} tasks simultaneously:\n` +
            tasks.map(t => `- ${t.title}: ${t.description}`).join('\n'),

        MAESTRO_APPEND_SYSTEM_PROMPT: 'Update ALL tasks via the hooks API. Use MAESTRO_TASK_IDS to update multiple tasks.',
        
        PATH: `${homeDir}/.agents-ui/maestro-skills/bin:${''}`,
    };

    // 3. Render template
    const templatePath = `${homeDir}/.agents-ui/maestro-templates/worker-prompt.template`;
    const systemPrompt = await PromptTemplateEngine.renderTemplate(templatePath, envVars);

    // 4. Build CLI config
    const cliConfig: ClaudeCliConfig = {
        mode: options?.mode || 'interactive',
        model: 'sonnet',
        systemPrompt,
        permissionMode: 'acceptEdits',
        sessionId: session.id,
    };

    const claudeCli = new ClaudeCliBuilder(cliConfig);
    const { command, args } = claudeCli.buildCommand();
    
    const isClaudeAgent = options?.agentId === 'claude' || !options?.agentId;
    const finalCommand = isClaudeAgent ? command : null;
    const finalArgs = isClaudeAgent ? args : [];

    // 5. Spawn terminal
    const terminalSessionId = await invoke<string>('create_session', {
        name: options?.sessionName || 'Multi-Task Session',
        command: finalCommand,
        args: finalArgs,
        cwd: project.basePath || homeDir,
        env_vars: envVars,
        persistent: false,
    });

    return terminalSessionId;
}

/**
 * Deletes a Maestro session when terminal closes
 *
 * This ensures proper cleanup of session data from server and UI cache.
 * The session is permanently removed from storage and all task references are cleaned up.
 */
export async function deleteSession(sessionId: string): Promise<void> {
    try {
        await maestroClient.deleteSession(sessionId);
        console.log('[Maestro] ✓ Session deleted:', sessionId);
    } catch (err) {
        console.error('[Maestro] Failed to delete session:', err);
        // Fallback: try to mark as completed if delete fails
        try {
            await maestroClient.updateSession(sessionId, {
                status: 'completed',
                completedAt: Date.now(),
            });
            console.log('[Maestro] ⚠ Fallback: Session marked as completed:', sessionId);
        } catch (fallbackErr) {
            console.error('[Maestro] Fallback update also failed:', fallbackErr);
        }
    }
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use deleteSession instead
 */
export async function completeSession(sessionId: string): Promise<void> {
    console.warn('[Maestro] completeSession is deprecated, use deleteSession instead');
    return deleteSession(sessionId);
}
