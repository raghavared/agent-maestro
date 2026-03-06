# Session Spawn Flow Diagram

## Overview

This diagram shows the complete end-to-end sequence of spawning a new session, from the initial API call through manifest generation to the AI agent starting work.

## Full Spawn Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as Desktop App
    participant Server as Maestro Server
    participant FS as File System (~/.maestro/)
    participant CLI as Maestro CLI
    participant PTY as PTY Terminal
    participant Agent as AI Agent (Claude/Codex/Gemini)

    Note over User,Agent: Step 1: Initiate Spawn
    User->>UI: Click "Start Session" or<br/>select task + team member
    UI->>Server: POST /api/sessions/spawn<br/>{taskIds, teamMemberId, mode, ...}

    Note over Server,FS: Step 2: Create Session Record
    Server->>FS: Write sessions/<id>.json<br/>(status: "spawning")
    Server->>FS: Update tasks/<id>.json<br/>(add sessionId)

    Note over Server,CLI: Step 3: Generate Manifest
    Server->>CLI: maestro manifest generate<br/>--mode worker --task-ids T1,T2<br/>--team-member-id M1 --model opus
    CLI->>FS: Read team member config
    CLI->>FS: Read task data
    CLI->>FS: Read skill definitions
    CLI->>FS: Write sessions/<id>/manifest.json

    Note over Server,UI: Step 4: Notify Clients
    Server-->>UI: WebSocket: session:created<br/>{sessionId, status: "spawning"}
    UI->>UI: Update dashboard<br/>(new session appears)

    Note over UI,PTY: Step 5: Create PTY
    UI->>PTY: Tauri create_session()<br/>(spawn terminal process)
    PTY->>PTY: Initialize shell environment<br/>Set MAESTRO_* env vars

    Note over PTY,Agent: Step 6: Start Agent
    PTY->>CLI: maestro worker init<br/>(or orchestrator init)
    CLI->>FS: Read manifest.json
    CLI->>CLI: Build agent command with:<br/>--append-system-prompt<br/>+ task XML payload

    CLI->>Agent: Execute: claude --append-system-prompt ...<br/>(or codex/gemini equivalent)

    Note over Agent,Server: Step 7: Agent Registers
    Agent->>CLI: maestro session register
    CLI->>Server: PATCH /api/sessions/<id><br/>{status: "working"}
    Server-->>UI: WebSocket: session:updated<br/>{status: "working"}

    Note over Agent: Step 8: Agent Begins Work
    Agent->>Agent: Read task descriptions<br/>Start executing
    Agent->>CLI: maestro task report progress T1<br/>"Starting implementation..."
    CLI->>Server: POST /api/tasks/<id>/timeline
    Server-->>UI: WebSocket: task:updated
```

## Simplified Spawn Flow

```mermaid
graph TB
    A[User clicks Start] --> B[Server creates session<br/>status: spawning]
    B --> C[CLI generates manifest<br/>with tasks + config]
    C --> D[UI notified via WebSocket]
    D --> E[Tauri spawns PTY terminal]
    E --> F[CLI reads manifest,<br/>builds agent command]
    F --> G[AI Agent starts<br/>with system prompt]
    G --> H[Agent registers<br/>status: working]
    H --> I[Agent begins<br/>task execution]

    style A fill:#e3f2fd,stroke:#1565c0
    style B fill:#e1bee7,stroke:#6a1b9a
    style C fill:#fff3e0,stroke:#e65100
    style D fill:#e3f2fd,stroke:#1565c0
    style E fill:#f3e5f5,stroke:#6a1b9a
    style F fill:#fff3e0,stroke:#e65100
    style G fill:#e8f5e9,stroke:#2e7d32
    style H fill:#e8f5e9,stroke:#2e7d32
    style I fill:#e8f5e9,stroke:#2e7d32
```

## Manifest Contents

The generated manifest (`~/.maestro/sessions/<id>/manifest.json`) contains:

```mermaid
graph LR
    subgraph Manifest ["manifest.json"]
        direction TB
        Meta["<b>Metadata</b><br/>manifestVersion<br/>mode (worker/coordinator)"]
        Tasks["<b>Tasks</b><br/>Task titles, descriptions,<br/>dependencies, priorities"]
        Session["<b>Session Config</b><br/>sessionId, projectId,<br/>environment variables"]
        Team["<b>Team Member</b><br/>name, identity, memory,<br/>capabilities, permissions"]
        Skills["<b>Skills</b><br/>Skill IDs to attach<br/>as plugins"]
        Agent["<b>Agent Config</b><br/>agentTool, model,<br/>permissionMode"]
    end

    style Meta fill:#e3f2fd,stroke:#1565c0
    style Tasks fill:#fff3e0,stroke:#e65100
    style Session fill:#e8f5e9,stroke:#2e7d32
    style Team fill:#f3e5f5,stroke:#6a1b9a
    style Skills fill:#fff9c4,stroke:#f9a825
    style Agent fill:#ffebee,stroke:#c62828
```

## Environment Variables Set for Agent

```mermaid
graph LR
    subgraph EnvVars ["PTY Environment"]
        V1["MAESTRO_API_URL<br/>http://localhost:3000"]
        V2["MAESTRO_PROJECT_ID<br/>&lt;project-id&gt;"]
        V3["MAESTRO_SESSION_ID<br/>&lt;session-id&gt;"]
        V4["MAESTRO_TASK_IDS<br/>task1,task2"]
        V5["MAESTRO_ROLE<br/>worker | orchestrator"]
        V6["MAESTRO_MANIFEST_PATH<br/>~/.maestro/sessions/&lt;id&gt;/manifest.json"]
    end
```

## CLI vs Desktop App Spawn

```mermaid
graph TB
    subgraph CLISpawn ["CLI Spawn"]
        CL1["maestro session spawn<br/>--task T1 --mode worker"] --> CL2[Server creates session]
        CL2 --> CL3[CLI generates manifest]
        CL3 --> CL4[CLI directly runs<br/>agent in current terminal]
    end

    subgraph UISpawn ["Desktop App Spawn"]
        UI1["Click Start in UI"] --> UI2[Server creates session]
        UI2 --> UI3[CLI generates manifest]
        UI3 --> UI4[WebSocket notifies UI]
        UI4 --> UI5[Tauri creates PTY<br/>in managed terminal]
    end

    style CLISpawn fill:#e3f2fd,stroke:#1565c0
    style UISpawn fill:#fff3e0,stroke:#e65100
```

## Text Description

```
END-TO-END SPAWN FLOW:

1. INITIATE
   - User clicks "Start" in UI, or runs `maestro session spawn` in CLI
   - Request sent to server: POST /api/sessions/spawn

2. CREATE SESSION
   - Server creates session JSON file (status: spawning)
   - Server updates task records with new session ID

3. GENERATE MANIFEST
   - CLI runs `maestro manifest generate`
   - Reads team member config, task data, skill definitions
   - Writes manifest.json to ~/.maestro/sessions/<id>/

4. NOTIFY CLIENTS
   - Server emits WebSocket event: session:created
   - UI updates dashboard to show new spawning session

5. CREATE PTY (Desktop App only)
   - Tauri creates new PTY terminal process
   - Sets MAESTRO_* environment variables

6. START AGENT
   - CLI reads manifest and builds agent command
   - Runs claude/codex/gemini with --append-system-prompt
   - System prompt includes Maestro context + task XML

7. REGISTER
   - Agent calls `maestro session register`
   - Status transitions: spawning → working
   - UI updates to show active session

8. BEGIN WORK
   - Agent reads task descriptions from system prompt
   - Starts executing, reports progress via CLI
```

## Usage

- **Where**: "How It Works" page, "Sessions" concept page, contributor docs
- **Format**: Full sequence for deep dives; simplified flow for overviews
- **Key points**: Manifest is the bridge between config and execution; WebSocket keeps UI in sync; environment variables connect agent to Maestro
