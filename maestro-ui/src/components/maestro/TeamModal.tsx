import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Team, CreateTeamPayload, UpdateTeamPayload } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";

type TeamModalProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    team?: Team | null;
};

export function TeamModal({ isOpen, onClose, projectId, team }: TeamModalProps) {
    const isEditMode = !!team;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatar, setAvatar] = useState("");
    const [leaderId, setLeaderId] = useState("");
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [selectedSubTeamIds, setSelectedSubTeamIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createTeam = useMaestroStore(s => s.createTeam);
    const updateTeam = useMaestroStore(s => s.updateTeam);
    const teamMembersMap = useMaestroStore(s => s.teamMembers);
    const teamsMap = useMaestroStore(s => s.teams);

    const activeMembers = React.useMemo(() => {
        return Array.from(teamMembersMap.values()).filter(
            m => m.projectId === projectId && m.status === 'active'
        );
    }, [teamMembersMap, projectId]);

    const otherTeams = React.useMemo(() => {
        return Array.from(teamsMap.values()).filter(
            t => t.projectId === projectId && (!team || t.id !== team.id)
        );
    }, [teamsMap, projectId, team]);

    // Compute ancestor IDs to prevent circular references
    const ancestorIds = React.useMemo(() => {
        if (!team) return new Set<string>();
        const ancestors = new Set<string>();
        const visited = new Set<string>();
        const findAncestors = (teamId: string) => {
            if (visited.has(teamId)) return;
            visited.add(teamId);
            const t = teamsMap.get(teamId);
            if (t?.parentTeamId) {
                ancestors.add(t.parentTeamId);
                findAncestors(t.parentTeamId);
            }
            // Also check: any team that lists this team as a sub-team is a parent
            for (const [id, other] of teamsMap) {
                if (other.subTeamIds.includes(teamId)) {
                    ancestors.add(id);
                    findAncestors(id);
                }
            }
        };
        findAncestors(team.id);
        return ancestors;
    }, [team, teamsMap]);

    // Teams that can be sub-teams (exclude self and ancestors)
    const availableSubTeams = React.useMemo(() => {
        return otherTeams.filter(t => !ancestorIds.has(t.id) && t.status === 'active');
    }, [otherTeams, ancestorIds]);

    useEffect(() => {
        if (!isOpen) return;
        if (team) {
            setName(team.name);
            setDescription(team.description || "");
            setAvatar(team.avatar || "");
            setLeaderId(team.leaderId);
            setSelectedMemberIds(team.memberIds);
            setSelectedSubTeamIds(team.subTeamIds);
        } else {
            setName("");
            setDescription("");
            setAvatar("");
            setLeaderId("");
            setSelectedMemberIds([]);
            setSelectedSubTeamIds([]);
        }
        setError(null);
    }, [isOpen, team]);

    // Auto-include leader in member list
    useEffect(() => {
        if (leaderId && !selectedMemberIds.includes(leaderId)) {
            setSelectedMemberIds(prev => [...prev, leaderId]);
        }
    }, [leaderId]);

    const handleClose = () => {
        if (!isSaving) onClose();
    };

    const handleSubmit = async () => {
        if (!name.trim()) { setError("Name is required"); return; }
        if (!leaderId) { setError("Leader is required"); return; }

        setIsSaving(true);
        setError(null);

        try {
            if (isEditMode && team) {
                const payload: UpdateTeamPayload = {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    avatar: avatar.trim() || undefined,
                    leaderId,
                    memberIds: selectedMemberIds,
                    subTeamIds: selectedSubTeamIds,
                };
                await updateTeam(team.id, projectId, payload);
            } else {
                const payload: CreateTeamPayload = {
                    projectId,
                    name: name.trim(),
                    description: description.trim() || undefined,
                    avatar: avatar.trim() || undefined,
                    leaderId,
                    memberIds: selectedMemberIds,
                    subTeamIds: selectedSubTeamIds,
                };
                await createTeam(payload);
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} team`);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(memberId)
                ? memberId === leaderId ? prev : prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const toggleSubTeam = (teamId: string) => {
        setSelectedSubTeamIds(prev =>
            prev.includes(teamId)
                ? prev.filter(id => id !== teamId)
                : [...prev, teamId]
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div
                className="themedModal themedModal--wide"
                onClick={(e) => e.stopPropagation()}
                style={{ overflow: 'hidden' }}
            >
                {/* Header */}
                <div className="themedModalHeader">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                        <span className="themedModalTitle" style={{ flexShrink: 0 }}>
                            {isEditMode ? '[ EDIT TEAM ]' : '[ NEW TEAM ]'}
                        </span>
                        <input
                            type="text"
                            className="themedFormInput"
                            style={{
                                flex: 1, minWidth: 0, margin: 0,
                                padding: '6px 10px', fontSize: '13px', fontWeight: 600,
                                boxSizing: 'border-box',
                            }}
                            placeholder="e.g., Frontend Squad"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>
                    <button className="themedModalClose" onClick={handleClose} disabled={isSaving}>{'\u00D7'}</button>
                </div>

                {/* Content */}
                <div className="themedModalContent" style={{ overflowX: 'hidden' }}>
                    {error && (
                        <div className="terminalErrorBanner" style={{ marginBottom: '10px' }}>
                            <span className="terminalErrorSymbol">[ERROR]</span>
                            <span className="terminalErrorText">{error}</span>
                            <button className="terminalErrorClose" onClick={() => setError(null)}>{'\u00D7'}</button>
                        </div>
                    )}

                    {/* Description & Avatar */}
                    <div className="tmModal__section">
                        <div className="tmModal__sectionLabel">Details</div>
                        <div className="tmModal__row">
                            <div className="tmModal__field">
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Description</div>
                                <textarea
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '6px 10px', fontSize: '12px', width: '100%', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical' }}
                                    placeholder="What this team does..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>
                            <div className="tmModal__fieldSmall">
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Avatar</div>
                                <input
                                    type="text"
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '6px 10px', fontSize: '16px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                                    placeholder={'\u{1F46A}'}
                                    value={avatar}
                                    onChange={(e) => setAvatar(e.target.value)}
                                    maxLength={2}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Leader */}
                    <div className="tmModal__section">
                        <div className="tmModal__sectionLabel">Leader *</div>
                        <select
                            className="themedFormSelect"
                            style={{ margin: 0, padding: '5px 8px', fontSize: '11px', width: '100%', boxSizing: 'border-box' }}
                            value={leaderId}
                            onChange={(e) => setLeaderId(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="">Select a leader...</option>
                            {activeMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.avatar} {m.name} ({m.role})</option>
                            ))}
                        </select>
                    </div>

                    {/* Members */}
                    <div className="tmModal__section">
                        <div className="tmModal__sectionLabel">Members ({selectedMemberIds.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', maxHeight: '120px', overflowY: 'auto' }}>
                            {activeMembers.map(m => {
                                const isSelected = selectedMemberIds.includes(m.id);
                                const isLeader = m.id === leaderId;
                                return (
                                    <label
                                        key={m.id}
                                        className="terminalTaskCheckbox"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            cursor: isLeader ? 'default' : 'pointer',
                                            opacity: isLeader ? 0.7 : 1,
                                            marginRight: 0,
                                        }}
                                        onClick={(e) => { e.preventDefault(); if (!isSaving && !isLeader) toggleMember(m.id); }}
                                    >
                                        <input type="checkbox" checked={isSelected} readOnly />
                                        <span className={`terminalTaskCheckmark ${isSelected ? 'terminalTaskCheckmark--checked' : ''}`} style={{ width: '14px', height: '14px', fontSize: '9px' }}>
                                            {isSelected ? '\u2713' : ''}
                                        </span>
                                        <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--theme-text)', whiteSpace: 'nowrap' }}>
                                            {m.avatar} {m.name}
                                            {isLeader && <span style={{ opacity: 0.5, marginLeft: '4px' }}>(leader)</span>}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sub-teams */}
                    {availableSubTeams.length > 0 && (
                        <div className="tmModal__section" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                            <div className="tmModal__sectionLabel">Sub-teams ({selectedSubTeamIds.length})</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', maxHeight: '100px', overflowY: 'auto' }}>
                                {availableSubTeams.map(t => {
                                    const isSelected = selectedSubTeamIds.includes(t.id);
                                    return (
                                        <label
                                            key={t.id}
                                            className="terminalTaskCheckbox"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                cursor: 'pointer', marginRight: 0,
                                            }}
                                            onClick={(e) => { e.preventDefault(); if (!isSaving) toggleSubTeam(t.id); }}
                                        >
                                            <input type="checkbox" checked={isSelected} readOnly />
                                            <span className={`terminalTaskCheckmark ${isSelected ? 'terminalTaskCheckmark--checked' : ''}`} style={{ width: '14px', height: '14px', fontSize: '9px' }}>
                                                {isSelected ? '\u2713' : ''}
                                            </span>
                                            <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--theme-text)', whiteSpace: 'nowrap' }}>
                                                {t.avatar || '\u{1F46A}'} {t.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="tmModal__footer">
                    <div className="tmModal__footerLeft" />
                    <div className="tmModal__footerRight">
                        <button type="button" className="themedBtn" onClick={handleClose} disabled={isSaving}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="themedBtn themedBtnPrimary"
                            onClick={handleSubmit}
                            disabled={isSaving || !name.trim() || !leaderId}
                        >
                            {isSaving
                                ? (isEditMode ? "Saving..." : "Creating...")
                                : (isEditMode ? "Save" : "Create Team")
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
