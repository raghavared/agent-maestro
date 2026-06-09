import React from "react";
import { DocEntry } from "../../../app/types/maestro";
import { Icon } from "../redesign/kit";

type GeneratedDocsTabProps = {
    taskDocs: DocEntry[];
};

export function GeneratedDocsTab({ taskDocs }: GeneratedDocsTabProps) {
    if (taskDocs.length === 0) {
        return <div className="pn-fhint">No generated docs yet.</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {taskDocs.map(doc => (
                <div
                    key={doc.id}
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
                    <span style={{ flex: 1 }}>{doc.title}</span>
                    <span className="pn-fhint" style={{ flexShrink: 0 }}>{doc.filePath}</span>
                </div>
            ))}
        </div>
    );
}
