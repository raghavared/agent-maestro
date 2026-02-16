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
import { getEffectiveStrategy, computeCapabilities } from '../types/manifest.js';
import { readManifestFromEnv } from './manifest-reader.js';

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
  { name: 'whoami', description: 'Print current context', allowedModes: ['execute', 'coordinate'], isCore: true },
  { name: 'status', description: 'Show project status', allowedModes: ['execute', 'coordinate'], isCore: true },
  { name: 'commands', description: 'Show available commands', allowedModes: ['execute', 'coordinate'], isCore: true },

  // Task commands
  { name: 'task:list', description: 'List tasks', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:get', description: 'Get task details', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:create', description: 'Create new task', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:edit', description: 'Edit task fields', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:delete', description: 'Delete a task', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:update', description: 'Update task status/priority', allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:complete', description: 'Mark task completed', allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:block', description: 'Mark task blocked', allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:children', description: 'List child tasks', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:tree', description: 'Show task tree', allowedModes: ['coordinate'], parent: 'task' },
  { name: 'task:report:progress', description: 'Report task progress', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:complete', description: 'Report task completion', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:blocked', description: 'Report task blocked', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:report:error', description: 'Report task error', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:docs:add', description: 'Add doc to task', allowedModes: ['execute', 'coordinate'], parent: 'task' },
  { name: 'task:docs:list', description: 'List task docs', allowedModes: ['execute', 'coordinate'], parent: 'task' },

  // Session commands
  { name: 'session:list', description: 'List sessions', allowedModes: ['coordinate'], parent: 'session' },
  { name: 'session:info', description: 'Get session info', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:watch', description: 'Watch sessions in real-time', allowedModes: ['coordinate'], parent: 'session' },
  { name: 'session:spawn', description: 'Spawn new session', allowedModes: ['coordinate'], parent: 'session' },
  { name: 'session:register', description: 'Register session', allowedModes: ['execute', 'coordinate'], parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:complete', description: 'Complete session', allowedModes: ['execute', 'coordinate'], parent: 'session', isCore: true, hiddenFromPrompt: true },
  { name: 'session:report:progress', description: 'Report work progress', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:complete', description: 'Report completion', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:blocked', description: 'Report blocker', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:report:error', description: 'Report error', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:docs:add', description: 'Add doc to session', allowedModes: ['execute', 'coordinate'], parent: 'session' },
  { name: 'session:docs:list', description: 'List session docs', allowedModes: ['execute', 'coordinate'], parent: 'session' },

  // Legacy report commands (hidden from prompts, aliased to session:report:*)
  { name: 'report:progress', description: 'Report work progress', allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:complete', description: 'Report completion', allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:blocked', description: 'Report blocker', allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },
  { name: 'report:error', description: 'Report error', allowedModes: ['execute', 'coordinate'], parent: 'report', hiddenFromPrompt: true },

  // Queue commands (only for queue strategy)
  { name: 'queue:top', description: 'Show next task in queue', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:start', description: 'Start processing task', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:complete', description: 'Complete current task', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:fail', description: 'Mark task failed', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:skip', description: 'Skip current task', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:list', description: 'List queue items', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:status', description: 'Show queue status', allowedModes: ['execute'], parent: 'queue', allowedStrategies: ['queue'] },
  { name: 'queue:push', description: 'Add task to queue', allowedModes: ['execute', 'coordinate'], parent: 'queue', allowedStrategies: ['queue'] },

  // Project commands (coordinate only)
  { name: 'project:list', description: 'List projects', allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:get', description: 'Get project details', allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:create', description: 'Create project', allowedModes: ['coordinate'], parent: 'project' },
  { name: 'project:delete', description: 'Delete project', allowedModes: ['coordinate'], parent: 'project' },

  // Mail commands
  { name: 'mail:send', description: 'Send mail to a session', allowedModes: ['execute', 'coordinate'], parent: 'mail' },
  { name: 'mail:inbox', description: 'List inbox for current session', allowedModes: ['execute', 'coordinate'], parent: 'mail' },
  { name: 'mail:reply', description: 'Reply to a mail', allowedModes: ['execute', 'coordinate'], parent: 'mail' },
  { name: 'mail:broadcast', description: 'Send to all sessions', allowedModes: ['coordinate'], parent: 'mail' },
  { name: 'mail:wait', description: 'Long-poll, block until mail arrives', allowedModes: ['coordinate'], parent: 'mail' },

  // Init commands (invoked by the spawning system, not by agents directly)
  { name: 'worker:init', description: 'Initialize execute-mode session', allowedModes: ['execute'], parent: 'worker', hiddenFromPrompt: true },
  { name: 'orchestrator:init', description: 'Initialize coordinate-mode session', allowedModes: ['coordinate'], parent: 'orchestrator', hiddenFromPrompt: true },

  // Show commands (display content in UI)
  { name: 'show:modal', description: 'Show HTML modal in UI', allowedModes: ['execute', 'coordinate'], parent: 'show' },

  // Modal commands (interact with agent modals)
  { name: 'modal:events', description: 'Listen for modal user actions', allowedModes: ['execute', 'coordinate'], parent: 'modal' },

  // Utility commands (internal — called by hooks, not agents)
  { name: 'track-file', description: 'Track file modification', allowedModes: ['execute', 'coordinate'], isCore: true, hiddenFromPrompt: true },
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
    'task:report:progress',
    'task:report:complete',
    'task:report:blocked',
    'task:report:error',
    'task:docs:add',
    'task:docs:list',
    'session:info',
    'session:register',
    'session:complete',
    'session:report:progress',
    'session:report:complete',
    'session:report:blocked',
    'session:report:error',
    'session:docs:add',
    'session:docs:list',
    // Mail commands (execute: send, inbox, reply)
    'mail:send',
    'mail:inbox',
    'mail:reply',
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
    'session:info',
    'session:watch',
    'session:spawn',
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
    // Mail commands (coordinate: all 5)
    'mail:send',
    'mail:inbox',
    'mail:reply',
    'mail:broadcast',
    'mail:wait',
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
  /** Agent mode */
  mode: AgentMode;
  /** Strategy for this session */
  strategy: string;
  /** Computed capabilities (three-axis model) */
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
      strategy: 'simple',
      capabilities: computeCapabilities('execute', 'simple'),
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
        strategy: 'simple',
        capabilities: computeCapabilities('execute', 'simple'),
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
      strategy: 'simple',
      capabilities: computeCapabilities('execute', 'simple'),
      loadedFromManifest: false,
    };
  }
}

/**
 * Get command permissions from a manifest object
 */
export function getPermissionsFromManifest(manifest: MaestroManifest): CommandPermissions {
  const mode = manifest.mode;
  const strategy = getEffectiveStrategy(manifest);
  const capabilities = computeCapabilities(mode, strategy);

  // Start with defaults for the mode
  let allowedCommands = [...DEFAULT_COMMANDS_BY_MODE[mode]];

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
    mode,
    strategy,
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
      const subCmd = cmd.name.replace(`${parent}:`, '').replace(/:/g, ' ');
      console.log(`    maestro ${parent} ${subCmd.padEnd(15)} ${cmd.description}`);
    }
  }

  if (permissions.hiddenCommands.length > 0) {
    console.log(`\n  (${permissions.hiddenCommands.length} commands hidden based on mode/strategy)`);
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
      `Command '${commandName}' is not allowed for ${permissions.mode} mode with ${permissions.strategy} strategy.\n` +
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
 * Command syntax/usage for each command (maps command name to usage string)
 */
const COMMAND_SYNTAX: Record<string, string> = {
  'whoami': 'maestro whoami',
  'status': 'maestro status',
  'commands': 'maestro commands',
  'track-file': 'maestro track-file <filePath>',
  // Legacy report aliases
  'report:progress': 'maestro report progress "<message>"',
  'report:complete': 'maestro report complete "<summary>"',
  'report:blocked': 'maestro report blocked "<reason>"',
  'report:error': 'maestro report error "<description>"',
  // Task commands
  'task:list': 'maestro task list [taskId] [--status <status>] [--priority <priority>]',
  'task:get': 'maestro task get <taskId>',
  'task:create': 'maestro task create "<title>" [-d "<description>"] [--priority <high|medium|low>] [--parent <parentId>]',
  'task:edit': 'maestro task edit <taskId> [--title "<title>"] [--desc "<description>"] [--priority <priority>]',
  'task:delete': 'maestro task delete <taskId> [--cascade]',
  'task:update': 'maestro task update <taskId> [--status <status>] [--priority <priority>] [--title "<title>"]',
  'task:complete': 'maestro task complete <taskId>',
  'task:block': 'maestro task block <taskId> --reason "<reason>"',
  'task:children': 'maestro task children <taskId> [--recursive]',
  'task:tree': 'maestro task tree [--root <taskId>] [--depth <n>] [--status <status>]',
  'task:report:progress': 'maestro task report progress <taskId> "<message>"',
  'task:report:complete': 'maestro task report complete <taskId> "<summary>"',
  'task:report:blocked': 'maestro task report blocked <taskId> "<reason>"',
  'task:report:error': 'maestro task report error <taskId> "<description>"',
  'task:docs:add': 'maestro task docs add <taskId> "<title>" --file <filePath>',
  'task:docs:list': 'maestro task docs list <taskId>',
  // Session commands
  'session:list': 'maestro session list',
  'session:info': 'maestro session info',
  'session:watch': 'maestro session watch <sessionId1>,<sessionId2>,...',
  'session:spawn': 'maestro session spawn',
  'session:register': 'maestro session register',
  'session:complete': 'maestro session complete',
  'session:report:progress': 'maestro session report progress "<message>"',
  'session:report:complete': 'maestro session report complete "<summary>"',
  'session:report:blocked': 'maestro session report blocked "<reason>"',
  'session:report:error': 'maestro session report error "<description>"',
  'session:docs:add': 'maestro session docs add "<title>" --file <filePath>',
  'session:docs:list': 'maestro session docs list',
  // Queue commands
  'queue:top': 'maestro queue top',
  'queue:start': 'maestro queue start',
  'queue:complete': 'maestro queue complete',
  'queue:fail': 'maestro queue fail',
  'queue:skip': 'maestro queue skip',
  'queue:list': 'maestro queue list',
  'queue:status': 'maestro queue status',
  'queue:push': 'maestro queue push',
  // Project commands
  'project:list': 'maestro project list',
  'project:get': 'maestro project get <projectId>',
  'project:create': 'maestro project create "<name>"',
  'project:delete': 'maestro project delete <projectId>',
  // Mail commands
  'mail:send': 'maestro mail send <sessionId1>,<sessionId2>,... --type <type> --subject "<subject>" [--message "<message>"]',
  'mail:inbox': 'maestro mail inbox [--type <type>]',
  'mail:reply': 'maestro mail reply <mailId> --message "<message>"',
  'mail:broadcast': 'maestro mail broadcast --type <type> --subject "<subject>" [--message "<message>"]',
  'mail:wait': 'maestro mail wait [--timeout <ms>] [--since <timestamp>]',
  'worker:init': 'maestro worker init',
  'orchestrator:init': 'maestro orchestrator init',
};

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
    '## Maestro Commands',
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
  const lines: string[] = ['## Maestro Commands'];

  const grouped = getAvailableCommandsGrouped(permissions, true);

  // Core/root commands as a single line
  if (grouped['root']) {
    const subCmds = grouped['root'].map(c => c.name).join('|');
    lines.push(`maestro {${subCmds}} — Core utilities`);
  }

  // Group definitions for compact rendering
  const groupMeta: Record<string, { prefix: string; description: string }> = {
    report: { prefix: 'maestro report', description: 'Status reporting' },
    task: { prefix: 'maestro task', description: 'Task management' },
    session: { prefix: 'maestro session', description: 'Session management' },
    queue: { prefix: 'maestro queue', description: 'Queue operations' },
    project: { prefix: 'maestro project', description: 'Project management' },
    mail: { prefix: 'maestro mail', description: 'Mailbox coordination' },
    worker: { prefix: 'maestro worker', description: 'Worker initialization' },
    orchestrator: { prefix: 'maestro orchestrator', description: 'Orchestrator initialization' },
  };

  for (const [parent, commands] of Object.entries(grouped)) {
    if (parent === 'root') continue;

    const meta = groupMeta[parent];
    const prefix = meta?.prefix || `maestro ${parent}`;
    const desc = meta?.description || '';

    // Separate simple sub-commands from nested ones (e.g. task:report:*, task:docs:*)
    const simple: string[] = [];
    const nested: Map<string, string[]> = new Map();

    for (const cmd of commands) {
      const parts = cmd.name.replace(`${parent}:`, '').split(':');
      if (parts.length === 1) {
        simple.push(parts[0]);
      } else {
        const nestedGroup = parts[0];
        if (!nested.has(nestedGroup)) {
          nested.set(nestedGroup, []);
        }
        nested.get(nestedGroup)!.push(parts.slice(1).join(' '));
      }
    }

    // Render simple sub-commands
    if (simple.length > 0) {
      const subCmds = simple.join('|');
      lines.push(`${prefix} {${subCmds}} — ${desc}`);
    }

    // Render nested sub-groups
    for (const [nestedGroup, subCmds] of nested.entries()) {
      const nestedJoined = subCmds.join('|');
      lines.push(`${prefix} ${nestedGroup} {${nestedJoined}} — ${capitalize(parent)} ${nestedGroup}`);
    }
  }

  lines.push('Run `maestro commands` for full syntax reference.');

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
