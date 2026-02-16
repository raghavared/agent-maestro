import React, { useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { TeamMember, AgentMode } from "../../app/types/maestro";

type SplitPlayButtonProps = {
    onPlayDefault: () => void;
    assignedTeamMemberId?: string;
    onAssignTeamMember?: (teamMemberId: string) => void;
    onOpenCreateTeamMember?: () => void;
    teamMembers?: TeamMember[];
    disabled?: boolean;
};

const MODE_LABELS: Record<AgentMode, string> = {
    execute: 'exec',
    coordinate: 'coord',
};

export function SplitPlayButton({
    onPlayDefault,
    assignedTeamMemberId,
    onAssignTeamMember,
    onOpenCreateTeamMember,
    teamMembers = [],
    disabled = false,
}: SplitPlayButtonProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
    const dropdownBtnRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const computeDropdownPos = useCallback(() => {
        const container = containerRef.current;
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const rightOffset = window.innerWidth - rect.right;
        return { top: rect.bottom + 4, right: rightOffset };
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
                        className="splitPlayDropdown"
                        style={{ top: dropdownPos.top, right: dropdownPos.right }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="splitPlayDropdown__header">Assign team member</div>

                        {/* Flat list of all team members */}
                        <div className="splitPlayDropdown__section">
                            {activeMembers.map(member => {
                                const isAssigned = member.id === assignedTeamMemberId;
                                return (
                                    <button
                                        key={member.id}
                                        className={`splitPlayDropdown__member ${isAssigned ? 'splitPlayDropdown__member--assigned' : ''} ${member.isDefault ? 'splitPlayDropdown__member--default' : 'splitPlayDropdown__member--custom'}`}
                                        onClick={() => handleSelectTeamMember(member.id)}
                                    >
                                        <span className="splitPlayDropdown__avatar">{member.avatar}</span>
                                        <span className="splitPlayDropdown__name">{member.name}</span>
                                        {member.mode && (
                                            <span className={`splitPlayDropdown__modeBadge splitPlayDropdown__modeBadge--${member.mode}`}>
                                                {MODE_LABELS[member.mode]}
                                            </span>
                                        )}
                                        {isAssigned && (
                                            <span className="splitPlayDropdown__assignedCheck">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* New team member button */}
                        <div className="splitPlayDropdown__separator" />
                        <button
                            className="splitPlayDropdown__newMember"
                            onClick={() => {
                                setShowDropdown(false);
                                onOpenCreateTeamMember?.();
                            }}
                        >
                            + New Team Member...
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
