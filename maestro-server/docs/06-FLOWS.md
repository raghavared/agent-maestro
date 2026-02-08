# Maestro Server - End-to-End Flows

Complete documentation of all major workflows and user journeys through the system.

## Table of Contents

1. [Project Setup Flow](#project-setup-flow)
2. [Task Creation Flow](#task-creation-flow)
3. [Session Spawn Flow](#session-spawn-flow)
4. [Task Execution Flow](#task-execution-flow)
5. [Hierarchical Task Creation Flow](#hierarchical-task-creation-flow)
6. [Session Completion Flow](#session-completion-flow)
7. [Task Status Lifecycle](#task-status-lifecycle)
8. [Bidirectional Relationship Management](#bidirectional-relationship-management)
9. [Error Handling Flows](#error-handling-flows)
10. [Real-time Update Flow](#real-time-update-flow)

---

## Project Setup Flow

**Actor:** User (via UI or API)

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant API
    participant Storage
    participant FileSystem
    participant WebSocket

    User->>UI: Create new project
    UI->>API: POST /api/projects<br/>(name, workingDir, description)
    API->>API: Validate request<br/>(name required)
    API->>Storage: createProject(data)

    Storage->>Storage: Generate ID: proj_<timestamp>_<random>
    Storage->>Storage: Create Project object<br/>with createdAt, updatedAt
    Storage->>Storage: projects.set(id, project)

    Storage->>FileSystem: mkdir ~/.maestro/data/projects
    Storage->>FileSystem: Write project JSON file

    Storage->>Storage: emit('project:created', project)
    Storage-->>API: return project

    API-->>UI: 201 Created<br/>project object
    UI->>UI: Add project to list

    Storage->>WebSocket: on('project:created')
    WebSocket->>WebSocket: broadcast(project:created)
    WebSocket-->>UI: WebSocket message
    UI->>UI: Update other connected clients
```

**Steps:**

1. User provides project name and optional working directory
2. API validates required fields
3. Storage generates unique project ID
4. Project saved to in-memory map
5. Project persisted to disk at `~/.maestro/data/projects/{id}.json`
6. `project:created` event emitted
7. WebSocket broadcasts to all connected clients
8. UI updates to show new project

**Edge Cases:**

- Empty project name → 400 validation error
- Invalid working directory → Accepted (not validated)
- Duplicate project name → Allowed (IDs are unique)

---

## Task Creation Flow

**Actor:** User or CLI

```mermaid
sequenceDiagram
    actor Actor
    participant API
    participant Storage
    participant FileSystem
    participant WebSocket

    Actor->>API: POST /api/tasks<br/>(projectId, title, description, priority)
    API->>API: Validate<br/>(projectId, title required)

    API->>Storage: createTask(payload)

    Storage->>Storage: Generate ID: task_<timestamp>_<random>
    Storage->>Storage: Create Task object with defaults:<br/>- status: 'pending'<br/>- priority: 'medium'<br/>- sessionIds: []<br/>- subtasks: []<br/>- timeline: [created event]

    Storage->>Storage: tasks.set(id, task)

    Storage->>FileSystem: mkdir ~/.maestro/data/tasks/{projectId}
    Storage->>FileSystem: Write task JSON file

    Storage->>Storage: emit('task:created', task)
    Storage-->>API: return task

    API-->>Actor: 201 Created<br/>task object

    Storage->>WebSocket: on('task:created')
    WebSocket->>WebSocket: broadcast(task:created, task)
    WebSocket-->>Actor: WebSocket update
```

**Steps:**

1. Actor provides task details (projectId, title required)
2. API validates payload
3. Storage generates task ID
4. Task initialized with default values:
   - `status: 'pending'`
   - `priority: 'medium'`
   - Empty arrays for sessionIds, subtasks, dependencies
   - Timeline with initial "created" event
5. Task saved to in-memory map and disk
6. Event broadcast to WebSocket clients
7. UI displays new task

**Default Timeline Event:**

```json
{
  "id": "evt_<timestamp>_<random>",
  "type": "created",
  "timestamp": 1706790000000,
  "message": "Task created"
}
```

---

## Session Spawn Flow

**CRITICAL:** This is the core orchestration flow that triggers terminal spawning.

```mermaid
sequenceDiagram
    actor Orchestrator
    participant API
    participant Storage
    participant FileSystem
    participant WebSocket
    participant UI
    participant Terminal
    participant CLI

    Orchestrator->>API: POST /api/sessions/spawn<br/>(projectId, taskIds, skills, context)

    API->>API: Validate:<br/>- projectId required<br/>- taskIds non-empty array<br/>- all tasks exist

    loop For each taskId
        API->>Storage: getTask(taskId)
        Storage-->>API: task object
        API->>API: Verify task exists
    end

    API->>Storage: createSession(<br/>  projectId, taskIds, name,<br/>  status: 'spawning',<br/>  metadata: (skills, spawnedBy, context)<br/>)

    Storage->>Storage: Generate session ID<br/>(or use provided ID)
    Storage->>Storage: Create Session object:<br/>- status: 'spawning'<br/>- hostname, platform<br/>- empty events array

    Storage->>Storage: sessions.set(id, session)
    Storage->>FileSystem: Write session JSON

    loop For each taskId
        Storage->>Storage: getTask(taskId)
        Storage->>Storage: Add session to task.sessionIds
        Storage->>Storage: Append timeline event:<br/>type: 'session_started'
        Storage->>Storage: tasks.set(taskId, updatedTask)
        Storage->>FileSystem: Write updated task JSON
    end

    Storage->>Storage: emit('session:spawn_request',<br/>  session, projectId, taskIds, skillIds<br/>)

    Storage->>Storage: emit('task:session_added')<br/>for each task

    Storage-->>API: return session
    API-->>Orchestrator: 201 Created<br/>(success, sessionId, session)

    Storage->>WebSocket: on('session:spawn_request')
    WebSocket->>WebSocket: broadcast(session:spawn_request)
    WebSocket-->>UI: WebSocket event

    UI->>UI: Receive spawn request
    UI->>Storage: GET /api/projects/{projectId}
    Storage-->>UI: project details (workingDir)

    UI->>Terminal: Spawn new terminal instance<br/>at workingDir with env vars:<br/>- MAESTRO_SESSION_ID<br/>- MAESTRO_PROJECT_ID<br/>- MAESTRO_TASK_IDS<br/>- MAESTRO_SERVER_URL<br/>- MAESTRO_SKILLS

    Terminal->>Terminal: Terminal opens
    Terminal->>CLI: Shell starts
    CLI->>CLI: maestro worker init<br/>(auto-detects env vars)

    CLI->>API: PATCH /api/sessions/(id)<br/>(status: 'running')

    CLI->>CLI: Generate prompt based on:<br/>- tasks<br/>- skills<br/>- context

    CLI->>CLI: Spawn Claude with prompt
    CLI->>CLI: Begin task execution
```

**Key Points:**

1. **Server Does NOT Generate Prompts:** Server only stores data and emits events
2. **UI Spawns Terminal:** UI receives WebSocket event and opens terminal with env vars
3. **CLI Takes Over:** CLI reads env vars, generates prompts, spawns Claude
4. **Session Status:** `spawning` → `running` when CLI connects

**Environment Variables Set by UI:**

```bash
MAESTRO_SESSION_ID=sess_1706792222222_lmn678
MAESTRO_PROJECT_ID=proj_1706789123456_k2j4n5l6m
MAESTRO_TASK_IDS=task_001,task_002
MAESTRO_SERVER_URL=http://localhost:3000
MAESTRO_SKILLS=maestro-worker
```

**Spawn Request Error Codes:**

- `missing_project_id` (400)
- `invalid_task_ids` (400)
- `task_not_found` (404)
- `spawn_error` (500)

---

## Task Execution Flow

**Actor:** Worker Session (CLI + Claude)

```mermaid
sequenceDiagram
    participant CLI
    participant API
    participant Storage
    participant WebSocket
    participant UI

    CLI->>API: PATCH /api/tasks/(id)<br/>(status: 'in_progress')

    API->>Storage: updateTask(id, (status: 'in_progress'))

    Storage->>Storage: Get task from map
    Storage->>Storage: Update status
    Storage->>Storage: Set startedAt = Date.now()
    Storage->>Storage: task.updatedAt = Date.now()

    Storage->>Storage: tasks.set(id, task)
    Storage->>Storage: save() to disk

    Storage->>Storage: emit('task:updated', task)
    Storage-->>API: return updated task

    API-->>CLI: 200 OK

    Storage->>WebSocket: on('task:updated')
    WebSocket-->>UI: broadcast(task:updated)
    UI->>UI: Update task card to show "in progress"

    loop Work on task
        CLI->>CLI: Execute subtasks
        CLI->>API: POST /api/tasks/(id)/timeline<br/>(message: 'Progress update')
        API->>Storage: updateTask with new timeline event
        Storage->>WebSocket: broadcast(task:updated)
        WebSocket-->>UI: Update timeline
    end

    CLI->>API: PATCH /api/tasks/(id)<br/>(status: 'completed')

    API->>Storage: updateTask(id, (status: 'completed'))
    Storage->>Storage: Set completedAt = Date.now()
    Storage->>Storage: emit('task:updated', task)

    WebSocket-->>UI: broadcast(task:updated)
    UI->>UI: Show task as completed
```

**Status Transitions:**

1. **pending → in_progress**
   - Sets `startedAt` timestamp
   - Session begins work

2. **in_progress → completed**
   - Sets `completedAt` timestamp
   - Task finished

3. **in_progress → blocked**
   - Task cannot proceed
   - Blocker must be resolved

**Timeline Updates:**

Workers can add timeline events at any time:

```bash
POST /api/tasks/{id}/timeline
{
  "type": "update",
  "message": "Completed User model implementation"
}
```

---

## Hierarchical Task Creation Flow

**Actor:** User, Orchestrator, or CLI

Tasks support parent-child relationships via the `parentId` field, allowing for recursive task decomposition.

### Create Child Task

```mermaid
sequenceDiagram
    participant Actor
    participant API
    participant Storage
    participant FileSystem
    participant WebSocket
    participant UI

    Actor->>API: POST /api/tasks<br/>(parentId: task-1, title: Create User model)

    API->>API: Validate:<br/>- title required<br/>- projectId required<br/>- parentId exists (if provided)

    API->>Storage: createTask(payload)

    Storage->>Storage: Generate ID: task_<timestamp>_<random>
    Storage->>Storage: Set parentId: task-1
    Storage->>Storage: Create Task with full capabilities:<br/>- status: 'pending'<br/>- sessionIds: []<br/>- timeline: [created event]

    Storage->>Storage: tasks.set(id, task)
    Storage->>FileSystem: Write task JSON file

    Storage->>Storage: emit('task:created', task)
    Storage-->>API: return task

    API-->>Actor: 201 Created (full Task object)

    Storage->>WebSocket: broadcast(task:created)
    WebSocket-->>UI: Task created event
    UI->>UI: Add child task to hierarchy view
```

### Query Child Tasks

```mermaid
sequenceDiagram
    participant Actor
    participant API
    participant Storage

    Actor->>API: GET /api/tasks/task-1/children

    API->>Storage: listTasks(parentId: task-1)
    Storage->>Storage: Filter tasks by parentId
    Storage-->>API: Array of child tasks

    API-->>Actor: 200 OK (child tasks array)
```

**Child Task Benefits:**

- **Full Task Entity**: Child tasks have all properties (status, priority, timeline, dependencies, sessions)
- **Independent Sessions**: Each child can have its own worker sessions
- **Recursive Nesting**: Children can have children (unlimited depth)
- **Independent Lifecycle**: Child status independent of parent status

**Example Hierarchy:**

```
task-1: Implement authentication (parentId: null)
  ├─ task-2: Create User model (parentId: task-1)
  ├─ task-3: Add JWT middleware (parentId: task-1)
  │  ├─ task-4: Write middleware (parentId: task-3)
  │  └─ task-5: Add tests (parentId: task-3)
  └─ task-6: Documentation (parentId: task-1)
```

---

## Session Completion Flow

**Actor:** Worker CLI or Orchestrator

```mermaid
sequenceDiagram
    participant CLI
    participant API
    participant Storage
    participant FileSystem
    participant WebSocket
    participant UI

    CLI->>API: PATCH /api/sessions/(id)<br/>(status: 'completed')

    API->>Storage: updateSession(id, (status: 'completed'))

    Storage->>Storage: Get session from map
    Storage->>Storage: session.status = 'completed'
    Storage->>Storage: session.completedAt = now
    Storage->>Storage: session.lastActivity = now

    Storage->>Storage: sessions.set(id, session)
    Storage->>FileSystem: Write updated session JSON

    Storage->>Storage: emit('session:updated', session)
    Storage-->>API: return session

    API-->>CLI: 200 OK

    Storage->>WebSocket: on('session:updated')
    WebSocket-->>UI: broadcast(session:updated)

    UI->>UI: Update session status badge
    UI->>UI: Gray out session in list
    UI->>UI: Show completion time
```

**Completion Triggers:**

1. **Manual:** Worker calls `maestro session complete`
2. **Automatic:** Worker task finished, CLI exits
3. **Orchestrator:** Marks session complete after validation

**Session Cleanup:**

- Session is NOT deleted (kept for history)
- Tasks retain session ID in their sessionIds array
- Timeline events preserved

---

## Task Status Lifecycle

Complete state machine for task status transitions.

```mermaid
stateDiagram-v2
    [*] --> pending: Task created

    pending --> in_progress: Worker starts task
    pending --> blocked: Blocker found before starting

    in_progress --> completed: Work finished & validated
    in_progress --> blocked: Blocker encountered
    in_progress --> pending: Worker unassigned (rare)

    blocked --> in_progress: Blocker resolved
    blocked --> pending: Worker unassigned

    completed --> [*]: Task done
```

**State Descriptions:**

| Status | Description | Timestamps Set |
|--------|-------------|----------------|
| `pending` | Task created, not yet started | `createdAt` |
| `in_progress` | Work actively happening | `startedAt` (if not set) |
| `blocked` | Cannot proceed due to blocker | None |
| `completed` | Work finished and verified | `completedAt` (if not set) |

**Blocking Scenarios:**

- Missing dependencies
- Unclear requirements
- External service down
- Waiting for user input

**Unblocking:**

1. Orchestrator resolves blocker
2. Task status updated to `in_progress`
3. Worker notified via WebSocket event
4. Worker resumes work

---

## Bidirectional Relationship Management

Phase IV-A: Many-to-many relationships between tasks and sessions.

### Add Task to Session

```mermaid
sequenceDiagram
    participant CLI
    participant API
    participant Storage
    participant WebSocket

    CLI->>API: POST /api/sessions/{sessionId}/tasks/{taskId}

    API->>Storage: addTaskToSession(sessionId, taskId)

    Storage->>Storage: getSession(sessionId)
    Storage->>Storage: getTask(taskId)

    Storage->>Storage: Validate both exist

    alt Task not already in session
        Storage->>Storage: session.taskIds.push(taskId)
        Storage->>Storage: sessions.set(sessionId, session)
    end

    alt Session not already in task
        Storage->>Storage: task.sessionIds.push(sessionId)
        Storage->>Storage: task.timeline.push(<br/>  type: 'session_started',<br/>  sessionId<br/>)
        Storage->>Storage: tasks.set(taskId, task)
    end

    Storage->>Storage: save() to disk

    Storage->>Storage: emit('session:task_added', sessionId, taskId)
    Storage->>Storage: emit('task:session_added', taskId, sessionId)

    Storage-->>API: return session
    API-->>CLI: 200 OK (session)

    Storage->>WebSocket: broadcast both events
```

### Remove Task from Session

```mermaid
sequenceDiagram
    participant CLI
    participant API
    participant Storage
    participant WebSocket

    CLI->>API: DELETE /api/sessions/{sessionId}/tasks/{taskId}

    API->>Storage: removeTaskFromSession(sessionId, taskId)

    Storage->>Storage: getSession(sessionId)
    Storage->>Storage: getTask(taskId)

    Storage->>Storage: Validate both exist

    Storage->>Storage: session.taskIds = filter out taskId
    Storage->>Storage: sessions.set(sessionId, session)

    Storage->>Storage: task.sessionIds = filter out sessionId
    Storage->>Storage: task.timeline.push(<br/>  type: 'session_ended',<br/>  sessionId<br/>)
    Storage->>Storage: tasks.set(taskId, task)

    Storage->>Storage: save()

    Storage->>Storage: emit('session:task_removed', sessionId, taskId)
    Storage->>Storage: emit('task:session_removed', taskId, sessionId)

    Storage-->>API: return session
    API-->>CLI: 200 OK

    Storage->>WebSocket: broadcast both events
```

**Use Cases:**

1. **Orchestrator reassigns task** from one worker to another
2. **Worker completes task** and is assigned new task
3. **Session context changes** during execution

---

## Error Handling Flows

### Task Not Found

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Storage

    Client->>API: GET /api/tasks/invalid_id

    API->>Storage: getTask('invalid_id')
    Storage-->>API: undefined

    API->>API: Check if task exists
    API-->>Client: 404 Not Found<br/>error: true,<br/>message: 'Task not found',<br/>code: 'TASK_NOT_FOUND'
```

### Project with Dependencies

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Storage

    Client->>API: DELETE /api/projects/proj_123

    API->>Storage: deleteProject('proj_123')

    Storage->>Storage: getProject('proj_123')
    Storage->>Storage: listTasks(projectId: 'proj_123')
    Storage->>Storage: Found 3 tasks

    Storage-->>API: throw Error('Cannot delete project with 3 existing task(s)')

    API-->>Client: 400 Bad Request<br/>error: true,<br/>message: 'Cannot delete project with 3 existing task(s)',<br/>code: 'PROJECT_HAS_DEPENDENCIES'
```

### Spawn with Invalid Task

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Storage

    Client->>API: POST /api/sessions/spawn<br/>(projectId, taskIds: ['invalid'])

    API->>API: Validate taskIds non-empty

    loop For each taskId
        API->>Storage: getTask('invalid')
        Storage-->>API: undefined

        API-->>Client: 404 Not Found<br/>error: true,<br/>code: 'task_not_found',<br/>message: 'Task invalid not found',<br/>details: (taskId: 'invalid')
    end
```

---

## Real-time Update Flow

**Scenario:** Multiple UIs observing same project

```mermaid
sequenceDiagram
    participant Worker
    participant API
    participant Storage
    participant WebSocket
    participant UI1
    participant UI2
    participant UI3

    Worker->>API: PATCH /api/tasks/task_123<br/>(status: 'in_progress')

    API->>Storage: updateTask('task_123', ...)
    Storage->>Storage: Update in memory & disk
    Storage->>Storage: emit('task:updated', task)

    Storage->>WebSocket: on('task:updated')
    WebSocket->>WebSocket: broadcast(task:updated, task)

    par Broadcast to all clients
        WebSocket-->>UI1: WebSocket message
        WebSocket-->>UI2: WebSocket message
        WebSocket-->>UI3: WebSocket message
    end

    UI1->>UI1: Update task card UI
    UI2->>UI2: Update task card UI
    UI3->>UI3: Update task card UI
```

**Benefits:**

- All connected UIs stay in sync
- No polling required
- Instant visual feedback
- Supports collaboration (multiple users)

---

## Orchestrator Workflow

**Complete orchestrator session lifecycle**

```mermaid
flowchart TD
    Start[Orchestrator Session Starts] --> Analyze[Analyze Project & Tasks]

    Analyze --> Decompose{Tasks need<br/>decomposition?}
    Decompose -->|Yes| CreateSubtasks[Create Subtasks<br/>for each task]
    Decompose -->|No| CheckReady

    CreateSubtasks --> CheckReady{Tasks ready<br/>for workers?}

    CheckReady -->|Yes| SpawnWorkers[Spawn Worker Sessions<br/>for each task]
    CheckReady -->|No| WaitRequirements[Wait for clarification]

    SpawnWorkers --> MonitorProgress[Monitor Worker Progress<br/>via WebSocket events]

    MonitorProgress --> CheckStatus{Worker status?}

    CheckStatus -->|In Progress| WaitUpdate[Wait for updates]
    CheckStatus -->|Blocked| UnblockWorker[Resolve blocker<br/>Update task]
    CheckStatus -->|Completed| ValidateWork[Review & validate work]

    WaitUpdate --> MonitorProgress
    UnblockWorker --> MonitorProgress

    ValidateWork --> AllDone{All tasks<br/>complete?}

    AllDone -->|No| CheckReady
    AllDone -->|Yes| CompleteOrchestrator[Mark orchestrator<br/>session complete]

    CompleteOrchestrator --> End[End]
```

**Orchestrator Commands:**

```bash
# Initial analysis
maestro whoami
maestro status
maestro task list

# Task decomposition
maestro task get <id>
maestro subtask create <taskId> "Subtask title"

# Worker delegation
maestro session spawn --task <id> --skill maestro-worker

# Monitoring
maestro task list --status in_progress
maestro session list --status running

# Unblocking
maestro task update <id> --status in_progress
maestro update "Resolved blocker: XYZ"

# Completion
maestro task complete
maestro session complete
```

---

## Summary of Key Flows

| Flow | Trigger | Server Role | CLI Role | UI Role |
|------|---------|-------------|----------|---------|
| **Project Setup** | User | Store & broadcast | - | Create form, display |
| **Task Creation** | User/CLI | Store & broadcast | Generate from user input | Display task card |
| **Session Spawn** | CLI/Orchestrator | Store, emit spawn event | Generate prompts, spawn Claude | Spawn terminal with env |
| **Task Execution** | Worker | Update status, broadcast | Execute work, report progress | Show status updates |
| **Subtask Management** | Worker/Orchestrator | Store subtasks, broadcast | Create/complete subtasks | Display subtask list |
| **Session Completion** | Worker/CLI | Update status, broadcast | Mark complete on exit | Update session badge |
| **Real-time Updates** | Any change | Broadcast WebSocket event | - | React to events |

**Key Principle:** Server is a **dumb data store**. Intelligence lives in the CLI. UI is a **visualization layer**.
