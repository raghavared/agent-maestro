import * as DEFAULTS from "../app/constants/defaults";
import { WorkspaceView } from "../app/types/workspace";
import { CodeEditorPersistedState } from "../components/CodeEditorPanel";
import { FileExplorerPersistedState } from "../components/FileExplorerPanel";


export type WorkspaceViewStorageV1 = {
    schemaVersion: 1;
    views: Record<string, StoredWorkspaceViewV1>;
  };
  type StoredWorkspaceViewV1 = {
    projectId: string;
    fileExplorerOpen?: boolean;
    fileExplorerRootDir?: string | null;
    fileExplorerPersistedState?: FileExplorerPersistedState | null;
    codeEditorOpen?: boolean;
    codeEditorRootDir?: string | null;
    codeEditorActiveFilePath?: string | null;
    codeEditorPersistedState?: CodeEditorPersistedState | null;
  };
  

export function projectIdFromWorkspaceKey(workspaceKey: string): string | null {
    const key = workspaceKey.trim();
    if (!key) return null;
    if (!key.startsWith("ssh:")) return key;
    const rest = key.slice("ssh:".length);
    const idx = rest.indexOf(":");
    if (idx <= 0) return null;
    return rest.slice(0, idx);
  }


export function loadWorkspaceViewStorageV1(): WorkspaceViewStorageV1 | null {
    try {
      const raw = localStorage.getItem(DEFAULTS.STORAGE_WORKSPACE_VIEW_BY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if ((parsed as { schemaVersion?: unknown }).schemaVersion !== 1) return null;
  
      const viewsRaw = (parsed as { views?: unknown }).views;
      if (!viewsRaw || typeof viewsRaw !== "object") return null;
  
      const out: Record<string, StoredWorkspaceViewV1> = {};
      for (const [workspaceKey, value] of Object.entries(viewsRaw as Record<string, unknown>)) {
        if (!workspaceKey || !value || typeof value !== "object") continue;
        const rec = value as Record<string, unknown>;
        const projectId =
          (typeof rec.projectId === "string" && rec.projectId.trim()) || projectIdFromWorkspaceKey(workspaceKey);
        if (!projectId) continue;
  
        const fileExplorerRootDir =
          rec.fileExplorerRootDir === null || typeof rec.fileExplorerRootDir === "string"
            ? (rec.fileExplorerRootDir as string | null)
            : null;
        const codeEditorRootDir =
          rec.codeEditorRootDir === null || typeof rec.codeEditorRootDir === "string"
            ? (rec.codeEditorRootDir as string | null)
            : null;
  
        out[workspaceKey] = {
          projectId,
          fileExplorerOpen: typeof rec.fileExplorerOpen === "boolean" ? rec.fileExplorerOpen : undefined,
          fileExplorerRootDir,
          fileExplorerPersistedState: coerceFileExplorerPersistedState(
            rec.fileExplorerPersistedState,
            fileExplorerRootDir ?? codeEditorRootDir,
          ),
          codeEditorOpen: typeof rec.codeEditorOpen === "boolean" ? rec.codeEditorOpen : undefined,
          codeEditorRootDir,
          codeEditorActiveFilePath:
            rec.codeEditorActiveFilePath === null || typeof rec.codeEditorActiveFilePath === "string"
              ? (rec.codeEditorActiveFilePath as string | null)
              : null,
          codeEditorPersistedState: coerceCodeEditorPersistedState(rec.codeEditorPersistedState),
        };
      }
  
      return { schemaVersion: 1, views: out };
    } catch {
      return null;
    }
  }
  


export function coerceFileExplorerPersistedState(
    value: unknown,
    rootOverride: string | null,
  ): FileExplorerPersistedState | null {
    if (!value || typeof value !== "object") return null;
    const rec = value as Record<string, unknown>;
    const root =
      (typeof rootOverride === "string" && rootOverride.trim()) ||
      (typeof rec.root === "string" && rec.root.trim()) ||
      "";
    if (!root) return null;
  
    const expandedDirs = Array.isArray(rec.expandedDirs)
      ? rec.expandedDirs.filter((x): x is string => typeof x === "string").slice(0, 400)
      : [];
  
    const scrollTop =
      typeof rec.scrollTop === "number" && Number.isFinite(rec.scrollTop) ? Math.max(0, rec.scrollTop) : 0;
  
    return { root, expandedDirs, dirStateByPath: {}, scrollTop };
  }
  
  export function coerceCodeEditorPersistedState(value: unknown): CodeEditorPersistedState | null {
    if (!value || typeof value !== "object") return null;
    const rec = value as Record<string, unknown>;
    const rawTabs = rec.tabs;
    if (!Array.isArray(rawTabs)) return null;
  
    const tabs = rawTabs
      .filter((t): t is { path: unknown } => Boolean(t) && typeof t === "object" && "path" in (t as object))
      .map((t) => (typeof t.path === "string" ? t.path.trim() : ""))
      .filter((p) => Boolean(p))
      .slice(0, 40)
      .map((path) => ({ path, dirty: false, content: null }));
  
    if (tabs.length === 0) return null;
  
    const desiredActive = typeof rec.activePath === "string" ? rec.activePath.trim() : "";
    const activePath =
      (desiredActive && tabs.some((t) => t.path === desiredActive) && desiredActive) || tabs[0]?.path || null;
  
    return { tabs, activePath };
  }
  

  function sanitizeFileExplorerPersistedStateForStorage(
    state: FileExplorerPersistedState | null,
    rootOverride: string | null,
  ): FileExplorerPersistedState | null {
    if (!state) return null;
    return coerceFileExplorerPersistedState(state, rootOverride);
  }
  
  function sanitizeCodeEditorPersistedStateForStorage(
    state: CodeEditorPersistedState | null,
  ): CodeEditorPersistedState | null {
    if (!state) return null;
    return coerceCodeEditorPersistedState(state);
  }


export function buildWorkspaceViewStorageV1(
    workspaceViewByKey: Record<string, WorkspaceView>,
    validProjectIds: Set<string>,
  ): WorkspaceViewStorageV1 {
    const entries: Array<[string, StoredWorkspaceViewV1]> = [];
    for (const [workspaceKey, view] of Object.entries(workspaceViewByKey)) {
      if (!view) continue;
      if (!shouldPersistWorkspaceView(view)) continue;
  
      const projectId = projectIdFromWorkspaceKey(workspaceKey) ?? view.projectId;
      if (!projectId || !validProjectIds.has(projectId)) continue;
  
      const rootOverride = view.fileExplorerRootDir ?? view.codeEditorRootDir ?? null;
      entries.push([
        workspaceKey,
        {
          projectId,
          fileExplorerOpen: view.fileExplorerOpen,
          fileExplorerRootDir: view.fileExplorerRootDir ?? null,
          fileExplorerPersistedState: sanitizeFileExplorerPersistedStateForStorage(
            view.fileExplorerPersistedState,
            rootOverride,
          ),
          codeEditorOpen: view.codeEditorOpen,
          codeEditorRootDir: view.codeEditorRootDir ?? null,
          codeEditorActiveFilePath: view.codeEditorActiveFilePath ?? null,
          codeEditorPersistedState: sanitizeCodeEditorPersistedStateForStorage(view.codeEditorPersistedState),
        },
      ]);
    }
  
    entries.sort(([a], [b]) => a.localeCompare(b));
    if (entries.length > 200) entries.length = 200;
  
    return { schemaVersion: 1, views: Object.fromEntries(entries) };
  }

  function shouldPersistWorkspaceView(view: WorkspaceView): boolean {
    if (!view.fileExplorerOpen) return true;
    if (view.fileExplorerRootDir) return true;
    if (view.fileExplorerPersistedState) return true;
    if (view.codeEditorOpen) return true;
    if (view.codeEditorRootDir) return true;
    if (view.codeEditorPersistedState) return true;
    if (view.codeEditorActiveFilePath) return true;
    return false;
  }