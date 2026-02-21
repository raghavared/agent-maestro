import type { AgentMode, MaestroManifest } from '../types/manifest.js';
import {
  getAllCommandIds,
  getCommandById,
  getCommandIdsByGroup,
  getCoreCommandIds,
  getDefaultCommandsForMode,
  MASTER_COMMAND_IDS,
} from './command-catalog.js';

export type PermissionResolution = 'manifest' | 'no-manifest' | 'fallback';

export interface CapabilityFlags {
  canSpawnSessions: boolean;
  canManageTasks: boolean;
  canUpdateTaskStatus: boolean;
  canReportProgress: boolean;
  canManageTaskDocs: boolean;
  canManageSessionDocs: boolean;
  canManageProjects: boolean;
  canManageTeamMembers: boolean;
  canManageTeams: boolean;
  canUseMasterCommands: boolean;
  canPromptOtherSessions: boolean;
  canUseModal: boolean;
}

export interface CapabilitySet {
  mode: AgentMode;
  allowedCommands: string[];
  hiddenCommands: string[];
  capabilities: CapabilityFlags;
  loadedFromManifest: boolean;
  resolution: PermissionResolution;
}

export interface PolicyOptions {
  isMasterSession?: boolean;
}

export type ManifestFailurePolicy = 'permissive' | 'safe-degraded';

const SAFE_DEGRADED_COMMANDS = [
  'whoami',
  'status',
  'commands',
  'task:report:progress',
  'task:report:complete',
  'task:report:blocked',
  'task:report:error',
  'session:report:progress',
  'session:report:complete',
  'session:report:blocked',
  'session:report:error',
  'task:docs:add',
  'task:docs:list',
  'session:docs:add',
  'session:docs:list',
];

function sortByCatalogOrder(commandIds: Set<string>): string[] {
  const allowed = commandIds;
  return getAllCommandIds().filter((id) => allowed.has(id));
}

function ensureCoreCommands(commandIds: Set<string>): void {
  for (const core of getCoreCommandIds()) {
    commandIds.add(core);
  }
}

function commandAllowedForMode(commandId: string, mode: AgentMode): boolean {
  const entry = getCommandById(commandId);
  if (!entry) return false;
  return entry.allowedModes.includes(mode);
}

function applyGroupOverrides(manifest: MaestroManifest, commands: Set<string>, mode: AgentMode): void {
  const groups = manifest.teamMemberCommandPermissions?.groups;
  if (!groups) return;

  const core = new Set(getCoreCommandIds());
  for (const [group, enabled] of Object.entries(groups)) {
    const groupCommands = group === 'root'
      ? getAllCommandIds().filter((id) => (getCommandById(id)?.group || 'root') === 'root')
      : getCommandIdsByGroup(group);

    if (enabled) {
      for (const commandId of groupCommands) {
        if (commandAllowedForMode(commandId, mode)) {
          commands.add(commandId);
        }
      }
      continue;
    }

    for (const commandId of groupCommands) {
      if (core.has(commandId)) continue;
      commands.delete(commandId);
    }
  }
}

function applyCommandOverrides(manifest: MaestroManifest, commands: Set<string>, mode: AgentMode): void {
  const overrides = manifest.teamMemberCommandPermissions?.commands;
  if (!overrides) return;

  const core = new Set(getCoreCommandIds());
  for (const [commandId, enabled] of Object.entries(overrides)) {
    if (!getCommandById(commandId)) continue;

    if (enabled) {
      if (commandAllowedForMode(commandId, mode)) {
        commands.add(commandId);
      }
      continue;
    }

    if (!core.has(commandId)) {
      commands.delete(commandId);
    }
  }
}

function applyExplicitAllowlist(manifest: MaestroManifest, mode: AgentMode): Set<string> | null {
  const allowlist = (manifest.session as any).allowedCommands as string[] | undefined;
  if (!allowlist) return null;

  const filtered = new Set<string>();
  for (const commandId of allowlist) {
    if (commandAllowedForMode(commandId, mode)) {
      filtered.add(commandId);
    }
  }

  ensureCoreCommands(filtered);
  return filtered;
}

function buildCapabilityFlags(allowedCommands: string[], overrides?: Record<string, boolean>): CapabilityFlags {
  const allowed = new Set(allowedCommands);
  const flags: CapabilityFlags = {
    canSpawnSessions: allowed.has('session:spawn'),
    canManageTasks: allowed.has('task:create') || allowed.has('task:edit') || allowed.has('task:delete'),
    canUpdateTaskStatus: allowed.has('task:update') || allowed.has('task:complete') || allowed.has('task:block'),
    canReportProgress: allowed.has('session:report:progress') || allowed.has('task:report:progress'),
    canManageTaskDocs: allowed.has('task:docs:add') || allowed.has('task:docs:list'),
    canManageSessionDocs: allowed.has('session:docs:add') || allowed.has('session:docs:list'),
    canManageProjects: allowed.has('project:create') || allowed.has('project:delete') || allowed.has('project:list'),
    canManageTeamMembers: allowed.has('team-member:create') || allowed.has('team-member:edit'),
    canManageTeams: allowed.has('team:create') || allowed.has('team:edit'),
    canUseMasterCommands: allowed.has('master:projects') || allowed.has('master:context'),
    canPromptOtherSessions: allowed.has('session:prompt'),
    canUseModal: allowed.has('show:modal') || allowed.has('modal:events'),
  };

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (key in flags) {
        (flags as any)[key] = value;
      }
    }
  }

  return flags;
}

export function resolveCapabilitySet(
  manifest: MaestroManifest,
  options: PolicyOptions = {},
): CapabilitySet {
  const mode = manifest.mode;
  const commands = new Set(getDefaultCommandsForMode(mode));

  if (options.isMasterSession) {
    for (const commandId of MASTER_COMMAND_IDS) {
      if (commandAllowedForMode(commandId, mode)) {
        commands.add(commandId);
      }
    }
  }

  applyGroupOverrides(manifest, commands, mode);
  applyCommandOverrides(manifest, commands, mode);

  const allowlist = applyExplicitAllowlist(manifest, mode);
  const finalCommands = allowlist || commands;

  ensureCoreCommands(finalCommands);

  const allowedCommands = sortByCatalogOrder(finalCommands);
  const hiddenCommands = getAllCommandIds().filter((id) => !finalCommands.has(id));

  return {
    mode,
    allowedCommands,
    hiddenCommands,
    capabilities: buildCapabilityFlags(allowedCommands, manifest.teamMemberCapabilities),
    loadedFromManifest: true,
    resolution: 'manifest',
  };
}

export function resolveNoManifestCapabilities(mode: AgentMode = 'worker'): CapabilitySet {
  const allowedCommands = getAllCommandIds();

  return {
    mode,
    allowedCommands,
    hiddenCommands: [],
    capabilities: buildCapabilityFlags(allowedCommands),
    loadedFromManifest: false,
    resolution: 'no-manifest',
  };
}

export function resolveManifestFailureCapabilities(
  mode: AgentMode = 'worker',
  policy: ManifestFailurePolicy = 'safe-degraded',
): CapabilitySet {
  if (policy === 'permissive') {
    const permissive = resolveNoManifestCapabilities(mode);
    return {
      ...permissive,
      resolution: 'fallback',
    };
  }

  const safe = new Set<string>();
  for (const commandId of SAFE_DEGRADED_COMMANDS) {
    if (commandAllowedForMode(commandId, mode)) {
      safe.add(commandId);
    }
  }
  ensureCoreCommands(safe);

  const allowedCommands = sortByCatalogOrder(safe);
  const hiddenCommands = getAllCommandIds().filter((id) => !safe.has(id));

  return {
    mode,
    allowedCommands,
    hiddenCommands,
    capabilities: buildCapabilityFlags(allowedCommands),
    loadedFromManifest: false,
    resolution: 'fallback',
  };
}
