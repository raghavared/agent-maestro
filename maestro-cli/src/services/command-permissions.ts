/**
 * Command Permissions Service
 *
 * Controls which commands are available to agents based on manifest configuration.
 * This module reads the manifest and determines allowed commands based on:
 * - Mode (execute vs coordinate)
 * - Strategy (simple, queue, default, etc.)
 * - Explicit allowedCommands list in manifest
 */

import type { MaestroManifest, AgentMode} from '../types/manifest.js';
import { isWorkerMode, isCoordinatorMode } from '../types/manifest.js';
import { readManifestFromEnv } from './manifest-reader.js';
import { config } from '../config.js';

// Mode groups for command permissions
const ALL_MODES: AgentMode[] = ['worker', 'coordinator', 'coordinated-worker', 'coordinated-coordinator'];
const COORDINATOR_MODES: AgentMode[] = ['coordinator', 'coordinated-coordinator'];
const WORKER_MODES: AgentMode[] = ['worker', 'coordinated-worker'];
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
  { name: 'whoami', description: CMD_DESC.whoami, allowedModes: ALL_MODES, isCore: true },
  { name: 'status', description: CMD_DESC.status, allowedModes: ALL_MODES, isCore: true },
  { name: 'commands', description: CMD_DESC.commands, allowedModes: ALL_MODES, isCore: true },

  // Task commands
  { name: 'task:list', description: CMD_DESC['task:list'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:get', description: CMD_DESC['task:get'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:create', description: CMD_DESC['task:create'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:edit', description: CMD_DESC['task:edit'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:delete', description: CMD_DESC['task:delete'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:update', description: CMD_DESC['task:update'], allowedModes: COORDINATOR_MODES, parent: 'task' },
  { name: 'task:complete', description: CMD_DESC['task:complete'], allowedModes: COORDINATOR_MODES, parent: 'task' },
  { name: 'task:block', description: CMD_DESC['task:block'], allowedModes: COORDINATOR_MODES, parent: 'task' },
  { name: 'task:children', description: CMD_DESC['task:children'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:tree', description: CMD_DESC['task:tree'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:report:progress', description: CMD_DESC['task:report:progress'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:report:complete', description: CMD_DESC['task:report:complete'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:report:blocked', description: CMD_DESC['task:report:blocked'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:report:error', description: CMD_DESC['task:report:error'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:docs:add', description: CMD_DESC['task:docs:add'], allowedModes: ALL_MODES, parent: 'task' },
  { name: 'task:docs:list', description: CMD_DESC['task:docs:list'], allowedModes: ALL_MODES, parent: 'task' },

  // Session commands
  { name: 'session:list', description: CMD_DESC['session:list'], allowedModes: COORDINATOR_MODES, parent: 'session' },
  { name: 'session:siblings', description: CMD_DESC['session:siblings'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:info', description: CMD_DESC['session:info'], allowedModes: COORDINATOR_MODES, parent: 'session' },
  { name: 'session:watch', description: CMD_DESC['session:watch'], allowedModes: COORDINATOR_MODES, parent: 'session' },
  { name: 'session:spawn', description: CMD_DESC['session:spawn'], allowedModes: COORDINATOR_MODES, parent: 'session' },
  { name: 'session:logs', description: CMD_DESC['session:logs'], allowedModes: COORDINATOR_MODES, parent: 'session' },
  { name: 'session:notify', description: CMD_DESC['session:notify'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:mail:read', description: CMD_DESC['session:mail:read'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:prompt', description: CMD_DESC['session:prompt'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:register', description: CMD_DESC['session:register'], allowedModes: ALL_MODES, parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:complete', description: CMD_DESC['session:complete'], allowedModes: ALL_MODES, parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:report:progress', description: CMD_DESC['session:report:progress'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:report:complete', description: CMD_DESC['session:report:complete'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:report:blocked', description: CMD_DESC['session:report:blocked'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:report:error', description: CMD_DESC['session:report:error'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:docs:add', description: CMD_DESC['session:docs:add'], allowedModes: ALL_MODES, parent: 'session' },
  { name: 'session:docs:list', description: CMD_DESC['session:docs:list'], allowedModes: ALL_MODES, parent: 'session' },

  // Legacy report commands (hidden from prompts, aliased to session:report:*)
  { name: 'report:progress', description: CMD_DESC['report:progress'], allowedModes: ALL_MODES, parent: 'report', hiddenFromPrompt: true },
  { name: 'report:complete', description: CMD_DESC['report:complete'], allowedModes: ALL_MODES, parent: 'report', hiddenFromPrompt: true },
  { name: 'report:blocked', description: CMD_DESC['report:blocked'], allowedModes: ALL_MODES, parent: 'report', hiddenFromPrompt: true },
  { name: 'report:error', description: CMD_DESC['report:error'], allowedModes: ALL_MODES, parent: 'report', hiddenFromPrompt: true },

  // Project commands (coordinator modes only)
  { name: 'project:list', description: CMD_DESC['project:list'], allowedModes: COORDINATOR_MODES, parent: 'project' },
  { name: 'project:get', description: CMD_DESC['project:get'], allowedModes: COORDINATOR_MODES, parent: 'project' },
  { name: 'project:create', description: CMD_DESC['project:create'], allowedModes: COORDINATOR_MODES, parent: 'project' },
  { name: 'project:delete', description: CMD_DESC['project:delete'], allowedModes: COORDINATOR_MODES, parent: 'project' },
  { name: 'project:set-master', description: CMD_DESC['project:set-master'], allowedModes: COORDINATOR_MODES, parent: 'project' },
  { name: 'project:unset-master', description: CMD_DESC['project:unset-master'], allowedModes: COORDINATOR_MODES, parent: 'project' },

  // Master commands (cross-project, master sessions only)
  { name: 'master:projects', description: CMD_DESC['master:projects'], allowedModes: ALL_MODES, parent: 'master' },
  { name: 'master:tasks', description: CMD_DESC['master:tasks'], allowedModes: ALL_MODES, parent: 'master' },
  { name: 'master:sessions', description: CMD_DESC['master:sessions'], allowedModes: ALL_MODES, parent: 'master' },
  { name: 'master:context', description: CMD_DESC['master:context'], allowedModes: ALL_MODES, parent: 'master' },

  // Init commands (invoked by the spawning system, not by agents directly)
  { name: 'worker:init', description: CMD_DESC['worker:init'], allowedModes: WORKER_MODES, parent: 'worker', hiddenFromPrompt: true },
  { name: 'orchestrator:init', description: CMD_DESC['orchestrator:init'], allowedModes: COORDINATOR_MODES, parent: 'orchestrator', hiddenFromPrompt: true },

  // Team member commands (all modes)
  { name: 'team-member:create', description: CMD_DESC['team-member:create'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:list', description: CMD_DESC['team-member:list'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:get', description: CMD_DESC['team-member:get'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:edit', description: CMD_DESC['team-member:edit'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:archive', description: CMD_DESC['team-member:archive'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:unarchive', description: CMD_DESC['team-member:unarchive'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:delete', description: CMD_DESC['team-member:delete'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:reset', description: CMD_DESC['team-member:reset'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:update-identity', description: CMD_DESC['team-member:update-identity'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:memory:append', description: CMD_DESC['team-member:memory:append'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:memory:list', description: CMD_DESC['team-member:memory:list'], allowedModes: ALL_MODES, parent: 'team-member' },
  { name: 'team-member:memory:clear', description: CMD_DESC['team-member:memory:clear'], allowedModes: ALL_MODES, parent: 'team-member' },

  // Team commands
  { name: 'team:list', description: CMD_DESC['team:list'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:get', description: CMD_DESC['team:get'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:create', description: CMD_DESC['team:create'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:edit', description: CMD_DESC['team:edit'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:delete', description: CMD_DESC['team:delete'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:archive', description: CMD_DESC['team:archive'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:unarchive', description: CMD_DESC['team:unarchive'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:add-member', description: CMD_DESC['team:add-member'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:remove-member', description: CMD_DESC['team:remove-member'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:add-sub-team', description: CMD_DESC['team:add-sub-team'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:remove-sub-team', description: CMD_DESC['team:remove-sub-team'], allowedModes: ALL_MODES, parent: 'team' },
  { name: 'team:tree', description: CMD_DESC['team:tree'], allowedModes: ALL_MODES, parent: 'team' },

  // Show commands (display content in UI)
  { name: 'show:modal', description: CMD_DESC['show:modal'], allowedModes: ALL_MODES, parent: 'show' },

  // Modal commands (interact with agent modals)
  { name: 'modal:events', description: CMD_DESC['modal:events'], allowedModes: ALL_MODES, parent: 'modal' },

  // Utility commands (internal — called by hooks, not agents)
  { name: 'track-file', description: CMD_DESC['track-file'], allowedModes: ALL_MODES, isCore: true, hiddenFromPrompt: true },

  // Developer debug commands
  { name: 'debug-prompt', description: CMD_DESC['debug-prompt'], allowedModes: ALL_MODES, isCore: true, hiddenFromPrompt: true },
];

/** Master-only commands added when MAESTRO_IS_MASTER=true */
export const MASTER_COMMANDS = [
  'master:projects',
  'master:tasks',
  'master:sessions',
  'master:context',
];

// Shared commands available to all modes
const BASE_COMMANDS = [
  'whoami', 'status', 'commands',
  'task:list', 'task:get', 'task:create', 'task:edit', 'task:delete',
  'task:children', 'task:tree',
  'task:report:progress', 'task:report:complete', 'task:report:blocked', 'task:report:error',
  'task:docs:add', 'task:docs:list',
  'session:siblings', 'session:register', 'session:complete',
  'session:report:progress', 'session:report:complete', 'session:report:blocked', 'session:report:error',
  'session:notify', 'session:mail:read', 'session:prompt',
  'session:docs:add', 'session:docs:list',
  'team-member:create', 'team-member:list', 'team-member:get', 'team-member:edit',
  'team-member:archive', 'team-member:unarchive', 'team-member:delete', 'team-member:reset',
  'team-member:update-identity', 'team-member:memory:append', 'team-member:memory:list', 'team-member:memory:clear',
  'team:list', 'team:get', 'team:create', 'team:edit', 'team:delete',
  'team:archive', 'team:unarchive', 'team:add-member', 'team:remove-member',
  'team:add-sub-team', 'team:remove-sub-team', 'team:tree',
  'show:modal', 'modal:events',
  'report:progress', 'report:complete', 'report:blocked', 'report:error',
  'track-file',
];

// Additional commands for coordinator modes
const COORDINATOR_EXTRA_COMMANDS = [
  'task:update', 'task:complete', 'task:block',
  'session:list', 'session:info', 'session:watch', 'session:spawn', 'session:logs',
  'project:list', 'project:get', 'project:create', 'project:delete',
  'project:set-master', 'project:unset-master',
];

// Additional commands for worker modes (session awareness)
const WORKER_EXTRA_COMMANDS = [
  'session:list', 'session:info', 'session:logs',
];

/**
 * Default allowed commands by mode
 */
export const DEFAULT_COMMANDS_BY_MODE: Record<string, string[]> = {
  'worker': [...BASE_COMMANDS, ...WORKER_EXTRA_COMMANDS],
  'coordinated-worker': [...BASE_COMMANDS, ...WORKER_EXTRA_COMMANDS],
  'coordinator': [...BASE_COMMANDS, ...COORDINATOR_EXTRA_COMMANDS],
  'coordinated-coordinator': [...BASE_COMMANDS, ...COORDINATOR_EXTRA_COMMANDS],
  // Legacy aliases
  'execute': [...BASE_COMMANDS, ...WORKER_EXTRA_COMMANDS],
  'coordinate': [...BASE_COMMANDS, ...COORDINATOR_EXTRA_COMMANDS],
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
    const allCommands = COMMAND_REGISTRY.map(c => c.name);
    return {
      allowedCommands: allCommands,
      hiddenCommands: [],
      mode: 'worker',
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
        mode: 'worker',
        loadedFromManifest: false,
      };
    }

    return getPermissionsFromManifest(result.manifest);
  } catch {
    // Fall back to defaults on error
    return {
      allowedCommands: COMMAND_REGISTRY.map(c => c.name),
      hiddenCommands: [],
      mode: 'worker',
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

  // Start with defaults for the mode
  let allowedCommands = [...DEFAULT_COMMANDS_BY_MODE[mode]];

  // Inject master commands if this is a master session
  if (config.isMaster) {
    for (const cmd of MASTER_COMMANDS) {
      if (!allowedCommands.includes(cmd)) {
        allowedCommands.push(cmd);
      }
    }
  }

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
export function getAvailableCommandsGrouped(manifest: MaestroManifest, permissions: CommandPermissions, excludeHidden: boolean = false): Record<string, CommandDefinition[]> {
  const grouped: Record<string, CommandDefinition[]> = {};

  for (const cmd of COMMAND_REGISTRY) {
    if (permissions.allowedCommands.includes(cmd.name)) {
      if(!cmd.allowedModes.includes(manifest.mode)) continue;
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
export function printAvailableCommands(manifest: MaestroManifest, permissions: CommandPermissions): void {
  console.log(AVAILABLE_COMMANDS_HEADER(manifest.mode));
  console.log(AVAILABLE_COMMANDS_SEPARATOR);

  const grouped = getAvailableCommandsGrouped(manifest, permissions);

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
  // Master commands are always gated by MAESTRO_IS_MASTER env var
  if (commandName.startsWith('master:') && !config.isMaster) {
    throw new Error(`Command '${commandName}' is only available in master sessions (MAESTRO_IS_MASTER=true).`);
  }

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
export function generateCommandBrief(manifest: MaestroManifest, permissions: CommandPermissions): string {
  const lines: string[] = [
    COMMANDS_REFERENCE_HEADER(manifest.mode),
    '',
  ];

  const grouped = getAvailableCommandsGrouped(manifest, permissions, true);

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
export function generateCompactCommandBrief(manifest: MaestroManifest, permissions: CommandPermissions): string {
  const mode = manifest.mode;

  const lines: string[] = [COMMANDS_REFERENCE_HEADER(mode)];

  const grouped = getAvailableCommandsGrouped(manifest, permissions, true);

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
