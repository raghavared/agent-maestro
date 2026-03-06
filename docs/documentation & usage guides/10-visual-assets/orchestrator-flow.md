# Orchestrator Flow Diagram

## Overview

The orchestrator pattern shows how a coordinator session decomposes work, spawns worker sessions, monitors progress, and verifies completion.

## Full Orchestrator Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI as Desktop App / CLI
    participant Server as Maestro Server
    participant Coord as Coordinator Session
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant W3 as Worker 3

    User->>UI: Create tasks & spawn coordinator
    UI->>Server: POST /api/sessions/spawn<br/>(mode: coordinator)
    Server-->>Coord: Session starts with task list

    rect rgb(230, 240, 255)
        Note over Coord: Phase 1: Analyze & Decompose
        Coord->>Server: Read tasks via CLI
        Coord->>Coord: Analyze dependencies,<br/>plan execution order
        Coord->>Server: Create sub-tasks if needed
    end

    rect rgb(255, 243, 224)
        Note over Coord: Phase 2: Spawn Workers
        Coord->>Server: maestro session spawn<br/>--task T1 --team-member-id M1
        Server-->>W1: Worker 1 starts (spawning → working)
        Coord->>Server: maestro session spawn<br/>--task T2 --team-member-id M2
        Server-->>W2: Worker 2 starts (spawning → working)
        Coord->>Server: maestro session spawn<br/>--task T3 --team-member-id M3
        Server-->>W3: Worker 3 starts (spawning → working)
    end

    rect rgb(232, 245, 233)
        Note over Coord: Phase 3: Monitor & Coordinate
        par Workers execute in parallel
            W1->>Server: maestro task report progress T1 "..."
            W2->>Server: maestro task report progress T2 "..."
            W3->>Server: maestro task report progress T3 "..."
        end

        Coord->>Server: maestro session watch W1,W2,W3
        Note over Coord: Watches until sessions complete

        W1->>Server: maestro task report complete T1 "Done"
        Note over W1: Status: working → completed

        W2->>Server: maestro task report blocked T2 "Need info"
        Note over W2: Status: working → idle (needs input)

        Coord->>Server: maestro session prompt W2<br/>--message "Here's the info you need"
        Note over W2: Status: idle → working (resumes)

        W2->>Server: maestro task report complete T2 "Done"
        W3->>Server: maestro task report complete T3 "Done"
    end

    rect rgb(243, 229, 245)
        Note over Coord: Phase 4: Verify & Report
        Coord->>Coord: Review all task completions
        Coord->>Server: maestro session report complete<br/>"All 3 tasks completed successfully"
        Server-->>UI: WebSocket: session:updated
        UI-->>User: Dashboard shows all green
    end
```

## Simplified Orchestrator Flow

```mermaid
graph TB
    Start((User Spawns<br/>Coordinator)) --> Analyze

    subgraph Phase1 ["1. Analyze"]
        Analyze[Read Tasks &<br/>Plan Execution]
    end

    Analyze --> Spawn

    subgraph Phase2 ["2. Spawn Workers"]
        Spawn[Spawn Worker Sessions<br/>with Team Members]
        Spawn --> W1[Worker 1<br/>Task A]
        Spawn --> W2[Worker 2<br/>Task B]
        Spawn --> W3[Worker 3<br/>Task C]
    end

    W1 --> Monitor
    W2 --> Monitor
    W3 --> Monitor

    subgraph Phase3 ["3. Monitor"]
        Monitor[Watch Sessions &<br/>Handle Blockers]
    end

    Monitor --> Verify

    subgraph Phase4 ["4. Verify"]
        Verify[Review Results &<br/>Report Completion]
    end

    Verify --> Done((All Tasks<br/>Completed))

    style Phase1 fill:#e3f2fd,stroke:#1565c0
    style Phase2 fill:#fff3e0,stroke:#e65100
    style Phase3 fill:#e8f5e9,stroke:#2e7d32
    style Phase4 fill:#f3e5f5,stroke:#6a1b9a
```

## Coordinator Modes

```mermaid
graph TB
    subgraph Standalone ["Standalone Coordinator"]
        C1[Coordinator<br/>mode: coordinator]
        C1 --> W1a[Worker]
        C1 --> W1b[Worker]
    end

    subgraph Nested ["Nested Coordination"]
        C2[Root Coordinator<br/>mode: coordinator]
        C2 --> CC1[Sub-Coordinator<br/>mode: coordinated-coordinator]
        C2 --> CC2[Sub-Coordinator<br/>mode: coordinated-coordinator]
        CC1 --> W2a[Worker<br/>mode: coordinated-worker]
        CC1 --> W2b[Worker<br/>mode: coordinated-worker]
        CC2 --> W2c[Worker<br/>mode: coordinated-worker]
    end

    style Standalone fill:#e3f2fd,stroke:#1565c0
    style Nested fill:#fff3e0,stroke:#e65100
```

## Built-in Workflow Templates

| Template | Strategy | Best For |
|----------|----------|----------|
| `coordinate-default` | Sequential decompose → spawn → monitor → verify | General orchestration |
| `coordinate-batching` | Group independent tasks into parallel batches | Many independent tasks |
| `coordinate-dag` | DAG-based execution in topological waves | Tasks with dependencies |

## Text Description

```
ORCHESTRATOR 4-PHASE FLOW:

1. ANALYZE
   - Coordinator receives task list
   - Reads task descriptions and dependencies
   - Plans execution order and parallelism

2. SPAWN WORKERS
   - Creates worker sessions for each task/group
   - Assigns team members with appropriate skills
   - Workers start executing independently

3. MONITOR & COORDINATE
   - Watches all worker sessions (session watch)
   - Handles blockers by prompting workers
   - Resolves dependencies between tasks
   - Can spawn additional workers if needed

4. VERIFY & REPORT
   - Reviews all task completions
   - Validates output quality
   - Reports final status to parent/user
```

## Usage

- **Where**: "Orchestrator" workflow guide, "How It Works" deep dive
- **Format**: Use full sequence diagram for detailed reference; simplified flow for overview
- **Key points**: 4-phase pattern, parallel worker execution, coordinator handles inter-worker communication, nested coordination is possible
