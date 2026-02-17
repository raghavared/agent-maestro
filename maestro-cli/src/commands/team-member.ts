import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputKeyValue, outputErrorJSON } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerTeamMemberCommands(program: Command) {
    const teamMember = program.command('team-member').description('Manage team members');

    teamMember.command('list')
        .description('List team members for the current project')
        .action(async () => {
            await guardCommand('team-member:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching team members...').start() : null;

            try {
                const members: any[] = await api.get(`/api/team-members?projectId=${projectId}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(members);
                } else {
                    if (members.length === 0) {
                        console.log('No team members found.');
                    } else {
                        const activeMembers = members.filter((m: any) => m.status === 'active');
                        outputTable(
                            ['ID', 'Name', 'Role', 'Mode', 'Default'],
                            activeMembers.map((m: any) => [
                                m.id,
                                `${m.avatar} ${m.name}`,
                                m.role,
                                m.mode || 'execute',
                                m.isDefault ? 'yes' : 'no',
                            ])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    teamMember.command('get <teamMemberId>')
        .description('Get team member details')
        .action(async (teamMemberId: string) => {
            await guardCommand('team-member:get');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching team member...').start() : null;

            try {
                const member: any = await api.get(`/api/team-members/${teamMemberId}?projectId=${projectId}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(member);
                } else {
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Role', member.role);
                    outputKeyValue('Mode', member.mode || 'execute');
                    outputKeyValue('Model', member.model || 'sonnet');
                    outputKeyValue('Agent Tool', member.agentTool || 'claude-code');
                    outputKeyValue('Default', member.isDefault ? 'yes' : 'no');
                    outputKeyValue('Status', member.status);
                    if (member.identity) {
                        outputKeyValue('Identity', member.identity);
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    teamMember.command('edit <teamMemberId>')
        .description('Edit a team member')
        .option('--name <name>', 'Update team member name')
        .option('--role <role>', 'Update role description')
        .option('--avatar <emoji>', 'Update avatar emoji')
        .option('--mode <mode>', 'Update agent mode: execute or coordinate')
        .option('--model <model>', 'Update model (e.g. sonnet, opus, haiku)')
        .option('--agent-tool <tool>', 'Update agent tool (claude-code, codex, or gemini)')
        .option('--identity <instructions>', 'Update identity/persona instructions')
        .option('--workflow-template <templateId>', 'Update workflow template ID')
        .option('--custom-workflow <workflow>', 'Update custom workflow text (use with --workflow-template custom)')
        .action(async (teamMemberId: string, cmdOpts: any) => {
            await guardCommand('team-member:edit');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            // Validate mode if provided
            if (cmdOpts.mode) {
                const validModes = ['execute', 'coordinate'];
                if (!validModes.includes(cmdOpts.mode)) {
                    const err = { message: `Invalid mode "${cmdOpts.mode}". Must be one of: ${validModes.join(', ')}` };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                }
            }

            // Validate agent tool if provided
            if (cmdOpts.agentTool) {
                const validAgentTools = ['claude-code', 'codex', 'gemini'];
                if (!validAgentTools.includes(cmdOpts.agentTool)) {
                    const err = { message: `Invalid agent tool "${cmdOpts.agentTool}". Must be one of: ${validAgentTools.join(', ')}` };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                }
            }

            // Build update payload from provided options
            const updates: Record<string, any> = { projectId };
            if (cmdOpts.name) updates.name = cmdOpts.name.trim();
            if (cmdOpts.role) updates.role = cmdOpts.role.trim();
            if (cmdOpts.avatar) updates.avatar = cmdOpts.avatar.trim();
            if (cmdOpts.mode) updates.mode = cmdOpts.mode;
            if (cmdOpts.model) updates.model = cmdOpts.model;
            if (cmdOpts.agentTool) updates.agentTool = cmdOpts.agentTool;
            if (cmdOpts.identity) updates.identity = cmdOpts.identity.trim();
            if (cmdOpts.workflowTemplate) updates.workflowTemplateId = cmdOpts.workflowTemplate;
            if (cmdOpts.customWorkflow) updates.customWorkflow = cmdOpts.customWorkflow.trim();

            // Check that at least one field is being updated
            const fieldCount = Object.keys(updates).length - 1; // exclude projectId
            if (fieldCount === 0) {
                const err = { message: 'No fields to update. Provide at least one option (e.g. --name, --role, --identity, --mode).' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Updating team member...').start() : null;

            try {
                const member: any = await api.patch(`/api/team-members/${teamMemberId}`, updates);

                spinner?.succeed('Team member updated');

                if (isJson) {
                    outputJSON(member);
                } else {
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Role', member.role);
                    outputKeyValue('Mode', member.mode || 'execute');
                    outputKeyValue('Model', member.model || 'sonnet');
                    outputKeyValue('Agent Tool', member.agentTool || 'claude-code');
                    if (member.identity) {
                        outputKeyValue('Identity', member.identity);
                    }
                    if (member.workflowTemplateId) {
                        outputKeyValue('Workflow Template', member.workflowTemplateId);
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    teamMember.command('create <name>')
        .description('Create a new team member')
        .requiredOption('--role <role>', 'Role description for the team member')
        .requiredOption('--avatar <emoji>', 'Avatar emoji for the team member')
        .requiredOption('--mode <mode>', 'Agent mode: execute or coordinate')
        .option('--model <model>', 'Model to use (e.g. sonnet, opus, haiku, or native model names)')
        .option('--agent-tool <tool>', 'Agent tool (claude-code, codex, or gemini)', 'claude-code')
        .option('--identity <instructions>', 'Custom identity/persona instructions')
        .action(async (name: string, cmdOpts: any) => {
            await guardCommand('team-member:create');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            // Validate mode
            const validModes = ['execute', 'coordinate'];
            if (!validModes.includes(cmdOpts.mode)) {
                const err = { message: `Invalid mode "${cmdOpts.mode}". Must be one of: ${validModes.join(', ')}` };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            // Validate agent tool
            const validAgentTools = ['claude-code', 'codex', 'gemini'];
            if (cmdOpts.agentTool && !validAgentTools.includes(cmdOpts.agentTool)) {
                const err = { message: `Invalid agent tool "${cmdOpts.agentTool}". Must be one of: ${validAgentTools.join(', ')}` };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Creating team member...').start() : null;

            try {
                const payload: any = {
                    projectId,
                    name: name.trim(),
                    role: cmdOpts.role.trim(),
                    avatar: cmdOpts.avatar.trim(),
                    mode: cmdOpts.mode,
                    agentTool: cmdOpts.agentTool || 'claude-code',
                    identity: cmdOpts.identity?.trim() || '',
                };

                if (cmdOpts.model) {
                    payload.model = cmdOpts.model;
                }

                const member: any = await api.post('/api/team-members', payload);

                spinner?.succeed('Team member created');

                if (isJson) {
                    outputJSON(member);
                } else {
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Role', member.role);
                    outputKeyValue('Mode', member.mode || 'execute');
                    outputKeyValue('Model', member.model || 'sonnet');
                    outputKeyValue('Agent Tool', member.agentTool || 'claude-code');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });
}
