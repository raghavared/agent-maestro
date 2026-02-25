import React, { useMemo } from "react";
import { AggregatedTimeline } from "../SessionTimeline";
import { useTaskSessions } from "../../../hooks/useTaskSessions";

type TimelineTabProps = {
    taskId: string;
};

export function TimelineTab({ taskId }: TimelineTabProps) {
    const { sessions } = useTaskSessions(taskId);

    const aggregatedTimelineData = useMemo(() => {
        const data = new Map<string, { sessionName: string; events: any[] }>();
        sessions.forEach(session => {
            data.set(session.id, {
                sessionName: session.name || session.id.slice(0, 8),
                events: session.timeline || []
            });
        });
        return data;
    }, [sessions]);

    const hasTimelineEvents = useMemo(() => {
        return sessions.some(session =>
            session.timeline?.some(event => event.taskId === taskId || !event.taskId)
        );
    }, [sessions, taskId]);

    if (sessions.length === 0) {
        return <div className="themedFormHint">No sessions to show timeline for</div>;
    }

    if (!hasTimelineEvents) {
        return <div className="themedFormHint">No timeline events recorded yet</div>;
    }

    return (
        <div className="terminalTabPane terminalTabPane--timeline">
            <AggregatedTimeline
                sessionEvents={aggregatedTimelineData}
                taskId={taskId}
                compact
                maxEvents={15}
            />
        </div>
    );
}
