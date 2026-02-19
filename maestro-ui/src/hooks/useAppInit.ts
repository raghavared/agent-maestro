import { useEffect, MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";
import { TerminalSession } from "../app/types/session";
import { MaestroProject } from "../app/types/maestro";
import { EnvironmentConfig } from "../app/types/app";
import { WorkspaceView } from "../app/types/workspace";
import {
  PtyOutput,
  PtyExit,
  AppMenuEventPayload,
  StartupFlags,
  TrayMenuEventPayload,
  PendingDataBuffer,
  SecureStorageMode,
  PersistedStateV1,
  PersistedStateMetaV1,
  Prompt,
  AssetTemplate,
  AssetSettings,
} from "../app/types/app-state";
import { TerminalRegistry } from "../SessionTerminal";
import { coercePtyDataToString } from "../services/terminalService";
import { createSession, closeSession, detachSession } from "../services/sessionService";
import { maestroClient } from "../utils/MaestroClient";
import { defaultProjectState, envVarsForProjectId } from "../app/utils/env";
import { loadWorkspaceViewStorageV1, coerceCodeEditorPersistedState, coerceFileExplorerPersistedState, projectIdFromWorkspaceKey } from "../utils/workSpaceStorage";
import { formatError, cleanAgentShortcutIds } from "../utils/formatters";
import { makeId } from "../app/utils/id";
import { sleep } from "../utils/domUtils";
import * as DEFAULTS from "../app/constants/defaults";

interface UseAppInitProps {
  // Refs
  registry: MutableRefObject<TerminalRegistry>;
  pendingData: MutableRefObject<PendingDataBuffer>;
  pendingExitCodes: MutableRefObject<Map<string, number | null>>;
  closingSessions: MutableRefObject<Map<string, number>>;
  sessionIdsRef: MutableRefObject<string[]>;
  sessionsRef: MutableRefObject<TerminalSession[]>;
  activeIdRef: MutableRefObject<string | null>;
  activeProjectIdRef: MutableRefObject<string>;
  homeDirRef: MutableRefObject<string | null>;

  // State persistence refs
  saveTimerRef: MutableRefObject<number | null>;
  pendingSaveRef: MutableRefObject<PersistedStateV1 | null>;
  workspaceViewSaveTimerRef: MutableRefObject<number | null>;
  pendingWorkspaceViewSaveRef: MutableRefObject<any>;

  // Session lifecycle
  markAgentWorkingFromOutput: (id: string, text: string) => void;
  clearAgentIdleTimer: (id: string) => void;
  agentIdleTimersRef: MutableRefObject<Map<string, number>>;
  lastResizeAtRef: MutableRefObject<Map<string, number>>;

  // Setters
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  setProjects: React.Dispatch<React.SetStateAction<MaestroProject[]>>;
  setActiveProjectId: (id: string) => void;
  setActiveSessionByProject: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  setEnvironments: React.Dispatch<React.SetStateAction<EnvironmentConfig[]>>;
  setAssets: React.Dispatch<React.SetStateAction<AssetTemplate[]>>;
  setAssetSettings: React.Dispatch<React.SetStateAction<AssetSettings>>;
  setAgentShortcutIds: React.Dispatch<React.SetStateAction<string[]>>;
  setWorkspaceViewByKey: React.Dispatch<React.SetStateAction<Record<string, WorkspaceView>>>;
  setSecureStorageMode: React.Dispatch<React.SetStateAction<SecureStorageMode | null>>;
  setPersistenceDisabledReason: (reason: string | null) => void;
  setUpdatesOpen: (open: boolean) => void;
  setPendingTrayAction: React.Dispatch<React.SetStateAction<TrayMenuEventPayload | null>>;

  // Callbacks
  applyPendingExit: (session: TerminalSession) => TerminalSession;
  checkForUpdates: () => Promise<void>;
  showNotice: (message: string, duration?: number) => void;
  reportError: (title: string, error: unknown) => void;
  createInitialWorkspaceView: (projectId: string) => WorkspaceView;
  lastActiveByProjectRef: MutableRefObject<Map<string, string>>;
  setHydrated: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppInit({
  registry,
  pendingData,
  pendingExitCodes,
  closingSessions,
  sessionIdsRef,
  sessionsRef,
  activeIdRef,
  activeProjectIdRef,
  homeDirRef,
  saveTimerRef,
  pendingSaveRef,
  workspaceViewSaveTimerRef,
  pendingWorkspaceViewSaveRef,
  markAgentWorkingFromOutput,
  clearAgentIdleTimer,
  agentIdleTimersRef,
  lastResizeAtRef,
  setSessions,
  setActiveId,
  setProjects,
  setActiveProjectId,
  setActiveSessionByProject,
  setPrompts,
  setEnvironments,
  setAssets,
  setAssetSettings,
  setAgentShortcutIds,
  setWorkspaceViewByKey,
  setSecureStorageMode,
  setPersistenceDisabledReason,
  setUpdatesOpen,
  setPendingTrayAction,
  applyPendingExit,
  checkForUpdates,
  showNotice,
  reportError,
  createInitialWorkspaceView,
  lastActiveByProjectRef,
  setHydrated,
}: UseAppInitProps) {
  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const isTerminalRendererReady = (term: unknown): boolean => {
        try {
          const anyTerm = term as any;
          const core = anyTerm?._core;
          const renderService = core?._renderService;
          const rendererRef = renderService?._renderer;
          const renderer = rendererRef?.value ?? rendererRef?._value ?? null;
          return Boolean(renderer && renderer.dimensions);
        } catch {
          return false;
        }
      };

      // Set up event listeners FIRST, before creating any sessions
      const unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
        if (cancelled) return;
        const { id, data } = event.payload as { id: string; data?: unknown };
        const text = coercePtyDataToString(data);
        if (!text) return;

        // Ignore events for sessions being closed
        if (closingSessions.current.has(id)) return;

        markAgentWorkingFromOutput(id, text);

        const entry = registry.current.get(id);
        if (entry && isTerminalRendererReady(entry.term)) {
          entry.term.write(text);
          return;
        }
        {
          // Buffer the data - the terminal will catch up
          if (
            !pendingData.current.has(id) &&
            pendingData.current.size >= DEFAULTS.MAX_PENDING_SESSIONS
          ) {
            const oldest = pendingData.current.keys().next().value as string | undefined;
            if (oldest) pendingData.current.delete(oldest);
          }
          const buffer = pendingData.current.get(id) || [];
          buffer.push(text);
          if (buffer.length > DEFAULTS.MAX_PENDING_CHUNKS_PER_SESSION) {
            buffer.splice(0, buffer.length - DEFAULTS.MAX_PENDING_CHUNKS_PER_SESSION);
          }
          // Maintain LRU order: most recently touched sessions go to the end.
          pendingData.current.delete(id);
          pendingData.current.set(id, buffer);
        }
      });
      unlisteners.push(unlistenOutput);

      const unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
        if (cancelled) return;
        const { id, exit_code } = event.payload;

        clearAgentIdleTimer(id);
        lastResizeAtRef.current.delete(id);

        const timeout = closingSessions.current.get(id);
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
          closingSessions.current.delete(id);
          return;
        }

        setSessions((prev) => {
          let found = false;
          const next = prev.map((s) => {
            if (s.id !== id) return s;
            found = true;
            return {
              ...s,
              exited: true,
              exitCode: exit_code ?? null,
              agentWorking: false,
              recordingActive: false,
            };
          });
          if (!found) pendingExitCodes.current.set(id, exit_code ?? null);
          return next;
        });
      });
      unlisteners.push(unlistenExit);

      const unlistenMenu = await listen<AppMenuEventPayload>("app-menu", (event) => {
        if (cancelled) return;
        if (event.payload.id === "help-check-updates") {
          setUpdatesOpen(true);
          void checkForUpdates();
        }
      });
      unlisteners.push(unlistenMenu);

      const unlistenTray = await listen<TrayMenuEventPayload>("tray-menu", (event) => {
        if (cancelled) return;
        setPendingTrayAction(event.payload);
      });
      unlisteners.push(unlistenTray);

      // Check if we were cancelled during async setup
      if (cancelled) {
        unlisteners.forEach(fn => fn());
        return;
      }

      let resolvedHome: string | null = null;
      try {
        resolvedHome = await homeDir();
        homeDirRef.current = resolvedHome;
      } catch {
        resolvedHome = null;
        homeDirRef.current = null;
      }

      const startupFlags = await invoke<StartupFlags>("get_startup_flags").catch(() => null);
      if (startupFlags?.clearData) {
        try {
          localStorage.removeItem(DEFAULTS.STORAGE_PROJECTS_KEY);
          localStorage.removeItem(DEFAULTS.STORAGE_ACTIVE_PROJECT_KEY);
          localStorage.removeItem(DEFAULTS.STORAGE_SESSIONS_KEY);
          localStorage.removeItem(DEFAULTS.STORAGE_ACTIVE_SESSION_BY_PROJECT_KEY);
          localStorage.removeItem(DEFAULTS.STORAGE_WORKSPACE_VIEW_BY_KEY);
        } catch {
          // Best-effort: localStorage may be unavailable in some contexts.
        }
        showNotice("Cleared saved app data for a fresh start.", 8000);
      }

      const stateMeta = await invoke<PersistedStateMetaV1 | null>("load_persisted_state_meta").catch(
        () => null,
      );
      const metaMode = stateMeta?.secureStorageMode ?? null;
      const needsSecureStorage = Boolean(
        stateMeta &&
        stateMeta.schemaVersion === 1 &&
        metaMode === "keychain" &&
        stateMeta.encryptedEnvironmentCount > 0,
      );
      if (needsSecureStorage) {
        showNotice(
          "macOS Keychain access is needed to decrypt/encrypt your environments + recordings. You may see 1\u20132 prompts (first run can create the encryption key). Choose \u201CAlways Allow\u201D to avoid future prompts.",
          60000,
        );
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        try {
          await invoke("prepare_secure_storage");
          showNotice(
            "Secure storage enabled: environments + recording inputs are encrypted at rest (key stored in macOS Keychain).",
            20000,
          );
        } catch (err) {
          if (!cancelled) {
            setPersistenceDisabledReason(`Secure storage is locked (changes won't be saved): ${formatError(err)}`);
          }
        }
      }

      let diskState: PersistedStateV1 | null = null;
      try {
        diskState = await invoke<PersistedStateV1 | null>("load_persisted_state");
      } catch (err) {
        const msg = formatError(err);
        if (!cancelled) {
          setPersistenceDisabledReason(
            `Failed to load saved state (changes won't be saved until restart): ${msg}`,
          );
        }
        diskState = null;
      }

      let state: PersistedStateV1 | null = diskState;

      if (!state) {
        const initial = defaultProjectState();
        state = {
          schemaVersion: 1,
          projects: initial.projects.map((p) => ({ ...p, basePath: resolvedHome })),
          activeProjectId: initial.activeProjectId,
          sessions: [],
          activeSessionByProject: {},
        };
      }

      if (cancelled) return;

      // Map loaded projects from Rust format (title) to app format (name)
      state.projects = state.projects.map((p) => {
        const rustProject = p as any;
        return {
          id: p.id,
          name: rustProject.title || rustProject.name || 'Untitled Project', // Map 'title' back to 'name'
          workingDir: rustProject.workingDir || rustProject.basePath || '',
          createdAt: rustProject.createdAt || Date.now(),
          updatedAt: rustProject.updatedAt || Date.now(),
          basePath: p.basePath ?? null,
          environmentId: (p as { environmentId?: string | null }).environmentId ?? null,
          assetsEnabled: (p as { assetsEnabled?: boolean }).assetsEnabled ?? true,
        };
      });

      const projectById = new Map(state.projects.map((p) => [p.id, p]));
      if (projectById.size === 0) {
        const initial = defaultProjectState();
        state.projects = initial.projects.map((p) => ({ ...p, basePath: resolvedHome }));
        state.activeProjectId = initial.activeProjectId;
        state.sessions = [];
        state.activeSessionByProject = {};
        projectById.clear();
        for (const p of state.projects) projectById.set(p.id, p);
      }

      const activeProjectId = projectById.has(state.activeProjectId)
        ? state.activeProjectId
        : state.projects[0].id;

      const activeSessionByProject = Object.fromEntries(
        Object.entries(state.activeSessionByProject).filter(([projectId]) =>
          projectById.has(projectId),
        ),
      );

      // Sync projects with maestro-server
      try {
        const serverProjects = await maestroClient.getProjects();
        const serverProjectsById = new Map(serverProjects.map(p => [p.id, p]));
        const localProjectsById = new Map(state.projects.map(p => [p.id, p]));

        // Merge: prioritize server projects, but keep local UI-specific fields
        const mergedProjects: MaestroProject[] = [];

        // Add all server projects (they are the source of truth)
        for (const serverProj of serverProjects) {
          const localProj = localProjectsById.get(serverProj.id);
          mergedProjects.push({
            id: serverProj.id,
            name: serverProj.name,
            workingDir: serverProj.workingDir,
            createdAt: serverProj.createdAt,
            updatedAt: serverProj.updatedAt,
            basePath: serverProj.workingDir || null,
            environmentId: localProj?.environmentId ?? null,
            assetsEnabled: localProj?.assetsEnabled ?? true,
          });
        }

        // Create any local projects that don't exist on server
        for (const localProj of state.projects) {
          if (!serverProjectsById.has(localProj.id)) {
            try {
              const created = await maestroClient.createProject({
                name: localProj.name,
                workingDir: localProj.workingDir,
                createdAt: localProj.createdAt,
                updatedAt: localProj.updatedAt,
                description: '',
              });
              mergedProjects.push({
                id: created.id,
                name: created.name,
                workingDir: created.workingDir,
                createdAt: created.createdAt,
                updatedAt: created.updatedAt,
                environmentId: localProj.environmentId,
                assetsEnabled: localProj.assetsEnabled ?? true,
              });
            } catch (err) {
              // Keep the local project if server creation fails
              mergedProjects.push(localProj);
            }
          }
        }

        // If we have merged projects, use them
        if (mergedProjects.length > 0) {
          state.projects = mergedProjects;
        }
      } catch (err) {
        // Continue with local projects if server sync fails
      }

      setProjects(state.projects);
      setActiveProjectId(activeProjectId);
      activeProjectIdRef.current = activeProjectId;
      setActiveSessionByProject(activeSessionByProject);

      const workspaceStorage = loadWorkspaceViewStorageV1();
      if (workspaceStorage?.schemaVersion === 1) {
        const validProjectIds = new Set(state.projects.map((p) => p.id));
        const nextWorkspaceViews: Record<string, WorkspaceView> = {};
        for (const [workspaceKey, stored] of Object.entries(workspaceStorage.views)) {
          const projectId = projectIdFromWorkspaceKey(workspaceKey) ?? stored.projectId;
          if (!projectId || !validProjectIds.has(projectId)) continue;

          const base = createInitialWorkspaceView(projectId);
          const fileExplorerRootDir = stored.fileExplorerRootDir ?? base.fileExplorerRootDir;
          const codeEditorRootDir = stored.codeEditorRootDir ?? base.codeEditorRootDir;
          const rootOverride = fileExplorerRootDir ?? codeEditorRootDir ?? null;

          const codeEditorPersistedState = coerceCodeEditorPersistedState(stored.codeEditorPersistedState);
          const codeEditorActiveFilePath =
            stored.codeEditorActiveFilePath ?? codeEditorPersistedState?.activePath ?? base.codeEditorActiveFilePath;

          nextWorkspaceViews[workspaceKey] = {
            ...base,
            projectId,
            fileExplorerOpen:
              typeof stored.fileExplorerOpen === "boolean" ? stored.fileExplorerOpen : base.fileExplorerOpen,
            fileExplorerRootDir,
            fileExplorerPersistedState: coerceFileExplorerPersistedState(
              stored.fileExplorerPersistedState,
              rootOverride,
            ),
            codeEditorOpen: typeof stored.codeEditorOpen === "boolean" ? stored.codeEditorOpen : base.codeEditorOpen,
            codeEditorRootDir,
            codeEditorActiveFilePath,
            codeEditorPersistedState,
            openFileRequest: null,
            codeEditorFsEvent: null,
          };
        }
        setWorkspaceViewByKey(nextWorkspaceViews);
      }

      const loadedSecureStorageMode =
        (state as { secureStorageMode?: SecureStorageMode | null }).secureStorageMode ?? metaMode;
      setSecureStorageMode(loadedSecureStorageMode ?? null);
      setPrompts(state.prompts ?? []);
      setEnvironments(state.environments ?? []);
      const encryptedEnvCount = (state.environments ?? []).filter((e) =>
        (e.content ?? "").trimStart().startsWith("enc:v1:"),
      ).length;
      if (encryptedEnvCount > 0) {
        if (loadedSecureStorageMode === "keychain") {
          showNotice(
            `Some environments could not be decrypted (${encryptedEnvCount}). Check macOS Keychain access.`,
            9000,
          );
        } else {
          showNotice(
            `Some environments are encrypted (${encryptedEnvCount}). Enable macOS Keychain encryption to unlock them.`,
            12000,
          );
        }
      }
      setAssetSettings(state.assetSettings ?? { autoApplyEnabled: true });
      setAgentShortcutIds(() => {
        const loaded = state.agentShortcutIds ?? null;
        if (!loaded) return cleanAgentShortcutIds(DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS);
        const cleaned = cleanAgentShortcutIds(loaded);
        if (loaded.length > 0 && cleaned.length === 0) {
          return cleanAgentShortcutIds(DEFAULTS.DEFAULT_AGENT_SHORTCUT_IDS);
        }
        return cleaned;
      });
      setAssets(() => {
        const loaded = (state.assets ?? [])
          .map((a) => ({
            ...a,
            name: a.name?.trim?.() ? a.name.trim() : a.name,
            relativePath: a.relativePath?.trim?.() ? a.relativePath.trim() : a.relativePath,
            autoApply: a.autoApply ?? true,
          }))
          .filter((a) => a && a.id && a.relativePath && a.name);
        if (loaded.length) return loaded;
        return [
          {
            id: makeId(),
            name: "AGENTS.md",
            relativePath: "AGENTS.md",
            content: "# AGENTS.md\n\n<INSTRUCTIONS>\n- Add project-specific agent instructions here.\n</INSTRUCTIONS>\n",
            createdAt: Date.now(),
            autoApply: true,
          },
        ];
      });

      const envVarsForProject = (projectId: string): Record<string, string> | null => {
        return envVarsForProjectId(projectId, state!.projects, state!.environments ?? []);
      };

      const persisted = state.sessions
        .filter((s) => projectById.has(s.projectId))
        .sort((a, b) => a.createdAt - b.createdAt);

      const restored: TerminalSession[] = [];
      for (const s of persisted) {
        if (cancelled) break;
        try {
          const createdRaw = await createSession({
            projectId: s.projectId,
            name: s.name,
            launchCommand: s.launchCommand,
            restoreCommand: s.restoreCommand ?? null,
            sshTarget: s.sshTarget ?? null,
            sshRootDir: s.sshRootDir ?? null,
            lastRecordingId: s.lastRecordingId ?? null,
            cwd: s.cwd ?? projectById.get(s.projectId)?.basePath ?? resolvedHome ?? null,
            envVars: envVarsForProject(s.projectId),
            persistent: s.persistent ?? false,
            persistId: s.persistId,
            createdAt: s.createdAt,
          });
          const created = applyPendingExit(createdRaw);
          restored.push(created);

          const restoreCmd =
            (s.persistent
              ? null
              : (s.launchCommand ? null : (s.restoreCommand ?? null))?.trim()) ?? null;
          if (restoreCmd) {
            const singleLine = restoreCmd.replace(/\r?\n/g, " ");
            void (async () => {
              try {
                if (singleLine) {
                  await invoke("write_to_session", {
                    id: created.id,
                    data: singleLine,
                    source: "system",
                  });
                  await sleep(30);
                }
                await invoke("write_to_session", {
                  id: created.id,
                  data: "\r",
                  source: "system",
                });
              } catch {
                // Best-effort restore: if this fails, the tab still opens as a shell.
              }
            })();
          }
        } catch (err) {
          if (!cancelled) reportError("Failed to restore session", err);
        }
      }

      if (cancelled) {
        await Promise.all(restored.map((s) => closeSession(s.id).catch(() => { })));
        return;
      }

      if (restored.length === 0) {
        let first: TerminalSession;
        try {
          const basePath = projectById.get(activeProjectId)?.basePath ?? resolvedHome ?? null;
          const createdRaw = await createSession({
            projectId: activeProjectId,
            cwd: basePath,
            envVars: envVarsForProject(activeProjectId),
          });
          first = applyPendingExit(createdRaw);
        } catch (err) {
          if (!cancelled) reportError("Failed to create session", err);
          setSessions([]);
          setActiveId(null);
          setHydrated(true);
          return;
        }
        if (cancelled) {
          await closeSession(first.id).catch(() => { });
          return;
        }
        setSessions([first]);
        setActiveId(first.id);
        setHydrated(true);
        return;
      }

      for (const p of state.projects) {
        const desired = activeSessionByProject[p.id];
        const session =
          (desired
            ? restored.find((s) => s.projectId === p.id && s.persistId === desired)
            : null) ?? restored.find((s) => s.projectId === p.id) ?? null;
        if (session) lastActiveByProjectRef.current.set(p.id, session.id);
      }

      setSessions(restored);
      const desired = activeSessionByProject[activeProjectId];
      const active =
        (desired
          ? restored.find(
            (s) => s.projectId === activeProjectId && s.persistId === desired,
          )
          : null) ??
        restored.find((s) => s.projectId === activeProjectId) ??
        null;
      setActiveId(active ? active.id : null);
      setHydrated(true);
    };

    void setup().catch((err) => {
      if (cancelled) return;
      reportError("Startup failed", err);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
      unlisteners.forEach(fn => fn());
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
      if (workspaceViewSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceViewSaveTimerRef.current);
        workspaceViewSaveTimerRef.current = null;
      }
      pendingWorkspaceViewSaveRef.current = null;
      for (const timeout of closingSessions.current.values()) {
        window.clearTimeout(timeout);
      }
      closingSessions.current.clear();
      for (const timeout of agentIdleTimersRef.current.values()) {
        window.clearTimeout(timeout);
      }
      agentIdleTimersRef.current.clear();
      for (const id of sessionIdsRef.current) {
        const s = sessionsRef.current.find((x) => x.id === id) ?? null;
        if (s?.persistent && !s.exited) void detachSession(id).catch(() => { });
        else void closeSession(id).catch(() => { });
      }
    };
  }, []);

}
