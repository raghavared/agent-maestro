import React, { useState, useMemo } from "react";
import type { MaestroSession, MaestroTask, MaestroSessionStatus } from "../../app/types/maestro";
import { StrategyBadge } from "./StrategyBadge";
import { SessionTimeline } from "./SessionTimeline";
import { SessionDetailsSection, SessionDetailsSummary } from "./SessionDetailsSection";

interface TreeSessionItemProps {
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
  spawning: "\u25CC",
  idle: "\u25CB",
  working: "\u25C9",
  completed: "\u2713",
  failed: "\u2717",
  stopped: "\u2298",
};

const SESSION_STATUS_LABELS: Record<MaestroSessionStatus, string> = {
  spawning: "Spawning",
  idle: "Idle",
  working: "Working",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

// Task status symbols
const TASK_STATUS_SYMBOLS: Record<string, string> = {
  todo: "\u25CB",
  in_progress: "\u25C9",
  completed: "\u2713",
  cancelled: "\u2298",
  blocked: "\u2717",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface TaskTreeNode {
  task: MaestroTask;
  children: TaskTreeNode[];
}

function buildTaskTree(tasks: MaestroTask[]): TaskTreeNode[] {
  const taskMap = new Map<string, MaestroTask>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const roots: TaskTreeNode[] = [];
  const nodeMap = new Map<string, TaskTreeNode>();

  // Create nodes
  tasks.forEach(t => {
    nodeMap.set(t.id, { task: t, children: [] });
  });

  // Build tree
  tasks.forEach(t => {
    const node = nodeMap.get(t.id)!;
    if (t.parentId && nodeMap.has(t.parentId)) {
      nodeMap.get(t.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function TreeTaskNode({
  node,
  isLast,
  prefix,
  onJumpToTask,
}: {
  node: TaskTreeNode;
  isLast: boolean;
  prefix: string;
  onJumpToTask?: (taskId: string) => void;
}) {
  const { task, children } = node;
  const connector = prefix === "" ? "" : (isLast ? "\u2514\u2500 " : "\u251C\u2500 ");
  const childPrefix = prefix === "" ? "" : (prefix + (isLast ? "   " : "\u2502  "));

  return (
    <>
      <div
        className={`treeSessionItemTask treeSessionItemTask--${task.status}`}
        onClick={() => onJumpToTask?.(task.id)}
      >
        <span className="treeSessionItemTaskPrefix">{prefix}{connector}</span>
        <span className={`treeSessionItemTaskStatus treeSessionItemTaskStatus--${task.status}`}>
          {TASK_STATUS_SYMBOLS[task.status] || "\u25CB"}
        </span>
        <span className="treeSessionItemTaskTitle">{task.title}</span>
        <span className={`treeSessionItemTaskPriority treeSessionItemTaskPriority--${task.priority}`}>
          {task.priority.toUpperCase()}
        </span>
        {onJumpToTask && (
          <button
            className="treeSessionItemTaskJump"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToTask(task.id);
            }}
            title="View task"
          >
            {"\u2192"}
          </button>
        )}
      </div>
      {children.map((child, i) => (
        <TreeTaskNode
          key={child.task.id}
          node={child}
          isLast={i === children.length - 1}
          prefix={childPrefix}
          onJumpToTask={onJumpToTask}
        />
      ))}
    </>
  );
}

export function TreeSessionItem({
  session,
  tasks,
  isActive,
  isExpanded,
  onToggle,
  onSelect,
  onClose,
  onJumpToTask,
}: TreeSessionItemProps) {
  const [showTree, setShowTree] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const treeRoots = useMemo(() => buildTaskTree(tasks), [tasks]);

  const completedCount = useMemo(
    () => tasks.filter(t => t.status === "completed").length,
    [tasks]
  );

  const hasTimeline = session.timeline && session.timeline.length > 0;

  return (
    <div
      className={`simpleSessionItem simpleSessionItem--${session.status} ${isActive ? "simpleSessionItem--active" : ""} ${isExpanded ? "simpleSessionItem--expanded" : ""}`}
    >
      {/* Header */}
      <div className="simpleSessionItemHeader" onClick={onToggle}>
        <button className={`simpleSessionItemToggle ${isExpanded ? "expanded" : ""}`}>
          {isExpanded ? "\u25BE" : "\u25B8"}
        </button>

        <span className={`simpleSessionItemStatus simpleSessionItemStatus--${session.status}`}>
          {SESSION_STATUS_SYMBOLS[session.status]} {SESSION_STATUS_LABELS[session.status]}
        </span>

        <span className="simpleSessionItemName">{session.name}</span>

        <StrategyBadge strategy={session.strategy} compact />

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
          {"\u00D7"}
        </button>
      </div>

      {/* Meta Line */}
      <div className="simpleSessionItemMeta">
        <SessionDetailsSummary session={session} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="simpleSessionItemExpanded">
          {/* Task Tree Section */}
          <div className="simpleSessionItemSection">
            <button
              className="simpleSessionItemSectionHeader"
              onClick={(e) => {
                e.stopPropagation();
                setShowTree(!showTree);
              }}
            >
              {showTree ? "\u25BE" : "\u25B8"} Task Tree ({completedCount}/{tasks.length} completed)
            </button>

            {showTree && (
              <div className="simpleSessionItemSectionContent">
                {treeRoots.length === 0 ? (
                  <div className="simpleSessionItemEmpty">No tasks linked to this session</div>
                ) : (
                  <div className="treeSessionItemTaskTree">
                    {treeRoots.map((root, i) => (
                      <TreeTaskNode
                        key={root.task.id}
                        node={root}
                        isLast={i === treeRoots.length - 1}
                        prefix=""
                        onJumpToTask={onJumpToTask}
                      />
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
                {showTimeline ? "\u25BE" : "\u25B8"} Session Timeline ({session.timeline.length} events)
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
              {showDetails ? "\u25BE" : "\u25B8"} Session Details
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
