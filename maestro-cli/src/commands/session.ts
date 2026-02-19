import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputErrorJSON, outputKeyValue } from '../utils/formatter.js';
import { validateRequired, validateTaskId } from '../utils/validation.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import { executeReport } from './report.js';
import ora from 'ora';
import { readFileSync } from 'fs';
import WebSocket from 'ws';
import chalk from 'chalk';

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
            'Work through the task systematically',
            'Report progress using maestro session report progress',
            'Create child tasks if needed with maestro task create --parent <taskId>',
            'Run maestro session report complete when all work is verified'
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
        .option('--team-member-id <tmId>', 'Filter by team member ID')
        .option('--active', 'Show only active sessions (working, idle, spawning)')
        .option('--siblings', 'Show sibling sessions (spawned by the same coordinator)')
        .option('--my-workers', 'Show worker sessions spawned by this session')
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
                if (cmdOpts.active) queryParts.push(`active=true`);
                if (cmdOpts.siblings) {
                    const coordinatorId = config.coordinatorSessionId;
                    if (!coordinatorId) {
                        spinner?.stop();
                        console.error('No coordinator session ID found (MAESTRO_COORDINATOR_SESSION_ID not set).');
                        process.exit(1);
                    }
                    queryParts.push(`parentSessionId=${coordinatorId}`);
                    if (!cmdOpts.active) queryParts.push('active=true');
                }
                if (cmdOpts.myWorkers) {
                    const myId = config.sessionId;
                    if (!myId) {
                        spinner?.stop();
                        console.error('No session ID found (MAESTRO_SESSION_ID not set).');
                        process.exit(1);
                    }
                    queryParts.push(`parentSessionId=${myId}`);
                    if (!cmdOpts.active) queryParts.push('active=true');
                }
                if (queryParts.length) endpoint += '?' + queryParts.join('&');

                let sessions: any[] = await api.get(endpoint);

                // Client-side filter by teamMemberId (server doesn't support this filter yet)
                if (cmdOpts.teamMemberId) {
                    sessions = sessions.filter(s => s.teamMemberId === cmdOpts.teamMemberId);
                }

                spinner?.stop();

                if (isJson) {
                    outputJSON(sessions);
                } else {
                    if (sessions.length === 0) {
                        console.log('No sessions found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Status', 'Team Member', 'Tasks'],
                            sessions.map(s => [
                                s.id,
                                s.name,
                                s.status,
                                s.teamMemberSnapshot?.name || s.teamMemberId || '-',
                                (s.taskIds || []).length,
                            ])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    session.command('siblings')
        .description('List sibling sessions — other active sessions spawned by the same coordinator')
        .action(async () => {
            await guardCommand('session:siblings');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;

            const coordinatorId = config.coordinatorSessionId;
            if (!coordinatorId) {
                if (isJson) {
                    outputJSON([]);
                } else {
                    console.log('No coordinator session found (not spawned by a coordinator). No siblings.');
                }
                return;
            }

            const myId = config.sessionId;
            const projectId = globalOpts.project || config.projectId;

            const spinner = !isJson ? ora('Fetching sibling sessions...').start() : null;
            try {
                const queryParts = [`parentSessionId=${coordinatorId}`, 'active=true'];
                if (projectId) queryParts.push(`projectId=${projectId}`);

                let sessions: any[] = await api.get(`/api/sessions?${queryParts.join('&')}`);

                // Exclude this session from the list
                if (myId) sessions = sessions.filter((s: any) => s.id !== myId);

                spinner?.stop();

                if (isJson) {
                    outputJSON(sessions);
                } else {
                    if (sessions.length === 0) {
                        console.log('No sibling sessions found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Role', 'Status', 'Tasks'],
                            sessions.map((s: any) => [
                                s.id,
                                s.name,
                                s.teamMemberSnapshot?.name || s.teamMemberId || '-',
                                s.status,
                                (s.taskIds || []).join(', ') || '-',
                            ])
                        );
                        console.log('\nTo message a sibling:');
                        console.log('  maestro session prompt <ID> --message "<your message>"');
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    session.command('info [sessionId]')
        .description('Get session info (defaults to current session, or specify a session ID)')
        .action(async (targetSessionId?: string) => {
            await guardCommand('session:info');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = targetSessionId || config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. Provide a session ID argument or set MAESTRO_SESSION_ID.' };
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

    // session docs <subcommand> — manage session documentation
    const sessionDocs = session.command('docs').description('Manage session documentation');

    sessionDocs.command('add <title>')
        .description('Add a doc entry to the current session')
        .requiredOption('--file <filePath>', 'File path for the doc')
        .option('--content <content>', 'Content of the doc (reads file if not provided)')
        .action(async (title: string, cmdOpts: any) => {
            await guardCommand('session:docs:add');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            let content = cmdOpts.content;
            if (!content && cmdOpts.file) {
                try {
                    content = readFileSync(cmdOpts.file, 'utf-8');
                } catch (e: any) {
                    const err = { message: `Failed to read file: ${e.message}` };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                }
            }

            const spinner = !isJson ? ora('Adding doc to session...').start() : null;
            try {
                const doc = await api.post(`/api/sessions/${sessionId}/docs`, {
                    title,
                    filePath: cmdOpts.file,
                    content,
                });

                spinner?.succeed('Doc added to session');

                if (isJson) {
                    outputJSON(doc);
                } else {
                    outputKeyValue('Title', title);
                    outputKeyValue('File', cmdOpts.file);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    sessionDocs.command('list')
        .description('List docs for the current session')
        .action(async () => {
            await guardCommand('session:docs:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching session docs...').start() : null;
            try {
                const docs: any[] = await api.get(`/api/sessions/${sessionId}/docs`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(docs);
                } else {
                    if (docs.length === 0) {
                        console.log('No docs found for this session.');
                    } else {
                        outputTable(
                            ['ID', 'Title', 'File Path', 'Added At'],
                            docs.map(d => [d.id, d.title, d.filePath, new Date(d.addedAt).toLocaleString()])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // session report <subcommand> — report session status
    const sessionReport = session.command('report').description('Report session status updates');

    sessionReport.command('progress <message>')
        .description('Report work progress')
        .action(async (message: string) => {
            await guardCommand('session:report:progress');
            await executeReport('progress', message, program.opts());
        });

    sessionReport.command('complete <summary>')
        .description('Report completion and mark session as completed')
        .action(async (summary: string) => {
            await guardCommand('session:report:complete');
            await executeReport('complete', summary, program.opts());
        });

    sessionReport.command('blocked <reason>')
        .description('Report blocker')
        .action(async (reason: string) => {
            await guardCommand('session:report:blocked');
            await executeReport('blocked', reason, program.opts());
        });

    sessionReport.command('error <description>')
        .description('Report error encountered')
        .action(async (description: string) => {
            await guardCommand('session:report:error');
            await executeReport('error', description, program.opts());
        });

    session.command('watch <sessionIds>')
        .description('Watch spawned sessions in real-time via WebSocket (comma-separated IDs)')
        .option('--timeout <ms>', 'Auto-exit after N milliseconds (0 = no timeout)', '0')
        .action(async (sessionIds: string, cmdOpts: any) => {
            await guardCommand('session:watch');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;

            const ids = sessionIds.split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length === 0) {
                console.error('Error: at least one session ID is required.');
                process.exit(1);
            }

            // Derive WebSocket URL from API URL
            const apiUrl = config.apiUrl;
            const wsUrl = apiUrl.replace(/^http/, 'ws');

            if (!isJson) {
                console.log(`[session:watch] Watching ${ids.length} session(s): ${ids.join(', ')}`);
                console.log(`[session:watch] Connecting to ${wsUrl} ...`);
            }

            // Track session statuses for completion detection
            const sessionStatuses = new Map<string, string>();
            for (const id of ids) {
                sessionStatuses.set(id, 'unknown');
            }

            const ws = new WebSocket(wsUrl);

            const timeoutMs = parseInt(cmdOpts.timeout || '0', 10);
            let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            };

            ws.on('open', () => {
                if (!isJson) {
                    console.log(`[session:watch] Connected. Listening for events...`);
                }

                // Subscribe to specific sessions
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    sessionIds: ids,
                }));

                if (timeoutMs > 0) {
                    timeoutHandle = setTimeout(() => {
                        if (!isJson) console.log(`[session:watch] Timeout reached (${timeoutMs}ms). Exiting.`);
                        cleanup();
                    }, timeoutMs);
                }
            });

            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const event = msg.event || msg.type;
                    const payload = msg.data;

                    if (!event || !payload) return;

                    // Filter: only show events for watched sessions
                    const eventSessionId = payload.id || payload.sessionId;
                    if (!eventSessionId || !ids.includes(eventSessionId)) return;

                    if (isJson) {
                        // JSON mode: output one JSON object per line (JSONL)
                        console.log(JSON.stringify({ event, sessionId: eventSessionId, data: payload, timestamp: msg.timestamp }));
                    } else {
                        // Human-readable output
                        const ts = new Date(msg.timestamp || Date.now()).toLocaleTimeString();

                        if (event === 'session:updated') {
                            const status = payload.status;
                            const prevStatus = sessionStatuses.get(eventSessionId);
                            sessionStatuses.set(eventSessionId, status);

                            // Show status changes
                            if (prevStatus !== status) {
                                console.log(`[${ts}] ${eventSessionId} status: ${status}`);
                            }

                            // Show latest timeline event if present
                            const timeline = payload.timeline;
                            if (timeline && timeline.length > 0) {
                                const latest = timeline[timeline.length - 1];
                                if (latest.type === 'progress' || latest.type === 'task_completed' || latest.type === 'task_blocked' || latest.type === 'error') {
                                    console.log(`[${ts}] ${eventSessionId} ${latest.type}: ${latest.message || ''}`);
                                }
                            }

                            // Show needsInput
                            if (payload.needsInput?.active) {
                                console.log(`[${ts}] ${eventSessionId} NEEDS INPUT: ${payload.needsInput.message || '(no message)'}`);
                            }
                        } else if (event === 'notify:progress') {
                            console.log(`[${ts}] ${eventSessionId} progress: ${payload.message || ''}`);
                        } else if (event === 'notify:session_completed') {
                            console.log(`[${ts}] ${eventSessionId} COMPLETED: ${payload.name || ''}`);
                        } else if (event === 'notify:session_failed') {
                            console.log(`[${ts}] ${eventSessionId} FAILED: ${payload.name || ''}`);
                        } else if (event === 'notify:needs_input') {
                            console.log(`[${ts}] ${eventSessionId} NEEDS INPUT: ${payload.message || ''}`);
                        } else {
                            // Generic event
                            console.log(`[${ts}] ${eventSessionId} ${event}`);
                        }
                    }

                    // Check if ALL watched sessions have completed/failed
                    const allDone = ids.every(id => {
                        const s = sessionStatuses.get(id);
                        return s === 'completed' || s === 'failed' || s === 'stopped';
                    });
                    if (allDone) {
                        if (!isJson) {
                            console.log(`[session:watch] All watched sessions have finished.`);
                        }
                        cleanup();
                    }
                } catch {
                    // ignore parse errors
                }
            });

            ws.on('error', (err: Error) => {
                if (!isJson) {
                    console.error(`[session:watch] WebSocket error: ${err.message}`);
                }
            });

            ws.on('close', () => {
                if (!isJson) {
                    console.log(`[session:watch] Disconnected.`);
                }
            });

            // Keep the process alive until WS closes
            await new Promise<void>((resolve) => {
                ws.on('close', resolve);
            });
        });

    session.command('spawn')
        .description('Spawn a new session with full task context')
        .requiredOption('--task <id>', 'Task ID to assign to the new session')
        .option('--skill <skill>', 'Skill to load (defaults to "maestro-worker")', 'maestro-worker')
        .option('--name <name>', 'Session name (auto-generated if not provided)')
        .option('--reason <reason>', 'Reason for spawning this session')
        .option('--include-related', 'Include related tasks in context')
        .option('--agent-tool <tool>', 'Agent tool to use (claude-code, codex, or gemini)')
        .option('--model <model>', 'Model to use (e.g. sonnet, opus, haiku, or native model names)')
        .option('--team-member-id <id>', 'Team member ID to run this session')
        .option('--subject <subject>', 'Initial directive subject (embedded in manifest for guaranteed delivery)')
        .option('--message <message>', 'Initial directive message body (requires --subject)')
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

                // Validate agent tool if provided
                const validAgentTools = ['claude-code', 'codex', 'gemini'];
                if (cmdOpts.agentTool && !validAgentTools.includes(cmdOpts.agentTool)) {
                    throw new Error(`Invalid agent tool "${cmdOpts.agentTool}". Must be one of: ${validAgentTools.join(', ')}`);
                }

                // Prepare spawn request with spawnSource and mode
                const mode = skill === 'maestro-orchestrator' ? 'coordinate' : 'execute';
                const spawnRequest: any = {
                    projectId,
                    taskIds: [taskId],
                    mode,
                    spawnSource: 'session',                     // Session-initiated spawn
                    sessionId: config.sessionId || undefined,   // Parent session ID
                    skills: [skill],
                    sessionName: sessionName,
                    context: {
                        ...context,
                        reason: cmdOpts.reason || `Execute task: ${task.title}`  // Move reason into context
                    }
                };

                // Include initial directive if --subject is set
                if (cmdOpts.subject) {
                    spawnRequest.initialDirective = {
                        subject: cmdOpts.subject,
                        message: cmdOpts.message || '',
                        fromSessionId: config.sessionId || undefined,
                    };
                }

                // Include team member ID if specified
                if (cmdOpts.teamMemberId) {
                    spawnRequest.teamMemberId = cmdOpts.teamMemberId;
                }

                // Include agent tool if specified
                if (cmdOpts.agentTool) {
                    spawnRequest.agentTool = cmdOpts.agentTool;
                }

                // Include model if specified
                if (cmdOpts.model) {
                    spawnRequest.model = cmdOpts.model;
                }

                const spinner3 = !isJson ? ora('Requesting session spawn...').start() : null;
                const result: any = await api.post('/api/sessions/spawn', spawnRequest);
                spinner3?.succeed('Spawn request sent');

                if (isJson) {
                    outputJSON(result);
                } else {
                    const toolDisplay = cmdOpts.agentTool || 'claude-code';
                    const modelDisplay = cmdOpts.model || 'sonnet';
                    console.log(`Spawning ${skill} session: ${sessionName}`);
                    console.log(`   Task: ${task.title}`);
                    console.log(`   Priority: ${task.priority}`);
                    console.log(`   Agent Tool: ${toolDisplay}`);
                    console.log(`   Model: ${modelDisplay}`);
                    console.log(`   Session ID: ${result.sessionId}`);
                    console.log('');
                    console.log('   Waiting for Agent Maestro to open terminal window...');
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
            const mode = process.env.MAESTRO_MODE || 'execute';
            const taskIds = config.taskIds;

            if (!sessionId) {
                process.exit(1);
            }

            try {
                // Check if session already exists (created by spawn endpoint)
                let sessionExists = false;
                try {
                    await api.get(`/api/sessions/${sessionId}`);
                    sessionExists = true;
                } catch {
                    // session not found on server
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
                        name: `${mode}: ${sessionId.substring(0, 16)}`,
                        status: 'working',
                        metadata: { mode },
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

    session.command('logs [ids]')
        .description('Read text output from session JSONL logs (for coordinator observation)')
        .option('--my-workers', 'Read logs for all workers under this coordinator session')
        .option('--last <n>', 'Number of text entries per session (default 5)', '5')
        .option('--full', 'Return full untruncated text entries')
        .option('--max-length <n>', 'Max character length per text entry (default 150)')
        .action(async (ids: string | undefined, cmdOpts: any) => {
            await guardCommand('session:logs');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const last = parseInt(cmdOpts.last || '5', 10);

            // Build maxLength query param
            let maxLengthParam = '';
            if (cmdOpts.full) {
                maxLengthParam = '&maxLength=0';
            } else if (cmdOpts.maxLength) {
                maxLengthParam = `&maxLength=${parseInt(cmdOpts.maxLength, 10)}`;
            }

            try {
                let endpoint: string;
                if (cmdOpts.myWorkers) {
                    const myId = config.sessionId;
                    if (!myId) {
                        console.error('Error: MAESTRO_SESSION_ID not set.');
                        process.exit(1);
                    }
                    endpoint = `/api/sessions/log-digests?parentSessionId=${myId}&last=${last}${maxLengthParam}`;
                } else if (ids) {
                    const sessionIds = ids.split(',').map(s => s.trim()).filter(Boolean);
                    if (sessionIds.length === 1) {
                        // Single session — use the single endpoint
                        const digest: any = await api.get(`/api/sessions/${sessionIds[0]}/log-digest?last=${last}${maxLengthParam}`);
                        if (isJson) {
                            outputJSON([digest]);
                        } else {
                            printDigest(digest);
                        }
                        return;
                    }
                    endpoint = `/api/sessions/log-digests?sessionIds=${sessionIds.join(',')}&last=${last}${maxLengthParam}`;
                } else {
                    console.error('Error: provide session IDs or --my-workers');
                    process.exit(1);
                    return;
                }

                const digests: any[] = await api.get(endpoint);

                if (isJson) {
                    outputJSON(digests);
                } else {
                    if (digests.length === 0) {
                        console.log('No active worker sessions found.');
                    } else {
                        for (const digest of digests) {
                            printDigest(digest);
                        }
                    }
                }
            } catch (err) {
                handleError(err, isJson);
            }
        });

    session
        .command('prompt <targetSessionId>')
        .description('Send an input prompt to another active Maestro session')
        .requiredOption('--message <message>', 'The prompt message to send')
        .option('--mode <mode>', '"send" (type + Enter) or "paste" (type only)', 'send')
        .action(async (targetSessionId: string, cmdOpts: any) => {
            await guardCommand('session:prompt');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const { message, mode } = cmdOpts;

            if (!['send', 'paste'].includes(mode)) {
                console.error('Error: --mode must be "send" or "paste"');
                process.exit(1);
            }

            const senderSessionId = config.sessionId;
            if (!senderSessionId) {
                console.error('Error: MAESTRO_SESSION_ID not set. Must be run from within a Maestro session.');
                process.exit(1);
            }

            const spinner = !isJson ? ora(`Sending prompt to session ${targetSessionId}...`).start() : null;
            try {
                await api.post(`/api/sessions/${targetSessionId}/prompt`, {
                    content: message,
                    mode,
                    senderSessionId,
                });
                spinner?.succeed(`✓ Prompt sent to session ${targetSessionId}`);
                if (isJson) outputJSON({ success: true, targetSessionId });
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    session
        .command('notify <ids...>')
        .description('Notify one or more sessions — sends a PTY wakeup and stores a mail message')
        .requiredOption('--message <brief>', 'Brief message (injected into PTY + stored as mail)')
        .option('--detail <full>', 'Full detail text (stored in mail only, not injected into PTY)')
        .action(async (ids: string[], cmdOpts: any) => {
            await guardCommand('session:notify');
            const mySessionId = config.sessionId;
            const myName = (config as any).teamMemberName || (config as any).teamMemberSnapshot?.name || config.sessionId || 'Unknown';
            if (!mySessionId) {
                console.error('No session ID — not running inside a session');
                process.exit(1);
            }
            for (const targetId of ids) {
                await api.post(`/api/sessions/${targetId}/mail`, {
                    fromSessionId: mySessionId,
                    fromName: myName,
                    message: cmdOpts.message,
                    ...(cmdOpts.detail ? { detail: cmdOpts.detail } : {}),
                });
            }
            console.log(`Notified ${ids.length} session(s).`);
        });

    const mail = session
        .command('mail')
        .description('Session mail (persistent messages)');

    mail
        .command('read')
        .description('Read unread mail for the current session')
        .action(async () => {
            await guardCommand('session:mail:read');
            const mySessionId = config.sessionId;
            if (!mySessionId) {
                console.error('No session ID — not running inside a session');
                process.exit(1);
            }
            const messages: any[] = await api.get(`/api/sessions/${mySessionId}/mail`);
            if (messages.length === 0) {
                console.log('No unread messages.');
                return;
            }
            console.log(`\n📬 ${messages.length} unread message(s):\n`);
            for (const m of messages) {
                const date = new Date(m.createdAt).toLocaleTimeString();
                console.log(`  [${date}] From: ${m.fromName} (${m.fromSessionId})`);
                console.log(`  ${m.message}`);
                if (m.detail) {
                    console.log(`  Detail: ${m.detail}`);
                }
                console.log();
            }
        });
}

/**
 * Format milliseconds into a human-readable duration string (e.g. "2m 30s").
 */
function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

/**
 * Print a single session log digest in human-readable format.
 */
function printDigest(digest: any): void {
    // State icon and color
    let stateIcon: string;
    let stateLabel: string;
    if (digest.state === 'active') {
        stateIcon = chalk.green('●');
        stateLabel = chalk.green('[active]');
    } else if (digest.state === 'needs_input') {
        stateIcon = chalk.yellow('⚡');
        stateLabel = chalk.yellow.bold('[NEEDS INPUT]');
    } else {
        stateIcon = chalk.gray('○');
        stateLabel = chalk.gray('[idle]');
    }

    // Stuck indicator
    const stuckLabel = digest.stuck ? chalk.red.bold(' ⚠ STUCK') : '';

    // Worker name
    const workerPart = digest.workerName ? `  ${chalk.bold('Worker:')} ${digest.workerName}` : '';

    // Task IDs
    const taskPart = digest.taskIds?.length
        ? `  ${chalk.bold('Tasks:')}  ${digest.taskIds.join(', ')}`
        : '';

    // Last activity
    let lastActivityPart = '';
    if (digest.lastActivityTimestamp) {
        const agoMs = Date.now() - digest.lastActivityTimestamp;
        lastActivityPart = `  ${chalk.bold('Last:')}   ${formatDuration(agoMs)} ago`;
    }

    // Header line
    console.log(`\n${stateIcon} ${chalk.bold(`Session ${digest.sessionId}`)} ${stateLabel}${stuckLabel}`);
    if (workerPart) console.log(workerPart);
    if (taskPart) console.log(taskPart);
    if (lastActivityPart) console.log(lastActivityPart);

    // Stuck details (shown prominently before entries)
    if (digest.stuck) {
        const duration = digest.stuck.silentDurationMs > 0
            ? ` (silent for ${formatDuration(digest.stuck.silentDurationMs)})`
            : '';
        console.log(chalk.red(`  ⚠  ${digest.stuck.warning}${duration}`));
    }

    // needs_input alert
    if (digest.state === 'needs_input') {
        console.log(chalk.yellow('  ⚡ This session is waiting for coordinator input!'));
    }

    // Separator
    console.log(chalk.gray('  ' + '─'.repeat(60)));

    // Entries
    if (digest.entries && digest.entries.length > 0) {
        for (const entry of digest.entries) {
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
            const timeStr = chalk.gray(`[${time}]`);
            if (entry.source === 'assistant') {
                const arrow = chalk.cyan('◀');
                console.log(`  ${timeStr} ${arrow} ${entry.text}`);
            } else {
                const arrow = chalk.magenta('▶');
                console.log(`  ${timeStr} ${arrow} ${chalk.italic(entry.text)}`);
            }
        }
    } else {
        console.log(chalk.gray('  (no text output yet)'));
    }
}
