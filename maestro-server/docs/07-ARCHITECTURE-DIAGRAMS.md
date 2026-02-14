# Maestro Server - Architecture Diagrams

Visual representation of the system architecture, component interactions, and data flows.

## System Architecture Overview

```mermaid
flowchart TB
    subgraph "User Layer"
        User[👤 Developer]
        UI[🖥️ Agent Maestro<br/>React/TypeScript]
    end

    subgraph "CLI Layer"
        CLI[⚡ Maestro CLI<br/>Orchestration Brain]
        Claude[🤖 Claude Agent<br/>Code Execution]
    end

    subgraph "Server Layer"
        Server[🗄️ Maestro Server<br/>Data Store + Events]
        WebSocket[🔌 WebSocket Server<br/>Real-time Broadcasting]
        API[🌐 REST API<br/>CRUD Operations]
    end

    subgraph "Storage Layer"
        Memory[(💾 In-Memory Maps<br/>Fast Access)]
        Disk[(📁 File System<br/>~/.maestro/data)]
    end

    subgraph "Skills System"
        Skills[📦 Skills Directory<br/>~/.agents-ui/maestro-skills]
    end

    User -->|Interacts| UI
    UI -->|WebSocket| WebSocket
    UI -->|Spawn Terminal| CLI
    CLI -->|HTTP API| API
    CLI -->|Spawn| Claude
    Claude -->|Execute| CLI
    API --> Server
    WebSocket --> Server
    Server --> Memory
    Server --> Disk
    Server --> Skills
```

---

## Component Diagram

```mermaid
graph TB
    subgraph Server[Maestro Server]
        ServerTS[server.ts<br/>HTTP + WS Setup]
        StorageTS[storage.ts<br/>Data Layer]
        WebSocketTS[websocket.ts<br/>Event Broadcaster]
        SkillsTS[skills.ts<br/>Skill Loader]

        subgraph API[API Routes]
            ProjectsAPI[projects.ts]
            TasksAPI[tasks.ts]
            SessionsAPI[sessions.ts]
            SubtasksAPI[subtasks.ts]
        end

        subgraph Services[Services]
            PromptGen[promptGenerator.ts<br/>⚠️ Deprecated]
        end

        ServerTS --> StorageTS
        ServerTS --> WebSocketTS
        ServerTS --> API
        API --> StorageTS
        WebSocketTS --> StorageTS
        SkillsTS -.->|Read Skills| Skills
    end

    subgraph Storage[File System Storage]
        Projects[(projects/*.json)]
        Tasks[(tasks/{projectId}/*.json)]
        Sessions[(sessions/*.json)]
    end

    subgraph Skills[Skills Directory]
        MaestroCLI[maestro-cli/]
        MaestroWorker[maestro-worker/]
        MaestroOrch[maestro-orchestrator/]
        CustomSkills[custom-skills/]
    end

    StorageTS <--> Projects
    StorageTS <--> Tasks
    StorageTS <--> Sessions
```

---

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph Input
        UIAPI[UI API Calls]
        CLIAPI[CLI API Calls]
    end

    subgraph Processing
        Router[Express Router]
        Validation[Request Validation]
        Storage[Storage Layer]
        Events[Event Emitter]
    end

    subgraph Output
        Response[HTTP Response]
        WSBroadcast[WebSocket Broadcast]
        FileWrite[File System Write]
    end

    UIAPI --> Router
    CLIAPI --> Router
    Router --> Validation
    Validation --> Storage
    Storage --> Events
    Events --> WSBroadcast
    Storage --> FileWrite
    Storage --> Response
    Response --> UIAPI
    Response --> CLIAPI
    WSBroadcast --> UIAPI
```

---

## Storage Architecture

```mermaid
flowchart TB
    subgraph "In-Memory Layer (Fast Access)"
        ProjectsMap[Map: string → Project]
        TasksMap[Map: string → Task]
        SessionsMap[Map: string → Session]
    end

    subgraph "Persistence Layer (Disk)"
        subgraph ProjectFiles[projects/]
            PF1[proj_123.json]
            PF2[proj_456.json]
        end

        subgraph TaskFiles[tasks/]
            subgraph TF1[proj_123/]
                T1[task_001.json]
                T2[task_002.json]
            end
            subgraph TF2[proj_456/]
                T3[task_003.json]
            end
        end

        subgraph SessionFiles[sessions/]
            SF1[sess_abc.json]
            SF2[sess_def.json]
        end
    end

    ProjectsMap -->|save| ProjectFiles
    TasksMap -->|save| TaskFiles
    SessionsMap -->|save| SessionFiles

    ProjectFiles -->|load| ProjectsMap
    TaskFiles -->|load| TasksMap
    SessionFiles -->|load| SessionsMap
```

**Access Patterns:**

- **Read:** O(1) from in-memory Map
- **Write:** O(1) Map update + async file write
- **List:** O(n) iterate Map values
- **Filter:** O(n) iterate + filter predicate

---

## WebSocket Event Flow

```mermaid
sequenceDiagram
    participant Storage
    participant EventEmitter
    participant WebSocketHandler
    participant Client1
    participant Client2
    participant ClientN

    Storage->>EventEmitter: emit('task:created', task)
    EventEmitter->>WebSocketHandler: on('task:created')

    WebSocketHandler->>WebSocketHandler: broadcast(event, data)

    par Broadcast to all clients
        WebSocketHandler->>Client1: send(JSON message)
        WebSocketHandler->>Client2: send(JSON message)
        WebSocketHandler->>ClientN: send(JSON message)
    end

    Client1->>Client1: Handle event
    Client2->>Client2: Handle event
    ClientN->>ClientN: Handle event
```

**Event Types:**

- Project: `created`, `updated`, `deleted`
- Task: `created`, `updated`, `deleted`
- Session: `created`, `updated`, `deleted`, `spawn_request`
- Subtask: `created`, `updated`, `deleted`
- Relationships: `task_added`, `task_removed`, `session_added`, `session_removed`

---

## Session Spawn Architecture

```mermaid
flowchart TB
    Start[Orchestrator calls spawn API] --> ValidateReq[Validate request:<br/>projectId, taskIds]

    ValidateReq --> CreateSession[Create Session object<br/>status: spawning]

    CreateSession --> UpdateTasks[Update all tasks:<br/>add sessionId, timeline event]

    UpdateTasks --> EmitEvent[Emit session:spawn_request]

    EmitEvent --> WSBroadcast[WebSocket broadcasts<br/>to all UIs]

    WSBroadcast --> UIReceive[UI receives event]

    UIReceive --> GetProject[UI fetches project details]

    GetProject --> SpawnTerminal[UI spawns terminal at workingDir<br/>with environment variables]

    SpawnTerminal --> TerminalOpen[Terminal opens, shell starts]

    TerminalOpen --> CLIDetect[CLI detects MAESTRO_* env vars]

    CLIDetect --> CLIInit[CLI: maestro worker init]

    CLIInit --> UpdateStatus[CLI updates session status: running]

    UpdateStatus --> GeneratePrompt[CLI generates prompt from:<br/>- Task details<br/>- Skill instructions<br/>- Context]

    GeneratePrompt --> SpawnClaude[CLI spawns Claude with prompt]

    SpawnClaude --> TaskExecution[Claude executes task]

    TaskExecution --> CLIReporting[CLI reports progress to server]

    CLIReporting --> End[Task completion]
```

**Environment Variables:**

```bash
MAESTRO_SESSION_ID=sess_1706792222222_lmn678
MAESTRO_PROJECT_ID=proj_1706789123456_k2j4n5l6m
MAESTRO_TASK_IDS=task_001,task_002
MAESTRO_SERVER_URL=http://localhost:3000
MAESTRO_SKILLS=maestro-worker
```

---

## Task-Session Relationship Architecture

**Many-to-Many Bidirectional**

```mermaid
erDiagram
    Task }o--o{ Session : "many-to-many"

    Task {
        string id PK
        string[] sessionIds "Sessions working on this"
    }

    Session {
        string id PK
        string[] taskIds "Tasks in this session"
    }
```

**Add Relationship Flow:**

```mermaid
flowchart TD
    Start[Add Task to Session] --> UpdateSession[session.taskIds.push(taskId)]
    UpdateSession --> UpdateTask[task.sessionIds.push(sessionId)]
    UpdateTask --> AddTimeline[task.timeline.push(session_started)]
    AddTimeline --> SaveBoth[Save both entities]
    SaveBoth --> EmitEvents[Emit bidirectional events]
    EmitEvents --> End[Broadcast via WebSocket]
```

**Remove Relationship Flow:**

```mermaid
flowchart TD
    Start[Remove Task from Session] --> FilterSession[session.taskIds = filter out taskId]
    FilterSession --> FilterTask[task.sessionIds = filter out sessionId]
    FilterTask --> AddTimeline[task.timeline.push(session_ended)]
    AddTimeline --> SaveBoth[Save both entities]
    SaveBoth --> EmitEvents[Emit bidirectional events]
    EmitEvents --> End[Broadcast via WebSocket]
```

---

## Skill Loading Architecture

```mermaid
flowchart TB
    Start[Load Skills] --> CheckDir{Skills dir exists?<br/>~/.agents-ui/maestro-skills}

    CheckDir -->|No| Return404[Return empty array]
    CheckDir -->|Yes| ReadDir[Read directory contents]

    ReadDir --> FilterDirs[Filter: has manifest.json]

    FilterDirs --> LoadManifest[Load manifest.json]

    LoadManifest --> LoadInstructions[Load skill.md]

    LoadInstructions --> ValidateDeps{Check dependencies}

    ValidateDeps -->|Missing deps| WarnMissing[Warn: dependency missing]
    ValidateDeps -->|All present| CreateSkill[Create Skill object]

    CreateSkill --> FormatPrompt[Format for LLM prompt]

    FormatPrompt --> ReturnSkills[Return array of Skill objects]

    WarnMissing --> ReturnSkills
```

**Skill Manifest Schema:**

```json
{
  "name": "maestro-worker",
  "version": "1.0.0",
  "description": "Worker skill for task execution",
  "type": "role",
  "assignTo": ["worker"],
  "capabilities": ["task_execution", "progress_reporting"],
  "dependencies": ["maestro-cli"],
  "config": {}
}
```

---

## API Layer Architecture

```mermaid
flowchart TB
    subgraph "Express Middleware Chain"
        CORS[CORS Middleware]
        JSON[JSON Body Parser]
        Routes[API Routes]
        ErrorHandler[Error Handler]
    end

    Request[HTTP Request] --> CORS
    CORS --> JSON
    JSON --> Routes

    subgraph "Route Handlers"
        ProjectsRouter[/api/projects]
        TasksRouter[/api/tasks]
        SessionsRouter[/api/sessions]
        SubtasksRouter[/api/tasks/:taskId/subtasks]
    end

    Routes --> ProjectsRouter
    Routes --> TasksRouter
    Routes --> SessionsRouter
    Routes --> SubtasksRouter

    ProjectsRouter --> Storage[Storage Layer]
    TasksRouter --> Storage
    SessionsRouter --> Storage
    SubtasksRouter --> Storage

    Storage --> Success[200/201 Response]
    Storage --> Error[4xx/5xx Response]

    Success --> ErrorHandler
    Error --> ErrorHandler
    ErrorHandler --> Response[HTTP Response]
```

---

## Deployment Architecture

### Single-Machine (Development)

```mermaid
flowchart TB
    subgraph LocalMachine[Developer Machine]
        Browser[Web Browser<br/>Agent Maestro]
        Terminal1[Terminal 1<br/>Orchestrator Session]
        Terminal2[Terminal 2<br/>Worker Session 1]
        Terminal3[Terminal 3<br/>Worker Session 2]
        Server[Maestro Server<br/>localhost:3000]
        Storage[~/.maestro/data/]
    end

    Browser <--> Server
    Terminal1 <--> Server
    Terminal2 <--> Server
    Terminal3 <--> Server
    Server <--> Storage
```

### Docker Deployment (Multi-Machine)

```mermaid
flowchart TB
    subgraph DevMachine[Developer Machine]
        UI[Agent Maestro<br/>localhost:5173]
    end

    subgraph DockerHost[Docker Host]
        Container[Maestro Server Container<br/>Port 3000]
        Volume[Docker Volume<br/>/data]
    end

    subgraph RemoteMachine[Remote Worker Machine]
        CLI[Maestro CLI<br/>Points to remote server]
    end

    UI <-->|WebSocket + HTTP| Container
    CLI <-->|HTTP API| Container
    Container <--> Volume
```

---

## Error Handling Architecture

```mermaid
flowchart TD
    Request[API Request] --> TryCatch{Try/Catch Block}

    TryCatch -->|Success| Process[Process Request]
    TryCatch -->|Exception| CatchError[Catch Error]

    Process --> StorageOp{Storage Operation}

    StorageOp -->|Success| EmitEvent[Emit Event]
    StorageOp -->|Not Found| NotFoundError[Return 404]
    StorageOp -->|Validation Failed| ValidationError[Return 400]
    StorageOp -->|Has Dependencies| DependencyError[Return 400]

    CatchError --> CheckErrorType{Error Type?}

    CheckErrorType -->|Not Found| NotFoundError
    CheckErrorType -->|Validation| ValidationError
    CheckErrorType -->|Other| InternalError[Return 500]

    NotFoundError --> ErrorResponse[Error Response JSON]
    ValidationError --> ErrorResponse
    DependencyError --> ErrorResponse
    InternalError --> ErrorResponse

    EmitEvent --> SuccessResponse[Success Response JSON]

    ErrorResponse --> Client[Client]
    SuccessResponse --> Client
```

**Error Response Format:**

```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}  // Optional
}
```

---

## Graceful Shutdown Flow

```mermaid
sequenceDiagram
    participant Process
    participant Signal
    participant Server
    participant WebSocket
    participant Storage
    participant FileSystem

    Signal->>Process: SIGINT (Ctrl+C)

    Process->>Process: Check isShuttingDown flag

    alt First SIGINT
        Process->>Process: Set isShuttingDown = true
        Process->>Process: Start 5s force-exit timer

        Process->>WebSocket: Close all client connections
        WebSocket->>WebSocket: clients.forEach(client => client.close())

        Process->>WebSocket: Close WebSocket server
        WebSocket-->>Process: wss.close() callback

        Process->>Storage: storage.save()
        Storage->>FileSystem: Write all data to disk
        FileSystem-->>Storage: Success

        Process->>Server: server.close()
        Server-->>Process: HTTP server stopped

        Process->>Process: Clear force-exit timer
        Process->>Process: process.exit(0)

    else Second SIGINT (force)
        Process->>Process: Force shutdown
        Process->>Process: process.exit(1)
    end
```

**Shutdown Steps:**

1. Close WebSocket connections
2. Close WebSocket server
3. Save all in-memory data to disk
4. Close HTTP server
5. Exit process

**Force Exit:** If graceful shutdown hangs, force exit after 5 seconds.

---

## Skills System Architecture

```mermaid
flowchart TB
    subgraph SkillsDirectory[~/.agents-ui/maestro-skills/]
        subgraph MaestroWorker[maestro-worker/]
            WM[manifest.json]
            WS[skill.md]
        end

        subgraph MaestroOrch[maestro-orchestrator/]
            OM[manifest.json]
            OS[skill.md]
        end

        subgraph MaestroCLI[maestro-cli/]
            CM[manifest.json]
            CS[skill.md]
        end

        subgraph CustomSkill[custom-skill/]
            XM[manifest.json]
            XS[skill.md]
        end
    end

    subgraph Server[Maestro Server]
        Loader[Skill Loader<br/>skills.ts]
    end

    subgraph CLI[Maestro CLI]
        PromptGen[Prompt Generator]
    end

    Loader -->|Read| SkillsDirectory
    CLI -->|Request skills| Loader
    Loader -->|Return skills| CLI
    CLI -->|Inject into prompt| PromptGen
```

**Skill Loading Flow:**

1. CLI requests skills for role (worker, orchestrator)
2. Server reads skill manifests from `~/.agents-ui/maestro-skills/`
3. Server validates dependencies
4. Server formats skills for LLM prompt
5. CLI injects skills into prompt
6. Claude receives full context including skill instructions

---

## Performance Characteristics

### Read Operations

```mermaid
graph LR
    A[Get by ID: O1] --> B[Map.get]
    C[List all: On] --> D[Map.values iterate]
    E[Filtered list: On] --> F[Map.values + filter]
```

### Write Operations

```mermaid
graph LR
    A[Create/Update: O1] --> B[Map.set]
    B --> C[Async file write]
    D[Delete: O1] --> E[Map.delete]
    E --> F[Async file delete]
```

### WebSocket Broadcast

```mermaid
graph LR
    A[Broadcast: Om] --> B[Iterate clients]
    B --> C[Send to each: O1]
```

Where:
- **n** = total entities
- **m** = connected clients

---

## Security Considerations

```mermaid
flowchart TB
    Request[HTTP Request] --> NoAuth{Authentication?}

    NoAuth -->|None| AllowAll[Allow all requests<br/>⚠️ Local dev only]

    AllowAll --> CORS{CORS?}

    CORS -->|Enabled| AllowOrigins[Allow all origins<br/>⚠️ Local dev only]

    AllowOrigins --> NoEncryption{Encryption?}

    NoEncryption -->|HTTP| NoTLS[Plain HTTP<br/>⚠️ Local dev only]

    NoTLS --> LocalOnly[✅ Safe for localhost<br/>❌ Unsafe for production]

    style NoAuth fill:#ff9999
    style CORS fill:#ff9999
    style NoEncryption fill:#ff9999
    style LocalOnly fill:#ffcc99
```

**Current Security:**
- ❌ No authentication
- ❌ No authorization
- ❌ No encryption (HTTP, not HTTPS)
- ❌ No rate limiting
- ✅ Designed for local, single-user use

**Production Requirements:**
- ✅ Token-based auth (JWT)
- ✅ User-based authorization
- ✅ TLS/HTTPS (WSS for WebSocket)
- ✅ Rate limiting per user
- ✅ Input sanitization
