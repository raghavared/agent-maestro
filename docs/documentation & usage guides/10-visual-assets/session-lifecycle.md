# Session Lifecycle Diagram

## Overview

Sessions in Maestro represent active AI agent processes. They follow a lifecycle with 6 possible statuses.

## Mermaid State Diagram

```mermaid
stateDiagram-v2
    [*] --> spawning : POST /api/sessions/spawn

    spawning --> working : PTY initialized,<br/>agent starts execution
    spawning --> failed : Spawn error<br/>(missing model, config error)

    working --> idle : Agent waiting for input<br/>or between tasks
    working --> completed : All tasks finished<br/>successfully
    working --> failed : Unrecoverable error
    working --> stopped : User stops session<br/>or coordinator shuts down

    idle --> working : New prompt received<br/>or new task assigned
    idle --> completed : Session finalized
    idle --> stopped : User stops session

    completed --> [*]
    failed --> [*]
    stopped --> [*]

    state spawning {
        [*] : Creating session record,<br/>generating manifest,<br/>starting PTY
    }

    state working {
        [*] : Agent actively executing<br/>CLI commands and code
    }

    state idle {
        [*] : Agent paused,<br/>waiting for input
    }

    state completed {
        [*] : All work done,<br/>session finalized
    }

    state failed {
        [*] : Error occurred,<br/>session terminated
    }

    state stopped {
        [*] : Manually terminated<br/>by user or coordinator
    }
```

## Simplified Flow Diagram

```mermaid
graph LR
    A((Spawn)) --> B[spawning]
    B --> C[working]
    C --> D[idle]
    D --> C
    C --> E[completed]
    D --> E
    B --> F[failed]
    C --> F
    C --> G[stopped]
    D --> G

    style B fill:#e1bee7,stroke:#6a1b9a
    style C fill:#fff3e0,stroke:#e65100
    style D fill:#e3f2fd,stroke:#1565c0
    style E fill:#e8f5e9,stroke:#2e7d32
    style F fill:#ffebee,stroke:#c62828
    style G fill:#efebe9,stroke:#4e342e
```

## Spawn Sequence Detail

The transition from `spawning` to `working` involves multiple steps:

```mermaid
sequenceDiagram
    participant Client as UI / CLI
    participant Server as Maestro Server
    participant FS as File System
    participant PTY as PTY Process
    participant Agent as AI Agent

    Client->>Server: POST /api/sessions/spawn
    Server->>FS: Create session JSON (status: spawning)
    Server->>FS: Generate manifest JSON
    Server-->>Client: WebSocket: session:created
    Client->>PTY: Tauri create_session()
    PTY->>Agent: Run claude/codex/gemini with --append-system-prompt
    Agent->>Server: maestro session register
    Note over Server: Status: spawning → working
    Server-->>Client: WebSocket: session:updated
```

## needsInput Sub-State

While in `working` or `idle`, a session can signal it needs human input:

```mermaid
stateDiagram-v2
    state working {
        executing --> needs_input : Agent requests input
        needs_input --> executing : Input provided via<br/>session prompt command
    }
```

The `needsInput` field (`{ active: boolean, message?: string }`) allows the UI to display a prompt indicator.

## Text Description

```
HAPPY PATH:
  spawning ──→ working ──→ completed

WITH IDLE:
  spawning ──→ working ──→ idle ──→ working ──→ completed

FAILURE PATH:
  spawning ──→ failed
  spawning ──→ working ──→ failed

MANUAL STOP:
  working ──→ stopped
  idle ──→ stopped

STATUS COLORS:
  spawning  = Purple (initializing)
  working   = Orange (active)
  idle      = Blue (waiting)
  completed = Green (success)
  failed    = Red (error)
  stopped   = Brown (terminated)
```

## Usage

- **Where**: "Sessions" concept page, session management guides
- **Format**: Use simplified flow for overview; full state diagram for reference; spawn sequence for "How It Works"
- **Key points**: Sessions cycle between working/idle, needsInput is a sub-state, spawn is a multi-step process
