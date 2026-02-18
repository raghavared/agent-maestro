import { invoke } from '@tauri-apps/api/core';
import { PersistedStateV1 } from '../app/types/app-state';
import { PersistedTerminalSession } from '../app/types/session';
import { buildWorkspaceViewStorageV1 } from '../utils/workSpaceStorage';
import { formatError } from '../utils/formatters';
import * as DEFAULTS from '../app/constants/defaults';

import { useProjectStore } from './useProjectStore';
import { useSessionStore } from './useSessionStore';
import { usePromptStore } from './usePromptStore';
import { useEnvironmentStore } from './useEnvironmentStore';
import { useAssetStore } from './useAssetStore';
import { useAgentShortcutStore } from './useAgentShortcutStore';
import { useSecureStorageStore } from './useSecureStorageStore';
import { useUIStore } from './useUIStore';
import { useWorkspaceStore } from './useWorkspaceStore';

/* ------------------------------------------------------------------ */
/*  Module-level refs (replaces useRef)                                 */
/* ------------------------------------------------------------------ */

let saveTimerRef: number | null = null;
let pendingSaveRef: PersistedStateV1 | null = null;
let workspaceViewSaveTimerRef: number | null = null;
let pendingWorkspaceViewSaveRef: any = null;

/* ------------------------------------------------------------------ */
/*  Central persistence (replaces useStatePersistence main effect)       */
/* ------------------------------------------------------------------ */

function buildPersistedState(): PersistedStateV1 {
  const { projects, activeProjectId, activeSessionByProject, closedProjectIds } = useProjectStore.getState();
  const { sessions } = useSessionStore.getState();
  const { prompts } = usePromptStore.getState();
  const { environments } = useEnvironmentStore.getState();
  const { assets, assetSettings } = useAssetStore.getState();
  const { agentShortcutIds } = useAgentShortcutStore.getState();
  const { secureStorageMode } = useSecureStorageStore.getState();

  const persistedSessions: PersistedTerminalSession[] = sessions
    .filter((s: any) => !s.closing)
    .map((s: any) => ({
      persistId: s.persistId,
      projectId: s.projectId,
      name: s.name,
      launchCommand: s.launchCommand,
      restoreCommand: s.restoreCommand ?? null,
      sshTarget: s.sshTarget ?? null,
      sshRootDir: s.sshRootDir ?? null,
      lastRecordingId: s.lastRecordingId ?? null,
      cwd: s.cwd,
      persistent: s.persistent,
      createdAt: s.createdAt,
      maestroSessionId: s.maestroSessionId ?? null,
      backendSessionId: s.id,
    }))
    .sort((a: any, b: any) => a.createdAt - b.createdAt);

  // Map projects to match Rust PersistedProjectV1 structure
  // Cast to any to bypass TypeScript's type checking since Rust expects 'title' but TS defines 'name'
  const persistedProjects = projects.map((p: any) => ({
    id: p.id,
    title: p.name, // Map 'name' to 'title' for Rust backend
    basePath: p.basePath ?? null,
    environmentId: p.environmentId ?? null,
    assetsEnabled: p.assetsEnabled ?? null,
    soundInstrument: p.soundInstrument ?? null,
    soundConfig: p.soundConfig ?? null,
  }));

  return {
    schemaVersion: 1,
    secureStorageMode: secureStorageMode ?? undefined,
    projects: persistedProjects as any, // Cast to bypass TS type mismatch (Rust uses 'title', TS uses 'name')
    activeProjectId,
    sessions: persistedSessions,
    activeSessionByProject,
    prompts,
    environments,
    assets,
    assetSettings,
    agentShortcutIds,
    closedProjectIds: closedProjectIds.length > 0 ? closedProjectIds : undefined,
  };
}

function scheduleSave() {
  const { hydrated } = useSessionStore.getState();
  const { persistenceDisabledReason, secureStorageMode } = useSecureStorageStore.getState();

  if (!hydrated || persistenceDisabledReason) return;

  if (saveTimerRef !== null) {
    window.clearTimeout(saveTimerRef);
  }

  pendingSaveRef = buildPersistedState();

  saveTimerRef = window.setTimeout(() => {
    saveTimerRef = null;
    const state = pendingSaveRef;
    if (!state) return;
    void invoke('save_persisted_state', { state }).catch((err) => {
      const msg = formatError(err);
      const lower = msg.toLowerCase();
      if (
        secureStorageMode === 'keychain' &&
        (lower.includes('keychain') || lower.includes('keyring'))
      ) {
        useSecureStorageStore
          .getState()
          .setPersistenceDisabledReason(
            `Secure storage is locked (changes won't be saved): ${msg}`,
          );
        return;
      }
      useUIStore.getState().reportError('Failed to save state', err);
    });
  }, 400);
}

/**
 * Subscribe to all domain stores that contribute to persisted state.
 * Returns a cleanup function that removes all subscriptions.
 */
export function initCentralPersistence(): () => void {
  const unsubs = [
    useProjectStore.subscribe(scheduleSave),
    useSessionStore.subscribe(scheduleSave),
    usePromptStore.subscribe(scheduleSave),
    useEnvironmentStore.subscribe(scheduleSave),
    useAssetStore.subscribe(scheduleSave),
    useAgentShortcutStore.subscribe(scheduleSave),
    useSecureStorageStore.subscribe(scheduleSave),
  ];

  return () => {
    unsubs.forEach((fn) => fn());
    if (saveTimerRef !== null) {
      window.clearTimeout(saveTimerRef);
      saveTimerRef = null;
    }
    pendingSaveRef = null;
  };
}

/* ------------------------------------------------------------------ */
/*  Workspace view persistence                                          */
/* ------------------------------------------------------------------ */

function scheduleWorkspaceViewSave() {
  const { hydrated } = useSessionStore.getState();
  if (!hydrated) return;

  if (workspaceViewSaveTimerRef !== null) {
    window.clearTimeout(workspaceViewSaveTimerRef);
  }

  const { projects } = useProjectStore.getState();
  const { workspaceViewByKey } = useWorkspaceStore.getState();
  const validProjectIds = new Set<string>(projects.map((p: any) => p.id));
  pendingWorkspaceViewSaveRef = buildWorkspaceViewStorageV1(workspaceViewByKey, validProjectIds);

  workspaceViewSaveTimerRef = window.setTimeout(() => {
    workspaceViewSaveTimerRef = null;
    const state = pendingWorkspaceViewSaveRef;
    if (!state) return;
    try {
      localStorage.setItem(DEFAULTS.STORAGE_WORKSPACE_VIEW_BY_KEY, JSON.stringify(state));
    } catch {
      // Best-effort.
    }
  }, 500);
}

/**
 * Subscribe to workspace view changes and persist to localStorage.
 * Returns a cleanup function.
 */
export function initWorkspaceViewPersistence(): () => void {
  const unsub = useWorkspaceStore.subscribe(scheduleWorkspaceViewSave);

  return () => {
    unsub();
    if (workspaceViewSaveTimerRef !== null) {
      window.clearTimeout(workspaceViewSaveTimerRef);
      workspaceViewSaveTimerRef = null;
    }
    pendingWorkspaceViewSaveRef = null;
  };
}
