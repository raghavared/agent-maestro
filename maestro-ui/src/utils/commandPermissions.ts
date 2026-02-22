import type { AgentMode } from "../app/types/maestro";

export type CommandMode = AgentMode;

const ALL_MODES: CommandMode[] = ['worker', 'coordinator', 'coordinated-worker', 'coordinated-coordinator'];
const COORDINATOR_MODES: CommandMode[] = ['coordinator', 'coordinated-coordinator'];

const DEFAULT_EXCLUDED_COMMANDS_BY_MODE: Partial<Record<CommandMode, string[]>> = {
  worker: ['team-member:create', 'team-member:list', 'team-member:get'],
  coordinator: ['team-member:list'],
  'coordinated-worker': ['team-member:create', 'team-member:list', 'team-member:get'],
  'coordinated-coordinator': ['team-member:list', 'session:spawn'],
};

// UI permission panels currently expose this subset of command IDs.
const COMMAND_ALLOWED_MODES: Record<string, CommandMode[]> = {
  whoami: ALL_MODES,
  status: ALL_MODES,
  commands: ALL_MODES,

  'task:list': ALL_MODES,
  'task:get': ALL_MODES,
  'task:create': ALL_MODES,
  'task:edit': ALL_MODES,
  'task:delete': ALL_MODES,
  'task:children': ALL_MODES,
  'task:report:progress': ALL_MODES,
  'task:report:complete': ALL_MODES,
  'task:report:blocked': ALL_MODES,
  'task:report:error': ALL_MODES,
  'task:docs:add': ALL_MODES,
  'task:docs:list': ALL_MODES,

  'session:siblings': ALL_MODES,
  'session:info': COORDINATOR_MODES,
  'session:prompt': ALL_MODES,
  'session:report:progress': ALL_MODES,
  'session:report:complete': ALL_MODES,
  'session:report:blocked': ALL_MODES,
  'session:report:error': ALL_MODES,
  'session:docs:add': ALL_MODES,
  'session:docs:list': ALL_MODES,

  'team-member:create': ALL_MODES,
  'team-member:list': ALL_MODES,
  'team-member:get': ALL_MODES,

  'show:modal': ALL_MODES,
  'modal:events': ALL_MODES,
};

export function normalizeCommandMode(mode: string | null | undefined): CommandMode {
  const normalized = String(mode || 'worker').trim().toLowerCase();
  if (normalized === 'execute') return 'worker';
  if (normalized === 'coordinate') return 'coordinator';
  if (normalized === 'coordinator' || normalized === 'coordinated-coordinator') return normalized as CommandMode;
  if (normalized === 'worker' || normalized === 'coordinated-worker') return normalized as CommandMode;
  return 'worker';
}

export function isCommandAllowedForMode(commandId: string, mode: string | null | undefined): boolean {
  const canonicalMode = normalizeCommandMode(mode);
  const allowedModes = COMMAND_ALLOWED_MODES[commandId];
  if (!allowedModes) return false;
  return allowedModes.includes(canonicalMode);
}

export function isCommandDefaultEnabled(commandId: string, mode: string | null | undefined): boolean {
  const canonicalMode = normalizeCommandMode(mode);
  if (!isCommandAllowedForMode(commandId, canonicalMode)) {
    return false;
  }
  const excluded = DEFAULT_EXCLUDED_COMMANDS_BY_MODE[canonicalMode] || [];
  return !excluded.includes(commandId);
}

export function getEffectiveCommandEnabled(
  commandId: string,
  mode: string | null | undefined,
  overrides: Record<string, boolean>,
): boolean {
  if (!isCommandAllowedForMode(commandId, mode)) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(overrides, commandId)) {
    return overrides[commandId];
  }
  return isCommandDefaultEnabled(commandId, mode);
}

export function toggleCommandOverride(
  overrides: Record<string, boolean>,
  commandId: string,
  mode: string | null | undefined,
): Record<string, boolean> {
  if (!isCommandAllowedForMode(commandId, mode)) {
    return overrides;
  }

  const next = { ...overrides };
  const defaultEnabled = isCommandDefaultEnabled(commandId, mode);
  const currentEnabled = Object.prototype.hasOwnProperty.call(overrides, commandId)
    ? overrides[commandId]
    : defaultEnabled;
  const toggledEnabled = !currentEnabled;

  if (toggledEnabled === defaultEnabled) {
    delete next[commandId];
  } else {
    next[commandId] = toggledEnabled;
  }

  return next;
}
