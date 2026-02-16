import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AgentTool, AgentMode, ModelType, TeamMember, UpdateTeamMemberPayload, WorkflowTemplate } from "../../app/types/maestro";
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

type EditTeamMemberModalProps = {
    isOpen: boolean;
    onClose: () => void;
    teamMember: TeamMember | null;
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

// Default configurations for the 5 default team members
const DEFAULT_CONFIGS: Record<string, { name: string; role: string; avatar: string; identity: string; agentTool: AgentTool; model: ModelType; mode: AgentMode; strategy: string }> = {
    simple_worker: {
        name: "Simple Worker",
        role: "Default executor",
        avatar: "⚡",
        identity: "You are a worker agent. You implement tasks directly — write code, run tests, fix bugs.",
        agentTool: "claude-code",
        model: "sonnet",
        mode: "execute",
        strategy: "simple",
    },
    queue_worker: {
        name: "Queue Worker",
        role: "Queue-based executor",
        avatar: "📋",
        identity: "You are a queue worker agent. You process tasks sequentially from a queue.",
        agentTool: "claude-code",
        model: "sonnet",
        mode: "execute",
        strategy: "queue",
    },
    coordinator: {
        name: "Coordinator",
        role: "Task orchestrator",
        avatar: "🎯",
        identity: "You are a coordinator agent. You break down complex tasks, assign work to team members, and track progress.",
        agentTool: "claude-code",
        model: "sonnet",
        mode: "coordinate",
        strategy: "default",
    },
    batch_coordinator: {
        name: "Batch Coordinator",
        role: "Intelligent batch orchestrator",
        avatar: "📦",
        identity: "You are a batch coordinator agent. You group related tasks into intelligent batches.",
        agentTool: "claude-code",
        model: "sonnet",
        mode: "coordinate",
        strategy: "intelligent-batching",
    },
    dag_coordinator: {
        name: "DAG Coordinator",
        role: "DAG-based orchestrator",
        avatar: "🔀",
        identity: "You are a DAG coordinator agent. You model task dependencies as a directed acyclic graph.",
        agentTool: "claude-code",
        model: "sonnet",
        mode: "coordinate",
        strategy: "dag",
    },
};

export function EditTeamMemberModal({ isOpen, onClose, teamMember, projectId }: EditTeamMemberModalProps) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [avatar, setAvatar] = useState("🤖");
    const [identity, setIdentity] = useState("");
    const [agentTool, setAgentTool] = useState<AgentTool>("claude-code");
    const [model, setModel] = useState<ModelType>("sonnet");
    const [mode, setMode] = useState<AgentMode>("execute");
    const [strategy, setStrategy] = useState("simple");
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [capabilities, setCapabilities] = useState<Record<string, boolean>>(() => getDefaultCapabilities('execute', 'simple'));
    const [commandOverrides, setCommandOverrides] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [workflowTemplateId, setWorkflowTemplateId] = useState<string>('');
    const [useCustomWorkflow, setUseCustomWorkflow] = useState(false);
    const [customWorkflow, setCustomWorkflow] = useState('');

    const updateTeamMember = useMaestroStore(s => s.updateTeamMember);
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

    // Populate form when team member changes
    useEffect(() => {
        if (teamMember) {
            setName(teamMember.name);
            setRole(teamMember.role);
            setAvatar(teamMember.avatar);
            setIdentity(teamMember.identity);
            setAgentTool(teamMember.agentTool || "claude-code");
            setModel(teamMember.model || "sonnet");
            setMode(teamMember.mode || "execute");
            setStrategy(teamMember.strategy || "simple");
            setError(null);
            // Load capabilities (from member or compute defaults)
            const memberMode = teamMember.mode || 'execute';
            const memberStrategy = teamMember.strategy || 'simple';
            setCapabilities(
                teamMember.capabilities
                    ? { ...getDefaultCapabilities(memberMode, memberStrategy), ...teamMember.capabilities }
                    : getDefaultCapabilities(memberMode, memberStrategy)
            );
            // Load command overrides
            setCommandOverrides(teamMember.commandPermissions?.commands || {});
            // Load workflow settings
            if (teamMember.customWorkflow) {
                setUseCustomWorkflow(true);
                setCustomWorkflow(teamMember.customWorkflow);
                setWorkflowTemplateId('');
            } else {
                setUseCustomWorkflow(false);
                setCustomWorkflow('');
                setWorkflowTemplateId(teamMember.workflowTemplateId || '');
            }
            setShowAdvanced(false);
            setExpandedGroups(new Set());
        } else {
            setName("");
            setRole("");
            setAvatar("🤖");
            setIdentity("");
            setAgentTool("claude-code");
            setModel("sonnet");
            setMode("execute");
            setStrategy("simple");
            setError(null);
            setCapabilities(getDefaultCapabilities('execute', 'simple'));
            setCommandOverrides({});
            setWorkflowTemplateId('');
            setUseCustomWorkflow(false);
            setCustomWorkflow('');
            setShowAdvanced(false);
            setExpandedGroups(new Set());
        }
    }, [teamMember]);

    const handleClose = () => {
        if (!isUpdating) {
            setError(null);
            onClose();
        }
    };

    const handleResetToDefault = () => {
        if (!teamMember || !teamMember.isDefault) return;

        // Extract the type from the ID (format: tm_{projectId}_{type})
        const idParts = teamMember.id.split('_');
        const type = idParts.slice(2).join('_'); // Everything after tm_{projectId}
        const defaults = DEFAULT_CONFIGS[type];

        if (defaults) {
            setName(defaults.name);
            setRole(defaults.role);
            setAvatar(defaults.avatar);
            setIdentity(defaults.identity);
            setAgentTool(defaults.agentTool);
            setModel(defaults.model);
            setMode(defaults.mode);
            setStrategy(defaults.strategy);
            setCapabilities(getDefaultCapabilities(defaults.mode, defaults.strategy));
            setCommandOverrides({});
            setWorkflowTemplateId('');
            setUseCustomWorkflow(false);
            setCustomWorkflow('');
        }
    };

    const handleSubmit = async () => {
        if (!teamMember) return;

        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        if (!role.trim()) {
            setError("Role is required");
            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            // Build command permissions if any overrides exist
            const cmdPerms = Object.keys(commandOverrides).length > 0
                ? { commands: commandOverrides }
                : undefined;

            const payload: UpdateTeamMemberPayload = {
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
                workflowTemplateId: useCustomWorkflow ? undefined : (workflowTemplateId || undefined),
                customWorkflow: useCustomWorkflow && customWorkflow.trim() ? customWorkflow.trim() : undefined,
            };

            await updateTeamMember(teamMember.id, projectId, payload);
            handleClose();
        } catch (err) {
            console.error("Failed to update team member:", err);
            setError(err instanceof Error ? err.message : "Failed to update team member");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (!isOpen || !teamMember) return null;

    const availableModels = MODELS_BY_TOOL[agentTool];
    const isDefault = teamMember.isDefault;

    return createPortal(
        <div className="themedModalBackdrop" onClick={handleClose}>
            <div className="themedModal themedModal--wide" onClick={(e) => e.stopPropagation()}>
                <div className="themedModalHeader">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        {isDefault && (
                            <span className="themedTaskStatusBadge" data-status="in_progress" style={{ flexShrink: 0, padding: '4px 8px', fontSize: '10px', lineHeight: '1' }}>
                                DEFAULT
                            </span>
                        )}
                        <span className="themedModalTitle" style={{ flexShrink: 0 }}>[ EDIT TEAM MEMBER ]</span>
                        <input
                            type="text"
                            className="themedFormInput"
                            style={{ flex: 1, margin: 0, padding: '6px 8px', fontSize: '13px', fontWeight: 600 }}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isUpdating || isDefault}
                        />
                    </div>
                    <button className="themedModalClose" onClick={handleClose} disabled={isUpdating}>×</button>
                </div>

                <div className="themedModalContent">
                    {error && (
                        <div className="terminalErrorBanner" style={{ marginBottom: '8px' }}>
                            <span className="terminalErrorSymbol">[ERROR]</span>
                            <span className="terminalErrorText">{error}</span>
                            <button className="terminalErrorClose" onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {isDefault && (
                        <div className="themedFormHint" style={{ marginBottom: '8px' }}>
                            Default team member — name cannot be changed. You can customize all other fields.
                        </div>
                    )}

                    {/* Role & Avatar row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ flex: 1 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Role *</div>
                            <input
                                type="text"
                                className="themedFormInput"
                                style={{ margin: 0, padding: '4px 8px', fontSize: '12px' }}
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isUpdating}
                            />
                        </div>
                        <div style={{ width: '80px' }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Avatar</div>
                            <input
                                type="text"
                                className="themedFormInput"
                                style={{ margin: 0, padding: '4px 8px', fontSize: '16px', textAlign: 'center' }}
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                maxLength={2}
                                disabled={isUpdating}
                            />
                        </div>
                    </div>

                    {/* Mode & Strategy row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ flex: 1 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Mode</div>
                            {isDefault ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
                                    <span className={`splitPlayDropdown__modeBadge splitPlayDropdown__modeBadge--${mode}`} style={{ fontSize: '11px' }}>
                                        {mode === 'execute' ? 'Worker' : 'Orchestrator'}
                                    </span>
                                    <span style={{ fontSize: '10px', opacity: 0.6 }}>(read-only for defaults)</span>
                                </div>
                            ) : (
                                <div className="themedSegmentedControl" style={{ margin: 0 }}>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${mode === 'execute' ? 'active' : ''}`}
                                        onClick={() => {
                                            setMode('execute');
                                            setStrategy('simple');
                                        }}
                                        style={{ padding: '4px 12px', fontSize: '11px' }}
                                        disabled={isUpdating}
                                    >
                                        Worker
                                    </button>
                                    <button
                                        type="button"
                                        className={`themedSegmentedBtn ${mode === 'coordinate' ? 'active' : ''}`}
                                        onClick={() => {
                                            setMode('coordinate');
                                            setStrategy('default');
                                        }}
                                        style={{ padding: '4px 12px', fontSize: '11px' }}
                                        disabled={isUpdating}
                                    >
                                        Orchestrator
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '2px' }}>Strategy</div>
                            {isDefault ? (
                                <div style={{ padding: '4px 0', fontSize: '11px', opacity: 0.8 }}>
                                    {strategy}
                                </div>
                            ) : (
                                <select
                                    className="themedFormInput"
                                    style={{ margin: 0, padding: '4px 8px', fontSize: '11px' }}
                                    value={strategy}
                                    onChange={(e) => setStrategy(e.target.value)}
                                    disabled={isUpdating}
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
                            )}
                        </div>
                    </div>

                    {/* Identity Prompt */}
                    <div className="themedFormRow" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div className="themedFormLabel" style={{ marginBottom: 0 }}>Identity (instructions)</div>
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
                                placeholder="Describe this team member's persona, expertise, and how they should approach tasks..."
                                value={identity}
                                onChange={(e) => setIdentity(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isUpdating}
                            />
                        </div>
                    </div>

                    {/* Advanced: Capabilities & Command Permissions */}
                    <div style={{ marginTop: '4px' }}>
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
                        <div style={{ marginTop: '4px', border: '1px solid var(--border-secondary)', borderRadius: '4px', padding: '8px' }}>
                            {/* Workflow Template */}
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Workflow</div>
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <select
                                        className="themedFormInput"
                                        style={{ margin: 0, padding: '4px 8px', fontSize: '11px', flex: 1 }}
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
                                        disabled={isUpdating}
                                    >
                                        <option value="">Default (auto from mode/strategy)</option>
                                        {filteredTemplates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                                        ))}
                                        <option value="__custom__">Custom workflow...</option>
                                    </select>
                                </div>
                                {selectedTemplate && !useCustomWorkflow && (
                                    <div style={{ fontSize: '10px', opacity: 0.7, padding: '4px 8px', border: '1px solid var(--border-secondary)', borderRadius: '3px', maxHeight: '100px', overflow: 'auto' }}>
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
                                            margin: 0, padding: '6px 8px', fontSize: '11px',
                                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                            minHeight: '100px', maxHeight: '200px', resize: 'vertical',
                                            width: '100%', boxSizing: 'border-box',
                                        }}
                                        placeholder="Enter custom workflow instructions..."
                                        value={customWorkflow}
                                        onChange={(e) => setCustomWorkflow(e.target.value)}
                                        disabled={isUpdating}
                                    />
                                )}
                            </div>

                            {/* Capabilities */}
                            <div className="themedFormLabel" style={{ fontSize: '10px', marginBottom: '4px' }}>Capabilities</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: '8px' }}>
                                {CAPABILITY_DEFS.map(cap => (
                                    <label key={cap.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }} title={cap.desc}>
                                        <input
                                            type="checkbox"
                                            checked={capabilities[cap.key] ?? false}
                                            onChange={() => handleCapabilityToggle(cap.key)}
                                            disabled={isUpdating}
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
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: '11px', padding: '2px 0', color: 'var(--text-primary)',
                                                display: 'flex', alignItems: 'center', gap: '4px', width: '100%',
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
                                                        <label key={cmd} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer', opacity: isDisabled ? 0.5 : 1 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!isDisabled}
                                                                onChange={() => handleCommandToggle(cmd)}
                                                                disabled={isUpdating}
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

                <div className="themedFormActions" style={{ flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                        <select
                            className="themedFormInput"
                            style={{ margin: 0, padding: '2px 8px', fontSize: '10px', width: 'auto', minWidth: '100px' }}
                            value={agentTool}
                            onChange={(e) => {
                                const newTool = e.target.value as AgentTool;
                                setAgentTool(newTool);
                                setModel(DEFAULT_MODEL[newTool] as ModelType);
                            }}
                            disabled={isUpdating}
                        >
                            {AGENT_TOOLS.map(tool => (
                                <option key={tool} value={tool}>
                                    {AGENT_TOOL_LABELS[tool]}
                                </option>
                            ))}
                        </select>
                        <div className="themedSegmentedControl" style={{ margin: 0 }}>
                            {availableModels.map(m => (
                                <button
                                    key={m.value}
                                    type="button"
                                    className={`themedSegmentedBtn ${model === m.value ? "active" : ""}`}
                                    onClick={() => setModel(m.value)}
                                    style={{ padding: '2px 8px', fontSize: '10px' }}
                                    disabled={isUpdating}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {isDefault && (
                        <button
                            type="button"
                            className="themedBtn themedBtnDanger"
                            onClick={handleResetToDefault}
                            disabled={isUpdating}
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                        >
                            Reset Default
                        </button>
                    )}
                    <button type="button" className="themedBtn" onClick={handleClose} disabled={isUpdating}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="themedBtn themedBtnPrimary"
                        onClick={handleSubmit}
                        disabled={isUpdating}
                    >
                        {isUpdating ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
