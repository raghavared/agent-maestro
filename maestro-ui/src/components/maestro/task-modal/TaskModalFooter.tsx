import React from "react";
import { TeamMember, MaestroTask } from "../../../app/types/maestro";
import { AutoSaveStatus } from "../../../hooks/useAutoSave";
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
    autoSaveStatus?: AutoSaveStatus;
    autoCreatedTask?: MaestroTask | null;
};

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
    if (status === "idle") return null;
    const label = status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save error";
    const color = status === "error" ? "var(--theme-error, #e55)" : "var(--theme-text-secondary)";
    return (
        <span style={{ fontSize: '10px', color, opacity: 0.7, marginRight: '4px' }}>
            {label}
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
    autoCreatedTask,
}: TaskModalFooterProps) {
    const hasMembers = selectedTeamMemberIds.length > 0;
    const isAutoCreated = !isEditMode && !!autoCreatedTask;

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
                    {autoSaveStatus && <AutoSaveIndicator status={autoSaveStatus} />}
                    <button type="button" className="themedBtn" onClick={onClose}>
                        Close
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
                    {isAutoCreated && autoSaveStatus && <AutoSaveIndicator status={autoSaveStatus} />}
                    <button type="button" className="themedBtn" onClick={onClose}>
                        {isAutoCreated ? "Close" : "Cancel"}
                    </button>
                    {isAutoCreated ? (
                        <button
                            type="button"
                            className="themedBtn themedBtnSuccess"
                            onClick={() => onSubmit(true)}
                        >
                            $ exec
                        </button>
                    ) : (
                        <>
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
                </>
            )}
        </div>
    );
}
