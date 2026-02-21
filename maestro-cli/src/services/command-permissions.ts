import type { AgentMode, MaestroManifest } from '../types/manifest.js';
import { readManifestFromEnv } from './manifest-reader.js';
import { config } from '../config.js';
import { formatCommandNotAllowed, AVAILABLE_COMMANDS_HEADER, AVAILABLE_COMMANDS_SEPARATOR, HIDDEN_COMMANDS_LABEL } from '../prompts/index.js';
import {
  type CapabilityFlags,
  type CapabilitySet,
  type ManifestFailurePolicy,
  resolveCapabilitySet,
  resolveManifestFailureCapabilities,
  resolveNoManifestCapabilities,
} from '../prompting/capability-policy.js';
import {
  type CommandCatalogEntry,
  COMMAND_CATALOG,
  MASTER_COMMAND_IDS,
  getCommandCatalog,
  getCommandSyntax as getCatalogCommandSyntax,
  groupCommandsByParent,
  getDefaultCommandsForMode,
} from '../prompting/command-catalog.js';
import { normalizeManifest } from '../prompting/manifest-normalizer.js';

export type CommandDefinition = CommandCatalogEntry;

export interface CommandPermissions {
  allowedCommands: string[];
  hiddenCommands: string[];
  mode: AgentMode;
  loadedFromManifest: boolean;
  resolution?: 'manifest' | 'no-manifest' | 'fallback';
  capabilities?: CapabilityFlags;
}

export const COMMAND_REGISTRY: CommandDefinition[] = COMMAND_CATALOG;
export const MASTER_COMMANDS = MASTER_COMMAND_IDS;

export const DEFAULT_COMMANDS_BY_MODE: Record<string, string[]> = {
  worker: getDefaultCommandsForMode('worker'),
  coordinator: getDefaultCommandsForMode('coordinator'),
  'coordinated-worker': getDefaultCommandsForMode('coordinated-worker'),
  'coordinated-coordinator': getDefaultCommandsForMode('coordinated-coordinator'),
  execute: getDefaultCommandsForMode('worker'),
  coordinate: getDefaultCommandsForMode('coordinator'),
};

function toPermissions(set: CapabilitySet): CommandPermissions {
  return {
    allowedCommands: set.allowedCommands,
    hiddenCommands: set.hiddenCommands,
    mode: set.mode,
    loadedFromManifest: set.loadedFromManifest,
    resolution: set.resolution,
    capabilities: set.capabilities,
  };
}

export async function loadCommandPermissions(): Promise<CommandPermissions> {
  const manifestPath = process.env.MAESTRO_MANIFEST_PATH;

  if (!manifestPath) {
    return toPermissions(resolveNoManifestCapabilities('worker'));
  }

  try {
    const result = await readManifestFromEnv();

    if (!result.success || !result.manifest) {
      return toPermissions(resolveManifestFailureCapabilities('worker', config.manifestPermissionFailurePolicy as ManifestFailurePolicy));
    }

    return getPermissionsFromManifest(result.manifest);
  } catch {
    return toPermissions(resolveManifestFailureCapabilities('worker', config.manifestPermissionFailurePolicy as ManifestFailurePolicy));
  }
}

export function getPermissionsFromManifest(manifest: MaestroManifest): CommandPermissions {
  const normalized = normalizeManifest(manifest).manifest;

  return toPermissions(
    resolveCapabilitySet(normalized, {
      isMasterSession: normalized.isMaster || config.isMaster,
    }),
  );
}

export function isCommandAllowed(commandName: string, permissions: CommandPermissions): boolean {
  return permissions.allowedCommands.includes(commandName);
}

export function getAvailableCommandsGrouped(
  manifest: MaestroManifest,
  permissions: CommandPermissions,
  excludeHidden = false,
): Record<string, CommandDefinition[]> {
  return groupCommandsByParent(permissions.allowedCommands, manifest.mode, {
    excludePromptHidden: excludeHidden,
  });
}

export function printAvailableCommands(manifest: MaestroManifest, permissions: CommandPermissions): void {
  console.log(AVAILABLE_COMMANDS_HEADER(manifest.mode));
  console.log(AVAILABLE_COMMANDS_SEPARATOR);

  const grouped = getAvailableCommandsGrouped(manifest, permissions);

  if (grouped.root) {
    for (const command of grouped.root) {
      console.log(`  ${command.syntax.padEnd(42)} ${command.description}`);
    }
  }

  for (const [group, commands] of Object.entries(grouped)) {
    if (group === 'root') continue;

    console.log(`\n  ${group}:`);
    for (const command of commands) {
      console.log(`    ${command.syntax.padEnd(40)} ${command.description}`);
    }
  }

  if (permissions.hiddenCommands.length > 0) {
    console.log(`\n  ${HIDDEN_COMMANDS_LABEL(permissions.hiddenCommands.length)}`);
  }

  console.log('');
}

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

export async function guardCommand(commandName: string): Promise<void> {
  if (commandName.startsWith('master:') && !config.isMaster) {
    throw new Error(`Command '${commandName}' is only available in master sessions (MAESTRO_IS_MASTER=true).`);
  }

  const permissions = await getOrLoadPermissions();

  if (!permissions.loadedFromManifest && permissions.resolution === 'no-manifest') {
    // No manifest context at all (human-operated shell usage), keep permissive behavior.
    return;
  }

  if (!isCommandAllowed(commandName, permissions)) {
    throw new Error(formatCommandNotAllowed(commandName, permissions.mode));
  }
}

export function guardCommandSync(commandName: string): boolean {
  const permissions = cachedPermissions;

  if (!permissions) {
    return true;
  }

  if (!permissions.loadedFromManifest && permissions.resolution === 'no-manifest') {
    return true;
  }

  return isCommandAllowed(commandName, permissions);
}

export function getCommandSyntax(commandName: string): string {
  return getCatalogCommandSyntax(commandName);
}

export function getCommandCatalogEntries(): CommandDefinition[] {
  return getCommandCatalog();
}
