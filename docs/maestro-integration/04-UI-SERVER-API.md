# UI → Server Integration (REST API)

The UI communicates with the server via REST APIs through a centralized client utility.

## API Client

| Aspect | Value |
|--------|-------|
| **File** | `maestro-ui/src/utils/MaestroClient.ts` |
| **Base URL** | `http://localhost:3000/api` |
| **HTTP Client** | Native `fetch` API |
| **Error Handling** | Throws on non-OK responses |

## Usage Locations

| Location | Purpose |
|----------|---------|
| `useMaestroStore.ts` | Zustand store API methods |
| `MaestroContext.tsx` | React context API methods |
| `maestroService.ts` | Session spawning |
| `maestroHelpers.ts` | Utility functions |
| `useProjectStore.ts` | Project CRUD |
| `initApp.ts` | Startup sync |

## REST Endpoints

### Projects

| Endpoint | Method | Function | Response |
|----------|--------|----------|----------|
| `/projects` | GET | `getProjects()` | `MaestroProject[]` |
| `/projects/{id}` | GET | `getProject(id)` | `MaestroProject` |
| `/projects` | POST | `createProject(data)` | `MaestroProject` |
| `/projects/{id}` | PUT | `updateProject(id, data)` | `MaestroProject` |
| `/projects/{id}` | DELETE | `deleteProject(id)` | `{success, id}` |

### Tasks

| Endpoint | Method | Function | Response |
|----------|--------|----------|----------|
| `/tasks` | GET | `getTasks(projectId?)` | `MaestroTask[]` |
| `/tasks/{id}` | GET | `getTask(id)` | `MaestroTask` |
| `/tasks` | POST | `createTask(data)` | `MaestroTask` |
| `/tasks/{id}` | PATCH | `updateTask(id, updates)` | `MaestroTask` |
| `/tasks/{id}` | DELETE | `deleteTask(id)` | `{success}` |
| `/tasks/{id}/children` | GET | `getTaskChildren(id)` | `MaestroTask[]` |
| `/tasks/{id}/timeline` | POST | `addTimelineEvent(id, event)` | `MaestroTask` |

### Sessions

| Endpoint | Method | Function | Response |
|----------|--------|----------|----------|
| `/sessions` | GET | `getSessions(taskId?)` | `MaestroSession[]` |
| `/sessions/{id}` | GET | `getSession(id)` | `MaestroSession` |
| `/sessions` | POST | `createSession(data)` | `MaestroSession` |
| `/sessions/{id}` | PATCH | `updateSession(id, updates)` | `MaestroSession` |
| `/sessions/{id}` | DELETE | `deleteSession(id)` | `{success}` |
| `/sessions/{sessionId}/tasks/{taskId}` | POST | `addTaskToSession(sid, tid)` | `MaestroSession` |
| `/sessions/{sessionId}/tasks/{taskId}` | DELETE | `removeTaskFromSession(sid, tid)` | `MaestroSession` |
| `/sessions/spawn` | POST | `spawnSession(data)` | `SpawnSessionResponse` |

### Skills

| Endpoint | Method | Function | Response |
|----------|--------|----------|----------|
| `/skills` | GET | `getSkills()` | `AgentSkill[]` |

## Request Schemas

### CreateTaskPayload

```typescript
interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  initialPrompt?: string;
  status?: TaskStatus;
  projectId?: string;
  parentId?: string;   // For hierarchical tasks
}
```

### UpdateTaskPayload

```typescript
interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  initialPrompt?: string;
}
```

### SpawnSessionPayload

```typescript
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role: 'worker' | 'orchestrator';
  spawnSource: 'ui' | 'session';
  sessionName: string;
  skills: string[];
}
```

### SpawnSessionResponse

```typescript
interface SpawnSessionResponse {
  sessionId: string;
  manifestPath: string;
  manifest?: any;
}
```

### TimelineEventPayload

```typescript
interface TimelineEventPayload {
  type: 'created' | 'status_change' | 'session_started' | 'session_ended' | 'update';
  message: string;
  sessionId?: string;
  oldStatus?: TaskStatus;
  newStatus?: TaskStatus;
}
```

## Response Schemas

### MaestroTask

```typescript
interface MaestroTask {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  initialPrompt: string;
  sessionIds: string[];
  skillIds: string[];
  agentIds: string[];
  dependencies: string[];
  timeline: TimelineEvent[];
}
```

### MaestroSession

```typescript
interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];
  name: string;
  agentId?: string;
  env: Record<string, string>;
  status: MaestroSessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: SessionEvent[];
  metadata?: Record<string, any>;
}
```

### MaestroProject

```typescript
interface MaestroProject {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}
```

## Startup Sync Flow

On app initialization, the UI syncs with the server:

```
1. UI starts
   │
   ▼
2. Load local projects from storage
   │
   ▼
3. GET /api/projects (fetch server projects)
   │
   ▼
4. Merge: server projects take precedence
   │
   ▼
5. For each local-only project:
   POST /api/projects (sync to server)
   │
   ▼
6. UI ready with synced state
```

## Error Handling

```typescript
async request<T>(method, endpoint, body?): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
```

The UI shows error states in components when API calls fail.

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Maestro UI                          │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐   │
│  │  Component  │───►│   Store/    │───►│  Maestro  │   │
│  │             │    │   Context   │    │  Client   │   │
│  └─────────────┘    └─────────────┘    └─────┬─────┘   │
│                                              │         │
└──────────────────────────────────────────────┼─────────┘
                                               │
                                     fetch()   │
                                               ▼
                                    ┌─────────────────┐
                                    │  Maestro Server │
                                    │  /api/*         │
                                    └─────────────────┘
```
