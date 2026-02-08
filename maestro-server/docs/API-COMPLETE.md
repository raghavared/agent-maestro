# Maestro Server - Complete API Documentation

**Version:** 1.0.0 (Phase IV-A)
**Last Updated:** February 2, 2026
**Base URL:** `http://localhost:3000`

---

## Table of Contents

1. [Overview](#overview)
2. [REST API Reference](#rest-api-reference)
   - [Health Check](#health-check)
   - [Projects API](#projects-api)
   - [Tasks API](#tasks-api)
   - [Sessions API](#sessions-api)
3. [WebSocket API Reference](#websocket-api-reference)
   - [Connection](#websocket-connection)
   - [Event Catalog](#event-catalog)
   - [Client Examples](#client-implementation-examples)
4. [Authentication & Security](#authentication--security)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples & Use Cases](#examples--use-cases)

---

## Overview

The Maestro Server provides a RESTful HTTP API for CRUD operations and a WebSocket API for real-time updates. It follows a **CLI-first architecture** where:

- **Server** = Data store + event broadcaster (intentionally "dumb")
- **CLI** = Orchestration logic + prompt generation + command execution
- **UI** = Visualization layer + terminal spawning

### Key Principles

- ✅ Server stores data and broadcasts events
- ✅ Server validates requests and maintains data integrity
- ❌ Server does NOT generate prompts
- ❌ Server does NOT execute commands
- ❌ Server does NOT contain orchestration logic

### Technology Stack

- **HTTP Server:** Express.js v5
- **WebSocket:** ws library
- **Storage:** File-based JSON (in-memory cache)
- **Port:** 3000 (configurable via `PORT` env var)

---

## REST API Reference

### Common Response Format

All API responses follow consistent formats:

**Success (200/201):**
```json
{
  "id": "entity_id",
  "field1": "value1",
  ...
}
```

**Error (4xx/5xx):**
```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional additional context
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation error, missing required fields |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server-side error |

---

## Health Check

### GET /health

Check server status and uptime.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": 1706789123456,
  "uptime": 3600.5
}
```

**Use Cases:**
- Health monitoring
- Load balancer checks
- Deployment verification

---

## Projects API

Projects represent codebases or workspaces with working directories.

### List All Projects

```http
GET /api/projects
```

**Response (200):**
```json
[
  {
    "id": "proj_1706789123456_abc123",
    "name": "E-commerce Platform",
    "workingDir": "/Users/dev/projects/ecommerce",
    "description": "Main platform with React + Node.js",
    "createdAt": 1706789123456,
    "updatedAt": 1706789234567
  }
]
```

**Example:**
```bash
curl http://localhost:3000/api/projects
```

---

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

**Response (201):**
```json
{
  "id": "proj_1706789123456_xyz789",
  "name": "My Project",
  "workingDir": "/path/to/dir",
  "description": "Description",
  "createdAt": 1706789123456,
  "updatedAt": 1706789123456
}
```

**Validation:**
- `name` is required (400 if missing)

**Example:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "workingDir": "/Users/dev/my-project"
  }'
```

---

### Get Project by ID

```http
GET /api/projects/:id
```

**Response (200):**
```json
{
  "id": "proj_123",
  "name": "My Project",
  "workingDir": "/path/to/dir",
  "description": "Description",
  "createdAt": 1706789123456,
  "updatedAt": 1706789234567
}
```

**Errors:**
- 404 if project not found

**Example:**
```bash
curl http://localhost:3000/api/projects/proj_123
```

---

### Update Project

```http
PUT /api/projects/:id
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "workingDir": "/new/path",
  "description": "New description"
}
```

**Response (200):**
```json
{
  "id": "proj_123",
  "name": "Updated Name",
  "workingDir": "/new/path",
  "description": "New description",
  "createdAt": 1706789123456,
  "updatedAt": 1706790000000
}
```

**Notes:**
- `updatedAt` is automatically set to current timestamp
- `id` and `createdAt` cannot be changed

**Example:**
```bash
curl -X PUT http://localhost:3000/api/projects/proj_123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Project Name"}'
```

---

### Delete Project

```http
DELETE /api/projects/:id
```

**Response (200):**
```json
{
  "success": true,
  "id": "proj_123"
}
```

**Errors:**
- 404 if project not found
- 400 if project has tasks or sessions (code: `PROJECT_HAS_DEPENDENCIES`)

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/projects/proj_123
```

---

## Tasks API

Tasks represent units of work within projects. Supports hierarchical task structure via `parentId`.

### List Tasks

```http
GET /api/tasks?projectId=<id>&status=<status>&parentId=<id|null>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Filter by project ID |
| `status` | string | Filter by status (`pending`, `in_progress`, `completed`, `blocked`) |
| `parentId` | string\|null | Filter by parent task ID (use `"null"` for root tasks) |

**Response (200):**
```json
[
  {
    "id": "task_1706790000000_xyz789",
    "projectId": "proj_123",
    "parentId": null,
    "title": "Implement authentication",
    "description": "Add JWT-based auth",
    "status": "in_progress",
    "priority": "high",
    "sessionIds": ["sess_123"],
    "skillIds": [],
    "agentIds": [],
    "dependencies": [],
    "timeline": [
      {
        "id": "evt_001",
        "type": "created",
        "timestamp": 1706790000000,
        "message": "Task created"
      }
    ],
    "createdAt": 1706790000000,
    "updatedAt": 1706792500000,
    "startedAt": 1706792222222,
    "completedAt": null,
    "initialPrompt": "add user auth to the app"
  }
]
```

**Examples:**

```bash
# All tasks in a project
curl 'http://localhost:3000/api/tasks?projectId=proj_123'

# Only in-progress tasks
curl 'http://localhost:3000/api/tasks?status=in_progress'

# Root tasks only (no parent)
curl 'http://localhost:3000/api/tasks?parentId=null'

# Child tasks of a parent
curl 'http://localhost:3000/api/tasks?parentId=task_123'
```

---

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
  "priority": "high",                // Optional: low, medium (default), high
  "initialPrompt": "User request"    // Optional
}
```

**Response (201):**
```json
{
  "id": "task_1706790000000_xyz789",
  "projectId": "proj_123",
  "parentId": "task_456",
  "title": "Task Title",
  "description": "Detailed desc",
  "status": "pending",
  "priority": "high",
  "sessionIds": [],
  "skillIds": [],
  "agentIds": [],
  "dependencies": [],
  "timeline": [
    {
      "id": "evt_001",
      "type": "created",
      "timestamp": 1706790000000,
      "message": "Task created"
    }
  ],
  "createdAt": 1706790000000,
  "updatedAt": 1706790000000,
  "startedAt": null,
  "completedAt": null,
  "initialPrompt": "User request"
}
```

**Defaults:**
- `status`: `"pending"`
- `priority`: `"medium"`
- `sessionIds`, `skillIds`, `agentIds`, `dependencies`: `[]`
- `timeline`: Array with single "created" event

**Validation:**
- `projectId` required (400 if missing)
- `title` required (400 if missing)

**Example:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication",
    "priority": "high"
  }'
```

---

### Get Task by ID

```http
GET /api/tasks/:id
```

**Response (200):**
Full task object with all fields (see Create Task response).

**Errors:**
- 404 if task not found

**Example:**
```bash
curl http://localhost:3000/api/tasks/task_123
```

---

### Update Task

```http
PATCH /api/tasks/:id
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "title": "New Title",
  "description": "New description",
  "status": "in_progress",           // pending, in_progress, completed, blocked
  "priority": "high",                // low, medium, high
  "sessionIds": ["sess_1", "sess_2"],
  "skillIds": ["skill_1"],           // Phase IV-B
  "agentIds": ["agent_1"],           // Phase IV-C
  "timeline": [                      // Appends to existing timeline
    {
      "id": "evt_002",
      "type": "update",
      "message": "Progress update",
      "timestamp": 1706789123456
    }
  ]
}
```

**Response (200):**
Updated task object.

**Special Behaviors:**

| Action | Automatic Side Effect |
|--------|----------------------|
| `status` → `"in_progress"` | Sets `startedAt` timestamp (if not already set) |
| `status` → `"completed"` | Sets `completedAt` timestamp (if not already set) |
| `timeline` array provided | Events are **appended** to existing timeline |

**Errors:**
- 404 if task not found

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/tasks/task_123 \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

---

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

**Response (200):**
Updated task object with new timeline event appended.

**Validation:**
- `message` is required (400 if missing)

**Example:**
```bash
curl -X POST http://localhost:3000/api/tasks/task_123/timeline \
  -H "Content-Type: application/json" \
  -d '{
    "type": "milestone",
    "message": "User model implementation completed"
  }'
```

---

### Delete Task

```http
DELETE /api/tasks/:id
```

**Response (200):**
```json
{
  "success": true,
  "id": "task_123"
}
```

**Errors:**
- 404 if task not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/tasks/task_123
```

---

### Get Child Tasks

Convenience endpoint to get all child tasks of a parent.

```http
GET /api/tasks/:id/children
```

**Response (200):**
Array of task objects where `parentId` matches the given task ID.

**Errors:**
- 404 if parent task not found

**Example:**
```bash
curl http://localhost:3000/api/tasks/task_123/children
```

**Note:** This is equivalent to `GET /api/tasks?parentId=task_123`

---

## Sessions API

Sessions represent active agent sessions (CLI instances) working on tasks.

### List Sessions

```http
GET /api/sessions?projectId=<id>&taskId=<id>&status=<status>&active=<bool>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Filter by project ID |
| `taskId` | string | Filter sessions containing this task ID |
| `status` | string | Filter by status (`spawning`, `running`, `completed`, `failed`) |
| `active` | boolean | If `"true"`, exclude completed/failed sessions |

**Response (200):**
```json
[
  {
    "id": "sess_1706792222222_lmn678",
    "projectId": "proj_123",
    "taskIds": ["task_001", "task_002"],
    "name": "Worker: User Auth",
    "agentId": null,
    "status": "running",
    "env": {
      "MAESTRO_SESSION_ID": "sess_1706792222222_lmn678",
      "MAESTRO_PROJECT_ID": "proj_123"
    },
    "startedAt": 1706792222222,
    "lastActivity": 1706792500000,
    "completedAt": null,
    "hostname": "MacBook-Pro.local",
    "platform": "darwin",
    "events": [],
    "metadata": {
      "skills": ["maestro-worker"]
    }
  }
]
```

**Examples:**

```bash
# All sessions in a project
curl 'http://localhost:3000/api/sessions?projectId=proj_123'

# Sessions working on a specific task
curl 'http://localhost:3000/api/sessions?taskId=task_123'

# Only active sessions
curl 'http://localhost:3000/api/sessions?active=true'
```

---

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
  "taskIds": ["task_1", "task_2"],       // Required (non-empty array)
  "name": "Session Name",                // Optional
  "agentId": "agent_123",                // Optional (Phase IV-C)
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

**Response (201):**
```json
{
  "id": "sess_1706792222222_lmn678",
  "projectId": "proj_123",
  "taskIds": ["task_1", "task_2"],
  "name": "Session Name",
  "agentId": null,
  "status": "running",
  "env": {},
  "startedAt": 1706792222222,
  "lastActivity": 1706792222222,
  "completedAt": null,
  "hostname": "MacBook-Pro.local",
  "platform": "darwin",
  "events": [],
  "metadata": {
    "skills": ["maestro-worker"]
  }
}
```

**Side Effects:**
- Adds session ID to all tasks in `taskIds`
- Appends `session_started` timeline event to each task

**Backward Compatibility:**
- Still accepts `taskId` (singular) and converts to `taskIds` array

**Validation:**
- `taskIds` required (400 if missing or empty)

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "name": "Worker Session",
    "metadata": {"skills": ["maestro-worker"]}
  }'
```

---

### Get Session by ID

```http
GET /api/sessions/:id
```

**Response (200):**
Full session object.

**Errors:**
- 404 if session not found

**Example:**
```bash
curl http://localhost:3000/api/sessions/sess_123
```

---

### Update Session

```http
PATCH /api/sessions/:id
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "taskIds": ["task_3", "task_4"],   // Update associated tasks
  "status": "completed",             // spawning, running, completed, failed
  "agentId": "agent_456",
  "events": [                        // Append events
    {
      "id": "evt_001",
      "timestamp": 1706789123456,
      "type": "log",
      "data": {"message": "Event data"}
    }
  ]
}
```

**Response (200):**
Updated session object.

**Notes:**
- `lastActivity` is automatically set to current timestamp

**Errors:**
- 404 if session not found

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/sessions/sess_123 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

---

### Delete Session

```http
DELETE /api/sessions/:id
```

**Response (200):**
```json
{
  "success": true,
  "id": "sess_123"
}
```

**Side Effects:**
- Removes session ID from all associated tasks
- Appends `session_ended` timeline event to each task

**Errors:**
- 404 if session not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_123
```

---

### Add Task to Session

```http
POST /api/sessions/:id/tasks/:taskId
```

**Response (200):**
Updated session object.

**Side Effects (Bidirectional):**
- Adds task to session's `taskIds`
- Adds session to task's `sessionIds`
- Appends `session_started` timeline event to task
- Emits `session:task_added` and `task:session_added` events

**Errors:**
- 404 if session or task not found

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/tasks/task_456
```

---

### Remove Task from Session

```http
DELETE /api/sessions/:id/tasks/:taskId
```

**Response (200):**
Updated session object.

**Side Effects (Bidirectional):**
- Removes task from session's `taskIds`
- Removes session from task's `sessionIds`
- Appends `session_ended` timeline event to task
- Emits `session:task_removed` and `task:session_removed` events

**Errors:**
- 404 if session or task not found

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_123/tasks/task_456
```

---

### Spawn Session

**CRITICAL ENDPOINT:** Triggers UI to spawn terminal with CLI context.

```http
POST /api/sessions/spawn
Content-Type: application/json
```

**Request Body:**
```json
{
  "projectId": "proj_123",                    // Required
  "taskIds": ["task_1", "task_2"],            // Required (non-empty array)
  "sessionName": "Worker: Auth",              // Optional
  "skills": ["code-visualizer"],              // Optional (default: ["maestro-worker"])
  "spawnedBy": "sess_orchestrator_123",       // Optional (parent session ID)
  "spawnReason": "Task delegation",           // Optional
  "context": {                                // Optional
    "reason": "Additional context"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "sessionId": "sess_789",
  "message": "Spawn request sent to Agents UI",
  "session": {
    "id": "sess_789",
    "projectId": "proj_123",
    "taskIds": ["task_1", "task_2"],
    "status": "spawning",
    "metadata": {
      "skills": ["code-visualizer"],
      "spawnedBy": "sess_orchestrator_123",
      "spawnReason": "Task delegation"
    }
  }
}
```

**What Happens:**

1. Server creates session with `status: "spawning"`
2. Server adds session ID to all tasks
3. Server broadcasts `session:spawn_request` via WebSocket
4. UI receives event and spawns terminal with environment variables:
   ```bash
   MAESTRO_SESSION_ID=sess_789
   MAESTRO_PROJECT_ID=proj_123
   MAESTRO_TASK_IDS=task_1,task_2
   MAESTRO_SERVER_URL=http://localhost:3000
   MAESTRO_SKILLS=code-visualizer
   ```
5. Terminal executes CLI auto-initialization
6. CLI generates prompts and spawns Claude
7. Session status updates to `running`

**Validation:**
- `projectId` required (400: `missing_project_id`)
- `taskIds` must be non-empty array (400: `invalid_task_ids`)
- All tasks must exist (404: `task_not_found`)

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "skills": ["maestro-worker"]
  }'
```

---

## WebSocket API Reference

### WebSocket Connection

**URL:** `ws://localhost:3000`

**Client-Side Connection:**

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('open', () => {
  console.log('Connected to Maestro Server');
});

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message.type, message.data);
});

ws.addEventListener('close', () => {
  console.log('Disconnected');
});

ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
});
```

---

### Message Format

All WebSocket messages follow this structure:

```json
{
  "type": "event_name",
  "event": "event_name",  // Duplicate for backward compatibility
  "data": {
    // Event-specific payload
  }
}
```

---

## Event Catalog

### Project Events

#### project:created

Emitted when a new project is created.

**Payload:**
```json
{
  "type": "project:created",
  "event": "project:created",
  "data": {
    "id": "proj_1706789123456_abc123",
    "name": "New Project",
    "workingDir": "/path/to/project",
    "description": "Project description",
    "createdAt": 1706789123456,
    "updatedAt": 1706789123456
  }
}
```

**Triggered By:**
- `POST /api/projects`

---

#### project:updated

Emitted when a project is modified.

**Payload:**
```json
{
  "type": "project:updated",
  "event": "project:updated",
  "data": {
    "id": "proj_123",
    "name": "Updated Project",
    // ... complete updated project object
  }
}
```

**Triggered By:**
- `PUT /api/projects/:id`

---

#### project:deleted

Emitted when a project is deleted.

**Payload:**
```json
{
  "type": "project:deleted",
  "event": "project:deleted",
  "data": {
    "id": "proj_123"
  }
}
```

**Triggered By:**
- `DELETE /api/projects/:id`

---

### Task Events

#### task:created

Emitted when a new task is created.

**Payload:**
```json
{
  "type": "task:created",
  "event": "task:created",
  "data": {
    "id": "task_1706790000000_xyz789",
    "projectId": "proj_123",
    "parentId": null,
    "title": "New Task",
    "status": "pending",
    "priority": "medium",
    "sessionIds": [],
    // ... complete task object
  }
}
```

**Triggered By:**
- `POST /api/tasks`

---

#### task:updated

Emitted when a task is modified.

**Payload:**
```json
{
  "type": "task:updated",
  "event": "task:updated",
  "data": {
    "id": "task_123",
    "status": "in_progress",
    // ... complete updated task object
  }
}
```

**Triggered By:**
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/timeline`
- Task modified as side effect of session operations

---

#### task:deleted

Emitted when a task is deleted.

**Payload:**
```json
{
  "type": "task:deleted",
  "event": "task:deleted",
  "data": {
    "id": "task_123"
  }
}
```

**Triggered By:**
- `DELETE /api/tasks/:id`

---

#### task:session_added

Emitted when a session is added to a task.

**Payload:**
```json
{
  "type": "task:session_added",
  "event": "task:session_added",
  "data": {
    "taskId": "task_456",
    "sessionId": "sess_123"
  }
}
```

**Triggered By:**
- `POST /api/sessions/:id/tasks/:taskId`
- `POST /api/sessions` (for tasks in `taskIds`)
- `POST /api/sessions/spawn`

---

#### task:session_removed

Emitted when a session is removed from a task.

**Payload:**
```json
{
  "type": "task:session_removed",
  "event": "task:session_removed",
  "data": {
    "taskId": "task_456",
    "sessionId": "sess_123"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id/tasks/:taskId`
- `DELETE /api/sessions/:id`

---

### Session Events

#### session:created

Emitted when a new session is created.

**Payload:**
```json
{
  "type": "session:created",
  "event": "session:created",
  "data": {
    "id": "sess_1706792222222_lmn678",
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "name": "Worker Session",
    "status": "running",
    // ... complete session object
  }
}
```

**Triggered By:**
- `POST /api/sessions`

---

#### session:updated

Emitted when a session is modified.

**Payload:**
```json
{
  "type": "session:updated",
  "event": "session:updated",
  "data": {
    "id": "sess_123",
    "status": "completed",
    // ... complete updated session object
  }
}
```

**Triggered By:**
- `PATCH /api/sessions/:id`

---

#### session:deleted

Emitted when a session is deleted.

**Payload:**
```json
{
  "type": "session:deleted",
  "event": "session:deleted",
  "data": {
    "id": "sess_123"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id`

---

#### session:spawn_request

**CRITICAL EVENT** - Triggers UI to spawn terminal.

**Payload:**
```json
{
  "type": "session:spawn_request",
  "event": "session:spawn_request",
  "data": {
    "session": {
      "id": "sess_789",
      "projectId": "proj_123",
      "taskIds": ["task_001"],
      "status": "spawning",
      // ... complete session object
    },
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "skillIds": ["maestro-worker"],
    "name": "Worker for task_001"
  }
}
```

**UI Response Flow:**
1. Receive event
2. Fetch project details (`GET /api/projects/:projectId`) for working directory
3. Spawn terminal at `workingDir` with environment variables
4. Terminal executes CLI auto-initialization
5. CLI updates session status to `running`

**Triggered By:**
- `POST /api/sessions/spawn`

---

#### session:task_added

Emitted when a task is added to a session.

**Payload:**
```json
{
  "type": "session:task_added",
  "event": "session:task_added",
  "data": {
    "sessionId": "sess_123",
    "taskId": "task_456"
  }
}
```

**Triggered By:**
- `POST /api/sessions/:id/tasks/:taskId`

---

#### session:task_removed

Emitted when a task is removed from a session.

**Payload:**
```json
{
  "type": "session:task_removed",
  "event": "session:task_removed",
  "data": {
    "sessionId": "sess_123",
    "taskId": "task_456"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id/tasks/:taskId`

---

## Client Implementation Examples

### React/TypeScript Client

```typescript
import { useEffect, useState } from 'react';

interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
}

export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [url]);

  return { ws, connected };
}

// Usage in component
export function TaskList() {
  const { ws } = useWebSocket('ws://localhost:3000');
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'task:created':
          setTasks(prev => [...prev, message.data]);
          break;

        case 'task:updated':
          setTasks(prev =>
            prev.map(t => t.id === message.data.id ? message.data : t)
          );
          break;

        case 'task:deleted':
          setTasks(prev => prev.filter(t => t.id !== message.data.id));
          break;
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  return <div>{/* Render tasks */}</div>;
}
```

---

### Node.js/CLI Client

```javascript
const WebSocket = require('ws');

class MaestroClient {
  constructor(url = 'ws://localhost:3000') {
    this.ws = new WebSocket(url);
    this.setupListeners();
  }

  setupListeners() {
    this.ws.on('open', () => {
      console.log('Connected to Maestro Server');
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      this.handleEvent(message);
    });

    this.ws.on('close', () => {
      console.log('Disconnected from Maestro Server');
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  handleEvent(message) {
    const { type, data } = message;

    switch (type) {
      case 'session:spawn_request':
        this.handleSpawnRequest(data);
        break;

      case 'task:updated':
        this.handleTaskUpdate(data);
        break;

      // Add more handlers...
    }
  }

  handleSpawnRequest(data) {
    const { session, projectId, taskIds, skillIds } = data;
    console.log(`Spawn request for session ${session.id}`);
    console.log(`Tasks: ${taskIds.join(', ')}`);
    console.log(`Skills: ${skillIds.join(', ')}`);
  }

  handleTaskUpdate(task) {
    console.log(`Task ${task.id} updated: ${task.status}`);
  }
}

// Usage
const client = new MaestroClient();
```

---

### Event Filtering by Project

```typescript
function handleMessage(message: WebSocketMessage, currentProjectId: string) {
  switch (message.type) {
    case 'task:created':
    case 'task:updated':
      if (message.data.projectId === currentProjectId) {
        updateTaskInUI(message.data);
      }
      break;

    case 'session:created':
    case 'session:updated':
      if (message.data.projectId === currentProjectId) {
        addSessionToUI(message.data);
      }
      break;

    case 'project:updated':
      if (message.data.id === currentProjectId) {
        updateProjectInUI(message.data);
      }
      break;
  }
}
```

---

### Reconnection Strategy

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
    });

    this.ws.addEventListener('close', () => {
      console.log('Disconnected');
      this.attemptReconnect(url);
    });

    this.ws.addEventListener('error', (error) => {
      console.error('Error:', error);
    });
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect(url);
    }, this.reconnectInterval);
  }
}
```

---

## Authentication & Security

### Current State

⚠️ **For local development only**

- **No authentication** - All endpoints are open
- **No authorization** - All clients receive all events
- **No encryption** - HTTP/WebSocket (not HTTPS/WSS)
- **No rate limiting** - Endpoints can be called unlimited times

### Production Requirements

For production deployment, implement:

1. **Authentication**
   - JWT tokens for API requests
   - Token-based WebSocket authentication

2. **Authorization**
   - User-based permissions
   - Project-level access control
   - Event filtering by user permissions

3. **Encryption**
   - HTTPS for REST API
   - WSS for WebSocket connections

4. **Rate Limiting**
   - Per-user/IP limits on API endpoints
   - WebSocket connection limits

5. **Input Validation**
   - Sanitize all user inputs
   - Validate JSON schemas
   - Prevent injection attacks

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Missing or invalid request parameters |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `TASK_NOT_FOUND` | 404 | Task does not exist |
| `PROJECT_HAS_DEPENDENCIES` | 400 | Cannot delete project with tasks/sessions |
| `missing_project_id` | 400 | No projectId in spawn request |
| `invalid_task_ids` | 400 | taskIds missing or empty in spawn request |
| `task_not_found` | 404 | Task in spawn request doesn't exist |
| `spawn_error` | 500 | Server error during session spawn |
| `INTERNAL_ERROR` | 500 | Server-side error |

### Example Error Response

```json
{
  "error": true,
  "message": "Task task_999 not found",
  "code": "task_not_found",
  "details": {
    "taskId": "task_999"
  }
}
```

---

## Rate Limiting

**Current State:** None

For production:
- Implement per-user/IP rate limiting
- Suggested limits:
  - 100 requests/minute for read operations
  - 30 requests/minute for write operations
  - 10 spawn requests/minute

---

## Examples & Use Cases

### Example 1: Create Project and Task

```bash
# 1. Create project
PROJECT_RESPONSE=$(curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "workingDir": "/Users/dev/my-app"}')

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
echo "Created project: $PROJECT_ID"

# 2. Create task
TASK_RESPONSE=$(curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"Setup database\",
    \"priority\": \"high\"
  }")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.id')
echo "Created task: $TASK_ID"
```

---

### Example 2: Spawn Worker Session

```bash
# Spawn a worker session for a task
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "sessionName": "Database Setup Worker",
    "skills": ["maestro-worker"]
  }'

# UI receives session:spawn_request event
# UI spawns terminal with env vars
# CLI initializes and starts work
```

---

### Example 3: Monitor Task Progress

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'task:updated') {
    const task = message.data;
    console.log(`Task ${task.id} is now ${task.status}`);

    if (task.status === 'completed') {
      console.log('Task completed!');
    }
  }
});
```

---

### Example 4: Hierarchical Task Management

```bash
# 1. Create parent task
PARENT=$(curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "title": "Implement Authentication"
  }')

PARENT_ID=$(echo $PARENT | jq -r '.id')

# 2. Create child tasks
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"proj_123\",
    \"parentId\": \"$PARENT_ID\",
    \"title\": \"Create User model\"
  }"

curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"proj_123\",
    \"parentId\": \"$PARENT_ID\",
    \"title\": \"Add JWT middleware\"
  }"

# 3. Get all child tasks
curl "http://localhost:3000/api/tasks/$PARENT_ID/children"
```

---

### Example 5: Session-Task Management

```bash
# Create session
SESSION=$(curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskIds": ["task_001"],
    "name": "Multi-task Worker"
  }')

SESSION_ID=$(echo $SESSION | jq -r '.id')

# Add another task to session
curl -X POST "http://localhost:3000/api/sessions/$SESSION_ID/tasks/task_002"

# Remove task from session
curl -X DELETE "http://localhost:3000/api/sessions/$SESSION_ID/tasks/task_001"
```

---

## Additional Resources

- [System Overview](./01-OVERVIEW.md)
- [Storage Layer Documentation](./03-STORAGE-LAYER.md)
- [Data Models](./05-DATA-MODELS.md)
- [Workflow Diagrams](./06-FLOWS.md)
- [Architecture Diagrams](./07-ARCHITECTURE-DIAGRAMS.md)

---

**Last Updated:** February 2, 2026
**Server Version:** 1.0.0 (Phase IV-A)
**Documentation Status:** Complete and synchronized with implementation
