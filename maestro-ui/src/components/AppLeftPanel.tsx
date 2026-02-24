import React, { useCallback, useMemo, useRef } from "react";
import { IconRail } from "./IconRail";
import { MaestroPanel } from "./maestro/MaestroPanel";
import { FileExplorerPanel } from "./FileExplorerPanel";
import { PrimaryTab, TeamSubTab } from "./maestro/PanelIconBar";
import { useUIStore, IconRailSection } from "../stores/useUIStore";
import { useProjectStore } from "../stores/useProjectStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useWorkspaceStore, getActiveWorkspaceView } from "../stores/useWorkspaceStore";
import { useMaestroStore } from "../stores/useMaestroStore";
import { isSshCommandLine, sshTargetFromCommandLine } from "../app/utils/ssh";
import { createMaestroSession } from "../services/maestroService";
import { useTasks } from "../hooks/useTasks";
import * as DEFAULTS from "../app/constants/defaults";

function sectionToPrimaryTab(section: IconRailSection): PrimaryTab | null {
    switch (section) {
        case "tasks": return "tasks";
        case "members": return "team";
        case "teams": return "team";
        case "skills": return "skills";
        case "lists": return "lists";
        default: return null;
    }
}

function sectionToTeamSubTab(section: IconRailSection): TeamSubTab | undefined {
    switch (section) {
        case "members": return "members";
        case "teams": return "teams";
        default: return undefined;
    }
}

export const AppLeftPanel: React.FC = () => {
    const iconRailActiveSection = useUIStore((s) => s.iconRailActiveSection);
    const toggleIconRailSection = useUIStore((s) => s.toggleIconRailSection);
    const maestroSidebarWidth = useUIStore((s) => s.maestroSidebarWidth);
    const homeDir = useUIStore((s) => s.homeDir);

    // Project & session stores
    const projects = useProjectStore((s) => s.projects);
    const activeProjectId = useProjectStore((s) => s.activeProjectId);
    const activeProject = useMemo(
        () => projects.find((p) => p.id === activeProjectId) ?? null,
        [projects, activeProjectId],
    );

    const sessions = useSessionStore((s) => s.sessions);
    const activeId = useSessionStore((s) => s.activeId);
    const handleJumpToSessionFromTask = useSessionStore((s) => s.handleJumpToSessionFromTask);
    const handleAddTaskToSessionRequest = useSessionStore((s) => s.handleAddTaskToSessionRequest);
    const active = sessions.find((s) => s.id === activeId) ?? null;

    // SSH state
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

    // Workspace store
    const handleSelectWorkspaceFile = useWorkspaceStore((s) => s.handleSelectWorkspaceFile);
    const activeWorkspaceView = getActiveWorkspaceView();

    const fileExplorerRootDir =
        activeWorkspaceView.fileExplorerRootDir ??
        activeWorkspaceView.codeEditorRootDir ??
        activeProject?.basePath ??
        active?.cwd ??
        homeDir ??
        "";

    // Task/team counts for badges
    const { tasks } = useTasks(activeProjectId);
    const teamMembersMap = useMaestroStore((s) => s.teamMembers);
    const teamsMap = useMaestroStore((s) => s.teams);

    const taskCount = useMemo(
        () => tasks.filter((t) => t.status !== "completed" && t.status !== "archived").length,
        [tasks],
    );
    const memberCount = useMemo(
        () => Array.from(teamMembersMap.values()).filter((tm) => tm.projectId === activeProjectId && tm.status !== "archived").length,
        [teamMembersMap, activeProjectId],
    );
    const teamCount = useMemo(
        () => Array.from(teamsMap.values()).filter((t) => t.projectId === activeProjectId && t.status === "active").length,
        [teamsMap, activeProjectId],
    );

    const handleSectionChange = useCallback(
        (section: Exclude<IconRailSection, null>) => {
            toggleIconRailSection(section);
        },
        [toggleIconRailSection],
    );

    const isExpanded = iconRailActiveSection !== null;
    const forcedPrimaryTab = sectionToPrimaryTab(iconRailActiveSection);
    const forcedTeamSubTab = sectionToTeamSubTab(iconRailActiveSection);
    const showFiles = iconRailActiveSection === "files";
    const showMaestro = isExpanded && !showFiles;

    // Track whether MaestroPanel has ever been opened so we mount it once and keep it alive
    const hasMountedMaestroRef = useRef(false);
    if (showMaestro && activeProject) hasMountedMaestroRef.current = true;
    const keepMaestroMounted = hasMountedMaestroRef.current && !!activeProject;

    const handleClose = useCallback(
        () => useUIStore.getState().setIconRailActiveSection(null),
        [],
    );

    return (
        <div
            className={`appLeftPanel ${isExpanded ? "appLeftPanel--expanded" : ""}`}
            style={{
                width: isExpanded
                    ? `${DEFAULTS.ICON_RAIL_WIDTH + maestroSidebarWidth}px`
                    : `${DEFAULTS.ICON_RAIL_WIDTH}px`,
            }}
        >
            <IconRail
                activeSection={iconRailActiveSection}
                onSectionChange={handleSectionChange}
                taskCount={taskCount}
                memberCount={memberCount}
                teamCount={teamCount}
            />

            {/* Always-mounted content pane — hidden via CSS when collapsed */}
            <div
                className="appLeftPanelContent"
                style={{
                    width: `${maestroSidebarWidth}px`,
                    display: isExpanded ? undefined : 'none',
                }}
            >
                {/* MaestroPanel stays mounted once opened — avoids expensive remount */}
                {keepMaestroMounted && (
                    <div style={{ display: showMaestro ? undefined : 'none', width: '100%', height: '100%' }}>
                        <MaestroPanel
                            isOpen={showMaestro}
                            onClose={handleClose}
                            projectId={activeProjectId}
                            project={activeProject!}
                            onCreateMaestroSession={createMaestroSession}
                            onJumpToSession={handleJumpToSessionFromTask}
                            onAddTaskToSession={handleAddTaskToSessionRequest}
                            forcedPrimaryTab={forcedPrimaryTab ?? undefined}
                            forcedTeamSubTab={forcedTeamSubTab}
                        />
                    </div>
                )}

                {showFiles && (
                    <FileExplorerPanel
                        isOpen={true}
                        provider={activeIsSsh ? "ssh" : "local"}
                        sshTarget={activeIsSsh ? activeSshTarget : null}
                        rootDir={fileExplorerRootDir}
                        activeFilePath={activeWorkspaceView.codeEditorActiveFilePath}
                        onSelectFile={handleSelectWorkspaceFile}
                        onClose={handleClose}
                    />
                )}
            </div>
        </div>
    );
};
