/**
 * Command Permissions Service
 *
 * Controls which commands are available to workers/orchestrators based on manifest configuration.
 * This module reads the manifest and determines allowed commands based on:
 * - Role (worker vs orchestrator)
 * - Strategy (simple vs queue)
 * - Explicit allowedCommands list in manifest
 */

import type { MaestroManifest, WorkerStrategy } from '../types/manifest.js';
import { readManifestFromEnv } from './manifest-reader.js';

/**
 * Command definition with metadata
 */
export interface CommandDefinition {
  name: string;
  description: string;
  /** Parent command (e.g., 'task' for 'task:list') */
  parent?: string;
  /** Roles that can use this command */
  allowedRoles: ('worker' | 'orchestrator')[];
  /** Strategies that enable this command (undefined = all strategies) */
  allowedStrategies?: WorkerStrategy[];
  /** Whether this is a core command always available */
  isCore?: boolean;
}

/**
 * Full command registry with metadata
 */
export const COMMAND_REGISTRY: CommandDefinition[] = [
  // Core commands (always available)
  { name: 'whoami', description: 'Print current context', allowedRoles: ['worker', 'orchestrator'], isCore: true },
  { name: 'status', description: 'Show project status', allowedRoles: ['worker', 'orchestrator'], isCore: true },

  // Report commands (session status reporting)
  { name: 'report:progress', description: 'Report work progress', allowedRoles: ['worker', 'orchestrator'], parent: 'report' },
  { name: 'report:complete', description: 'Report completion', allowedRoles: ['worker', 'orchestrator'], parent: 'report' },
  { name: 'report:blocked', description: 'Report blocker', allowedRoles: ['worker', 'orchestrator'], parent: 'report' },
  { name: 'report:error', description: 'Report error', allowedRoles: ['worker', 'orchestrator'], parent: 'report' },
  { name: 'report:needs-input', description: 'Request user input', allowedRoles: ['worker', 'orchestrator'], parent: 'report' },

  // Commands (always available)
  { name: 'commands', description: 'Show available commands', allowedRoles: ['worker', 'orchestrator'], isCore: true },

  // Task commands
  { name: 'task:list', description: 'List tasks', allowedRoles: ['worker', 'orchestrator'], parent: 'task' },
  { name: 'task:get', description: 'Get task details', allowedRoles: ['worker', 'orchestrator'], parent: 'task' },
  { name: 'task:create', description: 'Create new task', allowedRoles: ['worker', 'orchestrator'], parent: 'task' },
  { name: 'task:update', description: 'Update task', allowedRoles: ['orchestrator'], parent: 'task' },
  { name: 'task:complete', description: 'Mark task completed', allowedRoles: ['orchestrator'], parent: 'task' },
  { name: 'task:block', description: 'Mark task blocked', allowedRoles: ['orchestrator'], parent: 'task' },
  { name: 'task:children', description: 'List child tasks', allowedRoles: ['worker', 'orchestrator'], parent: 'task' },
  { name: 'task:tree', description: 'Show task tree', allowedRoles: ['orchestrator'], parent: 'task' },

  // Session commands
  { name: 'session:list', description: 'List sessions', allowedRoles: ['orchestrator'], parent: 'session' },
  { name: 'session:info', description: 'Get session info', allowedRoles: ['worker', 'orchestrator'], parent: 'session' },
  { name: 'session:spawn', description: 'Spawn new session', allowedRoles: ['orchestrator'], parent: 'session' },
  { name: 'session:register', description: 'Register session', allowedRoles: ['worker', 'orchestrator'], parent: 'session', isCore: true },
  { name: 'session:complete', description: 'Complete session', allowedRoles: ['worker', 'orchestrator'], parent: 'session', isCore: true },

  // Queue commands (only for queue strategy)
  { name: 'queue:top', description: 'Show next task in queue', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:start', description: 'Start processing task', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:complete', description: 'Complete current task', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:fail', description: 'Mark task failed', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:skip', description: 'Skip current task', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:list', description: 'List queue items', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:status', description: 'Show queue status', allowedRoles: ['worker'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:push', description: 'Add task to queue', allowedRoles: ['worker', 'orchestrator'], parent: 'queue', allowedStrategies: ['queue'] },

  // Project commands (orchestrator only)
  { name: 'project:list', description: 'List projects', allowedRoles: ['orchestrator'], parent: 'project' },
  { name: 'project:get', description: 'Get project details', allowedRoles: ['orchestrator'], parent: 'project' },
  { name: 'project:create', description: 'Create project', allowedRoles: ['orchestrator'], parent: 'project' },
  { name: 'project:delete', description: 'Delete project', allowedRoles: ['orchestrator'], parent: 'project' },

  // Worker/Orchestrator init commands
  { name: 'worker:init', description: 'Initialize worker session', allowedRoles: ['worker'], parent: 'worker', isCore: true },
  { name: 'orchestrator:init', description: 'Initialize orchestrator session', allowedRoles: ['orchestrator'], parent: 'orchestrator', isCore: true },

  // Utility commands
  { name: 'track-file', description: 'Track file modification', allowedRoles: ['worker', 'orchestrator'], isCore: true },
];

/**
 * Default allowed commands by role
 */
export const DEFAULT_COMMANDS_BY_ROLE: Record<string, string[]> = {
  worker: [
    'whoami',
    'status',
    'commands',
    'report:progress',
    'report:complete',
    'report:blocked',
    'report:error',
    'report:needs-input',
    'task:list',
    'task:get',
    'task:create',
    'task:children',
    'session:info',
    'session:register',
    'session:complete',
    'track-file',
    'worker:init',
  ],
  orchestrator: [
    'whoami',
    'status',
    'commands',
    'report:progress',
    'report:complete',
    'report:blocked',
    'report:error',
    'report:needs-input',
    'task:list',
    'task:get',
    'task:create',
    'task:update',
    'task:complete',
    'task:block',
    'task:children',
    'task:tree',
    'session:list',
    'session:info',
    'session:spawn',
    'session:register',
    'session:complete',
    'project:list',
    'project:get',
    'project:create',
    'project:delete',
    'track-file',
    'orchestrator:init',
  ],
};

/**
 * Commands added for queue strategy
 */
export const QUEUE_STRATEGY_COMMANDS: string[] = [
  'queue:top',
  'queue:start',
  'queue:complete',
  'queue:fail',
  'queue:skip',
  'queue:list',
  'queue:status',
  'queue:push',
];

/**
 * Commands added for tree strategy (grants task:tree to workers)
 * NOTE: Tree strategy not yet implemented - commented out for now
 */
// export const TREE_STRATEGY_COMMANDS: string[] = [
//   'task:tree',
//   'task:children',
// ];

/**
 * Result of loading command permissions
 */
export interface CommandPermissions {
  /** List of allowed command names */
  allowedCommands: string[];
  /** List of hidden command names */
  hiddenCommands: string[];
  /** Role from manifest */
  role: 'worker' | 'orchestrator';
  /** Strategy from manifest */
  strategy: WorkerStrategy;
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
      role: 'worker',
      strategy: 'simple',
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
        role: 'worker',
        strategy: 'simple',
        loadedFromManifest: false,
      };
    }

    return getPermissionsFromManifest(result.manifest);
  } catch {
    // Fall back to defaults on error
    return {
      allowedCommands: COMMAND_REGISTRY.map(c => c.name),
      hiddenCommands: [],
      role: 'worker',
      strategy: 'simple',
      loadedFromManifest: false,
    };
  }
}

/**
 * Get command permissions from a manifest object
 */
export function getPermissionsFromManifest(manifest: MaestroManifest): CommandPermissions {
  const role = manifest.role;
  const strategy = manifest.strategy || 'simple';

  // Start with defaults for the role
  let allowedCommands = [...DEFAULT_COMMANDS_BY_ROLE[role]];

  // Add queue commands if using queue strategy
  if (strategy === 'queue') {
    allowedCommands = [...allowedCommands, ...QUEUE_STRATEGY_COMMANDS];
  }

  // Add tree commands if using tree strategy
  // NOTE: Tree strategy not yet implemented
  // if (strategy === 'tree') {
  //   allowedCommands = [...allowedCommands, ...TREE_STRATEGY_COMMANDS];
  // }

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
    role,
    strategy,
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
 */
export function getAvailableCommandsGrouped(permissions: CommandPermissions): Record<string, CommandDefinition[]> {
  const grouped: Record<string, CommandDefinition[]> = {};

  for (const cmd of COMMAND_REGISTRY) {
    if (permissions.allowedCommands.includes(cmd.name)) {
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
  console.log('\nAvailable Commands:');
  console.log('-------------------');

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
      const subCmd = cmd.name.replace(`${parent}:`, '');
      console.log(`    maestro ${parent} ${subCmd.padEnd(15)} ${cmd.description}`);
    }
  }

  if (permissions.hiddenCommands.length > 0) {
    console.log(`\n  (${permissions.hiddenCommands.length} commands hidden based on role/strategy)`);
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
    throw new Error(
      `Command '${commandName}' is not allowed for ${permissions.role} role with ${permissions.strategy} strategy.\n` +
        'Run "maestro commands" to see available commands.'
    );
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
 * Generate brief text listing available commands for inclusion in session prompts
 */
export function generateCommandBrief(permissions: CommandPermissions): string {
  const lines: string[] = [
    '## Available Maestro Commands',
    '',
    `Role: ${permissions.role} | Strategy: ${permissions.strategy}`,
    '',
  ];

  const grouped = getAvailableCommandsGrouped(permissions);

  // Root commands
  if (grouped['root']) {
    lines.push('**Core Commands:**');
    for (const cmd of grouped['root']) {
      lines.push(`- \`maestro ${cmd.name}\` - ${cmd.description}`);
    }
    lines.push('');
  }

  // Grouped commands
  for (const [parent, commands] of Object.entries(grouped)) {
    if (parent === 'root') continue;

    lines.push(`**${parent} Commands:**`);
    for (const cmd of commands) {
      if (cmd.name === parent || !cmd.name.includes(':')) {
        // Parent command itself (e.g., name: 'update', parent: 'update')
        lines.push(`- \`maestro ${cmd.name}\` - ${cmd.description}`);
      } else {
        const subCmd = cmd.name.replace(`${parent}:`, '');
        lines.push(`- \`maestro ${parent} ${subCmd}\` - ${cmd.description}`);
      }
    }
    lines.push('');
  }

  if (permissions.hiddenCommands.length > 0) {
    lines.push(`_(${permissions.hiddenCommands.length} commands not available for this role/strategy)_`);
  }

  return lines.join('\n');
}
