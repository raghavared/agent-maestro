/**
 * Command Permissions Service
 *
 * Controls which commands are available to agents based on manifest configuration.
 * This module reads the manifest and determines allowed commands based on:
 * - Mode (execute vs coordinate)
 * - Strategy (simple, queue, default, etc.)
 * - Explicit allowedCommands list in manifest
 */

import type { MaestroManifest, AgentMode, Capability } from '../types/manifest.js';
import { computeCapabilities } from '../types/manifest.js';
import { readManifestFromEnv } from './manifest-reader.js';
import {
  CMD_DESC,
  CMD_SYNTAX,
  COMMAND_GROUP_META,
  COMMANDS_REFERENCE_HEADER,
  COMMANDS_REFERENCE_FOOTER,
  formatCommandNotAllowed,
  AVAILABLE_COMMANDS_HEADER,
  AVAILABLE_COMMANDS_SEPARATOR,
  HIDDEN_COMMANDS_LABEL,
} from '../prompts/index.js';

/**
 * Command definition with metadata
 */
export interface CommandDefinition {
  name: string;
  description: string;
  /** Parent command (e.g., 'task' for 'task:list') */
  parent?: string;
  /** Modes that can use this command */
  allowedModes: AgentMode[];
  /** Strategies that enable this command (undefined = all strategies) */
  allowedStrategies?: string[];
  /** Whether this is a core command always available */
  isCore?: boolean;
  /** Whether to hide this command from prompt/command briefs (internal/infrastructure commands) */
  hiddenFromPrompt?: boolean;
}

/**
 * Full command registry with metadata
 */
export const COMMAND_REGISTRY: CommandDefinition[] = [
  // Core commands (always available)
  { name: 'whoami', description: CMD_DESC.whoami, allowedModes: ['execute', 'coordinate'], isCore: true },
  { name: 'status', description: CMD_DESC.status, allowedModes: ['execute', 'coordinate'], isCore: true },
  { name: 'commands', description: CMD_DESC.commands, allowedModes: ['execute', 'coordinate'], isCore: true },

  // Task commands
  { name: 'task:list', description: CMD_DESC['task:list'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:get', description: CMD_DESC['task:get'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:create', description: CMD_DESC['task:create'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:edit', description: CMD_DESC['task:edit'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:delete', description: CMD_DESC['task:delete'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:update', description: CMD_DESC['task:update'], allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:complete', description: CMD_DESC['task:complete'], allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:block', description: CMD_DESC['task:block'], allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:children', description: CMD_DESC['task:children'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:tree', description: CMD_DESC['task:tree'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:progress', description: CMD_DESC['task:report:progress'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:complete', description: CMD_DESC['task:report:complete'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:blocked', description: CMD_DESC['task:report:blocked'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:error', description: CMD_DESC['task:report:error'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:docs:add', description: CMD_DESC['task:docs:add'], allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:docs:list', description: CMD_DESC['task:docs:list'], allowedModes: ['execute', 'coordinate'], parent: 'task' },

  // Session commands
  { name: 'session:list', description: CMD_DESC['session:list'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:siblings', description: CMD_DESC['session:siblings'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:info', description: CMD_DESC['session:info'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:watch', description: CMD_DESC['session:watch'], allowedModes: ['coordinate'], parent: 'session' },
  { name: 'session:spawn', description: CMD_DESC['session:spawn'], allowedModes: ['coordinate'], parent: 'session' },
  { name: 'session:logs', description: CMD_DESC['session:logs'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:notify', description: CMD_DESC['session:notify'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:mail:read', description: CMD_DESC['session:mail:read'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:prompt', description: CMD_DESC['session:prompt'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:register', description: CMD_DESC['session:register'], allowedModes: ['execute', 'coordinate'], parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:complete', description: CMD_DESC['session:complete'], allowedModes: ['execute', 'coordinate'], parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:report:progress', description: CMD_DESC['session:report:progress'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:complete', description: CMD_DESC['session:report:complete'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:blocked', description: CMD_DESC['session:report:blocked'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:error', description: CMD_DESC['session:report:error'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:docs:add', description: CMD_DESC['session:docs:add'], allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:docs:list', description: CMD_DESC['session:docs:list'], allowedModes: ['execute', 'coordinate'], parent: 'session' },

  // Legacy report commands (hidden from prompts, aliased to session:report:*)
  { name: 'report:progress', description: CMD_DESC['report:progress'], allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:complete', description: CMD_DESC['report:complete'], allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:blocked', description: CMD_DESC['report:blocked'], allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:error', description: CMD_DESC['report:error'], allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },

  // Project commands (coordinate only)
  { name: 'project:list', description: CMD_DESC['project:list'], allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:get', description: CMD_DESC['project:get'], allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:create', description: CMD_DESC['project:create'], allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:delete', description: CMD_DESC['project:delete'], allowedModes: ['coordinate'], parent: 'project' },

  // Init commands (invoked by the spawning system, not by agents directly)
  { name: 'worker:init', description: CMD_DESC['worker:init'], allowedModes: ['execute'], parent: 'worker', hiddenFromPrompt: true },
  { name: 'orchestrator:init', description: CMD_DESC['orchestrator:init'], allowedModes: ['coordinate'], parent: 'orchestrator', hiddenFromPrompt: true },

  // Team member commands (included in defaults for both execute and coordinate modes)
  { name: 'team-member:create', description: CMD_DESC['team-member:create'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:list', description: CMD_DESC['team-member:list'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:get', description: CMD_DESC['team-member:get'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:edit', description: CMD_DESC['team-member:edit'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:archive', description: CMD_DESC['team-member:archive'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:unarchive', description: CMD_DESC['team-member:unarchive'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:delete', description: CMD_DESC['team-member:delete'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:reset', description: CMD_DESC['team-member:reset'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:update-identity', description: CMD_DESC['team-member:update-identity'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:memory:append', description: CMD_DESC['team-member:memory:append'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:memory:list', description: CMD_DESC['team-member:memory:list'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },
  { name: 'team-member:memory:clear', description: CMD_DESC['team-member:memory:clear'], allowedModes: ['execute', 'coordinate'], parent: 'team-member' },

  // Show commands (display content in UI)
  { name: 'show:modal', description: CMD_DESC['show:modal'], allowedModes: ['execute', 'coordinate'], parent: 'show' },

  // Modal commands (interact with agent modals)
  { name: 'modal:events', description: CMD_DESC['modal:events'], allowedModes: ['execute', 'coordinate'], parent: 'modal' },

  // Utility commands (internal — called by hooks, not agents)
  { name: 'track-file', description: CMD_DESC['track-file'], allowedModes: ['execute', 'coordinate'], isCore: true, hiddenFromPrompt: true },

  // Developer debug commands
  { name: 'debug-prompt', description: CMD_DESC['debug-prompt'], allowedModes: ['execute', 'coordinate'], isCore: true, hiddenFromPrompt: true },
];

/**
 * Default allowed commands by mode
 */
export const DEFAULT_COMMANDS_BY_MODE: Record<string, string[]> = {
  execute: [
    'whoami',
    'status',
    'commands',
    'task:list',
    'task:get',
    'task:create',
    'task:edit',
    'task:delete',
    'task:children',
    'task:tree',
    'task:report:progress',
    'task:report:complete',
    'task:report:blocked',
    'task:report:error',
    'task:docs:add',
    'task:docs:list',
    'session:list',
    'session:siblings',
    'session:info',
    'session:logs',
    'session:register',
    'session:complete',
    'session:report:progress',
    'session:report:complete',
    'session:report:blocked',
    'session:report:error',
    'session:notify',
    'session:mail:read',
    'session:prompt',
    'session:docs:add',
    'session:docs:list',
    // Team member commands (all available to all sessions)
    'team-member:create',
    'team-member:list',
    'team-member:get',
    'team-member:edit',
    'team-member:archive',
    'team-member:unarchive',
    'team-member:delete',
    'team-member:reset',
    'team-member:update-identity',
    'team-member:memory:append',
    'team-member:memory:list',
    'team-member:memory:clear',
    // Show commands
    'show:modal',
    'modal:events',
    // Legacy aliases (backward compat)
    'report:progress',
    'report:complete',
    'report:blocked',
    'report:error',
    'track-file',
  ],
  coordinate: [
    'whoami',
    'status',
    'commands',
    'task:list',
    'task:get',
    'task:create',
    'task:edit',
    'task:delete',
    'task:update',
    'task:complete',
    'task:block',
    'task:children',
    'task:tree',
    'task:report:progress',
    'task:report:complete',
    'task:report:blocked',
    'task:report:error',
    'task:docs:add',
    'task:docs:list',
    'session:list',
    'session:siblings',
    'session:info',
    'session:watch',
    'session:spawn',
    'session:logs',
    'session:notify',
    'session:mail:read',
    'session:prompt',
    'session:register',
    'session:complete',
    'session:report:progress',
    'session:report:complete',
    'session:report:blocked',
    'session:report:error',
    'session:docs:add',
    'session:docs:list',
    'project:list',
    'project:get',
    'project:create',
    'project:delete',
    // Team member commands (all available to all sessions)
    'team-member:create',
    'team-member:list',
    'team-member:get',
    'team-member:edit',
    'team-member:archive',
    'team-member:unarchive',
    'team-member:delete',
    'team-member:reset',
    'team-member:update-identity',
    'team-member:memory:append',
    'team-member:memory:list',
    'team-member:memory:clear',
    // Show commands
    'show:modal',
    'modal:events',
    // Legacy aliases (backward compat)
    'report:progress',
    'report:complete',
    'report:blocked',
    'report:error',
    'track-file',
  ],
};


/**
 * Result of loading command permissions
 */
export interface CommandPermissions {
  /** List of allowed command names */
  allowedCommands: string[];
  /** List of hidden command names */
  hiddenCommands: string[];
  /** Agent mode */
  mode: AgentMode;
  /** Computed capabilities */
  capabilities: Capability[];
  /** Whether permissions were loaded from manifest */
  loadedFromManifest: boolean;
}

/**
 * Load command permissions from the manifest
 */
export async function loadCommandPermissions(): Promise<CommandPermissions> {
  const manifestPath = process.env.MAESTRO_MANIFEST_PATH;

  // Default to all commands if no manifest
  if (!manifestPath) {
    return {
      allowedCommands: COMMAND_REGISTRY.map(c => c.name),
      hiddenCommands: [],
      mode: 'execute',
      capabilities: computeCapabilities('execute'),
      loadedFromManifest: false,
    };
  }

  try {
    const result = await readManifestFromEnv();

    if (!result.success || !result.manifest) {
      // Fall back to defaults if manifest can't be read
      return {
        allowedCommands: COMMAND_REGISTRY.map(c => c.name),
        hiddenCommands: [],
        mode: 'execute',
        capabilities: computeCapabilities('execute'),
        loadedFromManifest: false,
      };
    }

    return getPermissionsFromManifest(result.manifest);
  } catch {
    // Fall back to defaults on error
    return {
      allowedCommands: COMMAND_REGISTRY.map(c => c.name),
      hiddenCommands: [],
      mode: 'execute',
      capabilities: computeCapabilities('execute'),
      loadedFromManifest: false,
    };
  }
}

/**
 * Get command permissions from a manifest object.
 * Supports team member capability and command permission overrides (Phase 2).
 */
export function getPermissionsFromManifest(manifest: MaestroManifest): CommandPermissions {
  const mode = manifest.mode;

  // Compute capabilities with optional team member overrides
  const capabilityOverrides = manifest.teamMemberCapabilities as Record<string, boolean> | undefined;
  const capabilities = computeCapabilities(mode, capabilityOverrides);

  // Start with defaults for the mode
  let allowedCommands = [...DEFAULT_COMMANDS_BY_MODE[mode]];

  // Apply team member command permission overrides (Phase 2)
  const cmdOverrides = manifest.teamMemberCommandPermissions;
  if (cmdOverrides) {
    // Group-level overrides: enable/disable entire command groups
    if (cmdOverrides.groups) {
      for (const [group, enabled] of Object.entries(cmdOverrides.groups)) {
        const groupCommands = COMMAND_REGISTRY
          .filter(c => c.parent === group || (group === 'root' && !c.parent))
          .map(c => c.name);

        if (enabled) {
          // Add all commands from this group
          for (const cmd of groupCommands) {
            if (!allowedCommands.includes(cmd)) {
              allowedCommands.push(cmd);
            }
          }
        } else {
          // Remove all non-core commands from this group
          const coreNames = new Set(COMMAND_REGISTRY.filter(c => c.isCore).map(c => c.name));
          allowedCommands = allowedCommands.filter(
            cmd => !groupCommands.includes(cmd) || coreNames.has(cmd)
          );
        }
      }
    }

    // Individual command overrides (most specific, wins over group)
    if (cmdOverrides.commands) {
      const coreNames = new Set(COMMAND_REGISTRY.filter(c => c.isCore).map(c => c.name));
      for (const [cmd, enabled] of Object.entries(cmdOverrides.commands)) {
        if (enabled) {
          if (!allowedCommands.includes(cmd)) {
            allowedCommands.push(cmd);
          }
        } else {
          // Don't remove core commands
          if (!coreNames.has(cmd)) {
            allowedCommands = allowedCommands.filter(c => c !== cmd);
          }
        }
      }
    }
  }

  // Override with explicit allowedCommands if provided in manifest
  if (manifest.session && (manifest.session as any).allowedCommands) {
    const explicit = (manifest.session as any).allowedCommands as string[];
    // Always include core commands
    const coreCommands = COMMAND_REGISTRY
      .filter(c => c.isCore)
      .map(c => c.name);
    allowedCommands = [...new Set([...coreCommands, ...explicit])];
  }

  // Calculate hidden commands
  const allCommands = COMMAND_REGISTRY.map(c => c.name);
  const hiddenCommands = allCommands.filter(c => !allowedCommands.includes(c));

  return {
    allowedCommands,
    hiddenCommands,
    mode,
    capabilities,
    loadedFromManifest: true,
  };
}

/**
 * Check if a specific command is allowed
 */
export function isCommandAllowed(commandName: string, permissions: CommandPermissions): boolean {
  return permissions.allowedCommands.includes(commandName);
}

/**
 * Get available commands grouped by parent
 * @param excludeHidden - If true, excludes commands marked as hiddenFromPrompt
 */
export function getAvailableCommandsGrouped(permissions: CommandPermissions, excludeHidden: boolean = false): Record<string, CommandDefinition[]> {
  const grouped: Record<string, CommandDefinition[]> = {};

  for (const cmd of COMMAND_REGISTRY) {
    if (permissions.allowedCommands.includes(cmd.name)) {
      if (excludeHidden && cmd.hiddenFromPrompt) continue;
      const parent = cmd.parent || 'root';
      if (!grouped[parent]) {
        grouped[parent] = [];
      }
      grouped[parent].push(cmd);
    }
  }

  return grouped;
}

/**
 * Print available commands to console
 */
export function printAvailableCommands(permissions: CommandPermissions): void {
  console.log(AVAILABLE_COMMANDS_HEADER);
  console.log(AVAILABLE_COMMANDS_SEPARATOR);

  const grouped = getAvailableCommandsGrouped(permissions);

  // Print root commands first
  if (grouped['root']) {
    for (const cmd of grouped['root']) {
      console.log(`  maestro ${cmd.name.padEnd(20)} ${cmd.description}`);
    }
  }

  // Print grouped commands
  for (const [parent, commands] of Object.entries(grouped)) {
    if (parent === 'root') continue;

    console.log(`\n  ${parent}:`);
    for (const cmd of commands) {
      const subCmd = cmd.name.replace(`${parent}:`, '').replace(/:/g, ' ');
      console.log(`    maestro ${parent} ${subCmd.padEnd(15)} ${cmd.description}`);
    }
  }

  if (permissions.hiddenCommands.length > 0) {
    console.log(`\n  ${HIDDEN_COMMANDS_LABEL(permissions.hiddenCommands.length)}`);
  }

  console.log('');
}

/**
 * Export permissions state for use in command registration
 */
let cachedPermissions: CommandPermissions | null = null;

export async function getOrLoadPermissions(): Promise<CommandPermissions> {
  if (!cachedPermissions) {
    cachedPermissions = await loadCommandPermissions();
  }
  return cachedPermissions;
}

export function setCachedPermissions(permissions: CommandPermissions): void {
  cachedPermissions = permissions;
}

export function getCachedPermissions(): CommandPermissions | null {
  return cachedPermissions;
}

/**
 * Guard function to check if a command can be executed.
 * Throws an error if the command is not allowed.
 *
 * Usage in command handlers:
 * ```typescript
 * .action(async () => {
 *   await guardCommand('task:create');
 *   // ... rest of command
 * });
 * ```
 */
export async function guardCommand(commandName: string): Promise<void> {
  const permissions = await getOrLoadPermissions();

  if (!permissions.loadedFromManifest) {
    // No manifest loaded, allow all commands
    return;
  }

  if (!isCommandAllowed(commandName, permissions)) {
    throw new Error(formatCommandNotAllowed(commandName, permissions.mode));
  }
}

/**
 * Synchronous version of guardCommand using cached permissions.
 * Returns false if permissions aren't loaded yet.
 */
export function guardCommandSync(commandName: string): boolean {
  const permissions = cachedPermissions;

  if (!permissions || !permissions.loadedFromManifest) {
    // No manifest loaded, allow all commands
    return true;
  }

  return isCommandAllowed(commandName, permissions);
}

/**
 * Command syntax/usage for each command (maps command name to usage string).
 * Imported from prompts module.
 */
const COMMAND_SYNTAX = CMD_SYNTAX;

/**
 * Get the executable CLI syntax string for a command ID.
 * Falls back to a best-effort space-separated command form.
 */
export function getCommandSyntax(commandName: string): string {
  if (COMMAND_SYNTAX[commandName]) {
    return COMMAND_SYNTAX[commandName];
  }

  // Fallback for unknown commands
  const parts = commandName.split(':');
  if (parts.length === 1) {
    return `maestro ${commandName}`;
  }
  return `maestro ${parts.join(' ')}`;
}

/**
 * Generate brief text listing available commands for inclusion in session prompts
 */
export function generateCommandBrief(permissions: CommandPermissions): string {
  const lines: string[] = [
    COMMANDS_REFERENCE_HEADER,
    '',
  ];

  const grouped = getAvailableCommandsGrouped(permissions, true);

  // Root commands
  if (grouped['root']) {
    for (const cmd of grouped['root']) {
      const syntax = COMMAND_SYNTAX[cmd.name] || `maestro ${cmd.name}`;
      lines.push(`- \`${syntax}\` — ${cmd.description}`);
    }
    lines.push('');
  }

  // Grouped commands
  for (const [parent, commands] of Object.entries(grouped)) {
    if (parent === 'root') continue;

    for (const cmd of commands) {
      const syntax = COMMAND_SYNTAX[cmd.name] || `maestro ${parent} ${cmd.name.replace(`${parent}:`, '').replace(/:/g, ' ')}`;
      lines.push(`- \`${syntax}\` — ${cmd.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a compact one-liner-per-group command reference for system prompts.
 * Much shorter than generateCommandBrief() — designed to save context window space.
 */
export function generateCompactCommandBrief(permissions: CommandPermissions): string {
  const lines: string[] = [COMMANDS_REFERENCE_HEADER];

  const grouped = getAvailableCommandsGrouped(permissions, true);

  // Core/root commands as a single line
  if (grouped['root']) {
    const subCmds = grouped['root'].map(c => c.name).join('|');
    lines.push(`maestro {${subCmds}} — Core utilities`);
  }

  // Group definitions for compact rendering (imported from prompts)
  const groupMeta = COMMAND_GROUP_META;

  for (const [parent, commands] of Object.entries(grouped)) {
    if (parent === 'root') continue;

    const meta = groupMeta[parent];
    const desc = meta?.description || '';

    // Separate simple sub-commands from nested ones (e.g. task:report:*, task:docs:*)
    const simple: string[] = [];
    const nestedCmds: CommandDefinition[] = [];

    for (const cmd of commands) {
      const parts = cmd.name.replace(`${parent}:`, '').split(':');
      if (parts.length === 1) {
        simple.push(parts[0]);
      } else {
        nestedCmds.push(cmd);
      }
    }

    // Render simple sub-commands as compact group
    if (simple.length > 0) {
      const prefix = meta?.prefix || `maestro ${parent}`;
      const subCmds = simple.join('|');
      lines.push(`${prefix} {${subCmds}} — ${desc}`);
    }

    // Render nested sub-commands with FULL SYNTAX (report, docs commands)
    // These are the commands agents get wrong most often due to complex arg patterns
    for (const cmd of nestedCmds) {
      const syntax = COMMAND_SYNTAX[cmd.name];
      if (syntax) {
        lines.push(`${syntax} — ${cmd.description}`);
      } else {
        // Fallback: convert colon-separated name to space-separated
        const parts = cmd.name.split(':');
        lines.push(`maestro ${parts.join(' ')} — ${cmd.description}`);
      }
    }
  }

  lines.push(COMMANDS_REFERENCE_FOOTER);

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
