# Phase II Architecture Visualization

## Hooks & Real-time Observability

This diagram shows how Claude Code hooks provide real-time visibility into agent actions.

### High-Level Architecture

```mermaid
flowchart TD
    subgraph Client ["Claude Code Session"]
        Agent[Claude Agent]
        Tool[Tool Execution]
        Hook["Hook Script (.sh)"]
        
        Agent -->|Calls| Tool
        Tool -->|Triggers| Hook
    end

    subgraph Server ["Maestro Server"]
        Webhook[Webhook Endpoint]
        Storage[Session Storage]
        WS_Server[WebSocket Server]

        Webhook -->|1. Receive| Storage
        Storage -->|2. Broadcast| WS_Server
    end

    subgraph Frontend ["Maestro UI"]
        WS_Client[WebSocket Client]
        Feed[Live Activity Feed]
        Timeline[Task Timeline]
        Metrics[Tool Charts]

        WS_Server -.->|3. Event| WS_Client
        WS_Client --> Feed
        WS_Client --> Timeline
        WS_Client --> Metrics
    end

    Hook -->|HTTP POST| Webhook
    style Hook fill:#f9f,stroke:#333,stroke-width:2px
    style Webhook fill:#bbf,stroke:#333,stroke-width:2px
    style Feed fill:#bfb,stroke:#333,stroke-width:2px
```

### Detailed Hook Event Flow

This sequence diagram details the lifecycle of a single tool use event (e.g., "Read File").

```mermaid
sequenceDiagram
    participant Claude as Claude Code
    participant Hook as .claude/hooks/log-tool-use.sh
    participant Webhook as POST /api/webhooks/hook-event
    participant Server as Maestro Server
    participant UI as Maestro UI

    Note over Claude: Agent executes "Read file.ts"
    Claude->>Hook: Trigger PostToolUse Event
    
    Note right of Claude: Input JSON:<br/>{ tool: "Read", file: "file.ts", ... }

    rect rgb(255, 250, 240)
        Note over Hook: Async Execution
        Hook->>Webhook: HTTP POST (Payload)
        Hook-->>Claude: Exit 0 (Don't block agent)
    end

    rect rgb(240, 248, 255)
        Note over Server: Server Processing
        Webhook->>Server: Validate & Map Session
        Server->>Server: Update Metrics (Read count++)
        Server->>Server: Add to Timeline
        Server->>UI: WS Broadcast: hook:tool_use
    end

    rect rgb(240, 255, 240)
        Note over UI: UI Update (< 100ms)
        UI->>UI: Add to Activity Feed
        UI->>UI: Update "Last Activity"
        UI->>UI: Increment Charts
    end
```

## Permission Blocking Flow

This diagram illustrates how the system handles blocking permissions (e.g., preventing dangerous commands).

```mermaid
sequenceDiagram
    participant Claude as Claude Code
    participant Hook as notify-permission.sh
    participant Server as Maestro Server
    participant UI as Maestro UI
    participant User

    Note over Claude: Agent attempts dangerous command
    Claude->>Claude: Internal Permission Prompt
    Claude->>Hook: Trigger Notification (permission_prompt)

    Hook->>Server: POST /api/webhooks/hook-event
    Server->>UI: WS: hook:notification
    
    rect rgb(255, 200, 200)
        Note over UI: BLOCKED STATE
        UI->>UI: Show "⚠️ Blocked" Badge
        UI->>User: Display Permission Modal
    end

    User->>Claude: Approves/Denies in Terminal
    
    Claude->>Hook: Trigger PostToolUse (if approved)
    Hook->>Server: POST /api/webhooks/hook-event
    Server->>UI: WS: hook:tool_use
    
    rect rgb(200, 255, 200)
        Note over UI: ACTIVE STATE
        UI->>UI: Remove "Blocked" Badge
        UI->>UI: Show Tool Execution
    end
```
