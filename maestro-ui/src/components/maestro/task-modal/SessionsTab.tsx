import React from "react";
import { MaestroTask } from "../../../app/types/maestro";
import { SessionInTaskView } from "../SessionInTaskView";
import { useTaskSessions } from "../../../hooks/useTaskSessions";

type SessionsTabProps = {
    taskId: string;
    tasks: Map<string, MaestroTask>;
    onJumpToSession?: (sessionId: string) => void;
};

export function SessionsTab({ taskId, tasks, onJumpToSession }: SessionsTabProps) {
    const { sessions, loading } = useTaskSessions(taskId);

    return (
        <div className="terminalTabPane terminalTabPane--sessions">
            {loading ? (
                <div className="terminalLoading">Loading sessions...</div>
            ) : sessions.length === 0 ? (
                <div className="themedFormHint">No sessions working on this task</div>
            ) : (
                <div className="terminalSessionsList">
                    {sessions.map(session => (
                        <SessionInTaskView
                            key={session.id}
                            session={session}
                            taskId={taskId}
                            tasks={tasks}
                            onJumpToSession={onJumpToSession}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
