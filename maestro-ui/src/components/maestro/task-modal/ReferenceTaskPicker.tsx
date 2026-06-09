import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { MaestroTask } from "../../../app/types/maestro";
import { useDropdownPosition } from "../../../hooks/useDropdownPosition";
import { Icon } from "../redesign/kit";

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
                <span key={rt.id} className="pn-mchip pn-mchip--ref">
                    <Icon name="doc" size={12} />
                    {rt.title.length > 30 ? rt.title.slice(0, 30) + '...' : rt.title}
                    <button
                        type="button"
                        onClick={() => onRemoveTask(rt.id)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                    >
                        <Icon name="x" size={11} />
                    </button>
                </span>
            ))}

            {/* Trigger button */}
            <button
                ref={btnRef}
                type="button"
                className="pn-mchip"
                onClick={(e) => {
                    e.stopPropagation();
                    onTogglePicker();
                }}
                title="Add reference tasks for context"
            >
                <Icon name="at" size={12} /> Reference
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
                            background: 'var(--pn-card)',
                            border: '1px solid var(--pn-line-2)',
                            borderRadius: 'var(--pn-r-sm)',
                            color: 'var(--pn-ink)',
                            boxShadow: 'var(--pn-sh-pop)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="pn-fhint" style={{ padding: '6px 10px', borderBottom: '1px solid var(--pn-line)' }}>
                            Reference tasks (select for context)
                        </div>
                        {loading ? (
                            <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                Loading tasks...
                            </div>
                        ) : candidates.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '11px', opacity: 0.5 }}>
                                No tasks found
                            </div>
                        ) : (
                            <>
                                {candidates.slice(0, displayCount).map(candidate => {
                                    const isSelected = selectedReferenceTasks.some(t => t.id === candidate.id);
                                    return (
                                        <button type="button"
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
                                                {candidate.docCount > 0 && (
                                                    <span style={{ fontSize: '9px', opacity: 0.5, flexShrink: 0 }}>
                                                        {candidate.docCount} doc{candidate.docCount !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="themedDropdownCheck">{'\u2713'}</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                                {candidates.length > displayCount && (
                                    <button type="button"
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
