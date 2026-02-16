import React from "react";
import { MaestroTask } from "../../app/types/maestro";

type TeamMemberListProps = {
    teamMembers: MaestroTask[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
};

export function TeamMemberList({
    teamMembers,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onDeselectAll,
}: TeamMemberListProps) {
    if (teamMembers.length === 0) {
        return (
            <div className="teamMemberList teamMemberList--empty">
                <span className="teamMemberListHint">
                    No team members yet. Create one with <strong>$ new team member</strong>
                </span>
            </div>
        );
    }

    const allSelected = teamMembers.every(m => selectedIds.has(m.id));

    return (
        <div className="teamMemberList">
            <div className="teamMemberListHeader">
                <span className="teamMemberListLabel">TEAM MEMBERS</span>
                <button
                    className="terminalCmd"
                    style={{ padding: '1px 6px', fontSize: '10px' }}
                    onClick={allSelected ? onDeselectAll : onSelectAll}
                >
                    {allSelected ? 'deselect all' : 'select all'}
                </button>
            </div>
            <div className="teamMemberListItems">
                {teamMembers.map(member => {
                    const meta = member.teamMemberMetadata;
                    const isSelected = selectedIds.has(member.id);
                    return (
                        <div
                            key={member.id}
                            className={`teamMemberItem ${isSelected ? 'teamMemberItem--selected' : ''}`}
                            onClick={() => onToggleSelect(member.id)}
                        >
                            <span className="teamMemberCheckbox">
                                {isSelected ? '[x]' : '[ ]'}
                            </span>
                            <span className="teamMemberAvatar">
                                {meta?.avatar || '?'}
                            </span>
                            <span className="teamMemberName">
                                {member.title}
                            </span>
                            <span className="teamMemberRole">
                                {meta?.role || ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
