# Webhook Architecture - Server Implementation

**Version:** 1.0
**Date:** 2026-02-01
**Approach:** Centralized Webhook Endpoint

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│              Claude Code Sessions (Multiple)                  │
│                                                               │
│  Session 1     Session 2     Session 3     Session N         │
│  (Task t1)     (Task t2)     (Task t3)     (Task tN)         │
│     │              │              │             │             │
│     │ POST         │ POST         │ POST        │ POST        │
│     │              │              │             │             │
│     └──────────────┴──────────────┴─────────────┘             │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │ HTTP POST
                            │ http://localhost:3000/api/webhooks/hook-event
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                    Maestro Server                              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  POST /api/webhooks/hook-event                         │  │
│  │                                                         │  │
│  │  1. Receive hook event JSON                            │  │
│  │  2. Validate input                                     │  │
│  │  3. Map Claude session ID → Maestro session            │  │
│  │  4. Process event (update metrics, timeline, etc.)     │  │
│  │  5. Broadcast to UI via WebSocket                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Storage                                                │  │
│  │  - sessionClaudeMap: Claude ID → Maestro ID            │  │
│  │  - toolMetrics: Session ID → Tool usage counts         │  │
│  │  - hookEvents: Optional persistence                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  WebSocket Server                                       │  │
│  │  - Broadcast: hook:tool_use                            │  │
│  │  - Broadcast: hook:notification                        │  │
│  │  - Broadcast: hook:session_start                       │  │
│  │  - Broadcast: hook:session_end                         │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────────────┘
                            │ WebSocket
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                      Maestro UI                                │
│                                                               │
│  - Listen for hook events                                    │
│  - Update task cards in real-time                            │
│  - Show activity feeds, badges, timelines                    │
└───────────────────────────────────────────────────────────────┘
```

---

## Webhook Endpoint Specification

### Endpoint: POST /api/webhooks/hook-event

**Purpose:** Receive hook events from Claude Code sessions

**URL:** `http://localhost:3000/api/webhooks/hook-event`

**Method:** POST

**Content-Type:** application/json

**Request Body:**
```typescript
{
  // Required fields
  session_id: string;           // Claude session ID
  hook_event_name: string;      // Event type (SessionStart, PostToolUse, etc.)

  // Optional fields (depending on hook type)
  tool_name?: string;           // For tool-related hooks
  tool_input?: object;          // Tool input parameters
  tool_response?: object;       // Tool response data
  notification_type?: string;   // For Notification hook
  message?: string;             // Notification message
  reason?: string;              // For SessionEnd
  source?: string;              // For SessionStart

  // Additional fields passed through
  [key: string]: any;
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Error):**
```json
{
  "error": true,
  "message": "Error description"
}
```

---

## Implementation

### File Structure

```
maestro-server/
├── src/
│   ├── api/
│   │   ├── tasks.ts          (existing)
│   │   ├── sessions.ts       (existing, updated)
│   │   └── webhooks.ts       (NEW)
│   ├── storage.ts            (updated with hook methods)
│   ├── websocket.ts          (existing)
│   └── index.ts              (updated to mount webhook router)
```

---

### Step 1: Create Webhook Router

**File:** `maestro-server/src/api/webhooks.ts`

```typescript
import express, { Request, Response } from 'express';
import Storage from '../storage';

export = function(storage: Storage) {
  const router = express.Router();

  /**
   * POST /api/webhooks/hook-event
   * Receive hook events from Claude Code sessions
   */
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
        // Session not found - might be a non-Maestro Claude session
        console.warn(`[Webhook] Unknown Claude session: ${session_id}`);
        return res.json({ success: true, ignored: true });
      }

      console.log(
        `[Webhook] ${hook_event_name} from Claude session ${session_id} ` +
        `→ Maestro session ${maestroSession.id}`
      );

      // Process hook event based on type
      switch (hook_event_name) {
        case 'SessionStart':
          await handleSessionStart(storage, maestroSession, rest);
          break;

        case 'PostToolUse':
          await handlePostToolUse(
            storage,
            maestroSession,
            tool_name,
            tool_input,
            tool_response
          );
          break;

        case 'Notification':
          await handleNotification(
            storage,
            maestroSession,
            notification_type,
            message
          );
          break;

        case 'SessionEnd':
          await handleSessionEnd(storage, maestroSession, rest);
          break;

        case 'PostToolUseFailure':
          await handlePostToolUseFailure(
            storage,
            maestroSession,
            tool_name,
            tool_input,
            rest.error
          );
          break;

        default:
          // Generic hook event - just broadcast
          storage.emit('hook:event', {
            sessionId: maestroSession.id,
            taskIds: maestroSession.taskIds,
            claudeSessionId: session_id,
            event: hook_event_name,
            timestamp: Date.now(),
            data: rest
          });
      }

      // Optionally persist to database
      if (storage.config?.persistHooks) {
        storage.saveHookEvent({
          sessionId: maestroSession.id,
          taskIds: maestroSession.taskIds,
          claudeSessionId: session_id,
          event: hook_event_name,
          timestamp: Date.now(),
          data: { tool_name, tool_input, tool_response, notification_type, message, ...rest }
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Webhook] Error:', err);
      res.status(500).json({ error: true, message: err.message });
    }
  });

  return router;
};

/**
 * Handle SessionStart hook
 */
async function handleSessionStart(
  storage: Storage,
  session: any,
  data: any
) {
  // Update session status
  storage.updateSession(session.id, {
    status: 'active',
    claudeSessionStarted: Date.now()
  });

  // Broadcast to UI
  storage.emit('hook:session_start', {
    sessionId: session.id,
    taskIds: session.taskIds,
    source: data.source,
    model: data.model,
    timestamp: Date.now()
  });

  // Add timeline event to tasks
  for (const taskId of session.taskIds) {
    storage.addTaskTimelineEvent(taskId, {
      type: 'session_start',
      message: 'Session started',
      sessionId: session.id
    });
  }

  console.log(`[Hook] Session ${session.id} started`);
}

/**
 * Handle PostToolUse hook (MOST IMPORTANT)
 */
async function handlePostToolUse(
  storage: Storage,
  session: any,
  toolName: string,
  toolInput: any,
  toolResponse: any
) {
  // Format activity description
  const activity = {
    tool: toolName,
    description: formatToolActivity(toolName, toolInput),
    timestamp: Date.now()
  };

  // Update tool usage metrics
  storage.incrementToolUsage(session.id, toolName);

  // Update session last activity timestamp
  storage.updateSession(session.id, {
    lastActivity: Date.now()
  });

  // Broadcast to UI (real-time)
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
      sessionId: session.id,
      metadata: {
        tool: toolName,
        ...toolInput
      }
    });
  }

  console.log(
    `[Hook] ${session.id} used ${toolName}: ${activity.description}`
  );
}

/**
 * Handle Notification hook (permission prompts)
 */
async function handleNotification(
  storage: Storage,
  session: any,
  notificationType: string,
  message: string
) {
  // Special handling for permission prompts
  if (notificationType === 'permission_prompt') {
    // Update task status to blocked
    for (const taskId of session.taskIds) {
      storage.updateTask(taskId, {
        status: 'blocked',
        blockReason: message,
        blockedAt: Date.now()
      });

      // Add timeline event
      storage.addTaskTimelineEvent(taskId, {
        type: 'blocked',
        message: `Waiting for permission: ${message}`,
        sessionId: session.id
      });
    }

    console.log(`[Hook] Session ${session.id} blocked: ${message}`);
  }

  // Broadcast to UI
  storage.emit('hook:notification', {
    sessionId: session.id,
    taskIds: session.taskIds,
    type: notificationType,
    message,
    timestamp: Date.now()
  });
}

/**
 * Handle SessionEnd hook
 */
async function handleSessionEnd(
  storage: Storage,
  session: any,
  data: any
) {
  const sessionStartTime = session.claudeSessionStarted || session.createdAt;
  const duration = Date.now() - sessionStartTime;

  // Update session
  storage.updateSession(session.id, {
    status: 'completed',
    claudeSessionEnded: Date.now(),
    endReason: data.reason,
    duration
  });

  // Broadcast to UI
  storage.emit('hook:session_end', {
    sessionId: session.id,
    taskIds: session.taskIds,
    reason: data.reason,
    duration,
    timestamp: Date.now()
  });

  // Add timeline event
  for (const taskId of session.taskIds) {
    storage.addTaskTimelineEvent(taskId, {
      type: 'session_end',
      message: `Session completed (duration: ${formatDuration(duration)})`,
      sessionId: session.id
    });
  }

  console.log(
    `[Hook] Session ${session.id} ended (reason: ${data.reason}, duration: ${formatDuration(duration)})`
  );
}

/**
 * Handle PostToolUseFailure hook
 */
async function handlePostToolUseFailure(
  storage: Storage,
  session: any,
  toolName: string,
  toolInput: any,
  error: string
) {
  const errorActivity = {
    tool: toolName,
    description: `Failed: ${formatToolActivity(toolName, toolInput)}`,
    error,
    timestamp: Date.now()
  };

  // Broadcast error to UI
  storage.emit('hook:tool_failure', {
    sessionId: session.id,
    taskIds: session.taskIds,
    activity: errorActivity
  });

  // Add to task timeline
  for (const taskId of session.taskIds) {
    storage.addTaskTimelineEvent(taskId, {
      type: 'error',
      message: `❌ ${errorActivity.description}: ${error}`,
      sessionId: session.id,
      metadata: {
        tool: toolName,
        error,
        ...toolInput
      }
    });
  }

  console.error(
    `[Hook] Session ${session.id} tool failure: ${toolName} - ${error}`
  );
}

/**
 * Format tool activity into human-readable description
 */
function formatToolActivity(tool: string, input: any): string {
  switch (tool) {
    case 'Bash':
      return `Executed: ${input.command}`;
    case 'Write':
      return `Created ${getFileName(input.file_path)}`;
    case 'Edit':
      return `Modified ${getFileName(input.file_path)}`;
    case 'Read':
      return `Read ${getFileName(input.file_path)}`;
    case 'Grep':
      return `Searched for "${input.pattern}"`;
    case 'Glob':
      return `Found files matching "${input.pattern}"`;
    case 'WebFetch':
      return `Fetched ${input.url}`;
    case 'WebSearch':
      return `Searched: ${input.query}`;
    case 'Task':
      return `Spawned ${input.subagent_type} agent`;
    default:
      return `Used ${tool}`;
  }
}

/**
 * Get filename from path
 */
function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Format duration in human-readable format
 */
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

### Step 2: Update Storage with Hook Methods

**File:** `maestro-server/src/storage.ts`

Add these methods to the Storage class:

```typescript
class Storage extends EventEmitter {
  // ... existing code ...

  // Claude session ID → Maestro session ID mapping
  private claudeSessionMap = new Map<string, string>();

  // Tool usage metrics per session
  private toolMetrics = new Map<string, Map<string, number>>();

  // Hook events (optional persistence)
  private hookEvents: HookEvent[] = [];

  /**
   * Map Claude session ID to Maestro session ID
   */
  mapClaudeSession(claudeSessionId: string, maestroSessionId: string): void {
    this.claudeSessionMap.set(claudeSessionId, maestroSessionId);
    console.log(
      `[Storage] Mapped Claude session ${claudeSessionId} → Maestro session ${maestroSessionId}`
    );
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
  incrementToolUsage(sessionId: string, tool: string): void {
    if (!this.toolMetrics.has(sessionId)) {
      this.toolMetrics.set(sessionId, new Map());
    }

    const sessionMetrics = this.toolMetrics.get(sessionId)!;
    const count = sessionMetrics.get(tool) || 0;
    sessionMetrics.set(tool, count + 1);

    // Broadcast metrics update
    this.emit('session:metrics_updated', {
      sessionId,
      metrics: this.getToolMetrics(sessionId)
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
  saveHookEvent(event: HookEvent): void {
    this.hookEvents.push(event);
    // Optionally write to database here
    // TODO: Implement database persistence if needed
  }

  /**
   * Get hook events for a session
   */
  getHookEvents(sessionId: string): HookEvent[] {
    return this.hookEvents.filter(e => e.sessionId === sessionId);
  }

  /**
   * Add timeline event to task
   */
  addTaskTimelineEvent(taskId: string, event: TimelineEvent): void {
    const task = this.getTask(taskId);
    if (!task) {
      console.warn(`[Storage] Task ${taskId} not found, cannot add timeline event`);
      return;
    }

    if (!task.timeline) {
      task.timeline = [];
    }

    const timelineEvent = {
      id: this.makeId('evt'),
      type: event.type,
      message: event.message,
      timestamp: Date.now(),
      sessionId: event.sessionId,
      metadata: event.metadata
    };

    task.timeline.push(timelineEvent);
    this.tasks.set(taskId, task);

    // Broadcast task update
    this.emit('task:updated', task);

    console.log(`[Storage] Added timeline event to task ${taskId}: ${event.message}`);
  }
}

// Type definitions
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
  metadata?: any;
}
```

---

### Step 3: Update Session Spawn to Set Environment Variables

**File:** `maestro-server/src/api/sessions.ts`

Update spawn endpoint:

```typescript
// In sessions.ts, update the spawn endpoint

router.post('/sessions/spawn', async (req: Request, res: Response) => {
  try {
    const { projectId, taskIds, name, skillIds } = req.body;

    if (!projectId || !taskIds || taskIds.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'projectId and taskIds are required'
      });
    }

    // Create session in DB
    const session = storage.createSession({
      projectId,
      taskIds,
      name,
      skillIds: skillIds || ['maestro-worker']
    } as any);

    // Emit spawn request with environment variables
    storage.emit('session:spawn_request', {
      session,
      projectId,
      taskIds,
      skillIds: skillIds || ['maestro-worker'],
      // NEW: Environment variables for spawned terminal
      envVars: {
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_TASK_IDS: taskIds.join(','),
        MAESTRO_API_URL: process.env.MAESTRO_API_URL || 'http://localhost:3000',
        MAESTRO_PROJECT_ID: projectId
      }
    });

    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// NEW: Register Claude session ID after terminal spawns
router.post('/sessions/:id/register-claude-session', async (req: Request, res: Response) => {
  try {
    const { claudeSessionId } = req.body;

    if (!claudeSessionId) {
      return res.status(400).json({
        error: true,
        message: 'claudeSessionId is required'
      });
    }

    const session = storage.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        error: true,
        message: 'Session not found'
      });
    }

    // Map Claude session to Maestro session
    storage.mapClaudeSession(claudeSessionId, session.id);

    // Update session record
    storage.updateSession(session.id, {
      claudeSessionId
    });

    console.log(
      `[Sessions] Registered Claude session ${claudeSessionId} for Maestro session ${session.id}`
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});
```

---

### Step 4: Mount Webhook Router

**File:** `maestro-server/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import Storage from './storage';
import tasksRouter from './api/tasks';
import sessionsRouter from './api/sessions';
import webhooksRouter from './api/webhooks';  // ADD THIS
import { createWebSocketServer } from './websocket';

const app = express();
const storage = new Storage();

app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api', tasksRouter(storage));
app.use('/api', sessionsRouter(storage));
app.use('/api', webhooksRouter(storage));  // ADD THIS LINE

// ... rest of server setup
```

---

## WebSocket Events

New events broadcast to UI:

### hook:tool_use
```typescript
{
  event: 'hook:tool_use',
  data: {
    sessionId: string;
    taskIds: string[];
    activity: {
      tool: string;
      description: string;
      timestamp: number;
    }
  }
}
```

### hook:notification
```typescript
{
  event: 'hook:notification',
  data: {
    sessionId: string;
    taskIds: string[];
    type: string;        // permission_prompt, idle_prompt, etc.
    message: string;
    timestamp: number;
  }
}
```

### hook:session_start
```typescript
{
  event: 'hook:session_start',
  data: {
    sessionId: string;
    taskIds: string[];
    source: string;      // startup, resume, clear, compact
    model: string;
    timestamp: number;
  }
}
```

### hook:session_end
```typescript
{
  event: 'hook:session_end',
  data: {
    sessionId: string;
    taskIds: string[];
    reason: string;      // clear, logout, other
    duration: number;    // milliseconds
    timestamp: number;
  }
}
```

### hook:tool_failure
```typescript
{
  event: 'hook:tool_failure',
  data: {
    sessionId: string;
    taskIds: string[];
    activity: {
      tool: string;
      description: string;
      error: string;
      timestamp: number;
    }
  }
}
```

---

## Security Measures

### Input Validation

```typescript
// Validate session ID format (UUID)
if (!/^[a-f0-9-]{36}$/.test(session_id)) {
  return res.status(400).json({
    error: true,
    message: 'Invalid session ID format'
  });
}

// Validate hook event name
const validEvents = [
  'SessionStart', 'SessionEnd', 'PostToolUse', 'PostToolUseFailure',
  'Notification', 'PreToolUse', 'SubagentStart', 'SubagentStop'
];
if (!validEvents.includes(hook_event_name)) {
  return res.status(400).json({
    error: true,
    message: 'Invalid hook event name'
  });
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const hookLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 1000,            // 1000 requests per minute per IP
  message: 'Too many hook events, please slow down'
});

router.post('/hook-event', hookLimiter, async (req, res) => {
  // ... handler
});
```

### Authentication (Optional)

```typescript
const HOOK_API_KEY = process.env.MAESTRO_HOOK_KEY;

router.post('/hook-event', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (HOOK_API_KEY && authHeader !== `Bearer ${HOOK_API_KEY}`) {
    return res.status(401).json({ error: true, message: 'Unauthorized' });
  }
  next();
}, async (req, res) => {
  // ... handler
});
```

---

## Error Handling

### Graceful Degradation

```typescript
try {
  // Process hook
  await handlePostToolUse(...);
} catch (err) {
  console.error('[Webhook] Error processing hook:', err);
  // Still return success to prevent hook from failing
  return res.json({ success: true, error: err.message });
}
```

### Unknown Sessions

```typescript
if (!maestroSession) {
  // Don't fail - just log and ignore
  console.warn(`[Webhook] Unknown Claude session: ${session_id}`);
  return res.json({ success: true, ignored: true });
}
```

---

## Performance Optimization

### Async Processing

For non-critical operations:

```typescript
// Don't await timeline updates
storage.addTaskTimelineEvent(taskId, event);  // Fire and forget

// Await critical operations
await storage.updateSession(sessionId, updates);
```

### Batch Broadcasting

If many events come in quick succession:

```typescript
const eventQueue: any[] = [];
let broadcastTimeout: NodeJS.Timeout | null = null;

function queueBroadcast(event: any) {
  eventQueue.push(event);

  if (!broadcastTimeout) {
    broadcastTimeout = setTimeout(() => {
      storage.emit('hook:batch', eventQueue);
      eventQueue.length = 0;
      broadcastTimeout = null;
    }, 50);  // Batch every 50ms
  }
}
```

---

## Monitoring

### Logging

```typescript
console.log(`[Webhook] ${hook_event_name} from ${session_id} → ${maestroSession.id}`);
console.log(`[Webhook] Processed in ${Date.now() - startTime}ms`);
```

### Metrics

Track:
- Requests per second
- Latency (p50, p95, p99)
- Error rate
- Unknown session rate

---

## Testing

### Unit Test

```typescript
// maestro-server/tests/webhooks.test.ts
import request from 'supertest';
import { app } from '../src/index';

describe('POST /api/webhooks/hook-event', () => {
  it('should accept valid hook events', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'test-123',
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

## Troubleshooting

### Check Server Logs

```bash
# Start server with debug logging
DEBUG=maestro:* npm run dev
```

### Test Webhook Directly

```bash
curl -X POST http://localhost:3000/api/webhooks/hook-event \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id": "test-123",
    "hook_event_name": "PostToolUse",
    "tool_name": "Read",
    "tool_input": {"file_path": "test.ts"}
  }'
```

---

## Next Steps

After implementing webhook endpoint:
1. → Read [05-HOOK-SCRIPTS-REFERENCE.md](./05-HOOK-SCRIPTS-REFERENCE.md) for hook scripts
2. → Read [03-UI-INTEGRATION.md](./03-UI-INTEGRATION.md) for UI implementation

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
