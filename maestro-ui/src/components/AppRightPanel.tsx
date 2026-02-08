import React, { useCallback } from "react";
import { MaestroPanel } from "./maestro/MaestroPanel";
import { FileExplorerPanel } from "./FileExplorerPanel";
import * as DEFAULTS from "../app/constants/defaults";
import { useUIStore } from "../stores/useUIStore";
import { useProjectStore } from "../stores/useProjectStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useWorkspaceStore, getActiveWorkspaceView } from "../stores/useWorkspaceStore";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";
import { createMaestroSession } from "../services/maestroService";

export const AppRightPanel: React.FC = () => {
    // --- UI store ---
    const activeRightPanel = useUIStore((s) => s.activeRightPanel);
    const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
    const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
    const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
    const persistRightPanelWidth = useUIStore((s) => s.persistRightPanelWidth);
    const homeDir = useUIStore((s) => s.homeDir);

    // --- Project store ---
    const projects = useProjectStore((s) => s.projects);
    const activeProjectId = useProjectStore((s) => s.activeProjectId);
    const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

    // --- Session store ---
    const sessions = useSessionStore((s) => s.sessions);
    const activeId = useSessionStore((s) => s.activeId);
    const handleJumpToSessionFromTask = useSessionStore((s) => s.handleJumpToSessionFromTask);
    const handleAddTaskToSessionRequest = useSessionStore((s) => s.handleAddTaskToSessionRequest);
    const active = sessions.find((s) => s.id === activeId) ?? null;

    // --- Derived SSH ---
    const activeIsSsh = active
        ? isSshCommandLine(active.launchCommand ?? active.restoreCommand ?? null)
        : false;
    const activeSshTarget = (() => {
        if (!active) return null;
        if (!activeIsSsh) return null;
        const stored = active.sshTarget?.trim() ?? "";
        if (stored) return stored;
        return sshTargetFromCommandLine(active.launchCommand ?? active.restoreCommand ?? null);
    })();

    // --- Workspace store ---
    const handleSelectWorkspaceFile = useWorkspaceStore((s) => s.handleSelectWorkspaceFile);
    const activeWorkspaceView = getActiveWorkspaceView();

    // --- File explorer root dir ---
    const fileExplorerRootDir =
        activeWorkspaceView.fileExplorerRootDir ??
        activeWorkspaceView.codeEditorRootDir ??
        activeProject?.basePath ??
        active?.cwd ??
        homeDir ??
        "";

    // --- Resize handler (uses CSS variables during drag for performance) ---
    const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only handle primary button
        e.preventDefault();

        const pointerId = e.pointerId;
        const target = e.currentTarget;
        const startX = e.clientX;
        const startWidth = rightPanelWidth;

        // Save previous styles
        const prevCursor = document.body.style.cursor;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        // Add resizing class for CSS optimizations (will-change, pointer-events)
        document.documentElement.classList.add("right-panel-resizing");

        try {
            target.setPointerCapture(pointerId);
        } catch {
            // ignore
        }

        let current = startWidth;

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            // Right panel grows to the left, so subtract delta
            const delta = startX - moveEvent.clientX;
            current = Math.min(
                DEFAULTS.MAX_RIGHT_PANEL_WIDTH,
                Math.max(DEFAULTS.MIN_RIGHT_PANEL_WIDTH, startWidth + delta),
            );
            // Use CSS variable for smooth drag - bypasses React re-renders
            document.documentElement.style.setProperty("--right-panel-width-live", `${current}px`);
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            if (upEvent.pointerId !== pointerId) return;

            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("pointercancel", onPointerUp);

            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevUserSelect;
            document.documentElement.classList.remove("right-panel-resizing");
            document.documentElement.style.removeProperty("--right-panel-width-live");

            try {
                target.releasePointerCapture(pointerId);
            } catch {
                // ignore
            }

            // Sync final value to React state
            setRightPanelWidth(current);
            persistRightPanelWidth(current);
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("pointercancel", onPointerUp);
    }, [rightPanelWidth, setRightPanelWidth, persistRightPanelWidth]);

    // --- Close handler ---
    const onClose = useCallback(
        () => setActiveRightPanel("none"),
        [setActiveRightPanel],
    );

    if (activeRightPanel === "none") return null;

    return (
        <>
            <div
                className="sidebarLeftResizeHandle"
                role="separator"
                aria-label="Resize Right Panel"
                aria-orientation="vertical"
                aria-valuemin={DEFAULTS.MIN_RIGHT_PANEL_WIDTH}
                aria-valuemax={DEFAULTS.MAX_RIGHT_PANEL_WIDTH}
                aria-valuenow={rightPanelWidth}
                tabIndex={0}
                onPointerDown={onResizeStart}
                title="Drag to resize"
            />
            <aside
                className="rightPanel"
                style={{ width: `${rightPanelWidth}px`, maxWidth: `${rightPanelWidth}px`, flexShrink: 0, flexGrow: 0 }}
            >
                {activeRightPanel === "maestro" && activeProject && (
                    <MaestroPanel
                        isOpen={true}
                        onClose={onClose}
                        projectId={activeProjectId}
                        project={activeProject}
                        onCreateMaestroSession={createMaestroSession}
                        onJumpToSession={handleJumpToSessionFromTask}
                        onAddTaskToSession={handleAddTaskToSessionRequest}
                    />
                )}
                {activeRightPanel === "files" && (
                    <FileExplorerPanel
                        isOpen={true}
                        provider={activeIsSsh ? "ssh" : "local"}
                        sshTarget={activeIsSsh ? activeSshTarget : null}
                        rootDir={fileExplorerRootDir}
                        activeFilePath={activeWorkspaceView.codeEditorActiveFilePath}
                        onSelectFile={handleSelectWorkspaceFile}
                        onClose={onClose}
                    />
                )}
            </aside>
        </>
    );
};
