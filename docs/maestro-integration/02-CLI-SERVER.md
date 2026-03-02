# CLI → Server Integration

The CLI communicates with the server via REST APIs for **all** task and session operations. The server is the single source of truth.

## Architecture Change

**Previous (Local-First)**:
```
CLI writes → Local Storage → safeNotify → Server (optional)
```

**Current (Server-Only)**:
```
CLI → REST API → Server → ~/.maestro/data/
```

The CLI no longer writes to local storage. All writes go through the server API.

## API Client

| Aspect | Value |
|--------|-------|
| **File** | `maestro-cli/src/api.ts` |
| **Class** | `APIClient` |
| **Base URL** | `MAESTRO_API_URL` or `MAESTRO_SERVER_URL` (default: `http://localhost:3000`) |

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `MAESTRO_API_URL` | Server base URL | `http://localhost:3000` |
| `MAESTRO_SERVER_URL` | Alternative URL variable | `http://localhost:3000` |
| `MAESTRO_PROJECT_ID` | Current project context | - |
| `MAESTRO_SESSION_ID` | Current session context | - |
| `MAESTRO_TASK_IDS` | Comma-separated task IDs | - |
| `MAESTRO_RETRIES` | Number of retries | `3` |
| `MAESTRO_RETRY_DELAY` | Retry delay (ms) | `1000` |
| `MAESTRO_DEBUG` | Enable debug logging | `false` |

## Retry Strategy

- 3 retries with exponential backoff
- 4xx errors: **no retry** (client error)
- 5xx errors: **retry** (server error)
- Network errors: **retry**

## REST Endpoints

### Project Endpoints

| Endpoint | Method | Command | Description |
|----------|--------|---------|-------------|
| `/api/projects` | GET | `project list` | List all projects |
| `/api/projects` | POST | `project create` | Create project |
| `/api/projects/{id}` | GET | `project get` | Get project details |
| `/api/projects/{id}` | DELETE | `project delete` | Delete project |

### Task Endpoints

| Endpoint | Method | Command | Description |
|----------|--------|---------|-------------|
| `/api/tasks` | GET | `task list` | List tasks (with filters) |
| `/api/tasks` | POST | `task create` | Create task |
| `/api/tasks/{id}` | GET | `task get` | Get task details |
| `/api/tasks/{id}` | PATCH | `task update` | Update task |
| `/api/tasks/{id}/children` | GET | `task children` | Get child tasks |
| `/api/tasks/{id}/timeline` | POST | `update` commands | Add timeline event |

**Query Parameters for `/api/tasks`:**
- `projectId`: Filter by project
- `status`: Filter by status
- `priority`: Filter by priority

### Session Endpoints

| Endpoint | Method | Command | Description |
|----------|--------|---------|-------------|
| `/api/sessions` | GET | `session list` | List sessions |
| `/api/sessions` | POST | `session register` | Register session |
| `/api/sessions/{id}` | GET | `session info` | Get session details |
| `/api/sessions/{id}` | PATCH | `session complete` | Update session status |
| `/api/sessions/spawn` | POST | `session spawn` | Spawn new session |
| `/api/sessions/{id}/events` | POST | `track-file` | Add session event |

## Request/Response Schemas

### Create Task

**Request:**
```typescript
POST /api/tasks
{
  projectId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  parentId?: string;  // For hierarchical tasks
}
```

**Response:**
```typescript
{
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  sessionIds: string[];
  timeline: TimelineEvent[];
  // ... other fields
}
```

### Update Task

**Request:**
```typescript
PATCH /api/tasks/{taskId}
{
  status?: TaskStatus;
  priority?: TaskPriority;
  title?: string;
  updateSource?: 'session' | 'user';
  sessionId?: string;
}
```

### Spawn Session

**Request:**
```typescript
POST /api/sessions/spawn
{
  projectId: string;
  taskIds: string[];
  role: 'worker' | 'orchestrator';
  spawnSource: 'session';
  sessionId?: string;         // Parent session ID
  skills: string[];
  sessionName: string;
  context?: Record<string, any>;
}
```

**Response:**
```typescript
{
  sessionId: string;
  manifestPath: string;
  manifest?: any;
}
```

### Add Timeline Event

**Request:**
```typescript
POST /api/tasks/{taskId}/timeline
{
  type: 'update' | 'blocker' | 'milestone';
  message: string;
  sessionId?: string;
}
```

### Add Session Event

**Request:**
```typescript
POST /api/sessions/{sessionId}/events
{
  type: string;           // e.g., 'file_modified'
  data?: any;             // Event-specific data
}
```

## Update Commands

The CLI provides shorthand commands that map to API calls:

| Command | API Call | Status Change |
|---------|----------|---------------|
| `update <message>` | POST /timeline | None |
| `update:progress <msg>` | PATCH + POST /timeline | `in_progress` |
| `update:blocked <msg>` | PATCH + POST /timeline | `blocked` |
| `update:needs-input <msg>` | POST /timeline | None |
| `update:complete <msg>` | PATCH + POST /timeline | `completed` |
| `update:error <msg>` | PATCH + POST /timeline | `blocked` |

## Local Storage (Read-Only Cache)

The CLI can still read from `~/.maestro/data/` as a cache, but:
- **All writes go through the server API**
- **Server is the single source of truth**
- **CLI requires server to be running for write operations**

## Data Flow

```
┌─────────────┐     REST API calls        ┌─────────────┐
│  Maestro    │ ─────────────────────────►│   Server    │
│    CLI      │ ◄─────────────────────────│             │
└─────────────┘     JSON responses        └──────┬──────┘
                                                 │
                                                 ▼
                                          ~/.maestro/data/
                                          (Server writes)
```

## Error Handling

Server errors now propagate to the user:
- Connection refused: Show error, suggest starting server
- 4xx errors: Show validation/not found errors
- 5xx errors: Retry, then show server error

## No WebSocket

The CLI uses **HTTP only** - no WebSocket connections. Real-time updates are handled by the UI.
