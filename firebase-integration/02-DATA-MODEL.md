# Data Model

## Firestore Collections

Firestore holds the durable state. Documents, subcollections, indexed queries.

### Projects

```
/projects/{projectId}
{
  name: string,
  description: string,
  workingDir: string,
  ownerId: string,
  members: string[],            // user IDs with access
  createdAt: Timestamp,
  updatedAt: Timestamp,
  settings: {
    defaultStrategy: "simple" | "queue",
    notifications: boolean
  }
}
```

### Tasks

```
/projects/{projectId}/tasks/{taskId}
{
  title: string,
  description: string,
  status: "todo" | "in_progress" | "in_review" | "completed" | "cancelled" | "blocked",
  priority: "low" | "medium" | "high",
  parentId: string | null,
  dependencies: string[],
  referenceTaskIds: string[],

  // Session tracking
  sessionIds: string[],
  taskSessionStatuses: {
    [sessionId]: "queued" | "working" | "blocked" | "completed" | "failed" | "skipped"
  },

  // Agent config
  model: string | null,
  agentTool: "claude-code" | "codex" | "gemini" | null,
  initialPrompt: string,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  startedAt: Timestamp | null,
  completedAt: Timestamp | null,

  // Metadata
  createdBy: string,            // user ID
  tags: string[]
}
```

Tasks are subcollections of projects. This gives us:
- Automatic scoping (query tasks within a project)
- Security rules tied to project membership
- Efficient queries without composite indexes

### Sessions

```
/sessions/{sessionId}
{
  projectId: string,
  taskIds: string[],
  userId: string,
  name: string,

  // Config
  role: "worker" | "orchestrator",
  strategy: string,
  agentId: string | null,

  // State
  status: "spawning" | "idle" | "working" | "completed" | "failed" | "stopped",
  needsInput: {
    active: boolean,
    message: string | null,
    since: Timestamp | null
  },

  // Timestamps
  startedAt: Timestamp,
  lastActivity: Timestamp,
  completedAt: Timestamp | null,

  // Environment
  hostname: string,
  platform: string,
  env: { [key: string]: string },
  metadata: { [key: string]: any }
}
```

Sessions are top-level (not nested under projects) because:
- A session can span multiple projects (future)
- Simpler security rules (userId-based)
- Direct lookup by session ID from CLI

### Session Timeline (subcollection)

```
/sessions/{sessionId}/timeline/{eventId}
{
  type: "started" | "progress" | "task_started" | "task_completed"
        | "blocked" | "error" | "completed" | "milestone" | "note",
  message: string,
  taskId: string | null,
  data: any | null,
  createdAt: Timestamp
}
```

Timeline as subcollection instead of array because:
- Arrays grow unbounded and hit document size limits (1MB)
- Subcollections allow paginated queries
- Each event is independently writable (no read-modify-write race)

### Session Docs (subcollection)

```
/sessions/{sessionId}/docs/{docId}
{
  title: string,
  filePath: string | null,
  content: string | null,        // inline content for small docs
  storageRef: string | null,     // Firebase Storage path for large files
  taskId: string | null,
  createdAt: Timestamp
}
```

### Queue State

```
/sessions/{sessionId}/queue/{queueId}
{
  items: [
    {
      taskId: string,
      status: "queued" | "processing" | "completed" | "failed" | "skipped",
      startedAt: Timestamp | null,
      completedAt: Timestamp | null
    }
  ],
  currentIndex: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Queue state stays as a single document (items array won't grow large -- it's bounded by tasks per session).

### Users

```
/users/{userId}
{
  email: string,
  displayName: string,
  photoURL: string | null,
  plan: "free" | "pro" | "team" | "enterprise",
  createdAt: Timestamp,
  settings: {
    theme: "light" | "dark" | "system",
    notifications: boolean,
    defaultModel: string
  }
}
```

---

## Realtime Database Structure

RTDB holds the ephemeral, high-frequency data. Presence, live output, heartbeats.

```json
{
  "sessions": {
    "{sessionId}": {
      "userId": "uid_xxx",
      "status": "working",
      "lastHeartbeat": 1234567890000,
      "currentTaskId": "task_xxx",
      "liveOutput": {
        "lines": ["Building...", "Tests passing..."],
        "updatedAt": 1234567890000
      }
    }
  },

  "presence": {
    "{userId}": {
      "online": true,
      "lastSeen": 1234567890000,
      "activeDevice": "desktop",
      "activeSessions": ["sess_xxx", "sess_yyy"]
    }
  }
}
```

### Why RTDB for These?

| Data | Why RTDB over Firestore |
|------|------------------------|
| Session heartbeat | Updates every 5s. RTDB: $0. Firestore: costly writes. |
| Live terminal output | Updates every 100ms during active work. Firestore can't keep up. |
| Presence | onDisconnect() handler -- RTDB exclusive feature. |
| Current status | Sub-50ms latency needed for live monitoring. |

### RTDB onDisconnect

```typescript
// When user goes offline, automatically mark as offline
const presenceRef = ref(rtdb, `presence/${userId}`);
onDisconnect(presenceRef).set({
  online: false,
  lastSeen: serverTimestamp()
});
```

This is critical. If the desktop crashes, the phone immediately knows. No polling. No stale state.

---

## Firebase Storage Structure

```
/users/{userId}/
  avatar.jpg

/projects/{projectId}/
  context-docs/
    requirements.pdf
    architecture.md
  session-recordings/
    {sessionId}.json

/shared/
  templates/
    worker-template.json
    orchestrator-template.json
```

Storage for files that don't belong in a database: PDFs, images, large text files, session recordings.

---

## Indexes

Firestore requires composite indexes for multi-field queries. These are the ones we need:

```
// Tasks by status within a project (subcollection, auto-indexed by parent)
// No composite index needed -- subcollection scoping handles it

// Sessions by project and status
Collection: sessions
Fields: projectId ASC, status ASC, startedAt DESC

// Sessions by user and status
Collection: sessions
Fields: userId ASC, status ASC, startedAt DESC

// Tasks by status and priority (within project subcollection)
Collection: projects/{projectId}/tasks
Fields: status ASC, priority DESC, createdAt DESC
```

---

## Data Size Estimates

| Entity | Avg Doc Size | Docs per Active User | Monthly Writes |
|--------|-------------|---------------------|----------------|
| Project | 500 bytes | 3-5 | 10 |
| Task | 1 KB | 50-200 | 500 |
| Session | 2 KB | 20-50 | 200 |
| Timeline Event | 200 bytes | 500-2000 | 2000 |
| Queue Item | 500 bytes | 10-30 | 100 |

A typical active user generates ~3000 Firestore writes/month. At $0.18 per 100k writes, that's $0.005/user/month. Negligible.
