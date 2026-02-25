import React, { useState } from "react";
import { TeamMember } from "../../../app/types/maestro";
import { TeamMemberList } from "../TeamMemberList";
import { TeamMemberModal } from "../TeamMemberModal";

type TeamMembersPanelProps = {
    projectId: string;
    teamMembers: TeamMember[];
    teamMembersLoading: boolean;
    onEdit: (member: any) => void;
    onArchive: (memberId: string) => void;
    onUnarchive: (memberId: string) => void;
    onDelete: (memberId: string) => void;
    onRun: (member: any) => void;
};

export function TeamMembersPanel({
    projectId,
    teamMembers,
    teamMembersLoading,
    onEdit,
    onArchive,
    onUnarchive,
    onDelete,
    onRun,
}: TeamMembersPanelProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<any | null>(null);

    const handleEdit = (member: any) => {
        setEditingMember(member);
        setShowModal(true);
        onEdit(member);
    };

    const handleNewMember = () => {
        setEditingMember(null);
        setShowModal(true);
    };

    return (
        <>
            <div className="terminalContent">
                {teamMembersLoading && teamMembers.length === 0 ? (
                    <div className="terminalLoadingState">
                        <div className="terminalSpinner">
                            <span className="terminalSpinnerDot">●</span>
                            <span className="terminalSpinnerDot">●</span>
                            <span className="terminalSpinnerDot">●</span>
                        </div>
                        <p className="terminalLoadingText">
                            <span className="terminalCursor">█</span> Loading team members...
                        </p>
                    </div>
                ) : (
                    <TeamMemberList
                        teamMembers={teamMembers}
                        onEdit={handleEdit}
                        onArchive={onArchive}
                        onUnarchive={onUnarchive}
                        onDelete={onDelete}
                        onNewMember={handleNewMember}
                        onRun={onRun}
                    />
                )}
            </div>

            <TeamMemberModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingMember(null);
                }}
                teamMember={editingMember}
                projectId={projectId}
            />
        </>
    );
}
