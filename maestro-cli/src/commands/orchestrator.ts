import { Command } from 'commander';
import { OrchestratorInitCommand } from './orchestrator-init.js';
import { WorkerResumeCommand } from './worker-resume.js';

/**
 * Register orchestrator commands
 *
 * Orchestrator commands handle orchestrator agent sessions that manage projects.
 */
export function registerOrchestratorCommands(program: Command) {
  const orchestrator = program.command('orchestrator').description('Orchestrator session commands');

  // orchestrator init - Initialize orchestrator session from manifest
  orchestrator
    .command('init')
    .description('Initialize orchestrator session from manifest')
    .action(async () => {
      const command = new OrchestratorInitCommand();
      await command.execute();
    });

  // orchestrator resume - Resume a previously stopped Claude session
  orchestrator
    .command('resume')
    .description('Resume a previously stopped Claude session')
    .action(async () => {
      const command = new WorkerResumeCommand();
      await command.execute();
    });
}
