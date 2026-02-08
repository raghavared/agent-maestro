import { Command } from 'commander';
import { WorkerInitCommand } from './worker-init.js';

/**
 * Register worker commands
 *
 * Worker commands handle worker agent sessions that execute tasks.
 */
export function registerWorkerCommands(program: Command) {
  const worker = program.command('worker').description('Worker session commands');

  // worker init - Initialize worker session from manifest
  worker
    .command('init')
    .description('Initialize worker session from manifest')
    .action(async () => {
      const command = new WorkerInitCommand();
      await command.execute();
    });
}
