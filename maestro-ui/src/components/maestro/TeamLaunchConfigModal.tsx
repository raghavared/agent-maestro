import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    AgentTool, ModelType, TeamMember, MemberLaunchOverride,
    CreateTeamPayload,
} from "../../app/types/maestro";
import { ClaudeCodeSkillsSelector } from "./ClaudeCodeSkillsSelector";

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_TOOLS: AgentTool[] = ["claude-code", "codex", "gemini"];
const AGENT_TOOL_LABELS: Record<AgentTool, string> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
    "gemini": "Google Gemini",
};

const MODELS_BY_TOOL: Record<AgentTool, { value: ModelType; label: string }[]> = {
    "claude-code": [
        { value: "haiku", label: "Haiku" },
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
    ],
    "codex": [
        { value: "gpt-5.3-codex", label: "GPT 5.3" },
        { value: "gpt-5.2-codex", label: "GPT 5.2" },
    ],
    "gemini": [
        { value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
};

const DEFAULT_MODEL: Record<string, string> = {
    "claude-code": "sonnet",
    "codex": "gpt-5.3-codex",
    "gemini": "gemini-3-pro-preview",
};

const COMMAND_GROUPS = [
    { key: 'root', label: 'Root', commands: ['whoami', 'status', 'commands'] },
    { key: 'task', label: 'Task', commands: ['task:list', 'task:get', 'task:create', 'task:edit', 'task:delete', 'task:children', 'task:report:progress', 'task:report:complete', 'task:report:blocked', 'task:report:error', 'task:docs:add', 'task:docs:list'] },
    { key: 'session', label: 'Session', commands: ['session:siblings', 'session:info', 'session:prompt', 'session:report:progress', 'session:report:complete', 'session:report:blocked', 'session:report:error', 'session:docs:add', 'session:docs:list'] },
    { key: 'team-member', label: 'Team Member', commands: ['team-member:create', 'team-member:list', 'team-member:get'] },
    { key: 'show', label: 'Show', commands: ['show:modal'] },
    { key: 'modal', label: 'Modal', commands: ['modal:events'] },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamLaunchConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    coordinatorId: string | null;
    workerIds: string[];
    teamMembers: TeamMember[];
    projectId: string;
    onLaunch: (overrides: Record<string, MemberLaunchOverride>) => void;
    onSaveAsTeam: (teamName: string, overrides: Record<string, MemberLaunchOverride>) => void;
}

// Per-member local state
interface MemberConfig {
    agentTool: AgentTool;
    model: ModelType;
    isDangerous: boolean;
    skillIds: string[];
    commandOverrides: Record<string, boolean>;
    expanded: boolean; // whether this member's details panel is open
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamLaunchConfigModal({
    isOpen,
    onClose,
    coordinatorId,
    workerIds,
    teamMembers,
    projectId,
    onLaunch,
    onSaveAsTeam,
}: TeamLaunchConfigModalProps) {
    // Build initial configs from team members
    const buildInitialConfigs = useCallback((): Record<string, MemberConfig> => {
        const configs: Record<string, MemberConfig> = {};
        const allIds = [coordinatorId, ...workerIds].filter(Boolean) as string[];

        for (const id of allIds) {
            const member = teamMembers.find(m => m.id === id);
            if (!member) continue;

            const tool = (member.agentTool || 'claude-code') as AgentTool;
            configs[id] = {
                agentTool: tool,
                model: (member.model || DEFAULT_MODEL[tool] || 'sonnet') as ModelType,
                isDangerous: member.permissionMode === 'bypassPermissions',
                skillIds: member.skillIds ? [...member.skillIds] : [],
                commandOverrides: member.commandPermissions?.commands
                    ? { ...member.commandPermissions.commands }
                    : {},
                expanded: false,
            };
        }
        return configs;
    }, [coordinatorId, workerIds, teamMembers]);

    const [configs, setConfigs] = useState<Record<string, MemberConfig>>(() => buildInitialConfigs());
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [expandedCommandGroups, setExpandedCommandGroups] = useState<Set<string>>(new Set());

    // Reset state when modal opens with new members
    React.useEffect(() => {
        if (isOpen) {
            setConfigs(buildInitialConfigs());
            setShowSaveDialog(false);
            setTeamName('');
        }
    }, [isOpen, buildInitialConfigs]);

    const updateConfig = (memberId: string, patch: Partial<MemberConfig>) => {
        setConfigs(prev => ({
            ...prev,
            [memberId]: { ...prev[memberId], ...patch },
        }));
    };

    const handleToolChange = (memberId: string, tool: AgentTool) => {
        const defaultModel = (DEFAULT_MODEL[tool] || 'sonnet') as ModelType;
        updateConfig(memberId, { agentTool: tool, model: defaultModel });
    };

    const handleCommandToggle = (memberId: string, cmd: string) => {
        setConfigs(prev => {
            const current = prev[memberId];
            const newOverrides = { ...current.commandOverrides };
            if (newOverrides[cmd] === false) {
                delete newOverrides[cmd]; // restore default (enabled)
            } else {
                newOverrides[cmd] = false; // disable
            }
            return { ...prev, [memberId]: { ...current, commandOverrides: newOverrides } };
        });
    };

    const toggleCommandGroup = (groupKey: string) => {
        setExpandedCommandGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    const toggleMemberExpanded = (memberId: string) => {
        updateConfig(memberId, { expanded: !configs[memberId]?.expanded });
    };

    // Build overrides from configs
    const buildOverrides = (): Record<string, MemberLaunchOverride> => {
        const overrides: Record<string, MemberLaunchOverride> = {};
        for (const [id, config] of Object.entries(configs)) {
            const member = teamMembers.find(m => m.id === id);
            if (!member) continue;

            const override: MemberLaunchOverride = {};
            if (config.agentTool !== (member.agentTool || 'claude-code')) override.agentTool = config.agentTool;
            if (config.model !== (member.model || DEFAULT_MODEL[member.agentTool || 'claude-code'])) override.model = config.model;

            const expectedPerm = config.isDangerous ? 'bypassPermissions' : (member.permissionMode === 'bypassPermissions' ? 'acceptEdits' : member.permissionMode);
            if (expectedPerm !== member.permissionMode) override.permissionMode = expectedPerm as any;

            const origSkills = member.skillIds || [];
            if (JSON.stringify(config.skillIds.sort()) !== JSON.stringify([...origSkills].sort())) {
                override.skillIds = config.skillIds;
            }

            const origCmds = member.commandPermissions?.commands || {};
            if (JSON.stringify(config.commandOverrides) !== JSON.stringify(origCmds)) {
                override.commandPermissions = { commands: config.commandOverrides };
            }

            if (Object.keys(override).length > 0) {
                overrides[id] = override;
            }
        }
        return overrides;
    };

    const handleLaunch = () => {
        onLaunch(buildOverrides());
        onClose();
    };

    const handleSaveAsTeam = () => {
        if (!teamName.trim()) return;
        onSaveAsTeam(teamName.trim(), buildOverrides());
        onClose();
    };

    if (!isOpen) return null;

    const allMemberIds = [coordinatorId, ...workerIds].filter(Boolean) as string[];
    const members = allMemberIds
        .map(id => teamMembers.find(m => m.id === id))
        .filter(Boolean) as TeamMember[];

    return createPortal(
        <div className="themedModalBackdrop" onClick={onClose}>
            <div
                className="themedModal themedModal--wide launchConfigModal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="themedModalHeader">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span className="themedModalTitle">[ LAUNCH CONFIGURATION ]</span>
                        <span style={{ fontSize: '10px', color: 'rgba(var(--theme-primary-rgb), 0.4)' }}>
                            {members.length} member{members.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button className="themedModalClose" onClick={onClose}>{'\u00D7'}</button>
                </div>

                {/* Content */}
                <div className="themedModalContent" style={{ overflowY: 'auto', flex: 1 }}>
                    {members.length === 0 ? (
                        <div style={{ color: 'rgba(var(--theme-primary-rgb), 0.4)', textAlign: 'center', padding: '20px' }}>
                            No team members selected. Select a coordinator and workers first.
                        </div>
                    ) : (
                        <div className="launchConfigMembers">
                            {members.map((member) => {
                                const config = configs[member.id];
                                if (!config) return null;
                                const isCoordinator = member.id === coordinatorId;
                                const models = MODELS_BY_TOOL[config.agentTool] || [];

                                return (
                                    <div key={member.id} className={`launchConfigCard ${isCoordinator ? 'launchConfigCard--coordinator' : ''}`}>
                                        {/* Card header row */}
                                        <div className="launchConfigCardHeader">
                                            <div className="launchConfigCardIdentity">
                                                <span className="launchConfigCardAvatar">{member.avatar}</span>
                                                <div>
                                                    <span className="launchConfigCardName">{member.name}</span>
                                                    {isCoordinator && (
                                                        <span className="launchConfigBadge launchConfigBadge--coordinator">COORD</span>
                                                    )}
                                                    <span className="launchConfigCardRole">{member.role}</span>
                                                </div>
                                            </div>

                                            <div className="launchConfigCardControls">
                                                {/* Agent Tool */}
                                                <select
                                                    className="launchConfigSelect"
                                                    value={config.agentTool}
                                                    onChange={(e) => handleToolChange(member.id, e.target.value as AgentTool)}
                                                >
                                                    {AGENT_TOOLS.map(t => (
                                                        <option key={t} value={t}>{AGENT_TOOL_LABELS[t]}</option>
                                                    ))}
                                                </select>

                                                {/* Model */}
                                                <select
                                                    className="launchConfigSelect"
                                                    value={config.model}
                                                    onChange={(e) => updateConfig(member.id, { model: e.target.value as ModelType })}
                                                >
                                                    {models.map(m => (
                                                        <option key={m.value} value={m.value}>{m.label}</option>
                                                    ))}
                                                </select>

                                                {/* Dangerous mode toggle */}
                                                <button
                                                    className={`launchConfigToggle ${config.isDangerous ? 'launchConfigToggle--active launchConfigToggle--danger' : ''}`}
                                                    onClick={() => updateConfig(member.id, { isDangerous: !config.isDangerous })}
                                                    title={config.isDangerous ? 'Dangerous mode ON (bypassPermissions)' : 'Dangerous mode OFF'}
                                                >
                                                    {config.isDangerous ? '\u26A0 dangerous' : '\u{1F6E1} safe'}
                                                </button>

                                                {/* Expand/collapse */}
                                                <button
                                                    className="launchConfigExpandBtn"
                                                    onClick={() => toggleMemberExpanded(member.id)}
                                                    title={config.expanded ? 'Collapse' : 'Skills & Commands'}
                                                >
                                                    {config.expanded ? '\u25B2' : '\u25BC'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded details */}
                                        {config.expanded && (
                                            <div className="launchConfigCardDetails">
                                                {/* Skills */}
                                                <div className="launchConfigSection">
                                                    <ClaudeCodeSkillsSelector
                                                        selectedSkills={config.skillIds}
                                                        onSelectionChange={(skills) => updateConfig(member.id, { skillIds: skills })}
                                                    />
                                                </div>

                                                {/* Command Permissions */}
                                                <div className="launchConfigSection">
                                                    <div className="tmModal__permCard">
                                                        <div className="tmModal__permCardLabel">Command Permissions</div>
                                                        <div className="themedFormHint" style={{ marginBottom: '6px' }}>
                                                            All commands enabled by default. Toggle off to restrict.
                                                        </div>
                                                        {COMMAND_GROUPS.map(group => {
                                                            const isExpanded = expandedCommandGroups.has(`${member.id}:${group.key}`);
                                                            const disabledCount = group.commands.filter(c => config.commandOverrides[c] === false).length;
                                                            return (
                                                                <div key={group.key} style={{ marginBottom: '2px' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleCommandGroup(`${member.id}:${group.key}`)}
                                                                        style={{
                                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                                            fontSize: '11px', padding: '3px 0', color: 'var(--theme-text)',
                                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                                            width: '100%', fontFamily: '"JetBrains Mono", monospace',
                                                                        }}
                                                                    >
                                                                        <span style={{ color: 'rgba(var(--theme-primary-rgb), 0.5)', fontSize: '10px' }}>
                                                                            {isExpanded ? '\u25BC' : '\u25B6'}
                                                                        </span>
                                                                        <span style={{ fontWeight: 500 }}>{group.label}</span>
                                                                        <span style={{ opacity: 0.5, fontSize: '10px' }}>
                                                                            ({group.commands.length - disabledCount}/{group.commands.length})
                                                                        </span>
                                                                    </button>
                                                                    {isExpanded && (
                                                                        <div style={{ paddingLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', paddingTop: '4px', paddingBottom: '4px' }}>
                                                                            {group.commands.map(cmd => {
                                                                                const isDisabled = config.commandOverrides[cmd] === false;
                                                                                const isChecked = !isDisabled;
                                                                                return (
                                                                                    <label
                                                                                        key={cmd}
                                                                                        className="terminalTaskCheckbox"
                                                                                        style={{
                                                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                                                            cursor: 'pointer', opacity: isDisabled ? 0.5 : 1, marginRight: 0,
                                                                                        }}
                                                                                        onClick={(e) => { e.preventDefault(); handleCommandToggle(member.id, cmd); }}
                                                                                    >
                                                                                        <input type="checkbox" checked={isChecked} readOnly />
                                                                                        <span
                                                                                            className={`terminalTaskCheckmark ${isChecked ? 'terminalTaskCheckmark--checked' : ''}`}
                                                                                            style={{ width: '14px', height: '14px', fontSize: '9px' }}
                                                                                        >
                                                                                            {isChecked ? '\u2713' : ''}
                                                                                        </span>
                                                                                        <span style={{ fontSize: '10px', whiteSpace: 'nowrap', fontFamily: '"JetBrains Mono", monospace', color: 'var(--theme-text)' }}>
                                                                                            {cmd}
                                                                                        </span>
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="tmModal__footer">
                    <div className="tmModal__footerLeft" />
                    <div className="tmModal__footerRight">
                        <button type="button" className="themedBtn" onClick={onClose}>
                            Cancel
                        </button>

                        {!showSaveDialog ? (
                            <>
                                <button
                                    type="button"
                                    className="themedBtn"
                                    onClick={() => setShowSaveDialog(true)}
                                    title="Save this configuration as a reusable team"
                                >
                                    Save as Team
                                </button>
                                <button
                                    type="button"
                                    className="themedBtn themedBtnPrimary"
                                    onClick={handleLaunch}
                                    disabled={members.length === 0}
                                >
                                    Launch
                                </button>
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '5px 8px', fontSize: '11px', width: '160px' }}
                                    placeholder="Team name..."
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveAsTeam();
                                        if (e.key === 'Escape') setShowSaveDialog(false);
                                    }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="themedBtn"
                                    onClick={() => setShowSaveDialog(false)}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className="themedBtn themedBtnPrimary"
                                    onClick={handleSaveAsTeam}
                                    disabled={!teamName.trim()}
                                >
                                    Save & Launch
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
