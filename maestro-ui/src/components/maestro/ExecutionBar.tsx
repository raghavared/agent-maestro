import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { MaestroTask, TeamMember, WorkerStrategy, OrchestratorStrategy, AgentTool, ModelType, ClaudeModel, CodexModel } from "../../app/types/maestro";
import { WhoamiPreview } from "./WhoamiPreview";

type ExecutionMode = 'none' | 'execute' | 'orchestrate';

type LaunchOverride = { agentTool: AgentTool; model: ModelType };

const AGENT_TOOLS: { id: AgentTool; label: string; symbol: string; models: { id: ModelType; label: string }[] }[] = [
    {
        id: 'claude-code',
        label: 'Claude Code',
        symbol: '◈',
        models: [
            { id: 'haiku' as ClaudeModel, label: 'Haiku' },
            { id: 'sonnet' as ClaudeModel, label: 'Sonnet' },
            { id: 'opus' as ClaudeModel, label: 'Opus' },
        ],
    },
    {
        id: 'codex',
        label: 'Codex',
        symbol: '◇',
        models: [
            { id: 'gpt-5.2-codex' as CodexModel, label: 'GPT 5.2' },
            { id: 'gpt-5.3-codex' as CodexModel, label: 'GPT 5.3' },
        ],
    },
];

type ExecutionBarProps = {
    isActive: boolean;
    onActivate: () => void;
    onCancel: () => void;
    onExecute: (teamMemberId?: string, override?: LaunchOverride) => void;
    onOrchestrate: (coordinatorId?: string, workerIds?: string[], override?: LaunchOverride) => void;
    selectedCount: number;
    activeMode?: ExecutionMode;
    onActivateOrchestrate: () => void;
    selectedTasks?: MaestroTask[];
    projectId?: string;
    teamMembers?: TeamMember[];
};

// Hook to compute portal menu position from a trigger button ref
function useDropdownPosition(triggerRef: React.RefObject<HTMLButtonElement | null>, isOpen: boolean) {
    const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null);

    const updatePos = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const rightOffset = window.innerWidth - rect.right;
            setPos({ top: rect.bottom + 2, right: rightOffset, width: rect.width });
        }
    }, [triggerRef]);

    useEffect(() => {
        if (isOpen) {
            updatePos();
        }
    }, [isOpen, updatePos]);

    return pos;
}

// Reusable single-select dropdown - renders menu via portal
function TeamMemberDropdown({
    label,
    members,
    selectedId,
    onSelect,
    accentColor,
}: {
    label: string;
    members: TeamMember[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    accentColor?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const pos = useDropdownPosition(triggerRef, isOpen);

    const selected = members.find(m => m.id === selectedId);

    return (
        <div className="executionBarDropdown">
            <button
                ref={triggerRef}
                className="executionBarDropdownTrigger"
                onClick={() => setIsOpen(!isOpen)}
                style={accentColor ? { borderColor: isOpen ? accentColor : undefined } : undefined}
            >
                <span className="executionBarDropdownLabel">{label}:</span>
                <span className="executionBarDropdownValue">
                    {selected ? (
                        <>{selected.avatar} {selected.name}</>
                    ) : (
                        <span className="executionBarDropdownPlaceholder">select...</span>
                    )}
                </span>
                <span className="executionBarDropdownArrow">{isOpen ? '\u25B4' : '\u25BE'}</span>
            </button>
            {isOpen && pos && createPortal(
                <>
                    {/* Full-screen backdrop to capture all clicks outside */}
                    <div
                        className="executionBarDropdownBackdrop"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        ref={menuRef}
                        className="executionBarDropdownMenu executionBarDropdownMenu--portal"
                        style={{ top: pos.top, right: pos.right, minWidth: pos.width }}
                    >
                        {members.length === 0 ? (
                            <div className="executionBarDropdownEmpty">No members available</div>
                        ) : (
                            members.map(member => (
                                <button
                                    key={member.id}
                                    className={`executionBarDropdownOption ${selectedId === member.id ? 'executionBarDropdownOption--selected' : ''}`}
                                    onClick={() => {
                                        onSelect(selectedId === member.id ? null : member.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span className="executionBarDropdownOptionAvatar">{member.avatar}</span>
                                    <span className="executionBarDropdownOptionName">{member.name}</span>
                                    <span className="executionBarDropdownOptionMeta">
                                        {member.role}
                                        {member.model && ` \u00B7 ${member.model}`}
                                    </span>
                                    {selectedId === member.id && (
                                        <span className="executionBarDropdownCheck">{'\u2713'}</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

// Multi-select dropdown for workers - renders menu via portal
function TeamMemberMultiDropdown({
    label,
    members,
    selectedIds,
    onToggle,
    onSelectAll,
    onClearAll,
    accentColor,
}: {
    label: string;
    members: TeamMember[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    accentColor?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const pos = useDropdownPosition(triggerRef, isOpen);

    const selectedMembers = members.filter(m => selectedIds.has(m.id));

    return (
        <div className="executionBarDropdown">
            <button
                ref={triggerRef}
                className="executionBarDropdownTrigger"
                onClick={() => setIsOpen(!isOpen)}
                style={accentColor ? { borderColor: isOpen ? accentColor : undefined } : undefined}
            >
                <span className="executionBarDropdownLabel">{label}:</span>
                <span className="executionBarDropdownValue">
                    {selectedMembers.length > 0 ? (
                        <>{selectedMembers.map(m => m.avatar).join(' ')} {selectedMembers.length} selected</>
                    ) : (
                        <span className="executionBarDropdownPlaceholder">select...</span>
                    )}
                </span>
                <span className="executionBarDropdownArrow">{isOpen ? '\u25B4' : '\u25BE'}</span>
            </button>
            {isOpen && pos && createPortal(
                <>
                    {/* Full-screen backdrop to capture all clicks outside */}
                    <div
                        className="executionBarDropdownBackdrop"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        ref={menuRef}
                        className="executionBarDropdownMenu executionBarDropdownMenu--portal"
                        style={{ top: pos.top, right: pos.right, minWidth: pos.width }}
                    >
                        {members.length === 0 ? (
                            <div className="executionBarDropdownEmpty">No members available</div>
                        ) : (
                            <>
                                <div className="executionBarDropdownActions">
                                    <button className="executionBarDropdownActionBtn" onClick={onSelectAll}>select all</button>
                                    <button className="executionBarDropdownActionBtn" onClick={onClearAll}>clear</button>
                                </div>
                                {members.map(member => (
                                    <button
                                        key={member.id}
                                        className={`executionBarDropdownOption ${selectedIds.has(member.id) ? 'executionBarDropdownOption--selected' : ''}`}
                                        onClick={() => onToggle(member.id)}
                                    >
                                        <span className={`executionBarDropdownCheckbox ${selectedIds.has(member.id) ? 'executionBarDropdownCheckbox--checked' : ''}`}>
                                            {selectedIds.has(member.id) ? '\u2713' : ''}
                                        </span>
                                        <span className="executionBarDropdownOptionAvatar">{member.avatar}</span>
                                        <span className="executionBarDropdownOptionName">{member.name}</span>
                                        <span className="executionBarDropdownOptionMeta">
                                            {member.role}
                                            {member.model && ` \u00B7 ${member.model}`}
                                        </span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

export function ExecutionBar({
    isActive,
    onActivate,
    onCancel,
    onExecute,
    onOrchestrate,
    selectedCount,
    activeMode = 'none',
    onActivateOrchestrate,
    selectedTasks = [],
    projectId = '',
    teamMembers = [],
}: ExecutionBarProps) {
    // Execute mode: single team member selection
    const [selectedExecuteMemberId, setSelectedExecuteMemberId] = useState<string | null>(null);

    // Orchestrate mode: coordinator (single) + workers (multi)
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string | null>(null);
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());

    // Launch override (model/tool override for the session)
    const [launchOverride, setLaunchOverride] = useState<LaunchOverride | null>(null);
    const [showLaunchDropdown, setShowLaunchDropdown] = useState(false);
    const [expandedTool, setExpandedTool] = useState<AgentTool | null>(null);
    const launchBtnRef = useRef<HTMLButtonElement>(null);
    const [launchDropdownPos, setLaunchDropdownPos] = useState<{ top?: number; bottom?: number; right: number; openDirection: 'down' | 'up' } | null>(null);

    const computeLaunchPos = useCallback(() => {
        const btn = launchBtnRef.current;
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const rightOffset = window.innerWidth - rect.right;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceAbove >= 200 || spaceAbove >= spaceBelow) {
            return { bottom: (window.innerHeight - rect.top) + 4, right: rightOffset, openDirection: 'up' as const };
        } else {
            return { top: rect.bottom + 4, right: rightOffset, openDirection: 'down' as const };
        }
    }, []);

    useLayoutEffect(() => {
        if (showLaunchDropdown) {
            setLaunchDropdownPos(computeLaunchPos());
        }
    }, [showLaunchDropdown, computeLaunchPos]);

    const activeMembers = teamMembers.filter(m => m.status === 'active' && (!projectId || m.projectId === projectId));

    // For orchestrate: coordinators have mode=coordinate, workers have mode=execute
    const coordinatorMembers = activeMembers.filter(m => m.mode === 'coordinate');
    const workerMembers = activeMembers.filter(m => m.mode === 'execute' || !m.mode);

    // Derive strategy from selected team member for WhoamiPreview
    const selectedExecuteMember = activeMembers.find(m => m.id === selectedExecuteMemberId);
    const selectedCoordinator = coordinatorMembers.find(m => m.id === selectedCoordinatorId);

    // Effective model: override > selected team member's model
    const effectiveExecuteModel = launchOverride?.model || selectedExecuteMember?.model || null;
    const effectiveCoordinatorModel = launchOverride?.model || selectedCoordinator?.model || null;

    // Reset override when team member changes
    const handleSelectExecuteMember = (id: string | null) => {
        setSelectedExecuteMemberId(id);
        setLaunchOverride(null);
    };

    const handleSelectCoordinator = (id: string | null) => {
        setSelectedCoordinatorId(id);
        setLaunchOverride(null);
    };

    if (!isActive) {
        return (
            <div className="executionBar executionBar--inactive">
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={onActivate}
                >
                    <span className="terminalPrompt">$</span> execute
                </button>
                <button
                    className="terminalCmd terminalCmdOrchestrate"
                    onClick={onActivateOrchestrate}
                >
                    <span className="terminalPrompt">$</span> orchestrate
                </button>
            </div>
        );
    }

    // Shared launch dropdown portal
    const launchDropdownPortal = showLaunchDropdown && launchDropdownPos && createPortal(
        <>
            <div
                className="executionBarDropdownBackdrop"
                onClick={() => setShowLaunchDropdown(false)}
            />
            <div
                className={`terminalLaunchDropdown terminalLaunchDropdown--fixed ${launchDropdownPos.openDirection === 'up' ? 'terminalInlineDropdown--openUp' : ''}`}
                style={{
                    ...(launchDropdownPos.openDirection === 'down'
                        ? { top: launchDropdownPos.top }
                        : { bottom: launchDropdownPos.bottom }),
                    right: launchDropdownPos.right,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="terminalLaunchDropdown__header">Launch With</div>
                {AGENT_TOOLS.map((tool) => (
                    <div key={tool.id} className="terminalLaunchDropdown__toolGroup">
                        <button
                            className={`terminalLaunchDropdown__tool ${expandedTool === tool.id ? 'terminalLaunchDropdown__tool--expanded' : ''}`}
                            onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                        >
                            <span className="terminalLaunchDropdown__toolSymbol">{tool.symbol}</span>
                            <span className="terminalLaunchDropdown__toolLabel">{tool.label}</span>
                            <span className="terminalLaunchDropdown__toolCaret">{expandedTool === tool.id ? '▴' : '▸'}</span>
                        </button>
                        {expandedTool === tool.id && (
                            <div className="terminalLaunchDropdown__models">
                                {tool.models.map((model) => (
                                    <button
                                        key={model.id}
                                        className={`terminalLaunchDropdown__model ${launchOverride?.model === model.id && launchOverride?.agentTool === tool.id ? 'terminalLaunchDropdown__model--selected' : ''}`}
                                        onClick={() => {
                                            setShowLaunchDropdown(false);
                                            setLaunchOverride({ agentTool: tool.id, model: model.id });
                                        }}
                                    >
                                        {model.label}
                                        {launchOverride?.model === model.id && launchOverride?.agentTool === tool.id && (
                                            <span style={{ marginLeft: 'auto', color: 'var(--terminal-green)' }}> ✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {launchOverride && (
                    <>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                        <button
                            className="terminalLaunchDropdown__model"
                            style={{ color: 'var(--terminal-text-dim)', paddingLeft: 10 }}
                            onClick={() => {
                                setShowLaunchDropdown(false);
                                setLaunchOverride(null);
                            }}
                        >
                            ✕ Clear override
                        </button>
                    </>
                )}
            </div>
        </>,
        document.body
    );

    if (activeMode === 'orchestrate') {
        const totalWorkerCount = selectedWorkerIds.size;

        return (
            <>
                <div className="executionBar executionBar--active executionBar--orchestrate executionBar--column">
                    <div className="executionBarDropdowns">
                        <TeamMemberDropdown
                            label="Coordinator"
                            members={coordinatorMembers}
                            selectedId={selectedCoordinatorId}
                            onSelect={handleSelectCoordinator}
                            accentColor="var(--terminal-amber, #ffab00)"
                        />
                        <TeamMemberMultiDropdown
                            label="Workers"
                            members={workerMembers}
                            selectedIds={selectedWorkerIds}
                            onToggle={(id) => {
                                setSelectedWorkerIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                });
                            }}
                            onSelectAll={() => setSelectedWorkerIds(new Set(workerMembers.map(m => m.id)))}
                            onClearAll={() => setSelectedWorkerIds(new Set())}
                            accentColor="var(--terminal-amber, #ffab00)"
                        />
                    </div>
                    <div className="executionBarRow">
                        {effectiveCoordinatorModel && (
                            <span className={`executionBarModelBadge ${launchOverride ? 'executionBarModelBadge--override' : ''}`}>
                                {effectiveCoordinatorModel}
                            </span>
                        )}
                        <div className="executionBarActions">
                            <button className="terminalCmd" onClick={onCancel}>cancel</button>
                            <div className="executionBarSplitBtn">
                                <button
                                    className="terminalCmd terminalCmdOrchestrate executionBarSplitBtn__main"
                                    onClick={() => onOrchestrate(
                                        selectedCoordinatorId || undefined,
                                        selectedWorkerIds.size > 0 ? Array.from(selectedWorkerIds) : undefined,
                                        launchOverride || undefined,
                                    )}
                                    disabled={selectedCount === 0}
                                >
                                    <span className="terminalPrompt">$</span> orchestrate ({selectedCount} task{selectedCount !== 1 ? "s" : ""}{totalWorkerCount > 0 ? `, ${totalWorkerCount} worker${totalWorkerCount !== 1 ? 's' : ''}` : ''})
                                </button>
                                <button
                                    ref={launchBtnRef}
                                    className={`terminalCmd terminalCmdOrchestrate executionBarSplitBtn__caret ${showLaunchDropdown ? 'executionBarSplitBtn__caret--open' : ''}`}
                                    onClick={() => {
                                        setShowLaunchDropdown(!showLaunchDropdown);
                                        setExpandedTool(null);
                                    }}
                                    title="Launch options"
                                >
                                    ▾
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {launchDropdownPortal}
                {selectedTasks.length > 0 && projectId && (
                    <WhoamiPreview
                        mode="orchestrate"
                        strategy={(selectedCoordinator?.strategy || 'default') as OrchestratorStrategy}
                        selectedTasks={selectedTasks}
                        projectId={projectId}
                    />
                )}
            </>
        );
    }

    // Default: execute mode
    return (
        <>
            <div className="executionBar executionBar--active executionBar--column">
                <div className="executionBarDropdowns">
                    <TeamMemberDropdown
                        label="Team Member"
                        members={activeMembers}
                        selectedId={selectedExecuteMemberId}
                        onSelect={handleSelectExecuteMember}
                    />
                </div>
                <div className="executionBarRow">
                    {effectiveExecuteModel && (
                        <span className={`executionBarModelBadge ${launchOverride ? 'executionBarModelBadge--override' : ''}`}>
                            {effectiveExecuteModel}
                        </span>
                    )}
                    <div className="executionBarActions">
                        <button className="terminalCmd" onClick={onCancel}>cancel</button>
                        <div className="executionBarSplitBtn">
                            <button
                                className="terminalCmd terminalCmdPrimary executionBarSplitBtn__main"
                                onClick={() => onExecute(selectedExecuteMemberId || undefined, launchOverride || undefined)}
                                disabled={selectedCount === 0}
                            >
                                <span className="terminalPrompt">$</span> execute ({selectedCount} task{selectedCount !== 1 ? "s" : ""})
                            </button>
                            <button
                                ref={launchBtnRef}
                                className={`terminalCmd terminalCmdPrimary executionBarSplitBtn__caret ${showLaunchDropdown ? 'executionBarSplitBtn__caret--open' : ''}`}
                                onClick={() => {
                                    setShowLaunchDropdown(!showLaunchDropdown);
                                    setExpandedTool(null);
                                }}
                                title="Launch options"
                            >
                                ▾
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {launchDropdownPortal}
            {selectedTasks.length > 0 && projectId && (
                <WhoamiPreview
                    mode="execute"
                    strategy={(selectedExecuteMember?.strategy || 'simple') as WorkerStrategy}
                    selectedTasks={selectedTasks}
                    projectId={projectId}
                />
            )}
        </>
    );
}
