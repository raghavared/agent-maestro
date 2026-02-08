# Architecture Diagrams

## Overview

Visual representations of the Maestro CLI architecture, data flows, and component interactions.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AGENTS UI (Frontend)                       │
│                                                                     │
│  Responsibilities:                                                  │
│  ✓ Display tasks, sessions, subtasks                              │
│  ✓ WebSocket event handling                                        │
│  ✓ User interactions (create task, spawn session)                 │
│  ✓ Terminal spawning with env vars                                │
│                                                                     │
│  What it does NOT do:                                              │
│  ✗ Build Claude commands                                           │
│  ✗ Read skill files                                                │
│  ✗ Execute hooks                                                   │
│  ✗ Manage Claude process                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Spawn Terminal:
                             │ command: maestro worker init
                             │ env: {
                             │   MAESTRO_MANIFEST_PATH,
                             │   MAESTRO_SESSION_ID,
                             │   MAESTRO_PROJECT_ID,
                             │   MAESTRO_API_URL
                             │ }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MAESTRO CLI (The Bridge) ⭐                     │
│                                                                     │
│  Responsibilities:                                                  │
│  ✓ Read environment variables                                      │
│  ✓ Read manifest from ~/.maestro/sessions/{id}/manifest.json      │
│  ✓ Validate manifest schema                                        │
│  ✓ Generate system prompt from templates                           │
│  ✓ Load standard skills from ~/.skills/                           │
│  ✓ Execute SessionStart hook (report to server)                   │
│  ✓ Display session brief                                           │
│  ✓ Execute initial commands                                        │
│  ✓ Spawn Claude Code with configuration                           │
│  ✓ Monitor Claude process                                          │
│  ✓ Execute SessionEnd hook (report completion)                    │
│  ✓ CRUD operations (tasks, sessions, subtasks)                    │
│  ✓ Progress reporting                                              │
│                                                                     │
│  Commands:                                                          │
│  • maestro worker init        - Start worker session               │
│  • maestro orchestrator init  - Start orchestrator session         │
│  • maestro task <cmd>         - Manage tasks                       │
│  • maestro session <cmd>      - Manage sessions                    │
│  • maestro report <cmd>       - Report session status              │
│  • maestro status             - Project status                     │
│  • maestro whoami             - Show context                       │
│  • maestro queue <cmd>       - Queue strategy commands             │
│  • maestro project <cmd>     - Project management                  │
│  • maestro track-file        - Track file modifications            │
│                                                                     │
│  Services:                                                          │
│  ✓ WhoamiRenderer     — Full context for maestro whoami           │
│  ✓ SessionBriefGenerator — Pre-spawn task summary                 │
│  ✓ LocalStorage       — Read-only cache of ~/.maestro/data/       │
│  ✓ APIClient          — HTTP client with retry logic              │
│  ✓ CommandPermissions — Role/strategy-based command filtering     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             │ POST /api/sessions
                             │ GET /api/tasks/{id}
                             │ PATCH /api/tasks/{id}
                             │ POST /api/tasks/{id}/timeline
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MAESTRO SERVER (Optional)                    │
│                                                                     │
│  Responsibilities:                                                  │
│  ✓ Store tasks, sessions, subtasks                                │
│  ✓ Validate operations                                             │
│  ✓ Broadcast WebSocket events                                      │
│  ✓ Maintain project state                                          │
│  ✓ Serve as API for CLI commands                                  │
│                                                                     │
│  API Endpoints:                                                     │
│  • GET    /api/tasks                                               │
│  • POST   /api/tasks                                               │
│  • PATCH  /api/tasks/{id}                                          │
│  • POST   /api/sessions                                            │
│  • PATCH  /api/sessions/{id}                                       │
│  • POST   /api/sessions/{id}/timeline                              │
│  • GET    /api/tasks/{id}/children                                 │
│                                                                     │
│  Services:                                                          │
│  • Storage          - In-memory/file persistence                   │
│  • WebSocket        - Event broadcasting                            │
│  • Validation       - Data validation                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Worker Session Spawning

```
┌──────────────────────┐
│  User (via UI)       │
│  "Spawn Worker"      │
└──────┬───────────────┘
       │
       │ 1. UI generates manifest
       │    - Task data from server
       │    - Selected skills
       │    - Session config
       │
       ▼
┌─────────────────────────────────────┐
│  UI creates:                        │
│  ~/.maestro/sessions/sess-123/      │
│    └── manifest.json                │
└──────┬──────────────────────────────┘
       │
       │ 2. UI spawns terminal
       │    - Sets env vars
       │    - Runs: maestro worker init
       │
       ▼
┌─────────────────────────────────────┐
│  Terminal opens                     │
│  Environment:                       │
│    MAESTRO_MANIFEST_PATH=           │
│      ~/.maestro/sessions/sess-123/  │
│        manifest.json                │
│    MAESTRO_SESSION_ID=sess-123      │
│    MAESTRO_PROJECT_ID=proj-1        │
│    MAESTRO_API_URL=http://...       │
└──────┬──────────────────────────────┘
       │
       │ 3. maestro worker init runs
       │
       ▼
┌─────────────────────────────────────┐
│  Maestro CLI:                       │
│  1. Read manifest                   │
│  2. Validate schema                 │
│  3. Generate system prompt          │
│  4. Load skills                     │
│  5. Execute SessionStart hook       │
│  6. Display session brief           │
│  7. Execute initial commands        │
│  8. Spawn Claude                    │
└──────┬──────────────────────────────┘
       │
       │ 4. SessionStart hook
       │    POST /api/sessions
       │    { id, status: "running" }
       │
       ▼
┌─────────────────────────────────────┐
│  Maestro Server                     │
│  - Stores session                   │
│  - Broadcasts to UI                 │
└──────┬──────────────────────────────┘
       │
       │ 5. WebSocket event
       │    session:created
       │
       ▼
┌─────────────────────────────────────┐
│  UI Updates                         │
│  - Shows session as "running"       │
└─────────────────────────────────────┘


┌─────────────────────────────────────┐
│  Claude Code Session                │
│  - Running with Maestro context     │
│  - Agent executes task              │
│  - Uses maestro commands            │
└──────┬──────────────────────────────┘
       │
       │ 6. Agent exits
       │
       ▼
┌─────────────────────────────────────┐
│  CLI detects exit                   │
│  - Execute SessionEnd hook          │
│  - PATCH /api/sessions/{id}         │
│    { status: "completed" }          │
└──────┬──────────────────────────────┘
       │
       │ 7. Server updates
       │
       ▼
┌─────────────────────────────────────┐
│  UI Updates                         │
│  - Shows session as "completed"     │
└─────────────────────────────────────┘
```

---

## Responsibility Matrix

| Component | Responsibilities | Does NOT Do |
|-----------|-----------------|-------------|
| **UI** | • Display tasks, sessions, subtasks<br>• Handle user input<br>• Generate manifests<br>• Spawn terminals with env vars<br>• WebSocket event handling | • Build Claude commands<br>• Execute hooks<br>• Manage Claude process<br>• Generate prompts |
| **CLI** | • Read manifests<br>• Generate prompts<br>• Load skills<br>• Execute hooks<br>• Spawn Claude<br>• Monitor process<br>• Server communication | • Store persistent state<br>• Broadcast events<br>• UI rendering |
| **Server** | • Store tasks/sessions<br>• Validate operations<br>• Broadcast WebSocket events<br>• Serve API endpoints | • Execute sessions<br>• Spawn Claude<br>• Generate prompts<br>• Run hooks |

---

## File System Layout

```
~/.maestro/
├── sessions/                      # Session-specific data
│   ├── sess-123/
│   │   ├── manifest.json         # Complete session manifest
│   │   └── .maestro-session      # Session metadata (optional)
│   └── sess-456/
│       └── manifest.json
│
├── templates/                     # System prompt templates (built-in)
│   ├── worker-prompt.md
│   └── orchestrator-prompt.md
│
├── config.json                    # CLI configuration
│
├── config                        # dotenv config file (key=value)
│
├── data/                         # Server-synced data (read by LocalStorage)
│   ├── projects/
│   │   └── proj-1.json
│   ├── tasks/
│   │   └── proj-1/
│   │       └── task-1.json
│   └── sessions/
│       └── sess-1.json
│
└── logs/                          # CLI logs (optional)
    └── maestro-cli.log

~/.skills/                         # Standard Claude Code skills
├── code-visualizer/
│   └── skill.md
├── frontend-design/
│   └── skill.md
└── skill-creator/
    └── skill.md
```

---

## Communication Patterns

### 1. CLI → Server (REST API)

```
POST   /api/sessions              - Create session (SessionStart)
PATCH  /api/sessions/{id}         - Update session (SessionEnd)
POST   /api/sessions/{id}/timeline - Report progress (via maestro report)
GET    /api/tasks/{id}            - Fetch task details
PATCH  /api/tasks/{id}            - Update task (status or sessionStatus)
POST   /api/tasks                 - Create task
GET    /api/tasks/{id}/children   - Get child tasks
```

### 2. Server → UI (WebSocket)

```
session:created    - New session started
session:updated    - Session status changed
task:updated       - Task modified
timeline:added     - Progress update (via report commands)
```

### 3. UI → Terminal (Process Spawn)

```bash
command: maestro worker init

env:
  MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-123/manifest.json
  MAESTRO_SESSION_ID=sess-123
  MAESTRO_PROJECT_ID=proj-1
  MAESTRO_API_URL=http://localhost:3000
```

### 4. CLI → Local Storage (File System Read)

```
READ   ~/.maestro/data/projects/*.json    - Cached project data
READ   ~/.maestro/data/tasks/**/*.json    - Cached task data
READ   ~/.maestro/data/sessions/*.json    - Cached session data
```

The LocalStorage service provides read-only access to data written by the server. This enables fast, offline-capable reads without API calls.

---

## Orchestrator Spawning Workers

```
┌──────────────────────────────────────┐
│  Orchestrator Session                │
│  (Claude Code running)               │
└──────┬───────────────────────────────┘
       │
       │ Agent runs:
       │ maestro session spawn --task t1
       │
       ▼
┌──────────────────────────────────────┐
│  Maestro CLI (session spawn)         │
│  1. Fetch task t1 from server        │
│  2. Generate worker manifest         │
│  3. Save to ~/.maestro/sessions/     │
│  4. Call server spawn API            │
└──────┬───────────────────────────────┘
       │
       │ POST /api/sessions/spawn
       │ { manifestPath, projectId }
       │
       ▼
┌──────────────────────────────────────┐
│  Maestro Server                      │
│  - Validates request                 │
│  - Broadcasts spawn event            │
└──────┬───────────────────────────────┘
       │
       │ WebSocket:
       │ session:spawn_request
       │
       ▼
┌──────────────────────────────────────┐
│  UI receives spawn event             │
│  - Reads manifest path from event    │
│  - Spawns terminal with env vars     │
└──────┬───────────────────────────────┘
       │
       │ New terminal:
       │ maestro worker init
       │
       ▼
┌──────────────────────────────────────┐
│  Worker Session Starts               │
│  (follows worker flow above)         │
└──────────────────────────────────────┘
```

---

## Offline vs Online Mode

### Online Mode (With Server)

```
CLI ←─────────→ Server ←─────────→ UI
    HTTP API         WebSocket

• SessionStart reports to server
• SessionEnd reports to server
• Commands query server for data
• Progress updates broadcast to UI
• Multi-client synchronization
```

### Offline Mode (No Server)

```
CLI ──────→ Local Manifest
            ~/.maestro/sessions/sess-123/manifest.json

• Reads manifest for task data
• No SessionStart/SessionEnd hooks
• No server API calls
• Commands read from manifest only
• Single-user workflow
```

---

## Manifest Generation Flow

```
┌──────────────────────────────────────┐
│  UI: User configures task           │
│  1. Select task                      │
│  2. Choose skills (optional)         │
│  3. Configure session                │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  UI: Generate Manifest               │
│  {                                   │
│    manifestVersion: "1.0",           │
│    role: "worker",                   │
│    task: { /* full task data */ },  │
│    skills: ["code-visualizer"],      │
│    session: { /* config */ }         │
│  }                                   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  UI: Save Manifest                   │
│  Write to:                           │
│  ~/.maestro/sessions/{id}/           │
│    manifest.json                     │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  UI: Spawn Terminal                  │
│  Set MAESTRO_MANIFEST_PATH           │
│  Run: maestro worker init            │
└──────────────────────────────────────┘
```

---

## Component Dependencies

```
┌─────────────┐
│     UI      │
└──────┬──────┘
       │
       │ depends on
       │
       ▼
┌─────────────┐     depends on     ┌─────────────┐
│  Manifest   │ ──────────────────→│   Server    │
│   Files     │                     │    (API)    │
└──────┬──────┘                     └─────────────┘
       │                                    ▲
       │ depends on                         │
       │                                    │
       ▼                                    │
┌─────────────┐                             │
│     CLI     │────────────────────────────┘
└──────┬──────┘         depends on
       │
       │ depends on
       │
       ▼
┌─────────────┐
│ Claude Code │
└─────────────┘
```

**Key Points:**
- UI depends on server for task data
- CLI depends on manifest files (generated by UI)
- CLI optionally depends on server (for hooks and commands)
- CLI depends on Claude Code (spawns it)
- System works offline if server is unavailable

---

## Summary

These diagrams show:
- ✅ Clear separation of responsibilities
- ✅ Data flow through the system
- ✅ How components communicate
- ✅ File system organization
- ✅ Online and offline modes
- ✅ Orchestrator spawning pattern

Next: See implementation details in other documentation files.
