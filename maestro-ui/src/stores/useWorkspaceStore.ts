import { create } from 'zustand';
import { WorkspaceView } from '../app/types/workspace';
import { CodeEditorFsEvent } from '../components/CodeEditorPanel';
import { isSshCommandLine, sshTargetFromCommandLine } from '../app/utils/ssh';
import * as DEFAULTS from '../app/constants/defaults';
import { useSessionStore } from './useSessionStore';
import { useProjectStore } from './useProjectStore';

/* ------------------------------------------------------------------ */
/*  Module-level refs for resize (replaces useRef)                      */
/* ------------------------------------------------------------------ */

export const workspaceEditorWidthRef = { current: DEFAULTS.DEFAULT_WORKSPACE_EDITOR_WIDTH };
export const workspaceFileTreeWidthRef = { current: DEFAULTS.DEFAULT_WORKSPACE_FILE_TREE_WIDTH };
export const workspaceResizeStartRef: {
  current: {
    x: number;
    editorWidth: number;
    treeWidth: number;
    projectId: string;
    workspaceKey: string;
  } | null;
} = { current: null };
export const workspaceResizeDraftRef: {
  current: { editorWidth: number; treeWidth: number } | null;
} = { current: null };
export const workspaceRowRef: { current: HTMLDivElement | null } = { current: null };
export const workspaceViewSaveTimerRef: { current: number | null } = { current: null };

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function workspaceEditorWidthStorageKey(projectId: string): string {
  return `${DEFAULTS.STORAGE_WORKSPACE_EDITOR_WIDTH_KEY}:${projectId}`;
}

function workspaceFileTreeWidthStorageKey(projectId: string): string {
  return `${DEFAULTS.STORAGE_WORKSPACE_FILE_TREE_WIDTH_KEY}:${projectId}`;
}

/* ------------------------------------------------------------------ */
/*  Store interface                                                     */
/* ------------------------------------------------------------------ */

interface WorkspaceState {
  workspaceViewByKey: Record<string, WorkspaceView>;
  workspaceResizeMode: 'editor' | 'tree' | null;

  setWorkspaceViewByKey: (
    v:
      | Record<string, WorkspaceView>
      | ((prev: Record<string, WorkspaceView>) => Record<string, WorkspaceView>),
  ) => void;
  setWorkspaceResizeMode: (mode: 'editor' | 'tree' | null) => void;

  createInitialWorkspaceView: (projectId: string) => WorkspaceView;
  updateWorkspaceViewForKey: (
    key: string,
    projectId: string,
    updater: (prev: WorkspaceView) => WorkspaceView,
  ) => void;
  updateActiveWorkspaceView: (updater: (prev: WorkspaceView) => WorkspaceView) => void;
  closeCodeEditor: () => void;
  handleSelectWorkspaceFile: (path: string) => void;
  handleRenameWorkspacePath: (fromPath: string, toPath: string) => void;
  handleDeleteWorkspacePath: (path: string) => void;
  beginWorkspaceResize: (mode: 'editor' | 'tree') => (e: React.MouseEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Derived selectors (pure functions)                                  */
/* ------------------------------------------------------------------ */

export function getActiveWorkspaceKey(): string {
  const { sessions, activeId } = useSessionStore.getState();
  const { activeProjectId } = useProjectStore.getState();
  const active = sessions.find((s) => s.id === activeId) ?? null;
  if (!active) return activeProjectId;
  const isSsh = isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
  if (isSsh) {
    const target =
      active.sshTarget?.trim() ||
      sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null) ||
      '';
    if (target) return `ssh:${active.projectId}:${target}`;
    return `ssh:${active.projectId}:${active.persistId}`;
  }
  return active.projectId;
}

export function getActiveWorkspaceView(): WorkspaceView {
  const state = useWorkspaceStore.getState();
  const key = getActiveWorkspaceKey();
  const { activeProjectId } = useProjectStore.getState();
  return (
    state.workspaceViewByKey[key] ?? state.createInitialWorkspaceView(activeProjectId)
  );
}

export function getWorkspaceEditorVisible(): boolean {
  return getActiveWorkspaceView().codeEditorOpen;
}

export function getWorkspaceTreeVisible(): boolean {
  return getActiveWorkspaceView().fileExplorerOpen;
}

/* ------------------------------------------------------------------ */
/*  Store creation                                                      */
/* ------------------------------------------------------------------ */

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceViewByKey: {},
  workspaceResizeMode: null,

  setWorkspaceViewByKey: (v) =>
    set((s) => ({
      workspaceViewByKey:
        typeof v === 'function' ? v(s.workspaceViewByKey) : v,
    })),
  setWorkspaceResizeMode: (mode) => set({ workspaceResizeMode: mode }),

  createInitialWorkspaceView: (projectId) => {
    const editorWidth = Math.max(
      DEFAULTS.MIN_WORKSPACE_EDITOR_WIDTH,
      readStoredNumber(
        workspaceEditorWidthStorageKey(projectId),
        DEFAULTS.DEFAULT_WORKSPACE_EDITOR_WIDTH,
      ),
    );
    const treeWidth = Math.max(
      DEFAULTS.MIN_WORKSPACE_FILE_TREE_WIDTH,
      readStoredNumber(
        workspaceFileTreeWidthStorageKey(projectId),
        DEFAULTS.DEFAULT_WORKSPACE_FILE_TREE_WIDTH,
      ),
    );
    return {
      projectId,
      fileExplorerOpen: true,
      fileExplorerRootDir: null,
      fileExplorerPersistedState: null,
      codeEditorOpen: false,
      codeEditorRootDir: null,
      openFileRequest: null,
      codeEditorActiveFilePath: null,
      codeEditorPersistedState: null,
      codeEditorFsEvent: null,
      editorWidth,
      treeWidth,
    };
  },

  updateWorkspaceViewForKey: (key, projectId, updater) => {
    set((prev) => {
      const current =
        prev.workspaceViewByKey[key] ?? get().createInitialWorkspaceView(projectId);
      const next = updater(current);
      if (next === current) return prev;
      return {
        workspaceViewByKey: { ...prev.workspaceViewByKey, [key]: next },
      };
    });
  },

  updateActiveWorkspaceView: (updater) => {
    const { activeProjectId } = useProjectStore.getState();
    const key = getActiveWorkspaceKey();
    get().updateWorkspaceViewForKey(key, activeProjectId, updater);
  },

  closeCodeEditor: () => {
    get().updateActiveWorkspaceView((prev) => ({
      ...prev,
      codeEditorOpen: false,
      openFileRequest: null,
    }));
  },

  handleSelectWorkspaceFile: (path) => {
    const { activeProjectId, projects } = useProjectStore.getState();
    const { sessions, activeId } = useSessionStore.getState();
    const active = sessions.find((s) => s.id === activeId) ?? null;
    const activeIsSsh = active
      ? isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null)
      : false;
    const project =
      projects.find((p) => p.id === activeProjectId) ?? null;

    get().updateActiveWorkspaceView((prev) => {
      const root = (
        prev.codeEditorRootDir ??
        prev.fileExplorerRootDir ??
        (!activeIsSsh ? project?.basePath : null) ??
        (!activeIsSsh ? active?.cwd : null) ??
        ''
      )
        .trim();
      if (!root) return prev;
      return {
        ...prev,
        codeEditorOpen: true,
        codeEditorActiveFilePath: path,
        codeEditorRootDir: prev.codeEditorRootDir ?? root,
        fileExplorerRootDir: prev.fileExplorerRootDir ?? root,
        openFileRequest: { path, nonce: Date.now() },
      };
    });
  },

  handleRenameWorkspacePath: (fromPath, toPath) => {
    get().updateActiveWorkspaceView((prev) => ({
      ...prev,
      codeEditorFsEvent: {
        type: 'rename',
        from: fromPath,
        to: toPath,
        nonce: Date.now(),
      } satisfies CodeEditorFsEvent,
    }));
  },

  handleDeleteWorkspacePath: (path) => {
    get().updateActiveWorkspaceView((prev) => ({
      ...prev,
      codeEditorFsEvent: {
        type: 'delete',
        path,
        nonce: Date.now(),
      } satisfies CodeEditorFsEvent,
    }));
  },

  beginWorkspaceResize: (mode) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    set({ workspaceResizeMode: mode });
    const { activeProjectId } = useProjectStore.getState();
    const editorWidth = workspaceEditorWidthRef.current;
    const treeWidth = workspaceFileTreeWidthRef.current;
    const activeKey = getActiveWorkspaceKey();
    workspaceResizeStartRef.current = {
      x: e.clientX,
      editorWidth,
      treeWidth,
      projectId: activeProjectId,
      workspaceKey: activeKey,
    };
    workspaceResizeDraftRef.current = { editorWidth, treeWidth };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  },
}));
