import React from "react";
import { MaestroTask } from "../../../app/types/maestro";

type RefDocsTabProps = {
    selectedReferenceTasks: MaestroTask[];
    onRemoveTask: (taskId: string) => void;
};

export function RefDocsTab({ selectedReferenceTasks, onRemoveTask }: RefDocsTabProps) {
    if (selectedReferenceTasks.length === 0) {
        return <div className="themedFormHint">No reference tasks. Use "+ ref tasks" above to add.</div>;
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
                        padding: '4px 0',
                        borderBottom: '1px solid var(--theme-border)',
                        fontSize: '11px',
                    }}
                >
                    <span style={{ opacity: 0.5, flexShrink: 0 }}>ref</span>
                    <span style={{ flex: 1, color: 'var(--theme-primary)' }}>
                        {rt.title}
                    </span>
                    <button
                        type="button"
                        className="themedBtn themedBtnDanger"
                        style={{ padding: '0 4px', fontSize: '12px' }}
                        onClick={() => onRemoveTask(rt.id)}
                        title="Remove reference"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
