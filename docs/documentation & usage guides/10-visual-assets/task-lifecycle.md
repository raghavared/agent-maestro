# Task Lifecycle Diagram

## Overview

Tasks in Maestro follow a state machine with 7 possible statuses. This diagram shows all valid transitions.

## Mermaid State Diagram

```mermaid
stateDiagram-v2
    [*] --> todo : Task Created

    todo --> in_progress : Session starts working<br/>or manual status change
    todo --> cancelled : User cancels
    todo --> blocked : Dependency unmet

    in_progress --> completed : Work finished successfully
    in_progress --> in_review : Ready for review
    in_progress --> blocked : Hit a blocker
    in_progress --> cancelled : User cancels

    blocked --> in_progress : Blocker resolved
    blocked --> todo : Reset to backlog
    blocked --> cancelled : User cancels

    in_review --> completed : Review approved
    in_review --> in_progress : Changes requested

    completed --> archived : Cleanup / archive
    cancelled --> archived : Cleanup / archive

    completed --> [*]
    archived --> [*]

    state todo {
        [*] : Waiting to start
    }

    state in_progress {
        [*] : Agent actively working
    }

    state blocked {
        [*] : Cannot proceed
    }

    state in_review {
        [*] : Awaiting review
    }

    state completed {
        [*] : Successfully done
    }

    state cancelled {
        [*] : Abandoned
    }

    state archived {
        [*] : Historical record
    }
```

## Simplified Flow Diagram

```mermaid
graph LR
    A((Start)) --> B[todo]
    B --> C[in_progress]
    C --> D[completed]
    C --> E[in_review]
    E --> D
    E --> C
    C --> F[blocked]
    F --> C
    B --> G[cancelled]
    C --> G
    D --> H[archived]
    G --> H

    style B fill:#e3f2fd,stroke:#1565c0
    style C fill:#fff3e0,stroke:#e65100
    style D fill:#e8f5e9,stroke:#2e7d32
    style E fill:#fff9c4,stroke:#f9a825
    style F fill:#ffebee,stroke:#c62828
    style G fill:#efebe9,stroke:#4e342e
    style H fill:#f5f5f5,stroke:#616161
```

## Per-Session Task Status

Tasks also track per-session status via `taskSessionStatuses`:

```mermaid
stateDiagram-v2
    [*] --> assigned : Session assigned to task
    assigned --> working : Session begins execution
    working --> done : Session completes its part
    working --> error : Session encounters error
    working --> blocked : Session hits blocker
    blocked --> working : Blocker resolved
    error --> working : Retry
```

This allows multiple sessions to work on the same task, each tracking their own progress independently.

## Text Description

```
HAPPY PATH:
  todo ──→ in_progress ──→ completed ──→ archived

WITH REVIEW:
  todo ──→ in_progress ──→ in_review ──→ completed

BLOCKED PATH:
  todo ──→ in_progress ──→ blocked ──→ in_progress ──→ completed

CANCELLED PATH:
  todo ──→ cancelled ──→ archived
  in_progress ──→ cancelled ──→ archived

STATUS COLORS:
  todo        = Blue (waiting)
  in_progress = Orange (active)
  completed   = Green (success)
  in_review   = Yellow (pending review)
  blocked     = Red (stuck)
  cancelled   = Brown (abandoned)
  archived    = Gray (historical)
```

## Usage

- **Where**: "Tasks" concept page, task management guides
- **Format**: Render the simplified flow for inline use; full state diagram for detailed reference
- **Key points**: Tasks can move backward (review → in_progress), blocked is recoverable, per-session status exists independently
