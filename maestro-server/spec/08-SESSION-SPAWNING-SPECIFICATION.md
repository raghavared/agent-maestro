# Session Spawning Specification

**Version:** 2.0.0
**Last Updated:** 2026-02-04
**Status:** Stable

## Overview

Session spawning is the process of creating a new Maestro session and launching it in a terminal with proper configuration. This specification documents TWO distinct spawning flows based on the initiator:

1. **UI-Initiated (Manual) Spawning** - User clicks spawn button in UI
2. **Agent-Initiated Spawning** - Agent executes `maestro session spawn` command

The key difference is that UI-initiated spawning uses HTTP response only, while agent-initiated spawning emits a WebSocket event for automatic terminal spawning.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     TWO SPAWNING FLOWS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Flow 1: UI-Initiated (Manual)     Flow 2: Agent-Initiated  │
│  ──────────────────────────        ─────────────────────── │
│                                                              │
│  User clicks "Spawn" in UI         Agent runs CLI command   │
│         │                                  │                │
│         ▼                                  ▼                │
│  POST /api/sessions/spawn          POST /api/sessions/spawn │
│  { spawnSource: "ui" }             { spawnSource: "session" } │
│         │                                  │                │
│         ▼                                  ▼                │
│  Server creates session            Server creates session   │
│  Server generates manifest         Server generates manifest│
│         │                                  │                │
│         ▼                                  ▼                │
│  HTTP Response ONLY                HTTP Response + Event    │
│  { sessionId, manifestPath }       { sessionId, ... }       │
│         │                                  │                │
│         ▼                                  ▼                │
│  UI spawns terminal locally        WebSocket: session:spawn │
│  (using response data)                     │                │
│                                            ▼                │
│                                    UI spawns terminal        │
│                                    automatically             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 1: UI-Initiated Manual Spawning

### Description

When a user clicks the "Spawn" button in the UI, the UI sends a spawn request with `spawnSource: "ui"` and receives an HTTP response containing all the information needed to spawn the terminal locally. NO WebSocket event is emitted.

### Architecture Diagram

```
┌─────────────┐
│     UI      │
│  (Renderer) │
└──────┬──────┘
       │
       │ User clicks "Spawn Session"
       │
       │ POST /api/sessions/spawn
       │ {
       │   projectId,
       │   taskIds,
       │   spawnSource: "ui"  ◄─── KEY FIELD
       │ }
       ▼
┌─────────────────────────────────┐
│  Maestro Server                 │
│  POST /sessions/spawn endpoint  │
│                                 │
│  1. Validate request            │
│  2. Create session in DB        │
│     (status: "spawning")        │
│  3. Generate manifest via CLI   │
│  4. Prepare spawn data          │
│  5. NO WebSocket event          │◄─── NO EVENT
│                                 │
│  HTTP Response:                 │
│  {                              │
│    sessionId,                   │
│    manifestPath,                │
│    envVars: {                   │
│      MAESTRO_SESSION_ID,        │
│      MAESTRO_MANIFEST_PATH,     │
│      MAESTRO_SERVER_URL         │
│    },                           │
│    initialCommand,              │
│    session: { ... }             │
│  }                              │
└──────┬──────────────────────────┘
       │
       │ HTTP Response
       ▼
┌─────────────────────────────────┐
│     UI (Renderer)               │
│                                 │
│  Receive HTTP response:         │
│  1. Extract spawn data          │
│  2. Create terminal window      │
│  3. Set envVars                 │
│  4. Set cwd                     │
│  5. Execute initialCommand      │
└─────────────────────────────────┘
```

### Sequence Diagram

```
User            UI              Server              CLI                 DB
 │               │                │                  │                  │
 │ Click Spawn   │                │                  │                  │
 ├──────────────>│                │                  │                  │
 │               │                │                  │                  │
 │               │ POST /spawn    │                  │                  │
 │               │ spawnSource:"ui"                  │                  │
 │               ├───────────────>│                  │                  │
 │               │                │                  │                  │
 │               │                │ Create session   │                  │
 │               │                │ (optimistic)     │                  │
 │               │                ├─────────────────────────────────────>│
 │               │                │                  │                  │
 │               │                │ Generate manifest│                  │
 │               │                ├─────────────────>│                  │
 │               │                │                  │                  │
 │               │                │ Manifest ready   │                  │
 │               │                │<─────────────────│                  │
 │               │                │                  │                  │
 │               │                │ NO WebSocket     │                  │
 │               │                │ event emitted    │                  │
 │               │                │                  │                  │
 │               │ HTTP Response  │                  │                  │
 │               │ {sessionId,    │                  │                  │
 │               │  manifestPath, │                  │                  │
 │               │  envVars,      │                  │                  │
 │               │  command}      │                  │                  │
 │               │<───────────────│                  │                  │
 │               │                │                  │                  │
 │               │ Spawn terminal │                  │                  │
 │               │ locally        │                  │                  │
 │               │───────┐        │                  │                  │
 │               │       │        │                  │                  │
 │               │<──────┘        │                  │                  │
 │               │                │                  │                  │
 │      Terminal opened           │                  │                  │
 │<──────────────│                │                  │                  │
```

### Request Example

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "taskIds": ["task_001"],
    "role": "worker",
    "spawnSource": "ui"
  }'
```

### Request Payload

```typescript
{
  projectId: string;              // Required
  taskIds: string[];              // Required
  spawnSource: "ui";              // Required: Indicates UI-initiated spawn
  role?: "worker" | "orchestrator";  // Optional (default: "worker")
  sessionName?: string;           // Optional
  skills?: string[];              // Optional
  context?: Record<string, any>;  // Optional
}
```

### Response Format

```json
{
  "success": true,
  "sessionId": "ses_abc123",
  "manifestPath": "/Users/user/.maestro/sessions/ses_abc123/manifest.json",
  "envVars": {
    "MAESTRO_SESSION_ID": "ses_abc123",
    "MAESTRO_MANIFEST_PATH": "/Users/user/.maestro/sessions/ses_abc123/manifest.json",
    "MAESTRO_SERVER_URL": "http://localhost:3000"
  },
  "initialCommand": "maestro worker init",
  "cwd": "/Users/user/projects/myproject",
  "session": {
    "id": "ses_abc123",
    "projectId": "proj_abc123",
    "taskIds": ["task_001"],
    "status": "spawning",
    "metadata": {
      "role": "worker",
      "spawnSource": "ui"
    }
  }
}
```

### UI Handling

The UI receives the HTTP response and spawns the terminal locally:

```typescript
async function handleManualSpawn(payload: SpawnPayload) {
  // Send spawn request
  const response = await fetch('http://localhost:3000/api/sessions/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      spawnSource: 'ui'  // Explicit UI spawn
    })
  });

  const spawnData = await response.json();

  // Create terminal locally using response data
  const terminal = createTerminal({
    name: spawnData.session.name,
    sessionId: spawnData.sessionId
  });

  terminal.setCwd(spawnData.cwd);
  terminal.setEnv(spawnData.envVars);
  terminal.executeCommand(spawnData.initialCommand);
  terminal.show();
}
```

### Events Emitted

**WebSocket Events:** NONE

**Side Effects:**
- Session created in database with `status: "spawning"`
- Manifest generated and saved to disk
- Session associated with tasks
- `task:session_added` events emitted for each task

---

## Flow 2: Agent-Initiated Spawning

### Description

When an agent executes `maestro session spawn` in the CLI, the CLI sends a spawn request with `spawnSource: "session"`. The server creates the session AND emits a WebSocket event `session:spawn` that the UI receives and uses to automatically spawn a terminal.

### Architecture Diagram

```
┌─────────────┐
│   Agent     │
│   (CLI)     │
└──────┬──────┘
       │
       │ maestro session spawn
       │
       │ POST /api/sessions/spawn
       │ {
       │   projectId,
       │   taskIds,
       │   spawnSource: "session",  ◄─── KEY FIELD
       │   spawnedBy: "parent_session_id"
       │ }
       ▼
┌─────────────────────────────────┐
│  Maestro Server                 │
│  POST /sessions/spawn endpoint  │
│                                 │
│  1. Validate request            │
│  2. Create session in DB        │
│     (status: "spawning")        │
│  3. Generate manifest via CLI   │
│  4. Prepare spawn data          │
│  5. Emit WebSocket event        │◄─── EMITS EVENT
│                                 │
│  WebSocket Event:               │
│  session:spawn {                │
│    sessionId,                   │
│    manifestPath,                │
│    envVars,                     │
│    initialCommand,              │
│    cwd,                         │
│    session: { ... }             │
│  }                              │
└──────┬──────────────────────────┘
       │
       │ WebSocket broadcast
       │ + HTTP Response
       │
       ▼
┌─────────────────────────────────┐
│     UI (Renderer)               │
│     WebSocket Handler           │
│                                 │
│  Receive session:spawn event:   │
│  1. Extract spawn data          │
│  2. Create terminal window      │
│  3. Set envVars                 │
│  4. Set cwd                     │
│  5. Execute initialCommand      │
│     (AUTOMATICALLY)             │
└─────────────────────────────────┘
```

### Sequence Diagram

```
Agent           CLI              Server              WebSocket           UI
 │               │                │                     │                │
 │ Run command   │                │                     │                │
 ├──────────────>│                │                     │                │
 │               │                │                     │                │
 │               │ POST /spawn    │                     │                │
 │               │ spawnSource:   │                     │                │
 │               │ "session"        │                     │                │
 │               ├───────────────>│                     │                │
 │               │                │                     │                │
 │               │                │ Create session      │                │
 │               │                │ (optimistic)        │                │
 │               │                │                     │                │
 │               │                │ Generate manifest   │                │
 │               │                │                     │                │
 │               │                │ Prepare spawn data  │                │
 │               │                │                     │                │
 │               │                │ Emit session:spawn  │                │
 │               │                │────────────────────>│                │
 │               │                │                     │                │
 │               │                │                     │ Broadcast      │
 │               │                │                     │ session:spawn  │
 │               │                │                     ├───────────────>│
 │               │                │                     │                │
 │               │                │                     │                │ Spawn terminal
 │               │                │                     │                │ automatically
 │               │                │                     │                │──────────┐
 │               │                │                     │                │          │
 │               │ HTTP Response  │                     │                │<─────────┘
 │               │<───────────────│                     │                │
 │               │                │                     │                │
 │ Response      │                │                     │           Terminal running
 │<──────────────│                │                     │                │
```

### Request Example

```bash
# From agent CLI
maestro session spawn --project proj_abc123 --task task_001

# Internally makes this request:
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "taskIds": ["task_001"],
    "role": "worker",
    "spawnSource": "session",
    "spawnedBy": "ses_parent_orchestrator"
  }'
```

### Request Payload

```typescript
{
  projectId: string;              // Required
  taskIds: string[];              // Required
  spawnSource: "session";           // Required: Indicates agent-initiated spawn
  spawnedBy: string;              // Required: Parent session ID
  role?: "worker" | "orchestrator";  // Optional (default: "worker")
  sessionName?: string;           // Optional
  skills?: string[];              // Optional
  context?: Record<string, any>;  // Optional
}
```

### Response Format

Same as UI-initiated spawning (HTTP response is identical).

### WebSocket Event Format

```json
{
  "type": "session:spawn",
  "event": "session:spawn",
  "data": {
    "sessionId": "ses_abc123",
    "manifestPath": "/Users/user/.maestro/sessions/ses_abc123/manifest.json",
    "envVars": {
      "MAESTRO_SESSION_ID": "ses_abc123",
      "MAESTRO_MANIFEST_PATH": "/Users/user/.maestro/sessions/ses_abc123/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000"
    },
    "initialCommand": "maestro worker init",
    "cwd": "/Users/user/projects/myproject",
    "session": {
      "id": "ses_abc123",
      "projectId": "proj_abc123",
      "taskIds": ["task_001"],
      "status": "spawning",
      "metadata": {
        "role": "worker",
        "spawnSource": "session",
        "spawnedBy": "ses_parent_orchestrator"
      }
    },
    "manifest": {
      "manifestVersion": "1.0.0",
      "role": "worker",
      "session": { "model": "claude-opus-4.5" },
      "project": { "id": "proj_abc123", "name": "My Project" },
      "tasks": [{ "id": "task_001", "title": "Build feature" }],
      "skills": []
    }
  }
}
```

### UI WebSocket Handler

```typescript
// WebSocket event handler
ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'session:spawn') {
    // Agent-initiated spawn - automatically create terminal
    handleAgentSpawn(message.data);
  }
});

function handleAgentSpawn(spawnData) {
  // Create terminal automatically
  const terminal = createTerminal({
    name: spawnData.session.name,
    sessionId: spawnData.sessionId
  });

  terminal.setCwd(spawnData.cwd);
  terminal.setEnv(spawnData.envVars);
  terminal.executeCommand(spawnData.initialCommand);
  terminal.show();

  // Optionally show notification
  showNotification({
    title: 'New Agent Session Spawned',
    message: `Session ${spawnData.sessionId} created by agent`
  });
}
```

### Events Emitted

**WebSocket Events:**
- `session:spawn` - Complete spawn data for automatic terminal creation
- `task:session_added` - For each task (emitted for both flows)

**Side Effects:**
- Session created in database with `status: "spawning"`
- Manifest generated and saved to disk
- Session associated with tasks

---

## Comparison Table

| Aspect | Flow 1: UI-Initiated | Flow 2: Agent-Initiated |
|--------|---------------------|------------------------|
| **Trigger** | User clicks "Spawn" button | Agent runs `maestro session spawn` |
| **Request Field** | `spawnSource: "ui"` | `spawnSource: "session"` |
| **HTTP Response** | Full spawn data | Full spawn data |
| **WebSocket Event** | NO event emitted | `session:spawn` event emitted |
| **Terminal Spawning** | UI spawns from HTTP response | UI spawns from WebSocket event |
| **Use Case** | Manual user-initiated spawning | Orchestrator spawning workers |
| **spawnedBy Field** | Not required | Required (parent session ID) |

---

## Server Implementation

### Single Endpoint Handles Both Flows

```typescript
app.post('/api/sessions/spawn', async (req, res) => {
  const { projectId, taskIds, spawnSource = 'ui', spawnedBy, ... } = req.body;

  // 1. Validate request
  // 2. Create session in DB (optimistic)
  // 3. Generate manifest via CLI
  // 4. Prepare spawn data

  const spawnData = {
    sessionId: session.id,
    manifestPath,
    envVars: {
      MAESTRO_SESSION_ID: session.id,
      MAESTRO_MANIFEST_PATH: manifestPath,
      MAESTRO_SERVER_URL: serverUrl
    },
    initialCommand: `maestro ${role} init`,
    cwd: project.workingDir,
    session
  };

  // 5. Conditional WebSocket event emission
  if (spawnSource === 'session') {
    // Agent-initiated: emit WebSocket event
    storage.emit('session:spawn', spawnData);
  }
  // If spawnSource === 'ui', NO event emitted

  // 6. Return HTTP response (same for both flows)
  return res.status(201).json({
    success: true,
    ...spawnData
  });
});
```

---

## Error Handling

Both flows share the same error handling:

### Validation Errors (400)

```json
{
  "error": true,
  "code": "missing_project_id",
  "message": "projectId is required"
}
```

```json
{
  "error": true,
  "code": "invalid_task_ids",
  "message": "taskIds must be a non-empty array"
}
```

```json
{
  "error": true,
  "code": "invalid_spawn_source",
  "message": "spawnSource must be 'ui' or 'session'"
}
```

### Not Found Errors (404)

```json
{
  "error": true,
  "code": "project_not_found",
  "message": "Project proj_abc123 not found"
}
```

```json
{
  "error": true,
  "code": "task_not_found",
  "message": "Task task_001 not found"
}
```

### Server Errors (500)

```json
{
  "error": true,
  "code": "manifest_generation_failed",
  "message": "Failed to generate manifest: maestro CLI not found"
}
```

---

## Complete Examples

### Example 1: UI-Initiated Worker Spawn

**Request:**
```json
{
  "projectId": "proj_abc123",
  "taskIds": ["task_001", "task_002"],
  "role": "worker",
  "spawnSource": "ui",
  "skills": ["maestro-worker"]
}
```

**Response (HTTP 201):**
```json
{
  "success": true,
  "sessionId": "ses_xyz789",
  "manifestPath": "/Users/user/.maestro/sessions/ses_xyz789/manifest.json",
  "envVars": {
    "MAESTRO_SESSION_ID": "ses_xyz789",
    "MAESTRO_MANIFEST_PATH": "/Users/user/.maestro/sessions/ses_xyz789/manifest.json",
    "MAESTRO_SERVER_URL": "http://localhost:3000"
  },
  "initialCommand": "maestro worker init",
  "cwd": "/Users/user/projects/myproject",
  "session": {
    "id": "ses_xyz789",
    "projectId": "proj_abc123",
    "taskIds": ["task_001", "task_002"],
    "status": "spawning",
    "metadata": {
      "role": "worker",
      "spawnSource": "ui",
      "skills": ["maestro-worker"]
    }
  }
}
```

**WebSocket Events:** NONE

**UI Action:** Spawns terminal using HTTP response data

---

### Example 2: Agent-Initiated Worker Spawn

**Request:**
```json
{
  "projectId": "proj_abc123",
  "taskIds": ["task_003"],
  "role": "worker",
  "spawnSource": "session",
  "spawnedBy": "ses_orchestrator_123",
  "skills": ["maestro-worker"]
}
```

**Response (HTTP 201):**
```json
{
  "success": true,
  "sessionId": "ses_worker_456",
  "manifestPath": "/Users/user/.maestro/sessions/ses_worker_456/manifest.json",
  "envVars": {
    "MAESTRO_SESSION_ID": "ses_worker_456",
    "MAESTRO_MANIFEST_PATH": "/Users/user/.maestro/sessions/ses_worker_456/manifest.json",
    "MAESTRO_SERVER_URL": "http://localhost:3000"
  },
  "initialCommand": "maestro worker init",
  "cwd": "/Users/user/projects/myproject",
  "session": {
    "id": "ses_worker_456",
    "projectId": "proj_abc123",
    "taskIds": ["task_003"],
    "status": "spawning",
    "metadata": {
      "role": "worker",
      "spawnSource": "session",
      "spawnedBy": "ses_orchestrator_123",
      "skills": ["maestro-worker"]
    }
  }
}
```

**WebSocket Event (`session:spawn`):**
```json
{
  "type": "session:spawn",
  "event": "session:spawn",
  "data": {
    "sessionId": "ses_worker_456",
    "manifestPath": "/Users/user/.maestro/sessions/ses_worker_456/manifest.json",
    "envVars": {
      "MAESTRO_SESSION_ID": "ses_worker_456",
      "MAESTRO_MANIFEST_PATH": "/Users/user/.maestro/sessions/ses_worker_456/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000"
    },
    "initialCommand": "maestro worker init",
    "cwd": "/Users/user/projects/myproject",
    "session": { ... },
    "manifest": { ... }
  }
}
```

**UI Action:** Automatically spawns terminal when WebSocket event received

---

## Related Specifications

- **[03-API-SPECIFICATION.md](./03-API-SPECIFICATION.md)** - POST /api/sessions/spawn endpoint details
- **[04-WEBSOCKET-SPECIFICATION.md](./04-WEBSOCKET-SPECIFICATION.md)** - session:spawn event documentation
- **[06-CLI-INTEGRATION-SPECIFICATION.md](./06-CLI-INTEGRATION-SPECIFICATION.md)** - CLI manifest generation
- **[02-SESSION-MANAGEMENT.md](./02-SESSION-MANAGEMENT.md)** - Session lifecycle
- **[01-MANIFEST-SCHEMA.md](../maestro-cli/docs/spec/01-MANIFEST-SCHEMA.md)** - Manifest structure

---

## Implementation Reference

**Primary Implementation:**
- File: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/sessions.ts`
- Endpoint: `POST /api/sessions/spawn`
- Helper: `generateManifestViaCLI`

**Key Decision Point:**
```typescript
// Line where spawnSource determines behavior
if (spawnSource === 'session') {
  storage.emit('session:spawn', spawnData);
}
// If spawnSource === 'ui', no event emitted
```
