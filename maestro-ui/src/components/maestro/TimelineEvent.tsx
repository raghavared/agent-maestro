import React from "react";
import type { SessionTimelineEvent, SessionTimelineEventType } from "../../app/types/maestro";

interface TimelineEventProps {
  event: SessionTimelineEvent;
  compact?: boolean;
  showTaskId?: boolean;
  highlightTaskId?: string;
}

// Terminal-style symbols for each event type
const EVENT_SYMBOLS: Record<SessionTimelineEventType, string> = {
  session_started: "●",
  session_stopped: "⊘",
  task_started: "▶",
  task_completed: "✓",
  task_failed: "✗",
  task_skipped: "⊘",
  task_blocked: "⚠",
  needs_input: "⚠",
  progress: "⚡",
  error: "⨯",
  milestone: "★",
  doc_added: "📄",
};

// CSS class suffixes for event types
const EVENT_TYPE_CLASSES: Record<SessionTimelineEventType, string> = {
  session_started: "session",
  session_stopped: "session",
  task_started: "started",
  task_completed: "completed",
  task_failed: "failed",
  task_skipped: "skipped",
  task_blocked: "blocked",
  needs_input: "warning",
  progress: "progress",
  error: "error",
  milestone: "milestone",
  doc_added: "doc",
};

// Human-readable labels for event types
const EVENT_LABELS: Record<SessionTimelineEventType, string> = {
  session_started: "Session Started",
  session_stopped: "Session Stopped",
  task_started: "Task Started",
  task_completed: "Task Completed",
  task_failed: "Task Failed",
  task_skipped: "Task Skipped",
  task_blocked: "Task Blocked",
  needs_input: "Needs Input",
  progress: "Progress",
  error: "Error",
  milestone: "Milestone",
  doc_added: "Doc Added",
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatFullTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TimelineEvent({
  event,
  compact = false,
  showTaskId = false,
  highlightTaskId,
}: TimelineEventProps) {
  const symbol = EVENT_SYMBOLS[event.type];
  const typeClass = EVENT_TYPE_CLASSES[event.type];
  const label = EVENT_LABELS[event.type];
  const isHighlighted = highlightTaskId && event.taskId === highlightTaskId;

  return (
    <div
      className={`timelineEvent timelineEvent--${typeClass} ${compact ? "timelineEvent--compact" : ""} ${isHighlighted ? "timelineEvent--highlighted" : ""}`}
      title={formatFullTimestamp(event.timestamp)}
    >
      <div className="timelineEventDot">{symbol}</div>

      <div className="timelineEventTime">
        {compact ? formatTimeAgo(event.timestamp) : formatTime(event.timestamp)}
      </div>

      <div className="timelineEventContent">
        <span className="timelineEventType">{label}</span>

        {event.message && (
          <span className="timelineEventMessage">{event.message}</span>
        )}

        {showTaskId && event.taskId && (
          <span className="timelineEventTaskId">task:{event.taskId.slice(0, 8)}</span>
        )}
      </div>
    </div>
  );
}

// Export constants for use in other components
export { EVENT_SYMBOLS, EVENT_TYPE_CLASSES, EVENT_LABELS };
