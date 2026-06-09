import React, { useMemo } from "react";
import { getProcessEffectById } from "../processEffects";
import type { ProcessEffect } from "../processEffects";
import { useMaestroStore } from "../stores/useMaestroStore";
import { useSpacesStore } from "../stores/useSpacesStore";
import { useProjectStore } from "../stores/useProjectStore";
import { buildTeamGroups, getGroupedSessionOrder } from "../utils/teamGrouping";
import { NewSpaceDropdown } from "./NewSpaceDropdown";
import { Icon } from "./maestro/redesign/kit";

type RailSession = {
    id: string;
    name: string;
    effectId?: string | null;
    agentWorking?: boolean;
    exited?: boolean;
    closing?: boolean;
    maestroSessionId?: string | null;
};

type SpacesRailProps = {
    sessions: RailSession[];
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onToggle: () => void;
    onOpenNewSession?: () => void;
    onOpenWhiteboard?: () => void;
    onOpenResources?: () => void;
    onCloseSpace?: (id: string) => void;
    agentShortcuts?: ProcessEffect[];
    onQuickStart?: (effect: ProcessEffect) => void;
};

function getSessionInitial(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed[0].toUpperCase();
}

function RailSessionButton({
    session,
    isActive,
    onSelect,
    maestroSessions,
}: {
    session: RailSession;
    isActive: boolean;
    onSelect: () => void;
    maestroSessions: Record<string, any>;
}) {
    const effect = getProcessEffectById(session.effectId);
    const isWorking = Boolean(effect && session.agentWorking && !session.exited && !session.closing);
    const isExited = Boolean(session.exited || session.closing);

    const maestroSession = session.maestroSessionId ? maestroSessions[session.maestroSessionId] ?? null : null;
    const needsInput = Boolean(maestroSession?.needsInput?.active);
    const isTerminal = !effect?.iconSrc && !session.maestroSessionId;

    return (
        <button
            className={`pn-srail-s ${isActive ? "pn-srail-s--active" : ""} ${isExited ? "pn-srail-s--exited" : ""} ${isTerminal ? "pn-agent--term" : ""}`}
            onClick={onSelect}
            title={session.name}
            type="button"
            {...(session.maestroSessionId ? { 'data-maestro-session-id': session.maestroSessionId } : {})}
        >
            {effect?.iconSrc ? (
                <img src={effect.iconSrc} alt={effect.label} />
            ) : session.maestroSessionId ? (
                <span>{getSessionInitial(session.name)}</span>
            ) : (
                <>&gt;_</>
            )}
            {isWorking && <span className="pn-srail-pulse" />}
            {needsInput && <span className="pn-srail-wait" />}
        </button>
    );
}

export const SpacesRail: React.FC<SpacesRailProps> = ({
    sessions,
    activeSessionId,
    onSelectSession,
    onToggle,
    onOpenNewSession,
    onOpenWhiteboard,
    onOpenResources,
    onCloseSpace,
    agentShortcuts,
    onQuickStart,
}) => {
    const maestroSessions = useMaestroStore((s) => s.sessions);
    const teamsMap = useMaestroStore((s) => s.teams);
    const activeProjectId = useProjectStore((s) => s.activeProjectId);
    const allSpaces = useSpacesStore((s) => s.spaces);
    const spaces = useMemo(
        () => allSpaces.filter((s) => s.projectId === activeProjectId),
        [allSpaces, activeProjectId],
    );

    const teamGroupData = useMemo(() => {
        return buildTeamGroups(sessions, maestroSessions, teamsMap);
    }, [sessions, maestroSessions, teamsMap]);

    const { grouped, ungrouped } = useMemo(() => {
        return getGroupedSessionOrder(sessions, teamGroupData.groups);
    }, [sessions, teamGroupData.groups]);

    const totalCount = sessions.length + spaces.length;

    return (
        <div className="pn-srail" style={{ width: "100%" }}>
            {/* Plus button at the very top — shared dropdown */}
            <NewSpaceDropdown
                variant="rail"
                onOpenNewSession={onOpenNewSession}
                onOpenWhiteboard={onOpenWhiteboard}
                agentShortcuts={agentShortcuts}
                onQuickStart={onQuickStart}
            />

            {/* Expand/collapse panel button */}
            <button
                className="pn-srail-s"
                onClick={onToggle}
                title="Expand Spaces"
                type="button"
            >
                <Icon name="grid" />
                {totalCount > 0 && (
                    <span className="pn-rail-badge">{totalCount > 99 ? "99+" : totalCount}</span>
                )}
            </button>

            <div className="pn-rail-div" />

            {onOpenResources && (
                <button
                    className="pn-srail-s"
                    onClick={onOpenResources}
                    title="Project Resources"
                    type="button"
                    data-testid="rail-resources-btn"
                >
                    <Icon name="layers" />
                </button>
            )}

            <div className="pn-rail-div" />

            {/* Per-session icons — flat avatar stack (team color stays in the panel) */}
            <div className="spacesRailSessions">
                {grouped.map(({ sessions: groupSessions }) =>
                    groupSessions.map((session) => (
                        <RailSessionButton
                            key={session.id}
                            session={session}
                            isActive={session.id === activeSessionId}
                            onSelect={() => onSelectSession(session.id)}
                            maestroSessions={maestroSessions}
                        />
                    )),
                )}

                {ungrouped.map((session) => (
                    <RailSessionButton
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onSelect={() => onSelectSession(session.id)}
                        maestroSessions={maestroSessions}
                    />
                ))}

                {/* Whiteboard & file space buttons — docs/drawings are now overlays */}
                {spaces.filter((s) => s.type !== "document").map((space) => (
                    <button type="button"
                        key={space.id}
                        className={`pn-srail-s ${space.id === activeSessionId ? "pn-srail-s--active" : ""}`}
                        onClick={() => onSelectSession(space.id)}
                        title={space.name}
                    >
                        <Icon name={space.type === "whiteboard" ? "pen" : "doc"} />
                    </button>
                ))}
            </div>
        </div>
    );
};
