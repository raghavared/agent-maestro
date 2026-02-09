import React, { useState, useMemo } from "react";
import type { MaestroSession, MaestroTask, MaestroSessionStatus } from "../../app/types/maestro";
import { StrategyBadge } from "./StrategyBadge";
import { SessionTimeline } from "./SessionTimeline";
import { SessionDetailsSection, SessionDetailsSummary } from "./SessionDetailsSection";
import { QueueStatusDisplay, type QueueState } from "./QueueStatusDisplay";

interface QueueSessionItemProps {
  session: MaestroSession;
  tasks: MaestroTask[];
  queueState?: QueueState;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onClose: () => void;
  onJumpToTask?: (taskId: string) => void;
}

// Session status symbols and labels
const SESSION_STATUS_SYMBOLS: Record<MaestroSessionStatus, string> = {
  spawning: "◌",
  idle: "○",
  working: "◉",
  "needs-user-input": "⚡",
  completed: "✓",
  failed: "✗",
  stopped: "⊘",
  "needs-user-input": "⚠",
};

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  "needs-user-input": "Needs Input",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
  "needs-user-input": "Needs Input",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function QueueSessionItem({
  session,
  tasks,
  queueState,
  isActive,
  isExpanded,
  onToggle,
  onSelect,
  onClose,
  onJumpToTask,
}: QueueSessionItemProps) {
  const [showQueue, setShowQueue] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Calculate queue stats
  const queueStats = useMemo(() => {
    if (!queueState) {
      return { total: tasks.length, position: 0, completed: 0, processing: 0 };
    }

    const completed = queueState.items.filter(i => i.status === "completed").length;
    const processing = queueState.items.filter(i => i.status === "processing").length;
    const position = queueState.currentIndex >= 0 ? queueState.currentIndex + 1 : completed;

    return {
      total: queueState.items.length,
      position,
      completed,
      processing,
    };
  }, [queueState, tasks]);

  // Create tasks map for QueueStatusDisplay
  const tasksMap = useMemo(() => {
    const map = new Map<string, MaestroTask>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  const hasTimeline = session.timeline && session.timeline.length > 0;

  return (
    <div
      className={`queueSessionItem queueSessionItem--${session.status} ${isActive ? "queueSessionItem--active" : ""} ${isExpanded ? "queueSessionItem--expanded" : ""}`}
    >
      {/* Header */}
      <div className="queueSessionItemHeader" onClick={onToggle}>
        <button className={`queueSessionItemToggle ${isExpanded ? "expanded" : ""}`}>
          {isExpanded ? "▾" : "▸"}
        </button>

        <span className={`queueSessionItemStatus queueSessionItemStatus--${session.status}`}>
          {SESSION_STATUS_SYMBOLS[session.status]} {SESSION_STATUS_LABELS[session.status]}
        </span>

        <span className="queueSessionItemName">{session.name}</span>

        <StrategyBadge
          strategy="queue"
          queuePosition={queueStats.position}
          queueTotal={queueStats.total}
        />

        <span className="queueSessionItemActivity">
          {formatTimeAgo(session.lastActivity)}
        </span>

        <button
          className="queueSessionItemCloseBtn"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close session"
        >
          ×
        </button>
      </div>

      {/* Meta Line */}
      <div className="queueSessionItemMeta">
        <SessionDetailsSummary session={session} />
        <span className="queueSessionItemProgress">
          {queueStats.completed}/{queueStats.total} completed
          {queueStats.processing > 0 && ` • ${queueStats.processing} processing`}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="queueSessionItemExpanded">
          {/* Queue Status Section */}
          <div className="queueSessionItemSection">
            <button
              className="queueSessionItemSectionHeader"
              onClick={(e) => {
                e.stopPropagation();
                setShowQueue(!showQueue);
              }}
            >
              {showQueue ? "▾" : "▸"} Queue Status ({queueStats.total} tasks)
            </button>

            {showQueue && (
              <div className="queueSessionItemSectionContent">
                {queueState ? (
                  <QueueStatusDisplay
                    queueState={queueState}
                    tasks={tasksMap}
                    onJumpToTask={onJumpToTask}
                  />
                ) : (
                  <div className="queueSessionItemTaskList">
                    {tasks.length === 0 ? (
                      <div className="queueSessionItemEmpty">No tasks in queue</div>
                    ) : (
                      tasks.map((task, index) => (
                        <div
                          key={task.id}
                          className={`queueSessionItemTask queueSessionItemTask--${task.status}`}
                          onClick={() => onJumpToTask?.(task.id)}
                        >
                          <span className="queueSessionItemTaskPosition">#{index + 1}</span>
                          <span className={`queueSessionItemTaskStatus queueSessionItemTaskStatus--${task.status}`}>
                            {task.status === "in_progress" ? "◉" : task.status === "completed" ? "✓" : "○"}
                            {task.status === "in_progress" ? " PROCESSING" : task.status === "completed" ? " COMPLETED" : " QUEUED"}
                          </span>
                          <span className="queueSessionItemTaskTitle">{task.title}</span>
                          <span className={`queueSessionItemTaskPriority queueSessionItemTaskPriority--${task.priority}`}>
                            {task.priority.toUpperCase()}
                          </span>
                          <button
                            className="queueSessionItemTaskJump"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToTask?.(task.id);
                            }}
                            title="View task"
                          >
                            →
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline Section */}
          {hasTimeline && (
            <div className="queueSessionItemSection">
              <button
                className="queueSessionItemSectionHeader"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimeline(!showTimeline);
                }}
              >
                {showTimeline ? "▾" : "▸"} Session Timeline ({session.timeline.length} events)
              </button>

              {showTimeline && (
                <div className="queueSessionItemSectionContent">
                  <SessionTimeline
                    events={session.timeline}
                    showFilters
                    compact
                    maxEvents={20}
                  />
                </div>
              )}
            </div>
          )}

          {/* Session Details Section */}
          <div className="queueSessionItemSection">
            <button
              className="queueSessionItemSectionHeader"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
            >
              {showDetails ? "▾" : "▸"} Session Details
            </button>

            {showDetails && (
              <div className="queueSessionItemSectionContent">
                <SessionDetailsSection session={session} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
