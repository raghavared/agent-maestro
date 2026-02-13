import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { MaestroProject } from '../app/types/maestro';
import { EnvironmentConfig } from '../app/types/app';
import { defaultProjectState, envVarsForProjectId } from '../app/utils/env';
import { maestroClient } from '../utils/MaestroClient';
import { createSession } from '../services/sessionService';
import { useSessionStore } from './useSessionStore';
import { useUIStore } from './useUIStore';
import { useEnvironmentStore } from './useEnvironmentStore';
import { useAssetStore } from './useAssetStore';

// Module-level ref (not reactive state)
export const lastActiveByProject = new Map<string, string>();

interface ProjectState {
  projects: MaestroProject[];
  activeProjectId: string;
  activeSessionByProject: Record<string, string>;
  projectOpen: boolean;
  projectMode: 'new' | 'rename';
  projectTitle: string;
  projectBasePath: string;
  projectEnvironmentId: string;
  projectAssetsEnabled: boolean;
  projectSoundInstrument: string;
  confirmDeleteProjectOpen: boolean;
  deleteProjectError: string | null;
  deleteProjectId: string | null;
  setProjects: (projects: MaestroProject[] | ((prev: MaestroProject[]) => MaestroProject[])) => void;
  setActiveProjectId: (id: string) => void;
  setActiveSessionByProject: (
    v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  setProjectOpen: (open: boolean) => void;
  setProjectMode: (mode: 'new' | 'rename') => void;
  setProjectTitle: (title: string) => void;
  setProjectBasePath: (path: string) => void;
  setProjectEnvironmentId: (id: string) => void;
  setProjectAssetsEnabled: (enabled: boolean) => void;
  setProjectSoundInstrument: (instrument: string) => void;
  setConfirmDeleteProjectOpen: (open: boolean) => void;
  selectProject: (projectId: string) => void;
  moveProject: (projectId: string, targetProjectId: string, position: 'before' | 'after') => void;
  openNewProject: () => void;
  openProjectSettings: (projectId: string) => void;
  openRenameProject: () => void;
  onProjectSubmit: (e: React.FormEvent) => Promise<void>;
  checkAndDeleteProject: (projectId: string) => Promise<void>;
  deleteActiveProject: () => Promise<void>;
  closeProject: (projectId: string) => Promise<void>;
  fetchSavedProjects: () => Promise<MaestroProject[]>;
  reopenProject: (projectId: string) => Promise<void>;
}

/**
 * Module-level helper that reads from useSessionStore.getState() to find
 * the best active session for a given project.
 */
function pickActiveSessionId(projectId: string): string | null {
  const { sessions } = useSessionStore.getState();
  const last = lastActiveByProject.get(projectId);
  console.log('[pickActiveSessionId] projectId:', projectId, 'lastActive:', last, 'mapEntries:', Array.from(lastActiveByProject.entries()));
  if (last && sessions.some((s) => s.id === last)) {
    console.log('[pickActiveSessionId] returning last active:', last);
    return last;
  }
  const first = sessions.find((s) => s.projectId === projectId);
  console.log('[pickActiveSessionId] falling back to first session:', first?.id ?? null);
  return first ? first.id : null;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const initial = defaultProjectState();
  return {
    projects: initial.projects,
    activeProjectId: initial.activeProjectId,
    activeSessionByProject: {},
    projectOpen: false,
    projectMode: 'new',
    projectTitle: '',
    projectBasePath: '',
    projectEnvironmentId: '',
    projectAssetsEnabled: true,
    projectSoundInstrument: 'piano',
    confirmDeleteProjectOpen: false,
    deleteProjectError: null,
    deleteProjectId: null,

    setProjects: (projects) =>
      set((s) => ({
        projects: typeof projects === 'function' ? projects(s.projects) : projects,
      })),
    setActiveProjectId: (id) => set({ activeProjectId: id }),
    setActiveSessionByProject: (v) =>
      set((s) => ({
        activeSessionByProject: typeof v === 'function' ? v(s.activeSessionByProject) : v,
      })),
    setProjectOpen: (open) => set({ projectOpen: open }),
    setProjectMode: (mode) => set({ projectMode: mode }),
    setProjectTitle: (title) => set({ projectTitle: title }),
    setProjectBasePath: (path) => set({ projectBasePath: path }),
    setProjectEnvironmentId: (id) => set({ projectEnvironmentId: id }),
    setProjectAssetsEnabled: (enabled) => set({ projectAssetsEnabled: enabled }),
    setProjectSoundInstrument: (instrument) => set({ projectSoundInstrument: instrument }),
    setConfirmDeleteProjectOpen: (open) => set({ confirmDeleteProjectOpen: open }),

    selectProject: (projectId) => {
      set({ activeProjectId: projectId });
      useSessionStore.getState().setActiveId(pickActiveSessionId(projectId));
    },

    moveProject: (projectId, targetProjectId, position) =>
      set((state) => {
        if (projectId === targetProjectId) return state;
        const project = state.projects.find((p) => p.id === projectId);
        if (!project) return state;
        const next = state.projects.filter((p) => p.id !== projectId);
        const targetIndex = next.findIndex((p) => p.id === targetProjectId);
        if (targetIndex < 0) return state;
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        next.splice(insertIndex, 0, project);
        const unchanged =
          state.projects.length === next.length &&
          state.projects.every((p, i) => p.id === next[i]?.id);
        return unchanged ? state : { projects: next };
      }),

    openNewProject: () => {
      useSessionStore.getState().setNewOpen(false);
      const homeDir = useUIStore.getState().homeDir;
      set({
        projectMode: 'new',
        projectTitle: '',
        projectBasePath: homeDir ?? '',
        projectEnvironmentId: '',
        projectAssetsEnabled: true,
        projectSoundInstrument: 'piano',
        projectOpen: true,
      });
    },

    openProjectSettings: (projectId) => {
      const { projects } = get();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      useSessionStore.getState().setNewOpen(false);
      set({
        projectMode: 'rename',
        projectTitle: project.name,
        projectBasePath: project.basePath ?? '',
        projectEnvironmentId: project.environmentId ?? '',
        projectAssetsEnabled: project.assetsEnabled ?? true,
        projectSoundInstrument: project.soundInstrument ?? 'piano',
        projectOpen: true,
      });
    },

    openRenameProject: () => {
      get().openProjectSettings(get().activeProjectId);
    },

    onProjectSubmit: async (e) => {
      e.preventDefault();
      const {
        projectTitle,
        projectBasePath,
        projectMode,
        activeProjectId,
        projectEnvironmentId,
        projectAssetsEnabled,
        projectSoundInstrument,
        projects,
      } = get();
      const title = projectTitle.trim();
      if (!title) return;

      const { setError, reportError, homeDir } = useUIStore.getState();
      const { environments } = useEnvironmentStore.getState();
      const { ensureAutoAssets } = useAssetStore.getState();

      const desiredBasePath = projectBasePath.trim() || homeDir || '';
      const validatedBasePath = await invoke<string | null>('validate_directory', {
        path: desiredBasePath,
      }).catch(() => null);
      if (!validatedBasePath) {
        setError('Project base path must be an existing directory.');
        return;
      }

      const environmentId =
        projectEnvironmentId &&
        environments.some((e: EnvironmentConfig) => e.id === projectEnvironmentId)
          ? projectEnvironmentId
          : null;

      if (projectMode === 'rename') {
        try {
          await maestroClient.updateProject(activeProjectId, {
            name: title,
            workingDir: validatedBasePath,
          });
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === activeProjectId
                ? {
                    ...p,
                    name: title,
                    basePath: validatedBasePath,
                    environmentId,
                    assetsEnabled: projectAssetsEnabled,
                    soundInstrument: projectSoundInstrument,
                  }
                : p,
            ),
            projectOpen: false,
          }));
        } catch (err) {
          reportError('Failed to update project', err);
        }
        return;
      }

      try {
        const serverProject = await maestroClient.createProject({
          name: title,
          workingDir: validatedBasePath,
          description: '',
        });
        const project: MaestroProject = {
          id: serverProject.id,
          name: serverProject.name,
          workingDir: serverProject.workingDir,
          createdAt: serverProject.createdAt,
          updatedAt: serverProject.updatedAt,
          basePath: serverProject.workingDir,
          environmentId,
          assetsEnabled: projectAssetsEnabled,
          soundInstrument: projectSoundInstrument,
        };
        set((s) => ({
          projects: [...s.projects, project],
          projectOpen: false,
          activeProjectId: serverProject.id,
        }));

        try {
          await ensureAutoAssets(validatedBasePath, serverProject.id, projectAssetsEnabled);
          const { applyPendingExit, setSessions, setActiveId } = useSessionStore.getState();
          const createdRaw = await createSession({
            projectId: serverProject.id,
            cwd: validatedBasePath,
            envVars: envVarsForProjectId(serverProject.id, [...projects, project], environments),
          });
          const s = applyPendingExit(createdRaw);
          setSessions((prev) => [...prev, s]);
          setActiveId(s.id);
        } catch (err) {
          reportError('Failed to create session', err);
          useSessionStore.getState().setActiveId(null);
        }
      } catch (err) {
        reportError('Failed to create project on server', err);
      }
    },

    checkAndDeleteProject: async (projectId) => {
      const { projects } = get();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      try {
        const [tasks, allSessions] = await Promise.all([
          maestroClient.getTasks(projectId).catch(() => []),
          maestroClient.getSessions().catch(() => []),
        ]);
        const projectSessions = allSessions.filter(
          (s: any) => s.projectId === projectId && ['spawning', 'idle', 'working'].includes(s.status),
        );

        if (tasks.length > 0 || projectSessions.length > 0) {
          const parts: string[] = [];
          if (tasks.length > 0) parts.push(`${tasks.length} task${tasks.length > 1 ? 's' : ''}`);
          if (projectSessions.length > 0) parts.push(`${projectSessions.length} active session${projectSessions.length > 1 ? 's' : ''}`);
          set({
            deleteProjectError: `Cannot delete "${project.name}": project has ${parts.join(' and ')}. Remove them first.`,
            deleteProjectId: projectId,
            confirmDeleteProjectOpen: true,
          });
          return;
        }

        set({
          deleteProjectError: null,
          deleteProjectId: projectId,
          confirmDeleteProjectOpen: true,
        });
      } catch {
        set({
          deleteProjectError: null,
          deleteProjectId: projectId,
          confirmDeleteProjectOpen: true,
        });
      }
    },

    deleteActiveProject: async () => {
      const { deleteProjectId, projects } = get();
      const projectId = deleteProjectId;
      if (!projectId) return;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const {
        sessions,
        cleanupSessionResources,
        setSessions,
        setActiveId,
      } = useSessionStore.getState();
      const { reportError } = useUIStore.getState();

      try {
        await maestroClient.deleteProject(projectId);
      } catch (err) {
        reportError('Failed to delete project on server', err);
        return;
      }

      // Clean up local sessions for this project
      const idsToClose = sessions
        .filter((s) => s.projectId === projectId)
        .map((s) => s.id);
      for (const id of idsToClose) cleanupSessionResources(id);
      setSessions((prev) => prev.filter((s) => s.projectId !== projectId));
      lastActiveByProject.delete(projectId);
      set((s) => {
        const next = { ...s.activeSessionByProject };
        delete next[projectId];
        return { activeSessionByProject: next };
      });

      const remaining = projects.filter((p) => p.id !== projectId);
      if (remaining.length === 0) {
        set({ projects: [], activeProjectId: '', confirmDeleteProjectOpen: false, deleteProjectId: null });
        setActiveId(null);
        return;
      }

      const nextProjectId = remaining[0].id;
      set({ projects: remaining, activeProjectId: nextProjectId, confirmDeleteProjectOpen: false, deleteProjectId: null });
      setActiveId(pickActiveSessionId(nextProjectId));
    },

    closeProject: async (projectId) => {
      const { projects, activeProjectId } = get();
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const {
        sessions,
        onClose,
        setSessions,
        setActiveId,
      } = useSessionStore.getState();
      const { reportError } = useUIStore.getState();

      // Close all local sessions for this project
      const projectSessions = sessions.filter((s) => s.projectId === projectId && !s.exited && !s.closing);
      for (const s of projectSessions) {
        try {
          await onClose(s.id);
        } catch (err) {
          reportError('Failed to close session', err);
        }
      }

      // Remove any remaining sessions from the UI
      setSessions((prev) => prev.filter((s) => s.projectId !== projectId));
      lastActiveByProject.delete(projectId);
      set((s) => {
        const next = { ...s.activeSessionByProject };
        delete next[projectId];
        return { activeSessionByProject: next };
      });

      // Remove project from UI (but NOT from server)
      const remaining = projects.filter((p) => p.id !== projectId);
      if (remaining.length === 0) {
        set({ projects: [], activeProjectId: '' });
        setActiveId(null);
        return;
      }

      const nextProjectId = activeProjectId === projectId ? remaining[0].id : activeProjectId;
      set({ projects: remaining, activeProjectId: nextProjectId });
      if (activeProjectId === projectId) {
        setActiveId(pickActiveSessionId(nextProjectId));
      }
    },

    fetchSavedProjects: async () => {
      const { projects } = get();
      const openIds = new Set(projects.map((p) => p.id));
      try {
        const allProjects = await maestroClient.getProjects();
        return allProjects.filter((p) => !openIds.has(p.id));
      } catch {
        return [];
      }
    },

    reopenProject: async (projectId) => {
      const { projects } = get();
      if (projects.some((p) => p.id === projectId)) {
        // Already open, just select it
        get().selectProject(projectId);
        return;
      }

      const { reportError } = useUIStore.getState();
      const { setActiveId } = useSessionStore.getState();

      try {
        const serverProject = await maestroClient.getProject(projectId);
        const project: MaestroProject = {
          id: serverProject.id,
          name: serverProject.name,
          workingDir: serverProject.workingDir,
          createdAt: serverProject.createdAt,
          updatedAt: serverProject.updatedAt,
          basePath: serverProject.workingDir,
          environmentId: null,
        };
        set((s) => ({
          projects: [...s.projects, project],
          activeProjectId: project.id,
        }));
        setActiveId(null);
      } catch (err) {
        reportError('Failed to reopen project', err);
      }
    },
  };
});

// Internal type alias to avoid importing TerminalSession in the module scope (circular import risk)
type SessionLike = { id: string; projectId: string; persistId: string };

/* ------------------------------------------------------------------ */
/*  Sync lastActiveByProject + activeSessionByProject on session switch */
/* ------------------------------------------------------------------ */

/**
 * Call once after stores are created (e.g. from initApp or App mount).
 * Subscribes to useSessionStore so that whenever activeId changes we
 * record the mapping projectId → sessionId / persistId for later
 * restoration when the user switches projects.
 */
export function initActiveSessionSync(): () => void {
  let prevActiveId: string | null = useSessionStore.getState().activeId;
  console.log('[activeSessionSync] initialized, prevActiveId:', prevActiveId);

  const unsub = useSessionStore.subscribe((state) => {
    const { activeId, sessions } = state;
    if (activeId === prevActiveId) return;
    console.log('[activeSessionSync] activeId changed:', prevActiveId, '->', activeId);
    prevActiveId = activeId;

    if (!activeId) return;
    const session = sessions.find((s) => s.id === activeId);
    if (!session) {
      console.log('[activeSessionSync] session not found for activeId:', activeId);
      return;
    }

    console.log('[activeSessionSync] storing projectId:', session.projectId, '-> sessionId:', activeId, 'persistId:', session.persistId);

    // Update module-level map (used by pickActiveSessionId at runtime)
    lastActiveByProject.set(session.projectId, activeId);

    // Update persisted record (saved to disk via persistence.ts)
    useProjectStore.getState().setActiveSessionByProject((prev) => {
      if (prev[session.projectId] === session.persistId) return prev;
      return { ...prev, [session.projectId]: session.persistId };
    });
  });

  return unsub;
}
