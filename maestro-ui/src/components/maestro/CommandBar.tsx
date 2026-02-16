import React from "react";
import { MaestroTask } from "../../app/types/maestro";

type CommandBarProps = {
    onNewTask: () => void;
    loading: boolean;
    projectId: string;
    tasks: MaestroTask[];
};

export const CommandBar: React.FC<CommandBarProps> = ({
    onNewTask,
    loading,
    projectId,
    tasks,
}) => {
    return (
        <div className="terminalCommandBar">
            <div className="terminalCommands">
                <button
                    className="terminalCmd terminalCmdPrimary"
                    onClick={onNewTask}
                >
                    <span className="terminalPrompt">$</span> new task
                </button>
            </div>
            <div className="terminalStats">
                <span className="terminalStat terminalStatActive">
                    ◉ {tasks.filter((t) => t.status === "in_progress").length}
                </span>
                <span className="terminalStat terminalStatPending">
                    ○ {tasks.filter((t) => t.status === "todo").length}
                </span>
                <span className="terminalStat terminalStatReview">
                    ◎ {tasks.filter((t) => t.status === "in_review").length}
                </span>
                <span className="terminalStat terminalStatDone">
                    ✓ {tasks.filter((t) => t.status === "completed").length}
                </span>
            </div>
        </div>
    );
};
