import React, { useState } from "react";
import type { MaestroTask, TaskPriority } from "../../app/types/maestro";
import { QueueItemStatusBadge, PriorityBadge, type QueueItemStatus } from "./StrategyBadge";

// Queue item interface (matches server QueueItem type)
export interface QueueItem {
  taskId: string;
  status: QueueItemStatus;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  failReason?: string;
}

// Queue state interface (matches server QueueState type)
export interface QueueState {
  sessionId: string;
  strategy: "queue";
  items: QueueItem[];
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
}

interface QueueStatusDisplayProps {
  queueState: QueueState;
  tasks: Map<string, MaestroTask>;
  onJumpToTask?: (taskId: string) => void;
  compact?: boolean;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function QueueStatusDisplay({
  queueState,
  tasks,
  onJumpToTask,
  compact = false,
}: QueueStatusDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { items, currentIndex } = queueState;

  // Calculate queue stats
  const stats = {
    total: items.length,
    completed: items.filter((i) => i.status === "completed").length,
    processing: items.filter((i) => i.status === "processing").length,
    queued: items.filter((i) => i.status === "queued").length,
    failed: items.filter((i) => i.status === "failed").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  };

  return (
    <div className={`queueStatusDisplay ${compact ? "queueStatusDisplay--compact" : ""}`}>
      <button
        className="queueStatusHeader"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="queueStatusToggle">{isExpanded ? "▾" : "▸"}</span>
        <span className="queueStatusTitle">Queue Status</span>
        <span className="queueStatusCount">({items.length} tasks)</span>
        <span className="queueStatusProgress">
          {stats.completed}/{stats.total} done
        </span>
      </button>

      {isExpanded && (
        <div className="queueStatusContent">
          {/* Queue Stats Summary */}
          <div className="queueStatusStats">
            {stats.processing > 0 && (
              <span className="queueStatusStat queueStatusStat--processing">
                {stats.processing} processing
              </span>
            )}
            {stats.queued > 0 && (
              <span className="queueStatusStat queueStatusStat--queued">
                {stats.queued} queued
              </span>
            )}
            {stats.completed > 0 && (
              <span className="queueStatusStat queueStatusStat--completed">
                {stats.completed} completed
              </span>
            )}
            {stats.failed > 0 && (
              <span className="queueStatusStat queueStatusStat--failed">
                {stats.failed} failed
              </span>
            )}
            {stats.skipped > 0 && (
              <span className="queueStatusStat queueStatusStat--skipped">
                {stats.skipped} skipped
              </span>
            )}
          </div>

          {/* Queue Items */}
          <div className="queueStatusItems">
            {items.map((item, index) => {
              const task = tasks.get(item.taskId);
              const isCurrent = index === currentIndex;

              return (
                <div
                  key={item.taskId}
                  className={`queueStatusItem queueStatusItem--${item.status} ${isCurrent ? "queueStatusItem--current" : ""}`}
                >
                  <span className="queueStatusItemPosition">#{index + 1}</span>

                  <QueueItemStatusBadge status={item.status} compact={compact} />

                  <span className="queueStatusItemTitle" title={task?.title}>
                    {task?.title || `Task ${item.taskId.slice(0, 8)}`}
                  </span>

                  {task?.priority && (
                    <PriorityBadge priority={task.priority} compact />
                  )}

                  <div className="queueStatusItemMeta">
                    {item.status === "queued" && (
                      <span>Queued {formatTimeAgo(item.addedAt)}</span>
                    )}
                    {item.status === "processing" && item.startedAt && (
                      <span>Started {formatTimeAgo(item.startedAt)}</span>
                    )}
                    {item.status === "completed" && item.completedAt && (
                      <span>Completed {formatTimeAgo(item.completedAt)}</span>
                    )}
                    {item.status === "failed" && (
                      <span className="queueStatusItemError">
                        {item.failReason || "Failed"}
                      </span>
                    )}
                    {item.status === "skipped" && (
                      <span>{item.failReason || "Skipped"}</span>
                    )}
                  </div>

                  {onJumpToTask && (
                    <button
                      className="queueStatusItemAction"
                      onClick={() => onJumpToTask(item.taskId)}
                      title="View task"
                    >
                      →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact inline queue indicator for headers
interface QueueIndicatorProps {
  queueState: QueueState;
}

export function QueueIndicator({ queueState }: QueueIndicatorProps) {
  const { items, currentIndex } = queueState;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const position = currentIndex >= 0 ? currentIndex + 1 : completedCount;

  return (
    <span className="queueIndicator" title={`Queue: ${position} of ${items.length}`}>
      Q:{position}/{items.length}
    </span>
  );
}
