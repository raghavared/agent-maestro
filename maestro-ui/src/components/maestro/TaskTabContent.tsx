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
};

export const TaskTabContent: React.FC<TaskTabContentProps> = ({
    loading,
    emptyMessage,
    emptySubMessage,
    roots,
    renderTaskNode,
    showPermanentDelete,
    listClassName,
    showNewTaskButton,
    onNewTask,
}) => {
    if (loading) {
        return (
            <div className="terminalContent">
                <div className="terminalLoadingState">
                    <div className="terminalSpinner">
                        <span className="terminalSpinnerDot">●</span>
                        <span className="terminalSpinnerDot">●</span>
                        <span className="terminalSpinnerDot">●</span>
                    </div>
                    <p className="terminalLoadingText">
                        <span className="terminalCursor">█</span> Loading tasks...
                    </p>
                </div>
            </div>
        );
    }

    if (roots.length === 0) {
        return (
            <div className="terminalContent">
                <div className="terminalEmptyState">
                    <pre className="terminalAsciiArt">{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║        ${emptyMessage.padEnd(31)}║
    ║                                       ║${emptySubMessage ? `
    ║     ${emptySubMessage.padEnd(33)}║
    ║                                       ║` : ''}
    ╚═══════════════════════════════════════╝
                    `}</pre>
                    {showNewTaskButton && onNewTask && (
                        <button
                            className="terminalCmd terminalCmdPrimary"
                            onClick={onNewTask}
                        >
                            <span className="terminalPrompt">$</span> new task
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="terminalContent">
            <div className={`terminalTaskList ${listClassName || ''}`}>
                <div className="terminalTaskHeader">
                    <span>STATUS</span>
                    <span>TASK</span>
                    <span>AGENT</span>
                    <span>ACTIONS</span>
                </div>
                {roots.map(node => renderTaskNode(node, 0, showPermanentDelete ? { showPermanentDelete: true } : undefined))}
            </div>
        </div>
    );
};
