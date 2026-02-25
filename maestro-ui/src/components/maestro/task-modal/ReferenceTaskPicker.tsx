import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { MaestroTask } from "../../../app/types/maestro";
import { useDropdownPosition } from "../../../hooks/useDropdownPosition";

type RefTaskCandidate = MaestroTask & { docCount: number };

type ReferenceTaskPickerProps = {
    selectedReferenceTasks: MaestroTask[];
    showPicker: boolean;
    candidates: RefTaskCandidate[];
    loading: boolean;
    displayCount: number;
    onTogglePicker: () => void;
    onClosePicker: () => void;
    onToggleSelection: (task: MaestroTask) => void;
    onRemoveTask: (taskId: string) => void;
    onLoadMore: () => void;
};

export function ReferenceTaskPicker({
    selectedReferenceTasks,
    showPicker,
    candidates,
    loading,
    displayCount,
    onTogglePicker,
    onClosePicker,
    onToggleSelection,
    onRemoveTask,
    onLoadMore,
}: ReferenceTaskPickerProps) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const pos = useDropdownPosition(btnRef, showPicker, "below");

    return (
        <>
            {/* Selected reference task chips */}
            {selectedReferenceTasks.map(rt => (
                <span
                    key={rt.id}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(var(--theme-primary-rgb), 0.05)',
                        color: 'var(--theme-primary)',
                    }}
                >
                    <span style={{ opacity: 0.5 }}>ref:</span>
                    {rt.title.length > 30 ? rt.title.slice(0, 30) + '...' : rt.title}
                    <button
                        type="button"
                        onClick={() => onRemoveTask(rt.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--theme-primary)',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '12px',
                            opacity: 0.6,
                        }}
                    >
                        ×
                    </button>
                </span>
            ))}

            {/* Trigger button */}
            <button
                ref={btnRef}
                type="button"
                className="themedBtn"
                style={{ padding: '1px 6px', fontSize: '10px' }}
                onClick={(e) => {
                    e.stopPropagation();
                    onTogglePicker();
                }}
                title="Add reference tasks for context"
            >
                + ref tasks
            </button>

            {/* Dropdown portal */}
            {showPicker && pos && createPortal(
                <>
                    <div
                        className="themedDropdownOverlay"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClosePicker();
                        }}
                    />
                    <div
                        className="themedDropdownMenu"
                        style={{
                            top: pos.top,
                            left: pos.left,
                            maxHeight: '240px',
                            overflowY: 'auto',
                            minWidth: '320px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '4px 8px', fontSize: '10px', opacity: 0.5, borderBottom: '1px solid var(--theme-border)' }}>
                            Reference tasks (select for context)
                        </div>
                        {loading ? (
                            <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                Loading tasks...
                            </div>
                        ) : candidates.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                No tasks with docs found
                            </div>
                        ) : (
                            <>
                                {candidates.slice(0, displayCount).map(candidate => {
                                    const isSelected = selectedReferenceTasks.some(t => t.id === candidate.id);
                                    return (
                                        <button
                                            key={candidate.id}
                                            className={`themedDropdownOption ${isSelected ? 'themedDropdownOption--current' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleSelection(candidate);
                                            }}
                                            style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="themedDropdownLabel" style={{ flex: 1 }}>
                                                    {candidate.title.length > 45 ? candidate.title.slice(0, 45) + '...' : candidate.title}
                                                </span>
                                                <span style={{ fontSize: '9px', opacity: 0.5, flexShrink: 0 }}>
                                                    {candidate.docCount} doc{candidate.docCount !== 1 ? 's' : ''}
                                                </span>
                                                {isSelected && (
                                                    <span className="themedDropdownCheck">{'\u2713'}</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                                {candidates.length > displayCount && (
                                    <button
                                        className="themedDropdownOption"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLoadMore();
                                        }}
                                        style={{ textAlign: 'center', opacity: 0.6, fontSize: '10px' }}
                                    >
                                        Load more ({candidates.length - displayCount} remaining)
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
