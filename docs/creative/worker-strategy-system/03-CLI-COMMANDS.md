# CLI Commands

## Overview

New CLI commands for the Worker Strategy System. Commands are organized by:
1. **Common commands** - Available to all worker types
2. **Worker-specific commands** - Only available to specific worker types

## Command Structure

```bash
maestro <resource> <action> [options]

# Examples:
maestro worker init           # Initialize worker for current session
maestro who-am-i              # Get worker type and available commands
maestro queue top             # Queue worker: peek at next task
maestro dag ready             # DAG worker: list ready tasks
```

## Common Commands

### `maestro worker init`

Initialize the worker loop for a session.

```bash
maestro worker init [sessionId] [options]

Options:
  --type <workerType>    Override worker type from manifest
  --dry-run              Show what would happen without executing

# Example output:
$ maestro worker init sess_abc123

✓ Session: sess_abc123
✓ Worker Type: queue
✓ Tasks in queue: 5
✓ Worker initialized

Run 'maestro who-am-i' to see your instructions.
Run 'maestro queue start' to begin processing.
```

**Implementation:**
```typescript
// src/commands/worker/init.ts
async function workerInit(sessionId: string, options: WorkerInitOptions) {
  // 1. Load session manifest
  const manifest = await loadManifest(sessionId);

  // 2. Determine worker type
  const workerType = options.type || manifest.workerType || 'queue';

  // 3. Initialize data structure with tasks
  const ds = await initializeDataStructure(sessionId, workerType, manifest.tasks);

  // 4. Update task statuses to 'queued'
  for (const task of manifest.tasks) {
    await updateTaskSessionStatus(task.taskId, sessionId, 'queued');
  }

  // 5. Emit initialization event
  await notify('worker:initialized', { sessionId, workerType, taskCount: ds.items.length });
}
```

### `maestro who-am-i`

Display worker identity and available commands.

```bash
maestro who-am-i [sessionId]

# Example output for queue worker:
$ maestro who-am-i

╔══════════════════════════════════════════════════════════╗
║                     QUEUE WORKER                          ║
╠══════════════════════════════════════════════════════════╣
║ Session: sess_abc123                                      ║
║ Project: My Project                                       ║
║ Tasks: 5 queued, 0 processing, 0 completed                ║
╠══════════════════════════════════════════════════════════╣
║ AVAILABLE COMMANDS                                        ║
╠══════════════════════════════════════════════════════════╣
║ maestro queue top       View next task                    ║
║ maestro queue start     Start working on next task        ║
║ maestro queue complete  Mark current task complete        ║
║ maestro queue fail      Mark current task failed          ║
║ maestro queue skip      Skip current task                 ║
║ maestro queue list      List all queued tasks             ║
║ maestro queue add       Add task to queue                 ║
╠══════════════════════════════════════════════════════════╣
║ WORKFLOW                                                  ║
║ 1. Run 'maestro queue start' to begin                     ║
║ 2. Work on the task                                       ║
║ 3. Run 'maestro queue complete' or 'maestro queue fail'   ║
║ 4. Repeat until queue is empty                            ║
╚══════════════════════════════════════════════════════════╝
```

**Implementation:**
```typescript
// src/commands/worker/who-am-i.ts
async function whoAmI(sessionId: string) {
  const session = await getSession(sessionId);
  const workerType = getWorkerType(session.workerType);
  const ds = await getDataStructure(sessionId);

  // Output formatted worker info
  console.log(formatWorkerInfo(workerType, session, ds));
}
```

---

## Queue Worker Commands

### `maestro queue top`

Peek at the next task without starting it.

```bash
maestro queue top [sessionId]

# Output:
$ maestro queue top

Next Task:
──────────────────────────────────
ID:          task_abc123
Title:       Implement user authentication
Priority:    Medium
Description: Add JWT-based auth with refresh tokens
Status:      queued
Position:    1 of 5
──────────────────────────────────

Run 'maestro queue start' to begin working on this task.
```

### `maestro queue start`

Start working on the next task in queue.

```bash
maestro queue start [sessionId]

# Output:
$ maestro queue start

Starting Task:
──────────────────────────────────
ID:          task_abc123
Title:       Implement user authentication
Description: Add JWT-based auth with refresh tokens
──────────────────────────────────

Task status updated to 'processing'.
Begin your work now.

When done, run:
  'maestro queue complete' - if successful
  'maestro queue fail'     - if unable to complete
```

**Server Actions:**
1. Set `currentItem` to front of queue
2. Update item status to `processing`
3. Update task's session status to `processing`
4. Emit `ds:current_item_changed` event

### `maestro queue complete`

Complete the current task.

```bash
maestro queue complete [sessionId] [--message <msg>]

Options:
  --message, -m    Completion message/notes

# Output:
$ maestro queue complete --message "Implemented JWT auth with refresh tokens"

✓ Task Completed: task_abc123
  Title: Implement user authentication
  Duration: 15m 32s

Remaining: 4 tasks in queue

Run 'maestro queue start' for next task.
```

**Server Actions:**
1. Remove item from queue
2. Add to history with `completed` status
3. Update task's session status to `completed`
4. Set `currentItem` to null
5. Emit events

### `maestro queue fail`

Mark the current task as failed.

```bash
maestro queue fail [sessionId] [--reason <reason>] [--retry]

Options:
  --reason, -r     Failure reason
  --retry          Move task to back of queue instead of removing

# Output:
$ maestro queue fail --reason "Missing API credentials" --retry

✗ Task Failed: task_abc123
  Title: Implement user authentication
  Reason: Missing API credentials
  Action: Moved to back of queue for retry

Remaining: 5 tasks in queue (including retry)
```

### `maestro queue skip`

Skip the current task.

```bash
maestro queue skip [sessionId] [--reason <reason>]

# Output:
$ maestro queue skip --reason "Blocked by task_xyz"

⊘ Task Skipped: task_abc123
  Title: Implement user authentication
  Reason: Blocked by task_xyz

Remaining: 4 tasks in queue
```

### `maestro queue list`

List all tasks in the queue.

```bash
maestro queue list [sessionId] [--format <format>]

Options:
  --format    Output format: table, json, minimal

# Output:
$ maestro queue list

Queue Status: 5 tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 #  │ ID           │ Title                    │ Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1  │ task_abc123  │ Implement auth           │ processing ⚙️
 2  │ task_def456  │ Add user profile page    │ queued
 3  │ task_ghi789  │ Write auth tests         │ queued
 4  │ task_jkl012  │ Setup CI pipeline        │ queued
 5  │ task_mno345  │ Documentation            │ queued
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `maestro queue add`

Add a task to the queue.

```bash
maestro queue add <taskId> [sessionId] [--position <pos>]

Options:
  --position    Position in queue (default: end)
                Use 'front' to add to front, or a number

# Output:
$ maestro queue add task_new123

✓ Added to queue: task_new123
  Title: New feature request
  Position: 6 of 6 (end of queue)
```

---

## Stack Worker Commands

### `maestro stack top`

View the top of the stack.

```bash
maestro stack top [sessionId]
```

### `maestro stack start`

Start working on top task.

```bash
maestro stack start [sessionId]
```

### `maestro stack complete`

Complete and pop the top task.

```bash
maestro stack complete [sessionId] [--message <msg>]
```

### `maestro stack fail`

Fail and pop the top task.

```bash
maestro stack fail [sessionId] [--reason <reason>]
```

### `maestro stack push`

Push a task to top of stack (for subtasks).

```bash
maestro stack push <taskId> [sessionId]

# Output:
$ maestro stack push task_subtask123

✓ Pushed to stack: task_subtask123
  Title: Implement helper function
  Stack depth: 4

Current task paused. New task at top.
Complete subtask first, then return to parent.
```

### `maestro stack list`

List all tasks in the stack.

```bash
maestro stack list [sessionId]

# Output:
$ maestro stack list

Stack Status: 4 tasks (depth)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Depth │ ID           │ Title                   │ Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TOP→  │ task_sub123  │ Implement helper        │ processing ⚙️
   2   │ task_abc123  │ Implement auth          │ queued (paused)
   3   │ task_def456  │ Add profile page        │ queued
 BOT   │ task_ghi789  │ Setup project           │ queued
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DAG Worker Commands

### `maestro dag ready`

List tasks ready to be worked on (no pending dependencies).

```bash
maestro dag ready [sessionId]

# Output:
$ maestro dag ready

Ready Tasks (dependencies satisfied):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ID           │ Title                   │ Dependents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 task_abc123  │ Setup database          │ 3 tasks waiting
 task_def456  │ Create API types        │ 2 tasks waiting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run 'maestro dag start <taskId>' to begin one.
```

### `maestro dag start`

Start working on a specific ready task.

```bash
maestro dag start <taskId> [sessionId]

# Output:
$ maestro dag start task_abc123

Starting Task:
──────────────────────────────────
ID:          task_abc123
Title:       Setup database
Dependents:  task_ghi789, task_jkl012, task_mno345
──────────────────────────────────

Completing this will unlock 3 dependent tasks.
```

### `maestro dag complete`

Complete the current task and unlock dependents.

```bash
maestro dag complete [sessionId]

# Output:
$ maestro dag complete

✓ Task Completed: task_abc123
  Title: Setup database

Unlocked Tasks:
  - task_ghi789: Create user table (now ready)
  - task_jkl012: Create session table (still waiting on task_def456)
  - task_mno345: Setup migrations (now ready)

Run 'maestro dag ready' to see available tasks.
```

### `maestro dag fail`

Fail the current task.

```bash
maestro dag fail [sessionId] [--reason <reason>] [--skip-dependents]

Options:
  --skip-dependents    Mark all dependent tasks as skipped

# Output:
$ maestro dag fail --reason "Invalid schema"

✗ Task Failed: task_abc123
  Title: Setup database
  Reason: Invalid schema

Blocked Tasks:
  - task_ghi789: Create user table (blocked)
  - task_jkl012: Create session table (blocked)
  - task_mno345: Setup migrations (blocked)

Warning: 3 tasks are now blocked by this failure.
```

### `maestro dag status`

Show overall DAG status.

```bash
maestro dag status [sessionId]

# Output:
$ maestro dag status

DAG Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Total:      12 tasks
 Completed:   4 (33%)
 Processing:  1
 Ready:       2
 Blocked:     3
 Failed:      2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Progress: [████████░░░░░░░░░░░░░░░░] 33%
```

### `maestro dag visualize`

Show ASCII visualization of the DAG.

```bash
maestro dag visualize [sessionId]

# Output:
$ maestro dag visualize

       [task_1] ✓            [task_2] ✓
           │                     │
           └──────────┬──────────┘
                      │
                 [task_3] ⚙️
                      │
           ┌──────────┼──────────┐
           │          │          │
      [task_4] 🚫 [task_5] ⏳  [task_6] ⏳
           │          │          │
           └──────────┴──────────┘
                      │
                 [task_7] 🔒

Legend: ✓ completed  ⚙️ processing  ⏳ ready  🔒 blocked  🚫 failed
```

---

## Priority Worker Commands

### `maestro priority top`

View the highest priority task.

```bash
maestro priority top [sessionId]
```

### `maestro priority start`

Start working on highest priority task.

```bash
maestro priority start [sessionId]
```

### `maestro priority complete`

Complete the current task.

```bash
maestro priority complete [sessionId]
```

### `maestro priority fail`

Fail the current task.

```bash
maestro priority fail [sessionId] [--reason <reason>]
```

### `maestro priority add`

Add a task with specific priority.

```bash
maestro priority add <taskId> [sessionId] --priority <1-5>

# Output:
$ maestro priority add task_urgent --priority 5

✓ Added with priority CRITICAL (5): task_urgent
  Title: Fix production bug
  Position: 1 (top - highest priority)
```

### `maestro priority bump`

Increase a task's priority.

```bash
maestro priority bump <taskId> [sessionId] [--to <priority>]

# Output:
$ maestro priority bump task_abc123 --to 4

✓ Priority increased: task_abc123
  Title: Add caching
  Previous: 2 (Low)
  New: 4 (High)
  Position: 2 → 1
```

### `maestro priority list`

List tasks by priority.

```bash
maestro priority list [sessionId]

# Output:
$ maestro priority list

Priority Queue: 6 tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Pri │ ID           │ Title                    │ Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ★★★★★ │ task_urg123  │ Fix production bug       │ processing ⚙️
 ★★★★☆ │ task_abc123  │ Add caching              │ queued
 ★★★☆☆ │ task_def456  │ Implement feature        │ queued
 ★★★☆☆ │ task_ghi789  │ Refactor module          │ queued
 ★★☆☆☆ │ task_jkl012  │ Update docs              │ queued
 ★☆☆☆☆ │ task_mno345  │ Code cleanup             │ queued
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Command Validation

Commands are validated against the session's worker type:

```typescript
// src/middleware/command-validator.ts
async function validateCommand(sessionId: string, command: string): Promise<void> {
  const session = await getSession(sessionId);
  const workerType = getWorkerType(session.workerType);

  if (!workerType.allowedCommands.includes(command)) {
    throw new CommandNotAllowedError(
      `Command '${command}' is not available for ${workerType.name}.\n` +
      `Allowed commands: ${workerType.allowedCommands.join(', ')}`
    );
  }
}
```

**Error Example:**
```bash
$ maestro stack push task_123  # When session is queue worker

Error: Command 'stack push' is not available for Queue Worker.
This session uses the 'queue' worker type.

Run 'maestro who-am-i' to see available commands.
```

## Command Registration

```typescript
// src/commands/index.ts
import { program } from 'commander';

// Common commands
program.command('worker').addCommand(initCommand).addCommand(whoAmICommand);

// Queue commands
const queueCmd = program.command('queue');
queueCmd.command('top').action(queueTop);
queueCmd.command('start').action(queueStart);
queueCmd.command('complete').action(queueComplete);
queueCmd.command('fail').action(queueFail);
queueCmd.command('skip').action(queueSkip);
queueCmd.command('list').action(queueList);
queueCmd.command('add').action(queueAdd);

// Stack commands
const stackCmd = program.command('stack');
// ... similar pattern

// DAG commands
const dagCmd = program.command('dag');
// ... similar pattern

// Priority commands
const priorityCmd = program.command('priority');
// ... similar pattern
```
