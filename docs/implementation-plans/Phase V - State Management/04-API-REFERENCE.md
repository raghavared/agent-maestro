# API & WebSocket Reference

## Overview

Complete reference for all Maestro Server REST API endpoints and WebSocket events.

**Base URL:** `http://localhost:3000/api`
**WebSocket URL:** `ws://localhost:3000`

---

## REST API Endpoints

### Tasks

#### `GET /api/tasks`

Get all tasks, optionally filtered by project.

**Query Parameters:**
- `projectId` (optional): Filter tasks by project ID

**Response:**
```json
[
  {
    "id": "task_abc123",
    "projectId": "proj_123",
    "title": "Implement login endpoint",
    "description": "Create REST API endpoint for user login",
    "prompt": "Create a secure login endpoint...",
    "status": "in_progress",
    "priority": "high",
    "sessionIds": ["sess_1", "sess_2"],
    "sessionCount": 2,
    "subtasks": [],
    "createdAt": 1234567890,
    "updatedAt": 1234567891,
    "completedAt": null
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

#### `GET /api/tasks/:id`

Get a single task by ID.

**Response:**
```json
{
  "id": "task_abc123",
  "projectId": "proj_123",
  "title": "Implement login endpoint",
  "status": "in_progress",
  "priority": "high",
  "sessionIds": ["sess_1"],
  "sessionCount": 1,
  ...
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Task not found
- `500 Internal Server Error` - Server error

---

#### `POST /api/tasks`

Create a new task.

**Request Body:**
```json
{
  "projectId": "proj_123",
  "title": "Implement login endpoint",
  "description": "Create REST API endpoint for user login",
  "prompt": "Create a secure login endpoint...",
  "priority": "high"
}
```

**Response:**
```json
{
  "id": "task_abc123",
  "projectId": "proj_123",
  "title": "Implement login endpoint",
  "description": "Create REST API endpoint for user login",
  "prompt": "Create a secure login endpoint...",
  "status": "pending",
  "priority": "high",
  "sessionIds": [],
  "sessionCount": 0,
  "subtasks": [],
  "createdAt": 1234567890,
  "updatedAt": 1234567890,
  "completedAt": null
}
```

**Status Codes:**
- `201 Created` - Task created successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `task:created`

---

#### `PATCH /api/tasks/:id`

Update an existing task.

**Request Body (partial):**
```json
{
  "status": "completed",
  "completedAt": 1234567900
}
```

**Response:**
```json
{
  "id": "task_abc123",
  "status": "completed",
  "completedAt": 1234567900,
  ...
}
```

**Status Codes:**
- `200 OK` - Task updated successfully
- `404 Not Found` - Task not found
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `task:updated`

---

#### `DELETE /api/tasks/:id`

Delete a task and remove it from all sessions.

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200 OK` - Task deleted successfully
- `404 Not Found` - Task not found
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `task:deleted`
- `session:updated` (for each session that had this task)

---

### Sessions

#### `GET /api/sessions`

Get all sessions, optionally filtered by task.

**Query Parameters:**
- `taskId` (optional): Filter sessions that include this task

**Response:**
```json
[
  {
    "id": "sess_task_abc123_1234567890",
    "projectId": "proj_123",
    "taskIds": ["task_abc123", "task_def456"],
    "name": "Implement login",
    "agentId": "claude",
    "env": {
      "MAESTRO_PROJECT_ID": "proj_123",
      "MAESTRO_TASK_IDS": "task_abc123,task_def456",
      "MAESTRO_SESSION_ID": "sess_task_abc123_1234567890"
    },
    "status": "running",
    "startedAt": 1234567890,
    "lastActivity": 1234567895,
    "completedAt": null
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

#### `GET /api/sessions/:id`

Get a single session by ID.

**Response:**
```json
{
  "id": "sess_task_abc123_1234567890",
  "projectId": "proj_123",
  "taskIds": ["task_abc123"],
  "name": "Implement login",
  "status": "running",
  ...
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Server error

---

#### `POST /api/sessions`

Create a new session linked to one or more tasks.

**Request Body:**
```json
{
  "id": "sess_task_abc123_1234567890",
  "projectId": "proj_123",
  "taskIds": ["task_abc123"],
  "name": "Implement login",
  "agentId": "claude"
}
```

**Response:**
```json
{
  "id": "sess_task_abc123_1234567890",
  "projectId": "proj_123",
  "taskIds": ["task_abc123"],
  "name": "Implement login",
  "agentId": "claude",
  "env": {
    "MAESTRO_PROJECT_ID": "proj_123",
    "MAESTRO_TASK_IDS": "task_abc123",
    "MAESTRO_SESSION_ID": "sess_task_abc123_1234567890",
    "MAESTRO_API_URL": "http://localhost:3000/api"
  },
  "status": "running",
  "startedAt": 1234567890,
  "lastActivity": 1234567890,
  "completedAt": null
}
```

**Status Codes:**
- `201 Created` - Session created successfully
- `400 Bad Request` - Invalid request body or task not found
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `session:created`
- `task:updated` (for each task in taskIds)
- `session:task_added` (for each task in taskIds)

---

#### `PATCH /api/sessions/:id`

Update an existing session.

**Request Body (partial):**
```json
{
  "status": "completed",
  "completedAt": 1234567900
}
```

**Response:**
```json
{
  "id": "sess_task_abc123_1234567890",
  "status": "completed",
  "completedAt": 1234567900,
  ...
}
```

**Status Codes:**
- `200 OK` - Session updated successfully
- `404 Not Found` - Session not found
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `session:updated`

---

#### `DELETE /api/sessions/:id`

Delete a session and remove all task associations.

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200 OK` - Session deleted successfully
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `session:deleted`
- `task:updated` (for each task that was linked)
- `session:task_removed` (for each task that was linked)

---

### Task-Session Relationships

#### `POST /api/sessions/:sessionId/tasks/:taskId`

Add a task to an existing session.

**Response:**
```json
{
  "id": "sess_...",
  "taskIds": ["task_abc123", "task_def456"],
  ...
}
```

**Status Codes:**
- `200 OK` - Task added to session successfully
- `404 Not Found` - Session or task not found
- `409 Conflict` - Task already in session
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `session:updated`
- `task:updated`
- `session:task_added`
- `task:session_added`

---

#### `DELETE /api/sessions/:sessionId/tasks/:taskId`

Remove a task from an existing session.

**Response:**
```json
{
  "id": "sess_...",
  "taskIds": ["task_abc123"],
  ...
}
```

**Status Codes:**
- `200 OK` - Task removed from session successfully
- `404 Not Found` - Session or task not found
- `500 Internal Server Error` - Server error

**WebSocket Events Triggered:**
- `session:updated`
- `task:updated`
- `session:task_removed`
- `task:session_removed`

---

### Projects

#### `GET /api/projects`

Get all projects.

**Response:**
```json
[
  {
    "id": "proj_123",
    "name": "My Project",
    "basePath": "/Users/user/projects/my-project",
    "createdAt": 1234567890
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Server error

---

#### `GET /api/projects/:id`

Get a single project by ID.

**Response:**
```json
{
  "id": "proj_123",
  "name": "My Project",
  "basePath": "/Users/user/projects/my-project",
  "createdAt": 1234567890
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Project not found
- `500 Internal Server Error` - Server error

---

#### `POST /api/projects`

Create a new project.

**Request Body:**
```json
{
  "name": "My Project"
}
```

**Response:**
```json
{
  "id": "proj_123",
  "name": "My Project",
  "basePath": null,
  "createdAt": 1234567890
}
```

**Status Codes:**
- `201 Created` - Project created successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Server error

---

## WebSocket Events

### Connection

#### Connect

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Connected to Maestro server');
};
```

#### Disconnect

```javascript
ws.onclose = () => {
  console.log('Disconnected from Maestro server');
  // Implement reconnection logic with exponential backoff
};
```

#### Message Format

All messages follow this structure:

```json
{
  "event": "event:type",
  "data": { /* event-specific data */ }
}
```

---

### Task Events

#### `task:created`

Emitted when a new task is created.

**Data:**
```json
{
  "event": "task:created",
  "data": {
    "id": "task_abc123",
    "projectId": "proj_123",
    "title": "Implement login",
    "status": "pending",
    "priority": "high",
    "sessionIds": [],
    "sessionCount": 0,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

**Triggered By:**
- `POST /api/tasks`

**UI Actions:**
- MaestroPanel: Add task to list (if matching project)

---

#### `task:updated`

Emitted when a task is updated.

**Data:**
```json
{
  "event": "task:updated",
  "data": {
    "id": "task_abc123",
    "status": "completed",
    "sessionCount": 1,
    "sessionIds": ["sess_1"],
    "completedAt": 1234567900,
    "updatedAt": 1234567900
  }
}
```

**Triggered By:**
- `PATCH /api/tasks/:id`
- `POST /api/sessions` (updates sessionCount)
- `DELETE /api/sessions/:id` (updates sessionCount)
- `POST /api/sessions/:sid/tasks/:tid`
- `DELETE /api/sessions/:sid/tasks/:tid`

**UI Actions:**
- MaestroPanel: Update task in list
- SessionsSection: Update task in session cache
- TaskListItem: Update task in UI

---

#### `task:deleted`

Emitted when a task is deleted.

**Data:**
```json
{
  "event": "task:deleted",
  "data": {
    "id": "task_abc123"
  }
}
```

**Triggered By:**
- `DELETE /api/tasks/:id`

**UI Actions:**
- MaestroPanel: Remove task from list
- SessionsSection: Remove task from all session caches
- TaskListItem: N/A (component destroyed)

---

### Session Events

#### `session:created`

Emitted when a new session is created.

**Data:**
```json
{
  "event": "session:created",
  "data": {
    "id": "sess_task_abc123_1234567890",
    "projectId": "proj_123",
    "taskIds": ["task_abc123"],
    "name": "Implement login",
    "agentId": "claude",
    "status": "running",
    "startedAt": 1234567890
  }
}
```

**Triggered By:**
- `POST /api/sessions`

**UI Actions:**
- SessionsSection: May correlate with UI session (via maestroSessionId)
- TaskListItem: May add to session cache if task is expanded

---

#### `session:updated`

Emitted when a session is updated.

**Data:**
```json
{
  "event": "session:updated",
  "data": {
    "id": "sess_task_abc123_1234567890",
    "status": "completed",
    "taskIds": ["task_abc123", "task_def456"],
    "completedAt": 1234567900
  }
}
```

**Triggered By:**
- `PATCH /api/sessions/:id`
- `POST /api/sessions/:sid/tasks/:tid` (updates taskIds)
- `DELETE /api/sessions/:sid/tasks/:tid` (updates taskIds)

**UI Actions:**
- SessionsSection: Update session in cache
- TaskListItem: Update session in cache

---

#### `session:deleted`

Emitted when a session is deleted.

**Data:**
```json
{
  "event": "session:deleted",
  "data": {
    "id": "sess_task_abc123_1234567890"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id`

**UI Actions:**
- SessionsSection: Remove session from cache
- TaskListItem: Remove session from all task caches
- App: Clean up UI session if maestroSessionId matches

---

### Relationship Events

#### `session:task_added`

Emitted when a task is added to a session.

**Data:**
```json
{
  "event": "session:task_added",
  "data": {
    "sessionId": "sess_task_abc123_1234567890",
    "taskId": "task_abc123"
  }
}
```

**Triggered By:**
- `POST /api/sessions` (for each initial task)
- `POST /api/sessions/:sid/tasks/:tid`

**UI Actions:**
- SessionsSection: Add task to session cache (if session expanded)
- TaskListItem: Add session to task cache (if task expanded)

---

#### `session:task_removed`

Emitted when a task is removed from a session.

**Data:**
```json
{
  "event": "session:task_removed",
  "data": {
    "sessionId": "sess_task_abc123_1234567890",
    "taskId": "task_abc123"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id` (for each linked task)
- `DELETE /api/sessions/:sid/tasks/:tid`

**UI Actions:**
- SessionsSection: Remove task from session cache
- TaskListItem: Remove session from task cache

---

#### `task:session_added`

Emitted when a session is associated with a task (mirror of `session:task_added`).

**Data:**
```json
{
  "event": "task:session_added",
  "data": {
    "taskId": "task_abc123",
    "sessionId": "sess_task_abc123_1234567890"
  }
}
```

**Triggered By:**
- `POST /api/sessions`
- `POST /api/sessions/:sid/tasks/:tid`

**UI Actions:**
- TaskListItem: Add session to task cache (if task expanded)

---

#### `task:session_removed`

Emitted when a session is disassociated from a task (mirror of `session:task_removed`).

**Data:**
```json
{
  "event": "task:session_removed",
  "data": {
    "taskId": "task_abc123",
    "sessionId": "sess_task_abc123_1234567890"
  }
}
```

**Triggered By:**
- `DELETE /api/sessions/:id`
- `DELETE /api/sessions/:sid/tasks/:tid`

**UI Actions:**
- TaskListItem: Remove session from task cache

---

## Error Responses

All API errors follow this format:

```json
{
  "error": "Error message here"
}
```

### Common Error Codes

| Status Code | Meaning | Example |
|-------------|---------|---------|
| `400 Bad Request` | Invalid request body or parameters | Missing required field, invalid ID format |
| `404 Not Found` | Resource not found | Task or session doesn't exist |
| `409 Conflict` | Resource conflict | Task already in session |
| `500 Internal Server Error` | Server error | Database error, unexpected exception |

---

## Type Definitions

### Task

```typescript
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  prompt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  sessionIds: string[];
  sessionCount: number;
  subtasks: Subtask[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
```

### Session

```typescript
type Session = {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  lastActivity: number;
  completedAt?: number | null;
};
```

### Subtask

```typescript
type Subtask = {
  id: string;
  taskId: string;
  title: string;
  status: 'pending' | 'completed';
  createdAt: number;
  completedAt: number | null;
};
```

---

## Next: Framework Design

See **[05-FRAMEWORK-DESIGN.md](./05-FRAMEWORK-DESIGN.md)** for a simplified communication framework.
