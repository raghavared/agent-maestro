import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Team } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { ConfirmActionModal } from "../modals/ConfirmActionModal";

type TeamTab = 'members' | 'subteams' | 'details';

type TeamListItemProps = {
    team: Team;
    depth?: number;
    onEdit: (team: Team) => void;
    onRun: (team: Team) => void;
    allTeams: Team[];
};

function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatTimeAgo(timestamp: string): string {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export function TeamListItem({
    team,
    depth = 0,
    onEdit,
    onRun,
    allTeams,
}: TeamListItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<TeamTab>('members');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [childrenCollapsed, setChildrenCollapsed] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const archiveTeam = useMaestroStore(s => s.archiveTeam);
    const unarchiveTeam = useMaestroStore(s => s.unarchiveTeam);
    const deleteTeam = useMaestroStore(s => s.deleteTeam);

    const leader = teamMembersMap.get(team.leaderId);
    const members = useMemo(() =>
        team.memberIds.map(id => teamMembersMap.get(id)).filter(Boolean),
        [team.memberIds, teamMembersMap]
    );
    const subTeams = useMemo(() =>
        allTeams.filter(t => team.subTeamIds.includes(t.id)),
        [allTeams, team.subTeamIds]
    );
    const isArchived = team.status === 'archived';
    const hasSubTeams = subTeams.length > 0;

    const handleArchiveToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (isArchived) {
                await unarchiveTeam(team.id, team.projectId);
            } else {
                await archiveTeam(team.id, team.projectId);
            }
        } catch {}
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteTeam(team.id, team.projectId);
            setShowDeleteConfirm(false);
        } catch {} finally {
            setIsDeleting(false);
        }
    };

    const handleCopyField = useCallback((label: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(label);
            setTimeout(() => setCopiedField(null), 1500);
        }).catch(() => {});
    }, []);

    const handleSubTeamToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setChildrenCollapsed(!childrenCollapsed);
    };

    return (
        <>
            <div
                className={`terminalTaskRow ${isArchived ? 'terminalTaskRow--cancelled' : 'terminalTaskRow--in_progress'} ${depth > 0 ? 'terminalTaskRow--subtask' : ''}`}
                style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
            >
                <div className="terminalTeamMain" onClick={() => setIsExpanded(!isExpanded)}>
                    {/* Row 1: Avatar + Team name (bold) */}
                    <div className="terminalTeamMain__titleRow">
                        <span className="terminalTeamAvatar">
                            {team.avatar || '\u{1F46A}'}
                        </span>
                        <span className="terminalTeamName" title={team.name}>{team.name}</span>
                    </div>

                    {/* Row 2: Meta badges + action buttons */}
                    <div className="terminalTeamMain__metaRow">
                        {/* Sub-team expand/collapse button */}
                        <button
                            className={`terminalSubtaskBtn ${hasSubTeams ? (childrenCollapsed ? 'terminalSubtaskBtn--collapsed' : 'terminalSubtaskBtn--expanded') : 'terminalSubtaskBtn--empty'}`}
                            onClick={handleSubTeamToggle}
                            title={hasSubTeams ? (childrenCollapsed ? `Expand ${subTeams.length} sub-team${subTeams.length !== 1 ? 's' : ''}` : `Collapse sub-teams`) : "No sub-teams"}
                        >
                            <span className="terminalSubtaskIcon">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M4 3v6c0 1 .5 1.5 1.5 1.5H8" />
                                    <path d="M4 6.5h3.5c1 0 1.5.5 1.5 1.5v0" />
                                </svg>
                            </span>
                            {subTeams.length > 0 && (
                                <span className="terminalSubtaskCount">{subTeams.length}</span>
                            )}
                        </button>

                        <span className={`terminalMetaBadge terminalMetaBadge--status terminalMetaBadge--status-${isArchived ? 'archived' : 'in_progress'}`}>
                            {isArchived ? '▫ Archived' : '◉ Active'}
                        </span>

                        <span className="terminalMetaBadge">
                            {team.memberIds.length} member{team.memberIds.length !== 1 ? 's' : ''}
                        </span>

                        {leader && (
                            <span className="terminalMetaBadge terminalMetaBadge--agent terminalTeamInlineBadge">
                                {leader.avatar} {leader.name}
                            </span>
                        )}

                        <span className="terminalTimeAgo">{formatTimeAgo(team.updatedAt)}</span>

                        {/* Spacer to push actions right */}
                        <span className="terminalTeamMain__spacer" />

                        {/* Action buttons */}
                        <div className="terminalTaskActions">
                            <button
                                className="terminalEditBtn terminalTeamEditBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(team);
                                }}
                                title="Edit team"
                            >
                                Edit
                            </button>

                            <button
                                className="terminalSplitPlay__play"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRun(team);
                                }}
                                title="Run team (spawn coordinator session)"
                            >
                                &#9654;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="terminalTaskExpanded">
                        {/* Tab Navigation */}
                        <div className="terminalTaskTabs" onClick={(e) => e.stopPropagation()}>
                            <button
                                className={`terminalTaskTab ${activeTab === 'members' ? 'terminalTaskTab--active' : ''}`}
                                onClick={() => setActiveTab('members')}
                            >
                                [Members]
                            </button>
                            <button
                                className={`terminalTaskTab ${activeTab === 'subteams' ? 'terminalTaskTab--active' : ''}`}
                                onClick={() => setActiveTab('subteams')}
                            >
                                [Sub-Teams{subTeams.length > 0 ? ` (${subTeams.length})` : ''}]
                            </button>
                            <button
                                className={`terminalTaskTab ${activeTab === 'details' ? 'terminalTaskTab--active' : ''}`}
                                onClick={() => setActiveTab('details')}
                            >
                                [Details]
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="terminalTaskTabContent" onClick={(e) => e.stopPropagation()}>
                            {/* Members Tab */}
                            {activeTab === 'members' && (
                                <div className="terminalTabPane terminalTabPane--sessions">
                                    {members.length === 0 ? (
                                        <div className="terminalEmptyState">No members in this team</div>
                                    ) : (
                                        <div className="terminalSessionsList">
                                            {members.map(member => {
                                                if (!member) return null;
                                                const isLeader = member.id === team.leaderId;
                                                return (
                                                    <div
                                                        key={member.id}
                                                        className="terminalTeamMemberRow"
                                                    >
                                                        <span className="terminalTeamMemberRow__avatar">{member.avatar}</span>
                                                        <span className={`terminalTeamMemberRow__name ${isLeader ? 'terminalTeamMemberRow__name--leader' : ''}`}>
                                                            {member.name}
                                                        </span>
                                                        <span className="terminalMetaBadge terminalTeamMemberRow__badge">
                                                            {member.role}
                                                        </span>
                                                        {member.mode && (
                                                            <span className={`terminalMetaBadge terminalTeamMemberRow__badge terminalMetaBadge--status-${member.mode === 'coordinator' || member.mode === 'coordinated-coordinator' || (member.mode as string) === 'coordinate' ? 'in_review' : 'in_progress'}`}>
                                                                {member.mode}
                                                            </span>
                                                        )}
                                                        {isLeader && (
                                                            <span className="terminalMetaBadge terminalTeamMemberRow__badge terminalMetaBadge--priority terminalMetaBadge--priority-high">
                                                                &#9733; Leader
                                                            </span>
                                                        )}
                                                        {member.agentTool && (
                                                            <span className="terminalMetaBadge terminalTeamMemberRow__badge terminalTeamMemberRow__badge--dim">
                                                                {member.agentTool}
                                                            </span>
                                                        )}
                                                        {member.model && (
                                                            <span className="terminalMetaBadge terminalTeamMemberRow__badge terminalMetaBadge--model">
                                                                {member.model}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub-Teams Tab */}
                            {activeTab === 'subteams' && (
                                <div className="terminalTabPane">
                                    {subTeams.length === 0 ? (
                                        <div className="terminalEmptyState">No sub-teams</div>
                                    ) : (
                                        <div className="terminalTaskList terminalTeamSubTeamsList">
                                            {subTeams.map(subTeam => (
                                                <TeamListItem
                                                    key={subTeam.id}
                                                    team={subTeam}
                                                    depth={depth + 1}
                                                    onEdit={onEdit}
                                                    onRun={onRun}
                                                    allTeams={allTeams}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Details Tab */}
                            {activeTab === 'details' && (
                                <div className="terminalTabPane terminalTabPane--details">
                                    <div className="terminalDetailGrid">
                                        {team.description && (
                                            <div className="terminalDetailRow">
                                                <span className="terminalDetailLabel">Description:</span>
                                                <span className="terminalDetailValue">{team.description}</span>
                                            </div>
                                        )}
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Created:</span>
                                            <span className="terminalDetailValue">{formatDate(team.createdAt)}</span>
                                        </div>
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Updated:</span>
                                            <span className="terminalDetailValue">{formatDate(team.updatedAt)}</span>
                                        </div>
                                        <div className="terminalDetailRow">
                                            <span className="terminalDetailLabel">Team ID:</span>
                                            <span className="terminalDetailValue" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <code style={{ fontSize: '10px', opacity: 0.8 }}>{team.id}</code>
                                                <button
                                                    className="terminalCopyBtn"
                                                    onClick={() => handleCopyField('id', team.id)}
                                                    style={{ fontSize: '9px', padding: '1px 4px' }}
                                                >
                                                    {copiedField === 'id' ? 'Copied!' : 'Copy'}
                                                </button>
                                            </span>
                                        </div>
                                        {team.parentTeamId && (
                                            <div className="terminalDetailRow">
                                                <span className="terminalDetailLabel">Parent Team:</span>
                                                <span className="terminalDetailValue">
                                                    {allTeams.find(t => t.id === team.parentTeamId)?.name || team.parentTeamId}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions Bar at Bottom Right */}
                        <div className="terminalTaskActionsBar terminalTaskActionsBar--right">
                            <button
                                className="terminalCopyBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyField('id', team.id);
                                }}
                                title="Copy team ID"
                            >
                                {copiedField === 'id' ? 'Copied!' : 'Copy ID'}
                            </button>
                            <button
                                className={isArchived ? "terminalViewDetailsBtn" : "terminalArchiveBtn"}
                                onClick={handleArchiveToggle}
                                title={isArchived ? "Unarchive team" : "Archive team"}
                            >
                                {isArchived ? 'Unarchive' : 'Archive'}
                            </button>
                            {isArchived && (
                                <button
                                    className="terminalDeleteBtn"
                                    onClick={handleDeleteClick}
                                    title="Permanently delete team"
                                >
                                    Delete Team
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Nested sub-teams (when expanded via the tree button, outside the row) */}
            {hasSubTeams && !childrenCollapsed && (
                <div className="terminalTaskGroupChildren">
                    {subTeams.map(subTeam => (
                        <TeamListItem
                            key={subTeam.id}
                            team={subTeam}
                            depth={depth + 1}
                            onEdit={onEdit}
                            onRun={onRun}
                            allTeams={allTeams}
                        />
                    ))}
                </div>
            )}

            {showDeleteConfirm && createPortal(
                <ConfirmActionModal
                    isOpen={showDeleteConfirm}
                    title="[ DELETE TEAM ]"
                    message={<>Are you sure you want to delete <strong>"{team.name}"</strong>?</>}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    confirmDanger
                    busy={isDeleting}
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={confirmDelete}
                />,
                document.body
            )}
        </>
    );
}
