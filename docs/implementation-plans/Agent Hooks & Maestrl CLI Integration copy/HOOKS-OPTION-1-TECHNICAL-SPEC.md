# Option 1: Centralized Webhook - Technical Specification

**For:** Maestro Orchestration System
**Option:** Centralized Webhook Endpoint (Recommended)
**Version:** 1.0
**Date:** 2026-02-01

---

## Executive Summary

This document provides complete technical specifications for implementing **Option 1: Centralized Webhook** hooks integration in the Maestro orchestration system.

**Implementation Time:** 8-12 hours
**Difficulty:** Low-Medium
**Dependencies:** None

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                     Maestro UI (Tauri/React)                      │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  TaskCard   │  │  TaskCard   │  │  TaskCard   │             │
│  │  (Task 1)   │  │  (Task 2)   │  │  (Task 3)   │             │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤             │
│  │ Live Feed:  │  │ Live Feed:  │  │ Live Feed:  │             │
│  │ ● Reading.. │  │ ● Writing.. │  │ ⚠️ Blocked  │             │
│  │ ● Bash run  │  │ ● Grep...   │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  useMaestroWebSocket                                │         │
│  │  - onHookEvent(data)                                │         │
│  │  - onTaskUpdated(task)                              │         │
│  └────────────────────────────────────────────────────┘         │
└───────────────────────┬───────────────────────────────────────────┘
                        │ WebSocket (existing + new events)
                        │
┌───────────────────────▼───────────────────────────────────────────┐
│                    Maestro Server (Express + WS)                  │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  NEW: POST /api/webhooks/hook-event                │         │
│  │  - Receives hook events from Claude sessions       │         │
│  │  - Maps Claude session ID to Maestro session       │         │
│  │  - Broadcasts to UI via WebSocket                  │         │
│  │  - Optionally logs to database                     │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Existing: WebSocket Server                         │         │
│  │  - task:created, task:updated, etc.                │         │
│  │  + NEW: hook:event, hook:tool_use, hook:notification│        │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Storage                                            │         │
│  │  - sessions (maps Claude ID → Maestro session)     │         │
│  │  + NEW: hookEvents (optional persistence)          │         │
│  └────────────────────────────────────────────────────┘         │
└───────────────────────┬───────────────────────────────────────────┘
                        │ HTTP POST (from hooks)
                        │
┌───────────────────────▼───────────────────────────────────────────┐
│              Claude Code Sessions (spawned terminals)             │
│                                                                   │
│  Environment Variables:                                          │
│  - MAESTRO_SESSION_ID=s123                                       │
│  - MAESTRO_TASK_IDS=t1,t2                                        │
│  - MAESTRO_API_URL=http://localhost:3000                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  .claude/settings.json                              │         │
│  │  {                                                  │         │
│  │    "hooks": {                                       │         │
│  │      "SessionStart": [...],                         │         │
│  │      "PostToolUse": [...],                          │         │
│  │      "Notification": [...],                         │         │
│  │      "SessionEnd": [...]                            │         │
│  │    }                                                │         │
│  │  }                                                  │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  .claude/hooks/                                     │         │
│  │  - session-start.sh                                 │         │
│  │  - log-tool-use.sh                                  │         │
│  │  - notify-permission.sh                             │         │
│  │  - session-end.sh                                   │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
│  When hook triggers:                                             │
│  1. Claude executes hook script                                  │
│  2. Script receives JSON on stdin                                │
│  3. Script POSTs to Maestro server webhook                       │
│  4. Server broadcasts to UI                                      │
└───────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Flow 1: Tool Use Event

```
1. User in Claude session: "Read the auth file"

2. Claude → PostToolUse hook triggers

3. Hook script executes:
   INPUT='{"session_id":"claude-abc","tool_name":"Read","tool_input":{"file_path":"auth.ts"}}'

4. Script POSTs to webhook:
   curl -X POST http://localhost:3000/api/webhooks/hook-event \
     -H 'Content-Type: application/json' \
     -d "$INPUT"

5. Server endpoint:
   - Extracts claude session ID: "claude-abc"
   - Looks up Maestro session: "s123"
   - Looks up task IDs from session: ["t1"]
   - Broadcasts WebSocket event:
     {
       "event": "hook:tool_use",
       "sessionId": "s123",
       "taskIds": ["t1"],
       "tool": "Read",
       "file": "auth.ts",
       "timestamp": 1234567890
     }

6. UI receives WebSocket event:
   - Updates TaskCard for task t1
   - Adds activity: "Reading auth.ts"
   - Increments tool usage counter
```

### Flow 2: Permission Prompt

```
1. Claude needs permission for: "git push --force"

2. Notification hook triggers:
   INPUT='{"notification_type":"permission_prompt","message":"Claude needs permission..."}'

3. Script POSTs to webhook

4. Server broadcasts:
   {
     "event": "hook:notification",
     "type": "permission_prompt",
     "message": "Claude needs permission to use Bash"
   }

5. UI receives event:
   - Shows "Blocked" badge on TaskCard
   - Displays permission message
   - Optionally shows [Approve] button
```

---

## Implementation Details

### 1. Server: Webhook Endpoint

**File:** `maestro-server/src/api/webhooks.ts`

```typescript
import express, { Request, Response } from 'express';
import Storage from '../storage';

export = function(storage: Storage) {
  const router = express.Router();

  // POST /api/webhooks/hook-event
  router.post('/hook-event', async (req: Request, res: Response) => {
    try {
      const {
        session_id,
        hook_event_name,
        tool_name,
        tool_input,
        tool_response,
        notification_type,
        message,
        ...rest
      } = req.body;

      // Validate required fields
      if (!session_id || !hook_event_name) {
        return res.status(400).json({
          error: true,
          message: 'session_id and hook_event_name are required'
        });
      }

      // Find Maestro session by Claude session ID
      const maestroSession = storage.findSessionByClaudeId(session_id);

      if (!maestroSession) {
        // Session not found - might be a non-Maestro session
        console.warn(`[Webhook] Unknown Claude session: ${session_id}`);
        return res.json({ success: true, ignored: true });
      }

      // Process hook event based on type
      const hookEvent = {
        sessionId: maestroSession.id,
        taskIds: maestroSession.taskIds,
        claudeSessionId: session_id,
        event: hook_event_name,
        timestamp: Date.now(),
        data: rest
      };

      // Specific event types
      switch (hook_event_name) {
        case 'SessionStart':
          handleSessionStart(storage, maestroSession, rest);
          break;

        case 'PostToolUse':
          handleToolUse(storage, maestroSession, tool_name, tool_input, tool_response);
          break;

        case 'Notification':
          handleNotification(storage, maestroSession, notification_type, message);
          break;

        case 'SessionEnd':
          handleSessionEnd(storage, maestroSession, rest);
          break;

        default:
          // Generic hook event
          storage.emit('hook:event', hookEvent);
      }

      // Optionally persist to database
      if (storage.config.persistHooks) {
        storage.saveHookEvent(hookEvent);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Webhook] Error:', err);
      res.status(500).json({ error: true, message: err.message });
    }
  });

  return router;
};

// Helper functions
function handleSessionStart(storage: Storage, session: any, data: any) {
  storage.updateSession(session.id, {
    status: 'active',
    claudeSessionStarted: Date.now()
  });

  storage.emit('hook:session_start', {
    sessionId: session.id,
    taskIds: session.taskIds,
    ...data
  });
}

function handleToolUse(storage: Storage, session: any, tool: string, input: any, response: any) {
  // Create activity entry
  const activity = {
    tool,
    description: formatToolActivity(tool, input),
    timestamp: Date.now()
  };

  // Update session metrics
  storage.incrementToolUsage(session.id, tool);

  // Broadcast to UI
  storage.emit('hook:tool_use', {
    sessionId: session.id,
    taskIds: session.taskIds,
    activity
  });

  // Add to task timeline
  for (const taskId of session.taskIds) {
    storage.addTaskTimelineEvent(taskId, {
      type: 'tool_use',
      message: activity.description,
      sessionId: session.id
    });
  }
}

function handleNotification(storage: Storage, session: any, type: string, message: string) {
  if (type === 'permission_prompt') {
    // Mark task as blocked
    for (const taskId of session.taskIds) {
      storage.updateTask(taskId, {
        status: 'blocked',
        blockReason: message
      });
    }
  }

  storage.emit('hook:notification', {
    sessionId: session.id,
    taskIds: session.taskIds,
    type,
    message
  });
}

function handleSessionEnd(storage: Storage, session: any, data: any) {
  storage.updateSession(session.id, {
    status: 'completed',
    claudeSessionEnded: Date.now(),
    endReason: data.reason
  });

  storage.emit('hook:session_end', {
    sessionId: session.id,
    taskIds: session.taskIds,
    ...data
  });
}

function formatToolActivity(tool: string, input: any): string {
  switch (tool) {
    case 'Bash':
      return `Executed: ${input.command}`;
    case 'Write':
    case 'Edit':
      return `Modified ${input.file_path}`;
    case 'Read':
      return `Read ${input.file_path}`;
    case 'Grep':
      return `Searched for "${input.pattern}"`;
    default:
      return `Used ${tool}`;
  }
}
```

---

### 2. Server: Storage Updates

**File:** `maestro-server/src/storage.ts`

Add methods for hook tracking:

```typescript
class Storage extends EventEmitter {
  // ... existing code ...

  // Map Claude session IDs to Maestro sessions
  private claudeSessionMap = new Map<string, string>();

  // Tool usage metrics per session
  private toolMetrics = new Map<string, Map<string, number>>();

  // Hook events (optional persistence)
  private hookEvents: HookEvent[] = [];

  /**
   * Map Claude session ID to Maestro session ID
   */
  mapClaudeSession(claudeSessionId: string, maestroSessionId: string) {
    this.claudeSessionMap.set(claudeSessionId, maestroSessionId);
  }

  /**
   * Find Maestro session by Claude session ID
   */
  findSessionByClaudeId(claudeSessionId: string): Session | null {
    const maestroId = this.claudeSessionMap.get(claudeSessionId);
    if (!maestroId) return null;
    return this.getSession(maestroId);
  }

  /**
   * Increment tool usage counter
   */
  incrementToolUsage(sessionId: string, tool: string) {
    if (!this.toolMetrics.has(sessionId)) {
      this.toolMetrics.set(sessionId, new Map());
    }
    const sessionMetrics = this.toolMetrics.get(sessionId)!;
    const count = sessionMetrics.get(tool) || 0;
    sessionMetrics.set(tool, count + 1);

    this.emit('session:metrics_updated', {
      sessionId,
      metrics: Array.from(sessionMetrics.entries()).map(([tool, uses]) => ({
        tool,
        uses
      }))
    });
  }

  /**
   * Get tool usage metrics for a session
   */
  getToolMetrics(sessionId: string): Array<{ tool: string; uses: number }> {
    const metrics = this.toolMetrics.get(sessionId);
    if (!metrics) return [];
    return Array.from(metrics.entries()).map(([tool, uses]) => ({
      tool,
      uses
    }));
  }

  /**
   * Save hook event (optional persistence)
   */
  saveHookEvent(event: HookEvent) {
    this.hookEvents.push(event);
    // Optionally write to database here
  }

  /**
   * Add timeline event to task
   */
  addTaskTimelineEvent(taskId: string, event: TimelineEvent) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    if (!task.timeline) {
      task.timeline = [];
    }

    task.timeline.push({
      id: this.makeId('evt'),
      ...event,
      timestamp: Date.now()
    });

    this.tasks.set(taskId, task);
    this.emit('task:updated', task);
  }
}

interface HookEvent {
  sessionId: string;
  taskIds: string[];
  claudeSessionId: string;
  event: string;
  timestamp: number;
  data: any;
}

interface TimelineEvent {
  type: string;
  message: string;
  sessionId?: string;
}
```

---

### 3. Server: Mount Webhook Router

**File:** `maestro-server/src/index.ts`

```typescript
import webhooksRouter from './api/webhooks';

// ... existing code ...

// Mount routers
app.use('/api', tasksRouter(storage));
app.use('/api', sessionsRouter(storage));
app.use('/api', webhooksRouter(storage)); // ADD THIS LINE
```

---

### 4. Session Spawning: Map Claude Session

**File:** `maestro-server/src/api/sessions.ts`

Update the spawn endpoint to capture Claude session ID:

```typescript
// In the session spawn handler
router.post('/sessions/spawn', async (req: Request, res: Response) => {
  // ... existing spawn logic ...

  // After creating session, we need to map Claude session ID
  // This will be sent back from the UI after the terminal spawns
  // For now, just emit the spawn request
  storage.emit('session:spawn_request', {
    session,
    projectId,
    taskIds,
    skillIds: skillIds || ['maestro-worker']
  });

  res.status(201).json(session);
});

// NEW: Endpoint to register Claude session ID
router.post('/sessions/:id/register-claude-session', async (req: Request, res: Response) => {
  try {
    const { claudeSessionId } = req.body;

    if (!claudeSessionId) {
      return res.status(400).json({ error: true, message: 'claudeSessionId required' });
    }

    const session = storage.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: true, message: 'Session not found' });
    }

    // Map Claude session to Maestro session
    storage.mapClaudeSession(claudeSessionId, session.id);

    // Update session record
    storage.updateSession(session.id, {
      claudeSessionId
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
```

---

### 5. Hook Scripts

**Directory:** `.claude/hooks/`

#### session-start.sh

```bash
#!/bin/bash
# .claude/hooks/session-start.sh

set -euo pipefail

INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
SOURCE=$(echo "$INPUT" | jq -r '.source')

# Get Maestro context from environment
MAESTRO_SESSION_ID=${MAESTRO_SESSION_ID:-unknown}
MAESTRO_TASK_IDS=${MAESTRO_TASK_IDS:-unknown}
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Register Claude session with Maestro
if [ "$MAESTRO_SESSION_ID" != "unknown" ]; then
  curl -X POST "${MAESTRO_API_URL}/api/sessions/${MAESTRO_SESSION_ID}/register-claude-session" \
    -H 'Content-Type: application/json' \
    -d "{\"claudeSessionId\": \"$SESSION_ID\"}" \
    --max-time 5 \
    --silent \
    --show-error || true
fi

# Send session start event
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error || true

# Inject context for Claude
echo "Session initialized for Maestro"
echo "Task IDs: $MAESTRO_TASK_IDS"
```

#### log-tool-use.sh

```bash
#!/bin/bash
# .claude/hooks/log-tool-use.sh

set -euo pipefail

INPUT=$(cat)

# Get Maestro API URL
MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Send event to Maestro (async, fire-and-forget)
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error &>/dev/null &
```

#### notify-permission.sh

```bash
#!/bin/bash
# .claude/hooks/notify-permission.sh

set -euo pipefail

INPUT=$(cat)

MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Send notification to Maestro
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error &>/dev/null &
```

#### session-end.sh

```bash
#!/bin/bash
# .claude/hooks/session-end.sh

set -euo pipefail

INPUT=$(cat)

MAESTRO_API_URL=${MAESTRO_API_URL:-http://localhost:3000}

# Send session end event (synchronous - wait for confirmation)
curl -X POST "${MAESTRO_API_URL}/api/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -d "$INPUT" \
  --max-time 5 \
  --silent \
  --show-error || true
```

---

### 6. Hook Configuration

**File:** `.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/log-tool-use.sh",
            "async": true
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/notify-permission.sh",
            "async": true
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-end.sh"
          }
        ]
      }
    ]
  }
}
```

---

### 7. UI: WebSocket Hook Handlers

**File:** `src/hooks/useMaestroWebSocket.ts`

Add new event types:

```typescript
type WebSocketEvent =
  | { event: 'task:created'; data: Task }
  | { event: 'task:updated'; data: Task }
  // ... existing events ...
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
      };
    }
  | {
      event: 'hook:session_start';
      data: {
        sessionId: string;
        taskIds: string[];
      };
    }
  | {
      event: 'hook:session_end';
      data: {
        sessionId: string;
        taskIds: string[];
        reason: string;
      };
    };

export type MaestroWebSocketCallbacks = {
  // ... existing callbacks ...
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
  }) => void;
  onHookSessionStart?: (data: { sessionId: string; taskIds: string[] }) => void;
  onHookSessionEnd?: (data: { sessionId: string; taskIds: string[]; reason: string }) => void;
};

// In onmessage handler:
ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data) as WebSocketEvent;

    switch (message.event) {
      // ... existing cases ...
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
    }
  } catch (error) {
    console.error('[Maestro WebSocket] Failed to parse message:', error);
  }
};
```

---

### 8. UI: Live Activity Feed Component

**File:** `src/components/maestro/LiveActivityFeed.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';

interface Activity {
  tool: string;
  description: string;
  timestamp: number;
}

interface Props {
  taskId: string;
}

export function LiveActivityFeed({ taskId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useMaestroWebSocket({
    onHookToolUse: (data) => {
      if (data.taskIds.includes(taskId)) {
        setActivities((prev) =>
          [...prev, data.activity].slice(-10) // Keep last 10
        );
      }
    }
  });

  return (
    <div className="activity-feed">
      <h4>Live Activity</h4>
      {activities.length === 0 ? (
        <p className="text-muted">No activity yet</p>
      ) : (
        <ul>
          {activities.map((activity, i) => (
            <li key={i}>
              <span className="timestamp">{formatTimeAgo(activity.timestamp)}</span>
              <span className="tool-icon">{getToolIcon(activity.tool)}</span>
              <span className="description">{activity.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getToolIcon(tool: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '📝',
    Bash: '⚙️',
    Grep: '🔍',
    Glob: '📁'
  };
  return icons[tool] || '🔧';
}
```

---

### 9. UI: Pending Action Badge

**File:** `src/components/maestro/TaskCard.tsx`

```typescript
import React, { useState } from 'react';
import { useMaestroWebSocket } from '../../hooks/useMaestroWebSocket';
import { LiveActivityFeed } from './LiveActivityFeed';

export function TaskCard({ task }: { task: Task }) {
  const [blocked, setBlocked] = useState<string | null>(null);

  useMaestroWebSocket({
    onHookNotification: (data) => {
      if (data.taskIds.includes(task.id) && data.type === 'permission_prompt') {
        setBlocked(data.message);
      }
    },
    onHookToolUse: (data) => {
      if (data.taskIds.includes(task.id)) {
        // Clear blocked state when activity resumes
        setBlocked(null);
      }
    }
  });

  return (
    <div className="task-card">
      <div className="task-header">
        <h3>{task.title}</h3>
        {blocked && (
          <span className="badge badge-warning">
            ⚠️ Blocked
          </span>
        )}
      </div>

      {blocked && (
        <div className="blocked-message">
          <p>{blocked}</p>
          <button>View Session</button>
        </div>
      )}

      <LiveActivityFeed taskId={task.id} />

      {/* ... rest of task card ... */}
    </div>
  );
}
```

---

## Testing Plan

### Phase 1: Unit Tests

**Test webhook endpoint:**

```typescript
// maestro-server/tests/webhooks.test.ts
import request from 'supertest';
import { app } from '../src/index';

describe('Webhooks', () => {
  it('should accept hook events', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'claude-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'test.ts' }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid events', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        // Missing required fields
      });

    expect(response.status).toBe(400);
  });
});
```

---

### Phase 2: Integration Tests

**Test hook scripts:**

```bash
# Test session-start.sh
MAESTRO_SESSION_ID=s123 \
MAESTRO_TASK_IDS=t1,t2 \
echo '{"session_id":"claude-abc","source":"startup"}' | \
.claude/hooks/session-start.sh
```

---

### Phase 3: End-to-End Tests

**Manual test flow:**

1. Start Maestro server
2. Start UI
3. Create a task via UI
4. Spawn a session for that task
5. In the spawned Claude session, perform actions:
   - Read a file
   - Write a file
   - Run a bash command
6. Verify UI updates in real-time

---

## Deployment Checklist

- [ ] Create `.claude/hooks/` directory
- [ ] Copy all hook scripts to `.claude/hooks/`
- [ ] Make scripts executable (`chmod +x .claude/hooks/*.sh`)
- [ ] Create `.claude/settings.json` with hook configuration
- [ ] Add webhook router to server
- [ ] Update Storage class with hook methods
- [ ] Update session spawn to set environment variables
- [ ] Add WebSocket event handlers to UI
- [ ] Create LiveActivityFeed component
- [ ] Update TaskCard with pending action badges
- [ ] Test end-to-end flow
- [ ] Deploy to production

---

## Monitoring & Observability

### Metrics to Track

1. **Hook execution rate**: How often hooks fire
2. **Webhook latency**: Time from hook trigger to server receipt
3. **WebSocket broadcast latency**: Time from server to UI
4. **Tool usage distribution**: Which tools are used most
5. **Permission prompt frequency**: How often agents need permission
6. **Session duration**: Average time from start to end

### Logging

```typescript
// Add logging to webhook endpoint
console.log(`[Hook] ${hook_event_name} from session ${session_id}`);
```

### Alerts

- Alert if webhook receives malformed events
- Alert if Claude session IDs don't map to Maestro sessions
- Alert if WebSocket connection drops

---

## Troubleshooting

### Issue: Hooks not firing

**Check:**
1. Are hook scripts executable? (`ls -la .claude/hooks/`)
2. Is `.claude/settings.json` valid JSON?
3. Are environment variables set? (`echo $MAESTRO_SESSION_ID`)
4. Is Maestro server running?

**Debug:**
```bash
# Enable Claude debug mode
claude --debug

# Test hook script manually
echo '{"session_id":"test"}' | .claude/hooks/session-start.sh
```

---

### Issue: UI not updating

**Check:**
1. Is WebSocket connected? (Check browser DevTools)
2. Are events being broadcast? (Check server logs)
3. Is event handler registered? (Check React DevTools)

**Debug:**
```typescript
// Add console.log in WebSocket handler
ws.onmessage = (event) => {
  console.log('Received:', event.data);
  // ...
};
```

---

## Performance Considerations

### Optimizations

1. **Async hooks**: Use `async: true` for non-critical hooks
2. **Debouncing**: Batch rapid-fire tool use events
3. **Selective broadcasting**: Only send events to relevant clients
4. **Compression**: Use WebSocket compression for large payloads

### Scalability

- **Current capacity**: ~100 hooks/second (single server)
- **Bottleneck**: WebSocket broadcasting
- **Scaling strategy**: Multiple server instances + Redis pub/sub

---

## Security Checklist

- [ ] Validate all webhook input
- [ ] Sanitize data before displaying in UI
- [ ] Add rate limiting to webhook endpoint
- [ ] Use HTTPS in production
- [ ] Add authentication (API key) to webhook
- [ ] Don't log sensitive data (credentials, secrets)
- [ ] Validate Claude session IDs format
- [ ] Set timeout on curl requests in hooks
- [ ] Use `set -euo pipefail` in all bash scripts
- [ ] Escape shell variables properly

---

## Cost Analysis

### Development Time

| Task | Hours |
|------|-------|
| Server webhook endpoint | 1.5 |
| Storage updates | 1 |
| Hook scripts | 1.5 |
| Hook configuration | 0.5 |
| UI WebSocket handlers | 1 |
| LiveActivityFeed component | 1.5 |
| TaskCard updates | 1 |
| Testing | 2 |
| Documentation | 1 |
| **Total** | **11 hours** |

### Ongoing Costs

- Maintenance: ~1 hour/month
- Server resources: Negligible (<1% CPU increase)
- Network: ~10KB per hook event

---

## Success Metrics

After implementation, you should achieve:

- ✅ Real-time activity feed on all task cards
- ✅ Pending action badges when blocked
- ✅ Session start/end tracked
- ✅ Tool usage visible in UI
- ✅ <100ms latency from hook to UI update
- ✅ 0 errors in production

---

## Next Steps

1. ✅ Review this specification
2. ✅ Approve implementation approach
3. → Begin implementation (Day 1: Server)
4. → Continue with hook scripts (Day 2)
5. → Integrate UI (Day 3)
6. → Test and deploy (Day 4)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Status:** Ready for Implementation
**Approved By:** [Pending]
