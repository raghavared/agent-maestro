import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

interface ModeResponse {
  id: string;
  mode: string;
  previousMode?: string;
  changed?: boolean;
  relation?: string;
  role?: string;
}

export function registerCoordinatorCommands(program: Command): void {
  const coordinator = program.command('coordinator').description('Manage coordinator role for this session');

  coordinator.command('enable')
    .description('Promote this session to coordinator role (unlocks session spawn)')
    .action(async () => {
      await guardCommand('coordinator:enable');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const sessionId = config.sessionId;

      if (!sessionId) {
        if (isJson) {
          outputJSON({ success: false, error: 'MAESTRO_SESSION_ID not set.' });
        } else {
          console.error('Error: MAESTRO_SESSION_ID not set. Must be run from within a Maestro session.');
        }
        process.exit(1);
      }

      const spinner = !isJson ? ora('Enabling coordinator mode...').start() : null;
      try {
        const result = await api.post<ModeResponse>(`/api/sessions/${sessionId}/mode`, { role: 'coordinator' });
        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          if (result.changed) {
            console.log(`✔ Mode: ${result.mode} (was: ${result.previousMode})`);
            console.log('You can now run `maestro session spawn ...`.');
          } else {
            console.log('Already a coordinator.');
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  coordinator.command('disable')
    .description('Demote this session to worker role (re-locks session spawn)')
    .action(async () => {
      await guardCommand('coordinator:disable');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const sessionId = config.sessionId;

      if (!sessionId) {
        if (isJson) {
          outputJSON({ success: false, error: 'MAESTRO_SESSION_ID not set.' });
        } else {
          console.error('Error: MAESTRO_SESSION_ID not set. Must be run from within a Maestro session.');
        }
        process.exit(1);
      }

      const spinner = !isJson ? ora('Disabling coordinator mode...').start() : null;
      try {
        const result = await api.post<ModeResponse>(`/api/sessions/${sessionId}/mode`, { role: 'worker' });
        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          if (result.changed) {
            console.log('Mode demoted to worker.');
          } else {
            console.log('Already a worker.');
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  coordinator.command('status')
    .description('Show current coordinator mode status')
    .action(async () => {
      await guardCommand('coordinator:status');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const sessionId = config.sessionId;

      if (!sessionId) {
        if (isJson) {
          outputJSON({ success: false, error: 'MAESTRO_SESSION_ID not set.' });
        } else {
          console.error('Error: MAESTRO_SESSION_ID not set. Must be run from within a Maestro session.');
        }
        process.exit(1);
      }

      const spinner = !isJson ? ora('Fetching coordinator status...').start() : null;
      try {
        const result = await api.get<ModeResponse>(`/api/sessions/${sessionId}/mode`);
        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('Mode', result.mode);
          outputKeyValue('Relation', result.relation || '');
          outputKeyValue('Role', result.role || '');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });
}
