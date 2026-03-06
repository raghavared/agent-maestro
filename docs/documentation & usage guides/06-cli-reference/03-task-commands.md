# Task Commands

Manage tasks within a project. Tasks represent units of work that sessions execute.

## maestro task list

List tasks with optional filters. Can also show a specific task and its subtree.

### Syntax

```
maestro task list [taskId] [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | No | Show a specific task and its children |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--status <status>` | string | — | Filter by status (`todo`, `in_progress`, `in_review`, `completed`, `cancelled`, `blocked`, `archived`) |
| `--priority <priority>` | string | — | Filter by priority (`low`, `medium`, `high`) |
| `--all` | boolean | `false` | Show all tasks (ignore project context) |

### Example

```bash
maestro task list --status in_progress --priority high
```

```
⏳ [task_abc123] Implement auth module (in_progress) [high]
  🔄 [task_def456] Add JWT validation (in_progress) [high]
  ⏳ [task_ghi789] Add refresh token flow (todo) [high]
```

### Related Commands

- `maestro task get` — Get full task details
- `maestro task tree` — Show hierarchical tree view

---

## maestro task create

Create a new task.

### Syntax

```
maestro task create [title] [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `title` | Yes* | Task title (*can also be passed via `--title`) |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t, --title <title>` | string | — | Task title (alternative to positional argument) |
| `-d, --desc <description>` | string | `""` | Task description |
| `--description <description>` | string | — | Task description (alias for `--desc`) |
| `--priority <priority>` | string | `medium` | Priority: `high`, `medium`, or `low` |
| `--parent <parentId>` | string | — | Parent task ID (creates a child/subtask) |

### Example

```bash
maestro task create "Add user authentication" \
  --desc "Implement JWT-based auth with refresh tokens" \
  --priority high \
  --parent task_root123
```

```
✔ Task created
  ID:     task_1772040830951_omhk
  Title:  Add user authentication
  Parent: task_root123
```

### Related Commands

- `maestro task list` — List all tasks
- `maestro task edit` — Edit an existing task
- `maestro task children` — List child tasks

---

## maestro task get

Get task details. If no ID is provided and the session context has exactly one task, that task is shown.

### Syntax

```
maestro task get [id]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | No | Task ID (defaults to session's single task if available) |

### Flags

None.

### Example

```bash
maestro task get task_1772040830951_omhk
```

```
  ID:          task_1772040830951_omhk
  Title:       Add user authentication
  Status:      in_progress
  Priority:    high
  Description: Implement JWT-based auth with refresh tokens
```

### Related Commands

- `maestro task edit` — Edit this task
- `maestro task complete` — Mark task as completed

---

## maestro task edit

Edit task fields (title, description, priority).

### Syntax

```
maestro task edit <id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task ID to edit |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--title <title>` | string | — | New title |
| `-d, --desc <description>` | string | — | New description |
| `--priority <priority>` | string | — | New priority (`high`, `medium`, `low`) |

### Example

```bash
maestro task edit task_abc123 --title "Updated title" --priority high
```

```
✔ Task updated
  Task updated successfully.
  Title:    Updated title
  Priority: high
```

### Related Commands

- `maestro task get` — View current task details
- `maestro task update` — Update task with status changes

---

## maestro task update

Update a task (including status changes).

### Syntax

```
maestro task update <id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task ID to update |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--status <status>` | string | — | New status (`todo`, `in_progress`, `in_review`, `completed`, `cancelled`, `blocked`) |
| `--priority <priority>` | string | — | New priority |
| `--title <title>` | string | — | New title |

### Example

```bash
maestro task update task_abc123 --status in_progress
```

```
✔ Task updated
  Task updated successfully.
```

### Related Commands

- `maestro task edit` — Edit task fields
- `maestro task complete` — Shortcut to mark as completed

---

## maestro task complete

Mark a task as completed.

### Syntax

```
maestro task complete <id>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task ID to complete |

### Flags

None.

### Example

```bash
maestro task complete task_abc123
```

```
✔ Task completed
```

### Related Commands

- `maestro task update` — Update task with other statuses
- `maestro task block` — Mark task as blocked

---

## maestro task block

Mark a task as blocked with a reason.

### Syntax

```
maestro task block <id> --reason <reason>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task ID to block |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--reason <reason>` | string | **Required** | Reason for blocking |

### Example

```bash
maestro task block task_abc123 --reason "Waiting for API key from external provider"
```

```
✔ Task blocked
  Task task_abc123 marked as blocked
     Reason: Waiting for API key from external provider
```

### Related Commands

- `maestro task update` — Update task status
- `maestro task complete` — Mark as completed

---

## maestro task delete

Delete a task. Optionally cascade-delete all child tasks.

### Syntax

```
maestro task delete <id> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Task ID to delete |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--cascade` | boolean | `false` | Also delete all child tasks (subtasks) recursively |

### Example

```bash
maestro task delete task_abc123 --cascade
```

```
✔ Task deleted (3 subtasks also removed)
```

### Related Commands

- `maestro task list` — List remaining tasks
- `maestro task children` — View child tasks before deleting

---

## maestro task children

List child tasks of a parent task.

### Syntax

```
maestro task children <taskId> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Parent task ID |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--recursive` | boolean | `false` | Include all descendants (children, grandchildren, etc.) |

### Example

```bash
maestro task children task_root123 --recursive
```

```
Child Tasks of task_root123 (4):
  🔄 [task_child1] Set up database schema (in_progress)
  ⏳ [task_child2] Create API endpoints (todo)
    ⏳ [task_grandchild1] GET /users endpoint (todo)
    ⏳ [task_grandchild2] POST /users endpoint (todo)
```

### Related Commands

- `maestro task tree` — Show full project task tree
- `maestro task create --parent` — Create a child task

---

## maestro task tree

Show hierarchical tree of all project tasks.

### Syntax

```
maestro task tree [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--root <taskId>` | string | — | Start tree from a specific task |
| `--depth <n>` | number | — | Maximum depth to display |
| `--status <status>` | string | — | Filter by status |

### Example

```bash
maestro task tree --depth 2
```

```
Project Task Tree (proj_1770533548982_3bgiz):

⏳ [task_root1] Build Authentication System (todo) [high]
  🔄 [task_child1] Implement JWT middleware (in_progress) [high]
  ⏳ [task_child2] Add OAuth2 providers (todo) [medium]
✅ [task_root2] Set up CI/CD pipeline (completed) [medium]
```

### Related Commands

- `maestro task list` — List tasks in flat format
- `maestro task children` — List children of a specific task

---

## maestro task docs add

Add a documentation entry to a task.

### Syntax

```
maestro task docs add <taskId> <title> --file <filePath> [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID to attach the doc to |
| `title` | Yes | Title of the document |

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--file <filePath>` | string | **Required** | File path for the document |
| `--content <content>` | string | — | Content of the doc (reads file if not provided) |

### Example

```bash
maestro task docs add task_abc123 "API Design" --file ./docs/api-design.md
```

```
✔ Doc added to task
  Title: API Design
  File:  ./docs/api-design.md
  Task:  task_abc123
```

### Related Commands

- `maestro task docs list` — List docs for a task
- `maestro session docs add` — Add docs to a session

---

## maestro task docs list

List documentation entries for a task (aggregated from all sessions).

### Syntax

```
maestro task docs list <taskId>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `taskId` | Yes | Task ID to list docs for |

### Flags

None.

### Example

```bash
maestro task docs list task_abc123
```

```
┌──────────┬────────────────┬──────────────────────┬─────────────────────┐
│ ID       │ Title          │ File Path            │ Added At            │
├──────────┼────────────────┼──────────────────────┼─────────────────────┤
│ doc_001  │ API Design     │ ./docs/api-design.md │ 3/5/2026, 10:30 AM  │
│ doc_002  │ Test Plan      │ ./docs/test-plan.md  │ 3/5/2026, 11:15 AM  │
└──────────┴────────────────┴──────────────────────┴─────────────────────┘
```

### Related Commands

- `maestro task docs add` — Add a doc to a task
