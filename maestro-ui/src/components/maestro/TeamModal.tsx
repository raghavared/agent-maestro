import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Team, CreateTeamPayload, UpdateTeamPayload } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { Icon } from "./redesign/kit";

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
        return Object.values(teamMembersMap).filter(
            m => m.projectId === projectId && m.status === 'active'
        );
    }, [teamMembersMap, projectId]);

    const otherTeams = React.useMemo(() => {
        return Object.values(teamsMap).filter(
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
            const t = teamsMap[teamId];
            if (t?.parentTeamId) {
                ancestors.add(t.parentTeamId);
                findAncestors(t.parentTeamId);
            }
            // Also check: any team that lists this team as a sub-team is a parent
            for (const [id, other] of Object.entries(teamsMap)) {
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
                className="pn-mdl"
                onClick={(e) => e.stopPropagation()}
                style={{ overflow: 'hidden' }}
            >
                {/* Header */}
                <div className="pn-mdl__hd">
                    <div className="pn-mdl__hdmain">
                        <div className="pn-mdl__crumb"><Icon name="users" /> <b>Team</b> <Icon name="chevronR" size={11} /> {isEditMode ? 'Edit team' : 'New team'}</div>
                        <input
                            type="text"
                            className="pn-mdl__titleinput"
                            placeholder="e.g., Frontend Squad"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>
                    <button type="button" className="pn-mdl__close" onClick={handleClose} disabled={isSaving}><Icon name="x" /></button>
                </div>

                {/* Content */}
                <div className="pn-mdl__body" style={{ overflowX: 'hidden' }}>
                    {error && (
                        <div className="pn-fhint" style={{ color: 'var(--pn-block)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1 }}>{error}</span>
                            <button type="button" className="pn-mdl__close" style={{ width: 22, height: 22 }} onClick={() => setError(null)}><Icon name="x" size={13} /></button>
                        </div>
                    )}

                    {/* Description & Avatar */}
                    <div className="pn-frow" style={{ alignItems: 'flex-end' }}>
                        <div className="pn-fld" style={{ flex: 1, minWidth: 160 }}>
                            <span className="pn-flabel">Description</span>
                            <textarea
                                className="pn-textarea"
                                style={{ minHeight: 60 }}
                                placeholder="What this team does..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="pn-fld">
                            <span className="pn-flabel">Avatar</span>
                            <input
                                type="text"
                                className="pn-avatar-edit"
                                style={{ textAlign: 'center' }}
                                placeholder={'\u{1F46A}'}
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                maxLength={2}
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    {/* Leader */}
                    <div className="pn-fld">
                        <span className="pn-flabel">Leader <span className="req">*</span></span>
                        <select
                            className="pn-select"
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
                    <div className="pn-fld">
                        <span className="pn-flabel">Members ({selectedMemberIds.length})</span>
                        <div className="pn-caps" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                            {activeMembers.map(m => {
                                const isSelected = selectedMemberIds.includes(m.id);
                                const isLeader = m.id === leaderId;
                                return (
                                    <div
                                        key={m.id}
                                        className="pn-cap"
                                        style={{ cursor: isLeader ? 'default' : 'pointer', opacity: isLeader ? 0.7 : 1 }}
                                        onClick={(e) => { e.preventDefault(); if (!isSaving && !isLeader) toggleMember(m.id); }}
                                    >
                                        <input type="checkbox" checked={isSelected} readOnly style={{ display: 'none' }} />
                                        <div className="pn-cap__body">
                                            <div className="pn-cap__name">
                                                {m.avatar} {m.name}
                                                {isLeader && <span style={{ opacity: 0.5, marginLeft: '6px' }}>(leader)</span>}
                                            </div>
                                            <div className="pn-cap__desc">{m.role}</div>
                                        </div>
                                        <span className={`pn-switch ${isSelected ? 'pn-switch--on' : ''}`}></span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sub-teams */}
                    {availableSubTeams.length > 0 && (
                        <div className="pn-fld">
                            <span className="pn-flabel">Sub-teams ({selectedSubTeamIds.length})</span>
                            <div className="pn-caps" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                {availableSubTeams.map(t => {
                                    const isSelected = selectedSubTeamIds.includes(t.id);
                                    return (
                                        <div
                                            key={t.id}
                                            className="pn-cap"
                                            style={{ cursor: 'pointer' }}
                                            onClick={(e) => { e.preventDefault(); if (!isSaving) toggleSubTeam(t.id); }}
                                        >
                                            <input type="checkbox" checked={isSelected} readOnly style={{ display: 'none' }} />
                                            <div className="pn-cap__body">
                                                <div className="pn-cap__name">{t.avatar || '\u{1F46A}'} {t.name}</div>
                                            </div>
                                            <span className={`pn-switch ${isSelected ? 'pn-switch--on' : ''}`}></span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="pn-mdl__foot">
                    <div className="pn-mdl__footL" />
                    <div className="pn-mdl__footR">
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={handleClose} disabled={isSaving}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
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
