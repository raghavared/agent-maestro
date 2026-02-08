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
  setConfirmDeleteProjectOpen: (open: boolean) => void;
  selectProject: (projectId: string) => void;
  moveProject: (projectId: string, targetProjectId: string, position: 'before' | 'after') => void;
  openNewProject: () => void;
  openProjectSettings: (projectId: string) => void;
  openRenameProject: () => void;
  onProjectSubmit: (e: React.FormEvent) => Promise<void>;
  checkAndDeleteProject: (projectId: string) => Promise<void>;
  deleteActiveProject: () => Promise<void>;
}

/**
 * Module-level helper that reads from useSessionStore.getState() to find
 * the best active session for a given project.
 */
function pickActiveSessionId(projectId: string): string | null {
  const { sessions } = useSessionStore.getState();
  const last = lastActiveByProject.get(projectId);
  if (last && sessions.some((s) => s.id === last)) return last;
  const first = sessions.find((s) => s.projectId === projectId);
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
  };
});

// Internal type alias to avoid importing TerminalSession in the module scope (circular import risk)
type SessionLike = { id: string; projectId: string; persistId: string };
