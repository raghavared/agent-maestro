import React, { useState, useRef } from "react";
import { TeamMember, AgentTool } from "../../app/types/maestro";
import { createPortal } from "react-dom";

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

export function TeamMemberList({
    teamMembers,
    onEdit,
    onArchive,
    onUnarchive,
    onDelete,
    onNewMember,
}: TeamMemberListProps) {
    const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    const activeMembers = teamMembers.filter(m => m.status === 'active');
    const archivedMembers = teamMembers.filter(m => m.status === 'archived');
    const defaultMembers = activeMembers.filter(m => m.isDefault);
    const customMembers = activeMembers.filter(m => !m.isDefault);

    const handleMenuToggle = (memberId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (menuOpenForId === memberId) {
            setMenuOpenForId(null);
        } else {
            const btn = menuBtnRefs.current.get(memberId);
            if (btn) {
                const rect = btn.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 4, left: rect.left });
            }
            setMenuOpenForId(memberId);
        }
    };

    const handleArchive = async (memberId: string) => {
        setMenuOpenForId(null);
        setLoadingAction(`archive:${memberId}`);
        try {
            await onArchive?.(memberId);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDelete = async (memberId: string) => {
        setMenuOpenForId(null);
        setLoadingAction(`delete:${memberId}`);
        try {
            await onDelete?.(memberId);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleUnarchive = async (memberId: string) => {
        setMenuOpenForId(null);
        setLoadingAction(`unarchive:${memberId}`);
        try {
            await onUnarchive?.(memberId);
        } finally {
            setLoadingAction(null);
        }
    };

    const isLoading = (action: string, memberId: string) => loadingAction === `${action}:${memberId}`;

    const renderMemberRow = (member: TeamMember, options?: { isArchived?: boolean }) => {
        const isArchived = options?.isArchived ?? false;

        return (
            <div
                key={member.id}
                className={`terminalTaskRow ${isArchived ? 'terminalTaskRow--completed' : ''}`}
            >
                <div className="terminalTaskMain" onClick={() => onEdit(member)}>
                    {/* Primary content area - matches TaskListItem layout */}
                    <div className="terminalTaskPrimaryContent">
                        <div className="terminalTaskTitleRow">
                            <span style={{ fontSize: '14px', flexShrink: 0, marginRight: '6px' }}>
                                {member.avatar}
                            </span>
                            <span className="terminalTaskTitle">{member.name}</span>
                        </div>

                        <div className="terminalTaskMeta">
                            {/* Role badge */}
                            <span className="terminalMetaBadge">
                                {member.role}
                            </span>

                            {/* Default badge */}
                            {member.isDefault && (
                                <span className="terminalMetaBadge terminalMetaBadge--status terminalMetaBadge--status-in_progress">
                                    DEFAULT
                                </span>
                            )}

                            {/* Agent tool + model badge - matches TaskListItem agent badge */}
                            {member.agentTool && (
                                <span className={`terminalMetaBadge terminalMetaBadge--agent terminalMetaBadge--agent-${member.agentTool}`}>
                                    {AGENT_TOOL_SYMBOLS[member.agentTool]}{' '}
                                    {member.model ? getModelDisplayLabel(member.model, member.agentTool) : AGENT_TOOL_LABELS[member.agentTool]}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right-side action buttons - matches terminalTaskActions */}
                    <div className="terminalTaskActions">
                        {!isArchived && !member.isDefault && (
                            <button
                                ref={(el) => {
                                    if (el) menuBtnRefs.current.set(member.id, el);
                                }}
                                className="terminalViewDetailsBtn"
                                onClick={(e) => handleMenuToggle(member.id, e)}
                                title="More actions"
                                style={{ padding: '2px 6px' }}
                            >
                                ...
                            </button>
                        )}

                        {!isArchived && member.isDefault && (
                            <button
                                className="terminalViewDetailsBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(member);
                                }}
                                title="Configure default member"
                            >
                                Configure
                            </button>
                        )}

                        {isArchived && (
                            <>
                                <button
                                    className="terminalViewDetailsBtn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnarchive(member.id);
                                    }}
                                    disabled={!!loadingAction}
                                >
                                    {isLoading('unarchive', member.id) ? '...' : 'Restore'}
                                </button>
                                <button
                                    className="terminalDeleteBtn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(member.id);
                                    }}
                                    disabled={!!loadingAction}
                                >
                                    {isLoading('delete', member.id) ? '...' : 'Delete'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Context menu for custom members - uses themed dropdown like TaskListItem */}
                {menuOpenForId === member.id && menuPos && createPortal(
                    <>
                        <div
                            className="terminalInlineStatusOverlay"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenForId(null);
                            }}
                        />
                        <div
                            className="terminalInlineStatusDropdown terminalInlineStatusDropdown--fixed"
                            style={{ top: menuPos.top, left: menuPos.left }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                className="terminalInlineStatusOption"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(member);
                                    setMenuOpenForId(null);
                                }}
                            >
                                <span className="terminalStatusLabel">Edit</span>
                            </button>
                            <button
                                className="terminalInlineStatusOption"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchive(member.id);
                                }}
                                disabled={!!loadingAction}
                            >
                                <span className="terminalStatusLabel">
                                    {isLoading('archive', member.id) ? 'Archiving...' : 'Archive'}
                                </span>
                            </button>
                            <button
                                className="terminalInlineStatusOption"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(member.id);
                                }}
                                disabled={!!loadingAction}
                                style={{ color: 'var(--theme-danger, #f87171)' }}
                            >
                                <span className="terminalStatusLabel">
                                    {isLoading('delete', member.id) ? 'Deleting...' : 'Delete'}
                                </span>
                            </button>
                        </div>
                    </>,
                    document.body
                )}
            </div>
        );
    };

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
