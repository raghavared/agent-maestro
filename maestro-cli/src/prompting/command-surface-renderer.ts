import type { AgentMode } from '../types/manifest.js';
import type { CapabilitySet } from './capability-policy.js';
import { COMMAND_GROUP_META, groupCommandsByParent } from './command-catalog.js';

export const COMMANDS_REFERENCE_FOOTER = 'Run `maestro commands` for full syntax reference.';

export interface SurfaceRenderOptions {
  compact?: boolean;
}

function renderHeader(mode: AgentMode): string {
  return `## Maestro ${mode} Commands`;
}

export function renderCommandSurface(
  mode: AgentMode,
  capabilitySet: CapabilitySet,
  options: SurfaceRenderOptions = {},
): string {
  if (options.compact) {
    return renderCompactSurface(mode, capabilitySet);
  }
  return renderFullSurface(mode, capabilitySet);
}

function renderFullSurface(mode: AgentMode, capabilitySet: CapabilitySet): string {
  const lines: string[] = [renderHeader(mode), ''];
  const grouped = groupCommandsByParent(capabilitySet.allowedCommands, mode, { excludePromptHidden: true });

  if (grouped.root) {
    for (const entry of grouped.root) {
      lines.push(`- \`${entry.syntax}\` - ${entry.description}`);
    }
    lines.push('');
  }

  for (const [group, entries] of Object.entries(grouped)) {
    if (group === 'root') continue;
    for (const entry of entries) {
      lines.push(`- \`${entry.syntax}\` - ${entry.description}`);
    }
    lines.push('');
  }

  lines.push(COMMANDS_REFERENCE_FOOTER);
  return lines.join('\n').trim();
}

function renderCompactSurface(mode: AgentMode, capabilitySet: CapabilitySet): string {
  const lines: string[] = [renderHeader(mode)];
  const grouped = groupCommandsByParent(capabilitySet.allowedCommands, mode, { excludePromptHidden: true });

  if (grouped.root && grouped.root.length > 0) {
    const rootCommands = grouped.root.map((entry) => entry.id).join('|');
    lines.push(`maestro {${rootCommands}} - Core utilities`);
  }

  for (const [group, entries] of Object.entries(grouped)) {
    if (group === 'root') continue;

    const meta = COMMAND_GROUP_META[group];
    const simpleCommands: string[] = [];
    const nestedEntries = [] as typeof entries;

    for (const entry of entries) {
      const subParts = entry.id.replace(`${group}:`, '').split(':');
      if (subParts.length === 1) {
        simpleCommands.push(subParts[0]);
      } else {
        nestedEntries.push(entry);
      }
    }

    if (simpleCommands.length > 0) {
      const prefix = meta?.prefix || `maestro ${group}`;
      const description = meta?.description || '';
      lines.push(`${prefix} {${simpleCommands.join('|')}} - ${description}`.trim());
    }

    for (const entry of nestedEntries) {
      lines.push(`${entry.syntax} - ${entry.description}`);
    }
  }

  lines.push(COMMANDS_REFERENCE_FOOTER);
  return lines.join('\n');
}
