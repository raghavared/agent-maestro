import React from "react";
import { TaskTreeNode } from "../../app/types/maestro";

type TaskTabContentProps = {
    loading: boolean;
    emptyMessage: string;
    emptySubMessage?: string;
    roots: TaskTreeNode[];
    renderTaskNode: (node: TaskTreeNode, depth: number, options?: { showPermanentDelete?: boolean }) => React.ReactNode;
    showPermanentDelete?: boolean;
    listClassName?: string;
    showNewTaskButton?: boolean;
    onNewTask?: () => void;
    sectionLabel?: string;
};

export const TaskTabContent: React.FC<TaskTabContentProps> = React.memo(({
    loading,
    emptyMessage,
    emptySubMessage,
    roots,
    renderTaskNode,
    showPermanentDelete,
    listClassName,
    showNewTaskButton,
    onNewTask,
    sectionLabel,
}) => {
    if (loading) {
        return (
            <div className="terminalContent">
                {/* Light-theme leak fix: leaf-state colors come from shared unscoped
                    terminal-theme classes (dark/green). Repoint to theme-aware --pn-*
                    tokens inline so light mode shows paper-correct ink, not dark. */}
                <div className="terminalLoadingState" style={{ color: "var(--pn-ink)" }}>
                    <div className="terminalSpinner">
                        <span className="terminalSpinnerDot" style={{ color: "var(--pn-ink-3)", textShadow: "none" }}>●</span>
                        <span className="terminalSpinnerDot" style={{ color: "var(--pn-ink-3)", textShadow: "none" }}>●</span>
                        <span className="terminalSpinnerDot" style={{ color: "var(--pn-ink-3)", textShadow: "none" }}>●</span>
                    </div>
                    <p className="terminalLoadingText" style={{ color: "var(--pn-ink-4)" }}>
                        <span className="terminalCursor" style={{ color: "var(--pn-brand)", textShadow: "none" }}>█</span> Loading tasks...
                    </p>
                </div>
            </div>
        );
    }

    if (roots.length === 0) {
        return (
            <div className="terminalContent">
                {/* Light-theme leak fix (ruling E: keep ASCII structure, repoint colors
                    to theme-aware --pn-* tokens so light mode renders paper-correct). */}
                <div className="terminalEmptyState" style={{ color: "var(--pn-ink)" }}>
                    <pre className="terminalAsciiArt" style={{ color: "var(--pn-ink-4)", textShadow: "none" }}>{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        ${emptyMessage.padEnd(31)}║
    ║                                       ║${emptySubMessage ? `
    ║     ${emptySubMessage.padEnd(33)}║
    ║                                       ║` : ''}
    ╚═══════════════════════════════════════╝
                    `}</pre>
                    {showNewTaskButton && onNewTask && (
                        <button type="button"
                            className="terminalCmd terminalCmdPrimary"
                            onClick={onNewTask}
                            style={{ color: "var(--pn-brand)", borderColor: "var(--pn-brand)", background: "transparent", boxShadow: "none" }}
                        >
                            <span className="terminalPrompt" style={{ color: "var(--pn-brand)" }}>$</span> new task
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const renderRow = (node: TaskTreeNode) =>
        renderTaskNode(node, 0, showPermanentDelete ? { showPermanentDelete: true } : undefined);

    // The "Current" sub-tab splits into the two design sections — "In progress"
    // (status === in_progress) and "Up next" (the rest). Pinned/Completed/Archived
    // keep a single section. This is a read-only presentational partition of the
    // already-sorted roots (order within each slice preserved); no logic/data change.
    // Gated on the sectionLabel passed by MaestroPanel to avoid a MaestroPanel edit.
    if (sectionLabel === "Current") {
        const inProgress = roots.filter(n => n.status === "in_progress");
        const upNext = roots.filter(n => n.status !== "in_progress");
        return (
            <div className="terminalContent">
                <div className={listClassName || undefined}>
                    {inProgress.length > 0 && (
                        <>
                            <div className="pn-sec-head">
                                <span className="pn-eyebrow">In progress <span className="pn-count">· {inProgress.length}</span></span>
                                <span className="pn-line" />
                            </div>
                            <div className="pn-list">{inProgress.map(renderRow)}</div>
                        </>
                    )}
                    {upNext.length > 0 && (
                        <>
                            <div className="pn-sec-head">
                                <span className="pn-eyebrow">Up next <span className="pn-count">· {upNext.length}</span></span>
                                <span className="pn-line" />
                            </div>
                            <div className="pn-list">{upNext.map(renderRow)}</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="terminalContent">
            <div className={listClassName || undefined}>
                {sectionLabel && (
                    <div className="pn-sec-head">
                        <span className="pn-eyebrow">{sectionLabel} <span className="pn-count">· {roots.length}</span></span>
                        <span className="pn-line" />
                    </div>
                )}
                <div className="pn-list">
                    {roots.map(renderRow)}
                </div>
            </div>
        </div>
    );
});
