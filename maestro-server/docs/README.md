# Maestro Server Documentation

Complete technical documentation for the Maestro Server backend.

## 📋 Table of Contents

1. [01-OVERVIEW.md](./01-OVERVIEW.md) - System overview and architecture philosophy
2. [02-API-REFERENCE.md](./02-API-REFERENCE.md) - Complete REST API documentation
3. [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) - Data persistence and in-memory storage
4. [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) - Real-time event system
5. [05-DATA-MODELS.md](./05-DATA-MODELS.md) - Entity schemas and relationships
6. [06-FLOWS.md](./06-FLOWS.md) - End-to-end workflow diagrams
7. [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) - Visual architecture reference

---

## 🚀 Quick Start

### Installation

```bash
cd maestro-server
npm install
```

### Development

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t maestro-server .
docker run -p 3000:3000 -v ~/.maestro/data:/data maestro-server
```

---

## 🎯 What is Maestro Server?

Maestro Server is a **task orchestration backend** for multi-agent development workflows. It provides:

- **Project Management** - Organize work into structured projects
- **Task Orchestration** - Create and track hierarchical tasks with subtasks
- **Session Coordination** - Manage multiple concurrent agent sessions
- **Real-time Updates** - WebSocket broadcasting of state changes
- **Skill Integration** - Load and manage agent skill configurations

### Key Philosophy: CLI-First Architecture

The server is intentionally **dumb** - it's a data store and event broadcaster, nothing more:

- ❌ Server does NOT generate prompts
- ❌ Server does NOT execute commands
- ❌ Server does NOT contain orchestration logic
- ✅ Server ONLY stores data and broadcasts events

**Intelligence lives in the CLI.** The UI is a visualization layer.

```
Orchestration Logic → Maestro CLI
Data Storage → Maestro Server
Visualization → Agent Maestro
```

---

## 📦 Core Entities

### Project
Represents a codebase with a working directory.

```typescript
{
  id: "proj_1706789123456_k2j4n5l6m",
  name: "E-commerce Platform",
  workingDir: "/Users/dev/projects/ecommerce",
  description: "Main e-commerce platform",
  createdAt: 1706789123456,
  updatedAt: 1706789123456
}
```

### Task
A unit of work with status, subtasks, and timeline.

```typescript
{
  id: "task_1706790000000_xyz789",
  projectId: "proj_1706789123456_k2j4n5l6m",
  title: "Implement user authentication",
  status: "in_progress",
  priority: "high",
  sessionIds: ["sess_1706792222222_lmn678"],
  subtasks: [...],
  timeline: [...]
}
```

### Session
An active CLI session working on tasks.

```typescript
{
  id: "sess_1706792222222_lmn678",
  projectId: "proj_1706789123456_k2j4n5l6m",
  taskIds: ["task_1706790000000_xyz789"],
  status: "running",
  env: {...},
  metadata: {skills: ["maestro-worker"]}
}
```

### Subtask
A smaller unit within a task.

```typescript
{
  id: "k2j4n5l6m",
  taskId: "task_1706790000000_xyz789",
  title: "Create User model",
  completed: true,
  order: 0
}
```

---

## 🔌 API Overview

### Health Check
```bash
GET /health
```

### Projects
```bash
GET    /api/projects           # List all
POST   /api/projects           # Create
GET    /api/projects/:id       # Get by ID
PUT    /api/projects/:id       # Update
DELETE /api/projects/:id       # Delete
```

### Tasks
```bash
GET    /api/tasks              # List (filterable)
POST   /api/tasks              # Create
GET    /api/tasks/:id          # Get by ID
PATCH  /api/tasks/:id          # Update
DELETE /api/tasks/:id          # Delete
POST   /api/tasks/:id/timeline # Add timeline event
```

### Sessions
```bash
GET    /api/sessions           # List (filterable)
POST   /api/sessions           # Create
GET    /api/sessions/:id       # Get by ID
PATCH  /api/sessions/:id       # Update
DELETE /api/sessions/:id       # Delete
POST   /api/sessions/spawn     # Spawn new session (triggers UI)
```

### Subtasks
```bash
GET    /api/tasks/:taskId/subtasks           # List
POST   /api/tasks/:taskId/subtasks           # Create
PATCH  /api/tasks/:taskId/subtasks/:id       # Update
DELETE /api/tasks/:taskId/subtasks/:id       # Delete
```

See [02-API-REFERENCE.md](./02-API-REFERENCE.md) for complete API documentation.

---

## 🔄 WebSocket Events

Connect to `ws://localhost:3000` to receive real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
});
```

### Event Types

**Projects:**
- `project:created`
- `project:updated`
- `project:deleted`

**Tasks:**
- `task:created`
- `task:updated`
- `task:deleted`
- `task:session_added`
- `task:session_removed`

**Sessions:**
- `session:created`
- `session:updated`
- `session:deleted`
- `session:spawn_request` ⭐ (triggers UI to spawn terminal)
- `session:task_added`
- `session:task_removed`

**Subtasks:**
- `subtask:created`
- `subtask:updated`
- `subtask:deleted`

See [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) for complete event documentation.

---

## 💾 Data Storage

### Location

```
~/.maestro/data/
├── projects/
│   ├── proj_123.json
│   └── proj_456.json
├── tasks/
│   ├── proj_123/
│   │   ├── task_001.json
│   │   └── task_002.json
│   └── proj_456/
│       └── task_003.json
└── sessions/
    ├── sess_abc.json
    └── sess_def.json
```

### Storage Architecture

- **In-Memory:** Map structures for fast O(1) access
- **Persistent:** JSON files for durability
- **Auto-Save:** Saves after every CRUD operation
- **Migration:** Automatic schema migration on load

See [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) for storage implementation details.

---

## 🎬 Key Workflows

### 1. Project Setup

```bash
POST /api/projects
{
  "name": "My Project",
  "workingDir": "/path/to/project"
}
```

### 2. Task Creation

```bash
POST /api/tasks
{
  "projectId": "proj_123",
  "title": "Implement feature X",
  "priority": "high"
}
```

### 3. Session Spawning

```bash
POST /api/sessions/spawn
{
  "projectId": "proj_123",
  "taskIds": ["task_001"],
  "skills": ["maestro-worker"]
}
```

**What happens:**
1. Server creates session with `status: "spawning"`
2. Server broadcasts `session:spawn_request` via WebSocket
3. UI receives event and spawns terminal with env vars
4. CLI auto-initializes in terminal
5. CLI generates prompt and spawns Claude
6. Session status updates to `running`

### 4. Task Execution

```bash
# Mark task as in progress
PATCH /api/tasks/task_001
{
  "status": "in_progress"
}

# Report progress
POST /api/tasks/task_001/timeline
{
  "message": "Completed User model implementation"
}

# Mark complete
PATCH /api/tasks/task_001
{
  "status": "completed"
}
```

See [06-FLOWS.md](./06-FLOWS.md) for complete workflow diagrams.

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Maestro CLI   │  ← Orchestration logic, prompt generation
│  (Brain)        │
└────────┬────────┘
         │ HTTP API
         ▼
┌─────────────────┐
│ Maestro Server  │  ← Data store, event broadcaster
│ (Data Layer)    │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│   Agent Maestro     │  ← Visualization, terminal spawning
│ (View Layer)    │
└─────────────────┘
```

### Component Diagram

```
maestro-server/
├── src/
│   ├── server.ts         # HTTP + WebSocket setup
│   ├── storage.ts        # Data persistence layer
│   ├── websocket.ts      # Event broadcasting
│   ├── types.ts          # TypeScript definitions
│   ├── skills.ts         # Skill loading
│   ├── api/
│   │   ├── projects.ts   # Project CRUD
│   │   ├── tasks.ts      # Task CRUD
│   │   ├── sessions.ts   # Session CRUD + spawn
│   │   └── subtasks.ts   # Subtask CRUD
│   └── services/
│       └── promptGenerator.ts  # ⚠️ Deprecated
└── docs/
    └── ... (you are here)
```

See [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) for visual architecture reference.

---

## 🔗 Relationships

### Many-to-Many: Task ↔ Session

**Phase IV-A Architecture** supports:
- Multiple sessions working on one task (parallel workers)
- One session working on multiple tasks (orchestrator managing workflow)

**Forward:** Task has `sessionIds: string[]`
**Backward:** Session has `taskIds: string[]`

**Bidirectional Methods:**
```bash
# Add task to session
POST /api/sessions/:sessionId/tasks/:taskId

# Remove task from session
DELETE /api/sessions/:sessionId/tasks/:taskId
```

Storage layer automatically maintains both sides of the relationship.

See [05-DATA-MODELS.md](./05-DATA-MODELS.md) for complete entity schemas.

---

## 🛠️ Development

### File Structure

```
maestro-server/
├── src/              # TypeScript source
├── dist/             # Compiled JavaScript
├── node_modules/     # Dependencies
├── docs/             # Documentation (this directory)
├── test/             # Tests
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript config
└── Dockerfile        # Docker build config
```

### Build

```bash
npm run build
```

Compiles TypeScript to `dist/` directory.

### Watch Mode

```bash
npm run watch
```

Automatically recompiles on file changes.

### Testing

Currently no automated tests. Manual testing via:

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test API
curl http://localhost:3000/health

# Terminal 3: Test WebSocket
wscat -c ws://localhost:3000
```

---

## 🔒 Security

**⚠️ Current Security Posture:**

- No authentication
- No authorization
- No encryption (HTTP, not HTTPS)
- No rate limiting
- Designed for **local, single-user use only**

**Production Requirements:**

For production deployment, implement:

1. **Authentication:** JWT tokens
2. **Authorization:** User-based permissions
3. **Encryption:** HTTPS + WSS
4. **Rate Limiting:** Per-user limits
5. **Input Validation:** Sanitize all inputs
6. **Session Management:** Token expiration and refresh

---

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t maestro-server .
```

### Run Container

```bash
docker run -p 3000:3000 -v ~/.maestro/data:/data maestro-server
```

### Docker Compose

```yaml
version: '3.8'
services:
  maestro-server:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ~/.maestro/data:/data
    environment:
      - PORT=3000
      - DATA_DIR=/data
```

---

## 🐛 Debugging

### Enable Debug Logging

```bash
DEBUG=1 npm run dev
```

Logs all WebSocket broadcasts:

```
📡 Broadcast to 2/2 clients: task:updated
📡 Broadcast to 3/3 clients: session:spawn_request
```

### Monitor WebSocket Traffic

Using browser DevTools:
1. Open DevTools → Network tab
2. Filter by "WS"
3. Click on WebSocket connection
4. View "Messages" tab

### Server Logs

Check `maestro-server/server.log` for:
- Storage initialization
- Data loading
- API requests
- Errors

---

## 📊 Performance

### Current Performance

- **Read Operations:** O(1) for ID lookups, O(n) for listings
- **Write Operations:** O(1) Map update + async file write
- **WebSocket Broadcast:** O(m) where m = connected clients
- **Memory Usage:** ~10MB base + data size

### Scalability Limits

**Current architecture supports:**
- ✅ Single developer machine
- ✅ ~1000 tasks/sessions
- ✅ ~10 concurrent WebSocket clients

**Does NOT support:**
- ❌ Multi-machine deployment (file-based storage)
- ❌ High concurrency (no database)
- ❌ Large datasets (in-memory maps)

### Future Optimizations

For larger deployments:
1. Replace file storage with PostgreSQL/SQLite
2. Add Redis for caching
3. Implement pagination for listings
4. Add indexes for common queries
5. Compress archived data

---

## 🚧 Known Limitations

### Storage

- **File-based:** Single-machine only
- **No transactions:** Multi-step operations can partially fail
- **No archival:** Old data kept indefinitely

### API

- **No pagination:** Listings return all results
- **No rate limiting:** Open to abuse
- **No authentication:** Anyone can access

### WebSocket

- **No filtering:** All events sent to all clients
- **No compression:** Plain JSON messages
- **No reconnection:** Clients must implement reconnection

### Skills

- **Python-only prompt generator:** Currently unused
- **No validation:** Skill manifests not validated
- **No hot reload:** Server restart required for skill changes

---

## 🔮 Future Enhancements

### Phase IV-B: Skill System
- Populate `skillIds` in tasks
- Skill-based task assignment
- Skill dependency resolution

### Phase IV-C: Agent Management
- Populate `agentIds` in tasks/sessions
- Agent registration and discovery
- Agent health monitoring

### Phase V: Advanced Features
- Task dependencies and DAG validation
- Parallel task execution
- Task templates
- Project templates
- Workspace management

---

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | System overview, philosophy, and key concepts |
| [02-API-REFERENCE.md](./02-API-REFERENCE.md) | Complete REST API endpoint documentation |
| [03-STORAGE-LAYER.md](./03-STORAGE-LAYER.md) | Data persistence, in-memory storage, and file structure |
| [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md) | Real-time event system and message formats |
| [05-DATA-MODELS.md](./05-DATA-MODELS.md) | Entity schemas, field definitions, and relationships |
| [06-FLOWS.md](./06-FLOWS.md) | End-to-end workflows and sequence diagrams |
| [07-ARCHITECTURE-DIAGRAMS.md](./07-ARCHITECTURE-DIAGRAMS.md) | Visual architecture reference |

---

## 🤝 Contributing

### Code Style

- TypeScript with strict mode
- 2-space indentation
- Async/await for all I/O
- Descriptive variable names

### Adding New Endpoints

1. Define types in `src/types.ts`
2. Add storage methods in `src/storage.ts`
3. Create API route in `src/api/`
4. Register route in `src/server.ts`
5. Add WebSocket events in `src/websocket.ts`
6. Update documentation

### Adding New Events

1. Emit from storage layer: `storage.emit('event:name', data)`
2. Add listener in `src/websocket.ts`
3. Broadcast to clients: `broadcast('event:name', data)`
4. Document in [04-WEBSOCKET-EVENTS.md](./04-WEBSOCKET-EVENTS.md)

---

## 📝 License

MIT

---

## 📞 Support

For issues and questions:
- Check documentation in `maestro-server/docs/`
- Review API reference for endpoint usage
- Enable DEBUG logging for troubleshooting
- Check `server.log` for error details

---

## 🎯 Summary

**Maestro Server** is a lightweight, file-based task orchestration backend designed for local, multi-agent development workflows. It provides:

✅ RESTful API for CRUD operations
✅ WebSocket broadcasting for real-time updates
✅ File-based persistence with in-memory caching
✅ Many-to-many task-session relationships
✅ Skill loading and management
✅ CLI-first architecture (server is intentionally dumb)

**Remember:** The server is a data store and event broadcaster. All orchestration logic lives in the Maestro CLI.
