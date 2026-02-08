# Worker Strategy System - Overview

## Vision

Transform Maestro from a static task-session binding model to a dynamic, **strategy-driven** orchestration system where:

1. **Sessions have processing strategies** (simple, queue, stack, DAG, priority, etc.)
2. **Tasks flow through data structures** based on the chosen strategy
3. **Claude Code runs a simple worker loop** instead of managing complex state
4. **Users can dynamically inject tasks** into running sessions
5. **Status management is decoupled** from the AI agent

## Design Pattern

This system implements the **Strategy Pattern**:

```
Session (Context)
    │
    └── WorkerTypeStrategy (Strategy Interface)
            │
            ├── SimpleStrategy      ← Default (current behavior)
            ├── QueueStrategy       ← FIFO processing
            ├── StackStrategy       ← LIFO processing
            ├── PriorityStrategy    ← Priority-based
            └── DAGStrategy         ← Dependency-aware
```

Each strategy encapsulates:
- **Data Structure**: How tasks are stored (none, queue, stack, etc.)
- **Algorithm**: How next task is selected
- **Commands**: What CLI commands are available
- **Status Rules**: Valid state transitions

## The Problem Today

Currently, Maestro sessions work like this:
```
1. User selects tasks → Session spawns with those tasks
2. Session manifest contains all context upfront
3. Claude Code receives a big prompt with all tasks
4. Task completion is managed by Claude Code itself
5. No way to add tasks to a running session
```

**Issues:**
- Tasks are static once session spawns
- Claude Code manages its own status updates (error-prone)
- No structured processing order
- Can't inject new work into running sessions
- Complex prompts with all context upfront

## The Solution: Worker Strategy System

```
┌─────────────────────────────────────────────────────────────┐
│                        MAESTRO UI                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Task List   │  │ Session     │  │ Data Structure View │  │
│  │             │→→│ + Worker    │→→│ Queue/Stack/DAG     │  │
│  │             │  │   Type      │  │ visualization       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MAESTRO SERVER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Session Data Structures                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │ Queue   │  │ Stack   │  │   DAG   │  ...         │   │
│  │  └─────────┘  └─────────┘  └─────────┘              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Worker Type Definitions                               │   │
│  │  - Allowed commands per type                          │   │
│  │  - Status transition rules                            │   │
│  │  - System prompt templates                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       MAESTRO CLI                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ maestro worker init    → Initialize worker loop       │   │
│  │ maestro who-am-i       → Get worker type & commands   │   │
│  │ maestro queue top      → Peek at next task            │   │
│  │ maestro queue pop      → Get & remove next task       │   │
│  │ maestro queue start    → Start working on top task    │   │
│  │ maestro queue complete → Mark top task complete       │   │
│  │ maestro queue fail     → Mark top task failed         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLAUDE CODE                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Simple Worker Loop:                                   │   │
│  │                                                       │   │
│  │   while (true) {                                      │   │
│  │     task = maestro queue start                        │   │
│  │     if (!task) break                                  │   │
│  │     // work on task                                   │   │
│  │     maestro queue complete|fail                       │   │
│  │   }                                                   │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Worker Type Strategies
Each session has a `strategy` that determines:
- What data structure it uses (none, queue, stack, DAG, priority queue)
- What commands are available
- How tasks are processed (freeform, FIFO, LIFO, dependency-based, priority-based)
- What system prompt the agent receives

**Available Strategies:**

| Strategy | Data Structure | Processing | Best For |
|----------|---------------|------------|----------|
| **Simple** (default) | None | Agent decides | Simple tasks, autonomous work |
| Queue | Queue (FIFO) | Sequential | Ordered workflows |
| Stack | Stack (LIFO) | Depth-first | Tasks with subtasks |
| Priority | Priority Queue | By priority | Mixed urgency |
| DAG | Directed Graph | Respects deps | Complex workflows |
| Round Robin | Circular Queue | Rotating | Parallel progress |

The **Simple Strategy** is the default - it preserves current behavior where all tasks are given upfront and Claude handles them freely. Structured strategies (Queue, Stack, etc.) add more control and dynamic capabilities.

### 2. Data Structure Encapsulation
The data structure is **internal to the strategy**, not a property of the session:

```typescript
// Session is clean - just references strategy by ID
interface Session {
  id: string;
  strategy: StrategyId;      // 'simple' | 'queue' | 'stack' | etc.
  config: WorkerConfig;
  taskIds: string[];
  status: SessionStatus;
  // NO dataStructure field - it's encapsulated
}

// Data structure is managed internally by StrategyRuntime
class StrategyRuntime {
  private strategy: WorkerTypeStrategy;
  private dataStructure?: SessionDataStructure;  // Internal

  // Commands operate on internal state
  start(): Task { ... }
  complete(taskId): void { ... }
}
```

This keeps the Session model simple while the strategy handles its own implementation details.

### 3. Status Separation
- **User Status**: User-controlled task status (todo, in_progress, done, etc.)
- **Session Status**: Worker-controlled per-session status (queued, processing, completed, failed)

### 4. Dynamic Task Injection
Users can add tasks to running sessions:
```bash
# From UI: Click "Add to Session" → Select session → Task added to queue
# From CLI: maestro session add-task <sessionId> <taskId>
```

## Document Index

| Document | Description |
|----------|-------------|
| [01-WORKER-TYPES.md](./01-WORKER-TYPES.md) | Structured strategy definitions (Queue, Stack, etc.) |
| [01a-MANIFEST-WORKER.md](./01a-MANIFEST-WORKER.md) | **Default** - Simple strategy (current behavior) |
| [02-DATA-STRUCTURES.md](./02-DATA-STRUCTURES.md) | Data structure specifications |
| [02a-STRATEGY-PATTERN.md](./02a-STRATEGY-PATTERN.md) | **Core** - Strategy Pattern architecture |
| [03-CLI-COMMANDS.md](./03-CLI-COMMANDS.md) | New CLI command specifications |
| [04-SERVER-API.md](./04-SERVER-API.md) | Server API changes |
| [05-STATUS-FLOWS.md](./05-STATUS-FLOWS.md) | Status transition rules |
| [06-UI-CHANGES.md](./06-UI-CHANGES.md) | UI implementation changes |
| [07-IMPLEMENTATION-PLAN.md](./07-IMPLEMENTATION-PLAN.md) | Phased implementation approach |
| [08-ADVANTAGES.md](./08-ADVANTAGES.md) | Benefits of this architecture |
| [09-DISADVANTAGES.md](./09-DISADVANTAGES.md) | Tradeoffs and limitations |
| [10-POTENTIAL-PROBLEMS.md](./10-POTENTIAL-PROBLEMS.md) | Risks and mitigations |
