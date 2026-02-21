import React, { useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { TeamMember, AgentMode, AgentTool } from "../../app/types/maestro";

type SplitPlayButtonProps = {
    onPlayDefault: () => void;
    assignedTeamMemberId?: string;
    onAssignTeamMember?: (teamMemberId: string) => void;
    onOpenCreateTeamMember?: () => void;
    teamMembers?: TeamMember[];
    disabled?: boolean;
};

const MODE_LABELS: Record<string, string> = {
    worker: 'worker',
    coordinator: 'coord',
    'coordinated-worker': 'c-worker',
    'coordinated-coordinator': 'c-coord',
    execute: 'exec',
    coordinate: 'coord',
};

const AGENT_TOOL_LABELS: Partial<Record<AgentTool, string>> = {
    "claude-code": "Claude",
    "codex": "Codex",
};

const AGENT_TOOL_SYMBOLS: Partial<Record<AgentTool, string>> = {
    "claude-code": "◈",
    "codex": "◇",
};

function getMemberBadgeLabel(member: TeamMember): string {
    if (member.mode) return MODE_LABELS[member.mode];
    return 'exec';
}

function getMemberBadgeClass(member: TeamMember): string {
    return member.mode || 'worker';
}

function getMemberSubline(member: TeamMember): string {
    const parts: string[] = [];
    if (member.role) parts.push(member.role);
    if (member.agentTool) {
        let toolLabel = AGENT_TOOL_LABELS[member.agentTool] || member.agentTool;
        if (member.model) toolLabel += ` / ${member.model}`;
        parts.push(toolLabel);
    }
    return parts.join(' · ');
}

export function SplitPlayButton({
    onPlayDefault,
    assignedTeamMemberId,
    onAssignTeamMember,
    onOpenCreateTeamMember,
    teamMembers = [],
    disabled = false,
}: SplitPlayButtonProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; right: number; openDirection: 'down' | 'up' } | null>(null);
    const dropdownBtnRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const computeDropdownPos = useCallback(() => {
        const container = containerRef.current;
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const rightOffset = window.innerWidth - rect.right;
        // Estimate dropdown height (header + members + new button + padding)
        const estimatedDropdownHeight = 300;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= estimatedDropdownHeight || spaceBelow >= spaceAbove) {
            // Open downward
            return { top: rect.bottom + 4, right: rightOffset, openDirection: 'down' as const };
        } else {
            // Open upward
            return { bottom: (window.innerHeight - rect.top) + 4, right: rightOffset, openDirection: 'up' as const };
        }
    }, []);

    useLayoutEffect(() => {
        if (showDropdown) {
            setDropdownPos(computeDropdownPos());
        }
    }, [showDropdown, computeDropdownPos]);

    const handlePlayDefault = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled) {
            onPlayDefault();
        }
    };

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled) {
            setShowDropdown(!showDropdown);
        }
    };

    const handleSelectTeamMember = (teamMemberId: string) => {
        setShowDropdown(false);
        onAssignTeamMember?.(teamMemberId);
    };

    // Find the assigned team member to show its avatar
    const assignedMember = assignedTeamMemberId
        ? teamMembers.find(m => m.id === assignedTeamMemberId)
        : null;

    // Active (non-archived) team members only
    const activeMembers = teamMembers.filter(m => m.status === 'active');

    return (
        <div className="splitPlayButton" ref={containerRef}>
            {/* Play button (left side) - shows assigned member avatar */}
            <button
                className="splitPlayButton__play"
                onClick={handlePlayDefault}
                disabled={disabled}
                title={assignedMember ? `Run with ${assignedMember.name}` : "Run task"}
            >
                {assignedMember ? (
                    <span className="splitPlayButton__avatar">{assignedMember.avatar}</span>
                ) : (
                    '▶'
                )}
            </button>

            {/* Dropdown button (right side) */}
            <button
                ref={dropdownBtnRef}
                className="splitPlayButton__dropdown"
                onClick={handleToggleDropdown}
                disabled={disabled}
                title="Choose team member"
            >
                ▾
            </button>

            {/* Dropdown menu */}
            {showDropdown && dropdownPos && createPortal(
                <>
                    <div
                        className="splitPlayDropdown__overlay"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(false);
                        }}
                    />
                    <div
                        className={`splitPlayDropdown ${dropdownPos.openDirection === 'up' ? 'splitPlayDropdown--openUp' : ''}`}
                        style={{
                            ...(dropdownPos.openDirection === 'down'
                                ? { top: dropdownPos.top }
                                : { bottom: dropdownPos.bottom }),
                            right: dropdownPos.right,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="splitPlayDropdown__header">Select Team Member</div>

                        {activeMembers.length === 0 ? (
                            <div className="splitPlayDropdown__empty">
                                No team members configured
                            </div>
                        ) : (
                            <div className="splitPlayDropdown__section">
                                {activeMembers.map(member => {
                                    const isAssigned = member.id === assignedTeamMemberId;
                                    const subline = getMemberSubline(member);
                                    return (
                                        <button
                                            key={member.id}
                                            className={`splitPlayDropdown__member ${isAssigned ? 'splitPlayDropdown__member--assigned' : ''}`}
                                            onClick={() => handleSelectTeamMember(member.id)}
                                        >
                                            <span className="splitPlayDropdown__avatar">{member.avatar}</span>
                                            <div className="splitPlayDropdown__memberInfo">
                                                <div className="splitPlayDropdown__memberTop">
                                                    <span className="splitPlayDropdown__name">{member.name}</span>
                                                    {member.mode && (
                                                        <span className={`splitPlayDropdown__modeBadge splitPlayDropdown__modeBadge--${getMemberBadgeClass(member)}`}>
                                                            {getMemberBadgeLabel(member)}
                                                        </span>
                                                    )}
                                                    {member.isDefault && (
                                                        <span className="splitPlayDropdown__defaultTag">default</span>
                                                    )}
                                                </div>
                                                {subline && (
                                                    <div className="splitPlayDropdown__memberSub">
                                                        {member.agentTool && (
                                                            <span className="splitPlayDropdown__agentIcon">{AGENT_TOOL_SYMBOLS[member.agentTool]}</span>
                                                        )}
                                                        {subline}
                                                    </div>
                                                )}
                                            </div>
                                            {isAssigned && (
                                                <span className="splitPlayDropdown__assignedCheck">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* New team member button */}
                        <div className="splitPlayDropdown__separator" />
                        <button
                            className="splitPlayDropdown__newMember"
                            onClick={() => {
                                setShowDropdown(false);
                                onOpenCreateTeamMember?.();
                            }}
                        >
                            <span className="splitPlayDropdown__newIcon">+</span>
                            New Team Member
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
