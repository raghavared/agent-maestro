import React from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { Icon } from "../redesign/kit";

type RefDocsTabProps = {
    selectedReferenceTasks: MaestroTask[];
    onRemoveTask: (taskId: string) => void;
};

export function RefDocsTab({ selectedReferenceTasks, onRemoveTask }: RefDocsTabProps) {
    if (selectedReferenceTasks.length === 0) {
        return <div className="pn-fhint">Reference other tasks to give this one context. None linked yet.</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {selectedReferenceTasks.map(rt => (
                <div
                    key={rt.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--pn-line)',
                        fontSize: '12px',
                        color: 'var(--pn-ink)',
                    }}
                >
                    <Icon name="doc" size={13} style={{ color: 'var(--pn-ink-3)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{rt.title}</span>
                    <button
                        type="button"
                        className="pn-mchip"
                        onClick={() => onRemoveTask(rt.id)}
                        title="Remove reference"
                    >
                        <Icon name="x" size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
}
