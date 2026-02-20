import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { api } from './api.js';
import { outputJSON, outputKeyValue } from './utils/formatter.js';
import { readManifest, readManifestFromEnv } from './services/manifest-reader.js';
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
import { registerTeamMemberCommands } from './commands/team-member.js';
import { registerTeamCommands } from './commands/team.js';
import {
  loadCommandPermissions,
  printAvailableCommands,
  isCommandAllowed,
  getCachedPermissions,
  getAvailableCommandsGrouped,
  getPermissionsFromManifest,
} from './services/command-permissions.js';

// Load version - use MAESTRO_CLI_VERSION env var (injected at bundle time for binary builds)
// or fall back to reading package.json for development
let cliVersion: string;
if (process.env.MAESTRO_CLI_VERSION) {
  cliVersion = process.env.MAESTRO_CLI_VERSION;
} else {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  cliVersion = pkg.version;
}

const program = new Command();

program
  .name('maestro')
  .description('CLI for Maestro Agents')
  .version(cliVersion)
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

// Debug prompt - show the exact system prompt and initial prompt sent to agent
program.command('debug-prompt')
  .description('Show the system prompt and initial prompt that would be sent to an agent session')
  .option('--manifest <path>', 'Path to manifest file (defaults to MAESTRO_MANIFEST_PATH)')
  .option('--session <id>', 'Fetch manifest for a specific session from server')
  .option('--system-only', 'Show only the system prompt')
  .option('--initial-only', 'Show only the initial prompt (task context)')
  .option('--raw', 'Output raw text without formatting headers')
  .action(async (cmdOpts) => {
    const opts = program.opts();
    const isJson = opts.json;

    try {
      let manifest;

      if (cmdOpts.session) {
        // Fetch session from server, which should have the manifest
        const sessionId = cmdOpts.session;
        const session: any = await api.get(`/api/sessions/${sessionId}`);
        if (!session.manifest) {
          process.exit(1);
        }
        manifest = session.manifest;
      } else if (cmdOpts.manifest) {
        const result = await readManifest(cmdOpts.manifest);
        if (!result.success || !result.manifest) {
          process.exit(1);
        }
        manifest = result.manifest;
      } else {
        const result = await readManifestFromEnv();
        if (!result.success || !result.manifest) {
          process.exit(1);
        }
        manifest = result.manifest;
      }

      const renderer = new WhoamiRenderer();
      const permissions = getPermissionsFromManifest(manifest);
      const sessionId = cmdOpts.session || config.sessionId || 'debug';

      const systemPrompt = renderer.renderSystemPrompt(manifest, permissions);
      const initialPrompt = await renderer.renderTaskContext(manifest, sessionId);

      if (isJson) {
        const output: any = {};
        if (!cmdOpts.initialOnly) output.systemPrompt = systemPrompt;
        if (!cmdOpts.systemOnly) output.initialPrompt = initialPrompt;
        outputJSON(output);
      } else {
        if (!cmdOpts.initialOnly) {
          if (!cmdOpts.raw) {
            console.log('=== SYSTEM PROMPT ===');
          }
          console.log(systemPrompt);
          if (!cmdOpts.raw && !cmdOpts.systemOnly) {
            console.log('');
          }
        }

        if (!cmdOpts.systemOnly) {
          if (!cmdOpts.raw) {
            console.log('=== INITIAL PROMPT ===');
          }
          console.log(initialPrompt);
        }
      }
    } catch (err: any) {
      if (isJson) {
        outputJSON({ success: false, error: err.message });
      } else {
        console.error(`Error: ${err.message || String(err)}`);
      }
      process.exit(1);
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
                  printAvailableCommands(permissions);
              }
          }
      } catch (err: any) {
          if (isJson) {
              outputJSON({ success: false, error: err.message });
          } else {
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
registerTeamMemberCommands(program);
registerTeamCommands(program);
program.command('status')
  .description('Show summary of current project state')
  .action(async () => {
    const globalOpts = program.opts();
    const isJson = globalOpts.json;
    const projectId = globalOpts.project || config.projectId;

    if (!projectId) {
      if (isJson) {
        outputJSON({ success: false, error: 'no_context', message: 'No project context.' });
      } else {
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
      }
    } catch (err) {
      if (isJson) {
        outputJSON({ success: false, error: 'status_failed', message: String(err) });
      } else {
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
