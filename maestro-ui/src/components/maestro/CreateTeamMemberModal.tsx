import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AgentTool, AgentMode, ModelType, CreateTeamMemberPayload, WorkflowTemplate } from "../../app/types/maestro";
import { useMaestroStore } from "../../stores/useMaestroStore";

// Capability definitions
const CAPABILITY_DEFS = [
    { key: 'can_spawn_sessions', label: 'Spawn Sessions', desc: 'Can create new agent sessions' },
    { key: 'can_edit_tasks', label: 'Edit Tasks', desc: 'Can create/edit/delete tasks' },
    { key: 'can_use_queue', label: 'Use Queue', desc: 'Can use queue-based task processing' },
    { key: 'can_report_task_level', label: 'Report Task-Level', desc: 'Can report progress on individual tasks' },
    { key: 'can_report_session_level', label: 'Report Session-Level', desc: 'Can report session-wide progress' },
] as const;

// Command group definitions
const COMMAND_GROUPS = [
    { key: 'root', label: 'Root', commands: ['whoami', 'status', 'commands'] },
    { key: 'task', label: 'Task', commands: ['task:list', 'task:get', 'task:create', 'task:edit', 'task:delete', 'task:children', 'task:report:progress', 'task:report:complete', 'task:report:blocked', 'task:report:error', 'task:docs:add', 'task:docs:list'] },
    { key: 'session', label: 'Session', commands: ['session:info', 'session:report:progress', 'session:report:complete', 'session:report:blocked', 'session:report:error', 'session:docs:add', 'session:docs:list'] },
    { key: 'queue', label: 'Queue', commands: ['queue:status', 'queue:top', 'queue:start', 'queue:complete', 'queue:fail', 'queue:skip', 'queue:list', 'queue:push'] },
    { key: 'mail', label: 'Mail', commands: ['mail:send', 'mail:inbox', 'mail:reply'] },
    { key: 'show', label: 'Show', commands: ['show:modal'] },
    { key: 'modal', label: 'Modal', commands: ['modal:events'] },
] as const;

function getDefaultCapabilities(mode: AgentMode, strategy: string): Record<string, boolean> {
    return {
        can_spawn_sessions: mode === 'coordinate',
        can_edit_tasks: true,
        can_use_queue: mode === 'execute' && strategy === 'queue',
        can_report_task_level: true,
        can_report_session_level: true,
    };
}

type CreateTeamMemberModalProps = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
};

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
        { value: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
        { value: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
    ],
    "gemini": [
        { value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
        { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    ],
};

const DEFAULT_MODEL: Record<string, string> = {
    "claude-code": "sonnet",
    "codex": "gpt-5.3-codex",
    "gemini": "gemini-3-pro-preview",
};

export function CreateTeamMemberModal({ isOpen, onClose, projectId }: CreateTeamMemberModalProps) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [avatar, setAvatar] = useState("🤖");
    const [identity, setIdentity] = useState("");
    const [agentTool, setAgentTool] = useState<AgentTool>("claude-code");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [mode, setMode] = useState<AgentMode>("execute");
    const [strategy, setStrategy] = useState("simple");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [capabilities, setCapabilities] = useState<Record<string, boolean>>(() => getDefaultCapabilities('execute', 'simple'));
    const [commandOverrides, setCommandOverrides] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [workflowTemplateId, setWorkflowTemplateId] = useState<string>('');
    const [useCustomWorkflow, setUseCustomWorkflow] = useState(false);
    const [customWorkflow, setCustomWorkflow] = useState('');

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

    const resetForm = () => {
        setName("");
        setRole("");
        setAvatar("🤖");
        setIdentity("");
        setAgentTool("claude-code");
        setModel("sonnet");
        setMode("execute");
        setStrategy("simple");
        setError(null);
        setShowAdvanced(false);
        setCapabilities(getDefaultCapabilities('execute', 'simple'));
        setCommandOverrides({});
        setExpandedGroups(new Set());
        setWorkflowTemplateId('');
        setUseCustomWorkflow(false);
        setCustomWorkflow('');
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
                strategy,
                capabilities,
                ...(cmdPerms && { commandPermissions: cmdPerms }),
                ...(useCustomWorkflow && customWorkflow.trim() ? { customWorkflow: customWorkflow.trim() } : workflowTemplateId ? { workflowTemplateId } : {}),
            };

            await createTeamMember(payload);
            resetForm();
            onClose();
        } catch (err) {
            console.error("Failed to create team member:", err);
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

    const availableModels = MODELS_BY_TOOL[agentTool];

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

                    {/* Mode & Strategy row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Mode</div>
                            <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                <button
                                    type="button"
                                    className={`themedSegmentedBtn ${mode === 'execute' ? 'active' : ''}`}
                                    onClick={() => {
                                        setMode('execute');
                                        setStrategy('simple');
                                        setCapabilities(getDefaultCapabilities('execute', 'simple'));
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
                                        setStrategy('default');
                                        setCapabilities(getDefaultCapabilities('coordinate', 'default'));
                                        setWorkflowTemplateId('');
                                    }}
                                    style={{ padding: '4px 12px', fontSize: '11px' }}
                                    disabled={isCreating}
                                >
                                    Orchestrator
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Strategy</div>
                            <select
                                className="themedFormSelect"
                                style={{
                                    margin: 0,
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                                value={strategy}
                                onChange={(e) => {
                                    const newStrategy = e.target.value;
                                    setStrategy(newStrategy);
                                    setCapabilities(getDefaultCapabilities(mode, newStrategy));
                                }}
                                disabled={isCreating}
                            >
                                {mode === 'execute' ? (
                                    <>
                                        <option value="simple">Simple</option>
                                        <option value="queue">Queue</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="default">Default</option>
                                        <option value="intelligent-batching">Intelligent Batching</option>
                                        <option value="dag">DAG</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Identity Prompt */}
                    <div className="themedFormRow" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div className="themedFormLabel" style={{ marginBottom: '4px' }}>Identity (instructions)</div>
                        <div className="mentionsWrapper" style={{ flex: 1, minHeight: 0 }}>
                            <textarea
                                className="themedFormInput"
                                style={{
                                    margin: 0,
                                    padding: '8px 10px',
                                    fontSize: '12px',
                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                    lineHeight: '1.5',
                                    minHeight: '120px',
                                    maxHeight: '300px',
                                    resize: 'vertical',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                                placeholder="Optional: Describe this team member's persona, expertise, and how they should approach tasks..."
                                value={identity}
                                onChange={(e) => setIdentity(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isCreating}
                            />
                        </div>
                    </div>

                    {/* Advanced: Capabilities & Command Permissions */}
                    <div style={{ marginTop: '6px' }}>
                        <button
                            type="button"
                            className="themedBtn"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            style={{ fontSize: '10px', padding: '2px 8px', opacity: 0.8 }}
                        >
                            {showAdvanced ? '▾' : '▸'} Capabilities & Permissions
                        </button>
                    </div>

                    {showAdvanced && (
                        <div style={{
                            marginTop: '6px',
                            border: '1px solid var(--theme-border)',
                            borderRadius: '4px',
                            padding: '10px',
                            overflowX: 'hidden',
                        }}>
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
                                    <option value="">Default (auto from mode/strategy)</option>
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
                                        maxHeight: '100px',
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
                                            minHeight: '100px',
                                            maxHeight: '200px',
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
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Capabilities</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: '10px' }}>
                                {CAPABILITY_DEFS.map(cap => (
                                    <label key={cap.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }} title={cap.desc}>
                                        <input
                                            type="checkbox"
                                            checked={capabilities[cap.key] ?? false}
                                            onChange={() => handleCapabilityToggle(cap.key)}
                                            disabled={isCreating}
                                            style={{ margin: 0 }}
                                        />
                                        {cap.label}
                                    </label>
                                ))}
                            </div>

                            {/* Command Permissions */}
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Command Permissions</div>
                            <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px' }}>
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
                                                padding: '2px 0',
                                                color: 'var(--text-primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                width: '100%',
                                                fontFamily: '"JetBrains Mono", monospace',
                                            }}
                                        >
                                            <span>{isExpanded ? '▾' : '▸'}</span>
                                            <span style={{ fontWeight: 500 }}>{group.label}</span>
                                            <span style={{ opacity: 0.5, fontSize: '10px' }}>
                                                ({group.commands.length - disabledCount}/{group.commands.length})
                                            </span>
                                        </button>
                                        {isExpanded && (
                                            <div style={{ paddingLeft: '16px', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                                                {group.commands.map(cmd => {
                                                    const isDisabled = commandOverrides[cmd] === false;
                                                    return (
                                                        <label key={cmd} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '10px',
                                                            cursor: 'pointer',
                                                            opacity: isDisabled ? 0.5 : 1,
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!isDisabled}
                                                                onChange={() => handleCommandToggle(cmd)}
                                                                disabled={isCreating}
                                                                style={{ margin: 0 }}
                                                            />
                                                            {cmd}
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
