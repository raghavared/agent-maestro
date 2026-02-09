import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputErrorJSON, outputKeyValue } from '../utils/formatter.js';
import { validateRequired, validateTaskId } from '../utils/validation.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

/**
 * Build comprehensive session context for spawning
 */
async function buildSessionContext(task: any, options: any): Promise<any> {
    const context: any = {
        primaryTask: {
            ...task,
            acceptanceCriteria: task.acceptanceCriteria || [],
            technicalNotes: task.technicalNotes || '',
            estimatedComplexity: task.estimatedComplexity || 'medium'
        }
    };

    // Add related tasks if requested
    if (options.includeRelated && task.dependencies?.length) {
        const relatedTasks = [];
        for (const depId of task.dependencies) {
            try {
                const depTask = await api.get(`/api/tasks/${depId}`);
                if (depTask) relatedTasks.push(depTask);
            } catch {
                // Skip unavailable dependencies
            }
        }
        context.relatedTasks = relatedTasks;
    }

    // Add workflow steps based on skill
    if (options.skill === 'maestro-worker') {
        context.workflowSteps = [
            'Run maestro task start to mark task as in-progress',
            'Work through the task systematically',
            'Report progress using maestro update',
            'Create child tasks if needed with maestro task create --parent <taskId>',
            'Run maestro task complete when all work is verified'
        ];
    } else if (options.skill === 'maestro-orchestrator') {
        context.workflowSteps = [
            'Run maestro status to see project overview',
            'Analyze tasks that need decomposition',
            'Create child tasks using maestro task create --parent <taskId>',
            'Spawn workers using maestro session spawn',
            'Monitor progress and unblock workers as needed'
        ];
    }

    // Add initial commands
    context.initialCommands = [
        'maestro whoami',
        `maestro task get ${task.id}`
    ];

    if (options.skill === 'maestro-worker') {
        context.initialCommands.push(`maestro task start ${task.id}`);
    }

    return context;
}

/**
 * Generate session name from task and skill
 */
function generateSessionName(task: any, skill: string): string {
    const skillName = skill === 'maestro-worker' ? 'Worker' :
                      skill === 'maestro-orchestrator' ? 'Orchestrator' : skill;

    // Truncate task title if too long
    const maxTitleLength = 30;
    let title = task.title;
    if (title.length > maxTitleLength) {
        title = title.substring(0, maxTitleLength) + '...';
    }

    return `${skillName}: ${title}`;
}

export function registerSessionCommands(program: Command) {
    const session = program.command('session').description('Manage sessions');

    session.command('list')
        .description('List sessions')
        .option('--task <taskId>', 'Filter by task ID')
        .action(async (cmdOpts) => {
            await guardCommand('session:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching sessions...').start() : null;

            try {
                const projectId = globalOpts.project || config.projectId;

                // Fetch sessions from server
                let endpoint = '/api/sessions';
                const queryParts = [];
                if (cmdOpts.task) queryParts.push(`taskId=${cmdOpts.task}`);
                if (projectId) queryParts.push(`projectId=${projectId}`);
                if (queryParts.length) endpoint += '?' + queryParts.join('&');

                const sessions: any[] = await api.get(endpoint);

                spinner?.stop();

                if (isJson) {
                    outputJSON(sessions);
                } else {
                    if (sessions.length === 0) {
                        console.log('No sessions found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Status', 'Tasks'],
                            sessions.map(s => [s.id, s.name, s.status, (s.taskIds || []).length])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    session.command('info')
        .description('Get current session info')
        .action(async () => {
            await guardCommand('session:info');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found (MAESTRO_SESSION_ID not set).' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching session info...').start() : null;
            try {
                // Fetch from server
                const s: any = await api.get(`/api/sessions/${sessionId}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(s);
                } else {
                    outputKeyValue('ID', s.id);
                    outputKeyValue('Name', s.name);
                    outputKeyValue('Status', s.status);
                    outputKeyValue('Tasks', (s.taskIds || []).join(', '));
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    session.command('spawn')
        .description('Spawn a new session with full task context')
        .requiredOption('--task <id>', 'Task ID to assign to the new session')
        .option('--skill <skill>', 'Skill to load (defaults to "maestro-worker")', 'maestro-worker')
        .option('--name <name>', 'Session name (auto-generated if not provided)')
        .option('--reason <reason>', 'Reason for spawning this session')
        .option('--include-related', 'Include related tasks in context')
        .option('--orchestrator-strategy <strategy>', 'Orchestrator strategy (default, intelligent-batching, or dag)')
        .action(async (cmdOpts) => {
            await guardCommand('session:spawn');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;

            try {
                const taskId = validateTaskId(cmdOpts.task, config.taskIds);
                const skill = cmdOpts.skill;

                const spinner = !isJson ? ora('Fetching task details...').start() : null;

                // Fetch task from server
                const task: any = await api.get(`/api/tasks/${taskId}`);
                spinner?.stop();

                const projectId = task.projectId;
                if (!projectId) {
                    throw new Error('Task does not have an associated projectId');
                }

                // Build session context
                const spinner2 = !isJson ? ora('Building session context...').start() : null;
                const context = await buildSessionContext(task, {
                    includeRelated: cmdOpts.includeRelated,
                    skill: skill
                });
                spinner2?.stop();

                // Generate session name if not provided
                const sessionName = cmdOpts.name || generateSessionName(task, skill);

                // Prepare spawn request with spawnSource and role
                const role = skill === 'maestro-orchestrator' ? 'orchestrator' : 'worker';
                const spawnRequest: any = {
                    projectId,
                    taskIds: [taskId],
                    role,
                    spawnSource: 'session',                     // Session-initiated spawn
                    sessionId: config.sessionId || undefined,   // Parent session ID
                    skills: [skill],
                    sessionName: sessionName,
                    context: {
                        ...context,
                        reason: cmdOpts.reason || `Execute task: ${task.title}`  // Move reason into context
                    }
                };

                // Include orchestratorStrategy when spawning an orchestrator
                if (role === 'orchestrator' && cmdOpts.orchestratorStrategy) {
                    spawnRequest.orchestratorStrategy = cmdOpts.orchestratorStrategy;
                }

                const spinner3 = !isJson ? ora('Requesting session spawn...').start() : null;
                const result: any = await api.post('/api/sessions/spawn', spawnRequest);
                spinner3?.succeed('Spawn request sent');

                if (isJson) {
                    outputJSON(result);
                } else {
                    console.log(`Spawning ${skill} session: ${sessionName}`);
                    console.log(`   Task: ${task.title}`);
                    console.log(`   Priority: ${task.priority}`);
                    console.log(`   Session ID: ${result.sessionId}`);
                    console.log('');
                    console.log('   Waiting for Agents UI to open terminal window...');
                }
            } catch (err) {
                if (isJson) {
                    outputErrorJSON(err);
                } else {
                    handleError(err, false);
                }
            }
        });

    // session register - Register current session with server (called by SessionStart hook)
    session
        .command('register')
        .description('Register current session with server (called by SessionStart hook)')
        .action(async () => {
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;
            const projectId = config.projectId;
            const role = process.env.MAESTRO_ROLE || 'worker';
            const taskIds = config.taskIds;
            const strategy = config.strategy;

            if (!isJson) {
                console.log(`[session:register] Hook fired (SessionStart)`);
                console.log(`[session:register]    Session ID: ${sessionId || '(not set)'}`);
                console.log(`[session:register]    Project ID: ${projectId || '(not set)'}`);
                console.log(`[session:register]    Role: ${role}`);
                console.log(`[session:register]    Task IDs: ${taskIds?.join(', ') || '(none)'}`);
                console.log(`[session:register]    Strategy: ${strategy || '(not set)'}`);
            }

            if (!sessionId) {
                if (!isJson) {
                    console.error('[session:register] ABORT: MAESTRO_SESSION_ID not set');
                }
                process.exit(1);
            }

            try {
                // Check if session already exists (created by spawn endpoint)
                let sessionExists = false;
                try {
                    if (!isJson) console.log(`[session:register]    GET /api/sessions/${sessionId} ...`);
                    await api.get(`/api/sessions/${sessionId}`);
                    sessionExists = true;
                    if (!isJson) console.log(`[session:register]    Session exists on server`);
                } catch {
                    if (!isJson) console.log(`[session:register]    Session not found on server`);
                }

                if (sessionExists) {
                    if (!isJson) console.log(`[session:register]    PATCH /api/sessions/${sessionId} -> status: 'working'`);
                    await api.patch(`/api/sessions/${sessionId}`, {
                        status: 'working',
                    });
                    if (!isJson) console.log(`[session:register]    Session status updated to 'working'`);
                } else {
                    if (!isJson) console.log(`[session:register]    POST /api/sessions (creating new session)`);
                    await api.post('/api/sessions', {
                        id: sessionId,
                        projectId,
                        taskIds,
                        name: `${role}: ${sessionId.substring(0, 16)}`,
                        status: 'working',
                        strategy,
                        metadata: { role },
                    });
                    if (!isJson) console.log(`[session:register]    New session created with status 'working'`);
                }

                if (!isJson) {
                    console.log(`[session:register] Done: session ${sessionId} registered`);
                } else {
                    outputJSON({ sessionId, status: 'registered' });
                }
            } catch (err: any) {
                if (!isJson) {
                    console.error(`[session:register] FAILED: ${err.message}`);
                }
                process.exit(0);
            }
        });

    // session complete - Mark session as completed (called by SessionEnd hook)
    session
        .command('complete')
        .description('Mark session as completed (called by SessionEnd hook)')
        .action(async () => {
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!isJson) {
                console.log(`[session:complete] Hook fired (SessionEnd)`);
                console.log(`[session:complete]    Session ID: ${sessionId || '(not set)'}`);
            }

            if (!sessionId) {
                if (!isJson) console.log(`[session:complete] ABORT: no session ID`);
                process.exit(0);
            }

            try {
                if (!isJson) console.log(`[session:complete]    PATCH /api/sessions/${sessionId} -> status: 'completed'`);
                await api.patch(`/api/sessions/${sessionId}`, {
                    status: 'completed',
                    completedAt: Date.now(),
                });

                if (!isJson) {
                    console.log(`[session:complete] Done: session ${sessionId} completed`);
                } else {
                    outputJSON({ sessionId, status: 'completed' });
                }
            } catch (err: any) {
                if (!isJson) {
                    console.error(`[session:complete] FAILED: ${err.message}`);
                }
                process.exit(0);
            }
        });

    // session needs-input - Mark session as needing user input (called by Stop hook)
    session
        .command('needs-input')
        .description('Mark session as needing user input (called by Stop hook)')
        .action(async () => {
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!isJson) {
                console.log(`[session:needs-input] Hook fired (Stop)`);
                console.log(`[session:needs-input]    Session ID: ${sessionId || '(not set)'}`);
            }

            if (!sessionId) {
                if (!isJson) console.log(`[session:needs-input] ABORT: no session ID`);
                process.exit(0);
            }

            try {
                if (!isJson) console.log(`[session:needs-input]    PATCH /api/sessions/${sessionId} -> needsInput: { active: true }`);
                await api.patch(`/api/sessions/${sessionId}`, {
                    needsInput: {
                        active: true,
                        message: 'Session is waiting for user input',
                        since: Date.now(),
                    },
                    timeline: [{
                        id: `evt-${Date.now()}`,
                        type: 'needs_input',
                        timestamp: Date.now(),
                        message: 'Session is waiting for user input',
                    }],
                });

                if (!isJson) {
                    console.log(`[session:needs-input] Done: session ${sessionId} marked as needsInput`);
                } else {
                    outputJSON({ sessionId, needsInput: true });
                }
            } catch (err: any) {
                if (!isJson) {
                    console.error(`[session:needs-input] FAILED: ${err.message}`);
                }
                process.exit(0);
            }
        });

    // session resume-working - Resume session to working status (called by UserPromptSubmit hook)
    session
        .command('resume-working')
        .description('Resume session to working status (called by UserPromptSubmit hook)')
        .action(async () => {
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!isJson) {
                console.log(`[session:resume-working] Hook fired (UserPromptSubmit)`);
                console.log(`[session:resume-working]    Session ID: ${sessionId || '(not set)'}`);
            }

            if (!sessionId) {
                if (!isJson) console.log(`[session:resume-working] ABORT: no session ID`);
                process.exit(0);
            }

            try {
                if (!isJson) console.log(`[session:resume-working]    PATCH /api/sessions/${sessionId} -> status: 'working', needsInput: { active: false }`);
                await api.patch(`/api/sessions/${sessionId}`, {
                    status: 'working',
                    needsInput: { active: false },
                });

                if (!isJson) {
                    console.log(`[session:resume-working] Done: session ${sessionId} resumed to working`);
                } else {
                    outputJSON({ sessionId, status: 'working' });
                }
            } catch (err: any) {
                if (!isJson) {
                    console.error(`[session:resume-working] FAILED: ${err.message}`);
                }
                process.exit(0);
            }
        });
}
