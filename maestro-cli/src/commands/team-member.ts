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
                    const memoryList = member.memory || [];
                    if (memoryList.length > 0) {
                        outputKeyValue('Memory', `${memoryList.length} entries`);
                        memoryList.forEach((entry: string, i: number) => {
                            console.log(`  ${i + 1}. ${entry}`);
                        });
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
        .option('--permission-mode <mode>', 'Update permission mode: acceptEdits, interactive, readOnly, or bypassPermissions')
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

            // Validate permission mode if provided
            if (cmdOpts.permissionMode) {
                const validPermissionModes = ['acceptEdits', 'interactive', 'readOnly', 'bypassPermissions'];
                if (!validPermissionModes.includes(cmdOpts.permissionMode)) {
                    const err = { message: `Invalid permission mode "${cmdOpts.permissionMode}". Must be one of: ${validPermissionModes.join(', ')}` };
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
            if (cmdOpts.permissionMode) updates.permissionMode = cmdOpts.permissionMode;
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

    // ── Self-update identity command ─────────────────────────────
    teamMember.command('update-identity <teamMemberId>')
        .description('Update own identity/persona instructions (self-awareness)')
        .requiredOption('--identity <instructions>', 'New identity/persona instructions')
        .action(async (teamMemberId: string, cmdOpts: any) => {
            await guardCommand('team-member:update-identity');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Updating identity...').start() : null;

            try {
                const member: any = await api.patch(`/api/team-members/${teamMemberId}`, {
                    projectId,
                    identity: cmdOpts.identity.trim(),
                });

                spinner?.succeed('Identity updated');

                if (isJson) {
                    outputJSON(member);
                } else {
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Identity', member.identity);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── Memory commands ────────────────────────────────────────
    const memory = teamMember.command('memory').description('Manage team member memory (persistent notes)');

    memory.command('append <teamMemberId>')
        .description('Append an entry to team member memory')
        .requiredOption('--entry <text>', 'Memory entry to store')
        .action(async (teamMemberId: string, cmdOpts: any) => {
            await guardCommand('team-member:memory:append');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const trimmedEntry = cmdOpts.entry.trim();
            if (!trimmedEntry) {
                const err = { message: 'Memory entry cannot be empty.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Appending to memory...').start() : null;

            try {
                const member: any = await api.post(`/api/team-members/${teamMemberId}/memory`, {
                    projectId,
                    entries: [trimmedEntry],
                });

                spinner?.succeed('Memory entry added');

                if (isJson) {
                    outputJSON(member);
                } else {
                    const memoryList = member.memory || [];
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Memory entries', String(memoryList.length));
                    if (memoryList.length > 0) {
                        console.log('\nMemory:');
                        memoryList.forEach((entry: string, i: number) => {
                            console.log(`  ${i + 1}. ${entry}`);
                        });
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    memory.command('list <teamMemberId>')
        .description('List all memory entries for a team member')
        .action(async (teamMemberId: string) => {
            await guardCommand('team-member:memory:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching memory...').start() : null;

            try {
                const member: any = await api.get(`/api/team-members/${teamMemberId}?projectId=${projectId}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON({ id: member.id, name: member.name, memory: member.memory || [] });
                } else {
                    const memoryList = member.memory || [];
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    outputKeyValue('Memory entries', String(memoryList.length));
                    if (memoryList.length > 0) {
                        console.log('\nMemory:');
                        memoryList.forEach((entry: string, i: number) => {
                            console.log(`  ${i + 1}. ${entry}`);
                        });
                    } else {
                        console.log('\nNo memory entries.');
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    memory.command('clear <teamMemberId>')
        .description('Clear all memory entries for a team member')
        .action(async (teamMemberId: string) => {
            await guardCommand('team-member:memory:clear');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = globalOpts.project || config.projectId;

            if (!projectId) {
                const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Clearing memory...').start() : null;

            try {
                const member: any = await api.patch(`/api/team-members/${teamMemberId}`, {
                    projectId,
                    memory: [],
                });

                spinner?.succeed('Memory cleared');

                if (isJson) {
                    outputJSON(member);
                } else {
                    outputKeyValue('ID', member.id);
                    outputKeyValue('Name', `${member.avatar} ${member.name}`);
                    console.log('Memory cleared.');
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
        .option('--permission-mode <mode>', 'Permission mode: acceptEdits, interactive, readOnly, or bypassPermissions')
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

            // Validate permission mode if provided
            if (cmdOpts.permissionMode) {
                const validPermissionModes = ['acceptEdits', 'interactive', 'readOnly', 'bypassPermissions'];
                if (!validPermissionModes.includes(cmdOpts.permissionMode)) {
                    const err = { message: `Invalid permission mode "${cmdOpts.permissionMode}". Must be one of: ${validPermissionModes.join(', ')}` };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                }
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

                if (cmdOpts.permissionMode) {
                    payload.permissionMode = cmdOpts.permissionMode;
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
