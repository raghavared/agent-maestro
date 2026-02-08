import React from "react";
import { Icon } from "../Icon";

type Session = {
    id: string;
    persistId: string;
    name: string;
    command: string;
    cwd: string | null;
    effectId?: string | null;
    processTag?: string | null;
    exited?: boolean;
    closing?: boolean;
};

type ManageTerminalsModalProps = {
    sessions: Session[];
    onReorder: (draggedPersistId: string, targetPersistId: string) => void;
    onClose: () => void;
};

export function ManageTerminalsModal({ sessions, onReorder, onClose }: ManageTerminalsModalProps) {
    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const current = sessions[index];
        const target = sessions[index - 1];
        onReorder(current.persistId, target.persistId);
    };

    const handleMoveDown = (index: number) => {
        if (index === sessions.length - 1) return;
        const current = sessions[index];
        const target = sessions[index + 1];
        onReorder(current.persistId, target.persistId);
    };

    return (
        <div className="modalBackdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="modalTitle">Manage Terminals</h3>
                <div className="hint" style={{ marginTop: 0 }}>
                    Reorder terminals using the arrow buttons. Changes are saved automatically.
                </div>

                <div className="agentShortcutEditorSection">
                    <div className="agentShortcutEditorTitle">Terminals</div>
                    {sessions.length === 0 ? (
                        <div className="empty">No terminals in this project.</div>
                    ) : (
                        <div className="agentShortcutEditorList">
                            {sessions.map((session, index) => {
                                const isExited = Boolean(session.exited);
                                const isClosing = Boolean(session.closing);
                                const isFirst = index === 0;
                                const isLast = index === sessions.length - 1;

                                return (
                                    <div
                                        key={session.id}
                                        className="agentShortcutEditorItem"
                                        style={isExited || isClosing ? { opacity: 0.6 } : undefined}
                                    >
                                        <div className="agentShortcutEditorMain">
                                            <div className="agentShortcutEditorName">{session.name}</div>
                                            <div className="agentShortcutEditorCmd">{session.command}</div>
                                        </div>
                                        <div className="agentShortcutEditorActions">
                                            <button
                                                type="button"
                                                className="btnSmall btnIcon"
                                                onClick={() => handleMoveUp(index)}
                                                disabled={isFirst}
                                                title="Move up"
                                                aria-label="Move up"
                                                style={{ transform: 'rotate(-90deg)' }}
                                            >
                                                <Icon name="chevron-left" />
                                            </button>
                                            <button
                                                type="button"
                                                className="btnSmall btnIcon"
                                                onClick={() => handleMoveDown(index)}
                                                disabled={isLast}
                                                title="Move down"
                                                aria-label="Move down"
                                                style={{ transform: 'rotate(-90deg)' }}
                                            >
                                                <Icon name="chevron-right" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="modalActions">
                    <button type="button" className="btn" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
