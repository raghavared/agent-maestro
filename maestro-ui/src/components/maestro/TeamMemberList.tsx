import React, { useState } from "react";
import { TeamMember, AgentTool } from "../../app/types/maestro";

type TeamMemberListProps = {
    teamMembers: TeamMember[];
    onEdit: (member: TeamMember) => void;
    onArchive?: (memberId: string) => void | Promise<void>;
    onUnarchive?: (memberId: string) => void | Promise<void>;
    onDelete?: (memberId: string) => void | Promise<void>;
    onNewMember: () => void;
};

const AGENT_TOOL_SYMBOLS: Partial<Record<AgentTool, string>> = {
    "claude-code": "◈",
    "codex": "◇",
};

const AGENT_TOOL_LABELS: Partial<Record<AgentTool, string>> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
};

function getModelDisplayLabel(model?: string, agentTool?: AgentTool): string {
    if (!model) return "";
    const modelLabels: Record<string, string> = {
        haiku: "Haiku",
        sonnet: "Sonnet",
        opus: "Opus",
        "gpt-5.3-codex": "5.3-codex",
        "gpt-5.2-codex": "5.2-codex",
    };
    return modelLabels[model] || model;
}

function TeamMemberRow({
    member,
    isArchived,
    onEdit,
    onArchive,
    onUnarchive,
    onDelete,
    loadingAction,
    setLoadingAction,
}: {
    member: TeamMember;
    isArchived: boolean;
    onEdit: (member: TeamMember) => void;
    onArchive?: (memberId: string) => void | Promise<void>;
    onUnarchive?: (memberId: string) => void | Promise<void>;
    onDelete?: (memberId: string) => void | Promise<void>;
    loadingAction: string | null;
    setLoadingAction: (v: string | null) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isLoading = (action: string) => loadingAction === `${action}:${member.id}`;

    const handleArchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadingAction(`archive:${member.id}`);
        try {
            await onArchive?.(member.id);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadingAction(`delete:${member.id}`);
        try {
            await onDelete?.(member.id);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleUnarchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadingAction(`unarchive:${member.id}`);
        try {
            await onUnarchive?.(member.id);
        } finally {
            setLoadingAction(null);
        }
    };

    const modelLabel = member.model
        ? getModelDisplayLabel(member.model, member.agentTool)
        : member.agentTool
            ? AGENT_TOOL_LABELS[member.agentTool]
            : null;

    return (
        <div
            className={`terminalTaskRow ${isArchived ? 'terminalTaskRow--completed' : ''}`}
        >
            {/* Single row: avatar + name + model + default badge */}
            <div className="terminalTaskMain" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="terminalTaskPrimaryContent" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>
                        {member.avatar}
                    </span>
                    <span className="terminalTaskTitle" style={{ flex: 1, minWidth: 0 }}>{member.name}</span>

                    {/* Model badge */}
                    {modelLabel && (
                        <span className={`terminalMetaBadge terminalMetaBadge--agent ${member.agentTool ? `terminalMetaBadge--agent-${member.agentTool}` : ''}`}>
                            {member.agentTool && AGENT_TOOL_SYMBOLS[member.agentTool]}{' '}
                            {modelLabel}
                        </span>
                    )}

                    {/* Default indicator */}
                    {member.isDefault && (
                        <span className="terminalMetaBadge terminalMetaBadge--status terminalMetaBadge--status-in_progress">
                            DEFAULT
                        </span>
                    )}
                </div>
            </div>

            {/* Expanded content - shown on click */}
            {isExpanded && (
                <div className="terminalTaskExpanded">
                    <div className="terminalTaskTabContent" onClick={(e) => e.stopPropagation()}>
                        <div className="terminalTabPane terminalTabPane--context">
                            {/* Role */}
                            {member.role && (
                                <div className="terminalDetailBlock">
                                    <div className="terminalDetailBlockLabel">Role</div>
                                    <div className="terminalDetailBlockContent terminalDescriptionText">
                                        {member.role}
                                    </div>
                                </div>
                            )}

                            {/* Identity / Instructions */}
                            {member.identity && (
                                <div className="terminalDetailBlock">
                                    <div className="terminalDetailBlockLabel">Instructions</div>
                                    <div className="terminalDetailBlockContent terminalDescriptionText">
                                        {member.identity}
                                    </div>
                                </div>
                            )}

                            {/* Skills */}
                            {member.skillIds && member.skillIds.length > 0 && (
                                <div className="terminalDetailBlock">
                                    <div className="terminalDetailBlockLabel">Skills</div>
                                    <div className="terminalDetailBlockContent terminalDescriptionText">
                                        {member.skillIds.join(', ')}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions bar */}
                    <div className="terminalTaskActionsBar terminalTaskActionsBar--right">
                        {!isArchived && (
                            <button
                                className="terminalViewDetailsBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(member);
                                }}
                                title={member.isDefault ? "Configure default member" : "Edit member"}
                            >
                                {member.isDefault ? 'Configure' : 'Edit'}
                            </button>
                        )}

                        {!isArchived && (
                            <button
                                className="terminalArchiveBtn"
                                onClick={handleArchive}
                                disabled={!!loadingAction}
                            >
                                {isLoading('archive') ? 'Archiving...' : 'Archive'}
                            </button>
                        )}

                        {isArchived && (
                            <>
                                <button
                                    className="terminalViewDetailsBtn"
                                    onClick={handleUnarchive}
                                    disabled={!!loadingAction}
                                >
                                    {isLoading('unarchive') ? '...' : 'Restore'}
                                </button>
                                <button
                                    className="terminalDeleteBtn"
                                    onClick={handleDelete}
                                    disabled={!!loadingAction}
                                >
                                    {isLoading('delete') ? '...' : 'Delete'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function TeamMemberList({
    teamMembers,
    onEdit,
    onArchive,
    onUnarchive,
    onDelete,
    onNewMember,
}: TeamMemberListProps) {
    const [showArchived, setShowArchived] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const activeMembers = teamMembers.filter(m => m.status === 'active');
    const archivedMembers = teamMembers.filter(m => m.status === 'archived');
    const defaultMembers = activeMembers.filter(m => m.isDefault);
    const customMembers = activeMembers.filter(m => !m.isDefault);

    const renderMemberRow = (member: TeamMember, options?: { isArchived?: boolean }) => (
        <TeamMemberRow
            key={member.id}
            member={member}
            isArchived={options?.isArchived ?? false}
            onEdit={onEdit}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onDelete={onDelete}
            loadingAction={loadingAction}
            setLoadingAction={setLoadingAction}
        />
    );

    return (
        <div>
            {/* Default members section */}
            {defaultMembers.length > 0 && (
                <div className="terminalTaskList">
                    {defaultMembers.map(member => renderMemberRow(member))}
                </div>
            )}

            {/* Custom members section */}
            {customMembers.length > 0 && (
                <div className="terminalTaskList">
                    {customMembers.map(member => renderMemberRow(member))}
                </div>
            )}

            {/* Archived section - collapsible */}
            {archivedMembers.length > 0 && (
                <div>
                    <button
                        className="terminalViewDetailsBtn"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 12px',
                            fontSize: '10px',
                            borderTop: '1px solid var(--theme-border)',
                        }}
                        onClick={() => setShowArchived(!showArchived)}
                    >
                        <span>ARCHIVED ({archivedMembers.length})</span>
                        <span>{showArchived ? '\u25B4' : '\u25BE'}</span>
                    </button>
                    {showArchived && (
                        <div className="terminalTaskList terminalTaskListCompleted">
                            {archivedMembers.map(member => renderMemberRow(member, { isArchived: true }))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {activeMembers.length === 0 && (
                <div className="terminalEmptyState">
                    <p className="terminalEmptyMessage">NO TEAM MEMBERS</p>
                    <p className="terminalEmptySubMessage">$ create your first team member</p>
                </div>
            )}
        </div>
    );
}
