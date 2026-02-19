import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { MentionsInput, Mention } from 'react-mentions';
import { AgentTool, AgentMode, ModelType, CreateTeamMemberPayload, WorkflowTemplate } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";
import { ClaudeCodeSkillsSelector } from "./ClaudeCodeSkillsSelector";

// Capability definitions
const CAPABILITY_DEFS = [
    { key: 'can_spawn_sessions', label: 'Spawn Sessions', desc: 'Can create new agent sessions' },
    { key: 'can_edit_tasks', label: 'Edit Tasks', desc: 'Can create/edit/delete tasks' },
    { key: 'can_report_task_level', label: 'Report Task-Level', desc: 'Can report progress on individual tasks' },
    { key: 'can_report_session_level', label: 'Report Session-Level', desc: 'Can report session-wide progress' },
] as const;

// Command group definitions
const COMMAND_GROUPS = [
    { key: 'root', label: 'Root', commands: ['whoami', 'status', 'commands'] },
    { key: 'task', label: 'Task', commands: ['task:list', 'task:get', 'task:create', 'task:edit', 'task:delete', 'task:children', 'task:report:progress', 'task:report:complete', 'task:report:blocked', 'task:report:error', 'task:docs:add', 'task:docs:list'] },
    { key: 'session', label: 'Session', commands: ['session:siblings', 'session:info', 'session:prompt', 'session:report:progress', 'session:report:complete', 'session:report:blocked', 'session:report:error', 'session:docs:add', 'session:docs:list'] },
    { key: 'team-member', label: 'Team Member', commands: ['team-member:create', 'team-member:list', 'team-member:get'] },
    { key: 'show', label: 'Show', commands: ['show:modal'] },
    { key: 'modal', label: 'Modal', commands: ['modal:events'] },
] as const;

function getDefaultCapabilities(mode: AgentMode): Record<string, boolean> {
    return {
        can_spawn_sessions: mode === 'coordinate',
        can_edit_tasks: true,
        can_report_task_level: true,
        can_report_session_level: true,
    };
}

type CreateTeamMemberModalProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
};

const AGENT_TOOLS: AgentTool[] = ["claude-code", "codex"];
const AGENT_TOOL_LABELS: Partial<Record<AgentTool, string>> = {
    "claude-code": "Claude Code",
    "codex": "OpenAI Codex",
};

const MODELS_BY_TOOL: Partial<Record<AgentTool, { value: ModelType; label: string }[]>> = {
    "claude-code": [
        { value: "haiku", label: "Haiku" },
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
    ],
    "codex": [
        { value: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
        { value: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
    ],
};

const DEFAULT_MODEL: Record<string, string> = {
    "claude-code": "sonnet",
    "codex": "gpt-5.3-codex",
};

// Style for react-mentions (matching CreateTaskModal)
const mentionsStyle = {
    control: {
        backgroundColor: 'transparent',
        fontSize: '12px',
        fontWeight: 'normal' as const,
        lineHeight: '1.5',
        minHeight: '120px',
        maxHeight: '300px',
    },
    '&multiLine': {
        control: {
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            minHeight: '120px',
            maxHeight: '300px',
        },
        highlighter: {
            padding: '8px 10px',
            border: '1px solid transparent',
            color: 'transparent',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            pointerEvents: 'none' as const,
            overflow: 'hidden' as const,
        },
        input: {
            padding: '8px 10px',
            border: '1px solid transparent',
            outline: 'none',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            maxHeight: '300px',
            overflow: 'auto' as const,
        },
    },
    suggestions: {
        list: {
            zIndex: 9999,
            width: '100%',
            maxWidth: '100%',
            left: 0,
            right: 0,
            boxSizing: 'border-box' as const,
        },
        item: {
            boxSizing: 'border-box' as const,
        },
    },
};

export function CreateTeamMemberModal({ isOpen, onClose, projectId }: CreateTeamMemberModalProps) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [avatar, setAvatar] = useState("🤖");
    const [identity, setIdentity] = useState("");
    const [agentTool, setAgentTool] = useState<AgentTool>("claude-code");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [mode, setMode] = useState<AgentMode>("execute");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [capabilities, setCapabilities] = useState<Record<string, boolean>>(() => getDefaultCapabilities('execute'));
    const [commandOverrides, setCommandOverrides] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [workflowTemplateId, setWorkflowTemplateId] = useState<string>('');
    const [useCustomWorkflow, setUseCustomWorkflow] = useState(false);
    const [customWorkflow, setCustomWorkflow] = useState('');
    const [permissionMode, setPermissionMode] = useState<'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions'>('acceptEdits');

    // Agent tool dropdown state (themed dropdown instead of raw <select>)
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const agentBtnRef = useRef<HTMLButtonElement>(null);
    const [agentDropdownPos, setAgentDropdownPos] = useState<{ top: number; left: number } | null>(null);

    const computeAgentDropdownPos = useCallback(() => {
        const btn = agentBtnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    }, []);

    useLayoutEffect(() => {
        if (showAgentDropdown) {
            setAgentDropdownPos(computeAgentDropdownPos());
        }
    }, [showAgentDropdown, computeAgentDropdownPos]);

    const createTeamMember = useMaestroStore(s => s.createTeamMember);
    const workflowTemplates = useMaestroStore(s => s.workflowTemplates);
    const fetchWorkflowTemplates = useMaestroStore(s => s.fetchWorkflowTemplates);

    // Fetch workflow templates on mount
    useEffect(() => {
        if (isOpen && workflowTemplates.length === 0) {
            fetchWorkflowTemplates();
        }
    }, [isOpen]);

    // Filter templates by current mode
    const filteredTemplates = workflowTemplates.filter(t => t.mode === mode);
    const selectedTemplate = workflowTemplates.find(t => t.id === workflowTemplateId);

    const handleCapabilityToggle = useCallback((key: string) => {
        setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleCommandToggle = useCallback((cmd: string) => {
        setCommandOverrides(prev => {
            const newOverrides = { ...prev };
            if (cmd in newOverrides) {
                delete newOverrides[cmd];
            } else {
                newOverrides[cmd] = false;
            }
            return newOverrides;
        });
    }, []);

    const toggleGroupExpanded = useCallback((group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    }, []);

    const toggleTab = (tab: string) => {
        setActiveTab(prev => prev === tab ? null : tab);
    };

    const resetForm = () => {
        setName("");
        setRole("");
        setAvatar("🤖");
        setIdentity("");
        setAgentTool("claude-code");
        setModel("sonnet");
        setMode("execute");
        setError(null);
        setActiveTab(null);
        setSelectedSkills([]);
        setCapabilities(getDefaultCapabilities('execute'));
        setCommandOverrides({});
        setExpandedGroups(new Set());
        setWorkflowTemplateId('');
        setUseCustomWorkflow(false);
        setCustomWorkflow('');
        setPermissionMode('acceptEdits');
        setShowAgentDropdown(false);
    };

    const handleClose = () => {
        if (!isCreating) {
            resetForm();
            onClose();
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        if (!role.trim()) {
            setError("Role is required");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // Build command permissions if any overrides exist
            const cmdPerms = Object.keys(commandOverrides).length > 0
                ? { commands: commandOverrides }
                : undefined;

            const payload: CreateTeamMemberPayload = {
                projectId,
                name: name.trim(),
                role: role.trim(),
                avatar: avatar.trim() || "🤖",
                identity: identity.trim(),
                agentTool,
                model,
                mode,
                permissionMode,
                capabilities,
                ...(selectedSkills.length > 0 && { skillIds: selectedSkills }),
                ...(cmdPerms && { commandPermissions: cmdPerms }),
                ...(useCustomWorkflow && customWorkflow.trim() ? { customWorkflow: customWorkflow.trim() } : workflowTemplateId ? { workflowTemplateId } : {}),
            };

            await createTeamMember(payload);
            resetForm();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create team member");
        } finally {
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (!isOpen) return null;

    const availableModels = MODELS_BY_TOOL[agentTool] || [];

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div
                className="themedModal themedModal--wide"
                onClick={(e) => e.stopPropagation()}
                style={{ overflow: 'hidden' }}
            >
                <div className="themedModalHeader">
                    <span className="themedModalTitle" style={{ flexShrink: 0 }}>[ NEW TEAM MEMBER ]</span>
                    <input
                        type="text"
                        className="themedFormInput"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            margin: 0,
                            padding: '6px 8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            boxSizing: 'border-box',
                        }}
                        placeholder="e.g., Frontend Dev"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isCreating}
                        autoFocus
                    />
                    <button className="themedModalClose" onClick={handleClose} disabled={isCreating}>×</button>
                </div>

                <div className="themedModalContent" style={{ overflowX: 'hidden' }}>
                    {error && (
                        <div className="terminalErrorBanner" style={{ marginBottom: '8px' }}>
                            <span className="terminalErrorSymbol">[ERROR]</span>
                            <span className="terminalErrorText">{error}</span>
                            <button className="terminalErrorClose" onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {/* Role & Avatar row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Role *</div>
                            <input
                                type="text"
                                className="themedFormInput"
                                style={{
                                    margin: 0,
                                    padding: '6px 8px',
                                    fontSize: '12px',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="e.g., frontend specialist, tester"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isCreating}
                            />
                        </div>
                        <div style={{ width: '70px', flexShrink: 0 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Avatar</div>
                            <input
                                type="text"
                                className="themedFormInput"
                                style={{
                                    margin: 0,
                                    padding: '6px 8px',
                                    fontSize: '16px',
                                    textAlign: 'center',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="🤖"
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                maxLength={2}
                                disabled={isCreating}
                            />
                        </div>
                    </div>

                    {/* Mode row */}
                    <div style={{ marginBottom: '8px' }}>
                        <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Mode</div>
                        <div className="themedSegmentedControl" style={{ margin: 0 }}>
                            <button
                                type="button"
                                className={`themedSegmentedBtn ${mode === 'execute' ? 'active' : ''}`}
                                onClick={() => {
                                    setMode('execute');
                                    setCapabilities(getDefaultCapabilities('execute'));
                                    setWorkflowTemplateId('');
                                }}
                                style={{ padding: '4px 12px', fontSize: '11px' }}
                                disabled={isCreating}
                            >
                                Worker
                            </button>
                            <button
                                type="button"
                                className={`themedSegmentedBtn ${mode === 'coordinate' ? 'active' : ''}`}
                                onClick={() => {
                                    setMode('coordinate');
                                    setCapabilities(getDefaultCapabilities('coordinate'));
                                    setWorkflowTemplateId('');
                                }}
                                style={{ padding: '4px 12px', fontSize: '11px' }}
                                disabled={isCreating}
                            >
                                Orchestrator
                            </button>
                        </div>
                    </div>

                    {/* Identity Prompt with MentionsInput */}
                    <div className="themedFormRow" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div className="themedFormLabel" style={{ marginBottom: '4px' }}>Identity (instructions)</div>
                        <div className="mentionsWrapper" style={{ flex: 1, minHeight: 0 }}>
                            <MentionsInput
                                value={identity}
                                onChange={(e) => setIdentity(e.target.value)}
                                style={mentionsStyle}
                                placeholder="Describe this team member's persona, expertise, and how they should approach tasks..."
                                className="mentionsInput"
                                onKeyDown={handleKeyDown}
                            >
                                <Mention
                                    trigger="@"
                                    data={[]}
                                    renderSuggestion={(entry, search, highlightedDisplay, index, focused) => (
                                        <div className={`suggestionItem ${focused ? 'focused' : ''}`}>
                                            {entry.display}
                                        </div>
                                    )}
                                />
                            </MentionsInput>
                        </div>
                    </div>
                </div>

                {/* Tab Content - between content and footer */}
                {activeTab && (
                    <div className="themedModalTabContent" style={{ maxHeight: '250px', overflowY: 'auto', borderTop: '1px solid var(--theme-border)' }}>
                        {/* Skills Tab */}
                        {activeTab === 'skills' && (
                            <ClaudeCodeSkillsSelector
                                selectedSkills={selectedSkills}
                                onSelectionChange={setSelectedSkills}
                            />
                        )}

                        {/* Capabilities & Permissions Tab */}
                        {activeTab === 'permissions' && (
                            <div style={{ overflowX: 'hidden' }}>
                                {/* Permission Mode */}
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Permission Mode</div>
                                <div style={{ marginBottom: '10px' }}>
                                    <select
                                        className="themedFormSelect"
                                        style={{
                                            margin: 0,
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            width: '100%',
                                            boxSizing: 'border-box' as const,
                                        }}
                                        value={permissionMode}
                                        onChange={(e) => setPermissionMode(e.target.value as typeof permissionMode)}
                                        disabled={isCreating}
                                    >
                                        <option value="acceptEdits">Accept Edits (default)</option>
                                        <option value="interactive">Interactive</option>
                                        <option value="readOnly">Read Only</option>
                                        <option value="bypassPermissions">Bypass — auto-approves all tool calls</option>
                                    </select>
                                    {permissionMode === 'bypassPermissions' && (
                                        <div style={{ fontSize: '10px', color: 'var(--theme-warning, #e8a030)', marginTop: '4px', fontFamily: '"JetBrains Mono", monospace' }}>
                                            ⚠ All tool calls will be auto-approved. Use for trusted coordinator roles.
                                        </div>
                                    )}
                                </div>

                                {/* Workflow Template */}
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Workflow</div>
                                <div style={{ marginBottom: '10px' }}>
                                    <select
                                        className="themedFormSelect"
                                        style={{
                                            margin: 0,
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            marginBottom: '4px',
                                        }}
                                        value={useCustomWorkflow ? '__custom__' : workflowTemplateId}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') {
                                                setUseCustomWorkflow(true);
                                                if (selectedTemplate) {
                                                    setCustomWorkflow(selectedTemplate.phases.map(p => `[${p.name}]\n${p.instruction}`).join('\n\n'));
                                                }
                                            } else {
                                                setUseCustomWorkflow(false);
                                                setWorkflowTemplateId(e.target.value);
                                            }
                                        }}
                                        disabled={isCreating}
                                    >
                                        <option value="">Default (auto from mode)</option>
                                        {filteredTemplates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                                        ))}
                                        <option value="__custom__">Custom workflow...</option>
                                    </select>
                                    {selectedTemplate && !useCustomWorkflow && (
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.7,
                                            padding: '6px 8px',
                                            border: '1px solid var(--theme-border)',
                                            borderRadius: '3px',
                                            maxHeight: '80px',
                                            overflow: 'auto',
                                        }}>
                                            {selectedTemplate.phases.map((p, i) => (
                                                <div key={i} style={{ marginBottom: i < selectedTemplate.phases.length - 1 ? '4px' : 0 }}>
                                                    <span style={{ fontWeight: 600 }}>{p.name}:</span> {p.instruction.substring(0, 80)}{p.instruction.length > 80 ? '...' : ''}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {useCustomWorkflow && (
                                        <textarea
                                            className="themedFormInput"
                                            style={{
                                                margin: 0,
                                                padding: '6px 8px',
                                                fontSize: '11px',
                                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                                minHeight: '80px',
                                                maxHeight: '150px',
                                                resize: 'vertical',
                                                width: '100%',
                                                boxSizing: 'border-box',
                                            }}
                                            placeholder="Enter custom workflow instructions..."
                                            value={customWorkflow}
                                            onChange={(e) => setCustomWorkflow(e.target.value)}
                                            disabled={isCreating}
                                        />
                                    )}
                                </div>

                                {/* Capabilities */}
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '6px' }}>Capabilities</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: '12px' }}>
                                    {CAPABILITY_DEFS.map(cap => {
                                        const isChecked = capabilities[cap.key] ?? false;
                                        return (
                                            <label
                                                key={cap.key}
                                                className="terminalTaskCheckbox"
                                                title={cap.desc}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginRight: 0 }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!isCreating) handleCapabilityToggle(cap.key);
                                                }}
                                            >
                                                <input type="checkbox" checked={isChecked} readOnly />
                                                <span className={`terminalTaskCheckmark ${isChecked ? 'terminalTaskCheckmark--checked' : ''}`}>
                                                    {isChecked ? '✓' : ''}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--theme-text)', fontFamily: '"JetBrains Mono", monospace' }}>
                                                    {cap.label}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* Command Permissions */}
                                <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Command Permissions</div>
                                <div className="themedFormHint" style={{ marginBottom: '6px' }}>
                                    All commands enabled by default. Toggle off individual commands to restrict.
                                </div>
                                {COMMAND_GROUPS.map(group => {
                                    const isExpanded = expandedGroups.has(group.key);
                                    const disabledCount = group.commands.filter(c => commandOverrides[c] === false).length;
                                    return (
                                        <div key={group.key} style={{ marginBottom: '2px' }}>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroupExpanded(group.key)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    padding: '3px 0',
                                                    color: 'var(--theme-text)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    width: '100%',
                                                    fontFamily: '"JetBrains Mono", monospace',
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
                                                        const isDisabled = commandOverrides[cmd] === false;
                                                        const isChecked = !isDisabled;
                                                        return (
                                                            <label
                                                                key={cmd}
                                                                className="terminalTaskCheckbox"
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    cursor: 'pointer',
                                                                    opacity: isDisabled ? 0.5 : 1,
                                                                    marginRight: 0,
                                                                }}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    if (!isCreating) handleCommandToggle(cmd);
                                                                }}
                                                            >
                                                                <input type="checkbox" checked={isChecked} readOnly />
                                                                <span className={`terminalTaskCheckmark ${isChecked ? 'terminalTaskCheckmark--checked' : ''}`} style={{ width: '14px', height: '14px', fontSize: '9px' }}>
                                                                    {isChecked ? '✓' : ''}
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
                        )}
                    </div>
                )}

                {/* Tab Bar - matching CreateTaskModal pattern */}
                <div className="themedModalTabBar" style={{ borderTop: '1px solid var(--theme-border)', marginTop: 'auto' }}>
                    <button
                        type="button"
                        className={`themedModalTab ${activeTab === 'skills' ? 'themedModalTab--active' : ''}`}
                        onClick={() => toggleTab('skills')}
                    >
                        Skills
                        {selectedSkills.length > 0 && (
                            <span className="themedModalTabBadge">{selectedSkills.length}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`themedModalTab ${activeTab === 'permissions' ? 'themedModalTab--active' : ''}`}
                        onClick={() => toggleTab('permissions')}
                    >
                        Permissions
                    </button>
                    {activeTab && (
                        <button
                            type="button"
                            className="themedModalTab themedModalTabClose"
                            onClick={() => setActiveTab(null)}
                            title="Collapse tab panel"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="themedFormActions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <div className="themedDropdownPicker" style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                                ref={agentBtnRef}
                                type="button"
                                className={`themedDropdownButton ${showAgentDropdown ? 'themedDropdownButton--open' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAgentDropdown(!showAgentDropdown);
                                }}
                                disabled={isCreating}
                            >
                                {AGENT_TOOL_LABELS[agentTool]}
                                <span className="themedDropdownCaret">{showAgentDropdown ? '\u25B4' : '\u25BE'}</span>
                            </button>
                            {showAgentDropdown && agentDropdownPos && createPortal(
                                <>
                                    <div
                                        className="themedDropdownOverlay"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAgentDropdown(false);
                                        }}
                                    />
                                    <div
                                        className="themedDropdownMenu"
                                        style={{ top: agentDropdownPos.top, left: agentDropdownPos.left }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {AGENT_TOOLS.map(tool => (
                                            <button
                                                key={tool}
                                                className={`themedDropdownOption ${tool === agentTool ? 'themedDropdownOption--current' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAgentTool(tool);
                                                    setModel(DEFAULT_MODEL[tool] as ModelType);
                                                    setShowAgentDropdown(false);
                                                }}
                                            >
                                                <span className="themedDropdownLabel">{AGENT_TOOL_LABELS[tool]}</span>
                                                {tool === agentTool && (
                                                    <span className="themedDropdownCheck">{'\u2713'}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                        <div className="themedSegmentedControl" style={{ margin: 0, flexShrink: 0 }}>
                            {availableModels.map(m => (
                                <button
                                    key={m.value}
                                    type="button"
                                    className={`themedSegmentedBtn ${model === m.value ? "active" : ""}`}
                                    onClick={() => setModel(m.value)}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                    disabled={isCreating}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button type="button" className="themedBtn" onClick={handleClose} disabled={isCreating}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="themedBtn themedBtnPrimary"
                        onClick={handleSubmit}
                        disabled={isCreating || !name.trim() || !role.trim()}
                    >
                        {isCreating ? "Creating..." : "Create Member"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
