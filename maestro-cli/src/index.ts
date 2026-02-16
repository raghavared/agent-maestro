import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { api } from './api.js';
import { outputJSON, outputKeyValue } from './utils/formatter.js';
import { readManifestFromEnv } from './services/manifest-reader.js';
import { WhoamiRenderer } from './services/whoami-renderer.js';
import { registerTaskCommands } from './commands/task.js';
import { registerSessionCommands } from './commands/session.js';
import { registerWorkerCommands } from './commands/worker.js';
import { registerOrchestratorCommands } from './commands/orchestrator.js';
import { registerSkillCommands } from './commands/skill.js';
import { registerManifestCommands } from './commands/manifest-generator.js';
import { registerProjectCommands } from './commands/project.js';

import { registerReportCommands } from './commands/report.js';
import { registerModalCommands } from './commands/modal.js';
import { registerMailCommands } from './commands/mail.js';
import { registerTeamMemberCommands } from './commands/team-member.js';
import {
  loadCommandPermissions,
  printAvailableCommands,
  isCommandAllowed,
  getCachedPermissions,
  getAvailableCommandsGrouped,
  getPermissionsFromManifest,
} from './services/command-permissions.js';

// Load version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('maestro')
  .description('CLI for Maestro Agents')
  .version(pkg.version)
  .option('--json', 'Output results as JSON')
  .option('--server <url>', 'Override Maestro Server URL')
  .option('--project <id>', 'Override Project ID')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.server) {
      api.setBaseUrl(opts.server);
    }
  });

program.command('whoami')
  .description('Print current context')
  .action(async () => {
      const opts = program.opts();
      const server = opts.server || config.apiUrl;
      const project = opts.project || config.projectId;
      const sessionId = config.sessionId;

      // Try to read manifest for rich output
      const manifestResult = await readManifestFromEnv();

      if (manifestResult.success && manifestResult.manifest) {
          const manifest = manifestResult.manifest;
          const permissions = getPermissionsFromManifest(manifest);
          const renderer = new WhoamiRenderer();

          if (opts.json) {
              outputJSON(renderer.renderJSON(manifest, permissions, sessionId));
          } else {
              console.log(await renderer.render(manifest, permissions, sessionId));
          }
      } else {
          // Fallback: no manifest available, show basic env-var output
          const data = {
              server,
              projectId: project,
              sessionId,
              taskIds: config.taskIds,
              mode: 'execute',
          };

          if (opts.json) {
              outputJSON(data);
          } else {
              outputKeyValue('Server', data.server);
              outputKeyValue('Project ID', data.projectId || 'N/A');
              outputKeyValue('Session ID', data.sessionId || 'N/A');
              outputKeyValue('Task IDs', data.taskIds.join(', ') || 'N/A');
              outputKeyValue('Mode', 'execute');
          }
      }
  });

// Commands - show available commands based on manifest permissions
program.command('commands')
  .description('Show available commands based on current session permissions')
  .option('--check <command>', 'Check if a specific command is allowed')
  .action(async (cmdOpts) => {
      const opts = program.opts();
      const isJson = opts.json;

      try {
          const permissions = getCachedPermissions() || await loadCommandPermissions();

          if (cmdOpts.check) {
              // Check if specific command is allowed
              const commandName = cmdOpts.check;
              const allowed = isCommandAllowed(commandName, permissions);

              if (isJson) {
                  outputJSON({ command: commandName, allowed, mode: permissions.mode });
              } else {
                  if (allowed) {
                      console.log(`Command '${commandName}' is ALLOWED for ${permissions.mode} mode`);
                  } else {
                      console.log(`Command '${commandName}' is NOT ALLOWED for ${permissions.mode} mode`);
                      console.log('\nRun "maestro commands" to see available commands.');
                  }
              }
          } else {
              // Show all available commands
              if (isJson) {
                  const grouped = getAvailableCommandsGrouped(permissions);
                  outputJSON({
                      mode: permissions.mode,
                      allowedCommands: permissions.allowedCommands,
                      hiddenCommands: permissions.hiddenCommands,
                      grouped,
                  });
              } else {
                  console.log(`\nSession Mode: ${permissions.mode}`);
                  console.log(`Mode: ${permissions.mode}`);
                  printAvailableCommands(permissions);
              }
          }
      } catch (err: any) {
          if (isJson) {
              console.log(JSON.stringify({ success: false, error: err.message }));
          } else {
              console.error('Failed to load command permissions:', err.message);
          }
          process.exit(1);
      }
  });

registerProjectCommands(program);
registerTaskCommands(program);
registerSessionCommands(program);
registerWorkerCommands(program);
registerOrchestratorCommands(program);
registerSkillCommands(program);
registerManifestCommands(program);

registerReportCommands(program);
registerModalCommands(program);
registerMailCommands(program);
registerTeamMemberCommands(program);
program.command('status')
  .description('Show summary of current project state')
  .action(async () => {
    const globalOpts = program.opts();
    const isJson = globalOpts.json;
    const projectId = globalOpts.project || config.projectId;

    if (!projectId) {
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: 'no_context', message: 'No project context.' }));
      } else {
        console.error('Error: No project context. Use --project <id> or set MAESTRO_PROJECT_ID');
      }
      process.exit(1);
    }

    try {
      // Fetch from server
      const tasks: any[] = await api.get(`/api/tasks?projectId=${projectId}`);
      const sessions: any[] = await api.get(`/api/sessions?projectId=${projectId}`);

      // Count by status
      const statusCounts = tasks.reduce((acc: any, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      // Count by priority
      const priorityCounts = tasks.reduce((acc: any, task: any) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {});

      const activeSessions = sessions.filter((s: any) => s.status === 'working' || s.status === 'spawning');

      const summary = {
        project: projectId,
        tasks: {
          total: tasks.length,
          byStatus: statusCounts,
          byPriority: priorityCounts
        },
        sessions: {
          active: activeSessions.length
        }
      };

      if (isJson) {
        outputJSON(summary);
      } else {
        console.log('\nProject Status\n');
        console.log(`Project ID: ${projectId}`);
        console.log(`\nTasks: ${tasks.length} total`);
        console.log(`  Todo: ${statusCounts.todo || 0}`);
        console.log(`  In Progress: ${statusCounts.in_progress || 0}`);
        console.log(`  Blocked: ${statusCounts.blocked || 0}`);
        console.log(`  Completed: ${statusCounts.completed || 0}`);
        console.log(`  Cancelled: ${statusCounts.cancelled || 0}`);
        console.log(`\nActive Sessions: ${summary.sessions.active}`);
        console.log('');
      }
    } catch (err) {
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: 'status_failed', message: String(err) }));
      } else {
        console.error('Failed to get project status:', err);
      }
      process.exit(1);
    }
  });

program.command('track-file <path>')
  .description('Track file modification (called by PostToolUse hook)')
  .action(async (filePath) => {
    const sessionId = config.sessionId;

    // Silent fail if no session
    if (!sessionId) {
      process.exit(0);
    }

    try {
      await api.post(`/api/sessions/${sessionId}/events`, {
        type: 'file_modified',
        data: { file: filePath, timestamp: new Date().toISOString() },
      });
    } catch {
      // Silent fail - don't spam Claude's output
    }
    process.exit(0);
  });

program.parse(process.argv);
