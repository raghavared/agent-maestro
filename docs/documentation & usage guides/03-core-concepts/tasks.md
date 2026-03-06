# Tasks

**A task is a unit of work with a title, description, status, and priority. Tasks are the backbone of Maestro — everything revolves around them.**

---

## What is a Task?

A task describes something that needs to happen. It could be "Build the login page," "Fix the memory leak in the WebSocket handler," or "Refactor the database layer." Every task has:

- A **title** and **description** that tell Claude what to do
- A **status** that tracks where it is in its lifecycle
- A **priority** that signals importance
- Optional **dependencies**, **subtasks**, and **acceptance criteria**

```bash
maestro task create "Build the login page" \
  --desc "Create a login form with email/password fields, validation, and OAuth support" \
  --priority high
```

## Why Tasks Matter

Tasks are how you communicate intent to Claude sessions. When you spawn a session and assign it a task, Claude reads the task's title, description, and context to understand what it needs to do. Clear tasks → better results.

Tasks also give you visibility. Instead of wondering "what is that Claude session doing?", you check the task status. In progress? Blocked? Completed? The task tells you.

## The Task Lifecycle

Every task moves through a lifecycle of statuses:

```
todo → in_progress → completed
              ↓
           blocked → in_progress → completed
              ↓
          cancelled
```

| Status | Meaning |
|--------|---------|
| `todo` | Not started yet. Waiting to be picked up. |
| `in_progress` | Actively being worked on by a session. |
| `in_review` | Work is done, awaiting human review. |
| `completed` | Finished. Acceptance criteria met. |
| `blocked` | Can't proceed. Something is in the way. |
| `cancelled` | Abandoned. No longer needed. |
| `archived` | Removed from active view but preserved. |

### Updating status

```bash
# Mark as in progress
maestro task update <task-id> --status in_progress

# Mark as completed
maestro task complete <task-id>

# Mark as blocked with a reason
maestro task block <task-id> --reason "Waiting on API schema from backend team"
```

### Reporting from inside a session

When Claude is working on a task, it reports progress directly:

```bash
# Report progress
maestro task report progress <task-id> "Login form UI is done, starting validation logic"

# Report completion
maestro task report complete <task-id> "Login page implemented with email/password and Google OAuth"

# Report a blocker
maestro task report blocked <task-id> "Need the OAuth client ID before I can test"

# Report an error
maestro task report error <task-id> "Tests failing due to missing test database"
```

## Task Data Model

```typescript
interface Task {
  id: string;
  projectId: string;
  parentId: string | null;         // null = top-level task
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  taskSessionStatuses?: Record<string, TaskSessionStatus>;
  sessionIds: string[];            // Sessions assigned to this task
  skillIds: string[];              // Skills required
  dependencies: string[];          // Task IDs that must complete first
  teamMemberId?: string;           // Assigned team member
  teamMemberIds?: string[];        // Multiple assignees
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}
```

Tasks are stored as JSON files at `~/.maestro/data/tasks/<task-id>.json`.

## Task Hierarchies

Tasks can have subtasks, and subtasks can have their own subtasks. This lets you break down complex work:

```bash
# Create a parent task
maestro task create "Build authentication system" --priority high

# Create subtasks under it
maestro task create "Build login page" --parent <parent-id>
maestro task create "Build registration page" --parent <parent-id>
maestro task create "Implement JWT token handling" --parent <parent-id>
```

### Viewing the hierarchy

```bash
# See direct children of a task
maestro task children <task-id>

# See the full subtask tree recursively
maestro task children <task-id> --recursive

# See the entire project's task tree
maestro task tree
```

## Task Dependencies

Tasks can depend on other tasks. A dependency means "don't start this until that is done."

```bash
maestro task edit <task-id>
# Set dependencies in the editor
```

Dependencies are stored as an array of task IDs in the `dependencies` field. Orchestrators use these to determine execution order — they won't assign a task to a worker until all its dependencies are completed.

## Per-Session Task Status

Here's a powerful concept: **multiple sessions can work on the same task**, and each one tracks its own status independently.

The `taskSessionStatuses` field is a map of session ID → status:

```typescript
taskSessionStatuses: {
  "sess_abc": { status: "in_progress", updatedAt: 1709234567890 },
  "sess_def": { status: "completed", updatedAt: 1709234599000 }
}
```

**Why this matters:** Imagine you assign the same "Write tests" task to two different Claude sessions — one for unit tests, one for integration tests. Each session can report its own progress without overwriting the other.

## Working with Tasks

### Create a task

```bash
maestro task create "Build the API endpoint" \
  --desc "POST /api/users — validates input, creates user, returns 201" \
  --priority high \
  --parent <parent-task-id>
```

### List tasks

```bash
# All tasks in the current project
maestro task list

# Filter by status
maestro task list --status todo

# Filter by priority
maestro task list --priority high

# Include all statuses (even completed/archived)
maestro task list --all
```

### View a specific task

```bash
maestro task get <task-id>
```

### Edit a task

```bash
maestro task edit <task-id>
```

### Delete a task

```bash
# Delete a single task
maestro task delete <task-id>

# Delete a task and all its subtasks
maestro task delete <task-id> --cascade
```

### Attach documentation

```bash
# Add a doc reference to a task
maestro task docs add <task-id> "API Spec" --file ./api-spec.md

# List docs attached to a task
maestro task docs list <task-id>
```

## Best Practices

1. **Write clear descriptions.** The description is what Claude reads. Be specific about what "done" looks like.
2. **Use priorities.** `high` = do this first. `medium` = do this soon. `low` = do this when everything else is done.
3. **Break big tasks down.** If a task has more than one deliverable, split it into subtasks.
4. **Use dependencies sparingly.** Only add a dependency when there's a real ordering constraint.

> **Next:** [Sessions](./sessions.md) — The Claude instances that execute your tasks.
