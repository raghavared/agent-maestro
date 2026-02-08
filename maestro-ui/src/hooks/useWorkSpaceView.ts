import { useCallback, useMemo, useRef, useState } from "react";
import { WorkspaceView } from "../app/types/workspace";
import * as DEFAULTS from "../app/constants/defaults";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";
import { MaestroProject, Session } from "../utils/MaestroClient";
import { TerminalSession } from "../app/types/session";
import { WorkspaceViewStorageV1 } from "../utils/workSpaceStorage";
import { CodeEditorFsEvent } from "../components/CodeEditorPanel";

export function useWorkspaceView({
    projects,
    sessions,
    activeId,
    activeProjectId,
}: {
    projects: MaestroProject[];
    sessions: TerminalSession[];
    activeId: string;
    activeProjectId: string;
    hydrated: boolean;

}) {
 const [workspaceViewByKey, setWorkspaceViewByKey] = useState<Record<string, WorkspaceView>>({});
 const workspaceRowRef = useRef<HTMLDivElement | null>(null);



 const [workspaceResizeMode, setWorkspaceResizeMode] = useState<"editor" | "tree" | null>(null);
 const workspaceEditorWidthStorageKey = useCallback(
    (projectId: string) => `${DEFAULTS.STORAGE_WORKSPACE_EDITOR_WIDTH_KEY}:${projectId}`,
    [],
  );
   const workspaceFileTreeWidthStorageKey = useCallback(
    (projectId: string) => `${DEFAULTS.STORAGE_WORKSPACE_FILE_TREE_WIDTH_KEY}:${projectId}`,
    [],
  );

   const readStoredNumber = useCallback((key: string, fallback: number) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw != null ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }, []);

   const createInitialWorkspaceView = useCallback(
    (projectId: string): WorkspaceView => {
      const editorWidth = Math.max(
        DEFAULTS.MIN_WORKSPACE_EDITOR_WIDTH,
        readStoredNumber(workspaceEditorWidthStorageKey(projectId), DEFAULTS.DEFAULT_WORKSPACE_EDITOR_WIDTH),
      );
      const treeWidth = Math.max(
        DEFAULTS.MIN_WORKSPACE_FILE_TREE_WIDTH,
        readStoredNumber(workspaceFileTreeWidthStorageKey(projectId), DEFAULTS.DEFAULT_WORKSPACE_FILE_TREE_WIDTH),
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
    [readStoredNumber, workspaceEditorWidthStorageKey, workspaceFileTreeWidthStorageKey],
  );


   const updateWorkspaceViewForKey = useCallback(
    (key: string, projectId: string, updater: (prev: WorkspaceView) => WorkspaceView) => {
      setWorkspaceViewByKey((prev) => {
        const current = prev[key] ?? createInitialWorkspaceView(projectId);
        const next = updater(current);
        if (next === current) return prev;
        return { ...prev, [key]: next };
      });
    },
    [createInitialWorkspaceView],
  );

  const activeWorkspaceKey = useMemo(() => {
    const active = sessions.find((s) => s.id === activeId) ?? null;
    if (!active) return activeProjectId;
    const isSsh = isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
    if (isSsh) {
      const target =
        active.sshTarget?.trim() ||
        sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null) ||
        "";
      if (target) return `ssh:${active.projectId}:${target}`;
      return `ssh:${active.projectId}:${active.persistId}`;
    }
    return active.projectId;
  }, [activeId, activeProjectId, sessions]);

  const updateActiveWorkspaceView = useCallback(
    (updater: (prev: WorkspaceView) => WorkspaceView) =>
      updateWorkspaceViewForKey(activeWorkspaceKey, activeProjectId, updater),
    [activeProjectId, activeWorkspaceKey, updateWorkspaceViewForKey],
  );


  const closeCodeEditor = useCallback(() => {
    updateActiveWorkspaceView((prev) => ({
      ...prev,
      codeEditorOpen: false,
      openFileRequest: null,
    }));
  }, [updateActiveWorkspaceView]);

  const activeWorkspaceView = useMemo(() => {
    return workspaceViewByKey[activeWorkspaceKey] ?? createInitialWorkspaceView(activeProjectId);
  }, [activeProjectId, activeWorkspaceKey, createInitialWorkspaceView, workspaceViewByKey]);

  const workspaceEditorWidthRef = useRef(activeWorkspaceView.editorWidth);
  const workspaceFileTreeWidthRef = useRef(activeWorkspaceView.treeWidth);


  const workspaceResizeStartRef = useRef<
    { x: number; editorWidth: number; treeWidth: number; projectId: string; workspaceKey: string } | null
  >(null);
  const workspaceResizeDraftRef = useRef<{ editorWidth: number; treeWidth: number } | null>(null);

  const workspaceViewSaveTimerRef = useRef<number | null>(null);

  const pendingWorkspaceViewSaveRef = useRef<WorkspaceViewStorageV1 | null>(null);
  const workspaceEditorVisible = activeWorkspaceView.codeEditorOpen;
  const workspaceTreeVisible = activeWorkspaceView.fileExplorerOpen;
  
  const handleRenameWorkspacePath = useCallback(
    (fromPath: string, toPath: string) => {
      updateActiveWorkspaceView((prev) => ({
        ...prev,
        codeEditorFsEvent: { type: "rename", from: fromPath, to: toPath, nonce: Date.now() } satisfies CodeEditorFsEvent,
      }));
    },
    [updateActiveWorkspaceView],
  );
  const handleDeleteWorkspacePath = useCallback(
    (path: string) => {
      updateActiveWorkspaceView((prev) => ({
        ...prev,
        codeEditorFsEvent: { type: "delete", path, nonce: Date.now() } satisfies CodeEditorFsEvent,
      }));
    },
    [updateActiveWorkspaceView],
  );

  const beginWorkspaceResize = useCallback(
    (mode: "editor" | "tree") => (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setWorkspaceResizeMode(mode);
      const editorWidth = workspaceEditorWidthRef.current;
      const treeWidth = workspaceFileTreeWidthRef.current;
      workspaceResizeStartRef.current = { x: e.clientX, editorWidth, treeWidth, projectId: activeProjectId, workspaceKey: activeWorkspaceKey };
      workspaceResizeDraftRef.current = { editorWidth, treeWidth };
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [activeProjectId, activeWorkspaceKey],
  );

     return {
         workspaceViewByKey,
         activeWorkspaceView,
         activeWorkspaceKey,
         workspaceRowRef,
         workspaceResizeMode,
         setWorkspaceViewByKey,
         closeCodeEditor,
         updateWorkspaceViewForKey,
         updateActiveWorkspaceView,
         setWorkspaceResizeMode,
         workspaceEditorWidthStorageKey,
         workspaceFileTreeWidthStorageKey,
         createInitialWorkspaceView,
         workspaceEditorWidthRef,
         workspaceFileTreeWidthRef,
         workspaceResizeStartRef,
         workspaceResizeDraftRef,
         workspaceViewSaveTimerRef,
         pendingWorkspaceViewSaveRef,
         workspaceEditorVisible,
         workspaceTreeVisible,
         handleRenameWorkspacePath,
         handleDeleteWorkspacePath,
         beginWorkspaceResize,
       };
};


export default useWorkspaceView;