# Agent Maestro — Backend Architecture Reference (Mermaid Diagrams)

## 1. System Overview

```mermaid
graph TB
    subgraph UI["maestro-ui (Tauri + React)"]
        UI_WS["WebSocket Client<br/>useMaestroWebSocket.ts"]
        UI_REST["REST Client<br/>MaestroClient.ts"]
        UI_Store["Zustand Stores<br/>useMaestroStore.ts"]
    end

    subgraph Server["maestro-server (Express + WS)"]
        API["REST API Routes<br/>/api/*"]
        WSBridge["WebSocket Bridge<br/>WebSocketBridge.ts"]
        Services["Application Services"]
        EventBus["InMemoryEventBus"]
        Repos["FileSystem Repositories<br/>~/.maestro/data/"]
    end

    subgraph CLI["maestro-cli (Commander.js)"]
        Commands["CLI Commands<br/>task, session, report..."]
        APIClient["API Client<br/>api.ts"]
        ManifestGen["Manifest Generator<br/>manifest.ts"]
        Hooks["Hook Executor<br/>hook-executor.ts"]
    end

    subgraph Agent["AI Agent (Claude Code / Codex / Gemini)"]
        AgentProcess["Agent Process"]
        ClaudeHooks["Lifecycle Hooks<br/>SessionStart, Stop, End"]
    end

    UI_REST -- "REST API calls" --> API
    UI_WS -- "WebSocket subscribe" --> WSBridge
    WSBridge -- "Real-time events" --> UI_WS
    API --> Services --> Repos
    Services -- "emit events" --> EventBus
    EventBus --> WSBridge
    Server -- "spawns child process<br/>maestro manifest generate" --> ManifestGen
    Commands --> APIClient -- "REST callbacks" --> API
    AgentProcess -- "runs maestro commands" --> Commands
    ClaudeHooks -- "SessionStart/Stop/End" --> Hooks --> Commands
```

## 2. Server Architecture — DDD Layers

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        ServerTS["server.ts<br/>Express app init, CORS, routes"]
        ContainerTS["container.ts<br/>DI wiring, initialization"]
    end

    subgraph API["API Layer — Route Handlers"]
        PR["projectRoutes.ts"]
        TR["taskRoutes.ts"]
        SR["sessionRoutes.ts<br/>+ generateManifestViaCLI()"]
        TMR["teamMemberRoutes.ts"]
        SkR["skillRoutes.ts"]
        OR["orderingRoutes.ts"]
        WTR["workflowTemplateRoutes.ts"]
        Val["validation.ts — Zod schemas"]
    end

    subgraph App["Application Layer — Services"]
        PS["ProjectService"]
        TS["TaskService"]
        SS["SessionService"]
        TMS["TeamMemberService"]
        OS["OrderingService"]
    end

    subgraph Domain["Domain Layer — Interfaces"]
        TypesTS["types.ts<br/>Project, Task, Session, TeamMember"]
        IRepos["IProjectRepository<br/>ITaskRepository<br/>ISessionRepository<br/>ITeamMemberRepository"]
        IEvents["IEventBus + DomainEvents"]
        ICommon["ILogger, IIdGenerator, Errors"]
    end

    subgraph Infra["Infrastructure Layer"]
        FSRepos["FileSystem*Repository<br/>JSON file persistence"]
        EvBus["InMemoryEventBus"]
        WSB["WebSocketBridge<br/>Event-to-WS broadcast"]
        Config["Config.ts<br/>ENV: PORT, DATA_DIR, SESSION_DIR"]
        SkillLoad["ClaudeCodeSkillLoader<br/>~/.claude/skills/"]
    end

    ServerTS --> ContainerTS
    ContainerTS --> API
    ContainerTS --> App
    ContainerTS --> Infra
    API --> Val
    API --> App
    App --> Domain
    Infra -.->|implements| Domain
```

## 3. Session Lifecycle Flow

```mermaid
sequenceDiagram
    participant U as UI / CLI
    participant S as Server
    participant DB as FileSystem
    participant WS as WebSocket
    participant CLI as maestro-cli
    participant A as Agent

    U->>S: POST /sessions/spawn<br/>{projectId, taskIds, mode, skills, teamMemberId}
    S->>DB: Create session (status: spawning)
    S->>CLI: spawn child process<br/>maestro manifest generate --mode X --task-ids Y
    CLI->>DB: Read tasks, skills, team-member data
    CLI->>DB: Write manifest.json to SESSION_DIR
    CLI-->>S: stdout: manifest path
    S->>DB: Read manifest.json
    S->>WS: emit session:spawn<br/>{session, manifest, command, env}
    WS->>U: session:spawn event
    U->>A: Open terminal, start agent<br/>with MAESTRO_SESSION_ID, MANIFEST_PATH

    Note over A: Agent boots up

    A->>CLI: SessionStart hook fires<br/>maestro session register
    CLI->>S: GET /sessions/{id} then PATCH status: working
    S->>WS: emit session:updated (working)

    loop Agent Execution
        A->>CLI: maestro report progress "message"
        CLI->>S: POST /sessions/{id}/timeline<br/>{type: progress, message}
        S->>WS: emit notify:progress

        A->>CLI: maestro task report complete "done"
        CLI->>S: PATCH /tasks/{id}<br/>{taskSessionStatuses: {sid: completed}}
        S->>WS: emit notify:task_completed
    end

    A->>CLI: SessionEnd hook fires<br/>maestro session complete
    CLI->>S: PATCH /sessions/{id} status: completed
    S->>WS: emit session:updated + notify:session_completed
```

## 4. CLI Command Architecture

```mermaid
graph LR
    subgraph Binary["bin/maestro.js"]
        Entry["CLI Entry<br/>index.ts"]
    end

    subgraph Commander["Commander.js Program"]
        Config["config.ts<br/>ENV: MAESTRO_SESSION_ID<br/>MAESTRO_SERVER_URL<br/>MAESTRO_PROJECT_ID"]
        Guard["command-permissions.ts<br/>guardCommand()"]
    end

    subgraph Commands["Command Modules"]
        Task["task.ts<br/>list, get, create, edit,<br/>delete, children, report, docs"]
        Session["session.ts<br/>list, get, spawn, register,<br/>complete, needs-input, resume"]
        Project["project.ts<br/>list, create, get"]
        Report["report.ts<br/>progress, complete,<br/>blocked, error"]
        TeamMember["team-member.ts<br/>create, list, get"]
        Manifest["manifest.ts<br/>generate"]
        Show["show.ts — modal"]
        Modal["modal.ts — events"]
        Whoami["whoami.ts, status.ts"]
        TrackFile["track-file.ts"]
    end

    subgraph Transport["Transport Layer"]
        API["api.ts — APIClient<br/>GET, POST, PATCH, DELETE<br/>3 retries, exponential backoff"]
        Storage["storage.ts — LocalStorage<br/>READ-ONLY cache ~/.maestro/data/"]
    end

    subgraph Server["maestro-server"]
        REST["/api/* endpoints"]
    end

    Entry --> Config
    Entry --> Guard
    Entry --> Commands
    Commands --> API
    Commands --> Storage
    API -- "HTTP requests" --> REST
```

## 5. Manifest Generation Pipeline

```mermaid
flowchart TB
    A["POST /api/sessions/spawn<br/>sessionRoutes.ts"] --> B["Validate inputs<br/>projectId, taskIds, mode, skills, teamMemberId"]
    B --> C["Create Session<br/>status: spawning"]
    C --> D["Resolve TeamMember defaults<br/>mode, model, agentTool from config"]
    D --> E["Collect referenceTaskIds<br/>from all spawned tasks"]
    E --> F["generateManifestViaCLI()"]
    F --> G["Spawn: maestro manifest generate<br/>--mode --project-id --task-ids --skills --output"]

    subgraph CLI_Process["CLI Manifest Generator"]
        G --> H["Read task data<br/>title, description, acceptance_criteria"]
        H --> I["Load skills<br/>~/.claude/skills/*.md"]
        I --> J["Load team member identity<br/>name, role, avatar, instructions, workflow"]
        J --> K["Build MaestroManifest"]
        K --> L["Generate system prompt<br/>mode-specific template + task context<br/>+ skills + workflow + commands ref"]
        L --> M["Write manifest.json<br/>SESSION_DIR/{sessionId}/manifest.json"]
    end

    M --> N["Server reads manifest"]
    N --> O["Prepare env vars<br/>MAESTRO_SESSION_ID<br/>MAESTRO_MANIFEST_PATH<br/>MAESTRO_SERVER_URL<br/>AUTH_KEYS"]
    O --> P["Emit session:spawn event via WebSocket"]
    P --> Q["UI opens terminal, runs agent with env + manifest"]
    Q --> R["Agent reads MAESTRO_MANIFEST_PATH<br/>gets full system prompt"]
```

## 6. Event System & WebSocket Bridge

```mermaid
graph TB
    subgraph Services["Application Services — emit events"]
        TS["TaskService"] -->|"task:created/updated/deleted<br/>task:session_added/removed"| EB
        SS["SessionService"] -->|"session:created/updated/deleted<br/>session:task_added/removed"| EB
        TMS["TeamMemberService"] -->|"team_member:created/updated<br/>team_member:deleted/archived"| EB
    end

    subgraph Notifications["Notification Events — high-impact"]
        TS2["TaskService"] -->|"notify:task_completed<br/>notify:task_failed<br/>notify:task_blocked<br/>notify:task_in_review"| EB
        SS2["SessionService"] -->|"notify:session_completed<br/>notify:session_failed<br/>notify:needs_input<br/>notify:progress"| EB
    end

    subgraph Special["Special Events"]
        SR["sessionRoutes.ts"] -->|"session:spawn<br/>session:modal<br/>session:modal_action<br/>session:modal_closed"| EB
    end

    EB["InMemoryEventBus<br/>emit / on / once"]

    EB --> WSB["WebSocketBridge"]

    WSB --> Filter{"Client has subscription?"}
    Filter -->|"Yes: filter by sessionIds"| FilteredSend["Send matching events"]
    Filter -->|"No subscription"| BroadcastAll["Broadcast ALL events"]
    Filter -->|"Project/team"| BypassFilter["Always broadcast"]

    FilteredSend --> Client1["UI Client"]
    BroadcastAll --> Client1
    BypassFilter --> Client1
```

## Key File Reference

| Layer | Files | Purpose |
|-------|-------|---------|
| **Server Entry** | `server.ts`, `container.ts`, `types.ts` | App init, DI, type defs |
| **API Routes** | `projectRoutes.ts`, `taskRoutes.ts`, `sessionRoutes.ts`, `teamMemberRoutes.ts`, `skillRoutes.ts`, `orderingRoutes.ts`, `workflowTemplateRoutes.ts`, `validation.ts` | HTTP endpoints, Zod validation |
| **Services** | `ProjectService.ts`, `TaskService.ts`, `SessionService.ts`, `TeamMemberService.ts`, `OrderingService.ts` | Business logic, event emission |
| **Domain** | `I*Repository.ts`, `DomainEvents.ts`, `IEventBus.ts`, `ILogger.ts`, `IIdGenerator.ts`, `Errors.ts` | Interfaces & contracts |
| **Infrastructure** | `FileSystem*Repository.ts`, `WebSocketBridge.ts`, `Config.ts`, `InMemoryEventBus.ts`, `ConsoleLogger.ts`, `TimestampIdGenerator.ts`, `ClaudeCodeSkillLoader.ts` | Persistence, WS, config |
| **CLI Entry** | `bin/maestro.js`, `index.ts`, `config.ts` | CLI bootstrap |
| **CLI Commands** | `task.ts`, `session.ts`, `project.ts`, `report.ts`, `team-member.ts`, `manifest.ts`, `show.ts`, `modal.ts`, `whoami.ts`, `status.ts`, `track-file.ts` | Command implementations |
| **CLI Transport** | `api.ts`, `storage.ts` | REST client with retry, local read-only cache |
| **CLI Hooks** | `hook-executor.ts`, `hooks.json` | Claude Code lifecycle hooks |
| **CLI Types** | `types/manifest.ts`, `types/storage.ts` | Manifest and storage type definitions |

## API Endpoints Quick Reference

### Projects
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Tasks
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tasks` | List tasks (filter: projectId, status, parentId) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task (cascade children) |
| GET | `/api/tasks/:id/children` | Get child tasks |
| GET | `/api/tasks/:id/docs` | Get aggregated docs |
| POST | `/api/tasks/:id/timeline` | Add timeline event |

### Sessions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session |
| PATCH | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/spawn` | Spawn session with manifest |
| GET | `/api/sessions/:id/docs` | Get docs |
| POST | `/api/sessions/:id/docs` | Add doc |
| POST | `/api/sessions/:id/events` | Add event |
| POST | `/api/sessions/:id/timeline` | Add timeline event |
| POST | `/api/sessions/:id/modal` | Show modal |

### Team Members
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/team-members` | List (defaults + custom) |
| POST | `/api/team-members` | Create custom |
| GET | `/api/team-members/:id` | Get by ID |
| PATCH | `/api/team-members/:id` | Update |
| DELETE | `/api/team-members/:id` | Delete (must archive first) |
| POST | `/api/team-members/:id/archive` | Archive |
| POST | `/api/team-members/:id/unarchive` | Unarchive |

### Skills & Workflows
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/skills` | List skills |
| GET | `/api/workflow-templates` | List workflow templates |
