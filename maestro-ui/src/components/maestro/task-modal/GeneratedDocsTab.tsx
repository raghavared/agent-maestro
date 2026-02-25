import React from "react";
import { DocEntry } from "../../../app/types/maestro";

type GeneratedDocsTabProps = {
    taskDocs: DocEntry[];
};

export function GeneratedDocsTab({ taskDocs }: GeneratedDocsTabProps) {
    if (taskDocs.length === 0) {
        return <div className="themedFormHint">No generated docs yet</div>;
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
                        padding: '4px 0',
                        borderBottom: '1px solid var(--theme-border)',
                        fontSize: '11px',
                    }}
                >
                    <span style={{ opacity: 0.5, flexShrink: 0 }}>doc</span>
                    <span style={{ flex: 1, color: 'var(--theme-primary)' }}>
                        {doc.title}
                    </span>
                    <span className="themedFormHint" style={{ flexShrink: 0, fontSize: '10px' }}>
                        {doc.filePath}
                    </span>
                </div>
            ))}
        </div>
    );
}
