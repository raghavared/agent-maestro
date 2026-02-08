# Maestro UI Specification

> Complete specification for maestro-ui server integration, state management, session spawning, and real-time event handling.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Models](#2-data-models)
3. [State Management Architecture](#3-state-management-architecture)
4. [REST API Integration](#4-rest-api-integration)
5. [WebSocket Event System](#5-websocket-event-system)
6. [WebSocket Events → UI State Changes](#6-websocket-events--ui-state-changes)
7. [Session Spawning Flows](#7-session-spawning-flows)
8. [Task-Session Relationship Model](#8-task-session-relationship-model)
9. [Tauri Terminal Interface](#9-tauri-terminal-interface)
10. [UI Component Data Flow](#10-ui-component-data-flow)
11. [Error Handling & Recovery](#11-error-handling--recovery)
12. [Dual Status Model](#12-dual-status-model)
13. [Subtask Model & Hierarchy](#13-subtask-model--hierarchy)

---

## 1. Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     MAESTRO UI (React + Tauri)              │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Components   │  │    Hooks     │  │   Services   │     │
│  │  (MaestroPanel│  │ (useTasks,   │  │(maestroService│     │
│  │   TaskListItem│  │  useTask     │  │  MaestroClient│     │
│  │   Sessions)   │  │  Sessions)   │  │)             │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ZUSTAND STORES                          │   │
│  │  useMaestroStore (tasks, sessions, CRUD)            │   │
│  │  useSessionStore (terminal sessions, lifecycle)     │   │
│  │  useProjectStore (projects, active project)         │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────┼──────────────────────────────┐   │
│  │         INTEGRATION LAYER                            │   │
│  │  ┌────────────────┐  │  ┌────────────────┐          │   │
│  │  │  MaestroClient │  │  │ useMaestroWS   │          │   │
│  │  │  (REST API)    │  │  │ (WebSocket)    │          │   │
│  │  └───────┬────────┘  │  └───────┬────────┘          │   │
│  └──────────┼───────────┼──────────┼────────────────────┘   │
│             │           │          │                         │
│  ┌──────────┼───────────┼──────────┼────────────────────┐   │
│  │          │    TAURI BRIDGE       │                    │   │
│  │          │  invoke('create_session', ...)             │   │
│  │          │  invoke('write_to_session', ...)           │   │
│  └──────────┼───────────┼──────────┼────────────────────┘   │
└─────────────┼───────────┼──────────┼────────────────────────┘
              │           │          │
              ▼           │          ▼
┌─────────────────────┐   │   ┌──────────────┐
│   MAESTRO SERVER    │   │   │  TAURI RUST  │
│   (Node.js)         │◄──┘   │  BACKEND     │
│   REST: :3000/api   │       │  (PTY/Term)  │
│   WS:   :3000       │       └──────────────┘
└─────────────────────┘
```

### Design Principles

1. **Separate hook + store**: `useMaestroWebSocket` handles WebSocket connection/reconnection and dispatches events. `useMaestroStore` manages state (tasks/sessions Maps) and provides CRUD actions via `MaestroClient`.
2. **CLI-first architecture**: The server is a thin translation layer over the `maestro` CLI. Write operations go through CLI (write-through), reads come from in-memory cache (1-5ms).
3. **Optimistic updates**: UI updates immediately on user actions, rolls back on server failure. WebSocket events confirm/reconcile final state.
4. **Dual identity for sessions**: Terminal sessions (managed by Tauri/useSessionStore) and Maestro sessions (managed by server/useMaestroStore) are linked via `maestroSessionId`.

---

## 2. Data Models

### 2.1 MaestroTask

```typescript
interface MaestroTask {
  // Core Identity
  id: string;                    // Format: task_{timestamp}_{random}
  projectId: string;             // FK to MaestroProject
  parentId: string | null;       // FK to parent task (for hierarchy)

  // Content
  title: string;
  description: string;
  initialPrompt: string;         // Prompt sent to agent when working on task

  // Status (Dual Model - see Section 12)
  status: TaskStatus;            // Human-controlled source of truth
  agentStatus: AgentStatus | null; // Agent-reported, informational

  // Priority
  priority: TaskPriority;

  // Timestamps
  createdAt: number;             // Unix ms
  updatedAt: number;             // Unix ms
  startedAt: number | null;      // When first session began work
  completedAt: number | null;    // When human marked done

  // Relationships
  sessionIds: string[];          // Maestro session IDs working on this task
  activeSessionId: string | null; // Currently active session
  skillIds: string[];            // Skills loaded for this task
  agentIds: string[];            // Agent IDs that worked on this
  dependencies: string[];        // Task IDs this depends on
  timeline: TimelineEvent[];     // Activity log

  // UI Computed Fields (optional, not from server)
  subtasks?: MaestroTask[];      // Populated from child tasks
  sessionCount?: number;         // Computed from sessions Map
  lastUpdate?: string | null;    // Formatted timestamp
}
```

### 2.2 Status Enums

```typescript
// Human-controlled task status (source of truth)
type TaskStatus =
  | 'todo'               // Not started
  | 'queued'             // Ready for agent pickup
  | 'in_progress'        // Agent working
  | 'blocked'            // Blocked by dependency
  | 'paused'             // Manually paused
  | 'review'             // Agent completed, needs human review
  | 'changes_requested'  // Human reviewed, needs more work
  | 'done'               // Human approved (terminal)
  | 'cancelled'          // Cancelled (terminal)
  | 'wont_do';           // Won't do (terminal)

// Agent-reported status (informational only)
type AgentStatus =
  | 'working'            // Agent actively working
  | 'blocked'            // Agent blocked by external dep
  | 'needs_input'        // Agent needs user input
  | 'completed'          // Agent thinks done (triggers status → review)
  | 'failed';            // Agent encountered fatal error

type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
```

### 2.3 MaestroSession

```typescript
interface MaestroSession {
  id: string;                    // Format: sess_{timestamp}_{random}
  projectId: string;             // FK to MaestroProject
  taskIds: string[];             // Array of task IDs being worked on
  name: string;                  // Human-readable session name
  agentId?: string;              // Agent type (e.g., 'claude')

  // Status
  status: MaestroSessionStatus;

  // Environment
  env: Record<string, string>;   // MAESTRO_* env vars set for this session

  // Timestamps
  startedAt: number;             // Unix ms
  lastActivity: number;          // Unix ms
  completedAt: number | null;    // Unix ms

  // Metadata
  hostname: string;
  platform: string;
  role: 'worker' | 'orchestrator';
  spawnSource: 'ui' | 'session';
  spawnedBy?: string;            // Session ID if spawned by orchestrator
  manifestPath?: string;         // Path to manifest file

  // Activity log
  events: MaestroSessionEvent[];
}

type MaestroSessionStatus =
  | 'spawning'     // Manifest being generated
  | 'running'      // Terminal active, agent working
  | 'completed'    // Agent finished successfully
  | 'failed'       // Agent encountered error
  | 'stopped';     // User stopped session
```

### 2.4 MaestroProject

```typescript
interface MaestroProject {
  id: string;                    // Format: proj_{timestamp}_{random}
  name: string;
  workingDir: string;            // Absolute path to project root
  description?: string;
  createdAt: number;             // Unix ms
  updatedAt: number;             // Unix ms

  // UI-specific fields (not stored on server)
  basePath?: string | null;      // Alias for workingDir in UI context
  environmentId: string | null;  // Link to environment config
  assetsEnabled?: boolean;       // Whether auto-assets are enabled
}
```

### 2.5 TerminalSession (UI-only, Tauri-managed)

```typescript
interface TerminalSession {
  // Core (from Tauri create_session response)
  id: string;                    // Tauri PTY session ID
  name: string;
  command: string;               // Shell command running
  cwd: string | null;            // Current working directory

  // Project linkage
  projectId: string;
  persistId: string;             // Persistent session identifier
  persistent: boolean;

  // Lifecycle
  createdAt: number;
  launchCommand: string | null;  // Command used to start
  restoreCommand?: string | null;
  exited?: boolean;
  closing?: boolean;
  exitCode?: number | null;

  // Agent detection
  effectId?: string | null;      // Process effect ID (e.g., 'claude')
  agentWorking?: boolean;        // Is agent producing output
  processTag?: string | null;

  // SSH
  sshTarget: string | null;
  sshRootDir: string | null;

  // Recording
  lastRecordingId?: string | null;
  recordingActive?: boolean;

  // MAESTRO LINK
  maestroSessionId?: string | null;  // Links to MaestroSession.id
}
```

### 2.6 TimelineEvent

```typescript
interface TimelineEvent {
  id: string;
  type: 'created' | 'session_started' | 'session_ended' | 'update'
      | 'milestone' | 'blocker' | 'progress';
  timestamp: number;
  message?: string;
  sessionId?: string;
}
```

### 2.7 API Payloads

```typescript
// Task CRUD (used for BOTH root tasks and subtasks)
interface CreateTaskPayload {
  projectId: string;
  parentId?: string;            // Set this to create a SUBTASK under a parent task
  title: string;
  description: string;
  priority: TaskPriority;
  initialPrompt?: string;
  skillIds?: string[];
}
// When parentId is set: creates a subtask. The subtask inherits projectId
// and appears under the parent in the task tree. It is a full MaestroTask
// with its own sessions, status, timeline, and subtasks.

interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  agentStatus?: AgentStatus;   // Agent-only field
  priority?: TaskPriority;
  initialPrompt?: string;
  sessionIds?: string[];
  skillIds?: string[];
  agentIds?: string[];
  timeline?: TimelineEvent[];
  completedAt?: number | null;
}

// Session CRUD
interface CreateSessionPayload {
  id?: string;                   // Optional: use provided ID
  projectId: string;
  taskIds: string[];
  name?: string;
  agentId?: string;
}

interface UpdateSessionPayload {
  taskIds?: string[];
  status?: MaestroSessionStatus;
  agentId?: string;
  events?: MaestroSessionEvent[];
  completedAt?: number;
  metadata?: Record<string, any>;  // Merged, not replaced
}

// Session Spawn
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role?: 'worker' | 'orchestrator';
  spawnSource?: 'ui' | 'session';
  sessionName?: string;
  skills?: string[];
  spawnedBy?: string;            // Session ID of orchestrator
  context?: Record<string, any>;
}

interface SpawnSessionResponse {
  success: boolean;
  sessionId: string;
  manifestPath: string;
  session: MaestroSession;
  command?: string;              // CLI command to execute
  cwd?: string;                  // Working directory
  envVars?: Record<string, string>; // Environment variables for terminal
  manifest?: object;             // Generated manifest content
}
```

### 2.8 AgentSkill

```typescript
interface AgentSkill {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'role';
  version: string;
  icon?: string;
}
```

---

## 3. State Management Architecture

### 3.1 Store Topology

```
┌──────────────────────────────────────────────────────────┐
│                    useMaestroStore                        │
│  Zustand store for Maestro server entities               │
│                                                          │
│  State:                                                  │
│    tasks: Map<string, MaestroTask>                       │
│    sessions: Map<string, MaestroSession>                 │
│    loading: Set<string>                                  │
│    errors: Map<string, string>                           │
│    wsConnected: boolean                                  │
│    activeProjectIdRef: string | null                     │
│                                                          │
│  Actions:                                                │
│    fetchTasks(projectId) → GET /api/tasks?projectId=     │
│    fetchTask(taskId) → GET /api/tasks/:id                │
│    fetchSessions(taskId?) → GET /api/sessions?taskId=    │
│    fetchSession(sessionId) → GET /api/sessions/:id       │
│    createTask(data) → POST /api/tasks                    │
│    updateTask(id, updates) → PATCH /api/tasks/:id        │
│    deleteTask(id) → DELETE /api/tasks/:id                │
│    createMaestroSession(data) → POST /api/sessions       │
│    updateMaestroSession(id, updates) → PATCH /sessions   │
│    deleteMaestroSession(id) → DELETE /api/sessions/:id   │
│    addTaskToSession(sid, tid) → POST /sessions/:s/tasks  │
│    removeTaskFromSession(sid, tid) → DELETE              │
│    clearCache() → Reset all Maps                         │
│    hardRefresh(projectId) → clearCache + fetchTasks      │
│    initWebSocket() → Connect singleton WS                │
│    destroyWebSocket() → Close + cleanup                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   useSessionStore                         │
│  Zustand store for Tauri terminal sessions               │
│                                                          │
│  State:                                                  │
│    sessions: TerminalSession[]                           │
│    activeId: string | null                               │
│    hydrated: boolean                                     │
│    newOpen/newName/newCommand/newCwd/...                  │
│    sessionOrderByProject: Record<string, string[]>       │
│                                                          │
│  Key Actions:                                            │
│    onClose(id) → Close terminal + cleanup                │
│    quickStart(preset) → Create terminal with command     │
│    onNewSubmit(e) → Create new terminal session          │
│    handleSpawnTerminalSession(info) → Spawn from         │
│      WebSocket event (Maestro spawn flow)                │
│    handleJumpToSessionFromTask(maestroSessionId) →       │
│      Find & activate terminal by maestroSessionId        │
│    markAgentWorkingFromOutput(id, data) →                │
│      Detect agent activity from terminal output          │
│    onCwdChange(id, cwd) → Track CWD changes             │
│    onCommandChange(id, cmd) → Detect process effects     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   useProjectStore                         │
│  Zustand store for projects                              │
│                                                          │
│  State:                                                  │
│    projects: MaestroProject[]                            │
│    activeProjectId: string                               │
│                                                          │
│  Key Actions:                                            │
│    selectProject(id) → Switch active project             │
│    onProjectSubmit(e) → Create/update project on server  │
│    deleteActiveProject() → Delete + cleanup sessions     │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Derived Hooks (Read-only selectors)

| Hook | Input | Output | Source |
|------|-------|--------|--------|
| `useTasks(projectId)` | project ID | `{ tasks, loading, error }` | Filters `useMaestroStore.tasks` by projectId |
| `useTaskTree(projectId)` | project ID | `{ tree, loading, error }` | Groups tasks by parentId into tree: root tasks with `subtasks[]` children. Recomputes on any task:created/updated/deleted. |
| `useTaskSessions(taskId)` | task ID | `{ sessions, loading, error }` | Filters `useMaestroStore.sessions` where `taskIds.includes(taskId)` |
| `useSessionTasks(sessionId)` | session ID | `{ session, tasks, loading, error }` | Gets session from store, maps `taskIds` to tasks |
| `useTaskSessionCount(taskId)` | task ID | `number` | Counts non-completed sessions containing this task |
| `useTaskBreadcrumb(taskId)` | task ID | `MaestroTask[]` | Walks parentId chain upward, returns `[grandparent, parent]` trail |
| `useSubtaskProgress(parentId)` | parent task ID | `{ total, completed, progress, totalActiveSessions } \| null` | Aggregates child task completion and session counts |
| `useOptimistic(action)` | async action | `{ execute, isPending, error }` | Wraps action with optimistic update + rollback |

### 3.3 Data Flow: Write Operation

```
User clicks "Create Task"
    ↓
MaestroPanel calls createTask(payload)
    ↓
useMaestroStore.createTask → maestroClient.createTask()
    ↓
POST /api/tasks → Server creates task → CLI writes to storage
    ↓
Server cache updated → WebSocket event: task:created
    ↓
useMaestroStore.handleMessage receives event
    ↓
Store updates: tasks.set(task.id, task)
    ↓
React re-renders: useTasks hook returns updated list
    ↓
MaestroPanel re-renders with new task
```

### 3.4 Data Flow: Read Operation

```
User navigates to project
    ↓
useTasks(projectId) hook triggers useEffect
    ↓
useMaestroStore.fetchTasks(projectId) called
    ↓
maestroClient.getTasks(projectId) → GET /api/tasks?projectId=X
    ↓
Server cache returns in 1-5ms (no CLI spawn)
    ↓
Store updates: tasks Map populated
    ↓
useTasks filters tasks by projectId → returns array
    ↓
Component re-renders with tasks
```

---

## 4. REST API Integration

### 4.1 MaestroClient (Singleton)

Base URL: `http://localhost:3000/api`

```typescript
class MaestroClient {
  private baseUrl: string;

  // Generic fetch with error handling
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T>;

  // ── Projects ──
  getProjects(): Promise<MaestroProject[]>;           // GET /projects
  getProject(id: string): Promise<MaestroProject>;    // GET /projects/:id
  createProject(data): Promise<MaestroProject>;       // POST /projects
  updateProject(id, data): Promise<MaestroProject>;   // PUT /projects/:id
  deleteProject(id): Promise<{ success, id }>;        // DELETE /projects/:id

  // ── Tasks ──
  getTasks(projectId?): Promise<MaestroTask[]>;       // GET /tasks?projectId=
  getTask(id): Promise<MaestroTask>;                  // GET /tasks/:id
  createTask(data): Promise<MaestroTask>;             // POST /tasks
  updateTask(id, updates): Promise<MaestroTask>;      // PATCH /tasks/:id
  deleteTask(id): Promise<{ success }>;               // DELETE /tasks/:id

  // ── Sessions ──
  getSessions(taskId?): Promise<MaestroSession[]>;    // GET /sessions?taskId=
  getSession(id): Promise<MaestroSession>;            // GET /sessions/:id
  createSession(data): Promise<MaestroSession>;       // POST /sessions
  updateSession(id, updates): Promise<MaestroSession>;// PATCH /sessions/:id
  deleteSession(id): Promise<{ success }>;            // DELETE /sessions/:id

  // ── Session-Task Relationships ──
  addTaskToSession(sid, tid): Promise<MaestroSession>;    // POST /sessions/:sid/tasks/:tid
  removeTaskFromSession(sid, tid): Promise<MaestroSession>;// DELETE /sessions/:sid/tasks/:tid

  // ── Session Spawning ──
  spawnSession(data: SpawnSessionPayload): Promise<SpawnSessionResponse>;
                                                      // POST /sessions/spawn

  // ── Skills ──
  getSkills(): Promise<AgentSkill[]>;                 // GET /skills
}

export const maestroClient = new MaestroClient();
```

### 4.2 API Endpoint Reference

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/api/projects` | List all projects | - | `MaestroProject[]` |
| GET | `/api/projects/:id` | Get project | - | `MaestroProject` |
| POST | `/api/projects` | Create project | `{ name, workingDir, description? }` | `MaestroProject` |
| PUT | `/api/projects/:id` | Update project | `{ name?, workingDir?, description? }` | `MaestroProject` |
| DELETE | `/api/projects/:id` | Delete project | - | `{ success, id }` |
| GET | `/api/tasks` | List tasks | Query: `?projectId=&status=&parentId=` | `MaestroTask[]` |
| GET | `/api/tasks/:id` | Get task | - | `MaestroTask` |
| POST | `/api/tasks` | Create task | `CreateTaskPayload` | `MaestroTask` |
| PATCH | `/api/tasks/:id` | Update task | `UpdateTaskPayload` | `MaestroTask` |
| DELETE | `/api/tasks/:id` | Delete task | - | `{ success }` |
| GET | `/api/tasks/:id/children` | Get child tasks | - | `MaestroTask[]` |
| POST | `/api/tasks/:id/timeline` | Add timeline event | `{ message, type }` | `TimelineEvent` |
| GET | `/api/sessions` | List sessions | Query: `?projectId=&taskId=&status=` | `MaestroSession[]` |
| GET | `/api/sessions/:id` | Get session | - | `MaestroSession` |
| POST | `/api/sessions` | Create session | `CreateSessionPayload` | `MaestroSession` |
| PATCH | `/api/sessions/:id` | Update session | `UpdateSessionPayload` | `MaestroSession` |
| DELETE | `/api/sessions/:id` | Delete session | - | `{ success }` |
| POST | `/api/sessions/:sid/tasks/:tid` | Add task to session | - | `MaestroSession` |
| DELETE | `/api/sessions/:sid/tasks/:tid` | Remove task from session | - | `MaestroSession` |
| POST | `/api/sessions/spawn` | Spawn session | `SpawnSessionPayload` | `SpawnSessionResponse` |
| GET | `/api/skills` | List skills | - | `AgentSkill[]` |
| GET | `/health` | Health check | - | `{ status, timestamp, uptime }` |

### 4.3 Query Filters

**Tasks**:
- `?projectId=proj_123` - Filter by project
- `?status=pending` - Filter by status (multiple: `?status=in_progress&status=blocked`)
- `?parentId=task_456` - Get children of a task
- `?sort=priority&order=desc` - Sort results

**Sessions**:
- `?projectId=proj_123` - Filter by project
- `?taskId=task_456` - Sessions working on a task
- `?status=running` - Filter by status
- `?active=true` - Only active (non-completed) sessions

---

## 5. WebSocket Event System

### 5.1 Connection Architecture

```typescript
// Connection: ws://localhost:3000 (same host as REST API)

// CANONICAL PATTERN: Separate hook + store
//
// useMaestroWebSocket (hook):
//   - Manages WebSocket singleton (global, shared across instances)
//   - Handles connect/reconnect with exponential backoff
//   - Dispatches parsed events to registered callbacks
//   - Reports connection status
//
// useMaestroStore (store):
//   - Receives events from hook callbacks
//   - Updates tasks/sessions Maps
//   - Triggers downstream re-renders
```

### 5.2 WebSocket Singleton Pattern

```typescript
// Module-level globals (shared across all hook instances)
let globalWs: WebSocket | null = null;
let globalConnecting = false;
let globalListeners: Set<(event: MessageEvent) => void> = new Set();
let globalReconnectTimeout: number | null = null;
let globalReconnectAttempts = 0;

// Reconnection: exponential backoff
// delay = min(1000 * 2^attempts, 30000)
// Attempts: 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s...

// Connection lifecycle:
// 1. First hook instance mounts → creates global WebSocket
// 2. Additional hook instances → register listeners only
// 3. Hook instances unmount → remove their listener
// 4. Last listener removed → close global WebSocket
// 5. On reconnect → auto-refresh active project tasks
```

### 5.3 Event Message Format

```typescript
// All WebSocket messages follow this format:
interface WebSocketMessage {
  event: string;        // Event type (e.g., "task:created")
  data: any;            // Event payload (entity data or relationship info)
}

// Example messages:
{ "event": "task:created", "data": { "id": "task_123", "title": "Fix bug", ... } }
{ "event": "task:updated", "data": { "id": "task_123", "status": "in_progress", ... } }
{ "event": "session:created", "data": { "id": "sess_456", ... } }
```

### 5.4 Complete Event Type Catalog

| Event | Payload | Trigger | Description |
|-------|---------|---------|-------------|
| `task:created` | `MaestroTask` | POST /api/tasks | New task created |
| `task:updated` | `MaestroTask` | PATCH /api/tasks/:id | Task fields changed |
| `task:deleted` | `{ id: string }` | DELETE /api/tasks/:id | Task removed |
| `task:session_added` | `{ taskId, sessionId }` | Session assigned to task | Bidirectional link created |
| `task:session_removed` | `{ taskId, sessionId }` | Session unassigned from task | Bidirectional link removed |
| `session:spawn` | `SpawnData` (session + command + envVars) | POST /api/sessions/spawn | **Triggers terminal creation** in UI |
| `session:created` | `MaestroSession` | POST /api/sessions (direct) | Session record created (no terminal spawn) |
| `session:updated` | `MaestroSession` | PATCH /api/sessions/:id | Session fields changed |
| `session:deleted` | `{ id: string }` | DELETE /api/sessions/:id | Session removed |
| `session:task_added` | `{ sessionId, taskId }` | POST /sessions/:s/tasks/:t | Task added to session |
| `session:task_removed` | `{ sessionId, taskId }` | DELETE /sessions/:s/tasks/:t | Task removed from session |
| `subtask:created` | `{ taskId, subtask }` | Subtask added to task | New subtask under parent |
| `subtask:updated` | `{ taskId, subtask }` | Subtask fields changed | Subtask modified |
| `subtask:deleted` | `{ taskId, subtaskId }` | Subtask removed | Subtask removed |

### 5.5 Dedicated Spawn Event: session:spawn

The server emits a dedicated `session:spawn` event (not overloaded on `session:created`) whenever `POST /api/sessions/spawn` is called from **any source** (UI, agent, CLI, API). This is the single trigger for terminal creation in the UI.

```typescript
// session:spawn — ALWAYS emitted by POST /api/sessions/spawn
// This is the ONLY event that triggers terminal creation in the UI
{
  "event": "session:spawn",
  "data": {
    "session": {
      "id": "sess_789",
      "projectId": "proj_123",
      "taskIds": ["task_456"],
      "status": "active",
      "role": "worker",
      "name": "Fix auth bug",
      ...
    },
    "command": "maestro worker init",     // CLI command to run in terminal
    "cwd": "/path/to/project",           // Working directory
    "envVars": {                          // Environment variables for terminal
      "MAESTRO_SESSION_ID": "sess_789",
      "MAESTRO_MANIFEST_PATH": "~/.maestro/sessions/sess_789/manifest.json",
      "MAESTRO_SERVER_URL": "http://localhost:3000",
      "MAESTRO_PROJECT_ID": "proj_123",
      "MAESTRO_TASK_IDS": "task_456"
    },
    "projectId": "proj_123",
    "taskIds": ["task_456"],
    "manifest": { ... }                  // Full manifest content
  }
}

// session:created — emitted for direct session creation (POST /api/sessions)
// Does NOT trigger terminal creation. Only updates the sessions Map.
{
  "event": "session:created",
  "data": {
    "id": "sess_789",
    "projectId": "proj_123",
    "taskIds": ["task_456"],
    "status": "running",
    ...
  }
}
```

**Key distinction**: `session:spawn` = create terminal + track session. `session:created` = track session only (used by CLI hooks reporting session start).

---

## 6. WebSocket Events → UI State Changes

### 6.1 Event → State Update Mapping

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│ WebSocket Event      │ UI State Change                                  │
├─────────────────────┼──────────────────────────────────────────────────┤
│ task:created         │ useMaestroStore.tasks.set(task.id, task)        │
│                      │ → useTasks re-filters → TaskList re-renders     │
│                      │                                                  │
│ task:updated         │ useMaestroStore.tasks.set(task.id, task)        │
│                      │ → TaskListItem re-renders with new status/data  │
│                      │ → If agentStatus→completed: status→review (auto)│
│                      │                                                  │
│ task:deleted         │ useMaestroStore.tasks.delete(task.id)           │
│                      │ → Task disappears from TaskList                 │
│                      │                                                  │
│ session:spawn        │ → useMaestroStore.sessions.set(id, session)     │
│                      │ → useSessionStore.handleSpawnTerminalSession    │
│                      │ → Tauri invoke('create_session', {...})         │
│                      │ → New TerminalSession added to sessions[]       │
│                      │ → Terminal appears in sidebar                    │
│                      │ → Terminal executes: maestro worker init         │
│                      │                                                  │
│ session:created      │ useMaestroStore.sessions.set(id, session)       │
│                      │ → NO terminal creation (just data tracking)     │
│                      │                                                  │
│ session:updated      │ useMaestroStore.sessions.set(id, session)       │
│                      │ → useTaskSessions re-computes → session list    │
│                      │   in TaskListItem updates                       │
│                      │                                                  │
│ session:deleted      │ useMaestroStore.sessions.delete(id)             │
│                      │ → Session count badges update                    │
│                      │ → Session lists in TaskListItem update           │
│                      │                                                  │
│ task:session_added   │ Re-fetch task to get updated sessionIds          │
│                      │ → useTaskSessionCount recomputes                 │
│                      │ → Session badge appears/increments on task       │
│                      │                                                  │
│ task:session_removed │ Re-fetch task to get updated sessionIds          │
│                      │ → useTaskSessionCount recomputes                 │
│                      │ → Session badge decrements/disappears            │
│                      │                                                  │
│ session:task_added   │ Re-fetch session to get updated taskIds          │
│                      │ → useSessionTasks recomputes                     │
│                      │ → SessionsSection subtask list updates           │
│                      │                                                  │
│ session:task_removed │ Re-fetch session to get updated taskIds          │
│                      │ → useSessionTasks recomputes                     │
│                      │                                                  │
│ subtask:created      │ Re-fetch parent task (subtasks populated)        │
│                      │ → TaskListItem subtask list updates              │
│                      │                                                  │
│ subtask:updated      │ Re-fetch parent task                             │
│                      │ → Subtask checkbox/status updates                │
│                      │                                                  │
│ subtask:deleted      │ Re-fetch parent task                             │
│                      │ → Subtask removed from list                      │
└─────────────────────┴──────────────────────────────────────────────────┘
```

### 6.2 Event Handler Implementation (in useMaestroStore)

```typescript
const handleMessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);

  switch (message.event) {
    // ── Task Events ──
    case 'task:created':
    case 'task:updated':
      // Upsert task into Map
      set(prev => ({
        tasks: new Map(prev.tasks).set(message.data.id, message.data)
      }));
      break;

    case 'task:deleted':
      // Remove task from Map
      set(prev => {
        const tasks = new Map(prev.tasks);
        tasks.delete(message.data.id);
        return { tasks };
      });
      break;

    // ── Session Spawn Event (UNIFIED FLOW) ──
    case 'session:spawn': {
      // This is the ONLY event that triggers terminal creation.
      // Emitted by server for ALL spawn sources (ui, agent, cli, api).
      const { session, command, cwd, envVars, projectId } = message.data;

      // 1. Update session in Maestro store
      set(prev => ({
        sessions: new Map(prev.sessions).set(session.id, session)
      }));

      // 2. Trigger terminal creation via Tauri
      if (command && envVars) {
        useSessionStore.getState().handleSpawnTerminalSession({
          name: session.name,
          command,
          args: [],
          cwd,
          envVars,
          projectId,
        });
      }
      break;
    }

    // ── Standard Session Events ──
    case 'session:created':
      // Direct session creation (e.g., CLI hook reporting).
      // Does NOT trigger terminal creation.
      set(prev => ({
        sessions: new Map(prev.sessions).set(message.data.id, message.data)
      }));
      break;

    case 'session:updated':
      set(prev => ({
        sessions: new Map(prev.sessions).set(message.data.id, message.data)
      }));
      break;

    case 'session:deleted':
      set(prev => {
        const sessions = new Map(prev.sessions);
        sessions.delete(message.data.id);
        return { sessions };
      });
      break;

    // ── Relationship Events ──
    case 'task:session_added':
    case 'task:session_removed':
      // Task's sessionIds changed - re-fetch to get latest
      // This updates: task card session badge, session list, session count
      get().fetchTask(message.data.taskId);
      break;

    case 'session:task_added':
    case 'session:task_removed':
      // Session's taskIds changed - re-fetch to get latest
      // This updates: session card task list, task rows in sidebar
      get().fetchSession(message.data.sessionId);
      break;

    // Note: subtask events use standard task events (task:created/updated/deleted)
    // because subtasks ARE tasks. When a task:created arrives with data.parentId,
    // the useTaskTree hook recomputes automatically, inserting the subtask
    // under its parent in the hierarchy. No special subtask handler needed.
  }
};
```

### 6.3 On Reconnection

```typescript
ws.onopen = () => {
  set({ wsConnected: true });
  globalReconnectAttempts = 0;

  // Refresh all data to catch up on missed events
  const { activeProjectIdRef } = get();
  if (activeProjectIdRef) {
    get().fetchTasks(activeProjectIdRef);
  }
};
```

---

## 7. Session Spawning Flows

### 7.1 Unified Spawn Architecture

**All spawn sources follow the same flow.** Whether the UI, an orchestrator agent, or the CLI initiates a spawn, the path is identical:

1. Caller sends `POST /api/sessions/spawn`
2. Server generates manifest via CLI
3. Server emits `session:spawn` WebSocket event with full spawn data
4. UI receives WebSocket event → creates terminal via Tauri

The HTTP response from the spawn endpoint is an **acknowledgment only**. The actual terminal creation is **always** triggered by the WebSocket event.

```
 ┌─────────┐      ┌───────────────┐      ┌───────────┐
 │  ANY     │      │  MAESTRO      │      │   UI      │
 │  CALLER  │      │  SERVER       │      │ (React)   │
 └────┬─────┘      └──────┬────────┘      └─────┬─────┘
      │                    │                     │
      │  POST /sessions/   │                     │
      │  spawn             │                     │
      │───────────────────►│                     │
      │                    │                     │
      │                    │ 1. Validate         │
      │                    │ 2. Create session   │
      │                    │ 3. CLI: manifest    │
      │                    │    generate         │
      │                    │ 4. Read manifest    │
      │                    │ 5. Prepare envVars  │
      │                    │                     │
      │   HTTP 201         │  WS: session:spawn  │
      │◄───────────────────│────────────────────►│
      │   { sessionId }    │  { session, command,│
      │                    │    cwd, envVars,    │
      │                    │    manifest }       │
      │                    │                     │
      │                    │                     │ 6. handleSpawnTerminalSession
      │                    │                     │ 7. invoke('create_session')
      │                    │                     │ 8. Terminal appears
      │                    │                     │ 9. $ maestro worker init
      │                    │                     │ 10. Claude starts
```

### 7.2 Complete Spawn Sequence

```
TRIGGER: Any source calls POST /api/sessions/spawn
    │
    │  Sources:
    │    - UI: User clicks ▶ on task → maestroClient.spawnSession()
    │    - Agent: Orchestrator spawns worker via API
    │    - CLI: $ maestro session spawn --project ... --tasks ...
    │
    ▼
POST /api/sessions/spawn {
    projectId: "proj_123",
    taskIds: ["task_456", "task_789"],
    role: "worker",
    spawnSource: "ui" | "session",
    spawnedBy: "sess_000",     ← (only if agent-initiated)
    sessionName: "Fix auth bug",
    skills: ["maestro-worker"]
}
    │
    ▼
SERVER PROCESSING:
    │
    ├── 1. Validate inputs
    │     - projectId exists
    │     - All taskIds exist
    │     - Project matches task projectIds
    │
    ├── 2. Create session record (status: 'spawning')
    │     - Generate session ID: sess_{timestamp}_{random}
    │     - Store in server cache + disk
    │
    ├── 3. Generate manifest via CLI (child process):
    │     $ maestro manifest generate \
    │       --role worker \
    │       --project-id proj_123 \
    │       --task-ids task_456,task_789 \
    │       --skills maestro-worker \
    │       --api-url http://localhost:3000 \
    │       --output ~/.maestro/sessions/sess_XYZ/manifest.json \
    │       --json
    │
    │     CLI internals:
    │       a) Fetch project data: GET /api/projects/proj_123
    │       b) Fetch each task: GET /api/tasks/task_456, GET /api/tasks/task_789
    │       c) Build manifest with tasks, project, skills, session config
    │       d) Write manifest.json to output path
    │       e) Output { success: true, manifestPath } to stdout
    │
    ├── 4. Server reads generated manifest
    │
    ├── 5. Prepare environment variables:
    │     MAESTRO_SESSION_ID = "sess_XYZ"
    │     MAESTRO_MANIFEST_PATH = "~/.maestro/sessions/sess_XYZ/manifest.json"
    │     MAESTRO_SERVER_URL = "http://localhost:3000"
    │     MAESTRO_PROJECT_ID = "proj_123"
    │     MAESTRO_TASK_IDS = "task_456,task_789"
    │
    ├── 6. Update session status: 'active'
    │
    ├── 7. Associate tasks with session (bidirectional links)
    │
    ├── 8. Emit WebSocket event: session:spawn
    │     {
    │       event: "session:spawn",
    │       data: {
    │         session: { id, projectId, taskIds, status, ... },
    │         command: "maestro worker init",
    │         cwd: "/path/to/project",
    │         envVars: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, ... },
    │         manifest: { ... },
    │         projectId: "proj_123",
    │         taskIds: ["task_456", "task_789"]
    │       }
    │     }
    │
    └── 9. Return HTTP 201:
          { success: true, sessionId: "sess_XYZ", manifestPath: "..." }
    │
    ▼
UI RECEIVES WebSocket event: session:spawn
    │
    ▼
useMaestroStore.handleMessage processes event:
    │
    ├── Updates sessions Map with new session
    │
    └── Triggers terminal creation:
        useSessionStore.handleSpawnTerminalSession({
            name: session.name,
            command: "maestro worker init",
            cwd: "/path/to/project",
            envVars: { MAESTRO_* },
            projectId: "proj_123"
        })
    │
    ▼
handleSpawnTerminalSession:
    │
    ├── Dedup check: spawningSessionsRef.has(dedupKey)?
    │     → If yes: skip (prevents double-spawn)
    │     → If no: add to set, proceed
    │
    ├── Create terminal via Tauri:
    │   invoke('create_session', {
    │       name: "Fix auth bug",
    │       command: "maestro worker init",
    │       cwd: "/path/to/project",
    │       cols: 200, rows: 50,
    │       env_vars: { MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, ... },
    │       persistent: false
    │   })
    │
    ├── Tauri creates PTY → Returns { id, name, command, cwd }
    │
    ├── Create TerminalSession:
    │   { ...tauriInfo, projectId, maestroSessionId: null, createdAt, ... }
    │
    └── Add to useSessionStore.sessions + set as active
    │
    ▼
TERMINAL EXECUTES: $ maestro worker init
    │
    ├── CLI reads MAESTRO_MANIFEST_PATH
    ├── CLI validates manifest schema
    ├── CLI generates system prompt from template
    ├── CLI loads skills from manifest
    ├── CLI displays session brief (task summary)
    ├── CLI auto-updates task status: pending → in_progress
    ├── [FUTURE] CLI calls SessionStart hook (POST /api/sessions)
    │
    ├── CLI spawns Claude Code:
    │   $ claude --model {model} --permission-mode {mode} \
    │     --append-system-prompt {generatedPrompt}
    │
    └── Claude agent session starts working on tasks
    │
    ▼
DURING SESSION:
    │
    ├── Agent updates task status via API
    │   → task:updated events → UI updates
    │
    ├── Agent adds timeline events
    │   → task:updated events → Timeline updates
    │
    └── Agent may spawn sub-sessions (orchestrator role)
        → POST /api/sessions/spawn → Same unified flow
    │
    ▼
SESSION ENDS:
    │
    ├── Claude exits
    ├── [FUTURE] CLI calls SessionEnd hook:
    │   PATCH /api/sessions/sess_XYZ { status: 'completed', exitCode: 0 }
    │   → session:updated event
    ├── CLI exits
    └── Terminal shows exited state in sidebar
```

### 7.3 Spawn Sources

| Source | spawnSource | Triggered By | HTTP Response Used? |
|--------|-----------|-------------|-------------------|
| UI | `"ui"` or `"manual"` | User clicks ▶ on task | Acknowledgment only |
| Orchestrator agent | `"agent"` | Orchestrator decides to spawn worker | Acknowledgment only |
| CLI | `"cli"` | `$ maestro session spawn` | N/A (CLI is the caller) |
| API | `"api"` | External tool calls API | Acknowledgment only |

All sources produce the same WebSocket event. The UI always creates terminals from the WebSocket event, never from the HTTP response. This ensures a single code path for terminal creation regardless of who initiated the spawn.

### 7.4 External Spawn (No UI Terminal)

When a spawn originates from outside the UI (direct CLI usage), the terminal runs externally:

```
$ maestro session spawn --project proj_123 --tasks task_789 --app terminal
    │
    ▼
Server processes, emits session:spawn event
    │
    ▼
UI receives event BUT:
  - If the event has no command/envVars → no terminal created
  - Session still added to useMaestroStore.sessions
  - Task session count badge updates
  - TaskListItem shows session in expanded sessions list
  - User can see session exists but terminal is external
```

### 7.4 Session Lifecycle After Spawn

```
Session Status: spawning → running → completed/failed
    │
    ├── spawning: Manifest being generated
    │     └── session:created event (status: spawning)
    │
    ├── running: Terminal active, agent working
    │     └── session:updated event (status: running)
    │     │
    │     ├── Agent updates task status:
    │     │   PATCH /api/tasks/:id { agentStatus: 'working' }
    │     │   → task:updated event → TaskListItem shows activity
    │     │
    │     ├── Agent adds timeline event:
    │     │   POST /api/tasks/:id/timeline { message: "Analyzing code..." }
    │     │   → task:updated event → Timeline section updates
    │     │
    │     └── Agent marks task done:
    │         PATCH /api/tasks/:id { agentStatus: 'completed' }
    │         → Server auto-sets: status → 'review'
    │         → task:updated event → Task shows "review" badge
    │
    ├── completed: Agent finished successfully
    │     └── CLI calls SessionEnd hook:
    │         PATCH /api/sessions/:id { status: 'completed', exitCode: 0 }
    │         → session:updated event
    │         → useTaskSessionCount decrements
    │
    └── failed: Agent encountered error
          └── CLI calls SessionEnd hook:
              PATCH /api/sessions/:id { status: 'failed', exitCode: 1 }
              → session:updated event
              → Terminal shows exited state in sidebar
```

### 7.5 Environment Variables Passed to Terminal

| Variable | Example | Purpose |
|----------|---------|---------|
| `MAESTRO_SESSION_ID` | `sess_1738713600000_abc` | Identifies session for API calls |
| `MAESTRO_MANIFEST_PATH` | `~/.maestro/sessions/sess_.../manifest.json` | Path to manifest file |
| `MAESTRO_SERVER_URL` | `http://localhost:3000` | Server API endpoint |
| `MAESTRO_PROJECT_ID` | `proj_1738713600000_xyz` | Current project |
| `MAESTRO_TASK_IDS` | `task_123,task_456` | Tasks to work on |
| `MAESTRO_API_URL` | `http://localhost:3000` | Alias for server URL |

---

## 8. Task-Session Relationship Model

### 8.1 Conceptual Model

```
Project
  ├── Task A (sessionIds: [sess_1, sess_2])
  ├── Task B (sessionIds: [sess_2])
  ├── Task C (sessionIds: [])         ← Not assigned
  └── Task D (sessionIds: [sess_3])

Session 1 (taskIds: [task_A])         ← Single-task worker
Session 2 (taskIds: [task_A, task_B]) ← Multi-task worker
Session 3 (taskIds: [task_D])         ← Single-task worker
```

### 8.2 Relationship Rules

1. **Many-to-many**: A task can have multiple sessions; a session can work on multiple tasks.
2. **No foreign key**: Tasks store `sessionIds[]`, sessions store `taskIds[]`. Both sides maintained by server.
3. **Bidirectional sync**: Adding a task to a session updates both `session.taskIds` and `task.sessionIds`.
4. **Independent lifecycle**: Tasks exist without sessions. Sessions can outlive task completion.
5. **Multi-task sessions**: Sessions always use array model (`taskIds: string[]`), even for single task.

### 8.3 Relationship Events

When adding task to session (`POST /sessions/:sid/tasks/:tid`), server emits:
1. `session:task_added` → `{ sessionId, taskId }` — Session's taskIds updated
2. `task:session_added` → `{ taskId, sessionId }` — Task's sessionIds updated

When removing (`DELETE /sessions/:sid/tasks/:tid`):
1. `session:task_removed` → `{ sessionId, taskId }`
2. `task:session_removed` → `{ taskId, sessionId }`

### 8.4 UI Implications

| UI Location | Data Source | What Shows |
|-------------|------------|------------|
| TaskListItem session badge | `useTaskSessionCount(taskId)` | Count of active sessions for this task |
| TaskListItem expanded sessions | `useTaskSessions(taskId)` | List of sessions with name, status, jump/remove actions |
| SessionsSection subtask list | `useSessionTasks(sessionId)` via `maestroSessionId` | Tasks assigned to this terminal's Maestro session |
| Session sidebar expand arrow | `session.maestroSessionId` presence | Shows ▸/▾ only if terminal has linked Maestro session |

### 8.5 Linking Terminal Sessions to Maestro Sessions

The `TerminalSession.maestroSessionId` field bridges the two worlds:

```
TerminalSession (Tauri/UI)          MaestroSession (Server)
─────────────────────────           ─────────────────────────
id: "pty_abc123"                    id: "sess_789"
maestroSessionId: "sess_789" ──────► id: "sess_789"
projectId: "proj_1"                 projectId: "proj_1"
command: "maestro worker init"      taskIds: ["task_456"]
cwd: "/path/to/project"            status: "running"
effectId: "claude"                  manifestPath: "~/.maestro/..."
agentWorking: true                  role: "worker"
```

**Jump-to-session flow**:
1. User clicks ↗ on session in TaskListItem
2. `onJumpToSession(maestroSessionId)` called
3. `useSessionStore.handleJumpToSessionFromTask(maestroSessionId)`
4. Finds TerminalSession where `s.maestroSessionId === maestroSessionId`
5. Sets that terminal as active → sidebar highlights + terminal focused

### 8.6 Bidirectional UI Rendering

The task-session many-to-many relationship is rendered in **both directions**: task cards show their sessions, and session cards show their tasks. Both update in real-time via WebSocket events.

#### Task Card → Shows Sessions

Every task (and subtask) shows its linked sessions with live status:

```
TaskListItem (expanded):
─────────────────────────────────────────────────────
▾ Fix authentication bug                    RUN  ◉ 2
  ┌─ Sessions ──────────────────────────────────────┐
  │ ● Auth worker         [running]      ↗  ×      │
  │ ○ Debug session       [completed]    ↗  ×      │
  └─────────────────────────────────────────────────┘

Legend:
  ● = running (green dot, pulsing)
  ○ = completed/stopped (dim)
  [running] / [completed] / [failed] = MaestroSession.status
  ↗ = Jump to terminal
  × = Remove task from session
```

**Data source:**

```typescript
// In TaskListItem:
const { sessions: taskSessions, loading } = useTaskSessions(task.id);
// taskSessions: MaestroSession[] where session.taskIds.includes(task.id)

// Each session rendered with:
{taskSessions.map(session => (
  <div className="sessionRow">
    <span className={`sessionDot sessionDot--${session.status}`} />
    <span className="sessionName">{session.name || session.id}</span>
    <span className={`sessionStatus sessionStatus--${session.status}`}>
      [{session.status}]
    </span>
    <button onClick={() => onJumpToSession(session.id)}>↗</button>
    <button onClick={() => onRemoveTaskFromSession(session.id, task.id)}>×</button>
  </div>
))}
```

#### Session Card → Shows Tasks

Each terminal session in the sidebar shows its linked Maestro tasks (with status and subtask info):

```
SessionsSection (left sidebar):
─────────────────────────────────────────────────────
  Auth worker ●
  ▾ (expand)
    ├── Fix authentication bug         [in_progress]
    │     └── Implement login check    [in_progress]
    │     └── Add session timeout      [todo]
    ├── Update user model              [review]
    └── Write integration tests        [todo]

  Debug session ○
  ▸ (collapsed)
─────────────────────────────────────────────────────
```

**Data source:**

```typescript
// In SessionsSection per terminal:
const terminalSession = sessions[i]; // TerminalSession from useSessionStore
const maestroSessionId = terminalSession.maestroSessionId;

// If linked to Maestro session, load tasks:
const { session: maestroSession, tasks: sessionTasks } =
  useSessionTasks(maestroSessionId);

// sessionTasks: MaestroTask[] resolved from maestroSession.taskIds
// Each task can itself have children (subtasks) — build mini-tree:

const taskTree = useMemo(() => {
  const roots = sessionTasks.filter(t => !t.parentId);
  const childMap = new Map<string, MaestroTask[]>();
  for (const t of sessionTasks) {
    if (t.parentId && sessionTasks.some(r => r.id === t.parentId)) {
      const siblings = childMap.get(t.parentId) || [];
      siblings.push(t);
      childMap.set(t.parentId, siblings);
    }
  }
  return { roots, childMap };
}, [sessionTasks]);
```

### 8.7 Session Status Display in Task Cards

Each session shown in a task card displays its **live status** with appropriate visual treatment:

```typescript
const SESSION_STATUS_DISPLAY: Record<MaestroSessionStatus, {
  dot: string;
  label: string;
  color: string;
  pulsing: boolean;
}> = {
  spawning:  { dot: '◌', label: 'spawning',  color: 'blue',   pulsing: true },
  running:   { dot: '●', label: 'running',   color: 'green',  pulsing: true },
  completed: { dot: '○', label: 'completed', color: 'muted',  pulsing: false },
  failed:    { dot: '✗', label: 'failed',    color: 'red',    pulsing: false },
  stopped:   { dot: '□', label: 'stopped',   color: 'yellow', pulsing: false },
};
```

**Real-time status updates**: When a `session:updated` event arrives with a new status, every task card showing that session re-renders immediately:

```
session:updated { id: "sess_456", status: "completed" }
    │
    ├── useMaestroStore.sessions Map updated
    │
    ├── useTaskSessions(taskId) recomputes for ALL tasks
    │   that reference sess_456 in their sessionIds
    │
    ├── useTaskSessionCount(taskId) recomputes
    │   (completed sessions no longer counted as "active")
    │
    └── UI updates:
        - Session dot changes from ● (green) to ○ (dim)
        - Session status label changes to [completed]
        - Active session count badge decrements (e.g., ◉ 2 → ◉ 1)
        - If last session completed: badge disappears entirely
```

### 8.8 Task Status Display in Session Cards

Each task shown in a session card displays its **live status** and **agent status**:

```
Session sidebar expanded:
─────────────────────────────────────────────────────
  ▾ Auth worker ●
    ├── ◉ Fix authentication bug       [RUN]  🟢
    │     └── ○ Add session timeout     [IDLE]
    ├── ◈ Update user model            [REVIEW]
    └── ○ Write integration tests      [IDLE]
─────────────────────────────────────────────────────

Legend:
  ◉/○/◈/✓ = TaskStatus symbol
  [RUN/IDLE/REVIEW/DONE] = TaskStatus label
  🟢 = agentStatus: working (pulsing dot)
```

**Real-time status updates**: When a `task:updated` event arrives, session cards re-render:

```
task:updated { id: "task_456", status: "review", agentStatus: "completed" }
    │
    ├── useMaestroStore.tasks Map updated
    │
    ├── useSessionTasks(sessionId) recomputes for ALL sessions
    │   whose taskIds include "task_456"
    │
    └── UI updates in session card:
        - Task status symbol changes: ◉ → ◈
        - Status label changes: [RUN] → [REVIEW]
        - Agent dot disappears (completed, no longer pulsing)
```

### 8.9 WebSocket Event Cascading Between Entities

Events on one entity type cascade to affect the UI of the other entity type. This is the core of the many-to-many relationship's real-time behavior.

```
┌──────────────────────────────────────────────────────────────────┐
│                EVENT CASCADE MATRIX                              │
├──────────────────┬───────────────────────────────────────────────┤
│ Event            │ Cascading UI Effects                           │
├──────────────────┼───────────────────────────────────────────────┤
│                  │                                               │
│ session:updated  │ TASK CARDS affected:                          │
│ (status change)  │  → Every task whose sessionIds includes this  │
│                  │    session re-renders its session list         │
│                  │  → Active session count badges update          │
│                  │  → If session→completed: task may show         │
│                  │    "no active sessions" state                  │
│                  │                                               │
│ session:spawn    │ TASK CARDS affected:                          │
│                  │  → task:session_added events follow            │
│                  │  → Task's session count increments             │
│                  │  → Task's session list shows new session       │
│                  │  → Task status may auto-transition to          │
│                  │    in_progress                                 │
│                  │                                               │
│ session:deleted  │ TASK CARDS affected:                          │
│                  │  → task:session_removed events follow          │
│                  │  → Task's session count decrements             │
│                  │  → Session removed from task's session list    │
│                  │                                               │
│ task:updated     │ SESSION CARDS affected:                       │
│ (status change)  │  → Every session whose taskIds includes this  │
│                  │    task re-renders its task list               │
│                  │  → Status badge updates in session's task row  │
│                  │  → Agent status dot updates                    │
│                  │                                               │
│ task:deleted     │ SESSION CARDS affected:                       │
│                  │  → Session's task list removes the task        │
│                  │  → session:task_removed event follows          │
│                  │  → Session's taskIds shrinks                   │
│                  │                                               │
│ task:created     │ SESSION CARDS affected:                       │
│ (with parentId)  │  → If parent task is in a session's taskIds,  │
│                  │    the session card's task tree updates with   │
│                  │    the new subtask                             │
│                  │                                               │
│ task:session_    │ BOTH affected:                                │
│ added/removed    │  → Task card: session count & list update     │
│                  │  → Session card: task count & list update      │
│                  │  → Triggers re-fetch of both entities          │
│                  │                                               │
│ session:task_    │ BOTH affected:                                │
│ added/removed    │  → Mirror of task:session_added/removed       │
│                  │  → Same bilateral update                      │
└──────────────────┴───────────────────────────────────────────────┘
```

**Handler implementation for cascading updates:**

```typescript
// In useMaestroStore handleMessage:

case 'session:updated': {
  const session = message.data;
  set(prev => ({
    sessions: new Map(prev.sessions).set(session.id, session)
  }));
  // Cascading: All task cards with useTaskSessions/useTaskSessionCount
  // hooks that reference this session will re-render automatically
  // because they derive from the sessions Map.
  break;
}

case 'task:updated': {
  const task = message.data;
  set(prev => ({
    tasks: new Map(prev.tasks).set(task.id, task)
  }));
  // Cascading: All session cards with useSessionTasks hooks
  // that reference this task will re-render automatically
  // because they derive from the tasks Map.
  break;
}

// Relationship events trigger targeted re-fetches:
case 'task:session_added':
case 'task:session_removed':
  get().fetchTask(message.data.taskId);      // Refresh task's sessionIds
  break;

case 'session:task_added':
case 'session:task_removed':
  get().fetchSession(message.data.sessionId); // Refresh session's taskIds
  break;
```

### 8.10 Complete Real-time Update Example

A full worked example showing how a single action cascades across the UI:

```
TRIGGER: Agent marks subtask as completed via CLI

1. Agent calls: PATCH /api/tasks/task_789 { agentStatus: "completed" }

2. Server processes:
   - Sets agentStatus = "completed"
   - Auto-transitions: status = "review" (from in_progress)
   - Updates task in cache
   - Emits: task:updated { id: "task_789", status: "review",
                           agentStatus: "completed", parentId: "task_456", ... }

3. UI receives WebSocket event:

   useMaestroStore:
     tasks.set("task_789", updatedTask)

4. Cascading re-renders:

   a) MaestroPanel Task List:
      - useTaskTree recomputes
      - Subtask "task_789" under parent "task_456" shows:
        Old: ◉ Implement login validation    [RUN]  🟢
        New: ◈ Implement login validation    [REVIEW]
      - Parent task_456's aggregate progress updates:
        "2/3 subtasks done"

   b) SessionsSection sidebar:
      - For every session whose taskIds includes "task_789":
        useSessionTasks recomputes
        Task row updates:
        Old: ◉ Implement login validation [RUN] 🟢
        New: ◈ Implement login validation [REVIEW]

   c) TaskDetailModal (if open for task_789):
      - Status badge changes to REVIEW
      - Agent status shows "Agent done"
      - Timeline may show new entry

   d) TaskDetailModal (if open for parent task_456):
      - Subtask list updates with new status
      - Subtask progress bar/count updates

All updates are INSTANT (no polling, no manual refresh).
```

---

## 9. Tauri Terminal Interface

### 9.1 Invoke Commands (UI → Tauri Rust Backend)

The UI interacts with the Tauri backend through these `invoke` commands. Treat internals as a black box.

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `create_session` | `{ name, command?, cwd?, cols, rows, env_vars?, persistent? }` | `TerminalSessionInfo` | Creates a new PTY terminal session |
| `close_session` | `{ id }` | `void` | Closes and destroys a terminal session |
| `write_to_session` | `{ id, data, source }` | `void` | Writes data to terminal (keystrokes, commands) |
| `resize_session` | `{ id, cols, rows }` | `void` | Resizes terminal PTY |
| `validate_directory` | `{ path }` | `string \| null` | Validates directory exists, returns canonical path |
| `kill_persistent_session` | `{ persistId }` | `void` | Kills a persistent background terminal |
| `stop_session_recording` | `{ id }` | `void` | Stops recording terminal output |

### 9.2 create_session Parameters

```typescript
invoke<TerminalSessionInfo>('create_session', {
  name: string;              // Display name for terminal
  command: string | null;    // Command to execute (null = interactive shell)
  cwd: string | null;        // Working directory (null = home)
  cols: number;              // Terminal columns (default: 200)
  rows: number;              // Terminal rows (default: 50)
  env_vars: Record<string, string>;  // Environment variables to set
  persistent: boolean;       // Whether terminal survives app restart
});

// Returns:
interface TerminalSessionInfo {
  id: string;        // Unique PTY session ID
  name: string;      // Session name
  command: string;   // Resolved command
  cwd?: string;      // Resolved working directory
}
```

### 9.3 Terminal Events (Tauri → UI)

Terminal data flows from Tauri to UI via event listeners:

| Event | Data | Handler |
|-------|------|---------|
| Session output | Raw terminal bytes | xterm.js writes to terminal + `markAgentWorkingFromOutput` |
| Session exit | `{ id, exitCode }` | `applyPendingExit` → marks `exited: true` |
| CWD change | `{ id, cwd }` | `onCwdChange` → updates session CWD |
| Command change | `{ id, commandLine }` | `onCommandChange` → detects process effects |

### 9.4 Maestro Session Spawn via Tauri

```typescript
// In useSessionStore.handleSpawnTerminalSession:
async handleSpawnTerminalSession(sessionInfo: {
  name: string;
  command: string | null;    // "maestro worker init"
  args: string[];
  cwd: string;               // Project working directory
  envVars: Record<string, string>;  // MAESTRO_* variables
  projectId: string;
}) {
  // 1. Deduplication check
  const dedupKey = `${sessionInfo.projectId}:${sessionInfo.name}`;
  if (spawningSessionsRef.has(dedupKey)) return;
  spawningSessionsRef.add(dedupKey);

  // 2. Create terminal via Tauri
  const info = await invoke<TerminalSessionInfo>('create_session', {
    name: sessionInfo.name,
    command: sessionInfo.command,
    cwd: sessionInfo.cwd,
    cols: 200,
    rows: 50,
    env_vars: sessionInfo.envVars,
    persistent: false,
  });

  // 3. Create TerminalSession object
  const newSession: TerminalSession = {
    ...info,
    projectId: sessionInfo.projectId,
    persistId: '',
    persistent: false,
    createdAt: Date.now(),
    launchCommand: sessionInfo.command,
    sshTarget: null,
    sshRootDir: null,
    cwd: sessionInfo.cwd,
    agentWorking: false,
    exited: false,
  };

  // 4. Add to store and activate
  set(s => ({
    sessions: [...s.sessions, newSession],
    activeId: newSession.id,
  }));

  // 5. Clear dedup after 2s
  setTimeout(() => spawningSessionsRef.delete(dedupKey), 2000);
}
```

---

## 10. UI Component Data Flow

### 10.1 Component Hierarchy

```
App.tsx
  ├── AppTopbar
  │     └── Project selector (useProjectStore)
  ├── AppWorkspace
  │     ├── SessionsSection (left sidebar)
  │     │     ├── Session list (useSessionStore.sessions)
  │     │     │     └── Per-session (if maestroSessionId):
  │     │     │           ├── Expand → show tasks via useSessionTasks
  │     │     │           │     └── Per-task row:
  │     │     │           │           ├── Status badge + title
  │     │     │           │           ├── Agent status dot
  │     │     │           │           └── Subtask children (if any)
  │     │     │           └── Session status indicator (running/completed/failed)
  │     │     ├── New terminal dropdown
  │     │     └── Agent shortcuts row
  │     ├── Terminal area (center)
  │     │     └── xterm.js terminal (active session)
  │     └── AppRightPanel / AppSlidePanel
  │           └── MaestroPanel (right panel)
  │                 ├── TaskFilters (status, priority, search)
  │                 ├── TaskTree (hierarchical task list)
  │                 │     └── TaskListItem (per root task)
  │                 │           ├── useTaskSessionCount(taskId)
  │                 │           ├── useTaskSessions(taskId) [on expand]
  │                 │           ├── Subtask rows (children)
  │                 │           │     ├── Each subtask: same hooks
  │                 │           │     ├── Session count per subtask
  │                 │           │     ├── Click → opens TaskDetailModal
  │                 │           │     └── ▶ button → spawn session
  │                 │           ├── "+ Add subtask" inline input
  │                 │           └── Session list (expanded, with live status)
  │                 ├── CreateTaskModal (also used for subtasks with parentId)
  │                 ├── TaskDetailModal (same for root tasks AND subtasks)
  │                 └── MultiTaskSessionCreator
  └── AppModals
        └── Various modals (settings, SSH, etc.)
```

### 10.2 MaestroPanel Data Requirements

```typescript
// Props received by MaestroPanel:
{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  project: MaestroProject;
  onCreateMaestroSession: (input) => Promise<any>;  // Spawn flow trigger
  onJumpToSession?: (maestroSessionId) => void;      // Navigate to terminal
  onAddTaskToSession?: (taskId) => void;              // Add task to existing session
}

// Internal data:
// - useTaskTree(projectId) → hierarchical task list (root tasks + subtask children)
// - useMaestroStore → createTask, updateTask, deleteTask, hardRefresh
// - Local UI state: filters, selected task, modals, taskDetailModalId
//
// Key: MaestroPanel renders a TREE, not a flat list.
// Root tasks shown at top level, subtasks nested underneath parents.
```

### 10.3 TaskListItem Data Requirements

```typescript
// Each TaskListItem needs (applies to BOTH root tasks and subtasks):
{
  task: MaestroTask;           // Task data (root task or subtask)
  depth: number;               // Nesting level (0 = root, 1 = subtask, 2 = sub-subtask)
  subtasks: MaestroTask[];     // Direct children of this task
  onSelect: (taskId: string) => void;  // Opens TaskDetailModal

  // Hooks used internally:
  // useTaskSessions(task.id)     → session list (lazy-loaded on expand)
  // useTaskSessionCount(task.id) → real-time active session count
  // useOptimistic(removeTaskFromSession) → optimistic session removal
}

// What the TaskListItem renders:
//
// COLLAPSED state:
// [▸] [StatusSymbol] Task Title              [time] [subtaskCount] [◉ sessionCount] [▶]
//
// EXPANDED state:
// [▾] [StatusSymbol] Task Title              [time] [subtaskCount] [◉ sessionCount] [▶]
//   ├── Description section (collapsible)
//   ├── Details section (collapsible): dependencies, skills, timestamps
//   ├── Timeline section (collapsible): activity log
//   ├── Sessions section (collapsible):
//   │     ├── ● Session-1 [running]   ↗ ×
//   │     └── ○ Session-2 [completed] ↗ ×
//   ├── Subtasks:
//   │     ├── [StatusSymbol] Subtask-1    [time] [◉ sessionCount] [▶]  ← clickable
//   │     ├── [StatusSymbol] Subtask-2    [time]                  [▶]  ← clickable
//   │     └── [StatusSymbol] Subtask-3    [time] [◉ sessionCount] [▶]  ← clickable
//   └── [+ Add subtask] input
```

### 10.4 SessionsSection Maestro Integration

```
SessionsSection renders:
  For each TerminalSession:
    │
    ├── If session.maestroSessionId exists:
    │     Show expand arrow (▸/▾) + session status indicator
    │     │
    │     └── On expand:
    │           Load tasks via useSessionTasks(maestroSessionId)
    │           Show task tree with:
    │             - Status badge (RUN/DONE/BLOCK/IDLE)
    │             - Task title (clickable → opens TaskDetailModal)
    │             - Agent status dot (if working)
    │             - Subtasks nested under their parents:
    │               ├── Root task [in_progress] 🟢
    │               │     ├── Subtask A [in_progress] 🟢
    │               │     └── Subtask B [todo]
    │               └── Root task 2 [review]
    │             - Each subtask shows its own session count
    │
    └── If no maestroSessionId:
          No expand arrow (regular terminal)

  Session status indicator in sidebar:
    ● running  (green, pulsing)
    ○ completed (dim)
    ✗ failed   (red)
    □ stopped  (yellow)
    ◌ spawning (blue, pulsing)
```

### 10.5 TaskDetailModal

The TaskDetailModal opens for **both root tasks and subtasks**. It is the single, unified detail view for any task regardless of hierarchy level.

```
TaskDetailModal
─────────────────────────────────────────────────────
│ Breadcrumb: Project > Parent Task > This Task      │
│                                                     │
│ Title: [Editable title]                             │
│ Status: [◈ REVIEW ▼]    Agent: [🟢 completed]     │
│ Priority: [High ▼]                                  │
│                                                     │
│ Description:                                        │
│ [Editable description text area]                    │
│                                                     │
│ ─── Active Sessions (2) ───────────────────────── │
│ ● Auth worker          [running]       ↗           │
│ ○ Debug session        [completed]     ↗           │
│ [+ Spawn new session]                               │
│                                                     │
│ ─── Subtasks (3/5 completed) ─────────────────── │
│ ✓ Implement login check            [done]           │
│ ✓ Add password validation          [done]           │
│ ✓ Setup JWT tokens                 [done]           │
│ ◉ Add session timeout              [in_progress] ◉1│
│ ○ Write auth tests                 [todo]           │
│ [+ Add subtask]                                     │
│                                                     │
│ ─── Timeline ──────────────────────────────────── │
│ [session_started] 2m ago - Auth worker started      │
│ [progress] 1m ago - Analyzing authentication flow   │
│ [update] 30s ago - Status changed to review         │
│                                                     │
│ ─── Details ───────────────────────────────────── │
│ Dependencies: task_111, task_222                     │
│ Skills: maestro-worker                              │
│ Created: Feb 4, 2026                                │
│ Started: Feb 4, 2026                                │
│                                                     │
│                              [Delete]  [Close]      │
─────────────────────────────────────────────────────
```

**Opening the modal:**

```typescript
// From TaskListItem (root task or subtask click):
const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

// Root task click:
<TaskListItem onSelect={() => setDetailTaskId(task.id)} ... />

// Subtask click (inside expanded TaskListItem):
<div
  className="subtaskRow"
  onClick={() => setDetailTaskId(subtask.id)}  // ← Same modal, subtask ID
>

// Modal:
{detailTaskId && (
  <TaskDetailModal
    taskId={detailTaskId}
    onClose={() => setDetailTaskId(null)}
  />
)}
```

**Modal data sources:**

```typescript
// Inside TaskDetailModal:
function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  // Task data (live, from store)
  const task = useMaestroStore(s => s.tasks.get(taskId));

  // Parent breadcrumb
  const breadcrumb = useTaskBreadcrumb(taskId);

  // Sessions for this task (live, real-time)
  const { sessions: taskSessions } = useTaskSessions(taskId);
  const activeSessionCount = useTaskSessionCount(taskId);

  // Subtasks of this task (live, from store)
  const allTasks = useMaestroStore(s => s.tasks);
  const subtasks = useMemo(
    () => [...allTasks.values()].filter(t => t.parentId === taskId),
    [allTasks, taskId]
  );

  // Each subtask's session count:
  // Rendered inline via useTaskSessionCount(subtask.id) per row

  // All data is reactive — WebSocket events auto-update everything
}
```

### 10.6 Project Switch Flow

```
User selects different project
    │
    ▼
useProjectStore.selectProject(newProjectId)
    │
    ├── Set activeProjectId = newProjectId
    ├── Find best terminal session for project
    │   └── useSessionStore.setActiveId(bestSessionId)
    │
    ▼
useTasks(newProjectId) hook fires
    │
    ├── useMaestroStore.fetchTasks(newProjectId)
    │   └── GET /api/tasks?projectId=newProjectId
    │
    └── useMaestroStore.activeProjectIdRef = newProjectId
        └── WebSocket reconnection auto-refreshes this project
```

---

## 11. Error Handling & Recovery

### 11.1 REST API Errors

```typescript
// MaestroClient.fetch handles errors:
if (!response.ok) {
  const errorText = await response.text().catch(() => 'Unknown error');
  throw new Error(`HTTP ${response.status}: ${errorText}`);
}

// Error propagation:
// MaestroClient → useMaestroStore (sets errors Map) → hooks (return error) → components (show banner)
```

### 11.2 WebSocket Disconnection

```
Connection lost
    │
    ▼
ws.onclose fires
    │
    ├── set({ wsConnected: false })
    ├── Schedule reconnect with exponential backoff:
    │     1s → 2s → 4s → 8s → 16s → 30s (max)
    │
    ▼
On reconnect (ws.onopen):
    ├── set({ wsConnected: true })
    ├── Reset reconnect counter
    └── fetchTasks(activeProjectIdRef)  ← Catch up on missed events
```

### 11.3 Optimistic Update Rollback

```typescript
// useOptimistic hook pattern:
const { execute, isPending, error } = useOptimistic(serverAction);

// Usage:
execute(
  () => { /* optimistic: update UI immediately */ },
  () => { /* rollback: revert UI on failure */ },
  ...actionArgs
);

// Flow:
// 1. Call optimistic update → UI shows change instantly
// 2. Call server action
// 3a. Success → WebSocket confirms change (no extra action needed)
// 3b. Failure → Call rollback → UI reverts → Show error
```

### 11.4 Spawn Failure Handling

```
Spawn request fails at any stage:
    │
    ├── Server validation fails (400):
    │     → Show error in MaestroPanel error banner
    │     → No terminal created, no session record
    │
    ├── Manifest generation fails:
    │     → Session stays in 'spawning' status
    │     → Server returns error in HTTP response
    │     → Show error to user
    │
    ├── Terminal creation fails (Tauri error):
    │     → Maestro session exists on server
    │     → No terminal in UI
    │     → useUIStore.reportError() shows notification
    │
    └── CLI fails inside terminal:
          → Terminal shows error output
          → CLI calls SessionEnd hook with status: 'failed'
          → session:updated event → UI shows failed status
```

### 11.5 Deduplication

```typescript
// Terminal spawn deduplication:
const spawningSessionsRef = new Set<string>();

// Key: `${projectId}:${sessionName}`
// Added before invoke('create_session')
// Removed 2 seconds after successful creation
// Prevents: rapid duplicate events from triggering double-spawn

// Note: With the unified spawn flow (single session:spawn event),
// deduplication is simpler. The main risk is WebSocket reconnection
// replaying recent events. The dedup set handles this.

// Relationship events (task:session_added × N) still fire separately
// but they only trigger data re-fetches, not terminal creation.
```

---

## 12. Dual Status Model

### 12.1 Overview

Tasks have two independent status fields:

| Field | Controller | Purpose |
|-------|-----------|---------|
| `status` (TaskStatus) | Human | Source of truth. Only humans can set terminal states (done, cancelled). |
| `agentStatus` (AgentStatus) | Agent | Informational. Reports what the agent is doing. Auto-transitions `status`. |

### 12.2 Status Transitions

**Human Status (`status`) state machine:**

```
                    ┌────────────┐
                    │    todo    │ ← Initial state
                    └─────┬──────┘
                          │ (queued for agent)
                    ┌─────▼──────┐
                    │   queued   │
                    └─────┬──────┘
                          │ (session spawned - auto)
                    ┌─────▼──────┐
         ┌─────────│ in_progress │◄────────────┐
         │         └─────┬──────┘              │
         │ (blocked)     │                     │ (changes requested)
    ┌────▼───┐           │ (agent completes)   │
    │ blocked│           │                ┌────┴────────────┐
    └────┬───┘     ┌─────▼──────┐         │changes_requested│
         │         │   review   │─────────┘                 │
         │         └─────┬──────┘                           │
         │               │ (human approves)                 │
         │         ┌─────▼──────┐                           │
         └────────►│    done    │ ← Terminal (human only)   │
                   └────────────┘                           │
                                                            │
                   ┌────────────┐                           │
                   │ cancelled  │ ← Terminal (human only)   │
                   └────────────┘                           │
                   ┌────────────┐                           │
                   │  wont_do   │ ← Terminal (human only)   │
                   └────────────┘
```

**Agent Status (`agentStatus`) state machine:**

```
null → working → completed
null → working → blocked → working → completed
null → working → needs_input → working → completed
null → working → failed
```

### 12.3 Automatic Transitions

| Trigger | From | To | Rule |
|---------|------|----|------|
| Session spawned | `status: todo/queued` | `status: in_progress` | Auto-set when first session starts |
| Agent sets `agentStatus: completed` | `status: in_progress` | `status: review` | System auto-transition (NOT done) |
| Agent sets `agentStatus: working` | - | `startedAt: now` (if null) | Auto-set first activity timestamp |

### 12.4 Permission Model

| Actor | Can Set `status` | Can Set `agentStatus` | Can Set `archived` |
|-------|-----------------|----------------------|-------------------|
| Human (UI) | All values | No | `true` only (irreversible) |
| Agent (CLI) | No | All values | No |
| System (auto) | `in_progress`, `review` | No | No |

### 12.5 UI Display Mapping

```typescript
// Status badge colors/labels in TaskListItem:

// Simple display (current):
const STATUS_DISPLAY = {
  todo:               { symbol: '○', label: 'IDLE', color: 'muted' },
  queued:             { symbol: '◎', label: 'QUEUE', color: 'blue' },
  in_progress:        { symbol: '◉', label: 'RUN',  color: 'green' },
  blocked:            { symbol: '✗', label: 'BLOCK', color: 'red' },
  paused:             { symbol: '⏸', label: 'PAUSE', color: 'yellow' },
  review:             { symbol: '◈', label: 'REVIEW', color: 'purple' },
  changes_requested:  { symbol: '↺', label: 'REDO', color: 'orange' },
  done:               { symbol: '✓', label: 'DONE', color: 'green' },
  cancelled:          { symbol: '⊘', label: 'CANCEL', color: 'muted' },
  wont_do:            { symbol: '─', label: 'SKIP', color: 'muted' },
};

// Agent activity indicator (shown alongside status):
const AGENT_DISPLAY = {
  working:     { dot: true, label: 'Agent working', color: 'green-pulse' },
  blocked:     { dot: true, label: 'Agent blocked', color: 'red' },
  needs_input: { dot: true, label: 'Needs input', color: 'yellow-pulse' },
  completed:   { dot: false, label: 'Agent done', color: 'green' },
  failed:      { dot: true, label: 'Agent failed', color: 'red' },
  null:        { dot: false, label: '', color: 'none' },
};
```

### 12.6 Agent Status → UI Reactions

| agentStatus Change | UI Reaction |
|-------------------|-------------|
| `null → working` | Pulsing green dot appears on task. Terminal shows activity. |
| `working → blocked` | Red dot on task. May show "Agent blocked" tooltip. |
| `working → needs_input` | Yellow pulsing dot. May show notification to user. |
| `working → completed` | Status changes to "review". Green checkmark. Awaits human approval. |
| `working → failed` | Red dot. Error state. Session may have exited. |

---

## 13. Subtask Model & Hierarchy

### 13.1 Core Principle: Subtasks ARE Tasks

A subtask is a regular `MaestroTask` with `parentId` set to the parent task's ID. There is **no separate subtask type**. The server stores them identically — the parent-child relationship is expressed solely through the `parentId` field.

```typescript
// A subtask is just a task with parentId set
const subtask: MaestroTask = {
  id: "task_789",
  projectId: "proj_123",
  parentId: "task_456",       // ← This makes it a subtask of task_456
  title: "Implement login validation",
  description: "...",
  status: "todo",
  agentStatus: null,
  priority: "medium",
  sessionIds: [],              // Subtask has its own sessions
  // ... all other MaestroTask fields
};

// A root task has parentId: null
const rootTask: MaestroTask = {
  id: "task_456",
  parentId: null,              // ← Root task
  title: "Build authentication system",
  // ...
};
```

### 13.2 Fetching Subtasks

Subtasks are fetched from the server and assembled into a tree client-side.

```
Data retrieval options:

1. Fetch all tasks for project, build tree client-side:
   GET /api/tasks?projectId=proj_123
   → Returns ALL tasks (root + subtasks)
   → Client filters: roots = tasks.filter(t => !t.parentId)
   → Client groups: children[parentId] = tasks.filter(t => t.parentId === parentId)

2. Fetch children of a specific task:
   GET /api/tasks/:id/children
   → Returns direct children only (one level)
   → Use for lazy-loading deep hierarchies

3. Filter by parentId:
   GET /api/tasks?projectId=proj_123&parentId=task_456
   → Returns children of task_456
```

**Recommended approach**: Option 1 (fetch all, build tree). Since `useTasks(projectId)` already fetches all tasks for the project, the tree can be built from that data without extra API calls.

### 13.3 Hierarchical Display in Task List

The task list shows root tasks at the top level, with subtasks nested underneath each parent. Both root tasks and subtasks show their own session counts and status.

```
MaestroPanel Task List:
─────────────────────────────────────────────────────
▸ Build authentication system     RUN  2m ago  ◉ 2
    ├── Implement login validation    RUN  1m ago  ◉ 1
    ├── Add password reset flow       IDLE 5m ago
    └── Write auth tests             DONE 10m ago  ✓
▸ Fix dashboard layout             IDLE 1h ago
    └── Adjust grid breakpoints      IDLE 1h ago
▸ Setup CI pipeline                QUEUE 3h ago
─────────────────────────────────────────────────────

Key:
  ▸/▾     = Expand/collapse subtasks + details
  ◉ 2     = 2 active sessions on this task
  RUN/IDLE = Task status badge
```

**Building the tree in the component:**

```typescript
// In MaestroPanel or a derived hook:

function useTaskTree(projectId: string) {
  const { tasks, loading, error } = useTasks(projectId);

  const tree = useMemo(() => {
    // Separate root tasks and subtasks
    const roots: MaestroTask[] = [];
    const childrenMap: Map<string, MaestroTask[]> = new Map();

    for (const task of tasks) {
      if (!task.parentId) {
        roots.push(task);
      } else {
        const siblings = childrenMap.get(task.parentId) || [];
        siblings.push(task);
        childrenMap.set(task.parentId, siblings);
      }
    }

    // Attach children to each root
    return roots.map(root => ({
      ...root,
      subtasks: childrenMap.get(root.id) || [],
    }));
  }, [tasks]);

  return { tree, loading, error };
}
```

### 13.4 Subtask Creation

Subtask creation uses the same `POST /api/tasks` endpoint with `parentId` set.

```
UI Flow:
─────────
1. User expands a task in the task list
2. User clicks "+ Add subtask" button within the expanded task
3. Inline input appears (or CreateTaskModal opens with parentId pre-set)
4. User enters subtask title (and optionally description, priority)
5. Submit

API Call:
─────────
POST /api/tasks
{
  "projectId": "proj_123",
  "parentId": "task_456",      ← Links to parent
  "title": "Implement login validation",
  "description": "Add email format and password strength checks",
  "priority": "medium"
}

Server Processing:
──────────────────
1. Create task with parentId = task_456
2. Update cache
3. Emit WebSocket event: task:created
   { event: "task:created", data: { id: "task_789", parentId: "task_456", ... } }

UI Receives WebSocket Event:
────────────────────────────
1. useMaestroStore.handleMessage receives task:created
2. tasks Map updated: tasks.set("task_789", subtaskData)
3. useTaskTree recomputes → subtask appears under parent
4. Parent task's subtask count updates
5. No page reload needed — reactive via Zustand subscription
```

**Inline subtask creation (preferred UX):**

```typescript
// In TaskListItem expanded section:
<div className="subtaskCreator">
  <input
    placeholder="Add subtask..."
    value={newSubtaskTitle}
    onChange={e => setNewSubtaskTitle(e.target.value)}
    onKeyDown={async (e) => {
      if (e.key === 'Enter' && newSubtaskTitle.trim()) {
        await createTask({
          projectId: task.projectId,
          parentId: task.id,           // ← Key: links to parent
          title: newSubtaskTitle.trim(),
          description: '',
          priority: 'medium',
        });
        setNewSubtaskTitle('');
      }
    }}
  />
</div>
```

### 13.5 Clicking Subtask → Task Detail Modal

Clicking any subtask in the hierarchy opens the **same TaskDetailModal** used for root tasks, loaded with the subtask's `id`. Subtasks are full tasks — the modal shows all the same fields.

```
User clicks subtask "Implement login validation"
    │
    ▼
onSelect(subtask.id) called
    │
    ▼
TaskDetailModal opens with taskId = "task_789"
    │
    ├── Modal fetches/reads task from useMaestroStore.tasks.get("task_789")
    ├── Shows: title, description, status, priority, timeline
    ├── Shows: parent breadcrumb → "Build authentication system" > "Implement login validation"
    ├── Shows: active sessions for this subtask (from useTaskSessions("task_789"))
    ├── Shows: this subtask's own children (if any — supports deep nesting)
    └── Actions: edit, change status, spawn session, delete
```

**Parent breadcrumb:**

```typescript
// Build breadcrumb trail from parentId chain:
function useTaskBreadcrumb(taskId: string): MaestroTask[] {
  const tasks = useMaestroStore(s => s.tasks);
  const trail: MaestroTask[] = [];
  let current = tasks.get(taskId);

  while (current?.parentId) {
    const parent = tasks.get(current.parentId);
    if (parent) trail.unshift(parent);
    current = parent;
  }

  return trail; // [grandparent, parent] (task itself not included)
}
```

### 13.6 Active Sessions Per Subtask

Each subtask independently tracks its own sessions. The task list shows session counts and status indicators for every level of the hierarchy.

```
Task: Build authentication system          ◉ 2 sessions
  ├── Implement login validation           ◉ 1 session     ← own session
  ├── Add password reset flow              (no sessions)
  └── Write auth tests                     ◉ 1 session     ← own session
```

**Data retrieval:**

```typescript
// Each subtask uses the same hooks as root tasks:

// In the subtask row component:
const sessionCount = useTaskSessionCount(subtask.id);
// → Counts sessions from useMaestroStore.sessions where
//    session.taskIds.includes(subtask.id) && session.status !== 'completed'

// On expand, show full session list:
const { sessions } = useTaskSessions(subtask.id);
// → Returns MaestroSession[] where session.taskIds.includes(subtask.id)
```

**Subtask session display in task list:**

```
▾ Build authentication system                    RUN  ◉ 2
    ├── ▸ Implement login validation              RUN  ◉ 1
    │       Session: "Auth worker" [running] ↗ ×
    ├──   Add password reset flow                 IDLE
    └──   Write auth tests                        DONE ✓
```

- ◉ N = number of active (non-completed) sessions on this specific task/subtask
- Clicking ▸ on a subtask expands it to show its sessions (and its own sub-subtasks if any)
- ↗ = Jump to terminal for that session
- × = Remove task from session

### 13.7 Spawning Sessions on Subtasks

Subtasks can have sessions spawned on them independently, using the same spawn flow as root tasks.

```
User clicks ▶ (play/execute) on subtask "Implement login validation"
    │
    ▼
Same unified spawn flow (Section 7):
POST /api/sessions/spawn {
  projectId: "proj_123",
  taskIds: ["task_789"],          ← The subtask's ID
  role: "worker",
  spawnSource: "ui"
}
    │
    ▼
Server generates manifest containing the subtask data
    │
    ▼
session:spawn WebSocket event received
    │
    ▼
Terminal created, agent works on subtask specifically
    │
    ▼
Parent task's aggregate session count updates:
  - Subtask "task_789" now has sessionIds: ["sess_new"]
  - Parent shows total sessions across itself + children (optional)
```

### 13.8 WebSocket Real-time Updates for Subtasks

All subtask changes propagate via the standard task events. No special subtask-specific events are needed since subtasks are tasks.

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│ WebSocket Event      │ Subtask-Specific UI Impact                       │
├─────────────────────┼──────────────────────────────────────────────────┤
│ task:created         │ If data.parentId !== null:                        │
│                      │   → useTaskTree recomputes                       │
│                      │   → New subtask appears under parent in list     │
│                      │   → Parent's subtask count badge updates         │
│                      │                                                  │
│ task:updated         │ If updated task has parentId:                     │
│                      │   → Subtask row re-renders with new status       │
│                      │   → Parent may show aggregate status change      │
│                      │   → If agentStatus→completed on subtask:         │
│                      │     subtask status→review (auto)                 │
│                      │                                                  │
│ task:deleted         │ If deleted task has parentId:                     │
│                      │   → Subtask removed from parent's children       │
│                      │   → Parent's subtask count decrements            │
│                      │   → useTaskTree recomputes                       │
│                      │                                                  │
│ task:session_added   │ Works identically for subtasks:                   │
│                      │   → useTaskSessionCount(subtaskId) recomputes    │
│                      │   → Session badge appears/increments on subtask  │
│                      │   → Parent task may show aggregate change        │
│                      │                                                  │
│ task:session_removed │ Works identically for subtasks:                   │
│                      │   → Session badge decrements on subtask          │
│                      │                                                  │
│ session:updated      │ If session.taskIds includes a subtask ID:        │
│                      │   → Subtask's session list updates (status)      │
│                      │   → E.g., session goes running→completed:        │
│                      │     subtask's active session count decrements    │
│                      │                                                  │
│ session:spawn        │ If taskIds includes a subtask ID:                 │
│                      │   → Terminal created (same as root task)          │
│                      │   → Subtask's session count increments           │
└─────────────────────┴──────────────────────────────────────────────────┘
```

### 13.9 Parent-Child Aggregate Display (Optional Enhancement)

A parent task can optionally show aggregate information from its children:

```typescript
// Aggregate subtask progress:
function useSubtaskProgress(parentTaskId: string) {
  const { tasks } = useTasks(projectId);

  return useMemo(() => {
    const children = tasks.filter(t => t.parentId === parentTaskId);
    if (children.length === 0) return null;

    const completed = children.filter(t =>
      t.status === 'done' || t.status === 'cancelled' || t.status === 'wont_do'
    ).length;

    const totalSessions = children.reduce((sum, child) => {
      // Count active sessions across all children
      return sum + (child.sessionIds?.length || 0);
    }, 0);

    return {
      total: children.length,
      completed,
      progress: completed / children.length,  // 0..1
      totalActiveSessions: totalSessions,
    };
  }, [tasks, parentTaskId]);
}

// Display: "Build auth system [3/5 subtasks] ◉ 4 sessions"
```

### 13.10 Deep Nesting

Subtasks can themselves have children (sub-subtasks). The data model supports arbitrary depth via `parentId` chains. However, the UI should limit visual nesting for readability.

```
Recommended: Max 2-3 levels of visual nesting in the task list

Level 0: Root task
Level 1:   └── Subtask
Level 2:       └── Sub-subtask
Level 3+:         └── (flat list or "N more levels..." indicator)

TaskDetailModal: Always shows full depth when viewing any task.
```

---

## Appendix A: ID Format Convention

```
{prefix}_{timestamp}_{random9}

Examples:
  proj_1738713600000_x7k9m2p4q
  task_1738713600000_a3b5c7d9e
  sess_1738713600000_f1g2h3j4k
  evt_1738713600000_m5n6p7q8r
```

## Appendix B: Server Cache Behavior

The Maestro server uses a **write-through cache** pattern:

- **Reads**: Served from in-memory cache (1-5ms). No CLI spawn needed.
- **Writes**: Go through CLI first (source of truth), then cache, then event.
- **Write order**: CLI → Cache → Event → HTTP Response (strict order).
- **Consistency**: Strong. Cache only updated after CLI confirms.
- **On startup**: Cache populated from CLI (`~200-500ms` one-time).
- **UI impact**: Reads are effectively instant. No need for client-side caching layer.

## Appendix C: Manifest Schema (v1.0)

The manifest file generated by the server and read by the CLI:

```typescript
interface Manifest {
  manifestVersion: "1.0";
  role: "worker" | "orchestrator";
  tasks: TaskData[];                    // ALWAYS an array (multi-task model)
  skills?: string[];
  session: {
    model: "sonnet" | "opus" | "haiku";
    permissionMode: "acceptEdits" | "interactive" | "readOnly";
    thinkingMode?: "auto" | "interleaved" | "disabled";
    workingDirectory?: string;
  };
  context?: {
    codebaseContext?: {
      relevantFiles: string[];
      patterns: string[];
      testingSetup: string;
      commands: Record<string, string>;
    };
    relatedTasks?: Array<{
      id: string;
      title: string;
      status: string;
      relationship: string;
    }>;
    projectStandards?: {
      codeStyle: string;
      testing: string;
      documentation: string;
      gitWorkflow: string;
    };
  };
}
```

## Appendix D: File System Layout

```
~/.maestro/
├── data/                          # Server storage (owned by server)
│   ├── projects/                  # proj_*.json
│   ├── tasks/                     # {projectId}/task_*.json
│   └── sessions/                  # sess_*.json
├── sessions/                      # Generated manifests (by CLI)
│   └── {sessionId}/
│       └── manifest.json
├── config.json                    # User-level CLI config
└── logs/                          # CLI logs

~/.skills/                         # Standard Claude Code skills directory
```
