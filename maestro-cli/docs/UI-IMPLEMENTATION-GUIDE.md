# UI Implementation Guide - Dual Status Model

**Date**: 2026-02-04
**Status**: Implementation Guide
**Target**: Maestro UI Team

---

## Overview

This guide outlines the UI changes required to implement the Dual Status Model for task management. The UI must display both agent status and human status, provide review workflows, and allow human-only actions like approving work and archiving tasks.

---

## Key UI Concepts

### Two Status Fields

1. **Agent Status** (`agentStatus`) - What Claude reports
   - Informational only
   - Updates automatically during session
   - Shows agent's current state

2. **Human Status** (`status`) - SOURCE OF TRUTH
   - What actually matters
   - Only humans can set terminal statuses (done, cancelled, wont_do)
   - Determines task filtering and metrics

### Permission Model

| Action | Agent (CLI) | Human (UI) | Auto (System) |
|--------|-------------|------------|---------------|
| Update agentStatus | ✅ | ❌ | ❌ |
| Set status to review | ❌ | ❌ | ✅ (when agent completes) |
| Set status to done | ❌ | ✅ | ❌ |
| Set status to cancelled | ❌ | ✅ | ❌ |
| Archive task | ❌ | ✅ | ❌ |

---

## Component Updates

### 1. Task Card Component

**File**: `src/components/maestro/TaskCard.tsx`

#### Current State Display
```typescript
<div className="task-status">
  Status: {task.status}
</div>
```

#### New Dual Status Display
```typescript
interface TaskCardProps {
  task: Task;
  onMarkDone?: (taskId: string) => void;
  onRequestChanges?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
}

function TaskCard({ task, onMarkDone, onRequestChanges, onCancel, onArchive }: TaskCardProps) {
  return (
    <div className="task-card">
      {/* Header */}
      <div className="task-header">
        <h3>{task.title}</h3>
        {task.archived && (
          <Badge variant="archived">📦 Archived</Badge>
        )}
      </div>

      {/* Dual Status Display */}
      <div className="task-status-section">
        {/* Human Status (Primary) */}
        <div className="status-primary">
          <StatusBadge status={task.status} />
          {task.status === 'review' && (
            <span className="needs-attention">⚠️ Needs Review</span>
          )}
        </div>

        {/* Agent Status (Secondary) */}
        {task.agentStatus && (
          <div className="status-secondary">
            <span className="label">Agent Status:</span>
            <AgentStatusBadge status={task.agentStatus} />
            {task.agentStatusReason && (
              <Tooltip content={task.agentStatusReason}>
                <InfoIcon />
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Review Workflow (when status === 'review') */}
      {task.status === 'review' && (
        <ReviewPanel
          task={task}
          onMarkDone={onMarkDone}
          onRequestChanges={onRequestChanges}
        />
      )}

      {/* Actions (when status === 'done') */}
      {task.status === 'done' && !task.archived && (
        <div className="task-actions">
          <Button
            variant="secondary"
            onClick={() => onArchive?.(task.id)}
          >
            📦 Archive Task
          </Button>
        </div>
      )}

      {/* Other task details */}
      <div className="task-details">
        {/* ... */}
      </div>
    </div>
  );
}
```

---

### 2. Review Panel Component

**File**: `src/components/maestro/ReviewPanel.tsx` (NEW)

```typescript
interface ReviewPanelProps {
  task: Task;
  onMarkDone: (taskId: string) => void;
  onRequestChanges: (taskId: string, feedback: string) => void;
}

function ReviewPanel({ task, onMarkDone, onRequestChanges }: ReviewPanelProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleMarkDone = () => {
    onMarkDone(task.id);
  };

  const handleRequestChanges = () => {
    if (!feedback.trim()) {
      alert('Please provide feedback about what needs to change');
      return;
    }
    onRequestChanges(task.id, feedback);
    setFeedback('');
    setShowFeedback(false);
  };

  return (
    <div className="review-panel">
      <div className="review-header">
        <h4>🎉 Agent has marked this task as complete!</h4>
        <p>Please review the work and confirm completion.</p>
      </div>

      {/* Agent's Completion Summary */}
      {task.agentStatusReason && (
        <div className="completion-summary">
          <strong>Agent Summary:</strong>
          <p>{task.agentStatusReason}</p>
        </div>
      )}

      {/* Acceptance Criteria Checklist */}
      <div className="acceptance-criteria">
        <strong>Acceptance Criteria:</strong>
        <ul>
          {task.acceptanceCriteria.map((criterion, idx) => (
            <li key={idx}>
              <Checkbox id={`criterion-${idx}`} />
              <label htmlFor={`criterion-${idx}`}>{criterion}</label>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="review-actions">
        <Button
          variant="success"
          size="lg"
          onClick={handleMarkDone}
        >
          ✅ Mark as Done
        </Button>

        <Button
          variant="warning"
          size="lg"
          onClick={() => setShowFeedback(!showFeedback)}
        >
          🔄 Request Changes
        </Button>
      </div>

      {/* Feedback Form */}
      {showFeedback && (
        <div className="feedback-form">
          <label>
            What needs to change?
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what needs to be revised..."
              rows={4}
            />
          </label>
          <div className="feedback-actions">
            <Button variant="primary" onClick={handleRequestChanges}>
              Submit Feedback
            </Button>
            <Button variant="ghost" onClick={() => setShowFeedback(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 3. Status Badge Components

**File**: `src/components/maestro/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: HumanStatus;
  showLabel?: boolean;
}

function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-icon">{config.icon}</span>
      {showLabel && <span className="status-label">{config.label}</span>}
    </span>
  );
}

function getStatusConfig(status: HumanStatus) {
  const configs = {
    todo: { icon: '⚪', label: 'To Do', color: 'gray' },
    queued: { icon: '🔵', label: 'Queued', color: 'blue' },
    in_progress: { icon: '🟡', label: 'In Progress', color: 'amber' },
    blocked: { icon: '🔴', label: 'Blocked', color: 'red' },
    paused: { icon: '🟣', label: 'Paused', color: 'purple' },
    review: { icon: '🟠', label: 'Review', color: 'orange' },
    changes_requested: { icon: '🔵', label: 'Changes Requested', color: 'teal' },
    done: { icon: '✅', label: 'Done', color: 'green' },
    cancelled: { icon: '⚫', label: 'Cancelled', color: 'gray-dark' },
    wont_do: { icon: '⚫', label: "Won't Do", color: 'gray-dark' },
  };

  return configs[status];
}

interface AgentStatusBadgeProps {
  status: AgentStatus;
  showLabel?: boolean;
}

function AgentStatusBadge({ status, showLabel = true }: AgentStatusBadgeProps) {
  const config = getAgentStatusConfig(status);

  return (
    <span className={`agent-status-badge agent-status-${status}`}>
      <span className="status-icon">{config.icon}</span>
      {showLabel && <span className="status-label">{config.label}</span>}
    </span>
  );
}

function getAgentStatusConfig(status: AgentStatus) {
  const configs = {
    working: { icon: '🟢', label: 'Working', color: 'green' },
    blocked: { icon: '🔴', label: 'Blocked', color: 'red' },
    needs_input: { icon: '🔵', label: 'Needs Input', color: 'blue' },
    completed: { icon: '✅', label: 'Completed', color: 'green' },
    failed: { icon: '❌', label: 'Failed', color: 'red' },
  };

  return configs[status];
}
```

---

### 4. Updates Panel Component

**File**: `src/components/maestro/UpdatesPanel.tsx` (NEW)

```typescript
interface UpdatesPanelProps {
  taskId: string;
}

function UpdatesPanel({ taskId }: UpdatesPanelProps) {
  const { data: updates, isLoading } = useQuery(
    ['task-updates', taskId],
    () => maestroClient.getTaskUpdates(taskId)
  );

  const [filter, setFilter] = useState<'all' | 'agent' | 'user'>('all');

  const filteredUpdates = updates?.filter(
    (update) => filter === 'all' || update.type === filter
  ) || [];

  const agentUpdates = filteredUpdates.filter((u) => u.type === 'agent');
  const userUpdates = filteredUpdates.filter((u) => u.type === 'user');

  return (
    <div className="updates-panel">
      {/* Filter Tabs */}
      <div className="updates-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All Updates ({filteredUpdates.length})
        </button>
        <button
          className={filter === 'agent' ? 'active' : ''}
          onClick={() => setFilter('agent')}
        >
          🤖 Agent ({agentUpdates.length})
        </button>
        <button
          className={filter === 'user' ? 'active' : ''}
          onClick={() => setFilter('user')}
        >
          👤 User ({userUpdates.length})
        </button>
      </div>

      {/* Updates List */}
      <div className="updates-list">
        {isLoading && <Spinner />}

        {filteredUpdates.length === 0 && (
          <div className="empty-state">
            No {filter !== 'all' && filter} updates yet
          </div>
        )}

        {filteredUpdates.map((update) => (
          <UpdateItem key={update.id} update={update} />
        ))}
      </div>

      {/* Add User Update */}
      <AddUpdateForm taskId={taskId} />
    </div>
  );
}

interface UpdateItemProps {
  update: SessionUpdate;
}

function UpdateItem({ update }: UpdateItemProps) {
  const isAgent = update.type === 'agent';
  const categoryIcon = getCategoryIcon(update.category);

  return (
    <div className={`update-item update-${update.type}`}>
      <div className="update-header">
        <span className="update-type">
          {isAgent ? '🤖 Agent' : '👤 User'}
        </span>
        <span className="update-category">
          {categoryIcon} {update.category}
        </span>
        <span className="update-time">
          {formatTimestamp(update.timestamp)}
        </span>
      </div>
      <div className="update-content">
        {update.content}
      </div>
    </div>
  );
}

function getCategoryIcon(category: UpdateCategory): string {
  const icons = {
    progress: '📝',
    completion: '✅',
    blocked: '🚫',
    question: '❓',
    error: '❌',
    note: '💬',
    feedback: '💭',
    instruction: '📋',
    approval: '✅',
    rejection: '🔄',
  };
  return icons[category] || '📝';
}
```

---

### 5. Task List Filtering

**File**: `src/components/maestro/TaskList.tsx`

```typescript
interface TaskListProps {
  projectId: string;
}

function TaskList({ projectId }: TaskListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'review' | 'done'>('active');
  const [hideArchived, setHideArchived] = useState(true);

  const { data: tasks } = useQuery(
    ['tasks', projectId, statusFilter, hideArchived],
    () => maestroClient.getTasks(projectId, {
      statusFilter,
      archived: hideArchived ? false : undefined
    })
  );

  // Group tasks by status
  const tasksByStatus = groupBy(tasks, 'status');
  const reviewTasks = tasksByStatus.review || [];
  const activeTasks = [
    ...(tasksByStatus.in_progress || []),
    ...(tasksByStatus.blocked || []),
  ];
  const doneTasks = tasksByStatus.done || [];

  return (
    <div className="task-list">
      {/* Filters */}
      <div className="task-filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All Tasks</option>
          <option value="active">Active Tasks</option>
          <option value="review">Needs Review ({reviewTasks.length})</option>
          <option value="done">Done</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={hideArchived}
            onChange={(e) => setHideArchived(e.target.checked)}
          />
          Hide Archived
        </label>
      </div>

      {/* Review Section (Always Visible if Tasks) */}
      {reviewTasks.length > 0 && (
        <div className="task-section review-section">
          <h3>🟠 Needs Review ({reviewTasks.length})</h3>
          <p className="section-description">
            These tasks are complete and awaiting your approval
          </p>
          {reviewTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Active Tasks */}
      {statusFilter === 'active' && (
        <div className="task-section">
          <h3>🟡 Active ({activeTasks.length})</h3>
          {activeTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Done Tasks */}
      {statusFilter === 'done' && (
        <div className="task-section">
          <h3>✅ Done ({doneTasks.length})</h3>
          {doneTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## API Client Updates

**File**: `src/utils/MaestroClient.ts`

```typescript
class MaestroClient {
  // ... existing methods ...

  /**
   * Mark task as done (human approval)
   */
  async markTaskDone(taskId: string, reason?: string): Promise<Task> {
    return this.patch<Task>(`/api/tasks/${taskId}/status`, {
      status: 'done',
      reason
    });
  }

  /**
   * Request changes on task
   */
  async requestTaskChanges(taskId: string, feedback: string): Promise<Task> {
    // Update status
    const task = await this.patch<Task>(`/api/tasks/${taskId}/status`, {
      status: 'changes_requested',
      reason: feedback
    });

    // Create user update with feedback
    await this.createUserUpdate(taskId, {
      category: 'feedback',
      content: feedback
    });

    return task;
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId: string, reason?: string): Promise<Task> {
    return this.patch<Task>(`/api/tasks/${taskId}/status`, {
      status: 'cancelled',
      reason
    });
  }

  /**
   * Archive task (irreversible)
   */
  async archiveTask(taskId: string): Promise<Task> {
    return this.patch<Task>(`/api/tasks/${taskId}/archive`, {
      archived: true
    });
  }

  /**
   * Get task updates
   */
  async getTaskUpdates(taskId: string, type?: 'agent' | 'user'): Promise<SessionUpdate[]> {
    const query = type ? `?type=${type}` : '';
    return this.get<SessionUpdate[]>(`/api/tasks/${taskId}/updates${query}`);
  }

  /**
   * Create user update
   */
  async createUserUpdate(taskId: string, data: {
    category: 'note' | 'feedback' | 'instruction' | 'approval' | 'rejection';
    content: string;
  }): Promise<SessionUpdate> {
    return this.post<SessionUpdate>(`/api/tasks/${taskId}/updates`, {
      type: 'user',
      category: data.category,
      content: data.content
    });
  }
}
```

---

## WebSocket Event Handlers

**File**: `src/stores/useMaestroStore.ts`

```typescript
// Add to WebSocket message handler
case 'task:agent_status_updated': {
  const { taskId, agentStatus, status } = message.data;

  // Update task in cache
  set((state) => {
    const task = state.tasks.get(taskId);
    if (task) {
      return {
        tasks: new Map(state.tasks).set(taskId, {
          ...task,
          agentStatus,
          status, // May have auto-updated
          agentStatusUpdatedAt: message.data.timestamp
        })
      };
    }
    return state;
  });

  // Show notification if agent completed
  if (agentStatus === 'completed') {
    toast.info('Task ready for review', {
      description: `${task.title} is complete and awaiting your approval`
    });
  }

  break;
}

case 'task:status_updated': {
  const { taskId, status, updatedBy } = message.data;

  // Update task in cache
  set((state) => {
    const task = state.tasks.get(taskId);
    if (task) {
      return {
        tasks: new Map(state.tasks).set(taskId, {
          ...task,
          status,
          statusUpdatedAt: message.data.timestamp,
          statusUpdatedBy: updatedBy
        })
      };
    }
    return state;
  });

  break;
}

case 'task:archived': {
  const { taskId, archivedBy } = message.data;

  // Update task in cache
  set((state) => {
    const task = state.tasks.get(taskId);
    if (task) {
      return {
        tasks: new Map(state.tasks).set(taskId, {
          ...task,
          archived: true,
          archivedAt: message.data.timestamp,
          archivedBy
        })
      };
    }
    return state;
  });

  break;
}

case 'task:update_created': {
  const { taskId, update } = message.data;

  // Refresh updates for this task
  queryClient.invalidateQueries(['task-updates', taskId]);

  // Show notification for agent updates
  if (update.type === 'agent' && update.category === 'question') {
    toast.info('Agent needs input', {
      description: update.content
    });
  }

  break;
}
```

---

## Styling Guide

**File**: `src/styles/task-status.css`

```css
/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-todo { background: #f3f4f6; color: #6b7280; }
.status-queued { background: #dbeafe; color: #1e40af; }
.status-in_progress { background: #fef3c7; color: #92400e; }
.status-blocked { background: #fee2e2; color: #991b1b; }
.status-paused { background: #e9d5ff; color: #6b21a8; }
.status-review { background: #fed7aa; color: #9a3412; }
.status-changes_requested { background: #ccfbf1; color: #115e59; }
.status-done { background: #d1fae5; color: #065f46; }
.status-cancelled { background: #f3f4f6; color: #374151; }
.status-wont_do { background: #f3f4f6; color: #374151; }

/* Review Panel */
.review-panel {
  background: linear-gradient(to bottom, #fffbeb, #fef3c7);
  border: 2px solid #fbbf24;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 1rem 0;
}

.review-header h4 {
  color: #92400e;
  margin-bottom: 0.5rem;
}

.review-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

/* Updates Panel */
.update-item {
  border-left: 3px solid #e5e7eb;
  padding: 1rem;
  margin-bottom: 1rem;
}

.update-item.update-agent {
  border-left-color: #3b82f6;
  background: #eff6ff;
}

.update-item.update-user {
  border-left-color: #8b5cf6;
  background: #f5f3ff;
}
```

---

## Testing Checklist

### UI Components

- [ ] TaskCard shows both agent and human status
- [ ] ReviewPanel appears when status === 'review'
- [ ] "Mark as Done" button works
- [ ] "Request Changes" button works with feedback
- [ ] Archive button appears when status === 'done'
- [ ] Archive button works (irreversible)
- [ ] Status badges display correct colors and icons
- [ ] Agent status badge shows tooltip with reason

### Filtering

- [ ] "Needs Review" filter shows only review tasks
- [ ] "Hide Archived" checkbox works
- [ ] Review section always visible when tasks exist
- [ ] Task counts update correctly

### Real-time Updates

- [ ] Agent status updates appear in real-time
- [ ] Human status updates appear in real-time
- [ ] Archive events update UI in real-time
- [ ] Notifications shown for important events

### Updates Panel

- [ ] Agent updates display with correct icons
- [ ] User updates display with correct icons
- [ ] Filter tabs work correctly
- [ ] Add user update form works

---

## Summary

**Components to Create**: 5 new components
- ReviewPanel
- UpdatesPanel
- UpdateItem
- AddUpdateForm
- StatusBadge / AgentStatusBadge

**Components to Update**: 3 existing components
- TaskCard
- TaskList
- MaestroClient

**WebSocket Handlers**: 4 new event types
- task:agent_status_updated
- task:status_updated
- task:archived
- task:update_created

**New API Methods**: 6 methods
- markTaskDone()
- requestTaskChanges()
- cancelTask()
- archiveTask()
- getTaskUpdates()
- createUserUpdate()

**Status**: Ready for Implementation
**Priority**: High (Complements CLI changes)
**Estimated Effort**: 3-4 days
