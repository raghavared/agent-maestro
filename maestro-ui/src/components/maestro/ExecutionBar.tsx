import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MaestroTask, TeamMember, WorkerStrategy, OrchestratorStrategy } from "../../app/types/maestro";
import { WhoamiPreview } from "./WhoamiPreview";

type ExecutionMode = 'none' | 'execute' | 'orchestrate';

type ExecutionBarProps = {
    isActive: boolean;
    onActivate: () => void;
    onCancel: () => void;
    onExecute: (teamMemberId?: string) => void;
    onOrchestrate: (coordinatorId?: string, workerIds?: string[]) => void;
    selectedCount: number;
    activeMode?: ExecutionMode;
    onActivateOrchestrate: () => void;
    selectedTasks?: MaestroTask[];
    projectId?: string;
    teamMembers?: TeamMember[];
};

// Hook to compute portal menu position from a trigger button ref
function useDropdownPosition(triggerRef: React.RefObject<HTMLButtonElement | null>, isOpen: boolean) {
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const updatePos = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
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
                        style={{ top: pos.top, left: pos.left, width: pos.width }}
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
                        style={{ top: pos.top, left: pos.left, width: pos.width }}
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

    const activeMembers = teamMembers.filter(m => m.status === 'active');

    // For orchestrate: coordinators have mode=coordinate, workers have mode=execute
    const coordinatorMembers = activeMembers.filter(m => m.mode === 'coordinate');
    const workerMembers = activeMembers.filter(m => m.mode === 'execute' || !m.mode);

    // Derive strategy from selected team member for WhoamiPreview
    const selectedExecuteMember = activeMembers.find(m => m.id === selectedExecuteMemberId);
    const selectedCoordinator = coordinatorMembers.find(m => m.id === selectedCoordinatorId);

    if (!isActive) {
        return (
            <div className="executionBar">
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

    if (activeMode === 'orchestrate') {
        const totalWorkerCount = selectedWorkerIds.size;

        return (
            <>
                <div className="executionBar executionBar--active executionBar--orchestrate executionBar--column">
                    <div className="executionBarRow">
                        <div className="executionBarDropdowns">
                            <TeamMemberDropdown
                                label="Coordinator"
                                members={coordinatorMembers}
                                selectedId={selectedCoordinatorId}
                                onSelect={setSelectedCoordinatorId}
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
                        <div className="executionBarActions">
                            <button className="terminalCmd" onClick={onCancel}>cancel</button>
                            <button
                                className="terminalCmd terminalCmdOrchestrate"
                                onClick={() => onOrchestrate(
                                    selectedCoordinatorId || undefined,
                                    selectedWorkerIds.size > 0 ? Array.from(selectedWorkerIds) : undefined,
                                )}
                                disabled={selectedCount === 0}
                            >
                                <span className="terminalPrompt">$</span> orchestrate ({selectedCount} task{selectedCount !== 1 ? "s" : ""}{totalWorkerCount > 0 ? `, ${totalWorkerCount} worker${totalWorkerCount !== 1 ? 's' : ''}` : ''})
                            </button>
                        </div>
                    </div>
                </div>
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
                <div className="executionBarRow">
                    <div className="executionBarDropdowns">
                        <TeamMemberDropdown
                            label="Team Member"
                            members={activeMembers}
                            selectedId={selectedExecuteMemberId}
                            onSelect={setSelectedExecuteMemberId}
                        />
                    </div>
                    <div className="executionBarActions">
                        <button className="terminalCmd" onClick={onCancel}>cancel</button>
                        <button
                            className="terminalCmd terminalCmdPrimary"
                            onClick={() => onExecute(selectedExecuteMemberId || undefined)}
                            disabled={selectedCount === 0}
                        >
                            <span className="terminalPrompt">$</span> execute ({selectedCount} task{selectedCount !== 1 ? "s" : ""})
                        </button>
                    </div>
                </div>
            </div>
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
