# Command Permissions System

## Overview

The Maestro CLI includes a command permissions system that controls which commands are available to agents based on their **role** and **strategy**. This ensures agents only have access to commands relevant to their workflow.

## How It Works

### 1. Permissions are Determined by Manifest

When a session is initialized, the CLI reads the manifest to determine:
- **Role**: `worker` or `orchestrator`
- **Strategy**: `simple` (default) or `queue` (for workers only)
- **Explicit Commands**: Optional `session.allowedCommands` array

### 2. Default Command Sets

If `session.allowedCommands` is not specified, the CLI applies default permissions:

#### Worker (Simple Strategy)

```typescript
const defaultCommands = [
  'whoami',              // Show context
  'status',              // Project status
  'commands',            // List available commands
  'report:progress',     // Report work progress
  'report:complete',     // Report completion
  'report:blocked',      // Report blocker
  'report:error',        // Report error
  'report:needs-input',  // Request user input
  'task:list',           // List tasks
  'task:get',            // Get task details
  'task:create',         // Create new tasks
  'task:children',       // List child tasks
  'session:info',        // Get session info
  'session:register',    // Register session
  'session:complete',    // Complete session
  'track-file',          // Track file modifications
  'worker:init'          // Initialize worker
];
```

**Important**: Workers **can** create tasks but **cannot** use `task:update`, `task:complete`, or `task:block`. These update commands are restricted to orchestrators only. Workers report their status via `maestro report` commands which update `sessionStatus`, not `task.status`.

#### Worker (Queue Strategy)

Same as Simple Strategy plus:

```typescript
const queueCommands = [
  'queue:top',       // Show next task in queue
  'queue:start',     // Start processing next task
  'queue:complete',  // Complete current task
  'queue:fail',      // Fail current task
  'queue:skip',      // Skip current task
  'queue:list',      // List all queue items
  'queue:status',    // Show queue status
  'queue:push'       // Add task to queue
];
```

#### Orchestrator (Simple Strategy)

```typescript
const defaultCommands = [
  'whoami',
  'status',
  'commands',
  'report:progress',
  'report:complete',
  'report:blocked',
  'report:error',
  'report:needs-input',
  'task:list',
  'task:get',
  'task:create',       // Create new tasks
  'task:update',       // Update task details/status
  'task:complete',     // Mark task completed
  'task:block',        // Mark task blocked
  'task:children',     // List child tasks
  'task:tree',         // Show task tree
  'session:list',      // List sessions
  'session:info',      // Get session info
  'session:spawn',     // Spawn worker sessions
  'session:register',
  'session:complete',
  'project:list',      // List projects
  'project:get',       // Get project details
  'project:create',    // Create projects
  'project:delete',    // Delete projects
  'track-file',
  'orchestrator:init'  // Initialize orchestrator
];
```

**Note**: Both workers and orchestrators can create tasks. However, only orchestrators can update task status and spawn worker sessions.

### 3. Explicit Override

The manifest can explicitly specify allowed commands:

```json
{
  "session": {
    "allowedCommands": [
      "whoami",
      "task:get",
      "report:progress"
    ]
  }
}
```

**When specified**: ONLY these commands (plus core commands) are allowed.

Core commands that are always included regardless of `allowedCommands`:
- `whoami`
- `status`
- `commands`
- `session:register`
- `session:complete`
- `worker:init` / `orchestrator:init`
- `track-file`

## Command Format

Commands follow the pattern: `<command>` or `<parent>:<subcommand>`

### Examples

| Command | Parent | Subcommand |
|---------|--------|------------|
| `whoami` | - | - |
| `commands` | - | - |
| `task:list` | `task` | `list` |
| `task:get` | `task` | `get` |
| `queue:start` | `queue` | `start` |
| `report:progress` | `report` | `progress` |

## Checking Permissions

### From CLI

```bash
# Show all available commands
$ maestro commands

Session Role: worker
Strategy: simple

Available Commands:

  Core:
    - maestro whoami
    - maestro status
    - maestro commands

  Report:
    - maestro report progress <message>
    - maestro report complete <summary>
    - maestro report blocked <reason>
    - maestro report error <description>
    - maestro report needs-input <question>

  Task:
    - maestro task list
    - maestro task get <id>
    - maestro task create <title>
    - maestro task children <id>
```

### Check Specific Command

```bash
$ maestro commands --check task:create

Command 'task:create' is NOT ALLOWED for worker (simple strategy)

Run "maestro commands" to see available commands.
```

### JSON Output

```bash
$ maestro commands --json

{
  "role": "worker",
  "strategy": "simple",
  "allowedCommands": [
    "whoami",
    "status",
    "commands",
    "report:progress",
    "report:complete",
    "report:blocked",
    "report:error",
    "report:needs-input",
    "task:list",
    "task:get",
    "task:create",
    "task:children",
    "session:info",
    "session:register",
    "session:complete",
    "track-file",
    "worker:init"
  ],
  "hiddenCommands": [
    "task:update",
    "task:complete",
    "task:block",
    "task:tree",
    "session:list",
    "session:spawn",
    "project:list",
    "project:get",
    "project:create",
    "orchestrator:init",
    "queue:top",
    "queue:start",
    "queue:complete",
    "queue:fail",
    "queue:skip",
    "queue:list",
    "queue:status"
  ]
}
```

## Guard System

Commands are protected by `guardCommand()` which checks permissions before execution:

```typescript
// In command handler
export async function guardCommand(commandName: string): Promise<void> {
  const permissions = await getOrLoadPermissions();
  if (!permissions.loadedFromManifest) return; // No manifest = allow all
  if (!isCommandAllowed(commandName, permissions)) {
    throw new Error(
      `Command '${commandName}' is not allowed for ${permissions.role} role`
    );
  }
}
```

### Synchronous Guard

For cases where permissions are already cached:

```typescript
function guardCommandSync(commandName: string): boolean {
  // Uses cached permissions (no async)
  // Returns false if permissions aren't loaded yet
  // Returns true if no manifest loaded (allow all)
}
```

### Command Brief Generation

Generate markdown listing available commands for inclusion in session prompts:

```typescript
function generateCommandBrief(permissions: CommandPermissions): string {
  // Returns formatted markdown with:
  // - Role and strategy header
  // - Grouped commands (Core, report, task, session, etc.)
  // - Count of hidden commands
}
```

This is used by `WhoamiRenderer` to include available commands in the `maestro whoami` output.

## Key Design Decisions

### Workers Can Create But Cannot Modify Task Status

Workers can create new tasks using `task:create`, but are intentionally restricted from using `task:update`, `task:complete`, and `task:block`. This ensures:

1. **Clear ownership**: Only users and orchestrators decide when a task is truly "completed" or "blocked"
2. **Safety**: A worker reporting "complete" via `maestro report complete` updates `sessionStatus` to `completed`, but `task.status` remains `in_progress` until a human or orchestrator confirms
3. **Separation of concerns**: `sessionStatus` = what the agent thinks, `status` = the authoritative task state

### Report vs Task Commands

| Command | Modifies | Available To | Purpose |
|---------|----------|-------------|---------|
| `maestro report progress` | `sessionStatus` (with `--task`) | Worker + Orchestrator | Report agent activity |
| `maestro report complete` | `sessionStatus` (with `--task`) or session status (without) | Worker + Orchestrator | Report agent finished |
| `maestro task update` | `status` | Orchestrator only | Change task lifecycle |
| `maestro task complete` | `status` | Orchestrator only | Mark task done |
| `maestro task block` | `status` | Orchestrator only | Mark task blocked |

### Report Command Targeting

All report commands accept an optional `--task <ids>` flag (comma-separated):

- **With `--task`**: Updates `sessionStatus` on specified tasks + posts timeline event per task
- **Without `--task`**: Posts session timeline event only (no task sessionStatus change)
- **Special: `report complete` without `--task`**: Also marks the **session** as completed via `PATCH /api/sessions/{sessionId}` with `status: 'completed'`

### Orchestrator Timeline Events

When orchestrators use `task update`, `task complete`, or `task block`, a timeline event is posted for audit trail:
```
POST /api/sessions/{sessionId}/timeline
{ "type": "task_status_changed", "message": "Status changed to completed", "taskId": "task-1" }
```

## Use Cases

### 1. Restrict Worker Actions

Prevent workers from doing anything beyond reporting:

```json
{
  "role": "worker",
  "session": {
    "allowedCommands": [
      "whoami",
      "task:get",
      "report:progress",
      "report:complete"
    ]
  }
}
```

### 2. Queue-Only Worker

Only allow queue operations:

```json
{
  "role": "worker",
  "strategy": "queue",
  "session": {
    "allowedCommands": [
      "whoami",
      "queue:start",
      "queue:complete",
      "queue:fail",
      "report:progress"
    ]
  }
}
```

### 3. Read-Only Session

Create a session that can only view data:

```json
{
  "role": "worker",
  "session": {
    "permissionMode": "readOnly",
    "allowedCommands": [
      "whoami",
      "task:get",
      "task:list",
      "session:info"
    ]
  }
}
```

## Benefits

- **Security**: Prevents agents from executing inappropriate commands
- **Clarity**: Agents know exactly what they can do
- **Flexibility**: Custom command sets for specialized workflows
- **Consistency**: Same permission model across all sessions
- **Discoverability**: `maestro commands` shows what's available

---

**Related Documentation**:
- [01-MANIFEST-SCHEMA.md](./01-MANIFEST-SCHEMA.md) - Manifest structure
- [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md) - All CLI commands
- [Worker Strategies](./01-MANIFEST-SCHEMA.md#worker-strategies) - Strategy details
