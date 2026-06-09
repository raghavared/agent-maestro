import React from "react";
import { TeamMember } from "../../../app/types/maestro";
import { AutoSaveStatus } from "../../../hooks/useAutoSave";
import { TeamMemberSelector } from "./TeamMemberSelector";
import { Icon, AgentTile } from "../redesign/kit";

type TaskModalFooterProps = {
    isEditMode: boolean;
    isValid: boolean;
    selectedTeamMemberIds: string[];
    onTeamMemberSelectionChange: (ids: string[]) => void;
    teamMembers: TeamMember[];
    onClose: () => void;
    onSave: () => void;
    onSubmit: (startImmediately: boolean) => void;
    onWorkOn?: () => void;
    showLaunchConfig: boolean;
    onToggleLaunchConfig: () => void;
    autoSaveStatus?: AutoSaveStatus;
    isDraft?: boolean;
};

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
    if (status === "idle") return null;
    const label = status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save error";
    const dotClass = status === "saving" ? "pn-dot--wait" : status === "error" ? "pn-dot--block" : "pn-dot--run";
    return (
        <span className="pn-savehint">
            <span className={`pn-dot ${dotClass}`}></span> {label}
        </span>
    );
}

export function TaskModalFooter({
    isEditMode,
    isValid,
    selectedTeamMemberIds,
    onTeamMemberSelectionChange,
    teamMembers,
    onClose,
    onSave,
    onSubmit,
    onWorkOn,
    showLaunchConfig,
    onToggleLaunchConfig,
    autoSaveStatus,
    isDraft,
}: TaskModalFooterProps) {
    const hasMembers = selectedTeamMemberIds.length > 0;

    const soleMember = selectedTeamMemberIds.length === 1
        ? teamMembers.find(m => m.id === selectedTeamMemberIds[0])
        : undefined;

    const gearBtn = hasMembers ? (
        <button
            type="button"
            className={`pn-mchip ${showLaunchConfig ? 'pn-mchip--ref' : ''}`}
            onClick={onToggleLaunchConfig}
            title={showLaunchConfig ? 'Back to description' : 'Configure launch options'}
        >
            <Icon name="settings" size={13} />
        </button>
    ) : null;

    const modelBadge = soleMember?.model ? (
        <span className="pn-badge pn-badge--model" style={{ marginLeft: 4 }}>
            <AgentTile kind={soleMember.agentTool || 'claude'} /> {soleMember.model}
        </span>
    ) : null;

    return (
        <div className="pn-mdl__foot">
            <div className="pn-mdl__footL">
                <TeamMemberSelector
                    selectedTeamMemberIds={selectedTeamMemberIds}
                    onSelectionChange={onTeamMemberSelectionChange}
                    teamMembers={teamMembers}
                />
                {gearBtn}
                {modelBadge}
                {((isEditMode && autoSaveStatus) || (!isEditMode && isDraft && autoSaveStatus)) && (
                    <AutoSaveIndicator status={autoSaveStatus} />
                )}
            </div>
            <div className="pn-mdl__footR">
                {isEditMode ? (
                    <>
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
                            onClick={() => {
                                onWorkOn?.();
                                onClose();
                            }}
                        >
                            <Icon name="play" size={13} /> Run
                        </button>
                    </>
                ) : isDraft ? (
                    <>
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
                            onClick={() => onSubmit(true)}
                        >
                            <Icon name="play" size={13} /> Run
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="pn-btn"
                            onClick={() => onSubmit(false)}
                            disabled={!isValid}
                        >
                            Create
                        </button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
                            onClick={() => onSubmit(true)}
                            disabled={!isValid}
                        >
                            <Icon name="play" size={13} /> Create &amp; start
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
