import React from "react";
import { SessionsSection } from "./SessionsSection";
import { SpacesRail } from "./SpacesRail";
import { NewSpaceDropdown } from "./NewSpaceDropdown";
import type { ProcessEffect } from "../processEffects";
import * as DEFAULTS from "../app/constants/defaults";
import { useSpacesStore } from "../stores/useSpacesStore";
import { useSessionStore } from "../stores/useSessionStore";
import { isWhiteboardId, isDocumentId } from "../app/types/space";

type SpacesPanelProps = {
    agentShortcuts: ProcessEffect[];
    sessions: any[];
    activeSessionId: string | null;
    activeProjectId: string;
    projectName: string | null;
    projectBasePath: string | null;
    onSelectSession: (sessionId: string) => void;
    onCloseSession: (sessionId: string) => void;
    onReorderSessions: (draggedPersistId: string, targetPersistId: string) => void;
    onQuickStart: (effect: ProcessEffect) => void;
    onOpenNewSession: () => void;
    onOpenAgentShortcuts: () => void;
    onOpenPersistentSessions: () => void;
    onOpenSshManager: () => void;
    onOpenManageTerminals: () => void;
    contentWidth: number;
    activeSection: 'sessions' | null;
    onToggle: () => void;
};

export const SpacesPanel: React.FC<SpacesPanelProps> = ({
    agentShortcuts,
    sessions,
    activeSessionId,
    activeProjectId,
    projectName,
    projectBasePath,
    onSelectSession,
    onCloseSession,
    onReorderSessions,
    onQuickStart,
    onOpenNewSession,
    onOpenAgentShortcuts,
    onOpenPersistentSessions,
    onOpenSshManager,
    onOpenManageTerminals,
    contentWidth,
    activeSection,
    onToggle,
}) => {
    const isExpanded = activeSection !== null;
    const createWhiteboard = useSpacesStore((s) => s.createWhiteboard);
    const closeWhiteboard = useSpacesStore((s) => s.closeWhiteboard);
    const closeDocument = useSpacesStore((s) => s.closeDocument);
    const setActiveId = useSessionStore((s) => s.setActiveId);

    const handleCreateWhiteboard = () => {
        const id = createWhiteboard(activeProjectId);
        setActiveId(id);
    };

    const handleCloseSpace = (id: string) => {
        if (isWhiteboardId(id)) {
            closeWhiteboard(id);
        } else if (isDocumentId(id)) {
            closeDocument(id);
        }
        // If the closed space was active, switch to first session
        if (id === activeSessionId) {
            if (sessions.length > 0) {
                setActiveId(sessions[0].id);
            } else {
                setActiveId(null);
            }
        }
    };

    return (
        <aside
            className={`spacesPanel ${isExpanded ? 'spacesPanel--expanded' : ''}`}
            style={{
                width: isExpanded
                    ? `${contentWidth}px`
                    : `${DEFAULTS.SPACES_RAIL_WIDTH}px`,
                maxWidth: isExpanded
                    ? `${contentWidth}px`
                    : `${DEFAULTS.SPACES_RAIL_WIDTH}px`,
                flexShrink: 0,
                flexGrow: 0,
            }}
        >
            {isExpanded ? (
                <div
                    className="spacesPanelContent"
                    style={{ width: `${contentWidth}px` }}
                >
                    <div className="spacesPanelToolbar">
                        <span className="spacesPanelTitle">Spaces</span>
                        <div className="spacesPanelActions">
                            <NewSpaceDropdown
                                variant="toolbar"
                                onOpenNewSession={onOpenNewSession}
                                onOpenWhiteboard={handleCreateWhiteboard}
                                agentShortcuts={agentShortcuts}
                                onQuickStart={onQuickStart}
                            />
                            <button
                                className="spacesPanelAction"
                                title="Collapse Panel"
                                type="button"
                                onClick={onToggle}
                            >
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                                    <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <SessionsSection
                        agentShortcuts={agentShortcuts}
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        activeProjectId={activeProjectId}
                        projectName={projectName}
                        projectBasePath={projectBasePath}
                        onSelectSession={onSelectSession}
                        onCloseSession={onCloseSession}
                        onReorderSessions={onReorderSessions}
                        onQuickStart={onQuickStart}
                        onOpenNewSession={onOpenNewSession}
                        onOpenAgentShortcuts={onOpenAgentShortcuts}
                        onOpenPersistentSessions={onOpenPersistentSessions}
                        onOpenSshManager={onOpenSshManager}
                        onOpenManageTerminals={onOpenManageTerminals}
                        onCreateWhiteboard={handleCreateWhiteboard}
                        onCloseSpace={handleCloseSpace}
                    />
                </div>
            ) : (
                <SpacesRail
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelectSession={(id) => {
                        onSelectSession(id);
                    }}
                    onToggle={onToggle}
                    onOpenNewSession={onOpenNewSession}
                    onOpenWhiteboard={handleCreateWhiteboard}
                    onCloseSpace={handleCloseSpace}
                    agentShortcuts={agentShortcuts}
                    onQuickStart={onQuickStart}
                />
            )}
        </aside>
    );
};
