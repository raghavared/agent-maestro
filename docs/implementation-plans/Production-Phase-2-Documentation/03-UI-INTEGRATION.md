# UI Integration - How Hooks Update the Interface

**Version:** 1.0
**Date:** 2026-02-01

---

## Overview

This document details **how hook events flow from Claude Code sessions to the Maestro UI** and which components get updated.

---

## Data Flow: Hook to UI

```
1. Claude Code executes tool (e.g., Read file.ts)
   ↓
2. PostToolUse hook fires
   ↓
3. Hook script POSTs to webhook
   POST /api/webhooks/hook-event
   ↓
4. Server processes event
   - Maps Claude session → Maestro session
   - Updates storage (metrics, timeline)
   ↓
5. Server broadcasts WebSocket event
   emit('hook:tool_use', {sessionId, taskIds, activity})
   ↓
6. UI WebSocket handler receives event
   useMaestroWebSocket({onHookToolUse: (data) => {...}})
   ↓
7. UI components update
   - LiveActivityFeed: Adds "Reading file.ts"
   - TaskCard: Updates last activity
   - Timeline: Adds timeline event
   - Metrics: Increments Read counter
   ↓
8. User sees update (< 100ms total latency)
```

---

## UI Components Updated by Hooks

### Component Map

| Hook Event | Component | Update | Visual Change |
|------------|-----------|--------|---------------|
| **SessionStart** | SessionCard status badge | status → "active" | 🟢 Active badge appears |
| **SessionStart** | TaskCard timeline | Add "Session started" | Timeline entry added |
| **PostToolUse** | LiveActivityFeed | Add activity item | "Reading auth.ts" appears |
| **PostToolUse** | TaskCard last activity | Update timestamp | "2s ago" → "Just now" |
| **PostToolUse** | Timeline | Add tool use event | "10:05 AM - Read auth.ts" |
| **PostToolUse** | ToolUsageChart | Increment counter | Read: 12 → 13 |
| **PostToolUse** | SessionMetrics | Update total | "45 tools used" → "46" |
| **Notification** (permission) | TaskCard badge | Show "Blocked" | ⚠️ Blocked badge |
| **Notification** (permission) | PermissionModal | Show modal | Modal opens |
| **Notification** (permission) | TaskCard status | status → "blocked" | Status color changes |
| **PostToolUseFailure** | ErrorToast | Show error | Toast notification |
| **PostToolUseFailure** | Timeline | Add error event | "❌ npm test failed" |
| **SessionEnd** | SessionCard badge | status → "completed" | ✓ Completed badge |
| **SessionEnd** | TaskCard timeline | Add "Session ended" | Timeline entry |
| **SessionEnd** | SessionDuration | Show duration | "Duration: 7m 34s" |

---

## Implementation Details

### Step 1: Add WebSocket Hook Event Types

**File:** `src/hooks/useMaestroWebSocket.ts`

```typescript
// Add new event types
type WebSocketEvent =
  | { event: 'task:created'; data: Task }
  | { event: 'task:updated'; data: Task }
  | { event: 'task:deleted'; data: { id: string } }
  | { event: 'session:created'; data: Session }
  | { event: 'session:updated'; data: Session }
  | { event: 'session:deleted'; data: { id: string } }
  // NEW: Hook events
  | {
      event: 'hook:tool_use';
      data: {
        sessionId: string;
        taskIds: string[];
        activity: {
          tool: string;
          description: string;
          timestamp: number;
        };
      };
    }
  | {
      event: 'hook:notification';
      data: {
        sessionId: string;
        taskIds: string[];
        type: string;
        message: string;
        timestamp: number;
      };
    }
  | {
      event: 'hook:session_start';
      data: {
        sessionId: string;
        taskIds: string[];
        source: string;
        model: string;
        timestamp: number;
      };
    }
  | {
      event: 'hook:session_end';
      data: {
        sessionId: string;
        taskIds: string[];
        reason: string;
        duration: number;
        timestamp: number;
      };
    }
  | {
      event: 'hook:tool_failure';
      data: {
        sessionId: string;
        taskIds: string[];
        activity: {
          tool: string;
          description: string;
          error: string;
          timestamp: number;
        };
      };
    };

// Add callbacks
export type MaestroWebSocketCallbacks = {
  // Existing callbacks...
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  // ... other existing callbacks ...

  // NEW: Hook event callbacks
  onHookToolUse?: (data: {
    sessionId: string;
    taskIds: string[];
    activity: { tool: string; description: string; timestamp: number };
  }) => void;

  onHookNotification?: (data: {
    sessionId: string;
    taskIds: string[];
    type: string;
    message: string;
    timestamp: number;
  }) => void;

  onHookSessionStart?: (data: {
    sessionId: string;
    taskIds: string[];
    source: string;
    model: string;
    timestamp: number;
  }) => void;

  onHookSessionEnd?: (data: {
    sessionId: string;
    taskIds: string[];
    reason: string;
    duration: number;
    timestamp: number;
  }) => void;

  onHookToolFailure?: (data: {
    sessionId: string;
    taskIds: string[];
    activity: { tool: string; description: string; error: string; timestamp: number };
  }) => void;
};

// In the WebSocket message handler
ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data) as WebSocketEvent;
    console.log('[Maestro WebSocket] Received:', message.event, message.data);

    switch (message.event) {
      // Existing cases...
      case 'task:created':
        callbacksRef.current.onTaskCreated?.(message.data);
        break;
      // ...

      // NEW: Hook event cases
      case 'hook:tool_use':
        callbacksRef.current.onHookToolUse?.(message.data);
        break;

      case 'hook:notification':
        callbacksRef.current.onHookNotification?.(message.data);
        break;

      case 'hook:session_start':
        callbacksRef.current.onHookSessionStart?.(message.data);
        break;

      case 'hook:session_end':
        callbacksRef.current.onHookSessionEnd?.(message.data);
        break;

      case 'hook:tool_failure':
        callbacksRef.current.onHookToolFailure?.(message.data);
        break;
    }
  } catch (error) {
    console.error('[Maestro WebSocket] Failed to parse message:', error);
  }
};
```

---

### Step 2: Create LiveActivityFeed Component

**File:** `src/components/maestro/LiveActivityFeed.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';

interface Activity {
  tool: string;
  description: string;
  timestamp: number;
  isError?: boolean;
}

interface Props {
  taskId: string;
  maxItems?: number;
}

export function LiveActivityFeed({ taskId, maxItems = 10 }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useMaestroWebSocket({
    onHookToolUse: (data) => {
      if (data.taskIds.includes(taskId)) {
        setActivities((prev) =>
          [...prev, data.activity].slice(-maxItems)
        );
      }
    },
    onHookToolFailure: (data) => {
      if (data.taskIds.includes(taskId)) {
        setActivities((prev) =>
          [...prev, { ...data.activity, isError: true }].slice(-maxItems)
        );
      }
    }
  });

  if (activities.length === 0) {
    return (
      <div className="activity-feed empty">
        <p className="text-muted">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      <h4>Live Activity</h4>
      <ul className="activity-list">
        {activities.map((activity, i) => (
          <li
            key={i}
            className={`activity-item ${activity.isError ? 'error' : ''}`}
          >
            <span className="timestamp">
              {formatTimeAgo(activity.timestamp)}
            </span>
            <span className="tool-icon">
              {getToolIcon(activity.tool, activity.isError)}
            </span>
            <span className="description">{activity.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getToolIcon(tool: string, isError?: boolean): string {
  if (isError) return '❌';

  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '📝',
    Bash: '⚙️',
    Grep: '🔍',
    Glob: '📁',
    WebFetch: '🌐',
    WebSearch: '🔎',
    Task: '🤖'
  };
  return icons[tool] || '🔧';
}
```

**Styles:** `src/components/maestro/LiveActivityFeed.css`

```css
.activity-feed {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.activity-feed h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.activity-feed.empty {
  padding: 2rem;
  text-align: center;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e8e8e8;
  font-size: 0.875rem;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item.error {
  background: #fff3f3;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #ffcccc;
}

.activity-item .timestamp {
  color: #999;
  font-size: 0.75rem;
  min-width: 60px;
}

.activity-item .tool-icon {
  font-size: 1rem;
}

.activity-item .description {
  flex: 1;
  color: #333;
}

.activity-item.error .description {
  color: #d32f2f;
}
```

---

### Step 3: Add Pending Action Badge to TaskCard

**File:** `src/components/maestro/TaskCard.tsx`

```typescript
import React, { useState } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';
import { LiveActivityFeed } from './LiveActivityFeed';
import type { Task } from '../../types/maestro';

export function TaskCard({ task }: { task: Task }) {
  const [blocked, setBlocked] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useMaestroWebSocket({
    onHookNotification: (data) => {
      if (data.taskIds.includes(task.id) && data.type === 'permission_prompt') {
        setBlocked(data.message);
        setShowPermissionModal(true);
      }
    },
    onHookToolUse: (data) => {
      if (data.taskIds.includes(task.id)) {
        // Clear blocked state when activity resumes
        setBlocked(null);
        setShowPermissionModal(false);
      }
    }
  });

  return (
    <div className="task-card">
      <div className="task-header">
        <h3>{task.title}</h3>
        <div className="badges">
          {task.status === 'in_progress' && !blocked && (
            <span className="badge badge-success">
              🟢 In Progress
            </span>
          )}
          {blocked && (
            <span className="badge badge-warning">
              ⚠️ Blocked
            </span>
          )}
          {task.status === 'completed' && (
            <span className="badge badge-completed">
              ✓ Completed
            </span>
          )}
        </div>
      </div>

      {blocked && (
        <div className="blocked-message">
          <p><strong>Waiting for permission:</strong></p>
          <p>{blocked}</p>
          <div className="actions">
            <button onClick={() => setShowPermissionModal(true)}>
              View Details
            </button>
          </div>
        </div>
      )}

      <LiveActivityFeed taskId={task.id} />

      {/* Rest of task card... */}
    </div>
  );
}
```

**Styles:**

```css
.task-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-success {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-warning {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffb74d;
}

.badge-completed {
  background: #e3f2fd;
  color: #1976d2;
}

.blocked-message {
  background: #fff8e1;
  border: 1px solid #ffb74d;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.blocked-message strong {
  color: #e65100;
}

.blocked-message .actions {
  margin-top: 0.75rem;
}

.blocked-message button {
  background: #ff9800;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.blocked-message button:hover {
  background: #f57c00;
}
```

---

### Step 4: Add Session Status Indicators

**File:** `src/components/maestro/SessionCard.tsx` (or SessionsSection update)

```typescript
import React, { useState, useEffect } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';
import type { Session } from '../../types/maestro';

export function SessionCard({ session }: { session: Session }) {
  const [status, setStatus] = useState(session.status || 'idle');
  const [duration, setDuration] = useState<number | null>(null);

  useMaestroWebSocket({
    onHookSessionStart: (data) => {
      if (data.sessionId === session.id) {
        setStatus('active');
      }
    },
    onHookSessionEnd: (data) => {
      if (data.sessionId === session.id) {
        setStatus('completed');
        setDuration(data.duration);
      }
    }
  });

  return (
    <div className="session-card">
      <div className="session-header">
        <h4>{session.name}</h4>
        <span className={`status-badge status-${status}`}>
          {getStatusIcon(status)} {status}
        </span>
      </div>

      {duration && (
        <div className="session-meta">
          <span>Duration: {formatDuration(duration)}</span>
        </div>
      )}

      {/* Rest of session card... */}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'active': return '🟢';
    case 'completed': return '✓';
    case 'idle': return '⚪';
    case 'blocked': return '⚠️';
    default: return '○';
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
```

---

### Step 5: Add Tool Usage Analytics

**File:** `src/components/maestro/ToolUsageChart.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';

interface ToolMetric {
  tool: string;
  uses: number;
}

interface Props {
  sessionId: string;
}

export function ToolUsageChart({ sessionId }: Props) {
  const [metrics, setMetrics] = useState<ToolMetric[]>([]);

  useMaestroWebSocket({
    onHookToolUse: (data) => {
      if (data.sessionId === sessionId) {
        setMetrics((prev) => {
          const existing = prev.find(m => m.tool === data.activity.tool);
          if (existing) {
            return prev.map(m =>
              m.tool === data.activity.tool
                ? { ...m, uses: m.uses + 1 }
                : m
            );
          } else {
            return [...prev, { tool: data.activity.tool, uses: 1 }];
          }
        });
      }
    }
  });

  if (metrics.length === 0) {
    return null;
  }

  const maxUses = Math.max(...metrics.map(m => m.uses));

  return (
    <div className="tool-usage-chart">
      <h4>Tool Usage</h4>
      <div className="chart">
        {metrics.map((metric) => (
          <div key={metric.tool} className="chart-row">
            <span className="tool-name">{metric.tool}</span>
            <div className="bar-container">
              <div
                className="bar"
                style={{ width: `${(metric.uses / maxUses) * 100}%` }}
              />
            </div>
            <span className="uses">{metric.uses} uses</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Styles:**

```css
.tool-usage-chart {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.tool-usage-chart h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.chart-row {
  display: grid;
  grid-template-columns: 80px 1fr 80px;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.tool-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.bar-container {
  height: 24px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #66bb6a);
  transition: width 0.3s ease;
}

.uses {
  text-align: right;
  font-size: 0.75rem;
  color: #666;
}
```

---

### Step 6: Add Error Toast Notifications

**File:** `src/components/maestro/ErrorToast.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';

interface ToastMessage {
  id: string;
  message: string;
  tool: string;
  error: string;
}

export function ErrorToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useMaestroWebSocket({
    onHookToolFailure: (data) => {
      const toast: ToastMessage = {
        id: Math.random().toString(36).substr(2, 9),
        message: data.activity.description,
        tool: data.activity.tool,
        error: data.activity.error
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== toast.id));
      }, 5000);
    }
  });

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast toast-error">
          <div className="toast-header">
            <strong>❌ {toast.tool} Failed</strong>
            <button
              className="close-btn"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
          <div className="toast-body">
            <p>{toast.message}</p>
            <p className="error-detail">{toast.error}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Styles:**

```css
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

.toast {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-error {
  border-left: 4px solid #d32f2f;
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #ffebee;
  border-bottom: 1px solid #ffcdd2;
}

.toast-header strong {
  color: #c62828;
  font-size: 0.875rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.toast-body {
  padding: 0.75rem 1rem;
}

.toast-body p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
}

.toast-body p:last-child {
  margin-bottom: 0;
}

.error-detail {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #666;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
}
```

---

### Step 7: Update App.tsx to Include Components

**File:** `src/App.tsx`

```typescript
import { ErrorToastContainer } from './components/maestro/ErrorToast';
import { MaestroPanel } from './components/maestro/MaestroPanel';

function App() {
  return (
    <div className="App">
      <MaestroPanel />
      <ErrorToastContainer />
    </div>
  );
}

export default App;
```

---

## Summary: Hook → UI Mapping

| Hook Event | What Happens | UI Components Updated | User Sees |
|------------|--------------|----------------------|-----------|
| **SessionStart** | Session initializes | SessionCard, Timeline | "🟢 Active" badge |
| **PostToolUse** (Read) | Agent reads file | LiveActivityFeed, Timeline, ToolChart | "Reading auth.ts" (instant) |
| **PostToolUse** (Write) | Agent writes file | LiveActivityFeed, Timeline, ToolChart | "Created middleware.ts" |
| **PostToolUse** (Bash) | Agent runs command | LiveActivityFeed, Timeline, ToolChart | "Executed: npm test" |
| **Notification** (permission) | Agent needs approval | TaskCard badge, Modal | "⚠️ Blocked" badge + modal |
| **PostToolUseFailure** | Tool fails | ErrorToast, Timeline | Red toast notification |
| **SessionEnd** | Session completes | SessionCard, Timeline | "✓ Completed" + duration |

---

## Performance Considerations

### Debouncing Rapid Updates

For high-frequency tool use:

```typescript
const [activities, setActivities] = useState<Activity[]>([]);
const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

useMaestroWebSocket({
  onHookToolUse: (data) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      setActivities((prev) => [...prev, data.activity].slice(-10));
    }, 50);  // Batch updates within 50ms
  }
});
```

### Virtualization for Long Lists

For tasks with many timeline events:

```typescript
import { FixedSizeList } from 'react-window';

function VirtualizedTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <FixedSizeList
      height={400}
      itemCount={events.length}
      itemSize={60}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          {events[index].message}
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Spawn a session, verify "🟢 Active" badge appears
- [ ] Read a file, verify activity appears in feed instantly
- [ ] Write a file, verify activity appears
- [ ] Run `npm test`, verify "Executed: npm test" appears
- [ ] Trigger permission prompt, verify "⚠️ Blocked" badge
- [ ] Cause tool failure, verify error toast
- [ ] End session, verify "✓ Completed" badge and duration
- [ ] Check timeline has all events
- [ ] Check tool usage chart shows correct counts

---

## Next Steps

1. → Read [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md) for step-by-step implementation
2. → Read [05-HOOK-SCRIPTS-REFERENCE.md](./05-HOOK-SCRIPTS-REFERENCE.md) for hook script details

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
