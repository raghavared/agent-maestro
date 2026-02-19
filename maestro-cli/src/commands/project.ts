import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerProjectCommands(program: Command) {
    const project = program.command('project').description('Manage projects');

    project.command('list')
        .description('List all projects')
        .action(async () => {
            await guardCommand('project:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching projects...').start() : null;

            try {
                // Fetch projects from server
                const projects: any[] = await api.get('/api/projects');

                spinner?.stop();

                if (isJson) {
                    outputJSON(projects);
                } else {
                    if (projects.length === 0) {
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Working Dir'],
                            projects.map(p => [p.id, p.name, p.workingDir])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    project.command('create <name>')
        .description('Create a new project')
        .option('-d, --dir <workingDir>', 'Working directory', process.cwd())
        .option('--desc <description>', 'Project description')
        .action(async (name, cmdOpts) => {
            await guardCommand('project:create');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Creating project...').start() : null;

            try {
                // Create project via server API
                const newProject: any = await api.post('/api/projects', {
                    name,
                    workingDir: cmdOpts.dir,
                    description: cmdOpts.desc,
                });

                spinner?.succeed('Project created');

                if (isJson) {
                    outputJSON(newProject);
                } else {
                    outputKeyValue('ID', newProject.id);
                    outputKeyValue('Name', newProject.name);
                    outputKeyValue('Dir', newProject.workingDir);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    project.command('get <id>')
        .description('Get project details')
        .action(async (id) => {
            await guardCommand('project:get');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Fetching project...').start() : null;

            try {
                // Fetch from server
                const p: any = await api.get(`/api/projects/${id}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(p);
                } else {
                    outputKeyValue('ID', p.id);
                    outputKeyValue('Name', p.name);
                    outputKeyValue('Dir', p.workingDir);
                    if (p.description) outputKeyValue('Description', p.description);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    project.command('delete <id>')
        .description('Delete a project')
        .action(async (id) => {
            await guardCommand('project:delete');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const spinner = !isJson ? ora('Deleting project...').start() : null;

            try {
                // Delete via server API
                await api.delete(`/api/projects/${id}`);

                spinner?.succeed('Project deleted');

                if (isJson) {
                    outputJSON({ deleted: id });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });
}
