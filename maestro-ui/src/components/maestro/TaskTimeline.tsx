import React from "react";
import { Icon } from "../Icon";

export type TimelineEvent = {
    id: string;
    type: "created" | "session_started" | "session_ended" | "update" | "completed" | "blocked";
    timestamp: number;
    message?: string;
    sessionId?: string;
};

type TaskTimelineProps = {
    events: TimelineEvent[];
};

const EVENT_LABELS: Record<TimelineEvent["type"], string> = {
    created: "Task created",
    session_started: "Session started",
    session_ended: "Session ended",
    update: "Progress update",
    completed: "Task completed",
    blocked: "Task blocked",
};

const EVENT_COLORS: Record<TimelineEvent["type"], string> = {
    created: "rgba(107, 138, 253, 0.8)",
    session_started: "rgba(34, 211, 238, 0.8)",
    session_ended: "rgba(148, 163, 184, 0.7)",
    update: "rgba(245, 158, 11, 0.8)",
    completed: "rgba(16, 185, 129, 0.8)",
    blocked: "rgba(239, 68, 68, 0.8)",
};

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
        return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date >= yesterday) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else {
        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
}

export function TaskTimeline({ events }: TaskTimelineProps) {
    if (events.length === 0) {
        return (
            <div className="maestroTimeline">
                <div className="maestroTimelineEmpty">
                    <Icon name="clock" />
                    <p>No timeline events yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="maestroTimeline">
            <h4 className="maestroTimelineTitle">Timeline</h4>
            <div className="maestroTimelineEvents">
                {events.map((event, index) => (
                    <div key={event.id} className="maestroTimelineEvent">
                        <div
                            className="maestroTimelineEventDot"
                            style={{ backgroundColor: EVENT_COLORS[event.type] }}
                        />
                        <div className="maestroTimelineEventLine">
                            {index < events.length - 1 && <div className="maestroTimelineEventLineBar" />}
                        </div>
                        <div className="maestroTimelineEventContent">
                            <div className="maestroTimelineEventHeader">
                                <span className="maestroTimelineEventLabel">{EVENT_LABELS[event.type]}</span>
                                <span className="maestroTimelineEventTime">{formatTimestamp(event.timestamp)}</span>
                            </div>
                            {event.message && <p className="maestroTimelineEventMessage">{event.message}</p>}
                            {event.sessionId && (
                                <span className="maestroTimelineEventSession">{event.sessionId.slice(5, 13)}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
