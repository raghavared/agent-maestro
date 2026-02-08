# Simple Strategy (Default)

> **Naming**: Also known as "Simple Strategy" - this is the default `WorkerTypeStrategy`.

## Overview

The **Simple Strategy** is the default strategy that preserves the current Maestro behavior. It provides all tasks upfront in a manifest and lets Claude Code handle them freely without structured data structure commands.

This is the "autonomous" strategy - maximum agent freedom, minimum system control.

## When to Use

- **Simple task sets** where order doesn't matter
- **Exploratory work** where the agent should decide the approach
- **Single-task sessions** where orchestration is overkill
- **Legacy compatibility** with existing workflows
- **Quick sessions** where setup overhead isn't worth it

## Strategy Definition

```typescript
const SimpleStrategy: WorkerTypeStrategy = {
  id: 'simple',
  name: 'Simple',
  description: 'All tasks provided upfront, agent decides execution order',
  dataStructure: 'none',  // No data structure management
  isDefault: true,
  allowedCommands: [
    'task list',        // View assigned tasks
    'task get',         // Get task details
    'task update',      // Update task status (existing commands)
    'task complete',    // Mark task complete
    'task fail',        // Mark task failed
  ],
  systemPrompt: `You are a Maestro worker agent. You have been assigned the following tasks to complete.

## Your Tasks
{tasks}

## Guidelines
- Review all tasks and plan your approach
- Complete tasks in whatever order makes sense
- Update task status as you work using \`maestro task update\`
- Mark tasks complete with \`maestro task complete <taskId>\`
- If you cannot complete a task, mark it failed with \`maestro task fail <taskId>\`

## Available Commands
- \`maestro task list\` - View your assigned tasks
- \`maestro task get <taskId>\` - Get full task details
- \`maestro task update <taskId> --status <status>\` - Update status
- \`maestro task complete <taskId>\` - Mark task complete
- \`maestro task fail <taskId> --reason <reason>\` - Mark task failed

Work through the tasks and update their status as you go.`
};
```

## Comparison with Structured Strategies

| Aspect | Simple Strategy | Structured Strategies (Queue, etc.) |
|--------|-----------------|-------------------------------------|
| Task delivery | All upfront in prompt | One at a time via commands |
| Execution order | Agent decides | System enforces |
| Status updates | Agent-initiated | Command-driven |
| Dynamic tasks | Not supported | Supported |
| User control | Minimal | High |
| Complexity | Low | Higher |
| Prompt size | Larger (all tasks) | Smaller (current task only) |
| Best for | Simple, autonomous work | Complex, controlled workflows |

## Data Model

The Simple Strategy doesn't use a data structure. Tasks are simply associated with the session:

```typescript
interface SimpleStrategySession {
  sessionId: string;
  strategy: 'simple';
  taskIds: string[];           // Tasks assigned to this session
  // No data structure state
  // No currentItem
  // No queue/stack operations
}
```

## Status Flow

Simpler status flow - agent updates task status directly:

```
Task Status (agent-controlled):
todo → in_progress → done | failed

No separate "session item status" - uses task status directly
```

## Manifest Format

```json
{
  "sessionId": "sess_abc123",
  "workerType": "manifest",
  "tasks": [
    {
      "id": "task_1",
      "title": "Implement user authentication",
      "description": "Add JWT-based auth...",
      "status": "todo",
      "priority": "high"
    },
    {
      "id": "task_2",
      "title": "Write tests for auth",
      "description": "Unit and integration tests...",
      "status": "todo",
      "priority": "medium"
    },
    {
      "id": "task_3",
      "title": "Update documentation",
      "description": "Add auth docs to README...",
      "status": "todo",
      "priority": "low"
    }
  ],
  "context": {
    "project": { ... },
    "environment": { ... }
  }
}
```

## CLI Commands

The Simple Strategy uses existing task commands, not new data structure commands:

### `maestro task list`

```bash
$ maestro task list

Your Tasks (3):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ID          │ Title                    │ Status    │ Priority
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 task_1      │ Implement auth           │ todo      │ high
 task_2      │ Write tests              │ todo      │ medium
 task_3      │ Update docs              │ todo      │ low
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `maestro task complete`

```bash
$ maestro task complete task_1 --message "Implemented JWT auth with refresh tokens"

✓ Task Completed: task_1
  Title: Implement user authentication

Remaining: 2 tasks
```

### `maestro task fail`

```bash
$ maestro task fail task_2 --reason "Missing test fixtures"

✗ Task Failed: task_2
  Title: Write tests for auth
  Reason: Missing test fixtures
```

## `who-am-i` Output

```bash
$ maestro who-am-i

╔══════════════════════════════════════════════════════════╗
║                   MANIFEST WORKER                         ║
╠══════════════════════════════════════════════════════════╣
║ Session: sess_abc123                                      ║
║ Project: My Project                                       ║
║ Tasks: 3 assigned (1 done, 0 failed, 2 remaining)         ║
╠══════════════════════════════════════════════════════════╣
║ MODE: Autonomous                                          ║
║ You have full control over task execution order.          ║
╠══════════════════════════════════════════════════════════╣
║ AVAILABLE COMMANDS                                        ║
╠══════════════════════════════════════════════════════════╣
║ maestro task list             View your tasks             ║
║ maestro task get <id>         Get task details            ║
║ maestro task complete <id>    Mark task complete          ║
║ maestro task fail <id>        Mark task failed            ║
╠══════════════════════════════════════════════════════════╣
║ WORKFLOW                                                  ║
║ 1. Review your tasks with 'maestro task list'             ║
║ 2. Work on tasks in any order you choose                  ║
║ 3. Mark each task complete or failed when done            ║
╚══════════════════════════════════════════════════════════╝
```

## UI Representation

### Session Panel

```
┌─────────────────────────────────────────────────────────────┐
│ Session: sess_abc123                    [Simple Strategy]   │
│ Status: Working                         Mode: Autonomous    │
├─────────────────────────────────────────────────────────────┤
│ Tasks (3):                                                  │
│                                                             │
│  ✓ [done]    Implement auth                                 │
│  ○ [todo]    Write tests                                    │
│  ○ [todo]    Update docs                                    │
│                                                             │
│ Progress: ████████░░░░░░░░░░░░░░░░ 33% (1/3)                │
└─────────────────────────────────────────────────────────────┘
```

No queue/stack/DAG visualization - just a simple task list with status.

### Worker Type Selection

In the session creation modal, Simple Strategy appears first as default:

```
┌─────────────────────────────────────────────────────────────┐
│ Select Worker Type                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [●] 📋 Manifest (Default)                                  │
│      All tasks upfront, agent decides order                 │
│      Best for: Simple tasks, autonomous work                │
│                                                             │
│  [ ] 📋 Queue                                               │
│      Process tasks in order (FIFO)                          │
│      Best for: Sequential workflows                         │
│                                                             │
│  [ ] 📚 Stack                                               │
│      Depth-first processing (LIFO)                          │
│      Best for: Tasks with subtasks                          │
│                                                             │
│  [ ] ⭐ Priority                                            │
│      Process by priority                                    │
│      Best for: Mixed urgency tasks                          │
│                                                             │
│  [ ] 🔀 DAG                                                 │
│      Respect dependencies                                   │
│      Best for: Complex workflows                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Notes

### Minimal Changes Required

Since this is the current behavior, implementation is mostly about:
1. Formalizing it as a worker type
2. Adding it to the registry
3. Ensuring backward compatibility

### Server Changes

```typescript
// Worker type registry
export const WorkerTypeRegistry: Record<string, WorkerType> = {
  manifest: ManifestWorker,  // Default, first
  queue: QueueWorker,
  stack: StackWorker,
  priority: PriorityWorker,
  dag: DAGWorker,
};

export const DEFAULT_WORKER_TYPE = 'manifest';
```

### Session Creation

```typescript
// When no workerType specified, use manifest
async function createSession(config: SessionConfig) {
  const workerType = config.workerType || DEFAULT_WORKER_TYPE;

  if (workerType === 'manifest') {
    // No data structure initialization needed
    // Just bind tasks to session
    return createManifestSession(config);
  } else {
    // Initialize data structure
    return createStructuredSession(config);
  }
}
```

### Backward Compatibility

Existing sessions without `workerType` are treated as Simple Strategys:

```typescript
function getSessionWorkerType(session: Session): WorkerType {
  return session.workerType || 'manifest';
}
```

## Advantages of Simple Strategy

1. **Simplicity** - No data structure overhead
2. **Flexibility** - Agent decides approach
3. **Familiarity** - Current behavior, no learning curve
4. **Lower latency** - All context upfront, fewer API calls
5. **Backward compatible** - Existing workflows unchanged

## Disadvantages of Simple Strategy

1. **No dynamic tasks** - Can't add tasks mid-session
2. **Less control** - User can't steer execution order
3. **Larger prompts** - All tasks in initial context
4. **Less visibility** - No structured progress tracking
5. **Agent-dependent** - Status updates rely on agent behavior

## Migration Path

For users wanting more control:

```
Simple Strategy (current default)
        ↓
    Need ordered execution? → Queue Worker
    Need depth-first? → Stack Worker
    Need priorities? → Priority Worker
    Need dependencies? → DAG Worker
```

## Summary

The Simple Strategy is the **"just let Claude do it"** strategy. It's:
- The default for backward compatibility
- Best for simple, autonomous work
- Lowest complexity option
- A baseline that structured workers improve upon

Think of it as the foundation: when you need more control, graduate to a structured worker type.
