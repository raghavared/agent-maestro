# Maestro Server - API Reference

Complete REST API documentation for all endpoints.

## Base URL

```
http://localhost:3000
```

## Common Response Formats

### Success Response
```json
{
  "id": "entity_id",
  ...entity fields
}
```

### Error Response
```json
{
  "error": true,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {} // Optional
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Missing or invalid request parameters |
| `INTERNAL_ERROR` | Server-side error |
| `PROJECT_NOT_FOUND` | Project does not exist |
| `TASK_NOT_FOUND` | Task does not exist |
| `PROJECT_HAS_DEPENDENCIES` | Cannot delete project with tasks/sessions |

---

## Health Check

### GET /health

Check server status and uptime.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1706789123456,
  "uptime": 3600.5
}
```

---

## Projects API

### List Projects

```http
GET /api/projects
```

**Response:** Array of Project objects

**Example:**
```bash
curl http://localhost:3000/api/projects
```

### Create Project

```http
POST /api/projects
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "My Project",          // Required
  "workingDir": "/path/to/dir",  // Optional
  "description": "Description"   // Optional
}
```

**Response:** Created Project object (201)

### Get Project

```http
GET /api/projects/:id
```

**Response:** Project object or 404

### Update Project

```http
PUT /api/projects/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Name",        // Optional
  "workingDir": "/new/path",     // Optional
  "description": "New desc"      // Optional
}
```

**Response:** Updated Project object

### Delete Project

```http
DELETE /api/projects/:id
```

**Response:**
```json
{
  "success": true,
  "id": "proj_123"
}
```

**Errors:**
- 404 if project not found
- 400 if project has tasks or sessions

---

## Tasks API

### List Tasks

```http
GET /api/tasks?projectId=<id>&status=<status>&parentId=<id>
```

**Query Parameters:**
- `projectId` (optional): Filter by project
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `blocked`)
- `parentId` (optional): Filter by parent task ID (use `null` for root tasks)

**Response:** Array of Task objects

### Create Task

```http
POST /api/tasks
Content-Type: application/json
```

**Request Body:**
```json
{
  "projectId": "proj_123",           // Required
  "parentId": "task_456",            // Optional (for child tasks)
  "title": "Task Title",             // Required
  "description": "Detailed desc",    // Optional
  "priority": "high",                // Optional: low, medium, high
  "initialPrompt": "User request"    // Optional
}
```

**Response:** Created Task object (201)

### Get Task

```http
GET /api/tasks/:id
```

**Response:** Task object with all fields including timeline, sessions

### Update Task

```http
PATCH /api/tasks/:id
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "title": "New Title",
  "description": "New description",
  "status": "in_progress",           // pending, in_progress, completed, blocked
  "priority": "high",                // low, medium, high
  "sessionIds": ["sess_1", "sess_2"], // Update associated sessions
  "skillIds": ["skill_1"],           // Phase IV-B
  "agentIds": ["agent_1"],           // Phase IV-C
  "timeline": [{                     // Append timeline events
    "type": "update",
    "message": "Progress update",
    "timestamp": 1706789123456
  }]
}
```

**Response:** Updated Task object

**Status Behavior:**
- Setting `status: "in_progress"` sets `startedAt` timestamp (if not already set)
- Setting `status: "completed"` sets `completedAt` timestamp (if not already set)

### Add Timeline Event

```http
POST /api/tasks/:id/timeline
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "update",                  // Optional: created, session_started, session_ended, update, milestone, blocker
  "message": "Event description",    // Required
  "sessionId": "sess_123"           // Optional
}
```

**Response:** Updated Task object with new event in timeline

### Delete Task

```http
DELETE /api/tasks/:id
```

**Response:**
```json
{
  "success": true,
  "id": "task_123"
}
```

### Get Child Tasks

```http
GET /api/tasks/:id/children
```

**Response:** Array of Task objects that have `parentId` matching the given task ID

**Example:**
```bash
curl http://localhost:3000/api/tasks/task_123/children
```


## Sessions API

### List Sessions

```http
GET /api/sessions?projectId=<id>&taskId=<id>&status=<status>&active=<bool>
```

**Query Parameters:**
- `projectId` (optional): Filter by project
- `taskId` (optional): Filter sessions containing this task
- `status` (optional): Filter by status (`spawning`, `running`, `completed`, `failed`)
- `active` (optional): If `"true"`, exclude completed sessions

**Response:** Array of Session objects

### Create Session

```http
POST /api/sessions
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "sess_custom_id",                // Optional (server generates if not provided)
  "projectId": "proj_123",               // Required
  "taskIds": ["task_1", "task_2"],       // Required (array of task IDs)
  "name": "Session Name",                // Optional
  "agentId": "agent_123",                // Optional
  "status": "running",                   // Optional (default: "running")
  "env": {                               // Optional
    "CUSTOM_VAR": "value"
  },
  "metadata": {                          // Optional
    "skills": ["maestro-worker"],
    "spawnedBy": "orchestrator_sess_id"
  }
}
```

**Backward Compatibility:**
- Still accepts `taskId` (singular) and converts to `taskIds` array

**Response:** Created Session object (201)

**Side Effects:**
- Adds session ID to all tasks in `taskIds`
- Appends timeline events to tasks

### Get Session

```http
GET /api/sessions/:id
```

**Response:** Session object or 404

### Update Session

```http
PATCH /api/sessions/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "taskIds": ["task_3", "task_4"],   // Optional: update associated tasks
  "status": "completed",             // Optional
  "agentId": "agent_456",            // Optional
  "events": [{                       // Optional: append events
    "timestamp": 1706789123456,
    "type": "log",
    "data": {"message": "Event data"}
  }]
}
```

**Response:** Updated Session object

### Delete Session

```http
DELETE /api/sessions/:id
```

**Response:**
```json
{
  "success": true,
  "id": "sess_123"
}
```

**Side Effects:**
- Removes session ID from all associated tasks
- Appends `session_ended` timeline events to tasks

### Add Task to Session

```http
POST /api/sessions/:id/tasks/:taskId
```

**Response:** Updated Session object

**Side Effects:**
- Adds task to session's `taskIds`
- Adds session to task's `sessionIds`
- Emits bidirectional events

### Remove Task from Session

```http
DELETE /api/sessions/:id/tasks/:taskId
```

**Response:** Updated Session object

**Side Effects:**
- Removes task from session's `taskIds`
- Removes session from task's `sessionIds`
- Emits bidirectional events

### Spawn Session

**CRITICAL:** This endpoint uses CLI to generate manifest, then spawns terminal.

```http
POST /api/sessions/spawn
Content-Type: application/json
```

**Request Body:**
```json
{
  "projectId": "proj_123",                    // Required
  "taskIds": ["task_1", "task_2"],            // Required (non-empty array)
  "role": "worker",                           // Required: "worker" | "orchestrator"
  "skills": ["code-visualizer"],              // Optional (array of skill names)
  "model": "sonnet",                          // Optional (default: "sonnet")
  "permissionMode": "acceptEdits",            // Optional (default: "acceptEdits")
  "sessionName": "Worker: Auth",              // Optional

  // Spawn tracking (NEW)
  "spawnSource": "manual",                    // Required: "manual" | "orchestrator" | "ui" | "cli" | "api"
  "spawnedBy": "sess_orchestrator_123",       // Optional (session ID if spawned by agent)

  // Optional context
  "context": {
    "reason": "Task delegation",
    "notes": "Additional context"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "sess_789",
  "manifestPath": "~/.maestro/sessions/sess_789/manifest.json",
  "session": {
    "id": "sess_789",
    "projectId": "proj_123",
    "taskIds": ["task_1"],
    "status": "spawning",
    "metadata": {
      "spawnSource": "manual",
      "skills": ["code-visualizer"]
    }
  }
}
```

**What Happens:**
1. Server generates session ID
2. Server creates manifest directory: `~/.maestro/sessions/{sessionId}/`
3. Server executes CLI command:
   ```bash
   maestro manifest generate \
     --role <role> \
     --project-id <projectId> \
     --task-ids <taskIds> \
     --skills <skills> \
     --model <model> \
     --api-url <serverUrl> \
     --output ~/.maestro/sessions/{sessionId}/manifest.json
   ```
4. CLI fetches task data from server
5. CLI generates manifest
6. Server creates session record with:
   - `status: "spawning"`
   - `metadata.spawnSource`
   - `metadata.spawnedBy`
7. Server broadcasts `session:spawn_request` via WebSocket
8. UI receives event and spawns terminal with env vars
9. Terminal executes `maestro worker init`

**Error Responses:**
- 400 `missing_project_id`: No projectId provided
- 400 `invalid_task_ids`: taskIds missing or empty
- 400 `invalid_spawn_source`: Invalid spawnSource value
- 404 `task_not_found`: One of the task IDs doesn't exist
- 500 `manifest_generation_failed`: CLI command failed
- 500 `spawn_error`: Server error during spawn

---

## WebSocket Connection

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log(event.type, event.data);
});
```

### Event Format

All WebSocket messages follow this format:

```json
{
  "type": "event_name",
  "event": "event_name",  // Duplicate for compatibility
  "data": {/* event-specific payload */}
}
```

See [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) for complete event documentation.

---

## Rate Limiting

Currently no rate limiting. All endpoints are open for local development.

## Authentication

Currently no authentication. Server assumes local, trusted environment.

## CORS

CORS is enabled for all origins in development.

## Content-Type

All POST/PUT/PATCH requests must use `Content-Type: application/json`.

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful deletion) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |
