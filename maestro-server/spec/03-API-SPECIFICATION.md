# Maestro Server - API Specification

**Version:** 2.0.0
**Last Updated:** 2026-02-08
**Purpose:** Complete REST API documentation with endpoints, schemas, and examples

---

## Overview

Maestro Server exposes a RESTful HTTP API on port 3000 (configurable via `PORT` env).

### Base URL
```
http://localhost:3000
```

### Content Type
All requests and responses use `application/json`.

### HTTP Methods
- **GET** - Retrieve resources
- **POST** - Create resources
- **PATCH** - Partially update resources
- **PUT** - Fully replace resources
- **DELETE** - Delete resources

### Error Response Format
All errors follow this schema:

```typescript
interface ErrorResponse {
  error: true;
  message: string;      // Human-readable error message
  code: string;         // Machine-readable error code
  details?: any;        // Optional additional details
}
```

---

## Endpoint Catalog

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (with filters) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task by ID |
| PATCH | `/api/tasks/:id` | Update task |
| POST | `/api/tasks/:id/timeline` | Add timeline event to task |
| GET | `/api/tasks/:id/children` | Get child tasks |
| DELETE | `/api/tasks/:id` | Delete task |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List sessions (with filters) |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session by ID |
| PATCH | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/events` | Add event to session |
| POST | `/api/sessions/:id/timeline` | Add timeline event to session |
| POST | `/api/sessions/spawn` | Spawn session (server-generated manifest) |
| POST | `/api/sessions/:id/tasks/:taskId` | Add task to session |
| DELETE | `/api/sessions/:id/tasks/:taskId` | Remove task from session |

### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List available skills |
| GET | `/api/skills/:id` | Get skill by ID |
| GET | `/api/skills/role/:role` | Get skills for role |
| POST | `/api/skills/:id/reload` | Reload skill from disk |

### Queue (Session Task Queues)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/:id/queue` | Get queue state |
| GET | `/api/sessions/:id/queue/top` | Get next item (peek) |
| POST | `/api/sessions/:id/queue/start` | Start processing next item |
| POST | `/api/sessions/:id/queue/complete` | Complete current item |
| POST | `/api/sessions/:id/queue/fail` | Fail current item |
| POST | `/api/sessions/:id/queue/skip` | Skip current item |
| GET | `/api/sessions/:id/queue/items` | List all queue items |
| POST | `/api/sessions/:id/queue/push` | Push new task to queue |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:id` | Get template by ID |
| GET | `/api/templates/role/:role` | Get template by role |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/:id` | Update template |
| POST | `/api/templates/:id/reset` | Reset template to default |
| DELETE | `/api/templates/:id` | Delete template |
| GET | `/api/templates/default/:role` | Get default content for role |

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ws-status` | WebSocket connection status |

---

## Projects API

### List Projects

**Endpoint:** `GET /api/projects`

**Description:** Retrieve all projects.

**Request:**
```bash
curl http://localhost:3000/api/projects
```

**Response:** `200 OK`
```json
[
  {
    "id": "proj_1738713600000_x7k9m2p4q",
    "name": "agents-ui",
    "workingDir": "/Users/john/Projects/agents-ui",
    "description": "Multi-agent UI framework",
    "createdAt": 1738713600000,
    "updatedAt": 1738713600000
  }
]
```

**Side Effects:**
- None

**Events Emitted:**
- None

---

### Create Project

**Endpoint:** `POST /api/projects`

**Description:** Create a new project.

**Request Schema:**
```typescript
{
  name: string;              // Required
  workingDir: string;        // Required
  description?: string;      // Optional
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "workingDir": "/Users/john/Projects/my-project",
    "description": "My awesome project"
  }'
```

**Response:** `201 Created`
```json
{
  "id": "proj_1738713600000_x7k9m2p4q",
  "name": "my-project",
  "workingDir": "/Users/john/Projects/my-project",
  "description": "My awesome project",
  "createdAt": 1738713600000,
  "updatedAt": 1738713600000
}
```

**Side Effects:**
- Project saved to `~/.maestro/data/projects/{id}.json`

**Events Emitted:**
- `project:created` - Full project object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "name is required" | Missing `name` field |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Get Project

**Endpoint:** `GET /api/projects/:id`

**Description:** Retrieve single project by ID.

**Request:**
```bash
curl http://localhost:3000/api/projects/proj_1738713600000_x7k9m2p4q
```

**Response:** `200 OK`
```json
{
  "id": "proj_1738713600000_x7k9m2p4q",
  "name": "agents-ui",
  "workingDir": "/Users/john/Projects/agents-ui",
  "description": "Multi-agent UI framework",
  "createdAt": 1738713600000,
  "updatedAt": 1738713600000
}
```

**Side Effects:**
- None

**Events Emitted:**
- None

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `PROJECT_NOT_FOUND` | "Project not found" | Project ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Update Project

**Endpoint:** `PUT /api/projects/:id`

**Description:** Update project fields. All fields optional.

**Request Schema:**
```typescript
{
  name?: string;
  workingDir?: string;
  description?: string;
}
```

**Request:**
```bash
curl -X PUT http://localhost:3000/api/projects/proj_1738713600000_x7k9m2p4q \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name"
  }'
```

**Response:** `200 OK`
```json
{
  "id": "proj_1738713600000_x7k9m2p4q",
  "name": "Updated Project Name",
  "workingDir": "/Users/john/Projects/agents-ui",
  "description": "Multi-agent UI framework",
  "createdAt": 1738713600000,
  "updatedAt": 1738713700000
}
```

**Side Effects:**
- `updatedAt` auto-set to current timestamp
- Project saved to disk

**Events Emitted:**
- `project:updated` - Full project object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `PROJECT_NOT_FOUND` | "Project not found" | Project ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Delete Project

**Endpoint:** `DELETE /api/projects/:id`

**Description:** Delete project. Fails if project has tasks or sessions.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/projects/proj_1738713600000_x7k9m2p4q
```

**Response:** `200 OK`
```json
{
  "success": true,
  "id": "proj_1738713600000_x7k9m2p4q"
}
```

**Side Effects:**
- Project file deleted from disk
- `~/.maestro/data/projects/{id}.json` removed

**Events Emitted:**
- `project:deleted` - `{ id: string }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `PROJECT_HAS_DEPENDENCIES` | "Cannot delete project with N existing task(s)" | Project has tasks |
| 400 | `PROJECT_HAS_DEPENDENCIES` | "Cannot delete project with N existing session(s)" | Project has sessions |
| 404 | `PROJECT_NOT_FOUND` | "Project not found" | Project ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

## Tasks API

### List Tasks

**Endpoint:** `GET /api/tasks`

**Description:** List tasks with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Filter by project ID |
| `status` | TaskStatus | Filter by status (pending, in_progress, completed, blocked) |
| `parentId` | string\|"null" | Filter by parent ID (use "null" for root tasks) |

**Request:**
```bash
# All tasks
curl http://localhost:3000/api/tasks

# Tasks in specific project
curl http://localhost:3000/api/tasks?projectId=proj_123

# Root tasks only
curl http://localhost:3000/api/tasks?parentId=null

# In-progress tasks
curl http://localhost:3000/api/tasks?status=in_progress

# Combined filters
curl http://localhost:3000/api/tasks?projectId=proj_123&status=pending&parentId=null
```

**Response:** `200 OK`
```json
[
  {
    "id": "task_1738713700000_p9q2r5t8w",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "parentId": null,
    "title": "Implement WebSocket events",
    "description": "Add real-time event broadcasting",
    "status": "in_progress",
    "priority": "high",
    "createdAt": 1738713700000,
    "updatedAt": 1738713800000,
    "startedAt": 1738713750000,
    "completedAt": null,
    "initialPrompt": "Add WebSocket support",
    "sessionIds": ["sess_1738713800000_a1b2c3d4e"],
    "skillIds": ["maestro-worker"],
    "agentIds": [],
    "dependencies": [],
    "timeline": [
      {
        "id": "evt_1738713700000_z1y2x3w4v",
        "type": "created",
        "timestamp": 1738713700000,
        "message": "Task created"
      }
    ]
  }
]
```

**Side Effects:**
- None

**Events Emitted:**
- None

---

### Create Task

**Endpoint:** `POST /api/tasks`

**Description:** Create new task.

**Request Schema:**
```typescript
{
  projectId: string;          // Required
  parentId?: string;          // Optional (null for root task)
  title: string;              // Required
  description?: string;       // Optional
  priority?: TaskPriority;    // Optional (default: "medium")
  initialPrompt?: string;     // Optional
  skillIds?: string[];        // Optional
  model?: 'haiku' | 'sonnet' | 'opus';  // Optional (LLM model)
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "title": "Build API endpoints",
    "description": "Implement REST API",
    "priority": "high",
    "initialPrompt": "Create REST API with Express"
  }'
```

**Response:** `201 Created`
```json
{
  "id": "task_1738713700000_p9q2r5t8w",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "parentId": null,
  "title": "Build API endpoints",
  "description": "Implement REST API",
  "status": "todo",
  "priority": "high",
  "createdAt": 1738713700000,
  "updatedAt": 1738713700000,
  "startedAt": null,
  "completedAt": null,
  "initialPrompt": "Create REST API with Express",
  "sessionIds": [],
  "skillIds": [],
  "agentIds": [],
  "dependencies": [],
  "timeline": [
    {
      "id": "evt_1738713700000_z1y2x3w4v",
      "type": "created",
      "timestamp": 1738713700000,
      "message": "Task created"
    }
  ]
}
```

**Side Effects:**
- Task saved to `~/.maestro/data/tasks/{projectId}/{id}.json`
- Initial timeline event auto-created

**Events Emitted:**
- `task:created` - Full task object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "projectId is required" | Missing `projectId` |
| 400 | `VALIDATION_ERROR` | "title is required" | Missing `title` |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Get Task

**Endpoint:** `GET /api/tasks/:id`

**Description:** Retrieve single task by ID.

**Request:**
```bash
curl http://localhost:3000/api/tasks/task_1738713700000_p9q2r5t8w
```

**Response:** `200 OK`
```json
{
  "id": "task_1738713700000_p9q2r5t8w",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "parentId": null,
  "title": "Build API endpoints",
  "description": "Implement REST API",
  "status": "todo",
  "priority": "high",
  "createdAt": 1738713700000,
  "updatedAt": 1738713700000,
  "startedAt": null,
  "completedAt": null,
  "initialPrompt": "Create REST API with Express",
  "sessionIds": [],
  "skillIds": [],
  "agentIds": [],
  "dependencies": [],
}
```

**Side Effects:**
- None

**Events Emitted:**
- None

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `TASK_NOT_FOUND` | "Task not found" | Task ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Update Task

**Endpoint:** `PATCH /api/tasks/:id`

**Description:** Partially update task. All fields optional.

**Request Schema:**
```typescript
{
  title?: string;
  description?: string;
  status?: TaskStatus;            // Auto-sets startedAt/completedAt
  sessionStatus?: TaskSessionStatus;  // Session's status while working on task
  priority?: TaskPriority;
  sessionIds?: string[];
  skillIds?: string[];
  agentIds?: string[];
  model?: 'haiku' | 'sonnet' | 'opus';  // LLM model
  updateSource?: 'user' | 'session';  // Who is making the update
  sessionId?: string;                  // Session ID if updateSource === 'session'
}
```

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/tasks/task_1738713700000_p9q2r5t8w \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }'
```

**Response:** `200 OK`
```json
{
  "id": "task_1738713700000_p9q2r5t8w",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "parentId": null,
  "title": "Build API endpoints",
  "description": "Implement REST API",
  "status": "in_progress",
  "priority": "high",
  "createdAt": 1738713700000,
  "updatedAt": 1738713750000,
  "startedAt": 1738713750000,
  "completedAt": null,
  "initialPrompt": "Create REST API with Express",
  "sessionIds": [],
  "skillIds": [],
  "agentIds": [],
  "dependencies": [],
}
```

**Side Effects:**
- `updatedAt` auto-set to current timestamp
- `startedAt` auto-set on first transition to `in_progress`
- `completedAt` auto-set on first transition to `completed`
- Task saved to disk

**Events Emitted:**
- `task:updated` - Full task object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `TASK_NOT_FOUND` | "Task not found" | Task ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Get Child Tasks

**Endpoint:** `GET /api/tasks/:id/children`

**Description:** Get all child tasks of parent task.

**Request:**
```bash
curl http://localhost:3000/api/tasks/task_1738713700000_p9q2r5t8w/children
```

**Response:** `200 OK`
```json
[
  {
    "id": "task_child1",
    "parentId": "task_1738713700000_p9q2r5t8w",
    "title": "Subtask 1"
  },
  {
    "id": "task_child2",
    "parentId": "task_1738713700000_p9q2r5t8w",
    "title": "Subtask 2"
  }
]
```

**Side Effects:**
- None

**Events Emitted:**
- None

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `TASK_NOT_FOUND` | "Task not found" | Task ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Delete Task

**Endpoint:** `DELETE /api/tasks/:id`

**Description:** Delete task.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/tasks/task_1738713700000_p9q2r5t8w
```

**Response:** `200 OK`
```json
{
  "success": true,
  "id": "task_1738713700000_p9q2r5t8w"
}
```

**Side Effects:**
- Task file deleted from disk
- Task removed from all sessions' `taskIds` arrays (if associated)

**Events Emitted:**
- `task:deleted` - `{ id: string }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `TASK_NOT_FOUND` | "Task not found" | Task ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

### Add Timeline Event to Task

**Endpoint:** `POST /api/tasks/:id/timeline`

**Description:** Add a timeline event to a task. Proxies the event to the session's timeline.

**Request Schema:**
```typescript
{
  type?: string;              // Event type (default: "progress")
  message: string;            // Required - event message
  sessionId: string;          // Required - session to add timeline event to
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/tasks/task_123/timeline \
  -H "Content-Type: application/json" \
  -d '{
    "type": "progress",
    "message": "Completed API implementation",
    "sessionId": "sess_456"
  }'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "taskId": "task_123",
  "sessionId": "sess_456",
  "message": "Completed API implementation",
  "type": "progress"
}
```

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "message is required" | Missing `message` |
| 400 | `VALIDATION_ERROR` | "sessionId is required" | Missing `sessionId` |
| 404 | `NOT_FOUND` | "Task not found" | Task doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

## Sessions API

### List Sessions

**Endpoint:** `GET /api/sessions`

**Description:** List sessions with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Filter by project ID |
| `taskId` | string | Filter by task ID (sessions working on this task) |
| `status` | SessionStatus | Filter by status |
| `active` | "true" | Only return non-completed sessions |

**Request:**
```bash
# All sessions
curl http://localhost:3000/api/sessions

# Sessions in project
curl http://localhost:3000/api/sessions?projectId=proj_123

# Sessions working on task
curl http://localhost:3000/api/sessions?taskId=task_456

# Active sessions only
curl http://localhost:3000/api/sessions?active=true

# Combined filters
curl http://localhost:3000/api/sessions?projectId=proj_123&status=running
```

**Response:** `200 OK`
```json
[
  {
    "id": "sess_1738713800000_a1b2c3d4e",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "name": "Worker Session",
    "env": {
      "MAESTRO_SESSION_ID": "sess_1738713800000_a1b2c3d4e",
      "MAESTRO_MANIFEST_PATH": "/Users/john/.maestro/sessions/sess_1738713800000_a1b2c3d4e/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000"
    },
    "status": "running",
    "startedAt": 1738713800000,
    "lastActivity": 1738713850000,
    "completedAt": null,
    "hostname": "johns-macbook.local",
    "platform": "darwin",
    "events": [],
    "metadata": {
      "skills": ["maestro-worker"],
      "role": "worker",
      "spawnSource": "ui"
    }
  }
]
```

**Side Effects:**
- None

**Events Emitted:**
- None

---

### Create Session

**Endpoint:** `POST /api/sessions`

**Description:** Create session and associate with tasks.

**Request Schema:**
```typescript
{
  id?: string;                        // Optional client-provided ID
  projectId: string;                  // Required
  taskIds: string[];                  // Required (can use taskId for backward compat)
  name?: string;                      // Optional (default: "Unnamed Session")
  agentId?: string;                   // Optional
  strategy?: WorkerStrategy;          // Optional (default: "simple")
  status?: SessionStatus;             // Optional (default: "idle")
  env?: Record<string, string>;       // Optional
  metadata?: Record<string, any>;     // Optional
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "name": "My Worker Session",
    "env": { "DEBUG": "true" }
  }'
```

**Response:** `201 Created`
```json
{
  "id": "sess_1738713800000_a1b2c3d4e",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "taskIds": ["task_1738713700000_p9q2r5t8w"],
  "name": "My Worker Session",
  "env": { "DEBUG": "true" },
  "strategy": "simple",
  "status": "idle",
  "startedAt": 1738713800000,
  "lastActivity": 1738713800000,
  "completedAt": null,
  "hostname": "johns-macbook.local",
  "platform": "darwin",
  "events": [],
  "timeline": [],
  "metadata": null
}
```

**Side Effects:**
- Session saved to `~/.maestro/data/sessions/{id}.json`
- Session ID added to all tasks in `taskIds`
- Timeline events added to all tasks

**Events Emitted:**
- `session:created` - Full session object
- `task:session_added` - For each task: `{ taskId, sessionId }`

**Backward Compatibility:**
```bash
# Old format still works
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "taskId": "task_456"
  }'
# Internally converted to: taskIds: ["task_456"]
```

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "taskIds is required" | Missing `taskIds` or `taskId` |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Get Session

**Endpoint:** `GET /api/sessions/:id`

**Description:** Retrieve single session by ID.

**Request:**
```bash
curl http://localhost:3000/api/sessions/sess_1738713800000_a1b2c3d4e
```

**Response:** `200 OK`
```json
{
  "id": "sess_1738713800000_a1b2c3d4e",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "taskIds": ["task_1738713700000_p9q2r5t8w"],
  "name": "Worker Session",
  "env": {},
  "status": "running",
  "startedAt": 1738713800000,
  "lastActivity": 1738713800000,
  "completedAt": null,
  "hostname": "johns-macbook.local",
  "platform": "darwin",
  "events": [],
  "metadata": null
}
```

**Side Effects:**
- None

**Events Emitted:**
- None

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `SESSION_NOT_FOUND` | "Session not found" | Session ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Update Session

**Endpoint:** `PATCH /api/sessions/:id`

**Description:** Partially update session. All fields optional.

**Request Schema:**
```typescript
{
  taskIds?: string[];
  status?: SessionStatus;
  agentId?: string;
  env?: Record<string, string>;
  events?: SessionEvent[];
}
```

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/sessions/sess_1738713800000_a1b2c3d4e \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

**Response:** `200 OK`
```json
{
  "id": "sess_1738713800000_a1b2c3d4e",
  "projectId": "proj_1738713600000_x7k9m2p4q",
  "taskIds": ["task_1738713700000_p9q2r5t8w"],
  "name": "Worker Session",
  "env": {},
  "status": "completed",
  "startedAt": 1738713800000,
  "lastActivity": 1738713900000,
  "completedAt": null,
  "hostname": "johns-macbook.local",
  "platform": "darwin",
  "events": [],
  "metadata": null
}
```

**Side Effects:**
- `lastActivity` auto-set to current timestamp
- Session saved to disk

**Events Emitted:**
- `session:updated` - Full session object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `SESSION_NOT_FOUND` | "Session not found" | Session ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Delete Session

**Endpoint:** `DELETE /api/sessions/:id`

**Description:** Delete session.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_1738713800000_a1b2c3d4e
```

**Response:** `200 OK`
```json
{
  "success": true,
  "id": "sess_1738713800000_a1b2c3d4e"
}
```

**Side Effects:**
- Session file deleted from disk
- Session ID removed from all tasks' `sessionIds` arrays
- Timeline events added to all tasks (session_ended)

**Events Emitted:**
- `session:deleted` - `{ id: string }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `SESSION_NOT_FOUND` | "Session not found" | Session ID doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Add Event to Session

**Endpoint:** `POST /api/sessions/:id/events`

**Description:** Add a generic event to the session's events log.

**Request Schema:**
```typescript
{
  type: string;               // Required - event type
  data?: any;                 // Optional - event payload
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tool_call",
    "data": { "tool": "read_file", "path": "/src/index.ts" }
  }'
```

**Response:** `200 OK` - Full session object with updated events array.

**Events Emitted:**
- `session:updated` - Full session object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "type is required" | Missing `type` |
| 404 | `NOT_FOUND` | "Session not found" | Session doesn't exist |

---

### Add Timeline Event to Session

**Endpoint:** `POST /api/sessions/:id/timeline`

**Description:** Add a structured timeline event to the session.

**Request Schema:**
```typescript
{
  type?: SessionTimelineEventType;  // Optional (default: "progress")
  message: string;                  // Required
  taskId?: string;                  // Optional - associated task
  metadata?: Record<string, any>;   // Optional
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/timeline \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task_completed",
    "message": "Finished implementing API endpoints",
    "taskId": "task_456"
  }'
```

**Response:** `200 OK` - Full session object with updated timeline.

**Events Emitted:**
- `session:updated` - Full session object

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "message is required" | Missing `message` |
| 404 | `NOT_FOUND` | "Session not found" | Session doesn't exist |

---

### Spawn Session (Server-Generated Manifest)

**Endpoint:** `POST /api/sessions/spawn`

**Description:** Create session with server-generated manifest via CLI. This is the primary method for spawning agent sessions.

**Request Schema:**
```typescript
{
  projectId: string;                              // Required
  taskIds: string[];                              // Required (at least 1)
  role?: 'worker' | 'orchestrator';               // Optional (default: "worker")
  strategy?: WorkerStrategy;                      // Optional (default: "simple") - 'simple' | 'queue' | 'tree'
  spawnSource?: 'ui' | 'session';                 // Optional (default: "ui") - 'ui' for user-initiated, 'session' for agent-spawned
  sessionName?: string;                           // Optional (auto-generated)
  skills?: string[];                              // Optional (default: [])
  sessionId?: string;                             // Optional (required when spawnSource is 'session' - parent session ID)
  context?: Record<string, any>;                  // Optional
}
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "role": "worker",
    "skills": ["maestro-worker"],
    "sessionName": "Build API Worker"
  }'
```

**Response:** `201 Created`
```json
{
  "success": true,
  "sessionId": "sess_1738713800000_a1b2c3d4e",
  "manifestPath": "/Users/john/.maestro/sessions/sess_1738713800000_a1b2c3d4e/manifest.json",
  "message": "Spawn request sent to Agent Maestro",
  "session": {
    "id": "sess_1738713800000_a1b2c3d4e",
    "projectId": "proj_1738713600000_x7k9m2p4q",
    "taskIds": ["task_1738713700000_p9q2r5t8w"],
    "name": "Build API Worker",
    "env": {
      "MAESTRO_SESSION_ID": "sess_1738713800000_a1b2c3d4e",
      "MAESTRO_MANIFEST_PATH": "/Users/john/.maestro/sessions/sess_1738713800000_a1b2c3d4e/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000"
    },
    "status": "spawning",
    "metadata": {
      "skills": ["maestro-worker"],
      "role": "worker",
      "spawnSource": "ui"
    }
  }
}
```

**Side Effects:**
1. Session created in DB with status `spawning`
2. Manifest generated via `maestro manifest generate` CLI command
3. Manifest written to `~/.maestro/sessions/{sessionId}/manifest.json`
4. Session ID added to all tasks
5. Timeline events added to tasks

**Events Emitted:**
- `session:spawn` - **ALWAYS emitted** (for both UI and session spawns):
  ```json
  {
    "session": { ... },
    "command": "maestro worker init",
    "cwd": "/Users/john/Projects/agents-ui",
    "envVars": {
      "MAESTRO_SESSION_ID": "sess_...",
      "MAESTRO_MANIFEST_PATH": "/path/to/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000",
      "MAESTRO_STRATEGY": "simple"
    },
    "manifest": { ... },
    "projectId": "proj_...",
    "taskIds": ["task_..."],
    "spawnSource": "ui",
    "parentSessionId": null,
    "_isSpawnCreated": true
  }
  ```
- `task:session_added` - For each task: `{ taskId, sessionId }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `missing_project_id` | "projectId is required" | Missing `projectId` |
| 400 | `invalid_task_ids` | "taskIds must be a non-empty array" | Invalid `taskIds` |
| 400 | `invalid_spawn_source` | "spawnSource must be 'ui' or 'session'" | Invalid `spawnSource` |
| 400 | `missing_session_id` | "sessionId is required when spawnSource is 'session'" | Missing parent `sessionId` |
| 400 | `invalid_role` | "role must be 'worker' or 'orchestrator'" | Invalid `role` |
| 400 | `invalid_strategy` | "strategy must be 'simple', 'queue', or 'tree'" | Invalid `strategy` |
| 404 | `task_not_found` | "Task {taskId} not found" | Task doesn't exist |
| 404 | `project_not_found` | "Project {projectId} not found" | Project doesn't exist |
| 404 | `parent_session_not_found` | "Parent session {sessionId} not found" | Parent session doesn't exist |
| 500 | `manifest_generation_failed` | "Failed to generate manifest: {error}" | CLI error |
| 500 | `spawn_error` | Error message | Server error |

---

### Add Task to Session

**Endpoint:** `POST /api/sessions/:id/tasks/:taskId`

**Description:** Associate task with session (many-to-many).

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_1738713800000_a1b2c3d4e/tasks/task_new123
```

**Response:** `200 OK`
```json
{
  "id": "sess_1738713800000_a1b2c3d4e",
  "taskIds": ["task_1738713700000_p9q2r5t8w", "task_new123"]
}
```

**Side Effects:**
- Session's `taskIds` array updated
- Task's `sessionIds` array updated
- Timeline event added to task
- Data saved to disk

**Events Emitted:**
- `session:task_added` - `{ sessionId, taskId }`
- `task:session_added` - `{ taskId, sessionId }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `NOT_FOUND` | "Session not found" or "Task not found" | Entity doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

### Remove Task from Session

**Endpoint:** `DELETE /api/sessions/:id/tasks/:taskId`

**Description:** Disassociate task from session.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_1738713800000_a1b2c3d4e/tasks/task_new123
```

**Response:** `200 OK`
```json
{
  "id": "sess_1738713800000_a1b2c3d4e",
  "taskIds": ["task_1738713700000_p9q2r5t8w"]
}
```

**Side Effects:**
- Session's `taskIds` array updated
- Task's `sessionIds` array updated
- Timeline event added to task
- Data saved to disk

**Events Emitted:**
- `session:task_removed` - `{ sessionId, taskId }`
- `task:session_removed` - `{ taskId, sessionId }`

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `NOT_FOUND` | "Session not found" or "Task not found" | Entity doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Server error |

---

## Skills API

### List Skills

**Endpoint:** `GET /api/skills`

**Description:** List all available skills from `~/.agents-ui/maestro-skills/`.

**Request:**
```bash
curl http://localhost:3000/api/skills
```

**Response:** `200 OK`
```json
[
  {
    "id": "maestro-worker",
    "name": "Maestro Worker",
    "description": "Worker agent for executing tasks",
    "type": "system",
    "version": "1.0.0"
  },
  {
    "id": "maestro-orchestrator",
    "name": "Maestro Orchestrator",
    "description": "Orchestrator agent for coordinating workers",
    "type": "system",
    "version": "1.0.0"
  }
]
```

**Side Effects:**
- None

**Events Emitted:**
- None

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 200 | (none) | `[]` | Skills directory not found or empty |

**Note:** This endpoint never returns errors, only empty array if skills unavailable.

---

### Get Skill by ID

**Endpoint:** `GET /api/skills/:id`

**Description:** Get a single skill by its ID, including instructions content.

**Request:**
```bash
curl http://localhost:3000/api/skills/maestro-worker
```

**Response:** `200 OK`
```json
{
  "id": "maestro-worker",
  "name": "Maestro Worker",
  "description": "Worker agent for executing tasks",
  "type": "role",
  "version": "1.0.0",
  "instructions": "# Maestro Worker\n\nYou are a worker agent..."
}
```

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `NOT_FOUND` | "Skill not found: {id}" | Skill doesn't exist |
| 500 | `INTERNAL_ERROR` | Error message | Load error |

---

### Get Skills by Role

**Endpoint:** `GET /api/skills/role/:role`

**Description:** Get skills assigned to a specific role (worker or orchestrator).

**Request:**
```bash
curl http://localhost:3000/api/skills/role/worker
```

**Response:** `200 OK`
```json
[
  {
    "id": "maestro-cli",
    "name": "Maestro CLI",
    "description": "CLI skill for all roles",
    "type": "system",
    "version": "1.0.0"
  },
  {
    "id": "maestro-worker",
    "name": "Maestro Worker",
    "description": "Worker agent skill",
    "type": "role",
    "version": "1.0.0"
  }
]
```

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "Role must be 'worker' or 'orchestrator'" | Invalid role |

---

### Reload Skill

**Endpoint:** `POST /api/skills/:id/reload`

**Description:** Clear cache and reload a skill from disk. Useful for development/hot-reload.

**Request:**
```bash
curl -X POST http://localhost:3000/api/skills/maestro-worker/reload
```

**Response:** `200 OK`
```json
{
  "id": "maestro-worker",
  "name": "Maestro Worker",
  "description": "Worker agent for executing tasks",
  "type": "role",
  "version": "1.0.0",
  "reloaded": true
}
```

**Errors:**

| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `NOT_FOUND` | "Skill not found: {id}" | Skill doesn't exist |
| 501 | `NOT_IMPLEMENTED` | "Reload not supported" | Loader doesn't support reload |

---

## Queue API

Queue API manages task queues for sessions using the 'queue' strategy. Sessions with queue strategy process tasks in FIFO order.

### Get Queue State

**Endpoint:** `GET /api/sessions/:id/queue`

**Description:** Get complete queue state and statistics for a session.

**Request:**
```bash
curl http://localhost:3000/api/sessions/sess_123/queue
```

**Response:** `200 OK`
```json
{
  "queue": {
    "sessionId": "sess_123",
    "strategy": "queue",
    "items": [...],
    "currentIndex": 0,
    "createdAt": 1738713800000,
    "updatedAt": 1738713900000
  },
  "stats": {
    "total": 5,
    "queued": 3,
    "processing": 1,
    "completed": 1,
    "failed": 0,
    "skipped": 0
  }
}
```

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "Session does not use queue strategy" | Session strategy != 'queue' |
| 404 | `NOT_FOUND` | "Queue not found" | Queue doesn't exist |

---

### Get Top Item

**Endpoint:** `GET /api/sessions/:id/queue/top`

**Description:** Peek at the next queued item without removing it.

**Request:**
```bash
curl http://localhost:3000/api/sessions/sess_123/queue/top
```

**Response (has items):** `200 OK`
```json
{
  "hasMore": true,
  "item": {
    "taskId": "task_456",
    "status": "queued",
    "addedAt": 1738713800000
  }
}
```

**Response (empty):** `200 OK`
```json
{
  "hasMore": false,
  "item": null,
  "message": "Queue is empty - all tasks processed"
}
```

---

### Start Item

**Endpoint:** `POST /api/sessions/:id/queue/start`

**Description:** Start processing the next queued item. Marks it as 'processing'.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/queue/start
```

**Response (started):** `200 OK`
```json
{
  "success": true,
  "item": {
    "taskId": "task_456",
    "status": "processing",
    "addedAt": 1738713800000,
    "startedAt": 1738713900000
  },
  "message": "Started processing task task_456"
}
```

**Response (empty):** `200 OK`
```json
{
  "success": true,
  "item": null,
  "empty": true,
  "message": "Queue is empty — no items to process"
}
```

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "Already processing task X" | Item already in progress |

---

### Complete Item

**Endpoint:** `POST /api/sessions/:id/queue/complete`

**Description:** Mark current processing item as completed.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/queue/complete
```

**Response:** `200 OK`
```json
{
  "success": true,
  "completedItem": {
    "taskId": "task_456",
    "status": "completed",
    "addedAt": 1738713800000,
    "startedAt": 1738713900000,
    "completedAt": 1738714000000
  },
  "nextItem": {
    "taskId": "task_789",
    "status": "queued"
  },
  "hasMore": true,
  "message": "Completed task_456. Next: task_789"
}
```

---

### Fail Item

**Endpoint:** `POST /api/sessions/:id/queue/fail`

**Description:** Mark current processing item as failed with reason.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/queue/fail \
  -H "Content-Type: application/json" \
  -d '{ "reason": "API timeout" }'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "failedItem": {
    "taskId": "task_456",
    "status": "failed",
    "failReason": "API timeout",
    "completedAt": 1738714000000
  },
  "nextItem": {...},
  "hasMore": true,
  "message": "Failed task_456. Next: task_789"
}
```

---

### Skip Item

**Endpoint:** `POST /api/sessions/:id/queue/skip`

**Description:** Skip current or next queued item.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/queue/skip
```

**Response:** Similar to complete/fail with `skippedItem`.

---

### List Items

**Endpoint:** `GET /api/sessions/:id/queue/items`

**Description:** List all items in queue with statistics.

**Response:** `200 OK`
```json
{
  "items": [
    {
      "taskId": "task_123",
      "status": "completed",
      "addedAt": 1738713700000,
      "startedAt": 1738713750000,
      "completedAt": 1738713800000
    },
    {
      "taskId": "task_456",
      "status": "processing",
      "addedAt": 1738713800000,
      "startedAt": 1738713850000
    }
  ],
  "stats": {...}
}
```

---

### Push Item

**Endpoint:** `POST /api/sessions/:id/queue/push`

**Description:** Add a new task to the queue.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sessions/sess_123/queue/push \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "task_999" }'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "item": {
    "taskId": "task_999",
    "status": "queued",
    "addedAt": 1738714000000
  }
}
```

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "taskId is required" | Missing taskId |

---

## Templates API

Templates API manages worker and orchestrator prompt templates.

### List Templates

**Endpoint:** `GET /api/templates`

**Description:** List all templates.

**Response:** `200 OK`
```json
[
  {
    "id": "tmpl_123",
    "name": "Default Worker",
    "role": "worker",
    "content": "You are a worker agent...",
    "isDefault": true,
    "createdAt": 1738713800000,
    "updatedAt": 1738713800000
  }
]
```

---

### Get Template by ID

**Endpoint:** `GET /api/templates/:id`

**Description:** Get specific template.

**Response:** `200 OK` - Full template object.

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 404 | `NOT_FOUND` | "Template not found" | Template doesn't exist |

---

### Get Template by Role

**Endpoint:** `GET /api/templates/role/:role`

**Description:** Get template for specific role (worker or orchestrator).

**Request:**
```bash
curl http://localhost:3000/api/templates/role/worker
```

**Response:** `200 OK` - Template object for that role.

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "Invalid role" | Role not 'worker' or 'orchestrator' |

---

### Create Template

**Endpoint:** `POST /api/templates`

**Description:** Create new template.

**Request:**
```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Worker",
    "role": "worker",
    "content": "Custom prompt..."
  }'
```

**Response:** `201 Created` - Full template object.

**Errors:**
| Status | Code | Message | Condition |
|--------|------|---------|-----------|
| 400 | `VALIDATION_ERROR` | "name, role, and content are required" | Missing fields |
| 400 | `VALIDATION_ERROR` | "Invalid role" | Role not valid |

---

### Update Template

**Endpoint:** `PUT /api/templates/:id`

**Description:** Update template name or content.

**Request:**
```bash
curl -X PUT http://localhost:3000/api/templates/tmpl_123 \
  -H "Content-Type: application/json" \
  -d '{ "content": "Updated prompt..." }'
```

**Response:** `200 OK` - Updated template object.

---

### Reset Template

**Endpoint:** `POST /api/templates/:id/reset`

**Description:** Reset template to default content.

**Response:** `200 OK` - Reset template object.

---

### Delete Template

**Endpoint:** `DELETE /api/templates/:id`

**Description:** Delete template.

**Response:** `200 OK`
```json
{
  "success": true,
  "id": "tmpl_123"
}
```

---

### Get Default Content

**Endpoint:** `GET /api/templates/default/:role`

**Description:** Get default template content for a role without creating template.

**Response:** `200 OK`
```json
{
  "role": "worker",
  "content": "Default worker prompt..."
}
```

---

## Health & Status

### Health Check

**Endpoint:** `GET /health`

**Description:** Server health check.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": 1738713800000,
  "uptime": 3600.5
}
```

**Side Effects:**
- None

**Events Emitted:**
- None

---

### WebSocket Status

**Endpoint:** `GET /ws-status`

**Description:** Get WebSocket server status and connected client information.

**Request:**
```bash
curl http://localhost:3000/ws-status
```

**Response:** `200 OK`
```json
{
  "connectedClients": 2,
  "clients": [
    { "readyState": 1, "readyStateText": "OPEN" },
    { "readyState": 1, "readyStateText": "OPEN" }
  ]
}
```

**Side Effects:**
- None

**Events Emitted:**
- None

---

## Error Handling

### Error Response Schema

All errors follow this format:

```typescript
interface ErrorResponse {
  error: true;
  message: string;      // Human-readable error
  code: string;         // Machine-readable code
  details?: any;        // Optional details
}
```

### HTTP Status Code Mapping

| Status | Usage |
|--------|-------|
| 200 | Success (GET, PATCH, PUT, DELETE) |
| 201 | Resource created (POST) |
| 400 | Validation error, bad request |
| 404 | Resource not found |
| 500 | Internal server error |

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Missing or invalid required fields |
| `PROJECT_NOT_FOUND` | 404 | Project ID doesn't exist |
| `PROJECT_HAS_DEPENDENCIES` | 400 | Cannot delete project with tasks/sessions |
| `TASK_NOT_FOUND` | 404 | Task ID doesn't exist |
| `SESSION_NOT_FOUND` | 404 | Session ID doesn't exist |
| `NOT_FOUND` | 404 | Generic not found (tasks/sessions endpoints) |
| `missing_project_id` | 400 | Spawn: projectId required |
| `invalid_task_ids` | 400 | Spawn: taskIds must be non-empty array |
| `invalid_spawn_source` | 400 | Spawn: invalid spawnSource value |
| `invalid_role` | 400 | Spawn: invalid role value |
| `invalid_strategy` | 400 | Spawn: invalid strategy value |
| `parent_session_not_found` | 404 | Spawn: parent session doesn't exist |
| `task_not_found` | 404 | Spawn: task doesn't exist |
| `project_not_found` | 404 | Spawn: project doesn't exist |
| `manifest_generation_failed` | 500 | Spawn: CLI manifest generation failed |
| `spawn_error` | 500 | Spawn: generic error |
| `INTERNAL_ERROR` | 500 | Generic server error |

---

## Cross-Cutting Concerns

### CORS

CORS is enabled for all origins:

```typescript
app.use(cors());
```

### JSON Body Parsing

All requests automatically parse JSON bodies:

```typescript
app.use(express.json());
```

### Content-Type

- **Request:** Must be `application/json` for POST/PUT/PATCH
- **Response:** Always `application/json`

### Timestamps

All timestamps are Unix milliseconds (JavaScript `Date.now()` format).

### Auto-Set Fields

Certain fields are auto-set by server:

| Field | When | Value |
|-------|------|-------|
| `id` | Create | `makeId(prefix)` |
| `createdAt` | Create | `Date.now()` |
| `updatedAt` | Create, Update | `Date.now()` |
| `startedAt` | Task status → in_progress | `Date.now()` (first time only) |
| `completedAt` | Task status → completed | `Date.now()` (first time only) |
| `lastActivity` | Session update | `Date.now()` |
| `hostname` | Session create | `os.hostname()` |
| `platform` | Session create | `os.platform()` |

---

## Related Specifications

- **02-CORE-CONCEPTS.md** - Entity definitions and relationships
- **04-WEBSOCKET-SPECIFICATION.md** - WebSocket events emitted by API operations
- **05-STORAGE-SPECIFICATION.md** - How data is persisted
- **08-SESSION-SPAWNING-SPECIFICATION.md** - Detailed spawn flow
- **09-ERROR-HANDLING-SPECIFICATION.md** - Complete error catalog
