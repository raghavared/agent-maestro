import { Command } from 'commander';
import { api } from '../api.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

export function registerAnnounceCommands(program: Command) {
  program
    .command('announce <text>')
    .description('Speak a short message aloud via Alexa (Voice Monkey)')
    .option('--device <name>', 'Voice Monkey device to speak on (defaults to server VM_DEVICE)')
    .action(async (text: string, cmdOpts: { device?: string }) => {
      await guardCommand('announce');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Announcing...').start() : null;

      try {
        const result: any = await api.post('/api/announce', {
          text,
          ...(cmdOpts.device ? { device: cmdOpts.device } : {}),
        });

        spinner?.succeed('Announced');

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('Spoken', text);
          if (result?.device) outputKeyValue('Device', result.device);
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });
}
