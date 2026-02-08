import { useEffect } from "react";
import * as DEFAULTS from "../app/constants/defaults";
import {
  useWorkspaceStore,
  getActiveWorkspaceView,
  getWorkspaceEditorVisible,
  getWorkspaceTreeVisible,
  workspaceRowRef,
  workspaceResizeStartRef,
  workspaceResizeDraftRef,
} from "../stores/useWorkspaceStore";

/**
 * Listens for workspace panel resize drag events and commits the
 * final widths to the workspace store on mouse-up.
 *
 * Reads all required state from useWorkspaceStore directly --
 * no props needed.
 */
export function useWorkspaceResizeEffect() {
  const workspaceResizeMode = useWorkspaceStore((s) => s.workspaceResizeMode);

  useEffect(() => {
    if (!workspaceResizeMode) return;

    const editorVisible = getWorkspaceEditorVisible();
    const treeVisible = getWorkspaceTreeVisible();

    const handleMouseMove = (e: MouseEvent) => {
      const start = workspaceResizeStartRef.current;
      const container = workspaceRowRef.current;
      if (!start || !container) return;

      const dx = e.clientX - start.x;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;

      const currentDraft = workspaceResizeDraftRef.current ?? {
        editorWidth: start.editorWidth,
        treeWidth: start.treeWidth,
      };

      if (workspaceResizeMode === "editor" && editorVisible) {
        const treeWidth = treeVisible ? currentDraft.treeWidth : 0;
        const max = Math.max(
          DEFAULTS.MIN_WORKSPACE_EDITOR_WIDTH,
          containerWidth - treeWidth - DEFAULTS.MIN_WORKSPACE_TERMINAL_WIDTH,
        );
        const next = Math.min(
          max,
          Math.max(DEFAULTS.MIN_WORKSPACE_EDITOR_WIDTH, start.editorWidth - dx),
        );
        workspaceResizeDraftRef.current = { ...currentDraft, editorWidth: next };
        container.style.setProperty("--workspaceEditorWidthPx", `${next}px`);
        return;
      }

      if (workspaceResizeMode === "tree" && treeVisible) {
        const editorWidth = editorVisible ? currentDraft.editorWidth : 0;
        const max = Math.max(
          DEFAULTS.MIN_WORKSPACE_FILE_TREE_WIDTH,
          containerWidth - editorWidth - DEFAULTS.MIN_WORKSPACE_TERMINAL_WIDTH,
        );
        const next = Math.min(
          max,
          Math.max(DEFAULTS.MIN_WORKSPACE_FILE_TREE_WIDTH, start.treeWidth - dx),
        );
        workspaceResizeDraftRef.current = { ...currentDraft, treeWidth: next };
        container.style.setProperty("--workspaceFileTreeWidthPx", `${next}px`);
      }
    };

    const handleMouseUp = () => {
      const draft = workspaceResizeDraftRef.current;
      const start = workspaceResizeStartRef.current;
      if (draft && start) {
        const editorWidth = Math.max(
          DEFAULTS.MIN_WORKSPACE_EDITOR_WIDTH,
          Math.floor(draft.editorWidth),
        );
        const treeWidth = Math.max(
          DEFAULTS.MIN_WORKSPACE_FILE_TREE_WIDTH,
          Math.floor(draft.treeWidth),
        );
        const { createInitialWorkspaceView, setWorkspaceViewByKey } =
          useWorkspaceStore.getState();
        setWorkspaceViewByKey((prev) => {
          let changed = false;
          const next = { ...prev };

          for (const [key, view] of Object.entries(prev)) {
            if (view.projectId !== start.projectId) continue;
            if (view.editorWidth === editorWidth && view.treeWidth === treeWidth)
              continue;
            next[key] = { ...view, editorWidth, treeWidth };
            changed = true;
          }

          const current =
            prev[start.workspaceKey] ??
            createInitialWorkspaceView(start.projectId);
          if (
            !prev[start.workspaceKey] ||
            current.editorWidth !== editorWidth ||
            current.treeWidth !== treeWidth
          ) {
            next[start.workspaceKey] = { ...current, editorWidth, treeWidth };
            changed = true;
          }

          return changed ? next : prev;
        });
      }
      workspaceResizeStartRef.current = null;
      workspaceResizeDraftRef.current = null;
      useWorkspaceStore.getState().setWorkspaceResizeMode(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [workspaceResizeMode]);
}
