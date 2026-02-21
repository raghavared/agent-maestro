import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerMasterCommands(program: Command) {
    const master = program.command('master').description('Cross-project master workspace commands');

    master.command('projects')
        .description('List all projects across the workspace')
        .action(async () => {
            await guardCommand('master:projects');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching all projects...').start() : null;

            try {
                const projects: any[] = await api.get('/api/master/projects');

                spinner?.stop();

                if (isJson) {
                    outputJSON(projects);
                } else {
                    if (projects.length === 0) {
                        console.log('No projects found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Working Dir', 'Master'],
                            projects.map(p => [p.id, p.name, p.workingDir, p.isMaster ? 'yes' : ''])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    master.command('tasks')
        .description('List tasks across all projects')
        .option('--project <id>', 'Filter by project ID')
        .action(async (cmdOpts) => {
            await guardCommand('master:tasks');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching tasks...').start() : null;

            try {
                const qs = cmdOpts.project ? `?projectId=${cmdOpts.project}` : '';
                const tasks: any[] = await api.get(`/api/master/tasks${qs}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(tasks);
                } else {
                    if (tasks.length === 0) {
                        console.log('No tasks found.');
                    } else {
                        outputTable(
                            ['ID', 'Title', 'Status', 'Priority', 'Project'],
                            tasks.map(t => [t.id, t.title, t.status, t.priority, t.projectId || ''])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    master.command('sessions')
        .description('List sessions across all projects')
        .option('--project <id>', 'Filter by project ID')
        .action(async (cmdOpts) => {
            await guardCommand('master:sessions');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching sessions...').start() : null;

            try {
                const qs = cmdOpts.project ? `?projectId=${cmdOpts.project}` : '';
                const sessions: any[] = await api.get(`/api/master/sessions${qs}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(sessions);
                } else {
                    if (sessions.length === 0) {
                        console.log('No sessions found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Status', 'Project'],
                            sessions.map(s => [s.id, s.name || '', s.status, s.projectId || ''])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    master.command('context')
        .description('Full workspace overview across all projects')
        .action(async () => {
            await guardCommand('master:context');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching workspace context...').start() : null;

            try {
                const ctx: any = await api.get('/api/master/context');

                spinner?.stop();

                if (isJson) {
                    outputJSON(ctx);
                } else {
                    outputKeyValue('Projects', String(ctx.projects?.length ?? 0));
                    if (ctx.projects && ctx.projects.length > 0) {
                        for (const p of ctx.projects) {
                            const taskCount = ctx.taskCounts?.[p.id] ?? 0;
                            const sessionCount = ctx.sessionCounts?.[p.id] ?? 0;
                            console.log(`  ${p.name} (${p.id})${p.isMaster ? ' [master]' : ''} — tasks: ${taskCount}, sessions: ${sessionCount}`);
                        }
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });
}
