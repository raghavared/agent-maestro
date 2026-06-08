import React, { useCallback, useState } from "react";
import { SessionsSection } from "./SessionsSection";
import { SpacesRail } from "./SpacesRail";
import { NewSpaceDropdown } from "./NewSpaceDropdown";
import { ResourcesView } from "./ResourcesView";
import type { ProcessEffect } from "../processEffects";
import * as DEFAULTS from "../app/constants/defaults";
import { useSpacesStore } from "../stores/useSpacesStore";
import { useSessionStore } from "../stores/useSessionStore";
import { isWhiteboardId, isDocumentId, isFileId } from "../app/types/space";
import { maestroClient } from "../utils/MaestroClient";

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
    const [panelMode, setPanelMode] = useState<'sessions' | 'resources'>('sessions');
    const createWhiteboard = useSpacesStore((s) => s.createWhiteboard);
    const closeWhiteboard = useSpacesStore((s) => s.closeWhiteboard);
    const closeDocument = useSpacesStore((s) => s.closeDocument);
    const closeFile = useSpacesStore((s) => s.closeFile);
    const setActiveId = useSessionStore((s) => s.setActiveId);

    const handleCreateWhiteboard = useCallback(async () => {
        const activeSess = sessions.find((s: any) => s.id === activeSessionId);
        const maestroSessionId: string | undefined = activeSess?.maestroSessionId;
        if (maestroSessionId) {
            try {
                const title = `Whiteboard ${new Date().toLocaleDateString()}`;
                const doc = await maestroClient.addSessionDoc(maestroSessionId, title, '{}', 'diagram');
                const id = createWhiteboard(activeProjectId, title, undefined, doc.id, maestroSessionId);
                setActiveId(id);
                return;
            } catch {
                // fall through to localStorage-only whiteboard
            }
        }
        const id = createWhiteboard(activeProjectId);
        setActiveId(id);
    }, [sessions, activeSessionId, activeProjectId, createWhiteboard, setActiveId]);

    const handleOpenResources = useCallback(() => {
        setPanelMode('resources');
        if (!isExpanded) onToggle();
    }, [isExpanded, onToggle]);

    const handleCloseSpace = (id: string) => {
        if (isWhiteboardId(id)) {
            closeWhiteboard(id);
        } else if (isDocumentId(id)) {
            closeDocument(id);
        } else if (isFileId(id)) {
            closeFile(id);
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
                        <div className="spacesPanelTabs">
                            <button
                                type="button"
                                className={`spacesPanelTab ${panelMode === 'sessions' ? 'spacesPanelTab--active' : ''}`}
                                onClick={() => setPanelMode('sessions')}
                            >
                                Sessions
                            </button>
                            <button
                                type="button"
                                className={`spacesPanelTab ${panelMode === 'resources' ? 'spacesPanelTab--active' : ''}`}
                                onClick={() => setPanelMode('resources')}
                                data-testid="resources-tab-btn"
                            >
                                Resources
                            </button>
                        </div>
                        <div className="spacesPanelActions">
                            {panelMode === 'sessions' && (
                                <NewSpaceDropdown
                                    variant="toolbar"
                                    onOpenNewSession={onOpenNewSession}
                                    onOpenWhiteboard={handleCreateWhiteboard}
                                    agentShortcuts={agentShortcuts}
                                    onQuickStart={onQuickStart}
                                />
                            )}
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

                    {panelMode === 'sessions' ? (
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
                    ) : (
                        <ResourcesView projectId={activeProjectId} />
                    )}
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
                    onOpenResources={handleOpenResources}
                    onCloseSpace={handleCloseSpace}
                    agentShortcuts={agentShortcuts}
                    onQuickStart={onQuickStart}
                />
            )}
        </aside>
    );
};
