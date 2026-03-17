import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import type {
  SpellEntityResponse,
  SpellDefinitionResponse,
  SpellInvokeResponse,
  SpellCustomPromptResponse,
  SpellEntityType,
} from '../types/api-responses.js';
import ora from 'ora';

const ALL_ENTITY_TYPES: SpellEntityType[] = ['maestro', 'skill', 'team-member', 'task', 'doc', 'session', 'custom-prompt'];

function groupByType(entities: SpellEntityResponse[]): Record<string, SpellEntityResponse[]> {
  const grouped: Record<string, SpellEntityResponse[]> = {};
  for (const entity of entities) {
    const type = entity.entityType;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(entity);
  }
  return grouped;
}

export function registerSpellCommands(program: Command): void {
  const spell = program.command('spell').description('Manage and invoke spells');

  // maestro spell entities [--type <entityType>] [--project <projectId>]
  spell.command('entities')
    .description('List available spell entities')
    .option('--type <entityType>', 'Filter by entity type (skill, team-member, task, doc, session, custom-prompt)')
    .action(async (cmdOpts) => {
      await guardCommand('spell:entities');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const projectId = globalOpts.project || config.projectId;
      const spinner = !isJson ? ora('Fetching spell entities...').start() : null;

      try {
        const types = cmdOpts.type ? [cmdOpts.type as SpellEntityType] : ALL_ENTITY_TYPES;
        const allEntities: SpellEntityResponse[] = [];

        const results = await Promise.allSettled(
          types.map(type => {
            let endpoint = `/api/spells/entities/${type}`;
            if (projectId) endpoint += `?projectId=${projectId}`;
            return api.get<SpellEntityResponse[]>(endpoint);
          }),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allEntities.push(...result.value);
          }
        }

        spinner?.stop();

        if (isJson) {
          outputJSON(allEntities);
        } else {
          if (allEntities.length === 0) {
            console.log('No spell entities found.');
          } else {
            const grouped = groupByType(allEntities);
            for (const [type, items] of Object.entries(grouped)) {
              console.log(`\n${type}:`);
              outputTable(
                ['ID', 'Name', 'Spells'],
                items.map(e => [
                  e.entityId,
                  e.name,
                  e.spells.map(s => s.name || 'default').join(', '),
                ]),
              );
            }
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro spell list [entityId] [--type <entityType>]
  spell.command('list [entityId]')
    .description('List spells for an entity, or all available spells')
    .option('--type <entityType>', 'Filter by entity type')
    .action(async (entityId, cmdOpts) => {
      await guardCommand('spell:list');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Fetching spells...').start() : null;

      try {
        let endpoint = '/api/spells/definitions';
        const queryParts: string[] = [];
        if (cmdOpts.type) queryParts.push(`entityType=${cmdOpts.type}`);
        if (queryParts.length) endpoint += '?' + queryParts.join('&');

        let spells = await api.get<SpellDefinitionResponse[]>(endpoint);

        // Filter by entityId client-side if specified
        if (entityId) {
          spells = spells.filter(s => s.entityId === entityId);
        }
        spinner?.stop();

        if (isJson) {
          outputJSON(spells);
        } else {
          if (spells.length === 0) {
            console.log('No spells found.');
          } else {
            outputTable(
              ['Entity', 'Spell', 'Description'],
              spells.map(s => [
                s.entityName || s.entityId,
                s.name || '(default)',
                s.description || '',
              ]),
            );
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro spell invoke <entityId> [spellName] --target <sessionId> [--args <json>]
  spell.command('invoke <entityId> [spellName]')
    .description('Invoke a spell on a target session')
    .requiredOption('--target <sessionId>', 'Target session to receive the spell prompt')
    .option('--args <json>', 'Additional arguments as JSON string')
    .action(async (entityId, spellName, cmdOpts) => {
      await guardCommand('spell:invoke');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const sessionId = config.sessionId;
      const spinner = !isJson ? ora('Invoking spell...').start() : null;

      try {
        const body: Record<string, unknown> = {
          entityId,
          spellName: spellName || null,
          targetSessionId: cmdOpts.target,
          invokerSessionId: sessionId || undefined,
        };

        if (cmdOpts.args) {
          try {
            body.args = JSON.parse(cmdOpts.args);
          } catch {
            throw new Error('Invalid --args JSON. Provide valid JSON string.');
          }
        }

        const result = await api.post<SpellInvokeResponse>('/api/spells/invoke', body);
        spinner?.succeed('Spell invoked');

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('Entity', result.entityName || entityId);
          outputKeyValue('Spell', result.spellName || '(default)');
          outputKeyValue('Target', cmdOpts.target);
          outputKeyValue('Status', result.status);
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro spell create <name> --prompt <text> [--description <text>]
  spell.command('create <name>')
    .description('Create a custom prompt spell')
    .requiredOption('--prompt <text>', 'The prompt text for this spell')
    .option('--description <text>', 'Description of what this spell does')
    .action(async (name, cmdOpts) => {
      await guardCommand('spell:create');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Creating custom spell...').start() : null;

      try {
        const result = await api.post<SpellCustomPromptResponse>('/api/spells/custom-prompts', {
          name,
          prompt: cmdOpts.prompt,
          description: cmdOpts.description || '',
        });

        spinner?.succeed('Custom spell created');

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('ID', result.id);
          outputKeyValue('Name', result.name);
          outputKeyValue('Type', 'custom-prompt');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro spell delete <entityId>
  spell.command('delete <entityId>')
    .description('Delete a custom prompt spell')
    .action(async (entityId) => {
      await guardCommand('spell:delete');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Deleting spell...').start() : null;

      try {
        await api.delete(`/api/spells/custom-prompts/${entityId}`);
        spinner?.succeed('Custom spell deleted');

        if (isJson) {
          outputJSON({ success: true, entityId });
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });
}
