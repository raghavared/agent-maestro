import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { TerminalRegistry } from "./SessionTerminal";
import { PendingDataBuffer } from "./app/types/app-state";
import * as DEFAULTS from "./app/constants/defaults";

// Stores
import { useUIStore } from "./stores/useUIStore";
import { useSessionStore, initSessionStoreRefs } from "./stores/useSessionStore";
import { useProjectStore, initActiveSessionSync } from "./stores/useProjectStore";
import { usePromptStore } from "./stores/usePromptStore";
import { useAgentShortcutStore } from "./stores/useAgentShortcutStore";
import { usePersistentSessionStore } from "./stores/usePersistentSessionStore";
import { useSshStore } from "./stores/useSshStore";
import { useMaestroStore } from "./stores/useMaestroStore";

// Store initialisation
import { initApp } from "./stores/initApp";
import { initCentralPersistence, initWorkspaceViewPersistence } from "./stores/persistence";
import { initTheme } from "./stores/useThemeStore";
import { initZoom } from "./stores/useZoomStore";

// Hooks
import { useQuickLaunch } from "./hooks/useQuickLaunch";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppLayoutResizing } from "./hooks/useAppLayoutResizing";
import { useWorkspaceResizeEffect } from "./hooks/useWorkspaceResizeEffect";
import { useProjectSoundSync } from "./hooks/useProjectSoundSync";

// Components
import { CommandPalette } from "./CommandPalette";
import { ProjectTabBar } from "./components/ProjectTabBar";
import { QuickPromptsSection } from "./components/QuickPromptsSection";
import { SessionsSection } from "./components/SessionsSection";
import { AppRightPanel } from "./components/AppRightPanel";
import { AppSlidePanel } from "./components/AppSlidePanel";
import { AppModals } from "./components/app/AppModals";
import { AppWorkspace } from "./components/app/AppWorkspace";
import { ConfirmActionModal } from "./components/modals/ConfirmActionModal";

// ---------------------------------------------------------------------------
// App  (thin layout shell -- all domain state lives in Zustand stores)
// ---------------------------------------------------------------------------

export default function App() {
  type RunningSessionsByProject = {
    projectId: string;
    projectName: string;
    sessions: Array<{ id: string; name: string }>;
  };

  // DOM-bound refs (these cannot live in Zustand)
  const registry = useRef<TerminalRegistry>(new Map());
  const pendingData = useRef<PendingDataBuffer>(new Map());
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sessionsRef = useRef<ReturnType<typeof useSessionStore.getState>["sessions"]>([]);
  const projectsRef = useRef<ReturnType<typeof useProjectStore.getState>["projects"]>([]);
  const onCloseRef = useRef<ReturnType<typeof useSessionStore.getState>["onClose"]>(async () => {});
  const bypassAppCloseConfirmRef = useRef(false);
  const [confirmCloseAppOpen, setConfirmCloseAppOpen] = useState(false);
  const [confirmCloseAppBusy, setConfirmCloseAppBusy] = useState(false);
  const [runningSessionsByProject, setRunningSessionsByProject] = useState<RunningSessionsByProject[]>([]);

  // ---------- bootstrap stores & persistence ----------
  useEffect(() => {
    initTheme();
    initZoom();
    initSessionStoreRefs(registry, pendingData, { current: null });
    const cleanupApp = initApp(registry, pendingData);
    const cleanupPersistence = initCentralPersistence();
    const cleanupWorkspace = initWorkspaceViewPersistence();
    const cleanupActiveSessionSync = initActiveSessionSync();
    return () => {
      cleanupApp();
      cleanupPersistence();
      cleanupWorkspace();
      cleanupActiveSessionSync();
    };
  }, []);

  // ---------- workspace panel resize ----------
  useWorkspaceResizeEffect();

  // ---------- keyboard shortcuts (reads from stores directly) ----------
  useKeyboardShortcuts();

  // ---------- project sound sync ----------
  useProjectSoundSync();

  // ---------- responsive mode ----------
  const responsiveMode = useUIStore((s) => s.responsiveMode);
  const setResponsiveMode = useUIStore((s) => s.setResponsiveMode);
  const activeMobilePanel = useUIStore((s) => s.activeMobilePanel);
  const setActiveMobilePanel = useUIStore((s) => s.setActiveMobilePanel);

  useEffect(() => {
    const BREAKPOINT = 960;
    const check = () => {
      const narrow = window.innerWidth < BREAKPOINT;
      if (narrow !== useUIStore.getState().responsiveMode) {
        setResponsiveMode(narrow);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [setResponsiveMode]);

  // ---------- read layout values from stores ----------
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setSlidePanelOpen = useUIStore((s) => s.setSlidePanelOpen);
  const setSlidePanelTab = useUIStore((s) => s.setSlidePanelTab);

  // ---------- projects ----------
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setProjectOpen = useProjectStore((s) => s.setProjectOpen);
  const selectProject = useProjectStore((s) => s.selectProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const checkAndDeleteProject = useProjectStore((s) => s.checkAndDeleteProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const fetchSavedProjects = useProjectStore((s) => s.fetchSavedProjects);
  const reopenProject = useProjectStore((s) => s.reopenProject);
  const moveProject = useProjectStore((s) => s.moveProject);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const handleDeleteProject = useCallback((projectId: string) => {
    void checkAndDeleteProject(projectId);
  }, [checkAndDeleteProject]);

  const handleCloseProject = useCallback((projectId: string) => {
    void closeProject(projectId);
  }, [closeProject]);

  const handleReopenProject = useCallback((projectId: string) => {
    void reopenProject(projectId);
  }, [reopenProject]);

  // ---------- sessions ----------
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const setActiveId = useSessionStore((s) => s.setActiveId);
  const setNewOpen = useSessionStore((s) => s.setNewOpen);
  const onClose = useSessionStore((s) => s.onClose);
  const quickStart = useSessionStore((s) => s.quickStart);
  const reorderSessions = useSessionStore((s) => s.reorderSessions);
  const sendPromptToActive = useSessionStore((s) => s.sendPromptToActive);

  // ---------- auto-clear needsInput when user views a session ----------
  const checkAndClearNeedsInput = useMaestroStore((s) => s.checkAndClearNeedsInputForActiveSession);
  useEffect(() => {
    if (activeId) checkAndClearNeedsInput();
  }, [activeId, checkAndClearNeedsInput]);

  const projectSessions = useMemo(
    () => sessions.filter((s) => s.projectId === activeProjectId),
    [sessions, activeProjectId],
  );

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const sessionCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
    return counts;
  }, [sessions]);

  const workingAgentCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (!s.effectId || s.exited || s.closing || !s.agentWorking) continue;
      counts.set(s.projectId, (counts.get(s.projectId) ?? 0) + 1);
    }
    return counts;
  }, [sessions]);

  const maestroSessions = useMaestroStore((s) => s.sessions);
  const needsInputByProject = useMemo(() => {
    const result = new Map<string, boolean>();
    for (const s of sessions) {
      if (!s.maestroSessionId) continue;
      const ms = maestroSessions.get(s.maestroSessionId);
      if (ms?.needsInput?.active) {
        result.set(s.projectId, true);
      }
    }
    return result;
  }, [sessions, maestroSessions]);

  // ---------- prompts ----------
  const prompts = usePromptStore((s) => s.prompts);
  const openPromptEditor = usePromptStore((s) => s.openPromptEditor);

  // ---------- agent shortcuts & quick-launch ----------
  const agentShortcutIds = useAgentShortcutStore((s) => s.agentShortcutIds);
  const setAgentShortcutsOpen = useAgentShortcutStore((s) => s.setAgentShortcutsOpen);
  const { agentShortcuts } = useQuickLaunch({ agentShortcutIds, sessions });

  // ---------- persistent sessions ----------
  const refreshPersistentSessions = usePersistentSessionStore((s) => s.refreshPersistentSessions);
  const setPersistentSessionsOpen = usePersistentSessionStore((s) => s.setPersistentSessionsOpen);
  const setManageTerminalsOpen = usePersistentSessionStore((s) => s.setManageTerminalsOpen);

  // ---------- open SSH manager (stable callback) ----------
  const openSshManager = useCallback(() => {
    setProjectOpen(false);
    setNewOpen(false);
    useSshStore.getState().setSshManagerOpen(true);
  }, [setProjectOpen, setNewOpen]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: null | (() => void) = null;

    const groupRunningSessionsByProject = (): RunningSessionsByProject[] => {
      const runningSessions = sessionsRef.current.filter((s) => !s.exited && !s.closing);
      const projectNameById = new Map(
        projectsRef.current.map((p) => [p.id, p.name?.trim() || p.id]),
      );
      const grouped = new Map<string, RunningSessionsByProject>();

      for (const session of runningSessions) {
        const current = grouped.get(session.projectId);
        if (current) {
          current.sessions.push({ id: session.id, name: session.name });
          continue;
        }

        grouped.set(session.projectId, {
          projectId: session.projectId,
          projectName: projectNameById.get(session.projectId) ?? session.projectId,
          sessions: [{ id: session.id, name: session.name }],
        });
      }

      return Array.from(grouped.values());
    };

    const registerCloseHandler = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (cancelled) return;
        unlisten = await getCurrentWindow().onCloseRequested((event) => {
          if (bypassAppCloseConfirmRef.current) return;
          const grouped = groupRunningSessionsByProject();
          if (grouped.length === 0) return;
          event.preventDefault();
          setRunningSessionsByProject(grouped);
          setConfirmCloseAppOpen(true);
        });
      } catch {
        // Running outside Tauri, or window API unavailable.
      }
    };

    void registerCloseHandler();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const closeAppWithRunningSessions = useCallback(async () => {
    if (confirmCloseAppBusy) return;
    setConfirmCloseAppBusy(true);
    try {
      const running = sessionsRef.current.filter((s) => !s.exited && !s.closing);
      for (const session of running) {
        try {
          await onCloseRef.current(session.id);
        } catch {
          // Best-effort shutdown while closing app.
        }
      }

      bypassAppCloseConfirmRef.current = true;
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      bypassAppCloseConfirmRef.current = false;
    } finally {
      setConfirmCloseAppBusy(false);
      setConfirmCloseAppOpen(false);
    }
  }, [confirmCloseAppBusy]);

  const runningSessionCount = useMemo(
    () => runningSessionsByProject.reduce((count, group) => count + group.sessions.length, 0),
    [runningSessionsByProject],
  );

  // ---------- layout resize handlers ----------
  const {
    handleSidebarResizePointerDown,
  } = useAppLayoutResizing({
    sidebarRef,
    projects,
    sidebarWidth,
    setSidebarWidth: useUIStore.getState().setSidebarWidth,
    persistSidebarWidth: useUIStore.getState().persistSidebarWidth,
    rightPanelWidth,
    setRightPanelWidth: useUIStore.getState().setRightPanelWidth,
    persistRightPanelWidth: useUIStore.getState().persistRightPanelWidth,
    projectsListHeightMode: 'auto',
    setProjectsListHeightMode: () => {},
    projectsListMaxHeight: 0,
    setProjectsListMaxHeight: () => {},
  });

  // ---------- render ----------
  const isEmpty = projects.length === 0;

  return (
    <div className="app">
      {/* -------- Project Tab Bar -------- */}
      {!isEmpty && (
        <ProjectTabBar
          projects={projects}
          activeProjectId={activeProjectId}
          sessionCountByProject={sessionCountByProject}
          workingAgentCountByProject={workingAgentCountByProject}
          needsInputByProject={needsInputByProject}
          onSelectProject={selectProject}
          onNewProject={openNewProject}
          onDeleteProject={handleDeleteProject}
          onCloseProject={handleCloseProject}
          onFetchSavedProjects={fetchSavedProjects}
          onReopenProject={handleReopenProject}
          onMoveProject={moveProject}
        />
      )}

      {isEmpty ? (
        <>
          <div className="emptyState">
            <div className="emptyStateTitle">NO PROJECTS</div>
            <div className="emptyStateHint">Create a project to get started</div>
            <button
              type="button"
              className="emptyStateBtn"
              onClick={openNewProject}
            >
              + NEW PROJECT
            </button>
          </div>
          <AppModals />
        </>
      ) : (
        <>
          {/* -------- Mobile Panel Switcher -------- */}
          {responsiveMode && (
            <div className="mobilePanelSwitcher">
              <button
                type="button"
                className={`mobilePanelTab ${activeMobilePanel === "sidebar" ? "mobilePanelTabActive" : ""}`}
                onClick={() => setActiveMobilePanel("sidebar")}
              >
                Sessions
              </button>
              <button
                type="button"
                className={`mobilePanelTab ${activeMobilePanel === "terminal" ? "mobilePanelTabActive" : ""}`}
                onClick={() => setActiveMobilePanel("terminal")}
              >
                Terminal
              </button>
              <button
                type="button"
                className={`mobilePanelTab ${activeMobilePanel === "maestro" ? "mobilePanelTabActive" : ""}`}
                onClick={() => setActiveMobilePanel("maestro")}
              >
                Maestro
              </button>
            </div>
          )}

          {/* -------- App Content -------- */}
          <div className={`appContent ${responsiveMode ? "appContentResponsive" : ""}`}>
            {/* -------- Sidebar -------- */}
            <aside
              className="sidebar"
              ref={sidebarRef}
              style={responsiveMode
                ? { width: "100%", maxWidth: "100%", flexGrow: 1, display: activeMobilePanel === "sidebar" ? undefined : "none" }
                : {
                    width: `${sidebarWidth}px`,
                    maxWidth: `${sidebarWidth}px`,
                    flexGrow: 0,
                  }
              }
            >
              <QuickPromptsSection
              prompts={prompts}
              activeSessionId={activeId}
              onSendPrompt={(prompt) => void sendPromptToActive(prompt, "send")}
              onEditPrompt={openPromptEditor}
              onOpenPromptsPanel={() => {
                setSlidePanelTab("prompts");
                setSlidePanelOpen(true);
              }}
            />

            <SessionsSection
              agentShortcuts={agentShortcuts}
              sessions={projectSessions}
              activeSessionId={activeId}
              projectName={activeProject?.name ?? null}
              projectBasePath={activeProject?.basePath ?? null}
              onSelectSession={(id) => {
                setActiveId(id);
                if (responsiveMode) setActiveMobilePanel("terminal");
              }}
              onCloseSession={(id) => void onClose(id)}
              onReorderSessions={reorderSessions}
              onQuickStart={(effect) => {
                void quickStart({
                  id: effect.id,
                  title: effect.label,
                  command: effect.matchCommands[0] ?? effect.label,
                });
                if (responsiveMode) setActiveMobilePanel("terminal");
              }}
              onOpenNewSession={() => {
                setProjectOpen(false);
                setNewOpen(true);
              }}
              onOpenPersistentSessions={() => {
                setPersistentSessionsOpen(true);
                void refreshPersistentSessions();
              }}
              onOpenSshManager={openSshManager}
              onOpenAgentShortcuts={() => setAgentShortcutsOpen(true)}
              onOpenManageTerminals={() => setManageTerminalsOpen(true)}
            />
            </aside>

            {/* -------- Sidebar resize handle -------- */}
            {!responsiveMode && (
              <div
                className="sidebarRightResizeHandle"
                role="separator"
                aria-label="Resize Sidebar"
                aria-orientation="vertical"
                aria-valuemin={DEFAULTS.MIN_SIDEBAR_WIDTH}
                aria-valuemax={DEFAULTS.MAX_SIDEBAR_WIDTH}
                aria-valuenow={sidebarWidth}
                tabIndex={0}
                onPointerDown={handleSidebarResizePointerDown}
                title="Drag to resize"
              />
            )}

            {/* -------- Main content -------- */}
            <main
              className="main"
              style={responsiveMode
                ? { display: activeMobilePanel === "terminal" ? undefined : "none" }
                : undefined
              }
            >
              <div className="terminalArea">
                <AppWorkspace registry={registry} pendingData={pendingData} />
                <AppModals />
                <AppSlidePanel />
              </div>
            </main>

            {/* -------- Right Panel (Maestro) -------- */}
            {responsiveMode ? (
              activeMobilePanel === "maestro" && <AppRightPanel forceMobileOpen />
            ) : (
              <AppRightPanel />
            )}
          </div>
        </>
      )}

      {/* -------- Command Palette -------- */}
      <CommandPalette />
      <ConfirmActionModal
        isOpen={confirmCloseAppOpen}
        title="Close App and All Running Sessions?"
        message={(
          <div>
            <div>
              {`There ${runningSessionCount === 1 ? "is" : "are"} `}
              <strong>{runningSessionCount}</strong>
              {` running ${runningSessionCount === 1 ? "session" : "sessions"}. Closing the app will stop all of them.`}
            </div>
            <div style={{ marginTop: 10 }}>
              {runningSessionsByProject.map((group) => (
                <div key={group.projectId} style={{ marginBottom: 8 }}>
                  <strong>{group.projectName}</strong>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {group.sessions.map((session) => (
                      <li key={session.id}>{session.name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        confirmLabel="Close App"
        cancelLabel="Cancel"
        confirmDanger
        busy={confirmCloseAppBusy}
        onClose={() => {
          if (confirmCloseAppBusy) return;
          setConfirmCloseAppOpen(false);
        }}
        onConfirm={() => {
          void closeAppWithRunningSessions();
        }}
      />
    </div>
  );
}
