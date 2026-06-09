import { Command } from 'commander';
import { api } from '../api.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import ora from 'ora';

interface LaunchConfigResponse {
  provider: string;
  model: string;
  reasoningEffort?: string;
  speed?: string;
  accessMode?: string;
}

interface ModelProfileResponse {
  id: string;
  name: string;
  description?: string;
  launchConfig: LaunchConfigResponse;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatLaunch(c: LaunchConfigResponse): string {
  const extras = [c.reasoningEffort, c.speed, c.accessMode].filter(Boolean).join(', ');
  return `${c.provider}/${c.model}${extras ? ` (${extras})` : ''}`;
}

export function registerModelProfileCommands(program: Command) {
  const modelProfile = program.command('model-profile').description('Inspect workspace-global model profiles');

  modelProfile.command('list')
    .description('List all model profiles')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Loading model profiles...').start() : null;
      try {
        const profiles = await api.get<ModelProfileResponse[]>('/api/model-profiles');
        spinner?.stop();
        if (isJson) {
          outputJSON(profiles);
          return;
        }
        if (profiles.length === 0) {
          console.log('No model profiles found.');
          return;
        }
        for (const p of profiles) {
          console.log(`${p.isDefault ? '★' : ' '} ${p.name}  [${p.id}]`);
          console.log(`    ${formatLaunch(p.launchConfig)}${p.description ? `  — ${p.description}` : ''}`);
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  modelProfile.command('get <profileId>')
    .description('Show a single model profile')
    .action(async (profileId: string) => {
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Loading model profile...').start() : null;
      try {
        const profile = await api.get<ModelProfileResponse>(`/api/model-profiles/${profileId}`);
        spinner?.stop();
        if (isJson) {
          outputJSON(profile);
          return;
        }
        outputKeyValue('ID', profile.id);
        outputKeyValue('Name', profile.name);
        outputKeyValue('Description', profile.description || '(none)');
        outputKeyValue('Launch', formatLaunch(profile.launchConfig));
        outputKeyValue('Default', profile.isDefault ? 'yes' : 'no');
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });
}
