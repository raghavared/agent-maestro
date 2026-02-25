import React from "react";
import { TeamMember } from "../../../app/types/maestro";
import { TeamMemberSelector } from "./TeamMemberSelector";

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
};

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
}: TaskModalFooterProps) {
    const hasMembers = selectedTeamMemberIds.length > 0;

    return (
        <div className="themedFormActions" style={{ flexWrap: 'wrap' }}>
            {isEditMode ? (
                <>
                    <TeamMemberSelector
                        selectedTeamMemberIds={selectedTeamMemberIds}
                        onSelectionChange={onTeamMemberSelectionChange}
                        teamMembers={teamMembers}
                    />
                    {hasMembers && (
                        <button
                            type="button"
                            className={`launchConfigGearBtn ${showLaunchConfig ? 'launchConfigGearBtn--active' : ''}`}
                            onClick={onToggleLaunchConfig}
                            title={showLaunchConfig ? 'Back to description' : 'Configure launch options'}
                        >
                            {'\u2699'}
                        </button>
                    )}
                    <button type="button" className="themedBtn" onClick={onClose}>
                        Close
                    </button>
                    <button type="button" className="themedBtn themedBtnPrimary" onClick={onSave}>
                        Save
                    </button>
                    <button
                        type="button"
                        className="themedBtn themedBtnSuccess"
                        onClick={() => {
                            onWorkOn?.();
                            onClose();
                        }}
                    >
                        $ exec
                    </button>
                </>
            ) : (
                <>
                    <TeamMemberSelector
                        selectedTeamMemberIds={selectedTeamMemberIds}
                        onSelectionChange={onTeamMemberSelectionChange}
                        teamMembers={teamMembers}
                    />
                    {hasMembers && (
                        <button
                            type="button"
                            className={`launchConfigGearBtn ${showLaunchConfig ? 'launchConfigGearBtn--active' : ''}`}
                            onClick={onToggleLaunchConfig}
                            title={showLaunchConfig ? 'Back to description' : 'Configure launch options'}
                        >
                            {'\u2699'}
                        </button>
                    )}
                    <button type="button" className="themedBtn" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="themedBtn themedBtnPrimary"
                        onClick={() => onSubmit(false)}
                        disabled={!isValid}
                    >
                        Create Task
                    </button>
                    <button
                        type="button"
                        className="themedBtn themedBtnSuccess"
                        onClick={() => onSubmit(true)}
                        disabled={!isValid}
                    >
                        Create &amp; Run
                    </button>
                </>
            )}
        </div>
    );
}
