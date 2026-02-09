import React, { useState, useMemo } from "react";
import type { MaestroSession, MaestroTask, MaestroSessionStatus } from "../../app/types/maestro";
import { StrategyBadge } from "./StrategyBadge";
import { SessionTimeline } from "./SessionTimeline";
import { SessionDetailsSection, SessionDetailsSummary } from "./SessionDetailsSection";

interface SimpleSessionItemProps {
  session: MaestroSession;
  tasks: MaestroTask[];
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
};

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  "needs-user-input": "Needs Input",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

// Task status symbols
const TASK_STATUS_SYMBOLS: Record<string, string> = {
  todo: "○",
  in_progress: "◉",
  completed: "✓",
  cancelled: "⊘",
  blocked: "✗",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "TODO",
  in_progress: "RUN",
  completed: "DONE",
  cancelled: "CANCEL",
  blocked: "BLOCK",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SimpleSessionItem({
  session,
  tasks,
  isActive,
  isExpanded,
  onToggle,
  onSelect,
  onClose,
  onJumpToTask,
}: SimpleSessionItemProps) {
  const [showTasks, setShowTasks] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Get tasks with their subtasks
  const taskTree = useMemo(() => {
    const rootTasks = tasks.filter(t => !t.parentId || !tasks.some(p => p.id === t.parentId));
    return rootTasks.map(task => ({
      task,
      subtasks: tasks.filter(t => t.parentId === task.id)
    }));
  }, [tasks]);

  const hasTimeline = session.timeline && session.timeline.length > 0;

  return (
    <div
      className={`simpleSessionItem simpleSessionItem--${session.status} ${isActive ? "simpleSessionItem--active" : ""} ${isExpanded ? "simpleSessionItem--expanded" : ""}`}
    >
      {/* Header */}
      <div className="simpleSessionItemHeader" onClick={onToggle}>
        <button className={`simpleSessionItemToggle ${isExpanded ? "expanded" : ""}`}>
          {isExpanded ? "▾" : "▸"}
        </button>

        <span className={`simpleSessionItemStatus simpleSessionItemStatus--${session.status}`}>
          {SESSION_STATUS_SYMBOLS[session.status]} {SESSION_STATUS_LABELS[session.status]}
        </span>

        <span className="simpleSessionItemName">{session.name}</span>

        <StrategyBadge strategy={session.strategy} orchestratorStrategy={session.orchestratorStrategy} />

        <span className="simpleSessionItemActivity">
          {formatTimeAgo(session.lastActivity)}
        </span>

        <button
          className="simpleSessionItemCloseBtn"
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
      <div className="simpleSessionItemMeta">
        <SessionDetailsSummary session={session} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="simpleSessionItemExpanded">
          {/* Tasks Section */}
          <div className="simpleSessionItemSection">
            <button
              className="simpleSessionItemSectionHeader"
              onClick={(e) => {
                e.stopPropagation();
                setShowTasks(!showTasks);
              }}
            >
              {showTasks ? "▾" : "▸"} Working on Tasks ({tasks.length})
            </button>

            {showTasks && (
              <div className="simpleSessionItemSectionContent">
                {taskTree.length === 0 ? (
                  <div className="simpleSessionItemEmpty">No tasks linked to this session</div>
                ) : (
                  <div className="simpleSessionItemTaskList">
                    {taskTree.map(({ task, subtasks }) => (
                      <div key={task.id} className="simpleSessionItemTaskGroup">
                        <div
                          className={`simpleSessionItemTask simpleSessionItemTask--${task.status}`}
                          onClick={() => onJumpToTask?.(task.id)}
                        >
                          <span className={`simpleSessionItemTaskStatus simpleSessionItemTaskStatus--${task.status}`}>
                            {TASK_STATUS_SYMBOLS[task.status] || "○"} {TASK_STATUS_LABELS[task.status] || task.status.toUpperCase()}
                          </span>

                          <span className={`simpleSessionItemTaskPriority simpleSessionItemTaskPriority--${task.priority}`}>
                            {task.priority === "high" ? "●" : task.priority === "medium" ? "●" : "●"} {task.priority.toUpperCase()}
                          </span>

                          <span className="simpleSessionItemTaskTitle">{task.title}</span>

                          {task.sessionStatus && (
                            <span className={`simpleSessionItemTaskSessionStatus simpleSessionItemTaskSessionStatus--${task.sessionStatus}`}>
                              {task.sessionStatus.replace("_", " ")}
                            </span>
                          )}

                          <button
                            className="simpleSessionItemTaskJump"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToTask?.(task.id);
                            }}
                            title="View task"
                          >
                            →
                          </button>
                        </div>

                        {/* Subtasks */}
                        {subtasks.length > 0 && (
                          <div className="simpleSessionItemSubtasks">
                            {subtasks.map(subtask => (
                              <div
                                key={subtask.id}
                                className={`simpleSessionItemTask simpleSessionItemTask--subtask simpleSessionItemTask--${subtask.status}`}
                                onClick={() => onJumpToTask?.(subtask.id)}
                              >
                                <span className="simpleSessionItemSubtaskPrefix">└─</span>
                                <span className={`simpleSessionItemTaskStatus simpleSessionItemTaskStatus--${subtask.status}`}>
                                  {TASK_STATUS_SYMBOLS[subtask.status] || "○"}
                                </span>
                                <span className="simpleSessionItemTaskTitle">{subtask.title}</span>
                                <button
                                  className="simpleSessionItemTaskJump"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onJumpToTask?.(subtask.id);
                                  }}
                                  title="View task"
                                >
                                  →
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline Section */}
          {hasTimeline && (
            <div className="simpleSessionItemSection">
              <button
                className="simpleSessionItemSectionHeader"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimeline(!showTimeline);
                }}
              >
                {showTimeline ? "▾" : "▸"} Session Timeline ({session.timeline.length} events)
              </button>

              {showTimeline && (
                <div className="simpleSessionItemSectionContent">
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
          <div className="simpleSessionItemSection">
            <button
              className="simpleSessionItemSectionHeader"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
            >
              {showDetails ? "▾" : "▸"} Session Details
            </button>

            {showDetails && (
              <div className="simpleSessionItemSectionContent">
                <SessionDetailsSection session={session} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
