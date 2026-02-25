import React, { useState } from "react";
import { TeamListItem } from "../TeamListItem";
import { TeamModal } from "../TeamModal";

type TeamsPanelProps = {
    projectId: string;
    teams: any[];
    topLevelTeams: any[];
    onEdit: (team: any) => void;
    onRun: (team: any) => void;
};

export function TeamsPanel({
    projectId,
    teams,
    topLevelTeams,
    onEdit,
    onRun,
}: TeamsPanelProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<any | null>(null);

    const handleEdit = (team: any) => {
        setEditingTeam(team);
        setShowModal(true);
        onEdit(team);
    };

    const handleNewTeam = () => {
        setEditingTeam(null);
        setShowModal(true);
    };

    return (
        <>
            <div className="terminalContent">
                {topLevelTeams.length === 0 ? (
                    <div className="terminalEmptyState">
                        <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║       NO TEAMS YET                    ║
    ║                                       ║
    ║    Create teams to group your         ║
    ║    team members together              ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
                                        `}</pre>
                        <button
                            className="themedBtn themedBtnPrimary"
                            style={{ marginTop: '8px' }}
                            onClick={handleNewTeam}
                        >
                            + Create Team
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '6px 12px 2px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="themedBtn themedBtnPrimary"
                                style={{ padding: '3px 10px', fontSize: '10px' }}
                                onClick={handleNewTeam}
                            >
                                + Create Team
                            </button>
                        </div>
                        <div className="terminalTaskList">
                            {topLevelTeams.map(team => (
                                <TeamListItem
                                    key={team.id}
                                    team={team}
                                    depth={0}
                                    onEdit={handleEdit}
                                    onRun={onRun}
                                    allTeams={teams}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <TeamModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingTeam(null);
                }}
                team={editingTeam}
                projectId={projectId}
            />
        </>
    );
}
