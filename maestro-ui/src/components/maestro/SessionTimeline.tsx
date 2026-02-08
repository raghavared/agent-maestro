import React, { useState, useMemo } from "react";
import type { SessionTimelineEvent } from "../../app/types/maestro";
import { TimelineEvent } from "./TimelineEvent";

type TimelineFilter = "all" | "thisTask" | "milestones" | "errors";

interface SessionTimelineProps {
  events: SessionTimelineEvent[];
  title?: string;
  filterByTask?: string;
  showFilters?: boolean;
  showSessionFilter?: boolean;
  sessionId?: string;
  compact?: boolean;
  maxEvents?: number;
  defaultFilter?: TimelineFilter;
  onShowMore?: () => void;
}

export function SessionTimeline({
  events,
  title = "Timeline",
  filterByTask,
  showFilters = true,
  showSessionFilter = false,
  sessionId,
  compact = false,
  maxEvents,
  defaultFilter = "all",
  onShowMore,
}: SessionTimelineProps) {
  const [filter, setFilter] = useState<TimelineFilter>(
    filterByTask ? "thisTask" : defaultFilter
  );
  const [isExpanded, setIsExpanded] = useState(true);

  // Sort events by timestamp (newest first for display, but we'll reverse for timeline)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.timestamp - b.timestamp);
  }, [events]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let filtered = sortedEvents;

    switch (filter) {
      case "thisTask":
        if (filterByTask) {
          filtered = sortedEvents.filter(
            (e) => e.taskId === filterByTask || !e.taskId
          );
        }
        break;
      case "milestones":
        filtered = sortedEvents.filter((e) => e.type === "milestone");
        break;
      case "errors":
        filtered = sortedEvents.filter(
          (e) => e.type === "error" || e.type === "task_failed"
        );
        break;
      case "all":
      default:
        break;
    }

    return filtered;
  }, [sortedEvents, filter, filterByTask]);

  // Limit events if maxEvents is set
  const displayEvents = maxEvents
    ? filteredEvents.slice(-maxEvents)
    : filteredEvents;

  const hasMoreEvents = maxEvents && filteredEvents.length > maxEvents;

  if (events.length === 0) {
    return (
      <div className="sessionTimeline sessionTimeline--empty">
        <div className="sessionTimelineHeader">
          <span className="sessionTimelineTitle">{title}</span>
          <span className="sessionTimelineCount">(0 events)</span>
        </div>
        <div className="sessionTimelineEmpty">No timeline events yet</div>
      </div>
    );
  }

  return (
    <div className={`sessionTimeline ${compact ? "sessionTimeline--compact" : ""}`}>
      <button
        className="sessionTimelineHeader"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="sessionTimelineToggle">{isExpanded ? "▾" : "▸"}</span>
        <span className="sessionTimelineTitle">{title}</span>
        <span className="sessionTimelineCount">
          ({filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""})
        </span>
      </button>

      {isExpanded && (
        <div className="sessionTimelineContent">
          {showFilters && (
            <div className="sessionTimelineFilters">
              {filterByTask && (
                <button
                  className={`sessionTimelineFilterBtn ${filter === "thisTask" ? "active" : ""}`}
                  onClick={() => setFilter("thisTask")}
                >
                  This Task
                </button>
              )}
              <button
                className={`sessionTimelineFilterBtn ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                className={`sessionTimelineFilterBtn ${filter === "milestones" ? "active" : ""}`}
                onClick={() => setFilter("milestones")}
              >
                Milestones
              </button>
              <button
                className={`sessionTimelineFilterBtn ${filter === "errors" ? "active" : ""}`}
                onClick={() => setFilter("errors")}
              >
                Errors
              </button>
            </div>
          )}

          <div className="sessionTimelineEvents">
            {displayEvents.map((event) => (
              <TimelineEvent
                key={event.id}
                event={event}
                compact={compact}
                showTaskId={filter === "all" && !filterByTask}
                highlightTaskId={filterByTask}
              />
            ))}
          </div>

          {hasMoreEvents && (
            <button
              className="sessionTimelineShowMore"
              onClick={onShowMore}
            >
              Show {filteredEvents.length - maxEvents} more events
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Aggregated timeline component for cross-session view
interface AggregatedTimelineProps {
  sessionEvents: Map<string, { sessionName: string; events: SessionTimelineEvent[] }>;
  taskId: string;
  compact?: boolean;
  maxEvents?: number;
}

export function AggregatedTimeline({
  sessionEvents,
  taskId,
  compact = false,
  maxEvents = 20,
}: AggregatedTimelineProps) {
  const [filter, setFilter] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState(true);

  // Merge and sort all events
  const allEvents = useMemo(() => {
    const events: Array<SessionTimelineEvent & { sessionName: string; sessionId: string }> = [];

    sessionEvents.forEach((data, sessionId) => {
      data.events.forEach((event) => {
        events.push({
          ...event,
          sessionName: data.sessionName,
          sessionId,
        });
      });
    });

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [sessionEvents]);

  // Filter events related to this task
  const taskEvents = useMemo(() => {
    return allEvents.filter((e) => e.taskId === taskId || !e.taskId);
  }, [allEvents, taskId]);

  // Apply session filter
  const filteredEvents = useMemo(() => {
    if (filter === "all") return taskEvents;
    return taskEvents.filter((e) => e.sessionId === filter);
  }, [taskEvents, filter]);

  const displayEvents = filteredEvents.slice(-maxEvents);
  const sessionNames = Array.from(sessionEvents.entries());

  if (allEvents.length === 0) {
    return (
      <div className="aggregatedTimeline aggregatedTimeline--empty">
        <div className="aggregatedTimelineHeader">
          <span className="aggregatedTimelineTitle">Aggregated Activity Timeline</span>
          <span className="aggregatedTimelineCount">(0 events)</span>
        </div>
        <div className="aggregatedTimelineEmpty">No activity recorded yet</div>
      </div>
    );
  }

  return (
    <div className={`aggregatedTimeline ${compact ? "aggregatedTimeline--compact" : ""}`}>
      <button
        className="aggregatedTimelineHeader"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="aggregatedTimelineToggle">{isExpanded ? "▾" : "▸"}</span>
        <span className="aggregatedTimelineTitle">
          Aggregated Activity Timeline
        </span>
        <span className="aggregatedTimelineCount">
          ({filteredEvents.length} events across {sessionEvents.size} session
          {sessionEvents.size !== 1 ? "s" : ""})
        </span>
      </button>

      {isExpanded && (
        <div className="aggregatedTimelineContent">
          <div className="aggregatedTimelineFilters">
            <button
              className={`aggregatedTimelineFilterBtn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Sessions
            </button>
            {sessionNames.map(([sessionId, data]) => (
              <button
                key={sessionId}
                className={`aggregatedTimelineFilterBtn ${filter === sessionId ? "active" : ""}`}
                onClick={() => setFilter(sessionId)}
              >
                {data.sessionName}
              </button>
            ))}
          </div>

          <div className="aggregatedTimelineEvents">
            {displayEvents.map((event) => (
              <div key={event.id} className="aggregatedTimelineEventRow">
                <span className="aggregatedTimelineEventSession">
                  {event.sessionName}
                </span>
                <TimelineEvent
                  event={event}
                  compact={compact}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
