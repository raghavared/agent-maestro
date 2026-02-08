# Maestro Server - System Overview

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Purpose:** Define architecture boundaries and system philosophy

---

## What Maestro Server Is

Maestro Server is a **project coordination backend** that provides:

1. **Data Management** - CRUD operations for projects, tasks, and sessions
2. **Real-Time Events** - WebSocket broadcasts for state changes
3. **Session Orchestration** - Coordinating multiple agent sessions working on tasks
4. **Skills Integration** - Loading and managing agent skills
5. **Manifest Generation** - Creating session configurations via CLI integration

### Core Responsibilities

```
┌────────────────────────────────────────────────────────────┐
│                    Maestro Server                          │
│                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   REST API  │  │  WebSocket   │  │  CLI Integration│  │
│  │  (HTTP/JSON)│  │  (Events)    │  │  (Manifest Gen) │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                    │           │
│         └────────────────┼────────────────────┘           │
│                         │                                 │
│         ┌───────────────▼─────────────────┐               │
│         │      Storage Layer              │               │
│         │  (Projects, Tasks, Sessions)    │               │
│         └─────────────────────────────────┘               │
│                                                            │
└────────────────────────────────────────────────────────────┘
              │                           │
              │                           │
    ┌─────────▼──────────┐     ┌─────────▼──────────┐
    │   UI Clients       │     │  Maestro CLI       │
    │  (WebSocket + API) │     │  (Manifest Reader) │
    └────────────────────┘     └────────────────────┘
```

---

## What Maestro Server Is NOT

Maestro Server explicitly **DOES NOT**:

1. ❌ **Execute agents** - Server only coordinates; CLI spawns agents
2. ❌ **Generate prompts** - That's the CLI's job (reads manifest)
3. ❌ **Manage terminals** - UI creates terminals, server just broadcasts spawn events
4. ❌ **Authenticate users** - No auth in current version (single-user, local)
5. ❌ **Validate business logic** - Minimal validation, trusts clients
6. ❌ **Queue or schedule work** - Just stores tasks, doesn't execute them
7. ❌ **Manage agent lifecycle** - Agents are independent processes

### Boundary Definition

```
SERVER RESPONSIBILITIES          │  CLI RESPONSIBILITIES
─────────────────────────────────┼─────────────────────────────────
Store projects/tasks/sessions    │  Read manifest files
Emit WebSocket events            │  Generate prompts from manifests
Generate manifests (via CLI)     │  Spawn Claude processes
Provide CRUD APIs                │  Execute agent sessions
Track session metadata           │  Report back to server via API
Serve skills metadata            │  Load skills into prompts
```

```
SERVER RESPONSIBILITIES          │  UI RESPONSIBILITIES
─────────────────────────────────┼─────────────────────────────────
Store data persistently          │  Display data to user
Emit state change events         │  Create terminal windows
Provide session spawn data       │  Execute spawn commands
Validate requests (minimal)      │  Validate user input (rich)
```

---

## Architecture Philosophy: CLI-First

Maestro Server follows a **CLI-first architecture**:

### Principle 1: Server as Coordinator, Not Executor
- Server **stores state** and **broadcasts events**
- CLI **executes work** (spawning agents, running tasks)
- UI **presents state** and **triggers actions**

### Principle 2: Server-Generated Manifests
- Server knows project context (tasks, skills, config)
- Server generates manifest via `maestro manifest generate` CLI
- CLI reads manifest and spawns agent with proper context
- UI receives spawn event and creates terminal

### Principle 3: Stateless Operations
- Server maintains persistent state in filesystem
- Each API request is independent (no sessions, auth, or cookies)
- WebSocket is **unidirectional** (server → clients only, no client messages)

### Principle 4: Single-User, Local-First
- Designed for single developer on local machine
- No multi-tenancy or user isolation
- No authentication or authorization
- Data stored in `~/.maestro/data/`

---

## Component Diagram

```mermaid
graph TB
    subgraph "Maestro Server Process"
        HTTP[HTTP Server :3000]
        WS[WebSocket Server]
        Storage[Storage Layer]
        API[API Routes]

        HTTP --> API
        HTTP --> WS
        API --> Storage
        Storage --> WS
    end

    subgraph "External Dependencies"
        CLI[Maestro CLI]
        FS[File System]
    end

    subgraph "Clients"
        UI[Agents UI]
        CURL[API Consumers]
    end

    Storage --> FS
    API --> CLI
    WS --> UI
    API --> UI
    CURL --> API

    style Storage fill:#e1f5ff
    style WS fill:#ffe1e1
    style API fill:#e1ffe1
```

### Component Descriptions

#### HTTP Server (Express)
- **Port:** 3000 (configurable via `PORT` env)
- **Middleware:** CORS, JSON body parser
- **Routes:** `/api/projects`, `/api/tasks`, `/api/sessions`, `/api/skills`, `/health`

#### WebSocket Server (ws)
- **Protocol:** WebSocket over HTTP upgrade
- **Direction:** Server → Client only (unidirectional)
- **Events:** 15+ event types (project:*, task:*, session:*)

#### Storage Layer
- **Type:** File-based JSON storage
- **Location:** `~/.maestro/data/` (configurable via `DATA_DIR`)
- **Structure:** Individual JSON files per entity
- **In-Memory:** Maps for fast reads (loaded on startup)

#### API Routes
- **Projects:** CRUD operations for project entities
- **Tasks:** CRUD + timeline, hierarchical tasks
- **Sessions:** CRUD + spawn orchestration
- **Skills:** List available skills

#### CLI Integration
- **Command:** `maestro manifest generate`
- **Purpose:** Generate session manifests with full context
- **Dependency:** Requires `maestro` CLI installed globally

---

## Non-Functional Requirements

### Performance
- **Startup:** < 1 second to initialize and load data
- **API Response:** < 50ms for CRUD operations (no external calls)
- **WebSocket Broadcast:** < 10ms to broadcast to all clients
- **Manifest Generation:** < 2 seconds (depends on CLI)

### Scalability
- **Data Size:** Designed for 100s of projects, 1000s of tasks
- **Concurrent Clients:** 10-50 WebSocket clients
- **Not Designed For:** Multi-tenant, cloud-scale, high-availability

### Reliability
- **Data Persistence:** Synchronous writes to filesystem on every mutation
- **Crash Recovery:** Data loaded from filesystem on startup
- **Error Handling:** Return error JSON, log to console, don't crash
- **Graceful Shutdown:** Save data before exit (SIGINT handler)

### Security
- **Current:** None (no auth, no encryption, no validation)
- **Assumption:** Trusted single-user environment
- **Future:** JWT auth, input validation, rate limiting (see `spec-review/`)

### Compatibility
- **Node.js:** >= 16.x (uses ES modules, modern APIs)
- **Dependencies:** Express, ws, TypeScript
- **Platform:** Cross-platform (macOS, Linux, Windows)

---

## Data Flow Patterns

### Pattern 1: CRUD Operation
```
Client                  Server                 Storage                WebSocket Clients
  │                       │                       │                         │
  ├─ POST /api/tasks ────>│                       │                         │
  │                       ├─ createTask() ───────>│                         │
  │                       │                       ├─ Save to disk           │
  │                       │                       ├─ emit('task:created')   │
  │                       │                       └──────────────────────────>│
  │                       │<─ task ───────────────┤                         │
  │<─ 201 Created ────────┤                       │                         │
  │                       │                       │                         │
```

### Pattern 2: Session Spawn (Server-Generated Manifest)
```
Client                Server              Maestro CLI         Storage         UI (WebSocket)
  │                     │                     │                 │                 │
  ├─ POST /spawn ──────>│                     │                 │                 │
  │                     ├─ Validate ──────────┤                 │                 │
  │                     ├─ createSession() ───────────────────>│                 │
  │                     │                     │                 ├─ Suppress event│
  │                     ├─ spawn CLI ────────>│                 │                 │
  │                     │                     ├─ Generate manifest               │
  │                     │                     └─ Write ~/.maestro/sessions/{id}  │
  │                     │<─ manifestPath ─────┤                 │                 │
  │                     ├─ emit('session:created' with spawn data) ────────────>│
  │<─ 201 Created ──────┤                     │                 │                 │
  │                     │                     │                 │                 ├─ UI creates terminal
  │                     │                     │                 │                 ├─ Runs command with env
  │                     │                     │                 │                 │
```

### Pattern 3: Real-Time State Sync
```
Client A             Server              Storage             Client B (WebSocket)
  │                    │                    │                       │
  ├─ PATCH /tasks/:id ─>│                    │                       │
  │                    ├─ updateTask() ─────>│                       │
  │                    │                    ├─ Save                  │
  │                    │                    ├─ emit('task:updated')  │
  │                    │                    └──────────────────────>│ (receives update)
  │<─ 200 OK ──────────┤                    │                       │
  │                    │                    │                       │
```

---

## Technology Stack

### Runtime
- **Node.js** >= 16.x
- **TypeScript** ^5.0.0

### Core Dependencies
- **express** ^4.18.2 - HTTP server and routing
- **ws** ^8.14.2 - WebSocket server
- **cors** ^2.8.5 - CORS middleware

### File System
- **fs/promises** - Async file operations (built-in)
- **path, os** - Path manipulation and OS info (built-in)

### CLI Integration
- **child_process** - Spawn `maestro` CLI (built-in)

### Event System
- **EventEmitter** - Storage event broadcasting (built-in)

---

## Deployment Model

### Current: Local Development Server
```
~/.maestro/
├── data/                    # Storage root
│   ├── projects/           # Project JSON files
│   ├── tasks/              # Task JSON files (organized by project)
│   └── sessions/           # Session JSON files
└── sessions/               # Generated manifests (by CLI)
    └── {session-id}/
        └── manifest.json

~/.agents-ui/
└── maestro-skills/         # Skills directory
    ├── maestro-cli/
    ├── maestro-worker/
    └── maestro-orchestrator/
```

### Future: Production Deployment
- Docker container (see `11-DEPLOYMENT-SPECIFICATION.md`)
- Database backend (PostgreSQL) instead of files
- JWT authentication
- Reverse proxy (nginx) for HTTPS
- Environment-based configuration

---

## Key Design Decisions

### Decision 1: File-Based Storage
**Rationale:** Simple, no database dependency, easy to inspect
**Trade-off:** Not suitable for high concurrency or large datasets
**Future:** Abstract storage behind interface (see `spec-review/02-DECOUPLING-PLAN.md`)

### Decision 2: Synchronous File Writes
**Rationale:** Ensure data persistence on every mutation
**Trade-off:** Slower API responses (but acceptable for local use)
**Future:** Async writes with write-ahead log

### Decision 3: Server-Generated Manifests via CLI
**Rationale:** Manifest generation requires Claude API, which CLI already has
**Trade-off:** Server depends on CLI being installed
**Future:** Server-side manifest generation (see `spec-review/`)

### Decision 4: Unidirectional WebSocket
**Rationale:** Server only broadcasts state changes, clients don't send commands
**Trade-off:** Clients must use HTTP API for mutations
**Benefit:** Simple protocol, no WebSocket authentication needed

### Decision 5: No Authentication
**Rationale:** Single-user, local-first tool
**Trade-off:** Not suitable for multi-user or remote access
**Future:** JWT auth for production deployment

---

## System Constraints

### Hard Constraints
1. **Single Process** - One server instance per machine
2. **Local Filesystem** - Data must be on same machine
3. **CLI Dependency** - Requires `maestro` CLI for manifest generation
4. **Node.js Environment** - Requires Node.js runtime

### Soft Constraints
1. **Port 3000** - Configurable via `PORT` env
2. **Data Directory** - Configurable via `DATA_DIR` env
3. **Skills Directory** - Configurable (hardcoded to `~/.agents-ui/maestro-skills/`)

---

## Success Criteria

A Maestro Server implementation is correct if:

1. ✅ All API endpoints return correct responses (see `03-API-SPECIFICATION.md`)
2. ✅ All WebSocket events are emitted (see `04-WEBSOCKET-SPECIFICATION.md`)
3. ✅ Data persists across restarts (see `05-STORAGE-SPECIFICATION.md`)
4. ✅ Session spawn generates manifest and emits event (see `08-SESSION-SPAWNING-SPECIFICATION.md`)
5. ✅ Skills can be listed (see `07-SKILLS-SPECIFICATION.md`)
6. ✅ Server starts and shuts down gracefully
7. ✅ All error codes match specification (see `09-ERROR-HANDLING-SPECIFICATION.md`)

---

## Next Steps

- **For API consumers:** Read `03-API-SPECIFICATION.md`
- **For UI developers:** Read `02-CORE-CONCEPTS.md` then `04-WEBSOCKET-SPECIFICATION.md`
- **For server developers:** Read `02-CORE-CONCEPTS.md` then dive into component specs
- **For architects:** Read `spec-review/01-CURRENT-ISSUES.md` for improvement opportunities

---

**Related Specifications:**
- `02-CORE-CONCEPTS.md` - Domain entities and relationships
- `03-API-SPECIFICATION.md` - REST API endpoints
- `04-WEBSOCKET-SPECIFICATION.md` - WebSocket events
- `spec-review/04-PROPOSED-ARCHITECTURE.md` - Future architecture
