# CLI Commands Reference

## Overview

Complete reference for all Maestro CLI commands. Commands are organized by category with detailed arguments, options, examples, and API interactions.

## Command Structure

```bash
maestro <command> [subcommand] [arguments] [options]
```

## Global Options

Available on all commands:
```bash
--json                  # Output as JSON (useful for scripting)
--debug                 # Enable debug logging
--help                  # Show command help
```

---

## Manifest Commands

### `maestro manifest generate`

**Purpose**: Generate a manifest file for a session (used by server and orchestrator)

**Options**:
```bash
--role <role>              # Required: "worker" | "orchestrator"
--project-id <id>          # Required: Project ID
--task-ids <ids>           # Required: Comma-separated task IDs
                           #   Single task: --task-ids task-1
                           #   Multi-task: --task-ids task-1,task-2,task-3
--skills <skills>          # Optional: Comma-separated skill names
--model <model>            # Optional: sonnet | opus | haiku (default: sonnet)
--permission-mode <mode>   # Optional: acceptEdits | requireApproval (default: acceptEdits)
--api-url <url>            # Required: Maestro server URL
--output <path>            # Required: Path to save manifest
--session-id <id>          # Optional: Custom session ID (generated if not provided)
```

**Example (Single Task)**:
```bash
$ maestro manifest generate \
    --role worker \
    --project-id proj-1 \
    --task-ids task-1 \
    --skills code-visualizer \
    --model sonnet \
    --permission-mode acceptEdits \
    --api-url http://localhost:3000 \
    --output ~/.maestro/sessions/sess-789/manifest.json

✅ Manifest generated: ~/.maestro/sessions/sess-789/manifest.json
   Tasks: 1 (single-task session)
   Skills: 1
   Model: sonnet
```

**Example (Multi-Task)**:
```bash
$ maestro manifest generate \
    --role worker \
    --project-id proj-1 \
    --task-ids task-101,task-102,task-103 \
    --skills code-visualizer,frontend-design \
    --model sonnet \
    --permission-mode acceptEdits \
    --api-url http://localhost:3000 \
    --output ~/.maestro/sessions/sess-789/manifest.json

✅ Manifest generated: ~/.maestro/sessions/sess-789/manifest.json
   Tasks: 3 (multi-task session)
     1. task-101: Implement user registration
     2. task-102: Implement user login
     3. task-103: Implement password reset
   Skills: 2
   Model: sonnet
```

**What It Does**:
1. Fetches full task data from server: `GET /api/tasks/task-1`, etc.
2. Loads appropriate system prompt template (worker/orchestrator)
3. Generates manifest with all required fields
4. Saves manifest to specified path
5. Creates parent directory if needed

**Used By**:
- Server (during spawn API calls)
- Orchestrator (when spawning workers)
- External automation tools

**Exit Codes**:
- `0` - Success
- `1` - Missing required options
- `2` - Invalid task IDs or tasks not found
- `3` - Network error (server unreachable)

---

## Init Commands

### `maestro worker init`

**Purpose**: Initialize a Maestro Worker session from a manifest

**Environment Variables Required**:
```bash
MAESTRO_MANIFEST_PATH=/path/to/manifest.json    # Path to manifest file
MAESTRO_PROJECT_ID=proj-123                     # Project identifier
MAESTRO_SESSION_ID=sess-456                     # Session identifier
MAESTRO_API_URL=http://localhost:3000           # Server URL (optional)
```

**What It Does**:
1. Reads manifest from `MAESTRO_MANIFEST_PATH`
2. Validates manifest schema
3. Loads worker system prompt template
4. Injects task data into template variables
5. Loads standard skills from `manifest.skills[]`
6. Executes SessionStart hook (reports to server)
7. Displays formatted session brief
8. Spawns Claude Code with:
   - Generated system prompt
   - Plugin directories for skills
   - Environment variables preserved
9. Monitors Claude process
10. Executes SessionEnd hook on exit

**Example**:
```bash
# Environment variables set by UI
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-123/manifest.json
export MAESTRO_PROJECT_ID=proj-1
export MAESTRO_SESSION_ID=sess-123
export MAESTRO_API_URL=http://localhost:3000

# Initialize worker
$ maestro worker init

🚀 Maestro Worker Initialization

📄 Reading manifest...
✅ Manifest loaded: Implement user authentication

📝 Generating system prompt...
✅ System prompt generated

🔌 Loading 1 skill(s)...
   • code-visualizer
✅ Loaded 1 skill(s)

Reporting session start...
✅ Session sess-123 created on server

🤖 Spawning Claude Code session...

─────────────────────────────────────────
[Claude session starts here]
```

**Exit Codes**:
- `0` - Success
- `1` - Invalid manifest or missing env vars
- `2` - Skill loading failed (non-fatal)
- `3` - Claude failed to spawn

---

### `maestro orchestrator init`

**Purpose**: Initialize a Maestro Orchestrator session

**Environment Variables Required**: (same as worker init)

**What It Does**:
Similar to `worker init` but:
- Uses orchestrator system prompt template
- Emphasizes task decomposition and worker spawning
- Different workflow instructions

**Example**:
```bash
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-456/manifest.json
export MAESTRO_SESSION_ID=sess-456
export MAESTRO_PROJECT_ID=proj-1

$ maestro orchestrator init

🚀 Maestro Orchestrator Initialization
...
```

---

## Task Commands

### `maestro task create <title>`

**Purpose**: Create a new task in the project

**Arguments**:
- `<title>` - Task title (required)

**Options**:
```bash
--description <text>              # Task description
--acceptance-criteria <criterion> # Can specify multiple times
--technical-notes <notes>         # Implementation notes
--complexity <level>              # low | medium | high
--priority <level>                # low | medium | high | critical
--estimated-hours <hours>         # Estimated hours
--depends-on <taskId>             # Dependency task ID (can specify multiple)
```


**Example**:
```bash
$ maestro task create "Implement user authentication" \
  --description "Add JWT-based authentication with login/logout" \
  --acceptance-criteria "Users can register with email/password" \
  --acceptance-criteria "Login returns JWT token" \
  --technical-notes "Use bcrypt for passwords, jsonwebtoken library" \
  --complexity high \
  --priority high \
  --estimated-hours 8

✅ Task created: task-789
   Title: Implement user authentication
   Priority: high
   Complexity: high
```

**API Call**:
```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication with login/logout",
  "acceptanceCriteria": [
    "Users can register with email/password",
    "Login returns JWT token"
  ],
  "technicalNotes": "Use bcrypt for passwords, jsonwebtoken library",
  "complexity": "high",
  "priority": "high",
  "estimatedHours": 8,
  "dependencies": [],
  "projectId": "proj-1"
}
```

**Returns**:
```json
{
  "id": "task-789",
  "title": "Implement user authentication",
  "status": "pending",
  "priority": "high",
  "createdAt": "2026-02-02T15:30:00Z"
}
```



---

### `maestro task list`

**Purpose**: List all tasks in the project

**Options**:
```bash
--status <status>      # Filter: pending | in_progress | completed | blocked
--priority <priority>  # Filter: low | medium | high | critical
--complexity <level>   # Filter: low | medium | high
--json                 # Output as JSON
```

**Example**:
```bash
$ maestro task list

Tasks (5):
  ID        Title                          Status        Priority  Subtasks
  task-1    Implement authentication       in_progress   high      3/5
  task-2    Add dark mode                  pending       medium    0/2
  task-3    Write documentation            completed     low       4/4
  task-4    Setup CI/CD                    blocked       high      0/0
  task-5    Refactor API                   pending       medium    0/0

$ maestro task list --status in_progress --json
{
  "success": true,
  "data": [
    {
      "id": "task-1",
      "title": "Implement authentication",
      "status": "in_progress",
      "priority": "high",
      "subtasks": [...]
    }
  ]
}
```

**API Call**:
```http
GET /api/tasks?projectId=proj-1&status=in_progress
```

---

### `maestro task get <id>`

**Purpose**: Get detailed information about a task

**Arguments**:
- `<id>` - Task ID (required)

**Options**:
```bash
--json    # Output as JSON
```

**Example**:
```bash
$ maestro task get task-1

Task: task-1
Title: Implement authentication
Status: in_progress
Priority: high
Complexity: high
Created: 2026-02-01 10:30:00
Estimated: 8 hours

Description:
Add JWT-based authentication to the API with login and logout endpoints.

Acceptance Criteria:
  1. Users can register with email/password
  2. Login returns JWT token
  3. Protected routes validate JWT

Technical Notes:
Use bcrypt for passwords, jsonwebtoken library

Subtasks (5):
  1. [✅] Install passport and dependencies
  2. [✅] Create User model
  3. [⬜] Implement registration endpoint
  4. [⬜] Implement login endpoint
  5. [⬜] Add JWT middleware

Dependencies:
  None

Timeline:
  2026-02-01 10:30 - Task created
  2026-02-01 11:00 - Task started (session: sess-1)
  2026-02-01 11:15 - Progress: Installed dependencies
  2026-02-01 11:30 - Subtask completed: Install passport
```

**API Call**:
```http
GET /api/tasks/task-1
```

---

### `maestro task update <id>`

**Purpose**: Update task properties

**Arguments**:
- `<id>` - Task ID (required)

**Options**:
```bash
--title <title>              # New title
--description <text>         # New description
--priority <priority>        # New priority
--complexity <complexity>    # New complexity
--status <status>            # New status
```

**Example**:
```bash
$ maestro task update task-1 \
  --priority critical \
  --title "Implement OAuth authentication"

✅ Task task-1 updated
```

**API Call**:
```http
PATCH /api/tasks/task-1
Content-Type: application/json

{
  "priority": "critical",
  "title": "Implement OAuth authentication"
}
```

---

### `maestro task start <id>`

**Purpose**: Mark task as in progress

**Arguments**:
- `<id>` - Task ID (optional, uses current task from manifest if omitted)

**Example**:
```bash
# From within worker session
$ maestro task start

🚀 Task task-1 started
   Status: pending → in_progress
   Started at: 2026-02-02 15:45:00

# Explicit task ID
$ maestro task start task-2

🚀 Task task-2 started
```

**What It Does**:
1. Updates task status to `in_progress`
2. Sets `startedAt` timestamp
3. Adds timeline entry
4. Broadcasts update via WebSocket

**API Call**:
```http
PATCH /api/tasks/task-1
Content-Type: application/json

{
  "status": "in_progress",
  "startedAt": "2026-02-02T15:45:00Z"
}
```

---

### `maestro task complete <id>`

**Purpose**: Mark task as completed

**Arguments**:
- `<id>` - Task ID (optional, uses current task if omitted)

**Options**:
```bash
--force    # Complete even if subtasks incomplete
```

**Example**:
```bash
$ maestro task complete

⚠️  2 subtasks are incomplete. Complete anyway? (y/N): y

✅ Task task-1 completed
   Duration: 2 hours 15 minutes
   Subtasks completed: 3/5 (forced)
```

**Validation**:
- Checks all subtasks are complete (unless `--force`)
- Warns if dependencies are incomplete

**API Call**:
```http
PATCH /api/tasks/task-1
Content-Type: application/json

{
  "status": "completed",
  "completedAt": "2026-02-02T16:00:00Z"
}
```

---

### `maestro task block <id>`

**Purpose**: Mark task as blocked

**Arguments**:
- `<id>` - Task ID (required)

**Options**:
```bash
--reason <reason>    # Blocking reason (required)
```

**Example**:
```bash
$ maestro task block task-1 --reason "Waiting for API credentials from DevOps"

🚫 Task task-1 blocked
   Reason: Waiting for API credentials from DevOps
   Blocked at: 2026-02-02 15:50:00
```

**What It Does**:
1. Updates status to `blocked`
2. Records blocker reason
3. Adds timeline entry
4. Notifies project members

**API Call**:
```http
PATCH /api/tasks/task-1
Content-Type: application/json

{
  "status": "blocked",
  "blockReason": "Waiting for API credentials from DevOps",
  "blockedAt": "2026-02-02T15:50:00Z"
}
```

---

### `maestro task delete <id>`

**Purpose**: Delete a task

**Arguments**:
- `<id>` - Task ID (required)

**Options**:
```bash
--force    # Delete even if other tasks depend on it
```

**Example**:
```bash
$ maestro task delete task-5

⚠️  This will permanently delete task-5 and all its child tasks.
   Continue? (y/N): y

✅ Task task-5 deleted
```

**API Call**:
```http
DELETE /api/tasks/task-5
```

---

## Hierarchical Task Commands

### `maestro task create <title>` (with --parent option)

**Purpose**: Create a child task under a parent task

**Arguments**:
- `<title>` - Task title (required)

**New Option**:
```bash
--parent <taskId>    # Create as child task of parent
```

**Example**:
```bash
# Create parent task
$ maestro task create "Implement authentication"
✅ Task created: task-1

# Create child tasks
$ maestro task create "Create User model" --parent task-1
✅ Task created: task-2 (child of task-1)

$ maestro task create "Add JWT middleware" --parent task-1
✅ Task created: task-3 (child of task-1)

# Create grandchild task
$ maestro task create "Write middleware tests" --parent task-3
✅ Task created: task-4 (child of task-3)
```

**API Call**:
```http
POST /api/tasks
Content-Type: application/json

{
  "projectId": "proj-1",
  "parentId": "task-1",
  "title": "Create User model",
  "description": "..."
}
```

---

### `maestro task children <taskId>`

**Purpose**: List all child tasks of a parent task

**Arguments**:
- `<taskId>` - Parent task ID (required)

**Options**:
```bash
--recursive    # Include grandchildren, great-grandchildren, etc.
--json         # Output as JSON
```

**Example**:
```bash
$ maestro task children task-1

Child Tasks of task-1 (2):
  ID       Title                 Status        Priority
  task-2   Create User model     completed     medium
  task-3   Add JWT middleware    in_progress   high

$ maestro task children task-1 --recursive

Task Hierarchy:
task-1: Implement authentication
  ├─ task-2: Create User model [✅ completed]
  ├─ task-3: Add JWT middleware [🔄 in_progress]
  │  ├─ task-4: Write middleware [⬜ pending]
  │  └─ task-5: Add tests [⬜ pending]
  └─ task-6: Documentation [⬜ pending]
```

**API Call**:
```http
GET /api/tasks/:id/children
```

---

### `maestro task tree`

**Purpose**: Show hierarchical tree of all project tasks

**Options**:
```bash
--root <taskId>    # Start from specific task
--depth <n>        # Max depth to display
--status <status>  # Filter by status
--json             # Output as JSON
```

**Example**:
```bash
$ maestro task tree

Project Task Tree (proj-1):

task-1: Implement authentication [🔄 in_progress]
  ├─ task-2: Create User model [✅ completed]
  ├─ task-3: Add JWT middleware [🔄 in_progress]
  │  ├─ task-4: Write middleware [⬜ pending]
  │  └─ task-5: Add tests [⬜ pending]
  └─ task-6: Documentation [⬜ pending]

task-7: Add dark mode [⬜ pending]
  ├─ task-8: Theme provider [⬜ pending]
  └─ task-9: UI components [⬜ pending]

task-10: Setup CI/CD [⬜ pending]

$ maestro task tree --status in_progress --depth 2

Active Tasks:
task-1: Implement authentication [🔄 in_progress]
  └─ task-3: Add JWT middleware [🔄 in_progress]
```

**API Calls**:
```http
GET /api/tasks?projectId=proj-1&parentId=null  # Get root tasks
GET /api/tasks/:id/children                    # Get children recursively
```

---

## Session Commands

### `maestro session list`

**Purpose**: List all sessions in the project

**Options**:
```bash
--status <status>    # Filter: running | completed | failed
--task <taskId>      # Filter by task
--json               # Output as JSON
```

**Example**:
```bash
$ maestro session list

Sessions (3):
  ID        Role          Task      Status     Started         Duration
  sess-1    worker        task-1    running    10 minutes ago  -
  sess-2    worker        task-2    completed  1 hour ago      45 min
  sess-3    orchestrator  -         running    2 hours ago     -

$ maestro session list --status running --json
{
  "success": true,
  "data": [
    {
      "id": "sess-1",
      "role": "worker",
      "taskIds": ["task-1"],
      "status": "running",
      "startedAt": "2026-02-02T15:35:00Z"
    }
  ]
}
```

**API Call**:
```http
GET /api/sessions?projectId=proj-1&status=running
```

---

### `maestro session get <id>`

**Purpose**: Get detailed session information

**Arguments**:
- `<id>` - Session ID (required)

**Example**:
```bash
$ maestro session get sess-1

Session: sess-1
Role: worker
Status: running
Tasks: task-1
Model: sonnet
Started: 2026-02-02 15:35:00
Duration: 15 minutes

Manifest:
  Skills: code-visualizer
  Working Directory: /Users/dev/project

Events:
  15:35:00 - Session created
  15:35:05 - Claude spawned
  15:36:00 - Task started
  15:40:00 - Subtask completed: subtask-10
  15:45:00 - Progress update: "Installed dependencies"
```

**API Call**:
```http
GET /api/sessions/sess-1
```

---

### `maestro session spawn` (Orchestrator Command)

**Purpose**: Spawn a new worker session from orchestrator

> **Note**: This command creates a manifest and spawns a worker session. Detailed orchestrator workflows will be documented separately.

**Options**:
```bash
--task <taskId>       # Task to assign (required)
--skills <skills>     # Comma-separated skills (optional)
--model <model>       # Claude model: sonnet | opus | haiku (default: sonnet)
```

**Example**:
```bash
$ maestro session spawn --task task-1 --skills code-visualizer

🚀 Creating worker manifest for task-1...
✅ Manifest created

📡 Spawning worker session...
✅ Session sess-456 created

Waiting for UI to open terminal...
```

**What It Does** (High-Level):
1. Fetches task data
2. Generates worker manifest
3. Saves manifest to `~/.maestro/sessions/{sessionId}/`
4. Calls server spawn API
5. Server broadcasts to UI
6. UI opens terminal with `maestro worker init`

**API Call**:
```http
POST /api/sessions/spawn
Content-Type: application/json

{
  "manifestPath": "~/.maestro/sessions/sess-456/manifest.json",
  "projectId": "proj-1",
  "role": "worker"
}
```

> **Status**: Basic implementation. Full orchestrator spawning workflows to be documented in Phase 2.

---

## Queue Commands

**Available Only**: Queue strategy sessions (`strategy: "queue"` in manifest)

Queue commands provide FIFO (First-In-First-Out) task processing for workers. The server maintains a queue of tasks, and the worker pulls and processes them sequentially.

### `maestro queue top`

**Purpose**: Show the next task in the queue without starting it

**Example**:
```bash
$ maestro queue top

Next Task in Queue:
  ID:     task-456
  Status: pending
  Added:  2026-02-06 14:30:00

Run "maestro queue start" to begin processing this task.
```

**API Call**:
```http
GET /api/sessions/{sessionId}/queue/top
```

**Returns**:
```json
{
  "success": true,
  "hasMore": true,
  "item": {
    "taskId": "task-456",
    "status": "pending",
    "addedAt": "2026-02-06T14:30:00Z"
  }
}
```

---

### `maestro queue start`

**Purpose**: Start processing the next task in the queue

**What It Does**:
1. Dequeues the next task from the server queue
2. Updates task status to `in_progress`
3. Returns task details to the agent
4. Agent begins working on the task

**Example**:
```bash
$ maestro queue start

✅ Task started

  Now Processing: task-456
  Started At:     2026-02-06 14:35:00

  When done, run:
    maestro queue complete  - Mark as completed
    maestro queue fail      - Mark as failed
    maestro queue skip      - Skip this task
```

**API Call**:
```http
POST /api/sessions/{sessionId}/queue/start
```

**Returns**:
```json
{
  "success": true,
  "item": {
    "taskId": "task-456",
    "status": "processing",
    "startedAt": "2026-02-06T14:35:00Z"
  },
  "task": {
    "id": "task-456",
    "title": "Fix login bug",
    "description": "Users cannot login with valid credentials",
    "acceptanceCriteria": ["Login works with valid credentials"]
  }
}
```

---

### `maestro queue complete`

**Purpose**: Mark the current task as completed and move to next

**What It Does**:
1. Updates task status to `completed`
2. Records completion timestamp
3. Allows agent to call `queue start` again for next task

**Example**:
```bash
$ maestro queue complete

✅ Task completed: task-456

Queue Status:
  Completed: 1
  Remaining: 3

Run "maestro queue start" to begin the next task.
```

**API Call**:
```http
POST /api/sessions/{sessionId}/queue/complete
```

**Returns**:
```json
{
  "success": true,
  "completedTask": "task-456",
  "remainingInQueue": 3
}
```

---

### `maestro queue fail`

**Purpose**: Mark the current task as failed and move to next

**Options**:
```bash
--reason <text>    # Reason for failure (optional)
```

**Example**:
```bash
$ maestro queue fail --reason "Missing API credentials"

⚠️  Task failed: task-456
    Reason: Missing API credentials

Queue Status:
  Failed: 1
  Remaining: 3

Run "maestro queue start" to begin the next task.
```

**API Call**:
```http
POST /api/sessions/{sessionId}/queue/fail
Content-Type: application/json

{
  "reason": "Missing API credentials"
}
```

---

### `maestro queue skip`

**Purpose**: Skip the current task without marking it complete or failed

**What It Does**:
1. Moves task back to queue as `pending`
2. Allows agent to move to next task
3. Skipped task can be retried later

**Example**:
```bash
$ maestro queue skip

⏭️  Task skipped: task-456
   (Task returned to queue)

Run "maestro queue start" to begin the next task.
```

**API Call**:
```http
POST /api/sessions/{sessionId}/queue/skip
```

---

### `maestro queue list`

**Purpose**: List all items in the queue

**Options**:
```bash
--json    # Output as JSON
```

**Example**:
```bash
$ maestro queue list

Queue Items (5):

  Status      Task ID    Added At
  ────────────────────────────────────────
  processing  task-456   2026-02-06 14:30
  pending     task-457   2026-02-06 14:31
  pending     task-458   2026-02-06 14:32
  pending     task-459   2026-02-06 14:33
  pending     task-460   2026-02-06 14:34

Current: task-456 (processing)
Remaining: 4
```

**API Call**:
```http
GET /api/sessions/{sessionId}/queue/items
```

**Returns**:
```json
{
  "success": true,
  "items": [
    {
      "taskId": "task-456",
      "status": "processing",
      "addedAt": "2026-02-06T14:30:00Z",
      "startedAt": "2026-02-06T14:35:00Z"
    },
    {
      "taskId": "task-457",
      "status": "pending",
      "addedAt": "2026-02-06T14:31:00Z"
    }
  ],
  "current": "task-456",
  "remaining": 4
}
```

---

### Queue Workflow Example

```bash
# 1. Start a queue-based worker session
$ maestro worker init
   (Manifest has strategy: "queue")

# 2. Check what's in the queue
$ maestro queue list
   Queue Items (3): task-1, task-2, task-3

# 3. Start first task
$ maestro queue start
   ✅ Now processing: task-1

# 4. Work on task, report progress
$ maestro report progress "Fixed the login validation"

# 5. Complete task
$ maestro queue complete
   ✅ Task completed: task-1

# 6. Start next task
$ maestro queue start
   ✅ Now processing: task-2

# 7. Encountered blocker
$ maestro report blocked "Need database credentials"
$ maestro queue skip
   ⏭️  Task skipped: task-2 (returned to queue)

# 8. Start next task
$ maestro queue start
   ✅ Now processing: task-3

# 9. Complete final task
$ maestro queue complete
   ✅ Task completed: task-3

# 10. Check queue status
$ maestro queue top
   Queue is empty - all tasks processed
```

---

## Utility Commands

### `maestro whoami`

**Purpose**: Show current session context

**Example**:
```bash
$ maestro whoami

Session Context:
  Project ID: proj-1
  Session ID: sess-1
  Role: worker
  Manifest: ~/.maestro/sessions/sess-1/manifest.json

Task:
  ID: task-1
  Title: Implement user authentication
  Status: in_progress

Skills:
  • code-visualizer

Server:
  API URL: http://localhost:3000
  Connected: ✅
```

**Uses**: Environment variables only (no API call)

---

## Report Commands

Report commands allow agents to communicate session status. All report commands support an optional `--task` flag:

- **With `--task <ids>`**: Updates `sessionStatus` on specified tasks + posts timeline event per task
- **Without `--task`**: Posts session timeline event only (no task sessionStatus change)
- **Special: `report complete` without `--task`**: Also marks the session as completed

**Note**: Report commands modify `sessionStatus` (the agent's activity state), NOT `status` (the task lifecycle state). Only users and orchestrators can change `task.status`.

### `maestro report progress <message>`

**Purpose**: Report work progress

**Options**:
```bash
--task <ids>    # Comma-separated task IDs to update sessionStatus on
```

**Example**:
```bash
# With task targeting (updates sessionStatus on task)
$ maestro report progress "Completed User model implementation" --task task-1
✅ progress reported

# Without task targeting (session timeline only)
$ maestro report progress "Completed User model implementation"
✅ progress reported
```

**API Calls (with --task)**:
```http
PATCH /api/tasks/{taskId}
{ "sessionStatus": "working", "updateSource": "session", "sessionId": "sess-1" }

POST /api/sessions/sess-1/timeline
{ "type": "progress", "message": "Completed User model...", "taskId": "task-1" }
```

**API Calls (without --task)**:
```http
POST /api/sessions/sess-1/timeline
{ "type": "progress", "message": "Completed User model..." }
```

---

### `maestro report complete <summary>`

**Purpose**: Report task completion (sets sessionStatus to `completed`). Without `--task`, also marks the session as completed.

**Options**:
```bash
--task <ids>    # Comma-separated task IDs to update sessionStatus on
```

**Example**:
```bash
# With task targeting (updates sessionStatus on task)
$ maestro report complete "All acceptance criteria met" --task task-1
✅ complete reported

# Without task targeting (posts timeline + marks session completed)
$ maestro report complete "All work done"
✅ complete reported
```

**API Calls (with --task)**:
```http
PATCH /api/tasks/{taskId}
{ "sessionStatus": "completed", "updateSource": "session", "sessionId": "sess-1" }

POST /api/sessions/sess-1/timeline
{ "type": "task_completed", "message": "All acceptance criteria met...", "taskId": "task-1" }
```

**API Calls (without --task)**:
```http
POST /api/sessions/sess-1/timeline
{ "type": "task_completed", "message": "All work done" }

PATCH /api/sessions/sess-1
{ "status": "completed" }
```

---

### `maestro report blocked <reason>`

**Purpose**: Report a blocker

**Options**:
```bash
--task <ids>    # Comma-separated task IDs to update sessionStatus on
```

**Example**:
```bash
$ maestro report blocked "Need API credentials from DevOps team" --task task-1
✅ blocked reported
```

**API Calls (with --task)**:
```http
PATCH /api/tasks/{taskId}
{ "sessionStatus": "blocked", "updateSource": "session", "sessionId": "sess-1" }

POST /api/sessions/sess-1/timeline
{ "type": "task_blocked", "message": "Need API credentials...", "taskId": "task-1" }
```

---

### `maestro report error <description>`

**Purpose**: Report an error encountered during work

**Options**:
```bash
--task <ids>    # Comma-separated task IDs to update sessionStatus on
```

**Example**:
```bash
$ maestro report error "Tests failing due to missing dependency" --task task-1
✅ error reported
```

**API Calls (with --task)**:
```http
PATCH /api/tasks/{taskId}
{ "sessionStatus": "failed", "updateSource": "session", "sessionId": "sess-1" }

POST /api/sessions/sess-1/timeline
{ "type": "error", "message": "Tests failing...", "taskId": "task-1" }
```

---

### `maestro report needs-input <question>`

**Purpose**: Request user input

**Options**:
```bash
--task <ids>    # Comma-separated task IDs to update sessionStatus on
```

**Example**:
```bash
$ maestro report needs-input "Should I use JWT or session-based authentication?" --task task-1
✅ needs-input reported
```

**API Calls (with --task)**:
```http
PATCH /api/tasks/{taskId}
{ "sessionStatus": "needs_input", "updateSource": "session", "sessionId": "sess-1" }

POST /api/sessions/sess-1/timeline
{ "type": "needs_input", "message": "Should I use JWT or...", "taskId": "task-1" }
```

---

### `maestro status`

**Purpose**: Show project status summary

**Example**:
```bash
$ maestro status

📊 Project Status: proj-1

Tasks: 10 total
  ⏳ Pending: 5
  🔄 In Progress: 3
  🚫 Blocked: 1
  ✅ Completed: 1

Active Sessions: 2
  sess-1 (worker, task-1) - 15 minutes
  sess-3 (orchestrator) - 2 hours

Priority Breakdown:
  🔴 Critical: 1 task
  🟠 High: 4 tasks
  🟡 Medium: 4 tasks
  🟢 Low: 1 task
```

**API Calls**:
```http
GET /api/tasks?projectId=proj-1
GET /api/sessions?projectId=proj-1&status=running
```

---

### `maestro config`

**Purpose**: Manage CLI configuration

**Subcommands**:
```bash
maestro config list               # List all configuration
maestro config get <key>          # Get specific config value
maestro config set <key> <value>  # Set config value
```

**Example**:
```bash
$ maestro config list

Configuration:
  API URL: http://localhost:3000
  Skills Directory: ~/.skills
  Manifest Directory: ~/.maestro/sessions
  Debug: false

$ maestro config set apiUrl https://maestro.example.com
✅ Configuration updated

$ maestro config get apiUrl
https://maestro.example.com
```

**Config File**: `~/.maestro/config.json`

---

### `maestro version`

**Purpose**: Show CLI version information

**Example**:
```bash
$ maestro version

Maestro CLI v1.0.0
Node: v20.10.0
Platform: darwin (arm64)
```

---

## Exit Codes

All commands use standard exit codes:

```bash
0   # Success
1   # General error (invalid arguments, validation failed)
2   # Resource not found (task, session, subtask not found)
3   # Network error (server unreachable, timeout)
4   # Permission denied or authentication failed
5   # Claude Code failed to spawn or crashed
```

**Usage in Scripts**:
```bash
#!/bin/bash

maestro task start task-1
if [ $? -eq 0 ]; then
  echo "Task started successfully"
else
  echo "Failed to start task"
  exit 1
fi
```

---

## JSON Output Format

When using `--json` flag, all commands return:

**Success Response**:
```json
{
  "success": true,
  "data": { /* command-specific data */ }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'task-999' not found",
    "details": {}
  }
}
```

---

## Error Handling

### Helpful Error Messages

```bash
$ maestro task get invalid-id

❌ Error: Task 'invalid-id' not found

Suggestions:
  • Use 'maestro task list' to see available tasks
  • Check if you're in the correct project
  • Verify MAESTRO_PROJECT_ID environment variable
```

### Network Errors

```bash
$ maestro task list

❌ Error: Cannot connect to Maestro server at http://localhost:3000

Possible causes:
  • Server is not running
  • Wrong URL in MAESTRO_API_URL
  • Network connectivity issues

Try:
  • Check server is running: curl http://localhost:3000/health
  • Verify MAESTRO_API_URL environment variable
```

### Validation Errors

```bash
$ maestro task complete task-1

❌ Error: Cannot complete task with incomplete subtasks

Details:
  Incomplete subtasks (2):
    • subtask-12: Implement registration endpoint
    • subtask-13: Implement login endpoint

Options:
  • Complete remaining subtasks first
  • Use --force to complete anyway
```

---

## Summary

Complete CLI command reference with:
- ✅ All commands documented
- ✅ Arguments and options specified
- ✅ Examples provided
- ✅ API calls shown
- ✅ Exit codes defined
- ✅ Error handling documented

Next: See system prompt templates for how these commands are used in agent workflows.
