import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputKeyValue, outputErrorJSON } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

function requireProject(program: Command, isJson: boolean): string {
    const globalOpts = program.opts();
    const projectId = globalOpts.project || config.projectId;
    if (!projectId) {
        const err = { message: 'No project context found. Use --project <id> or set MAESTRO_PROJECT_ID.' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
    }
    return projectId;
}

export function registerTeamCommands(program: Command) {
    const team = program.command('team').description('Manage teams');

    // ── team list ─────────────────────────────────────────────
    team.command('list')
        .description('List teams for the current project')
        .option('--all', 'Include archived teams')
        .option('--status <status>', 'Filter by status: active or archived')
        .action(async (cmdOpts: any) => {
            await guardCommand('team:list');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            if (cmdOpts.status && !['active', 'archived'].includes(cmdOpts.status)) {
                const err = { message: `Invalid status "${cmdOpts.status}". Must be: active or archived` };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Fetching teams...').start() : null;

            try {
                const teams: any[] = await api.get(`/api/teams?projectId=${projectId}`);

                spinner?.stop();

                let filtered = teams;
                if (cmdOpts.all) {
                    // include all
                } else if (cmdOpts.status) {
                    filtered = teams.filter((t: any) => t.status === cmdOpts.status);
                } else {
                    filtered = teams.filter((t: any) => t.status === 'active');
                }

                if (isJson) {
                    outputJSON(filtered);
                } else {
                    if (filtered.length === 0) {
                        console.log('No teams found.');
                    } else {
                        outputTable(
                            ['ID', 'Name', 'Leader', 'Members', 'Sub-Teams', 'Status'],
                            filtered.map((t: any) => [
                                t.id,
                                `${t.avatar || '👥'} ${t.name}`,
                                t.leaderId || 'none',
                                String((t.memberIds || []).length),
                                String((t.subTeamIds || []).length),
                                t.status,
                            ])
                        );
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team get ──────────────────────────────────────────────
    team.command('get <teamId>')
        .description('Get team details')
        .action(async (teamId: string) => {
            await guardCommand('team:get');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Fetching team...').start() : null;

            try {
                const t: any = await api.get(`/api/teams/${teamId}?projectId=${projectId}`);

                spinner?.stop();

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    if (t.description) outputKeyValue('Description', t.description);
                    outputKeyValue('Leader', t.leaderId || 'none');
                    outputKeyValue('Status', t.status);

                    const memberIds = t.memberIds || [];
                    if (memberIds.length > 0) {
                        outputKeyValue('Members', memberIds.join(', '));
                    } else {
                        outputKeyValue('Members', 'none');
                    }

                    const subTeamIds = t.subTeamIds || [];
                    if (subTeamIds.length > 0) {
                        outputKeyValue('Sub-Teams', subTeamIds.join(', '));
                    }
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team create ──────────────────────────────────────────
    team.command('create <name>')
        .description('Create a new team')
        .requiredOption('--leader <teamMemberId>', 'Team leader (team member ID)')
        .option('--members <ids>', 'Comma-separated member IDs')
        .option('--description <text>', 'Team description')
        .option('--avatar <emoji>', 'Team avatar emoji')
        .action(async (name: string, cmdOpts: any) => {
            await guardCommand('team:create');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Creating team...').start() : null;

            try {
                const payload: any = {
                    projectId,
                    name: name.trim(),
                    leaderId: cmdOpts.leader.trim(),
                };

                if (cmdOpts.members) {
                    payload.memberIds = cmdOpts.members.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
                if (cmdOpts.description) payload.description = cmdOpts.description.trim();
                if (cmdOpts.avatar) payload.avatar = cmdOpts.avatar.trim();

                const t: any = await api.post('/api/teams', payload);

                spinner?.succeed('Team created');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Leader', t.leaderId || 'none');
                    outputKeyValue('Members', (t.memberIds || []).join(', ') || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team edit ─────────────────────────────────────────────
    team.command('edit <teamId>')
        .description('Edit a team')
        .option('--name <name>', 'Update team name')
        .option('--leader <teamMemberId>', 'Update team leader')
        .option('--description <text>', 'Update description')
        .option('--avatar <emoji>', 'Update avatar emoji')
        .action(async (teamId: string, cmdOpts: any) => {
            await guardCommand('team:edit');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const updates: Record<string, any> = { projectId };
            if (cmdOpts.name) updates.name = cmdOpts.name.trim();
            if (cmdOpts.leader) updates.leaderId = cmdOpts.leader.trim();
            if (cmdOpts.description) updates.description = cmdOpts.description.trim();
            if (cmdOpts.avatar) updates.avatar = cmdOpts.avatar.trim();

            const fieldCount = Object.keys(updates).length - 1;
            if (fieldCount === 0) {
                const err = { message: 'No fields to update. Provide at least one option (e.g. --name, --leader, --description).' };
                if (isJson) { outputErrorJSON(err); process.exit(1); }
                else { console.error(err.message); process.exit(1); }
            }

            const spinner = !isJson ? ora('Updating team...').start() : null;

            try {
                const t: any = await api.patch(`/api/teams/${teamId}`, updates);

                spinner?.succeed('Team updated');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Leader', t.leaderId || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team archive ─────────────────────────────────────────
    team.command('archive <teamId>')
        .description('Archive a team')
        .action(async (teamId: string) => {
            await guardCommand('team:archive');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Archiving team...').start() : null;

            try {
                const t: any = await api.post(`/api/teams/${teamId}/archive`, { projectId });

                spinner?.succeed('Team archived');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Status', t.status);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team unarchive ───────────────────────────────────────
    team.command('unarchive <teamId>')
        .description('Unarchive a team')
        .action(async (teamId: string) => {
            await guardCommand('team:unarchive');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Unarchiving team...').start() : null;

            try {
                const t: any = await api.post(`/api/teams/${teamId}/unarchive`, { projectId });

                spinner?.succeed('Team unarchived');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Status', t.status);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team delete ──────────────────────────────────────────
    team.command('delete <teamId>')
        .description('Delete a team (must be archived first)')
        .action(async (teamId: string) => {
            await guardCommand('team:delete');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            if (!isJson) {
                console.log('Warning: Teams must be archived before deletion. Use "team archive <id>" first.');
            }

            const spinner = !isJson ? ora('Deleting team...').start() : null;

            try {
                const result: any = await api.delete(`/api/teams/${teamId}?projectId=${projectId}`);

                spinner?.succeed('Team deleted');

                if (isJson) {
                    outputJSON(result);
                } else {
                    console.log(`Team ${teamId} deleted.`);
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team add-member ──────────────────────────────────────
    team.command('add-member <teamId> <memberIds...>')
        .description('Add members to a team')
        .action(async (teamId: string, memberIds: string[]) => {
            await guardCommand('team:add-member');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Adding members...').start() : null;

            try {
                const t: any = await api.post(`/api/teams/${teamId}/members`, {
                    projectId,
                    memberIds,
                });

                spinner?.succeed('Members added');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Members', (t.memberIds || []).join(', ') || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team remove-member ───────────────────────────────────
    team.command('remove-member <teamId> <memberIds...>')
        .description('Remove members from a team')
        .action(async (teamId: string, memberIds: string[]) => {
            await guardCommand('team:remove-member');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Removing members...').start() : null;

            try {
                const memberIdsParam = memberIds.join(',');
                const t: any = await api.delete(`/api/teams/${teamId}/members?projectId=${projectId}&memberIds=${encodeURIComponent(memberIdsParam)}`);

                spinner?.succeed('Members removed');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Members', (t.memberIds || []).join(', ') || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team add-sub-team ────────────────────────────────────
    team.command('add-sub-team <teamId> <subTeamId>')
        .description('Add a sub-team to a team')
        .action(async (teamId: string, subTeamId: string) => {
            await guardCommand('team:add-sub-team');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Adding sub-team...').start() : null;

            try {
                const t: any = await api.post(`/api/teams/${teamId}/sub-teams`, {
                    projectId,
                    subTeamId,
                });

                spinner?.succeed('Sub-team added');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Sub-Teams', (t.subTeamIds || []).join(', ') || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team remove-sub-team ─────────────────────────────────
    team.command('remove-sub-team <teamId> <subTeamId>')
        .description('Remove a sub-team from a team')
        .action(async (teamId: string, subTeamId: string) => {
            await guardCommand('team:remove-sub-team');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Removing sub-team...').start() : null;

            try {
                const t: any = await api.delete(`/api/teams/${teamId}/sub-teams?projectId=${projectId}&subTeamId=${encodeURIComponent(subTeamId)}`);

                spinner?.succeed('Sub-team removed');

                if (isJson) {
                    outputJSON(t);
                } else {
                    outputKeyValue('ID', t.id);
                    outputKeyValue('Name', `${t.avatar || '👥'} ${t.name}`);
                    outputKeyValue('Sub-Teams', (t.subTeamIds || []).join(', ') || 'none');
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });

    // ── team tree ────────────────────────────────────────────
    team.command('tree <teamId>')
        .description('Display full team hierarchy tree')
        .action(async (teamId: string) => {
            await guardCommand('team:tree');
            const globalOpts = program.opts();
            const isJson = globalOpts.json;
            const projectId = requireProject(program, isJson);

            const spinner = !isJson ? ora('Building team tree...').start() : null;

            try {
                // Fetch all teams to build the tree locally
                const allTeams: any[] = await api.get(`/api/teams?projectId=${projectId}`);
                const teamMap = new Map<string, any>();
                for (const t of allTeams) {
                    teamMap.set(t.id, t);
                }

                const root = teamMap.get(teamId);
                if (!root) {
                    spinner?.stop();
                    const err = { message: `Team ${teamId} not found.` };
                    if (isJson) { outputErrorJSON(err); process.exit(1); }
                    else { console.error(err.message); process.exit(1); }
                    return;
                }

                spinner?.stop();

                if (isJson) {
                    // Build JSON tree recursively
                    function buildTree(t: any): any {
                        const children = (t.subTeamIds || [])
                            .map((id: string) => teamMap.get(id))
                            .filter(Boolean)
                            .map((child: any) => buildTree(child));
                        return {
                            id: t.id,
                            name: t.name,
                            avatar: t.avatar,
                            leaderId: t.leaderId,
                            memberIds: t.memberIds || [],
                            children,
                        };
                    }
                    outputJSON(buildTree(root));
                } else {
                    // Print tree with indentation
                    function printTree(t: any, prefix: string, isLast: boolean) {
                        const connector = isLast ? '└── ' : '├── ';
                        const avatar = t.avatar || '👥';
                        const memberCount = (t.memberIds || []).length;
                        console.log(`${prefix}${connector}${avatar} ${t.name} (${memberCount} members)`);

                        const subIds = t.subTeamIds || [];
                        const childPrefix = prefix + (isLast ? '    ' : '│   ');
                        subIds.forEach((subId: string, i: number) => {
                            const sub = teamMap.get(subId);
                            if (sub) {
                                printTree(sub, childPrefix, i === subIds.length - 1);
                            } else {
                                const conn = i === subIds.length - 1 ? '└── ' : '├── ';
                                console.log(`${childPrefix}${conn}⚠ ${subId} (not found)`);
                            }
                        });
                    }

                    const avatar = root.avatar || '👥';
                    const memberCount = (root.memberIds || []).length;
                    console.log(`${avatar} ${root.name} (${memberCount} members)`);
                    const subIds = root.subTeamIds || [];
                    subIds.forEach((subId: string, i: number) => {
                        const sub = teamMap.get(subId);
                        if (sub) {
                            printTree(sub, '', i === subIds.length - 1);
                        } else {
                            const conn = i === subIds.length - 1 ? '└── ' : '├── ';
                            console.log(`${conn}⚠ ${subId} (not found)`);
                        }
                    });
                }
            } catch (err) {
                spinner?.stop();
                handleError(err, isJson);
            }
        });
}
