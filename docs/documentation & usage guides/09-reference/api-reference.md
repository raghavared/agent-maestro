# API reference

> Every Maestro server endpoint with method, path, request/response schemas, and examples.

**Base URL:** `http://localhost:3000/api` (dev) or `http://localhost:2357/api` (prod)

---

## Projects

6 endpoints for managing projects.

### List projects

```
GET /api/projects
```

Returns all projects.

**Response:** `Project[]`

```bash
curl http://localhost:3000/api/projects
```

```json
[
  {
    "id": "proj_1770533548982_3bgizuthk",
    "name": "my-app",
    "workingDir": "/Users/dev/my-app",
    "description": "Main application",
    "isMaster": false,
    "createdAt": 1770533548982,
    "updatedAt": 1770533548982
  }
]
```

---

### Create project

```
POST /api/projects
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name (1–500 chars). |
| `workingDir` | string | Yes | Absolute path to project directory. |
| `description` | string | No | Short description (max 500 chars). |
| `isMaster` | boolean | No | Enable cross-project access. |

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "workingDir": "/Users/dev/my-app"}'
```

**Response:** `201 Created` — the created `Project`.

---

### Get project

```
GET /api/projects/:id
```

**Path params:** `id` — Project ID.

```bash
curl http://localhost:3000/api/projects/proj_1770533548982_3bgizuthk
```

**Response:** `Project`

---

### Update project

```
PUT /api/projects/:id
```

**Path params:** `id` — Project ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Updated name. |
| `workingDir` | string | No | Updated directory path. |
| `description` | string | No | Updated description. |
| `isMaster` | boolean | No | Toggle master status. |

```bash
curl -X PUT http://localhost:3000/api/projects/proj_1770533548982_3bgizuthk \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'
```

**Response:** Updated `Project`.

---

### Delete project

```
DELETE /api/projects/:id
```

**Path params:** `id` — Project ID.

```bash
curl -X DELETE http://localhost:3000/api/projects/proj_1770533548982_3bgizuthk
```

**Response:**

```json
{ "success": true, "id": "proj_1770533548982_3bgizuthk" }
```

---

### Set master status

```
PUT /api/projects/:id/master
```

Toggle whether a project is a master project.

**Path params:** `id` — Project ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isMaster` | boolean | Yes | `true` to enable, `false` to disable. |

```bash
curl -X PUT http://localhost:3000/api/projects/proj_1770533548982_3bgizuthk/master \
  -H "Content-Type: application/json" \
  -d '{"isMaster": true}'
```

**Response:** Updated `Project`.

---

## Tasks

10 endpoints for managing tasks, timeline events, docs, and images.

### List tasks

```
GET /api/tasks
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project. |
| `status` | TaskStatus | Filter by status. |
| `parentId` | string | Filter by parent task. Use `"null"` for root tasks. |

```bash
curl "http://localhost:3000/api/tasks?projectId=proj_abc123&status=todo"
```

**Response:** `Task[]`

---

### Create task

```
POST /api/tasks
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Parent project ID. |
| `title` | string | Yes | Task title (1–500 chars). |
| `description` | string | No | Task description (max 10,000 chars). |
| `priority` | `low` \| `medium` \| `high` | No | Defaults to `medium`. |
| `parentId` | string | No | Parent task ID for subtasks. |
| `initialPrompt` | string | No | Initial prompt for the agent. |
| `skillIds` | string[] | No | Skills to assign. |
| `referenceTaskIds` | string[] | No | Tasks to use as context. |
| `teamMemberId` | string | No | Assigned team member. |
| `teamMemberIds` | string[] | No | Multiple team members. |
| `memberOverrides` | Record | No | Per-member launch overrides. |
| `dangerousMode` | boolean | No | Skip permission checks. |

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "title": "Fix authentication timeout",
    "description": "Users are getting logged out after 5 minutes",
    "priority": "high"
  }'
```

**Response:** `201 Created` — the created `Task`.

---

### Get task

```
GET /api/tasks/:id
```

**Path params:** `id` — Task ID.

```bash
curl http://localhost:3000/api/tasks/task_1772040904192_s2fbh399k
```

**Response:** `Task`

---

### Update task

```
PATCH /api/tasks/:id
```

**Path params:** `id` — Task ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Updated title. |
| `description` | string | No | Updated description. |
| `status` | TaskStatus | No | New status. |
| `priority` | TaskPriority | No | New priority. |
| `sessionStatus` | TaskSessionStatus | No | Per-session status (backward compat). |
| `taskSessionStatuses` | Record | No | Direct map update of per-session statuses. |
| `sessionIds` | string[] | No | Update linked sessions. |
| `skillIds` | string[] | No | Update assigned skills. |
| `referenceTaskIds` | string[] | No | Update reference tasks. |
| `pinned` | boolean | No | Pin/unpin the task. |
| `teamMemberId` | string | No | Update assigned member. |
| `teamMemberIds` | string[] | No | Update multiple members. |
| `dueDate` | string \| null | No | Due date (ISO `YYYY-MM-DD`) or null. |
| `dangerousMode` | boolean | No | Toggle dangerous mode. |
| `updateSource` | `user` \| `session` | No | Who is making the update. |
| `sessionId` | string | No | Session ID (when `updateSource` is `session`). |

```bash
curl -X PATCH http://localhost:3000/api/tasks/task_1772040904192_s2fbh399k \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

**Response:** Updated `Task`.

---

### Delete task

```
DELETE /api/tasks/:id
```

**Path params:** `id` — Task ID.

```bash
curl -X DELETE http://localhost:3000/api/tasks/task_1772040904192_s2fbh399k
```

**Response:**

```json
{ "success": true, "id": "task_1772040904192_s2fbh399k" }
```

---

### Get child tasks

```
GET /api/tasks/:id/children
```

Returns all direct child tasks of a parent task.

**Path params:** `id` — Parent task ID.

```bash
curl http://localhost:3000/api/tasks/task_parent123/children
```

**Response:** `Task[]`

---

### Add timeline event

```
POST /api/tasks/:id/timeline
```

Adds a timeline event to the session working on this task.

**Path params:** `id` — Task ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Event message (1–500 chars). |
| `type` | TimelineEventType | No | Defaults to `progress`. |
| `sessionId` | string | Yes | Session reporting the event. |

```bash
curl -X POST http://localhost:3000/api/tasks/task_abc123/timeline \
  -H "Content-Type: application/json" \
  -d '{"message": "Completed database migration", "type": "milestone", "sessionId": "sess_xyz789"}'
```

**Response:**

```json
{ "success": true, "taskId": "task_abc123", "sessionId": "sess_xyz789", "message": "Completed database migration", "type": "milestone" }
```

---

### Get task docs

```
GET /api/tasks/:id/docs
```

Returns docs aggregated from all sessions working on this task.

**Path params:** `id` — Task ID.

```bash
curl http://localhost:3000/api/tasks/task_abc123/docs
```

**Response:** `DocEntry[]` (each entry includes `sessionId` and `sessionName`).

---

### Add task doc

```
POST /api/tasks/:id/docs
```

Adds a document to a task via its session.

**Path params:** `id` — Task ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Document title. |
| `filePath` | string | Yes | Path to the document file. |
| `content` | string | No | Inline markdown content (max 100KB). |
| `sessionId` | string | Yes | Session adding the doc. |

```bash
curl -X POST http://localhost:3000/api/tasks/task_abc123/docs \
  -H "Content-Type: application/json" \
  -d '{"title": "API Design", "filePath": "/docs/api-design.md", "sessionId": "sess_xyz789"}'
```

**Response:** `201 Created`

```json
{ "success": true, "taskId": "task_abc123", "sessionId": "sess_xyz789", "title": "API Design", "filePath": "/docs/api-design.md", "addedAt": 1772040904192 }
```

---

### Upload task image

```
POST /api/tasks/:id/images
```

Upload a base64-encoded image to a task.

**Path params:** `id` — Task ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Original filename. |
| `data` | string | Yes | Base64-encoded image data. |
| `mimeType` | string | Yes | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, or `image/svg+xml`. |

```bash
curl -X POST http://localhost:3000/api/tasks/task_abc123/images \
  -H "Content-Type: application/json" \
  -d '{"filename": "screenshot.png", "data": "iVBORw0KGgo...", "mimeType": "image/png"}'
```

**Response:** `201 Created` — `TaskImage` object.

```json
{ "id": "img_1772040904192_abc123def", "filename": "screenshot.png", "mimeType": "image/png", "size": 45678, "addedAt": 1772040904192 }
```

---

### Get task image

```
GET /api/tasks/:id/images/:imageId
```

Serves the image file binary.

**Path params:** `id` — Task ID, `imageId` — Image ID.

```bash
curl http://localhost:3000/api/tasks/task_abc123/images/img_1772040904192_abc123def \
  --output screenshot.png
```

**Response:** Binary image data with appropriate `Content-Type` header.

---

### Delete task image

```
DELETE /api/tasks/:id/images/:imageId
```

**Path params:** `id` — Task ID, `imageId` — Image ID.

```bash
curl -X DELETE http://localhost:3000/api/tasks/task_abc123/images/img_1772040904192_abc123def
```

**Response:**

```json
{ "success": true, "id": "img_1772040904192_abc123def" }
```

---

## Sessions

19 endpoints for managing sessions, events, timeline, docs, modals, tasks, prompts, and log digests.

### List sessions

```
GET /api/sessions
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project. |
| `taskId` | string | Filter by task. |
| `status` | SessionStatus | Filter by status. |
| `active` | `"true"` \| `"false"` | Exclude completed sessions. |
| `parentSessionId` | string | Filter by parent session. |
| `rootSessionId` | string | Filter by root session. |
| `teamSessionId` | string | Filter by team session. |

```bash
curl "http://localhost:3000/api/sessions?projectId=proj_abc123&active=true"
```

**Response:** `Session[]` (enriched with team member snapshots).

---

### Create session

```
POST /api/sessions
```

Creates a session record directly (low-level). For spawning with manifest generation, use `POST /api/sessions/spawn`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `taskIds` | string[] | Yes | Task IDs for this session. |
| `name` | string | No | Session display name. |
| `agentId` | string | No | Agent identifier. |
| `claudeSessionId` | string (UUID) | No | Pre-generated Claude CLI session ID. |
| `status` | SessionStatus | No | Initial status. |
| `env` | Record<string, string> | No | Environment variables. |
| `metadata` | Record | No | Additional metadata. |

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "taskIds": ["task_xyz789"]}'
```

**Response:** `201 Created` — the created `Session`.

---

### Spawn session

```
POST /api/sessions/spawn
```

The primary way to launch a new session. Generates a manifest, creates the session record, and emits a spawn event for the UI to start the PTY.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `taskIds` | string[] | Yes | Task IDs (min 1). |
| `mode` | AgentMode | No | Defaults to `worker`. |
| `spawnSource` | `ui` \| `session` | No | Defaults to `ui`. |
| `sessionId` | string | No | Parent session ID (required when `spawnSource` is `session`). |
| `sessionName` | string | No | Custom session name. |
| `skills` | string[] | No | Skill names to load. |
| `context` | Record | No | Additional context data. |
| `teamMemberId` | string | No | Team member identity (backward compat). |
| `teamMemberIds` | string[] | No | Multiple team member identities. |
| `delegateTeamMemberIds` | string[] | No | Team members for worker delegation (coordinators). |
| `agentTool` | string | No | Override agent tool (`claude-code`, `codex`, `gemini`). |
| `model` | `haiku` \| `sonnet` \| `opus` | No | Override model. |
| `initialDirective` | object | No | `{ subject, message, fromSessionId? }` for coordinated sessions. |
| `memberOverrides` | Record | No | Per-member launch config overrides. |
| `permissionMode` | string | No | Session permission mode. |
| `delegatePermissionMode` | string | No | Permission mode for spawned workers. |

```bash
curl -X POST http://localhost:3000/api/sessions/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "taskIds": ["task_xyz789"],
    "mode": "worker",
    "teamMemberId": "tm_backend_dev",
    "model": "sonnet"
  }'
```

**Response:** `201 Created`

```json
{
  "session": { "id": "sess_1772653083339_mdwh9yerv", "status": "spawning", "..." : "..." },
  "manifest": { "..." : "..." },
  "command": "claude --session-id ... --append-system-prompt ..."
}
```

---

### Get session

```
GET /api/sessions/:id
```

**Path params:** `id` — Session ID.

```bash
curl http://localhost:3000/api/sessions/sess_1772653083339_mdwh9yerv
```

**Response:** `Session` (enriched with team member snapshots).

---

### Update session

```
PATCH /api/sessions/:id
```

**Path params:** `id` — Session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskIds` | string[] | No | Update linked tasks. |
| `status` | SessionStatus | No | Update status. |
| `agentId` | string | No | Update agent ID. |
| `env` | Record<string, string> | No | Update environment variables. |
| `events` | SessionEvent[] | No | Append events. |
| `timeline` | SessionTimelineEvent[] | No | Append timeline events. |
| `needsInput` | object | No | `{ active: boolean, message?: string, since?: number }`. |

```bash
curl -X PATCH http://localhost:3000/api/sessions/sess_abc123 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**Response:** Updated `Session`.

---

### Delete session

```
DELETE /api/sessions/:id
```

**Path params:** `id` — Session ID.

```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_abc123
```

**Response:**

```json
{ "success": true, "id": "sess_abc123" }
```

---

### Add event

```
POST /api/sessions/:id/events
```

Adds a generic event to the session's event log.

**Path params:** `id` — Session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type (max 100 chars). |
| `data` | any | No | Event payload. |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/events \
  -H "Content-Type: application/json" \
  -d '{"type": "tool_call", "data": {"tool": "read_file", "path": "/src/main.ts"}}'
```

**Response:** Updated `Session`.

---

### Add timeline event

```
POST /api/sessions/:id/timeline
```

Adds a structured timeline event.

**Path params:** `id` — Session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Event message. |
| `type` | TimelineEventType | No | Defaults to `progress`. |
| `taskId` | string | No | Related task ID. |
| `metadata` | Record | No | Additional metadata. |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/timeline \
  -H "Content-Type: application/json" \
  -d '{"message": "Refactored auth module", "type": "progress", "taskId": "task_xyz789"}'
```

**Response:** Updated `Session`.

---

### Get session docs

```
GET /api/sessions/:id/docs
```

Returns all docs attached to this session.

**Path params:** `id` — Session ID.

```bash
curl http://localhost:3000/api/sessions/sess_abc123/docs
```

**Response:** `DocEntry[]`

---

### Add session doc

```
POST /api/sessions/:id/docs
```

**Path params:** `id` — Session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Document title. |
| `filePath` | string | Yes | File path. |
| `content` | string | No | Inline markdown content. |
| `taskId` | string | No | Related task ID. |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/docs \
  -H "Content-Type: application/json" \
  -d '{"title": "Implementation Notes", "filePath": "/docs/notes.md"}'
```

**Response:** Updated `Session`.

---

### Add task to session

```
POST /api/sessions/:id/tasks/:taskId
```

Links a task to an existing session.

**Path params:** `id` — Session ID, `taskId` — Task ID.

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/tasks/task_xyz789
```

**Response:** Updated `Session`.

---

### Remove task from session

```
DELETE /api/sessions/:id/tasks/:taskId
```

Unlinks a task from a session.

**Path params:** `id` — Session ID, `taskId` — Task ID.

```bash
curl -X DELETE http://localhost:3000/api/sessions/sess_abc123/tasks/task_xyz789
```

**Response:** Updated `Session`.

---

### Get log digest (single session)

```
GET /api/sessions/:id/log-digest
```

Returns a digest of the session's PTY log.

**Path params:** `id` — Session ID.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `last` | number | `5` | Number of recent entries. |
| `maxLength` | number | — | Max character length of the digest. |

```bash
curl "http://localhost:3000/api/sessions/sess_abc123/log-digest?last=10"
```

**Response:** Log digest object.

---

### Get log digests (multi-session)

```
GET /api/sessions/log-digests
```

Returns digests for multiple sessions. Used by coordinators to read worker logs.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `parentSessionId` | string | Get digests for all child sessions of this parent. |
| `sessionIds` | string | Comma-separated session IDs. |
| `last` | number | Number of recent entries (default `5`). |
| `maxLength` | number | Max character length per digest. |

```bash
curl "http://localhost:3000/api/sessions/log-digests?parentSessionId=sess_coordinator123&last=5"
```

**Response:** Array of log digest objects.

---

### Show modal

```
POST /api/sessions/:id/modal
```

Sends agent-generated HTML content to the UI as a modal dialog.

**Path params:** `id` — Session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modalId` | string | Yes | Unique modal identifier. |
| `html` | string | Yes | HTML content to display. |
| `title` | string | No | Modal title (defaults to "Agent Modal"). |
| `filePath` | string | No | Optional file path reference. |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/modal \
  -H "Content-Type: application/json" \
  -d '{"modalId": "modal_review_1", "title": "Code Review", "html": "<h1>Review Results</h1><p>All tests pass.</p>"}'
```

**Response:**

```json
{ "success": true, "modalId": "modal_review_1", "sessionId": "sess_abc123", "message": "Modal sent to UI" }
```

---

### Modal action

```
POST /api/sessions/:id/modal/:modalId/actions
```

Forwards a user action from a modal back to the agent.

**Path params:** `id` — Session ID, `modalId` — Modal ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | Action identifier (e.g., `"approve"`, `"reject"`). |
| `data` | any | No | Additional action data. |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/modal/modal_review_1/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "data": {"comment": "Looks good"}}'
```

**Response:**

```json
{ "success": true, "modalId": "modal_review_1", "action": "approve" }
```

---

### Close modal

```
POST /api/sessions/:id/modal/:modalId/close
```

Notifies the agent that the user closed a modal.

**Path params:** `id` — Session ID, `modalId` — Modal ID.

```bash
curl -X POST http://localhost:3000/api/sessions/sess_abc123/modal/modal_review_1/close
```

**Response:**

```json
{ "success": true, "modalId": "modal_review_1" }
```

---

### Send prompt to session

```
POST /api/sessions/:id/prompt
```

Sends a text prompt to a session's terminal. Subject to team boundary restrictions — only parent/sibling sessions can communicate.

**Path params:** `id` — Target session ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Prompt text. |
| `senderSessionId` | string | Yes | Sending session ID. |
| `mode` | `send` \| `paste` | No | Delivery mode (defaults to `send`). |

```bash
curl -X POST http://localhost:3000/api/sessions/sess_worker123/prompt \
  -H "Content-Type: application/json" \
  -d '{"content": "Please prioritize the auth fix first", "senderSessionId": "sess_coordinator123", "mode": "send"}'
```

**Response:**

```json
{ "success": true }
```

> **Note:** Returns `403` if the sender is not within the target's team boundary (not a parent, sibling, or direct child).

---

## Task lists

8 endpoints for managing ordered task collections.

### List task lists

```
GET /api/task-lists
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project. |

```bash
curl "http://localhost:3000/api/task-lists?projectId=proj_abc123"
```

**Response:** `TaskList[]`

---

### Create task list

```
POST /api/task-lists
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `name` | string | Yes | List name. |
| `description` | string | No | List description. |
| `orderedTaskIds` | string[] | No | Initial task order. |

```bash
curl -X POST http://localhost:3000/api/task-lists \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "name": "Sprint 1 Backlog", "orderedTaskIds": ["task_1", "task_2"]}'
```

**Response:** `201 Created` — the created `TaskList`.

---

### Get task list

```
GET /api/task-lists/:id
```

**Path params:** `id` — Task list ID.

```bash
curl http://localhost:3000/api/task-lists/tl_abc123
```

**Response:** `TaskList`

---

### Update task list

```
PATCH /api/task-lists/:id
```

**Path params:** `id` — Task list ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Updated name. |
| `description` | string | No | Updated description. |
| `orderedTaskIds` | string[] | No | Updated task order. |

```bash
curl -X PATCH http://localhost:3000/api/task-lists/tl_abc123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint 1 — Updated"}'
```

**Response:** Updated `TaskList`.

---

### Delete task list

```
DELETE /api/task-lists/:id
```

**Path params:** `id` — Task list ID.

```bash
curl -X DELETE http://localhost:3000/api/task-lists/tl_abc123
```

**Response:**

```json
{ "success": true, "id": "tl_abc123" }
```

---

### Add task to list

```
POST /api/task-lists/:id/tasks/:taskId
```

Appends a task to the list.

**Path params:** `id` — Task list ID, `taskId` — Task ID.

```bash
curl -X POST http://localhost:3000/api/task-lists/tl_abc123/tasks/task_xyz789
```

**Response:** Updated `TaskList`.

---

### Remove task from list

```
DELETE /api/task-lists/:id/tasks/:taskId
```

Removes a task from the list.

**Path params:** `id` — Task list ID, `taskId` — Task ID.

```bash
curl -X DELETE http://localhost:3000/api/task-lists/tl_abc123/tasks/task_xyz789
```

**Response:** Updated `TaskList`.

---

### Reorder task list

```
PUT /api/task-lists/:id/reorder
```

Replaces the full task order.

**Path params:** `id` — Task list ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderedTaskIds` | string[] | Yes | New task order. |

```bash
curl -X PUT http://localhost:3000/api/task-lists/tl_abc123/reorder \
  -H "Content-Type: application/json" \
  -d '{"orderedTaskIds": ["task_3", "task_1", "task_2"]}'
```

**Response:** Updated `TaskList`.

---

## Teams

11 endpoints for managing teams, members, and sub-teams.

### List teams

```
GET /api/teams?projectId=:projectId
```

**Query params:** `projectId` (required) — Project ID.

```bash
curl "http://localhost:3000/api/teams?projectId=proj_abc123"
```

**Response:** `Team[]`

---

### Create team

```
POST /api/teams
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `name` | string | Yes | Team name. |
| `description` | string | No | Team description. |
| `avatar` | string | No | Emoji avatar. |
| `leaderId` | string | Yes | Team member ID of the leader. |
| `memberIds` | string[] | Yes | Team member IDs. |
| `subTeamIds` | string[] | No | Sub-team IDs. |
| `parentTeamId` | string | No | Parent team ID. |

```bash
curl -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "name": "Backend Team",
    "leaderId": "tm_coordinator_1",
    "memberIds": ["tm_coordinator_1", "tm_backend_dev", "tm_db_admin"]
  }'
```

**Response:** `201 Created` — the created `Team`.

---

### Get team

```
GET /api/teams/:id?projectId=:projectId
```

**Path params:** `id` — Team ID.
**Query params:** `projectId` (required) — Project ID.

```bash
curl "http://localhost:3000/api/teams/team_abc123?projectId=proj_abc123"
```

**Response:** `Team`

---

### Update team

```
PATCH /api/teams/:id
```

**Path params:** `id` — Team ID.

**Request body:** Must include `projectId`. Any `Team` field can be updated.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `name` | string | No | Updated name. |
| `description` | string | No | Updated description. |
| `avatar` | string | No | Updated avatar. |
| `leaderId` | string | No | New leader. |
| `memberIds` | string[] | No | Replace member list. |
| `status` | `active` \| `archived` | No | Change status. |

```bash
curl -X PATCH http://localhost:3000/api/teams/team_abc123 \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "name": "Backend & API Team"}'
```

**Response:** Updated `Team`.

---

### Delete team

```
DELETE /api/teams/:id?projectId=:projectId
```

Deletes a team. Must be archived first.

**Path params:** `id` — Team ID.
**Query params:** `projectId` (required) — Project ID.

```bash
curl -X DELETE "http://localhost:3000/api/teams/team_abc123?projectId=proj_abc123"
```

**Response:**

```json
{ "success": true, "id": "team_abc123" }
```

---

### Archive team

```
POST /api/teams/:id/archive
```

**Request body:** `{ "projectId": "..." }`

```bash
curl -X POST http://localhost:3000/api/teams/team_abc123/archive \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123"}'
```

**Response:** Updated `Team` with `status: "archived"`.

---

### Unarchive team

```
POST /api/teams/:id/unarchive
```

**Request body:** `{ "projectId": "..." }`

```bash
curl -X POST http://localhost:3000/api/teams/team_abc123/unarchive \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123"}'
```

**Response:** Updated `Team` with `status: "active"`.

---

### Add members to team

```
POST /api/teams/:id/members
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `memberIds` | string[] | Yes | Team member IDs to add. |

```bash
curl -X POST http://localhost:3000/api/teams/team_abc123/members \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "memberIds": ["tm_new_dev"]}'
```

**Response:** Updated `Team`.

---

### Remove members from team

```
DELETE /api/teams/:id/members
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `memberIds` | string[] | Yes | Team member IDs to remove. |

```bash
curl -X DELETE http://localhost:3000/api/teams/team_abc123/members \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "memberIds": ["tm_old_dev"]}'
```

**Response:** Updated `Team`.

---

### Add sub-team

```
POST /api/teams/:id/sub-teams
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `subTeamId` | string | Yes | Sub-team ID to add. |

```bash
curl -X POST http://localhost:3000/api/teams/team_abc123/sub-teams \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "subTeamId": "team_frontend"}'
```

**Response:** Updated `Team`.

---

### Remove sub-team

```
DELETE /api/teams/:id/sub-teams
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `subTeamId` | string | Yes | Sub-team ID to remove. |

```bash
curl -X DELETE http://localhost:3000/api/teams/team_abc123/sub-teams \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "subTeamId": "team_frontend"}'
```

**Response:** Updated `Team`.

---

## Team members

9 endpoints for managing agent profiles.

### List team members

```
GET /api/team-members?projectId=:projectId
```

**Query params:** `projectId` (required) — Project ID.

```bash
curl "http://localhost:3000/api/team-members?projectId=proj_abc123"
```

**Response:** `TeamMember[]` (includes both default and custom members).

---

### Create team member

```
POST /api/team-members
```

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `name` | string | Yes | Display name. |
| `role` | string | Yes | Role description. |
| `avatar` | string | Yes | Emoji avatar. |
| `identity` | string | No | Persona/identity prompt. |
| `model` | string | No | `haiku`, `sonnet`, or `opus`. |
| `agentTool` | string | No | `claude-code`, `codex`, or `gemini`. |
| `mode` | AgentMode | No | Agent mode. |
| `permissionMode` | string | No | Permission mode. |
| `skillIds` | string[] | No | Assigned skills. |
| `capabilities` | object | No | `{ can_spawn_sessions?, can_edit_tasks?, can_report_task_level?, can_report_session_level? }` |
| `commandPermissions` | object | No | `{ groups?: {}, commands?: {} }` |
| `workflowTemplateId` | string | No | Built-in workflow template. |
| `customWorkflow` | string | No | Custom workflow text. |
| `soundInstrument` | string | No | Sound identity instrument. |

```bash
curl -X POST http://localhost:3000/api/team-members \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_abc123",
    "name": "Backend Dev",
    "role": "Backend API developer",
    "avatar": "🔧",
    "model": "sonnet",
    "agentTool": "claude-code",
    "mode": "worker"
  }'
```

**Response:** `201 Created` — the created `TeamMember`.

---

### Get team member

```
GET /api/team-members/:id?projectId=:projectId
```

**Path params:** `id` — Team member ID.
**Query params:** `projectId` (required) — Project ID.

```bash
curl "http://localhost:3000/api/team-members/tm_backend_dev?projectId=proj_abc123"
```

**Response:** `TeamMember`

---

### Update team member

```
PATCH /api/team-members/:id
```

**Path params:** `id` — Team member ID.

**Request body:** Must include `projectId`. Any `TeamMember` field can be updated.

```bash
curl -X PATCH http://localhost:3000/api/team-members/tm_backend_dev \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "model": "opus"}'
```

**Response:** Updated `TeamMember`.

---

### Delete team member

```
DELETE /api/team-members/:id?projectId=:projectId
```

Deletes a team member. Returns `403` for default members and `400` if not archived.

**Path params:** `id` — Team member ID.
**Query params:** `projectId` (required) — Project ID.

```bash
curl -X DELETE "http://localhost:3000/api/team-members/tm_backend_dev?projectId=proj_abc123"
```

**Response:**

```json
{ "success": true, "id": "tm_backend_dev" }
```

---

### Archive team member

```
POST /api/team-members/:id/archive
```

**Request body:** `{ "projectId": "..." }`

```bash
curl -X POST http://localhost:3000/api/team-members/tm_backend_dev/archive \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123"}'
```

**Response:** Updated `TeamMember` with `status: "archived"`.

---

### Unarchive team member

```
POST /api/team-members/:id/unarchive
```

**Request body:** `{ "projectId": "..." }`

```bash
curl -X POST http://localhost:3000/api/team-members/tm_backend_dev/unarchive \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123"}'
```

**Response:** Updated `TeamMember` with `status: "active"`.

---

### Append memory

```
POST /api/team-members/:id/memory
```

Adds entries to a team member's persistent memory.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID. |
| `entries` | string[] | Yes | Memory entries to append. |

```bash
curl -X POST http://localhost:3000/api/team-members/tm_backend_dev/memory \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123", "entries": ["Prefers PostgreSQL over MySQL", "Uses snake_case for API fields"]}'
```

**Response:** Updated `TeamMember`.

---

### Reset default member

```
POST /api/team-members/:id/reset
```

Resets a default team member to its original code-defined values. Returns `404` if the member is not a default.

**Request body:** `{ "projectId": "..." }`

```bash
curl -X POST http://localhost:3000/api/team-members/tm_default_worker/reset \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj_abc123"}'
```

**Response:** Reset `TeamMember`.

---

## Skills

4 endpoints for listing and inspecting skills.

### List skills

```
GET /api/skills
```

Returns all available skills with metadata.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectPath` | string | Project directory for project-scoped skills. |

```bash
curl "http://localhost:3000/api/skills?projectPath=/Users/dev/my-app"
```

**Response:** Array of skill objects with `id`, `name`, `description`, `version`, `triggers`, `content`, and scope info.

---

### Get skill

```
GET /api/skills/:id
```

**Path params:** `id` — Skill name.

```bash
curl http://localhost:3000/api/skills/nodejs-backend-patterns
```

**Response:**

```json
{
  "id": "nodejs-backend-patterns",
  "name": "nodejs-backend-patterns",
  "description": "Build production-ready Node.js backend services",
  "type": "system",
  "version": "1.0.0",
  "instructions": "..."
}
```

---

### List skills by mode

```
GET /api/skills/mode/:mode
```

Returns skills applicable to a specific agent mode.

**Path params:** `mode` — `worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator`, `execute`, or `coordinate`.

```bash
curl http://localhost:3000/api/skills/mode/worker
```

**Response:** Array of skill summary objects.

---

### Reload skill

```
POST /api/skills/:id/reload
```

Clears cache and reloads a skill from disk.

**Path params:** `id` — Skill name.

```bash
curl -X POST http://localhost:3000/api/skills/nodejs-backend-patterns/reload
```

**Response:**

```json
{
  "id": "nodejs-backend-patterns",
  "name": "nodejs-backend-patterns",
  "description": "Build production-ready Node.js backend services",
  "type": "system",
  "version": "1.0.0",
  "reloaded": true
}
```

---

## Ordering

2 endpoints for managing UI display order.

### Get ordering

```
GET /api/ordering/:entityType/:projectId
```

**Path params:**
- `entityType` — `task`, `session`, or `task-list`.
- `projectId` — Project ID.

```bash
curl http://localhost:3000/api/ordering/task/proj_abc123
```

**Response:**

```json
{
  "projectId": "proj_abc123",
  "entityType": "task",
  "orderedIds": ["task_3", "task_1", "task_2"],
  "updatedAt": 1772040904192
}
```

---

### Save ordering

```
PUT /api/ordering/:entityType/:projectId
```

**Path params:**
- `entityType` — `task`, `session`, or `task-list`.
- `projectId` — Project ID.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderedIds` | string[] | Yes | Ordered array of entity IDs. |

```bash
curl -X PUT http://localhost:3000/api/ordering/task/proj_abc123 \
  -H "Content-Type: application/json" \
  -d '{"orderedIds": ["task_3", "task_1", "task_2"]}'
```

**Response:** `Ordering` object.

---

## Master

4 endpoints for cross-project queries. All require a valid master session via `X-Session-Id` header or `sessionId` query param.

> **Note:** Returns `403` if the session is not a master session.

### List all projects

```
GET /api/master/projects
```

**Headers:** `X-Session-Id: <master-session-id>`

```bash
curl http://localhost:3000/api/master/projects \
  -H "X-Session-Id: sess_master_abc123"
```

**Response:** `Project[]`

---

### List all tasks

```
GET /api/master/tasks
```

**Headers:** `X-Session-Id: <master-session-id>`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project (optional). |
| `status` | TaskStatus | Filter by status (optional). |

```bash
curl "http://localhost:3000/api/master/tasks?projectId=proj_abc123" \
  -H "X-Session-Id: sess_master_abc123"
```

**Response:** `Task[]`

---

### List all sessions

```
GET /api/master/sessions
```

**Headers:** `X-Session-Id: <master-session-id>`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project (optional). |

```bash
curl "http://localhost:3000/api/master/sessions" \
  -H "X-Session-Id: sess_master_abc123"
```

**Response:** `Session[]`

---

### Get workspace context

```
GET /api/master/context
```

Returns a full workspace summary: all projects with task and session counts.

**Headers:** `X-Session-Id: <master-session-id>`

```bash
curl http://localhost:3000/api/master/context \
  -H "X-Session-Id: sess_master_abc123"
```

**Response:**

```json
{
  "projects": [ { "id": "proj_abc123", "name": "my-app", "..." : "..." } ],
  "taskCounts": { "proj_abc123": 15 },
  "sessionCounts": { "proj_abc123": 4 }
}
```

---

## Utility

2 health-check endpoints.

### Health check

```
GET /health
```

```bash
curl http://localhost:3000/health
```

**Response:** `200 OK`

---

### WebSocket status

```
GET /ws-status
```

```bash
curl http://localhost:3000/ws-status
```

**Response:** WebSocket connection status.

---

## Error responses

All endpoints return errors in a consistent format:

```json
{
  "error": true,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

Common error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body, params, or query. |
| `NOT_FOUND` | 404 | Entity does not exist. |
| `FORBIDDEN` | 403 | Insufficient permissions (e.g., not a master session). |
| `INTERNAL_ERROR` | 500 | Unexpected server error. |

---

## Data types quick reference

### Project

```typescript
interface Project {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  isMaster?: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Task

```typescript
interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked' | 'archived';
  priority: 'low' | 'medium' | 'high';
  taskSessionStatuses?: Record<string, 'working' | 'blocked' | 'completed' | 'failed' | 'skipped'>;
  sessionIds: string[];
  skillIds: string[];
  dependencies: string[];
  teamMemberId?: string;
  teamMemberIds?: string[];
  referenceTaskIds?: string[];
  pinned?: boolean;
  dueDate: string | null;
  images?: TaskImage[];
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}
```

### Session

```typescript
interface Session {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  status: 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';
  env: Record<string, string>;
  events: SessionEvent[];
  timeline: SessionTimelineEvent[];
  docs: DocEntry[];
  needsInput?: { active: boolean; message?: string; since?: number };
  teamMemberId?: string;
  teamMemberSnapshot?: TeamMemberSnapshot;
  parentSessionId?: string | null;
  rootSessionId?: string | null;
  teamSessionId?: string | null;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
}
```

### TaskList

```typescript
interface TaskList {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  orderedTaskIds: string[];
  createdAt: number;
  updatedAt: number;
}
```

### Team

```typescript
interface Team {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  avatar?: string;
  leaderId: string;
  memberIds: string[];
  subTeamIds: string[];
  parentTeamId?: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

### TeamMember

```typescript
interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  role: string;
  identity?: string;
  avatar: string;
  model?: string;
  agentTool?: 'claude-code' | 'codex' | 'gemini';
  mode?: 'worker' | 'coordinator' | 'coordinated-worker' | 'coordinated-coordinator';
  permissionMode?: 'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions';
  skillIds?: string[];
  isDefault: boolean;
  status: 'active' | 'archived';
  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };
  memory?: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

> **See also:** [Status reference](./status-reference.md) for transition diagrams, [Glossary](./glossary.md) for term definitions, [Configuration reference](./configuration-reference.md) for config files and env vars.
