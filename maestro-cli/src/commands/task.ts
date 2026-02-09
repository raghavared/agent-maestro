import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputErrorJSON, outputKeyValue, outputTaskTree } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerTaskCommands(program: Command) {
    const task = program.command('task').description('Manage tasks');

    task.command('list [taskId]')
        .description('List tasks with children. Optionally show a specific task and its subtree')
        .option('--status <status>', 'Filter by status')
        .option('--priority <priority>', 'Filter by priority')
        .option('--all', 'Show all tasks (ignore project context)')
        .action(async (taskId, cmdOpts) => {
            await guardCommand('task:list');
            const globalOpts = program.opts();
            const projectId = cmdOpts.all ? undefined : (globalOpts.project || config.projectId);
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching tasks...').start() : null;

            try {
                let tasks: any[] = [];

                if (taskId) {
                    // Fetch specific task from server
                    const t: any = await api.get(`/api/tasks/${taskId}`);
                    // Fetch children from server
                    try {
                        const children = await api.get(`/api/tasks/${taskId}/children`);
                        t.children = children;
                    } catch {
                        t.children = [];
                    }
                    tasks = [t];
                } else {
                    // Fetch all tasks from server
                    let endpoint = '/api/tasks';
                    const queryParts = [];
                    if (projectId) queryParts.push(`projectId=${projectId}`);
                    if (queryParts.length) endpoint += '?' + queryParts.join('&');
                    tasks = await api.get(endpoint);

                    // Apply filters
                    if (cmdOpts.status) tasks = tasks.filter(t => t.status === cmdOpts.status);
                    if (cmdOpts.priority) tasks = tasks.filter(t => t.priority === cmdOpts.priority);
                }

                spinner?.stop();

                if (isJson) {
                    outputJSON(tasks);
                } else {
                    if (tasks.length === 0) {
                        console.log('No tasks found.');
                    } else {
                        outputTaskTree(tasks);
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('create [title]')
        .description('Create a new task')
        .option('-t, --title <title>', 'Task title')
        .option('-d, --desc <description>', 'Task description')
        .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
        .option('--parent <parentId>', 'Parent task ID (creates child task)')
        .action(async (title, cmdOpts) => {
            await guardCommand('task:create');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            const finalTitle = title || cmdOpts.title;

            if (!finalTitle) {
                const err = { message: 'Task title is required. Use "maestro task create <title>" or "maestro task create --title <title>".' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            if (!projectId) {
                const err = { message: 'Project ID is required. Use --project or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Creating task...').start() : null;

            try {
                // Create task via server API
                const newTask: any = await api.post('/api/tasks', {
                    projectId,
                    title: finalTitle,
                    description: cmdOpts.desc || '',
                    priority: cmdOpts.priority,
                    parentId: cmdOpts.parent,
                });

                spinner?.succeed('Task created');

                if (isJson) {
                    outputJSON(newTask);
                } else {
                    outputKeyValue('ID', newTask.id);
                    outputKeyValue('Title', newTask.title);
                    if (cmdOpts.parent) {
                        outputKeyValue('Parent', cmdOpts.parent);
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('get [id]')
        .description('Get task details')
        .action(async (id) => {
             await guardCommand('task:get');
             const globalOpts = program.opts();
             const isJson = globalOpts.json;
             if (!id) {
                 if (config.taskIds.length === 1) {
                     id = config.taskIds[0];
                 } else {
                     const err = { message: 'Task ID required or context must have exactly one task.' };
                     if (isJson) { outputErrorJSON(err); process.exit(1); }
                     else { console.error(err.message); process.exit(1); }
                 }
             }

             const spinner = !isJson ? ora('Fetching task...').start() : null;
             try {
                 // Fetch from server
                 const t: any = await api.get(`/api/tasks/${id}`);

                 spinner?.stop();
                 if (isJson) {
                     outputJSON(t);
                 } else {
                     outputKeyValue('ID', t.id);
                     outputKeyValue('Title', t.title);
                     outputKeyValue('Status', t.status);
                     if (t.taskSessionStatuses && Object.keys(t.taskSessionStatuses).length > 0) {
                         const entries = Object.entries(t.taskSessionStatuses as Record<string, string>);
                         if (entries.length === 1) {
                             outputKeyValue('Session Status', `${entries[0][1]} (${entries[0][0]})`);
                         } else {
                             outputKeyValue('Session Statuses', '');
                             for (const [sid, status] of entries) {
                                 outputKeyValue(`  ${sid}`, status as string);
                             }
                         }
                     }
                     outputKeyValue('Priority', t.priority);
                     outputKeyValue('Description', t.description || '');
                 }
             } catch (err) {
                 spinner?.stop();
                 handleError(err, isJson);
             }
        });

    task.command('update <id>')
        .description('Update a task')
        .option('--status <status>', 'New status (todo, in_progress, completed, cancelled, blocked)')
        .option('--priority <priority>', 'New priority')
        .option('--title <title>', 'New title')
        .action(async (id, cmdOpts) => {
            await guardCommand('task:update');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Updating task...').start() : null;

            try {
                const sessionId = config.sessionId;
                const updateData: Record<string, any> = {};

                if (cmdOpts.status) updateData.status = cmdOpts.status;
                if (cmdOpts.priority) updateData.priority = cmdOpts.priority;
                if (cmdOpts.title) updateData.title = cmdOpts.title;

                // Update via server API
                const updated = await api.patch(`/api/tasks/${id}`, updateData);

                // Post timeline event if running from a session (orchestrator status change audit trail)
                if (sessionId && cmdOpts.status) {
                    try {
                        await api.post(`/api/sessions/${sessionId}/timeline`, {
                            type: 'task_status_changed',
                            message: `Status changed to ${cmdOpts.status}`,
                            taskId: id,
                        });
                    } catch {
                        // Don't fail the command if timeline post fails
                    }
                }

                spinner?.succeed('Task updated');

                if (isJson) outputJSON(updated);
                else {
                    console.log('Task updated successfully.');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('complete <id>')
        .description('Mark task as completed')
        .action(async (id) => {
            await guardCommand('task:complete');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Completing task...').start() : null;
            try {
                const sessionId = config.sessionId;

                // Always update task.status (guardCommand blocks workers)
                const updated = await api.patch(`/api/tasks/${id}`, {
                    status: 'completed',
                });

                // Post timeline event if running from a session (orchestrator audit trail)
                if (sessionId) {
                    try {
                        await api.post(`/api/sessions/${sessionId}/timeline`, {
                            type: 'task_status_changed',
                            message: 'Status changed to completed',
                            taskId: id,
                        });
                    } catch {
                        // Don't fail the command if timeline post fails
                    }
                }

                spinner?.succeed('Task completed');
                if (isJson) outputJSON(updated);
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('block <id>')
        .description('Mark task as blocked with a reason')
        .requiredOption('--reason <reason>', 'Reason for blocking')
        .action(async (id, cmdOpts) => {
            await guardCommand('task:block');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Blocking task...').start() : null;
            try {
                const sessionId = config.sessionId;

                // Always update task.status (guardCommand blocks workers)
                await api.patch(`/api/tasks/${id}`, {
                    status: 'blocked',
                });

                // Post timeline event if running from a session (orchestrator audit trail)
                if (sessionId) {
                    try {
                        await api.post(`/api/sessions/${sessionId}/timeline`, {
                            type: 'task_status_changed',
                            message: `Status changed to blocked: ${cmdOpts.reason}`,
                            taskId: id,
                        });
                    } catch {
                        // Don't fail the command if timeline post fails
                    }
                }

                spinner?.succeed('Task blocked');

                if (isJson) {
                    outputJSON({ success: true, taskId: id, status: 'blocked', reason: cmdOpts.reason });
                } else {
                    console.log(`Task ${id} marked as blocked`);
                    console.log(`   Reason: ${cmdOpts.reason}`);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('children <taskId>')
        .description('List child tasks of a parent task')
        .option('--recursive', 'Include all descendants (children, grandchildren, etc.)')
        .action(async (taskId, cmdOpts) => {
            await guardCommand('task:children');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching child tasks...').start() : null;

            try {
                let children: any[] = [];

                if (cmdOpts.recursive) {
                    // Recursively fetch all descendants via server
                    const fetchDescendants = async (parentId: string): Promise<any[]> => {
                        const directChildren: any[] = await api.get(`/api/tasks/${parentId}/children`);
                        let descendants = [...directChildren];
                        for (const child of directChildren) {
                            const childDescendants = await fetchDescendants(child.id);
                            descendants = descendants.concat(childDescendants);
                        }
                        return descendants;
                    };
                    children = await fetchDescendants(taskId);
                } else {
                    children = await api.get(`/api/tasks/${taskId}/children`);
                }

                spinner?.stop();

                if (isJson) {
                    outputJSON(children);
                } else {
                    if (children.length === 0) {
                        console.log(`No child tasks found for ${taskId}`);
                    } else {
                        console.log(`\nChild Tasks of ${taskId} (${children.length}):`);
                        if (cmdOpts.recursive) {
                            outputTaskTree(children);
                        } else {
                            children.forEach((child: any) => {
                                const statusIcon = child.status === 'completed' ? '✅' :
                                                  child.status === 'in_progress' ? '🔄' :
                                                  child.status === 'blocked' ? '🚫' :
                                                  child.status === 'cancelled' ? '⊘' :
                                                  child.status === 'todo' ? '⏳' : '⬜';
                                console.log(`  ${statusIcon} [${child.id}] ${child.title} (${child.status})`);
                            });
                        }
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // task report <subcommand> — report task-session status
    const taskReport = task.command('report').description('Report task-session status');

    taskReport.command('progress <taskId> <message>')
        .description('Report work progress on a task')
        .action(async (taskId: string, message: string) => {
            await guardCommand('task:report:progress');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Reporting task progress...').start() : null;
            try {
                await api.patch(`/api/tasks/${taskId}`, {
                    sessionStatus: 'working',
                    updateSource: 'session',
                    sessionId,
                });

                await api.post(`/api/sessions/${sessionId}/timeline`, {
                    type: 'progress',
                    message,
                    taskId,
                });

                spinner?.succeed('Task progress reported');
                if (isJson) {
                    outputJSON({ success: true, taskId, sessionStatus: 'working', sessionId });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    taskReport.command('complete <taskId> <summary>')
        .description('Report task completion (does NOT complete session)')
        .action(async (taskId: string, summary: string) => {
            await guardCommand('task:report:complete');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Reporting task completion...').start() : null;
            try {
                await api.patch(`/api/tasks/${taskId}`, {
                    sessionStatus: 'completed',
                    updateSource: 'session',
                    sessionId,
                });

                await api.post(`/api/sessions/${sessionId}/timeline`, {
                    type: 'task_completed',
                    message: summary,
                    taskId,
                });

                spinner?.succeed('Task completion reported');
                if (isJson) {
                    outputJSON({ success: true, taskId, sessionStatus: 'completed', sessionId });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    taskReport.command('blocked <taskId> <reason>')
        .description('Report task is blocked')
        .action(async (taskId: string, reason: string) => {
            await guardCommand('task:report:blocked');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Reporting task blocked...').start() : null;
            try {
                await api.patch(`/api/tasks/${taskId}`, {
                    sessionStatus: 'blocked',
                    updateSource: 'session',
                    sessionId,
                });

                await api.post(`/api/sessions/${sessionId}/timeline`, {
                    type: 'task_blocked',
                    message: reason,
                    taskId,
                });

                spinner?.succeed('Task blocked reported');
                if (isJson) {
                    outputJSON({ success: true, taskId, sessionStatus: 'blocked', sessionId });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    taskReport.command('error <taskId> <description>')
        .description('Report error on task')
        .action(async (taskId: string, description: string) => {
            await guardCommand('task:report:error');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const sessionId = config.sessionId;

            if (!sessionId) {
                const err = { message: 'No session context found. MAESTRO_SESSION_ID must be set.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Reporting task error...').start() : null;
            try {
                await api.patch(`/api/tasks/${taskId}`, {
                    sessionStatus: 'failed',
                    updateSource: 'session',
                    sessionId,
                });

                await api.post(`/api/sessions/${sessionId}/timeline`, {
                    type: 'error',
                    message: description,
                    taskId,
                });

                spinner?.succeed('Task error reported');
                if (isJson) {
                    outputJSON({ success: true, taskId, sessionStatus: 'failed', sessionId });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    task.command('tree')
        .description('Show hierarchical tree of all project tasks')
        .option('--root <taskId>', 'Start from specific task')
        .option('--depth <n>', 'Maximum depth to display', parseInt)
        .option('--status <status>', 'Filter by status')
        .action(async (cmdOpts) => {
            await guardCommand('task:tree');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;
            const spinner = !isJson ? ora('Building task tree...').start() : null;

            try {
                if (!projectId && !cmdOpts.root) {
                    const err = { message: 'Project ID is required. Use --project or set MAESTRO_PROJECT_ID.' };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                }

                let tasks: any[] = [];

                if (cmdOpts.root) {
                    // Get specific task from server
                    const rootTask = await api.get(`/api/tasks/${cmdOpts.root}`);
                    tasks = [rootTask];
                } else {
                    // Get all root tasks (no parent) for the project from server
                    const allTasks: any[] = await api.get(`/api/tasks?projectId=${projectId}`);
                    tasks = allTasks.filter((t: any) => !t.parentId);
                }

                // Apply status filter
                if (cmdOpts.status) {
                    tasks = tasks.filter((t: any) => t.status === cmdOpts.status);
                }

                // Build tree structure recursively via server
                const buildTree = async (taskId: string, depth: number = 0): Promise<any> => {
                    if (cmdOpts.depth && depth >= cmdOpts.depth) return null;

                    const task: any = await api.get(`/api/tasks/${taskId}`);
                    const children: any[] = await api.get(`/api/tasks/${taskId}/children`);

                    const childTrees = await Promise.all(
                        children.map((child: any) => buildTree(child.id, depth + 1))
                    );

                    return { ...task, children: childTrees.filter(Boolean) };
                };

                const tree = await Promise.all(tasks.map(t => buildTree(t.id)));

                spinner?.stop();

                if (isJson) {
                    outputJSON(tree.filter(Boolean));
                } else {
                    if (tree.length === 0) {
                        console.log('No tasks found.');
                    } else {
                        console.log(`\nProject Task Tree (${projectId || cmdOpts.root}):\n`);
                        outputTaskTree(tree.filter(Boolean));
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });
}
