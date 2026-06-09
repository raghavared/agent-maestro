import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AgentTool, LaunchConfig, ModelProfile } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import {
    createLaunchConfig,
    formatLaunchConfigLabel,
    getAgentToolForLaunchConfig,
    sanitizeLaunchConfig,
} from "../../app/constants/agentTools";
import { LaunchConfigDropdown } from "./LaunchConfigDropdown";
import { Icon } from "./redesign/kit";

type ModelProfileModalProps = {
    isOpen: boolean;
    onClose: () => void;
    profile?: ModelProfile | null;
};

const DEFAULT_CONFIG: LaunchConfig = createLaunchConfig("claude-code", "claude-opus-4-8");

export function ModelProfileModal({ isOpen, onClose, profile }: ModelProfileModalProps) {
    const createModelProfile = useMaestroStore((s) => s.createModelProfile);
    const updateModelProfile = useMaestroStore((s) => s.updateModelProfile);

    const isEditMode = !!profile;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [launchConfig, setLaunchConfig] = useState<LaunchConfig | null>(DEFAULT_CONFIG);
    const [activeTool, setActiveTool] = useState<AgentTool | null>("claude-code");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (profile) {
            setName(profile.name);
            setDescription(profile.description || "");
            setLaunchConfig(profile.launchConfig);
            setActiveTool(getAgentToolForLaunchConfig(profile.launchConfig) || "claude-code");
        } else {
            setName("");
            setDescription("");
            setLaunchConfig(DEFAULT_CONFIG);
            setActiveTool("claude-code");
        }
        setError(null);
    }, [isOpen, profile]);

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleSubmit = async () => {
        const sanitized = sanitizeLaunchConfig(launchConfig);
        if (!name.trim()) { setError("Name is required"); return; }
        if (!sanitized) { setError("Pick a model for this profile"); return; }

        setIsSaving(true);
        setError(null);
        try {
            if (isEditMode && profile) {
                await updateModelProfile(profile.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    launchConfig: sanitized,
                });
            } else {
                await createModelProfile({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    launchConfig: sanitized,
                });
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} profile`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div className="pn-mdl" onClick={(e) => e.stopPropagation()} style={{ overflow: "hidden" }}>
                <div className="pn-mdl__hd">
                    <div className="pn-mdl__hdmain">
                        <div className="pn-mdl__crumb"><Icon name="sliders" /> <b>Model profile</b> <Icon name="chevronR" size={11} /> {isEditMode ? "Edit" : "New"}</div>
                        <input
                            type="text"
                            className="pn-mdl__titleinput"
                            placeholder="e.g., Heavy"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>
                    <button type="button" className="pn-mdl__close" onClick={handleClose} disabled={isSaving}><Icon name="x" /></button>
                </div>

                <div className="pn-mdl__body" style={{ overflowX: "hidden" }}>
                    {error && (
                        <div className="pn-fhint" style={{ color: "var(--pn-block)", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1 }}>{error}</span>
                            <button type="button" className="pn-mdl__close" style={{ width: 22, height: 22 }} onClick={() => setError(null)}><Icon name="x" size={13} /></button>
                        </div>
                    )}

                    <div className="pn-fhint">
                        Team members bound to this profile resolve their model + launch settings here. Editing this
                        profile re-points every bound member the next time they spawn.
                    </div>

                    <div className="pn-fld">
                        <span className="pn-flabel">Description</span>
                        <input
                            type="text"
                            className="pn-input"
                            placeholder="Optional — what this tier is for"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSaving}
                        />
                    </div>

                    <div className="pn-fld">
                        <span className="pn-flabel">Launch config <span style={{ opacity: 0.6, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>— {formatLaunchConfigLabel(launchConfig || undefined)}</span></span>
                        <div className="terminalLaunchDropdown terminalLaunchDropdown--inline">
                            <LaunchConfigDropdown
                                launchConfig={launchConfig}
                                activeTool={activeTool}
                                onActiveToolChange={setActiveTool}
                                onLaunchConfigChange={setLaunchConfig}
                                showAdvancedOptions
                            />
                        </div>
                    </div>
                </div>

                <div className="pn-mdl__foot">
                    <div className="pn-mdl__footL" />
                    <div className="pn-mdl__footR">
                        <button type="button" className="pn-btn pn-btn--ghost" onClick={handleClose} disabled={isSaving}>Cancel</button>
                        <button
                            type="button"
                            className="pn-btn pn-btn--primary"
                            onClick={handleSubmit}
                            disabled={isSaving || !name.trim()}
                        >
                            {isSaving ? (isEditMode ? "Saving..." : "Creating...") : isEditMode ? "Save Profile" : "Create Profile"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
