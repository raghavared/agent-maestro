import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { TeamMember } from "../../../app/types/maestro";
import { useDropdownPosition } from "../../../hooks/useDropdownPosition";

const AGENT_TOOL_LABELS: Record<string, string> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
};

type TeamMemberSelectorProps = {
    selectedTeamMemberIds: string[];
    onSelectionChange: (ids: string[]) => void;
    teamMembers: TeamMember[];
};

export function TeamMemberSelector({
    selectedTeamMemberIds,
    onSelectionChange,
    teamMembers,
}: TeamMemberSelectorProps) {
    const [showDropdown, setShowDropdown] = React.useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const pos = useDropdownPosition(btnRef, showDropdown, "above");

    const selectedTeamMembers = selectedTeamMemberIds
        .map(id => teamMembers.find(m => m.id === id))
        .filter(Boolean) as TeamMember[];

    const toggleMember = (memberId: string) => {
        const isSelected = selectedTeamMemberIds.includes(memberId);
        onSelectionChange(
            isSelected
                ? selectedTeamMemberIds.filter(id => id !== memberId)
                : [...selectedTeamMemberIds, memberId]
        );
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
            <div className="themedDropdownPicker" style={{ position: 'relative' }}>
                <button
                    ref={btnRef}
                    type="button"
                    className={`themedDropdownButton ${showDropdown ? 'themedDropdownButton--open' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDropdown(!showDropdown);
                    }}
                >
                    {selectedTeamMembers.length > 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{selectedTeamMembers.map(m => m.avatar).join('')}</span>
                            <span>{selectedTeamMembers.length === 1 ? selectedTeamMembers[0].name : `${selectedTeamMembers.length} members`}</span>
                        </span>
                    ) : (
                        <span style={{ opacity: 0.6 }}>Select Team Members</span>
                    )}
                    <span className="themedDropdownCaret">{showDropdown ? '\u25B4' : '\u25BE'}</span>
                </button>
                {showDropdown && pos && createPortal(
                    <>
                        <div
                            className="themedDropdownOverlay"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(false);
                            }}
                        />
                        <div
                            className="themedDropdownMenu"
                            style={{ top: 'auto', bottom: pos.bottom, left: pos.left, minWidth: '240px', maxHeight: `${Math.min(window.innerHeight - 40, 320)}px`, overflowY: 'auto' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ padding: '4px 8px', fontSize: '10px', opacity: 0.5, borderBottom: '1px solid var(--theme-border)', position: 'sticky', top: 0, backgroundColor: 'var(--theme-bg)', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Select team members</span>
                                {selectedTeamMemberIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onSelectionChange([]); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--theme-primary)', cursor: 'pointer', padding: '0 2px', fontSize: '10px', opacity: 0.7 }}
                                    >
                                        clear
                                    </button>
                                )}
                            </div>
                            {teamMembers.map(member => {
                                const isSelected = selectedTeamMemberIds.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        className={`themedDropdownOption ${isSelected ? 'themedDropdownOption--current' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMember(member.id);
                                        }}
                                        style={{ textAlign: 'left' }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{member.avatar}</span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span className="themedDropdownLabel">{member.name}</span>
                                                <span style={{ display: 'block', fontSize: '9px', opacity: 0.5 }}>
                                                    {[
                                                        member.role,
                                                        member.agentTool ? AGENT_TOOL_LABELS[member.agentTool] || member.agentTool : null,
                                                        member.model,
                                                    ].filter(Boolean).join(' · ')}
                                                </span>
                                            </span>
                                            {isSelected && (
                                                <span className="themedDropdownCheck">{'\u2713'}</span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                            {teamMembers.length === 0 && (
                                <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                    No team members configured
                                </div>
                            )}
                        </div>
                    </>,
                    document.body
                )}
            </div>
            {selectedTeamMembers.length === 1 && (
                <span style={{ fontSize: '10px', opacity: 0.5 }}>
                    {[
                        selectedTeamMembers[0].agentTool ? AGENT_TOOL_LABELS[selectedTeamMembers[0].agentTool] : null,
                        selectedTeamMembers[0].model,
                    ].filter(Boolean).join(' / ')}
                </span>
            )}
            {selectedTeamMembers.length > 1 && (
                <span style={{ fontSize: '10px', opacity: 0.5 }}>
                    {selectedTeamMembers.map(m => m.avatar).join(' ')}
                </span>
            )}
        </div>
    );
}
