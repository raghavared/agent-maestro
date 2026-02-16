# Maestro - Current Architecture Reference

> This document describes the **existing** system as of the `bun-fixes` branch. It is the ground truth for any implementation work.

---

## 1. System Overview

Maestro is an agentic task management system with three layers:

```
maestro-ui (Tauri/React)  <-- WebSocket + REST -->  maestro-server (Express)  <-- CLI spawn -->  maestro-cli (Commander.js)
```

- **maestro-server**: Express + WebSocket server. Persists data to filesystem. Manages projects, tasks, sessions, queues, mail, and ordering.
- **maestro-cli**: CLI tool installed as `maestro`. Used by both humans and spawned agents. Reads manifests, generates prompts, spawns Claude/Codex/Gemini agents.
- **maestro-ui**: React app (Tauri desktop or web). Connects via REST API + WebSocket for real-time updates.

---

## 2. Server Architecture

### 2.1 Layered Design

```
API Layer (routes)
  -> Application Layer (services)
    -> Domain Layer (interfaces)
      -> Infrastructure Layer (implementations)
```

### 2.2 Dependency Injection

`container.ts` wires all dependencies:

```typescript
interface Container {
  // Infrastructure
  config: Config;
  logger: ILogger;
  idGenerator: IIdGenerator;
  eventBus: IEventBus;

  // Repositories (filesystem-backed)
  projectRepo: IProjectRepository;
  taskRepo: ITaskRepository;
  sessionRepo: ISessionRepository;
  queueRepo: IQueueRepository;
  mailRepo: IMailRepository;
  orderingRepo: IOrderingRepository;

  // Loaders
  skillLoader: ISkillLoader;

  // Services
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  queueService: QueueService;
  mailService: MailService;
  orderingService: OrderingService;
}
```

### 2.3 Configuration

`Config` class loads from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DATA_DIR` | `~/.maestro/data` | Task/session/project JSON storage |
| `SESSION_DIR` | `~/.maestro/sessions` | Manifest and session working files |
| `SKILLS_DIR` | `~/.claude/skills` | Claude Code skill files |
| `SERVER_URL` | `http://localhost:3000` | Server URL (written to `DATA_DIR/server-url` for CLI auto-discovery) |

### 2.4 Storage Layout

```
~/.maestro/data/
  projects/{projectId}.json
  tasks/{projectId}/{taskId}.json
  sessions/{sessionId}.json
  queues/{sessionId}.json
  mail/{mailId}.json
  ordering/task_{projectId}.json
  ordering/session_{projectId}.json
  modals/{modalId}.html
  server-url                         # contains "http://localhost:3000"

~/.maestro/sessions/
  {sessionId}/
    manifest.json                    # Generated manifest for this session
```

---

## 3. Core Entities

### 3.1 Project

```typescript
interface Project {
  id: string;              // "proj_<timestamp>_<random>"
  name: string;
  workingDir: string;      // Absolute path to project root
  description?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.2 Task

```typescript
interface Task {
  id: string;              // "task_<timestamp>_<random>"
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;      // 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked' | 'archived'
  priority: TaskPriority;  // 'low' | 'medium' | 'high'
  taskSessionStatuses?: Record<string, TaskSessionStatus>;  // { [sessionId]: 'queued'|'working'|'blocked'|'completed'|'failed'|'skipped' }
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  initialPrompt: string;

  // Relationships
  sessionIds: string[];       // Sessions working on this task
  skillIds: string[];
  agentIds: string[];
  dependencies: string[];
  referenceTaskIds?: string[];  // Context: docs from these tasks are provided to agent

  // Configuration
  model?: string;
  agentTool?: AgentTool;       // 'claude-code' | 'codex' | 'gemini'
  pinned?: boolean;

  // DEPRECATED (to be removed in team member rework)
  taskType?: 'task' | 'team-member';
  teamMemberMetadata?: TeamMemberMetadata;
}
```

**Key behavior:** Sessions can ONLY update `taskSessionStatuses` (via backward-compat `sessionStatus` + `sessionId`). Users can update all fields. This is enforced in `TaskService.updateTask()`.

### 3.3 Session

```typescript
interface Session {
  id: string;              // "sess_<timestamp>_<random>"
  projectId: string;
  taskIds: string[];       // Many-to-many: multiple tasks per session
  name: string;
  agentId?: string;
  env: Record<string, string>;  // Environment variables passed to agent
  strategy: WorkerStrategy | OrchestratorStrategy;
  status: SessionStatus;   // 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped'
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: SessionEvent[];
  timeline: SessionTimelineEvent[];
  docs: DocEntry[];
  metadata?: Record<string, any>;  // { skills, spawnedBy, spawnSource, mode, strategy, context }
  needsInput?: { active: boolean; message?: string; since?: number };
}
```

### 3.4 Relationships

```
Project 1:N Task
Project 1:N Session
Task N:M Session   (via task.sessionIds / session.taskIds, maintained bidirectionally)
Task 1:N Task      (parent-child via task.parentId)
```

---

## 4. API Routes

### 4.1 Projects (`/api/projects`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project (fails if has tasks/sessions) |

### 4.2 Tasks (`/api/tasks`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks?projectId=X&status=Y&parentId=Z&taskType=T` | List tasks with filters |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task (cascade deletes descendants) |
| POST | `/tasks/:id/timeline` | Proxy to session timeline |
| GET | `/tasks/:id/docs` | Aggregate docs from all sessions |
| GET | `/tasks/:id/children` | Get child tasks |

### 4.3 Sessions (`/api/sessions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions?projectId=X&taskId=Y&status=Z` | List sessions |
| POST | `/sessions` | Create session |
| GET | `/sessions/:id` | Get session |
| PATCH | `/sessions/:id` | Update session |
| DELETE | `/sessions/:id` | Delete session |
| POST | `/sessions/:id/events` | Add event |
| POST | `/sessions/:id/timeline` | Add timeline event |
| POST | `/sessions/:id/docs` | Add document |
| GET | `/sessions/:id/docs` | Get documents |
| POST | `/sessions/:id/tasks/:taskId` | Add task to session |
| DELETE | `/sessions/:id/tasks/:taskId` | Remove task from session |
| POST | `/sessions/:id/modal` | Show modal in UI |
| POST | `/sessions/:id/modal/:modalId/actions` | Send modal action to agent |
| POST | `/sessions/:id/modal/:modalId/close` | Close modal |
| **POST** | **`/sessions/spawn`** | **Spawn session (complex - generates manifest, creates session, emits spawn event)** |

### 4.4 Queue (`/api/sessions/:id/queue`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions/:id/queue` | Get full queue state |
| GET | `/sessions/:id/queue/top` | Peek next item |
| POST | `/sessions/:id/queue/start` | Start processing next |
| POST | `/sessions/:id/queue/complete` | Complete current |
| POST | `/sessions/:id/queue/fail` | Fail current |
| POST | `/sessions/:id/queue/skip` | Skip current/next |
| GET | `/sessions/:id/queue/items` | List all items |
| POST | `/sessions/:id/queue/push` | Add task to queue |

### 4.5 Mail (`/api/mail`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/mail` | Send mail message |
| GET | `/mail/inbox/:id` | Get session inbox |
| GET | `/mail/wait/:id` | Long-poll wait for mail (120s timeout) |
| GET | `/mail/:id` | Get message |
| DELETE | `/mail/:id` | Delete message |

### 4.6 Skills (`/api/skills`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/skills` | List all skills |
| GET | `/skills/:id` | Get skill |
| GET | `/skills/mode/:mode` | Get skills for mode |
| POST | `/skills/:id/reload` | Reload skill from disk |

### 4.7 Ordering (`/api/ordering`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ordering/:entityType/:projectId` | Get ordering |
| PUT | `/ordering/:entityType/:projectId` | Save ordering |

---

## 5. Event System

### 5.1 Event Bus

`InMemoryEventBus` implements `IEventBus` (pub-sub). All services emit events which `WebSocketBridge` broadcasts to connected clients.

### 5.2 Event Names (Convention: `entity:action` with underscores)

```
project:created, project:updated, project:deleted
task:created, task:updated, task:deleted
task:session_added, task:session_removed
session:created, session:updated, session:deleted, session:spawn
session:task_added, session:task_removed
session:modal, session:modal_action, session:modal_closed
notify:task_completed, notify:task_failed, notify:task_blocked
notify:task_in_review
notify:task_session_completed, notify:task_session_failed
notify:session_completed, notify:session_failed
notify:needs_input, notify:progress
mail:received, mail:deleted
queue:created, queue:item_started, queue:item_completed, queue:item_failed, queue:item_skipped
```

### 5.3 WebSocket Bridge

- Subscribes to all domain events
- Broadcasts JSON `{ type, event, data, timestamp }` to connected WebSocket clients
- Supports per-client session subscription filtering (clients send `{ type: 'subscribe', sessionIds: [...] }`)
- Unsubscribed clients receive ALL events

---

## 6. Session Spawn Flow (Critical Path)

This is the most complex flow in the system.

### 6.1 Trigger

UI or agent calls `POST /sessions/spawn` with:

```typescript
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  mode?: 'execute' | 'coordinate';   // defaults to 'execute'
  strategy?: string;                  // defaults to 'simple'
  spawnSource?: 'ui' | 'session';
  sessionId?: string;                 // parent session ID when spawnSource='session'
  sessionName?: string;
  skills?: string[];
  model?: string;
  agentTool?: AgentTool;
  context?: Record<string, any>;
  teamMemberIds?: string[];           // For coordinate mode
}
```

### 6.2 Server Processing

1. Validate inputs (projectId, taskIds, mode, strategy)
2. If `spawnSource === 'session'`, verify parent session exists
3. Collect `referenceTaskIds` from all tasks
4. Create session with `status: 'spawning'`, `_suppressCreatedEvent: true`
5. If `strategy === 'queue'`, initialize queue via `QueueService`
6. Generate manifest via CLI: `maestro manifest generate --mode X --project-id Y --task-ids Z ...`
7. Update session with environment variables
8. Emit `session:spawn` event with full manifest and environment
9. Emit `task:session_added` for each task
10. Return `{ success, sessionId, manifestPath, session }`

### 6.3 Manifest Generation (CLI)

`ManifestGeneratorCLICommand` (in maestro-cli):
1. Reads tasks from local storage
2. Resolves model (max-model across tasks)
3. Builds `MaestroManifest` with tasks, session config, skills, context
4. If `teamMemberIds` provided, fetches team member data from tasks with `taskType: 'team-member'`
5. Writes manifest JSON to `SESSION_DIR/<sessionId>/manifest.json`

### 6.4 Agent Spawning (UI-side)

The UI receives the `session:spawn` WebSocket event and:
1. Reads the command (`maestro worker init` or `maestro orchestrator init`)
2. Spawns the CLI process with the environment variables
3. CLI reads manifest from `MAESTRO_MANIFEST_PATH`
4. `WhoamiRenderer` generates system prompt + task context using `PromptBuilder`
5. `AgentSpawner` selects the correct spawner (Claude/Codex/Gemini)
6. Spawner executes the agent with full prompt and configuration

### 6.5 Environment Variables Passed to Agent

```
MAESTRO_SESSION_ID, MAESTRO_MANIFEST_PATH, MAESTRO_SERVER_URL,
MAESTRO_MODE, MAESTRO_STRATEGY,
DATA_DIR, SESSION_DIR,
GEMINI_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
```

---

## 7. CLI Architecture

### 7.1 Entry Point

`maestro-cli/src/index.ts` registers all Commander.js commands.

### 7.2 Key Commands

| Command | Description |
|---------|-------------|
| `maestro manifest generate` | Generate manifest JSON for a session |
| `maestro worker init` | Initialize and spawn a worker agent |
| `maestro orchestrator init` | Initialize and spawn a coordinator agent |
| `maestro task {list,get,create,edit,delete,children}` | Task CRUD |
| `maestro task report {progress,complete,blocked,error}` | Task status reporting |
| `maestro session {info,report,docs,spawn,register,complete}` | Session operations |
| `maestro queue {top,start,complete,fail,skip,list,status,push}` | Queue operations |
| `maestro mail {send,inbox,reply,broadcast,wait}` | Inter-session messaging |
| `maestro show modal` | Display HTML modal in UI |
| `maestro whoami` | Print current session context |
| `maestro status` | Show project status |

### 7.3 Prompt System (Two-Layer)

**Layer 1: System Prompt** (`WhoamiRenderer.renderSystemPrompt()`)
- Calls `PromptBuilder.buildSystemXml()` → `<maestro_system_prompt>` XML
- Contains: identity, capabilities, workflow phases, commands

**Layer 2: Task Context** (`WhoamiRenderer.renderTaskContext()`)
- Calls `PromptBuilder.buildTaskXml()` → `<maestro_task_prompt>` XML
- Contains: task details, skills, team members (coordinate mode), session context, reference tasks

### 7.4 Agent Spawners

All implement `IAgentSpawner` interface. Factory: `AgentSpawner.getSpawner(manifest)`.

| Spawner | Agent Tool | System Prompt Method | Model Mapping |
|---------|-----------|---------------------|---------------|
| `ClaudeSpawner` | claude-code | `--append-system-prompt` | opus/sonnet/haiku (native) |
| `CodexSpawner` | codex | `-c developer_instructions=<json>` | gpt-5.3-codex / gpt-5.2-codex |
| `GeminiSpawner` | gemini | Concatenated with `[SYSTEM INSTRUCTIONS]` header | gemini-3-pro-preview / gemini-2.5-pro |

### 7.5 Command Permissions

Mode-based command visibility:
- **Execute mode:** Can report, manage own tasks, manage session, manage queue (if queue strategy), send mail
- **Coordinate mode:** All execute commands PLUS session:spawn, session:watch, session:list, task:create, task:edit, task:delete, task:tree, task:children

---

## 8. UI Architecture

### 8.1 Store (`useMaestroStore.ts`)

Zustand store managing:
- `tasks: Map<string, MaestroTask>`
- `sessions: Map<string, MaestroSession>`
- `activeModals: AgentModal[]`
- `taskOrdering: Map<string, string[]>`
- `sessionOrdering: Map<string, string[]>`
- WebSocket connection (singleton)
- CRUD actions for tasks and sessions

### 8.2 MaestroClient

HTTP client wrapping all REST API calls. Methods mirror server endpoints.

### 8.3 WebSocket

Global singleton connecting to `ws://localhost:3000`. Handles:
- Real-time task/session/notification updates
- Modal events
- Automatic reconnection with exponential backoff

### 8.4 Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| `MaestroPanel.tsx` | maestro-ui/src/components/maestro/ | Main panel with Tasks/Team/Skills tabs |
| `TaskListItem.tsx` | maestro-ui/src/components/maestro/ | Individual task row with play/pin/status |
| `TaskFilters.tsx` | maestro-ui/src/components/maestro/ | Task filtering controls |
| `SessionsSection.tsx` | maestro-ui/src/components/ | Session list in sidebar |
| `SortableTaskList.tsx` | maestro-ui/src/components/maestro/ | Drag-and-drop task ordering |

---

## 9. Strategies

### 9.1 Execute Mode Strategies

| Strategy | Description | CLI Commands |
|----------|-------------|--------------|
| `simple` | Single task, direct execution | Core + report |
| `queue` | FIFO multi-task processing | Core + report + queue:* |
| `tree` | (Not yet implemented) | - |

### 9.2 Coordinate Mode Strategies

| Strategy | Description |
|----------|-------------|
| `default` | Analyze → decompose → spawn → monitor → verify → complete |
| `intelligent-batching` | Groups related tasks for parallel execution |
| `dag` | Directed acyclic graph execution in topological order |

---

## 10. Deprecated: Team Member as Task Type

Currently team members are stored as tasks with `taskType: 'team-member'` and `teamMemberMetadata`. This is being replaced by a first-class TeamMember entity. See `02-team-members-design-v4.md`.

Fields to be removed:
- `TaskType` type alias
- `TeamMemberMetadata` interface
- `taskType` and `teamMemberMetadata` on Task, CreateTaskPayload, UpdateTaskPayload
