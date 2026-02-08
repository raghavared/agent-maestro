import { create } from 'zustand';
import { EnvironmentConfig } from '../app/types/app';
import { makeId } from '../app/utils/id';
import { useUIStore } from './useUIStore';

interface EnvironmentState {
  environments: EnvironmentConfig[];
  environmentsOpen: boolean;
  environmentEditorOpen: boolean;
  environmentEditorId: string | null;
  environmentEditorName: string;
  environmentEditorContent: string;
  environmentEditorLocked: boolean;
  confirmDeleteEnvironmentId: string | null;
  setEnvironments: (envs: EnvironmentConfig[] | ((prev: EnvironmentConfig[]) => EnvironmentConfig[])) => void;
  setEnvironmentsOpen: (open: boolean) => void;
  setEnvironmentEditorOpen: (open: boolean) => void;
  setEnvironmentEditorId: (id: string | null) => void;
  setEnvironmentEditorName: (name: string) => void;
  setEnvironmentEditorContent: (content: string) => void;
  setEnvironmentEditorLocked: (locked: boolean) => void;
  setConfirmDeleteEnvironmentId: (id: string | null) => void;
  openEnvironmentEditor: (env?: EnvironmentConfig) => void;
  closeEnvironmentEditor: () => void;
  saveEnvironmentFromEditor: () => void;
  requestDeleteEnvironment: (id: string) => void;
  confirmDeleteEnvironment: (crossStoreCallbacks?: {
    clearProjectEnvironmentId: (deletedId: string) => void;
    clearProjectsEnvironmentId: (deletedId: string) => void;
  }) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  environmentsOpen: false,
  environmentEditorOpen: false,
  environmentEditorId: null,
  environmentEditorName: '',
  environmentEditorContent: '',
  environmentEditorLocked: false,
  confirmDeleteEnvironmentId: null,
  setEnvironments: (envs) =>
    set((state) => ({
      environments: typeof envs === 'function' ? envs(state.environments) : envs,
    })),
  setEnvironmentsOpen: (open) => set({ environmentsOpen: open }),
  setEnvironmentEditorOpen: (open) => set({ environmentEditorOpen: open }),
  setEnvironmentEditorId: (id) => set({ environmentEditorId: id }),
  setEnvironmentEditorName: (name) => set({ environmentEditorName: name }),
  setEnvironmentEditorContent: (content) => set({ environmentEditorContent: content }),
  setEnvironmentEditorLocked: (locked) => set({ environmentEditorLocked: locked }),
  setConfirmDeleteEnvironmentId: (id) => set({ confirmDeleteEnvironmentId: id }),
  openEnvironmentEditor: (env) => {
    const locked = Boolean((env?.content ?? '').trimStart().startsWith('enc:v1:'));
    set({
      environmentsOpen: false,
      environmentEditorId: env?.id ?? null,
      environmentEditorName: env?.name ?? '',
      environmentEditorLocked: locked,
      environmentEditorContent: locked ? '' : env?.content ?? '',
      environmentEditorOpen: true,
    });
  },
  closeEnvironmentEditor: () => {
    set({
      environmentEditorOpen: false,
      environmentEditorId: null,
      environmentEditorName: '',
      environmentEditorContent: '',
      environmentEditorLocked: false,
    });
  },
  saveEnvironmentFromEditor: () => {
    const {
      environmentEditorLocked,
      environmentEditorName,
      environmentEditorContent,
      environmentEditorId,
      environments,
    } = get();
    if (environmentEditorLocked) return;
    const name = environmentEditorName.trim();
    if (!name) return;
    const content = environmentEditorContent;
    const now = Date.now();
    const id = environmentEditorId ?? makeId();
    const next: EnvironmentConfig = { id, name, content, createdAt: now };

    const updated = environmentEditorId
      ? environments
          .map((e) => (e.id === environmentEditorId ? { ...e, name, content } : e))
          .sort((a, b) => b.createdAt - a.createdAt)
      : [...environments, next].sort((a, b) => b.createdAt - a.createdAt);

    set({
      environments: updated,
      environmentEditorOpen: false,
      environmentEditorId: null,
      environmentEditorName: '',
      environmentEditorContent: '',
      environmentEditorLocked: false,
    });
  },
  requestDeleteEnvironment: (id) => set({ confirmDeleteEnvironmentId: id }),
  confirmDeleteEnvironment: (crossStoreCallbacks) => {
    const { confirmDeleteEnvironmentId: id, environments, environmentEditorId } = get();
    if (!id) return;

    const env = environments.find((e) => e.id === id);
    const label = env?.name?.trim() ? env.name.trim() : 'environment';

    const updates: Partial<EnvironmentState> = {
      confirmDeleteEnvironmentId: null,
      environments: environments.filter((e) => e.id !== id),
    };
    if (environmentEditorId === id) {
      updates.environmentEditorOpen = false;
      updates.environmentEditorId = null;
      updates.environmentEditorName = '';
      updates.environmentEditorContent = '';
      updates.environmentEditorLocked = false;
    }
    set(updates as EnvironmentState);

    // Cross-store: update projects that reference the deleted environment
    if (crossStoreCallbacks) {
      crossStoreCallbacks.clearProjectsEnvironmentId(id);
      crossStoreCallbacks.clearProjectEnvironmentId(id);
    }

    // Cross-store: show notice
    try {
      useUIStore.getState().showNotice(`Deleted environment "${label}"`);
    } catch {
      // best-effort
    }
  },
}));
